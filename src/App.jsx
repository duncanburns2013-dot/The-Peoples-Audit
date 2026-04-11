import { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area, Treemap,
  Legend, Sankey
} from 'recharts';
import {
  DollarSign, Users, Building2, TrendingUp, AlertTriangle,
  ExternalLink, Search, ChevronDown, Scale, Vote, FileText,
  Landmark, Eye, Download, Menu, X, ArrowRight, Fingerprint,
  Network, ShieldAlert, Banknote, ChevronRight, Layers, Activity,
  MapPin
} from 'lucide-react';
import DisclosuresFeed from './components/DisclosuresFeed.jsx';
import OcpfDataCenter from './components/OcpfDataCenter.jsx';
import PacDashboard from './components/PacDashboard.jsx';
import CostOfLivingCalculator from './components/CostOfLivingCalculator.jsx';
import LobbyingExplorer from './components/LobbyingExplorer.jsx';
import NonprofitLookup from './components/NonprofitLookup.jsx';
import {
  fetchSpendingByDepartment, fetchSpendingByVendor, fetchSpendingOverTime,
  fetchPayrollByDepartment, fetchTopEarners, fetchPayrollOverTime, searchPayroll,
  fetchQuasiPayments, fetchQuasiAgencyDetail, fetchQuasiAgencyByYear, fetchQuasiAgencyCategories, fetchQuasiAgencyPayments,
  fetchFederalSpendingMA, fetchFederalAwardsMA,
  fetchTreasuryDebtContext, fetchMADebtServiceFederal, fetchEmmaRecentTrades,
  fetchTopVendors, searchVendors, fetchNonProfitVendors, fetchVendorByYear,
  fetchVendorByDepartment, fetchVendorByCategory, fetchVendorPayments,
  fetchDepartmentVendors, fetchDepartmentCategories, fetchDepartmentAppropriations,
  fetchDepartmentOverTime, fetchDepartmentPayments, fetchSpendingByCabinet,
  fetchLegislatorFinances, fetchPACFinances, searchContributions, searchExpenditures, fetchLastContribution,
  crossReferenceVendorDonations, fetchCampaignFinanceTotals,
  MA_BUDGET_SUMMARY, AUDIT_FACTS,
  SPENDING_BY_DEPARTMENT, SPENDING_BY_VENDOR, SPENDING_OVER_TIME,
  PAYROLL_BY_DEPARTMENT, TOP_EARNERS, PAYROLL_OVER_TIME,
  QUASI_PAYMENTS, FEDERAL_SPENDING_MA, FEDERAL_AWARDS_MA, MBTA_AUDITED_FINANCIALS,
  MA_STATE_DEBT_YOY, MA_TOP_BOND_ISSUERS, MA_DEBT_BY_TYPE, MA_COUNTY_DEBT, MA_BOND_FACTS,
} from './services/api';
import './index.css';

// ============================================================
// HELPERS
// ============================================================

const formatMoney = (num) => {
  if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
  if (num >= 1e6) return `$${(num / 1e6).toFixed(1)}M`;
  if (num >= 1e3) return `$${(num / 1e3).toFixed(0)}K`;
  return `$${num.toLocaleString()}`;
};

const formatMoneyFull = (num) => `$${Number(num).toLocaleString()}`;

const COLORS = ['#4361ee', '#e76f51', '#2a9d8f', '#e9c46a', '#264653', '#7209b7',
  '#f4845f', '#577590', '#c77dff', '#6c8eb5', '#d4a373', '#48bfe3'];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: '#ffffff', border: '1px solid #dfe2ea', borderRadius: 8,
      padding: '12px 16px', fontSize: '0.85rem', boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
    }}>
      <p style={{ color: '#1a1d2e', fontWeight: 600, marginBottom: 4 }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color || '#d48a00' }}>
          {p.name}: {typeof p.value === 'number' ? formatMoney(p.value) : p.value}
        </p>
      ))}
    </div>
  );
};

// Chart axis/grid colors for light theme
const GRID_COLOR = '#e4e6ed';
const AXIS_COLOR = '#6b7189';

// Page transition variants
const pageVariants = {
  initial: { opacity: 0, y: 20, filter: 'blur(4px)' },
  animate: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] } },
  exit: { opacity: 0, y: -10, filter: 'blur(4px)', transition: { duration: 0.2 } },
};

// ============================================================
// SPENDING EXPLORER â Department Drill-Down
// ============================================================

function SpendingExplorer({ departments, spendingOverTime, initialYear }) {
  const [selectedDept, setSelectedDept] = useState(null);
  const [deptDetail, setDeptDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [deptYear, setDeptYear] = useState(initialYear || '2026');
  const [paymentPage, setPaymentPage] = useState(0);
  const [deptPaySortField, setDeptPaySortField] = useState('date');
  const [deptPaySortDir, setDeptPaySortDir] = useState('desc');
  const PAYMENTS_PER_PAGE = 25;
  const detailPanelRef = useRef(null);

  const selectDepartment = useCallback((deptName) => {
    setSelectedDept(deptName);
    setDetailLoading(true);
    setPaymentPage(0);
    Promise.all([
      fetchDepartmentVendors(deptName, deptYear),
      fetchDepartmentCategories(deptName, deptYear),
      fetchDepartmentAppropriations(deptName, deptYear),
      fetchDepartmentOverTime(deptName),
      fetchDepartmentPayments(deptName, deptYear, 500),
    ]).then(([vendors, categories, appropriations, overTime, payments]) => {
      setDeptDetail({ vendors, categories, appropriations, overTime, payments });
      setDetailLoading(false);
      setTimeout(() => {
        detailPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 0);
    });
  }, [deptYear]);

  return (
    <div className="section">
      <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <span className="section-tag red">Expenditures</span>
          <h2>Where the Money Goes</h2>
          <p>Click any department to drill down into every vendor, appropriation, and payment. Live data from CTHRU.</p>
        </div>
        <select className="year-select" value={deptYear} onChange={e => { setDeptYear(e.target.value); setSelectedDept(null); setDeptDetail(null); }}>
          {Array.from({ length: 17 }, (_, i) => 2026 - i).map(y => (
            <option key={y} value={y}>FY {y}</option>
          ))}
        </select>
      </div>

      {/* Department Detail Panel */}
      {selectedDept && (
        <div ref={detailPanelRef} className="detail-panel" style={{ marginBottom: 24 }}>
          <button className="close-btn" onClick={() => { setSelectedDept(null); setDeptDetail(null); }}>Close</button>

          <h3 style={{ color: 'var(--accent-red)', marginBottom: 4 }}>{selectedDept}</h3>
          <div className="chart-subtitle">Complete spending breakdown â every vendor, every dollar</div>

          {detailLoading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
              <div className="spinner" style={{ margin: '0 auto 12px' }} /> Loading department data...
            </div>
          ) : deptDetail && (
            <>
              {deptDetail.overTime.length > 0 && (
                <div style={{ marginTop: 20 }}>
                  <h4 style={{ marginBottom: 8, color: 'var(--text-secondary)' }}>Department Spending by Fiscal Year</h4>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={deptDetail.overTime}>
                      <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
                      <XAxis dataKey="year" stroke={AXIS_COLOR} />
                      <YAxis tickFormatter={formatMoney} stroke={AXIS_COLOR} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="total" fill="#ff3344" radius={[3, 3, 0, 0]} name="Total Spent" />
                    </BarChart>
                  </ResponsiveContainer>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    All-time total: <strong style={{ color: 'var(--accent-red)' }}>{formatMoney(deptDetail.overTime.reduce((s, y) => s + y.total, 0))}</strong>
                    {' '}across <strong style={{ color: 'var(--text-primary)' }}>{deptDetail.overTime.length}</strong> fiscal years
                  </span>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: 20, marginTop: 24 }}>
                {deptDetail.vendors.length > 0 && (
                  <div>
                    <h4 style={{ marginBottom: 8, color: 'var(--text-secondary)' }}>Top Vendors â FY{deptYear}</h4>
                    <ResponsiveContainer width="100%" height={Math.max(200, Math.min(15, deptDetail.vendors.length) * 28 + 40)}>
                      <BarChart data={deptDetail.vendors.slice(0, 15)} layout="vertical" margin={{ left: 180 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
                        <XAxis type="number" tickFormatter={formatMoney} stroke={AXIS_COLOR} />
                        <YAxis type="category" dataKey="vendor" stroke={AXIS_COLOR} width={170} tick={{ fontSize: 10 }} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="total" fill="#22cc66" radius={[0, 3, 3, 0]} name="Paid" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {deptDetail.categories.length > 0 && (
                  <div>
                    <h4 style={{ marginBottom: 8, color: 'var(--text-secondary)' }}>Spending Categories â FY{deptYear}</h4>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie data={deptDetail.categories.slice(0, 8)} dataKey="total" nameKey="category" cx="50%" cy="50%" outerRadius={100} label={({ percent }) => `${(percent * 100).toFixed(0)}%`}>
                          {deptDetail.categories.slice(0, 8).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px', fontSize: '0.75rem' }}>
                      {deptDetail.categories.slice(0, 8).map((c, i) => (
                        <span key={i} style={{ color: COLORS[i % COLORS.length] }}>
                          {c.category.replace(/^\([^)]+\)\s*/, '')} â {formatMoney(c.total)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {deptDetail.appropriations.length > 0 && (
                <div style={{ marginTop: 24 }}>
                  <h4 style={{ marginBottom: 8, color: 'var(--text-secondary)' }}>Budget Appropriations â FY{deptYear}</h4>
                  <div className="data-table-wrapper">
                    <table className="data-table">
                      <thead>
                        <tr><th>#</th><th>Appropriation</th><th>Total</th><th>Payments</th></tr>
                      </thead>
                      <tbody>
                        {deptDetail.appropriations.map((a, i) => (
                          <tr key={i}>
                            <td style={{ color: 'var(--text-muted)' }}>{i + 1}</td>
                            <td style={{ fontSize: '0.85rem' }}>{a.appropriation.replace(/^\([^)]+\)\s*/, '')}</td>
                            <td className="money">{formatMoney(a.total)}</td>
                            <td>{a.paymentCount.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {deptDetail.payments.length > 0 && (() => {
                const sortedDeptPayments = [...deptDetail.payments].sort((a, b) => {
                  if (deptPaySortField === 'date') {
                    const da = new Date(a.date || 0), db = new Date(b.date || 0);
                    return deptPaySortDir === 'desc' ? db - da : da - db;
                  }
                  if (deptPaySortField === 'amount') return deptPaySortDir === 'desc' ? (b.amount || 0) - (a.amount || 0) : (a.amount || 0) - (b.amount || 0);
                  return 0;
                });
                return (
                <div style={{ marginTop: 24 }}>
                  <h4 style={{ marginBottom: 8, color: 'var(--text-secondary)' }}>
                    Individual Payments â FY{deptYear} ({deptDetail.payments.length} records)
                  </h4>
                  <div className="data-table-wrapper">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th style={{ cursor: 'pointer' }} onClick={() => { setDeptPaySortField('date'); setDeptPaySortDir(d => deptPaySortField === 'date' ? (d === 'desc' ? 'asc' : 'desc') : 'desc'); setPaymentPage(0); }}>
                            Date {deptPaySortField === 'date' ? (deptPaySortDir === 'desc' ? 'â' : 'â') : ''}
                          </th>
                          <th style={{ cursor: 'pointer' }} onClick={() => { setDeptPaySortField('amount'); setDeptPaySortDir(d => deptPaySortField === 'amount' ? (d === 'desc' ? 'asc' : 'desc') : 'desc'); setPaymentPage(0); }}>
                            Amount {deptPaySortField === 'amount' ? (deptPaySortDir === 'desc' ? 'â' : 'â') : ''}
                          </th>
                          <th>Vendor</th><th>Appropriation</th><th>Category</th><th>Method</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedDeptPayments.slice(paymentPage * PAYMENTS_PER_PAGE, (paymentPage + 1) * PAYMENTS_PER_PAGE).map((p, i) => (
                          <tr key={i}>
                            <td style={{ whiteSpace: 'nowrap' }}>{p.date}</td>
                            <td className="money">{formatMoneyFull(p.amount)}</td>
                            <td style={{ fontSize: '0.8rem' }}>{p.vendor}</td>
                            <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{p.appropriation.replace(/^\([^)]+\)\s*/, '')}</td>
                            <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{p.category.replace(/^\([^)]+\)\s*/, '')}</td>
                            <td style={{ fontSize: '0.8rem' }}>{p.paymentMethod}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {deptDetail.payments.length > PAYMENTS_PER_PAGE && (
                    <div className="pagination">
                      <button disabled={paymentPage === 0} onClick={() => setPaymentPage(p => p - 1)}>Previous</button>
                      <span className="page-info">Page {paymentPage + 1} of {Math.ceil(deptDetail.payments.length / PAYMENTS_PER_PAGE)}</span>
                      <button disabled={(paymentPage + 1) * PAYMENTS_PER_PAGE >= deptDetail.payments.length}
                        onClick={() => setPaymentPage(p => p + 1)}>Next</button>
                    </div>
                  )}
                </div>
              );})()}
            </>
          )}
        </div>
      )}

      {departments ? (
        <>
          <div className="chart-card">
            <h3>Spending by Department â FY{deptYear}</h3>
            <div className="chart-subtitle">Click any department to see the full breakdown</div>
            <ResponsiveContainer width="100%" height={600}>
              <BarChart data={departments.slice(0, 20)} layout="vertical" margin={{ left: 200 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
                <XAxis type="number" tickFormatter={formatMoney} stroke={AXIS_COLOR} />
                <YAxis type="category" dataKey="name" stroke={AXIS_COLOR} width={190} tick={({ x, y, payload }) => (
                  <text x={x} y={y} dy={4} textAnchor="end" fill={AXIS_COLOR} fontSize={10}>
                    {payload.value.length > 28 ? payload.value.substring(0, 26) + 'â¦' : payload.value}
                  </text>
                )} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value" fill="#ff3344" radius={[0, 3, 3, 0]} name="Total Spent" cursor="pointer"
                  onClick={(data) => data && selectDepartment(data.name)} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {spendingOverTime && spendingOverTime.length > 0 && (
            <div className="chart-card" style={{ marginTop: 24 }}>
              <h3>Total State Spending Over Time</h3>
              <div className="chart-subtitle">Year-over-year expenditure growth (data through latest completed fiscal year)</div>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={spendingOverTime}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
                  <XAxis dataKey="year" stroke={AXIS_COLOR} />
                  <YAxis tickFormatter={formatMoney} stroke={AXIS_COLOR} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="total" stroke="#ff3344" fill="rgba(217,38,56,0.12)" name="Total Spent" />
                </AreaChart>
              </ResponsiveContainer>
              <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(20, 85, 143, 0.08)', border: '1px solid rgba(20, 85, 143, 0.25)', borderRadius: 8, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                ð <strong style={{ color: '#14558F' }}>Data through FY2024</strong> â the latest fiscal year published by CTHRU. FY2025 data will appear after official publication.
              </div>
            </div>
          )}

          <div className="data-table-wrapper" style={{ marginTop: 24 }}>
            <table className="data-table">
              <thead>
                <tr><th>#</th><th>Department</th><th>Total Expenditure</th><th></th></tr>
              </thead>
              <tbody>
                {departments.map((d, i) => (
                  <tr key={i} onClick={() => selectDepartment(d.name)} style={{ cursor: 'pointer' }}
                    className={selectedDept === d.name ? 'active-row' : ''}>
                    <td style={{ color: 'var(--text-muted)' }}>{i + 1}</td>
                    <td style={{ fontWeight: selectedDept === d.name ? 700 : 400 }}>{d.name}</td>
                    <td className="money">{formatMoneyFull(d.value)}</td>
                    <td><ChevronRight size={12} style={{ color: 'var(--accent-purple)' }} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="loading-skeleton" />
      )}
    </div>
  );
}

// ============================================================
// VENDOR EXPLORER â "Track Every Dollar"
// ============================================================

function VendorExplorer({ spendingYear }) {
  const [vendorSearch, setVendorSearch] = useState('');
  const [vendors, setVendors] = useState([]);
  const [vendorsLoading, setVendorsLoading] = useState(true);
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [vendorDetail, setVendorDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [vendorYear, setVendorYear] = useState(spendingYear || '2026');
  const [paymentPage, setPaymentPage] = useState(0);
  const [nonProfitFilter, setNonProfitFilter] = useState(false);
  const [sortField, setSortField] = useState('total');
  const [sortDir, setSortDir] = useState('desc');
  const [paySortField, setPaySortField] = useState('date');
  const [paySortDir, setPaySortDir] = useState('desc');
  const PAYMENTS_PER_PAGE = 25;

  useEffect(() => {
    setVendorsLoading(true);
    if (nonProfitFilter) {
      fetchNonProfitVendors(vendorYear, 200).then(data => { setVendors(data); setVendorsLoading(false); });
    } else {
      fetchTopVendors(vendorYear, 200).then(data => { setVendors(data); setVendorsLoading(false); });
    }
  }, [vendorYear, nonProfitFilter]);

  useEffect(() => {
    if (!vendorSearch.trim()) return;
    const timer = setTimeout(() => {
      setVendorsLoading(true);
      searchVendors(vendorSearch, vendorYear).then(data => { setVendors(data); setVendorsLoading(false); });
    }, 400);
    return () => clearTimeout(timer);
  }, [vendorSearch, vendorYear]);

  useEffect(() => {
    if (vendorSearch === '') {
      setVendorsLoading(true);
      if (nonProfitFilter) {
        fetchNonProfitVendors(vendorYear, 200).then(data => { setVendors(data); setVendorsLoading(false); });
      } else {
        fetchTopVendors(vendorYear, 200).then(data => { setVendors(data); setVendorsLoading(false); });
      }
    }
  }, [vendorSearch, vendorYear, nonProfitFilter]);

  const vendorDetailPanelRef = useRef(null);

  const selectVendor = useCallback((vendorName) => {
    setSelectedVendor(vendorName);
    setDetailLoading(true);
    setPaymentPage(0);
    Promise.all([
      fetchVendorByYear(vendorName),
      fetchVendorByDepartment(vendorName, vendorYear),
      fetchVendorByCategory(vendorName, vendorYear),
      fetchVendorPayments(vendorName, vendorYear, 500),
    ]).then(([byYear, byDept, byCat, payments]) => {
      setVendorDetail({ byYear, byDept, byCat, payments });
      setDetailLoading(false);
      setTimeout(() => {
        vendorDetailPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 0);
    });
  }, [vendorYear]);

  const totalSpent = vendors.reduce((s, v) => s + v.total, 0);
  const totalPayments = vendors.reduce((s, v) => s + v.paymentCount, 0);

  const sortedVendors = [...vendors].sort((a, b) => {
    const aVal = sortField === 'vendor' ? a.vendor.toLowerCase() : a[sortField];
    const bVal = sortField === 'vendor' ? b.vendor.toLowerCase() : b[sortField];
    if (sortField === 'vendor') return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
  });

  return (
    <div className="section">
      <div className="section-header">
        <span className="section-tag gold">Vendor Money Tracker</span>
        <h2>Track Every Dollar</h2>
        <p>Search any vendor, contractor, or organization receiving Massachusetts taxpayer money. Click any vendor to see where every dollar went.</p>
      </div>

      <div className="kpi-row" style={{ marginBottom: 24 }}>
        <div className="kpi-card">
          <div className="kpi-label">Total Vendor Payments</div>
          <div className="kpi-value">{formatMoney(totalSpent)}</div>
          <div className="kpi-sub">FY{vendorYear}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Total Transactions</div>
          <div className="kpi-value">{totalPayments.toLocaleString()}</div>
          <div className="kpi-sub">Individual payments</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Unique Vendors</div>
          <div className="kpi-value">{vendors.length.toLocaleString()}+</div>
          <div className="kpi-sub">{vendorSearch ? 'matching search' : 'top recipients'}</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 280, position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', zIndex: 1 }} />
          <input type="text" className="search-input"
            placeholder="Search vendors... (e.g. Deloitte, Partners Healthcare, Keolis)"
            value={vendorSearch} onChange={e => setVendorSearch(e.target.value)} />
        </div>
        <div className="filter-toggle">
          <button className={`filter-btn ${!nonProfitFilter ? 'active' : ''}`} onClick={() => setNonProfitFilter(false)}>All Vendors</button>
          <button className={`filter-btn ${nonProfitFilter ? 'active' : ''}`} onClick={() => setNonProfitFilter(true)}>Non-Profits</button>
        </div>
        <select className="year-select" value={vendorYear} onChange={e => { setVendorYear(e.target.value); setSelectedVendor(null); setVendorDetail(null); }}>
          {Array.from({ length: 17 }, (_, i) => 2026 - i).map(y => (
            <option key={y} value={y}>FY {y}</option>
          ))}
        </select>
      </div>

      {selectedVendor && (
        <div ref={vendorDetailPanelRef} className="detail-panel" style={{ marginBottom: 24 }}>
          <button className="close-btn" onClick={() => { setSelectedVendor(null); setVendorDetail(null); }}>Close</button>
          <h3 style={{ color: 'var(--accent-gold)', marginBottom: 4 }}>{selectedVendor}</h3>
          <div className="chart-subtitle">Complete payment history â every dollar tracked</div>

          {detailLoading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
              <div className="spinner" style={{ margin: '0 auto 12px' }} /> Loading vendor data...
            </div>
          ) : vendorDetail && (
            <>
              {vendorDetail.byYear.length > 0 && (
                <div style={{ marginTop: 20 }}>
                  <h4 style={{ marginBottom: 8, color: 'var(--text-secondary)' }}>Payment History by Fiscal Year</h4>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={vendorDetail.byYear}>
                      <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
                      <XAxis dataKey="year" stroke={AXIS_COLOR} />
                      <YAxis tickFormatter={formatMoney} stroke={AXIS_COLOR} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="total" fill="#ffaa22" radius={[3, 3, 0, 0]} name="Total Paid" />
                    </BarChart>
                  </ResponsiveContainer>
                  <div style={{ display: 'flex', gap: 24, marginTop: 12, flexWrap: 'wrap' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                      All-time total: <strong style={{ color: 'var(--accent-gold)' }}>{formatMoney(vendorDetail.byYear.reduce((s, y) => s + y.total, 0))}</strong>
                    </span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                      Years active: <strong style={{ color: 'var(--text-primary)' }}>{vendorDetail.byYear.length}</strong>
                    </span>
                  </div>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: 20, marginTop: 24 }}>
                {vendorDetail.byDept.length > 0 && (
                  <div>
                    <h4 style={{ marginBottom: 8, color: 'var(--text-secondary)' }}>Paying Departments â FY{vendorYear}</h4>
                    <ResponsiveContainer width="100%" height={Math.max(200, vendorDetail.byDept.length * 32)}>
                      <BarChart data={vendorDetail.byDept.slice(0, 15)} layout="vertical" margin={{ left: 180 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
                        <XAxis type="number" tickFormatter={formatMoney} stroke={AXIS_COLOR} />
                        <YAxis type="category" dataKey="department" stroke={AXIS_COLOR} width={170} tick={{ fontSize: 10 }} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="total" fill="#3388ff" radius={[0, 3, 3, 0]} name="Paid" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {vendorDetail.byCat.length > 0 && (
                  <div>
                    <h4 style={{ marginBottom: 8, color: 'var(--text-secondary)' }}>Spending Categories â FY{vendorYear}</h4>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie data={vendorDetail.byCat.slice(0, 8)} dataKey="total" nameKey="category" cx="50%" cy="50%" outerRadius={100} label={({ percent }) => `${(percent * 100).toFixed(0)}%`}>
                          {vendorDetail.byCat.slice(0, 8).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {vendorDetail.payments.length > 0 && (() => {
                const sortedPayments = [...vendorDetail.payments].sort((a, b) => {
                  if (paySortField === 'date') {
                    const da = new Date(a.date || 0), db = new Date(b.date || 0);
                    return paySortDir === 'desc' ? db - da : da - db;
                  }
                  if (paySortField === 'amount') return paySortDir === 'desc' ? (b.amount || 0) - (a.amount || 0) : (a.amount || 0) - (b.amount || 0);
                  return 0;
                });
                return (
                <div style={{ marginTop: 24 }}>
                  <h4 style={{ marginBottom: 8, color: 'var(--text-secondary)' }}>
                    Individual Payments â FY{vendorYear} ({vendorDetail.payments.length} records)
                  </h4>
                  <div className="data-table-wrapper">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th style={{ cursor: 'pointer' }} onClick={() => { setPaySortField('date'); setPaySortDir(d => paySortField === 'date' ? (d === 'desc' ? 'asc' : 'desc') : 'desc'); setPaymentPage(0); }}>
                            Date {paySortField === 'date' ? (paySortDir === 'desc' ? 'â' : 'â') : ''}
                          </th>
                          <th style={{ cursor: 'pointer' }} onClick={() => { setPaySortField('amount'); setPaySortDir(d => paySortField === 'amount' ? (d === 'desc' ? 'asc' : 'desc') : 'desc'); setPaymentPage(0); }}>
                            Amount {paySortField === 'amount' ? (paySortDir === 'desc' ? 'â' : 'â') : ''}
                          </th>
                          <th>Department</th><th>Appropriation</th><th>Category</th><th>Method</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedPayments.slice(paymentPage * PAYMENTS_PER_PAGE, (paymentPage + 1) * PAYMENTS_PER_PAGE).map((p, i) => (
                          <tr key={i}>
                            <td style={{ whiteSpace: 'nowrap' }}>{p.date}</td>
                            <td className="money">{formatMoneyFull(p.amount)}</td>
                            <td style={{ fontSize: '0.8rem' }}>{p.department}</td>
                            <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{p.appropriation.replace(/^\([^)]+\)\s*/, '')}</td>
                            <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{p.category.replace(/^\([^)]+\)\s*/, '')}</td>
                            <td style={{ fontSize: '0.8rem' }}>{p.paymentMethod}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {vendorDetail.payments.length > PAYMENTS_PER_PAGE && (
                    <div className="pagination">
                      <button disabled={paymentPage === 0} onClick={() => setPaymentPage(p => p - 1)}>Previous</button>
                      <span className="page-info">Page {paymentPage + 1} of {Math.ceil(vendorDetail.payments.length / PAYMENTS_PER_PAGE)}</span>
                      <button disabled={(paymentPage + 1) * PAYMENTS_PER_PAGE >= vendorDetail.payments.length}
                        onClick={() => setPaymentPage(p => p + 1)}>Next</button>
                    </div>
                  )}
                </div>
              );})()}
            </>
          )}
        </div>
      )}

      {vendorsLoading ? (
        <div className="loading-skeleton" style={{ height: 400 }} />
      ) : (
        <>
          <div className="chart-card">
            <h3>{vendorSearch ? `Search Results for "${vendorSearch}"` : `Top Vendors by Payment â FY${vendorYear}`}</h3>
            <div className="chart-subtitle">{vendorSearch ? `${vendors.length} vendors found` : 'Click any vendor to drill down into every payment'}</div>
            {vendors.length > 0 && (
              <ResponsiveContainer width="100%" height={Math.min(800, vendors.slice(0, 30).length * 26 + 40)}>
                <BarChart data={vendors.slice(0, 30)} layout="vertical" margin={{ left: 220 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
                  <XAxis type="number" tickFormatter={formatMoney} stroke={AXIS_COLOR} />
                  <YAxis type="category" dataKey="vendor" stroke={AXIS_COLOR} width={210} tick={({ x, y, payload }) => (
                    <text x={x} y={y} dy={4} textAnchor="end" fill={AXIS_COLOR} fontSize={10}>
                      {payload.value.length > 28 ? payload.value.substring(0, 26) + 'â¦' : payload.value}
                    </text>
                  )} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="total" fill="#22cc66" radius={[0, 3, 3, 0]} name="Total Paid" cursor="pointer"
                    onClick={(data) => data && selectVendor(data.vendor)} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="data-table-wrapper" style={{ marginTop: 24 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th style={{ cursor: 'pointer' }} onClick={() => { setSortField('vendor'); setSortDir(d => sortField === 'vendor' ? (d === 'asc' ? 'desc' : 'asc') : 'asc'); }}>
                    Vendor / Contractor {sortField === 'vendor' ? (sortDir === 'asc' ? 'â' : 'â') : ''}
                  </th>
                  <th style={{ cursor: 'pointer' }} onClick={() => { setSortField('total'); setSortDir(d => sortField === 'total' ? (d === 'asc' ? 'desc' : 'asc') : 'desc'); }}>
                    Total Payments {sortField === 'total' ? (sortDir === 'asc' ? 'â' : 'â') : ''}
                  </th>
                  <th># Transactions</th>
                  <th>Avg Payment</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {sortedVendors.map((v, i) => (
                  <tr key={i} onClick={() => selectVendor(v.vendor)} style={{ cursor: 'pointer' }}
                    className={selectedVendor === v.vendor ? 'active-row' : ''}>
                    <td style={{ color: 'var(--text-muted)' }}>{i + 1}</td>
                    <td style={{ fontWeight: selectedVendor === v.vendor ? 700 : 400 }}>{v.vendor}</td>
                    <td className="money">{formatMoney(v.total)}</td>
                    <td>{v.paymentCount.toLocaleString()}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{v.paymentCount > 0 ? formatMoney(v.total / v.paymentCount) : 'N/A'}</td>
                    <td><ChevronRight size={12} style={{ color: 'var(--accent-purple)' }} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </d             <th style={{ cursor: 'pointer' }} onClick={() => { setPaySortField('date'); setPaySortDir(d => paySortField === 'date' ? (d === 'desc' ? 'asc' : 'desc') : 'desc'); setPaymentPage(0); }}>
                            Date {paySortField === 'date' ? (paySortDir === 'desc' ? 'â' : 'â') : ''}
                          </th>
                          <th style={{ cursor: 'pointer' }} onClick={() => { setPaySortField('amount'); setPaySortDir(d => paySortField === 'amount' ? (d === 'desc' ? 'asc' : 'desc') : 'desc'); setPaymentPage(0); }}>
                            Amount {paySortField === 'amount' ? (paySortDir === 'desc' ? 'â' : 'â') : ''}
                          </th>
                          <th>Department</th><th>Appropriation</th><th>Category</th><th>Method</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedPayments.slice(paymentPage * PAYMENTS_PER_PAGE, (paymentPage + 1) * PAYMENTS_PER_PAGE).map((p, i) => (
                          <tr key={i}>
                            <td style={{ whiteSpace: 'nowrap' }}>{p.date}</td>
                            <td className="money">{formatMoneyFull(p.amount)}</td>
                            <td style={{ fontSize: '0.8rem' }}>{p.department}</td>
                            <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{p.appropriation.replace(/^\([^)]+\)\s*/, '')}</td>
                            <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{p.category.replace(/^\([^)]+\)\s*/, '')}</td>
                            <td style={{ fontSize: '0.8rem' }}>{p.paymentMethod}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {vendorDetail.payments.length > PAYMENTS_PER_PAGE && (
                    <div className="pagination">
                      <button disabled={paymentPage === 0} onClick={() => setPaymentPage(p => p - 1)}>Previous</button>
                      <span className="page-info">Page {paymentPage + 1} of {Math.ceil(vendorDetail.payments.length / PAYMENTS_PER_PAGE)}</span>
                      <button disabled={(paymentPage + 1) * PAYMENTS_PER_PAGE >= vendorDetail.payments.length}
                        onClick={() => setPaymentPage(p => p + 1)}>Next</button>
                    </div>
                  )}
                </div>
              );})()}
            </>
          )}
        </div>
      )}

      {vendorsLoading ? (
        <div className="loading-skeleton" style={{ height: 400 }} />
      ) : (
        <>
          <div className="chart-card">
            <h3>{vendorSearch ? `Search Results for "${vendorSearch}"` : `Top Vendors by Payment â FY${vendorYear}`}</h3>
            <div className="chart-subtitle">{vendorSearch ? `${vendors.length} vendors found` : 'Click any vendor to drill down into every payment'}</div>
            {vendors.length > 0 && (
              <ResponsiveContainer width="100%" height={Math.min(800, vendors.slice(0, 30).length * 26 + 40)}>
                <BarChart data={vendors.slice(0, 30)} layout="vertical" margin={{ left: 220 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
                  <XAxis type="number" tickFormatter={formatMoney} stroke={AXIS_COLOR} />
                  <YAxis type="category" dataKey="vendor" stroke={AXIS_COLOR} width={210} tick={({ x, y, payload }) => (
                    <text x={x} y={y} dy={4} textAnchor="end" fill={AXIS_COLOR} fontSize={10}>
                      {payload.value.length > 28 ? payload.value.substring(0, 26) + 'â¦' : payload.value}
                    </text>
                  )} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="total" fill="#22cc66" radius={[0, 3, 3, 0]} name="Total Paid" cursor="pointer"
                    onClick={(data) => data && selectVendor(data.vendor)} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="data-table-wrapper" style={{ marginTop: 24 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th style={{ cursor: 'pointer' }} onClick={() => { setSortField('vendor'); setSortDir(d => sortField === 'vendor' ? (d === 'asc' ? 'desc' : 'asc') : 'asc'); }}>
                    Vendor / Contractor {sortField === 'vendor' ? (sortDir === 'asc' ? 'â' : 'â') : ''}
                  </th>
                  <th style={{ cursor: 'pointer' }} onClick={() => { setSortField('total'); setSortDir(d => sortField === 'total' ? (d === 'asc' ? 'desc' : 'asc') : 'desc'); }}>
                    Total Payments {sortField === 'total' ? (sortDir === 'asc' ? 'â' : 'â') : ''}
                  </th>
                  <th># Transactions</th>
                  <th>Avg Payment</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {sortedVendors.map((v, i) => (
                  <tr key={i} onClick={() => selectVendor(v.vendor)} style={{ cursor: 'pointer' }}
                    className={selectedVendor === v.vendor ? 'active-row' : ''}>
                    <td style={{ color: 'var(--text-muted)' }}>{i + 1}</td>
                    <td style={{ fontWeight: selectedVendor === v.vendor ? 700 : 400 }}>{v.vendor}</td>
                    <td className="money">{formatMoney(v.total)}</td>
                    <td>{v.paymentCount.toLocaleString()}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{v.paymentCount > 0 ? formatMoney(v.total / v.paymentCount) : 'N/A'}</td>
                    <td><ChevronRight size={12} style={{ color: 'var(--accent-purple)' }} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================
// QUASI EXPLORER â Quasi-Government Drill-Down
// ============================================================

function QuasiExplorer({ quasiPayments }) {
  const [selectedAgency, setSelectedAgency] = useState(null);
  const [agencyDetail, setAgencyDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [quasiYear, setQuasiYear] = useState('2026');
  const [paymentPage, setPaymentPage] = useState(0);
  const PAYMENTS_PER_PAGE = 25;
  const quasiDetailPanelRef = useRef(null);

  const selectAgency = useCallback((agencyName) => {
    setSelectedAgency(agencyName);
    setDetailLoading(true);
    setPaymentPage(0);
    Promise.all([
      fetchQuasiAgencyByYear(agencyName),
      fetchQuasiAgencyCategories(agencyName, quasiYear),
      fetchQuasiAgencyDetail(agencyName, quasiYear),
      fetchQuasiAgencyPayments(agencyName, quasiYear, 500),
    ]).then(([byYear, categories, vendors, payments]) => {
      // Merge MBTA audited financials (CTHRU only tracks stateâMBTA payments through ~2017;
      // these come from MBTA's own published Comprehensive Annual Financial Reports)
      let mergedByYear = byYear;
      const isMBTA = /MBTA|Massachusetts Bay Transportation/i.test(agencyName);
      if (isMBTA) {
        const have = new Set(byYear.map(y => String(y.year)));
        const fromAudit = MBTA_AUDITED_FINANCIALS
          .filter(r => !have.has(String(r.year)))
          .map(r => ({ year: r.year, total: r.operatingExpenses, paymentCount: 0, source: r.source, audited: true }));
        mergedByYear = [...byYear, ...fromAudit].sort((a, b) => String(a.year).localeCompare(String(b.year)));
      }
      setAgencyDetail({ byYear: mergedByYear, categories, vendors, payments, isMBTA });
      setDetailLoading(false);
      setTimeout(() => {
        quasiDetailPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 0);
    });
  }, [quasiYear]);

  return (
    <div className="section">
      <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <span className="section-tag cyan">Quasi-Public Entities</span>
          <h2>The Shadow Government</h2>
          <p>Quasi-government organizations operate with public funds but often with less oversight. Click any agency to see detailed spending breakdown.</p>
        </div>
        <select className="year-select" value={quasiYear} onChange={e => { setQuasiYear(e.target.value); setSelectedAgency(null); setAgencyDetail(null); }}>
          {Array.from({ length: 17 }, (_, i) => 2026 - i).map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {selectedAgency && (
        <div ref={quasiDetailPanelRef} className="detail-panel" style={{ marginBottom: 24 }}>
          <button className="close-btn" onClick={() => { setSelectedAgency(null); setAgencyDetail(null); }}>Close</button>
          <h3 style={{ color: 'var(--accent-cyan)', marginBottom: 4 }}>{selectedAgency}</h3>
          <div className="chart-subtitle">Complete budget breakdown â every vendor, every dollar, every category</div>

          {detailLoading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
              <div className="spinner" style={{ margin: '0 auto 12px' }} /> Loading agency data...
            </div>
          ) : agencyDetail && (
            <>
              {agencyDetail.isMBTA && (
                <div style={{ marginTop: 16, padding: '12px 16px', background: 'rgba(20, 85, 143, 0.08)', border: '1px solid rgba(20, 85, 143, 0.3)', borderRadius: 10, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  ð <strong style={{ color: '#14558F' }}>MBTA Note:</strong> CTHRU tracks state payments to MBTA through ~FY2017. Years 2018â2025 below are pulled from the MBTA's own published audited financial statements.
                  {' '}<a href="https://www.mbta.com/financials/audited-financials" target="_blank" rel="noopener" style={{ color: '#14558F', fontWeight: 600 }}>Audited Financials</a>
                  {' Â· '}
                  <a href="https://www.mbta.com/financials" target="_blank" rel="noopener" style={{ color: '#14558F', fontWeight: 600 }}>MBTA Financial Center</a>
                </div>
              )}
              {/* KPI summary for selected agency */}
              <div className="kpi-row" style={{ marginTop: 16 }}>
                <div className="kpi-card">
                  <div className="kpi-label">Years of Data</div>
                  <div className="kpi-value" style={{ color: 'var(--accent-cyan)' }}>{agencyDetail.byYear.length}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4 }}>
                    {agencyDetail.byYear.length > 0 ? `FY${agencyDetail.byYear[0].year} â FY${agencyDetail.byYear[agencyDetail.byYear.length - 1].year}` : 'N/A'}
                  </div>
                </div>
                <div className="kpi-card">
                  <div className="kpi-label">Top Vendors</div>
                  <div className="kpi-value" style={{ color: 'var(--accent-green)' }}>{agencyDetail.vendors.length}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4 }}>Unique vendors paid</div>
                </div>
                <div className="kpi-card">
                  <div className="kpi-label">Spending Categories</div>
                  <div className="kpi-value" style={{ color: '#E67E22' }}>{agencyDetail.categories.length}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4 }}>Budget line items</div>
                </div>
                <div className="kpi-card">
                  <div className="kpi-label">Total Payments</div>
                  <div className="kpi-value">{agencyDetail.payments.length.toLocaleString()}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4 }}>Individual transactions in FY{quasiYear}</div>
                </div>
              </div>

              {agencyDetail.byYear.length > 0 && (
                <div style={{ marginTop: 20 }}>
                  <h4 style={{ marginBottom: 8, color: 'var(--text-secondary)' }}>Agency Spending by Fiscal Year</h4>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={agencyDetail.byYear}>
                      <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
                      <XAxis dataKey="year" stroke={AXIS_COLOR} />
                      <YAxis tickFormatter={formatMoney} stroke={AXIS_COLOR} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="total" fill="#22ddee" radius={[3, 3, 0, 0]} name="Total Spent" />
                    </BarChart>
                  </ResponsiveContainer>
                  {agencyDetail.byYear.length > 0 && (
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', display: 'block', marginTop: 8 }}>
                      Data available: FY{agencyDetail.byYear[0].year} â FY{agencyDetail.byYear[agencyDetail.byYear.length - 1].year}
                      {!agencyDetail.byYear.find(y => y.year === quasiYear) && (
                        <span style={{ color: 'var(--accent-red)', marginLeft: 8 }}>
                          (No data for FY{quasiYear} â showing available years)
                        </span>
                      )}
                    </span>
                  )}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: 20, marginTop: 24 }}>
                {agencyDetail.vendors.length > 0 && (
                  <div>
                    <h4 style={{ marginBottom: 8, color: 'var(--text-secondary)' }}>Top Vendors â FY{quasiYear}</h4>
                    <ResponsiveContainer width="100%" height={Math.max(200, Math.min(15, agencyDetail.vendors.length) * 28 + 40)}>
                      <BarChart data={agencyDetail.vendors.slice(0, 15)} layout="vertical" margin={{ left: 180 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
                        <XAxis type="number" tickFormatter={formatMoney} stroke={AXIS_COLOR} />
                        <YAxis type="category" dataKey="vendor" stroke={AXIS_COLOR} width={170} tick={{ fontSize: 10 }} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="total" fill="#22cc66" radius={[0, 3, 3, 0]} name="Paid" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {agencyDetail.categories.length > 0 && (
                  <div>
                    <h4 style={{ marginBottom: 8, color: 'var(--text-secondary)' }}>Spending Categories â FY{quasiYear}</h4>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie data={agencyDetail.categories.slice(0, 8)} dataKey="total" nameKey="category" cx="50%" cy="50%" outerRadius={100} label={({ percent }) => `${(percent * 100).toFixed(0)}%`}>
                          {agencyDetail.categories.slice(0, 8).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {agencyDetail.payments.length > 0 && (
                <div style={{ marginTop: 24 }}>
                  <h4 style={{ marginBottom: 8, color: 'var(--text-secondary)' }}>
                    Individual Payments â FY{quasiYear} ({agencyDetail.payments.length} records)
                  </h4>
                  <div className="data-table-wrapper">
                    <table className="data-table">
                      <thead>
                        <tr><th>Date</th><th>Amount</th><th>Vendor</th><th>Account</th><th>Department</th><th>Category</th></tr>
                      </thead>
                      <tbody>
                        {agencyDetail.payments.slice(paymentPage * PAYMENTS_PER_PAGE, (paymentPage + 1) * PAYMENTS_PER_PAGE).map((p, i) => (
                          <tr key={i}>
                            <td style={{ whiteSpace: 'nowrap' }}>{p.date}</td>
                            <td className="money">{formatMoneyFull(p.amount)}</td>
                            <td style={{ fontSize: '0.8rem' }}>{p.vendor}</td>
                            <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{p.account}</td>
                            <td style={{ fontSize: '0.8rem' }}>{p.department}</td>
                            <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{p.category}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {agencyDetail.payments.length > PAYMENTS_PER_PAGE && (
                    <div className="pagination">
                      <button disabled={paymentPage === 0} onClick={() => setPaymentPage(p => p - 1)}>Previous</button>
                      <span className="page-info">Page {paymentPage + 1} of {Math.ceil(agencyDetail.payments.length / PAYMENTS_PER_PAGE)}</span>
                      <button disabled={(paymentPage + 1) * PAYMENTS_PER_PAGE >= agencyDetail.payments.length}
                        onClick={() => setPaymentPage(p => p + 1)}>Next</button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {quasiPayments ? (
        <>
          <div className="chart-card">
            <h3>Payments to Quasi-Government Entities</h3>
            <div className="chart-subtitle">Click any agency to see the full breakdown</div>
            <ResponsiveContainer width="100%" height={600}>
              <BarChart data={quasiPayments.slice(0, 20)} layout="vertical" margin={{ left: 220 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
                <XAxis type="number" tickFormatter={formatMoney} stroke={AXIS_COLOR} />
                <YAxis type="category" dataKey="name" stroke={AXIS_COLOR} width={210} tick={{ fontSize: 11 }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value" fill="#22ddee" radius={[0, 3, 3, 0]} name="Total Payments" cursor="pointer"
                  onClick={(data) => data && selectAgency(data.name)} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="data-table-wrapper" style={{ marginTop: 24 }}>
            <table className="data-table">
              <thead>
                <tr><th>#</th><th>Organization</th><th>Total Payments</th><th></th></tr>
              </thead>
              <tbody>
                {quasiPayments.map((q, i) => (
                  <tr key={i} onClick={() => selectAgency(q.name)} style={{ cursor: 'pointer' }}
                    className={selectedAgency === q.name ? 'active-row' : ''}>
                    <td style={{ color: 'var(--text-muted)' }}>{i + 1}</td>
                    <td style={{ fontWeight: selectedAgency === q.name ? 700 : 400 }}>{q.name}</td>
                    <td className="money">{formatMoneyFull(q.value)}</td>
                    <td><ChevronRight size={12} style={{ color: 'var(--accent-purple)' }} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="loading-skeleton" />
      )}
    </div>
  );
}

// ============================================================
// PAYROLL SEARCHER â Search by name or department
// ============================================================

function PayrollSearcher({ payrollYear, setPayrollYear, data }) {
  const [payrollSearch, setPayrollSearch] = useState('');
  const [searchType, setSearchType] = useState('name');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchPage, setSearchPage] = useState(0);
  const RESULTS_PER_PAGE = 50;

  useEffect(() => {
    if (!payrollSearch.trim()) { setSearchResults([]); return; }
    const timer = setTimeout(() => {
      setSearchLoading(true);
      searchPayroll(payrollSearch, payrollYear, searchType, 200).then(results => {
        setSearchResults(results);
        setSearchLoading(false);
        setSearchPage(0);
      });
    }, 400);
    return () => clearTimeout(timer);
  }, [payrollSearch, searchType, payrollYear]);

  return (
    <div className="section">
      <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <span className="section-tag gold">Compensation</span>
          <h2>Public Employee Payroll</h2>
          <p>Every salary, every department. Data from CTHRU Statewide Payroll.</p>
        </div>
        <select className="year-select" value={payrollYear} onChange={e => setPayrollYear(e.target.value)}>
          {Array.from({ length: 17 }, (_, i) => 2026 - i).map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {data.payrollByDept ? (
        <div className="card-grid">
          <div className="chart-card">
            <h3>Total Payroll by Department</h3>
            <div className="chart-subtitle">Aggregate compensation â {payrollYear}</div>
            <ResponsiveContainer width="100%" height={500}>
              <BarChart data={data.payrollByDept.slice(0, 15)} layout="vertical" margin={{ left: 180 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
                <XAxis type="number" tickFormatter={formatMoney} stroke={AXIS_COLOR} />
                <YAxis type="category" dataKey="department" stroke={AXIS_COLOR} width={170} tick={{ fontSize: 11 }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="totalPay" fill="#ffaa22" radius={[0, 3, 3, 0]} name="Total Compensation" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="chart-card">
            <h3>Headcount by Department</h3>
            <div className="chart-subtitle">Employee count â {payrollYear}</div>
            <ResponsiveContainer width="100%" height={500}>
              <BarChart data={data.payrollByDept.slice(0, 15)} layout="vertical" margin={{ left: 180 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
                <XAxis type="number" stroke={AXIS_COLOR} />
                <YAxis type="category" dataKey="department" stroke={AXIS_COLOR} width={170} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="employees" fill="#3388ff" radius={[0, 3, 3, 0]} name="Employees" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        <div className="loading-skeleton" />
      )}

      <div style={{ marginTop: 32 }}>
        <h3 style={{ marginBottom: 16 }}>Search Payroll Records</h3>
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 280, position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', zIndex: 1 }} />
            <input type="text" className="search-input"
              placeholder={searchType === 'name' ? 'Search by name (first or last)...' : 'Search by agency/department...'}
              value={payrollSearch} onChange={e => setPayrollSearch(e.target.value)} />
          </div>
          <div className="filter-toggle">
            <button className={`filter-btn ${searchType === 'name' ? 'active' : ''}`} onClick={() => setSearchType('name')}>By Name</button>
            <button className={`filter-btn ${searchType === 'department' ? 'active' : ''}`} onClick={() => setSearchType('department')}>By Agency</button>
          </div>
        </div>

        {payrollSearch && (
          <div>
            <h4 style={{ marginBottom: 8, color: 'var(--text-secondary)' }}>
              {searchLoading ? 'Searching...' : `Results (${searchResults.length} found)`}
            </h4>
            {searchLoading ? (
              <div className="loading-skeleton" style={{ height: 200 }} />
            ) : searchResults.length > 0 ? (
              <>
                <div className="data-table-wrapper">
                  <table className="data-table">
                    <thead>
                      <tr><th>#</th><th>Name</th><th>Department</th><th>Title</th><th>Total Pay</th><th>Base Pay</th><th>Overtime</th><th>Other Pay</th></tr>
                    </thead>
                    <tbody>
                      {searchResults.slice(searchPage * RESULTS_PER_PAGE, (searchPage + 1) * RESULTS_PER_PAGE).map((r, i) => (
                        <tr key={i}>
                          <td style={{ color: 'var(--text-muted)' }}>{searchPage * RESULTS_PER_PAGE + i + 1}</td>
                          <td>{r.name}</td>
                          <td style={{ fontSize: '0.85rem' }}>{r.department}</td>
                          <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{r.title}</td>
                          <td className="money">{formatMoneyFull(r.totalPay)}</td>
                          <td className="money">{formatMoneyFull(r.basePay)}</td>
                          <td className="money" style={{ color: 'var(--accent-green)' }}>{formatMoneyFull(r.overtime)}</td>
                          <td className="money">{formatMoneyFull(r.otherPay)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {searchResults.length > RESULTS_PER_PAGE && (
                  <div className="pagination">
                    <button disabled={searchPage === 0} onClick={() => setSearchPage(p => p - 1)}>Previous</button>
                    <span className="page-info">Page {searchPage + 1} of {Math.ceil(searchResults.length / RESULTS_PER_PAGE)}</span>
                    <button disabled={(searchPage + 1) * RESULTS_PER_PAGE >= searchResults.length}
                      onClick={() => setSearchPage(p => p + 1)}>Next</button>
                  </div>
                )}
              </>
            ) : (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
                No results found for &quot;{payrollSearch}&quot;
              </div>
            )}
          </div>
        )}
      </div>

      {data.topEarners && !payrollSearch && (
        <div style={{ marginTop: 32 }}>
          <h3 style={{ marginBottom: 16 }}>Top 50 Highest-Paid State Employees â {payrollYear}</h3>
          <div className="data-table-wrapper">
            <table className="data-table">
              <thead>
                <tr><th>#</th><th>Name</th><th>Department</th><th>Title</th><th>Total Compensation</th></tr>
              </thead>
              <tbody>
                {data.topEarners.map((e, i) => (
                  <tr key={i}>
                    <td style={{ color: 'var(--text-muted)' }}>{i + 1}</td>
                    <td>{e.name}</td>
                    <td>{e.department}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{e.title}</td>
                    <td className="money">{formatMoneyFull(e.totalPay)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {data.payrollOverTime && (
        <div className="chart-card" style={{ marginTop: 32 }}>
          <h3>Total State Payroll Over Time</h3>
          <div className="chart-subtitle">Year-over-year payroll growth</div>
          <ResponsiveContainer width="100%" height={350}>
            <AreaChart data={data.payrollOverTime}>
              <defs>
                <linearGradient id="payrollGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ffaa22" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#ffaa22" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
              <XAxis dataKey="year" stroke={AXIS_COLOR} />
              <YAxis tickFormatter={formatMoney} stroke={AXIS_COLOR} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="totalPayroll" stroke="#ffaa22" fill="url(#payrollGrad)" strokeWidth={2} name="Total Payroll" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

// ============================================================
// FOLLOW THE MONEY â Campaign Finance + Cross-Reference
// ============================================================

function FollowTheMoney() {
  const [legislators, setLegislators] = useState([]);
  const [pacs, setPacs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [crossRefVendor, setCrossRefVendor] = useState('');
  const [crossRefResults, setCrossRefResults] = useState(null);
  const [crossRefLoading, setCrossRefLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedLegislator, setSelectedLegislator] = useState(null);
  const [legislatorContributions, setLegislatorContributions] = useState(null);
  const [contribLoading, setContribLoading] = useState(false);
  const [contribYear, setContribYear] = useState(String(new Date().getFullYear()));
  const [contribPage, setContribPage] = useState(0);
  const [contribSort, setContribSort] = useState('date-desc');
  const [crossRefSort, setCrossRefSort] = useState('amount-desc');
  const [crossRefYear, setCrossRefYear] = useState('all');
  const [crossRefPage, setCrossRefPage] = useState(0);
  const contribRef = useRef(null);
  const CONTRIB_PAGE_SIZE = 100;
  const CROSSREF_PAGE_SIZE = 24;

  // Last contribution date cache: cpfId â { date, amount, contributor }
  const [lastContribMap, setLastContribMap] = useState({});
  const [lastContribLoading, setLastContribLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.allSettled([
      fetchLegislatorFinances('2025'),
      fetchPACFinances('2025'),
    ]).then(([legResult, pacResult]) => {
      if (legResult.status === 'fulfilled') setLegislators(legResult.value);
      if (pacResult.status === 'fulfilled') setPacs(pacResult.value);
      setLoading(false);
    });
  }, []);

  // Batch-fetch last contribution dates for all legislators (throttled: 8 concurrent)
  useEffect(() => {
    if (legislators.length === 0) return;
    setLastContribLoading(true);
    const sorted = [...legislators].sort((a, b) => b.receipts - a.receipts);
    const BATCH = 8;
    let cancelled = false;
    (async () => {
      for (let i = 0; i < sorted.length; i += BATCH) {
        if (cancelled) break;
        const batch = sorted.slice(i, i + BATCH);
        const results = await Promise.allSettled(batch.map(l => fetchLastContribution(l.cpfId)));
        if (cancelled) break;
        setLastContribMap(prev => {
          const next = { ...prev };
          results.forEach(r => {
            if (r.status === 'fulfilled' && r.value.lastContribDate) {
              next[r.value.cpfId] = {
                date: r.value.lastContribDate,
                amount: r.value.lastContribAmount,
                contributor: r.value.lastContributor,
              };
            }
          });
          return next;
        });
      }
      if (!cancelled) setLastContribLoading(false);
    })();
    return () => { cancelled = true; };
  }, [legislators]);

  // Search contributions
  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults(null); return; }
    const timer = setTimeout(() => {
      setSearchLoading(true);
      searchContributions({ searchPhrase: searchQuery, pageSize: 50 }).then(data => {
        setSearchResults(data);
        setSearchLoading(false);
      });
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Cross-reference vendor â pulls a wide window so client-side sort/filter works
  const runCrossRef = useCallback(() => {
    if (!crossRefVendor.trim()) return;
    setCrossRefLoading(true);
    setCrossRefPage(0);
    crossReferenceVendorDonations(crossRefVendor, 500).then(data => {
      setCrossRefResults(data);
      setCrossRefLoading(false);
    });
  }, [crossRefVendor]);

  // Load legislator contributions for a given year + page
  // OCPF returns oldest-first when no date filter is set, so we always pass a date window.
  const loadContribs = useCallback((leg, year, page) => {
    setContribLoading(true);
    const params = { cpfId: leg.cpfId, pageSize: CONTRIB_PAGE_SIZE, pageIndex: page };
    const today = new Date().toISOString().slice(0, 10);
    if (year && year !== 'all') {
      params.startDate = `${year}-01-01`;
      params.endDate = `${year}-12-31`;
    } else {
      // "All" mode: fetch last 5 years so we get recent data, not 2010-era results
      const fiveYearsAgo = new Date();
      fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
      params.startDate = fiveYearsAgo.toISOString().slice(0, 10);
      params.endDate = today;
    }
    searchContributions(params).then(data => {
      setLegislatorContributions(data);
      setContribLoading(false);
    });
  }, []);

  const selectLegislatorForContribs = useCallback((leg) => {
    const currentYear = String(new Date().getFullYear());
    setSelectedLegislator(leg);
    setContribYear(currentYear);
    setContribPage(0);
    loadContribs(leg, currentYear, 0);
    setTimeout(() => contribRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  }, [loadContribs]);

  // Reload when year or page changes
  useEffect(() => {
    if (selectedLegislator) loadContribs(selectedLegislator, contribYear, contribPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contribYear, contribPage]);

  const topFundedLegislators = [...legislators].sort((a, b) => b.receipts - a.receipts).slice(0, 20);
  const topPACs = [...pacs].sort((a, b) => b.receipts - a.receipts).slice(0, 15);
  const totalLegReceipts = legislators.reduce((s, l) => s + l.receipts, 0);
  const totalPACReceipts = pacs.reduce((s, p) => s + p.receipts, 0);

  return (
    <div className="section follow-the-money">
      <div className="section-header">
        <span className="section-tag purple">Campaign Finance</span>
        <h2>Follow the Money</h2>
        <p>Cross-referencing OCPF campaign finance data with state spending. Who pays to play â and who profits?</p>
      </div>

      <div className="disclaimer">
        Campaign finance data from the Massachusetts Office of Campaign and Political Finance (OCPF) public API.
        Cross-references show contributions from entities matching vendor names â correlation does not imply wrongdoing.
        All data is publicly available under Massachusetts open records laws.
      </dsetLegislatorContributions(null); }}>Close</button>
                  <h3 style={{ color: 'var(--accent-purple)' }}>{selectedLegislator.name}</h3>
                  <div className="chart-subtitle">
                    {selectedLegislator.office} {selectedLegislator.district && `â ${selectedLegislator.district}`} | {selectedLegislator.party}
                  </div>
                  <div className="kpi-row" style={{ marginTop: 16 }}>
                    <div className="kpi-card">
                      <div className="kpi-label">Total Receipts</div>
                      <div className="kpi-value" style={{ color: 'var(--accent-green)' }}>{formatMoney(selectedLegislator.receipts)}</div>
                    </div>
                    <div className="kpi-card">
                      <div className="kpi-label">Expenditures</div>
                      <div className="kpi-value" style={{ color: 'var(--accent-red)' }}>{formatMoney(selectedLegislator.expenditures)}</div>
                    </div>
                    <div className="kpi-card">
                      <div className="kpi-label">Cash on Hand</div>
                      <div className="kpi-value">{formatMoney(selectedLegislator.cashOnHand)}</div>
                    </div>
                  </div>

                  {contribLoading ? (
                    <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                      <div className="spinner" style={{ margin: '0 auto 12px' }} /> Loading contributions...
                    </div>
                  ) : legislatorContributions?.items && (
                    <div style={{ marginTop: 16 }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                        <h4 style={{ color: 'var(--text-secondary)', margin: 0 }}>
                          Contributions ({legislatorContributions.items.length} on this page)
                        </h4>
                        <div style={{ marginLeft: 'auto', display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                          <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Year:</label>
                          <select value={contribYear} onChange={e => { setContribPage(0); setContribYear(e.target.value); }}
                            style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', background: '#fff', fontSize: '0.85rem' }}>
                            <option value="all">All (last 5 yrs)</option>
                            {[2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016, 2015, 2014, 2013, 2012, 2011, 2010].map(y => (
                              <option key={y} value={y}>{y}</option>
                            ))}
                          </select>
                          <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Sort:</label>
                          <select value={contribSort} onChange={e => setContribSort(e.target.value)}
                            style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', background: '#fff', fontSize: '0.85rem' }}>
                            <option value="date-desc">Date (newest)</option>
                            <option value="date-asc">Date (oldest)</option>
                            <option value="amount-desc">Amount (high â low)</option>
                            <option value="amount-asc">Amount (low â high)</option>
                            <option value="contributor">Contributor (AâZ)</option>
                          </select>
                          <button onClick={() => setContribPage(p => Math.max(0, p - 1))} disabled={contribPage === 0}
                            style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border)', background: '#fff', cursor: contribPage === 0 ? 'not-allowed' : 'pointer', opacity: contribPage === 0 ? 0.5 : 1 }}>
                            â Prev
                          </button>
                          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Page {contribPage + 1}</span>
                          <button onClick={() => setContribPage(p => p + 1)} disabled={legislatorContributions.items.length < CONTRIB_PAGE_SIZE}
                            style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border)', background: '#fff', cursor: legislatorContributions.items.length < CONTRIB_PAGE_SIZE ? 'not-allowed' : 'pointer', opacity: legislatorContributions.items.length < CONTRIB_PAGE_SIZE ? 0.5 : 1 }}>
                            Next â
                          </button>
                        </div>
                      </div>
                      {legislatorContributions.items.length === 0 ? (
                        <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)', background: 'var(--bg-card-hover)', borderRadius: 8 }}>
                          No contributions found for {contribYear === 'all' ? 'this filer' : contribYear}.
                        </div>
                      ) : (
                        <div className="data-table-wrapper">
                          <table className="data-table">
                            <thead>
                              <tr><th>Date</th><th>Contributor</th><th>Amount</th><th>Employer</th><th>City</th></tr>
                            </thead>
                            <tbody>
                              {[...legislatorContributions.items].sort((a, b) => {
                                switch (contribSort) {
                                  case 'date-asc': return (a.date || '').localeCompare(b.date || '');
                                  case 'date-desc': return (b.date || '').localeCompare(a.date || '');
                                  case 'amount-desc': return b.amountNum - a.amountNum;
                                  case 'amount-asc': return a.amountNum - b.amountNum;
                                  case 'contributor': return (a.contributor || '').localeCompare(b.contributor || '');
                                  default: return 0;
                                }
                              }).map((c, i) => (
                                <tr key={i}>
                                  <td style={{ whiteSpace: 'nowrap', fontSize: '0.8rem' }}>{c.date}</td>
                                  <td>{c.contributor}</td>
                                  <td className="money">{c.amount}</td>
                                  <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{c.employer}</td>
                                  <td style={{ fontSize: '0.8rem' }}>{c.city}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="data-table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr><th>#</th><th>Name</th><th>Office</th><th>Party</th><th>Receipts</th><th>Expenditures</th><th>Cash on Hand</th><th>Last Contribution</th><th></th></tr>
                  </thead>
                  <tbody>
                    {legislators.sort((a, b) => {
                      const dA = lastContribMap[a.cpfId]?.date || '';
                      const dB = lastContribMap[b.cpfId]?.date || '';
                      // Parse M/D/YYYY dates for proper sort (string compare fails on this format)
                      const pA = dA ? (() => { const p = dA.split('/'); return new Date(+p[2], +p[0]-1, +p[1]).getTime(); })() : 0;
                      const pB = dB ? (() => { const p = dB.split('/'); return new Date(+p[2], +p[0]-1, +p[1]).getTime(); })() : 0;
                      if (pA || pB) return (pB - pA) || b.receipts - a.receipts;
                      return b.receipts - a.receipts;
                    }).map((l, i) => (
                      <tr key={i} onClick={() => selectLegislatorForContribs(l)} style={{ cursor: 'pointer' }}
                        className={selectedLegislator?.cpfId === l.cpfId ? 'active-row' : ''}>
                        <td style={{ color: 'var(--text-muted)' }}>{i + 1}</td>
                        <td style={{ fontWeight: selectedLegislator?.cpfId === l.cpfId ? 700 : 400 }}>{l.name}</td>
                        <td style={{ fontSize: '0.8rem' }}>{l.office}</td>
                        <td style={{ fontSize: '0.8rem', color: l.party === 'Democratic' ? '#3388ff' : l.party === 'Republican' ? '#ff3344' : 'var(--text-muted)' }}>{l.party}</td>
                        <td className="money">{formatMoney(l.receipts)}</td>
                        <td className="money" style={{ color: 'var(--accent-red)' }}>{formatMoney(l.expenditures)}</td>
                        <td className="money">{formatMoney(l.cashOnHand)}</td>
                        <td style={{ fontSize: '0.8rem', whiteSpace: 'nowrap', color: lastContribMap[l.cpfId] ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                          {lastContribMap[l.cpfId]
                            ? <span title={`${lastContribMap[l.cpfId].amount} from ${lastContribMap[l.cpfId].contributor}`}>{lastContribMap[l.cpfId].date}</span>
                            : (lastContribLoading ? <span className="spinner" style={{ width: 12, height: 12, borderWidth: 2, display: 'inline-block', verticalAlign: 'middle' }} /> : 'â')}
                        </td>
                        <td><ChevronRight size={12} style={{ color: 'var(--accent-purple)' }} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {/* === CROSS-REFERENCE TAB === */}
          {activeTab === 'crossref' && (
            <motion.div {...pageVariants} key="ftm-crossref">
              <div className="chart-card highlighted" style={{ marginBottom: 24 }}>
                <h3 style={{ color: 'var(--accent-purple)' }}>
                  <Fingerprint size={18} style={{ verticalAlign: 'middle', marginRight: 8 }} />
                  Vendor â Donor Cross-Reference
                </h3>
                <div className="chart-subtitle">
                  Enter a state vendor name to see if anyone associated with that company donated to MA politicians.
                  This searches OCPF contribution records matching the vendor name.
                </div>
                <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
                  <div style={{ flex: 1, position: 'relative' }}>
                    <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', zIndex: 1 }} />
                    <input type="text" className="search-input"
                      placeholder="Enter vendor name (e.g. Deloitte, Partners Healthcare, KPMG)..."
                      value={crossRefVendor}
                      onChange={e => setCrossRefVendor(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && runCrossRef()} />
                  </div>
                  <button className="btn-primary" onClick={runCrossRef}
                    style={{ padding: '12px 24px', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                    <Fingerprint size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Investigate
                  </button>
                </div>
              </div>

              {crossRefLoading && (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                  <div className="spinner" style={{ margin: '0 auto 12px' }} /> Cross-referencing OCPF records...
                </div>
              )}

              {crossRefResults && !crossRefLoading && (() => {
                // Apply year filter and sort client-side
                const filtered = crossRefResults.filter(c => {
                  if (crossRefYear === 'all') return true;
                  return (c.date || '').startsWith(String(crossRefYear));
                });
                const sorted = [...filtered].sort((a, b) => {
                  switch (crossRefSort) {
                    case 'amount-desc': return b.amountNum - a.amountNum;
                    case 'amount-asc': return a.amountNum - b.amountNum;
                    case 'date-desc': return (b.date || '').localeCompare(a.date || '');
                    case 'date-asc': return (a.date || '').localeCompare(b.date || '');
                    case 'contributor': return (a.contributor || '').localeCompare(b.contributor || '');
                    case 'recipient': return (a.recipient || '').localeCompare(b.recipient || '');
                    default: return 0;
                  }
                });
                const pageStart = crossRefPage * CROSSREF_PAGE_SIZE;
                const pageEnd = pageStart + CROSSREF_PAGE_SIZE;
                const cardSlice = sorted.slice(pageStart, pageEnd);
                const totalPages = Math.max(1, Math.ceil(sorted.length / CROSSREF_PAGE_SIZE));
                return (
                <div>
                  <h4 style={{ marginBottom: 12, color: 'var(--text-secondary)' }}>
                    {sorted.length > 0
                      ? `Found ${sorted.length} contribution(s) matching "${crossRefVendor}"${crossRefResults.length >= 500 ? ' (capped at 500 â narrow your search for more)' : ''}`
                      : `No contributions found matching "${crossRefVendor}"${crossRefYear !== 'all' ? ` for ${crossRefYear}` : ''}`}
                  </h4>

                  {sorted.length > 0 && (
                    <>
                      {/* Summary cards */}
                      <div className="kpi-row" style={{ marginBottom: 20 }}>
                        <div className="kpi-card" style={{ borderColor: 'rgba(153,85,255,0.3)' }}>
                          <div className="kpi-label">Total Donated</div>
                          <div className="kpi-value" style={{ color: 'var(--accent-purple)' }}>
                            {formatMoney(sorted.reduce((s, c) => s + c.amountNum, 0))}
                          </div>
                        </div>
                        <div className="kpi-card">
                          <div className="kpi-label">Unique Recipients</div>
                          <div className="kpi-value">{new Set(sorted.map(c => c.recipientCpfId)).size}</div>
                        </div>
                        <div className="kpi-card">
                          <div className="kpi-label">Unique Donors</div>
                          <div className="kpi-value">{new Set(sorted.map(c => c.contributor)).size}</div>
                        </div>
                      </div>

                      {/* Filter / Sort / Pagination controls */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginBottom: 16, padding: 12, background: 'var(--bg-card-hover)', borderRadius: 10, border: '1px solid var(--border)' }}>
                        <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Year:</label>
                        <select value={crossRefYear} onChange={e => { setCrossRefPage(0); setCrossRefYear(e.target.value); }}
                          style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', background: '#fff', fontSize: '0.85rem' }}>
                          <option value="all">All years</option>
                          {[2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016, 2015, 2014, 2013, 2012, 2011, 2010].map(y => (
                            <option key={y} value={y}>{y}</option>
                          ))}
                        </select>
                        <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: 8 }}>Sort:</label>
                        <select value={crossRefSort} onChange={e => { setCrossRefPage(0); setCrossRefSort(e.target.value); }}
                          style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', background: '#fff', fontSize: '0.85rem' }}>
                          <option value="amount-desc">Amount (high â low)</option>
                          <option value="amount-asc">Amount (low â high)</option>
                          <option value="date-desc">Date (newest)</option>
                          <option value="date-asc">Date (oldest)</option>
                          <option value="contributor">Contributor (AâZ)</option>
                          <option value="recipient">Recipient (AâZ)</option>
                        </select>
                        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                          <button onClick={() => setCrossRefPage(p => Math.max(0, p - 1))} disabled={crossRefPage === 0}
                            style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border)', background: '#fff', cursor: crossRefPage === 0 ? 'not-allowed' : 'pointer', opacity: crossRefPage === 0 ? 0.5 : 1 }}>â Prev</button>
                          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Page {crossRefPage + 1} / {totalPages}</span>
                          <button onClick={() => setCrossRefPage(p => Math.min(totalPages - 1, p + 1))} disabled={crossRefPage >= totalPages - 1}
                            style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border)', background: '#fff', cursor: crossRefPage >= totalPages - 1 ? 'not-allowed' : 'pointer', opacity: crossRefPage >= totalPages - 1 ? 0.5 : 1 }}>Next â</button>
                        </div>
                      </div>

                      {/* Connection cards (current page) */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16, marginBottom: 24 }}>
                        {cardSlice.map((c, i) => (
                          <div key={i} className="connection-card">
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '1px' }}>
                              Contribution Match
                            </div>
                            <div style={{ fontWeight: 600, marginBottom: 4 }}>{c.contributor}</div>
                            <div className="connection-amount">{c.amount}</div>
                            <div style={{ marginTop: 8, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                              <ArrowRight size={12} style={{ color: 'var(--accent-purple)', verticalAlign: 'middle', marginRight: 4 }} />
                              {c.recipient}
                            </div>
                            {c.employer && (
                              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4 }}>
                                Employer: {c.employer}
                              </div>
                            )}
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
                              {c.date} | {c.city}{c.state ? `, ${c.state}` : ''}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Full sorted table */}
                      <div className="data-table-wrapper">
                        <table className="data-table">
                          <thead>
                            <tr><th>Date</th><th>Contributor</th><th>Amount</th><th>Recipient</th><th>Employer</th><th>City</th></tr>
                          </thead>
                          <tbody>
                            {sorted.map((c, i) => (
                              <tr key={i}>
                                <td style={{ whiteSpace: 'nowrap', fontSize: '0.8rem' }}>{c.date}</td>
                                <td>{c.contributor}</td>
                                <td className="money">{c.amount}</td>
                                <td style={{ color: 'var(--accent-purple)' }}>{c.recipient}</td>
                                <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{c.employer}</td>
                                <td style={{ fontSize: '0.8rem' }}>{c.city}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </div>
                );
              })()}
            </motion.div>
          )}

          {/* === SEARCH TAB === */}
          {activeTab === 'search' && (
            <motion.div {...pageVariants} key="ftm-search">
              <div style={{ marginBottom: 24 }}>
                <div style={{ position: 'relative' }}>
                  <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', zIndex: 1 }} />
                  <input type="text" className="search-input"
                    placeholder="Search all campaign contributions (by name, employer, or keyword)..."
                    value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                </div>
              </div>

              {searchLoading && (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                  <div className="spinner" style={{ margin: '0 auto 12px' }} /> Searching OCPF records...
                </div>
              )}

              {searchResults && !searchLoading && (
                <div>
                  <h4 style={{ marginBottom: 12, color: 'var(--text-secondary)' }}>
                    {searchResults.items.length} contributions found
                  </h4>
                  {searchResults.items.length > 0 && (
                    <div className="data-table-wrapper">
                      <table className="data-table">
                        <thead>
                          <tr><th>Date</th><th>Contributor</th><th>Amount</th><th>Recipient</th><th>Employer</th><th>Occupation</th><th>City</th></tr>
                        </thead>
                        <tbody>
                          {searchResults.items.map((c, i) => (
                            <tr key={i}>
                              <td style={{ whiteSpace: 'nowrap', fontSize: '0.8rem' }}>{c.date}</td>
                              <td>{c.contributor}</td>
                              <td className="money">{c.amount}</td>
                              <td style={{ color: 'var(--accent-purple)' }}>{c.recipient}</td>
                              <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{c.employer}</td>
                              <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{c.occupation}</td>
                              <td style={{ fontSize: '0.8rem' }}>{c.city}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}

          {/* === OCPF DATA CENTER SUB-TAB === */}
          {activeTab === 'ocpf' && (
            <motion.div {...pageVariants} key="ftm-ocpf">
              <OcpfDataCenter />
            </motion.div>
          )}

          {/* === PAC DASHBOARD SUB-TAB === */}
          {activeTab === 'pacs' && (
            <motion.div {...pageVariants} key="ftm-pacs">
              <PacDashboard />
            </motion.div>
          )}

          {/* === NONPROFIT EXPLORER SUB-TAB === */}
          {activeTab === 'nonprofits' && (
            <motion.div {...pageVariants} key="ftm-nonprofits">
              <NonprofitLookup />
            </motion.div>
          )}
        </>
      )}
    </div>
  );
}

// ============================================================
// TREEMAP CONTENT for Budget Visualization
// ============================================================

const TreemapContent = ({ x, y, width, height, name, value, index }) => {
  if (width < 60 || height < 40) return null;
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} rx={4}
        style={{ fill: COLORS[index % COLORS.length], stroke: '#ffffff', strokeWidth: 2, opacity: 0.9 }} />
      <text x={x + width / 2} y={y + height / 2 - 8} textAnchor="middle" fill="#fff" fontSize={width > 120 ? 12 : 10} fontWeight={600}>
        {name?.length > 20 ? name.substring(0, 18) + 'â¦' : name}
      </text>
      <text x={x + width / 2} y={y + height / 2 + 10} textAnchor="middle" fill="rgba(255,255,255,0.7)" fontSize={10}>
        {formatMoney(value)}
      </text>
    </g>
  );
};

// ============================================================
// MUNICIPALITIES EXPLORER â MA DLS Long-Term Debt (351 towns)
// ============================================================

function MunicipalitiesExplorer() {
  const [rows, setRows] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [year, setYear] = useState(2025);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState('debt_per_capita');
  const [sortDir, setSortDir] = useState('desc');
  const [selectedTown, setSelectedTown] = useState(null);

  useEffect(() => {
    const url = `${import.meta.env.BASE_URL}data/ma-municipal-debt.json?t=${Date.now()}`;
    fetch(url)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(setRows)
      .catch(err => setLoadError(err.message || String(err)));
  }, []);

  const years = rows ? Array.from(new Set(rows.map(r => r.fiscal_year))).sort() : [];
  const yearRows = rows ? rows.filter(r => r.fiscal_year === year) : [];

  const filtered = yearRows.filter(r => {
    if (!search.trim()) return true;
    return r.municipality.toLowerCase().includes(search.trim().toLowerCase());
  });

  const sorted = [...filtered].sort((a, b) => {
    const av = a[sortKey];
    const bv = b[sortKey];
    const an = av == null ? -Infinity : Number(av);
    const bn = bv == null ? -Infinity : Number(bv);
    if (typeof av === 'string' && typeof bv === 'string') {
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    }
    return sortDir === 'asc' ? an - bn : bn - an;
  });

  const setSort = (key) => {
    if (key === sortKey) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir(key === 'municipality' ? 'asc' : 'desc'); }
  };

  // Aggregate KPIs for the selected year
  const totalDebt = yearRows.reduce((s, r) => s + (Number(r.total_outstanding_debt) || 0), 0);
  const totalPop = yearRows.reduce((s, r) => s + (Number(r.population) || 0), 0);
  const statewidePerCapita = totalPop > 0 ? totalDebt / totalPop : 0;
  const highest = yearRows
    .filter(r => r.debt_per_capita != null)
    .sort((a, b) => Number(b.debt_per_capita) - Number(a.debt_per_capita))[0];

  // Per-town history for the drilldown
  const townHistory = selectedTown && rows
    ? rows.filter(r => r.municipality === selectedTown).sort((a, b) => a.fiscal_year - b.fiscal_year)
    : [];

  const arrow = (key) => sortKey === key ? (sortDir === 'asc' ? ' â²' : ' â¼') : '';

  return (
    <div className="section">
      <div className="section-header">
        <span className="section-tag red">Municipal Debt</span>
        <h2>How Much Your Town Owes</h2>
        <p>
          Every one of Massachusetts' 351 cities and towns. Total outstanding long-term debt,
          debt-per-resident, and debt service as a share of the local budget â FY2021 through FY2025.
          How much is being taken away from you?
        </p>
      </div>

      <div className="disclaimer">
        Source: Massachusetts Division of Local Services (DLS) Municipal Databank â Cat_6 Long-Term Debt 351 report.
        {' '}Some FY2025 values are blank because municipal Schedule A filings are still being processed by DOR.
      </div>

      {loadError && (
        <div className="card" style={{ borderColor: 'var(--accent-red)', marginBottom: 20 }}>
          <div className="card-title"><AlertTriangle size={14} /> Failed to load municipal debt data</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 8 }}>{loadError}</div>
        </div>
      )}

      {!rows && !loadError && (
        <div className="loading-skeleton" style={{ height: 400 }} />
      )}

      {rows && (
        <>
          <div className="kpi-row">
            <div className="card">
              <div className="card-title"><Banknote size={14} /> Total Municipal Debt</div>
              <div className="card-value">{formatMoney(totalDebt)}</div>
              <div className="card-change">All 351 towns, FY{year}</div>
            </div>
            <div className="card">
              <div className="card-title"><Users size={14} /> Statewide Population</div>
              <div className="card-value">{totalPop.toLocaleString()}</div>
              <div className="card-change">DLS population estimate</div>
            </div>
            <div className="card">
              <div className="card-title"><TrendingUp size={14} /> Avg Debt / Resident</div>
              <div className="card-value" style={{ color: 'var(--accent-red)' }}>
                ${Math.round(statewidePerCapita).toLocaleString()}
              </div>
              <div className="card-change">Weighted by population</div>
            </div>
            <div className="card">
              <div className="card-title"><MapPin size={14} /> Highest Per-Capita</div>
              <div className="card-value" style={{ fontSize: '1.5rem' }}>
                {highest ? highest.municipality : 'â'}
              </div>
              <div className="card-change" style={{ color: 'var(--accent-red)' }}>
                {highest && highest.debt_per_capita != null
                  ? `$${Number(highest.debt_per_capita).toLocaleString()}/person`
                  : ''}
              </div>
            </div>
          </div>

          <div style={{
            display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center',
            margin: '24px 0 16px', padding: '14px 16px',
            background: 'var(--card-bg, rgba(255,255,255,0.04))',
            borderRadius: 8, border: '1px solid var(--border, rgba(255,255,255,0.08))'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: '1 1 260px' }}>
              <Search size={16} />
              <input
                type="text"
                placeholder="Search 351 towns..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{
                  flex: 1, background: 'transparent', border: 'none', outline: 'none',
                  color: 'var(--text-primary)', fontSize: '0.95rem', padding: '6px 4px'
                }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Fiscal Year</label>
              <select
                value={year}
                onChange={e => setYear(Number(e.target.value))}
                style={{
                  background: 'var(--card-bg, rgba(255,255,255,0.06))',
                  color: 'var(--text-primary)', border: '1px solid var(--border, rgba(255,255,255,0.15))',
                  borderRadius: 6, padding: '6px 10px', fontSize: '0.9rem'
                }}
              >
                {years.map(y => <option key={y} value={y}>FY{y}</option>)}
              </select>
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Showing <strong>{sorted.length}</strong> of {yearRows.length} towns
            </div>
          </div>

          <div className="chart-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto', maxHeight: 640 }}>
              <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead style={{ position: 'sticky', top: 0, background: 'var(--card-bg, #14192a)', zIndex: 1 }}>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '10px 12px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                        onClick={() => setSort('municipality')}>Municipality{arrow('municipality')}</th>
                    <th style={{ textAlign: 'right', padding: '10px 12px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                        onClick={() => setSort('total_outstanding_debt')}>Total Debt{arrow('total_outstanding_debt')}</th>
                    <th style={{ textAlign: 'right', padding: '10px 12px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                        onClick={() => setSort('debt_pct_eqv')}>Debt / EQV %{arrow('debt_pct_eqv')}</th>
                    <th style={{ textAlign: 'right', padding: '10px 12px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                        onClick={() => setSort('population')}>Population{arrow('population')}</th>
                    <th style={{ textAlign: 'right', padding: '10px 12px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                        onClick={() => setSort('debt_per_capita')}>Debt / Resident{arrow('debt_per_capita')}</th>
                    <th style={{ textAlign: 'right', padding: '10px 12px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                        onClick={() => setSort('debt_service_pct_budget')}>Debt Svc % Budget{arrow('debt_service_pct_budget')}</th>
                    <th style={{ textAlign: 'right', padding: '10px 12px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                        onClick={() => setSort('total_budget')}>Total Budget{arrow('total_budget')}</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((r, i) => (
                    <tr
                      key={`${r.dor_code}-${r.fiscal_year}`}
                      onClick={() => setSelectedTown(r.municipality)}
                      style={{
                        borderTop: '1px solid var(--border, rgba(255,255,255,0.06))',
                        cursor: 'pointer',
                        background: selectedTown === r.municipality ? 'rgba(255,51,68,0.08)' : (i % 2 ? 'rgba(255,255,255,0.02)' : 'transparent')
                      }}
                    >
                      <td style={{ padding: '8px 12px', fontWeight: 500 }}>{r.municipality}</td>
                      <td className="money" style={{ padding: '8px 12px', textAlign: 'right' }}>
                        {r.total_outstanding_debt != null ? formatMoney(Number(r.total_outstanding_debt)) : 'â'}
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                        {r.debt_pct_eqv != null ? `${Number(r.debt_pct_eqv).toFixed(2)}%` : 'â'}
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                        {r.population != null ? Number(r.population).toLocaleString() : 'â'}
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--accent-red)', fontWeight: 600 }}>
                        {r.debt_per_capita != null ? `$${Number(r.debt_per_capita).toLocaleString()}` : 'â'}
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                        {r.debt_service_pct_budget != null ? `${Number(r.debt_service_pct_budget).toFixed(2)}%` : 'â'}
                      </td>
                      <td className="money" style={{ padding: '8px 12px', textAlign: 'right' }}>
                        {r.total_budget != null ? formatMoney(Number(r.total_budget)) : 'â'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {selectedTown && townHistory.length > 0 && (
            <div className="chart-card" style={{ marginTop: 24 }}>
              <h3>{selectedTown} â 5-Year Debt History</h3>
              <div className="chart-subtitle">FY2021 â FY2025 from DLS Schedule A Part 10</div>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={townHistory.map(r => ({
                  year: `FY${r.fiscal_year}`,
                  debt: Number(r.total_outstanding_debt) || 0,
                  perCapita: Number(r.debt_per_capita) || 0,
                }))}>
                  <defs>
                    <linearGradient id="townDebtGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ff3344" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#ff3344" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                  <XAxis dataKey="year" stroke="#9ca0b8" />
                  <YAxis tickFormatter={formatMoney} stroke="#9ca0b8" />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="debt" stroke="#ff3344" fill="url(#townDebtGrad)" strokeWidth={2} name="Total Debt" />
                </AreaChart>
              </ResponsiveContainer>
              <div style={{ marginTop: 12, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Click another town in the table to compare. Data: MA DLS Municipal Databank.
              </div>
            </div>
          )}

          <div style={{ marginTop: 24, padding: '20px 24px', background: 'rgba(20,85,143,0.08)', border: '1px solid rgba(20,85,143,0.25)', borderRadius: 8, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            <strong style={{ color: '#14558F', fontSize: '1rem' }}>What Do These Numbers Mean for You?</strong>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginTop: 16 }}>
              <div style={{ padding: '14px 16px', background: 'rgba(255,255,255,0.6)', borderRadius: 6, borderLeft: '3px solid #680A1D' }}>
                <strong style={{ color: '#680A1D' }}>Debt / EQV %</strong>
                <div style={{ marginTop: 6, lineHeight: 1.55 }}>
                  This is the town's total outstanding debt divided by its <em>Equalized Valuation</em> â the state's estimate of all taxable property at full market value. Think of it as: &quot;for every $100 of property value in town, how many dollars are owed to bondholders?&quot; A town at 5% owes $5 for every $100 of property. The higher this number, the more leveraged your town is relative to its tax base. If property values fall, this ratio climbs â and so does the pressure on your tax bill.
                </div>
              </div>

              <div style={{ padding: '14px 16px', background: 'rgba(255,255,255,0.6)', borderRadius: 6, borderLeft: '3px solid #32784E' }}>
                <strong style={{ color: '#32784E' }}>Debt Service % of Budget</strong>
                <div style={{ marginTop: 6, lineHeight: 1.55 }}>
                  This is the share of your town's annual budget that goes to paying off debt â principal and interest on bonds. It's money that <em>cannot</em> be spent on schools, roads, police, or any other service. A town at 10% sends a dime of every budget dollar to Wall Street before anything else gets funded. When this number rises, services get squeezed or your property taxes go up to compensate. Some towns show 0% because they report debt service in a separate enterprise fund (e.g., water/sewer) rather than the general fund.
                </div>
              </div>

              <div style={{ padding: '14px 16px', background: 'rgba(255,255,255,0.6)', borderRadius: 6, borderLeft: '3px solid #14558F' }}>
                <strong style={{ color: '#14558F' }}>Debt / Resident</strong>
                <div style={{ marginTop: 6, lineHeight: 1.55 }}>
                  Total outstanding debt divided by population â your personal share of what the town owes. This is <em>on top of</em> the ~$13,000 per person you already owe as your share of Commonwealth state-level debt. Tourist-heavy towns (Cape Cod, the Islands) can show very high per-capita figures because their permanent-resident headcount is small relative to the infrastructure they finance.
                </div>
              </div>

              <div style={{ padding: '14px 16px', background: 'rgba(255,255,255,0.6)', borderRadius: 6, borderLeft: '3px solid #9a6b00' }}>
                <strong style={{ color: '#9a6b00' }}>About the Source</strong>
                <div style={{ marginTop: 6, lineHeight: 1.55 }}>
                  Every MA municipality files a Schedule A with the Division of Local Services each year. &quot;Total Outstanding Debt&quot; (Part 10) is the full principal balance on all long-term bonds and notes at fiscal year-end. EQV is the DOR's biennial full-market-value appraisal. This data updates once a year as towns complete their filings â some FY2025 values may still be blank.
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================
// APP
// ============================================================

export default function App() {
  const [activeSection, setActiveSection] = useState('overview');
  const [overviewSubTab, setOverviewSubTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [heroSearchValue, setHeroSearchValue] = useState('');
  const [loading, setLoading] = useState({});
  const [errors, setErrors] = useState({});
  const [data, setData] = useState({
    spendingByDept: null,
    spendingByVendor: null,
    spendingOverTime: null,
    payrollByDept: null,
    topEarners: null,
    payrollOverTime: null,
    quasiPayments: null,
    federalSpending: null,
    federalAwards: null,
    treasuryDebt: null,
    debtServiceFederal: null,
    emmaTrades: null,
  });
  const [spendingYear, setSpendingYear] = useState('2026');
  const [payrollYear, setPayrollYear] = useState('2026');
  const [federalYear, setFederalYear] = useState(2026);
  const [emmaRefreshing, setEmmaRefreshing] = useState(false);
  const [emmaLastFetched, setEmmaLastFetched] = useState(null);
  // Bonds tab: debt history chart range toggle ("10yr" = last 10 fiscal years,
  // "all" = every row in MA_STATE_DEBT_YOY).
  const [debtRange, setDebtRange] = useState('all');
  const debtSeries = debtRange === '10yr'
    ? MA_STATE_DEBT_YOY.slice(-10)
    : MA_STATE_DEBT_YOY;
  const debtSeriesFirst = debtSeries[0];
  const debtSeriesLast  = debtSeries[debtSeries.length - 1];
  const debtSeriesLabel = `${debtSeriesFirst.fy} â ${debtSeriesLast.fy}`;
  const debtSeriesGrowthB = ((debtSeriesLast.debt - debtSeriesFirst.debt) / 1e9).toFixed(1);
  const debtSeriesYears   = debtSeries.length - 1;
  const debtSeriesHasProjection = debtSeries.some(r => r.projected);

  const fetchAllData = useCallback(async () => {
    setLoading(prev => ({ ...prev, global: true }));

    const fetchers = [
      { key: 'spendingByDept', fn: () => fetchSpendingByDepartment(spendingYear) },
      { key: 'spendingByVendor', fn: () => fetchSpendingByVendor(spendingYear) },
      { key: 'spendingOverTime', fn: () => fetchSpendingOverTime() },
      { key: 'payrollByDept', fn: () => fetchPayrollByDepartment(payrollYear) },
      { key: 'topEarners', fn: () => fetchTopEarners(payrollYear) },
      { key: 'payrollOverTime', fn: () => fetchPayrollOverTime() },
      { key: 'quasiPayments', fn: () => fetchQuasiPayments() },
      { key: 'federalSpending', fn: () => fetchFederalSpendingMA(federalYear) },
      { key: 'federalAwards', fn: () => fetchFederalAwardsMA(federalYear) },
      { key: 'treasuryDebt', fn: () => fetchTreasuryDebtContext() },
      { key: 'debtServiceFederal', fn: () => fetchMADebtServiceFederal(federalYear) },
      { key: 'emmaTrades', fn: () => fetchEmmaRecentTrades() },
    ];

    const fallbacks = {
      spendingByDept: SPENDING_BY_DEPARTMENT,
      spendingByVendor: SPENDING_BY_VENDOR,
      spendingOverTime: SPENDING_OVER_TIME,
      payrollByDept: PAYROLL_BY_DEPARTMENT,
      topEarners: TOP_EARNERS,
      payrollOverTime: PAYROLL_OVER_TIME,
      quasiPayments: QUASI_PAYMENTS,
      federalSpending: FEDERAL_SPENDING_MA,
      federalAwards: FEDERAL_AWARDS_MA,
      treasuryDebt: null,
      debtServiceFederal: null,
      emmaTrades: null,
    };

    const results = await Promise.allSettled(fetchers.map(f => f.fn()));
    const newData = {};
    const newErrors = {};
    let liveCount = 0;

    results.forEach((result, i) => {
      const key = fetchers[i].key;
      const val = result.status === 'fulfilled' ? result.value : null;
      if (val && Array.isArray(val) && val.length > 0) {
        newData[key] = val;
        liveCount++;
      } else {
        newData[key] = fallbacks[key] || null;
        if (!val) newErrors[key] = true;
      }
    });

    setData(prev => ({ ...prev, ...newData }));
    setErrors(newErrors);
    setLoading(prev => ({ ...prev, global: false }));
    if (newData.emmaTrades) setEmmaLastFetched(new Date());
    if (liveCount > 0) console.log(`Live data loaded for ${liveCount}/${fetchers.length} sources`);
  }, [spendingYear, payrollYear, federalYear]);

  useEffect(() => { fetchAllData(); }, [fetchAllData]);

  const refreshEmmaTrades = useCallback(async () => {
    setEmmaRefreshing(true);
    try {
      const trades = await fetchEmmaRecentTrades();
      if (trades && Array.isArray(trades) && trades.length > 0) {
        setData(prev => ({ ...prev, emmaTrades: trades }));
        setEmmaLastFetched(new Date());
      }
    } catch (err) {
      console.error('EMMA refresh failed:', err);
    }
    setEmmaRefreshing(false);
  }, []);

  const dataSourceCount = Object.values(data).filter(Boolean).length;
  const errorCount = Object.values(errors).filter(Boolean).length;
  const budget = MA_BUDGET_SUMMARY;
  const audit = AUDIT_FACTS;

  const sections = [
    { id: 'overview', label: 'Overview', icon: <Eye size={16} />, tag: 'live' },
    { id: 'spending', label: 'Spending', icon: <DollarSign size={16} />, tag: 'live' },
    { id: 'payroll', label: 'Payroll', icon: <Users size={16} />, tag: 'live' },
    { id: 'vendors', label: 'Vendors & Contracts', icon: <Building2 size={16} />, tag: 'live' },
    { id: 'campaign', label: 'Follow the Money', icon: <Fingerprint size={16} />, tag: 'new' },
    { id: 'bonds', label: 'Bonds & Borrowing', icon: <Banknote size={16} />, tag: 'critical' },
    { id: 'municipalities', label: 'Municipalities', icon: <MapPin size={16} />, tag: 'new' },
    { id: 'lobbyists', label: 'Lobbying', icon: <Network size={16} />, tag: 'critical' },
    { id: 'federal', label: 'Federal Funds', icon: <Landmark size={16} />, tag: 'live' },
    { id: 'quasi', label: 'Quasi-Government', icon: <Layers size={16} />, tag: 'live' },
    { id: 'audit', label: 'The Audit Fight', icon: <Scale size={16} /> },
  ];

  const navigateTo = (id, searchQuery = null) => {
    setActiveSection(id);
    if (searchQuery) {
      setHeroSearchValue(searchQuery);
    }
    setSidebarOpen(false);
    window.scrollTo({ top: document.getElementById('dashboard')?.offsetTop || 0, behavior: 'smooth' });
  };

  return (
    <>
      {/* ============ HERO ============ */}
      <section className="hero">
        {/* Ominous official portraits â flex row, big and evenly spaced */}
        <div className="hero-figures">
          <img className="hero-figure" src="/The-Peoples-Audit/images/Official1.png" alt="" />
          <img className="hero-figure" src="/The-Peoples-Audit/images/Official2.png" alt="" />
          <img className="hero-figure" src="/The-Peoples-Audit/images/Official3.png" alt="" />
          <img className="hero-figure" src="/The-Peoples-Audit/images/Official4.png" alt="" />
          <img className="hero-figure" src="/The-Peoples-Audit/images/Official5.png" alt="" />
        </div>
        <div className="hero-content">
          <div className="hero-badge">Public Financial Investigation</div>
          <h1>The People's Audit</h1>
          <p className="subtitle">
            Massachusetts voters demanded accountability. The legislature refused.
            So we're putting every public dollar on display â and following the money to its source.
          </p>
          <div className="audit-stat">
            <span className="big-number">{audit.percentYes}%</span>
            <span className="stat-label">
              <strong>of voters said YES</strong>
              to auditing the legislature ({audit.ballotQuestion}, {audit.ballotYear})
            </span>
          </div>
          <div className="hero-search" style={{ margin: '30px auto', width: '100%', maxWidth: '640px', display: 'flex', justifyContent: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(255,255,255,0.12)', padding: '14px 22px', borderRadius: '10px', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.25)', width: '100%' }}>
              <Search size={20} style={{ color: '#fff', flexShrink: 0 }} />
              <input
                type="text"
                placeholder="Search for vendors, people, organizations..."
                value={heroSearchValue}
                onChange={(e) => setHeroSearchValue(e.target.value)}
                style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '1rem', width: '100%', outline: 'none' }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && heroSearchValue.trim()) {
                    navigateTo('vendors', heroSearchValue);
                  }
                }}
              />
            </div>
          </div>

          <div className="hero-cta">
            <a href="https://github.com/duncanburns2013-dot/The-Peoples-Audit" target="_blank" rel="noopener" className="btn-secondary">
              <FileText size={18} /> Source Code
            </a>
          </div>
        </div>
      </section>

      {/* ============ TOP TAB NAV ============ */}
      <nav className="tab-nav" id="dashboard">
        <div className="tab-nav-brand">THE PEOPLE'S <span>AUDIT</span></div>
        {sections.map(s => (
          <button key={s.id}
            className={`tab-link ${activeSection === s.id ? 'active' : ''}`}
            onClick={() => navigateTo(s.id)}>
            {s.icon}
            {s.label}
            {s.tag && <span className={`tab-badge ${s.tag}`}>{s.tag}</span>}
          </button>
        ))}
      </nav>

      {/* ============ STATUS BAR ============ */}
      <div className="section" style={{ paddingBottom: 0 }}>
        <div className="status-bar">
          <span className={`status-dot ${loading.global ? 'loading' : errorCount === 0 ? '' : 'error'}`} />
          <span style={{ color: 'var(--text-secondary)' }}>
            {loading.global
              ? 'Connecting to Massachusetts public records + OCPF campaign finance...'
              : dataSourceCount > 0 && errorCount === 0
                ? `Connected to ${dataSourceCount} live data feeds + OCPF campaign finance â all sources online`
                : dataSourceCount > 0
                  ? `${dataSourceCount} live feeds active | ${errorCount} source(s) using cached public records`
                  : `Displaying cached public records data from CTHRU, USASpending.gov, OCPF & official reports`
            }
          </span>
        </div>
        <div className="disclaimer">
          All data sourced from publicly available Massachusetts government records: CTHRU Open Transparency Portal (Office of the Comptroller),
          USASpending.gov, and the Massachusetts Office of Campaign and Political Finance (OCPF).
          This dashboard is a citizen-led transparency project and is not affiliated with any government entity.
        </div>
      </div>

      {/* ============ MAIN CONTENT ============ */}
      <div>
        {/* ============ OVERVIEW ============ */}
        {activeSection === 'overview' && (
          <div>
            {/* Overview Sub-tabs */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 0, padding: '0', background: 'var(--bg-secondary)', borderBottom: '2px solid var(--border)' }}>
              <button onClick={() => setOverviewSubTab('dashboard')}
                style={{
                  padding: '16px 32px', fontSize: '1rem', fontWeight: 700, cursor: 'pointer',
                  background: overviewSubTab === 'dashboard' ? 'var(--bg-card)' : 'transparent',
                  color: overviewSubTab === 'dashboard' ? 'var(--accent-red)' : 'var(--text-secondary)',
                  border: 'none', borderBottom: overviewSubTab === 'dashboard' ? '3px solid var(--accent-red)' : '3px solid transparent',
                  display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.2s ease',
                }}>
                <Eye size={18} /> Dashboard
              </button>
              <button onClick={() => setOverviewSubTab('costliving')}
                style={{
                  padding: '16px 32px', fontSize: '1rem', fontWeight: 700, cursor: 'pointer',
                  background: overviewSubTab === 'costliving' ? 'var(--bg-card)' : 'transparent',
                  color: overviewSubTab === 'costliving' ? 'var(--accent-blue)' : 'var(--text-secondary)',
                  border: 'none', borderBottom: overviewSubTab === 'costliving' ? '3px solid var(--accent-blue)' : '3px solid transparent',
                  display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.2s ease',
                }}>
                <Banknote size={18} /> Cost of Living
              </button>
            </div>

            {overviewSubTab === 'costliving' && (
              <div className="section">
                <CostOfLivingCalculator />
              </div>
            )}

            {overviewSubTab === 'dashboard' && (
            <div className="section">
              <div className="section-header">
                <span className="section-tag red">FY{budget.fiscalYear} Snapshot</span>
                <h2>Massachusetts at a Glance</h2>
                <p>A high-level view of state finances â budget, revenue, expenditure, and workforce.</p>
              </div>

              <div className="kpi-row">
                <div className="card">
                  <div className="card-title"><DollarSign size={14} /> Total Budget</div>
                  <div className="card-value">{formatMoney(budget.totalBudget)}</div>
                  <div className="card-change">FY{budget.fiscalYear} Enacted</div>
                </div>
                <div className="card">
                  <div className="card-title"><TrendingUp size={14} /> Revenue</div>
                  <div className="card-value">{formatMoney(budget.totalRevenue)}</div>
                  <div className="card-change">Tax + Federal</div>
                </div>
                <div className="card">
                  <div className="card-title"><DollarSign size={14} /> Expenditure</div>
                  <div className="card-value">{formatMoney(budget.totalExpenditure)}</div>
                  <div className="card-change" style={{ color: 'var(--accent-red)' }}>
                    {formatMoney(budget.totalExpenditure - budget.totalRevenue)} gap
                  </div>
                </div>
                <div className="card">
                  <div className="card-title"><Vote size={14} /> Audit Mandate</div>
                  <div className="card-value" style={{ color: 'var(--accent-gold)' }}>{audit.percentYes}%</div>
                  <div className="card-change" style={{ color: 'var(--accent-red)' }}>Blocked by legislature</div>
                </div>
              </div>

              {/* Budget Treemap */}
              <div className="chart-card highlighted" style={{ marginTop: 24 }}>
                <h3>Budget Treemap â Where {formatMoney(budget.totalBudget)} Goes</h3>
                <div className="chart-subtitle">Proportional visualization of FY{budget.fiscalYear} spending categories. Larger = more money.</div>
                <ResponsiveContainer width="100%" height={420}>
                  <Treemap
                    data={budget.categories}
                    dataKey="value"
                    nameKey="name"
                    content={<TreemapContent />}
                  />
                </ResponsiveContainer>
              </div>

              <div className="card-grid" style={{ marginTop: 24 }}>
                <div className="chart-card">
                  <h3>Budget by Category</h3>
                  <div className="chart-subtitle">FY{budget.fiscalYear} breakdown</div>
                  <ResponsiveContainer width="100%" height={400}>
                    <PieChart>
                      <Pie data={budget.categories} cx="50%" cy="50%" outerRadius={120} innerRadius={50} dataKey="value"
                        label={({ percent }) => `${(percent * 100).toFixed(1)}%`}
                        labelLine={{ stroke: '#9ca0b8', strokeWidth: 1 }}>
                        {budget.categories.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                      <Legend formatter={(value, entry) => <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>{value}</span>} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="chart-card">
                  <h3>Revenue Sources</h3>
                  <div className="chart-subtitle">How the Commonwealth funds itself</div>
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={budget.revenueSources} layout="vertical" margin={{ left: 120 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
                      <XAxis type="number" tickFormatter={formatMoney} stroke={AXIS_COLOR} />
                      <YAxis type="category" dataKey="name" stroke={AXIS_COLOR} width={110} tick={{ fontSize: 12 }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="value" fill="#3388ff" radius={[0, 3, 3, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {data.spendingOverTime && (
                <div className="chart-card" style={{ marginTop: 24 }}>
                  <h3>State Spending Over Time</h3>
                  <div className="chart-subtitle">Total expenditures by fiscal year â live from CTHRU (data through latest completed fiscal year)</div>
                  <ResponsiveContainer width="100%" height={350}>
                    <AreaChart data={data.spendingOverTime}>
                      <defs>
                        <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#ff3344" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#ff3344" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
                      <XAxis dataKey="year" stroke={AXIS_COLOR} />
                      <YAxis tickFormatter={formatMoney} stroke={AXIS_COLOR} />
                      <Tooltip content={<CustomTooltip />} />
                      <Area type="monotone" dataKey="total" stroke="#ff3344" fill="url(#spendGrad)" strokeWidth={2} name="Total Spending" />
                    </AreaChart>
                  </ResponsiveContainer>
                  <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(20, 85, 143, 0.08)', border: '1px solid rgba(20, 85, 143, 0.25)', borderRadius: 8, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    ð <strong style={{ color: '#14558F' }}>Data through FY2024</strong> â the latest fiscal year published by CTHRU. FY2025 expenditure data will be added after official publication by the Comptroller.
                  </div>
                </div>
              )}
            </div>
            )}
          </div>
        )}

        {/* ============ SPENDING EXPLORER ============ */}
        {activeSection === 'spending' && (
          <div>
            <SpendingExplorer departments={data.spendingByDept} spendingOverTime={data.spendingOverTime} initialYear={spendingYear} />
          </div>
        )}

        {/* ============ PAYROLL ============ */}
        {activeSection === 'payroll' && (
          <div>
            <PayrollSearcher payrollYear={payrollYear} setPayrollYear={setPayrollYear} data={data} />
          </div>
        )}

        {/* ============ VENDOR EXPLORER ============ */}
        {activeSection === 'vendors' && (
          <div>
            <VendorExplorer spendingYear={spendingYear} />
          </div>
        )}

        {/* ============ FOLLOW THE MONEY ============ */}
        {activeSection === 'campaign' && (
          <div>
            <FollowTheMoney />
          </div>
        )}

{/* ============ BONDS & BORROWING ============ */}
        {activeSection === 'bonds' && (
          <div>
            <div className="section">
              <div className="section-header">
                <span className="section-tag blue">Debt Service</span>
                <h2>Massachusetts Bonds & Borrowing</h2>
                <p>State, county, and municipal debt obligations. Live federal debt context from the U.S. Treasury fiscalData API. MA-specific figures compiled from the Commonwealth's Annual Comprehensive Financial Report, the Debt Affordability Committee, MassBondHolder investor disclosures, and EMMA (MSRB) issuer filings. What is the true cost of Massachusetts' borrowing strategy?</p>
              </div>

              <div className="card-grid">
                <div className="card" style={{ borderColor: 'rgba(20,85,143,0.3)' }}>
                  <div className="card-title"><Banknote size={16} /> State Debt Outstanding</div>
                  <div className="card-value">{formatMoney(MA_BOND_FACTS.totalStateDebt)}</div>
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: '12px' }}>GO + Revenue + Special Obligation (FY2025)</div>
                </div>
                <div className="card" style={{ borderColor: 'rgba(50,120,78,0.3)' }}>
                  <div className="card-title"><TrendingUp size={16} /> Annual Debt Service</div>
                  <div className="card-value">{formatMoney(MA_BOND_FACTS.annualDebtService)}</div>
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: '12px' }}>{MA_BOND_FACTS.percentOfBudget}% of state budget</div>
                </div>
                <div className="card" style={{ borderColor: 'rgba(104,10,29,0.3)' }}>
                  <div className="card-title"><Users size={16} /> Per-Capita Debt</div>
                  <div className="card-value">${MA_BOND_FACTS.perCapitaDebt.toLocaleString()}</div>
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: '12px' }}>Every MA resident owes this share</div>
                </div>
                <div className="card" style={{ borderColor: 'rgba(20,85,143,0.3)' }}>
                  <div className="card-title"><Scale size={16} /> Credit Rating</div>
                  <div className="card-value" style={{ fontSize: '1.6rem' }}>{MA_BOND_FACTS.creditRating}</div>
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: '12px' }}>Avg interest rate {MA_BOND_FACTS.averageInterestRate}%</div>
                </div>
              </div>

              {/* Range toggle for the two debt history charts */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 24, flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  History window:
                </span>
                {[
                  { key: 'all',  label: `All available (${MA_STATE_DEBT_YOY[0].fy}â${MA_STATE_DEBT_YOY[MA_STATE_DEBT_YOY.length-1].fy})` },
                  { key: '10yr', label: 'Last 10 years' },
                ].map(opt => (
                  <button
                    key={opt.key}
                    onClick={() => setDebtRange(opt.key)}
                    style={{
                      padding: '5px 12px',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      borderRadius: 4,
                      cursor: 'pointer',
                      border: '1px solid #14558F',
                      background: debtRange === opt.key ? '#14558F' : '#fff',
                      color:      debtRange === opt.key ? '#fff' : '#14558F',
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
                {debtSeriesHasProjection && (
                  <span style={{ fontSize: '0.78rem', color: '#9a6b00', marginLeft: 6 }}>
                    * FY2026 figures are projected from the March 24, 2026 Information Statement â not yet reported in an ACFR.
                  </span>
                )}
              </div>

              {/* Data provenance banner â now covering FY2000 onward */}
              <div style={{ marginTop: 10, padding: '10px 14px', background: '#eef5ff', border: '1px solid #9dbae5', borderRadius: 4, fontSize: '0.82rem', color: '#163b6a' }}>
                <strong>Data provenance:</strong> Series now runs <strong>FY2000 â FY2026</strong>.
                FY2000âFY2014 figures have been extracted and cross-verified directly from the
                Commonwealth's archived ACFR PDFs (FY2004, FY2009, FY2011, FY2012, FY2013, and
                FY2014 editions), with each number checked against at least two independent
                ACFR tables to catch restatements. See the Methodology &amp; Sources panel
                below for line-by-line citations, the FY2013 methodology break (net-proceeds
                â principal), and the confirmed FY2007/FY2008 debt-service restatement anomaly.
              </div>

              <div className="card-grid" style={{ marginTop: 16 }}>
                <div className="chart-card">
                  <h3>State Debt Outstanding: {debtSeriesLabel}</h3>
                  <div className="chart-subtitle">
                    Total principal owed by the Commonwealth grew by ${debtSeriesGrowthB}B over {debtSeriesYears} fiscal years. Source: MA Comptroller ACFR &amp; Debt Affordability Committee.
                  </div>
                  <ResponsiveContainer width="100%" height={360}>
                    <AreaChart data={debtSeries}>
                      <defs>
                        <linearGradient id="debtGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#14558F" stopOpacity={0.85} />
                          <stop offset="100%" stopColor="#14558F" stopOpacity={0.1} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
                      <XAxis dataKey="fy" stroke={AXIS_COLOR} />
                      <YAxis tickFormatter={formatMoney} stroke={AXIS_COLOR} />
                      <Tooltip content={<CustomTooltip />} />
                      <Area type="monotone" dataKey="debt" stroke="#14558F" strokeWidth={2.5} fill="url(#debtGrad)" name="Debt Outstanding" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                <div className="chart-card">
                  <h3>Annual Debt Service: {debtSeriesLabel}</h3>
                  <div className="chart-subtitle">
                    Yearly interest + principal payments on Commonwealth debt. This is money spent every year that is not available for schools, roads, or public services.
                  </div>
                  <ResponsiveContainer width="100%" height={360}>
                    <LineChart data={debtSeries}>
                      <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
                      <XAxis dataKey="fy" stroke={AXIS_COLOR} />
                      <YAxis tickFormatter={formatMoney} stroke={AXIS_COLOR} />
                      <Tooltip content={<CustomTooltip />} />
                      <Line type="monotone" dataKey="service" stroke="#680A1D" strokeWidth={3} dot={{ r: 4, fill: '#680A1D' }} name="Debt Service" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="card-grid" style={{ marginTop: 24 }}>
                <div className="chart-card">
                  <h3>Top Massachusetts Bond Issuers</h3>
                  <div className="chart-subtitle">Ranked by outstanding principal. Source: EMMA + MassBondHolder</div>
                  <ResponsiveContainer width="100%" height={460}>
                    <BarChart data={[...MA_TOP_BOND_ISSUERS].sort((a,b) => b.value - a.value)} layout="vertical" margin={{ left: 220 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
                      <XAxis type="number" tickFormatter={formatMoney} stroke={AXIS_COLOR} />
                      <YAxis type="category" dataKey="name" stroke={AXIS_COLOR} width={210} tick={({ x, y, payload }) => (
                        <text x={x} y={y} dy={4} textAnchor="end" fill={AXIS_COLOR} fontSize={10}>
                          {payload.value.length > 32 ? payload.value.substring(0, 30) + 'â¦' : payload.value}
                        </text>
                      )} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="value" fill="#14558F" radius={[0, 3, 3, 0]} name="Outstanding" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="chart-card">
                  <h3>Debt Composition by Type</h3>
                  <div className="chart-subtitle">How MA borrowing is structured</div>
                  <ResponsiveContainer width="100%" height={460}>
                    <PieChart>
                      <Pie
                        data={MA_DEBT_BY_TYPE}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={150}
                        label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
                      >
                        {MA_DEBT_BY_TYPE.map((_, i) => (
                          <Cell key={i} fill={['#14558F', '#680A1D', '#32784E', '#d48a00', '#7209b7'][i]} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                      <Legend verticalAlign="bottom" height={60} wrapperStyle={{ fontSize: '0.8rem' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="chart-card" style={{ marginTop: 24 }}>
                <h3>County-Level Debt (MA Regional)</h3>
                <div className="chart-subtitle">
                  Outstanding municipal debt aggregated by county, normalized two ways so you
                  can see what it actually means for the residents who live there.
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #14558F', textAlign: 'left' }}>
                        <th style={{ padding: '12px 8px', color: '#14558F' }}>County</th>
                        <th style={{ padding: '12px 8px', color: '#14558F', textAlign: 'center' }}>Data as of</th>
                        <th style={{ padding: '12px 8px', color: '#14558F', textAlign: 'right' }}>Outstanding Debt</th>
                        <th style={{ padding: '12px 8px', color: '#14558F', textAlign: 'right' }}>Per Capita</th>
                        <th style={{ padding: '12px 8px', color: '#14558F', textAlign: 'right' }}>Median HH Income</th>
                        <th
                          style={{ padding: '12px 8px', color: '#14558F', textAlign: 'right' }}
                          title="Per-capita debt divided by median household income. A standard Moody's/S&P municipal credit metric."
                        >
                          Debt-to-Income Ratio
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {MA_COUNTY_DEBT.map((c, i) => {
                        const ratio = c.debtToIncomeRatio; // e.g. 0.122 = 12.2%
                        const ratioPct = (ratio * 100).toFixed(1);
                        // Color bands based on standard municipal credit analysis thresholds:
                        //   < 5%   green  (modest)
                        //   5-10%  blue   (moderate)
                        //   10-15% amber  (elevated)
                        //   > 15%  red    (high)
                        const color =
                          ratio < 0.05 ? '#32784E' :
                          ratio < 0.10 ? '#14558F' :
                          ratio < 0.15 ? '#9a6b00' : '#680A1D';
                        return (
                          <tr key={i} style={{ borderBottom: '1px solid #e4e6ed' }}>
                            <td style={{ padding: '10px 8px', fontWeight: 500 }}>{c.county}</td>
                            <td style={{ padding: '10px 8px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                              {c.fy || 'â'}
                            </td>
                            <td style={{ padding: '10px 8px', textAlign: 'right' }}>{formatMoney(c.debt)}</td>
                            <td style={{ padding: '10px 8px', textAlign: 'right' }}>${c.perCapita.toLocaleString()}</td>
                            <td style={{ padding: '10px 8px', textAlign: 'right' }}>
                              {c.medianHHIncome ? `$${c.medianHHIncome.toLocaleString()}` : 'â'}
                            </td>
                            <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 600, color }}>
                              {ratioPct}%
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Plain-English explanation of the Debt-to-Income Ratio â replaces the undocumented "Burden Index" */}
                <div
                  style={{
                    marginTop: 16,
                    padding: '14px 16px',
                    background: '#f4f5f8',
                    borderLeft: '4px solid #14558F',
                    borderRadius: 4,
                    fontSize: '0.86rem',
                    lineHeight: 1.55,
                  }}
                >
                  <div style={{ fontWeight: 700, color: '#14558F', marginBottom: 6 }}>
                    How to read the Debt-to-Income Ratio
                  </div>
                  <div style={{ color: '#333' }}>
                    <strong>Formula:</strong> per-capita municipal debt Ã· median household income
                    for that county. A ratio of <strong>12%</strong> means that for every $100
                    the typical household in that county earns in a year, there is $12 of local
                    government debt attributed to each resident. This is the same metric Moody's,
                    S&amp;P, and Fitch use when rating municipal bonds, because it answers the
                    question regular residents actually care about: <em>how heavy is this debt
                    relative to what we actually make?</em> Under 5% is modest, 5â10% moderate,
                    10â15% elevated, above 15% high.
                  </div>
                  <div style={{ marginTop: 10, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    <strong>Sources:</strong> Outstanding debt from MA Division of Local Services
                    (DLS) Schedule A filings and county ACFR disclosures. Median household income
                    from U.S. Census Bureau American Community Survey 5-Year Estimates, Table
                    S1901 (
                    <a
                      href="https://data.census.gov/table/ACSST5Y2022.S1901"
                      target="_blank"
                      rel="noopener"
                      style={{ color: '#14558F' }}
                    >
                      data.census.gov â
                    </a>
                    ). Fiscal years shown in the "Data as of" column reflect the most recent
                    audited filing available for each jurisdiction.
                  </div>
                </div>
              </div>

              {/* ========== LIVE MA Disclosures Feed (replaces broken EMMA iframe) ========== */}
              <DisclosuresFeed />

              {/* ========== Methodology & Sources (Bonds tab) ========== */}
              <div
                className="chart-card"
                style={{ marginTop: 24, borderLeft: '4px solid #14558F' }}
              >
                <h3>Methodology &amp; Sources â Bonds &amp; Borrowing</h3>
                <div className="chart-subtitle">
                  Every number on this tab traces back to a primary-source document.
                  We publish our methodology openly because the whole point of an
                  audit is that it has to be checkable by anyone, not just us.
                </div>

                <div style={{ marginTop: 14, fontSize: '0.88rem', lineHeight: 1.6, color: '#333' }}>
                  <div style={{ fontWeight: 700, color: '#14558F', marginTop: 10 }}>
                    State debt outstanding &amp; debt service history
                  </div>
                  <div>
                    Pulled from the Commonwealth of Massachusetts{' '}
                    <a href="https://www.macomptroller.org/annual-comprehensive-financial-report/"
                       target="_blank" rel="noopener" style={{ color: '#14558F' }}>
                      Annual Comprehensive Financial Report (ACFR) â
                    </a>{' '}
                    published each year by the Office of the State Comptroller, cross-checked
                    against the{' '}
                    <a href="https://www.mass.gov/orgs/debt-affordability-committee"
                       target="_blank" rel="noopener" style={{ color: '#14558F' }}>
                      MA Debt Affordability Committee â
                    </a>{' '}
                    annual report and{' '}
                    <a href="https://www.massbondholder.com/"
                       target="_blank" rel="noopener" style={{ color: '#14558F' }}>
                      MassBondHolder.com â
                    </a>{' '}
                    investor disclosures. Series now runs <strong>FY2000 â FY2026</strong>.
                    FY2000âFY2014 figures were extracted line-by-line from the archived ACFR
                    PDFs (FY2004, FY2009, FY2011, FY2012, FY2013, FY2014 editions) and
                    cross-verified across multiple years' statistical sections. "Debt" means
                    Total Primary Government bonded debt + capital leases from the ACFR
                    "Per Capita General Long-Term Bonded Debt" schedule â this explicitly
                    <strong> excludes</strong> discretely presented component units (MSBA,
                    MBTA, Massport, MWRA, etc.), consistent with the post-FY2015 figures.
                  </div>

                  <div style={{ fontWeight: 700, color: '#14558F', marginTop: 14 }}>
                    Known anomalies &amp; methodology breaks (surfaced by cross-reference)
                  </div>
                  <div>
                    <strong>FY2013 methodology break.</strong> Effective January 1, 2013, state
                    finance law changed the statutory definition of outstanding debt from
                    "net proceeds of debt issued" to "principal." FY2012 and earlier rows are
                    on a net-proceeds basis; FY2013 and later are on a principal basis. This
                    explains the apparent flat line between FY2012 ($25.36B) and FY2013
                    ($25.32B) â the underlying debt didn't actually stop growing; the
                    accounting changed.
                    <br /><br />
                    <strong>FY2007 &amp; FY2008 debt service restatement.</strong> The FY2009,
                    FY2010, and FY2011 ACFRs reported FY2007 debt service at $2,166M and FY2008
                    at $2,239M. Starting with the FY2013 ACFR, those numbers were restated
                    upward to $2,538M (+$372M, +17%) and $2,486M (+$247M, +11%) respectively,
                    with no narrative explanation provided in the statistical section. The
                    People's Audit uses the latest authoritative (restated) figures but flags
                    these rows so residents understand why debt service appears to spike and
                    then fall in that window. This is the kind of finding that a real
                    legislative audit would investigate â the same kind of audit 72% of MA
                    voters demanded in 2024.
                    <br /><br />
                    <strong>FY2000 â FY2001 scope.</strong> Pre-GASB 34, the Commonwealth
                    reported bonded debt as a single aggregate figure without splitting
                    governmental from business-type activities. Those two rows use the
                    single-column "Total long-term bonds and notes payable" figure from the
                    FY2004 ACFR's Ten-Year Per Capita schedule and are flagged
                    <code style={{ background: '#f4f5f8', padding: '1px 4px', borderRadius: 3 }}>
                      preGASB34: true
                    </code>
                    in the underlying data file.
                  </div>

                  <div style={{ fontWeight: 700, color: '#14558F', marginTop: 14 }}>
                    County-level debt &amp; debt-to-income ratio
                  </div>
                  <div>
                    Outstanding debt aggregated from the MA{' '}
                    <a href="https://www.mass.gov/orgs/division-of-local-services"
                       target="_blank" rel="noopener" style={{ color: '#14558F' }}>
                      Division of Local Services (DLS) â
                    </a>{' '}
                    Schedule A filings that every city and town is legally required to file,
                    plus county ACFRs where the county itself is the issuer. Median household
                    income is the U.S. Census Bureau American Community Survey 5-Year Estimate,
                    Table{' '}
                    <a href="https://data.census.gov/table/ACSST5Y2022.S1901"
                       target="_blank" rel="noopener" style={{ color: '#14558F' }}>
                      S1901 â
                    </a>
                    . The Debt-to-Income Ratio is the same metric used by Moody's, S&amp;P,
                    and Fitch municipal credit analysts.
                  </div>

                  <div style={{ fontWeight: 700, color: '#14558F', marginTop: 14 }}>
                    Live disclosures feed
                  </div>
                  <div>
                    The MSRB's EMMA site (<a href="https://emma.msrb.org/"
                       target="_blank" rel="noopener" style={{ color: '#14558F' }}>emma.msrb.org â</a>)
                    blocks all third-party iframe embedding for security reasons
                    (X-Frame-Options: DENY). Instead, a scheduled GitHub Action in this
                    repository fetches the latest Massachusetts disclosures every 6 hours
                    from EMMA, mass.gov Debt Management, and the MA State Treasurer, then
                    commits the results back to{' '}
                    <code style={{ background: '#f4f5f8', padding: '1px 5px', borderRadius: 3 }}>
                      public/data/ma-disclosures.json
                    </code>
                    . Because the fetched JSON is committed to git, every number on this
                    page has a timestamped, reproducible provenance trail anyone can audit.
                  </div>

                  <div style={{ fontWeight: 700, color: '#14558F', marginTop: 14 }}>
                    Federal debt context
                  </div>
                  <div>
                    Pulled live from the U.S. Treasury{' '}
                    <a href="https://fiscaldata.treasury.gov/api-documentation/"
                       target="_blank" rel="noopener" style={{ color: '#14558F' }}>
                      fiscalData API â
                    </a>
                    . No caching, no intermediaries â your browser talks directly to Treasury.
                  </div>

                  <div style={{ fontWeight: 700, color: '#14558F', marginTop: 14 }}>
                    What is still missing (honest disclosure)
                  </div>
                  <div>
                    This tab does not yet include: (1) municipal-level debt issuance for all
                    351 MA cities and towns from DLS Schedule A, (2) a "how much is being
                    taken away from you" personal-cost-of-borrowing explainer, and (3)
                    independent PDF re-verification of the FY2015âFY2025 ACFR figures (we
                    have those numbers from aggregated sources but haven't yet cross-checked
                    each one against the primary ACFR document the way we did for
                    FY2000âFY2014). All three are queued for the next update. If you notice
                    a number that looks wrong, file an issue on{' '}
                    <a href="https://github.com/duncanburns2013-dot/The-Peoples-Audit/issues"
                       target="_blank" rel="noopener" style={{ color: '#14558F' }}>
                      GitHub â
                    </a>{' '}
                    â this project improves by being checked.
                  </div>
                </div>
              </div>

              {(
                <div className="chart-card" style={{ marginTop: 24, borderLeft: '4px solid #680A1D' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <h3 style={{ margin: 0 }}>
                      <span style={{
                        display: 'inline-block', width: 10, height: 10, borderRadius: '50%',
                        background: data.emmaTrades ? '#ef4444' : '#9ca3af',
                        marginRight: 8, animation: data.emmaTrades ? 'pulse 1.6s infinite' : 'none'
                      }} />
                      Recent Notable MA Bond Trades
                    </h3>
                    <button
                      onClick={refreshEmmaTrades}
                      disabled={emmaRefreshing}
                      style={{
                        padding: '6px 12px', fontSize: '0.78rem', fontWeight: 600,
                        border: '1px solid #680A1D',
                        background: emmaRefreshing ? '#f4f5f8' : '#fff',
                        color: '#680A1D', borderRadius: 4,
                        cursor: emmaRefreshing ? 'default' : 'pointer'
                      }}
                      title="Re-fetch latest MA bond trades from EMMA / MSRB"
                    >
                      {emmaRefreshing ? 'Refreshingâ¦' : 'â» Refresh now'}
                    </button>
                  </div>
                  <div className="chart-subtitle" style={{ marginTop: 6 }}>
                    Snapshot of significant Massachusetts issuer trades. Click any CUSIP to view full EMMA history.
                  </div>
                  {emmaLastFetched && data.emmaTrades && (
                    <div style={{
                      marginTop: 8, padding: '6px 12px', background: '#f4f5f8', borderRadius: 4,
                      fontSize: '0.82rem', color: 'var(--text-muted)'
                    }}>
                      <strong style={{ color: '#222' }}>Last refreshed:</strong>{' '}
                      {emmaLastFetched.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                      {' Â· '}{data.emmaTrades.length} trades loaded
                    </div>
                  )}
                  {data.emmaTrades && data.emmaTrades.length > 0 ? (
                  <div style={{ overflowX: 'auto', marginTop: 12 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid #680A1D', textAlign: 'left' }}>
                          <th style={{ padding: '10px 8px', color: '#680A1D' }}>Issuer</th>
                          <th style={{ padding: '10px 8px', color: '#680A1D' }}>CUSIP</th>
                          <th style={{ padding: '10px 8px', color: '#680A1D', textAlign: 'right' }}>Par</th>
                          <th style={{ padding: '10px 8px', color: '#680A1D', textAlign: 'right' }}>Price</th>
                          <th style={{ padding: '10px 8px', color: '#680A1D', textAlign: 'right' }}>Yield</th>
                          <th style={{ padding: '10px 8px', color: '#680A1D' }}>Trade Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.emmaTrades.map((t, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid #e4e6ed' }}>
                            <td style={{ padding: '10px 8px', fontWeight: 500 }}>{t.issuer}</td>
                            <td style={{ padding: '10px 8px', fontFamily: 'monospace' }}>
                              <a href={`https://emma.msrb.org/Security/Details/${t.cusip}`} target="_blank" rel="noopener" style={{ color: '#14558F', textDecoration: 'none' }}>
                                {t.cusip} â
                              </a>
                            </td>
                            <td style={{ padding: '10px 8px', textAlign: 'right' }}>{formatMoney(t.par)}</td>
                            <td style={{ padding: '10px 8px', textAlign: 'right' }}>{t.price.toFixed(2)}</td>
                            <td style={{ padding: '10px 8px', textAlign: 'right', color: t.yield > 4.2 ? '#680A1D' : '#32784E' }}>{t.yield.toFixed(2)}%</td>
                            <td style={{ padding: '10px 8px', color: 'var(--text-muted)' }}>{t.date}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  ) : (
                    <div style={{ marginTop: 16, padding: '20px 16px', background: '#f4f5f8', borderRadius: 8, textAlign: 'center', color: 'var(--text-muted)' }}>
                      <p style={{ margin: '0 0 8px', fontWeight: 600, color: '#680A1D' }}>No bond trades loaded</p>
                      <p style={{ margin: 0, fontSize: '0.85rem' }}>Click "â» Refresh now" above to fetch the latest MA bond trades from EMMA / MSRB.</p>
                    </div>
                  )}
                </div>
              )}

              {/* ========== Treasury Federal Debt Context ========== */}
              <div className="chart-card" style={{ marginTop: 24 }}>
                <h3>
                  <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: data.treasuryDebt ? '#ef4444' : '#9ca3af', marginRight: 8, animation: data.treasuryDebt ? 'pulse 1.6s infinite' : 'none' }} />
                  {data.treasuryDebt ? 'LIVE' : 'OFFLINE'}: Federal Debt Context (U.S. Treasury API)
                </h3>
                <div className="chart-subtitle">
                  {data.treasuryDebt
                    ? `Total federal public debt, last ${data.treasuryDebt.length} data points, fetched live from api.fiscaldata.treasury.gov (no API key required). MA's borrowing sits inside this broader fiscal environment.`
                    : 'Could not reach api.fiscaldata.treasury.gov from your browser. The endpoint may be rate-limited or temporarily down. Open the browser console to see the exact error.'}
                </div>
                {data.treasuryDebt ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={data.treasuryDebt}>
                      <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
                      <XAxis dataKey="date" stroke={AXIS_COLOR} tickFormatter={d => d?.substring(0, 7)} minTickGap={40} />
                      <YAxis tickFormatter={formatMoney} stroke={AXIS_COLOR} domain={['auto', 'auto']} />
                      <Tooltip content={<CustomTooltip />} />
                      <Line type="monotone" dataKey="federalDebt" stroke="#680A1D" strokeWidth={2} dot={false} name="U.S. Federal Debt" isAnimationActive={false} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ padding: 40, textAlign: 'center', background: '#f4f5f8', borderRadius: 8, color: 'var(--text-muted)' }}>
                    <div style={{ fontSize: '2rem', marginBottom: 8 }}>â </div>
                    <div>Live Treasury feed unavailable. Try refreshing, or visit <a href="https://fiscaldata.treasury.gov/datasets/debt-to-the-penny/" target="_blank" rel="noopener" style={{ color: '#680A1D', fontWeight: 600 }}>the Treasury fiscalData portal directly â</a></div>
                  </div>
                )}
              </div>

              <div className="chart-card" style={{ marginTop: 24 }}>
                <h3>Drill Deeper â Official Sources</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginTop: 12 }}>
                  <a href="https://emma.msrb.org/IssuerHomePage/Issuer?id=EC7583FF8C47A63AE040A8C0E4052D69" target="_blank" rel="noopener" style={{ padding: 16, background: '#f4f5f8', borderLeft: '4px solid #14558F', textDecoration: 'none', color: 'inherit', borderRadius: 4 }}>
                    <strong style={{ color: '#14558F' }}>EMMA â MSRB Issuer Page â</strong>
                    <div style={{ fontSize: '0.85rem', marginTop: 6, color: 'var(--text-muted)' }}>Live trading data, continuing disclosures, official statements for every Commonwealth of MA bond.</div>
                  </a>
                  <a href="https://www.massbondholder.com/" target="_blank" rel="noopener" style={{ padding: 16, background: '#f4f5f8', borderLeft: '4px solid #680A1D', textDecoration: 'none', color: 'inherit', borderRadius: 4 }}>
                    <strong style={{ color: '#680A1D' }}>MassBondHolder.com â</strong>
                    <div style={{ fontSize: '0.85rem', marginTop: 6, color: 'var(--text-muted)' }}>Commonwealth Treasurer's investor portal â debt statements, POS, official statements, redemption schedules.</div>
                  </a>
                  <a href="https://www.macomptroller.org/annual-comprehensive-financial-report/" target="_blank" rel="noopener" style={{ padding: 16, background: '#f4f5f8', borderLeft: '4px solid #32784E', textDecoration: 'none', color: 'inherit', borderRadius: 4 }}>
                    <strong style={{ color: '#32784E' }}>MA Comptroller ACFR â</strong>
                    <div style={{ fontSize: '0.85rem', marginTop: 6, color: 'var(--text-muted)' }}>Annual Comprehensive Financial Report â authoritative source for state debt figures.</div>
                  </a>
                  <a href="https://www.mass.gov/debt-affordability-committee" target="_blank" rel="noopener" style={{ padding: 16, background: '#f4f5f8', borderLeft: '4px solid #14558F', textDecoration: 'none', color: 'inherit', borderRadius: 4 }}>
                    <strong style={{ color: '#14558F' }}>Debt Affordability Committee â</strong>
                    <div style={{ fontSize: '0.85rem', marginTop: 6, color: 'var(--text-muted)' }}>Annual report on how much new debt the Commonwealth can responsibly issue.</div>
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============ MUNICIPALITIES ============ */}
        {activeSection === 'municipalities' && (
          <div>
            <MunicipalitiesExplorer />
          </div>
        )}

        {/* ============ LOBBYISTS ============ */}
        {activeSection === 'lobbyists' && (
              <div>
                <LobbyingExplorer />
              </div>
            )}


{/* ============ FEDERAL ============ */}
        {activeSection === 'federal' && (
          <div>
            <div className="section">
              <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
                <div>
                  <span className="section-tag blue">Federal Funding</span>
                  <h2>Federal Money Flowing to Massachusetts</h2>
                  <p>Grants, contracts, and awards from the federal government to MA entities. Data from USASpending.gov.</p>
                </div>
                <select className="year-select" value={federalYear} onChange={e => setFederalYear(Number(e.target.value))}>
                  {Array.from({ length: 10 }, (_, i) => 2025 - i).map(y => (
                    <option key={y} value={y}>FY {y}</option>
                  ))}
                </select>
              </div>

              <div className="card-grid">
                {data.federalSpending ? (
                  <div className="chart-card">
                    <h3>Federal Spending by Agency</h3>
                    <div className="chart-subtitle">Which federal agencies send the most to MA</div>
                    <ResponsiveContainer width="100%" height={500}>
                      <BarChart data={data.federalSpending.slice(0, 15)} layout="vertical" margin={{ left: 200 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
                        <XAxis type="number" tickFormatter={formatMoney} stroke={AXIS_COLOR} />
                        <YAxis type="category" dataKey="name" stroke={AXIS_COLOR} width={190} tick={({ x, y, payload }) => (
                          <text x={x} y={y} dy={4} textAnchor="end" fill={AXIS_COLOR} fontSize={10}>
                            {payload.value.length > 28 ? payload.value.substring(0, 26) + 'â¦' : payload.value}
                          </text>
                        )} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="value" fill="#22ddee" radius={[0, 3, 3, 0]} name="Federal Spending" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : <div className="loading-skeleton" />}

                {data.federalAwards ? (
                  <div className="chart-card">
                    <h3>Top Federal Award Recipients in MA</h3>
                    <div className="chart-subtitle">Who receives the most federal dollars</div>
                    <ResponsiveContainer width="100%" height={500}>
                      <BarChart data={data.federalAwards.slice(0, 15)} layout="vertical" margin={{ left: 200 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
                        <XAxis type="number" tickFormatter={formatMoney} stroke={AXIS_COLOR} />
                        <YAxis type="category" dataKey="name" stroke={AXIS_COLOR} width={190} tick={({ x, y, payload }) => (
                          <text x={x} y={y} dy={4} textAnchor="end" fill={AXIS_COLOR} fontSize={10}>
                            {payload.value.length > 28 ? payload.value.substring(0, 26) + 'â¦' : payload.value}
                          </text>
                        )} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="value" fill="#aa44ff" radius={[0, 3, 3, 0]} name="Award Amount" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : <div className="loading-skeleton" />}
              </div>
            </div>
          </div>
        )}

        {/* ============ QUASI-GOVERNMENT ============ */}
        {activeSection === 'quasi' && (
          <div>
            <QuasiExplorer quasiPayments={data.quasiPayments} />
          </div>
        )}

        {/* ============ THE AUDIT FIGHT ============ */}
        {activeSection === 'audit' && (
          <div>
            <div className="section">
              <div className="section-header">
                <span className="section-tag red">Democracy in Action</span>
                <h2>The Fight for the Legislative Audit</h2>
                <p>The people spoke. The legislature refused to listen. Here's the full story.</p>
              </div>

              <div className="card-grid">
                <div className="card" style={{ borderColor: 'rgba(255,170,34,0.3)' }}>
                  <div className="card-title"><Vote size={14} /> The Mandate</div>
                  <div className="card-value" style={{ color: 'var(--accent-gold)' }}>{audit.percentYes}%</div>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.6 }}>
                    On November 5, 2024, Massachusetts {audit.ballotQuestion} asked voters whether the
                    State Auditor should have explicit authority to audit the Legislature.
                    <strong style={{ color: 'var(--text-primary)' }}> Nearly 72% voted YES</strong> â an
                    overwhelming, bipartisan mandate for transparency.
                  </p>
                </div>

                <div className="card" style={{ borderColor: 'rgba(255,51,68,0.3)' }}>
                  <div className="card-title"><AlertTriangle size={14} /> The Blockade</div>
                  <div className="card-value" style={{ color: 'var(--accent-red)', fontSize: '1.6rem' }}>Refused</div>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.6 }}>
                    Despite the voter mandate, legislative leaders â including {audit.legislativeLeaders.join(' and ')} â
                    have refused to comply. In January 2025, the House hired outside legal counsel
                    to fight the audit, arguing &quot;separation of powers.&quot;
                  </p>
                </div>

                <div className="card" style={{ borderColor: 'rgba(51,136,255,0.3)' }}>
                  <div className="card-title"><Scale size={14} /> The Court Battle</div>
                  <div className="card-value" style={{ color: 'var(--accent-blue)', fontSize: '1.3rem' }}>Supreme Court</div>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.6 }}>
                    On {audit.courtFilingDate}, Auditor {audit.auditorName} filed a complaint with the
                    Massachusetts Supreme Judicial Court to enforce the will of the voters
                    and compel the Legislature to submit to an audit.
                  </p>
                </div>

                <div className="card" style={{ borderColor: 'rgba(34,204,102,0.3)' }}>
                  <div className="card-title"><Eye size={14} /> Why This Dashboard Exists</div>
                  <div className="card-value" style={{ color: 'var(--accent-green)', fontSize: '1.3rem' }}>Transparency</div>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.6 }}>
                    If the Legislature won't allow a formal audit, the people will audit them with
                    the data that's already public. Every dollar, every vendor, every salary â
                    and now, every campaign contribution.
                  </p>
                </div>
              </div>

              <div className="chart-card" style={{ marginTop: 32 }}>
                <h3>Timeline of Events</h3>
                <div style={{ padding: '20px 0' }}>
                  {[
                    { date: '2022', event: 'Diana DiZoglio elected State Auditor on a platform of legislative accountability', color: '#3388ff' },
                    { date: '2023', event: 'Auditor DiZoglio attempts audit; Legislature refuses, citing lack of authority', color: '#ffaa22' },
                    { date: 'Nov 2024', event: 'Ballot Question 1 passes with 71.8% YES â voters affirm the auditor\'s authority', color: '#22cc66' },
                    { date: 'Nov 2024', event: 'DiZoglio announces plans to begin the audit immediately', color: '#22cc66' },
                    { date: 'Jan 2025', event: 'House of Representatives hires outside counsel to fight the audit', color: '#ff3344' },
                    { date: 'Feb 2026', event: 'DiZoglio files complaint with Supreme Judicial Court to enforce Question 1', color: '#aa44ff' },
                    { date: '2026', event: 'The People\'s Audit goes live â if they won\'t audit, we will', color: '#ff3344' },
                  ].map((item, i) => (
                    <div key={i} style={{
                      display: 'flex', gap: 20, padding: '16px 0',
                      borderLeft: `3px solid ${item.color}`, paddingLeft: 20, marginLeft: 10,
                      marginBottom: i < 6 ? 8 : 0,
                    }}>
                      <span style={{ fontFamily: 'JetBrains Mono', fontSize: '0.85rem', color: item.color, minWidth: 80 }}>
                        {item.date}
                      </span>
                      <span style={{ color: 'var(--text-primary)', fontSize: '0.95rem' }}>{item.event}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ marginTop: 32, textAlign: 'center' }}>
                <h3 style={{ marginBottom: 16, color: 'var(--text-primary)' }}>Learn More & Take Action</h3>
                <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                  <a href="https://www.macomptroller.org/cthru/" target="_blank" rel="noopener" className="btn-secondary" style={{ padding: '10px 20px', borderRadius: 8, textDecoration: 'none', fontSize: '0.85rem' }}>
                    <ExternalLink size={14} /> CTHRU Portal
                  </a>
                  <a href="https://massopenbooks.org/" target="_blank" rel="noopener" className="btn-secondary" style={{ padding: '10px 20px', borderRadius: 8, textDecoration: 'none', fontSize: '0.85rem' }}>
                    <ExternalLink size={14} /> MassOpenBooks
                  </a>
                  <a href="https://www.ocpf.us" target="_blank" rel="noopener" className="btn-secondary" style={{ padding: '10px 20px', borderRadius: 8, textDecoration: 'none', fontSize: '0.85rem' }}>
                    <ExternalLink size={14} /> OCPF Campaign Finance
                  </a>
                  <a href="https://ballotpedia.org/Massachusetts_Question_1,_Authorization_of_State_Auditor_to_Audit_General_Court_Initiative_(2024)" target="_blank" rel="noopener" className="btn-secondary" style={{ padding: '10px 20px', borderRadius: 8, textDecoration: 'none', fontSize: '0.85rem' }}>
                    <ExternalLink size={14} /> Question 1 Details
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}
              </div>

      {/* ============ SHARE ============ */}
      <div style={{ background: 'var(--bg-secondary)', borderTop: '1px solid var(--border)', padding: '40px 24px', textAlign: 'center' }}>
        <h3 style={{ marginBottom: 8, fontSize: '1.3rem', fontWeight: 700 }}>Share This Dashboard</h3>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 20, fontSize: '0.9rem' }}>
          Help spread transparency â share The People's Audit with your network.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <a href="https://twitter.com/intent/tweet?text=Massachusetts%20voters%20demanded%20a%20legislative%20audit.%20The%20legislature%20refused.%20So%20we%20built%20The%20People%27s%20Audit%20%E2%80%94%20tracking%20every%20public%20dollar.&url=https://duncanburns2013-dot.github.io/The-Peoples-Audit/"
            target="_blank" rel="noopener"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 8, background: '#1a1d2e', color: '#fff', textDecoration: 'none', fontSize: '0.85rem', fontWeight: 600, transition: 'all 0.2s' }}>
            Share on X
          </a>
          <a href="https://www.linkedin.com/sharing/share-offsite/?url=https://duncanburns2013-dot.github.io/The-Peoples-Audit/"
            target="_blank" rel="noopener"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 8, background: '#0077B5', color: '#fff', textDecoration: 'none', fontSize: '0.85rem', fontWeight: 600, transition: 'all 0.2s' }}>
            Share on LinkedIn
          </a>
          <button onClick={() => { navigator.clipboard.writeText('https://duncanburns2013-dot.github.io/The-Peoples-Audit/'); }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 8, background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border)', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s' }}>
            Copy Link
          </button>
        </div>
      </div>

      {/* ============ FOOTER ============ */}
      <footer className="footer">
        <div className="footer-brand">THE PEOPLE'S AUDIT</div>
        <p>A citizen-led financial transparency project for Massachusetts</p>
        <p style={{ marginTop: 8 }}>
          Built on public data from{' '}
          <a href="https://www.macomptroller.org/cthru/" target="_blank" rel="noopener">CTHRU Portal</a>,{' '}
          <a href="https://www.ocpf.us" target="_blank" rel="noopener">OCPF</a>,{' '}
          <a href="https://massopenbooks.org/" target="_blank" rel="noopener">MassOpenBooks</a>, and{' '}
          <a href="https://www.usaspending.gov/" target="_blank" rel="noopener">USASpending.gov</a>.
        </p>
        <div className="footer-links">
          <a href="https://github.com/duncanburns2013-dot/The-Peoples-Audit" target="_blank" rel="noopener">GitHub</a>
          <a href="https://cthrupayroll.mass.gov/" target="_blank" rel="noopener">CTHRU Payroll</a>
          <a href="https://cthruspending.mass.gov/" target="_blank" rel="noopener">CTHRU Spending</a>
          <a href="https://api.ocpf.us" target="_blank" rel="noopener">OCPF API</a>
          <a href="https://api.usaspending.gov/" target="_blank" rel="noopener">USASpending API</a>
        </div>
        <p style={{ marginTop: 16, fontSize: '0.75rem' }}>
          72% of Massachusetts voters demanded a legislative audit. This dashboard exists because the Legislature said no.
        </p>
      </footer>
    </>
  );
}
