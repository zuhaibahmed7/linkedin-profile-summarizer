import { describe, it, expect, beforeEach, vi } from 'vitest';
import { cleanExtractedText, extractVisiblePostsFromDom, isSupportedLinkedInUrl } from '../src/content/post-extractor';
import { parseAndValidateSummaryJson, sanitizeAndTruncateInput } from '../src/lib/validation';
import { buildSummarizationPrompt } from '../src/lib/prompts';

const memoryStorage: Record<string, unknown> = {};
vi.stubGlobal('chrome', {
  storage: { local: { get: vi.fn(async (k: string) => ({ [k]: memoryStorage[k] })), set: vi.fn(async (o: Record<string, unknown>) => Object.assign(memoryStorage, o)), remove: vi.fn() } },
  action: { setBadgeText: vi.fn(), setBadgeBackgroundColor: vi.fn() },
});

describe('LinkedIn Profile Summarizer AI Suite', () => {
  beforeEach(() => { for (const k of Object.keys(memoryStorage)) delete memoryStorage[k]; });
  it('validates LinkedIn profile URLs (/in/)', () => {
    expect(isSupportedLinkedInUrl('https://www.linkedin.com/in/ada-lovelace/')).toBe(true);
    expect(isSupportedLinkedInUrl('https://www.linkedin.com/feed/')).toBe(false);
  });
  it('cleans UI noise', () => {
    expect(cleanExtractedText('Senior Engineer\n...see more')).toBe('Senior Engineer');
  });
  it('extracts structured profile from DOM', () => {
    document.body.innerHTML = '<main><section><h1>Ada Lovelace</h1><div class="text-body-medium break-words">Principal Architect & Mathematician</div></section><section><div id="about"></div><div class="inline-show-more-text">Pioneering computer programming and analytical engines.</div></section></main>';
    const { primaryPost } = extractVisiblePostsFromDom(document);
    expect(primaryPost).not.toBeNull();
    expect(primaryPost?.authorName).toBe('Ada Lovelace');
    expect(primaryPost?.content).toContain('Principal Architect');
  });
  it('truncates long profile input safely', () => {
    const res = sanitizeAndTruncateInput('A'.repeat(1200), 1000);
    expect(res.wasTruncated).toBe(true);
    expect(res.processedCharCount).toBe(1000);
  });
  it('fences untrusted profile input in prompt', () => {
    const p = buildSummarizationPrompt({ authorName: 'Ada', postContent: 'Experience...', mode: 'executive-bio', length: 'medium', wasTruncated: false });
    expect(p).toContain('<untrusted_linkedin_profile>');
  });
  it('validates Gemini Profile JSON output', () => {
    const raw = JSON.stringify({ title: 'Principal Engineer', mainIdea: 'Distributed systems leader', summary: '10 years building scalable cloud platforms.', keyTakeaways: ['Led 20 engineers'] });
    const res = parseAndValidateSummaryJson(raw, { wasTruncated: false, originalCharCount: 80, processedCharCount: 80 });
    expect(res.title).toBe('Principal Engineer');
  });
});