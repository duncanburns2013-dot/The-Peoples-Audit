import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart,
  Bar,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from 'recharts';
import { Search, TrendingUp, TrendingDown, DollarSign, ArrowUpDown, ArrowLeft, Loader, Users, CreditCard } from 'lucide-react';
import { fetchPACFinances, fetchPACContributions, fetchPACExpenditures } from '../services/api';

const GRID_COLOR = '#e4e6ed';
const AXIS_COLOR = '#6b7189';

const formatMoney = (n) => {
  if (!n) return '$0';
  if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(1) + 'B';
  if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
  if (Math.abs(n) >= 1e3) return '$' + (n / 1e3).toFixed(0) + 'K';
  return '$' + n.toLocaleString();
};

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{ backgroundColor: '#ffffff', border: '1px solid #dfe2ea', borderRadius: '8px', padding: '8px 12px', color: 'var(--text-primary)' }}>
        {payload.map((entry, index) => (
          <div key={index} style={{ color: entry.color }}>
            <span style={{ marginRight: '8px' }}>{entry.name}:</span>
            <strong>{formatMoney(entry.value)}</strong>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

const PACTableHeader = ({ column, label, sorted, onSort }) => (
  <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => onSort(column)}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      {label}
      {sorted.column === column && (
        <ArrowUpDown size={14} style={{ color: 'var(--accent-purple)', transform: sorted.direction === 'desc' ? 'rotate(180deg)' : 'rotate(0deg)' }} />
      )}
    </div>
  </th>
);

/* ─── PAC Detail View ─── */
function PACDetailView({ pac, onBack }) {
  const [contributions, setContributions] = useState([]);
  const [expenditures, setExpenditures] = useState([]);
  const [loadingDetail, setLoadingDetail] = useState(true);
  const [activeTab, setActiveTab] = useState('contributions');
  const [contribSort, setContribSort] = useState({ col: 'date', dir: 'desc' });
  const [expendSort, setExpendSort] = useState({ col: 'date', dir: 'desc' });

  useEffect(() => {
    if (!pac?.cpfId) { setLoadingDetail(false); return; }
    let cancelled = false;
    setLoadingDetail(true);
    Promise.allSettled([
      fetchPACContributions(pac.cpfId, 100),
      fetchPACExpenditures(pac.cpfId, 100),
    ]).then(([cRes, eRes]) => {
      if (cancelled) return;
      setContributions(cRes.status === 'fulfilled' ? cRes.value : []);
      setExpenditures(eRes.status === 'fulfilled' ? eRes.value : []);
      setLoadingDetail(false);
    });
    return () => { cancelled = true; };
  }, [pac?.cpfId]);

  const totalContrib = contributions.reduce((s, c) => s + c.amountNum, 0);
  const totalExpend = expenditures.reduce((s, e) => s + e.amountNum, 0);

  // Top contributors aggregated
  const contribByName = {};
  contributions.forEach(c => {
    const key = c.name;
    if (!contribByName[key]) contribByName[key] = { name: key, total: 0, count: 0, employer: c.employer, occupation: c.occupation, city: c.city };
    contribByName[key].total += c.amountNum;
    contribByName[key].count++;
  });
  const topContributors = Object.values(contribByName).sort((a, b) => b.total - a.total).slice(0, 15);

  // Top vendors aggregated
  const expendByVendor = {};
  expenditures.forEach(e => {
    const key = e.vendor;
    if (!expendByVendor[key]) expendByVendor[key] = { vendor: key, total: 0, count: 0, purposes: new Set(), city: e.city };
    expendByVendor[key].total += e.amountNum;
    expendByVendor[key].count++;
    if (e.purpose) expendByVendor[key].purposes.add(e.purpose);
  });
  const topVendors = Object.values(expendByVendor).sort((a, b) => b.total - a.total).slice(0, 15);

  // Parse M/D/YYYY dates for sorting
  const parseDate = (d) => {
    if (!d) return 0;
    const parts = d.split('/');
    if (parts.length === 3) return new Date(parts[2], parts[0] - 1, parts[1]).getTime();
    return 0;
  };

  // Sort contributions
  const sortedContribs = [...contributions].sort((a, b) => {
    let cmp = 0;
    if (contribSort.col === 'date') cmp = parseDate(a.date) - parseDate(b.date);
    else if (contribSort.col === 'amount') cmp = a.amountNum - b.amountNum;
    else if (contribSort.col === 'name') cmp = (a.name || '').localeCompare(b.name || '');
    return contribSort.dir === 'desc' ? -cmp : cmp;
  });

  // Sort expenditures
  const sortedExpend = [...expenditures].sort((a, b) => {
    let cmp = 0;
    if (expendSort.col === 'date') cmp = parseDate(a.date) - parseDate(b.date);
    else if (expendSort.col === 'amount') cmp = a.amountNum - b.amountNum;
    else if (expendSort.col === 'vendor') cmp = (a.vendor || '').localeCompare(b.vendor || '');
    return expendSort.dir === 'desc' ? -cmp : cmp;
  });

  const toggleSort = (setter, current, col) => {
    if (current.col === col) setter({ col, dir: current.dir === 'desc' ? 'asc' : 'desc' });
    else setter({ col, dir: 'desc' });
  };

  const SortHeader = ({ label, col, current, setter, align }) => (
    <th style={{ textAlign: align || 'left', cursor: 'pointer', userSelect: 'none' }} onClick={() => toggleSort(setter, current, col)}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: align === 'right' ? 'flex-end' : 'flex-start' }}>
        {label}
        {current.col === col && <ArrowUpDown size={12} style={{ color: 'var(--accent-purple)', transform: current.dir === 'desc' ? 'rotate(180deg)' : 'none' }} />}
      </div>
    </th>
  );

  return (
    <div style={{ padding: '24px' }}>
      {/* Back button + header */}
      <button onClick={onBack} style={{
        display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none',
        color: 'var(--accent-purple)', fontSize: '14px', fontWeight: 600, cursor: 'pointer',
        padding: 0, marginBottom: '16px',
      }}>
        <ArrowLeft size={16} /> Back to all PACs
      </button>

      <h1 style={{ margin: '0 0 4px', color: 'var(--text-primary)', fontSize: '22px' }}>{pac.name}</h1>
      <p style={{ margin: '0 0 24px', color: 'var(--text-secondary)', fontSize: '14px' }}>
        CPF ID: {pac.cpfId} &middot; Data from OCPF (Massachusetts Office of Campaign and Political Finance)
      </p>

      {/* KPI row */}
      <div className="card-grid" style={{ marginBottom: '24px' }}>
        <div className="kpi-card">
          <div className="kpi-label">Total Receipts</div>
          <div className="kpi-value" style={{ color: 'var(--accent-green)' }}>{formatMoney(pac.receipts || 0)}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Total Expenditures</div>
          <div className="kpi-value" style={{ color: '#ff006e' }}>{formatMoney(pac.expenditures || 0)}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Cash on Hand</div>
          <div className="kpi-value" style={{ color: 'var(--accent-gold)' }}>{formatMoney(pac.cashOnHand || 0)}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Net Balance</div>
          {(() => {
            const net = (pac.receipts || 0) - (pac.expenditures || 0);
            return <div className="kpi-value" style={{ color: net >= 0 ? 'var(--accent-green)' : '#ff006e' }}>
              {net >= 0 ? '+' : ''}{formatMoney(net)}
            </div>;
          })()}
        </div>
      </div>

      {loadingDetail ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
          <Loader size={28} style={{ animation: 'spin 1s linear infinite', marginBottom: '12px' }} />
          <p style={{ margin: 0 }}>Loading contributions &amp; expenditures from OCPF...</p>
          <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
      ) : (
        <>
          {/* Tab switcher */}
          <div style={{ display: 'flex', gap: '0', marginBottom: '20px', borderBottom: '2px solid var(--border)' }}>
            {[
              { key: 'contributions', label: 'Who Gave Money', icon: <Users size={15} />, count: contributions.length },
              { key: 'expenditures', label: 'Where Money Went', icon: <CreditCard size={15} />, count: expenditures.length },
            ].map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '10px 20px', border: 'none', cursor: 'pointer',
                fontSize: '14px', fontWeight: 600,
                background: activeTab === tab.key ? 'var(--accent-purple)' : 'transparent',
                color: activeTab === tab.key ? '#fff' : 'var(--text-secondary)',
                borderRadius: '8px 8px 0 0',
                transition: 'all 0.15s ease',
              }}>
                {tab.icon} {tab.label} ({tab.count})
              </button>
            ))}
          </div>

          {/* Contributions tab */}
          {activeTab === 'contributions' && (
            <div>
              {contributions.length === 0 ? (
                <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '20px' }}>
                  No contribution records found for this PAC.
                </p>
              ) : (
                <>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                    Showing {contributions.length} most recent contributions totaling {formatMoney(totalContrib)}.
                  </p>

                  {/* Top contributors chart */}
                  {topContributors.length > 0 && (
                    <div className="chart-card" style={{ marginBottom: '20px' }}>
                      <h3 style={{ margin: '0 0 12px', fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                        Top Contributors
                      </h3>
                      <ResponsiveContainer width="100%" height={Math.max(200, topContributors.length * 30)}>
                        <BarChart data={topContributors} layout="vertical" margin={{ top: 5, right: 30, left: 180, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
                          <XAxis type="number" stroke={AXIS_COLOR} style={{ fontSize: '12px' }} tickFormatter={v => formatMoney(v)} />
                          <YAxis dataKey="name" type="category" stroke={AXIS_COLOR} style={{ fontSize: '11px' }} width={175} />
                          <Tooltip content={<CustomTooltip />} />
                          <Bar dataKey="total" fill="var(--accent-green)" radius={[0, 6, 6, 0]} name="Total Contributed" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {/* Contributions table */}
                  <div style={{ overflowX: 'auto' }}>
                    <table className="data-table" style={{ width: '100%' }}>
                      <thead>
                        <tr>
                          <SortHeader label="Contributor" col="name" current={contribSort} setter={setContribSort} />
                          <th style={{ textAlign: 'left' }}>Employer / Occupation</th>
                          <th style={{ textAlign: 'left' }}>City</th>
                          <SortHeader label="Date" col="date" current={contribSort} setter={setContribSort} />
                          <SortHeader label="Amount" col="amount" current={contribSort} setter={setContribSort} align="right" />
                        </tr>
                      </thead>
                      <tbody>
                        {sortedContribs.map((c, i) => (
                          <tr key={i}>
                            <td style={{ textAlign: 'left', fontWeight: 500 }}>{c.name}</td>
                            <td style={{ textAlign: 'left', fontSize: '13px', color: 'var(--text-secondary)' }}>
                              {c.employer && <span style={{ display: 'block' }}>{c.employer}</span>}
                              {c.occupation && <span style={{ display: 'block', fontSize: '12px', fontStyle: 'italic' }}>{c.occupation}</span>}
                            </td>
                            <td style={{ textAlign: 'left', fontSize: '13px' }}>{c.city}{c.state ? `, ${c.state}` : ''}</td>
                            <td style={{ fontSize: '13px', whiteSpace: 'nowrap' }}>{c.date}</td>
                            <td style={{ fontWeight: 600, color: 'var(--accent-green)', whiteSpace: 'nowrap', textAlign: 'right' }}>{c.amount}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Expenditures tab */}
          {activeTab === 'expenditures' && (
            <div>
              {expenditures.length === 0 ? (
                <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '20px' }}>
                  No expenditure records found for this PAC.
                </p>
              ) : (
                <>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                    Showing {expenditures.length} most recent expenditures totaling {formatMoney(totalExpend)}.
                  </p>

                  {/* Top vendors chart */}
                  {topVendors.length > 0 && (
                    <div className="chart-card" style={{ marginBottom: '20px' }}>
                      <h3 style={{ margin: '0 0 12px', fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                        Top Vendors / Recipients
                      </h3>
                      <ResponsiveContainer width="100%" height={Math.max(200, topVendors.length * 30)}>
                        <BarChart data={topVendors} layout="vertical" margin={{ top: 5, right: 30, left: 180, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
                          <XAxis type="number" stroke={AXIS_COLOR} style={{ fontSize: '12px' }} tickFormatter={v => formatMoney(v)} />
                          <YAxis dataKey="vendor" type="category" stroke={AXIS_COLOR} style={{ fontSize: '11px' }} width={175} />
                          <Tooltip content={<CustomTooltip />} />
                          <Bar dataKey="total" fill="#ff006e" radius={[0, 6, 6, 0]} name="Total Spent" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {/* Expenditures table */}
                  <div style={{ overflowX: 'auto' }}>
                    <table className="data-table" style={{ width: '100%' }}>
                      <thead>
                        <tr>
                          <SortHeader label="Vendor" col="vendor" current={expendSort} setter={setExpendSort} />
                          <th style={{ textAlign: 'left' }}>Purpose</th>
                          <th style={{ textAlign: 'left' }}>City</th>
                          <SortHeader label="Date" col="date" current={expendSort} setter={setExpendSort} />
                          <SortHeader label="Amount" col="amount" current={expendSort} setter={setExpendSort} align="right" />
                        </tr>
                      </thead>
                      <tbody>
                        {sortedExpend.map((e, i) => (
                          <tr key={i}>
                            <td style={{ textAlign: 'left', fontWeight: 500 }}>{e.vendor}</td>
                            <td style={{ textAlign: 'left', fontSize: '13px', color: 'var(--text-secondary)' }}>{e.purpose}</td>
                            <td style={{ textAlign: 'left', fontSize: '13px' }}>{e.city}{e.state ? `, ${e.state}` : ''}</td>
                            <td style={{ fontSize: '13px', whiteSpace: 'nowrap' }}>{e.date}</td>
                            <td style={{ fontWeight: 600, color: '#ff006e', whiteSpace: 'nowrap', textAlign: 'right' }}>{e.amount}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ─── Main Dashboard ─── */
export default function PacDashboard() {
  const [data, setData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [year, setYear] = useState(2026);
  const [searchQuery, setSearchQuery] = useState('');
  const [sorted, setSorted] = useState({ column: 'receipts', direction: 'desc' });
  const [selectedPAC, setSelectedPAC] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const result = await fetchPACFinances(year);
        setData(Array.isArray(result) ? result : (result?.data || []));
      } catch (err) {
        setError(err.message);
        setData([]);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [year]);

  useEffect(() => {
    let filtered = data;
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(pac =>
        pac.name.toLowerCase().includes(query) || (pac.type && pac.type.toLowerCase().includes(query))
      );
    }
    const sorted_data = [...filtered].sort((a, b) => {
      const aVal = a[sorted.column] || 0;
      const bVal = b[sorted.column] || 0;
      return sorted.direction === 'desc' ? bVal - aVal : aVal - bVal;
    });
    setFilteredData(sorted_data);
  }, [data, searchQuery, sorted]);

  const handleSort = (column) => {
    if (sorted.column === column) {
      setSorted({ column, direction: sorted.direction === 'desc' ? 'asc' : 'desc' });
    } else {
      setSorted({ column, direction: 'desc' });
    }
  };

  // If a PAC is selected, show the detail view
  if (selectedPAC) {
    return <PACDetailView pac={selectedPAC} onBack={() => setSelectedPAC(null)} />;
  }

  const totalReceipts = data.reduce((sum, pac) => sum + (pac.receipts || 0), 0);
  const totalExpenditures = data.reduce((sum, pac) => sum + (pac.expenditures || 0), 0);
  const totalCashOnHand = data.reduce((sum, pac) => sum + (pac.cashOnHand || 0), 0);
  const avgCashOnHand = data.length > 0 ? totalCashOnHand / data.length : 0;

  const topPACsByReceipts = [...data].sort((a, b) => (b.receipts || 0) - (a.receipts || 0)).slice(0, 20);
  const topPACsByExpenditures = [...data].sort((a, b) => (b.expenditures || 0) - (a.expenditures || 0)).slice(0, 20);
  const expenditureVsReceipts = topPACsByReceipts.map(pac => ({
    name: pac.name.substring(0, 20),
    receipts: pac.receipts || 0,
    expenditures: pac.expenditures || 0,
  }));

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Loading PAC data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <p style={{ color: '#ff006e' }}>Error loading data: {error}</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h1 style={{ margin: '0 0 8px 0', color: 'var(--text-primary)' }}>PAC Dashboard</h1>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '14px' }}>
            Political Action Committee Financial Overview &middot; Click any PAC to see contributions &amp; expenditures
          </p>
        </div>
        <select
          className="year-select"
          value={year}
          onChange={(e) => setYear(parseInt(e.target.value))}
          style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '14px' }}
        >
          {[2026, 2025, 2024, 2023, 2022, 2021, 2020].map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {/* KPI Cards */}
      <div className="card-grid" style={{ marginBottom: '32px' }}>
        <div className="kpi-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
            <div>
              <div className="kpi-label">Total PACs</div>
              <div className="kpi-value">{data.length.toLocaleString()}</div>
            </div>
            <DollarSign size={24} style={{ color: 'var(--accent-purple)' }} />
          </div>
        </div>
        <div className="kpi-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
            <div>
              <div className="kpi-label">Total Receipts</div>
              <div className="kpi-value">{formatMoney(totalReceipts)}</div>
              <div className="kpi-sub">All PACs combined</div>
            </div>
            <TrendingUp size={24} style={{ color: 'var(--accent-green)' }} />
          </div>
        </div>
        <div className="kpi-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
            <div>
              <div className="kpi-label">Total Expenditures</div>
              <div className="kpi-value">{formatMoney(totalExpenditures)}</div>
              <div className="kpi-sub">All PACs combined</div>
            </div>
            <TrendingDown size={24} style={{ color: '#ff006e' }} />
          </div>
        </div>
        <div className="kpi-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
            <div>
              <div className="kpi-label">Avg Cash on Hand</div>
              <div className="kpi-value">{formatMoney(avgCashOnHand)}</div>
              <div className="kpi-sub">Per PAC</div>
            </div>
            <DollarSign size={24} style={{ color: 'var(--accent-gold)' }} />
          </div>
        </div>
      </div>

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(600px, 1fr))', gap: '24px', marginBottom: '32px' }}>
        <div className="chart-card">
          <h2 className="section-header"><span className="section-tag">Top 20</span> PACs by Receipts</h2>
          {topPACsByReceipts.length > 0 ? (
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={topPACsByReceipts} layout="vertical" margin={{ top: 5, right: 30, left: 200, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
                <XAxis type="number" stroke={AXIS_COLOR} style={{ fontSize: '12px' }} />
                <YAxis dataKey="name" type="category" stroke={AXIS_COLOR} style={{ fontSize: '11px' }} width={195} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="receipts" fill="var(--accent-purple)" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p style={{ color: 'var(--text-secondary)' }}>No data available</p>}
        </div>
        <div className="chart-card">
          <h2 className="section-header"><span className="section-tag">Top 20</span> PACs by Expenditures</h2>
          {topPACsByExpenditures.length > 0 ? (
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={topPACsByExpenditures} layout="vertical" margin={{ top: 5, right: 30, left: 200, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
                <XAxis type="number" stroke={AXIS_COLOR} style={{ fontSize: '12px' }} />
                <YAxis dataKey="name" type="category" stroke={AXIS_COLOR} style={{ fontSize: '11px' }} width={195} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="expenditures" fill="#ff006e" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p style={{ color: 'var(--text-secondary)' }}>No data available</p>}
        </div>
      </div>

      {/* Comparison Chart */}
      <div className="chart-card" style={{ marginBottom: '32px' }}>
        <h2 className="section-header"><span className="section-tag">Top 20</span> Receipts vs Expenditures</h2>
        {expenditureVsReceipts.length > 0 ? (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={expenditureVsReceipts} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
              <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} stroke={AXIS_COLOR} style={{ fontSize: '12px' }} />
              <YAxis stroke={AXIS_COLOR} style={{ fontSize: '12px' }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ color: 'var(--text-secondary)', fontSize: '12px' }} iconType="square" />
              <Bar dataKey="receipts" fill="var(--accent-green)" radius={[8, 8, 0, 0]} />
              <Bar dataKey="expenditures" fill="#ff006e" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : <p style={{ color: 'var(--text-secondary)' }}>No data available</p>}
      </div>

      {/* Search */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <h2 className="section-header"><span className="section-tag">Search</span> PACs</h2>
        <div style={{ position: 'relative' }}>
          <Search size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-secondary)', pointerEvents: 'none' }} />
          <input
            type="text"
            placeholder="Search PAC names..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: '100%', padding: '10px 12px 10px 40px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '14px', boxSizing: 'border-box' }}
          />
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '8px' }}>
          Showing {filteredData.length} of {data.length} PACs &middot; Click any row to see detailed contributions &amp; expenditures
        </p>
      </div>

      {/* PAC Table */}
      <div className="chart-card">
        <h2 className="section-header"><span className="section-tag">Table</span> All PACs</h2>
        <div style={{ overflowX: 'auto' }}>
          {filteredData.length > 0 ? (
            <table className="data-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>PAC Name</th>
                  <PACTableHeader column="receipts" label="Receipts" sorted={sorted} onSort={handleSort} />
                  <PACTableHeader column="expenditures" label="Expenditures" sorted={sorted} onSort={handleSort} />
                  <PACTableHeader column="cashOnHand" label="Cash on Hand" sorted={sorted} onSort={handleSort} />
                </tr>
              </thead>
              <tbody>
                {filteredData.map((pac, index) => (
                  <tr key={index} onClick={() => setSelectedPAC(pac)} style={{ cursor: 'pointer' }}>
                    <td style={{ textAlign: 'left', fontWeight: '500' }}>{pac.name}</td>
                    <td style={{ color: 'var(--accent-green)', fontWeight: '500' }}>{formatMoney(pac.receipts || 0)}</td>
                    <td style={{ color: '#ff006e', fontWeight: '500' }}>{formatMoney(pac.expenditures || 0)}</td>
                    <td style={{ color: 'var(--accent-gold)', fontWeight: '500' }}>{formatMoney(pac.cashOnHand || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p style={{ color: 'var(--text-secondary)', padding: '20px', textAlign: 'center' }}>No PACs found matching your search.</p>
          )}
        </div>
      </div>
    </div>
  );
}
