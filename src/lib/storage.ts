import { ExtensionSettings, SavedSummary } from '../types';
import { createAppError } from './gemini-client';
import { DEFAULT_SETTINGS, ExtensionSettingsSchema } from './validation';

const SETTINGS_KEY = 'li_summarizer_settings_v1';
const HISTORY_KEY = 'li_summarizer_history_v1';
const LAST_INLINE_POST_KEY = 'li_summarizer_inline_post_v1';
const MAX_SAVED_SUMMARIES = 50;

export async function getSettings(): Promise<ExtensionSettings> {
  try {
    const stored = await chrome.storage.local.get(SETTINGS_KEY);
    if (!stored[SETTINGS_KEY]) return DEFAULT_SETTINGS;
    const parsed = ExtensionSettingsSchema.safeParse({ ...DEFAULT_SETTINGS, ...stored[SETTINGS_KEY] });
    return parsed.success ? parsed.data : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(partial: Partial<ExtensionSettings>): Promise<ExtensionSettings> {
  const current = await getSettings();
  const validated = ExtensionSettingsSchema.parse({ ...current, ...partial });
  try {
    await chrome.storage.local.set({ [SETTINGS_KEY]: validated });
    return validated;
  } catch {
    throw createAppError('STORAGE_QUOTA_EXCEEDED', 'Failed to save settings to Chrome local storage.', 'Clear old saved summaries.');
  }
}

export async function getSavedSummaries(): Promise<SavedSummary[]> {
  try {
    const stored = await chrome.storage.local.get(HISTORY_KEY);
    return Array.isArray(stored[HISTORY_KEY]) ? stored[HISTORY_KEY] : [];
  } catch {
    return [];
  }
}

export async function saveSummaryEntry(entry: SavedSummary): Promise<SavedSummary[]> {
  const current = await getSavedSummaries();
  const updated = [entry, ...current.filter((item) => item.id !== entry.id)].slice(0, MAX_SAVED_SUMMARIES);
  try {
    await chrome.storage.local.set({ [HISTORY_KEY]: updated });
    return updated;
  } catch {
    throw createAppError('STORAGE_QUOTA_EXCEEDED', 'Chrome storage quota reached.', 'Delete older summaries from History.');
  }
}

export async function deleteSavedSummary(id: string): Promise<SavedSummary[]> {
  const current = await getSavedSummaries();
  const updated = current.filter((item) => item.id !== id);
  await chrome.storage.local.set({ [HISTORY_KEY]: updated });
  return updated;
}

export async function clearAllSavedSummaries(): Promise<void> {
  await chrome.storage.local.remove(HISTORY_KEY);
}

export async function setPendingInlinePost(post: unknown): Promise<void> {
  await chrome.storage.local.set({ [LAST_INLINE_POST_KEY]: post });
}

export async function consumePendingInlinePost<T>(): Promise<T | null> {
  const stored = await chrome.storage.local.get(LAST_INLINE_POST_KEY);
  const post = stored[LAST_INLINE_POST_KEY] ?? null;
  if (post) await chrome.storage.local.remove(LAST_INLINE_POST_KEY);
  return post as T | null;
}