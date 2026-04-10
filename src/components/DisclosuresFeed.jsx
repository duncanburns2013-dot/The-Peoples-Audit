import { useEffect, useState, useCallback } from 'react';

/**
 * DisclosuresFeed
 * ----------------
 * Renders the latest Massachusetts bond / debt disclosures from a JSON file
 * refreshed every 6 hours by the fetch-disclosures GitHub Actions workflow.
 *
 * Design rules (The People's Audit):
 *   - Never show the word "CACHED". Always show a human-readable age.
 *   - Always show WHEN the next refresh is expected, so a resident knows
 *     this is a living feed and not a dead snapshot.
 *   - Provide a visible "Refresh now" button that bypasses HTTP cache.
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

const REFRESH_HOURS = 6; // cron runs every 6h

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

function fmtAge(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const diffMs = Date.now() - d.getTime();
  if (diffMs < 0) return 'just now';
  const min = Math.floor(diffMs / 60_000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  if (days === 1) return '1 day ago';
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  if (months === 1) return '1 month ago';
  return `${months} months ago`;
}

function fmtNextRefresh(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const nextMs = d.getTime() + REFRESH_HOURS * 3600 * 1000;
  const remaining = nextMs - Date.now();
  if (remaining <= 0) return 'due any moment';
  const hrs = Math.ceil(remaining / 3600_000);
  return `in ~${hrs}h`;
}

export default function DisclosuresFeed() {
  const [state, setState] = useState({ loading: true, data: null, error: null });
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const url = `${import.meta.env.BASE_URL}data/ma-disclosures.json?t=${Date.now()}`;
      const r = await fetch(url, { cache: 'no-store' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      setState({ loading: false, data, error: null });
    } catch (err) {
      setState({ loading: false, data: null, error: err.message || String(err) });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefreshClick = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const { loading, data, error } = state;
  const items = data?.items || [];
  const fetchedAt = data?.fetchedAt;
  const fetchedAtMs = fetchedAt ? Date.parse(fetchedAt) : 0;
  const ageHours = fetchedAtMs ? (Date.now() - fetchedAtMs) / 3600_000 : Infinity;
  // "Live" dot stays red for up to 24h — the refresh cadence is 6h so
  // anything older than that means the cron failed and we should notice.
  const isLive = ageHours < 24;

  return (
    <div
      className="chart-card"
      style={{ marginTop: 24, borderLeft: '4px solid #680A1D' }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <h3 style={{ margin: 0 }}>
          <span
            style={{
              display: 'inline-block',
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: isLive ? '#ef4444' : '#9ca3af',
              marginRight: 8,
              animation: isLive ? 'pulse 1.6s infinite' : 'none',
            }}
          />
          Massachusetts Bond Disclosures Feed
        </h3>
        <button
          onClick={onRefreshClick}
          disabled={refreshing || loading}
          style={{
            padding: '6px 12px',
            fontSize: '0.78rem',
            fontWeight: 600,
            border: '1px solid #680A1D',
            background: refreshing ? '#f4f5f8' : '#fff',
            color: '#680A1D',
            borderRadius: 4,
            cursor: refreshing || loading ? 'default' : 'pointer',
          }}
          title="Re-fetch the latest committed ma-disclosures.json"
        >
          {refreshing ? 'Refreshing…' : '↻ Refresh now'}
        </button>
      </div>

      <div className="chart-subtitle" style={{ marginTop: 6 }}>
        Recent Massachusetts continuing disclosures, official statements, and
        bond-issuance announcements. Refreshed every {REFRESH_HOURS} hours by a
        GitHub Action that pulls from public sources (MSRB EMMA, mass.gov Debt
        Management, MA State Treasurer) and commits the results back to this
        repository, so every item on this page is reproducible and auditable.
      </div>

      {fetchedAt && (
        <div
          style={{
            marginTop: 10,
            padding: '8px 12px',
            background: '#f4f5f8',
            borderRadius: 4,
            fontSize: '0.82rem',
            color: 'var(--text-muted)',
            display: 'flex',
            gap: 16,
            flexWrap: 'wrap',
          }}
        >
          <span>
            <strong style={{ color: '#222' }}>Last updated:</strong>{' '}
            {fmtDate(fetchedAt)} · {fmtAge(fetchedAt)}
          </span>
          <span>
            <strong style={{ color: '#222' }}>Next automatic refresh:</strong>{' '}
            {fmtNextRefresh(fetchedAt)}
          </span>
          <span>
            <strong style={{ color: '#222' }}>Items:</strong> {items.length}
          </span>
        </div>
      )}

      {loading && (
        <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading latest disclosures…
        </div>
      )}

      {error && !loading && (
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
                    {fmtAge(it.date) && ` · ${fmtAge(it.date)}`}
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
        ⓘ MSRB EMMA does not allow third-party iframe embedding for security
        reasons. This feed is refreshed server-side every {REFRESH_HOURS} hours
        via a scheduled GitHub Action and committed back to the repo, so every
        number on this page is reproducible and auditable. For any item's full
        record, view it on{' '}
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
