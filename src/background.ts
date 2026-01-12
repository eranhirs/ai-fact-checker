// Background service worker for the extension

import { GoogleGenAI, Type } from '@google/genai';
import type { ExtensionMessage, ExtensionState, SourceDocument, VerificationResult, TelemetryEvent } from '../types';
import { sendTelemetryEvent, getTelemetryLevel, setTelemetryLevel, extractDomain } from './telemetry';

const STORAGE_KEY = 'gemini_api_key';
const STATE_KEY = 'extension_state';
const MAX_SOURCES_KEY = 'max_sources';
const DEFAULT_MAX_SOURCES = 10;

function getDefaultState(): ExtensionState {
  return {
    aiOverviewDetected: false,
    pageMode: 'inactive',
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

async function getMaxSources(): Promise<number> {
  const result = await chrome.storage.local.get(MAX_SOURCES_KEY);
  return result[MAX_SOURCES_KEY] ?? DEFAULT_MAX_SOURCES;
}

async function setMaxSources(maxSources: number): Promise<void> {
  await chrome.storage.local.set({ [MAX_SOURCES_KEY]: maxSources });
}

// Resolve redirect URLs to get the actual target URL
function resolveRedirectUrl(url: string): string {
  try {
    const parsed = new URL(url);

    // Handle Google redirect URLs (www.google.com/url?...)
    if (parsed.hostname === 'www.google.com' && parsed.pathname === '/url') {
      const targetUrl = parsed.searchParams.get('url') || parsed.searchParams.get('q');
      if (targetUrl) {
        // Recursively resolve in case the target is also a redirect
        return resolveRedirectUrl(targetUrl);
      }
    }

    // Handle Google grounding API redirect URLs
    // These need to be followed via HTTP to get the actual URL
    if (parsed.hostname === 'vertexaisearch.cloud.google.com' &&
        parsed.pathname.startsWith('/grounding-api-redirect/')) {
      // Return as-is, will be resolved via fetch redirect
      return url;
    }

    return url;
  } catch {
    return url;
  }
}

interface FetchResult {
  content: string;
  finalUrl: string;
}

// Cache to store already-fetched page content and avoid recrawling
// Key: original URL, Value: FetchResult
const pageContentCache = new Map<string, FetchResult>();

async function fetchPageContent(url: string): Promise<FetchResult> {
  // Check if we already have this URL cached
  const cachedResult = pageContentCache.get(url);
  if (cachedResult) {
    console.log('[Background] Using cached content for URL:', url);
    return cachedResult;
  }
  try {
    // First resolve any known redirect URL patterns
    const resolvedUrl = resolveRedirectUrl(url);
    console.log('[Background] Fetching URL:', resolvedUrl, resolvedUrl !== url ? `(resolved from ${url})` : '');

    // Fetch with redirect following enabled (default behavior)
    const response = await fetch(resolvedUrl);

    // Get the final URL after any redirects
    const finalUrl = response.url;
    if (finalUrl !== resolvedUrl) {
      console.log('[Background] Followed redirect to:', finalUrl);
    }

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

    const result: FetchResult = {
      content: text.slice(0, 15000),
      finalUrl
    };

    // Cache the result for future requests
    pageContentCache.set(url, result);
    // Also cache by final URL if different (handles redirects)
    if (finalUrl !== url) {
      pageContentCache.set(finalUrl, result);
    }

    return result;
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
        state.pageMode = 'ai_overview';
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
        // Update source URLs if prioritized URLs are provided
        if (message.prioritizedUrls && message.prioritizedUrls.length > 0) {
          state.sourceUrls = message.prioritizedUrls;
          console.log('[Background] Updated source URLs with', message.prioritizedUrls.length, 'prioritized URLs');
        }
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
      fetchPageContent(message.url).then(result => {
        sendResponse({
          type: 'PAGE_CONTENT',
          url: message.url,
          content: result.content,
          finalUrl: result.finalUrl
        });
      }).catch(error => {
        sendResponse({ type: 'PAGE_FETCH_ERROR', url: message.url, error: error.message });
      });
      return true;
    }

    case 'VERIFY_CLAIM': {
      (async () => {
        const state = await getState();
        const startTime = Date.now();

        // Get the page URL where the user made the verification call (Google Search page)
        const pageUrl = sender.tab?.url || '';
        const domain = extractDomain(pageUrl);

        // Send verification_started event
        const startEvent: TelemetryEvent = {
          event_name: 'verification_started',
          timestamp: startTime,
          domain,
          source_count: message.sources.length,
          full_url: pageUrl,
          claim_text: message.claim,
          claim_length: message.claim.length,
          source_urls: message.sources.map(s => s.url),
        };
        sendTelemetryEvent(startEvent);

        try {
          const result = await verifyWithGemini(message.claim, message.sources);
          const endTime = Date.now();

          // Send verification_completed event
          const completedEvent: TelemetryEvent = {
            event_name: 'verification_completed',
            timestamp: endTime,
            domain,
            success: true,
            source_count: message.sources.length,
            full_url: pageUrl,
            claim_text: message.claim,
            claim_length: message.claim.length,
            source_urls: message.sources.map(s => s.url),
            verification_status: result.status,
            evidence_count: result.evidence.length,
            verify_duration_ms: endTime - startTime,
          };
          sendTelemetryEvent(completedEvent);

          sendResponse({ type: 'VERIFICATION_RESULT', result });
        } catch (error: any) {
          const endTime = Date.now();

          // Send verification_error event
          const errorEvent: TelemetryEvent = {
            event_name: 'verification_error',
            timestamp: endTime,
            domain,
            success: false,
            source_count: message.sources.length,
            full_url: pageUrl,
            claim_text: message.claim,
            claim_length: message.claim.length,
            source_urls: message.sources.map(s => s.url),
            error_message: error.message,
            verify_duration_ms: endTime - startTime,
          };
          sendTelemetryEvent(errorEvent);

          sendResponse({ type: 'VERIFICATION_ERROR', error: error.message });
        }
      })();
      return true;
    }

    case 'GET_TELEMETRY_LEVEL': {
      getTelemetryLevel().then(level => {
        sendResponse({ level });
      });
      return true;
    }

    case 'SAVE_TELEMETRY_LEVEL': {
      setTelemetryLevel(message.level).then(() => {
        sendResponse({ success: true });
      });
      return true;
    }

    case 'GET_MAX_SOURCES': {
      getMaxSources().then(maxSources => {
        sendResponse({ maxSources });
      });
      return true;
    }

    case 'SAVE_MAX_SOURCES': {
      setMaxSources(message.maxSources).then(() => {
        sendResponse({ success: true });
      });
      return true;
    }

    case 'GENERIC_PAGE_ACTIVATED': {
      (async () => {
        console.log('[Background] Generic page activated');
        const state = await getState();
        state.pageMode = 'generic';
        state.aiOverviewDetected = false;
        state.selectedText = '';
        state.sourceUrls = [];
        await setState(state);
      })();
      break;
    }
  }
});

// Clean up state when tab closes
chrome.tabs.onRemoved.addListener(() => {
  // Reset state when tab closes
  setState(getDefaultState());
});

// Handle extension icon click - open side panel
chrome.action.onClicked.addListener(async (tab) => {
  if (tab.id) {
    // Open the side panel
    await chrome.sidePanel.open({ tabId: tab.id });

    const url = tab.url || '';
    const isGoogleSearch = url.includes('google.com/search');

    if (!isGoogleSearch) {
      // Inject generic content script for non-Google pages
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['generic-content-script.js']
        });
        console.log('[Background] Injected generic content script');
      } catch (error) {
        console.error('[Background] Failed to inject content script:', error);
        // Still update state to generic mode even if injection fails
        const state = await getState();
        state.pageMode = 'generic';
        state.aiOverviewDetected = false;
        state.selectedText = '';
        state.sourceUrls = [];
        await setState(state);
      }
    }
  }
});

console.log('[AI Fact Checker] Background service worker started');
