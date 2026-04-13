import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Cell } from 'recharts';
import { Search, DollarSign, FileText, ChevronRight, Award, Calendar, TrendingUp } from 'lucide-react';
import {
  fetchLegislatorFinances,
  fetchMonthlyChartData,
  searchContributions,
  searchExpenditures,
  fetchCampaignFinanceTotals,
} from '../services/api';

const GRID_COLOR = '#e4e6ed';
const AXIS_COLOR = '#6b7189';
const COLORS = ['#4361ee', '#e76f51', '#2a9d8f', '#e9c46a', '#264653', '#7209b7', '#f4845f', '#577590', '#c77dff', '#6c8eb5', '#d4a373', '#48bfe3', '#ff6b6b', '#51cf66', '#ffd43b'];

const formatMoney = (num) => {
  if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
  if (num >= 1e6) return `$${(num / 1e6).toFixed(1)}M`;
  if (num >= 1e3) return `$${(num / 1e3).toFixed(0)}K`;
  return `$${Number(num).toLocaleString()}`;
};
const formatMoneyFull = (num) => `$${Number(num).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const parseOcpfDate = (dateStr) => {
  if (!dateStr) return 0;
  const parts = dateStr.split('/');
  if (parts.length === 3) return new Date(+parts[2], +parts[0] - 1, +parts[1]).getTime();
  return 0;
};

// Get current month/year for default date range
const now = new Date();
const currentYear = now.getFullYear();
const currentMonth = now.getMonth() + 1;

// Generate month options for the monthly dashboard
const MONTHS = [];
for (let y = currentYear; y >= 2020; y--) {
  const maxM = y === currentYear ? currentMonth : 12;
  for (let m = maxM; m >= 1; m--) {
    const label = new Date(y, m - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const start = `${String(m).padStart(2, '0')}/01/${y}`;
    const lastDay = new Date(y, m, 0).getDate();
    const end = `${String(m).padStart(2, '0')}/${lastDay}/${y}`;
    MONTHS.push({ label, start, end, value: `${y}-${String(m).padStart(2, '0')}` });
  }
}

// Sortable header component
function SortHeader({ label, sortKey, asc, desc, currentSort, setSort }) {
  const isActive = currentSort === asc || currentSort === desc;
  const isAsc = currentSort === asc;
  return (
    <th
      onClick={() => {
        if (asc === desc) setSort(asc);
        else setSort(isActive && !isAsc ? asc : desc);
      }}
      style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
    >
      {label} <span style={{ color: isActive ? 'var(--accent-purple)' : '#ccc', fontSize: '0.7rem' }}>
        {isActive ? (isAsc ? ' ▲' : ' ▼') : ' ▼'}
      </span>
    </th>
  );
}

export default function OcpfDataCenter() {
  // YTD stats
  const [ytdStats, setYtdStats] = useState(null);
  const [ytdLoading, setYtdLoading] = useState(true);

  // Monthly dashboard
  const [monthlyData, setMonthlyData] = useState([]);
  const [monthlyExpend, setMonthlyExpend] = useState([]);
  const [monthlyPeriod, setMonthlyPeriod] = useState(MONTHS[0]?.value || '');
  const [monthlyType, setMonthlyType] = useState('contributions');
  const [monthlyLoading, setMonthlyLoading] = useState(true);

  // Top candidates by year (depository reports)
  const [topCandidates, setTopCandidates] = useState([]);
  const [topYear, setTopYear] = useState('2024');
  const [topLoading, setTopLoading] = useState(true);

  // Politician search + detail
  const [searchText, setSearchText] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedPolitician, setSelectedPolitician] = useState(null);
  const [detailTab, setDetailTab] = useState('contributions');
  const [contributions, setContributions] = useState([]);
  const [expenditures, setExpenditures] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [contribSort, setContribSort] = useState('date-desc');
  const [expendSort, setExpendSort] = useState('date-desc');

  // Load YTD stats
  useEffect(() => {
    fetchCampaignFinanceTotals().then(data => {
      setYtdStats(data);
      setYtdLoading(false);
    }).catch(() => setYtdLoading(false));
  }, []);

  // Load monthly dashboard data
  useEffect(() => {
    const month = MONTHS.find(m => m.value === monthlyPeriod);
    if (!month) return;
    setMonthlyLoading(true);
    Promise.all([
      fetchMonthlyChartData('C-TOTAL', month.start, month.end, 0),
      fetchMonthlyChartData('E-TOTAL', month.start, month.end, 0),
    ]).then(([contribs, expends]) => {
      setMonthlyData(contribs);
      setMonthlyExpend(expends);
      setMonthlyLoading(false);
    }).catch(() => setMonthlyLoading(false));
  }, [monthlyPeriod]);

  // Load top candidates by year (depository reports)
  useEffect(() => {
    setTopLoading(true);
    const yr = parseInt(topYear);
    fetchLegislatorFinances(yr, yr % 2 === 0 ? 'state' : 'municipal').then(data => {
      const arr = Array.isArray(data) ? data : (data?.data || []);
      setTopCandidates([...arr].sort((a, b) => (b.receipts || 0) - (a.receipts || 0)));
      setTopLoading(false);
    }).catch(() => { setTopCandidates([]); setTopLoading(false); });
  }, [topYear]);

  // Politician search
  const handleSearch = useCallback(async () => {
    if (!searchText.trim()) return;
    setSearching(true);
    setSelectedPolitician(null);
    try {
      let allResults = [];
      for (const yr of [2024, 2025, 2022, 2023, 2020, 2021]) {
        const data = await fetchLegislatorFinances(yr, yr % 2 === 0 ? 'state' : 'municipal');
        const arr = Array.isArray(data) ? data : (data?.data || []);
        arr.filter(leg => leg.name.toLowerCase().includes(searchText.toLowerCase()))
          .forEach(m => { if (!allResults.find(r => r.cpfId === m.cpfId)) allResults.push({ ...m, year: yr }); });
        if (allResults.length >= 5) break;
      }
      if (allResults.length === 0) {
        const contribResult = await searchContributions({ searchPhrase: searchText, pageSize: 50 });
        const items = contribResult?.items || [];
        const map = {};
        items.forEach(c => {
          const name = c.recipient || '';
          if (name.toLowerCase().includes(searchText.toLowerCase()) && !map[name]) {
            map[name] = { cpfId: c.recipientCpfId || 0, name, office: '', district: '', party: '', receipts: 0, expenditures: 0 };
          }
        });
        allResults = Object.values(map);
      }
      setSearchResults(allResults);
    } catch (err) {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, [searchText]);

  // Load detail
  useEffect(() => {
    if (!selectedPolitician) return;
    setDetailLoading(true);
    setContributions([]);
    setExpenditures([]);
    Promise.all([
      searchContributions({ cpfId: selectedPolitician.cpfId, pageSize: 200 }),
      searchExpenditures({ cpfId: selectedPolitician.cpfId, pageSize: 200 }),
    ]).then(([c, e]) => {
      setContributions(c?.items || []);
      setExpenditures(e?.items || []);
      setDetailLoading(false);
    }).catch(() => setDetailLoading(false));
  }, [selectedPolitician]);

  // Sort & stats
  const sortedContributions = useMemo(() => {
    return [...contributions].sort((a, b) => {
      switch (contribSort) {
        case 'amount-desc': return (b.amountNum || 0) - (a.amountNum || 0);
        case 'amount-asc': return (a.amountNum || 0) - (b.amountNum || 0);
        case 'date-desc': return parseOcpfDate(b.date) - parseOcpfDate(a.date);
        case 'date-asc': return parseOcpfDate(a.date) - parseOcpfDate(b.date);
        case 'contributor': return (a.contributor || '').localeCompare(b.contributor || '');
        case 'employer': return (a.employer || '').localeCompare(b.employer || '');
        default: return 0;
      }
    });
  }, [contributions, contribSort]);

  const sortedExpenditures = useMemo(() => {
    return [...expenditures].sort((a, b) => {
      switch (expendSort) {
        case 'amount-desc': return (b.amountNum || 0) - (a.amountNum || 0);
        case 'amount-asc': return (a.amountNum || 0) - (b.amountNum || 0);
        case 'date-desc': return parseOcpfDate(b.date) - parseOcpfDate(a.date);
        case 'date-asc': return parseOcpfDate(a.date) - parseOcpfDate(b.date);
        case 'payee': return (a.payee || '').localeCompare(b.payee || '');
        default: return 0;
      }
    });
  }, [expenditures, expendSort]);

  const contribStats = useMemo(() => {
    const total = contributions.reduce((s, c) => s + (c.amountNum || 0), 0);
    return { count: contributions.length, total, avg: contributions.length ? total / contributions.length : 0 };
  }, [contributions]);

  const expendStats = useMemo(() => {
    const total = expenditures.reduce((s, c) => s + (c.amountNum || 0), 0);
    return { count: expenditures.length, total, avg: expenditures.length ? total / expenditures.length : 0 };
  }, [expenditures]);

  const contribByMonth = useMemo(() => {
    const monthly = {};
    contributions.forEach(c => {
      if (c.date) {
        const parts = c.date.split('/');
        if (parts.length === 3) {
          const key = `${parts[2]}-${parts[0].padStart(2, '0')}`;
          monthly[key] = (monthly[key] || 0) + (c.amountNum || 0);
        }
      }
    });
    return Object.entries(monthly).sort().map(([k, v]) => ({
      month: new Date(k + '-01').toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      amount: v,
    }));
  }, [contributions]);

  // Active monthly display data
  const activeMonthlyData = monthlyType === 'contributions' ? monthlyData : monthlyExpend;
  const monthLabel = MONTHS.find(m => m.value === monthlyPeriod)?.label || '';

  return (
    <div>
      {/* ===== YTD STATS ===== */}
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: 4 }}>OCPF Data Center</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: 20 }}>
          Live campaign finance data from the Massachusetts Office of Campaign and Political Finance
        </p>
        {ytdLoading ? (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>
            <div className="spinner" style={{ margin: '0 auto 8px' }} /> Loading YTD stats...
          </div>
        ) : ytdStats && (
          <div className="kpi-row">
            <div className="kpi-card" style={{ borderColor: 'rgba(67,97,238,0.3)' }}>
              <div className="kpi-label">Contributions</div>
              <div className="kpi-value" style={{ color: '#4361ee', fontSize: '1.8rem' }}>{(ytdStats.contributionCount || 0).toLocaleString()}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>to candidates & committees</div>
            </div>
            <div className="kpi-card" style={{ borderColor: 'rgba(231,111,81,0.3)' }}>
              <div className="kpi-label">Expenditures</div>
              <div className="kpi-value" style={{ color: '#e76f51', fontSize: '1.8rem' }}>{(ytdStats.expenditureCount || 0).toLocaleString()}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>by political committees</div>
            </div>
            <div className="kpi-card" style={{ borderColor: 'rgba(42,157,143,0.3)' }}>
              <div className="kpi-label">Reports Filed</div>
              <div className="kpi-value" style={{ color: '#2a9d8f', fontSize: '1.8rem' }}>{(ytdStats.reportCount || 0).toLocaleString()}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>by candidates & committees</div>
            </div>
          </div>
        )}
      </div>

      {/* ===== MONTHLY FUNDRAISING DASHBOARD ===== */}
      <div className="card" style={{ padding: 24, marginBottom: 32, background: 'var(--bg-card)', borderRadius: 16, border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: 4 }}>
              <TrendingUp size={18} style={{ verticalAlign: 'middle', marginRight: 6, color: 'var(--accent-purple)' }} />
              Monthly Fundraising Dashboard
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Top 10 candidates by {monthlyType === 'contributions' ? 'total contributions received' : 'total expenditures made'} — {monthLabel}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <select value={monthlyType} onChange={e => setMonthlyType(e.target.value)}
              style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)', background: '#fff', fontSize: '0.85rem' }}>
              <option value="contributions">Total Raised</option>
              <option value="expenditures">Total Spent</option>
            </select>
            <select value={monthlyPeriod} onChange={e => setMonthlyPeriod(e.target.value)}
              style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)', background: '#fff', fontSize: '0.85rem' }}>
              {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
        </div>

        {monthlyLoading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
            <div className="spinner" style={{ margin: '0 auto 8px' }} /> Loading monthly data...
          </div>
        ) : activeMonthlyData.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>No data available for {monthLabel}.</div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={Math.min(420, activeMonthlyData.length * 40 + 40)}>
              <BarChart
                data={activeMonthlyData.slice(0, 10).map(c => ({
                  name: c.filerName.length > 22 ? c.filerName.substring(0, 20) + '...' : c.filerName,
                  fullName: c.filerName,
                  total: c.total || 0,
                  party: c.partyAffiliation || '',
                  office: c.officeSoughtDescription || '',
                  cpfId: c.cpfId,
                }))}
                layout="vertical"
                margin={{ left: 170, right: 80, top: 5, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
                <XAxis type="number" stroke={AXIS_COLOR} tickFormatter={v => formatMoney(v)} />
                <YAxis type="category" dataKey="name" stroke={AXIS_COLOR} width={160} tick={{ fontSize: 12 }} />
                <Tooltip content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload;
                  return (
                    <div style={{ background: '#fff', border: '1px solid #dfe2ea', borderRadius: 8, padding: '10px 14px', fontSize: '0.85rem', boxShadow: '0 4px 16px rgba(0,0,0,0.1)' }}>
                      <p style={{ fontWeight: 600 }}>{d.fullName} ({d.party})</p>
                      <p style={{ fontSize: '0.8rem', color: '#666' }}>{d.office}</p>
                      <p style={{ color: '#4361ee', fontWeight: 600 }}>{formatMoneyFull(d.total)}</p>
                    </div>
                  );
                }} />
                <Bar dataKey="total" radius={[0, 6, 6, 0]}
                  label={{ position: 'right', formatter: (v) => formatMoney(v), fontSize: 11, fill: AXIS_COLOR }}>
                  {activeMonthlyData.slice(0, 10).map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            {/* Monthly data table */}
            <div className="data-table-wrapper" style={{ marginTop: 16 }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: 36 }}>#</th>
                    <th>Candidate</th>
                    <th>Office</th>
                    <th>Party</th>
                    <th>{monthlyType === 'contributions' ? 'Total Raised' : 'Total Spent'}</th>
                  </tr>
                </thead>
                <tbody>
                  {activeMonthlyData.map((c, i) => (
                    <tr key={c.cpfId || i} style={{ cursor: 'pointer' }}
                      onClick={() => { setSelectedPolitician({ cpfId: c.cpfId, name: c.filerName, office: c.officeSoughtDescription, party: c.partyAffiliation }); setDetailTab('contributions'); }}>
                      <td style={{ fontWeight: 600, color: 'var(--text-muted)' }}>{i + 1}</td>
                      <td style={{ fontWeight: 600 }}>{c.filerName}</td>
                      <td style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{c.officeSoughtDescription || '—'}</td>
                      <td style={{ fontSize: '0.82rem' }}>{c.partyAffiliation || '—'}</td>
                      <td className="money" style={{ color: monthlyType === 'contributions' ? '#2a9d8f' : '#e76f51', fontWeight: 600 }}>{formatMoneyFull(c.total || 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* ===== DEPOSITORY REPORTS — TOP FUNDED BY YEAR ===== */}
      <div className="card" style={{ padding: 24, marginBottom: 32, background: 'var(--bg-card)', borderRadius: 16, border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 4 }}>
              <Award size={18} style={{ verticalAlign: 'middle', marginRight: 6, color: 'var(--accent-purple)' }} />
              Annual Depository Reports — Top Funded
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {parseInt(topYear) % 2 === 0 ? 'State' : 'Municipal'} race depository reports — ranked by total receipts
            </p>
          </div>
          <select value={topYear} onChange={e => setTopYear(e.target.value)}
            style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)', background: '#fff', fontSize: '0.85rem' }}>
            {Array.from({ length: 10 }, (_, i) => currentYear - i).map(y => (
              <option key={y} value={y}>{y} — {y % 2 === 0 ? 'State' : 'Municipal'}</option>
            ))}
          </select>
        </div>

        {topLoading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
            <div className="spinner" style={{ margin: '0 auto 8px' }} /> Loading depository reports...
          </div>
        ) : topCandidates.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>No depository reports found for {topYear}.</div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={Math.min(400, topCandidates.slice(0, 15).length * 32 + 40)}>
              <BarChart
                data={topCandidates.slice(0, 15).map(c => ({
                  name: c.name.length > 22 ? c.name.substring(0, 20) + '...' : c.name,
                  fullName: c.name,
                  receipts: c.receipts || 0,
                  party: c.party || '',
                  office: c.office || c.district || '',
                }))}
                layout="vertical"
                margin={{ left: 160, right: 80, top: 5, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
                <XAxis type="number" stroke={AXIS_COLOR} tickFormatter={v => formatMoney(v)} />
                <YAxis type="category" dataKey="name" stroke={AXIS_COLOR} width={150} tick={{ fontSize: 12 }} />
                <Tooltip content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload;
                  return (
                    <div style={{ background: '#fff', border: '1px solid #dfe2ea', borderRadius: 8, padding: '10px 14px', fontSize: '0.85rem', boxShadow: '0 4px 16px rgba(0,0,0,0.1)' }}>
                      <p style={{ fontWeight: 600 }}>{d.fullName}</p>
                      {d.office && <p style={{ fontSize: '0.8rem', color: '#666' }}>{d.office} {d.party && `(${d.party})`}</p>}
                      <p style={{ color: '#4361ee', fontWeight: 600 }}>Receipts: {formatMoneyFull(d.receipts)}</p>
                    </div>
                  );
                }} />
                <Bar dataKey="receipts" radius={[0, 6, 6, 0]}
                  label={{ position: 'right', formatter: (v) => formatMoney(v), fontSize: 11, fill: AXIS_COLOR }}>
                  {topCandidates.slice(0, 15).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            <div className="data-table-wrapper" style={{ marginTop: 16 }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: 36 }}>#</th>
                    <th>Candidate</th>
                    <th>Office / District</th>
                    <th>Party</th>
                    <th>Receipts</th>
                    <th>Expenditures</th>
                    <th>Cash on Hand</th>
                  </tr>
                </thead>
                <tbody>
                  {topCandidates.slice(0, 25).map((c, i) => (
                    <tr key={c.cpfId || i} style={{ cursor: 'pointer' }}
                      onClick={() => { setSelectedPolitician(c); setDetailTab('contributions'); }}>
                      <td style={{ fontWeight: 600, color: 'var(--text-muted)' }}>{i + 1}</td>
                      <td style={{ fontWeight: 600 }}>{c.name}</td>
                      <td style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{c.office || c.district || '—'}</td>
                      <td style={{ fontSize: '0.82rem' }}>{c.party || '—'}</td>
                      <td className="money" style={{ color: '#2a9d8f', fontWeight: 600 }}>{formatMoneyFull(c.receipts || 0)}</td>
                      <td className="money" style={{ color: '#e76f51' }}>{formatMoneyFull(c.expenditures || 0)}</td>
                      <td className="money">{formatMoneyFull(c.cashOnHand || 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* ===== POLITICIAN SEARCH ===== */}
      <div className="card" style={{ padding: 24, marginBottom: 32, background: 'var(--bg-card)', borderRadius: 16, border: '1px solid var(--border)' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 12 }}>
          <Search size={18} style={{ verticalAlign: 'middle', marginRight: 6, color: 'var(--accent-purple)' }} />
          Detailed Contributions & Expenditures Lookup
        </h3>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 12 }}>
          Search for any candidate or committee to see their individual contributions received and expenditures made.
        </p>
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input type="text" className="search-input" style={{ paddingLeft: 36 }}
              placeholder="Enter politician name (e.g. Healey, Minogue, Spilka...)"
              value={searchText} onChange={e => setSearchText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()} />
          </div>
          <button onClick={handleSearch} disabled={searching || !searchText.trim()}
            style={{
              padding: '10px 28px', background: 'linear-gradient(135deg, var(--accent-purple), #e91e63)',
              color: '#fff', border: 'none', borderRadius: 10, fontWeight: 600, cursor: 'pointer',
              opacity: searching || !searchText.trim() ? 0.5 : 1,
            }}>
            {searching ? 'Searching...' : 'Search'}
          </button>
        </div>

        {searchResults.length > 0 && !selectedPolitician && (
          <div style={{ marginTop: 16 }}>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 8 }}>
              {searchResults.length} result(s) found — click to view contributions & expenditures:
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {searchResults.map(leg => (
                <button key={leg.cpfId} onClick={() => { setSelectedPolitician(leg); setDetailTab('contributions'); }}
                  style={{ padding: '10px 16px', borderRadius: 10, border: '1px solid var(--border)', background: '#fff', cursor: 'pointer', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'all 0.15s' }}
                  onMouseOver={e => e.currentTarget.style.background = 'var(--bg-card-hover)'}
                  onMouseOut={e => e.currentTarget.style.background = '#fff'}>
                  <span>
                    <strong>{leg.name}</strong>
                    {leg.office && <span style={{ color: 'var(--text-muted)', marginLeft: 8, fontSize: '0.85rem' }}>{leg.office}</span>}
                    {leg.district && <span style={{ color: 'var(--text-muted)', marginLeft: 4, fontSize: '0.85rem' }}>({leg.district})</span>}
                    {leg.year && <span style={{ color: 'var(--accent-purple)', marginLeft: 8, fontSize: '0.75rem' }}>{leg.year}</span>}
                    {leg.receipts > 0 && <span style={{ color: '#2a9d8f', marginLeft: 8, fontSize: '0.8rem' }}>{formatMoney(leg.receipts)}</span>}
                  </span>
                  <ChevronRight size={16} style={{ color: 'var(--text-muted)' }} />
                </button>
              ))}
            </div>
          </div>
        )}
        {searchResults.length === 0 && searchText && !searching && !selectedPolitician && (
          <p style={{ marginTop: 12, fontSize: '0.85rem', color: 'var(--text-muted)' }}>No politicians found matching "{searchText}".</p>
        )}
      </div>

      {/* ===== POLITICIAN DETAIL ===== */}
      {selectedPolitician && (
        <div className="card" style={{ padding: 24, background: 'var(--bg-card)', borderRadius: 16, border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <h3 style={{ fontSize: '1.3rem', fontWeight: 700 }}>{selectedPolitician.name}</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                {selectedPolitician.office || selectedPolitician.district || 'Campaign Committee'}
                {selectedPolitician.party && ` — ${selectedPolitician.party}`}
                {' · CPF ID: '}{selectedPolitician.cpfId}
              </p>
            </div>
            <button onClick={() => { setSelectedPolitician(null); setContributions([]); setExpenditures([]); }}
              style={{ padding: '6px 16px', borderRadius: 8, border: '1px solid var(--border)', background: '#fff', cursor: 'pointer', fontSize: '0.85rem' }}>
              ← Back
            </button>
          </div>

          {detailLoading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
              <div className="spinner" style={{ margin: '0 auto 8px' }} /> Loading contributions & expenditures...
            </div>
          ) : (
            <>
              {/* KPIs */}
              <div className="kpi-row" style={{ marginBottom: 20 }}>
                <div className="kpi-card" style={{ borderColor: 'rgba(42,157,143,0.3)' }}>
                  <div className="kpi-label">Total Receipts</div>
                  <div className="kpi-value" style={{ color: '#2a9d8f' }}>{formatMoney(contribStats.total)}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{contribStats.count} contributions</div>
                </div>
                <div className="kpi-card" style={{ borderColor: 'rgba(231,111,81,0.3)' }}>
                  <div className="kpi-label">Total Spent</div>
                  <div className="kpi-value" style={{ color: '#e76f51' }}>{formatMoney(expendStats.total)}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{expendStats.count} expenditures</div>
                </div>
                <div className="kpi-card">
                  <div className="kpi-label">Avg Contribution</div>
                  <div className="kpi-value">{formatMoneyFull(contribStats.avg)}</div>
                </div>
                <div className="kpi-card">
                  <div className="kpi-label">Unique Donors</div>
                  <div className="kpi-value">{new Set(contributions.map(c => c.contributor)).size}</div>
                </div>
              </div>

              {/* Line chart */}
              {contribByMonth.length > 1 && (
                <div style={{ marginBottom: 24 }}>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: 8, color: 'var(--text-secondary)' }}>Contributions Over Time</h4>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={contribByMonth}>
                      <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
                      <XAxis dataKey="month" stroke={AXIS_COLOR} tick={{ fontSize: 11 }} />
                      <YAxis stroke={AXIS_COLOR} tickFormatter={v => formatMoney(v)} tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v) => formatMoneyFull(v)} />
                      <Line type="monotone" dataKey="amount" stroke="#2a9d8f" strokeWidth={2} dot={{ fill: '#2a9d8f', r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Detail tabs */}
              <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid var(--border)', marginBottom: 16 }}>
                {[
                  { id: 'contributions', label: `Contributions Received (${contributions.length})`, icon: DollarSign },
                  { id: 'expenditures', label: `Expenditures Made (${expenditures.length})`, icon: FileText },
                ].map(tab => (
                  <button key={tab.id} onClick={() => setDetailTab(tab.id)}
                    style={{
                      padding: '10px 20px', border: 'none', borderBottom: detailTab === tab.id ? '3px solid var(--accent-purple)' : '3px solid transparent',
                      background: 'transparent', cursor: 'pointer', fontWeight: detailTab === tab.id ? 700 : 400,
                      color: detailTab === tab.id ? 'var(--accent-purple)' : 'var(--text-muted)',
                      fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 6,
                    }}>
                    <tab.icon size={16} /> {tab.label}
                  </button>
                ))}
              </div>

              {detailTab === 'contributions' ? (
                sortedContributions.length === 0 ? (
                  <p style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>No contributions found.</p>
                ) : (
                  <div className="data-table-wrapper">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <SortHeader label="Date" asc="date-asc" desc="date-desc" currentSort={contribSort} setSort={setContribSort} />
                          <SortHeader label="Contributor" asc="contributor" desc="contributor" currentSort={contribSort} setSort={setContribSort} />
                          <SortHeader label="Amount" asc="amount-asc" desc="amount-desc" currentSort={contribSort} setSort={setContribSort} />
                          <SortHeader label="Employer" asc="employer" desc="employer" currentSort={contribSort} setSort={setContribSort} />
                          <th>Occupation</th>
                          <th>City</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedContributions.map((c, i) => (
                          <tr key={i}>
                            <td style={{ whiteSpace: 'nowrap', fontSize: '0.8rem' }}>{c.date}</td>
                            <td>{c.contributor}</td>
                            <td className="money">{c.amount}</td>
                            <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{c.employer}</td>
                            <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{c.occupation}</td>
                            <td style={{ fontSize: '0.8rem' }}>{c.city}{c.state ? `, ${c.state}` : ''}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              ) : (
                sortedExpenditures.length === 0 ? (
                  <p style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>No expenditures found.</p>
                ) : (
                  <div className="data-table-wrapper">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <SortHeader label="Date" asc="date-asc" desc="date-desc" currentSort={expendSort} setSort={setExpendSort} />
                          <SortHeader label="Payee" asc="payee" desc="payee" currentSort={expendSort} setSort={setExpendSort} />
                          <SortHeader label="Amount" asc="amount-asc" desc="amount-desc" currentSort={expendSort} setSort={setExpendSort} />
                          <th>Description</th>
                          <th>City</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedExpenditures.map((c, i) => (
                          <tr key={i}>
                            <td style={{ whiteSpace: 'nowrap', fontSize: '0.8rem' }}>{c.date}</td>
                            <td>{c.payee}</td>
                            <td className="money">{c.amount}</td>
                            <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{c.description}</td>
                            <td style={{ fontSize: '0.8rem' }}>{c.city}{c.state ? `, ${c.state}` : ''}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
