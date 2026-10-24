import { ExtensionMessage, MessageResponse } from '../types';
import { checkArgonConnectivity } from '../lib/argon-client';
import { isAppError } from '../lib/gemini-client';
import { getSettings, saveSummaryEntry, setPendingInlinePost } from '../lib/storage';
import { executeCommentGeneration, executePostSummarization } from '../lib/summarizer';

export async function routeExtensionMessage(message: ExtensionMessage): Promise<MessageResponse> {
  try {
    const settings = await getSettings();
    switch (message.type) {
      case 'CHECK_CONNECTIVITY': {
        if (settings.connectionMode === 'direct-api') {
          return { ok: true, data: { connected: settings.directGeminiApiKey.trim().length >= 10, mode: 'direct-api', model: settings.model } };
        }
        const connected = await checkArgonConnectivity(settings.backendUrl);
        return { ok: true, data: { connected, mode: 'backend-proxy', model: settings.model } };
      }
      case 'SUMMARIZE_POST': {
        const { post, mode, length, customInstruction } = message.payload;
        const result = await executePostSummarization({ post, mode, length, customInstruction, settings });
        if (settings.autoSaveSummaries) {
          await saveSummaryEntry({ id: post.id + '-' + Date.now(), createdAt: Date.now(), sourceUrl: post.url, authorName: post.authorName, mode, length, result });
        }
        return { ok: true, data: result };
      }
      case 'GENERATE_COMMENT': {
        const { postContent, summaryTitle, tone } = message.payload;
        const commentResult = await executeCommentGeneration({ postContent, summaryTitle, tone, settings });
        return { ok: true, data: commentResult };
      }
      case 'INLINE_SUMMARIZE_TRIGGERED': {
        await setPendingInlinePost(message.payload.post);
        await chrome.action.setBadgeText({ text: '1' });
        await chrome.action.setBadgeBackgroundColor({ color: '#0a66c2' });
        return { ok: true };
      }
      default:
        return { ok: false, error: { code: 'UNKNOWN_ERROR', message: 'Unsupported message type.', nextStep: 'Reload extension.' } };
    }
  } catch (err: unknown) {
    if (isAppError(err)) return { ok: false, error: err };
    return { ok: false, error: { code: 'UNKNOWN_ERROR', message: err instanceof Error ? err.message : 'Unexpected failure.', nextStep: 'Check Extension Settings.' } };
  }
}