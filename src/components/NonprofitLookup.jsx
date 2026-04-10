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
// Styles use existing index.css classes

// Format money helper
const formatMoney = (n) => {
  if (!n) return '$0';
  if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(1) + 'B';
  if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
  if (Math.abs(n) >= 1e3) return '$' + (n / 1e3).toFixed(0) + 'K';
  return '$' + n.toLocaleString();
};

// Top MA nonprofits by revenue (static data)
const TOP_MA_NONPROFITS = [
  { name: 'Partners HealthCare', ein: '042103580', revenue: 18200000000, city: 'Boston' },
  { name: 'Harvard University', ein: '042103580', revenue: 16500000000, city: 'Cambridge' },
  { name: 'Massachusetts Institute of Technology', ein: '042103427', revenue: 11200000000, city: 'Cambridge' },
  { name: 'Massachusetts General Hospital', ein: '042103465', revenue: 4200000000, city: 'Boston' },
  { name: 'Boston Children\'s Hospital', ein: '042103527', revenue: 2400000000, city: 'Boston' },
  { name: 'Brigham and Women\'s Hospital', ein: '042103548', revenue: 3100000000, city: 'Boston' },
  { name: 'Dana-Farber Cancer Institute', ein: '042103562', revenue: 1500000000, city: 'Boston' },
  { name: 'WGBH Educational Foundation', ein: '042106029', revenue: 320000000, city: 'Boston' },
  { name: 'Boston Medical Center', ein: '042103601', revenue: 2000000000, city: 'Boston' },
  { name: 'Boston University', ein: '042103329', revenue: 2100000000, city: 'Boston' },
];

// MA nonprofit statistics (static KPI data)
const MA_NONPROFIT_STATS = {
  totalNonprofits: 40000,
  totalRevenue: 120000000000,
  topSectors: ['Healthcare', 'Education', 'Human Services', 'Arts & Culture', 'Religion'],
};

export default function NonprofitLookup() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedOrg, setSelectedOrg] = useState(null);
  const [orgDetails, setOrgDetails] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalResults, setTotalResults] = useState(0);

  // Search nonprofits
  const handleSearch = useCallback(
    async (e) => {
      e.preventDefault();
      if (!searchQuery.trim()) return;

      setIsLoading(true);
      setError(null);
      setSearchResults([]);
      setSelectedOrg(null);
      setOrgDetails(null);
      setCurrentPage(1);

      try {
        const response = await fetch(
          `https://projects.propublica.org/nonprofits/api/v2/search.json?q=${encodeURIComponent(
            searchQuery
          )}&state[id]=MA&page=1`
        );

        if (!response.ok) throw new Error('Search failed');

        const data = await response.json();
        setSearchResults(data.organizations || []);
        setTotalResults(data.total_results || 0);
      } catch (err) {
        setError('Failed to search nonprofits. Please try again.');
        console.error('Search error:', err);
      } finally {
        setIsLoading(false);
      }
    },
    [searchQuery]
  );

  // Fetch organization details
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
      console.error('Detail fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Process filings data for chart
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
    <div className="nonprofit-lookup-container">
      {/* Header */}
      <div className="section-header">
        <div className="header-content">
          <Heart className="header-icon" size={32} />
          <div>
            <h1>Massachusetts Nonprofit Explorer</h1>
            <p>Search and explore registered MA nonprofits, their finances, and tax filings</p>
          </div>
        </div>
      </div>

      {/* MA Nonprofit Stats KPIs */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-label">Registered Nonprofits in MA</div>
          <div className="kpi-value">{MA_NONPROFIT_STATS.totalNonprofits.toLocaleString()}</div>
          <div className="kpi-secondary">Active organizations</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Combined Annual Revenue</div>
          <div className="kpi-value">{formatMoney(MA_NONPROFIT_STATS.totalRevenue)}</div>
          <div className="kpi-secondary">All Massachusetts nonprofits</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Top Sectors</div>
          <div className="kpi-value">{MA_NONPROFIT_STATS.topSectors.length}</div>
          <div className="kpi-secondary">
            {MA_NONPROFIT_STATS.topSectors.slice(0, 3).join(', ')} +2 more
          </div>
        </div>
      </div>

      {/* Search Section */}
      <div className="card search-card">
        <h2>Search Nonprofits</h2>
        <form onSubmit={handleSearch} className="search-form">
          <div className="search-input-wrapper">
            <Search className="search-icon" size={20} />
            <input
              type="text"
              placeholder="Search by organization name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
            <button type="submit" className="search-button" disabled={isLoading || !searchQuery.trim()}>
              {isLoading ? <Loader size={18} className="spinner" /> : 'Search'}
            </button>
          </div>
          <p className="search-hint">Search Massachusetts nonprofits by name to find their financial data and tax filings</p>
        </form>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="alert alert-error">
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      <div className="lookup-content">
        {/* Search Results */}
        <div className="results-panel">
          <h2 className="panel-title">
            {searchResults.length > 0 ? `Results (${totalResults} found)` : 'Search Results'}
          </h2>

          {isLoading && !orgDetails && (
            <div className="loading-state">
              <Loader className="spinner" size={32} />
              <p>Searching nonprofits...</p>
            </div>
          )}

          {!isLoading && searchResults.length === 0 && searchQuery && (
            <div className="empty-state">
              <Building2 size={48} />
              <p>No nonprofits found matching "{searchQuery}"</p>
              <span className="text-secondary">Try a different organization name</span>
            </div>
          )}

          {searchResults.length > 0 && (
            <div className="card-grid">
              {searchResults.map((org) => (
                <div
                  key={org.ein}
                  className={`org-card ${selectedOrg === org.ein ? 'selected' : ''}`}
                  onClick={() => handleSelectOrg(org.ein)}
                >
                  <div className="org-card-header">
                    <Building2 size={20} className="org-icon" />
                    <h3>{org.name}</h3>
                  </div>
                  <div className="org-card-body">
                    <div className="org-detail-row">
                      <span className="label">EIN:</span>
                      <span className="value">{org.ein}</span>
                    </div>
                    <div className="org-detail-row">
                      <span className="label">City:</span>
                      <span className="value">{org.city}</span>
                    </div>
                    {org.revenue && (
                      <div className="org-detail-row">
                        <span className="label">Revenue:</span>
                        <span className="value">{formatMoney(org.revenue)}</span>
                      </div>
                    )}
                    {org.assets && (
                      <div className="org-detail-row">
                        <span className="label">Assets:</span>
                        <span className="value">{formatMoney(org.assets)}</span>
                      </div>
                    )}
                  </div>
                  <div className="org-card-footer">
                    <span className="category-badge">{org.ntee_code || 'Nonprofit'}</span>
                    <ChevronRight size={16} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Organization Details Panel */}
        <div className="details-panel">
          {selectedOrg && orgDetails ? (
            <>
              <div className="details-header">
                <h2>{orgDetails.name}</h2>
                <div className="details-meta">
                  <div className="detail-item">
                    <span className="label">EIN:</span>
                    <code>{orgDetails.ein}</code>
                  </div>
                  <div className="detail-item">
                    <span className="label">State:</span>
                    <span>{orgDetails.state}</span>
                  </div>
                  <div className="detail-item">
                    <span className="label">City:</span>
                    <span>{orgDetails.city}</span>
                  </div>
                  {orgDetails.ntee_code && (
                    <div className="detail-item">
                      <span className="label">NTEE Category:</span>
                      <span>{orgDetails.ntee_code}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Financial Summary */}
              <div className="financial-summary">
                <h3>Financial Summary</h3>
                <div className="summary-grid">
                  {orgDetails.revenue && (
                    <div className="summary-item">
                      <div className="summary-label">Total Revenue</div>
                      <div className="summary-value">{formatMoney(orgDetails.revenue)}</div>
                    </div>
                  )}
                  {orgDetails.expense && (
                    <div className="summary-item">
                      <div className="summary-label">Total Expenses</div>
                      <div className="summary-value">{formatMoney(orgDetails.expense)}</div>
                    </div>
                  )}
                  {orgDetails.assets && (
                    <div className="summary-item">
                      <div className="summary-label">Total Assets</div>
                      <div className="summary-value">{formatMoney(orgDetails.assets)}</div>
                    </div>
                  )}
                  {orgDetails.liabilities && (
                    <div className="summary-item">
                      <div className="summary-label">Total Liabilities</div>
                      <div className="summary-value">{formatMoney(orgDetails.liabilities)}</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Revenue/Expense Trend Chart */}
              {getFilingsData().length > 0 && (
                <div className="chart-card">
                  <h3>Revenue & Expense Trend</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={getFilingsData()}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                      <XAxis dataKey="year" stroke="#999" />
                      <YAxis stroke="#999" tickFormatter={(val) => formatMoney(val / 1e6)} />
                      <Tooltip formatter={(val) => formatMoney(val)} />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="revenue"
                        stroke="#14558F"
                        strokeWidth={2}
                        dot={false}
                        name="Revenue"
                      />
                      <Line
                        type="monotone"
                        dataKey="expenses"
                        stroke="#E67E22"
                        strokeWidth={2}
                        dot={false}
                        name="Expenses"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Recent Filings */}
              {orgDetails.filings && orgDetails.filings.length > 0 && (
                <div className="filings-section">
                  <h3>Recent Tax Filings</h3>
                  <div className="data-table">
                    <div className="table-header">
                      <div className="col-year">Tax Year</div>
                      <div className="col-revenue">Revenue</div>
                      <div className="col-expense">Expenses</div>
                      <div className="col-link">Filing</div>
                    </div>
                    {orgDetails.filings.slice(-5).reverse().map((filing, idx) => (
                      <div key={idx} className="table-row">
                        <div className="col-year">{filing.tax_year || filing.year}</div>
                        <div className="col-revenue">{formatMoney(filing.totrevenue)}</div>
                        <div className="col-expense">{formatMoney(filing.totexpense)}</div>
                        <div className="col-link">
                          {filing.pdf_url ? (
                            <a href={filing.pdf_url} target="_blank" rel="noopener noreferrer" className="filing-link">
                              <ExternalLink size={16} />
                            </a>
                          ) : (
                            <span className="text-secondary">â</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* IRS Link */}
              {orgDetails.ein && (
                <div className="external-links">
                  <a
                    href={`https://www.irs.gov/charities-non-profits/form-990-series-downloads`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="external-link"
                  >
                    <ExternalLink size={16} />
                    View IRS 990 Filing Information
                  </a>
                </div>
              )}
            </>
          ) : (
            <div className="empty-details">
              <Heart size={48} />
              <p>Select a nonprofit to view detailed financial information</p>
              <span className="text-secondary">Search above to find an organization</span>
            </div>
          )}
        </div>
      </div>

      {/* Top Nonprofits Section */}
      <div className="card top-nonprofits-card">
        <h2>Top 10 MA Nonprofits by Revenue</h2>
        <p className="section-subtitle">Largest registered nonprofits in Massachusetts</p>
        <div className="top-nonprofits-chart">
          <ResponsiveContainer width="100%" height={400}>
            <BarChart
              data={TOP_MA_NONPROFITS}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 250, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis type="number" stroke="#999" tickFormatter={(val) => formatMoney(val / 1e9)} />
              <YAxis dataKey="name" type="category" stroke="#999" width={240} tick={{ fontSize: 12 }} />
              <Tooltip formatter={(val) => formatMoney(val)} />
              <Bar dataKey="revenue" fill="#14558F" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Context Information */}
      <div className="card context-card">
        <h3>How Nonprofit Data Connects to State Spending</h3>
        <div className="context-content">
          <p>
            Many Massachusetts nonprofits receive state government contracts and grants for services including healthcare,
            education, human services, and social welfare programs. When you find a nonprofit in this explorer, it may also
            appear in our <strong>State Vendor Payments</strong> tab if it contracts with state agencies.
          </p>
          <ul className="context-list">
            <li>
              <strong>Service Delivery:</strong> Nonprofits are major providers of contracted services to the Commonwealth
            </li>
            <li>
              <strong>Transparency:</strong> These organizations' financial filings (Form 990) are public records showing
              how they spend funds
            </li>
            <li>
              <strong>Accountability:</strong> Cross-reference nonprofit finances with state payments to understand funding
              flows
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
