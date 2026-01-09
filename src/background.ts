// Background service worker for the extension

import { GoogleGenAI, Type } from '@google/genai';
import type { ExtensionMessage, ExtensionState, SourceDocument, VerificationResult } from '../types';

const STORAGE_KEY = 'gemini_api_key';
const STATE_KEY = 'extension_state';

function getDefaultState(): ExtensionState {
  return {
    aiOverviewDetected: false,
    selectedText: '',
    sourceUrls: [],
    apiKeySet: false
  };
}

async function getState(): Promise<ExtensionState> {
  const result = await chrome.storage.local.get(STATE_KEY);
  return result[STATE_KEY] || getDefaultState();
}

async function setState(state: ExtensionState): Promise<void> {
  await chrome.storage.local.set({ [STATE_KEY]: state });
}

async function getApiKey(): Promise<string> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  return result[STORAGE_KEY] || '';
}

async function setApiKey(apiKey: string): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: apiKey });
}

async function fetchPageContent(url: string): Promise<string> {
  try {
    const response = await fetch(url);
    const html = await response.text();

    // Extract text from HTML without DOMParser (not available in Service Workers)
    let text = html
      // Remove script tags and their content
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
      // Remove style tags and their content
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
      // Remove HTML comments
      .replace(/<!--[\s\S]*?-->/g, ' ')
      // Remove all HTML tags
      .replace(/<[^>]+>/g, ' ')
      // Decode common HTML entities
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&[a-z]+;/gi, ' ')
      // Clean up whitespace
      .replace(/\s+/g, ' ')
      .trim();

    return text.slice(0, 15000);
  } catch (error) {
    console.error('Failed to fetch page:', url, error);
    throw error;
  }
}

async function verifyWithGemini(
  claim: string,
  sources: SourceDocument[]
): Promise<VerificationResult> {
  const apiKey = await getApiKey();

  if (!apiKey) {
    throw new Error('No API key configured. Please set your Gemini API key in settings.');
  }

  const ai = new GoogleGenAI({ apiKey });
  const validSources = sources.filter(s => s.status === 'fetched' && s.content);

  if (validSources.length === 0) {
    return {
      status: 'inconclusive',
      evidence: [],
      explanation: 'Could not fetch content from any source URLs.'
    };
  }

  const sourcesText = validSources.map((s, index) =>
    `SOURCE ${index + 1} (${s.url}):\n${s.content}\n---`
  ).join('\n');

  const prompt = `
    You are a rigorous fact-checking assistant.
    User Claim: "${claim}"

    Below are the contents of several web pages cited as attribution.
    Your task is to search these sources for EXACT text that supports the claim.

    ${sourcesText}

    Instructions:
    1. Analyze the sources to find sentences that directly support the claim.
    2. If found, extract the exact quote and the URL of the source it came from.
    3. Determine if the claim is "supported", "unsupported" (contradicted), "partial" (some parts supported, others not), or "inconclusive" (not found in sources).
    4. Provide a brief explanation.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            status: {
              type: Type.STRING,
              enum: ['supported', 'unsupported', 'partial', 'inconclusive'],
              description: 'The verification status of the claim.'
            },
            evidence: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  quote: { type: Type.STRING, description: 'The exact quote from the source.' },
                  sourceUrl: { type: Type.STRING, description: 'The URL of the source where the quote was found.' }
                },
                required: ['quote', 'sourceUrl']
              },
              description: 'Exact quotes and their source URLs supporting the verification status.'
            },
            explanation: {
              type: Type.STRING,
              description: 'A concise explanation of the findings.'
            }
          },
          required: ['status', 'evidence', 'explanation']
        }
      }
    });

    const resultText = response.text;
    if (!resultText) throw new Error('Empty response from Gemini');

    return JSON.parse(resultText) as VerificationResult;
  } catch (error) {
    console.error('Gemini verification error:', error);
    throw error;
  }
}

// Handle messages from content script and side panel
chrome.runtime.onMessage.addListener((message: ExtensionMessage, sender, sendResponse) => {
  const tabId = sender.tab?.id;

  switch (message.type) {
    case 'AI_OVERVIEW_DETECTED': {
      (async () => {
        console.log('[Background] AI Overview detected with URLs:', message.urls);
        const state = await getState();
        state.aiOverviewDetected = true;
        state.sourceUrls = message.urls;
        await setState(state);

        if (tabId) {
          // Enable side panel for this tab
          chrome.sidePanel.setOptions({
            tabId,
            path: 'sidepanel.html',
            enabled: true
          });

          // Show badge to indicate AI Overview detected
          chrome.action.setBadgeText({ text: 'AI', tabId });
          chrome.action.setBadgeBackgroundColor({ color: '#9333ea', tabId });
        }
      })();
      break;
    }

    case 'TEXT_SELECTED': {
      (async () => {
        console.log('[Background] Text selected:', message.text.substring(0, 50));
        const state = await getState();
        state.selectedText = message.text;
        await setState(state);
      })();
      break;
    }

    case 'GET_STATE': {
      (async () => {
        const state = await getState();
        const apiKey = await getApiKey();
        state.apiKeySet = !!apiKey;
        sendResponse({ type: 'STATE_UPDATE', state });
      })();
      return true; // Will respond async
    }

    case 'SAVE_API_KEY': {
      setApiKey(message.apiKey).then(() => {
        sendResponse({ success: true });
      });
      return true;
    }

    case 'FETCH_PAGE': {
      fetchPageContent(message.url).then(content => {
        sendResponse({ type: 'PAGE_CONTENT', url: message.url, content });
      }).catch(error => {
        sendResponse({ type: 'PAGE_FETCH_ERROR', url: message.url, error: error.message });
      });
      return true;
    }

    case 'VERIFY_CLAIM': {
      verifyWithGemini(message.claim, message.sources).then(result => {
        sendResponse({ type: 'VERIFICATION_RESULT', result });
      }).catch(error => {
        sendResponse({ type: 'VERIFICATION_ERROR', error: error.message });
      });
      return true;
    }
  }
});

// Clean up state when tab closes
chrome.tabs.onRemoved.addListener(() => {
  // Reset state when tab closes
  setState(getDefaultState());
});

// Handle extension icon click - open side panel
chrome.action.onClicked.addListener((tab) => {
  if (tab.id) {
    chrome.sidePanel.open({ tabId: tab.id });
  }
});

console.log('[AI Overview Checker] Background service worker started');
