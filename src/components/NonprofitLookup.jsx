import React, { useState, useCallback } from 'react';
import {
  Search,
  Building2,
  DollarSign,
  Heart,
  ExternalLink,
  Loader,
  AlertCircle,
  ChevronRight,
  TrendingUp,
  Users,
  PieChart,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';

const formatMoney = (n) => {
  if (!n) return '$0';
  if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(1) + 'B';
  if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
  if (Math.abs(n) >= 1e3) return '$' + (n / 1e3).toFixed(0) + 'K';
  return '$' + n.toLocaleString();
};

const TOP_MA_NONPROFITS = [
  { name: 'Partners HealthCare', ein: '042103580', revenue: 18200000000, city: 'Boston' },
  { name: 'Harvard University', ein: '042103580', revenue: 16500000000, city: 'Cambridge' },
  { name: 'MIT', ein: '042103427', revenue: 11200000000, city: 'Cambridge' },
  { name: 'Mass General Hospital', ein: '042103465', revenue: 4200000000, city: 'Boston' },
  { name: 'Brigham & Women\'s', ein: '042103548', revenue: 3100000000, city: 'Boston' },
  { name: 'Boston Children\'s Hospital', ein: '042103527', revenue: 2400000000, city: 'Boston' },
  { name: 'Boston University', ein: '042103329', revenue: 2100000000, city: 'Boston' },
  { name: 'Boston Medical Center', ein: '042103601', revenue: 2000000000, city: 'Boston' },
  { name: 'Dana-Farber Cancer Institute', ein: '042103562', revenue: 1500000000, city: 'Boston' },
  { name: 'WGBH Educational Foundation', ein: '042106029', revenue: 320000000, city: 'Boston' },
];

const MA_NONPROFIT_STATS = {
  totalNonprofits: 40000,
  totalRevenue: 120000000000,
  topSectors: ['Healthcare', 'Education', 'Human Services', 'Arts & Culture', 'Religion'],
};

const chartTooltipStyle = {
  background: 'var(--bg-card)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  fontSize: 13,
  padding: '8px 12px',
};

export default function NonprofitLookup() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedOrg, setSelectedOrg] = useState(null);
  const [orgDetails, setOrgDetails] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [totalResults, setTotalResults] = useState(0);

  const handleSearch = useCallback(async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsLoading(true);
    setError(null);
    setSearchResults([]);
    setSelectedOrg(null);
    setOrgDetails(null);

    try {
      const response = await fetch(
        `https://projects.propublica.org/nonprofits/api/v2/search.json?q=${encodeURIComponent(searchQuery)}&state[id]=MA&page=1`
      );
      if (!response.ok) throw new Error('Search failed');
      const data = await response.json();
      setSearchResults(data.organizations || []);
      setTotalResults(data.total_results || 0);
    } catch (err) {
      setError('Failed to search nonprofits. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery]);

  const handleSelectOrg = useCallback(async (ein) => {
    setIsLoading(true);
    setError(null);
    setOrgDetails(null);
    setSelectedOrg(ein);

    try {
      const response = await fetch(
        `https://projects.propublica.org/nonprofits/api/v2/organizations/${ein}.json`
      );
      if (!response.ok) throw new Error('Failed to fetch organization details');
      const data = await response.json();
      setOrgDetails(data.organization || null);
    } catch (err) {
      setError('Failed to load organization details. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getFilingsData = () => {
    if (!orgDetails?.filings || orgDetails.filings.length === 0) return [];
    return orgDetails.filings
      .slice(-10)
      .reverse()
      .map((filing) => ({
        year: filing.tax_year || filing.year,
        revenue: filing.totrevenue || 0,
        expenses: filing.totexpense || 0,
      }));
  };

  return (
    <div className="section">
      {/* Header */}
      <div className="section-header" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Heart size={28} style={{ color: '#E74C3C' }} />
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>
            Massachusetts Nonprofit Explorer
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--text-secondary)', fontWeight: 400 }}>
            Search and explore registered MA nonprofits, their finances, and tax filings
          </p>
        </div>
      </div>

      {/* KPI Row */}
      <div className="kpi-row" style={{ marginTop: 16 }}>
        <div className="kpi-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Users size={18} style={{ color: 'var(--accent-blue)' }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Registered Nonprofits
            </span>
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)' }}>
            {MA_NONPROFIT_STATS.totalNonprofits.toLocaleString()}+
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>Active organizations in MA</div>
        </div>
        <div className="kpi-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <DollarSign size={18} style={{ color: 'var(--accent-green)' }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Combined Revenue
            </span>
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)' }}>
            {formatMoney(MA_NONPROFIT_STATS.totalRevenue)}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>Annual nonprofit revenue</div>
        </div>
        <div className="kpi-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <PieChart size={18} style={{ color: '#E67E22' }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Top Sectors
            </span>
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)' }}>5</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
            Healthcare, Education, Human Services...
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="chart-card" style={{ marginTop: 16 }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
          <Search size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />
          Search Nonprofits
        </h3>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <input
              type="text"
              placeholder="Search by organization name (e.g. 'Dana-Farber', 'YMCA')..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px',
                border: '1px solid var(--border)',
                borderRadius: 8,
                fontSize: 14,
                background: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
          <button
            type="submit"
            disabled={isLoading || !searchQuery.trim()}
            style={{
              padding: '10px 20px',
              background: isLoading ? 'var(--border)' : 'var(--accent-blue)',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              cursor: isLoading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              whiteSpace: 'nowrap',
            }}
          >
            {isLoading && !orgDetails ? <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Search size={16} />}
            Search
          </button>
        </form>
        <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>
          Data from ProPublica Nonprofit Explorer. Searches Massachusetts nonprofits only.
        </p>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          marginTop: 16,
          padding: '12px 16px',
          background: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          color: '#991b1b',
          fontSize: 14,
        }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Search Results */}
      {searchResults.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
            Search Results ({totalResults.toLocaleString()} found)
          </h3>
          <div className="card-grid">
            {searchResults.map((org) => (
              <div
                key={org.ein}
                onClick={() => handleSelectOrg(org.ein)}
                className="chart-card"
                style={{
                  cursor: 'pointer',
                  border: selectedOrg === org.ein ? '2px solid var(--accent-blue)' : '1px solid var(--border)',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <Building2 size={18} style={{ color: 'var(--accent-blue)', flexShrink: 0 }} />
                  <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.3 }}>
                    {org.name}
                  </h4>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>EIN</span>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'monospace', fontSize: 12 }}>{org.ein}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>City</span>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{org.city || 'N/A'}</span>
                  </div>
                  {org.income_amount != null && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Revenue</span>
                      <span style={{ fontWeight: 700, color: 'var(--accent-green)' }}>{formatMoney(org.income_amount)}</span>
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                  <span style={{
                    fontSize: 11,
                    padding: '2px 8px',
                    borderRadius: 4,
                    background: 'rgba(20,85,143,0.08)',
                    color: 'var(--accent-blue)',
                    fontWeight: 600,
                  }}>
                    {org.ntee_code || 'Nonprofit'}
                  </span>
                  <ChevronRight size={14} style={{ color: 'var(--text-secondary)' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Loading for org details */}
      {isLoading && selectedOrg && (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>
          <Loader size={32} style={{ animation: 'spin 1s linear infinite', marginBottom: 12 }} />
          <p style={{ margin: 0 }}>Loading organization details...</p>
        </div>
      )}

      {/* Organization Detail Panel */}
      {selectedOrg && orgDetails && !isLoading && (
        <div style={{ marginTop: 20 }}>
          {/* Org Header */}
          <div className="chart-card" style={{ borderLeft: '4px solid var(--accent-blue)' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 800, color: 'var(--text-primary)' }}>
              {orgDetails.name}
            </h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, fontSize: 13 }}>
              <span><strong style={{ color: 'var(--text-secondary)' }}>EIN:</strong> <code style={{ background: 'var(--bg-primary)', padding: '2px 6px', borderRadius: 4, fontSize: 12 }}>{orgDetails.ein}</code></span>
              <span><strong style={{ color: 'var(--text-secondary)' }}>State:</strong> {orgDetails.state}</span>
              <span><strong style={{ color: 'var(--text-secondary)' }}>City:</strong> {orgDetails.city}</span>
              {orgDetails.ntee_code && (
                <span><strong style={{ color: 'var(--text-secondary)' }}>NTEE:</strong> {orgDetails.ntee_code}</span>
              )}
            </div>
          </div>

          {/* Financial KPIs */}
          <div className="kpi-row" style={{ marginTop: 12 }}>
            {orgDetails.income_amount != null && (
              <div className="kpi-card">
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 6 }}>Total Revenue</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--accent-green)' }}>{formatMoney(orgDetails.income_amount)}</div>
              </div>
            )}
            {orgDetails.revenue != null && !orgDetails.income_amount && (
              <div className="kpi-card">
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 6 }}>Total Revenue</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--accent-green)' }}>{formatMoney(orgDetails.revenue)}</div>
              </div>
            )}
            {orgDetails.totexpense != null && (
              <div className="kpi-card">
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 6 }}>Total Expenses</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#E67E22' }}>{formatMoney(orgDetails.totexpense)}</div>
              </div>
            )}
            {orgDetails.asset_amount != null && (
              <div className="kpi-card">
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 6 }}>Total Assets</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--accent-blue)' }}>{formatMoney(orgDetails.asset_amount)}</div>
              </div>
            )}
          </div>

          {/* Revenue/Expense Trend Chart */}
          {getFilingsData().length > 0 && (
            <div className="chart-card" style={{ marginTop: 12 }}>
              <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
                <TrendingUp size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                Revenue & Expense Trend
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={getFilingsData()}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                  <XAxis dataKey="year" stroke="rgba(0,0,0,0.4)" tick={{ fontSize: 12 }} />
                  <YAxis stroke="rgba(0,0,0,0.4)" tick={{ fontSize: 12 }} tickFormatter={(val) => formatMoney(val)} />
                  <Tooltip contentStyle={chartTooltipStyle} formatter={(val) => formatMoney(val)} />
                  <Legend />
                  <Line type="monotone" dataKey="revenue" stroke="#14558F" strokeWidth={2.5} dot={{ r: 3 }} name="Revenue" />
                  <Line type="monotone" dataKey="expenses" stroke="#E67E22" strokeWidth={2.5} dot={{ r: 3 }} name="Expenses" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Recent Filings Table */}
          {orgDetails.filings && orgDetails.filings.length > 0 && (
            <div className="chart-card" style={{ marginTop: 12 }}>
              <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Recent Tax Filings</h3>
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th>Tax Year</th>
                      <th>Revenue</th>
                      <th>Expenses</th>
                      <th>Filing</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orgDetails.filings.slice(-8).reverse().map((filing, idx) => (
                      <tr key={idx}>
                        <td style={{ fontWeight: 600 }}>{filing.tax_prd_yr || filing.tax_year || filing.year}</td>
                        <td style={{ color: 'var(--accent-green)', fontWeight: 600 }}>{formatMoney(filing.totrevenue)}</td>
                        <td style={{ color: '#E67E22', fontWeight: 600 }}>{formatMoney(filing.totfuncexpns || filing.totexpense)}</td>
                        <td>
                          {filing.pdf_url ? (
                            <a href={filing.pdf_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-blue)', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13 }}>
                              <ExternalLink size={14} /> View 990
                            </a>
                          ) : (
                            <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>N/A</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* No search yet â show top nonprofits */}
      {!selectedOrg && searchResults.length === 0 && !isLoading && (
        <div className="chart-card" style={{ marginTop: 20 }}>
          <h3 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
            Top 10 MA Nonprofits by Revenue
          </h3>
          <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--text-secondary)' }}>
            Largest registered nonprofits in Massachusetts
          </p>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart
              data={TOP_MA_NONPROFITS}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 180, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
              <XAxis type="number" stroke="rgba(0,0,0,0.4)" tick={{ fontSize: 12 }} tickFormatter={(val) => formatMoney(val)} />
              <YAxis dataKey="name" type="category" stroke="rgba(0,0,0,0.4)" width={175} tick={{ fontSize: 12 }} />
              <Tooltip contentStyle={chartTooltipStyle} formatter={(val) => formatMoney(val)} />
              <Bar dataKey="revenue" fill="var(--accent-blue)" radius={[0, 4, 4, 0]} name="Revenue" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Context card */}
      <div className="chart-card" style={{ marginTop: 16, borderLeft: '4px solid var(--accent-green)' }}>
        <h3 style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
          How Nonprofit Data Connects to State Spending
        </h3>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          Many Massachusetts nonprofits receive state government contracts and grants for healthcare,
          education, human services, and social welfare programs. Organizations found here may also
          appear in the State Vendor Payments data if they contract with state agencies. Cross-referencing
          nonprofit finances (Form 990) with state payments reveals how public funds flow through
          the nonprofit sector.
        </p>
      </div>

      {/* Spinner keyframes */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
