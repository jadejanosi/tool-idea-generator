// POST /api/subscribe
// Body: { email: string, source?: string }
//
// Adds an email to your Brevo list. This is intentionally fire-and-forget
// from the frontend's perspective: if Brevo is down or misconfigured, the
// tool should still deliver its result rather than blocking the user's
// value on a third-party API succeeding. The "gate" is requiring an email
// be entered, not requiring Brevo's call to succeed.

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const BREVO_LIST_ID = process.env.BREVO_LIST_ID; // e.g. 17 for your NOVA-style lists

export async function POST(req) {
  try {
    const { email, source } = await req.json();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return Response.json({ error: 'Enter a valid email.' }, { status: 400 });
    }
    if (!BREVO_API_KEY || !BREVO_LIST_ID) {
      // Don't hard-fail the user experience over a missing env var,
      // just log it so you notice in Vercel logs, and return success
      // so the tool doesn't block on a config issue.
      console.error('BREVO_API_KEY or BREVO_LIST_ID not set.');
      return Response.json({ ok: true, warning: 'Email capture not configured yet.' });
    }

    const res = await fetch('https://api.brevo.com/v3/contacts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': BREVO_API_KEY,
      },
      body: JSON.stringify({
        email,
        listIds: [parseInt(BREVO_LIST_ID, 10)],
        updateEnabled: true, // prevents "contact already exists" errors
        attributes: source ? { SOURCE: source } : undefined,
      }),
    });

    // Brevo returns 204 on success, or 400 if the contact already exists
    // even with updateEnabled in some edge cases, treat both as success
    // for the purposes of this gate.
    if (!res.ok && res.status !== 400) {
      const errBody = await res.text().catch(() => '');
      console.error('Brevo error:', res.status, errBody);
    }

    return Response.json({ ok: true });
  } catch (err) {
    console.error(err);
    // Same principle: don't block the tool over an email-capture failure.
    return Response.json({ ok: true, warning: err.message });
  }
}
