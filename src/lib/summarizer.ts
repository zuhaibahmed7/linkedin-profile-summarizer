import { ExtractedPost, ExtensionSettings, SummaryLength, SummaryMode, SummaryResult } from '../types';
import { callArgonGeminiProxy } from './argon-client';
import { callGeminiDirect, createAppError, isAppError } from './gemini-client';
import { buildCommentPrompt, buildSummarizationPrompt } from './prompts';
import { CommentResponseSchema, parseAndValidateSummaryJson, sanitizeAndTruncateInput } from './validation';

export async function executePostSummarization(params: {
  post: ExtractedPost;
  mode: SummaryMode;
  length: SummaryLength;
  customInstruction?: string;
  settings: ExtensionSettings;
}): Promise<SummaryResult> {
  const { post, mode, length, customInstruction, settings } = params;
  if (!post.content || post.content.trim().length < 20) {
    throw createAppError('EMPTY_CONTENT', 'Profile data is too short to analyze.', 'Open a LinkedIn profile (linkedin.com/in/...) or paste profile text manually.');
  }
  const { cleanedText, wasTruncated, originalCharCount, processedCharCount } = sanitizeAndTruncateInput(post.content, settings.maxInputLength);
  const prompt = buildSummarizationPrompt({ authorName: post.authorName, postContent: cleanedText, mode, length, customInstruction, wasTruncated });
  const rawOutput = await dispatchPromptToConfiguredProvider(prompt, settings);
  try {
    return parseAndValidateSummaryJson(rawOutput, { wasTruncated, originalCharCount, processedCharCount });
  } catch {
    throw createAppError('INVALID_AI_RESPONSE', 'Gemini returned a response that did not match the profile schema.', 'Click Summarize Profile again or switch models in Settings.');
  }
}

export async function executeCommentGeneration(params: {
  postContent: string;
  summaryTitle: string;
  tone: 'Networking' | 'Recruiting' | 'CoffeeChat';
  settings: ExtensionSettings;
}): Promise<{ draftComment: string; rationale?: string }> {
  const { cleanedText } = sanitizeAndTruncateInput(params.postContent, params.settings.maxInputLength);
  const prompt = buildCommentPrompt({ postContent: cleanedText, summaryTitle: params.summaryTitle, tone: params.tone });
  const rawOutput = await dispatchPromptToConfiguredProvider(prompt, params.settings);
  try {
    const cleaned = rawOutput.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    return CommentResponseSchema.parse(JSON.parse(cleaned));
  } catch {
    throw createAppError('INVALID_AI_RESPONSE', 'Unable to parse the generated connection note.', 'Try generating the outreach note again.');
  }
}

async function dispatchPromptToConfiguredProvider(prompt: string, settings: ExtensionSettings): Promise<string> {
  try {
    if (settings.connectionMode === 'backend-proxy') {
      return await callArgonGeminiProxy({ backendUrl: settings.backendUrl, authToken: settings.backendAuthToken, model: settings.model, prompt });
    }
    return await callGeminiDirect({ apiKey: settings.directGeminiApiKey, model: settings.model, prompt });
  } catch (err: unknown) {
    if (isAppError(err)) throw err;
    throw createAppError('UNKNOWN_ERROR', 'An unexpected error occurred during Gemini profile analysis.', 'Verify your API key or proxy in Settings.');
  }
}