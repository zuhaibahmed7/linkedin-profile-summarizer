import { useEffect, useState } from 'react';
import {
  UserCheck,
  Settings,
  Copy,
  Check,
  RefreshCw,
  Bookmark,
  Download,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  History,
  Trash2,
  MessageSquarePlus,
  FileEdit,
  ExternalLink,
  Search,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import {
  AppError,
  ExtractedPost,
  ExtensionSettings,
  MessageResponse,
  SavedSummary,
  SummaryLength,
  SummaryMode,
  SummaryResult,
} from '../types';
import {
  clearAllSavedSummaries,
  consumePendingInlinePost,
  deleteSavedSummary,
  getSavedSummaries,
  getSettings,
  saveSummaryEntry,
} from '../lib/storage';
import { DEFAULT_SETTINGS } from '../lib/validation';

const SUMMARY_MODES: Array<{ id: SummaryMode; label: string }> = [
  { id: 'executive-bio', label: 'Executive Bio' },
  { id: 'recruiter-screen', label: 'Recruiter Screen & Fit' },
  { id: 'skills-stack', label: 'Tech & Skills Breakdown' },
  { id: 'career-progression', label: 'Career Trajectory' },
  { id: 'outreach-icebreakers', label: 'Outreach & Icebreakers' },
  { id: 'custom', label: 'Custom Role Evaluation' },
];

export default function App() {
  const [settings, setSettings] = useState<ExtensionSettings>(DEFAULT_SETTINGS);
  const [activeTab, setActiveTab] = useState<'summarize' | 'history'>('summarize');
  const [connected, setConnected] = useState<boolean | null>(null);
  const [isProfilePage, setIsProfilePage] = useState<boolean>(false);

  const [profile, setProfile] = useState<ExtractedPost | null>(null);
  const [isManualEdit, setIsManualEdit] = useState<boolean>(false);
  const [manualText, setManualText] = useState<string>('');
  const [manualAuthor, setManualAuthor] = useState<string>('LinkedIn Member');

  const [mode, setMode] = useState<SummaryMode>('executive-bio');
  const [length, setLength] = useState<SummaryLength>('medium');
  const [customInstruction, setCustomInstruction] = useState<string>('');

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<AppError | null>(null);
  const [result, setResult] = useState<SummaryResult | null>(null);
  const [showDeepDetails, setShowDeepDetails] = useState<boolean>(false);

  const [copied, setCopied] = useState<boolean>(false);
  const [savedNotice, setSavedNotice] = useState<boolean>(false);

  const [outreachLoading, setOutreachLoading] = useState<boolean>(false);
  const [outreachTone, setOutreachTone] = useState<'Networking' | 'Recruiting' | 'CoffeeChat'>('Networking');
  const [outreachDraft, setOutreachDraft] = useState<string>('');

  const [history, setHistory] = useState<SavedSummary[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');

  useEffect(() => {
    initializePopup();
  }, []);

  async function initializePopup() {
    chrome.action.setBadgeText({ text: '' });
    const loadedSettings = await getSettings();
    setSettings(loadedSettings);
    setMode(loadedSettings.defaultMode);
    setLength(loadedSettings.defaultLength);

    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.classList.toggle(
      'dark',
      loadedSettings.theme === 'dark' || (loadedSettings.theme === 'system' && prefersDark)
    );

    setHistory(await getSavedSummaries());

    chrome.runtime.sendMessage(
      { type: 'CHECK_CONNECTIVITY' },
      (res: MessageResponse<{ connected: boolean }>) => {
        setConnected(Boolean(res?.ok && res.data?.connected));
      }
    );

    const pendingInline = await consumePendingInlinePost<ExtractedPost>();
    if (pendingInline) {
      setIsProfilePage(true);
      setProfile(pendingInline);
      setManualText(pendingInline.content);
      setManualAuthor(pendingInline.authorName);
      return;
    }

    await detectAndExtractCurrentProfile(loadedSettings.autoSummarize);
  }

  async function detectAndExtractCurrentProfile(shouldAutoSummarize = false) {
    setError(null);
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab?.id || !tab.url || !tab.url.includes('linkedin.com/in/')) {
      setIsProfilePage(false);
      setIsManualEdit(true);
      setError({
        code: 'UNSUPPORTED_PAGE',
        message: 'Active tab is not a LinkedIn Profile page (/in/...).',
        nextStep: 'Open any LinkedIn member profile (linkedin.com/in/username) or paste their bio below.',
      });
      return;
    }

    setIsProfilePage(true);

    chrome.tabs.sendMessage(
      tab.id,
      { type: 'EXTRACT_ACTIVE_POST' },
      (response: MessageResponse<ExtractedPost>) => {
        if (chrome.runtime.lastError || !response) {
          setError({
            code: 'EXTRACTION_FAILED',
            message: 'Could not read the LinkedIn profile page.',
            nextStep: 'Refresh the LinkedIn profile tab once and reopen this popup.',
          });
          setIsManualEdit(true);
          return;
        }

        if (!response.ok || !response.data) {
          setError(
            response.error || {
              code: 'NO_POST_DETECTED',
              message: 'Could not extract profile sections.',
              nextStep: 'Scroll down slightly on the profile so Experience loads, then click Re-scan.',
            }
          );
          setIsManualEdit(true);
          return;
        }

        setProfile(response.data);
        setManualText(response.data.content);
        setManualAuthor(response.data.authorName);

        if (shouldAutoSummarize) {
          handleSummarize(response.data);
        }
      }
    );
  }

  async function handleSummarize(overrideProfile?: ExtractedPost) {
    setError(null);
    setOutreachDraft('');

    const effectiveProfile: ExtractedPost = overrideProfile || {
      id: profile?.id || 'profile-' + Date.now(),
      authorName: manualAuthor.trim() || 'LinkedIn Member',
      content: isManualEdit ? manualText : profile?.content || manualText,
      url: profile?.url || 'https://www.linkedin.com/in/',
    };

    if (!effectiveProfile.content || effectiveProfile.content.trim().length < 20) {
      setError({
        code: 'EMPTY_CONTENT',
        message: 'Profile content is empty or too short.',
        nextStep: 'Open a LinkedIn profile page or paste profile text manually.',
      });
      return;
    }

    setLoading(true);
    chrome.runtime.sendMessage(
      {
        type: 'SUMMARIZE_POST',
        payload: {
          post: effectiveProfile,
          mode,
          length,
          customInstruction,
        },
      },
      async (response: MessageResponse<SummaryResult>) => {
        setLoading(false);
        if (!response?.ok || !response.data) {
          setError(
            response?.error || {
              code: 'UNKNOWN_ERROR',
              message: 'Failed to summarize profile.',
              nextStep: 'Check your Gemini API Key or Argon Proxy in Settings.',
            }
          );
          return;
        }
        setResult(response.data);
        setHistory(await getSavedSummaries());
      }
    );
  }

  async function handleGenerateOutreach() {
    if (!result) return;
    const sourceContent = isManualEdit ? manualText : profile?.content || manualText;
    setOutreachLoading(true);
    chrome.runtime.sendMessage(
      {
        type: 'GENERATE_COMMENT',
        payload: {
          postContent: sourceContent,
          summaryTitle: (profile?.authorName || manualAuthor) + ' - ' + result.title,
          tone: outreachTone,
        },
      },
      (res: MessageResponse<{ draftComment: string }>) => {
        setOutreachLoading(false);
        if (res?.ok && res.data?.draftComment) {
          setOutreachDraft(res.data.draftComment);
        } else if (res?.error) {
          setError(res.error);
        }
      }
    );
  }

  function formatSummaryForExport(res: SummaryResult, format: 'md' | 'txt'): string {
    const name = profile?.authorName || manualAuthor;
    if (format === 'md') {
      return [
        '# ' + name + ' — ' + res.title,
        '**Value Proposition:** ' + res.mainIdea,
        '**Archetype:** ' + res.sentiment.label,
        '',
        '## Executive Profile Summary',
        res.summary,
        '',
        '## Standout Strengths & Highlights',
        ...res.keyTakeaways.map((t) => '- ' + t),
        '',
        '## Outreach Icebreakers',
        ...res.actionItems.map((a) => '- ' + a),
        '',
        '**Core Tech / Skills:** ' + res.entities.technologies.join(', '),
        '**Organizations:** ' + res.entities.companies.join(', '),
      ].join('\n');
    }
    return [
      name.toUpperCase() + ' - ' + res.title,
      'Positioning: ' + res.mainIdea,
      '',
      'EXECUTIVE SUMMARY:',
      res.summary,
      '',
      'KEY STRENGTHS:',
      ...res.keyTakeaways.map((t) => '* ' + t),
    ].join('\n');
  }

  function handleDownload(format: 'md' | 'txt') {
    if (!result) return;
    const content = formatSummaryForExport(result, format);
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'profile-summary-' + Date.now() + '.' + format;
    a.click();
    URL.revokeObjectURL(url);
  }

  const filteredHistory = history.filter(
    (h) =>
      h.result.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      h.result.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
      h.authorName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col min-h-[540px] max-h-[600px] overflow-hidden">
      <header className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-brand-500 flex items-center justify-center text-white">
            <UserCheck className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-sm font-bold leading-tight">Profile Summarizer AI</h1>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
              <span className={'w-2 h-2 rounded-full ' + (connected === null ? 'bg-amber-400' : connected ? 'bg-emerald-500' : 'bg-rose-500')} />
              <span>{connected === null ? 'Checking...' : connected ? 'Argon • ' + settings.model : 'API Disconnected'}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => setActiveTab(activeTab === 'summarize' ? 'history' : 'summarize')} className="p-1.5 rounded-md text-xs font-medium flex items-center gap-1 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
            <History className="w-4 h-4" /><span>{history.length}</span>
          </button>
          <button type="button" onClick={() => chrome.runtime.openOptionsPage()} className="p-1.5 rounded-md text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </header>

      {activeTab === 'summarize' ? (
        <main className="flex-1 overflow-y-auto px-4 py-3 space-y-3 scrollbar-thin">
          <section className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-brand-500">{isProfilePage ? '✓ LinkedIn Profile Detected' : 'Manual Profile Paste Mode'}</span>
              <div className="flex items-center gap-2">
                {isProfilePage && (
                  <button type="button" onClick={() => detectAndExtractCurrentProfile(false)} className="text-xs text-brand-500 hover:underline flex items-center gap-1">
                    <RefreshCw className="w-3 h-3" />Re-scan
                  </button>
                )}
                <button type="button" onClick={() => setIsManualEdit(!isManualEdit)} className="text-xs text-slate-500 hover:underline flex items-center gap-1">
                  <FileEdit className="w-3 h-3" />{isManualEdit ? 'Preview Card' : 'Raw Profile Text'}
                </button>
              </div>
            </div>

            {isManualEdit ? (
              <div className="space-y-1.5">
                <input type="text" value={manualAuthor} onChange={(e) => setManualAuthor(e.target.value)} placeholder="Member Name" className="w-full text-xs px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900" />
                <textarea rows={4} value={manualText} onChange={(e) => setManualText(e.target.value)} placeholder="Paste LinkedIn profile bio, experience, and skills here..." className="w-full text-xs p-2 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900" />
              </div>
            ) : profile ? (
              <div className="text-xs space-y-0.5">
                <div className="font-bold text-slate-900 dark:text-white">{profile.authorName}</div>
                {profile.authorHeadline && <div className="text-slate-600 dark:text-slate-300 line-clamp-1">{profile.authorHeadline}</div>}
                {profile.location && <div className="text-[11px] text-slate-400">{profile.location}</div>}
              </div>
            ) : (
              <p className="text-xs text-slate-400">Open a LinkedIn profile (/in/...) and click Re-scan.</p>
            )}
          </section>

          <section className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <select value={mode} onChange={(e) => setMode(e.target.value as SummaryMode)} className="w-full text-xs rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-2">
                {SUMMARY_MODES.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
            </div>
            <div>
              <select value={length} onChange={(e) => setLength(e.target.value as SummaryLength)} className="w-full text-xs rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-2">
                <option value="short">Short</option>
                <option value="medium">Medium</option>
                <option value="long">Detailed</option>
              </select>
            </div>
          </section>

          {mode === 'custom' && (
            <input type="text" value={customInstruction} onChange={(e) => setCustomInstruction(e.target.value)} placeholder="E.g., Evaluate fit for a Senior React + AI Engineer role..." className="w-full text-xs px-3 py-2 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800" />
          )}

          <button type="button" disabled={loading} onClick={() => handleSummarize()} className="w-full py-2.5 px-4 rounded-lg bg-brand-500 hover:bg-brand-600 disabled:opacity-60 text-white font-semibold text-xs flex items-center justify-center gap-2">
            {loading ? <><RefreshCw className="w-4 h-4 animate-spin" /><span>Analyzing Profile with Gemini...</span></> : <><Sparkles className="w-4 h-4" /><span>Summarize LinkedIn Profile</span></>}
          </button>

          {error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 dark:bg-rose-950/40 p-3 text-xs space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-rose-700 dark:text-rose-300"><AlertCircle className="w-4 h-4" /><span>{error.message}</span></div>
              <p className="text-rose-600 dark:text-rose-400">Next: {error.nextStep}</p>
            </div>
          )}

          {!loading && result && (
            <section className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 p-3.5 space-y-3 text-xs">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-sm font-bold">{result.title}</h2>
                  <p className="text-[11px] text-brand-500 font-medium">{result.mainIdea}</p>
                </div>
                <span className="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700">
                  {result.sentiment.label}
                </span>
              </div>

              <p className="leading-relaxed whitespace-pre-line border-t border-slate-100 dark:border-slate-700 pt-2">{result.summary}</p>

              {result.keyTakeaways.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-1">Career Highlights & Strengths</h3>
                  <ul className="list-disc pl-4 space-y-1">{result.keyTakeaways.map((k, i) => <li key={i}>{k}</li>)}</ul>
                </div>
              )}

              {result.entities.technologies.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-1">Core Skills & Tech Stack</h3>
                  <div className="flex flex-wrap gap-1">
                    {result.entities.technologies.map((tech, i) => (
                      <span key={i} className="text-[10px] px-2 py-0.5 rounded bg-brand-50 dark:bg-slate-900 text-brand-600 dark:text-brand-100 font-medium">{tech}</span>
                    ))}
                  </div>
                </div>
              )}

              <button type="button" onClick={() => setShowDeepDetails(!showDeepDetails)} className="w-full py-1 text-brand-500 font-medium flex items-center justify-center gap-1 border-t border-slate-100 dark:border-slate-700 pt-2">
                {showDeepDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                <span>{showDeepDetails ? 'Hide Icebreakers & Interview Questions' : 'Show Outreach Icebreakers & Cold Note Drafter'}</span>
              </button>

              {showDeepDetails && (
                <div className="space-y-2.5 border-t pt-2 border-slate-100 dark:border-slate-700">
                  {result.actionItems.length > 0 && (
                    <div>
                      <h4 className="font-semibold">Personalized Icebreakers</h4>
                      <ul className="list-disc pl-4 space-y-0.5 mt-0.5">{result.actionItems.map((a, i) => <li key={i}>{a}</li>)}</ul>
                    </div>
                  )}
                  {result.followUpQuestions.length > 0 && (
                    <div>
                      <h4 className="font-semibold">Interview / Coffee-Chat Questions</h4>
                      <ul className="list-disc pl-4 space-y-0.5 mt-0.5">{result.followUpQuestions.map((q, i) => <li key={i}>{q}</li>)}</ul>
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-1">
                    <span className="font-semibold flex items-center gap-1"><MessageSquarePlus className="w-3.5 h-3.5 text-brand-500" />Connection Note Goal</span>
                    <select value={outreachTone} onChange={(e) => setOutreachTone(e.target.value as 'Networking' | 'Recruiting' | 'CoffeeChat')} className="text-[11px] rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-1.5 py-0.5">
                      <option value="Networking">Peer Networking</option>
                      <option value="Recruiting">Recruiting / Hiring</option>
                      <option value="CoffeeChat">Coffee Chat Request</option>
                    </select>
                  </div>
                  <button type="button" disabled={outreachLoading} onClick={handleGenerateOutreach} className="w-full py-1.5 rounded border border-brand-500 text-brand-500 font-medium">
                    {outreachLoading ? 'Drafting Note...' : 'Draft 300-Char Connection Note'}
                  </button>
                  {outreachDraft && <div className="p-2 rounded bg-slate-50 dark:bg-slate-900 italic">{outreachDraft}</div>}
                </div>
              )}

              <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-700">
                <div className="flex gap-1.5">
                  <button type="button" onClick={async () => { await navigator.clipboard.writeText(formatSummaryForExport(result, 'md')); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-700 flex items-center gap-1">
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}<span>{copied ? 'Copied' : 'Copy'}</span>
                  </button>
                  <button type="button" onClick={async () => { const next = await saveSummaryEntry({ id: 'profile-' + Date.now(), createdAt: Date.now(), sourceUrl: profile?.url || '', authorName: profile?.authorName || manualAuthor, mode, length, result }); setHistory(next); setSavedNotice(true); setTimeout(() => setSavedNotice(false), 1500); }} className="px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-700 flex items-center gap-1">
                    <Bookmark className="w-3.5 h-3.5" /><span>{savedNotice ? 'Saved' : 'Save'}</span>
                  </button>
                </div>
                <div className="flex gap-1">
                  <button type="button" onClick={() => handleDownload('md')} className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-700 flex items-center gap-1"><Download className="w-3 h-3" /><span>.MD</span></button>
                  <button type="button" onClick={() => handleDownload('txt')} className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-700 flex items-center gap-1"><Download className="w-3 h-3" /><span>.TXT</span></button>
                </div>
              </div>
            </section>
          )}
        </main>
      ) : (
        <main className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
          <div className="flex justify-between items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-2" />
              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search saved profiles..." className="w-full text-xs pl-7 pr-2.5 py-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800" />
            </div>
            {history.length > 0 && <button type="button" onClick={async () => { await clearAllSavedSummaries(); setHistory([]); }} className="text-xs text-rose-600">Clear All</button>}
          </div>
          {filteredHistory.map((item) => (
            <div key={item.id} className="p-2.5 rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 text-xs space-y-1">
              <div className="flex justify-between font-bold items-center">
                <span>{item.authorName} — {item.result.title}</span>
                <div className="flex items-center gap-1.5">
                  {item.sourceUrl && <a href={item.sourceUrl} target="_blank" rel="noreferrer"><ExternalLink className="w-3.5 h-3.5 text-slate-400 hover:text-brand-500" /></a>}
                  <button type="button" onClick={async () => setHistory(await deleteSavedSummary(item.id))}><Trash2 className="w-3.5 h-3.5 text-rose-500" /></button>
                </div>
              </div>
              <p className="text-slate-500 line-clamp-2">{item.result.summary}</p>
            </div>
          ))}
        </main>
      )}

      <footer className="px-4 py-2 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between text-[11px] text-slate-400">
        <span className="flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />Only user-selected profiles sent to Gemini</span>
      </footer>
    </div>
  );
}