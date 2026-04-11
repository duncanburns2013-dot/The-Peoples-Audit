import React, { useState, useCallback, useMemo } from 'react';
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import {
  Search, TrendingUp, DollarSign, FileText, AlertCircle, Loader,
  ChevronRight, Users, Building2, ExternalLink
} from 'lucide-react';
import { searchContributions, searchExpenditures, fetchCampaignFinanceTotals } from '../services/api';

const COLORS = ['#14558F', '#32784E', '#680A1D', '#FFC72C', '#00A9CE', '#7209b7', '#e76f51', '#264653'];

const formatCurrency = (value) => {
  if (!value) return '$0';
  const num = parseFloat(value);
  if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
  if (num >= 1e6) return `$${(num / 1e6).toFixed(1)}M`;
  if (num >= 1e3) return `$${(num / 1e3).toFixed(0)}K`;
  return `$${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatCurrencyFull = (value) => {
  if (!value) return '$0.00';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(parseFloat(value));
};

const chartTooltipStyle = {
  background: 'var(--bg-card)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  fontSize: '0.85rem',
  boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
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

function SearchForm({ onSearch, loading, type }) {
  const [formData, setFormData] = useState({
    name: '', firstName: '', lastName: '', cpfId: '', city: '', state: '',
    vendor: '', purpose: '', year: new Date().getFullYear(), minAmount: '', maxAmount: ''
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
      name: '', firstName: '', lastName: '', cpfId: '', city: '', state: '',
      vendor: '', purpose: '', year: new Date().getFullYear(), minAmount: '', maxAmount: ''
    };
    setFormData(resetData);
  };

  const isContribution = type === 'contribution';

  const inputStyle = {
    width: '100%', padding: '10px 14px', border: '1px solid var(--border)',
    borderRadius: 8, fontSize: 14, background: 'var(--bg-primary)',
    color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box',
  };

  const labelStyle = {
    display: 'block', fontSize: 12, fontWeight: 600,
    color: 'var(--text-secondary)', marginBottom: 4, textTransform: 'uppercase',
    letterSpacing: 0.5,
  };

  return (
    <form onSubmit={handleSubmit} style={{ marginBottom: 20 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 16 }}>
        {isContribution ? (
          <>
            <div>
              <label style={labelStyle}>Full Name</label>
              <input type="text" name="name" value={formData.name} onChange={handleChange} placeholder="Contributor name" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>First Name</label>
              <input type="text" name="firstName" value={formData.firstName} onChange={handleChange} placeholder="First name" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Last Name</label>
              <input type="text" name="lastName" value={formData.lastName} onChange={handleChange} placeholder="Last name" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>City</label>
              <input type="text" name="city" value={formData.city} onChange={handleChange} placeholder="City" style={inputStyle} />
            </div>
          </>
        ) : (
          <>
            <div>
              <label style={labelStyle}>Vendor Name</label>
              <input type="text" name="vendor" value={formData.vendor} onChange={handleChange} placeholder="Vendor name" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Purpose</label>
              <input type="text" name="purpose" value={formData.purpose} onChange={handleChange} placeholder="Expenditure purpose" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>City</label>
              <input type="text" name="city" value={formData.city} onChange={handleChange} placeholder="City" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>State</label>
              <input type="text" name="state" value={formData.state} onChange={handleChange} placeholder="MA" maxLength="2" style={inputStyle} />
            </div>
          </>
        )}
        <div>
          <label style={labelStyle}>Year</label>
          <input type="number" name="year" value={formData.year} onChange={handleChange} min="2000" max={new Date().getFullYear()} style={inputStyle} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="submit" disabled={loading} style={{
          padding: '10px 24px', background: loading ? 'var(--border)' : 'var(--accent-blue)',
          color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600,
          cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6,
        }}>
          {loading ? <><Loader size={16} style={{ animation: 'spin 1s linear infinite' }} /> Searching...</> : <><Search size={16} /> Search</>}
        </button>
        <button type="button" onClick={handleReset} disabled={loading} style={{
          padding: '10px 20px', background: 'transparent', color: 'var(--text-secondary)',
          border: '1px solid var(--border)', borderRadius: 8, fontSize: 14, cursor: 'pointer',
        }}>Reset</button>
      </div>
    </form>
  );
}

function ContributionTab() {
  const [contributionData, setContributionData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSearch = useCallback(async (params) => {
    setLoading(true);
    setError(null);
    try {
      const result = await searchContributions({ ...params, pageSize: 50 });
      setContributionData(result.records || []);
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
      total: contributionData.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0)
    };
  }, [contributionData]);

  return (
    <div>
      <h3 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
        <DollarSign size={18} style={{ verticalAlign: 'middle', marginRight: 6 }} />
        Contribution Search
      </h3>
      <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--text-secondary)' }}>
        Search OCPF contributions by contributor name, recipient, location, or amount
      </p>

      <SearchForm onSearch={handleSearch} loading={loading} type="contribution" />

      {contributionData.length > 0 && (
        <div className="kpi-row" style={{ marginBottom: 16 }}>
          <div className="kpi-card">
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 4 }}>Records Found</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)' }}>{stats.count.toLocaleString()}</div>
          </div>
          <div className="kpi-card">
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 4 }}>Total Contributions</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--accent-green)' }}>{formatCurrencyFull(stats.total)}</div>
          </div>
        </div>
      )}

      {error && (
        <div style={{ padding: '12px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8, color: '#991b1b', fontSize: 14, marginBottom: 16 }}>
          <AlertCircle size={18} /> <span>{error}</span>
        </div>
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>
          <Loader size={32} style={{ animation: 'spin 1s linear infinite', marginBottom: 12 }} />
          <p style={{ margin: 0 }}>Loading results...</p>
        </div>
      )}

      {!loading && contributionData.length > 0 && (
        <div className="data-table-wrapper">
          <table className="data-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Contributor</th>
                <th>Amount</th>
                <th>Recipient</th>
                <th>City/State</th>
              </tr>
            </thead>
            <tbody>
              {contributionData.map((row, idx) => (
                <tr key={idx}>
                  <td style={{ whiteSpace: 'nowrap' }}>{parseOcpfDate(row.date)}</td>
                  <td style={{ fontWeight: 600, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.contributor_name || 'N/A'}</td>
                  <td className="money" style={{ color: 'var(--accent-green)', fontWeight: 700 }}>{formatCurrencyFull(row.amount)}</td>
                  <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.recipient_name || 'N/A'}</td>
                  <td>{(row.city || '') + (row.state ? `, ${row.state}` : '')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && !error && contributionData.length === 0 && (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>
          <Search size={32} style={{ marginBottom: 12, opacity: 0.4 }} />
          <p style={{ margin: 0 }}>Search for contributions using the form above.</p>
        </div>
      )}
    </div>
  );
}

function ExpenditureTab() {
  const [expenditureData, setExpenditureData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSearch = useCallback(async (params) => {
    setLoading(true);
    setError(null);
    try {
      const result = await searchExpenditures({
        vendor: params.vendor, cpfId: params.cpfId, city: params.city,
        state: params.state, year: params.year, pageSize: 50
      });
      setExpenditureData(result.records || []);
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
      total: expenditureData.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0)
    };
  }, [expenditureData]);

  return (
    <div>
      <h3 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
        <FileText size={18} style={{ verticalAlign: 'middle', marginRight: 6 }} />
        Expenditure Search
      </h3>
      <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--text-secondary)' }}>
        Search OCPF expenditures by vendor, purpose, location, or amount
      </p>

      <SearchForm onSearch={handleSearch} loading={loading} type="expenditure" />

      {expenditureData.length > 0 && (
        <div className="kpi-row" style={{ marginBottom: 16 }}>
          <div className="kpi-card">
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 4 }}>Records Found</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)' }}>{stats.count.toLocaleString()}</div>
          </div>
          <div className="kpi-card">
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 4 }}>Total Expenditures</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#E67E22' }}>{formatCurrencyFull(stats.total)}</div>
          </div>
        </div>
      )}

      {error && (
        <div style={{ padding: '12px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8, color: '#991b1b', fontSize: 14, marginBottom: 16 }}>
          <AlertCircle size={18} /> <span>{error}</span>
        </div>
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>
          <Loader size={32} style={{ animation: 'spin 1s linear infinite', marginBottom: 12 }} />
          <p style={{ margin: 0 }}>Loading results...</p>
        </div>
      )}

      {!loading && expenditureData.length > 0 && (
        <div className="data-table-wrapper">
          <table className="data-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Vendor</th>
                <th>Amount</th>
                <th>Purpose</th>
                <th>Filer</th>
              </tr>
            </thead>
            <tbody>
              {expenditureData.map((row, idx) => (
                <tr key={idx}>
                  <td style={{ whiteSpace: 'nowrap' }}>{parseOcpfDate(row.date)}</td>
                  <td style={{ fontWeight: 600, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.vendor_name || 'N/A'}</td>
                  <td className="money" style={{ color: '#E67E22', fontWeight: 700 }}>{formatCurrencyFull(row.amount)}</td>
                  <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.purpose || 'N/A'}</td>
                  <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.filer_name || 'N/A'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && !error && expenditureData.length === 0 && (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>
          <Search size={32} style={{ marginBottom: 12, opacity: 0.4 }} />
          <p style={{ margin: 0 }}>Search for expenditures using the form above.</p>
        </div>
      )}
    </div>
  );
}

function SummaryStatsTab() {
  const [totals, setTotals] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  React.useEffect(() => { loadTotals(); }, []);

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
      <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>
        <Loader size={32} style={{ animation: 'spin 1s linear infinite', marginBottom: 12 }} />
        <p style={{ margin: 0 }}>Loading campaign finance data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <div style={{ padding: '12px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8, color: '#991b1b', fontSize: 14 }}>
          <AlertCircle size={18} /> <span>{error}</span>
        </div>
        <button onClick={loadTotals} style={{ marginTop: 12, padding: '8px 20px', background: 'var(--accent-blue)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, cursor: 'pointer' }}>Try Again</button>
      </div>
    );
  }

  if (!totals) return null;

  const chartData = [
    { name: 'Contributions', value: totals.ytdContributions || 0 },
    { name: 'Expenditures', value: totals.ytdExpenditures || 0 }
  ];
  const net = (totals.ytdContributions || 0) - (totals.ytdExpenditures || 0);

  return (
    <div>
      <h3 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
        <TrendingUp size={18} style={{ verticalAlign: 'middle', marginRight: 6 }} />
        Campaign Finance Summary
      </h3>
      <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--text-secondary)' }}>
        Year-to-date contribution and expenditure totals from OCPF
      </p>

      <div className="kpi-row">
        <div className="kpi-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <DollarSign size={18} style={{ color: 'var(--accent-green)' }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>YTD Contributions</span>
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--accent-green)' }}>{formatCurrency(totals.ytdContributions)}</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>{(totals.contributionCount || 0).toLocaleString()} records</div>
        </div>
        <div className="kpi-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <FileText size={18} style={{ color: '#E67E22' }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>YTD Expenditures</span>
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#E67E22' }}>{formatCurrency(totals.ytdExpenditures)}</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>{(totals.expenditureCount || 0).toLocaleString()} records</div>
        </div>
        <div className="kpi-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <TrendingUp size={18} style={{ color: net >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Net YTD</span>
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: net >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>{formatCurrency(net)}</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>Contributions - Expenditures</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: 20, marginTop: 20 }}>
        <div className="chart-card">
          <h4 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Contributions vs Expenditures</h4>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
              <XAxis dataKey="name" stroke="rgba(0,0,0,0.4)" tick={{ fontSize: 12 }} />
              <YAxis stroke="rgba(0,0,0,0.4)" tick={{ fontSize: 12 }} tickFormatter={formatCurrency} />
              <Tooltip contentStyle={chartTooltipStyle} formatter={(val) => formatCurrencyFull(val)} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                <Cell fill="var(--accent-green)" />
                <Cell fill="#E67E22" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="chart-card">
          <h4 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Financial Distribution</h4>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ percent }) => `${(percent * 100).toFixed(0)}%`}>
                <Cell fill="var(--accent-green)" />
                <Cell fill="#E67E22" />
              </Pie>
              <Tooltip contentStyle={chartTooltipStyle} formatter={(val) => formatCurrencyFull(val)} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {totals.lastUpdated && (
        <p style={{ marginTop: 16, fontSize: 12, color: 'var(--text-secondary)' }}>
          Last updated: {new Date(totals.lastUpdated).toLocaleDateString()}
        </p>
      )}
    </div>
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
    <div className="section">
      <div className="section-header">
        <span className="section-tag" style={{ background: 'rgba(20,85,143,0.1)', color: 'var(--accent-blue)' }}>Campaign Finance</span>
        <h2>OCPF Data Center</h2>
        <p>Search Massachusetts campaign finance data. Contributions, expenditures, and summary statistics from OCPF.</p>
      </div>

      {/* Tab buttons */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'var(--bg-primary)', borderRadius: 10, padding: 4, border: '1px solid var(--border)' }}>
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                flex: 1, padding: '10px 16px', border: 'none', borderRadius: 8,
                background: isActive ? 'var(--bg-card)' : 'transparent',
                color: isActive ? 'var(--accent-blue)' : 'var(--text-secondary)',
                fontWeight: isActive ? 700 : 500, fontSize: 14, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="chart-card">
        {activeTab === 'contributions' && <ContributionTab />}
        {activeTab === 'expenditures' && <ExpenditureTab />}
        {activeTab === 'summary' && <SummaryStatsTab />}
      </div>

      {/* Source note */}
      <div style={{ marginTop: 16, padding: '12px 16px', background: 'rgba(20,85,143,0.04)', borderRadius: 8, borderLeft: '4px solid var(--accent-blue)' }}>
        <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          Data sourced from the Massachusetts Office of Campaign and Political Finance (OCPF).
          All campaign finance records are public under Massachusetts General Laws Chapter 55.
        </p>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
