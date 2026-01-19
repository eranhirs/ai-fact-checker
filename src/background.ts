// Background service worker for the extension

import { GoogleGenAI, Type } from '@google/genai';
import type { ExtensionMessage, ExtensionState, SourceDocument, VerificationResult, TelemetryEvent, GeminiModel } from '../types';
import { sendTelemetryEvent, getTelemetryLevel, setTelemetryLevel, extractDomain } from './telemetry';

const STORAGE_KEY = 'gemini_api_key';
const STATE_KEY = 'extension_state';
const MAX_SOURCES_KEY = 'max_sources';
const MODEL_KEY = 'gemini_model';
const DEFAULT_MAX_SOURCES = 10;
const DEFAULT_MODEL: GeminiModel = 'gemini-3-flash-preview';

function getDefaultState(): ExtensionState {
  return {
    aiOverviewDetected: false,
    pageMode: 'inactive',
    selectedText: '',
    surroundingContext: '',
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

async function getModel(): Promise<GeminiModel> {
  const result = await chrome.storage.local.get(MODEL_KEY);
  return result[MODEL_KEY] || DEFAULT_MODEL;
}

async function setModel(model: GeminiModel): Promise<void> {
  await chrome.storage.local.set({ [MODEL_KEY]: model });
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
  const model = await getModel();

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
      model,
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

interface DecontextualizedClaim {
  decontextualizedClaim: string;
  wasModified: boolean;
}

async function decontextualizeClaim(
  claim: string,
  surroundingContext: string
): Promise<DecontextualizedClaim> {
  // If there's no context or the claim is already self-contained, skip decontextualization
  if (!surroundingContext || surroundingContext.trim().length === 0) {
    return { decontextualizedClaim: claim, wasModified: false };
  }

  const apiKey = await getApiKey();
  const model = await getModel();
  if (!apiKey) {
    // If no API key, return original claim
    return { decontextualizedClaim: claim, wasModified: false };
  }

  const ai = new GoogleGenAI({ apiKey });

  const prompt = `You are a text decontextualization assistant. Your task is to rewrite a selected text snippet to be self-contained and understandable without the original context.

SURROUNDING CONTEXT:
"""
${surroundingContext}
"""

SELECTED CLAIM (highlighted by user):
"""
${claim}
"""

INSTRUCTIONS:
1. Analyze the selected claim for any of the following issues that make it unclear without context:
   - Pronouns (it, they, this, that, he, she, its, their)
   - Demonstratives (this, that, these, those)
   - Relative references ("the function", "the value", "the process" when not defined)
   - Parenthetical fragments that reference something from the surrounding sentence
   - Incomplete phrases or sentence fragments that need their subject or object
2. If the claim has any of these issues, rewrite it to be a complete, self-contained statement by incorporating the necessary context.
3. Keep the rewritten claim concise and as close to the original meaning as possible.
4. If the claim is already self-contained and clear, return it unchanged.
5. The decontextualized claim must be factually equivalent to the original - do not add, remove, or alter any factual content.

Examples:
- Original: "It returns a string" with context about "The parseJSON function..." → "The parseJSON function returns a string"
- Original: "They can grow up to 30 feet" with context about "Blue whales..." → "Blue whales can grow up to 30 feet"
- Original: "(around 25Hz)" with context "The vibrations from purring (around 25Hz) are believed to help..." → "The vibrations from cats purring are around 25Hz"
- Original: "which helps with bone density" with context about purring → "Cat purring helps with bone density"
- Original: "The Earth orbits the Sun" (already clear) → "The Earth orbits the Sun"`;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            decontextualizedClaim: {
              type: Type.STRING,
              description: 'The rewritten claim that is self-contained and understandable without context.'
            },
            wasModified: {
              type: Type.BOOLEAN,
              description: 'True if the claim was modified, false if it was already self-contained.'
            }
          },
          required: ['decontextualizedClaim', 'wasModified']
        }
      }
    });

    const resultText = response.text;
    if (!resultText) {
      console.warn('[Background] Empty decontextualization response, using original claim');
      return { decontextualizedClaim: claim, wasModified: false };
    }

    const result = JSON.parse(resultText) as DecontextualizedClaim;
    console.log('[Background] Decontextualization result:', result);
    return result;
  } catch (error) {
    console.error('Decontextualization error:', error);
    // On error, return original claim
    return { decontextualizedClaim: claim, wasModified: false };
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
        // Clear previous decontextualized claim when new text is selected
        state.decontextualizedClaim = undefined;
        state.claimWasModified = undefined;
        // Store surrounding context for decontextualization
        if (message.surroundingContext) {
          state.surroundingContext = message.surroundingContext;
          console.log('[Background] Stored surrounding context, length:', message.surroundingContext.length);
        }
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

    case 'DECONTEXTUALIZE_CLAIM': {
      (async () => {
        const state = await getState();
        console.log('[Background] Decontextualizing claim:', message.claim);

        const { decontextualizedClaim, wasModified } = await decontextualizeClaim(
          message.claim,
          state.surroundingContext
        );

        // Update state immediately so SidePanel can show it
        if (wasModified) {
          state.decontextualizedClaim = decontextualizedClaim;
          state.claimWasModified = true;
          await setState(state);
        }

        sendResponse({
          type: 'DECONTEXTUALIZATION_RESULT',
          decontextualizedClaim,
          claimWasModified: wasModified
        });
      })();
      return true;
    }

    case 'VERIFY_CLAIM': {
      (async () => {
        const state = await getState();
        const startTime = Date.now();

        // Get the page URL where the user made the verification call (Google Search page)
        const pageUrl = sender.tab?.url || '';
        const domain = extractDomain(pageUrl);

        // Use the decontextualized claim from state if available, otherwise use original
        const claimToVerify = state.decontextualizedClaim || message.claim;
        const wasModified = state.claimWasModified || false;
        console.log('[Background] Verifying claim:', claimToVerify, 'wasModified:', wasModified);

        // Send verification_started event
        const startEvent: TelemetryEvent = {
          event_name: 'verification_started',
          timestamp: startTime,
          domain,
          source_count: message.sources.length,
          full_url: pageUrl,
          claim_text: claimToVerify,
          claim_length: claimToVerify.length,
          source_urls: message.sources.map(s => s.url),
        };
        sendTelemetryEvent(startEvent);

        try {
          const result = await verifyWithGemini(claimToVerify, message.sources);
          const endTime = Date.now();

          // Send verification_completed event
          const completedEvent: TelemetryEvent = {
            event_name: 'verification_completed',
            timestamp: endTime,
            domain,
            success: true,
            source_count: message.sources.length,
            full_url: pageUrl,
            claim_text: claimToVerify,
            claim_length: claimToVerify.length,
            source_urls: message.sources.map(s => s.url),
            verification_status: result.status,
            evidence_count: result.evidence.length,
            verify_duration_ms: endTime - startTime,
          };
          sendTelemetryEvent(completedEvent);

          // Include decontextualization info in the response
          // Always send the claim that was verified and whether it was modified
          sendResponse({
            type: 'VERIFICATION_RESULT',
            result,
            decontextualizedClaim: claimToVerify,
            claimWasModified: wasModified
          });
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
            claim_text: claimToVerify,
            claim_length: claimToVerify.length,
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

    case 'GET_MODEL': {
      getModel().then(model => {
        sendResponse({ model });
      });
      return true;
    }

    case 'SAVE_MODEL': {
      setModel(message.model).then(() => {
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
        state.surroundingContext = '';
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
      // Activate the generic content script (already loaded via manifest)
      chrome.tabs.sendMessage(tab.id, { type: 'ACTIVATE_GENERIC_CONTENT_SCRIPT' });
      console.log('[Background] Sent activation message to generic content script');
    }
  }
});

console.log('[AI Fact Checker] Background service worker started');
