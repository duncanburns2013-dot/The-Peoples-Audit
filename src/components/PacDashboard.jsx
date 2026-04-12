import React, { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from 'recharts';
import { Search, TrendingUp, TrendingDown, DollarSign, ArrowUpDown } from 'lucide-react';
import { fetchPACFinances } from '../services/api';
// Styles use existing index.css classes

const GRID_COLOR = '#e4e6ed';
const AXIS_COLOR = '#6b7189';
const COLORS = ['#4361ee', '#e76f51', '#2a9d8f', '#e9c46a', '#264653', '#7209b7'];

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
      <div
        style={{
          backgroundColor: '#ffffff',
          border: '1px solid #dfe2ea',
          borderRadius: '8px',
          padding: '8px 12px',
          color: 'var(--text-primary)',
        }}
      >
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
  <th
    style={{
      cursor: 'pointer',
      userSelect: 'none',
      position: 'relative',
    }}
    onClick={() => onSort(column)}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      {label}
      {sorted.column === column && (
        <ArrowUpDown
          size={14}
          style={{
            color: 'var(--accent-purple)',
            transform: sorted.direction === 'desc' ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        />
      )}
    </div>
  </th>
);

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
        // Handle both { data, year } object and plain array returns
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
      filtered = filtered.filter(
        (pac) =>
          pac.name.toLowerCase().includes(query) ||
          (pac.type && pac.type.toLowerCase().includes(query))
      );
    }

    const sorted_data = [...filtered].sort((a, b) => {
      const aVal = a[sorted.column] || 0;
      const bVal = b[sorted.column] || 0;
      const comparison = aVal - bVal;
      return sorted.direction === 'desc' ? -comparison : comparison;
    });

    setFilteredData(sorted_data);
  }, [data, searchQuery, sorted]);

  const handleSort = (column) => {
    if (sorted.column === column) {
      setSorted({
        column,
        direction: sorted.direction === 'desc' ? 'asc' : 'desc',
      });
    } else {
      setSorted({ column, direction: 'desc' });
    }
  };

  const totalReceipts = data.reduce((sum, pac) => sum + (pac.receipts || 0), 0);
  const totalExpenditures = data.reduce((sum, pac) => sum + (pac.expenditures || 0), 0);
  const totalCashOnHand = data.reduce((sum, pac) => sum + (pac.cashOnHand || 0), 0);
  const avgCashOnHand = data.length > 0 ? totalCashOnHand / data.length : 0;

  const topPACsByReceipts = [...data]
    .sort((a, b) => (b.receipts || 0) - (a.receipts || 0))
    .slice(0, 20);

  const topPACsByExpenditures = [...data]
    .sort((a, b) => (b.expenditures || 0) - (a.expenditures || 0))
    .slice(0, 20);

  const expenditureVsReceipts = topPACsByReceipts.map((pac) => ({
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
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '32px',
        }}
      >
        <div>
          <h1 style={{ margin: '0 0 8px 0', color: 'var(--text-primary)' }}>PAC Dashboard</h1>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '14px' }}>
            Political Action Committee Financial Overview
          </p>
        </div>
        <select
          className="year-select"
          value={year}
          onChange={(e) => setYear(parseInt(e.target.value))}
          style={{
            padding: '8px 12px',
            borderRadius: '6px',
            border: '1px solid var(--border)',
            backgroundColor: 'var(--bg-primary)',
            color: 'var(--text-primary)',
            cursor: 'pointer',
            fontSize: '14px',
          }}
        >
          {[2026, 2025, 2024, 2023, 2022, 2021, 2020].map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
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
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(600px, 1fr))',
          gap: '24px',
          marginBottom: '32px',
        }}
      >
        {/* Top PACs by Receipts */}
        <div className="chart-card">
          <h2 className="section-header">
            <span className="section-tag">Top 20</span>
            PACs by Receipts
          </h2>
          {topPACsByReceipts.length > 0 ? (
            <ResponsiveContainer width="100%" height={400}>
              <BarChart
                data={topPACsByReceipts}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 200, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
                <XAxis type="number" stroke={AXIS_COLOR} style={{ fontSize: '12px' }} />
                <YAxis
                  dataKey="name"
                  type="category"
                  stroke={AXIS_COLOR}
                  style={{ fontSize: '11px' }}
                  width={195}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="receipts" fill="var(--accent-purple)" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p style={{ color: 'var(--text-secondary)' }}>No data available</p>
          )}
        </div>

        {/* Top PACs by Expenditures */}
        <div className="chart-card">
          <h2 className="section-header">
            <span className="section-tag">Top 20</span>
            PACs by Expenditures
          </h2>
          {topPACsByExpenditures.length > 0 ? (
            <ResponsiveContainer width="100%" height={400}>
              <BarChart
                data={topPACsByExpenditures}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 200, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
                <XAxis type="number" stroke={AXIS_COLOR} style={{ fontSize: '12px' }} />
                <YAxis
                  dataKey="name"
                  type="category"
                  stroke={AXIS_COLOR}
                  style={{ fontSize: '11px' }}
                  width={195}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="expenditures" fill="#ff006e" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p style={{ color: 'var(--text-secondary)' }}>No data available</p>
          )}
        </div>
      </div>

      {/* Comparison Chart */}
      <div className="chart-card" style={{ marginBottom: '32px' }}>
        <h2 className="section-header">
          <span className="section-tag">Top 20</span>
          Receipts vs Expenditures
        </h2>
        {expenditureVsReceipts.length > 0 ? (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart
              data={expenditureVsReceipts}
              margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
              <XAxis
                dataKey="name"
                angle={-45}
                textAnchor="end"
                height={100}
                stroke={AXIS_COLOR}
                style={{ fontSize: '12px' }}
              />
              <YAxis stroke={AXIS_COLOR} style={{ fontSize: '12px' }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ color: 'var(--text-secondary)', fontSize: '12px' }}
                iconType="square"
              />
              <Bar dataKey="receipts" fill="var(--accent-green)" radius={[8, 8, 0, 0]} />
              <Bar dataKey="expenditures" fill="#ff006e" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p style={{ color: 'var(--text-secondary)' }}>No data available</p>
        )}
      </div>

      {/* Search and Filter */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <h2 className="section-header">
          <span className="section-tag">Search</span>
          PACs
        </h2>
        <div style={{ position: 'relative' }}>
          <Search
            size={18}
            style={{
              position: 'absolute',
              left: '12px',
              top: '12px',
              color: 'var(--text-secondary)',
              pointerEvents: 'none',
            }}
          />
          <input
            type="text"
            placeholder="Search PAC names..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px 10px 40px',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              backgroundColor: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              fontSize: '14px',
              boxSizing: 'border-box',
            }}
          />
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '8px' }}>
          Showing {filteredData.length} of {data.length} PACs
        </p>
      </div>

      {/* PAC Table */}
      <div className="chart-card">
        <h2 className="section-header">
          <span className="section-tag">Table</span>
          All PACs
        </h2>
        <div style={{ overflowX: 'auto' }}>
          {filteredData.length > 0 ? (
            <table className="data-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>PAC Name</th>
                  <PACTableHeader
                    column="receipts"
                    label="Receipts"
                    sorted={sorted}
                    onSort={handleSort}
                  />
                  <PACTableHeader
                    column="expenditures"
                    label="Expenditures"
                    sorted={sorted}
                    onSort={handleSort}
                  />
                  <PACTableHeader
                    column="cashOnHand"
                    label="Cash on Hand"
                    sorted={sorted}
                    onSort={handleSort}
                  />
                </tr>
              </thead>
              <tbody>
                {filteredData.map((pac, index) => (
                  <tr
                    key={index}
                    onClick={() => setSelectedPAC(pac)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td style={{ textAlign: 'left', fontWeight: '500' }}>{pac.name}</td>
                    <td style={{ color: 'var(--accent-green)', fontWeight: '500' }}>
                      {formatMoney(pac.receipts || 0)}
                    </td>
                    <td style={{ color: '#ff006e', fontWeight: '500' }}>
                      {formatMoney(pac.expenditures || 0)}
                    </td>
                    <td style={{ color: 'var(--accent-gold)', fontWeight: '500' }}>
                      {formatMoney(pac.cashOnHand || 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p style={{ color: 'var(--text-secondary)', padding: '20px', textAlign: 'center' }}>
              No PACs found matching your search.
            </p>
          )}
        </div>
      </div>

      {/* PAC Detail Panel */}
      {selectedPAC && (
        <div className="detail-panel" style={{
          position: 'fixed',
          top: 0,
          right: 0,
          width: '400px',
          height: '100vh',
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderLeft: '2px solid var(--accent-purple)',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
          overflowY: 'auto',
          zIndex: 1000,
          padding: '24px',
        }}>
          <button
            className="close-btn"
            onClick={() => setSelectedPAC(null)}
            style={{
              position: 'absolute',
              top: '16px',
              right: '16px',
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: 'var(--text-secondary)',
            }}
          >
            ×
          </button>

          <h3 style={{ marginTop: 0, marginBottom: '8px', color: 'var(--text-primary)' }}>
            {selectedPAC.name}
          </h3>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
            Financial overview from OCPF (Massachusetts Office of Campaign and Political Finance)
          </p>

          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '16px',
            marginBottom: '24px',
          }}>
            <div style={{
              padding: '12px',
              backgroundColor: 'var(--bg-primary)',
              borderRadius: '6px',
              border: '1px solid var(--border)',
            }}>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                Receipts
              </div>
              <div style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--accent-green)' }}>
                {formatMoney(selectedPAC.receipts || 0)}
              </div>
            </div>
            <div style={{
              padding: '12px',
              backgroundColor: 'var(--bg-primary)',
              borderRadius: '6px',
              border: '1px solid var(--border)',
            }}>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                Expenditures
              </div>
              <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#ff006e' }}>
                {formatMoney(selectedPAC.expenditures || 0)}
              </div>
            </div>
            <div style={{
              gridColumn: '1 / -1',
              padding: '12px',
              backgroundColor: 'var(--bg-primary)',
              borderRadius: '6px',
              border: '1px solid var(--border)',
            }}>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                Cash on Hand
              </div>
              <div style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--accent-gold)' }}>
                {formatMoney(selectedPAC.cashOnHand || 0)}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
