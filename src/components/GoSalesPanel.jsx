import { useEffect, useState } from 'react';

/**
 * GoSalesPanel
 * ------------
 * Massachusetts general obligation bond sales vs AAA-rated states, from the
 * Official Statements (public/data/ma-go-sales.json, built by
 * scripts/build-ma-go-sales.mjs from ma-go-sales-source.csv).
 *
 * Replaces the old "Recent Notable MA Bond Trades" panel, whose eight rows were
 * seed data that the EMMA fetch never replaced. Every number here traces to a
 * document link in the table.
 */

const CRAN = '#680A1D', BLUE = '#14558F', MUTED = 'var(--text-muted)';

const fmtDate = iso => new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
const bps = v => (v > 0 ? `+${v}` : `${v}`);

export default function GoSalesPanel() {
  const [d, setD] = useState(null);
  const [err, setErr] = useState(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/ma-go-sales.json`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(setD, e => setErr(e.message || String(e)));
  }, []);

  const card = { marginTop: 24, borderLeft: `4px solid ${CRAN}` };
  if (err) {
    return (
      <div className="chart-card" style={card}>
        <h3 style={{ margin: 0 }}>Massachusetts bond sales vs AAA states</h3>
        <p style={{ color: MUTED }}>Could not load ma-go-sales.json ({err}).</p>
      </div>
    );
  }
  if (!d) return null;

  const ten = d.summary.find(s => s.tenor === '10y');
  const twenty = d.summary.find(s => s.tenor === '20y');
  const r = d.ratingsLatest;
  const rows = d.sales.filter(s => s.tenors['10y'] && (showAll || s.date >= d.summarySince));
  const th = { padding: '10px 8px', color: CRAN, textAlign: 'left' };
  const td = { padding: '10px 8px', verticalAlign: 'top' };

  return (
    <div className="chart-card" style={card}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0 }}>Do investors charge Massachusetts more to borrow?</h3>
        <a href="https://www.massbondholder.com/" target="_blank" rel="noopener"
           style={{ padding: '6px 14px', fontSize: '0.78rem', fontWeight: 600, background: BLUE, color: '#fff', borderRadius: 4, textDecoration: 'none' }}>
          MassBondHolder.com ↗
        </a>
      </div>
      <div className="chart-subtitle" style={{ marginTop: 6 }}>
        Each Massachusetts general obligation bond sale, against a AAA-rated state's sale of the same maturity within 7 days.
        Yields are the reoffering yields printed in each Official Statement.
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 14 }}>
        {[
          [`${bps(ten.medianBps)} bp`, `Median 10-year gap since ${new Date(d.summarySince).getUTCFullYear()} (${ten.matches} like-for-like matches; ${ten.within10Bps} within 10 bp)`],
          [`${bps(twenty.medianBps)} bp`, `Median 20-year gap, same period (${twenty.matches} matches)`],
          [`${r.moodys} / ${r.sp} / ${r.fitch}`, `Ratings (Moody's / S&P / Fitch) on the ${fmtDate(r.date)} Official Statement: one notch below AAA`],
        ].map(([v, t]) => (
          <div key={t} style={{ flex: '1 1 200px', background: '#f4f5f8', borderRadius: 6, padding: '12px 14px' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#222', fontVariantNumeric: 'tabular-nums' }}>{v}</div>
            <div style={{ fontSize: '0.82rem', color: MUTED, marginTop: 4 }}>{t}</div>
          </div>
        ))}
      </div>
      <p style={{ margin: '12px 0 0', fontSize: '0.9rem' }}>
        A basis point (bp) is 0.01 percentage point. Massachusetts carries one of the highest state debt loads per person,
        but it borrows at about the same rate as AAA states: the market is not charging a meaningful premium.
      </p>

      <div style={{ overflowX: 'auto', marginTop: 12 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
          <thead>
            <tr style={{ borderBottom: `2px solid ${CRAN}` }}>
              <th style={th}>Sale</th>
              <th style={th}>Series</th>
              <th style={{ ...th, textAlign: 'right' }}>MA 10-yr yield</th>
              <th style={th}>AAA state, same week</th>
              <th style={{ ...th, textAlign: 'right' }}>Gap</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(s => {
              const t = s.tenors['10y'];
              return (
                <tr key={s.date} style={{ borderBottom: '1px solid #e4e6ed' }}>
                  <td style={{ ...td, whiteSpace: 'nowrap' }}>{fmtDate(s.date)}</td>
                  <td style={td}>
                    <a href={t.source} target="_blank" rel="noopener" style={{ color: BLUE }}>{s.series}</a>
                    <div style={{ fontSize: '0.78rem', color: MUTED }}>{t.maturity} maturity, {t.coupon}% coupon</div>
                  </td>
                  <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{t.yield.toFixed(2)}%</td>
                  <td style={td}>
                    {t.comparators.length === 0 && <span style={{ color: MUTED }}>No AAA sale within 7 days</span>}
                    {t.comparators.map(c => (
                      <div key={c.state + c.saleDate}>
                        <a href={c.source} target="_blank" rel="noopener" style={{ color: BLUE }}>{c.state}</a>{' '}
                        {c.yield.toFixed(2)}%{c.match === 'rough' && <span title={c.matchNote} style={{ color: MUTED }}> (rough match)</span>}
                      </div>
                    ))}
                  </td>
                  <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    {t.comparators.map(c => (
                      <div key={c.state + c.saleDate} style={{ color: c.match === 'rough' ? MUTED : '#222' }}>{bps(c.spreadBps)} bp</div>
                    ))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <button onClick={() => setShowAll(v => !v)}
              style={{ marginTop: 10, padding: '6px 12px', fontSize: '0.8rem', fontWeight: 600, border: `1px solid ${CRAN}`, background: '#fff', color: CRAN, borderRadius: 4, cursor: 'pointer' }}>
        {showAll ? `Show ${new Date(d.summarySince).getUTCFullYear()} onward` : 'Show sampled sales back to 2015'}
      </button>
      <p style={{ fontSize: '0.8rem', color: MUTED, margin: '10px 0 0' }}>
        {d.method} Every yield links to its Official Statement. Full data:{' '}
        <a href={`${import.meta.env.BASE_URL}data/${d.sourceCsv}`} style={{ color: BLUE }}>{d.sourceCsv}</a>{' '}
        (retrieved {fmtDate(d.fetchedAt.slice(0, 10))}).
      </p>
    </div>
  );
}
