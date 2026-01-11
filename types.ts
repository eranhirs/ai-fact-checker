
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
  | { type: 'TEXT_SELECTED'; text: string; prioritizedUrls?: string[] }
  | { type: 'VERIFY_CLAIM'; claim: string; sources: SourceDocument[] }
  | { type: 'GET_STATE' }
  | { type: 'SAVE_API_KEY'; apiKey: string }
  | { type: 'FETCH_PAGE'; url: string }
  | { type: 'STATE_UPDATE'; state: ExtensionState }
  | { type: 'VERIFICATION_RESULT'; result: VerificationResult }
  | { type: 'VERIFICATION_ERROR'; error: string }
  | { type: 'PAGE_CONTENT'; url: string; content: string; finalUrl?: string }
  | { type: 'PAGE_FETCH_ERROR'; url: string; error: string }
  | { type: 'SAVE_TELEMETRY_LEVEL'; level: TelemetryLevel }
  | { type: 'GET_TELEMETRY_LEVEL' }
  | { type: 'SAVE_MAX_SOURCES'; maxSources: number }
  | { type: 'GET_MAX_SOURCES' }
  | { type: 'GENERIC_PAGE_ACTIVATED' };

export type PageMode = 'ai_overview' | 'generic' | 'inactive';

export interface ExtensionState {
  aiOverviewDetected: boolean;
  pageMode: PageMode;
  selectedText: string;
  sourceUrls: string[];
  apiKeySet: boolean;
}

// Telemetry types
export type TelemetryLevel = 'off' | 'statistics' | 'verbose';

export interface TelemetryEvent {
  event_name: 'verification_started' | 'verification_completed' | 'verification_error';
  timestamp: number;
  // Statistics level fields
  domain?: string;
  success?: boolean;
  verification_status?: string;
  source_count?: number;
  // Verbose level fields
  full_url?: string;
  claim_text?: string;
  claim_length?: number;
  source_urls?: string[];
  evidence_count?: number;
  fetch_duration_ms?: number;
  verify_duration_ms?: number;
  error_message?: string;
}
