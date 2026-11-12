import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8000);
const HOST = '127.0.0.1';
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf'
};
const allowedHtml = new Set(['index.html', 'games-loader.html']);
const buckets = new Map();

function send(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin'
  });
  res.end(JSON.stringify(data));
}

async function readJson(req, limit = 180_000) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw Object.assign(new Error('Request too large.'), { status: 413 });
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw Object.assign(new Error('Invalid JSON.'), { status: 400 }); }
}

function rateLimited(ip) {
  const now = Date.now();
  const recent = (buckets.get(ip) || []).filter(time => now - time < 60_000);
  if (recent.length >= 20) { buckets.set(ip, recent); return true; }
  recent.push(now);
  buckets.set(ip, recent);
  return false;
}

async function handleChat(req, res) {
  if (!process.env.GROQ_API_KEY) {
    return send(res, 503, { error: 'Groq is not configured. Restart Vanta and enter a replacement API key.' });
  }
  if (rateLimited(req.socket.remoteAddress || 'local')) {
    return send(res, 429, { error: 'Please wait a moment before sending another message.' });
  }

  let body;
  try { body = await readJson(req); }
  catch (error) { return send(res, error.status || 400, { error: error.message }); }
  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return send(res, 400, { error: 'Add a message to start the conversation.' });
  }

  const messages = body.messages.slice(-24).map(message => ({
    role: message?.role === 'assistant' ? 'assistant' : 'user',
    content: typeof message?.content === 'string' ? message.content.trim().slice(0, 12_000) : ''
  })).filter(message => message.content);
  if (!messages.length) return send(res, 400, { error: 'Your message is empty.' });
  if (messages.reduce((total, message) => total + message.content.length, 0) > 48_000) {
    return send(res, 413, { error: 'This conversation is too long. Clear it and start a fresh chat.' });
  }

  try {
    const upstream = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-20b',
        messages: [{
          role: 'system',
          content: 'You are Vanta AI, a helpful and conversational assistant inside the Vanta browser dashboard. Answer clearly and honestly. You do not have access to open tabs or browsing history unless the user includes that information in their message.'
        }, ...messages],
        max_completion_tokens: 2048,
        temperature: 0.7
      }),
      signal: AbortSignal.timeout(90_000)
    });
    const data = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      const message = upstream.status === 401
        ? 'Groq rejected the key. Check it and restart Vanta.'
        : upstream.status === 429
          ? 'Groq rate limit reached. Please try again shortly.'
          : 'Groq could not complete that request.';
      return send(res, upstream.status === 429 ? 429 : 502, { error: message });
    }
    const reply = data?.choices?.[0]?.message?.content;
    if (typeof reply !== 'string' || !reply.trim()) {
      return send(res, 502, { error: 'Groq returned an empty reply. Please try again.' });
    }
    return send(res, 200, { reply });
  } catch {
    return send(res, 502, { error: 'Could not reach Groq. Check your internet connection and try again.' });
  }
}

const server = createServer(async (req, res) => {
  const requestUrl = new URL(req.url || '/', `http://${HOST}:${PORT}`);
  if (req.method === 'GET' && requestUrl.pathname === '/api/status') {
    return send(res, 200, { aiAvailable: Boolean(process.env.GROQ_API_KEY), model: 'openai/gpt-oss-20b' });
  }
  if (req.method === 'POST' && requestUrl.pathname === '/api/chat') return handleChat(req, res);
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { error: 'Method not allowed.' });

  let relativePath;
  try { relativePath = decodeURIComponent(requestUrl.pathname === '/' ? 'index.html' : requestUrl.pathname.slice(1)); }
  catch { return send(res, 400, { error: 'Invalid path.' }); }
  const normalized = path.normalize(relativePath);
  if (path.isAbsolute(normalized) || normalized === '..' || normalized.startsWith(`..${path.sep}`)) {
    return send(res, 404, { error: 'Not found.' });
  }
  const filename = path.join(ROOT, normalized);
  const basename = path.basename(filename);
  const extension = path.extname(filename).toLowerCase();
  if (!allowedHtml.has(basename) && !['.css', '.js', '.svg', '.png', '.woff2', '.woff', '.ttf'].includes(extension)) {
    return send(res, 404, { error: 'Not found.' });
  }
  try {
    const details = await stat(filename);
    if (!details.isFile()) return send(res, 404, { error: 'Not found.' });
    const data = await readFile(filename);
    res.writeHead(200, {
      'Content-Type': MIME[extension] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin'
    });
    return res.end(req.method === 'HEAD' ? undefined : data);
  } catch {
    return send(res, 404, { error: 'Not found.' });
  }
});

server.on('error', error => {
  console.error(error.code === 'EADDRINUSE'
    ? 'Port 8000 is already in use. Stop the existing Vanta server before restarting.'
    : 'Vanta server could not start.');
  process.exitCode = 1;
});
server.listen(PORT, HOST, () => console.log(`Vanta is running at http://localhost:${PORT}`));
