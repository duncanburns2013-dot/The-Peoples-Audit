import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { TrendingUp, Users, DollarSign, Building2, Search, Network, ExternalLink, ArrowRight, AlertTriangle } from 'lucide-react';
import { searchLobbyingContributions } from '../services/api';

// ============================================================
// OVERVIEW DATA — Based on MA Secretary of State public filings
// ============================================================

const spendingByYear = [
  { year: 2015, spending: 72.4 }, { year: 2016, spending: 74.8 }, { year: 2017, spending: 77.1 },
  { year: 2018, spending: 80.3 }, { year: 2019, spending: 83.6 }, { year: 2020, spending: 69.2 },
  { year: 2021, spending: 76.8 }, { year: 2022, spending: 85.4 }, { year: 2023, spending: 89.7 },
  { year: 2024, spending: 93.2 }, { year: 2025, spending: 96.1 },
];

const industryData = [
  { name: 'Healthcare', value: 25, amount: 24.0, lobbyists: 145, topIssues: 'MassHealth rates, drug pricing, hospital licensing, telehealth regulation', topOrgs: 'Mass General Brigham, BCBS MA, Mass Medical Society, Mass Hospital Assoc.' },
  { name: 'Energy/Utilities', value: 15, amount: 14.4, lobbyists: 88, topIssues: 'Rate cases, clean energy mandates, grid modernization, offshore wind', topOrgs: 'Eversource, National Grid, Avangrid, Cape Wind' },
  { name: 'Technology', value: 12, amount: 11.5, lobbyists: 72, topIssues: 'Data privacy, AI regulation, gig worker classification, broadband expansion', topOrgs: 'Amazon/AWS, Google, Microsoft, Uber, Lyft' },
  { name: 'Insurance', value: 10, amount: 9.6, lobbyists: 55, topIssues: 'Rate regulation, coverage mandates, auto insurance reform, climate risk', topOrgs: 'BCBS MA, Tufts Health, Harvard Pilgrim, Liberty Mutual' },
  { name: 'Real Estate', value: 8, amount: 7.7, lobbyists: 48, topIssues: 'Zoning reform, rent control, housing production, 40B compliance', topOrgs: 'NAIOP MA, Greater Boston Real Estate Board, MassHousing' },
  { name: 'Education', value: 8, amount: 7.7, lobbyists: 42, topIssues: 'Charter school caps, funding formula, student debt, higher ed governance', topOrgs: 'UMass System, Boston University, Harvard, MTA' },
  { name: 'Financial Services', value: 7, amount: 6.7, lobbyists: 38, topIssues: 'Fintech regulation, banking charters, consumer protection, fiduciary rules', topOrgs: 'Fidelity, State Street, MassMutual, Rockland Trust' },
  { name: 'Retail/Commerce', value: 6, amount: 5.8, lobbyists: 30, topIssues: 'Sales tax, Sunday/holiday pay, cannabis licensing, liquor laws', topOrgs: 'Retailers Assoc. of MA, Amazon, CVS, Stop & Shop' },
  { name: 'Transportation', value: 5, amount: 4.8, lobbyists: 25, topIssues: 'MBTA funding, road tolls, ride-share regulation, EV infrastructure', topOrgs: 'MBTA Advisory Board, AAA Northeast, Mass. Trucking Assoc.' },
  { name: 'Other', value: 4, amount: 3.8, lobbyists: 20, topIssues: 'Cannabis, gaming, environmental, labor, telecommunications', topOrgs: 'Various trade associations and advocacy groups' },
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

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch { return dateStr; }
};

export default function LobbyingExplorer() {
  const [activeTab, setActiveTab] = useState('overview');

  // === SOS Lobbying Data (from scraper JSON) ===
  const [lobbyData, setLobbyData] = useState(null);
  const [lobbyLoading, setLobbyLoading] = useState(true);
  const [lobbyError, setLobbyError] = useState(null);
  const [firmSearch, setFirmSearch] = useState('');
  const [selectedFirm, setSelectedFirm] = useState(null);
  const [firmOcpf, setFirmOcpf] = useState(null);
  const [firmOcpfLoading, setFirmOcpfLoading] = useState(false);
  const firmDetailRef = useRef(null);

  const handleFirmClick = useCallback((firm) => {
    const isAlreadySelected = selectedFirm?.name === firm.name;
    if (isAlreadySelected) {
      setSelectedFirm(null);
      setFirmOcpf(null);
      return;
    }
    setSelectedFirm(firm);
    setFirmOcpf(null);
    setFirmOcpfLoading(true);
    searchLobbyingContributions(firm.name, { pageSize: 100 })
      .then(data => {
        const byRecipient = {};
        for (const c of data.items) {
          const key = c.recipient || 'Unknown';
          if (!byRecipient[key]) byRecipient[key] = { recipient: key, total: 0, count: 0, latestDate: '' };
          byRecipient[key].total += c.amount;
          byRecipient[key].count++;
          if (c.date > byRecipient[key].latestDate) byRecipient[key].latestDate = c.date;
        }
        const topRecipients = Object.values(byRecipient).sort((a, b) => b.total - a.total).slice(0, 15);
        setFirmOcpf({
          totalAmount: data.items.reduce((s, c) => s + c.amount, 0),
          totalCount: data.items.length,
          uniqueRecipients: Object.keys(byRecipient).length,
          topRecipients,
          recentItems: data.items.slice(0, 10),
        });
        setFirmOcpfLoading(false);
      })
      .catch(() => {
        setFirmOcpf({ totalAmount: 0, totalCount: 0, uniqueRecipients: 0, topRecipients: [], recentItems: [] });
        setFirmOcpfLoading(false);
      });
    setTimeout(() => firmDetailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  }, [selectedFirm]);

  // === OCPF Cross-Reference State ===
  const [ocpfTerm, setOcpfTerm] = useState('');
  const [ocpfResults, setOcpfResults] = useState(null);
  const [ocpfLoading, setOcpfLoading] = useState(false);
  const [ocpfError, setOcpfError] = useState(null);

  // Load SOS lobbying data
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/ma-lobbying.json?t=${Date.now()}`)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => {
        setLobbyData(data);
        setLobbyLoading(false);
      })
      .catch(err => {
        setLobbyError(err.message);
        setLobbyLoading(false);
      });
  }, []);

  // OCPF search
  const runOcpfSearch = useCallback(() => {
    if (!ocpfTerm.trim()) return;
    setOcpfLoading(true);
    setOcpfError(null);
    searchLobbyingContributions(ocpfTerm.trim(), { pageSize: 50 })
      .then(data => {
        setOcpfResults(data);
        setOcpfLoading(false);
      })
      .catch(err => {
        setOcpfError(err.message || 'Search failed');
        setOcpfLoading(false);
      });
  }, [ocpfTerm]);

  // Derived data
  const top20 = lobbyData?.top20 || [];
  const keyIndividuals = lobbyData?.keyIndividuals || [];

  // FIX: close detail panel on search, and search across name + focus + clients + lobbyists
  const filteredFirms = firmSearch.length >= 2
    ? top20.filter(f => {
        const q = firmSearch.toLowerCase();
        return (
          f.name.toLowerCase().includes(q) ||
          (f.focus || '').toLowerCase().includes(q) ||
          (f.topClients || []).some(c => c.name.toLowerCase().includes(q)) ||
          (f.lobbyists || []).some(l => l.name.toLowerCase().includes(q))
        );
      })
    : top20;

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
        <p>Track lobbying spending, registered firms, and political influence in Massachusetts.</p>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>Data: MA Secretary of State Lobbyist Filings, OCPF &middot; Last updated April 2026</div>
      </div>

      {/* Sub-navigation tabs */}
      <div className="filter-toggle" style={{ marginBottom: 24 }}>
        <button className={`filter-btn ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>
          <TrendingUp size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Overview
        </button>
        <button className={`filter-btn ${activeTab === 'firms' ? 'active' : ''}`} onClick={() => setActiveTab('firms')}>
          <Building2 size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Top Firms
        </button>
        <button className={`filter-btn ${activeTab === 'industry' ? 'active' : ''}`} onClick={() => setActiveTab('industry')}>
          <DollarSign size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} /> By Industry
        </button>
        <button className={`filter-btn ${activeTab === 'ocpf' ? 'active' : ''}`} onClick={() => setActiveTab('ocpf')}>
          <Search size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} /> OCPF Cross-Ref
        </button>
      </div>

      {/* Data source info box */}
      <div style={{ background: 'rgba(50,120,78,0.06)', border: '1px solid rgba(50,120,78,0.15)', borderRadius: 10, padding: '14px 18px', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 24, lineHeight: 1.6 }}>
        <strong style={{ color: 'var(--accent-green)' }}>Data Sources:</strong> Lobbying data comes from the <strong>MA Secretary of the Commonwealth</strong> — lobbyist registrations, client disclosures, and expenditure reports (updated weekly). The OCPF Cross-Ref tab queries a <em>separate</em> database (Office of Campaign and Political Finance) to find where lobbying-connected entities also make campaign contributions. <strong>MA law caps lobbyist gifts to officials at $200/year per recipient.</strong>
      </div>

      {/* Scraper status badge */}
      {lobbyData && lobbyData.warnings?.length > 0 && (
        <div style={{ background: 'rgba(230,126,34,0.08)', border: '1px solid rgba(230,126,34,0.2)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertTriangle size={14} style={{ color: '#E67E22', flexShrink: 0 }} />
          <span>{lobbyData.warnings[0]}</span>
          {lobbyData.fetchedAt && <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Last updated: {formatDate(lobbyData.fetchedAt)}</span>}
        </div>
      )}

      {/* === OVERVIEW TAB === */}
      {activeTab === 'overview' && (
        <div>
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
                  <div className="kpi-label">Registered Firms</div>
                  <div className="kpi-value">{lobbyData?.totalRecords || '25'}+</div>
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

          {/* Top Firms Quick View */}
          <div className="chart-card" style={{ marginBottom: 24 }}>
            <h3>Top 10 Lobbying Firms by Total Expenditure</h3>
            <div className="chart-subtitle">Registered lobbying entities — MA Secretary of State</div>
            {lobbyLoading ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                <div className="spinner" style={{ margin: '0 auto 12px' }} /> Loading lobbying data...
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={top20.slice(0, 10).map(f => ({ ...f, spendM: f.totalExpenditure / 1e6 }))} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
                  <XAxis type="number" stroke={AXIS_COLOR} style={{ fontSize: '12px' }} tickFormatter={v => `$${v}M`} />
                  <YAxis dataKey="name" type="category" stroke={AXIS_COLOR} width={220} style={{ fontSize: '11px' }} />
                  <Tooltip formatter={(v) => [formatMoney(v * 1e6), 'Total Expenditure']} contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13 }} />
                  <Bar dataKey="spendM" fill="#680A1D" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}

      {/* === TOP FIRMS TAB === */}
      {activeTab === 'firms' && (
        <div>
          <div className="chart-card" style={{ marginBottom: 24 }}>
            <h3>Top Lobbying Firms & Entities — MA Secretary of State</h3>
            <div className="chart-subtitle">Registered lobbying entities with total expenditures and gifts to officials. Data from official SOS disclosure filings.</div>

            {/* Search filter — FIX: clears selected firm on type */}
            <div style={{ marginTop: 16, marginBottom: 16, position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', zIndex: 1 }} />
              <input
                type="text"
                className="search-input"
                placeholder="Type to search firm, client, or lobbyist name (e.g. Tesla, Harvard, ML Strategies)..."
                value={firmSearch}
                onChange={e => {
                  setFirmSearch(e.target.value);
                  setSelectedFirm(null);
                  setFirmOcpf(null);
                }}
                style={{ paddingLeft: 38 }}
              />
            </div>

            {/* Selected Firm Detail Panel */}
            {selectedFirm && (
              <div ref={firmDetailRef} className="detail-panel" style={{ marginBottom: 16 }}>
                <button className="close-btn" onClick={() => setSelectedFirm(null)}>Close</button>
                <h3 style={{ color: 'var(--accent-green)', marginBottom: 4 }}>{selectedFirm.name}</h3>
                {selectedFirm.type && <div className="chart-subtitle">{selectedFirm.type}</div>}

                <div className="kpi-row" style={{ marginTop: 16 }}>
                  <div className="kpi-card">
                    <div className="kpi-label">Total Expenditure</div>
                    <div className="kpi-value" style={{ color: 'var(--accent-red)' }}>{formatMoney(selectedFirm.totalExpenditure)}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4 }}>Reported to MA Secretary of State</div>
                  </div>
                  <div className="kpi-card">
                    <div className="kpi-label">Active Clients</div>
                    <div className="kpi-value" style={{ color: 'var(--accent-cyan)' }}>{selectedFirm.clients || '—'}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4 }}>Registered lobbying clients</div>
                  </div>
                  {selectedFirm.yearFounded && (
                    <div className="kpi-card">
                      <div className="kpi-label">Year Founded</div>
                      <div className="kpi-value">{selectedFirm.yearFounded}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4 }}>{new Date().getFullYear() - selectedFirm.yearFounded} years in operation</div>
                    </div>
                  )}
                </div>

                {selectedFirm.focus && (
                  <div style={{ marginTop: 16, padding: '12px 16px', background: 'rgba(50,120,78,0.06)', border: '1px solid rgba(50,120,78,0.15)', borderRadius: 8, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    <strong style={{ color: 'var(--accent-green)' }}>Focus Areas:</strong> {selectedFirm.focus}
                  </div>
                )}

                {/* Top Clients from JSON */}
                {selectedFirm.topClients?.length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <h4 style={{ marginBottom: 8, color: 'var(--text-secondary)' }}>Top Clients by Fee</h4>
                    <div className="data-table-wrapper" style={{ maxHeight: 220, overflow: 'auto' }}>
                      <table className="data-table">
                        <thead>
                          <tr><th>Client</th><th>Fee Paid</th></tr>
                        </thead>
                        <tbody>
                          {selectedFirm.topClients.map((c, i) => (
                            <tr key={i}>
                              <td>{c.name}</td>
                              <td className="money">{formatMoney(c.amount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {(() => {
                  const firmPeople = keyIndividuals.filter(p => p.firm === selectedFirm.name);
                  const localPeople = selectedFirm.lobbyists || [];
                  const people = firmPeople.length > 0 ? firmPeople : localPeople.map(l => ({ name: l.name, role: 'Registered Lobbyist', salary: l.salary }));
                  if (!people.length) return null;
                  return (
                    <div style={{ marginTop: 16 }}>
                      <h4 style={{ marginBottom: 8, color: 'var(--text-secondary)' }}>Registered Lobbyists</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
                        {people.map((person, idx) => (
                          <div key={idx} style={{ background: 'var(--bg-card-hover)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px' }}>
                            <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{person.name}</div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--accent-blue)', marginTop: 2 }}>{person.role || 'Registered Lobbyist'}</div>
                            {person.salary > 0 && (
                              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4 }}>
                                Salary: {formatMoney(person.salary)}
                              </div>
                            )}
                            {person.notableClients && (
                              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4 }}>
                                Notable clients: {person.notableClients}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* OCPF Campaign Contribution Cross-Reference */}
                <div style={{ marginTop: 20 }}>
                  <h4 style={{ marginBottom: 8, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    Campaign Contributions — OCPF Cross-Reference
                    <span style={{ fontSize: '0.72rem', background: 'rgba(230,126,34,0.1)', color: '#E67E22', padding: '2px 8px', borderRadius: 4, fontWeight: 500 }}>Separate Database</span>
                  </h4>
                  {firmOcpfLoading ? (
                    <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>
                      <div className="spinner" style={{ margin: '0 auto 8px' }} /> Searching OCPF records for "{selectedFirm.name}"...
                    </div>
                  ) : firmOcpf && firmOcpf.totalCount > 0 ? (
                    <div>
                      <div className="kpi-row" style={{ marginBottom: 12 }}>
                        <div className="kpi-card" style={{ borderColor: 'rgba(230,126,34,0.25)' }}>
                          <div className="kpi-label">Contributions Found</div>
                          <div className="kpi-value" style={{ color: '#E67E22' }}>{firmOcpf.totalCount}</div>
                        </div>
                        <div className="kpi-card">
                          <div className="kpi-label">Total Donated</div>
                          <div className="kpi-value">{formatMoney(firmOcpf.totalAmount)}</div>
                        </div>
                        <div className="kpi-card">
                          <div className="kpi-label">Unique Recipients</div>
                          <div className="kpi-value" style={{ color: 'var(--accent-blue)' }}>{firmOcpf.uniqueRecipients}</div>
                        </div>
                      </div>
                      {firmOcpf.topRecipients.length > 0 && (
                        <div>
                          <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Top Recipients (Officials & Committees)</div>
                          <div className="data-table-wrapper" style={{ maxHeight: 280, overflow: 'auto' }}>
                            <table className="data-table">
                              <thead>
                                <tr><th>Recipient</th><th>Total</th><th>Count</th><th>Latest</th></tr>
                              </thead>
                              <tbody>
                                {firmOcpf.topRecipients.map((r, i) => (
                                  <tr key={i}>
                                    <td style={{ fontWeight: 500, color: 'var(--accent-blue)' }}>{r.recipient}</td>
                                    <td className="money">{formatMoney(r.total)}</td>
                                    <td style={{ textAlign: 'center' }}>{r.count}</td>
                                    <td style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>{formatDate(r.latestDate)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                      <div style={{ marginTop: 8, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        Source: MA Office of Campaign and Political Finance (OCPF). Searches by employer name — includes contributions from firm employees, not just the firm itself.
                      </div>
                    </div>
                  ) : firmOcpf ? (
                    <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)', background: 'var(--bg-card-hover)', borderRadius: 8, fontSize: '0.85rem' }}>
                      No OCPF campaign contribution records found for "{selectedFirm.name}".
                    </div>
                  ) : null}
                </div>

                <div style={{ marginTop: 16, display: 'flex', gap: 12 }}>
                  <a href="https://www.sec.state.ma.us/lobbyistpublicsearch/Default.aspx"
                    target="_blank" rel="noopener noreferrer"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: 'var(--accent-blue)', color: '#fff', borderRadius: 6, fontSize: '0.82rem', fontWeight: 600, textDecoration: 'none' }}>
                    <ExternalLink size={14} /> View on SOS Site
                  </a>
                  <a href="https://www.ocpf.us/Filers"
                    target="_blank" rel="noopener noreferrer"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: '#E67E22', color: '#fff', borderRadius: 6, fontSize: '0.82rem', fontWeight: 600, textDecoration: 'none' }}>
                    <ExternalLink size={14} /> Search OCPF
                  </a>
                </div>
              </div>
            )}

            {lobbyLoading ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                <div className="spinner" style={{ margin: '0 auto 12px' }} /> Loading lobbying data...
              </div>
            ) : lobbyError ? (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--accent-red)' }}>
                Failed to load lobbying data: {lobbyError}
              </div>
            ) : (
              <div className="data-table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Firm / Entity</th>
                      <th>Focus</th>
                      <th>Clients</th>
                      <th>Total Expenditure</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredFirms.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)' }}>
                          No firms match "{firmSearch}"
                        </td>
                      </tr>
                    ) : (
                      filteredFirms.map((f, i) => (
                        <tr key={i} onClick={() => handleFirmClick(f)}
                          style={{ cursor: 'pointer', background: selectedFirm?.name === f.name ? 'rgba(50,120,78,0.06)' : undefined }}>
                          <td style={{ color: 'var(--text-muted)' }}>{f.rank || i + 1}</td>
                          <td style={{ fontWeight: 600 }}>{f.name} <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: 4 }}>▶</span></td>
                          <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{f.focus || f.type}</td>
                          <td style={{ textAlign: 'center' }}>{f.clients}</td>
                          <td className="money" style={{ color: 'var(--accent-red)' }}>{formatMoney(f.totalExpenditure)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* $200 gift limit callout */}
            <div style={{ marginTop: 16, padding: '12px 16px', background: 'rgba(104,10,29,0.06)', border: '1px solid rgba(104,10,29,0.15)', borderRadius: 8, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              <strong style={{ color: 'var(--accent-red)' }}>Gift Limit:</strong> Massachusetts law (M.G.L. c. 3, §43) limits lobbyist gifts to legislators and other public officials to <strong>$200 per year per recipient</strong>. This includes spending on gifts, meals, travel, and entertainment provided directly to state officials.
            </div>
          </div>

          {/* Key Individuals */}
          {keyIndividuals.length > 0 && (
            <div className="chart-card" style={{ marginTop: 24 }}>
              <h3>Key Lobbyists on Beacon Hill</h3>
              <div className="chart-subtitle">Prominent individual lobbyists and their affiliations</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12, marginTop: 16 }}>
                {keyIndividuals.map((person, idx) => (
                  <div key={idx} style={{ background: 'var(--bg-card-hover)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px' }}>
                    <div style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: 4 }}>{person.name}</div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--accent-blue)', marginBottom: 4 }}>{person.role} — {person.firm}</div>
                    {person.totalSalary > 0 && (
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 4 }}>
                        2025 salary: {formatMoney(person.totalSalary)}
                      </div>
                    )}
                    {person.note && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{person.note}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* === INDUSTRY TAB === */}
      {activeTab === 'industry' && (
        <div>
          <div className="kpi-row" style={{ marginBottom: 24 }}>
            <div className="kpi-card">
              <div className="kpi-label">Total Industry Lobbying</div>
              <div className="kpi-value">${industryData.reduce((s, d) => s + d.amount, 0).toFixed(0)}M</div>
              <div className="kpi-sub">Across {industryData.length} sectors (2025 est.)</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Top Sector</div>
              <div className="kpi-value" style={{ fontSize: '1.3rem' }}>Healthcare</div>
              <div className="kpi-sub">${industryData[0].amount}M — {industryData[0].value}% of total</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Active Lobbyists</div>
              <div className="kpi-value">{industryData.reduce((s, d) => s + d.lobbyists, 0)}+</div>
              <div className="kpi-sub">Registered across all sectors</div>
            </div>
          </div>

          <div className="chart-card" style={{ marginBottom: 24 }}>
            <h3>Lobbying Spending by Industry Sector</h3>
            <div className="chart-subtitle">Estimated annual expenditures in millions — MA Secretary of State disclosures (2025)</div>
            <ResponsiveContainer width="100%" height={420}>
              <BarChart data={industryData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
                <XAxis type="number" stroke={AXIS_COLOR} style={{ fontSize: '12px' }} tickFormatter={v => `$${v}M`} />
                <YAxis dataKey="name" type="category" stroke={AXIS_COLOR} width={130} style={{ fontSize: '11px' }} />
                <Tooltip formatter={(v, name) => name === 'amount' ? [`$${v}M`, 'Spending'] : [v, name]}
                  contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13 }} />
                <Bar dataKey="amount" radius={[0, 6, 6, 0]}>
                  {industryData.map((entry, i) => (
                    <Cell key={i} fill={INDUSTRY_COLORS[i % INDUSTRY_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="chart-card" style={{ marginBottom: 24 }}>
            <h3>Industry Deep Dive — What They Lobby For</h3>
            <div className="chart-subtitle">Key legislative issues and top organizations by sector</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
              {industryData.map((sector, idx) => (
                <div key={idx} style={{ background: 'var(--bg-card-hover)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px 18px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontWeight: 600, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 12, height: 12, borderRadius: 3, background: INDUSTRY_COLORS[idx % INDUSTRY_COLORS.length], display: 'inline-block' }} />
                      {sector.name}
                    </span>
                    <span style={{ fontWeight: 700, color: 'var(--accent-green)', fontSize: '0.95rem' }}>${sector.amount}M <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: '0.8rem' }}>({sector.value}%)</span></span>
                  </div>
                  <div style={{ display: 'flex', gap: 24, fontSize: '0.85rem', marginBottom: 8 }}>
                    <span><span style={{ color: 'var(--text-muted)' }}>Active lobbyists:</span> <strong>{sector.lobbyists}</strong></span>
                  </div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: 6 }}>
                    <strong style={{ color: 'var(--accent-blue)' }}>Key issues:</strong> {sector.topIssues}
                  </div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                    <strong style={{ color: 'var(--text-muted)' }}>Top organizations:</strong> {sector.topOrgs}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="chart-card" style={{ marginBottom: 24 }}>
            <h3>Market Share of Lobbying Spend</h3>
            <ResponsiveContainer width="100%" height={400}>
              <PieChart>
                <Pie data={industryData} cx="50%" cy="50%" labelLine={false}
                  label={({ name, value }) => `${name} ${value}%`}
                  outerRadius={140} dataKey="value">
                  {industryData.map((entry, i) => (
                    <Cell key={i} fill={INDUSTRY_COLORS[i % INDUSTRY_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v, name, props) => [`$${props.payload.amount}M (${v}%)`, props.payload.name]}
                  contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* === OCPF CROSS-REFERENCE TAB === */}
      {activeTab === 'ocpf' && (
        <div>
          <div style={{ background: 'rgba(230,126,34,0.06)', border: '1px solid rgba(230,126,34,0.15)', borderRadius: 10, padding: '14px 18px', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 20, lineHeight: 1.6 }}>
            <strong style={{ color: '#E67E22' }}>Different Data Source:</strong> This tab queries <strong>OCPF</strong> (Office of Campaign and Political Finance) — a <em>separate</em> database from the Secretary of State lobbying registry. OCPF tracks campaign contributions to candidates and committees. Use this to cross-reference whether lobbying-connected names or employers also make political contributions. Results include <em>all</em> contributors matching the search, not just registered lobbyists.
          </div>

          <div className="chart-card highlighted" style={{ marginBottom: 24 }}>
            <h3 style={{ color: 'var(--accent-blue)' }}>
              <Search size={18} style={{ verticalAlign: 'middle', marginRight: 8 }} />
              OCPF Campaign Contribution Search
            </h3>
            <div className="chart-subtitle">
              Search by contributor name or employer across OCPF records (2018–present). Matches both name and employer fields.
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', zIndex: 1 }} />
                <input type="text" className="search-input"
                  placeholder="Search by name or employer (e.g. Eversource, National Grid, Partners Healthcare)..."
                  value={ocpfTerm}
                  onChange={e => setOcpfTerm(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && runOcpfSearch()}
                  style={{ paddingLeft: 38 }}
                />
              </div>
              <button className="btn-primary" onClick={runOcpfSearch}
                style={{ padding: '12px 24px', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                <Search size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Search OCPF
              </button>
            </div>
            <div style={{ marginTop: 10, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Try: "Eversource", "Partners Healthcare", "National Grid", "Blue Cross", "Amazon", "Comcast"
            </div>
          </div>

          {ocpfLoading && (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
              <div className="spinner" style={{ margin: '0 auto 12px' }} /> Searching OCPF records across multiple years... This may take a moment.
            </div>
          )}

          {ocpfError && (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--accent-red)', background: 'rgba(220,50,50,0.06)', borderRadius: 10, border: '1px solid rgba(220,50,50,0.15)' }}>
              Search error: {ocpfError}. The OCPF API may be temporarily unavailable.
            </div>
          )}

          {ocpfResults && !ocpfLoading && (
            <div>
              <div className="kpi-row" style={{ marginBottom: 20 }}>
                <div className="kpi-card" style={{ borderColor: 'rgba(20,85,143,0.3)' }}>
                  <div className="kpi-label">Contributions Found</div>
                  <div className="kpi-value" style={{ color: 'var(--accent-blue)' }}>{ocpfResults.items.length}</div>
                </div>
                <div className="kpi-card">
                  <div className="kpi-label">Total Amount</div>
                  <div className="kpi-value">{formatMoney(ocpfResults.items.reduce((s, c) => s + c.amount, 0))}</div>
                </div>
                <div className="kpi-card">
                  <div className="kpi-label">Unique Recipients</div>
                  <div className="kpi-value">{new Set(ocpfResults.items.map(c => c.recipient)).size}</div>
                </div>
                <div className="kpi-card">
                  <div className="kpi-label">Unique Donors</div>
                  <div className="kpi-value">{new Set(ocpfResults.items.map(c => c.contributor)).size}</div>
                </div>
              </div>

              {ocpfResults.items.length > 0 ? (
                <div className="data-table-wrapper">
                  <table className="data-table">
                    <thead>
                      <tr><th>Date</th><th>Contributor</th><th>Amount</th><th>Recipient</th><th>Employer</th><th>City</th></tr>
                    </thead>
                    <tbody>
                      {ocpfResults.items.map((c, i) => (
                        <tr key={i}>
                          <td style={{ whiteSpace: 'nowrap', fontSize: '0.8rem' }}>{formatDate(c.date)}</td>
                          <td>{c.contributor}</td>
                          <td className="money">{formatMoney(c.amount)}</td>
                          <td style={{ color: 'var(--accent-blue)' }}>{c.recipient}</td>
                          <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{c.employer}</td>
                          <td style={{ fontSize: '0.8rem' }}>{c.city}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)', background: 'var(--bg-card-hover)', borderRadius: 8 }}>
                  No OCPF contribution records found matching "{ocpfTerm}". Try a different name or keyword.
                </div>
              )}
            </div>
          )}

          {!ocpfResults && !ocpfLoading && (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', background: 'var(--bg-card-hover)', borderRadius: 10 }}>
              <Search size={32} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.3 }} />
              Search OCPF campaign finance records by contributor name or employer. This is a separate database from the SOS lobbying registry above.
            </div>
          )}
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
    </div>
  );
}
