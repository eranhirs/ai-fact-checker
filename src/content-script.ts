// Content script for detecting AI Overview on Google Search pages

const AI_OVERVIEW_SELECTORS = [
  '[data-attrid*="ai_overview"]',
  '[data-sgrd="true"]',
  '.kp-wholepage-osrp',
  '#m-x-content',
  '[data-async-token]',
  '.wDYxhc[data-md]',
];

let aiOverviewElement: Element | null = null;
let lastSelectedText = '';

function findAIOverview(): Element | null {
  for (const selector of AI_OVERVIEW_SELECTORS) {
    const element = document.querySelector(selector);
    if (element) {
      // Verify it looks like an AI Overview by checking for characteristic content
      const text = element.textContent || '';
      if (text.length > 100) {
        return element;
      }
    }
  }

  // Fallback: Look for elements containing "AI Overview" text
  const allElements = document.querySelectorAll('div[class*="kp"], div[data-attrid]');
  for (const el of allElements) {
    const heading = el.querySelector('h2, [role="heading"]');
    if (heading && heading.textContent?.toLowerCase().includes('ai overview')) {
      return el;
    }
  }

  return null;
}

function cleanUrl(href: string): string | null {
  if (!href ||
      href.includes('google.com') ||
      href.includes('accounts.google') ||
      href.startsWith('javascript:') ||
      !href.startsWith('http')) {
    return null;
  }

  try {
    const url = new URL(href);
    if (url.hostname === 'www.google.com' && url.pathname === '/url') {
      return url.searchParams.get('url') || url.searchParams.get('q') || null;
    }
    return href;
  } catch {
    return href;
  }
}

function extractUrlsFromElement(container: Element, existingUrls: Set<string>): string[] {
  const urls: string[] = [];
  const links = container.querySelectorAll('a[href]');

  for (const link of links) {
    const cleanedUrl = cleanUrl((link as HTMLAnchorElement).href);
    if (cleanedUrl && !existingUrls.has(cleanedUrl)) {
      urls.push(cleanedUrl);
      existingUrls.add(cleanedUrl);
    }
  }

  return urls;
}

function extractSourceUrls(container: Element): string[] {
  const seen = new Set<string>();
  const urls: string[] = [];

  // Extract from AI output container
  urls.push(...extractUrlsFromElement(container, seen));

  // Also look for citation links in the broader search results
  const searchResults = document.querySelectorAll('#search a[href], #rso a[href]');
  for (const link of searchResults) {
    const cleanedUrl = cleanUrl((link as HTMLAnchorElement).href);
    if (cleanedUrl && !seen.has(cleanedUrl)) {
      urls.push(cleanedUrl);
      seen.add(cleanedUrl);
    }
  }

  // Dedupe and limit
  return urls.slice(0, 25);
}

// Extract URLs prioritized by proximity to a DOM node
function extractUrlsNearSelection(selectionNode: Node): string[] {
  const seen = new Set<string>();
  const prioritizedUrls: string[] = [];

  // Walk up the DOM tree, collecting URLs at each level
  // URLs closer to the selection get added first (higher priority)
  let current: Node | null = selectionNode;
  let depth = 0;
  const maxDepth = 10;

  while (current && depth < maxDepth) {
    if (current instanceof Element) {
      const urls = extractUrlsFromElement(current, seen);
      prioritizedUrls.push(...urls);
    }
    current = current.parentNode;
    depth++;
  }

  // Add remaining URLs from AI Overview and search results
  if (aiOverviewElement) {
    prioritizedUrls.push(...extractUrlsFromElement(aiOverviewElement, seen));
  }

  const searchResults = document.querySelectorAll('#search a[href], #rso a[href]');
  for (const link of searchResults) {
    const cleanedUrl = cleanUrl((link as HTMLAnchorElement).href);
    if (cleanedUrl && !seen.has(cleanedUrl)) {
      prioritizedUrls.push(cleanedUrl);
      seen.add(cleanedUrl);
    }
  }

  return prioritizedUrls.slice(0, 25);
}

function handleTextSelection() {
  const selection = window.getSelection();
  const selectedText = selection?.toString().trim() || '';

  if (selectedText && selectedText !== lastSelectedText && selectedText.length > 5) {
    lastSelectedText = selectedText;

    // Get URLs prioritized by proximity to the selection
    const anchorNode = selection?.anchorNode;
    let prioritizedUrls: string[] = [];

    if (anchorNode) {
      prioritizedUrls = extractUrlsNearSelection(anchorNode);
      console.log('[AI Overview Checker] Text selected with', prioritizedUrls.length, 'nearby URLs');
    }

    console.log('[AI Overview Checker] Text selected:', selectedText.substring(0, 50) + '...');

    // Send selection with prioritized URLs
    chrome.runtime.sendMessage({
      type: 'TEXT_SELECTED',
      text: selectedText,
      prioritizedUrls
    });
  }
}

function detectAndNotify() {
  aiOverviewElement = findAIOverview();

  if (aiOverviewElement) {
    const urls = extractSourceUrls(aiOverviewElement);
    console.log('[AI Overview Checker] Detected AI Overview with', urls.length, 'source URLs');

    chrome.runtime.sendMessage({
      type: 'AI_OVERVIEW_DETECTED',
      urls
    });

    // Highlight the AI Overview section subtly
    (aiOverviewElement as HTMLElement).style.outline = '2px solid rgba(147, 51, 234, 0.3)';

    return true;
  }

  return false;
}

// Initial detection
function init() {
  // Try to detect immediately
  if (!detectAndNotify()) {
    // If not found, set up a MutationObserver for dynamic content
    const observer = new MutationObserver((mutations) => {
      if (!aiOverviewElement) {
        if (detectAndNotify()) {
          observer.disconnect();
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Also retry after a delay for slow-loading content
    setTimeout(() => {
      if (!aiOverviewElement) {
        detectAndNotify();
      }
    }, 2000);

    setTimeout(() => {
      if (!aiOverviewElement) {
        detectAndNotify();
        observer.disconnect();
      }
    }, 5000);
  }

  // Listen for text selection
  document.addEventListener('mouseup', handleTextSelection);
  document.addEventListener('keyup', (e) => {
    if (e.key === 'Shift' || e.key === 'Control' || e.key === 'Meta') {
      handleTextSelection();
    }
  });
}

// Run when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

console.log('[AI Overview Checker] Content script loaded');
