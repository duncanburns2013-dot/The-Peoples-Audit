import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer,
  Tooltip, XAxis, YAxis, CartesianGrid, Legend,
} from 'recharts';
import { Search, TrendingUp, TrendingDown, DollarSign, ArrowUpDown, Users, Building2, ChevronRight } from 'lucide-react';
import { fetchPACFinances } from '../services/api';

const COLORS = ['#14558F', '#32784E', '#680A1D', '#FFC72C', '#00A9CE', '#7209b7', '#e76f51', '#264653'];

const formatMoney = (n) => {
  if (!n) return '$0';
  if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
  if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
  if (Math.abs(n) >= 1e3) return '$' + (n / 1e3).toFixed(0) + 'K';
  return '$' + n.toLocaleString();
};

const formatMoneyFull = (n) => {
  if (!n) return '$0.00';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
};

const chartTooltipStyle = {
  background: 'var(--bg-card)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  fontSize: '0.85rem',
  boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
};

const GRID_COLOR = 'rgba(0,0,0,0.06)';
const AXIS_COLOR = 'rgba(0,0,0,0.4)';

export default function PacDashboard() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [year, setYear] = useState(2025);
  const [searchQuery, setSearchQuery] = useState('');
  const [sorted, setSorted] = useState({ column: 'receipts', direction: 'desc' });
  const [selectedPac, setSelectedPac] = useState(null);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 25;

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await fetchPACFinances(year);
        setData(result || []);
      } catch (err) {
        setError(err.message);
        setData([]);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [year]);

  const filteredData = useMemo(() => {
    let filtered = data;
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(pac =>
        pac.name?.toLowerCase().includes(query) ||
        (pac.type && pac.type.toLowerCase().includes(query))
      );
    }
    return [...filtered].sort((a, b) => {
      const aVal = a[sorted.column] || 0;
      const bVal = b[sorted.column] || 0;
      return sorted.direction === 'desc' ? bVal - aVal : aVal - bVal;
    });
  }, [data, searchQuery, sorted]);

  const pagedData = useMemo(() => filteredData.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE), [filteredData, page]);
  const totalPages = Math.ceil(filteredData.length / PAGE_SIZE);

  const handleSort = (column) => {
    if (sorted.column === column) {
      setSorted({ column, direction: sorted.direction === 'desc' ? 'asc' : 'desc' });
    } else {
      setSorted({ column, direction: 'desc' });
    }
    setPage(0);
  };

  const totalReceipts = data.reduce((sum, pac) => sum + (pac.receipts || 0), 0);
  const totalExpenditures = data.reduce((sum, pac) => sum + (pac.expenditures || 0), 0);
  const totalCashOnHand = data.reduce((sum, pac) => sum + (pac.cashOnHand || 0), 0);
  const avgCashOnHand = data.length > 0 ? totalCashOnHand / data.length : 0;

  const topPACsByReceipts = useMemo(() =>
    [...data].sort((a, b) => (b.receipts || 0) - (a.receipts || 0)).slice(0, 15),
  [data]);

  const topPACsByExpenditures = useMemo(() =>
    [...data].sort((a, b) => (b.expenditures || 0) - (a.expenditures || 0)).slice(0, 15),
  [data]);

  const comparisonData = useMemo(() =>
    topPACsByReceipts.slice(0, 10).map(pac => ({
      name: pac.name?.length > 25 ? pac.name.substring(0, 25) + '...' : pac.name,
      receipts: pac.receipts || 0,
      expenditures: pac.expenditures || 0,
    })),
  [topPACsByReceipts]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)' }}>
        <div className="spinner" style={{ margin: '0 auto 12px' }} />
        Loading PAC data for {year}...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ textAlign: 'center', padding: 40 }}>
        <p style={{ color: 'var(--accent-red)', fontWeight: 600 }}>Error loading data: {error}</p>
        <button onClick={() => setYear(year)} style={{ marginTop: 12, padding: '8px 20px', background: 'var(--accent-blue)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
          Try Again
        </button>
      </div>
    );
  }

  const SortHeader = ({ column, label }) => (
    <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort(column)}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {label}
        {sorted.column === column && (
          <ArrowUpDown size={12} style={{ color: 'var(--accent-blue)', transform: sorted.direction === 'desc' ? 'scaleY(-1)' : 'none' }} />
        )}
      </div>
    </th>
  );

  return (
    <div className="section">
      <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <span className="section-tag" style={{ background: 'rgba(114,9,183,0.1)', color: '#7209b7' }}>Political Finance</span>
          <h2>PAC Dashboard</h2>
          <p>Political Action Committee financial overview. Receipts, expenditures, and cash on hand.</p>
        </div>
        <select className="year-select" value={year} onChange={(e) => { setYear(parseInt(e.target.value)); setPage(0); }}>
          {[2026, 2025, 2024, 2023, 2022, 2021, 2020].map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {/* KPI Row */}
      <div className="kpi-row">
        <div className="kpi-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Users size={18} style={{ color: 'var(--accent-blue)' }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Total PACs</span>
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)' }}>{data.length.toLocaleString()}</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>Registered committees</div>
        </div>
        <div className="kpi-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <TrendingUp size={18} style={{ color: 'var(--accent-green)' }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Total Receipts</span>
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--accent-green)' }}>{formatMoney(totalReceipts)}</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>All PACs combined</div>
        </div>
        <div className="kpi-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <TrendingDown size={18} style={{ color: 'var(--accent-red)' }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Total Expenditures</span>
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--accent-red)' }}>{formatMoney(totalExpenditures)}</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>All PACs combined</div>
        </div>
        <div className="kpi-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <DollarSign size={18} style={{ color: 'var(--accent-gold)' }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Avg Cash on Hand</span>
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--accent-gold)' }}>{formatMoney(avgCashOnHand)}</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>Per PAC average</div>
        </div>
      </div>

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 20, marginTop: 20 }}>
        <div className="chart-card">
          <h4 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
            Top 15 PACs by Receipts
          </h4>
          {topPACsByReceipts.length > 0 ? (
            <ResponsiveContainer width="100%" height={Math.max(300, topPACsByReceipts.length * 26 + 40)}>
              <BarChart data={topPACsByReceipts} layout="vertical" margin={{ left: 180 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
                <XAxis type="number" stroke={AXIS_COLOR} tick={{ fontSize: 11 }} tickFormatter={formatMoney} />
                <YAxis dataKey="name" type="category" stroke={AXIS_COLOR} width={170} tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={chartTooltipStyle} formatter={(val) => formatMoneyFull(val)} />
                <Bar dataKey="receipts" fill="var(--accent-green)" radius={[0, 3, 3, 0]} name="Receipts" />
              </BarChart>
            </ResponsiveContainer>
          ) : <p style={{ color: 'var(--text-secondary)' }}>No data available</p>}
        </div>

        <div className="chart-card">
          <h4 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
            Top 15 PACs by Expenditures
          </h4>
          {topPACsByExpenditures.length > 0 ? (
            <ResponsiveContainer width="100%" height={Math.max(300, topPACsByExpenditures.length * 26 + 40)}>
              <BarChart data={topPACsByExpenditures} layout="vertical" margin={{ left: 180 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
                <XAxis type="number" stroke={AXIS_COLOR} tick={{ fontSize: 11 }} tickFormatter={formatMoney} />
                <YAxis dataKey="name" type="category" stroke={AXIS_COLOR} width={170} tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={chartTooltipStyle} formatter={(val) => formatMoneyFull(val)} />
                <Bar dataKey="expenditures" fill="var(--accent-red)" radius={[0, 3, 3, 0]} name="Expenditures" />
              </BarChart>
            </ResponsiveContainer>
          ) : <p style={{ color: 'var(--text-secondary)' }}>No data available</p>}
        </div>
      </div>

      {/* Comparison Chart */}
      <div className="chart-card" style={{ marginTop: 20 }}>
        <h4 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
          Receipts vs Expenditures â Top 10
        </h4>
        {comparisonData.length > 0 ? (
          <ResponsiveContainer width="100%" height={360}>
            <BarChart data={comparisonData} margin={{ top: 10, right: 30, left: 20, bottom: 80 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
              <XAxis dataKey="name" angle={-35} textAnchor="end" height={100} stroke={AXIS_COLOR} tick={{ fontSize: 11 }} />
              <YAxis stroke={AXIS_COLOR} tick={{ fontSize: 11 }} tickFormatter={formatMoney} />
              <Tooltip contentStyle={chartTooltipStyle} formatter={(val) => formatMoneyFull(val)} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="receipts" fill="var(--accent-green)" radius={[4, 4, 0, 0]} name="Receipts" />
              <Bar dataKey="expenditures" fill="var(--accent-red)" radius={[4, 4, 0, 0]} name="Expenditures" />
            </BarChart>
          </ResponsiveContainer>
        ) : <p style={{ color: 'var(--text-secondary)' }}>No data available</p>}
      </div>

      {/* Search */}
      <div className="chart-card" style={{ marginTop: 20 }}>
        <h4 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
          <Search size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />
          Search PACs
        </h4>
        <div style={{ position: 'relative', marginBottom: 12 }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-secondary)', pointerEvents: 'none' }} />
          <input
            type="text"
            placeholder="Search PAC names..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setPage(0); }}
            style={{
              width: '100%', padding: '10px 14px 10px 36px', border: '1px solid var(--border)',
              borderRadius: 8, fontSize: 14, background: 'var(--bg-primary)',
              color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          Showing {filteredData.length} of {data.length} PACs
        </span>
      </div>

      {/* Table */}
      <div className="chart-card" style={{ marginTop: 16 }}>
        <h4 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
          All PACs â {year}
        </h4>
        <div className="data-table-wrapper">
          {pagedData.length > 0 ? (
            <>
              <table className="data-table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left' }}>#</th>
                    <th style={{ textAlign: 'left' }}>PAC Name</th>
                    <SortHeader column="receipts" label="Receipts" />
                    <SortHeader column="expenditures" label="Expenditures" />
                    <SortHeader column="cashOnHand" label="Cash on Hand" />
                  </tr>
                </thead>
                <tbody>
                  {pagedData.map((pac, index) => (
                    <tr key={index}>
                      <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{page * PAGE_SIZE + index + 1}</td>
                      <td style={{ fontWeight: 600, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pac.name}</td>
                      <td style={{ color: 'var(--accent-green)', fontWeight: 600 }}>{formatMoney(pac.receipts || 0)}</td>
                      <td style={{ color: 'var(--accent-red)', fontWeight: 600 }}>{formatMoney(pac.expenditures || 0)}</td>
                      <td style={{ color: 'var(--accent-gold)', fontWeight: 600 }}>{formatMoney(pac.cashOnHand || 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 16 }}>
                  <button
                    disabled={page === 0}
                    onClick={() => setPage(p => p - 1)}
                    style={{ padding: '6px 14px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-primary)', color: 'var(--text-primary)', cursor: page === 0 ? 'not-allowed' : 'pointer', opacity: page === 0 ? 0.4 : 1 }}
                  >Prev</button>
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                    Page {page + 1} of {totalPages}
                  </span>
                  <button
                    disabled={page >= totalPages - 1}
                    onClick={() => setPage(p => p + 1)}
                    style={{ padding: '6px 14px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-primary)', color: 'var(--text-primary)', cursor: page >= totalPages - 1 ? 'not-allowed' : 'pointer', opacity: page >= totalPages - 1 ? 0.4 : 1 }}
                  >Next</button>
                </div>
              )}
            </>
          ) : (
            <p style={{ color: 'var(--text-secondary)', padding: 20, textAlign: 'center' }}>
              No PACs found matching your search.
            </p>
          )}
        </div>
      </div>

      {/* Source */}
      <div style={{ marginTop: 16, padding: '12px 16px', background: 'rgba(114,9,183,0.04)', borderRadius: 8, borderLeft: '4px solid #7209b7' }}>
        <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          Data sourced from Massachusetts OCPF. PAC financial data includes receipts, expenditures, and cash on hand as reported.
        </p>
      </div>
    </div>
  );
}
