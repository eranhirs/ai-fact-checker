
import React, { useEffect, useState } from 'react';
import { SourceDocument, VerificationResult } from '../types';
import { fetchPageContent } from '../services/crawlerService';
import { verifyClaimWithGemini, getStoredApiKey, setStoredApiKey } from '../services/geminiService';

interface ExtensionSidebarProps {
  selectedText: string;
  knownUrls: string[];
}

const ExtensionSidebar: React.FC<ExtensionSidebarProps> = ({ selectedText, knownUrls }) => {
  const [claim, setClaim] = useState('');
  const [sources, setSources] = useState<SourceDocument[]>([]);
  const [isVerifying, setIsVerifying] = useState(false);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [apiKey, setApiKey] = useState(() => getStoredApiKey());
  const [apiKeySaved, setApiKeySaved] = useState(false);

  const handleSaveApiKey = () => {
    setStoredApiKey(apiKey);
    setApiKeySaved(true);
    setTimeout(() => setApiKeySaved(false), 2000);
  };

  // Update claim when text is selected from the parent
  useEffect(() => {
    if (selectedText) {
      setClaim(selectedText);
      setResult(null); // Reset result on new selection
      // Automatically prepare sources based on "known" urls from the page context
      initializeSources(knownUrls);
    }
  }, [selectedText, knownUrls]);

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

  const handleVerify = async () => {
    if (!claim) return;
    setIsVerifying(true);
    setError(null);
    setResult(null);

    try {
      // Step 1: Crawl
      const updatedSources = [...sources];
      
      // We simulate fetching in parallel
      await Promise.all(updatedSources.map(async (source, index) => {
        updatedSources[index].status = 'crawling';
        setSources([...updatedSources]); // Force update UI
        
        try {
          const content = await fetchPageContent(source.url);
          updatedSources[index].content = content;
          updatedSources[index].status = 'fetched';
        } catch (e) {
          updatedSources[index].status = 'error';
        }
        setSources([...updatedSources]);
      }));

      // Step 2: Verify with Gemini
      const verificationResult = await verifyClaimWithGemini(claim, updatedSources);
      setResult(verificationResult);

    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="w-[400px] h-full bg-white shadow-xl flex flex-col border-l border-gray-200">
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

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        
        {/* Claim Section */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Selected Claim
          </label>
          <textarea
            value={claim}
            onChange={(e) => setClaim(e.target.value)}
            placeholder="Highlight text on the left to populate..."
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
          <div className="space-y-2">
            {sources.map(source => (
              <div key={source.id} className="flex items-center gap-2 text-xs p-2 rounded border border-gray-100 bg-white">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  source.status === 'pending' ? 'bg-gray-300' :
                  source.status === 'crawling' ? 'bg-yellow-400 animate-pulse' :
                  source.status === 'fetched' ? 'bg-green-400' : 'bg-red-400'
                }`} />
                <span className="truncate flex-1 text-gray-600">{source.url}</span>
                {source.status === 'crawling' && <span className="text-gray-400 italic">Crawling...</span>}
              </div>
            ))}
            {sources.length === 0 && (
              <div className="text-xs text-gray-400 italic text-center py-2">
                No sources detected in context.
              </div>
            )}
          </div>
        </div>

        {/* Results Section */}
        {error && (
          <div className="p-3 bg-red-50 text-red-700 text-xs rounded border border-red-100">
            {error}
          </div>
        )}

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
                {result.evidence.map((item, idx) => (
                  <div key={idx} className="p-3 bg-gray-50 border-l-4 border-purple-500 rounded-r text-sm text-gray-700 italic flex flex-col gap-1">
                    <span>"{item.quote}"</span>
                    <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline truncate block w-full" title={item.sourceUrl}>
                       {item.sourceUrl}
                    </a>
                  </div>
                ))}
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
            <>
              Verify Selection
            </>
          )}
        </button>
      </div>
    </div>
  );
};

// Simple Icon Components
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

export default ExtensionSidebar;
