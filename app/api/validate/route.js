// POST /api/validate
// Body: { idea: string, niche?: string }
//
// Validates a single idea using the shared pipeline in app/lib/validateIdea.js.
// See that file for how demand, competition, and pricing signals are gathered.

import { validateIdea, hasApiKey } from '../../lib/validateIdea';

export async function POST(req) {
  try {
    const { idea, niche } = await req.json();

    if (!idea || !idea.trim()) {
      return Response.json({ error: 'Enter an idea to validate.' }, { status: 400 });
    }
    if (!hasApiKey()) {
      return Response.json(
        { error: 'ANTHROPIC_API_KEY is not set in your Vercel environment variables.' },
        { status: 500 }
      );
    }

    const result = await validateIdea(idea, niche);
    return Response.json(result);
  } catch (err) {
    console.error(err);
    return Response.json(
      { error: 'Validation failed. Check your API key and try again.' },
      { status: 500 }
    );
  }
}
