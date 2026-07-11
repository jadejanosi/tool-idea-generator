// Shared validation pipeline, used by both /api/validate (single idea)
// and /api/discover (generate + filter many ideas). Keeping this in one
// place means both modes always score ideas identically.

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

export async function callClaude(prompt, { maxTokens = 1000, tools = null } = {}) {
  const body = {
    model: 'claude-sonnet-4-6',
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: prompt }],
  };
  if (tools) body.tools = tools;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error('Claude API request failed.');
  const data = await res.json();
  const text = data.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n');
  return text;
}

export async function extractKeyword(idea, niche) {
  const prompt = `Extract a single short search-style keyword phrase (3-6 words, lowercase, no punctuation) that someone would type into Google to find a tool like this. Return ONLY the phrase, nothing else.

Idea: ${idea}
Niche: ${niche || 'not specified'}`;
  const text = await callClaude(prompt, { maxTokens: 60 });
  return text.trim().toLowerCase().replace(/["'.]/g, '');
}

function monthsAgo(n) {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d;
}

export async function getTrendData(keyword) {
  try {
    const googleTrends = (await import('google-trends-api')).default;
    const raw = await googleTrends.interestOverTime({ keyword, startTime: monthsAgo(3) });
    const parsed = JSON.parse(raw);
    const points = parsed?.default?.timelineData || [];
    if (!points.length) return null;
    const values = points.map((p) => Number(p.value?.[0] ?? 0));
    const avg = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
    const direction = values[values.length - 1] >= values[0] ? 'rising' : 'declining';
    return { averageInterest: avg, direction };
  } catch {
    return null;
  }
}

export async function getCompetitionSignal(keyword, idea) {
  const prompt = `Search the web for "${keyword}" and for existing tools or products that solve this problem: "${idea}".

Based on what you find, respond with ONLY valid JSON, no markdown fences:
{
  "competitorCount": <your best estimate of how many real, similar existing tools/products you found, as an integer>,
  "saturationNote": "<1 sentence describing how crowded or open this space looks, and name 1-2 examples you found if any>"
}`;

  const text = await callClaude(prompt, {
    maxTokens: 600,
    tools: [{ type: 'web_search_20250305', name: 'web_search' }],
  });

  try {
    const cleaned = text.replace(/```json|```/g, '').trim();
    const match = cleaned.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : null;
  } catch {
    return null;
  }
}

export async function getRedditSignal(keyword) {
  try {
    const query = encodeURIComponent(keyword);
    const res = await fetch(
      `https://www.reddit.com/search.json?q=${query}&sort=relevance&limit=15`,
      { headers: { 'User-Agent': 'idea-validator-tool/1.0' } }
    );
    if (!res.ok) return { posts: [], count: 0 };
    const data = await res.json();
    const posts = (data?.data?.children || []).map((c) => ({
      title: c.data.title,
      upvotes: c.data.ups,
      subreddit: c.data.subreddit,
    }));
    return { posts, count: posts.length };
  } catch {
    return { posts: [], count: 0 };
  }
}

export async function synthesize({ idea, niche, keyword, trendData, competitionSignal, redditSignal }) {
  const prompt = `You are scoring a digital tool idea's sellability. Return ONLY valid JSON, no markdown fences, no preamble.

IDEA: ${idea}
NICHE: ${niche || 'not specified'}
CORE KEYWORD USED FOR RESEARCH: ${keyword}

GOOGLE TRENDS SIGNAL: ${trendData ? JSON.stringify(trendData) : 'not available, Google Trends did not return data for this keyword'}
WEB COMPETITION SIGNAL (from live web search): ${
    competitionSignal ? JSON.stringify(competitionSignal) : 'not available, web search did not return usable data'
  }
REDDIT DEMAND SIGNAL (${redditSignal.count} posts found): ${JSON.stringify(
    redditSignal.posts.slice(0, 10)
  )}

Score three sub-dimensions from 0-100 and an overall score from 0-100:
1. demand: based on Google Trends interest/direction (if available) and how strongly the Reddit posts show real people expressing this problem or asking for a solution like it
2. competition: HIGHER score means MORE headroom (less saturated), based on the web competition signal's competitorCount and saturationNote
3. pricing: how much pricing headroom this idea has, based on how specific/high-value the problem is versus how commodity it sounds

Respond with this exact JSON shape:
{
  "overallScore": <int 0-100>,
  "verdict": "<2-3 sentence plain-language verdict, direct, no filler>",
  "demand": {"score": <int>, "note": "<1 sentence, cite the specific signal used>"},
  "competition": {"score": <int>, "note": "<1 sentence, cite the specific signal used>"},
  "pricing": {"score": <int>, "note": "<1 sentence>"}
}`;

  const text = await callClaude(prompt, { maxTokens: 700 });
  const cleaned = text.replace(/```json|```/g, '').trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  return JSON.parse(match ? match[0] : cleaned);
}

// Full pipeline for one idea, used by both single-validate and discover modes.
export async function validateIdea(idea, niche) {
  const keyword = await extractKeyword(idea, niche);
  const [trendData, competitionSignal, redditSignal] = await Promise.all([
    getTrendData(keyword),
    getCompetitionSignal(keyword, idea),
    getRedditSignal(keyword),
  ]);
  const synthesis = await synthesize({ idea, niche, keyword, trendData, competitionSignal, redditSignal });
  return { idea, niche, keyword, ...synthesis };
}

export function hasApiKey() {
  return Boolean(ANTHROPIC_API_KEY);
}
