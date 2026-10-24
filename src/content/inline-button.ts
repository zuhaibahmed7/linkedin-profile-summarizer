import { extractVisiblePostsFromDom, isSupportedLinkedInUrl } from './post-extractor';
import { ExtractedPost } from '../types';

const INLINE_BTN_ID = 'li-profile-summarizer-inline-btn';

export function injectInlineSummarizeButtons(onTrigger: (profile: ExtractedPost) => void): void {
  if (!isSupportedLinkedInUrl(window.location.href)) {
    removeInlineSummarizeButtons();
    return;
  }
  if (document.getElementById(INLINE_BTN_ID)) return;

  const nameHeading = document.querySelector('main h1');
  if (!nameHeading || !nameHeading.parentElement) return;

  const btn = document.createElement('button');
  btn.id = INLINE_BTN_ID;
  btn.type = 'button';
  btn.textContent = '✨ Summarize Profile';
  btn.title = 'Summarize this LinkedIn Profile with Gemini AI';
  Object.assign(btn.style, {
    marginLeft: '10px',
    padding: '4px 12px',
    fontSize: '12px',
    fontWeight: '600',
    color: '#ffffff',
    backgroundColor: '#0a66c2',
    border: 'none',
    borderRadius: '9999px',
    cursor: 'pointer',
    verticalAlign: 'middle',
    boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
  });

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();
    const { primaryPost } = extractVisiblePostsFromDom(document);
    if (primaryPost) {
      btn.textContent = '✓ Profile Sent to Popup (Click Extension Icon)';
      btn.style.backgroundColor = '#059669';
      setTimeout(() => {
        btn.textContent = '✨ Summarize Profile';
        btn.style.backgroundColor = '#0a66c2';
      }, 3000);
      onTrigger(primaryPost);
    }
  });

  nameHeading.parentElement.appendChild(btn);
}

export function removeInlineSummarizeButtons(): void {
  const existing = document.getElementById(INLINE_BTN_ID);
  if (existing) existing.remove();
}