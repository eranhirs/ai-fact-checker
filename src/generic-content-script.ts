// Generic content script for non-Google pages
// Loaded on all non-Google pages, but only activates when user clicks extension icon

let lastSelectedText = '';
let isActivated = false;

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

// Extract surrounding context from the selection's container element
function extractSurroundingContext(selection: Selection): string {
  const anchorNode = selection.anchorNode;
  if (!anchorNode) return '';

  // Find the nearest block-level container that provides meaningful context
  let container: Element | null = anchorNode.parentElement;
  const blockElements = ['P', 'DIV', 'SECTION', 'ARTICLE', 'LI', 'TD', 'BLOCKQUOTE', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6'];

  // Walk up to find a suitable container
  while (container && !blockElements.includes(container.tagName)) {
    container = container.parentElement;
  }

  // If we found a block container, get its full text plus siblings for more context
  if (container) {
    let contextParts: string[] = [];

    // Get previous sibling's text if it exists (for preceding context)
    const prevSibling = container.previousElementSibling;
    if (prevSibling && blockElements.includes(prevSibling.tagName)) {
      const prevText = prevSibling.textContent?.trim();
      if (prevText && prevText.length < 500) {
        contextParts.push(prevText);
      }
    }

    // Get the container's full text
    const containerText = container.textContent?.trim();
    if (containerText) {
      contextParts.push(containerText);
    }

    // Get next sibling's text if it exists (for following context)
    const nextSibling = container.nextElementSibling;
    if (nextSibling && blockElements.includes(nextSibling.tagName)) {
      const nextText = nextSibling.textContent?.trim();
      if (nextText && nextText.length < 500) {
        contextParts.push(nextText);
      }
    }

    const fullContext = contextParts.join('\n\n');
    // Limit context to a reasonable size
    return fullContext.slice(0, 2000);
  }

  return '';
}

function handleTextSelection() {
  if (!isActivated) return;

  const selection = window.getSelection();
  const selectedText = selection?.toString().trim() || '';

  if (selectedText && selectedText !== lastSelectedText && selectedText.length > 5) {
    lastSelectedText = selectedText;

    // Get URLs prioritized by proximity to the selection
    const anchorNode = selection?.anchorNode;
    let prioritizedUrls: string[] = [];
    let surroundingContext = '';

    if (anchorNode) {
      prioritizedUrls = extractUrlsNearSelection(anchorNode);
      surroundingContext = extractSurroundingContext(selection);
      console.log('[AI Fact Checker - Generic] Text selected with', prioritizedUrls.length, 'nearby URLs');
      console.log('[AI Fact Checker - Generic] Surrounding context length:', surroundingContext.length);
    }

    console.log('[AI Fact Checker - Generic] Text selected:', selectedText.substring(0, 50) + '...');

    // Send selection with prioritized URLs and surrounding context
    chrome.runtime.sendMessage({
      type: 'TEXT_SELECTED',
      text: selectedText,
      prioritizedUrls,
      surroundingContext
    });
  }
}

function activate() {
  if (isActivated) return;
  isActivated = true;

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

  console.log('[AI Fact Checker - Generic] Activated on:', window.location.hostname);
}

// Listen for activation message from background
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'ACTIVATE_GENERIC_CONTENT_SCRIPT') {
    activate();
  }
});
