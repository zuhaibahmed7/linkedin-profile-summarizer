import { z } from 'zod';
import { ExtensionSettings, SummaryResult } from '../types';

export const NamedEntitiesSchema = z.object({
  people: z.array(z.string()).default([]),
  companies: z.array(z.string()).default([]),
  technologies: z.array(z.string()).default([]),
});

export const SentimentSchema = z.object({
  label: z.enum(['Executive', 'Technical', 'Founder/Builder', 'Operational', 'Creative', 'Academic', 'Generalist']).catch('Generalist'),
  confidenceNote: z.string().default('AI persona classification based on profile history.'),
});

export const ExplainedConceptSchema = z.object({
  term: z.string(),
  explanation: z.string(),
});

export const GeminiSummaryPayloadSchema = z.object({
  title: z.string().min(2).max(160),
  mainIdea: z.string().min(5),
  summary: z.string().min(10),
  keyTakeaways: z.array(z.string()).min(1).max(8),
  importantFacts: z.array(z.string()).default([]),
  entities: NamedEntitiesSchema.default({ people: [], companies: [], technologies: [] }),
  sentiment: SentimentSchema.default({ label: 'Generalist', confidenceNote: 'AI profile archetype.' }),
  topics: z.array(z.string()).default([]),
  hashtags: z.array(z.string()).default([]),
  actionItems: z.array(z.string()).default([]),
  followUpQuestions: z.array(z.string()).default([]),
  explainedConcepts: z.array(ExplainedConceptSchema).default([]),
});

export const CommentResponseSchema = z.object({
  draftComment: z.string().min(5).max(800),
  rationale: z.string().optional(),
});

export const ExtensionSettingsSchema = z.object({
  connectionMode: z.enum(['backend-proxy', 'direct-api']),
  backendUrl: z.string().url().or(z.literal('')),
  backendAuthToken: z.string(),
  directGeminiApiKey: z.string(),
  model: z.enum(['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash']),
  defaultMode: z.enum(['executive-bio', 'recruiter-screen', 'skills-stack', 'career-progression', 'outreach-icebreakers', 'custom']),
  defaultLength: z.enum(['short', 'medium', 'long']),
  theme: z.enum(['light', 'dark', 'system']),
  enableInlineButton: z.boolean(),
  autoSummarize: z.boolean(),
  autoSaveSummaries: z.boolean(),
  maxInputLength: z.number().int().min(500).max(30000),
});

export const DEFAULT_SETTINGS: ExtensionSettings = {
  connectionMode: 'backend-proxy',
  backendUrl: 'http://localhost:8787',
  backendAuthToken: '',
  directGeminiApiKey: '',
  model: 'gemini-2.5-flash',
  defaultMode: 'executive-bio',
  defaultLength: 'medium',
  theme: 'system',
  enableInlineButton: true,
  autoSummarize: false,
  autoSaveSummaries: true,
  maxInputLength: 15000,
};

export function sanitizeAndTruncateInput(rawText: string, maxLength: number) {
  const normalized = rawText.replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  const originalCharCount = normalized.length;
  if (originalCharCount <= maxLength) {
    return { cleanedText: normalized, wasTruncated: false, originalCharCount, processedCharCount: originalCharCount };
  }
  const sliced = normalized.slice(0, maxLength);
  return { cleanedText: sliced, wasTruncated: true, originalCharCount, processedCharCount: sliced.length };
}

export function parseAndValidateSummaryJson(
  rawModelOutput: string,
  meta: { wasTruncated: boolean; originalCharCount: number; processedCharCount: number }
): SummaryResult {
  const cleaned = rawModelOutput.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(cleaned);
  } catch {
    throw new Error('Model did not return valid JSON.');
  }
  const validated = GeminiSummaryPayloadSchema.parse(parsedJson);
  return { ...validated, ...meta };
}