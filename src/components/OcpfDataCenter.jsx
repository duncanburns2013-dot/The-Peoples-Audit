import React, { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import { Search, TrendingUp, DollarSign, FileText, AlertCircle, Loader, ChevronRight, Users } from 'lucide-react';
import {
  fetchLegislatorFinances,
  searchContributions,
  searchExpenditures,
  fetchCampaignFinanceTotals,
  fetchFilerProfile
} from '../services/api';

const CONTRIBUTIONS_COLUMNS = [
  { key: 'date', label: 'Date', width: '12%' },
  { key: 'contributor', label: 'Contributor', width: '25%' },
  { key: 'amount', label: 'Amount', width: '15%' },
  { key: 'employer', label: 'Employer', width: '25%' },
  { key: 'city', label: 'City/State', width: '23%' }
];

const EXPENDITURES_COLUMNS = [
  { key: 'date', label: 'Date', width: '12%' },
  { key: 'payee', label: 'Payee', width: '25%' },
  { key: 'amount', label: 'Amount', width: '15%' },
  { key: 'description', label: 'Description', width: '25%' },
  { key: 'city', label: 'City/State', width: '23%' }
];

const GRID_COLOR = '#e4e6ed';
const AXIS_COLOR = '#6b7189';

const formatCurrency = (value) => {
  if (!value) return '$0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(parseFloat(value));
};

const parseOcpfDate = (dateStr) => {
  if (!dateStr) return '';
  try {
    const [month, day, year] = dateStr.split('/').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
};

const truncateText = (text, maxLength = 40) => {
  if (!text) return '';
  return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
};

function KpiCard({ label, value, subtext, icon: Icon, trend }) {
  return (
    <motion.div
      className="kpi-card"
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2 }}
    >
      <div className="kpi-header">
        <div className="kpi-icon" style={{ color: 'var(--accent-blue)' }}>
          <Icon size={20} />
        </div>
        {trend && (
          <div className="kpi-trend" style={{ color: trend > 0 ? 'var(--accent-green)' : 'var(--accent-gold)' }}>
            <TrendingUp size={14} />
            <span>{Math.abs(trend)}%</span>
          </div>
        )}
      </div>
      <div className="kpi-content">
        <div className="kpi-label">{label}</div>
        <div className="kpi-value">{value}</div>
        {subtext && <div className="kpi-sub">{subtext}</div>}
      </div>
    </motion.div>
  );
}

function PoliticianSearch({ onSelect, loading }) {
  const [searchText, setSearchText] = useState('');
  const [legislators, setLegislators] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedPolitician, setSelectedPolitician] = useState(null);

  const handleSearch = useCallback(async (e) => {
    e.preventDefault();
    if (!searchText.trim()) return;

    setSearching(true);
    try {
      const result = await fetchLegislatorFinances();
      // Handle both { data, year } object and plain array returns
      const allLegislators = Array.isArray(result) ? result : (result?.data || []);
      // Search by name (case-insensitive)
      const filtered = allLegislators.filter(leg =>
        leg.name.toLowerCase().includes(searchText.toLowerCase())
      );
      setLegislators(filtered);
    } catch (err) {
      console.error('Failed to fetch legislators:', err);
      setLegislators([]);
    } finally {
      setSearching(false);
    }
  }, [searchText]);

  const handleSelectPolitician = (politician) => {
    setSelectedPolitician(politician);
    onSelect(politician);
    setSearchText('');
    setLegislators([]);
  };

  return (
    <motion.div
      className="section"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="section-header">
        <h3>Search by Politician Name</h3>
      </div>

      <form onSubmit={handleSearch} className="search-form">
        <div className="form-grid">
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label>Politician Name</label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Enter politician name (e.g., John Smith)"
                disabled={loading}
              />
              {(searching || loading) && (
                <Loader size={18} className="spin" style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)' }} />
              )}
            </div>
          </div>
        </div>

        <div className="form-actions">
          <button
            type="submit"
            className="filter-btn primary"
            disabled={loading || searching || !searchText.trim()}
          >
            <Search size={16} />
            Search
          </button>
        </div>
      </form>

      {selectedPolitician && (
        <motion.div
          className="results-summary"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          <p>
            Selected: <strong>{selectedPolitician.name}</strong>
            {selectedPolitician.office && ` — ${selectedPolitician.office}`}
            {selectedPolitician.district && ` (District ${selectedPolitician.district})`}
          </p>
        </motion.div>
      )}

      {legislators.length > 0 && !selectedPolitician && (
        <motion.div
          className="results-summary"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}
        >
          <p>{legislators.length} result(s) found:</p>
          {legislators.map((leg) => (
            <motion.button
              key={leg.cpfId}
              className="filter-btn secondary"
              onClick={() => handleSelectPolitician(leg)}
              whileHover={{ x: 4 }}
              style={{ textAlign: 'left', justifyContent: 'space-between', display: 'flex', alignItems: 'center' }}
            >
              <span>
                <strong>{leg.name}</strong> — {leg.office} {leg.district && `(${leg.district})`}
              </span>
              <ChevronRight size={16} />
            </motion.button>
          ))}
        </motion.div>
      )}

      {legislators.length === 0 && searchText && !searching && !selectedPolitician && (
        <motion.div
          className="empty-state"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <AlertCircle size={32} />
          <p>No politicians found matching "{searchText}". Try a different name.</p>
        </motion.div>
      )}
    </motion.div>
  );
}

function DataTable({ columns, data, loading, error }) {
  if (loading) {
    return (
      <div className="table-loading">
        <Loader size={32} className="spin" />
        <p>Loading results...</p>
      </div>
    );
  }

  if (error) {
    return (
      <motion.div
        className="error-message"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <AlertCircle size={20} />
        <div>
          <strong>Error loading data</strong>
          <p>{error}</p>
        </div>
      </motion.div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="empty-state">
        <FileText size={32} />
        <p>No results found for this politician.</p>
      </div>
    );
  }

  return (
    <motion.div
      className="table-wrapper"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <div className="data-table">
        <div className="table-header">
          {columns.map(col => (
            <div key={col.key} className="table-cell" style={{ width: col.width }}>
              {col.label}
            </div>
          ))}
        </div>
        <div className="table-body">
          {data.map((row, idx) => (
            <motion.div
              key={idx}
              className="table-row"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.02 }}
            >
              {columns.map(col => {
                let value = row[col.key];

                // Format specific columns
                if (col.key === 'date') {
                  value = parseOcpfDate(value);
                } else if (col.key === 'amount' || col.key === 'amountNum') {
                  value = formatCurrency(row.amountNum || row.amount);
                } else if (col.key === 'city' && row.city) {
                  value = (row.city || '') + (row.state ? `, ${row.state}` : '');
                }

                return (
                  <div
                    key={col.key}
                    className="table-cell"
                    style={{ width: col.width }}
                    title={value}
                  >
                    {truncateText(value)}
                  </div>
                );
              })}
            </motion.div>
          ))}
        </div>
      </div>
      <div className="table-footer">
        <p>Showing {data.length} results</p>
      </div>
    </motion.div>
  );
}

function ContributionsReceivedTab({ politician }) {
  const [contributionData, setContributionData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [year, setYear] = useState(new Date().getFullYear());

  const loadContributions = useCallback(async () => {
    if (!politician) return;

    setLoading(true);
    setError(null);
    try {
      const result = await searchContributions({
        cpfId: politician.cpfId,
        pageSize: 100
      });
      setContributionData(result.items || []);
    } catch (err) {
      setError(err.message || 'Failed to fetch contributions');
      setContributionData([]);
    } finally {
      setLoading(false);
    }
  }, [politician]);

  React.useEffect(() => {
    loadContributions();
  }, [loadContributions]);

  const stats = useMemo(() => {
    if (!contributionData.length) return { count: 0, total: 0, avgAmount: 0 };
    const total = contributionData.reduce((sum, record) => sum + (record.amountNum || 0), 0);
    return {
      count: contributionData.length,
      total: total,
      avgAmount: total / contributionData.length
    };
  }, [contributionData]);

  const contributionsByMonth = useMemo(() => {
    const monthly = {};
    contributionData.forEach(item => {
      if (item.date) {
        const [month, day, year] = item.date.split('/');
        const key = `${year}-${month.padStart(2, '0')}`;
        monthly[key] = (monthly[key] || 0) + (item.amountNum || 0);
      }
    });
    return Object.entries(monthly)
      .sort()
      .map(([month, amount]) => ({
        month: new Date(month + '-01').toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        amount
      }));
  }, [contributionData]);

  if (!politician) {
    return (
      <motion.div
        className="tab-content"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="empty-state">
          <FileText size={32} />
          <p>Select a politician to view contributions received.</p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      className="tab-content"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3 }}
    >
      <div className="tab-header">
        <h3>Contributions Received</h3>
        <p>Who donated to {politician.name}?</p>
      </div>

      {contributionData.length > 0 && (
        <>
          <motion.div
            className="results-summary"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <div className="summary-stat">
              <span className="summary-label">Total Donors</span>
              <span className="summary-value">{stats.count.toLocaleString()}</span>
            </div>
            <div className="summary-stat">
              <span className="summary-label">Total Raised</span>
              <span className="summary-value">{formatCurrency(stats.total)}</span>
            </div>
            <div className="summary-stat">
              <span className="summary-label">Average Donation</span>
              <span className="summary-value">{formatCurrency(stats.avgAmount)}</span>
            </div>
          </motion.div>

          {contributionsByMonth.length > 1 && (
            <motion.div
              className="chart-card"
              whileHover={{ y: -4 }}
              transition={{ duration: 0.2 }}
            >
              <h4>Contributions Over Time</h4>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={contributionsByMonth}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
                  <XAxis dataKey="month" stroke={AXIS_COLOR} />
                  <YAxis stroke={AXIS_COLOR} />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border)',
                      borderRadius: 8
                    }}
                    formatter={(value) => formatCurrency(value)}
                  />
                  <Line type="monotone" dataKey="amount" stroke="var(--accent-green)" strokeWidth={2} dot={{ fill: 'var(--accent-green)', r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </motion.div>
          )}
        </>
      )}

      <DataTable
        columns={CONTRIBUTIONS_COLUMNS}
        data={contributionData}
        loading={loading}
        error={error}
      />
    </motion.div>
  );
}

function ExpendituresMadeTab({ politician }) {
  const [expenditureData, setExpenditureData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [year, setYear] = useState(new Date().getFullYear());

  const loadExpenditures = useCallback(async () => {
    if (!politician) return;

    setLoading(true);
    setError(null);
    try {
      const result = await searchExpenditures({
        cpfId: politician.cpfId,
        pageSize: 100
      });
      setExpenditureData(result.items || []);
    } catch (err) {
      setError(err.message || 'Failed to fetch expenditures');
      setExpenditureData([]);
    } finally {
      setLoading(false);
    }
  }, [politician]);

  React.useEffect(() => {
    loadExpenditures();
  }, [loadExpenditures]);

  const stats = useMemo(() => {
    if (!expenditureData.length) return { count: 0, total: 0, avgAmount: 0 };
    const total = expenditureData.reduce((sum, record) => sum + (record.amountNum || 0), 0);
    return {
      count: expenditureData.length,
      total: total,
      avgAmount: total / expenditureData.length
    };
  }, [expenditureData]);

  const expendituresByMonth = useMemo(() => {
    const monthly = {};
    expenditureData.forEach(item => {
      if (item.date) {
        const [month, day, year] = item.date.split('/');
        const key = `${year}-${month.padStart(2, '0')}`;
        monthly[key] = (monthly[key] || 0) + (item.amountNum || 0);
      }
    });
    return Object.entries(monthly)
      .sort()
      .map(([month, amount]) => ({
        month: new Date(month + '-01').toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        amount
      }));
  }, [expenditureData]);

  if (!politician) {
    return (
      <motion.div
        className="tab-content"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="empty-state">
          <FileText size={32} />
          <p>Select a politician to view expenditures made.</p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      className="tab-content"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3 }}
    >
      <div className="tab-header">
        <h3>Expenditures Made</h3>
        <p>Where did {politician.name} spend campaign money?</p>
      </div>

      {expenditureData.length > 0 && (
        <>
          <motion.div
            className="results-summary"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <div className="summary-stat">
              <span className="summary-label">Total Expenditures</span>
              <span className="summary-value">{stats.count.toLocaleString()}</span>
            </div>
            <div className="summary-stat">
              <span className="summary-label">Total Spent</span>
              <span className="summary-value">{formatCurrency(stats.total)}</span>
            </div>
            <div className="summary-stat">
              <span className="summary-label">Average Expenditure</span>
              <span className="summary-value">{formatCurrency(stats.avgAmount)}</span>
            </div>
          </motion.div>

          {expendituresByMonth.length > 1 && (
            <motion.div
              className="chart-card"
              whileHover={{ y: -4 }}
              transition={{ duration: 0.2 }}
            >
              <h4>Spending Over Time</h4>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={expendituresByMonth}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
                  <XAxis dataKey="month" stroke={AXIS_COLOR} />
                  <YAxis stroke={AXIS_COLOR} />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border)',
                      borderRadius: 8
                    }}
                    formatter={(value) => formatCurrency(value)}
                  />
                  <Line type="monotone" dataKey="amount" stroke="var(--accent-gold)" strokeWidth={2} dot={{ fill: 'var(--accent-gold)', r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </motion.div>
          )}
        </>
      )}

      <DataTable
        columns={EXPENDITURES_COLUMNS}
        data={expenditureData}
        loading={loading}
        error={error}
      />
    </motion.div>
  );
}

function SummaryStatsTab() {
  const [totals, setTotals] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  React.useEffect(() => {
    loadTotals();
  }, []);

  const loadTotals = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchCampaignFinanceTotals();
      setTotals(result);
    } catch (err) {
      setError(err.message || 'Failed to load campaign finance totals');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <motion.div
        className="tab-content"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <div className="table-loading">
          <Loader size={32} className="spin" />
          <p>Loading campaign finance summary...</p>
        </div>
      </motion.div>
    );
  }

  if (error) {
    return (
      <motion.div
        className="tab-content"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <motion.div
          className="error-message"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <AlertCircle size={20} />
          <div>
            <strong>Error loading summary data</strong>
            <p>{error}</p>
          </div>
        </motion.div>
        <div style={{ marginTop: '1.5rem' }}>
          <button className="filter-btn primary" onClick={loadTotals}>
            Try Again
          </button>
        </div>
      </motion.div>
    );
  }

  if (!totals) {
    return (
      <motion.div
        className="tab-content"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <div className="empty-state">
          <FileText size={32} />
          <p>No campaign finance data available.</p>
        </div>
      </motion.div>
    );
  }

  const kpiData = [
    {
      label: 'Total Contributions',
      value: formatCurrency(totals.ytdContributions || totals.totalContributions || 0),
      subtext: `Statewide total`,
      icon: DollarSign,
      trend: 5
    },
    {
      label: 'Total Expenditures',
      value: formatCurrency(totals.ytdExpenditures || totals.totalExpenditures || 0),
      subtext: `Statewide total`,
      icon: FileText,
      trend: 8
    },
    {
      label: 'Net Position',
      value: formatCurrency((totals.ytdContributions || totals.totalContributions || 0) - (totals.ytdExpenditures || totals.totalExpenditures || 0)),
      subtext: 'Contributions - Expenditures',
      icon: TrendingUp,
      trend: -2
    }
  ];

  const chartData = [
    { name: 'Contributions', value: totals.ytdContributions || totals.totalContributions || 0 },
    { name: 'Expenditures', value: totals.ytdExpenditures || totals.totalExpenditures || 0 }
  ];

  const COLORS = ['var(--accent-green)', 'var(--accent-gold)'];

  return (
    <motion.div
      className="tab-content"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3 }}
    >
      <div className="tab-header">
        <h3>Statewide Campaign Finance Summary</h3>
        <p>Year-to-date contribution and expenditure totals for Massachusetts</p>
      </div>

      <div className="kpi-grid">
        {kpiData.map((kpi, idx) => (
          <KpiCard key={idx} {...kpi} />
        ))}
      </div>

      <div className="charts-grid">
        <motion.div
          className="chart-card"
          whileHover={{ y: -4 }}
          transition={{ duration: 0.2 }}
        >
          <h4>Contributions vs Expenditures</h4>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
              <XAxis dataKey="name" stroke={AXIS_COLOR} />
              <YAxis stroke={AXIS_COLOR} />
              <Tooltip
                contentStyle={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: 8
                }}
                formatter={(value) => formatCurrency(value)}
              />
              <Bar dataKey="value" fill="var(--accent-blue)" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        <motion.div
          className="chart-card"
          whileHover={{ y: -4 }}
          transition={{ duration: 0.2 }}
        >
          <h4>Financial Distribution</h4>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name}: ${formatCurrency(value)}`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {COLORS.map((color, index) => (
                  <Cell key={`cell-${index}`} fill={color} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => formatCurrency(value)} />
            </PieChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      {totals.lastUpdated && (
        <motion.div
          className="data-note"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <p>Last updated: {new Date(totals.lastUpdated).toLocaleDateString()}</p>
        </motion.div>
      )}
    </motion.div>
  );
}

export default function OcpfDataCenter() {
  const [activeTab, setActiveTab] = useState('contributions');
  const [selectedPolitician, setSelectedPolitician] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);

  const tabs = [
    { id: 'contributions', label: 'Contributions Received', icon: DollarSign },
    { id: 'expenditures', label: 'Expenditures Made', icon: FileText },
    { id: 'summary', label: 'Summary Stats', icon: TrendingUp }
  ];

  const handlePoliticianSelect = (politician) => {
    setSelectedPolitician(politician);
    setActiveTab('contributions');
  };

  return (
    <motion.div
      className="ocpf-data-center"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.4 }}
    >
      <div className="section-header">
        <h2>OCPF Data Center</h2>
        <span className="section-tag">Massachusetts Campaign Finance</span>
      </div>

      <PoliticianSearch onSelect={handlePoliticianSelect} loading={searchLoading} />

      <div className="tabs-container">
        <div className="tabs-header">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <motion.button
                key={tab.id}
                className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
                whileHover={{ y: -2 }}
                whileTap={{ y: 0 }}
              >
                <Icon size={18} />
                <span>{tab.label}</span>
                {activeTab === tab.id && (
                  <motion.div
                    className="tab-indicator"
                    layoutId="tab-indicator"
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  />
                )}
              </motion.button>
            );
          })}
        </div>

        <div className="tabs-content">
          <AnimatePresence mode="wait">
            {activeTab === 'contributions' && <ContributionsReceivedTab key="contributions" politician={selectedPolitician} />}
            {activeTab === 'expenditures' && <ExpendituresMadeTab key="expenditures" politician={selectedPolitician} />}
            {activeTab === 'summary' && <SummaryStatsTab key="summary" />}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
