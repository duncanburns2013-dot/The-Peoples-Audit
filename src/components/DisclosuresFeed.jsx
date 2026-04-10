import { useEffect, useState } from 'react';

/**
 * DisclosuresFeed
 * ----------------
 * Renders the latest Massachusetts bond / debt disclosures from the JSON file
 * that the GitHub Actions workflow refreshes every 6 hours.
 *
 * The data file lives at /public/data/ma-disclosures.json and is fetched at
 * runtime using Vite's BASE_URL so it works on GitHub Pages under
 * /The-Peoples-Audit/.
 */

const TYPE_COLORS = {
  'Continuing Disclosure': '#680A1D',
  'Official Statement':    '#14558F',
  'Upcoming Issuance':     '#32784E',
  'Investor Communication': '#9a6b00',
  'News / Disclosure':     '#14558F',
  'Issuer Page':           '#555',
  'Security Detail':       '#555',
};

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

function fmtRelative(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const diffMs = Date.now() - d.getTime();
  const hr = Math.floor(diffMs / 3_600_000);
  if (hr < 1) return 'just now';
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  if (days < 30) return `${days}d ago`;
  return '';
}

export default function DisclosuresFeed() {
  const [state, setState] = useState({ loading: true, data: null, error: null });

  useEffect(() => {
    let cancelled = false;
    const url = `${import.meta.env.BASE_URL}data/ma-disclosures.json`;
    fetch(url, { cache: 'no-cache' })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        if (!cancelled) setState({ loading: false, data, error: null });
      })
      .catch((err) => {
        if (!cancelled)
          setState({ loading: false, data: null, error: err.message || String(err) });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const { loading, data, error } = state;
  const items = data?.items || [];
  const fetchedAtMs = data?.fetchedAt ? Date.parse(data.fetchedAt) : 0;
  const isFresh = fetchedAtMs && Date.now() - fetchedAtMs < 12 * 3600 * 1000;

  return (
    <div className="chart-card" style={{ marginTop: 24, borderLeft: '4px solid #680A1D' }}>
      <h3>
        <span
          style={{
            display: 'inline-block',
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: isFresh ? '#ef4444' : '#9ca3af',
            marginRight: 8,
            animation: isFresh ? 'pulse 1.6s infinite' : 'none',
          }}
        />
        {isFresh ? 'LIVE' : 'CACHED'}: Massachusetts Bond Disclosures Feed
      </h3>
      <div className="chart-subtitle">
        Recent Massachusetts continuing disclosures, official statements, and bond
        issuance announcements. Refreshed automatically from public sources
        (MSRB EMMA, mass.gov Debt Management, and the State Treasurer) every six hours.
        {data?.fetchedAt && (
          <>
            {' '}
            Last updated <strong>{fmtDate(data.fetchedAt)}</strong>{' '}
            ({fmtRelative(data.fetchedAt)}).
          </>
        )}
      </div>

      {loading && (
        <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading latest disclosures…
        </div>
      )}

      {error && (
        <div
          style={{
            padding: 16,
            background: '#fff4f4',
            border: '1px solid #f5c0c0',
            borderRadius: 6,
            color: '#680A1D',
            marginTop: 12,
          }}
        >
          Could not load disclosures feed ({error}). View the source data{' '}
          <a
            href="https://emma.msrb.org/QuickSearch/Results?quickSearchText=MASSACHUSETTS"
            target="_blank"
            rel="noopener"
            style={{ color: '#680A1D', fontWeight: 600 }}
          >
            on EMMA ↗
          </a>
          .
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)' }}>
          No disclosures available right now.
        </div>
      )}

      {!loading && !error && items.length > 0 && (
        <ul
          style={{
            listStyle: 'none',
            padding: 0,
            margin: '14px 0 0 0',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          {items.map((it) => {
            const color = TYPE_COLORS[it.type] || '#555';
            return (
              <li
                key={it.id || it.url || it.title}
                style={{
                  borderLeft: `4px solid ${color}`,
                  background: '#f7f8fa',
                  borderRadius: 4,
                  padding: '12px 14px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    flexWrap: 'wrap',
                    marginBottom: 4,
                  }}
                >
                  <span
                    style={{
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      letterSpacing: 0.4,
                      textTransform: 'uppercase',
                      color: '#fff',
                      background: color,
                      padding: '2px 8px',
                      borderRadius: 3,
                    }}
                  >
                    {it.type}
                  </span>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    {fmtDate(it.date)}
                    {fmtRelative(it.date) && ` · ${fmtRelative(it.date)}`}
                  </span>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    · {it.issuer}
                  </span>
                </div>
                <a
                  href={it.url}
                  target="_blank"
                  rel="noopener"
                  style={{
                    color: '#14558F',
                    textDecoration: 'none',
                    fontWeight: 600,
                    fontSize: '0.96rem',
                    lineHeight: 1.35,
                  }}
                >
                  {it.title} ↗
                </a>
                {it.summary && (
                  <div
                    style={{
                      fontSize: '0.85rem',
                      color: 'var(--text-muted)',
                      marginTop: 4,
                    }}
                  >
                    {it.summary}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div style={{ marginTop: 12, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
        ⓘ MSRB EMMA does not allow third-party iframe embedding for security reasons.
        This feed is refreshed server-side every 6 hours via GitHub Actions and
        committed to the repo, so the data on the page is always reproducible and
        auditable. View any item's full record on{' '}
        <a
          href="https://emma.msrb.org/QuickSearch/Results?quickSearchText=MASSACHUSETTS"
          target="_blank"
          rel="noopener"
          style={{ color: '#680A1D', fontWeight: 600 }}
        >
          EMMA ↗
        </a>
        .
      </div>
    </div>
  );
}
