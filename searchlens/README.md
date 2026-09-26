# SearchLens — SEO / GEO / AEO Audit

A single-page tool that scans a web page for classic SEO, technical, and AI-search (GEO/AEO) readiness — with a 0–100 score, per-check evidence, ready-to-paste fixes, and PDF/CSV export.

- **Frontend** (`index.html`) — the full site + audit engine, runs client-side.
- **Backend** (`api/scan.js`) — a tiny serverless function that fetches any public URL server-side (bypassing browser CORS) so the "Enter URL" scan works live.

Two input modes:
- **Paste HTML** — works entirely in the browser (no backend needed).
- **Enter URL** — calls `/api/scan`, which fetches the page + its `robots.txt` + `llms.txt` and scans them.

---

## Before you deploy — one step

Find-and-replace **`YOURDOMAIN.com`** with your real domain across the project (it appears in `index.html`, `robots.txt`, `sitemap.xml`, and `llms.txt`). That's the only edit needed. If you're only using the free `*.vercel.app` URL for now, use that instead.

## Deploy to Vercel

Pick any one method.

### A) Drag & drop (easiest)
1. Go to **https://vercel.com/new**.
2. Drag this whole `searchlens` folder onto the page (or zip it and upload).
3. Click **Deploy**. Done — you'll get a live URL.

### B) Vercel CLI
```bash
npm i -g vercel        # once
cd searchlens
vercel                 # follow prompts (accept defaults)
vercel --prod          # promote to production
```

### C) GitHub → Vercel
1. Push this folder to a GitHub repo.
2. In Vercel: **Add New… → Project → Import** the repo.
3. Framework preset: **Other** (no build step needed). Deploy.

No environment variables, no build command, no dependencies — it just works.

---

## Structure
```
searchlens/
├── index.html        # frontend + audit engine (client-side) + full SEO meta & JSON-LD
├── api/
│   └── scan.js       # serverless URL-fetch proxy (bypasses CORS)
├── robots.txt        # crawlers + AI crawlers allowed, links sitemap
├── sitemap.xml       # add a <url> per new page you build
├── llms.txt          # AI-readable map of the site
├── favicon.svg       # scalable icon (+ favicon.ico fallback)
├── favicon.ico
├── og-image.png      # social/AI share preview (1200×630)
├── package.json      # Node >=18 (uses built-in fetch, no deps)
├── vercel.json       # function config
└── README.md
```

## How it works
- `index.html` runs all deterministic checks in the browser (title, meta, headings, schema, AI-crawler rules, llms.txt, answer-first, etc.).
- For **Enter URL**, the browser can't read another site's HTML (CORS), so it calls `GET /api/scan?url=…`. The function fetches the page + robots.txt + llms.txt on the server and returns them; the browser then scans that HTML with the same engine.
- `api/scan.js` has basic SSRF protection (blocks localhost / private IPs), a 10s timeout, and a size cap.

## Cost
Runs on Vercel's free (Hobby) tier: static hosting is free, and the function fits comfortably in the free serverless allowance. Effectively **$0/month** at low–moderate traffic.

## Next layers (optional)
- **AI-written fixes** — send the page to a cheap/free LLM (Gemini Flash, Groq, or the user's own key via BYOK) and return page-specific rewrites. Add a second function (`api/fix.js`) and keep the API key in a Vercel Environment Variable — never in the frontend.
- **Backlinks / authority** — via DataForSEO (reseller-friendly) using BYOK or a paid tier; keep it out of the free path.

## Notes
- Opening `index.html` directly from disk (or in a preview host) works for **Paste HTML**; **Enter URL** only works once deployed (it needs `/api/scan`).
- The score is a diagnostic heuristic, not a guarantee.
