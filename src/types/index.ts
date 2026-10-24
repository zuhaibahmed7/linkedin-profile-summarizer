export type SummaryMode = 'executive-bio' | 'recruiter-screen' | 'skills-stack' | 'career-progression' | 'outreach-icebreakers' | 'custom';
export type SummaryLength = 'short' | 'medium' | 'long';
export type GeminiModelId = 'gemini-2.5-flash' | 'gemini-2.5-pro' | 'gemini-2.0-flash';
export type ConnectionMode = 'backend-proxy' | 'direct-api';
export type ThemePreference = 'light' | 'dark' | 'system';

export interface ExtractedPost {
  id: string;
  authorName: string;
  authorHeadline?: string;
  location?: string;
  content: string;
  url: string;
  isTruncatedByLinkedIn?: boolean;
}

export interface NamedEntities {
  people: string[];
  companies: string[];
  technologies: string[];
}

export interface SentimentAnalysis {
  label: 'Executive' | 'Technical' | 'Founder/Builder' | 'Operational' | 'Creative' | 'Academic' | 'Generalist';
  confidenceNote: string;
}

export interface SummaryResult {
  title: string;
  mainIdea: string;
  summary: string;
  keyTakeaways: string[];
  importantFacts: string[];
  entities: NamedEntities;
  sentiment: SentimentAnalysis;
  topics: string[];
  hashtags: string[];
  actionItems: string[];
  followUpQuestions: string[];
  explainedConcepts: Array<{ term: string; explanation: string }>;
  wasTruncated: boolean;
  originalCharCount: number;
  processedCharCount: number;
}

export interface SavedSummary {
  id: string;
  createdAt: number;
  sourceUrl: string;
  authorName: string;
  mode: SummaryMode;
  length: SummaryLength;
  result: SummaryResult;
}

export interface ExtensionSettings {
  connectionMode: ConnectionMode;
  backendUrl: string;
  backendAuthToken: string;
  directGeminiApiKey: string;
  model: GeminiModelId;
  defaultMode: SummaryMode;
  defaultLength: SummaryLength;
  theme: ThemePreference;
  enableInlineButton: boolean;
  autoSummarize: boolean;
  autoSaveSummaries: boolean;
  maxInputLength: number;
}

export type ErrorCode =
  | 'UNSUPPORTED_PAGE'
  | 'NO_POST_DETECTED'
  | 'EXTRACTION_FAILED'
  | 'EMPTY_CONTENT'
  | 'CREDENTIALS_MISSING'
  | 'ARGON_UNAVAILABLE'
  | 'AUTH_FAILED'
  | 'RATE_LIMITED'
  | 'NETWORK_TIMEOUT'
  | 'INVALID_AI_RESPONSE'
  | 'BACKEND_UNAVAILABLE'
  | 'STORAGE_QUOTA_EXCEEDED'
  | 'UNKNOWN_ERROR';

export interface AppError {
  code: ErrorCode;
  message: string;
  nextStep: string;
}

export type ExtensionMessage =
  | { type: 'EXTRACT_ACTIVE_POST' }
  | { type: 'SUMMARIZE_POST'; payload: { post: ExtractedPost; mode: SummaryMode; length: SummaryLength; customInstruction?: string } }
  | { type: 'GENERATE_COMMENT'; payload: { postContent: string; summaryTitle: string; tone: 'Networking' | 'Recruiting' | 'CoffeeChat' } }
  | { type: 'CHECK_CONNECTIVITY' }
  | { type: 'INLINE_SUMMARIZE_TRIGGERED'; payload: { post: ExtractedPost } };

export interface MessageResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: AppError;
}