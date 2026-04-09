import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area, Treemap,
  Legend, Sankey
} from 'recharts';
import {
  DollarSign, Users, Building2, TrendingUp, AlertTriangle,
  ExternalLink, Search, ChevronDown, Scale, Vote, FileText,
  Landmark, Eye, Download, Menu, X, ArrowRight, Fingerprint,
  Network, ShieldAlert, Banknote, ChevronRight, Layers, Activity
} from 'lucide-react';
import {
  fetchSpendingByDepartment, fetchSpendingByVendor, fetchSpendingOverTime,
  fetchPayrollByDepartment, fetchTopEarners, fetchPayrollOverTime, searchPayroll,
  fetchQuasiPayments, fetchQuasiAgencyDetail, fetchQuasiAgencyByYear, fetchQuasiAgencyCategories, fetchQuasiAgencyPayments,
  fetchFederalSpendingMA, fetchFederalAwardsMA,
  fetchTopVendors, searchVendors, fetchNonProfitVendors, fetchVendorByYear,
  fetchVendorByDepartment, fetchVendorByCategory, fetchVendorPayments,
  fetchDepartmentVendors, fetchDepartmentCategories, fetchDepartmentAppropriations,
  fetchDepartmentOverTime, fetchDepartmentPayments, fetchSpendingByCabinet,
  fetchLegislatorFinances, fetchPACFinances, searchContributions, searchExpenditures,
  crossReferenceVendorDonations, fetchCampaignFinanceTotals,
  MA_BUDGET_SUMMARY, AUDIT_FACTS,
  SPENDING_BY_DEPARTMENT, SPENDING_BY_VENDOR, SPENDING_OVER_TIME,
  PAYROLL_BY_DEPARTMENT, TOP_EARNERS, PAYROLL_OVER_TIME,
  QUASI_PAYMENTS, FEDERAL_SPENDING_MA, FEDERAL_AWARDS_MA, MBTA_AUDITED_FINANCIALS,
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
// SPENDING EXPLORER — Department Drill-Down
// ============================================================

function SpendingExplorer({ departments, spendingOverTime, initialYear }) {
  const [selectedDept, setSelectedDept] = useState(null);
  const [deptDetail, setDeptDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [deptYear, setDeptYear] = useState(initialYear || '2025');
  const [paymentPage, setPaymentPage] = useState(0);
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
          <div className="chart-subtitle">Complete spending breakdown — every vendor, every dollar</div>

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
                    <h4 style={{ marginBottom: 8, color: 'var(--text-secondary)' }}>Top Vendors — FY{deptYear}</h4>
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
                    <h4 style={{ marginBottom: 8, color: 'var(--text-secondary)' }}>Spending Categories — FY{deptYear}</h4>
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
                          {c.category.replace(/^\([^)]+\)\s*/, '')} — {formatMoney(c.total)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {deptDetail.appropriations.length > 0 && (
                <div style={{ marginTop: 24 }}>
                  <h4 style={{ marginBottom: 8, color: 'var(--text-secondary)' }}>Budget Appropriations — FY{deptYear}</h4>
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

              {deptDetail.payments.length > 0 && (
                <div style={{ marginTop: 24 }}>
                  <h4 style={{ marginBottom: 8, color: 'var(--text-secondary)' }}>
                    Individual Payments — FY{deptYear} ({deptDetail.payments.length} records)
                  </h4>
                  <div className="data-table-wrapper">
                    <table className="data-table">
                      <thead>
                        <tr><th>Date</th><th>Amount</th><th>Vendor</th><th>Appropriation</th><th>Category</th><th>Method</th></tr>
                      </thead>
                      <tbody>
                        {deptDetail.payments.slice(paymentPage * PAYMENTS_PER_PAGE, (paymentPage + 1) * PAYMENTS_PER_PAGE).map((p, i) => (
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
              )}
            </>
          )}
        </div>
      )}

      {departments ? (
        <>
          <div className="chart-card">
            <h3>Spending by Department — FY{deptYear}</h3>
            <div className="chart-subtitle">Click any department to see the full breakdown</div>
            <ResponsiveContainer width="100%" height={600}>
              <BarChart data={departments.slice(0, 20)} layout="vertical" margin={{ left: 200 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
                <XAxis type="number" tickFormatter={formatMoney} stroke={AXIS_COLOR} />
                <YAxis type="category" dataKey="name" stroke={AXIS_COLOR} width={190} tick={({ x, y, payload }) => (
                  <text x={x} y={y} dy={4} textAnchor="end" fill={AXIS_COLOR} fontSize={10}>
                    {payload.value.length > 28 ? payload.value.substring(0, 26) + '…' : payload.value}
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
                📊 <strong style={{ color: '#14558F' }}>Data through FY2024</strong> — the latest fiscal year published by CTHRU. FY2025 data will appear after official publication.
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
// VENDOR EXPLORER — "Track Every Dollar"
// ============================================================

function VendorExplorer({ spendingYear }) {
  const [vendorSearch, setVendorSearch] = useState('');
  const [vendors, setVendors] = useState([]);
  const [vendorsLoading, setVendorsLoading] = useState(true);
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [vendorDetail, setVendorDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [vendorYear, setVendorYear] = useState(spendingYear || '2025');
  const [paymentPage, setPaymentPage] = useState(0);
  const [nonProfitFilter, setNonProfitFilter] = useState(false);
  const [sortField, setSortField] = useState('total');
  const [sortDir, setSortDir] = useState('desc');
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
          <div className="chart-subtitle">Complete payment history — every dollar tracked</div>

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
                    <h4 style={{ marginBottom: 8, color: 'var(--text-secondary)' }}>Paying Departments — FY{vendorYear}</h4>
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
                    <h4 style={{ marginBottom: 8, color: 'var(--text-secondary)' }}>Spending Categories — FY{vendorYear}</h4>
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

              {vendorDetail.payments.length > 0 && (
                <div style={{ marginTop: 24 }}>
                  <h4 style={{ marginBottom: 8, color: 'var(--text-secondary)' }}>
                    Individual Payments — FY{vendorYear} ({vendorDetail.payments.length} records)
                  </h4>
                  <div className="data-table-wrapper">
                    <table className="data-table">
                      <thead>
                        <tr><th>Date</th><th>Amount</th><th>Department</th><th>Appropriation</th><th>Category</th><th>Method</th></tr>
                      </thead>
                      <tbody>
                        {vendorDetail.payments.slice(paymentPage * PAYMENTS_PER_PAGE, (paymentPage + 1) * PAYMENTS_PER_PAGE).map((p, i) => (
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
              )}
            </>
          )}
        </div>
      )}

      {vendorsLoading ? (
        <div className="loading-skeleton" style={{ height: 400 }} />
      ) : (
        <>
          <div className="chart-card">
            <h3>{vendorSearch ? `Search Results for "${vendorSearch}"` : `Top Vendors by Payment — FY${vendorYear}`}</h3>
            <div className="chart-subtitle">{vendorSearch ? `${vendors.length} vendors found` : 'Click any vendor to drill down into every payment'}</div>
            {vendors.length > 0 && (
              <ResponsiveContainer width="100%" height={Math.min(800, vendors.slice(0, 30).length * 26 + 40)}>
                <BarChart data={vendors.slice(0, 30)} layout="vertical" margin={{ left: 220 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
                  <XAxis type="number" tickFormatter={formatMoney} stroke={AXIS_COLOR} />
                  <YAxis type="category" dataKey="vendor" stroke={AXIS_COLOR} width={210} tick={({ x, y, payload }) => (
                    <text x={x} y={y} dy={4} textAnchor="end" fill={AXIS_COLOR} fontSize={10}>
                      {payload.value.length > 28 ? payload.value.substring(0, 26) + '…' : payload.value}
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
                    Vendor / Contractor {sortField === 'vendor' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                  </th>
                  <th style={{ cursor: 'pointer' }} onClick={() => { setSortField('total'); setSortDir(d => sortField === 'total' ? (d === 'asc' ? 'desc' : 'asc') : 'desc'); }}>
                    Total Payments {sortField === 'total' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
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
// QUASI EXPLORER — Quasi-Government Drill-Down
// ============================================================

function QuasiExplorer({ quasiPayments }) {
  const [selectedAgency, setSelectedAgency] = useState(null);
  const [agencyDetail, setAgencyDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [quasiYear, setQuasiYear] = useState('2025');
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
      // Merge MBTA audited financials (CTHRU only tracks state→MBTA payments through ~2017;
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
          <div className="chart-subtitle">Complete spending breakdown — every vendor, every dollar</div>

          {detailLoading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
              <div className="spinner" style={{ margin: '0 auto 12px' }} /> Loading agency data...
            </div>
          ) : agencyDetail && (
            <>
              {agencyDetail.isMBTA && (
                <div style={{ marginTop: 16, padding: '12px 16px', background: 'rgba(20, 85, 143, 0.08)', border: '1px solid rgba(20, 85, 143, 0.3)', borderRadius: 10, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  📊 <strong style={{ color: '#14558F' }}>MBTA Note:</strong> CTHRU tracks state payments to MBTA through ~FY2017. Years 2018–2025 below are pulled from the MBTA's own published audited financial statements.
                  {' '}<a href="https://www.mbta.com/financials/audited-financials" target="_blank" rel="noopener" style={{ color: '#14558F', fontWeight: 600 }}>Audited Financials</a>
                  {' · '}
                  <a href="https://www.mbta.com/financials" target="_blank" rel="noopener" style={{ color: '#14558F', fontWeight: 600 }}>MBTA Financial Center</a>
                </div>
              )}
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
                      Data available: FY{agencyDetail.byYear[0].year} — FY{agencyDetail.byYear[agencyDetail.byYear.length - 1].year}
                      {!agencyDetail.byYear.find(y => y.year === quasiYear) && (
                        <span style={{ color: 'var(--accent-red)', marginLeft: 8 }}>
                          (No data for FY{quasiYear} — showing available years)
                        </span>
                      )}
                    </span>
                  )}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: 20, marginTop: 24 }}>
                {agencyDetail.vendors.length > 0 && (
                  <div>
                    <h4 style={{ marginBottom: 8, color: 'var(--text-secondary)' }}>Top Vendors — FY{quasiYear}</h4>
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
                    <h4 style={{ marginBottom: 8, color: 'var(--text-secondary)' }}>Spending Categories — FY{quasiYear}</h4>
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
                    Individual Payments — FY{quasiYear} ({agencyDetail.payments.length} records)
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
// PAYROLL SEARCHER — Search by name or department
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
            <div className="chart-subtitle">Aggregate compensation — {payrollYear}</div>
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
            <div className="chart-subtitle">Employee count — {payrollYear}</div>
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
          <h3 style={{ marginBottom: 16 }}>Top 50 Highest-Paid State Employees — {payrollYear}</h3>
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
// FOLLOW THE MONEY — Campaign Finance + Cross-Reference
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
  const [contribYear, setContribYear] = useState('all');
  const [contribPage, setContribPage] = useState(0);
  const [contribSort, setContribSort] = useState('date-desc');
  const [crossRefSort, setCrossRefSort] = useState('amount-desc');
  const [crossRefYear, setCrossRefYear] = useState('all');
  const [crossRefPage, setCrossRefPage] = useState(0);
  const contribRef = useRef(null);
  const CONTRIB_PAGE_SIZE = 100;
  const CROSSREF_PAGE_SIZE = 24;

  useEffect(() => {
    setLoading(true);
    Promise.allSettled([
      fetchLegislatorFinances('2024'),
      fetchPACFinances('2024'),
    ]).then(([legResult, pacResult]) => {
      if (legResult.status === 'fulfilled') setLegislators(legResult.value);
      if (pacResult.status === 'fulfilled') setPacs(pacResult.value);
      setLoading(false);
    });
  }, []);

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

  // Cross-reference vendor — pulls a wide window so client-side sort/filter works
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
  const loadContribs = useCallback((leg, year, page) => {
    setContribLoading(true);
    const params = { cpfId: leg.cpfId, pageSize: CONTRIB_PAGE_SIZE, pageIndex: page };
    if (year && year !== 'all') {
      params.startDate = `${year}-01-01`;
      params.endDate = `${year}-12-31`;
    }
    searchContributions(params).then(data => {
      setLegislatorContributions(data);
      setContribLoading(false);
    });
  }, []);

  const selectLegislatorForContribs = useCallback((leg) => {
    setSelectedLegislator(leg);
    setContribYear('all');
    setContribPage(0);
    loadContribs(leg, 'all', 0);
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
        <p>Cross-referencing OCPF campaign finance data with state spending. Who pays to play — and who profits?</p>
      </div>

      <div className="disclaimer">
        Campaign finance data from the Massachusetts Office of Campaign and Political Finance (OCPF) public API.
        Cross-references show contributions from entities matching vendor names — correlation does not imply wrongdoing.
        All data is publicly available under Massachusetts open records laws.
      </div>

      {/* Sub-navigation tabs */}
      <div className="filter-toggle" style={{ marginBottom: 24 }}>
        <button className={`filter-btn ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>
          <Activity size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Overview
        </button>
        <button className={`filter-btn ${activeTab === 'legislators' ? 'active' : ''}`} onClick={() => setActiveTab('legislators')}>
          <Landmark size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Legislators
        </button>
        <button className={`filter-btn ${activeTab === 'crossref' ? 'active' : ''}`} onClick={() => setActiveTab('crossref')}>
          <Network size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Cross-Reference
        </button>
        <button className={`filter-btn ${activeTab === 'search' ? 'active' : ''}`} onClick={() => setActiveTab('search')}>
          <Search size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Search
        </button>
      </div>

      {loading ? (
        <div className="loading-skeleton" style={{ height: 400 }} />
      ) : (
        <>
          {/* === OVERVIEW TAB === */}
          {activeTab === 'overview' && (
            <motion.div {...pageVariants} key="ftm-overview">
              <div className="kpi-row">
                <div className="kpi-card">
                  <div className="kpi-label">Legislators Tracked</div>
                  <div className="kpi-value" style={{ color: 'var(--accent-purple)' }}>{legislators.length}</div>
                  <div className="kpi-sub">All races, 2024 cycle</div>
                </div>
                <div className="kpi-card">
                  <div className="kpi-label">Total Legislator Receipts</div>
                  <div className="kpi-value">{formatMoney(totalLegReceipts)}</div>
                  <div className="kpi-sub">Campaign contributions</div>
                </div>
                <div className="kpi-card">
                  <div className="kpi-label">PACs Tracked</div>
                  <div className="kpi-value" style={{ color: 'var(--accent-gold)' }}>{pacs.length}</div>
                  <div className="kpi-sub">Political Action Committees</div>
                </div>
                <div className="kpi-card">
                  <div className="kpi-label">Total PAC Receipts</div>
                  <div className="kpi-value">{formatMoney(totalPACReceipts)}</div>
                  <div className="kpi-sub">PAC fundraising, 2024</div>
                </div>
              </div>

              <div className="card-grid">
                <div className="chart-card">
                  <h3>Top-Funded Legislators — 2024</h3>
                  <div className="chart-subtitle">Ranked by total campaign receipts</div>
                  {topFundedLegislators.length > 0 && (
                    <ResponsiveContainer width="100%" height={500}>
                      <BarChart data={topFundedLegislators} layout="vertical" margin={{ left: 180 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
                        <XAxis type="number" tickFormatter={formatMoney} stroke={AXIS_COLOR} />
                        <YAxis type="category" dataKey="name" stroke={AXIS_COLOR} width={170} tick={{ fontSize: 10 }} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="receipts" fill="#9955ff" radius={[0, 3, 3, 0]} name="Receipts" cursor="pointer"
                          onClick={(data) => data && selectLegislatorForContribs(data)} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>

                <div className="chart-card">
                  <h3>Top PACs by Receipts — 2024</h3>
                  <div className="chart-subtitle">Political Action Committee fundraising</div>
                  {topPACs.length > 0 && (
                    <ResponsiveContainer width="100%" height={500}>
                      <BarChart data={topPACs} layout="vertical" margin={{ left: 200 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
                        <XAxis type="number" tickFormatter={formatMoney} stroke={AXIS_COLOR} />
                        <YAxis type="category" dataKey="name" stroke={AXIS_COLOR} width={190} tick={{ fontSize: 9 }} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="receipts" fill="#ffaa22" radius={[0, 3, 3, 0]} name="Receipts" />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* === LEGISLATORS TAB === */}
          {activeTab === 'legislators' && (
            <motion.div {...pageVariants} key="ftm-legislators">
              {selectedLegislator && (
                <div ref={contribRef} className="detail-panel" style={{ marginBottom: 24 }}>
                  <button className="close-btn" onClick={() => { setSelectedLegislator(null); setLegislatorContributions(null); }}>Close</button>
                  <h3 style={{ color: 'var(--accent-purple)' }}>{selectedLegislator.name}</h3>
                  <div className="chart-subtitle">
                    {selectedLegislator.office} {selectedLegislator.district && `— ${selectedLegislator.district}`} | {selectedLegislator.party}
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
                            <option value="all">All years</option>
                            {[2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016, 2015, 2014, 2013, 2012, 2011, 2010].map(y => (
                              <option key={y} value={y}>{y}</option>
                            ))}
                          </select>
                          <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Sort:</label>
                          <select value={contribSort} onChange={e => setContribSort(e.target.value)}
                            style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', background: '#fff', fontSize: '0.85rem' }}>
                            <option value="date-desc">Date (newest)</option>
                            <option value="date-asc">Date (oldest)</option>
                            <option value="amount-desc">Amount (high → low)</option>
                            <option value="amount-asc">Amount (low → high)</option>
                            <option value="contributor">Contributor (A→Z)</option>
                          </select>
                          <button onClick={() => setContribPage(p => Math.max(0, p - 1))} disabled={contribPage === 0}
                            style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border)', background: '#fff', cursor: contribPage === 0 ? 'not-allowed' : 'pointer', opacity: contribPage === 0 ? 0.5 : 1 }}>
                            ← Prev
                          </button>
                          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Page {contribPage + 1}</span>
                          <button onClick={() => setContribPage(p => p + 1)} disabled={legislatorContributions.items.length < CONTRIB_PAGE_SIZE}
                            style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border)', background: '#fff', cursor: legislatorContributions.items.length < CONTRIB_PAGE_SIZE ? 'not-allowed' : 'pointer', opacity: legislatorContributions.items.length < CONTRIB_PAGE_SIZE ? 0.5 : 1 }}>
                            Next →
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
                    <tr><th>#</th><th>Name</th><th>Office</th><th>Party</th><th>Receipts</th><th>Expenditures</th><th>Cash on Hand</th><th></th></tr>
                  </thead>
                  <tbody>
                    {legislators.sort((a, b) => b.receipts - a.receipts).map((l, i) => (
                      <tr key={i} onClick={() => selectLegislatorForContribs(l)} style={{ cursor: 'pointer' }}
                        className={selectedLegislator?.cpfId === l.cpfId ? 'active-row' : ''}>
                        <td style={{ color: 'var(--text-muted)' }}>{i + 1}</td>
                        <td style={{ fontWeight: selectedLegislator?.cpfId === l.cpfId ? 700 : 400 }}>{l.name}</td>
                        <td style={{ fontSize: '0.8rem' }}>{l.office}</td>
                        <td style={{ fontSize: '0.8rem', color: l.party === 'Democratic' ? '#3388ff' : l.party === 'Republican' ? '#ff3344' : 'var(--text-muted)' }}>{l.party}</td>
                        <td className="money">{formatMoney(l.receipts)}</td>
                        <td className="money" style={{ color: 'var(--accent-red)' }}>{formatMoney(l.expenditures)}</td>
                        <td className="money">{formatMoney(l.cashOnHand)}</td>
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
                  Vendor → Donor Cross-Reference
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
                      ? `Found ${sorted.length} contribution(s) matching "${crossRefVendor}"${crossRefResults.length >= 500 ? ' (capped at 500 — narrow your search for more)' : ''}`
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
                          {[2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016, 2015, 2014, 2013, 2012, 2011, 2010].map(y => (
                            <option key={y} value={y}>{y}</option>
                          ))}
                        </select>
                        <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: 8 }}>Sort:</label>
                        <select value={crossRefSort} onChange={e => { setCrossRefPage(0); setCrossRefSort(e.target.value); }}
                          style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', background: '#fff', fontSize: '0.85rem' }}>
                          <option value="amount-desc">Amount (high → low)</option>
                          <option value="amount-asc">Amount (low → high)</option>
                          <option value="date-desc">Date (newest)</option>
                          <option value="date-asc">Date (oldest)</option>
                          <option value="contributor">Contributor (A→Z)</option>
                          <option value="recipient">Recipient (A→Z)</option>
                        </select>
                        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                          <button onClick={() => setCrossRefPage(p => Math.max(0, p - 1))} disabled={crossRefPage === 0}
                            style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border)', background: '#fff', cursor: crossRefPage === 0 ? 'not-allowed' : 'pointer', opacity: crossRefPage === 0 ? 0.5 : 1 }}>← Prev</button>
                          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Page {crossRefPage + 1} / {totalPages}</span>
                          <button onClick={() => setCrossRefPage(p => Math.min(totalPages - 1, p + 1))} disabled={crossRefPage >= totalPages - 1}
                            style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border)', background: '#fff', cursor: crossRefPage >= totalPages - 1 ? 'not-allowed' : 'pointer', opacity: crossRefPage >= totalPages - 1 ? 0.5 : 1 }}>Next →</button>
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
        {name?.length > 20 ? name.substring(0, 18) + '…' : name}
      </text>
      <text x={x + width / 2} y={y + height / 2 + 10} textAnchor="middle" fill="rgba(255,255,255,0.7)" fontSize={10}>
        {formatMoney(value)}
      </text>
    </g>
  );
};

// ============================================================
// APP
// ============================================================

export default function App() {
  const [activeSection, setActiveSection] = useState('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
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
  });
  const [spendingYear, setSpendingYear] = useState('2025');
  const [payrollYear, setPayrollYear] = useState('2025');
  const [federalYear, setFederalYear] = useState(2025);

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
    if (liveCount > 0) console.log(`Live data loaded for ${liveCount}/${fetchers.length} sources`);
  }, [spendingYear, payrollYear, federalYear]);

  useEffect(() => { fetchAllData(); }, [fetchAllData]);

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
    { id: 'lobbyists', label: 'Lobbying', icon: <Network size={16} />, tag: 'critical' },
    { id: 'federal', label: 'Federal Funds', icon: <Landmark size={16} />, tag: 'live' },
    { id: 'quasi', label: 'Quasi-Government', icon: <Layers size={16} />, tag: 'live' },
    { id: 'audit', label: 'The Audit Fight', icon: <Scale size={16} /> },
  ];

  const navigateTo = (id) => {
    setActiveSection(id);
    setSidebarOpen(false);
    window.scrollTo({ top: document.getElementById('dashboard')?.offsetTop || 0, behavior: 'smooth' });
  };

  return (
    <>
      {/* ============ HERO ============ */}
      <section className="hero">
        {/* Ominous official portraits — flex row, big and evenly spaced */}
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
            So we're putting every public dollar on display — and following the money to its source.
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
                style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '1rem', width: '100%', outline: 'none' }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    navigateTo('spending');
                  }
                }}
              />
            </div>
          </div>

          <div className="hero-cta">
            <button className="btn-primary" onClick={() => navigateTo('overview')}>
              <Eye size={18} /> Explore the Data
            </button>
            <button className="btn-primary" onClick={() => navigateTo('bonds')}
              style={{ background: 'linear-gradient(135deg, #680A1D 0%, #14558F 50%, #32784E 100%)' }}>
              <Banknote size={18} /> Bonds & Borrowing
            </button>
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
                ? `Connected to ${dataSourceCount} live data feeds + OCPF campaign finance — all sources online`
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
      <AnimatePresence mode="wait">
        {/* ============ OVERVIEW ============ */}
        {activeSection === 'overview' && (
          <motion.div key="overview" variants={pageVariants} initial="initial" animate="animate" exit="exit">
            <div className="section">
              <div className="section-header">
                <span className="section-tag red">FY{budget.fiscalYear} Snapshot</span>
                <h2>Massachusetts at a Glance</h2>
                <p>A high-level view of state finances — budget, revenue, expenditure, and workforce.</p>
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
                <h3>Budget Treemap — Where {formatMoney(budget.totalBudget)} Goes</h3>
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
                  <div className="chart-subtitle">Total expenditures by fiscal year — live from CTHRU (data through latest completed fiscal year)</div>
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
                    📊 <strong style={{ color: '#14558F' }}>Data through FY2024</strong> — the latest fiscal year published by CTHRU. FY2025 expenditure data will be added after official publication by the Comptroller.
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* ============ SPENDING EXPLORER ============ */}
        {activeSection === 'spending' && (
          <motion.div key="spending" variants={pageVariants} initial="initial" animate="animate" exit="exit">
            <SpendingExplorer departments={data.spendingByDept} spendingOverTime={data.spendingOverTime} initialYear={spendingYear} />
          </motion.div>
        )}

        {/* ============ PAYROLL ============ */}
        {activeSection === 'payroll' && (
          <motion.div key="payroll" variants={pageVariants} initial="initial" animate="animate" exit="exit">
            <PayrollSearcher payrollYear={payrollYear} setPayrollYear={setPayrollYear} data={data} />
          </motion.div>
        )}

        {/* ============ VENDOR EXPLORER ============ */}
        {activeSection === 'vendors' && (
          <motion.div key="vendors" variants={pageVariants} initial="initial" animate="animate" exit="exit">
            <VendorExplorer spendingYear={spendingYear} />
          </motion.div>
        )}

        {/* ============ FOLLOW THE MONEY ============ */}
        {activeSection === 'campaign' && (
          <motion.div key="campaign" variants={pageVariants} initial="initial" animate="animate" exit="exit">
            <FollowTheMoney />
          </motion.div>
        )}

{/* ============ BONDS & BORROWING ============ */}
        {activeSection === 'bonds' && (
          <motion.div key="bonds" variants={pageVariants} initial="initial" animate="animate" exit="exit">
            <div className="section">
              <div className="section-header">
                <span className="section-tag blue">Debt Service</span>
                <h2>Massachusetts Bonds & Borrowing</h2>
                <p>State, county, and municipal debt obligations. Data sourced from EMMA (Electronic Municipal Market Access) and MassBondHolder. What is the true cost of Massachusetts' borrowing strategy?</p>
              </div>

              <div className="card-grid">
                <div className="card" style={{ borderColor: 'rgba(20,85,143,0.3)' }}>
                  <div className="card-title"><Banknote size={16} /> State Debt Outstanding</div>
                  <div className="card-value">$40.7B</div>
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: '12px' }}>General Obligation & Revenue Bonds combined</div>
                </div>
                <div className="card" style={{ borderColor: 'rgba(50,120,78,0.3)' }}>
                  <div className="card-title"><TrendingUp size={16} /> Annual Debt Service</div>
                  <div className="card-value">$2.3B</div>
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: '12px' }}>5.6% of state budget (FY2025)</div>
                </div>
              </div>

              <div className="chart-card">
                <h3>Bond Data Sources (Live)</h3>
                <div style={{ background: '#f4f5f8', padding: '20px', borderRadius: '8px', fontSize: '0.9rem', marginBottom: '20px', color: 'var(--text-secondary)' }}>
                  <p><strong>EMMA (msrb.org):</strong> Massachusetts municipal and county bonds in real-time trading data</p>
                  <p style={{ marginTop: '12px' }}><strong>MassBondHolder:</strong> Comprehensive financial documents, debt statements, redemption schedules</p>
                  <p style={{ marginTop: '12px' }}><strong>Secretary of the Commonwealth:</strong> Official bond issuance records</p>
                  <br />
                  Search: <a href="https://emma.msrb.org/QuickSearch/Results?quickSearchText=MASSACHUSETTS" target="_blank" rel="noopener" style={{ color: '#14558F', textDecoration: 'none', fontWeight: '600' }}>EMMA Massachusetts ↗</a>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ============ LOBBYISTS ============ */}
        {activeSection === 'lobbyists' && (
          <motion.div key="lobbyists" variants={pageVariants} initial="initial" animate="animate" exit="exit">
            <div className="section">
              <div className="section-header">
                <span className="section-tag green">Money & Influence</span>
                <h2>Massachusetts Lobbying Activity</h2>
                <p>Who is paid to influence Massachusetts government? Track lobbying registrations, spending, and client relationships. Data from Massachusetts Secretary of the Commonwealth.</p>
              </div>

              <div className="card-grid">
                <div className="card" style={{ borderColor: 'rgba(32,120,78,0.3)' }}>
                  <div className="card-title"><Network size={16} /> Search Lobbyists</div>
                  <div style={{ fontSize: '0.9rem', marginTop: '12px', color: 'var(--text-secondary)' }}>
                    <a href="https://www.sec.state.ma.us/lobbyistpublicsearch/" target="_blank" rel="noopener" style={{ color: '#32784E', textDecoration: 'none', fontWeight: '600' }}>
                      SEC Lobbyist Public Search ↗
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

{/* ============ FEDERAL ============ */}
        {activeSection === 'federal' && (
          <motion.div key="federal" variants={pageVariants} initial="initial" animate="animate" exit="exit">
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
                            {payload.value.length > 28 ? payload.value.substring(0, 26) + '…' : payload.value}
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
                            {payload.value.length > 28 ? payload.value.substring(0, 26) + '…' : payload.value}
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
          </motion.div>
        )}

        {/* ============ QUASI-GOVERNMENT ============ */}
        {activeSection === 'quasi' && (
          <motion.div key="quasi" variants={pageVariants} initial="initial" animate="animate" exit="exit">
            <QuasiExplorer quasiPayments={data.quasiPayments} />
          </motion.div>
        )}

        {/* ============ THE AUDIT FIGHT ============ */}
        {activeSection === 'audit' && (
          <motion.div key="audit" variants={pageVariants} initial="initial" animate="animate" exit="exit">
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
                    <strong style={{ color: 'var(--text-primary)' }}> Nearly 72% voted YES</strong> — an
                    overwhelming, bipartisan mandate for transparency.
                  </p>
                </div>

                <div className="card" style={{ borderColor: 'rgba(255,51,68,0.3)' }}>
                  <div className="card-title"><AlertTriangle size={14} /> The Blockade</div>
                  <div className="card-value" style={{ color: 'var(--accent-red)', fontSize: '1.6rem' }}>Refused</div>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.6 }}>
                    Despite the voter mandate, legislative leaders — including {audit.legislativeLeaders.join(' and ')} —
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
                    the data that's already public. Every dollar, every vendor, every salary —
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
                    { date: 'Nov 2024', event: 'Ballot Question 1 passes with 71.8% YES — voters affirm the auditor\'s authority', color: '#22cc66' },
                    { date: 'Nov 2024', event: 'DiZoglio announces plans to begin the audit immediately', color: '#22cc66' },
                    { date: 'Jan 2025', event: 'House of Representatives hires outside counsel to fight the audit', color: '#ff3344' },
                    { date: 'Feb 2026', event: 'DiZoglio files complaint with Supreme Judicial Court to enforce Question 1', color: '#aa44ff' },
                    { date: '2026', event: 'The People\'s Audit goes live — if they won\'t audit, we will', color: '#ff3344' },
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
          </motion.div>
        )}
      </AnimatePresence>

      {/* ============ SHARE ============ */}
      <div style={{ background: 'var(--bg-secondary)', borderTop: '1px solid var(--border)', padding: '40px 24px', textAlign: 'center' }}>
        <h3 style={{ marginBottom: 8, fontSize: '1.3rem', fontWeight: 700 }}>Share This Dashboard</h3>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 20, fontSize: '0.9rem' }}>
          Help spread transparency — share The People's Audit with your network.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <a href="https://twitter.com/intent/tweet?text=Massachusetts%20voters%20demanded%20a%20legislative%20audit.%20The%20legislature%20refused.%20So%20we%20built%20The%20People%27s%20Audit%20%E2%80%94%20tracking%20every%20public%20dollar.&url=https://duncanburns2013-dot.github.io/The-Peoples-Audit/"
            target="_blank" rel="noopener"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 8, background: '#1a1d2e', color: '#fff', textDecoration: 'none', fontSize: '0.85rem', fontWeight: 600, transition: 'all 0.2s' }}>
            Share on X
          </a>
          <a href="https://www.facebook.com/sharer/sharer.php?u=https://duncanburns2013-dot.github.io/The-Peoples-Audit/"
            target="_blank" rel="noopener"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 8, background: '#1877f2', color: '#fff', textDecoration: 'none', fontSize: '0.85rem', fontWeight: 600, transition: 'all 0.2s' }}>
            Share on Facebook
          </a>
          <a href="https://www.linkedin.com/sharing/share-offsite/?url=https://duncanburns2013-dot.github.io/The-Peoples-Audit/"
            target="_blank" rel="noopener"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 8, background: '#0a66c2', color: '#fff', textDecoration: 'none', fontSize: '0.85rem', fontWeight: 600, transition: 'all 0.2s' }}>
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