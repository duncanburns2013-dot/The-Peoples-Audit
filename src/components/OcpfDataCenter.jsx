import React, { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Search, TrendingUp, DollarSign, FileText, AlertCircle, Loader, ChevronRight } from 'lucide-react';
import { searchContributions, searchExpenditures, fetchCampaignFinanceTotals } from '../services/api';
// Styles use existing index.css classes

const CONTRIBUTION_COLUMNS = [
  { key: 'date', label: 'Date', width: '12%' },
  { key: 'contributor_name', label: 'Contributor', width: '25%' },
  { key: 'amount', label: 'Amount', width: '15%' },
  { key: 'recipient_name', label: 'Recipient', width: '25%' },
  { key: 'city_state', label: 'City/State', width: '23%' }
];

const EXPENDITURE_COLUMNS = [
  { key: 'date', label: 'Date', width: '12%' },
  { key: 'vendor_name', label: 'Vendor', width: '25%' },
  { key: 'amount', label: 'Amount', width: '15%' },
  { key: 'purpose', label: 'Purpose', width: '25%' },
  { key: 'filer_name', label: 'Filer', width: '23%' }
];

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
        <div className="kpi-icon" style={{ color: 'var(--accent-purple)' }}>
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

function SearchForm({ onSearch, loading, type }) {
  const [formData, setFormData] = useState({
    name: '',
    firstName: '',
    lastName: '',
    cpfId: '',
    city: '',
    state: '',
    vendor: '',
    purpose: '',
    year: new Date().getFullYear(),
    minAmount: '',
    maxAmount: ''
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSearch(formData);
  };

  const handleReset = () => {
    const resetData = {
      name: '',
      firstName: '',
      lastName: '',
      cpfId: '',
      city: '',
      state: '',
      vendor: '',
      purpose: '',
      year: new Date().getFullYear(),
      minAmount: '',
      maxAmount: ''
    };
    setFormData(resetData);
    onSearch(resetData);
  };

  const isContribution = type === 'contribution';

  return (
    <motion.form
      className="search-form"
      onSubmit={handleSubmit}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="form-grid">
        {isContribution ? (
          <>
            <div className="form-group">
              <label>Full Name</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Enter contributor name"
              />
            </div>
            <div className="form-group">
              <label>First Name</label>
              <input
                type="text"
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                placeholder="First name"
              />
            </div>
            <div className="form-group">
              <label>Last Name</label>
              <input
                type="text"
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
                placeholder="Last name"
              />
            </div>
            <div className="form-group">
              <label>City</label>
              <input
                type="text"
                name="city"
                value={formData.city}
                onChange={handleChange}
                placeholder="City"
              />
            </div>
          </>
        ) : (
          <>
            <div className="form-group">
              <label>Vendor Name</label>
              <input
                type="text"
                name="vendor"
                value={formData.vendor}
                onChange={handleChange}
                placeholder="Enter vendor name"
              />
            </div>
            <div className="form-group">
              <label>Purpose</label>
              <input
                type="text"
                name="purpose"
                value={formData.purpose}
                onChange={handleChange}
                placeholder="Expenditure purpose"
              />
            </div>
            <div className="form-group">
              <label>City</label>
              <input
                type="text"
                name="city"
                value={formData.city}
                onChange={handleChange}
                placeholder="City"
              />
            </div>
            <div className="form-group">
              <label>State</label>
              <input
                type="text"
                name="state"
                value={formData.state}
                onChange={handleChange}
                placeholder="State"
                maxLength="2"
              />
            </div>
          </>
        )}
        <div className="form-group">
          <label>Year</label>
          <input
            type="number"
            name="year"
            value={formData.year}
            onChange={handleChange}
            min="2000"
            max={new Date().getFullYear()}
          />
        </div>
      </div>

      <div className="form-actions">
        <button
          type="submit"
          className="filter-btn primary"
          disabled={loading}
        >
          {loading ? (
            <>
              <Loader size={16} className="spin" />
              Searching...
            </>
          ) : (
            <>
              <Search size={16} />
              Search
            </>
          )}
        </button>
        <button
          type="button"
          className="filter-btn secondary"
          onClick={handleReset}
          disabled={loading}
        >
          Reset
        </button>
      </div>
    </motion.form>
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
        <p>No results found. Try adjusting your search criteria.</p>
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
                } else if (col.key === 'amount') {
                  value = formatCurrency(value);
                } else if (col.key === 'city_state' && !value) {
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

function ContributionTab() {
  const [searchParams, setSearchParams] = useState(null);
  const [contributionData, setContributionData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSearch = useCallback(async (params) => {
    setLoading(true);
    setError(null);
    try {
      const result = await searchContributions({
        ...params,
        pageSize: 50
      });
      setContributionData(result.records || []);
      setSearchParams(params);
    } catch (err) {
      setError(err.message || 'Failed to fetch contributions');
      setContributionData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const stats = useMemo(() => {
    if (!contributionData.length) return { count: 0, total: 0 };
    return {
      count: contributionData.length,
      total: contributionData.reduce((sum, record) => sum + (parseFloat(record.amount) || 0), 0)
    };
  }, [contributionData]);

  return (
    <motion.div
      className="tab-content"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3 }}
    >
      <div className="tab-header">
        <h3>Contribution Search</h3>
        <p>Search OCPF contributions by contributor name, recipient, location, or amount</p>
      </div>

      <SearchForm onSearch={handleSearch} loading={loading} type="contribution" />

      {contributionData.length > 0 && (
        <motion.div
          className="results-summary"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <div className="summary-stat">
            <span className="summary-label">Total Records</span>
            <span className="summary-value">{stats.count.toLocaleString()}</span>
          </div>
          <div className="summary-stat">
            <span className="summary-label">Total Contributions</span>
            <span className="summary-value">{formatCurrency(stats.total)}</span>
          </div>
        </motion.div>
      )}

      <DataTable
        columns={CONTRIBUTION_COLUMNS}
        data={contributionData}
        loading={loading}
        error={error}
      />
    </motion.div>
  );
}

function ExpenditureTab() {
  const [searchParams, setSearchParams] = useState(null);
  const [expenditureData, setExpenditureData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSearch = useCallback(async (params) => {
    setLoading(true);
    setError(null);
    try {
      const result = await searchExpenditures({
        vendor: params.vendor,
        cpfId: params.cpfId,
        city: params.city,
        state: params.state,
        year: params.year,
        pageSize: 50
      });
      setExpenditureData(result.records || []);
      setSearchParams(params);
    } catch (err) {
      setError(err.message || 'Failed to fetch expenditures');
      setExpenditureData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const stats = useMemo(() => {
    if (!expenditureData.length) return { count: 0, total: 0 };
    return {
      count: expenditureData.length,
      total: expenditureData.reduce((sum, record) => sum + (parseFloat(record.amount) || 0), 0)
    };
  }, [expenditureData]);

  return (
    <motion.div
      className="tab-content"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3 }}
    >
      <div className="tab-header">
        <h3>Expenditure Search</h3>
        <p>Search OCPF expenditures by vendor, purpose, location, or amount</p>
      </div>

      <SearchForm onSearch={handleSearch} loading={loading} type="expenditure" />

      {expenditureData.length > 0 && (
        <motion.div
          className="results-summary"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <div className="summary-stat">
            <span className="summary-label">Total Records</span>
            <span className="summary-value">{stats.count.toLocaleString()}</span>
          </div>
          <div className="summary-stat">
            <span className="summary-label">Total Expenditures</span>
            <span className="summary-value">{formatCurrency(stats.total)}</span>
          </div>
        </motion.div>
      )}

      <DataTable
        columns={EXPENDITURE_COLUMNS}
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
          <p>Loading campaign finance data...</p>
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
      label: 'YTD Contributions',
      value: formatCurrency(totals.ytdContributions),
      subtext: `${(totals.contributionCount || 0).toLocaleString()} records`,
      icon: DollarSign,
      trend: 5
    },
    {
      label: 'YTD Expenditures',
      value: formatCurrency(totals.ytdExpenditures),
      subtext: `${(totals.expenditureCount || 0).toLocaleString()} records`,
      icon: FileText,
      trend: 8
    },
    {
      label: 'Net YTD',
      value: formatCurrency((totals.ytdContributions || 0) - (totals.ytdExpenditures || 0)),
      subtext: 'Contributions - Expenditures',
      icon: TrendingUp,
      trend: -2
    }
  ];

  const chartData = [
    { name: 'Contributions', value: totals.ytdContributions || 0 },
    { name: 'Expenditures', value: totals.ytdExpenditures || 0 }
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
        <h3>Campaign Finance Summary</h3>
        <p>Year-to-date contribution and expenditure totals</p>
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
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" stroke="var(--text-secondary)" />
              <YAxis stroke="var(--text-secondary)" />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px'
                }}
                formatter={(value) => formatCurrency(value)}
              />
              <Bar dataKey="value" fill="var(--accent-purple)" radius={[8, 8, 0, 0]} />
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

  const tabs = [
    { id: 'contributions', label: 'Contributions', icon: DollarSign },
    { id: 'expenditures', label: 'Expenditures', icon: FileText },
    { id: 'summary', label: 'Summary Stats', icon: TrendingUp }
  ];

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
            {activeTab === 'contributions' && <ContributionTab key="contributions" />}
            {activeTab === 'expenditures' && <ExpenditureTab key="expenditures" />}
            {activeTab === 'summary' && <SummaryStatsTab key="summary" />}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
