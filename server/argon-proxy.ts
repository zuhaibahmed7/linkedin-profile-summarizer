import http from 'node:http';
import { SUMMARIZER_SYSTEM_INSTRUCTION } from '../src/lib/prompts';

const PORT = Number(process.env.PORT || 8787);
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const ARGON_GATEWAY_URL = process.env.ARGON_GATEWAY_URL || '';
const ARGON_API_KEY = process.env.ARGON_API_KEY || '';

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Client');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  if (req.method === 'GET' && req.url === '/api/health') {
    const ready = Boolean(GEMINI_API_KEY || ARGON_GATEWAY_URL);
    res.writeHead(ready ? 200 : 503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: ready ? 'ok' : 'missing_credentials' }));
    return;
  }
  if (req.method === 'POST' && req.url === '/api/gemini') {
    let body = '';
    for await (const chunk of req) body += chunk;
    try {
      const parsed = JSON.parse(body);
      const model = parsed.model || 'gemini-2.5-flash';
      const targetEndpoint = ARGON_GATEWAY_URL || ('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent?key=' + encodeURIComponent(GEMINI_API_KEY));
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (ARGON_GATEWAY_URL && ARGON_API_KEY) headers['Authorization'] = 'Bearer ' + ARGON_API_KEY;
      const upstreamRes = await fetch(targetEndpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SUMMARIZER_SYSTEM_INSTRUCTION }] },
          contents: [{ role: 'user', parts: [{ text: parsed.prompt }] }],
          generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
        }),
      });
      const data = await upstreamRes.json();
      const resultText = data?.candidates?.[0]?.content?.parts?.[0]?.text || data?.resultText || '';
      res.writeHead(upstreamRes.ok ? 200 : upstreamRes.status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ resultText }));
    } catch {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Proxy error' }));
    }
    return;
  }
  res.writeHead(404); res.end();
});
server.listen(PORT, () => console.log('Argon/Gemini Proxy listening on http://localhost:' + PORT));