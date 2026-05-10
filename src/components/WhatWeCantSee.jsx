import { useEffect, useState } from 'react';
import { ShieldAlert, EyeOff, FileX, Lock, AlertTriangle, ExternalLink } from 'lucide-react';

const SHIELDED_CATEGORIES = [
  {
    name: 'Public Records Law',
    massachusetts: 'Legislature exempt — alone among the 50 states. Members can refuse any document request without explanation.',
    elsewhere: [
      'CA: Legislature subject to the California Public Records Act.',
      'NY: Legislature subject to FOIL with limited exemptions.',
      'IL: Legislature subject to FOIA, with deliberative-process carve-outs.',
      'TX: Legislature subject to the Public Information Act.',
    ],
    severity: 'high',
  },
  {
    name: 'Open Meeting Law',
    massachusetts: 'Legislature exempt. Conference committees — where major legislation is actually written — meet in secret with no posted agenda or minutes.',
    elsewhere: [
      'Most state legislatures publish committee agendas, recordings, and votes.',
      'CA conference committees: open with public notice, recorded.',
      'IL: open committees, audio archived.',
    ],
    severity: 'high',
  },
  {
    name: 'Roll Call Votes',
    massachusetts: 'Most bills pass by voice vote with no recorded individual position. House requires 16 members standing to demand a roll call; Senate requires 25%.',
    elsewhere: [
      'CA, NY, IL: every floor vote on substantive legislation is roll-called by default.',
      'Many states post recorded votes on every committee bill.',
    ],
    severity: 'high',
    seeAlso: 'See the Roll Calls tab for actual numbers from the current session.',
  },
  {
    name: 'Member Office Budgets',
    massachusetts: 'Each legislator receives an office allotment plus per-diems and leadership stipends. Detail of what was spent on what is published only in summary form, if at all.',
    elsewhere: [
      'CA, OR, MN: line-item member expenses published quarterly.',
      'WA: detailed itemized expense reports per legislator, online.',
    ],
    severity: 'medium',
  },
  {
    name: 'Speaker / Leadership Discretionary Funds',
    massachusetts: 'Leadership controls millions in unallocated spending with limited public reporting on how it is used.',
    elsewhere: [
      'Most states either prohibit or require detailed accounting of leadership discretionary spending.',
    ],
    severity: 'medium',
  },
  {
    name: 'Internal Communications',
    massachusetts: 'Email, drafting histories, staff memos — none subject to disclosure. The legislature has interpreted its constitutional independence to mean no internal record can be compelled.',
    elsewhere: [
      'CA, NY, IL: legislative communications subject to FOIA-style access with deliberative-process exemptions.',
    ],
    severity: 'high',
  },
  {
    name: 'Bill Drafting & Amendments',
    massachusetts: 'Outside sections, midnight amendments, omnibus riders attached to the budget hours before a vote. No structured tracking of who proposed what.',
    elsewhere: [
      'CA, NY: every amendment posted online with sponsor and timestamp before the vote.',
    ],
    severity: 'high',
  },
  {
    name: 'Hiring & Patronage',
    massachusetts: 'Legislator family members on state payroll: published indirectly via CTHRU but not as a structured relationship dataset. Hiring decisions are not subject to records law.',
    elsewhere: [
      'Several states bar nepotism in legislative hiring outright; others require disclosure of family employment.',
    ],
    severity: 'medium',
    seeAlso: 'Use the Payroll tab to search by surname.',
  },
];

const RANKINGS = [
  {
    source: 'Center for Public Integrity',
    year: 2015,
    finding: 'Massachusetts received an "F" grade on legislative accountability — among the worst in the nation.',
    url: 'https://publicintegrity.org/politics/state-politics/state-integrity-investigation/',
  },
  {
    source: 'R Street Institute (State Transparency Index)',
    year: 2024,
    finding: 'Massachusetts ranks dead last on legislative transparency among all 50 states.',
    url: 'https://www.rstreet.org/',
  },
  {
    source: 'Pew Charitable Trusts',
    year: 2023,
    finding: 'Identifies Massachusetts as one of three states with sweeping legislative public-records exemptions.',
    url: 'https://www.pewtrusts.org/',
  },
  {
    source: 'Massachusetts Ballot Question 1',
    year: 2024,
    finding: '71.8% of Massachusetts voters approved giving the State Auditor authority to audit the Legislature. Legislative leadership has refused to comply.',
    url: 'https://www.sec.state.ma.us/divisions/elections/results/2024/2024-state-ballot-questions.htm',
  },
];

const severityColors = {
  high: { bg: 'rgba(104, 10, 29, 0.08)', border: 'var(--accent-red)', label: 'COMPLETELY SHIELDED' },
  medium: { bg: 'rgba(255, 199, 44, 0.08)', border: 'var(--accent-gold)', label: 'PARTIALLY DISCLOSED' },
};

export default function WhatWeCantSee() {
  const [rollCallStats, setRollCallStats] = useState(null);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/ma-roll-calls.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setRollCallStats(d))
      .catch(() => {});
  }, []);

  return (
    <div className="section">
      <div className="section-header">
        <span className="section-tag red">The Limits of Public Data</span>
        <h2>What We Can&rsquo;t See</h2>
        <p style={{ maxWidth: 820 }}>
          The Massachusetts Legislature is the most secretive state legislature in the United States. Below
          is what voters cannot see &mdash; the categories of public-interest information that elsewhere
          are published as a matter of course but in Massachusetts have been deliberately shielded by the
          Legislature&rsquo;s self-applied exemptions. This dashboard surfaces every dollar that flows through the
          Comptroller and every donation that flows through OCPF; it cannot reach anything below.
        </p>
      </div>

      {rollCallStats?.totals?.actions > 0 && (
        <div
          className="chart-card highlighted"
          style={{
            background: 'linear-gradient(145deg, rgba(104, 10, 29, 0.08), rgba(104, 10, 29, 0.02))',
            borderLeft: '4px solid var(--accent-red)',
            marginBottom: 32,
          }}
        >
          <h3 style={{ color: 'var(--accent-red)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertTriangle size={20} /> The Voice-Vote Problem &mdash; live count from this session
          </h3>
          <p style={{ marginTop: 12, fontSize: '0.95rem', color: 'var(--text-secondary)' }}>
            From a <strong>{rollCallStats.billsScanned.toLocaleString()}-bill sample</strong> of the {rollCallStats.generalCourt}
            <sup>th</sup> General Court (2025&ndash;2026), we counted{' '}
            <strong>{rollCallStats.totals.voicePasses.toLocaleString()}</strong> decisive bill actions
            (passages, engrossments, enactments) and{' '}
            <strong>{rollCallStats.totals.rollCalls.toLocaleString()}</strong> roll-call votes where individual
            legislators&rsquo; positions were recorded.
            {rollCallStats.totals.rollCalls === 0
              ? ' Of those decisive actions, none had recorded individual positions.'
              : ` That works out to ${(rollCallStats.ratios.voicePassShare * 100).toFixed(1)}% voice vote, ${(rollCallStats.ratios.rollCallShare * 100).toFixed(1)}% roll-call.`}
          </p>
          <div className="kpi-row" style={{ marginTop: 16 }}>
            <div className="card">
              <div className="card-title">Bills sampled</div>
              <div className="card-value">{rollCallStats.billsScanned.toLocaleString()}</div>
              <div className="card-change">of {rollCallStats.billsTotal.toLocaleString()} in session</div>
            </div>
            <div className="card">
              <div className="card-title">Roll-call votes</div>
              <div className="card-value" style={{ color: 'var(--accent-green)' }}>
                {rollCallStats.totals.rollCalls.toLocaleString()}
              </div>
              <div className="card-change">individual positions on record</div>
            </div>
            <div className="card">
              <div className="card-title">Voice-vote passages</div>
              <div className="card-value" style={{ color: 'var(--accent-red)' }}>
                {rollCallStats.totals.voicePasses.toLocaleString()}
              </div>
              <div className="card-change" style={{ color: 'var(--accent-red)' }}>
                no recorded position
              </div>
            </div>
          </div>
          <div style={{ marginTop: 14, fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            Method: scraped from <code>malegislature.gov/Bills/{rollCallStats.generalCourt}/&lt;BillNumber&gt;</code>.
            Sample is <code>{rollCallStats.sampleStrategy}</code>. Refreshed twice weekly. The sample is
            biased toward bills with low BillNumbers, so this likely understates the small fraction of
            high-profile bills that do receive a roll-call vote.
          </div>
        </div>
      )}

      <h3 style={{ marginBottom: 16, marginTop: 8 }}>Categories Shielded by the Legislature</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {SHIELDED_CATEGORIES.map((c) => {
          const sev = severityColors[c.severity];
          return (
            <div
              key={c.name}
              className="chart-card"
              style={{ background: sev.bg, borderLeft: `4px solid ${sev.border}` }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                {c.severity === 'high' ? <Lock size={18} /> : <EyeOff size={18} />}
                <h3 style={{ margin: 0, fontSize: '1.05rem' }}>{c.name}</h3>
                <span
                  style={{
                    marginLeft: 'auto',
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    letterSpacing: 1,
                    color: sev.border,
                  }}
                >
                  {sev.label}
                </span>
              </div>
              <p style={{ color: 'var(--text-primary)', marginBottom: 12 }}>
                <strong>Massachusetts:</strong> {c.massachusetts}
              </p>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                <strong style={{ color: 'var(--text-muted)' }}>Elsewhere:</strong>
                <ul style={{ margin: '6px 0 0 18px', padding: 0 }}>
                  {c.elsewhere.map((e, i) => (
                    <li key={i} style={{ marginBottom: 4 }}>
                      {e}
                    </li>
                  ))}
                </ul>
              </div>
              {c.seeAlso && (
                <div style={{ marginTop: 10, fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  &rarr; {c.seeAlso}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <h3 style={{ marginTop: 32, marginBottom: 16 }}>Independent Rankings &amp; Findings</h3>
      <div className="card-grid">
        {RANKINGS.map((r) => (
          <div key={r.source} className="card">
            <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <ShieldAlert size={14} /> {r.source} &middot; {r.year}
            </div>
            <p style={{ marginTop: 8, fontSize: '0.85rem', lineHeight: 1.5 }}>{r.finding}</p>
            {r.url && (
              <a
                href={r.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  marginTop: 10,
                  fontSize: '0.75rem',
                  color: 'var(--accent-cyan)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                Source <ExternalLink size={11} />
              </a>
            )}
          </div>
        ))}
      </div>

      <div
        className="chart-card"
        style={{
          marginTop: 32,
          background: 'linear-gradient(145deg, rgba(20, 85, 143, 0.08), transparent)',
          borderLeft: '4px solid var(--accent-blue)',
        }}
      >
        <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--accent-blue)' }}>
          <FileX size={18} /> Why this page exists
        </h3>
        <p style={{ marginTop: 12 }}>
          A formal audit of the Legislature, as 71.8% of Massachusetts voters demanded in 2024, would have
          subpoena power and could reach every category above. Until that audit is allowed, the gap between
          what we can publish here and what the Legislature has chosen to hide <em>is</em> the story.
        </p>
        <p style={{ marginTop: 12, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          On February 10, 2026, State Auditor Diana DiZoglio filed a complaint with the Massachusetts Supreme
          Judicial Court to enforce the will of the voters. That case is the legal route to closing this gap.
          The data above is the political route.
        </p>
      </div>
    </div>
  );
}
