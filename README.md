# Idea Validator — Advanced

Two modes:

**Validate My Idea** — score one idea's sellability using Google Trends,
live web competition search, and real Reddit demand language, then a
Claude-synthesized 0-100 score with a plain-language verdict.

**Discover Ideas** — give it a niche instead of one idea. It generates a
batch of candidate tool ideas (varied across scorer/diagnostic/generator/
quiz/calculator types), runs EVERY candidate through the exact same
validation pipeline as single mode, and only shows you the ones that
clear a score threshold. This is not a shortcut around the scoring, there's
no formula to reverse, since demand and competition come from live
internet data. It's generate-then-filter: check many ideas automatically
instead of one at a time.

**Only one API key required.** No Google Cloud project, no Custom Search
Engine, no DataForSEO account.

## Setup (2 minutes)

1. **Get a Claude API key**: console.anthropic.com → API Keys → Create Key
2. **Deploy to Vercel**:
   - Click "Use this template" on the GitHub repo
   - Import the new repo into Vercel
   - In Vercel → Settings → Environment Variables, add `ANTHROPIC_API_KEY`
   - Deploy

## Local development

```
npm install
cp .env.example .env.local   # then add your key
npm run dev
```

Visit http://localhost:3000

## Files that matter

- `app/page.js` — UI for both modes (mode toggle at the top)
- `app/lib/validateIdea.js` — the shared scoring pipeline, used by both
  `/api/validate` and `/api/discover` so both modes always score identically
- `app/api/validate/route.js` — single-idea validation endpoint
- `app/api/discover/route.js` — generates candidates for a niche, validates
  all of them in parallel, returns the ones that passed
- `app/globals.css` — styling, uses the NOVA brand palette by default

## Important: Discover mode and Vercel execution time limits

Discover mode runs several full validation pipelines in one request (each
involving a Claude web search call). On **Vercel's free Hobby plan**,
serverless functions are capped around 10 seconds, which Discover mode
with 6+ candidates will likely exceed, even though the validations run in
parallel, not sequentially.

Options if you hit timeouts:
- Lower the candidate count to 3-4 in the UI dropdown
- Upgrade to Vercel Pro, which allows longer execution time (the
  `maxDuration` setting in `app/api/discover/route.js` only takes effect
  on paid plans)

Validate mode (single idea) is well within Hobby plan limits and does not
have this issue.

## Notes on the free data sources

- **Google Trends** uses an unofficial package that scrapes Google's public
  Trends site. No official rate limit, but can occasionally fail under
  heavy traffic, the tool continues gracefully without that signal if so.
- **Reddit** search is public and free with no auth, but rate-limited by
  Reddit itself under heavy simultaneous use.
- **Claude web search** has no fixed daily cap. Cost scales with normal
  Claude API usage, Discover mode uses noticeably more tokens per run
  than Validate mode since it's checking multiple ideas at once.

## Customizing

To change scoring weights, edit `synthesize()` in `app/lib/validateIdea.js`,
both modes will pick up the change automatically since they share this file.
To change how candidate ideas are generated (e.g. weight toward certain
tool types), edit `generateCandidates()` in `app/api/discover/route.js`.
