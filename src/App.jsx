import { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area, Treemap,
  Legend
} from 'recharts';
import {
  DollarSign, Users, Building2, TrendingUp, AlertTriangle,
  ExternalLink, Search, ChevronDown, Scale, Vote, FileText,
  Landmark, Eye, Download
} from 'lucide-react';
import {
  fetchSpendingByDepartment, fetchSpendingByVendor, fetchSpendingOverTime,
  fetchPayrollByDepartment, fetchTopEarners, fetchPayrollOverTime,
  fetchQuasiPayments, fetchFederalSpendingMA, fetchFederalAwardsMA,
  fetchTopVendors, searchVendors, fetchVendorByYear,
  fetchVendorByDepartment, fetchVendorByCategory, fetchVendorPayments,
  fetchDepartmentVendors, fetchDepartmentCategories, fetchDepartmentAppropriations,
  fetchDepartmentOverTime, fetchDepartmentPayments,
  MA_BUDGET_SUMMARY, AUDIT_FACTS,
  SPENDING_BY_DEPARTMENT, SPENDING_BY_VENDOR, SPENDING_OVER_TIME,
  PAYROLL_BY_DEPARTMENT, TOP_EARNERS, PAYROLL_OVER_TIME,
  QUASI_PAYMENTS, FEDERAL_SPENDING_MA, FEDERAL_AWARDS_MA,
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

const COLORS = ['#ff3344', '#ffaa22', '#3388ff', '#22cc66', '#22ddee', '#aa44ff',
  '#ff6644', '#44bbaa', '#ff88aa', '#88aaff', '#ffcc44', '#66ddaa'];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: '#1c1c28', border: '1px solid #2a2a3a', borderRadius: 8,
      padding: '12px 16px', fontSize: '0.85rem',
    }}>
      <p style={{ color: '#e8e8f0', fontWeight: 600, marginBottom: 4 }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color || '#ffaa22' }}>
          {p.name}: {typeof p.value === 'number' ? formatMoney(p.value) : p.value}
        </p>
      ))}
    </div>
  );
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
    });
  }, [deptYear]);

  return (
    <div className="section">
      <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <span className="section-tag">Expenditures</span>
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
        <div className="chart-card" style={{ marginBottom: 24, border: '1px solid var(--accent-red)', position: 'relative' }}>
          <button onClick={() => { setSelectedDept(null); setDeptDetail(null); }} style={{
            position: 'absolute', top: 12, right: 12, background: 'var(--bg-secondary)',
            border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-secondary)',
            padding: '4px 12px', cursor: 'pointer', fontSize: '0.8rem',
          }}>Close</button>

          <h3 style={{ color: 'var(--accent-red)', marginBottom: 4 }}>{selectedDept}</h3>
          <div className="chart-subtitle">Complete spending breakdown — every vendor, every dollar</div>

          {detailLoading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading department data...</div>
          ) : deptDetail && (
            <>
              {/* Spending over time */}
              {deptDetail.overTime.length > 0 && (
                <div style={{ marginTop: 20 }}>
                  <h4 style={{ marginBottom: 8, color: 'var(--text-secondary)' }}>Department Spending by Fiscal Year</h4>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={deptDetail.overTime}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
                      <XAxis dataKey="year" stroke="#606078" />
                      <YAxis tickFormatter={formatMoney} stroke="#606078" />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="total" fill="#ff3344" radius={[6, 6, 0, 0]} name="Total Spent" />
                    </BarChart>
                  </ResponsiveContainer>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    All-time total: <strong style={{ color: 'var(--accent-red)' }}>{formatMoney(deptDetail.overTime.reduce((s, y) => s + y.total, 0))}</strong>
                    {' '}across <strong style={{ color: 'var(--text-primary)' }}>{deptDetail.overTime.length}</strong> fiscal years
                  </span>
                </div>
              )}

              {/* Vendors + Categories side by side */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: 20, marginTop: 24 }}>
                {/* Top vendors for this department */}
                {deptDetail.vendors.length > 0 && (
                  <div>
                    <h4 style={{ marginBottom: 8, color: 'var(--text-secondary)' }}>Top Vendors — FY{deptYear}</h4>
                    <ResponsiveContainer width="100%" height={Math.max(200, Math.min(15, deptDetail.vendors.length) * 28 + 40)}>
                      <BarChart data={deptDetail.vendors.slice(0, 15)} layout="vertical" margin={{ left: 180 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
                        <XAxis type="number" tickFormatter={formatMoney} stroke="#606078" />
                        <YAxis type="category" dataKey="vendor" stroke="#606078" width={170} tick={{ fontSize: 10 }} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="total" fill="#22cc66" radius={[0, 6, 6, 0]} name="Paid" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Spending categories */}
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

              {/* Appropriations table */}
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

              {/* Individual payments */}
              {deptDetail.payments.length > 0 && (
                <div style={{ marginTop: 24 }}>
                  <h4 style={{ marginBottom: 8, color: 'var(--text-secondary)' }}>
                    Individual Payments — FY{deptYear} ({deptDetail.payments.length} records)
                  </h4>
                  <div className="data-table-wrapper">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Date</th><th>Amount</th><th>Vendor</th><th>Appropriation</th><th>Category</th><th>Method</th>
                        </tr>
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
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 12 }}>
                      <button disabled={paymentPage === 0} onClick={() => setPaymentPage(p => p - 1)} style={{
                        padding: '6px 16px', borderRadius: 6, border: '1px solid var(--border)',
                        background: 'var(--bg-secondary)', color: 'var(--text-primary)',
                        cursor: paymentPage === 0 ? 'not-allowed' : 'pointer', opacity: paymentPage === 0 ? 0.4 : 1,
                      }}>Previous</button>
                      <span style={{ padding: '6px 12px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        Page {paymentPage + 1} of {Math.ceil(deptDetail.payments.length / PAYMENTS_PER_PAGE)}
                      </span>
                      <button disabled={(paymentPage + 1) * PAYMENTS_PER_PAGE >= deptDetail.payments.length}
                        onClick={() => setPaymentPage(p => p + 1)} style={{
                        padding: '6px 16px', borderRadius: 6, border: '1px solid var(--border)',
                        background: 'var(--bg-secondary)', color: 'var(--text-primary)',
                        cursor: (paymentPage + 1) * PAYMENTS_PER_PAGE >= deptDetail.payments.length ? 'not-allowed' : 'pointer',
                        opacity: (paymentPage + 1) * PAYMENTS_PER_PAGE >= deptDetail.payments.length ? 0.4 : 1,
                      }}>Next</button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Department rankings */}
      {departments ? (
        <>
          <div className="chart-card">
            <h3>Spending by Department — FY{deptYear}</h3>
            <div className="chart-subtitle">Click any department to see the full breakdown</div>
            <ResponsiveContainer width="100%" height={600}>
              <BarChart data={departments.slice(0, 20)} layout="vertical" margin={{ left: 200 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
                <XAxis type="number" tickFormatter={formatMoney} stroke="#606078" />
                <YAxis type="category" dataKey="name" stroke="#606078" width={190} tick={{ fontSize: 11 }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value" fill="#ff3344" radius={[0, 6, 6, 0]} name="Total Spent" cursor="pointer"
                  onClick={(data) => data && selectDepartment(data.name)} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {spendingOverTime && spendingOverTime.length > 0 && (
            <div className="chart-card" style={{ marginTop: 24 }}>
              <h3>Total State Spending Over Time</h3>
              <div className="chart-subtitle">Year-over-year expenditure growth</div>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={spendingOverTime}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
                  <XAxis dataKey="year" stroke="#606078" />
                  <YAxis tickFormatter={formatMoney} stroke="#606078" />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="total" stroke="#ff3344" fill="rgba(255,51,68,0.15)" name="Total Spent" />
                </AreaChart>
              </ResponsiveContainer>
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
                    <td><ExternalLink size={12} style={{ color: 'var(--accent-blue)', cursor: 'pointer' }} /></td>
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
  const PAYMENTS_PER_PAGE = 25;

  // Load top vendors on mount and when year changes
  useEffect(() => {
    setVendorsLoading(true);
    fetchTopVendors(vendorYear, 200).then(data => {
      setVendors(data);
      setVendorsLoading(false);
    });
  }, [vendorYear]);

  // Search vendors
  useEffect(() => {
    if (!vendorSearch.trim()) return;
    const timer = setTimeout(() => {
      setVendorsLoading(true);
      searchVendors(vendorSearch, vendorYear).then(data => {
        setVendors(data);
        setVendorsLoading(false);
      });
    }, 400); // debounce
    return () => clearTimeout(timer);
  }, [vendorSearch, vendorYear]);

  // Reset to top vendors when search is cleared
  useEffect(() => {
    if (vendorSearch === '') {
      setVendorsLoading(true);
      fetchTopVendors(vendorYear, 200).then(data => {
        setVendors(data);
        setVendorsLoading(false);
      });
    }
  }, [vendorSearch, vendorYear]);

  // Load vendor detail when selected
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
    });
  }, [vendorYear]);

  const totalSpent = vendors.reduce((s, v) => s + v.total, 0);
  const totalPayments = vendors.reduce((s, v) => s + v.paymentCount, 0);

  return (
    <div className="section">
      <div className="section-header">
        <span className="section-tag">Vendor Money Tracker</span>
        <h2>Track Every Dollar</h2>
        <p>Search any vendor, contractor, or organization receiving Massachusetts taxpayer money. Click any vendor to see where every dollar went.</p>
      </div>

      {/* KPI Row */}
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

      {/* Search and Filter Bar */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 280, position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Search vendors... (e.g. Deloitte, Partners Healthcare, Keolis)"
            value={vendorSearch}
            onChange={e => setVendorSearch(e.target.value)}
            style={{
              width: '100%', padding: '12px 12px 12px 36px', borderRadius: 8,
              border: '1px solid var(--border)', background: 'var(--bg-secondary)',
              color: 'var(--text-primary)', fontSize: '0.9rem',
            }}
          />
        </div>
        <select className="year-select" value={vendorYear} onChange={e => { setVendorYear(e.target.value); setSelectedVendor(null); setVendorDetail(null); }}>
          {Array.from({ length: 17 }, (_, i) => 2026 - i).map(y => (
            <option key={y} value={y}>FY {y}</option>
          ))}
        </select>
      </div>

      {/* Vendor Detail Panel (when a vendor is selected) */}
      {selectedVendor && (
        <div className="chart-card" style={{ marginBottom: 24, border: '1px solid var(--accent-gold)', position: 'relative' }}>
          <button onClick={() => { setSelectedVendor(null); setVendorDetail(null); }} style={{
            position: 'absolute', top: 12, right: 12, background: 'var(--bg-secondary)',
            border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-secondary)',
            padding: '4px 12px', cursor: 'pointer', fontSize: '0.8rem',
          }}>Close</button>

          <h3 style={{ color: 'var(--accent-gold)', marginBottom: 4 }}>{selectedVendor}</h3>
          <div className="chart-subtitle">Complete payment history — every dollar tracked</div>

          {detailLoading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading vendor data...</div>
          ) : vendorDetail && (
            <>
              {/* Year-over-year payment history */}
              {vendorDetail.byYear.length > 0 && (
                <div style={{ marginTop: 20 }}>
                  <h4 style={{ marginBottom: 8, color: 'var(--text-secondary)' }}>Payment History by Fiscal Year</h4>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={vendorDetail.byYear}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
                      <XAxis dataKey="year" stroke="#606078" />
                      <YAxis tickFormatter={formatMoney} stroke="#606078" />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="total" fill="#ffaa22" radius={[6, 6, 0, 0]} name="Total Paid" />
                    </BarChart>
                  </ResponsiveContainer>
                  <div style={{ display: 'flex', gap: 24, marginTop: 12, flexWrap: 'wrap' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                      All-time total: <strong style={{ color: 'var(--accent-gold)' }}>{formatMoney(vendorDetail.byYear.reduce((s, y) => s + y.total, 0))}</strong>
                    </span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                      Years active: <strong style={{ color: 'var(--text-primary)' }}>{vendorDetail.byYear.length}</strong>
                    </span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                      Total payments: <strong style={{ color: 'var(--text-primary)' }}>{vendorDetail.byYear.reduce((s, y) => s + y.paymentCount, 0).toLocaleString()}</strong>
                    </span>
                  </div>
                </div>
              )}

              {/* Department breakdown + Category breakdown side by side */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: 20, marginTop: 24 }}>
                {/* Which departments paid this vendor */}
                {vendorDetail.byDept.length > 0 && (
                  <div>
                    <h4 style={{ marginBottom: 8, color: 'var(--text-secondary)' }}>Paying Departments — FY{vendorYear}</h4>
                    <ResponsiveContainer width="100%" height={Math.max(200, vendorDetail.byDept.length * 32)}>
                      <BarChart data={vendorDetail.byDept.slice(0, 15)} layout="vertical" margin={{ left: 180 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
                        <XAxis type="number" tickFormatter={formatMoney} stroke="#606078" />
                        <YAxis type="category" dataKey="department" stroke="#606078" width={170} tick={{ fontSize: 10 }} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="total" fill="#3388ff" radius={[0, 6, 6, 0]} name="Paid" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Spending categories */}
                {vendorDetail.byCat.length > 0 && (
                  <div>
                    <h4 style={{ marginBottom: 8, color: 'var(--text-secondary)' }}>Spending Categories — FY{vendorYear}</h4>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie data={vendorDetail.byCat.slice(0, 8)} dataKey="total" nameKey="category" cx="50%" cy="50%" outerRadius={100} label={({ category, percent }) => `${(percent * 100).toFixed(0)}%`}>
                          {vendorDetail.byCat.slice(0, 8).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px', fontSize: '0.75rem' }}>
                      {vendorDetail.byCat.slice(0, 8).map((c, i) => (
                        <span key={i} style={{ color: COLORS[i % COLORS.length] }}>
                          {c.category.replace(/^\([^)]+\)\s*/, '')} — {formatMoney(c.total)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Individual payment records */}
              {vendorDetail.payments.length > 0 && (
                <div style={{ marginTop: 24 }}>
                  <h4 style={{ marginBottom: 8, color: 'var(--text-secondary)' }}>
                    Individual Payments — FY{vendorYear} ({vendorDetail.payments.length} records)
                  </h4>
                  <div className="data-table-wrapper">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Amount</th>
                          <th>Department</th>
                          <th>Appropriation</th>
                          <th>Category</th>
                          <th>Method</th>
                        </tr>
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
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 12 }}>
                      <button
                        disabled={paymentPage === 0}
                        onClick={() => setPaymentPage(p => p - 1)}
                        style={{
                          padding: '6px 16px', borderRadius: 6, border: '1px solid var(--border)',
                          background: 'var(--bg-secondary)', color: 'var(--text-primary)', cursor: paymentPage === 0 ? 'not-allowed' : 'pointer',
                          opacity: paymentPage === 0 ? 0.4 : 1,
                        }}
                      >Previous</button>
                      <span style={{ padding: '6px 12px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        Page {paymentPage + 1} of {Math.ceil(vendorDetail.payments.length / PAYMENTS_PER_PAGE)}
                      </span>
                      <button
                        disabled={(paymentPage + 1) * PAYMENTS_PER_PAGE >= vendorDetail.payments.length}
                        onClick={() => setPaymentPage(p => p + 1)}
                        style={{
                          padding: '6px 16px', borderRadius: 6, border: '1px solid var(--border)',
                          background: 'var(--bg-secondary)', color: 'var(--text-primary)',
                          cursor: (paymentPage + 1) * PAYMENTS_PER_PAGE >= vendorDetail.payments.length ? 'not-allowed' : 'pointer',
                          opacity: (paymentPage + 1) * PAYMENTS_PER_PAGE >= vendorDetail.payments.length ? 0.4 : 1,
                        }}
                      >Next</button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Main vendor rankings table */}
      {vendorsLoading ? (
        <div className="loading-skeleton" style={{ height: 400 }} />
      ) : (
        <>
          <div className="chart-card">
            <h3>{vendorSearch ? `Search Results for "${vendorSearch}"` : `Top 200 Vendors by Payment — FY${vendorYear}`}</h3>
            <div className="chart-subtitle">{vendorSearch ? `${vendors.length} vendors found` : 'Click any vendor to drill down into every payment'}</div>
            {vendors.length > 0 && (
              <ResponsiveContainer width="100%" height={Math.min(800, vendors.slice(0, 30).length * 26 + 40)}>
                <BarChart data={vendors.slice(0, 30)} layout="vertical" margin={{ left: 220 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
                  <XAxis type="number" tickFormatter={formatMoney} stroke="#606078" />
                  <YAxis type="category" dataKey="vendor" stroke="#606078" width={210} tick={{ fontSize: 10 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="total" fill="#22cc66" radius={[0, 6, 6, 0]} name="Total Paid" cursor="pointer"
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
                  <th>Vendor / Contractor</th>
                  <th>Total Payments</th>
                  <th># Transactions</th>
                  <th>Avg Payment</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {vendors.map((v, i) => (
                  <tr key={i} onClick={() => selectVendor(v.vendor)} style={{ cursor: 'pointer' }}
                    className={selectedVendor === v.vendor ? 'active-row' : ''}>
                    <td style={{ color: 'var(--text-muted)' }}>{i + 1}</td>
                    <td style={{ fontWeight: selectedVendor === v.vendor ? 700 : 400 }}>{v.vendor}</td>
                    <td className="money">{formatMoney(v.total)}</td>
                    <td>{v.paymentCount.toLocaleString()}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{v.paymentCount > 0 ? formatMoney(v.total / v.paymentCount) : 'N/A'}</td>
                    <td><ExternalLink size={12} style={{ color: 'var(--accent-blue)', cursor: 'pointer' }} /></td>
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
// APP
// ============================================================

export default function App() {
  const [activeSection, setActiveSection] = useState('overview');
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

  // Fetch data on mount and when years change
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
      { key: 'federalSpending', fn: () => fetchFederalSpendingMA() },
      { key: 'federalAwards', fn: () => fetchFederalAwardsMA() },
    ];

    // Fallback data map — used when live API calls return null
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
      // Use live data only if it's a non-empty array; otherwise fall back
      if (val && Array.isArray(val) && val.length > 0) {
        newData[key] = val;
        liveCount++;
      } else {
        newData[key] = fallbacks[key] || null;
        if (!val) newErrors[key] = true; // only mark error if API actually failed
      }
    });

    setData(prev => ({ ...prev, ...newData }));
    setErrors(newErrors);
    setLoading(prev => ({ ...prev, global: false }));
    if (liveCount > 0) {
      console.log(`Live data loaded for ${liveCount}/${fetchers.length} sources`);
    } else {
      console.log('Using cached public records data (live APIs unavailable)');
    }
  }, [spendingYear, payrollYear]);

  useEffect(() => { fetchAllData(); }, [fetchAllData]);

  const dataSourceCount = Object.values(data).filter(Boolean).length;
  const errorCount = Object.values(errors).filter(Boolean).length;
  const budget = MA_BUDGET_SUMMARY;
  const audit = AUDIT_FACTS;

  const sections = [
    { id: 'overview', label: 'Overview', icon: <Eye size={14} /> },
    { id: 'spending', label: 'Spending', icon: <DollarSign size={14} /> },
    { id: 'payroll', label: 'Payroll', icon: <Users size={14} /> },
    { id: 'vendors', label: 'Vendors & Contracts', icon: <Building2 size={14} /> },
    { id: 'federal', label: 'Federal Funds', icon: <Landmark size={14} /> },
    { id: 'quasi', label: 'Quasi-Government', icon: <Building2 size={14} /> },
    { id: 'audit', label: 'The Audit Fight', icon: <Scale size={14} /> },
  ];

  return (
    <>
      {/* ============ HERO ============ */}
      <section className="hero">
        <div className="hero-content">
          <div className="hero-badge">Public Financial Transparency</div>
          <h1>The People's Audit</h1>
          <p className="subtitle">
            Massachusetts voters demanded accountability. The legislature refused.
            So we're putting every public dollar on display — for all the world to see.
          </p>
          <div className="audit-stat">
            <span className="big-number">{audit.percentYes}%</span>
            <span className="stat-label">
              <strong>of voters said YES</strong>
              to auditing the legislature ({audit.ballotQuestion}, {audit.ballotYear})
            </span>
          </div>
          <div className="hero-cta">
            <a href="#dashboard" className="btn-primary">
              <Eye size={18} /> Explore the Data
            </a>
            <a href="https://github.com/duncanburns2013-dot/The-Peoples-Audit" target="_blank" rel="noopener" className="btn-secondary">
              <FileText size={18} /> View Source on GitHub
            </a>
          </div>
        </div>
      </section>

      {/* ============ NAV ============ */}
      <nav className="nav" id="dashboard">
        <div className="nav-inner">
          {sections.map(s => (
            <button
              key={s.id}
              className={`nav-link ${activeSection === s.id ? 'active' : ''}`}
              onClick={() => setActiveSection(s.id)}
            >
              {s.icon} {s.label}
            </button>
          ))}
        </div>
      </nav>

      {/* ============ STATUS BAR ============ */}
      <div className="section" style={{ paddingBottom: 0 }}>
        <div className="status-bar">
          <span className={`status-dot ${loading.global ? 'loading' : errorCount === 0 ? '' : dataSourceCount > 0 ? '' : 'cached'}`} />
          <span style={{ color: 'var(--text-secondary)' }}>
            {loading.global
              ? 'Fetching live data from Massachusetts public records...'
              : dataSourceCount > 0 && errorCount === 0
                ? `Connected to ${dataSourceCount} live data feeds — all sources online`
                : dataSourceCount > 0
                  ? `${dataSourceCount} live feeds active | ${errorCount} source(s) using cached public records`
                  : `Displaying cached public records data from CTHRU, USASpending.gov & official reports`
            }
          </span>
        </div>
        <div className="disclaimer">
          All data shown is sourced from publicly available Massachusetts government records via the
          CTHRU Open Transparency Portal (Office of the Comptroller) and USASpending.gov.
          Budget summary figures are compiled from the Governor's FY2025 budget recommendation.
          This dashboard is a citizen-led transparency project and is not affiliated with any government entity.
        </div>
      </div>

      {/* ============ OVERVIEW ============ */}
      {activeSection === 'overview' && (
        <div className="section">
          <div className="section-header">
            <span className="section-tag">FY{budget.fiscalYear} Snapshot</span>
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

          <div className="card-grid">
            <div className="chart-card">
              <h3>Budget by Category</h3>
              <div className="chart-subtitle">Where {formatMoney(budget.totalBudget)} goes — FY{budget.fiscalYear}</div>
              <ResponsiveContainer width="100%" height={400}>
                <PieChart>
                  <Pie data={budget.categories} cx="50%" cy="50%" outerRadius={150} dataKey="value"
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(1)}%)`}
                    labelLine={{ stroke: '#606078' }}
                  >
                    {budget.categories.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="chart-card">
              <h3>Revenue Sources</h3>
              <div className="chart-subtitle">How the Commonwealth funds itself</div>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={budget.revenueSources} layout="vertical" margin={{ left: 120 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
                  <XAxis type="number" tickFormatter={formatMoney} stroke="#606078" />
                  <YAxis type="category" dataKey="name" stroke="#606078" width={110} tick={{ fontSize: 12 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="value" fill="#3388ff" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {data.spendingOverTime && (
            <div className="chart-card" style={{ marginTop: 24 }}>
              <h3>State Spending Over Time</h3>
              <div className="chart-subtitle">Total expenditures by fiscal year — live from CTHRU</div>
              <ResponsiveContainer width="100%" height={350}>
                <AreaChart data={data.spendingOverTime}>
                  <defs>
                    <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ff3344" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#ff3344" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
                  <XAxis dataKey="year" stroke="#606078" />
                  <YAxis tickFormatter={formatMoney} stroke="#606078" />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="total" stroke="#ff3344" fill="url(#spendGrad)" strokeWidth={2} name="Total Spending" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* ============ SPENDING EXPLORER ============ */}
      {activeSection === 'spending' && (
        <SpendingExplorer departments={data.spendingByDept} spendingOverTime={data.spendingOverTime} initialYear={spendingYear} />
      )}

      {/* ============ PAYROLL ============ */}
      {activeSection === 'payroll' && (
        <div className="section">
          <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <span className="section-tag">Compensation</span>
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
                    <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
                    <XAxis type="number" tickFormatter={formatMoney} stroke="#606078" />
                    <YAxis type="category" dataKey="department" stroke="#606078" width={170} tick={{ fontSize: 11 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="totalPay" fill="#ffaa22" radius={[0, 6, 6, 0]} name="Total Compensation" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="chart-card">
                <h3>Headcount by Department</h3>
                <div className="chart-subtitle">Employee count — {payrollYear}</div>
                <ResponsiveContainer width="100%" height={500}>
                  <BarChart data={data.payrollByDept.slice(0, 15)} layout="vertical" margin={{ left: 180 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
                    <XAxis type="number" stroke="#606078" />
                    <YAxis type="category" dataKey="department" stroke="#606078" width={170} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="employees" fill="#3388ff" radius={[0, 6, 6, 0]} name="Employees" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : (
            <div className="loading-skeleton" />
          )}

          {data.topEarners && (
            <div style={{ marginTop: 24 }}>
              <h3 style={{ marginBottom: 16 }}>Top 50 Highest-Paid State Employees — {payrollYear}</h3>
              <div className="data-table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Name</th>
                      <th>Department</th>
                      <th>Title</th>
                      <th>Total Compensation</th>
                    </tr>
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
            <div className="chart-card" style={{ marginTop: 24 }}>
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
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
                  <XAxis dataKey="year" stroke="#606078" />
                  <YAxis tickFormatter={formatMoney} stroke="#606078" />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="totalPayroll" stroke="#ffaa22" fill="url(#payrollGrad)" strokeWidth={2} name="Total Payroll" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* ============ VENDOR EXPLORER ============ */}
      {activeSection === 'vendors' && (
        <VendorExplorer spendingYear={spendingYear} />
      )}

      {/* ============ FEDERAL ============ */}
      {activeSection === 'federal' && (
        <div className="section">
          <div className="section-header">
            <span className="section-tag">Federal Funding</span>
            <h2>Federal Money Flowing to Massachusetts</h2>
            <p>Grants, contracts, and awards from the federal government to MA entities. Data from USASpending.gov.</p>
          </div>

          <div className="card-grid">
            {data.federalSpending ? (
              <div className="chart-card">
                <h3>Federal Spending by Agency</h3>
                <div className="chart-subtitle">Which federal agencies send the most to MA</div>
                <ResponsiveContainer width="100%" height={500}>
                  <BarChart data={data.federalSpending.slice(0, 15)} layout="vertical" margin={{ left: 200 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
                    <XAxis type="number" tickFormatter={formatMoney} stroke="#606078" />
                    <YAxis type="category" dataKey="name" stroke="#606078" width={190} tick={{ fontSize: 11 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="value" fill="#22ddee" radius={[0, 6, 6, 0]} name="Federal Spending" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="loading-skeleton" />
            )}

            {data.federalAwards ? (
              <div className="chart-card">
                <h3>Top Federal Award Recipients in MA</h3>
                <div className="chart-subtitle">Who receives the most federal dollars</div>
                <ResponsiveContainer width="100%" height={500}>
                  <BarChart data={data.federalAwards.slice(0, 15)} layout="vertical" margin={{ left: 200 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
                    <XAxis type="number" tickFormatter={formatMoney} stroke="#606078" />
                    <YAxis type="category" dataKey="name" stroke="#606078" width={190} tick={{ fontSize: 11 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="value" fill="#aa44ff" radius={[0, 6, 6, 0]} name="Award Amount" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="loading-skeleton" />
            )}
          </div>
        </div>
      )}

      {/* ============ QUASI-GOVERNMENT ============ */}
      {activeSection === 'quasi' && (
        <div className="section">
          <div className="section-header">
            <span className="section-tag">Quasi-Public Entities</span>
            <h2>The Shadow Government</h2>
            <p>Quasi-government organizations operate with public funds but often with less oversight. Here's where the money goes.</p>
          </div>

          {data.quasiPayments ? (
            <>
              <div className="chart-card">
                <h3>Payments to Quasi-Government Entities</h3>
                <div className="chart-subtitle">Aggregated from CTHRU Quasi-Government data</div>
                <ResponsiveContainer width="100%" height={600}>
                  <BarChart data={data.quasiPayments.slice(0, 20)} layout="vertical" margin={{ left: 220 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
                    <XAxis type="number" tickFormatter={formatMoney} stroke="#606078" />
                    <YAxis type="category" dataKey="name" stroke="#606078" width={210} tick={{ fontSize: 11 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="value" fill="#ff6644" radius={[0, 6, 6, 0]} name="Total Payments" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="data-table-wrapper" style={{ marginTop: 24 }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Organization</th>
                      <th>Total Payments</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.quasiPayments.map((q, i) => (
                      <tr key={i}>
                        <td style={{ color: 'var(--text-muted)' }}>{i + 1}</td>
                        <td>{q.name}</td>
                        <td className="money">{formatMoneyFull(q.value)}</td>
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
      )}

      {/* ============ THE AUDIT FIGHT ============ */}
      {activeSection === 'audit' && (
        <div className="section">
          <div className="section-header">
            <span className="section-tag">Democracy in Action</span>
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
                to fight the audit, arguing "separation of powers."
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
                the data that's already public. Every dollar, every vendor, every salary.
                This dashboard is built entirely on publicly available data — and it's just the beginning.
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
              <a href="https://ballotpedia.org/Massachusetts_Question_1,_Authorization_of_State_Auditor_to_Audit_General_Court_Initiative_(2024)" target="_blank" rel="noopener" className="btn-secondary" style={{ padding: '10px 20px', borderRadius: 8, textDecoration: 'none', fontSize: '0.85rem' }}>
                <ExternalLink size={14} /> Question 1 Details
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ============ FOOTER ============ */}
      <footer className="footer">
        <p>
          <strong style={{ color: 'var(--text-primary)' }}>The People's Audit</strong> — A citizen-led transparency project for Massachusetts
        </p>
        <p style={{ marginTop: 8 }}>
          Built on public data from the <a href="https://www.macomptroller.org/cthru/" target="_blank" rel="noopener">CTHRU Portal</a>,{' '}
          <a href="https://massopenbooks.org/" target="_blank" rel="noopener">MassOpenBooks</a>, and{' '}
          <a href="https://www.usaspending.gov/" target="_blank" rel="noopener">USASpending.gov</a>.
        </p>
        <div className="footer-links">
          <a href="https://github.com/duncanburns2013-dot/The-Peoples-Audit" target="_blank" rel="noopener">GitHub Repository</a>
          <a href="https://cthrupayroll.mass.gov/" target="_blank" rel="noopener">CTHRU Payroll</a>
          <a href="https://cthruspending.mass.gov/" target="_blank" rel="noopener">CTHRU Spending</a>
          <a href="https://api.usaspending.gov/" target="_blank" rel="noopener">USASpending API</a>
        </div>
        <p style={{ marginTop: 16, fontSize: '0.75rem' }}>
          72% of Massachusetts voters demanded a legislative audit. This dashboard exists because the Legislature said no.
        </p>
      </footer>
    </>
  );
}
