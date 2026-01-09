
export interface SourceDocument {
  id: string;
  url: string;
  title: string;
  content: string;
  status: 'pending' | 'crawling' | 'fetched' | 'error';
  error?: string;
}

export interface VerificationResult {
  status: 'supported' | 'unsupported' | 'partial' | 'inconclusive';
  evidence: {
    quote: string;
    sourceUrl: string;
  }[];
  explanation: string;
}

// Extension message types
export type ExtensionMessage =
  | { type: 'AI_OVERVIEW_DETECTED'; urls: string[] }
  | { type: 'TEXT_SELECTED'; text: string }
  | { type: 'VERIFY_CLAIM'; claim: string; sources: SourceDocument[] }
  | { type: 'GET_STATE' }
  | { type: 'SAVE_API_KEY'; apiKey: string }
  | { type: 'FETCH_PAGE'; url: string }
  | { type: 'STATE_UPDATE'; state: ExtensionState }
  | { type: 'VERIFICATION_RESULT'; result: VerificationResult }
  | { type: 'VERIFICATION_ERROR'; error: string }
  | { type: 'PAGE_CONTENT'; url: string; content: string }
  | { type: 'PAGE_FETCH_ERROR'; url: string; error: string };

export interface ExtensionState {
  aiOverviewDetected: boolean;
  selectedText: string;
  sourceUrls: string[];
  apiKeySet: boolean;
}
