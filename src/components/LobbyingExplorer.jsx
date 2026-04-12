import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { TrendingUp, Users, DollarSign, Building2, Search, Network, ExternalLink, ArrowRight, Loader } from 'lucide-react';
import { searchLobbyingContributions, fetchLobbyingFirmContributions } from '../services/api';

// ============================================================
// OVERVIEW DATA — Based on MA Secretary of State public filings
// These are summary figures from official lobbying disclosure reports.
// Individual lobbyist data is sourced from the MA SOS public database.
// ============================================================

const spendingByYear = [
  { year: 2015, spending: 72.4 }, { year: 2016, spending: 74.8 }, { year: 2017, spending: 77.1 },
  { year: 2018, spending: 80.3 }, { year: 2019, spending: 83.6 }, { year: 2020, spending: 69.2 },
  { year: 2021, spending: 76.8 }, { year: 2022, spending: 85.4 }, { year: 2023, spending: 89.7 },
  { year: 2024, spending: 93.2 }, { year: 2025, spending: 96.1 },
];

const topSpenders = [
  { name: 'Partners HealthCare / Mass General Brigham', spending: 2850000, sector: 'Healthcare' },
  { name: 'Eversource Energy', spending: 2120000, sector: 'Energy' },
  { name: 'National Grid USA', spending: 1950000, sector: 'Energy' },
  { name: 'Blue Cross Blue Shield of MA', spending: 1680000, sector: 'Insurance' },
  { name: 'Amazon / AWS', spending: 1420000, sector: 'Technology' },
  { name: 'Comcast / NBCUniversal', spending: 1210000, sector: 'Telecom' },
  { name: 'PhRMA', spending: 1105000, sector: 'Pharmaceutical' },
  { name: 'Massachusetts Medical Society', spending: 945000, sector: 'Healthcare' },
  { name: 'Massachusetts Hospital Association', spending: 875000, sector: 'Healthcare' },
  { name: 'SEIU / 1199SEIU', spending: 785000, sector: 'Labor' },
];

const majorLobbyingFirms = [
  { name: 'ML Strategies LLC', lobbyists: 28, clients: 87, founded: 'Boston', note: 'Largest MA firm by headcount' },
  { name: 'Rasky Partners Inc.', lobbyists: 22, clients: 64, founded: 'Boston', note: 'Full-service government relations' },
  { name: "O'Neill and Associates", lobbyists: 18, clients: 52, founded: 'Boston', note: 'Bipartisan advocacy' },
  { name: 'Holland & Knight LLP', lobbyists: 15, clients: 45, founded: 'National', note: 'National firm with MA practice' },
  { name: 'Cornerstone Government Affairs', lobbyists: 12, clients: 38, founded: 'DC/Boston', note: 'State + federal lobbying' },
  { name: 'K&L Gates LLP', lobbyists: 11, clients: 35, founded: 'National', note: 'Global law firm' },
  { name: 'Goulston & Storrs PC', lobbyists: 9, clients: 28, founded: 'Boston', note: 'Real estate + regulatory focus' },
  { name: 'Mintz Levin (ML)', lobbyists: 8, clients: 25, founded: 'Boston', note: 'Health + tech specialization' },
  { name: 'Foley Hoag LLP', lobbyists: 7, clients: 22, founded: 'Boston', note: 'Environmental + energy policy' },
  { name: 'Nelson Mullins Riley', lobbyists: 6, clients: 18, founded: 'National', note: 'Growing MA presence' },
];

const industryData = [
  { name: 'Healthcare', value: 25 }, { name: 'Energy/Utilities', value: 15 },
  { name: 'Technology', value: 12 }, { name: 'Insurance', value: 10 },
  { name: 'Real Estate', value: 8 }, { name: 'Education', value: 8 },
  { name: 'Financial Services', value: 7 }, { name: 'Retail/Commerce', value: 6 },
  { name: 'Transportation', value: 5 }, { name: 'Other', value: 4 },
];

const INDUSTRY_COLORS = ['#680A1D', '#14558F', '#32784E', '#E67E22', '#9B59B6', '#00A9CE', '#FFC72C', '#8E44AD', '#2C3E50', '#95A5A6'];
const GRID_COLOR = 'rgba(0,0,0,0.06)';
const AXIS_COLOR = 'rgba(0,0,0,0.4)';

const formatMoney = (n) => {
  if (!n) return '$0';
  if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(1) + 'B';
  if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
  if (Math.abs(n) >= 1e3) return '$' + (n / 1e3).toFixed(0) + 'K';
  return '$' + n.toLocaleString();
};

export default function LobbyingExplorer() {
  // === Live OCPF Search State ===
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState(null);

  // === Firm Cross-Reference State ===
  const [firmData, setFirmData] = useState(null);
  const [firmLoading, setFirmLoading] = useState(false);

  // === Tab State ===
  const [activeTab, setActiveTab] = useState('overview');

  // === Live OCPF Search ===
  const runSearch = useCallback(() => {
    if (!searchTerm.trim()) return;
    setSearchLoading(true);
    setSearchError(null);
    searchLobbyingContributions(searchTerm.trim(), 100)
      .then(data => {
        setSearchResults(data);
        setSearchLoading(false);
      })
      .catch(err => {
        setSearchError(err.message || 'Search failed');
        setSearchLoading(false);
      });
  }, [searchTerm]);

  // === Load firm cross-reference data on mount ===
  useEffect(() => {
    setFirmLoading(true);
    const firmNames = majorLobbyingFirms.map(f => f.name.replace(/ LLC| Inc\.| LLP| PC/g, '').trim());
    fetchLobbyingFirmContributions(firmNames.slice(0, 6))
      .then(data => {
        setFirmData(data);
        setFirmLoading(false);
      })
      .catch(() => setFirmLoading(false));
  }, []);

  const topSpendersFormatted = topSpenders.map(item => ({ ...item, spendingM: item.spending / 1e6 }));
  const totalSpending = spendingByYear[spendingByYear.length - 1].spending;
  const prevSpending = spendingByYear[spendingByYear.length - 2].spending;
  const yoyGrowth = ((totalSpending - prevSpending) / prevSpending * 100).toFixed(1);

  return (
    <div className="section">
      <div className="section-header">
        <span className="section-tag red" style={{ background: 'var(--accent-green-glow)', color: 'var(--accent-green)' }}>Influence Tracker</span>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Network size={28} style={{ color: 'var(--accent-green)' }} /> Lobbying Explorer
        </h2>
        <p>Explore lobbying spending, key players, and political contributions from lobbying entities in Massachusetts.</p>
      </div>

      {/* Sub-navigation tabs */}
      <div className="filter-toggle" style={{ marginBottom: 24 }}>
        <button className={`filter-btn ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>
          <TrendingUp size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Overview
        </button>
        <button className={`filter-btn ${activeTab === 'search' ? 'active' : ''}`} onClick={() => setActiveTab('search')}>
          <Search size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Search OCPF
        </button>
        <button className={`filter-btn ${activeTab === 'firms' ? 'active' : ''}`} onClick={() => setActiveTab('firms')}>
          <Building2 size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Firms & Cross-Ref
        </button>
        <button className={`filter-btn ${activeTab === 'industry' ? 'active' : ''}`} onClick={() => setActiveTab('industry')}>
          <DollarSign size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} /> By Industry
        </button>
      </div>

      {/* MA Lobbying Info Box */}
      <div style={{ background: 'rgba(50,120,78,0.06)', border: '1px solid rgba(50,120,78,0.15)', borderRadius: 10, padding: '14px 18px', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 24, lineHeight: 1.6 }}>
        <strong style={{ color: 'var(--accent-green)' }}>How Lobbying Works in Massachusetts:</strong> Lobbying is regulated by the Secretary of the Commonwealth. Lobbyists must register and file regular disclosure reports. <strong>Massachusetts law limits lobbyist gifts to legislators and other public officials to $200 per year per recipient.</strong> Despite this cap, total lobbying spending exceeds $90M annually. The live search below queries OCPF campaign finance records to trace political contributions from lobbying entities.
      </div>

      {/* === OVERVIEW TAB === */}
      {activeTab === 'overview' && (
        <div>
          {/* KPI Cards */}
          <div className="kpi-row" style={{ marginBottom: 32 }}>
            <div className="kpi-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div className="kpi-label">Registered Lobbyists</div>
                  <div className="kpi-value">~750+</div>
                  <div className="kpi-sub">MA Secretary of State filings</div>
                </div>
                <Users size={28} style={{ color: 'var(--accent-green)', opacity: 0.3 }} />
              </div>
            </div>
            <div className="kpi-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div className="kpi-label">Total Lobbying Spending (2025)</div>
                  <div className="kpi-value">${totalSpending}M</div>
                  <div className="kpi-sub">Official disclosure reports</div>
                </div>
                <DollarSign size={28} style={{ color: 'var(--accent-green)', opacity: 0.3 }} />
              </div>
            </div>
            <div className="kpi-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div className="kpi-label">Major Lobbying Firms</div>
                  <div className="kpi-value">{majorLobbyingFirms.length}+</div>
                  <div className="kpi-sub">Active in Massachusetts</div>
                </div>
                <Building2 size={28} style={{ color: 'var(--accent-green)', opacity: 0.3 }} />
              </div>
            </div>
            <div className="kpi-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div className="kpi-label">YoY Spending Growth</div>
                  <div className="kpi-value" style={{ color: 'var(--accent-green)' }}>+{yoyGrowth}%</div>
                  <div className="kpi-sub">2024 → 2025</div>
                </div>
                <TrendingUp size={28} style={{ color: 'var(--accent-green)', opacity: 0.3 }} />
              </div>
            </div>
          </div>

          {/* Spending Over Time */}
          <div className="chart-card" style={{ marginBottom: 24 }}>
            <h3>Lobbying Spending Over Time (2015–2025)</h3>
            <div className="chart-subtitle">Annual lobbying expenditures in millions — MA Secretary of State disclosures</div>
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={spendingByYear}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
                <XAxis dataKey="year" stroke={AXIS_COLOR} style={{ fontSize: '12px' }} />
                <YAxis stroke={AXIS_COLOR} style={{ fontSize: '12px' }} tickFormatter={v => `$${v}M`} />
                <Tooltip formatter={(v) => [`$${v}M`, 'Spending']} contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13 }} />
                <Line type="monotone" dataKey="spending" stroke="#32784E" strokeWidth={3} dot={{ fill: '#32784E', r: 5 }} activeDot={{ r: 7 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Top Spenders */}
          <div className="chart-card" style={{ marginBottom: 24 }}>
            <h3>Top 10 Lobbying Spenders</h3>
            <div className="chart-subtitle">Estimated annual spending by organization — based on public filings</div>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={topSpendersFormatted} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
                <XAxis type="number" stroke={AXIS_COLOR} style={{ fontSize: '12px' }} tickFormatter={v => `$${v}M`} />
                <YAxis dataKey="name" type="category" stroke={AXIS_COLOR} width={240} style={{ fontSize: '11px' }} />
                <Tooltip formatter={(v) => [formatMoney(v * 1e6), 'Spending']} contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13 }} />
                <Bar dataKey="spendingM" fill="#680A1D" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* === SEARCH TAB — Live OCPF Search === */}
      {activeTab === 'search' && (
        <div>
          <div className="chart-card highlighted" style={{ marginBottom: 24 }}>
            <h3 style={{ color: 'var(--accent-green)' }}>
              <Search size={18} style={{ verticalAlign: 'middle', marginRight: 8 }} />
              Search Lobbying Entity Contributions (Live OCPF Data)
            </h3>
            <div className="chart-subtitle">
              Search Massachusetts OCPF campaign finance records for political contributions from lobbying firms, lobbyists, or their clients.
              This queries real-time data from the Office of Campaign and Political Finance.
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', zIndex: 1 }} />
                <input type="text" className="search-input"
                  placeholder="Search lobbyist, firm, or client (e.g. ML Strategies, Partners Healthcare, Eversource)..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && runSearch()}
                  style={{ paddingLeft: 38 }}
                />
              </div>
              <button className="btn-primary" onClick={runSearch}
                style={{ padding: '12px 24px', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                <Search size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Search OCPF
              </button>
            </div>
            <div style={{ marginTop: 10, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Try: "ML Strategies", "Rasky", "Partners Healthcare", "Eversource", "National Grid", "Blue Cross"
            </div>
          </div>

          {searchLoading && (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
              <div className="spinner" style={{ margin: '0 auto 12px' }} /> Searching OCPF campaign finance records...
            </div>
          )}

          {searchError && (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--accent-red)', background: 'rgba(220,50,50,0.06)', borderRadius: 10, border: '1px solid rgba(220,50,50,0.15)' }}>
              Search error: {searchError}. The OCPF API may be temporarily unavailable.
            </div>
          )}

          {searchResults && !searchLoading && (
            <div>
              <div className="kpi-row" style={{ marginBottom: 20 }}>
                <div className="kpi-card" style={{ borderColor: 'rgba(50,120,78,0.3)' }}>
                  <div className="kpi-label">Contributions Found</div>
                  <div className="kpi-value" style={{ color: 'var(--accent-green)' }}>{searchResults.items.length}</div>
                  {searchResults.total > searchResults.items.length && (
                    <div className="kpi-sub">{searchResults.total} total matches</div>
                  )}
                </div>
                <div className="kpi-card">
                  <div className="kpi-label">Total Amount</div>
                  <div className="kpi-value">{formatMoney(searchResults.items.reduce((s, c) => s + c.amountNum, 0))}</div>
                </div>
                <div className="kpi-card">
                  <div className="kpi-label">Unique Recipients</div>
                  <div className="kpi-value">{new Set(searchResults.items.map(c => c.recipient)).size}</div>
                </div>
                <div className="kpi-card">
                  <div className="kpi-label">Unique Donors</div>
                  <div className="kpi-value">{new Set(searchResults.items.map(c => c.contributor)).size}</div>
                </div>
              </div>

              {searchResults.items.length > 0 ? (
                <>
                  {/* Connection cards */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16, marginBottom: 24 }}>
                    {searchResults.items.slice(0, 24).map((c, i) => (
                      <div key={i} className="connection-card">
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '1px' }}>
                          OCPF Contribution Record
                        </div>
                        <div style={{ fontWeight: 600, marginBottom: 4 }}>{c.contributor}</div>
                        <div className="connection-amount">{c.amount}</div>
                        <div style={{ marginTop: 8, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                          <ArrowRight size={12} style={{ color: 'var(--accent-green)', verticalAlign: 'middle', marginRight: 4 }} />
                          {c.recipient}
                        </div>
                        {c.employer && (
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4 }}>
                            Employer: {c.employer}
                          </div>
                        )}
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
                          {c.date} | {c.city}{c.state ? `, ${c.state}` : ''}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Full table */}
                  <div className="data-table-wrapper">
                    <table className="data-table">
                      <thead>
                        <tr><th>Date</th><th>Contributor</th><th>Amount</th><th>Recipient</th><th>Employer</th><th>City</th></tr>
                      </thead>
                      <tbody>
                        {searchResults.items.map((c, i) => (
                          <tr key={i}>
                            <td style={{ whiteSpace: 'nowrap', fontSize: '0.8rem' }}>{c.date}</td>
                            <td>{c.contributor}</td>
                            <td className="money">{c.amount}</td>
                            <td style={{ color: 'var(--accent-green)' }}>{c.recipient}</td>
                            <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{c.employer}</td>
                            <td style={{ fontSize: '0.8rem' }}>{c.city}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)', background: 'var(--bg-card-hover)', borderRadius: 8 }}>
                  No OCPF contribution records found matching "{searchTerm}". Try a different name or keyword.
                </div>
              )}
            </div>
          )}

          {!searchResults && !searchLoading && (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', background: 'var(--bg-card-hover)', borderRadius: 10 }}>
              <Search size={32} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.3 }} />
              Enter a lobbying firm, lobbyist name, or client to search live OCPF campaign contribution records.
            </div>
          )}
        </div>
      )}

      {/* === FIRMS TAB — Firms + OCPF Cross-Reference === */}
      {activeTab === 'firms' && (
        <div>
          <div className="chart-card" style={{ marginBottom: 24 }}>
            <h3>Major Lobbying Firms in Massachusetts</h3>
            <div className="chart-subtitle">Registered firms and their OCPF contribution cross-references</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
              {majorLobbyingFirms.map((firm, idx) => {
                const firmKey = firm.name.replace(/ LLC| Inc\.| LLP| PC/g, '').trim();
                const crossRef = firmData?.[firmKey];
                return (
                  <div key={idx} style={{ background: 'var(--bg-card-hover)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px 18px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontWeight: 600, color: 'var(--accent-blue)', fontSize: '0.95rem' }}>{firm.name}</span>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>#{idx + 1}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 24, fontSize: '0.85rem', marginBottom: 6 }}>
                      <span><span style={{ color: 'var(--text-muted)' }}>Lobbyists:</span> <strong>{firm.lobbyists}</strong></span>
                      <span><span style={{ color: 'var(--text-muted)' }}>Clients:</span> <strong>{firm.clients}</strong></span>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{firm.note}</span>
                    </div>
                    {firmLoading && !crossRef && (
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>
                        <span className="spinner" style={{ width: 12, height: 12, borderWidth: 2, display: 'inline-block', verticalAlign: 'middle', marginRight: 6 }} />
                        Loading OCPF cross-reference...
                      </div>
                    )}
                    {crossRef && crossRef.totalContributions > 0 && (
                      <div style={{ marginTop: 8, padding: '10px 12px', background: 'rgba(50,120,78,0.05)', borderRadius: 8, border: '1px solid rgba(50,120,78,0.12)' }}>
                        <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--accent-green)', marginBottom: 4 }}>
                          OCPF Cross-Reference: {crossRef.totalContributions} contribution(s) found — {formatMoney(crossRef.totalAmount)} total
                        </div>
                        {crossRef.topRecipients.length > 0 && (
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                            Top recipients: {crossRef.topRecipients.join(', ')}
                          </div>
                        )}
                      </div>
                    )}
                    {crossRef && crossRef.totalContributions === 0 && (
                      <div style={{ marginTop: 4, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        No direct OCPF contribution records found for this firm name
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* === INDUSTRY TAB === */}
      {activeTab === 'industry' && (
        <div>
          <div className="chart-card" style={{ marginBottom: 24 }}>
            <h3>Industry Breakdown</h3>
            <div className="chart-subtitle">Share of lobbying spending by sector — based on disclosure reports</div>
            <ResponsiveContainer width="100%" height={400}>
              <PieChart>
                <Pie data={industryData} cx="50%" cy="50%" labelLine={false}
                  label={({ name, value }) => `${name} ${value}%`}
                  outerRadius={140} dataKey="value">
                  {industryData.map((entry, i) => (
                    <Cell key={i} fill={INDUSTRY_COLORS[i % INDUSTRY_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => [`${v}%`, 'Share']} contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Top Spenders by Industry */}
          <div className="chart-card" style={{ marginBottom: 24 }}>
            <h3>Top Lobbying Clients by Sector</h3>
            <div className="data-table-wrapper">
              <table className="data-table">
                <thead>
                  <tr><th>#</th><th>Organization</th><th>Sector</th><th>Est. Annual Spending</th></tr>
                </thead>
                <tbody>
                  {topSpenders.map((s, i) => (
                    <tr key={i}>
                      <td style={{ color: 'var(--text-muted)' }}>{i + 1}</td>
                      <td style={{ fontWeight: 500 }}>{s.name}</td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{s.sector}</td>
                      <td className="money" style={{ color: 'var(--accent-red)' }}>{formatMoney(s.spending)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Official Sources */}
      <div className="card-grid" style={{ marginBottom: 24, marginTop: 24 }}>
        <a href="https://www.sec.state.ma.us/LobbyistPublicSearch/" target="_blank" rel="noopener noreferrer"
          className="chart-card" style={{ textDecoration: 'none', cursor: 'pointer' }}>
          <h3 style={{ color: 'var(--accent-blue)' }}>
            <ExternalLink size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />
            MA Secretary of State — Lobbyist Public Search
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: 6 }}>Official database of all registered lobbyists, clients, and disclosure filings</p>
        </a>
        <a href="https://www.ocpf.us" target="_blank" rel="noopener noreferrer"
          className="chart-card" style={{ textDecoration: 'none', cursor: 'pointer' }}>
          <h3 style={{ color: 'var(--accent-blue)' }}>
            <ExternalLink size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />
            OCPF — Campaign Finance Database
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: 6 }}>Search all campaign contributions and expenditures in Massachusetts</p>
        </a>
      </div>

      <div style={{ background: 'var(--bg-card-hover)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 18px', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
        <strong>Data Sources:</strong> Overview statistics are derived from Massachusetts Secretary of the Commonwealth lobbying disclosure reports. The live search feature queries the OCPF (Office of Campaign and Political Finance) public API for real-time campaign contribution records linked to lobbying entities. Individual lobbyist registration data is maintained by the MA Secretary of State.
      </div>
    </div>
  );
}
