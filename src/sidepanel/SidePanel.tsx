import React, { useEffect, useState } from 'react';
import type { SourceDocument, VerificationResult, ExtensionState, ExtensionMessage } from '../../types';

const SidePanel: React.FC = () => {
  const [claim, setClaim] = useState('');
  const [sources, setSources] = useState<SourceDocument[]>([]);
  const [isVerifying, setIsVerifying] = useState(false);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [apiKeySaved, setApiKeySaved] = useState(false);
  const [aiOverviewDetected, setAiOverviewDetected] = useState(false);

  // Load initial state and listen for storage changes
  useEffect(() => {
    // Load initial state
    chrome.runtime.sendMessage({ type: 'GET_STATE' }, (response) => {
      if (response?.state) {
        handleStateUpdate(response.state);
      }
    });

    // Load saved API key
    chrome.storage.local.get('gemini_api_key', (result) => {
      if (result.gemini_api_key) {
        setApiKey(result.gemini_api_key);
      }
    });

    // Listen for storage changes (state updates from background/content script)
    const storageListener = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes.extension_state?.newValue) {
        console.log('[SidePanel] State updated from storage:', changes.extension_state.newValue);
        handleStateUpdate(changes.extension_state.newValue);
      }
    };

    chrome.storage.local.onChanged.addListener(storageListener);
    return () => chrome.storage.local.onChanged.removeListener(storageListener);
  }, []);

  const handleStateUpdate = (state: ExtensionState) => {
    setAiOverviewDetected(state.aiOverviewDetected);

    if (state.selectedText && state.selectedText !== claim) {
      setClaim(state.selectedText);
      setResult(null);

      // Reinitialize sources with new prioritized URLs when text changes
      if (state.sourceUrls.length > 0) {
        initializeSources(state.sourceUrls);
      }
    } else if (state.sourceUrls.length > 0 && sources.length === 0) {
      // Initial source load
      initializeSources(state.sourceUrls);
    }
  };

  const initializeSources = (urls: string[]) => {
    const initialSources: SourceDocument[] = urls.map(url => ({
      id: Math.random().toString(36).substr(2, 9),
      url,
      title: new URL(url).hostname,
      content: '',
      status: 'pending'
    }));
    setSources(initialSources);
  };

  const getSourceTooltip = (source: SourceDocument): string => {
    const statusText = {
      pending: 'Pending - Not yet crawled',
      crawling: 'Crawling...',
      fetched: `Fetched - ${Math.round((source.content?.length || 0) / 1000)}k characters`,
      error: `Error - ${source.error || 'Failed to fetch'}`
    };
    return `${statusText[source.status]}\n${source.url}`;
  };

  // Generate a URL with text fragment to highlight the quote
  const getHighlightUrl = (baseUrl: string, quote: string): string => {
    // Remove any existing fragment
    const urlWithoutFragment = baseUrl.split('#')[0];

    // Clean and truncate the quote for the text fragment
    // Text fragments work best with shorter, exact phrases
    let textToHighlight = quote
      .trim()
      .replace(/\s+/g, ' ') // Normalize whitespace
      .slice(0, 150); // Keep it reasonable length

    // Encode special characters for text fragment
    // These characters have special meaning in text fragments: - , &
    const encoded = encodeURIComponent(textToHighlight)
      .replace(/-/g, '%2D');

    return `${urlWithoutFragment}#:~:text=${encoded}`;
  };

  const handleSaveApiKey = () => {
    chrome.runtime.sendMessage({ type: 'SAVE_API_KEY', apiKey }, () => {
      setApiKeySaved(true);
      setTimeout(() => setApiKeySaved(false), 2000);
    });
  };

  const handleVerify = async () => {
    if (!claim) return;
    setIsVerifying(true);
    setError(null);
    setResult(null);

    try {
      // Step 1: Fetch content for each source
      const updatedSources = [...sources];

      for (let i = 0; i < updatedSources.length; i++) {
        updatedSources[i].status = 'crawling';
        setSources([...updatedSources]);

        try {
          const response = await chrome.runtime.sendMessage({
            type: 'FETCH_PAGE',
            url: updatedSources[i].url
          });

          if (response?.type === 'PAGE_CONTENT') {
            updatedSources[i].content = response.content;
            updatedSources[i].status = 'fetched';
            updatedSources[i].error = undefined;
          } else if (response?.type === 'PAGE_FETCH_ERROR') {
            updatedSources[i].status = 'error';
            updatedSources[i].error = response.error;
          } else {
            updatedSources[i].status = 'error';
            updatedSources[i].error = 'Unknown error';
          }
        } catch (e: any) {
          updatedSources[i].status = 'error';
          updatedSources[i].error = e?.message || 'Failed to fetch';
        }

        setSources([...updatedSources]);
      }

      // Step 2: Verify with Gemini
      const response = await chrome.runtime.sendMessage({
        type: 'VERIFY_CLAIM',
        claim,
        sources: updatedSources
      });

      if (response?.type === 'VERIFICATION_RESULT') {
        setResult(response.result);
      } else if (response?.type === 'VERIFICATION_ERROR') {
        setError(response.error);
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="h-screen bg-white flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-purple-50 to-white">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-purple-600 rounded-md flex items-center justify-center text-white font-bold text-xs">
            AI
          </div>
          <span className="font-semibold text-gray-800">FactCheck</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`p-1.5 rounded-md transition-colors ${showSettings ? 'bg-purple-100 text-purple-600' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}
            title="Settings"
          >
            <SettingsIcon className="w-4 h-4" />
          </button>
          <div className="text-xs text-gray-400">v1.0.0</div>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="p-4 border-b border-gray-200 bg-gray-50 space-y-3">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Gemini API Key
            </label>
            <div className="flex gap-2">
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter your Gemini API key..."
                className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none bg-white"
              />
              <button
                onClick={handleSaveApiKey}
                className="px-3 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors"
              >
                {apiKeySaved ? 'Saved!' : 'Save'}
              </button>
            </div>
            <p className="text-xs text-gray-400">
              Get your API key from{' '}
              <a
                href="https://aistudio.google.com/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="text-purple-500 hover:underline"
              >
                Google AI Studio
              </a>
            </p>
          </div>
        </div>
      )}

      {/* Status Banner */}
      {!aiOverviewDetected && (
        <div className="p-3 bg-yellow-50 border-b border-yellow-100 text-yellow-800 text-sm">
          Waiting for AI Overview detection on Google Search...
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Claim Section */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Selected Claim
          </label>
          <textarea
            value={claim}
            onChange={(e) => setClaim(e.target.value)}
            placeholder="Select text from the AI Overview to verify..."
            className="w-full h-24 p-3 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none resize-none bg-gray-50 text-gray-800"
          />
        </div>

        {/* Sources Section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Sources ({sources.length})
            </label>
            <span className="text-[10px] bg-gray-100 px-2 py-0.5 rounded text-gray-500">Auto-detected</span>
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {sources.map(source => (
              <div
                key={source.id}
                className="group relative flex items-center gap-2 text-xs p-2 rounded border border-gray-100 bg-white hover:border-gray-300 cursor-default transition-colors"
                title={getSourceTooltip(source)}
              >
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  source.status === 'pending' ? 'bg-gray-300' :
                  source.status === 'crawling' ? 'bg-yellow-400 animate-pulse' :
                  source.status === 'fetched' ? 'bg-green-400' : 'bg-red-400'
                }`} />
                <span className="truncate flex-1 text-gray-600">{source.url}</span>
                {source.status === 'crawling' && <span className="text-gray-400 italic">Crawling...</span>}
                {source.status === 'fetched' && (
                  <span className="text-green-600 text-[10px]">{Math.round((source.content?.length || 0) / 1000)}k chars</span>
                )}
                {source.status === 'error' && (
                  <span className="text-red-500 text-[10px]">Failed</span>
                )}
                {/* Tooltip popup on hover */}
                <div className="absolute left-0 right-0 bottom-full mb-1 hidden group-hover:block z-10">
                  <div className="bg-gray-900 text-white text-[10px] rounded px-2 py-1.5 shadow-lg max-w-full">
                    <div className="font-medium mb-0.5">
                      {source.status === 'pending' && 'Pending'}
                      {source.status === 'crawling' && 'Crawling...'}
                      {source.status === 'fetched' && `Fetched (${Math.round((source.content?.length || 0) / 1000)}k chars)`}
                      {source.status === 'error' && 'Error'}
                    </div>
                    {source.status === 'error' && source.error && (
                      <div className="text-red-300 break-words">{source.error}</div>
                    )}
                    <div className="text-gray-400 truncate mt-0.5">{source.url}</div>
                  </div>
                </div>
              </div>
            ))}
            {sources.length === 0 && (
              <div className="text-xs text-gray-400 italic text-center py-2">
                No sources detected yet. Navigate to a Google Search with AI Overview.
              </div>
            )}
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="p-3 bg-red-50 text-red-700 text-xs rounded border border-red-100">
            {error}
          </div>
        )}

        {/* Results Section */}
        {result && (
          <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className={`p-4 rounded-lg border flex flex-col gap-2 ${
              result.status === 'supported' ? 'bg-green-50 border-green-200' :
              result.status === 'partial' ? 'bg-yellow-50 border-yellow-200' :
              result.status === 'unsupported' ? 'bg-red-50 border-red-200' :
              'bg-gray-50 border-gray-200'
            }`}>
              <div className="flex items-center gap-2">
                {result.status === 'supported' && <CheckCircleIcon className="text-green-600" />}
                {result.status === 'partial' && <AlertCircleIcon className="text-yellow-600" />}
                {result.status === 'unsupported' && <XCircleIcon className="text-red-600" />}
                {result.status === 'inconclusive' && <HelpCircleIcon className="text-gray-600" />}

                <span className={`font-bold uppercase text-sm ${
                  result.status === 'supported' ? 'text-green-800' :
                  result.status === 'partial' ? 'text-yellow-800' :
                  result.status === 'unsupported' ? 'text-red-800' :
                  'text-gray-800'
                }`}>
                  {result.status}
                </span>
              </div>
              <p className="text-sm text-gray-800 leading-relaxed">
                {result.explanation}
              </p>
            </div>

            {result.evidence.length > 0 && (
              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Supporting Evidence
                </label>
                {result.evidence.map((item, idx) => {
                  const highlightUrl = getHighlightUrl(item.sourceUrl, item.quote);
                  return (
                    <div key={idx} className="rounded-lg border border-gray-200 overflow-hidden bg-white hover:shadow-md transition-shadow">
                      <a
                        href={highlightUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block p-3 bg-purple-50 hover:bg-purple-100 transition-colors border-b border-purple-100"
                      >
                        <div className="flex items-center gap-2">
                          <LinkIcon className="w-4 h-4 text-purple-600 flex-shrink-0" />
                          <span className="text-sm font-medium text-purple-700 truncate">
                            {new URL(item.sourceUrl).hostname}
                          </span>
                          <ExternalLinkIcon className="w-3 h-3 text-purple-400 flex-shrink-0 ml-auto" />
                        </div>
                        <div className="text-[10px] text-purple-500 truncate mt-0.5" title={highlightUrl}>
                          {item.sourceUrl}
                        </div>
                      </a>
                      <div className="p-3 text-sm text-gray-700 italic bg-gray-50">
                        "{item.quote}"
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer / Action */}
      <div className="p-4 border-t border-gray-200 bg-gray-50">
        <button
          onClick={handleVerify}
          disabled={!claim || isVerifying}
          className={`w-full py-3 rounded-lg font-medium text-white shadow-sm transition-all flex items-center justify-center gap-2 ${
            !claim || isVerifying
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-purple-600 hover:bg-purple-700 hover:shadow-md'
          }`}
        >
          {isVerifying ? (
            <>
              <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Verifying...
            </>
          ) : (
            'Verify Selection'
          )}
        </button>
      </div>
    </div>
  );
};

// Icon Components
const CheckCircleIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 ${className}`} viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
  </svg>
);

const AlertCircleIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 ${className}`} viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
  </svg>
);

const XCircleIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 ${className}`} viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
  </svg>
);

const HelpCircleIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 ${className}`} viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
  </svg>
);

const SettingsIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
  </svg>
);

const LinkIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z" clipRule="evenodd" />
  </svg>
);

const ExternalLinkIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 20 20" fill="currentColor">
    <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
    <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
  </svg>
);

export default SidePanel;
