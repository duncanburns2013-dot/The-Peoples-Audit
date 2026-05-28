import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { TrendingUp, Users, DollarSign, Building2, Search, Network, ExternalLink, ArrowRight, AlertTriangle, FileText, Calendar } from 'lucide-react';
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

function FirmDetailPanel({ firm, year }) {
  const hasMoney = (firm.totalSalariesReceived || 0) > 0 || (firm.totalSalariesPaid || 0) > 0;
  return (
    <div style={{ fontSize: '0.85rem', lineHeight: 1.55 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10, marginBottom: 14 }}>
        {firm.address && (
          <div style={{ background: 'var(--bg-card-hover)', borderRadius: 6, padding: '8px 12px' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Address</div>
            <div style={{ fontSize: '0.82rem' }}>{firm.address}</div>
          </div>
        )}
        {firm.registrationDate && (
          <div style={{ background: 'var(--bg-card-hover)', borderRadius: 6, padding: '8px 12px' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Initial Registration</div>
            <div style={{ fontSize: '0.82rem' }}>{firm.registrationDate}</div>
          </div>
        )}
        <div style={{ background: 'var(--bg-card-hover)', borderRadius: 6, padding: '8px 12px' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Counts</div>
          <div style={{ fontSize: '0.82rem' }}>
            <strong>{firm.lobbyistCount}</strong> lobbyist{firm.lobbyistCount === 1 ? '' : 's'},{' '}
            <strong>{firm.clientCount}</strong> client{firm.clientCount === 1 ? '' : 's'}
          </div>
        </div>
        {hasMoney && (
          <>
            <div style={{ background: 'var(--bg-card-hover)', borderRadius: 6, padding: '8px 12px' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Salaries Received from Clients</div>
              <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--accent-green)' }}>${(firm.totalSalariesReceived || 0).toLocaleString()}</div>
            </div>
            <div style={{ background: 'var(--bg-card-hover)', borderRadius: 6, padding: '8px 12px' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Salaries Paid to Lobbyists</div>
              <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--accent-red)' }}>${(firm.totalSalariesPaid || 0).toLocaleString()}</div>
            </div>
          </>
        )}
      </div>

      {!hasMoney && (
        <div style={{ marginBottom: 14, padding: '8px 12px', fontSize: '0.78rem', background: 'rgba(230,126,34,0.06)', border: '1px solid rgba(230,126,34,0.18)', borderRadius: 6, color: 'var(--text-secondary)' }}>
          <strong style={{ color: '#E67E22' }}>No fee amounts reported yet for {year}.</strong>{' '}
          MA SOS disclosure reports are filed twice a year (mid-year and end-of-year). The
          registry shows everyone registered, but fee/expenditure data is empty until the
          first disclosure report of the year is filed. Historical years carry the real
          dollar amounts.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Lobbyists */}
        <div>
          <div style={{ fontWeight: 600, color: 'var(--accent-blue)', marginBottom: 6, fontSize: '0.85rem' }}>
            Registered Lobbyists ({firm.lobbyistCount})
          </div>
          {firm.lobbyists.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>None on file.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {firm.lobbyists.map((l, idx) => (
                <div key={idx} style={{ background: 'var(--bg-card-hover)', padding: '6px 10px', borderRadius: 5, fontSize: '0.8rem', display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <div>
                    {l.sysvalue ? (
                      <a href={`https://www.sec.state.ma.us/LobbyistPublicSearch/Summary.aspx?sysvalue=${encodeURIComponent(l.sysvalue)}`}
                        target="_blank" rel="noopener noreferrer"
                        style={{ color: 'var(--accent-blue)' }}>{l.name}</a>
                    ) : <span>{l.name}</span>}
                    {l.employedDate && (
                      <span style={{ marginLeft: 6, fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        from {l.employedDate}
                      </span>
                    )}
                  </div>
                  {l.amount > 0 && (
                    <span style={{ color: 'var(--accent-red)', fontWeight: 500, whiteSpace: 'nowrap' }}>
                      ${l.amount.toLocaleString()}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Clients */}
        <div>
          <div style={{ fontWeight: 600, color: 'var(--accent-green)', marginBottom: 6, fontSize: '0.85rem' }}>
            Clients ({firm.clientCount})
          </div>
          {firm.clients.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>None on file.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 380, overflow: 'auto' }}>
              {firm.clients.map((c, idx) => (
                <div key={idx} style={{ background: 'var(--bg-card-hover)', padding: '6px 10px', borderRadius: 5, fontSize: '0.8rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <div>
                      {c.sysvalue ? (
                        <a href={`https://www.sec.state.ma.us/LobbyistPublicSearch/Summary.aspx?sysvalue=${encodeURIComponent(c.sysvalue)}`}
                          target="_blank" rel="noopener noreferrer"
                          style={{ color: 'var(--accent-green)' }}>{c.name}</a>
                      ) : <span>{c.name}</span>}
                      {c.employedDate && (
                        <span style={{ marginLeft: 6, fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          from {c.employedDate}
                        </span>
                      )}
                    </div>
                    {c.amount > 0 && (
                      <span style={{ color: 'var(--accent-green)', fontWeight: 500, whiteSpace: 'nowrap' }}>
                        ${c.amount.toLocaleString()}
                      </span>
                    )}
                  </div>
                  {c.purpose && (
                    <div style={{ marginTop: 3, fontSize: '0.72rem', color: 'var(--text-muted)', fontStyle: 'italic', lineHeight: 1.4 }}>
                      "{c.purpose.length > 220 ? c.purpose.slice(0, 220) + '…' : c.purpose}"
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ marginTop: 10, fontSize: '0.72rem', color: 'var(--text-muted)' }}>
        Source: <a href={firm.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-blue)' }}>
          SOS Summary.aspx for {firm.name} ({year}) ↗
        </a>
      </div>
    </div>
  );
}

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

  // === SOS Registrant Index (2016-2026, hand-pulled View Source) ===
  // The registry tab loads a small (~3KB) index eagerly, then fetches the
  // ~830KB per-year detail file only when the user picks a year.
  const [regIndex, setRegIndex] = useState(null);
  const [regIndexError, setRegIndexError] = useState(null);
  const [regYear, setRegYear] = useState(null);
  const [regDetail, setRegDetail] = useState(null);
  const [regDetailLoading, setRegDetailLoading] = useState(false);
  const [regDetailError, setRegDetailError] = useState(null);
  const [regDetailCache, setRegDetailCache] = useState({}); // year -> detail
  const [regSearch, setRegSearch] = useState('');
  const [regTypeFilter, setRegTypeFilter] = useState('All'); // All | Lobbyist | Client | Lobbyist Entity
  const [regShowCount, setRegShowCount] = useState(200);

  // Per-firm Summary.aspx detail (lobbyist roster + client list + purpose)
  // produced by scripts/parse-sos-firm-details.py from Tampermonkey scrapes.
  // Lazy-loaded per year; row expansion is one-firm-at-a-time.
  const [firmDetailsByYear, setFirmDetailsByYear] = useState({});
  const [firmDetailsState, setFirmDetailsState] = useState({}); // year -> 'idle'|'loading'|'loaded'|'unavailable'
  const [expandedFirmSys, setExpandedFirmSys] = useState(null);

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

  // Load registrant index eagerly (small file, drives the year picker UI).
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/ma-lobbying-registrants-index.json`)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => {
        setRegIndex(data);
        const years = Object.keys(data.years || {}).sort();
        if (years.length) setRegYear(years[years.length - 1]); // default to latest
      })
      .catch(err => setRegIndexError(err.message));
  }, []);

  // Lazy-load the per-year detail file when the user picks a year. Cache so
  // toggling back to a prior year doesn't re-fetch.
  useEffect(() => {
    if (!regYear || !regIndex?.years?.[regYear]) return;
    if (regDetailCache[regYear]) {
      setRegDetail(regDetailCache[regYear]);
      setRegDetailError(null);
      return;
    }
    setRegDetailLoading(true);
    setRegDetailError(null);
    const path = regIndex.years[regYear].detailFile; // e.g. "data/ma-lobbying-registrants-2026.json"
    fetch(`${import.meta.env.BASE_URL}${path}`)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => {
        setRegDetail(data);
        setRegDetailCache(prev => ({ ...prev, [regYear]: data }));
        setRegDetailLoading(false);
      })
      .catch(err => {
        setRegDetailError(err.message);
        setRegDetailLoading(false);
      });
  }, [regYear, regIndex, regDetailCache]);

  // Reset visible-row count whenever the year, search, or type filter changes
  // so the user doesn't see stale "Showing 600 of 3,243" on a fresh query.
  useEffect(() => { setRegShowCount(200); }, [regYear, regSearch, regTypeFilter]);

  // Close any expanded firm-detail row when the user switches year/filter.
  useEffect(() => { setExpandedFirmSys(null); }, [regYear, regSearch, regTypeFilter]);

  // Lazy-load firm-detail JSON for a year the first time a Lobbyist Entity
  // row is clicked. Files (ma-lobbying-firm-details-{year}.json) may not
  // exist for every year — only those scraped via the Tampermonkey userscript.
  const ensureFirmDetailLoaded = useCallback((year) => {
    if (!year) return;
    const state = firmDetailsState[year];
    if (state === 'loading' || state === 'loaded' || state === 'unavailable') return;
    setFirmDetailsState(prev => ({ ...prev, [year]: 'loading' }));
    fetch(`${import.meta.env.BASE_URL}data/ma-lobbying-firm-details-${year}.json`)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => {
        const bySys = {};
        for (const f of (data.firms || [])) {
          if (f.sysvalue) bySys[f.sysvalue] = f;
        }
        setFirmDetailsByYear(prev => ({ ...prev, [year]: { ...data, bySys } }));
        setFirmDetailsState(prev => ({ ...prev, [year]: 'loaded' }));
      })
      .catch(() => {
        setFirmDetailsState(prev => ({ ...prev, [year]: 'unavailable' }));
      });
  }, [firmDetailsState]);

  const toggleFirmRow = useCallback((row) => {
    if (row.accountType !== 'Lobbyist Entity') return;
    if (expandedFirmSys === row.sysvalue) {
      setExpandedFirmSys(null);
      return;
    }
    setExpandedFirmSys(row.sysvalue);
    ensureFirmDetailLoaded(regYear);
  }, [expandedFirmSys, regYear, ensureFirmDetailLoaded]);

  // Apply search + type filter to the loaded per-year registrants list.
  const filteredRegistrants = useMemo(() => {
    const rows = regDetail?.registrants || [];
    const q = regSearch.trim().toLowerCase();
    return rows.filter(r =>
      (regTypeFilter === 'All' || r.accountType === regTypeFilter) &&
      (!q || r.name.toLowerCase().includes(q))
    );
  }, [regDetail, regSearch, regTypeFilter]);

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
  const stats = lobbyData?.stats || {};

  // Build the spending-over-time chart from real data when available,
  // falling back to the hardcoded historical estimates for earlier years
  // (the SOS site doesn't expose historical totals; 2015–2024 here are
  // best-available estimates, 2025/2026 come from the live snapshot).
  const spendingChart = useMemo(() => {
    const arr = spendingByYear.slice(0, -2).map(r => ({ ...r, source: 'estimate' })); // 2015–2023
    // 2024 stays as an estimate unless the snapshot includes it
    arr.push({ year: 2024, spending: 93.2, source: 'estimate' });
    if (stats.totalRevenue2025) {
      arr.push({ year: 2025, spending: +(stats.totalRevenue2025 / 1e6).toFixed(1), source: 'snapshot' });
    } else {
      arr.push({ year: 2025, spending: 96.1, source: 'estimate' });
    }
    if (stats.totalRevenue2026 && stats.totalRevenue2026 > 1e6) {
      arr.push({ year: 2026, spending: +(stats.totalRevenue2026 / 1e6).toFixed(1), source: 'snapshot' });
    }
    return arr;
  }, [stats]);

  const latestSnapshotYear = spendingChart.filter(r => r.source === 'snapshot').pop()?.year || 2025;
  const latestSpendingM = spendingChart.find(r => r.year === latestSnapshotYear)?.spending || 96.1;
  const prevYearSpendingM = spendingChart.find(r => r.year === latestSnapshotYear - 1)?.spending || 93.2;
  const yoyGrowth = ((latestSpendingM - prevYearSpendingM) / prevYearSpendingM * 100).toFixed(1);

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

  // Stale-data check — if the cached snapshot is more than 21 days old,
  // surface a warning. The MA SOS Lobbyist Public Search blocks automation
  // (see scripts/fetch-ma-lobbying.mjs), so refreshes are manual.
  const dataAgeDays = useMemo(() => {
    if (!lobbyData?.fetchedAt) return null;
    try {
      const fa = new Date(lobbyData.fetchedAt);
      return Math.floor((Date.now() - fa.getTime()) / (24 * 3600 * 1000));
    } catch { return null; }
  }, [lobbyData]);

  return (
    <div className="section">
      <div className="section-header">
        <span className="section-tag red" style={{ background: 'var(--accent-green-glow)', color: 'var(--accent-green)' }}>Influence Tracker</span>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Network size={28} style={{ color: 'var(--accent-green)' }} /> Lobbying Explorer
        </h2>
        <p>Track lobbying spending, registered firms, and political influence in Massachusetts.</p>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
          Data: MA Secretary of State Lobbyist Filings (snapshot), OCPF (live API)
          {lobbyData?.fetchedAt && <> &middot; Snapshot taken {formatDate(lobbyData.fetchedAt)}</>}
        </div>
      </div>

      {/* Sub-navigation tabs */}
      <div className="filter-toggle" style={{ marginBottom: 24 }}>
        <button className={`filter-btn ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>
          <TrendingUp size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Overview
        </button>
        <button className={`filter-btn ${activeTab === 'firms' ? 'active' : ''}`} onClick={() => setActiveTab('firms')}>
          <Building2 size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Top Firms
        </button>
        <button className={`filter-btn ${activeTab === 'registry' ? 'active' : ''}`} onClick={() => setActiveTab('registry')}>
          <FileText size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} /> SOS Registry
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

      {/* Data freshness + provenance banner. Hidden on the SOS Registry tab —
          that tab has its own (fresh) provenance line because the registrant
          index is a separate, more recently refreshed dataset than the
          Top Firms / Industry snapshot. Showing the 42-day-old banner there
          would be misleading. */}
      {lobbyData && activeTab !== 'registry' && (
        <div style={{
          background: dataAgeDays > 21 ? 'rgba(230,126,34,0.08)' : 'rgba(50,120,78,0.06)',
          border: `1px solid ${dataAgeDays > 21 ? 'rgba(230,126,34,0.25)' : 'rgba(50,120,78,0.18)'}`,
          borderRadius: 8, padding: '12px 16px', marginBottom: 16,
          fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6,
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <AlertTriangle size={16} style={{ color: dataAgeDays > 21 ? '#E67E22' : 'var(--accent-green)', flexShrink: 0, marginTop: 2 }} />
            <div style={{ flex: 1 }}>
              <div>
                <strong style={{ color: dataAgeDays > 21 ? '#E67E22' : 'var(--accent-green)' }}>
                  Top Firms / Industry snapshot from {formatDate(lobbyData.fetchedAt)}
                </strong>
                {dataAgeDays != null && (
                  <span> &middot; {dataAgeDays} {dataAgeDays === 1 ? 'day' : 'days'} old</span>
                )}
                . The MA Secretary of State Lobbyist Public Search blocks
                automated access from cloud servers, so this snapshot is
                refreshed manually rather than on a schedule. The{' '}
                <strong style={{ color: 'var(--accent-blue)' }}>SOS Registry tab</strong>{' '}
                ships from a separate, more recently refreshed dataset (see its own
                provenance line).{' '}
                <a href="https://www.sec.state.ma.us/LobbyistPublicSearch/Default.aspx"
                  target="_blank" rel="noopener noreferrer"
                  style={{ color: 'var(--accent-blue)' }}>
                  Live SOS search ↗
                </a>
              </div>
              {lobbyData.warnings?.[0] && (
                <div style={{ marginTop: 6, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {lobbyData.warnings[0]}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* === OVERVIEW TAB === */}
      {activeTab === 'overview' && (
        <div>
          <div className="kpi-row" style={{ marginBottom: 32 }}>
            <div className="kpi-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div className="kpi-label">Unique Registered Lobbyists</div>
                  <div className="kpi-value">{stats.uniqueLobbyists?.toLocaleString() || '—'}</div>
                  <div className="kpi-sub">From snapshot ({latestSnapshotYear})</div>
                </div>
                <Users size={28} style={{ color: 'var(--accent-green)', opacity: 0.3 }} />
              </div>
            </div>
            <div className="kpi-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div className="kpi-label">Total Lobbying Revenue ({latestSnapshotYear})</div>
                  <div className="kpi-value">{stats.totalRevenue2025 ? formatMoney(stats.totalRevenue2025) : `$${latestSpendingM}M`}</div>
                  <div className="kpi-sub">Salaries received by lobbying firms from clients</div>
                </div>
                <DollarSign size={28} style={{ color: 'var(--accent-green)', opacity: 0.3 }} />
              </div>
            </div>
            <div className="kpi-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div className="kpi-label">Registered Firms / Entities</div>
                  <div className="kpi-value">{stats.entities2025?.toLocaleString() || top20.length || '—'}</div>
                  <div className="kpi-sub">Disclosure filings in {latestSnapshotYear}</div>
                </div>
                <Building2 size={28} style={{ color: 'var(--accent-green)', opacity: 0.3 }} />
              </div>
            </div>
            <div className="kpi-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div className="kpi-label">Unique Clients Lobbying MA</div>
                  <div className="kpi-value">{stats.uniqueClients?.toLocaleString() || '—'}</div>
                  <div className="kpi-sub">Entities paying for representation</div>
                </div>
                <TrendingUp size={28} style={{ color: 'var(--accent-green)', opacity: 0.3 }} />
              </div>
            </div>
          </div>

          {/* Spending Over Time */}
          <div className="chart-card" style={{ marginBottom: 24 }}>
            <h3>Lobbying Revenue Over Time (2015–{latestSnapshotYear})</h3>
            <div className="chart-subtitle">
              Annual lobbying-firm revenue in millions. {spendingChart.find(r => r.source === 'snapshot') ? (
                <span>{latestSnapshotYear} value is from the live MA SOS snapshot; earlier years are best-available historical estimates.</span>
              ) : 'Historical estimates — live snapshot value not yet available.'}
            </div>
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={spendingChart}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
                <XAxis dataKey="year" stroke={AXIS_COLOR} style={{ fontSize: '12px' }} />
                <YAxis stroke={AXIS_COLOR} style={{ fontSize: '12px' }} tickFormatter={v => `$${v}M`} />
                <Tooltip formatter={(v, _, props) => [`$${v}M${props.payload.source === 'estimate' ? ' (est.)' : ''}`, 'Spending']} contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13 }} />
                <Line type="monotone" dataKey="spending" stroke="#32784E" strokeWidth={3}
                  dot={(props) => {
                    const isSnap = props.payload.source === 'snapshot';
                    return <circle cx={props.cx} cy={props.cy} r={isSnap ? 6 : 4} fill={isSnap ? '#680A1D' : '#32784E'} stroke={isSnap ? '#fff' : 'none'} strokeWidth={isSnap ? 2 : 0} />;
                  }}
                  activeDot={{ r: 7 }} />
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
                    <div style={{ padding: 16, color: 'var(--text-secondary)', background: 'var(--bg-card-hover)', borderRadius: 8, fontSize: '0.85rem', lineHeight: 1.6 }}>
                      <div style={{ fontWeight: 600, marginBottom: 6 }}>
                        No OCPF contributions matched the literal firm name &ldquo;{selectedFirm.name}&rdquo;.
                      </div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                        OCPF&rsquo;s contributor data is keyed on individual donors&rsquo; self-reported{' '}
                        <code style={{ background: 'var(--bg-card)', padding: '1px 5px', borderRadius: 3 }}>employer</code>{' '}
                        field. Lobbyists at this firm often write the employer differently — e.g. as a
                        shorter name, a parent entity, or &ldquo;Self-employed.&rdquo; To find
                        contributions from individuals at this firm, try the{' '}
                        <strong>OCPF Cross-Ref</strong> tab and search by a partial firm name or by an
                        individual lobbyist&rsquo;s name from the list above.
                      </div>
                      <a
                        href={`https://www.ocpf.us/Filers/Index?q=${encodeURIComponent(selectedFirm.name)}`}
                        target="_blank" rel="noopener noreferrer"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 8, color: 'var(--accent-blue)', fontSize: '0.82rem' }}
                      >
                        Or search OCPF directly <ExternalLink size={11} />
                      </a>
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

      {/* === SOS REGISTRY TAB === */}
      {activeTab === 'registry' && (
        <div>
          <div className="chart-card" style={{ marginBottom: 24 }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <FileText size={20} style={{ color: 'var(--accent-blue)' }} />
              MA Secretary of State — Lobbyist Public Search Registry
            </h3>
            <div className="chart-subtitle">
              Every registered lobbyist, client, and lobbyist entity on file with the MA SOS, year by year (2016&ndash;2026).
              Each row links to its detail page on the official SOS site.
            </div>

            {/* Provenance — MA SOS blocks cloud-server scraping, so registry data is pulled by hand */}
            <div style={{
              marginTop: 12, padding: '10px 14px',
              background: 'rgba(20,85,143,0.05)',
              border: '1px solid rgba(20,85,143,0.15)',
              borderRadius: 8,
              fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.55,
            }}>
              <strong style={{ color: 'var(--accent-blue)' }}>Source:</strong>{' '}
              <a href="https://www.sec.state.ma.us/LobbyistPublicSearch/Default.aspx"
                target="_blank" rel="noopener noreferrer"
                style={{ color: 'var(--accent-blue)' }}>
                sec.state.ma.us/LobbyistPublicSearch
              </a>
              {regIndex?.fetchedAt && <> &middot; pulled {formatDate(regIndex.fetchedAt)}</>}
              .  The MA SOS blocks automated traffic from cloud servers, so each year was
              dumped by hand via browser View Source and parsed offline. Each registrant
              row links to its own <code style={{ background: 'var(--bg-card)', padding: '0 4px', borderRadius: 3 }}>Summary.aspx</code> page
              on the SOS site for the full filing detail.
            </div>

            {/* Year selector */}
            {regIndexError ? (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--accent-red)' }}>
                Failed to load registrant index: {regIndexError}
              </div>
            ) : !regIndex ? (
              <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)' }}>
                <div className="spinner" style={{ margin: '0 auto 10px' }} /> Loading registrant index...
              </div>
            ) : (
              <>
                {/* Year totals strip */}
                <div style={{ marginTop: 18, display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                  <Calendar size={14} style={{ color: 'var(--text-muted)' }} />
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginRight: 4 }}>Year:</span>
                  {Object.keys(regIndex.years).sort().map(y => {
                    const active = y === regYear;
                    return (
                      <button
                        key={y}
                        onClick={() => setRegYear(y)}
                        className="filter-btn"
                        style={{
                          padding: '6px 12px',
                          fontSize: '0.82rem',
                          background: active ? 'var(--accent-blue)' : 'var(--bg-card-hover)',
                          color: active ? '#fff' : 'var(--text-secondary)',
                          border: `1px solid ${active ? 'var(--accent-blue)' : 'var(--border)'}`,
                          borderRadius: 6,
                          cursor: 'pointer',
                          fontWeight: active ? 600 : 500,
                        }}
                      >
                        {y}
                        <span style={{
                          marginLeft: 6, fontSize: '0.7rem',
                          color: active ? 'rgba(255,255,255,0.75)' : 'var(--text-muted)',
                        }}>
                          {regIndex.years[y].count.toLocaleString()}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Year KPI strip */}
                {regYear && regIndex.years[regYear] && (
                  <div className="kpi-row" style={{ marginTop: 18 }}>
                    <div className="kpi-card">
                      <div className="kpi-label">Total Registrants</div>
                      <div className="kpi-value">{regIndex.years[regYear].count.toLocaleString()}</div>
                      <div className="kpi-sub">Registry year {regYear}</div>
                    </div>
                    <div className="kpi-card">
                      <div className="kpi-label">Lobbyists</div>
                      <div className="kpi-value" style={{ color: 'var(--accent-blue)' }}>
                        {(regIndex.years[regYear].byAccountType?.Lobbyist || 0).toLocaleString()}
                      </div>
                      <div className="kpi-sub">Individual filings</div>
                    </div>
                    <div className="kpi-card">
                      <div className="kpi-label">Clients</div>
                      <div className="kpi-value" style={{ color: 'var(--accent-green)' }}>
                        {(regIndex.years[regYear].byAccountType?.Client || 0).toLocaleString()}
                      </div>
                      <div className="kpi-sub">Paying for representation</div>
                    </div>
                    <div className="kpi-card">
                      <div className="kpi-label">Lobbyist Entities</div>
                      <div className="kpi-value" style={{ color: 'var(--accent-red)' }}>
                        {(regIndex.years[regYear].byAccountType?.['Lobbyist Entity'] || 0).toLocaleString()}
                      </div>
                      <div className="kpi-sub">Firms / organizations</div>
                    </div>
                  </div>
                )}

                {/* Filter chips + search */}
                <div style={{ marginTop: 18, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  {['All', 'Lobbyist', 'Client', 'Lobbyist Entity'].map(t => {
                    const active = t === regTypeFilter;
                    const count = t === 'All'
                      ? regDetail?.count
                      : regDetail?.byAccountType?.[t];
                    return (
                      <button
                        key={t}
                        onClick={() => setRegTypeFilter(t)}
                        className="filter-btn"
                        style={{
                          padding: '6px 12px',
                          fontSize: '0.82rem',
                          background: active ? 'var(--accent-green)' : 'var(--bg-card-hover)',
                          color: active ? '#fff' : 'var(--text-secondary)',
                          border: `1px solid ${active ? 'var(--accent-green)' : 'var(--border)'}`,
                          borderRadius: 6,
                          cursor: 'pointer',
                          fontWeight: active ? 600 : 500,
                        }}
                      >
                        {t}
                        {count != null && (
                          <span style={{
                            marginLeft: 6, fontSize: '0.7rem',
                            color: active ? 'rgba(255,255,255,0.75)' : 'var(--text-muted)',
                          }}>
                            {count.toLocaleString()}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                <div style={{ marginTop: 12, position: 'relative' }}>
                  <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', zIndex: 1 }} />
                  <input
                    type="text"
                    className="search-input"
                    placeholder={`Search ${regYear || 'year'} registrants by name (e.g. Tempus, BCBS, Eversource)...`}
                    value={regSearch}
                    onChange={e => setRegSearch(e.target.value)}
                    style={{ paddingLeft: 38 }}
                  />
                </div>

                {/* Discoverability hint for the click-to-expand feature */}
                <div style={{
                  marginTop: 10,
                  padding: '8px 12px',
                  background: 'rgba(104,10,29,0.05)',
                  border: '1px solid rgba(104,10,29,0.15)',
                  borderRadius: 6,
                  fontSize: '0.78rem',
                  color: 'var(--text-secondary)',
                  lineHeight: 1.5,
                }}>
                  <strong style={{ color: 'var(--accent-red)' }}>Tip:</strong>{' '}
                  Click any row with the <span style={{
                    display: 'inline-block', padding: '1px 6px',
                    fontSize: '0.7rem', fontWeight: 600, borderRadius: 3,
                    background: 'rgba(104,10,29,0.1)', color: 'var(--accent-red)',
                  }}>Lobbyist Entity</span> badge to expand it inline with the
                  firm's full lobbyist roster, client list, and per-client
                  purpose-of-engagement text from the SOS filing.
                </div>

                {/* Results table */}
                {regDetailError ? (
                  <div style={{ marginTop: 18, padding: 20, textAlign: 'center', color: 'var(--accent-red)' }}>
                    Failed to load {regYear} detail: {regDetailError}
                  </div>
                ) : regDetailLoading ? (
                  <div style={{ marginTop: 18, padding: 30, textAlign: 'center', color: 'var(--text-muted)' }}>
                    <div className="spinner" style={{ margin: '0 auto 10px' }} /> Loading {regYear} registrants...
                  </div>
                ) : regDetail ? (
                  <div style={{ marginTop: 18 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                      <span>
                        Showing <strong style={{ color: 'var(--text-primary)' }}>
                          {Math.min(regShowCount, filteredRegistrants.length).toLocaleString()}
                        </strong> of <strong style={{ color: 'var(--text-primary)' }}>
                          {filteredRegistrants.length.toLocaleString()}
                        </strong> {filteredRegistrants.length === 1 ? 'match' : 'matches'} in {regYear}
                      </span>
                      {regSearch && (
                        <button
                          onClick={() => setRegSearch('')}
                          style={{ background: 'none', border: 'none', color: 'var(--accent-blue)', fontSize: '0.78rem', cursor: 'pointer' }}
                        >
                          Clear search
                        </button>
                      )}
                    </div>

                    {filteredRegistrants.length === 0 ? (
                      <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', background: 'var(--bg-card-hover)', borderRadius: 8 }}>
                        No registrants match{regSearch && <> &ldquo;{regSearch}&rdquo;</>} in {regYear}.
                      </div>
                    ) : (
                      <>
                        <div className="data-table-wrapper">
                          <table className="data-table">
                            <thead>
                              <tr>
                                <th style={{ width: 50 }}>#</th>
                                <th style={{ width: 140 }}>Account Type</th>
                                <th>Name</th>
                                <th style={{ width: 130 }}>SOS Filing</th>
                              </tr>
                            </thead>
                            <tbody>
                              {filteredRegistrants.slice(0, regShowCount).map((r, i) => {
                                const isEntity = r.accountType === 'Lobbyist Entity';
                                const isOpen = isEntity && expandedFirmSys === r.sysvalue;
                                const yrData = firmDetailsByYear[regYear];
                                const firmDetail = isOpen ? yrData?.bySys?.[r.sysvalue] : null;
                                const yrState = firmDetailsState[regYear];
                                return (
                                  <React.Fragment key={r.sysvalue}>
                                    <tr
                                      onClick={() => toggleFirmRow(r)}
                                      style={{
                                        cursor: isEntity ? 'pointer' : 'default',
                                        background: isOpen ? 'rgba(20,85,143,0.06)' : undefined,
                                      }}
                                    >
                                      <td style={{ color: 'var(--text-muted)' }}>{i + 1}</td>
                                      <td>
                                        <span style={{
                                          display: 'inline-block',
                                          padding: '2px 8px',
                                          fontSize: '0.75rem',
                                          fontWeight: 600,
                                          borderRadius: 4,
                                          background:
                                            r.accountType === 'Lobbyist' ? 'rgba(20,85,143,0.1)' :
                                            r.accountType === 'Client' ? 'rgba(50,120,78,0.1)' :
                                            'rgba(104,10,29,0.1)',
                                          color:
                                            r.accountType === 'Lobbyist' ? 'var(--accent-blue)' :
                                            r.accountType === 'Client' ? 'var(--accent-green)' :
                                            'var(--accent-red)',
                                        }}>
                                          {r.accountType}
                                        </span>
                                      </td>
                                      <td style={{ fontWeight: 500 }}>
                                        {isEntity && (
                                          <span style={{
                                            display: 'inline-block', width: 14, color: 'var(--text-muted)',
                                            fontSize: '0.8rem', transition: 'transform 0.15s',
                                            transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                                          }}>▶</span>
                                        )}
                                        {' '}{r.name}
                                      </td>
                                      <td>
                                        <a href={r.summaryUrl} target="_blank" rel="noopener noreferrer"
                                          onClick={(e) => e.stopPropagation()}
                                          style={{ color: 'var(--accent-blue)', fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                          View <ExternalLink size={11} />
                                        </a>
                                      </td>
                                    </tr>
                                    {isOpen && (
                                      <tr style={{ background: 'rgba(20,85,143,0.03)' }}>
                                        <td colSpan={4} style={{ padding: '14px 18px' }}>
                                          {yrState === 'loading' && (
                                            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                              <div className="spinner" style={{ display: 'inline-block', marginRight: 8, verticalAlign: 'middle' }} />
                                              Loading firm detail for {regYear}...
                                            </div>
                                          )}
                                          {yrState === 'unavailable' && (
                                            <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.55 }}>
                                              <strong style={{ color: '#E67E22' }}>Detail not yet captured for {regYear}.</strong>
                                              {' '}Per-firm Summary.aspx detail (lobbyist roster, client list,
                                              fees, purposes) is populated as the SOS site is scraped one year
                                              at a time via the Tampermonkey userscript at{' '}
                                              <a href="https://github.com/duncanburns2013-dot/The-Peoples-Audit/tree/main/userscripts"
                                                target="_blank" rel="noopener noreferrer"
                                                style={{ color: 'var(--accent-blue)' }}>
                                                userscripts/
                                              </a>. Click "View" to see the firm's filing on the SOS site directly.
                                            </div>
                                          )}
                                          {yrState === 'loaded' && !firmDetail && (
                                            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                              This firm is in the {regYear} registry but the detail scrape didn't
                                              include it. Re-run the userscript and let me know.
                                            </div>
                                          )}
                                          {firmDetail && (
                                            <FirmDetailPanel firm={firmDetail} year={regYear} />
                                          )}
                                        </td>
                                      </tr>
                                    )}
                                  </React.Fragment>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                        {regShowCount < filteredRegistrants.length && (
                          <div style={{ marginTop: 12, textAlign: 'center' }}>
                            <button
                              onClick={() => setRegShowCount(c => c + 500)}
                              style={{
                                padding: '8px 20px',
                                background: 'var(--accent-blue)',
                                color: '#fff',
                                border: 'none',
                                borderRadius: 6,
                                fontWeight: 600,
                                cursor: 'pointer',
                                fontSize: '0.85rem',
                              }}
                            >
                              Show 500 more ({(filteredRegistrants.length - regShowCount).toLocaleString()} remaining)
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ) : null}
              </>
            )}
          </div>
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
