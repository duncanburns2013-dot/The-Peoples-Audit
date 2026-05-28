import { Fragment, useEffect, useMemo, useState } from 'react';
import {
  Fingerprint, FileText, Hourglass, ExternalLink, Search,
  Flame, Gift, Eye, AlertCircle, ChevronDown,
} from 'lucide-react';

/**
 * SfiExplorer — Massachusetts Statement of Financial Interest browser
 *
 * Reads two JSON files:
 *   data/ma-sfi.json         — every filing, with extracted entity names and flags
 *   data/ma-sfi-tempus.json  — the verified Tempus-disclosure pattern
 *
 * Surfaces the headline Tempus finding first, then a filterable searchable
 * table of every filing with the disclosed entity names visible inline.
 */
export default function SfiExplorer() {
  const [data, setData] = useState(null);
  const [tempus, setTempus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('all'); // all | tempus | gifts | interested
  const [activeChamber, setActiveChamber] = useState('all');
  const [activeYear, setActiveYear] = useState('all');
  const [expandedRow, setExpandedRow] = useState(null);
  const [pageSize, setPageSize] = useState(60);

  useEffect(() => {
    const base = import.meta.env.BASE_URL;
    Promise.all([
      fetch(`${base}data/ma-sfi.json`).then((r) => (r.ok ? r.json() : null)),
      fetch(`${base}data/ma-sfi-tempus.json`).then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([d, t]) => {
        setData(d);
        setTempus(t);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const filings = data?.filings || [];

  const filtered = useMemo(() => {
    let rows = filings;
    if (activeFilter === 'tempus') rows = rows.filter((f) => f.hasTempus);
    if (activeFilter === 'gifts') rows = rows.filter((f) => f.hasLobbyistGifts);
    if (activeFilter === 'interested') rows = rows.filter((f) => f.hasInterestedPartyGifts);
    if (activeFilter === 'blindtrust') rows = rows.filter((f) => f.hasBlindTrust);
    if (activeChamber !== 'all') rows = rows.filter((f) => f.chamber === activeChamber);
    if (activeYear !== 'all') rows = rows.filter((f) => f.filingYear === activeYear);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter((f) =>
        [
          f.legislatorName, f.chamber, f.workEmail,
          f.ownTopEmployer, f.spouseTopEmployer,
          f.ownRealEstate, f.spouseRealEstate,
          f.topMortgageCreditor,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(q)
      );
    }
    return rows;
  }, [filings, activeFilter, activeChamber, activeYear, search]);

  if (loading) {
    return (
      <div className="section">
        <div className="loading-skeleton" style={{ height: 240 }} />
      </div>
    );
  }

  const status = data?.status || 'unknown';
  const chambers = data?.categories || [];
  const years = data?.filingsYears || [];

  return (
    <div className="section">
      <SfiCss />

      {/* Header */}
      <div className="section-header">
        <span className="section-tag red">Statements of Financial Interest</span>
        <h2>Legislator &amp; Public-Official Personal Finances</h2>
        <p style={{ maxWidth: 820 }}>
          Every Massachusetts public official subject to G.L. c. 268B (legislators, judges, agency
          heads, board members, designated public employees) files an annual SFI with the State
          Ethics Commission disclosing outside employers, securities, real estate, debts, and gifts.
          This dashboard renders the 2026 bulk redacted release in full — {data?.count?.toLocaleString() || '—'}{' '}
          filings, {data?.filingsYears?.length || 0} years.
        </p>
      </div>

      {/* Stats strip */}
      {status === 'live' && (
        <div className="sfi-stats">
          <SfiStat value={data.count.toLocaleString()} label="filings" />
          <SfiStat value={data.filingsYears.length} label="years 2019–2025" />
          <SfiStat value={data.tempusFilingsCount} label="Tempus disclosures" accent="red" />
          <SfiStat value={data.lobbyistGiftFilingsCount.toLocaleString()} label="lobbyist / gift filings" accent="gold" />
        </div>
      )}

      {/* The headline pattern card */}
      {tempus && (
        <TempusSpotlight tempus={tempus} />
      )}

      {/* Awaiting-access banner only when the data is not live */}
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
          <p>{data?.accessNote}</p>
        </div>
      )}

      {/* Filters + search */}
      {status === 'live' && (
        <>
          <div className="sfi-filter-bar">
            <div className="sfi-chip-row">
              <SfiChip
                active={activeFilter === 'all'}
                onClick={() => setActiveFilter('all')}
                label={`All  ${data.count.toLocaleString()}`}
              />
              <SfiChip
                active={activeFilter === 'tempus'}
                onClick={() => setActiveFilter('tempus')}
                label={`Tempus / PCA program  ${data.tempusFilingsCount}`}
                color="red"
                icon={<Flame size={12} />}
              />
              <SfiChip
                active={activeFilter === 'gifts'}
                onClick={() => setActiveFilter('gifts')}
                label={`Lobbyist gifts  ${data.lobbyistGiftFilingsCount.toLocaleString()}`}
                color="gold"
                icon={<Gift size={12} />}
              />
              <SfiChip
                active={activeFilter === 'interested'}
                onClick={() => setActiveFilter('interested')}
                label={`Interested-party gifts (Q36.a / Q37.a)`}
                color="red"
                icon={<AlertCircle size={12} />}
              />
              <SfiChip
                active={activeFilter === 'blindtrust'}
                onClick={() => setActiveFilter('blindtrust')}
                label={`Blind trust`}
                color="blue"
                icon={<Eye size={12} />}
              />
            </div>

            <div className="sfi-select-row">
              <label className="sfi-select">
                <span>Branch</span>
                <select value={activeChamber} onChange={(e) => setActiveChamber(e.target.value)}>
                  <option value="all">All branches</option>
                  {chambers.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label className="sfi-select">
                <span>Year</span>
                <select value={activeYear} onChange={(e) => setActiveYear(e.target.value)}>
                  <option value="all">All years</option>
                  {years.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="sfi-search">
              <Search size={16} />
              <input
                type="text"
                placeholder="Search by filer, employer, town, creditor…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <p className="sfi-result-count">
            {filtered.length.toLocaleString()} matching filings
            {filtered.length > pageSize && ` · showing first ${pageSize.toLocaleString()}`}
          </p>

          {/* Data table — desktop: condensed 6-col, mobile: stacked cards */}
          <div className="sfi-table-wrap">
            <table className="sfi-table">
              <thead>
                <tr>
                  <th className="sfi-col-filer">Filer</th>
                  <th className="sfi-col-flags">Flags</th>
                  <th className="sfi-col-employer">Top employers</th>
                  <th className="sfi-col-realestate">Real estate</th>
                  <th className="sfi-col-creditor">Top creditor</th>
                  <th className="sfi-col-pdf"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, pageSize).map((f, i) => {
                  const key = `${f.filingYear}-${f.legislatorName}-${i}`;
                  const expanded = expandedRow === key;
                  return (
                    <Fragment key={key}>
                      <tr className={expanded ? 'sfi-row sfi-row-expanded' : 'sfi-row'}>
                        <td className="sfi-col-filer">
                          <div className="sfi-filer-cell">
                            <button
                              className="sfi-expand-btn"
                              onClick={() => setExpandedRow(expanded ? null : key)}
                              aria-label="Toggle details"
                            >
                              <ChevronDown
                                size={16}
                                style={{
                                  transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                                  transition: 'transform 0.18s',
                                }}
                              />
                            </button>
                            <div className="sfi-filer-stack">
                              <span className="sfi-name">{f.legislatorName}</span>
                              <span className="sfi-filer-meta">
                                <span className={`sfi-branch sfi-branch-${slug(f.chamber)}`}>
                                  {f.chamber}
                                </span>
                                <span className="sfi-year">{f.filingYear}</span>
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="sfi-col-flags">
                          <div className="sfi-flags">
                            {f.hasTempus && (
                              <span className="sfi-flag sfi-flag-red" title="Tempus / PCA-program disclosure">
                                <Flame size={11} /> PCA
                              </span>
                            )}
                            {f.hasInterestedPartyGifts && (
                              <span className="sfi-flag sfi-flag-red" title="Q36.a / Q37.a — interested-party reimbursement">
                                <AlertCircle size={11} /> Q36.a
                              </span>
                            )}
                            {f.hasLobbyistGifts && !f.hasInterestedPartyGifts && (
                              <span className="sfi-flag sfi-flag-gold" title="Lobbyist gift / honorarium / reimbursement">
                                <Gift size={11} /> Gift
                              </span>
                            )}
                            {f.hasBlindTrust && (
                              <span className="sfi-flag sfi-flag-blue" title="Filer used a Blind Trust (Q40)">
                                <Eye size={11} /> Blind
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="sfi-col-employer">
                          <div className="sfi-employer-stack">
                            {f.spouseTopEmployer && (
                              <div className="sfi-emp-row" title={f.spouseTopEmployer}>
                                <span className="sfi-emp-label">Spouse</span>
                                <span className="sfi-emp-value">{f.spouseTopEmployer}</span>
                              </div>
                            )}
                            {f.ownTopEmployer && (
                              <div className="sfi-emp-row" title={f.ownTopEmployer}>
                                <span className="sfi-emp-label">Own</span>
                                <span className="sfi-emp-value">{f.ownTopEmployer}</span>
                              </div>
                            )}
                            {!f.spouseTopEmployer && !f.ownTopEmployer && (
                              <span className="sfi-empty">—</span>
                            )}
                          </div>
                        </td>
                        <td className="sfi-col-realestate">
                          {f.ownRealEstate && <span className="sfi-pill">{f.ownRealEstate}</span>}
                          {f.spouseRealEstate && f.spouseRealEstate !== f.ownRealEstate && (
                            <span className="sfi-pill sfi-pill-muted">{f.spouseRealEstate}</span>
                          )}
                          {!f.ownRealEstate && !f.spouseRealEstate && <span className="sfi-empty">—</span>}
                        </td>
                        <td className="sfi-col-creditor sfi-cell-truncate" title={f.topMortgageCreditor}>
                          {f.topMortgageCreditor || <span className="sfi-empty">—</span>}
                        </td>
                        <td className="sfi-col-pdf">
                          {f.sourcePdfUrl && (
                            <a
                              href={f.sourcePdfUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="sfi-pdf-link"
                              title="Open the original redacted SFI PDF"
                            >
                              <FileText size={14} />
                              <span className="sfi-pdf-label">PDF</span>
                            </a>
                          )}
                        </td>
                      </tr>
                      {expanded && (
                        <tr className="sfi-detail">
                          <td colSpan={6}>
                            <SfiDetail filing={f} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>

            {filtered.length > pageSize && (
              <button className="sfi-loadmore" onClick={() => setPageSize(pageSize + 60)}>
                Load 60 more
              </button>
            )}
          </div>
        </>
      )}

      {/* Provenance footnote */}
      <div className="sfi-provenance">
        <Fingerprint size={14} />
        <div>
          Source: redacted bulk release from the MA State Ethics Commission. Per G.L. c. 268B, the
          Commission notified every individual whose SFI was released as part of the public-records
          process. Home addresses, personal phone numbers, and personal email addresses are
          redacted at the source; all substantive financial-interest disclosures are preserved.
          Raw PDFs:{' '}
          <a
            href="https://github.com/duncanburns2013-dot/The-Peoples-Audit/releases"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub Releases
          </a>{' '}
          (sfi-2019 … sfi-2025).
        </div>
      </div>
    </div>
  );
}

/* ---------- subcomponents ---------- */

function SfiStat({ value, label, accent }) {
  return (
    <div className={`sfi-stat${accent ? ' sfi-stat-' + accent : ''}`}>
      <div className="sfi-stat-value">{value}</div>
      <div className="sfi-stat-label">{label}</div>
    </div>
  );
}

function SfiChip({ active, onClick, label, color, icon }) {
  const cls = ['sfi-chip', active && 'sfi-chip-active', color && `sfi-chip-${color}`]
    .filter(Boolean)
    .join(' ');
  return (
    <button className={cls} onClick={onClick}>
      {icon && <span className="sfi-chip-icon">{icon}</span>}
      {label}
    </button>
  );
}

function TempusSpotlight({ tempus }) {
  const rows = tempus.rows || [];
  const ctx = tempus.tempusContext || {};
  return (
    <div className="tempus-card">
      <div className="tempus-tag">Headline finding · LOCKED v1</div>
      <h3 className="tempus-headline">
        Eight MA public officials disclosed in their own SFIs that a spouse or household dependent
        is paid through the <strong>MassHealth Personal Care Attendant program</strong>, with{' '}
        <strong>Tempus Unlimited, Inc.</strong> as the sole statewide Fiscal Intermediary.
      </h3>
      <p className="tempus-sub">
        28 individual disclosures across 2019–2025, every one re-verified by direct PDF re-read.
        Tempus is the program administrator; the MassHealth member is the legal employer of record.
        The $6.62B figure in the HHS-MA-DOGE flagged-address index is cumulative 2018–2024 PCA-
        program pass-through — Tempus FY2024 net surplus was {usd(ctx.fy2024NetSurplus)}.
      </p>

      <div className="tempus-grid">
        {rows.map((r) => (
          <div key={`${r.filerLast}-${r.filerFirst}`} className="tempus-card-row">
            <div className="tempus-name">{r.fullName || `${r.filerLast}, ${r.filerFirst}`}</div>
            <div className="tempus-title">{r.title}</div>
            <div className="tempus-role">{r.role}</div>
            <div className="tempus-years">
              {(r.years || []).map((y) => (
                <a
                  key={y.year}
                  className="tempus-year"
                  href={`https://github.com/duncanburns2013-dot/The-Peoples-Audit/releases/download/sfi-${y.year}/${encodeURIComponent(
                    y.pdf.split('/').pop()
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={`Open ${y.year} SFI for ${r.filerLast}, ${r.filerFirst}`}
                >
                  {y.year}
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="tempus-links">
        <a
          href="https://github.com/duncanburns2013-dot/The-Peoples-Audit/blob/main/findings/FINDINGS-SFI-LOCKED.md"
          target="_blank"
          rel="noopener noreferrer"
          className="tempus-cta"
        >
          Read the locked finding doc <ExternalLink size={12} />
        </a>
        <a
          href="https://github.com/duncanburns2013-dot/The-Peoples-Audit/blob/main/findings/PRESS-BRIEF-SFI-TEMPUS.md"
          target="_blank"
          rel="noopener noreferrer"
          className="tempus-cta tempus-cta-secondary"
        >
          Press brief <ExternalLink size={12} />
        </a>
        <a
          href="https://github.com/duncanburns2013-dot/The-Peoples-Audit/blob/main/data/sfi/verify/tempus_verified.md"
          target="_blank"
          rel="noopener noreferrer"
          className="tempus-cta tempus-cta-secondary"
        >
          Verification log (28/28) <ExternalLink size={12} />
        </a>
        <a
          href="https://github.com/duncanburns2013-dot/HHS-MA-DOGE/blob/main/enforcement/SFI-CROSSREF.md"
          target="_blank"
          rel="noopener noreferrer"
          className="tempus-cta tempus-cta-secondary"
        >
          HHS-MA-DOGE cross-reference <ExternalLink size={12} />
        </a>
      </div>

      <div className="tempus-foot">
        These are the officials&rsquo; own lawful disclosures, filed under penalty of perjury with
        the MA State Ethics Commission. No wrongdoing by any named official is alleged. Per G.L.
        c. 268B, each was notified by the Commission&rsquo;s bulk-release process.
      </div>
    </div>
  );
}

function SfiDetail({ filing }) {
  const fields = [
    ['Work email', filing.workEmail],
    ['Submitted', filing.submitted],
    ['Own employer (Q5)', filing.ownTopEmployer],
    ['Spouse employer (Q7)', filing.spouseTopEmployer],
    ['Own real estate (Q13)', filing.ownRealEstate],
    ['Spouse real estate (Q14)', filing.spouseRealEstate],
    ['Top mortgage creditor (Q29/Q30)', filing.topMortgageCreditor],
  ];
  return (
    <div className="sfi-detail-grid">
      {fields.map(([label, val]) =>
        val ? (
          <div key={label} className="sfi-detail-cell">
            <div className="sfi-detail-label">{label}</div>
            <div className="sfi-detail-value">{val}</div>
          </div>
        ) : null
      )}
      <div className="sfi-detail-cell sfi-detail-counts">
        <div className="sfi-detail-label">Section coverage</div>
        <div className="sfi-detail-value">
          {filing.employers > 0 && <span className="sfi-pill">Employment ×{filing.employers}</span>}
          {filing.businessOwnership > 0 && (
            <span className="sfi-pill">Business ownership ×{filing.businessOwnership}</span>
          )}
          {filing.realEstate > 0 && <span className="sfi-pill">Real estate ×{filing.realEstate}</span>}
          {filing.investments > 0 && <span className="sfi-pill">Investments ×{filing.investments}</span>}
          {filing.debts > 0 && <span className="sfi-pill">Debt ×{filing.debts}</span>}
          {filing.gifts > 0 && <span className="sfi-pill">Gifts ×{filing.gifts}</span>}
          {filing.hasBlindTrust && <span className="sfi-pill">Blind trust</span>}
        </div>
      </div>
    </div>
  );
}

/* ---------- helpers ---------- */

function slug(s) {
  return (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function usd(n) {
  if (n == null) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

/* ---------- inline styles (kept local so the component is portable) ---------- */

function SfiCss() {
  return (
    <style>{`
      .sfi-stats {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 14px;
        margin: 12px 0 28px;
      }
      .sfi-stat {
        background: var(--bg-card);
        border: 1px solid var(--border);
        border-radius: 8px;
        padding: 16px 18px;
        box-shadow: var(--shadow-card);
      }
      .sfi-stat-value {
        font-family: 'JetBrains Mono', monospace;
        font-size: 2.1rem;
        font-weight: 700;
        color: var(--text-primary);
        line-height: 1.1;
        letter-spacing: -0.02em;
      }
      .sfi-stat-label {
        font-size: 0.82rem;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--text-muted);
        margin-top: 8px;
        font-weight: 600;
      }
      .sfi-stat-red .sfi-stat-value { color: var(--accent-red); }
      .sfi-stat-gold .sfi-stat-value { color: #B88A00; }

      /* Tempus headline card */
      .tempus-card {
        position: relative;
        padding: 28px 32px;
        margin: 8px 0 36px;
        border-radius: 12px;
        background:
          linear-gradient(155deg, rgba(104,10,29,0.06), rgba(104,10,29,0.02) 60%),
          var(--bg-card);
        border: 1px solid rgba(104,10,29,0.20);
        border-left: 5px solid var(--accent-red);
        box-shadow: var(--shadow-card);
        overflow: hidden;
      }
      .tempus-card::before {
        content: '';
        position: absolute;
        top: -40px; right: -40px;
        width: 200px; height: 200px;
        background: radial-gradient(circle, var(--accent-gold-glow), transparent 70%);
        pointer-events: none;
      }
      .tempus-tag {
        display: inline-block;
        font-family: 'JetBrains Mono', monospace;
        font-size: 0.68rem;
        font-weight: 700;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: var(--accent-red);
        background: rgba(104,10,29,0.08);
        padding: 4px 10px;
        border-radius: 4px;
        margin-bottom: 14px;
      }
      .tempus-headline {
        font-size: 1.65rem;
        line-height: 1.35;
        margin: 0 0 14px;
        color: var(--text-primary);
        font-weight: 700;
        letter-spacing: -0.015em;
      }
      .tempus-headline strong { color: var(--accent-red); font-weight: 800; }
      .tempus-sub {
        font-size: 1.02rem;
        line-height: 1.6;
        color: var(--text-secondary);
        margin: 0 0 24px;
        max-width: 880px;
      }
      .tempus-name { font-size: 1rem; }
      .tempus-title { font-size: 0.86rem; }
      .tempus-role { font-size: 0.8rem; }
      .tempus-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
        gap: 12px;
        margin-bottom: 20px;
      }
      .tempus-card-row {
        background: rgba(255,255,255,0.6);
        border: 1px solid var(--border);
        border-radius: 8px;
        padding: 12px 14px;
      }
      .tempus-name {
        font-weight: 700;
        color: var(--text-primary);
        font-size: 0.92rem;
      }
      .tempus-title {
        font-size: 0.78rem;
        color: var(--text-secondary);
        margin-top: 2px;
        line-height: 1.3;
      }
      .tempus-role {
        font-size: 0.74rem;
        color: var(--text-muted);
        font-style: italic;
        margin-top: 2px;
        line-height: 1.3;
      }
      .tempus-years {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        margin-top: 8px;
      }
      .tempus-year {
        font-family: 'JetBrains Mono', monospace;
        font-size: 0.7rem;
        font-weight: 600;
        padding: 3px 8px;
        background: var(--accent-red);
        color: #fff;
        border-radius: 4px;
        text-decoration: none;
        transition: opacity 0.15s, transform 0.15s;
      }
      .tempus-year:hover { opacity: 0.85; transform: translateY(-1px); }
      .tempus-links {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
        margin-top: 6px;
      }
      .tempus-cta {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 8px 14px;
        font-size: 0.82rem;
        font-weight: 600;
        background: var(--accent-red);
        color: #fff;
        border-radius: 6px;
        text-decoration: none;
        transition: background 0.15s;
      }
      .tempus-cta:hover { background: #4d0716; }
      .tempus-cta-secondary {
        background: transparent;
        color: var(--accent-red);
        border: 1px solid rgba(104,10,29,0.25);
      }
      .tempus-cta-secondary:hover { background: rgba(104,10,29,0.06); }
      .tempus-foot {
        margin-top: 16px;
        padding-top: 14px;
        border-top: 1px dashed rgba(104,10,29,0.15);
        font-size: 0.78rem;
        color: var(--text-muted);
        line-height: 1.5;
      }

      /* Filter bar */
      .sfi-filter-bar {
        display: flex;
        flex-direction: column;
        gap: 12px;
        margin-bottom: 16px;
      }
      .sfi-chip-row {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      .sfi-chip {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 6px 12px;
        font-size: 0.8rem;
        font-weight: 600;
        background: var(--bg-card);
        color: var(--text-secondary);
        border: 1px solid var(--border);
        border-radius: 999px;
        cursor: pointer;
        transition: all 0.12s;
        font-family: inherit;
      }
      .sfi-chip:hover { background: var(--bg-card-hover); border-color: var(--border-active); }
      .sfi-chip-active {
        background: var(--text-primary);
        color: #fff;
        border-color: var(--text-primary);
      }
      .sfi-chip-red.sfi-chip-active { background: var(--accent-red); border-color: var(--accent-red); }
      .sfi-chip-gold.sfi-chip-active { background: #B88A00; border-color: #B88A00; }
      .sfi-chip-blue.sfi-chip-active { background: var(--accent-blue); border-color: var(--accent-blue); }
      .sfi-chip-icon { display: inline-flex; }

      .sfi-select-row { display: flex; gap: 14px; flex-wrap: wrap; }
      .sfi-select {
        display: flex;
        flex-direction: column;
        font-size: 0.72rem;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--text-muted);
        gap: 4px;
      }
      .sfi-select select {
        font-family: inherit;
        font-size: 0.85rem;
        padding: 6px 10px;
        background: var(--bg-card);
        border: 1px solid var(--border);
        border-radius: 6px;
        color: var(--text-primary);
        min-width: 160px;
      }
      .sfi-search {
        position: relative;
        max-width: 500px;
      }
      .sfi-search svg {
        position: absolute;
        left: 12px; top: 50%;
        transform: translateY(-50%);
        color: var(--text-muted);
      }
      .sfi-search input {
        width: 100%;
        padding: 9px 14px 9px 36px;
        font-family: inherit;
        font-size: 0.92rem;
        background: var(--bg-card);
        border: 1px solid var(--border);
        border-radius: 8px;
        color: var(--text-primary);
      }
      .sfi-search input:focus { outline: none; border-color: var(--accent-red); }

      .sfi-result-count {
        font-size: 0.78rem;
        color: var(--text-muted);
        margin: 8px 0 12px;
      }

      /* Table */
      .sfi-table-wrap {
        background: var(--bg-card);
        border: 1px solid var(--border);
        border-radius: 10px;
        overflow-x: auto;
        overflow-y: visible;
        box-shadow: var(--shadow-card);
        margin-bottom: 24px;
        -webkit-overflow-scrolling: touch;
      }
      .sfi-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.95rem;
        table-layout: fixed;
      }
      .sfi-col-filer    { width: 24%; min-width: 220px; }
      .sfi-col-flags    { width: 12%; min-width: 130px; }
      .sfi-col-employer { width: 30%; min-width: 220px; }
      .sfi-col-realestate { width: 11%; min-width: 100px; }
      .sfi-col-creditor { width: 15%; min-width: 130px; }
      .sfi-col-pdf      { width: 8%; min-width: 90px; text-align: right; }
      .sfi-table thead th.sfi-col-pdf,
      .sfi-row td.sfi-col-pdf {
        position: sticky;
        right: 0;
        background: inherit;
        box-shadow: -8px 0 12px -8px rgba(0,0,0,0.08);
        z-index: 1;
      }
      .sfi-table thead th.sfi-col-pdf { background: var(--bg-card-hover); }
      .sfi-row td.sfi-col-pdf { background: var(--bg-card); }
      .sfi-row:hover td.sfi-col-pdf { background: var(--bg-card-hover); }
      .sfi-row-expanded td.sfi-col-pdf { background: #f6e6ea; }

      .sfi-table thead th {
        text-align: left;
        font-size: 0.74rem;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: var(--text-muted);
        background: var(--bg-card-hover);
        padding: 14px 16px;
        border-bottom: 1px solid var(--border);
        font-weight: 700;
      }
      .sfi-table thead th.sfi-col-pdf { text-align: right; }

      .sfi-row td {
        padding: 16px;
        border-bottom: 1px solid var(--border);
        vertical-align: middle;
      }
      .sfi-row:hover td { background: var(--bg-card-hover); }
      .sfi-row-expanded td {
        background: rgba(104,10,29,0.05);
        border-bottom-color: transparent;
      }

      .sfi-filer-cell {
        display: flex;
        align-items: flex-start;
        gap: 10px;
      }
      .sfi-filer-stack {
        display: flex;
        flex-direction: column;
        gap: 5px;
        min-width: 0;
      }
      .sfi-expand-btn {
        background: var(--bg-card);
        border: 1px solid var(--border);
        border-radius: 5px;
        padding: 4px;
        cursor: pointer;
        color: var(--text-muted);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        margin-top: 2px;
        flex-shrink: 0;
      }
      .sfi-expand-btn:hover { background: var(--bg-card-hover); color: var(--text-primary); }
      .sfi-name {
        font-size: 1rem;
        font-weight: 700;
        color: var(--text-primary);
        line-height: 1.25;
        word-break: break-word;
      }
      .sfi-filer-meta {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
      }
      .sfi-year {
        font-family: 'JetBrains Mono', monospace;
        font-size: 0.85rem;
        font-weight: 600;
        color: var(--text-muted);
      }
      .sfi-branch {
        display: inline-block;
        font-size: 0.74rem;
        font-weight: 700;
        padding: 3px 9px;
        border-radius: 4px;
        background: var(--bg-card-hover);
        color: var(--text-secondary);
        border: 1px solid var(--border);
        white-space: nowrap;
        letter-spacing: 0.02em;
      }
      .sfi-branch-house, .sfi-branch-senate { background: rgba(20,85,143,0.12); color: var(--accent-blue); border-color: rgba(20,85,143,0.3); }
      .sfi-branch-judiciary { background: rgba(50,120,78,0.12); color: var(--accent-green); border-color: rgba(50,120,78,0.3); }
      .sfi-branch-executive { background: rgba(0,169,206,0.12); color: var(--accent-cyan); border-color: rgba(0,169,206,0.3); }
      .sfi-branch-massdot, .sfi-branch-mbta, .sfi-branch-doc, .sfi-branch-dor, .sfi-branch-state-police {
        background: rgba(255,199,44,0.15); color: #8a6700; border-color: rgba(255,199,44,0.4);
      }

      .sfi-flags { display: flex; flex-wrap: wrap; gap: 5px; }
      .sfi-flag {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 0.72rem;
        font-weight: 700;
        padding: 4px 8px;
        border-radius: 4px;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        white-space: nowrap;
      }
      .sfi-flag-red { background: var(--accent-red); color: #fff; }
      .sfi-flag-gold { background: var(--accent-gold); color: #2a1f00; }
      .sfi-flag-blue { background: var(--accent-blue); color: #fff; }

      .sfi-employer-stack {
        display: flex;
        flex-direction: column;
        gap: 5px;
      }
      .sfi-emp-row {
        display: grid;
        grid-template-columns: 56px 1fr;
        gap: 8px;
        align-items: baseline;
        font-size: 0.92rem;
        line-height: 1.35;
      }
      .sfi-emp-label {
        font-size: 0.68rem;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--text-muted);
        font-weight: 700;
        padding-top: 1px;
      }
      .sfi-emp-value {
        color: var(--text-primary);
        overflow: hidden;
        text-overflow: ellipsis;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        word-break: break-word;
      }

      .sfi-cell-truncate {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        color: var(--text-secondary);
        font-size: 0.92rem;
      }
      .sfi-empty { color: var(--text-muted); opacity: 0.5; font-size: 1.1rem; }
      .sfi-pill {
        display: inline-block;
        font-size: 0.8rem;
        font-weight: 600;
        padding: 3px 10px;
        background: var(--bg-card-hover);
        color: var(--text-secondary);
        border: 1px solid var(--border);
        border-radius: 999px;
        margin-right: 4px;
        margin-bottom: 3px;
      }
      .sfi-pill-muted { opacity: 0.7; }
      .sfi-pdf-link {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        color: var(--accent-cyan);
        text-decoration: none;
        font-weight: 700;
        font-size: 0.86rem;
        padding: 6px 10px;
        background: rgba(0,169,206,0.08);
        border: 1px solid rgba(0,169,206,0.25);
        border-radius: 6px;
        transition: background 0.12s;
        white-space: nowrap;
      }
      .sfi-pdf-link:hover { background: rgba(0,169,206,0.18); }
      .sfi-pdf-label { font-size: 0.82rem; }

      /* Expanded detail */
      .sfi-detail td {
        border-bottom: 1px solid var(--border);
        background: rgba(104,10,29,0.03);
        padding: 0;
      }
      .sfi-detail-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 14px;
        padding: 14px 28px 18px 40px;
      }
      .sfi-detail-cell { font-size: 0.84rem; }
      .sfi-detail-label {
        font-size: 0.7rem;
        text-transform: uppercase;
        color: var(--text-muted);
        letter-spacing: 0.06em;
        margin-bottom: 3px;
      }
      .sfi-detail-value {
        color: var(--text-primary);
        line-height: 1.4;
      }
      .sfi-detail-counts { grid-column: 1 / -1; }

      .sfi-loadmore {
        display: block;
        margin: 12px auto;
        padding: 8px 24px;
        background: var(--bg-card);
        border: 1px solid var(--border);
        border-radius: 6px;
        color: var(--text-secondary);
        font-weight: 600;
        font-size: 0.85rem;
        cursor: pointer;
        font-family: inherit;
      }
      .sfi-loadmore:hover { background: var(--bg-card-hover); }

      .sfi-provenance {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        margin-top: 24px;
        padding: 14px 18px;
        background: var(--bg-card-hover);
        border-radius: 8px;
        font-size: 0.76rem;
        color: var(--text-muted);
        line-height: 1.5;
      }
      .sfi-provenance svg { flex-shrink: 0; margin-top: 2px; }
      .sfi-provenance a { color: var(--accent-cyan); text-decoration: none; }
      .sfi-provenance a:hover { text-decoration: underline; }

      /* Tablet: tighten paddings + drop fixed widths */
      @media (max-width: 1100px) {
        .sfi-table { table-layout: auto; }
        .sfi-col-filer    { min-width: 180px; }
        .sfi-col-employer { min-width: 200px; }
        .sfi-col-creditor { min-width: 120px; }
      }

      /* Mobile: collapse table into stacked cards (one row = one card) */
      @media (max-width: 760px) {
        .sfi-table-wrap { background: transparent; border: none; box-shadow: none; border-radius: 0; }
        .sfi-table, .sfi-table thead, .sfi-table tbody, .sfi-table tr, .sfi-table th, .sfi-table td {
          display: block;
        }
        .sfi-table thead { display: none; }
        .sfi-row {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: 10px;
          margin-bottom: 12px;
          box-shadow: var(--shadow-card);
          padding: 4px 0;
        }
        .sfi-row:hover td { background: transparent; }
        .sfi-row-expanded {
          background: rgba(104,10,29,0.04);
          border-color: rgba(104,10,29,0.25);
        }
        .sfi-row td {
          padding: 8px 16px;
          border-bottom: none;
        }
        .sfi-row td.sfi-col-pdf {
          text-align: left;
          padding-top: 12px;
          padding-bottom: 12px;
        }
        .sfi-row td:empty { display: none; }
        .sfi-row td.sfi-col-realestate:has(.sfi-empty) { display: none; }
        .sfi-row td.sfi-col-creditor:has(.sfi-empty) { display: none; }
        .sfi-row td.sfi-col-employer:has(.sfi-empty) { display: none; }
        .sfi-row td.sfi-col-flags:empty { display: none; }
        .sfi-name { font-size: 1.05rem; }
        .sfi-emp-row {
          grid-template-columns: 48px 1fr;
          font-size: 0.88rem;
        }
        .sfi-emp-value { -webkit-line-clamp: 3; }
        .sfi-detail td { padding: 0; }
        .sfi-detail-grid { padding: 12px 16px; }

        .tempus-card { padding: 22px 18px; }
        .tempus-headline { font-size: 1.15rem; }
        .tempus-grid { grid-template-columns: 1fr; }

        .sfi-stats { grid-template-columns: 1fr 1fr; }
        .sfi-stat { padding: 12px 14px; }
        .sfi-stat-value { font-size: 1.4rem; }

        .sfi-chip-row { gap: 6px; }
        .sfi-chip { font-size: 0.78rem; padding: 6px 10px; }
        .sfi-select select { min-width: 130px; }

        .sfi-result-count { font-size: 0.85rem; }
      }
    `}</style>
  );
}
