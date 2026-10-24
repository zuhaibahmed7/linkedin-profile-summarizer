import React, { useEffect, useState } from 'react';
import { Sparkles, Save, CheckCircle2 } from 'lucide-react';
import { ExtensionSettings } from '../types';
import { getSettings, saveSettings } from '../lib/storage';
import { DEFAULT_SETTINGS } from '../lib/validation';

export default function Options() {
  const [form, setForm] = useState<ExtensionSettings>(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState(false);

  useEffect(() => { getSettings().then(setForm); }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const next = await saveSettings(form);
    setForm(next); setSaved(true); setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="max-w-xl mx-auto py-10 px-6 space-y-6">
      <div className="flex items-center gap-3"><div className="w-9 h-9 rounded-lg bg-brand-500 flex items-center justify-center text-white"><Sparkles className="w-5 h-5" /></div><h1 className="text-xl font-bold">LinkedIn Summarizer AI — Settings</h1></div>
      <form onSubmit={handleSubmit} className="space-y-4 bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800">
        <div>
          <label className="block text-xs font-semibold mb-1">Connection Mode</label>
          <select value={form.connectionMode} onChange={(e) => setForm({ ...form, connectionMode: e.target.value as ExtensionSettings['connectionMode'] })} className="w-full text-sm px-3 py-2 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
            <option value="backend-proxy">Argon / Backend Proxy (Recommended)</option>
            <option value="direct-api">Personal Direct Gemini API Key</option>
          </select>
        </div>
        {form.connectionMode === 'backend-proxy' ? (
          <div><label className="block text-xs font-semibold mb-1">Backend Proxy URL</label><input type="url" value={form.backendUrl} onChange={(e) => setForm({ ...form, backendUrl: e.target.value })} className="w-full text-sm px-3 py-2 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" /></div>
        ) : (
          <div><label className="block text-xs font-semibold mb-1">Personal Gemini API Key</label><input type="password" value={form.directGeminiApiKey} onChange={(e) => setForm({ ...form, directGeminiApiKey: e.target.value })} placeholder="AIzaSy..." className="w-full text-sm px-3 py-2 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" /></div>
        )}
        <div>
          <label className="block text-xs font-semibold mb-1">Gemini Model</label>
          <select value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value as ExtensionSettings['model'] })} className="w-full text-sm px-3 py-2 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
            <option value="gemini-2.5-flash">gemini-2.5-flash</option>
            <option value="gemini-2.5-pro">gemini-2.5-pro</option>
            <option value="gemini-2.0-flash">gemini-2.0-flash</option>
          </select>
        </div>
        <button type="submit" className="px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-semibold flex items-center gap-2"><Save className="w-4 h-4" />Save Settings</button>
        {saved && <div className="text-emerald-600 text-xs flex items-center gap-1"><CheckCircle2 className="w-4 h-4" />Settings saved!</div>}
      </form>
    </div>
  );
}