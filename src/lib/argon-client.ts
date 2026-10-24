import { GeminiModelId } from '../types';
import { createAppError, isAppError } from './gemini-client';

export interface ArgonProxyRequest {
  backendUrl: string;
  authToken?: string;
  model: GeminiModelId;
  prompt: string;
  timeoutMs?: number;
}

export async function callArgonGeminiProxy(req: ArgonProxyRequest): Promise<string> {
  const { backendUrl, authToken, model, prompt, timeoutMs = 25000 } = req;
  if (!backendUrl || !backendUrl.trim()) {
    throw createAppError('ARGON_UNAVAILABLE', 'Argon / Backend Proxy URL is not configured.', 'Open Settings and configure your Argon Backend URL or Direct Gemini key.');
  }
  const normalizedUrl = backendUrl.replace(/\/+$/, '') + '/api/gemini';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Client': 'linkedin-summarizer-ai-extension/1.0.0',
    };
    if (authToken?.trim()) {
      headers['Authorization'] = 'Bearer ' + authToken.trim();
    }
    const response = await fetch(normalizedUrl, {
      method: 'POST',
      headers,
      signal: controller.signal,
      body: JSON.stringify({ model, prompt }),
    });
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw createAppError('AUTH_FAILED', 'Authentication with the Argon proxy failed.', 'Check your Backend Auth Token in Settings.');
      }
      if (response.status === 429) {
        throw createAppError('RATE_LIMITED', 'Rate limit reached on the Argon proxy.', 'Wait a moment before requesting another summary.');
      }
      throw createAppError('ARGON_UNAVAILABLE', 'Argon proxy responded with HTTP ' + response.status + '.', 'Ensure npm run proxy is running and GEMINI_API_KEY is set.');
    }
    const payload = await response.json();
    if (typeof payload?.resultText !== 'string' || !payload.resultText.trim()) {
      throw createAppError('INVALID_AI_RESPONSE', 'Argon proxy returned an invalid payload.', 'Check proxy logs or try regenerating.');
    }
    return payload.resultText;
  } catch (err: unknown) {
    if (isAppError(err)) throw err;
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw createAppError('NETWORK_TIMEOUT', 'Connection to the Argon backend proxy timed out.', 'Verify the proxy server is reachable.');
    }
    throw createAppError('ARGON_UNAVAILABLE', 'Could not reach the Argon / Gemini backend service.', 'Run npm run proxy or switch to Personal Direct API Key mode in Settings.');
  } finally {
    clearTimeout(timer);
  }
}

export async function checkArgonConnectivity(backendUrl: string): Promise<boolean> {
  if (!backendUrl?.trim()) return false;
  try {
    const res = await fetch(backendUrl.replace(/\/+$/, '') + '/api/health', {
      method: 'GET',
      signal: AbortSignal.timeout(4000),
    });
    return res.ok;
  } catch {
    return false;
  }
}