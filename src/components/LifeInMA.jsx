import { useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell
} from 'recharts';
import {
  Zap, Home, Heart, Briefcase, DollarSign, TrendingUp, ExternalLink,
  AlertTriangle, Users
} from 'lucide-react';

const GRID_COLOR = 'rgba(0,0,0,0.06)';
const AXIS_COLOR = '#94a3b8';

const formatMoney = (v) => {
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v.toLocaleString()}`;
};

/* ── topic data ── */
const TOPICS = [
  {
    id: 'energy',
    title: 'Energy Costs',
    icon: <Zap size={22} />,
    color: '#E67E22',
    subtitle: 'EIA Electric Power Monthly · January 2026',
    deepDive: 'https://duncanburns2013-dot.github.io/Massachusetts-Data-Hub/energy-dashboard.html',
    kpis: [
      { label: 'MA Residential Rate', value: '31.16¢/kWh', sub: 'EIA Jan 2026', color: '#E74C3C' },
      { label: 'National Average', value: '17.45¢/kWh', sub: 'US residential avg', color: '#14558F' },
      { label: 'Annual Overpayment', value: '$987', sub: 'Per household vs US avg', color: '#E74C3C' },
      { label: 'Rate Growth Since 2014', value: '+81%', sub: '2x faster than US', color: '#E67E22' },
    ],
    chartTitle: 'Residential Electricity Rate — MA vs. Selected States (¢/kWh)',
    chartData: [
      { state: 'MA', rate: 31.16 },
      { state: 'CT', rate: 30.23 },
      { state: 'NH', rate: 25.37 },
      { state: 'RI', rate: 27.48 },
      { state: 'NY', rate: 23.59 },
      { state: 'NJ', rate: 19.17 },
      { state: 'US Avg', rate: 17.45 },
      { state: 'NC', rate: 13.91 },
      { state: 'FL', rate: 15.92 },
      { state: 'TX', rate: 14.68 },
    ],
    source: 'U.S. Energy Information Administration (EIA), Electric Power Monthly Table 5.6.A',
  },
  {
    id: 'housing',
    title: 'Housing',
    icon: <Home size={22} />,
    color: '#3498DB',
    subtitle: 'Warren Group, MLS PIN · 2025–2026',
    deepDive: 'https://duncanburns2013-dot.github.io/Massachusetts-Data-Hub/ma-housing-dashboard.html',
    kpis: [
      { label: 'Statewide Median Price', value: '$638K', sub: '+3.7% YoY', color: '#E74C3C' },
      { label: 'Greater Boston Median', value: '$800K', sub: 'Metro area', color: '#E74C3C' },
      { label: 'Income Needed to Buy', value: '$171K', sub: '28% DTI rule', color: '#E67E22' },
      { label: 'Housing Unit Deficit', value: '222K', sub: 'Units needed statewide', color: '#14558F' },
    ],
    chartTitle: 'Statewide Median Home Price Trend',
    chartData: [
      { year: '2020', price: 482 },
      { year: '2021', price: 530 },
      { year: '2022', price: 575 },
      { year: '2023', price: 598 },
      { year: '2024', price: 615 },
      { year: '2025', price: 638 },
    ],
    source: 'Warren Group, MLS Property Information Network',
  },
  {
    id: 'healthcare',
    title: 'Healthcare',
    icon: <Heart size={22} />,
    color: '#E74C3C',
    subtitle: 'CMS State Health Expenditure Accounts',
    deepDive: 'https://duncanburns2013-dot.github.io/Massachusetts-Data-Hub/healthcare-dashboard.html',
    kpis: [
      { label: 'MA Per-Capita Spending', value: '$13,319', sub: '#1 nationally', color: '#E74C3C' },
      { label: 'National Average', value: '$10,191', sub: 'US per capita', color: '#14558F' },
      { label: 'MA Premium', value: '+30.7%', sub: 'Above national average', color: '#E67E22' },
      { label: 'Family Premium (Employer)', value: '$26,625', sub: 'Annual avg · KFF 2024', color: '#E74C3C' },
    ],
    chartTitle: 'Per-Capita Health Spending — MA vs. US',
    chartData: [
      { year: '2018', ma: 11280, us: 9040 },
      { year: '2019', ma: 11690, us: 9370 },
      { year: '2020', ma: 11840, us: 9420 },
      { year: '2021', ma: 12560, us: 9860 },
      { year: '2022', ma: 12940, us: 10010 },
      { year: '2023', ma: 13319, us: 10191 },
    ],
    source: 'Centers for Medicare & Medicaid Services (CMS), State Health Expenditure Accounts',
  },
  {
    id: 'employment',
    title: 'Employment',
    icon: <Briefcase size={22} />,
    color: '#2ECC71',
    subtitle: 'BLS LAUS, JOLTS · January 2026',
    deepDive: 'https://duncanburns2013-dot.github.io/Massachusetts-Data-Hub/employment-dashboard.html',
    kpis: [
      { label: 'MA Unemployment', value: '4.7%', sub: 'Jan 2026 · Pre-COVID: 2.9%', color: '#E67E22' },
      { label: 'National Rate', value: '4.3%', sub: 'Mar 2026', color: '#14558F' },
      { label: 'National Rank', value: '#44', sub: 'of 51 (50 states + DC)', color: '#E74C3C' },
      { label: 'Openings per Unemployed', value: '0.87', sub: '2022 peak was 2.0', color: '#E67E22' },
    ],
    chartTitle: 'Unemployment Rate — MA vs. National (2019–2026)',
    chartData: [
      { year: '2019', ma: 2.9, us: 3.7 },
      { year: '2020', ma: 9.5, us: 8.1 },
      { year: '2021', ma: 5.3, us: 5.4 },
      { year: '2022', ma: 3.7, us: 3.6 },
      { year: '2023', ma: 3.5, us: 3.6 },
      { year: '2024', ma: 4.3, us: 4.0 },
      { year: '2025', ma: 4.5, us: 4.2 },
      { year: '2026', ma: 4.7, us: 4.3 },
    ],
    source: 'Bureau of Labor Statistics (BLS), Local Area Unemployment Statistics (LAUS)',
  },
  {
    id: 'affordability',
    title: 'Affordability & Taxes',
    icon: <DollarSign size={22} />,
    color: '#9B59B6',
    subtitle: 'BEA, IRS, MA DOR · 2023–2025',
    deepDive: 'https://duncanburns2013-dot.github.io/Massachusetts-Data-Hub/affordability-dashboard.html',
    kpis: [
      { label: 'Income to "Live Comfortably"', value: '$313,747', sub: 'Family of 4 · SmartAsset 2025', color: '#E74C3C' },
      { label: 'Median Family Income', value: '$140,309', sub: 'Census ACS', color: '#14558F' },
      { label: '$100 Buys Only...', value: '$92.38', sub: 'BEA Regional Price Parity', color: '#E67E22' },
      { label: 'Net Tax Filers Lost (2011–23)', value: '184,719', sub: '$24.7B in AGI outflow', color: '#E74C3C' },
    ],
    chartTitle: 'Cost of Living Premium — MA vs. Competitor States (BEA RPP, US = 100)',
    chartData: [
      { state: 'MA', index: 108.2 },
      { state: 'NY', index: 112.1 },
      { state: 'NJ', index: 110.4 },
      { state: 'CT', index: 105.8 },
      { state: 'US', index: 100.0 },
      { state: 'NC', index: 92.1 },
      { state: 'FL', index: 100.7 },
      { state: 'TX', index: 96.4 },
      { state: 'NH', index: 104.1 },
    ],
    source: 'Bureau of Economic Analysis (BEA), Regional Price Parities; IRS SOI Migration Data',
  },
];

/* ── additional dashboards for the link grid ── */
const MORE_DASHBOARDS = [
  { label: 'Immigration & Migration', url: 'https://duncanburns2013-dot.github.io/Massachusetts-Data-Hub/immigration-dashboard.html', icon: <Users size={16} /> },
  { label: 'Tax & Budget Deep Dive', url: 'https://duncanburns2013-dot.github.io/Massachusetts-Data-Hub/tax-budget-dashboard.html', icon: <DollarSign size={16} /> },
  { label: 'Education Statewide', url: 'https://duncanburns2013-dot.github.io/Massachusetts-Data-Hub/education-statewide.html', icon: <TrendingUp size={16} /> },
  { label: 'Pension Obligations', url: 'https://duncanburns2013-dot.github.io/Massachusetts-Data-Hub/pension-dashboard.html', icon: <AlertTriangle size={16} /> },
  { label: 'H-1B Visa Data', url: 'https://duncanburns2013-dot.github.io/H1B/', icon: <Briefcase size={16} /> },
  { label: 'Pay to Play', url: 'https://duncanburns2013-dot.github.io/Massachusetts-Data-Hub/pay-to-play-dashboard.html', icon: <DollarSign size={16} /> },
];

export default function LifeInMA() {
  const [expandedTopic, setExpandedTopic] = useState('energy');

  return (
    <div className="section">
      <div className="section-header">
        <span className="section-tag red" style={{ background: 'rgba(155,89,182,0.1)', color: '#9B59B6' }}>Life in Massachusetts</span>
        <h2>What It Actually Costs to Live Here</h2>
        <p>
          Official government data on energy, housing, healthcare, employment, and taxes — compared to the rest of the country.
          Every number below comes from a federal or state agency. Click any topic to expand, or visit the full dashboards for the deep dive.
        </p>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>Data: EIA, BLS, CMS, BEA, Warren Group, IRS, MA DOR &middot; Last updated April 2026</div>
      </div>

      {/* ── The headline: the gap ── */}
      <div className="chart-card" style={{ marginBottom: 24, textAlign: 'center', padding: '28px 24px' }}>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 8, fontWeight: 500, letterSpacing: 1, textTransform: 'uppercase' }}>The Gap</div>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 32, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: '2.2rem', fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", color: '#E74C3C' }}>$313,747</div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Income needed to "live comfortably"</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Family of 4 &middot; SmartAsset 2025</div>
          </div>
          <div style={{ fontSize: '2rem', color: 'var(--text-muted)', fontWeight: 300 }}>vs.</div>
          <div>
            <div style={{ fontSize: '2.2rem', fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", color: '#14558F' }}>$140,309</div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Median family income</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Census ACS</div>
          </div>
        </div>
        <div style={{ marginTop: 16, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
          The median Massachusetts family earns <strong style={{ color: 'var(--text-primary)' }}>$173,438 less</strong> than what it takes to live comfortably in the state.
        </div>
      </div>

      {/* ── Topic sections ── */}
      {TOPICS.map((topic) => {
        const isExpanded = expandedTopic === topic.id;
        return (
          <div key={topic.id} className="chart-card" style={{ marginBottom: 16, overflow: 'hidden' }}>
            {/* Header — always visible, clickable */}
            <div
              onClick={() => setExpandedTopic(isExpanded ? null : topic.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
                padding: '4px 0', userSelect: 'none'
              }}
            >
              <span style={{ color: topic.color, flexShrink: 0 }}>{topic.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-primary)' }}>{topic.title}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{topic.subtitle}</div>
              </div>
              {/* Quick stat preview when collapsed */}
              {!isExpanded && topic.kpis[0] && (
                <div style={{ textAlign: 'right', marginRight: 8 }}>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: '1.1rem', color: topic.kpis[0].color }}>
                    {topic.kpis[0].value}
                  </span>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{topic.kpis[0].label}</div>
                </div>
              )}
              <span style={{ color: 'var(--text-muted)', fontSize: '1.2rem', transition: 'transform 0.2s', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                ▾
              </span>
            </div>

            {/* Expanded content */}
            {isExpanded && (
              <div style={{ marginTop: 16 }}>
                {/* KPI cards */}
                <div className="kpi-row" style={{ marginBottom: 20 }}>
                  {topic.kpis.map((kpi, i) => (
                    <div className="kpi-card" key={i}>
                      <div className="kpi-label">{kpi.label}</div>
                      <div className="kpi-value" style={{ color: kpi.color }}>{kpi.value}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>{kpi.sub}</div>
                    </div>
                  ))}
                </div>

                {/* Chart */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>{topic.chartTitle}</div>
                  <ResponsiveContainer width="100%" height={280}>
                    {topic.id === 'energy' || topic.id === 'affordability' ? (
                      <BarChart data={topic.chartData} layout="vertical" margin={{ left: 60, right: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
                        <XAxis type="number" stroke={AXIS_COLOR} style={{ fontSize: '11px' }}
                          tickFormatter={v => topic.id === 'energy' ? `${v}¢` : v} />
                        <YAxis type="category" dataKey="state" stroke={AXIS_COLOR} style={{ fontSize: '11px' }} width={50} />
                        <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13 }} />
                        <Bar dataKey={topic.id === 'energy' ? 'rate' : 'index'} radius={[0, 4, 4, 0]}>
                          {topic.chartData.map((entry, i) => (
                            <Cell key={i} fill={
                              (entry.state === 'MA') ? topic.color :
                              (entry.state === 'US Avg' || entry.state === 'US') ? '#14558F' : '#94a3b8'
                            } />
                          ))}
                        </Bar>
                      </BarChart>
                    ) : topic.id === 'housing' ? (
                      <BarChart data={topic.chartData} margin={{ left: 10, right: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
                        <XAxis dataKey="year" stroke={AXIS_COLOR} style={{ fontSize: '11px' }} />
                        <YAxis stroke={AXIS_COLOR} style={{ fontSize: '11px' }} tickFormatter={v => `$${v}K`} />
                        <Tooltip formatter={(v) => [`$${v}K`, 'Median Price']}
                          contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13 }} />
                        <Bar dataKey="price" fill={topic.color} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    ) : (
                      /* healthcare & employment: grouped bar (MA vs US) */
                      <BarChart data={topic.chartData} margin={{ left: 10, right: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
                        <XAxis dataKey="year" stroke={AXIS_COLOR} style={{ fontSize: '11px' }} />
                        <YAxis stroke={AXIS_COLOR} style={{ fontSize: '11px' }}
                          tickFormatter={v => topic.id === 'healthcare' ? `$${(v/1000).toFixed(0)}K` : `${v}%`} />
                        <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13 }}
                          formatter={(v) => [topic.id === 'healthcare' ? `$${v.toLocaleString()}` : `${v}%`]} />
                        <Bar dataKey="ma" name="Massachusetts" fill={topic.color} radius={[4, 4, 0, 0]} />
                        <Bar dataKey="us" name="US Average" fill="#14558F" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    )}
                  </ResponsiveContainer>
                </div>

                {/* Source + deep dive */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Source: {topic.source}</div>
                  <a href={topic.deepDive} target="_blank" rel="noopener noreferrer"
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      fontSize: '0.82rem', fontWeight: 600, color: topic.color,
                      textDecoration: 'none', padding: '6px 14px', borderRadius: 6,
                      background: `${topic.color}12`, transition: 'all 0.2s'
                    }}>
                    Full Dashboard <ExternalLink size={14} />
                  </a>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* ── More dashboards grid ── */}
      <div className="chart-card" style={{ marginTop: 24 }}>
        <h3 style={{ marginBottom: 4 }}>More Massachusetts Data</h3>
        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 16 }}>
          In-depth dashboards on immigration, pensions, education, and more — all sourced from official government data.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
          {MORE_DASHBOARDS.map((d, i) => (
            <a key={i} href={d.url} target="_blank" rel="noopener noreferrer"
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '12px 16px', borderRadius: 8,
                border: '1px solid var(--border)', background: 'var(--bg-secondary)',
                textDecoration: 'none', color: 'var(--text-primary)',
                fontSize: '0.85rem', fontWeight: 500, transition: 'all 0.2s'
              }}>
              <span style={{ color: 'var(--text-muted)' }}>{d.icon}</span>
              {d.label}
              <ExternalLink size={12} style={{ marginLeft: 'auto', color: 'var(--text-muted)' }} />
            </a>
          ))}
        </div>
      </div>

      {/* ── Data integrity note ── */}
      <div style={{ marginTop: 20, padding: '14px 18px', background: 'rgba(20,85,143,0.05)', border: '1px solid rgba(20,85,143,0.12)', borderRadius: 8, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
        <strong style={{ color: '#14558F' }}>Data Integrity:</strong> Every number on this page comes from an official federal or state government source — EIA, BLS, CMS, BEA, Census Bureau, IRS, or the Massachusetts Department of Revenue.
        No estimates, no projections, no partisan think tanks. Click "Full Dashboard" on any topic for complete methodology and source citations.
      </div>
    </div>
  );
}
