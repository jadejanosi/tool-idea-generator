'use client';

import { useState } from 'react';

export default function Home() {
  const [mode, setMode] = useState('validate'); // 'validate' | 'discover'

  return (
    <div className="wrap">
      <div className="mode-toggle">
        <button
          className={mode === 'validate' ? 'mode-btn active' : 'mode-btn'}
          onClick={() => setMode('validate')}
        >
          Validate My Idea
        </button>
        <button
          className={mode === 'discover' ? 'mode-btn active' : 'mode-btn'}
          onClick={() => setMode('discover')}
        >
          Discover Ideas
        </button>
      </div>

      {mode === 'validate' ? <ValidateMode /> : <DiscoverMode />}
    </div>
  );
}

function ValidateMode() {
  const [idea, setIdea] = useState('');
  const [niche, setNiche] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!idea.trim()) return;
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const res = await fetch('/api/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idea, niche }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Something went wrong. Try again.');
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="eyebrow">Idea Validator — Advanced</div>
      <h1>Check demand before you build.</h1>
      <p className="sub">
        Enter a tool idea. This pulls real search demand, competition, and
        demand language from live search and community data, then scores it.
      </p>

      <div className="card">
        <form onSubmit={handleSubmit}>
          <label htmlFor="idea">Tool idea or problem it solves</label>
          <textarea
            id="idea"
            placeholder="e.g. a tool that scores how sellable a course idea is before you build it"
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            required
          />

          <div style={{ height: 16 }} />

          <label htmlFor="niche">Niche or audience (optional, sharpens results)</label>
          <input
            id="niche"
            type="text"
            placeholder="e.g. online course creators"
            value={niche}
            onChange={(e) => setNiche(e.target.value)}
          />

          <button className="btn" type="submit" disabled={loading}>
            {loading ? 'Reading the signals…' : 'Validate this idea'}
          </button>
        </form>

        {error && <div className="error-box">{error}</div>}

        {result && (
          <div className="readout">
            <ScoreBlock result={result} />
            <div className="footer-note">
              Signal sources: search trend data, live competition search, and
              real community demand language. Scores are directional, not
              guarantees, use them to prioritize which idea to build first.
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function DiscoverMode() {
  const [niche, setNiche] = useState('');
  const [count, setCount] = useState(6);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [showFailed, setShowFailed] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!niche.trim()) return;
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const res = await fetch('/api/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ niche, count }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Something went wrong. Try again.');
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="eyebrow">Idea Validator — Discover Mode</div>
      <h1>Find ideas that already pass.</h1>
      <p className="sub">
        Give this a niche. It generates a batch of candidate tool ideas,
        validates every single one through the same real-data pipeline, and
        only shows you the ones that clear the bar.
      </p>

      <div className="card">
        <form onSubmit={handleSubmit}>
          <label htmlFor="disc-niche">Niche or audience</label>
          <input
            id="disc-niche"
            type="text"
            placeholder="e.g. wedding photographers"
            value={niche}
            onChange={(e) => setNiche(e.target.value)}
            required
          />

          <div style={{ height: 16 }} />

          <label htmlFor="disc-count">How many ideas to generate and check</label>
          <select
            id="disc-count"
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
          >
            <option value={4}>4 (fastest)</option>
            <option value={6}>6 (recommended)</option>
            <option value={8}>8</option>
            <option value={10}>10 (slowest, may time out on free hosting tiers)</option>
          </select>

          <button className="btn" type="submit" disabled={loading}>
            {loading ? 'Generating and checking each idea…' : 'Find validated ideas'}
          </button>
        </form>

        {error && <div className="error-box">{error}</div>}

        {result && (
          <div className="readout">
            <div className="discover-summary">
              {result.passedCount} of {result.generated} ideas cleared the bar
              for &ldquo;{result.niche}&rdquo;
            </div>

            {result.passed.length === 0 && (
              <div className="footer-note">
                None of the generated ideas scored high enough this round. Try
                a more specific niche, or run it again, results vary since the
                candidates are freshly generated each time.
              </div>
            )}

            {result.passed.map((r, i) => (
              <div key={i} className="discover-card">
                <div className="discover-idea">{r.idea}</div>
                <ScoreBlock result={r} compact />
              </div>
            ))}

            {result.failed && result.failed.length > 0 && (
              <div className="failed-toggle-wrap">
                <button
                  className="failed-toggle"
                  onClick={() => setShowFailed(!showFailed)}
                  type="button"
                >
                  {showFailed ? 'Hide' : 'Show'} {result.failed.length} idea
                  {result.failed.length === 1 ? '' : 's'} that didn&apos;t make the cut
                </button>
                {showFailed && (
                  <div className="failed-list">
                    {result.failed.map((r, i) => (
                      <div key={i} className="failed-item">
                        <span className="failed-score">{r.overallScore || 0}</span>
                        <span>{r.idea}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="footer-note">
              Every idea above went through the exact same validation pipeline
              as Validate mode, search trend, live competition search, and
              real community demand language. Nothing here is guessed.
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function ScoreBlock({ result, compact }) {
  return (
    <>
      <div className={compact ? 'score-row compact' : 'score-row'}>
        <div className={compact ? 'score-num compact' : 'score-num'}>{result.overallScore}</div>
        <div className="score-label">/ 100 sellability score</div>
      </div>
      <div className="verdict">{result.verdict}</div>
      <div className="gauges">
        <Gauge name="Demand signal" score={result.demand.score} note={result.demand.note} />
        <Gauge
          name="Competition headroom"
          score={result.competition.score}
          note={result.competition.note}
        />
        <Gauge name="Pricing headroom" score={result.pricing.score} note={result.pricing.note} />
      </div>
    </>
  );
}

function Gauge({ name, score, note }) {
  return (
    <div className="gauge">
      <div className="gauge-top">
        <div className="gauge-name">{name}</div>
        <div className="gauge-score">{score}</div>
      </div>
      <div className="gauge-bar-track">
        <div className="gauge-bar-fill" style={{ width: `${score}%` }} />
      </div>
      <div className="gauge-note">{note}</div>
    </div>
  );
}
