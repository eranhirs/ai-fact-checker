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

function extractSourceUrls(container: Element): string[] {
  const urls: string[] = [];
  const links = container.querySelectorAll('a[href]');

  for (const link of links) {
    const href = (link as HTMLAnchorElement).href;
    // Filter out Google internal links and keep actual source URLs
    if (href &&
        !href.includes('google.com') &&
        !href.includes('accounts.google') &&
        !href.startsWith('javascript:') &&
        href.startsWith('http')) {
      // Clean up Google redirect URLs
      try {
        const url = new URL(href);
        if (url.hostname === 'www.google.com' && url.pathname === '/url') {
          const actualUrl = url.searchParams.get('url') || url.searchParams.get('q');
          if (actualUrl) {
            urls.push(actualUrl);
            continue;
          }
        }
        urls.push(href);
      } catch {
        urls.push(href);
      }
    }
  }

  // Also look for citation links in the broader search results
  const searchResults = document.querySelectorAll('#search a[href], #rso a[href]');
  for (const link of searchResults) {
    const href = (link as HTMLAnchorElement).href;
    if (href &&
        !href.includes('google.com') &&
        !href.startsWith('javascript:') &&
        href.startsWith('http') &&
        !urls.includes(href)) {
      try {
        const url = new URL(href);
        if (url.hostname === 'www.google.com' && url.pathname === '/url') {
          const actualUrl = url.searchParams.get('url') || url.searchParams.get('q');
          if (actualUrl && !urls.includes(actualUrl)) {
            urls.push(actualUrl);
            continue;
          }
        }
        if (!urls.includes(href)) {
          urls.push(href);
        }
      } catch {
        if (!urls.includes(href)) {
          urls.push(href);
        }
      }
    }
  }

  // Dedupe and limit to first 10
  return [...new Set(urls)].slice(0, 10);
}

function handleTextSelection() {
  const selection = window.getSelection();
  const selectedText = selection?.toString().trim() || '';

  if (selectedText && selectedText !== lastSelectedText && selectedText.length > 5) {
    lastSelectedText = selectedText;

    // Send any selection from the page (not just AI Overview)
    // This makes it easier to test and more flexible
    console.log('[AI Overview Checker] Text selected:', selectedText.substring(0, 50) + '...');
    chrome.runtime.sendMessage({
      type: 'TEXT_SELECTED',
      text: selectedText
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
