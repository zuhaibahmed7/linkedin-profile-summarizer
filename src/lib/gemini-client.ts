import { AppError, GeminiModelId } from '../types';
import { SUMMARIZER_SYSTEM_INSTRUCTION } from './prompts';

export interface GeminiCallOptions {
  apiKey: string;
  model: GeminiModelId;
  prompt: string;
  timeoutMs?: number;
}

export async function callGeminiDirect(options: GeminiCallOptions): Promise<string> {
  const { apiKey, model, prompt, timeoutMs = 25000 } = options;
  if (!apiKey || apiKey.trim().length < 10) {
    throw createAppError('CREDENTIALS_MISSING', 'Direct Gemini API key is not configured.', 'Open Extension Settings and provide a valid Gemini API key or switch to the Argon Backend Proxy.');
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const endpoint = 'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent?key=' + encodeURIComponent(apiKey.trim());

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SUMMARIZER_SYSTEM_INSTRUCTION }] },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, topP: 0.9, responseMimeType: 'application/json' },
      }),
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw createAppError('AUTH_FAILED', 'Gemini API authentication failed (HTTP 401/403).', 'Verify your Gemini API key in Extension Settings.');
      }
      if (response.status === 429) {
        throw createAppError('RATE_LIMITED', 'Gemini API rate limit exceeded (HTTP 429).', 'Wait 30-60 seconds before trying again.');
      }
      throw createAppError('BACKEND_UNAVAILABLE', 'Gemini API returned HTTP ' + response.status + '.', 'Verify your connection or model selection.');
    }
    const data = await response.json();
    const textOutput: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textOutput) {
      throw createAppError('INVALID_AI_RESPONSE', 'Gemini returned an empty candidate payload.', 'Try regenerating the summary.');
    }
    return textOutput;
  } catch (err: unknown) {
    if (isAppError(err)) throw err;
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw createAppError('NETWORK_TIMEOUT', 'The request to Google Gemini timed out.', 'Check your connection and click Regenerate.');
    }
    throw createAppError('BACKEND_UNAVAILABLE', 'Network error while contacting the Gemini API.', 'Check your internet connection.');
  } finally {
    clearTimeout(timer);
  }
}

export function createAppError(code: AppError['code'], message: string, nextStep: string): AppError {
  return { code, message, nextStep };
}

export function isAppError(err: unknown): err is AppError {
  return typeof err === 'object' && err !== null && 'code' in err && 'message' in err && 'nextStep' in err;
}