
import React, { useRef, useEffect } from 'react';
import { GOOGLE_SEARCH_HTML } from '../data/googleSearchHtml';

interface MockBrowserProps {
  onTextSelect: (text: string) => void;
}

const MockBrowser: React.FC<MockBrowserProps> = ({ onTextSelect }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    // We also need to listen to messages from the iframe if we were cross-origin,
    // but with srcDoc it is same-origin, so we can access contentDocument directly.
  }, []);

  const handleIframeLoad = () => {
    const iframe = iframeRef.current;
    if (!iframe || !iframe.contentDocument) return;

    const doc = iframe.contentDocument;

    // Inject some CSS to make the text selection visible and cursor pointer where appropriate
    const style = doc.createElement('style');
    style.textContent = `
      body { cursor: text; }
      ::selection { background-color: #c084fc; color: white; }
    `;
    doc.head.appendChild(style);

    // Listen for selection changes
    doc.addEventListener('mouseup', () => {
      const selection = doc.getSelection();
      if (selection && selection.toString().trim().length > 0) {
        onTextSelect(selection.toString().trim());
      }
    });

    // Also listen for keyup (e.g. shift+arrow keys)
    doc.addEventListener('keyup', () => {
      const selection = doc.getSelection();
      if (selection && selection.toString().trim().length > 0) {
        onTextSelect(selection.toString().trim());
      }
    });
  };

  return (
    <div className="flex-1 bg-white flex flex-col h-full overflow-hidden relative">
       {/* Browser Address Bar Simulation */}
       <div className="border-b border-gray-200 p-2 bg-gray-50 flex items-center gap-3 px-4">
        <div className="flex gap-2">
           <div className="w-3 h-3 rounded-full bg-red-400"></div>
           <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
           <div className="w-3 h-3 rounded-full bg-green-400"></div>
        </div>
        <div className="flex-1 bg-white border border-gray-300 rounded-md px-3 py-1 text-sm text-gray-600 truncate shadow-sm flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          Why do cats purr? - Google Search
        </div>
      </div>

      {/* The Actual Content */}
      <iframe 
        ref={iframeRef}
        srcDoc={GOOGLE_SEARCH_HTML}
        className="w-full h-full border-none"
        title="Google Search Result"
        onLoad={handleIframeLoad}
      />
    </div>
  );
};

export default MockBrowser;
