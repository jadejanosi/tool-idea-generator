// POST /api/discover
// Body: { niche: string, count?: number, threshold?: number }
//
// "Discover Ideas" mode. This does NOT reverse-engineer the scoring, there's
// no formula to invert since real signals (search trend, live competition,
// Reddit demand) come from the internet, not from Claude's own knowledge.
// Instead this generates a batch of candidate ideas for a niche, runs EVERY
// candidate through the exact same validateIdea() pipeline used by the
// single-idea mode, and returns only the ones that score above the threshold.
//
// IMPORTANT — Vercel execution time: this route can run 6-10+ full
// validation pipelines (each with a web search call) in one request.
// On Vercel's Hobby plan, serverless functions are capped around 10s,
// which this will likely exceed. The maxDuration export below asks for
// more time, but that setting only takes effect on paid Vercel plans.
// If you're on Hobby, drop `count` down to 3-4 and expect it to be slow,
// or upgrade to Pro for the higher execution time ceiling.

import { callClaude, validateIdea, hasApiKey } from '../../lib/validateIdea';

export const maxDuration = 60; // seconds — only honored on Vercel Pro/Enterprise

export async function POST(req) {
  try {
    const { niche, count = 6, threshold = 65 } = await req.json();

    if (!niche || !niche.trim()) {
      return Response.json({ error: 'Enter a niche to discover ideas for.' }, { status: 400 });
    }
    if (!hasApiKey()) {
      return Response.json(
        { error: 'ANTHROPIC_API_KEY is not set in your Vercel environment variables.' },
        { status: 500 }
      );
    }

    const safeCount = Math.min(Math.max(parseInt(count, 10) || 6, 1), 10);

    // Step 1: generate candidate ideas, deliberately varied across tool types
    const candidates = await generateCandidates(niche, safeCount);

    // Step 2: validate every candidate through the SAME pipeline as single mode,
    // in parallel to keep total wall-clock time as low as possible
    const results = await Promise.all(
      candidates.map((c) =>
        validateIdea(c.idea, niche).catch((err) => ({
          idea: c.idea,
          niche,
          error: true,
          overallScore: 0,
          verdict: 'Could not be validated (an API call failed for this candidate).',
        }))
      )
    );

    // Step 3: filter to the ones that clear the bar, sort best first
    const passed = results
      .filter((r) => !r.error && r.overallScore >= threshold)
      .sort((a, b) => b.overallScore - a.overallScore);

    const failed = results
      .filter((r) => r.error || r.overallScore < threshold)
      .sort((a, b) => (b.overallScore || 0) - (a.overallScore || 0));

    return Response.json({
      niche,
      threshold,
      generated: results.length,
      passedCount: passed.length,
      passed,
      failed, // shown collapsed in the UI, useful for seeing what didn't make the cut
    });
  } catch (err) {
    console.error(err);
    return Response.json(
      { error: 'Discovery failed. Check your API key and try again, or lower the idea count.' },
      { status: 500 }
    );
  }
}

async function generateCandidates(niche, count) {
  const prompt = `Generate ${count} distinct AI tool ideas for the niche: "${niche}".

Deliberately vary the TYPE of tool across these ideas, spread them across these categories as evenly as possible:
- Scorer (rates something out of 100)
- Diagnostic (finds a problem and explains why)
- Generator (builds a finished plan or list)
- Quiz (sorts someone into a result)
- Calculator (turns numbers into one answer)

Each idea should be a specific, concrete one-sentence description of what the tool does, not a vague category. Return ONLY valid JSON, no markdown fences, no preamble:
{
  "candidates": [
    {"idea": "<one sentence describing the specific tool>", "type": "<scorer|diagnostic|generator|quiz|calculator>"}
  ]
}`;

  const text = await callClaude(prompt, { maxTokens: 900 });
  const cleaned = text.replace(/```json|```/g, '').trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  const parsed = JSON.parse(match ? match[0] : cleaned);
  return parsed.candidates || [];
}
