
export interface SourceDocument {
  id: string;
  url: string;
  title: string;
  content: string; // The text content of the page
  status: 'pending' | 'crawling' | 'fetched' | 'error';
}

export interface VerificationResult {
  status: 'supported' | 'unsupported' | 'partial' | 'inconclusive';
  evidence: {
    quote: string;
    sourceUrl: string;
  }[];
  explanation: string;
}

export interface SearchResult {
  query: string;
  aiOverview: string;
  sources: {
    url: string;
    title: string;
    snippet: string;
  }[];
}
