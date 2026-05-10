import { useEffect, useState } from 'react';
import { Fingerprint, FileText, Hourglass, ExternalLink, Search } from 'lucide-react';

export default function SfiExplorer() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/ma-sfi.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="section">
        <div className="loading-skeleton" style={{ height: 240 }} />
      </div>
    );
  }

  const status = data?.status || 'unknown';
  const filings = Array.isArray(data?.filings) ? data.filings : [];

  const filtered = search.trim()
    ? filings.filter((f) => {
        const haystack = [
          f.legislatorName,
          f.chamber,
          f.district,
          ...(f.employers || []).map((e) => e.name),
          ...(f.securities || []).map((s) => s.company),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(search.trim().toLowerCase());
      })
    : filings;

  return (
    <div className="section">
      <div className="section-header">
        <span className="section-tag red">Statements of Financial Interest</span>
        <h2>Legislator Personal Finances</h2>
        <p style={{ maxWidth: 820 }}>
          Every elected official in Massachusetts files an annual SFI with the State Ethics Commission
          disclosing outside employers, securities, real estate, and gifts. Cross-referenced with committee
          assignments and lobbying clients, these filings are the most direct conflict-of-interest signal a
          public dataset can provide. They are legally public records.
        </p>
      </div>

      {status === 'awaiting-access' && (
        <div
          className="chart-card highlighted"
          style={{
            background: 'linear-gradient(145deg, rgba(255, 199, 44, 0.08), transparent)',
            borderLeft: '4px solid var(--accent-gold)',
            marginBottom: 24,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <Hourglass size={20} style={{ color: 'var(--accent-gold)' }} />
            <h3 style={{ margin: 0, color: 'var(--accent-gold)' }}>
              Awaiting bulk-access approval from the State Ethics Commission
            </h3>
          </div>
          <p style={{ marginBottom: 12 }}>
            {data?.accessNote ||
              'Bulk programmatic access to SFI filings is request-gated. Once approved, ' +
                'this tab will populate automatically on the next scheduled fetch.'}
          </p>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            <strong>What will appear here:</strong> for each legislator, structured fields for outside
            employers, securities holdings (by company name &mdash; account numbers redacted), real estate
            (by town and type), gifts received, and spouse&rsquo;s sources of income. Personal-safety
            redactions (home addresses, dependents&rsquo; names) are preserved as <code>redacted: true</code>{' '}
            flags rather than dropped, so the join keys for cross-reference analysis remain intact.
          </p>
          <a
            href="https://www.mass.gov/lists/statements-of-financial-interests-sfis"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              marginTop: 16,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: '0.85rem',
              color: 'var(--accent-cyan)',
            }}
          >
            View SFIs at mass.gov <ExternalLink size={12} />
          </a>
        </div>
      )}

      {filings.length > 0 && (
        <>
          <div style={{ marginBottom: 16, position: 'relative', maxWidth: 480 }}>
            <Search
              size={16}
              style={{
                position: 'absolute',
                left: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
              }}
            />
            <input
              type="text"
              className="search-input"
              placeholder="Search by legislator, employer, company..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: 36 }}
            />
          </div>

          <div className="data-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Legislator</th>
                  <th>Chamber</th>
                  <th>District</th>
                  <th>Outside employers</th>
                  <th>Securities</th>
                  <th>Real estate</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((f, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 600 }}>{f.legislatorName}</td>
                    <td>{f.chamber}</td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{f.district}</td>
                    <td>{f.employers?.length || 0}</td>
                    <td>{f.securities?.length || 0}</td>
                    <td>{f.realEstate?.length || 0}</td>
                    <td>
                      {f.sourcePdfUrl && (
                        <a
                          href={f.sourcePdfUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: 'var(--accent-cyan)', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                        >
                          PDF <FileText size={11} />
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <div
        style={{
          marginTop: 24,
          padding: 16,
          background: 'var(--bg-card-hover)',
          borderRadius: 8,
          fontSize: '0.78rem',
          color: 'var(--text-muted)',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 10,
        }}
      >
        <Fingerprint size={14} style={{ flexShrink: 0, marginTop: 2 }} />
        <div>
          SFI data is filed by the legislator and published, redacted, by the State Ethics Commission. This
          dashboard does not modify the source &mdash; redactions and missing entries reflect what the
          Commission released.
        </div>
      </div>
    </div>
  );
}
