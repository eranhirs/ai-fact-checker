// Generic content script for non-Google pages
// Injected programmatically when user opens side panel on any webpage

let lastSelectedText = '';

function cleanUrl(href: string): string | null {
  if (!href ||
      href.startsWith('javascript:') ||
      href.startsWith('#') ||
      href.startsWith('mailto:') ||
      !href.startsWith('http')) {
    return null;
  }

  try {
    const url = new URL(href);

    // Handle Google redirect URLs - extract the actual target URL
    if (url.hostname === 'www.google.com' && url.pathname === '/url') {
      const targetUrl = url.searchParams.get('url') || url.searchParams.get('q');
      if (targetUrl) {
        // Recursively clean the extracted URL (handles nested redirects)
        return cleanUrl(targetUrl);
      }
      return null;
    }

    // Filter out common non-content URLs
    const filterPatterns = [
      /facebook\.com\/sharer/,
      /twitter\.com\/intent/,
      /linkedin\.com\/share/,
      /pinterest\.com\/pin/,
      /reddit\.com\/submit/,
      /accounts\./,
      /login/,
      /signin/,
      /signup/,
      /auth\./,
    ];

    if (filterPatterns.some(pattern => pattern.test(href))) {
      return null;
    }

    return href;
  } catch {
    return null;
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

// Extract URLs prioritized by proximity to the selection
function extractUrlsNearSelection(selectionNode: Node): string[] {
  const seen = new Set<string>();
  const prioritizedUrls: string[] = [];

  // Walk up the DOM tree, collecting URLs at each level
  // URLs closer to the selection get added first (higher priority)
  let current: Node | null = selectionNode;
  let depth = 0;
  const maxDepth = 15; // Slightly deeper for generic pages

  while (current && depth < maxDepth && prioritizedUrls.length < 25) {
    if (current instanceof Element) {
      const urls = extractUrlsFromElement(current, seen);
      prioritizedUrls.push(...urls);
    }
    current = current.parentNode;
    depth++;
  }

  // If we didn't find enough URLs near selection, look in common content areas
  if (prioritizedUrls.length < 10) {
    const contentSelectors = [
      'article',
      'main',
      '[role="main"]',
      '.content',
      '.post',
      '.entry',
      '#content',
    ];

    for (const selector of contentSelectors) {
      const container = document.querySelector(selector);
      if (container && prioritizedUrls.length < 25) {
        const urls = extractUrlsFromElement(container, seen);
        prioritizedUrls.push(...urls);
      }
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
      console.log('[AI Fact Checker - Generic] Text selected with', prioritizedUrls.length, 'nearby URLs');
    }

    console.log('[AI Fact Checker - Generic] Text selected:', selectedText.substring(0, 50) + '...');

    // Send selection with prioritized URLs
    chrome.runtime.sendMessage({
      type: 'TEXT_SELECTED',
      text: selectedText,
      prioritizedUrls
    });
  }
}

function init() {
  // Listen for text selection
  document.addEventListener('mouseup', handleTextSelection);
  document.addEventListener('keyup', (e) => {
    if (e.key === 'Shift' || e.key === 'Control' || e.key === 'Meta') {
      handleTextSelection();
    }
  });

  // Notify background that we're active on this page
  chrome.runtime.sendMessage({
    type: 'GENERIC_PAGE_ACTIVATED'
  });
}

// Run immediately since we're injected on demand
init();

console.log('[AI Fact Checker - Generic] Content script loaded on:', window.location.hostname);
