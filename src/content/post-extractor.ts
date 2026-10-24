import { ExtractedPost } from '../types';

export function isSupportedLinkedInUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    return url.hostname.endsWith('linkedin.com') && url.pathname.startsWith('/in/');
  } catch {
    return false;
  }
}

export function cleanExtractedText(raw: string): string {
  return raw
    .replace(/\u00A0/g, ' ')
    .replace(/^\u2026see more$/gim, '')
    .replace(/^\.\.\.see more$/gim, '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line, idx, arr) => !(line === '' && arr[idx - 1] === ''))
    .join('\n')
    .trim();
}

function extractSectionText(doc: Document, anchorId: string, maxItems = 8): string {
  const anchor = doc.getElementById(anchorId);
  const section = anchor?.closest('section');
  if (!section) return '';

  const items = section.querySelectorAll('li.artdeco-list__item');
  if (items.length > 0) {
    const lines: string[] = [];
    items.forEach((item, idx) => {
      if (idx >= maxItems) return;
      const visibleSpans = Array.from(item.querySelectorAll('span[aria-hidden="true"]'))
        .map((s) => s.textContent?.trim())
        .filter(Boolean);
      if (visibleSpans.length > 0) {
        lines.push('- ' + Array.from(new Set(visibleSpans)).join(' | '));
      }
    });
    if (lines.length > 0) return lines.join('\n');
  }

  const clone = section.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('.visually-hidden, .sr-only, button, script, style').forEach((e) => e.remove());
  return cleanExtractedText(clone.innerText || clone.textContent || '').slice(0, 2500);
}

export function extractVisiblePostsFromDom(doc: Document = document): {
  primaryPost: ExtractedPost | null;
  candidates: ExtractedPost[];
} {
  const pageUrl = doc.location?.href || 'https://www.linkedin.com/in/';
  const mainEl = doc.querySelector('main') || doc.body;

  const nameEl = mainEl.querySelector('h1');
  const fullName = nameEl?.textContent?.trim() || 'LinkedIn Member';

  const topCard = nameEl?.closest('section') || mainEl;
  const headlineEl = topCard.querySelector('.text-body-medium.break-words') || topCard.querySelector('[data-generated-suggestion-target]');
  const headline = headlineEl?.textContent?.trim() || '';

  const locationEl = topCard.querySelector('.text-body-small.inline.t-black--light.break-words');
  const location = locationEl?.textContent?.trim() || '';

  const aboutText = extractSectionText(doc, 'about', 4);
  const experienceText = extractSectionText(doc, 'experience', 10);
  const educationText = extractSectionText(doc, 'education', 5);
  const skillsText = extractSectionText(doc, 'skills', 15);
  const projectsText = extractSectionText(doc, 'projects', 5);
  const certificationsText = extractSectionText(doc, 'licenses_and_certifications', 6);

  const structuredParts: string[] = [
    'FULL NAME: ' + fullName,
    headline ? 'HEADLINE: ' + headline : '',
    location ? 'LOCATION: ' + location : '',
    aboutText ? '\n=== ABOUT ===\n' + aboutText : '',
    experienceText ? '\n=== EXPERIENCE ===\n' + experienceText : '',
    educationText ? '\n=== EDUCATION ===\n' + educationText : '',
    skillsText ? '\n=== SKILLS ===\n' + skillsText : '',
    projectsText ? '\n=== PROJECTS ===\n' + projectsText : '',
    certificationsText ? '\n=== CERTIFICATIONS ===\n' + certificationsText : '',
  ].filter(Boolean);

  let combinedContent = structuredParts.join('\n');

  // Resilient fallback: if LinkedIn obfuscated section IDs, grab clean text from <main>
  if (combinedContent.length < 120 && mainEl) {
    const clone = mainEl.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('button, nav, aside, footer, script, style, .visually-hidden, .sr-only').forEach((el) => el.remove());
    const rawMain = cleanExtractedText(clone.innerText || clone.textContent || '');
    combinedContent = 'FULL NAME: ' + fullName + '\n' + (headline ? 'HEADLINE: ' + headline + '\n' : '') + rawMain.slice(0, 10000);
  }

  if (combinedContent.trim().length < 25) {
    return { primaryPost: null, candidates: [] };
  }

  const handle = doc.location?.pathname.split('/').filter(Boolean)[1] || 'member';
  const profileData: ExtractedPost = {
    id: 'profile-' + handle,
    authorName: fullName,
    authorHeadline: headline,
    location,
    content: combinedContent,
    url: pageUrl,
  };

  return { primaryPost: profileData, candidates: [profileData] };
}

export function extractPostFromContainer(container: Element, pageUrl: string): ExtractedPost | null {
  const text = cleanExtractedText(container.textContent || '');
  if (text.length < 20) return null;
  return { id: 'profile-card', authorName: 'LinkedIn Member', content: text, url: pageUrl };
}