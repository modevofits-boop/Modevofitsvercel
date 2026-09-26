// api/scan.js — Vercel serverless function
// Fetches a target page's HTML + robots.txt + llms.txt on the server (bypasses browser CORS),
// so the client-side audit engine can analyse any public URL.
//
// GET /api/scan?url=https://example.com/page
// -> { finalUrl, status, html, robots, llms }

const UA = 'Mozilla/5.0 (compatible; SearchLensBot/1.0; +https://searchlens.app/bot)';
const PAGE_MAX = 2_500_000;   // ~2.5 MB cap on page HTML
const TXT_MAX  = 300_000;     // cap on robots/llms
const TIMEOUT  = 10_000;      // 10s per request

// Block localhost / private-network hosts (basic SSRF guard)
function isBlockedHost(host) {
  host = host.toLowerCase();
  if (host === 'localhost' || host.endsWith('.local') || host === '::1') return true;
  if (/^(127\.|0\.|10\.|169\.254\.|192\.168\.)/.test(host)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return true;
  return false;
}

async function fetchText(url, maxBytes, timeout) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': UA, 'Accept': 'text/html,text/plain,*/*' },
      redirect: 'follow',
      signal: ctrl.signal,
    });
    const buf = Buffer.from(await r.arrayBuffer());
    let text = buf.toString('utf8');
    if (text.length > maxBytes) text = text.slice(0, maxBytes);
    return { ok: r.ok, status: r.status, text, finalUrl: r.url };
  } catch (e) {
    return { ok: false, status: 0, text: '', error: e.name === 'AbortError' ? 'timeout' : e.message };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const raw = (req.query && req.query.url) || '';
  let target;
  try {
    target = new URL(raw);
  } catch {
    return res.status(400).json({ error: 'Invalid URL — include https://' });
  }
  if (!/^https?:$/.test(target.protocol)) {
    return res.status(400).json({ error: 'Only http/https URLs are allowed.' });
  }
  if (isBlockedHost(target.hostname)) {
    return res.status(400).json({ error: 'That host is not allowed.' });
  }

  // Fetch the page
  const page = await fetchText(target.href, PAGE_MAX, TIMEOUT);
  if (!page.ok && !page.text) {
    return res.status(502).json({ error: 'Could not fetch that page (' + (page.error || page.status) + ').' });
  }

  // Best-effort robots.txt + llms.txt from the same origin (never fail the whole request)
  const origin = target.origin;
  const [robots, llms] = await Promise.all([
    fetchText(origin + '/robots.txt', TXT_MAX, 6000),
    fetchText(origin + '/llms.txt', TXT_MAX, 6000),
  ]);

  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
  return res.status(200).json({
    finalUrl: page.finalUrl || target.href,
    status: page.status,
    html: page.text,
    robots: robots.ok ? robots.text : '',
    llms: llms.ok ? llms.text : '',
  });
};
