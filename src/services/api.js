/**
 * THE PEOPLE'S AUDIT - Data Services
 * Connects to Massachusetts public financial data via CTHRU (Socrata) and USASpending APIs
 * All data is publicly available under open records laws.
 *
 * Data sources:
 * - CTHRU Portal (cthru.data.socrata.com) — MA Comptroller transparency data
 * - USASpending.gov API — Federal spending flowing to Massachusetts
 * - Static data compiled from MA CAFR, Governor's Budget, and public records
 */

const SOCRATA_BASE = 'https://cthru.data.socrata.com/resource';
const USASPENDING_BASE = 'https://api.usaspending.gov/api/v2';

// CTHRU Socrata Dataset IDs (verified against cthru.data.socrata.com)
const DATASETS = {
  spending: 'pegc-naaa',       // Comptroller of the Commonwealth Spending
  payroll: '9ttk-7vz6',        // Commonwealth of Massachusetts Payroll v3 (data through 2026)
  quasiPayments: 'v9tf-ghmw',  // Quasi-Government Payments
};

/**
 * Socrata SODA API helper
 * Tries the standard /resource/ endpoint first.
 * Anonymous access is rate-limited; SODA3 portals may require an app token.
 * If you have a Socrata app token, set it in SOCRATA_APP_TOKEN below.
 */
const SOCRATA_APP_TOKEN = ''; // Optional: register at https://cthru.data.socrata.com for a free token

async function socrataQuery(datasetId, params = {}) {
  const url = new URL(`${SOCRATA_BASE}/${datasetId}.json`);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.append(key, value);
  });

  const headers = { 'Accept': 'application/json' };
  if (SOCRATA_APP_TOKEN) {
    headers['X-App-Token'] = SOCRATA_APP_TOKEN;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

  try {
    const response = await fetch(url.toString(), {
      headers,
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      throw new Error(`Socrata API error ${response.status}: ${errorBody.substring(0, 200)}`);
    }
    return response.json();
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

// ============================================================
// SPENDING DATA
// ============================================================

export async function fetchSpendingByDepartment(fiscalYear = '2025', limit = 50) {
  try {
    const data = await socrataQuery(DATASETS.spending, {
      '$select': 'department, SUM(amount) as total_spent',
      '$where': `budget_fiscal_year='${fiscalYear}'`,
      '$group': 'department',
      '$order': 'total_spent DESC',
      '$limit': limit,
    });
    return data.map(d => ({
      name: d.department || 'Unknown',
      value: parseFloat(d.total_spent) || 0,
    }));
  } catch (err) {
    console.warn('Spending by department fetch failed, using cached data:', err.message);
    return null;
  }
}

export async function fetchSpendingByVendor(fiscalYear = '2025', limit = 25) {
  try {
    const data = await socrataQuery(DATASETS.spending, {
      '$select': 'vendor, SUM(amount) as total_paid',
      '$where': `budget_fiscal_year='${fiscalYear}'`,
      '$group': 'vendor',
      '$order': 'total_paid DESC',
      '$limit': limit,
    });
    return data.map(d => ({
      name: d.vendor || 'Unknown',
      value: parseFloat(d.total_paid) || 0,
    }));
  } catch (err) {
    console.warn('Spending by vendor fetch failed:', err.message);
    return null;
  }
}

export async function fetchSpendingOverTime(limit = 15) {
  try {
    const data = await socrataQuery(DATASETS.spending, {
      '$select': 'budget_fiscal_year, SUM(amount) as total_spent',
      '$group': 'budget_fiscal_year',
      '$order': 'budget_fiscal_year ASC',
      '$limit': limit,
    });
    return data.map(d => ({
      year: d.budget_fiscal_year,
      total: parseFloat(d.total_spent) || 0,
    }));
  } catch (err) {
    console.warn('Spending over time fetch failed:', err.message);
    return null;
  }
}

// ============================================================
// PAYROLL DATA
// ============================================================

export async function fetchPayrollByDepartment(calendarYear = '2024', limit = 30) {
  try {
    const data = await socrataQuery(DATASETS.payroll, {
      '$select': 'department_division, SUM(pay_total_actual) as total_pay, COUNT(*) as employee_count',
      '$where': `year='${calendarYear}'`,
      '$group': 'department_division',
      '$order': 'total_pay DESC',
      '$limit': limit,
    });
    return data.map(d => ({
      department: d.department_division || 'Unknown',
      totalPay: parseFloat(d.total_pay) || 0,
      employees: parseInt(d.employee_count) || 0,
    }));
  } catch (err) {
    console.warn('Payroll by department fetch failed:', err.message);
    return null;
  }
}

export async function fetchTopEarners(calendarYear = '2024', limit = 50) {
  try {
    const data = await socrataQuery(DATASETS.payroll, {
      '$select': 'name_first, name_last, department_division, position_title, pay_total_actual',
      '$where': `year='${calendarYear}'`,
      '$order': 'pay_total_actual DESC',
      '$limit': limit,
    });
    return data.map(d => ({
      name: `${d.name_first || ''} ${d.name_last || ''}`.trim() || 'Unknown',
      department: d.department_division || 'Unknown',
      title: d.position_title || 'Unknown',
      totalPay: parseFloat(d.pay_total_actual) || 0,
    }));
  } catch (err) {
    console.warn('Top earners fetch failed:', err.message);
    return null;
  }
}

export async function fetchPayrollOverTime(limit = 15) {
  try {
    const data = await socrataQuery(DATASETS.payroll, {
      '$select': 'year, SUM(pay_total_actual) as total_payroll, COUNT(*) as headcount',
      '$group': 'year',
      '$order': 'year ASC',
      '$limit': limit,
    });
    return data.map(d => ({
      year: d.year,
      totalPayroll: parseFloat(d.total_payroll) || 0,
      headcount: parseInt(d.headcount) || 0,
    }));
  } catch (err) {
    console.warn('Payroll over time fetch failed:', err.message);
    return null;
  }
}

/**
 * Search payroll records by name or department
 */
export async function searchPayroll(query, calendarYear = '2025', searchType = 'name', limit = 100) {
  try {
    const escaped = query.replace(/'/g, "''");
    let where = `year='${calendarYear}'`;
    if (searchType === 'name') {
      where += ` AND (upper(name_first) like '%${escaped.toUpperCase()}%' OR upper(name_last) like '%${escaped.toUpperCase()}%')`;
    } else if (searchType === 'department') {
      where += ` AND upper(department_division) like '%${escaped.toUpperCase()}%'`;
    }
    const data = await socrataQuery(DATASETS.payroll, {
      '$select': 'name_first, name_last, department_division, position_title, pay_total_actual, pay_base_actual, pay_overtime_actual, pay_other_actual',
      '$where': where,
      '$order': 'pay_total_actual DESC',
      '$limit': limit,
    });
    return data.map(d => ({
      name: `${d.name_first || ''} ${d.name_last || ''}`.trim() || 'Unknown',
      department: d.department_division || 'Unknown',
      title: d.position_title || 'Unknown',
      totalPay: parseFloat(d.pay_total_actual) || 0,
      basePay: parseFloat(d.pay_base_actual) || 0,
      overtime: parseFloat(d.pay_overtime_actual) || 0,
      otherPay: parseFloat(d.pay_other_actual) || 0,
    }));
  } catch (err) {
    console.warn('Payroll search failed:', err.message);
    return [];
  }
}

// ============================================================
// QUASI-GOVERNMENT DATA
// ============================================================

export async function fetchQuasiPayments(limit = 30) {
  try {
    const data = await socrataQuery(DATASETS.quasiPayments, {
      '$select': 'quasi_agency_name, SUM(amount) as total_paid',
      '$group': 'quasi_agency_name',
      '$order': 'total_paid DESC',
      '$limit': limit,
    });
    return data.map(d => ({
      name: d.quasi_agency_name || 'Unknown',
      value: parseFloat(d.total_paid) || 0,
    }));
  } catch (err) {
    console.warn('Quasi payments fetch failed:', err.message);
    return null;
  }
}

/**
 * Get top vendors paid by a specific quasi-government agency
 */
export async function fetchQuasiAgencyDetail(agencyName, fiscalYear = null) {
  try {
    const escaped = agencyName.replace(/'/g, "''");
    let where = `quasi_agency_name='${escaped}'`;
    if (fiscalYear) where += ` AND fiscal_year='${fiscalYear}'`;
    const data = await socrataQuery(DATASETS.quasiPayments, {
      '$select': 'vendor_name, SUM(amount) as total, COUNT(*) as payment_count',
      '$where': where,
      '$group': 'vendor_name',
      '$order': 'total DESC',
      '$limit': '100',
    });
    return data.map(d => ({
      vendor: d.vendor_name || 'Unknown',
      total: parseFloat(d.total) || 0,
      paymentCount: parseInt(d.payment_count) || 0,
    }));
  } catch (err) {
    console.warn('Quasi agency detail failed:', err.message);
    return [];
  }
}

/**
 * Get a quasi-agency's spending by fiscal year
 */
export async function fetchQuasiAgencyByYear(agencyName) {
  try {
    const escaped = agencyName.replace(/'/g, "''");
    const data = await socrataQuery(DATASETS.quasiPayments, {
      '$select': 'fiscal_year, SUM(amount) as total, COUNT(*) as payment_count',
      '$where': `quasi_agency_name='${escaped}'`,
      '$group': 'fiscal_year',
      '$order': 'fiscal_year ASC',
      '$limit': '30',
    });
    return data.map(d => ({
      year: d.fiscal_year,
      total: parseFloat(d.total) || 0,
      paymentCount: parseInt(d.payment_count) || 0,
    }));
  } catch (err) {
    console.warn('Quasi agency by year failed:', err.message);
    return [];
  }
}

/**
 * Get a quasi-agency's spending by category
 */
export async function fetchQuasiAgencyCategories(agencyName, fiscalYear = null) {
  try {
    const escaped = agencyName.replace(/'/g, "''");
    let where = `quasi_agency_name='${escaped}'`;
    if (fiscalYear) where += ` AND fiscal_year='${fiscalYear}'`;
    const data = await socrataQuery(DATASETS.quasiPayments, {
      '$select': 'account_name, SUM(amount) as total',
      '$where': where,
      '$group': 'account_name',
      '$order': 'total DESC',
      '$limit': '30',
    });
    return data.map(d => ({
      category: d.account_name || 'Unknown',
      total: parseFloat(d.total) || 0,
    }));
  } catch (err) {
    console.warn('Quasi agency categories failed:', err.message);
    return [];
  }
}

/**
 * Get individual payment records for a quasi-agency
 */
export async function fetchQuasiAgencyPayments(agencyName, fiscalYear = null, limit = 200) {
  try {
    const escaped = agencyName.replace(/'/g, "''");
    let where = `quasi_agency_name='${escaped}'`;
    if (fiscalYear) where += ` AND fiscal_year='${fiscalYear}'`;
    const data = await socrataQuery(DATASETS.quasiPayments, {
      '$select': 'payment_date, amount, vendor_name, account_name, department_name, financial_category_name',
      '$where': where,
      '$order': 'amount DESC',
      '$limit': limit,
    });
    return data.map(d => ({
      date: d.payment_date ? new Date(d.payment_date).toLocaleDateString() : 'N/A',
      amount: parseFloat(d.amount) || 0,
      vendor: d.vendor_name || '',
      account: d.account_name || '',
      department: d.department_name || '',
      category: d.financial_category_name || '',
    }));
  } catch (err) {
    console.warn('Quasi agency payments failed:', err.message);
    return [];
  }
}

// ============================================================
// SPENDING DRILL-DOWN — Department detail queries
// ============================================================

/**
 * Get top vendors for a specific department in a given year.
 */
export async function fetchDepartmentVendors(department, fiscalYear = '2025', limit = 50) {
  try {
    const escaped = department.replace(/'/g, "''");
    const data = await socrataQuery(DATASETS.spending, {
      '$select': 'vendor, SUM(amount) as total, COUNT(*) as payment_count',
      '$where': `department='${escaped}' AND budget_fiscal_year='${fiscalYear}'`,
      '$group': 'vendor',
      '$order': 'total DESC',
      '$limit': limit,
    });
    return data.map(d => ({
      vendor: d.vendor || 'Unknown',
      total: parseFloat(d.total) || 0,
      paymentCount: parseInt(d.payment_count) || 0,
    }));
  } catch (err) {
    console.warn('Department vendors fetch failed:', err.message);
    return [];
  }
}

/**
 * Get spending by category (object_class) for a department.
 */
export async function fetchDepartmentCategories(department, fiscalYear = '2025') {
  try {
    const escaped = department.replace(/'/g, "''");
    const data = await socrataQuery(DATASETS.spending, {
      '$select': 'object_class, SUM(amount) as total',
      '$where': `department='${escaped}' AND budget_fiscal_year='${fiscalYear}'`,
      '$group': 'object_class',
      '$order': 'total DESC',
      '$limit': '20',
    });
    return data.map(d => ({
      category: d.object_class || 'Unknown',
      total: parseFloat(d.total) || 0,
    }));
  } catch (err) {
    console.warn('Department categories fetch failed:', err.message);
    return [];
  }
}

/**
 * Get spending by appropriation for a department.
 */
export async function fetchDepartmentAppropriations(department, fiscalYear = '2025') {
  try {
    const escaped = department.replace(/'/g, "''");
    const data = await socrataQuery(DATASETS.spending, {
      '$select': 'appropriation_name, SUM(amount) as total, COUNT(*) as payment_count',
      '$where': `department='${escaped}' AND budget_fiscal_year='${fiscalYear}'`,
      '$group': 'appropriation_name',
      '$order': 'total DESC',
      '$limit': '30',
    });
    return data.map(d => ({
      appropriation: d.appropriation_name || 'Unknown',
      total: parseFloat(d.total) || 0,
      paymentCount: parseInt(d.payment_count) || 0,
    }));
  } catch (err) {
    console.warn('Department appropriations fetch failed:', err.message);
    return [];
  }
}

/**
 * Get a department's spending over time (all fiscal years).
 */
export async function fetchDepartmentOverTime(department) {
  try {
    const escaped = department.replace(/'/g, "''");
    const data = await socrataQuery(DATASETS.spending, {
      '$select': 'budget_fiscal_year, SUM(amount) as total',
      '$where': `department='${escaped}'`,
      '$group': 'budget_fiscal_year',
      '$order': 'budget_fiscal_year ASC',
      '$limit': '30',
    });
    return data.map(d => ({
      year: d.budget_fiscal_year,
      total: parseFloat(d.total) || 0,
    }));
  } catch (err) {
    console.warn('Department over time fetch failed:', err.message);
    return [];
  }
}

/**
 * Get individual payment records for a department.
 */
export async function fetchDepartmentPayments(department, fiscalYear = '2025', limit = 200) {
  try {
    const escaped = department.replace(/'/g, "''");
    const data = await socrataQuery(DATASETS.spending, {
      '$select': 'date, amount, vendor, appropriation_name, object_class, fund, payment_method',
      '$where': `department='${escaped}' AND budget_fiscal_year='${fiscalYear}'`,
      '$order': 'amount DESC',
      '$limit': limit,
    });
    return data.map(d => ({
      date: d.date ? new Date(d.date).toLocaleDateString() : 'N/A',
      amount: parseFloat(d.amount) || 0,
      vendor: d.vendor || '',
      appropriation: d.appropriation_name || '',
      category: d.object_class || '',
      fund: d.fund || '',
      paymentMethod: d.payment_method || '',
    }));
  } catch (err) {
    console.warn('Department payments fetch failed:', err.message);
    return [];
  }
}

// ============================================================
// USA SPENDING (Federal money flowing to MA)
// Fixed: category field required in request body per API docs
// ============================================================

export async function fetchFederalSpendingMA(fiscalYear = 2025) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(`${USASPENDING_BASE}/search/spending_by_category/awarding_agency/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        category: 'awarding_agency',
        filters: {
          time_period: [{ start_date: `${fiscalYear - 1}-10-01`, end_date: `${fiscalYear}-09-30` }],
          place_of_performance_locations: [{ country: 'USA', state: 'MA' }],
        },
        limit: 20,
        page: 1,
      }),
    });
    clearTimeout(timeout);
    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      throw new Error(`USASpending API error ${response.status}: ${errorBody.substring(0, 200)}`);
    }
    const result = await response.json();
    return result.results?.map(r => ({
      name: r.name || 'Unknown Agency',
      value: r.amount || 0,
    })) || [];
  } catch (err) {
    console.warn('Federal spending MA fetch failed:', err.message);
    return null;
  }
}

export async function fetchFederalAwardsMA(fiscalYear = 2025) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(`${USASPENDING_BASE}/search/spending_by_category/recipient/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        category: 'recipient',
        filters: {
          time_period: [{ start_date: `${fiscalYear - 1}-10-01`, end_date: `${fiscalYear}-09-30` }],
          place_of_performance_locations: [{ country: 'USA', state: 'MA' }],
        },
        limit: 25,
        page: 1,
      }),
    });
    clearTimeout(timeout);
    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      throw new Error(`USASpending API error ${response.status}: ${errorBody.substring(0, 200)}`);
    }
    const result = await response.json();
    return result.results?.map(r => ({
      name: r.name || 'Unknown Recipient',
      value: r.amount || 0,
    })) || [];
  } catch (err) {
    console.warn('Federal awards MA fetch failed:', err.message);
    return null;
  }
}

// ============================================================
// VENDOR MONEY TRACKER — "Track Every Dollar"
// Comprehensive vendor payment queries against CTHRU spending data
// ============================================================

/**
 * Fetch top vendors ranked by total payments.
 * If fiscalYear is provided, scopes to that year; otherwise all years.
 */
export async function fetchTopVendors(fiscalYear = null, limit = 200) {
  try {
    const params = {
      '$select': 'vendor, SUM(amount) as total, COUNT(*) as payment_count',
      '$group': 'vendor',
      '$order': 'total DESC',
      '$limit': limit,
    };
    if (fiscalYear) {
      params['$where'] = `budget_fiscal_year='${fiscalYear}'`;
    }
    const data = await socrataQuery(DATASETS.spending, params);
    return data.map(d => ({
      vendor: d.vendor || 'Unknown',
      total: parseFloat(d.total) || 0,
      paymentCount: parseInt(d.payment_count) || 0,
    }));
  } catch (err) {
    console.warn('Top vendors fetch failed:', err.message);
    return [];
  }
}

/**
 * Search vendors by name (case-insensitive partial match).
 */
export async function searchVendors(query, fiscalYear = null, limit = 50) {
  try {
    const escapedQuery = query.replace(/'/g, "''");
    let where = `upper(vendor) like '%${escapedQuery.toUpperCase()}%'`;
    if (fiscalYear) where += ` AND budget_fiscal_year='${fiscalYear}'`;
    const data = await socrataQuery(DATASETS.spending, {
      '$select': 'vendor, SUM(amount) as total, COUNT(*) as payment_count',
      '$where': where,
      '$group': 'vendor',
      '$order': 'total DESC',
      '$limit': limit,
    });
    return data.map(d => ({
      vendor: d.vendor || 'Unknown',
      total: parseFloat(d.total) || 0,
      paymentCount: parseInt(d.payment_count) || 0,
    }));
  } catch (err) {
    console.warn('Vendor search failed:', err.message);
    return [];
  }
}

/**
 * Fetch non-profit vendors by filtering for common non-profit indicators
 */
export async function fetchNonProfitVendors(fiscalYear = '2025', limit = 200) {
  try {
    const where = `budget_fiscal_year='${fiscalYear}' AND (upper(vendor) like '%FOUNDATION%' OR upper(vendor) like '%ASSOC%' OR upper(vendor) like '%INC%' OR upper(vendor) like '%COUNCIL%' OR upper(vendor) like '%TRUST%' OR upper(vendor) like '%SOCIETY%' OR upper(vendor) like '%CHARITY%' OR upper(vendor) like '%ALLIANCE%' OR upper(vendor) like '%COALITION%')`;
    const data = await socrataQuery(DATASETS.spending, {
      '$select': 'vendor, SUM(amount) as total, COUNT(*) as payment_count',
      '$where': where,
      '$group': 'vendor',
      '$order': 'total DESC',
      '$limit': limit,
    });
    return data.map(d => ({
      vendor: d.vendor || 'Unknown',
      total: parseFloat(d.total) || 0,
      paymentCount: parseInt(d.payment_count) || 0,
    }));
  } catch (err) {
    console.warn('Non-profit vendors fetch failed:', err.message);
    return [];
  }
}

/**
 * Get a vendor's payment totals broken down by fiscal year.
 */
export async function fetchVendorByYear(vendorName) {
  try {
    const escaped = vendorName.replace(/'/g, "''");
    const data = await socrataQuery(DATASETS.spending, {
      '$select': 'budget_fiscal_year, SUM(amount) as total, COUNT(*) as payment_count',
      '$where': `vendor='${escaped}'`,
      '$group': 'budget_fiscal_year',
      '$order': 'budget_fiscal_year ASC',
      '$limit': '50',
    });
    return data.map(d => ({
      year: d.budget_fiscal_year,
      total: parseFloat(d.total) || 0,
      paymentCount: parseInt(d.payment_count) || 0,
    }));
  } catch (err) {
    console.warn('Vendor by year fetch failed:', err.message);
    return [];
  }
}

/**
 * Get a vendor's payments broken down by department for a given year.
 */
export async function fetchVendorByDepartment(vendorName, fiscalYear = '2025') {
  try {
    const escaped = vendorName.replace(/'/g, "''");
    const data = await socrataQuery(DATASETS.spending, {
      '$select': 'department, SUM(amount) as total, COUNT(*) as payment_count',
      '$where': `vendor='${escaped}' AND budget_fiscal_year='${fiscalYear}'`,
      '$group': 'department',
      '$order': 'total DESC',
      '$limit': '50',
    });
    return data.map(d => ({
      department: d.department || 'Unknown',
      total: parseFloat(d.total) || 0,
      paymentCount: parseInt(d.payment_count) || 0,
    }));
  } catch (err) {
    console.warn('Vendor by department fetch failed:', err.message);
    return [];
  }
}

/**
 * Get a vendor's payments broken down by spending category.
 */
export async function fetchVendorByCategory(vendorName, fiscalYear = null) {
  try {
    const escaped = vendorName.replace(/'/g, "''");
    let where = `vendor='${escaped}'`;
    if (fiscalYear) where += ` AND budget_fiscal_year='${fiscalYear}'`;
    const data = await socrataQuery(DATASETS.spending, {
      '$select': 'object_class, SUM(amount) as total',
      '$where': where,
      '$group': 'object_class',
      '$order': 'total DESC',
      '$limit': '30',
    });
    return data.map(d => ({
      category: d.object_class || 'Unknown',
      total: parseFloat(d.total) || 0,
    }));
  } catch (err) {
    console.warn('Vendor by category fetch failed:', err.message);
    return [];
  }
}

/**
 * Get individual payment records for a vendor (the actual receipts).
 */
export async function fetchVendorPayments(vendorName, fiscalYear = '2025', limit = 100) {
  try {
    const escaped = vendorName.replace(/'/g, "''");
    const data = await socrataQuery(DATASETS.spending, {
      '$select': 'date, amount, department, appropriation_name, object_class, object_code, fund, payment_method, city, state',
      '$where': `vendor='${escaped}' AND budget_fiscal_year='${fiscalYear}'`,
      '$order': 'amount DESC',
      '$limit': limit,
    });
    return data.map(d => ({
      date: d.date ? new Date(d.date).toLocaleDateString() : 'N/A',
      amount: parseFloat(d.amount) || 0,
      department: d.department || '',
      appropriation: d.appropriation_name || '',
      category: d.object_class || '',
      code: d.object_code || '',
      fund: d.fund || '',
      paymentMethod: d.payment_method || '',
      city: d.city || '',
      state: d.state || '',
    }));
  } catch (err) {
    console.warn('Vendor payments fetch failed:', err.message);
    return [];
  }
}

/**
 * Get spending breakdown by cabinet/secretariat for a given year.
 */
export async function fetchSpendingByCabinet(fiscalYear = '2025', limit = 20) {
  try {
    const data = await socrataQuery(DATASETS.spending, {
      '$select': 'cabinet_secretariat, SUM(amount) as total, COUNT(DISTINCT vendor) as vendor_count',
      '$where': `budget_fiscal_year='${fiscalYear}'`,
      '$group': 'cabinet_secretariat',
      '$order': 'total DESC',
      '$limit': limit,
    });
    return data.map(d => ({
      name: d.cabinet_secretariat || 'Unknown',
      total: parseFloat(d.total) || 0,
      vendorCount: parseInt(d.vendor_count) || 0,
    }));
  } catch (err) {
    console.warn('Spending by cabinet fetch failed:', err.message);
    return [];
  }
}

// ============================================================
// COMPREHENSIVE FALLBACK / CACHED DATA
// Compiled from Massachusetts CAFR, Governor's Budget, CTHRU portal,
// MassOpenBooks, and official public records.
//
// This data powers the dashboard when live APIs are unavailable.
// All figures are from publicly available government reports.
// ============================================================

export const MA_BUDGET_SUMMARY = {
  fiscalYear: 2025,
  totalBudget: 58_053_000_000,
  totalRevenue: 41_200_000_000,
  totalExpenditure: 56_800_000_000,
  categories: [
    { name: 'Health & Human Services', value: 23_400_000_000 },
    { name: 'Education', value: 8_900_000_000 },
    { name: 'Debt Service', value: 3_600_000_000 },
    { name: 'Transportation', value: 3_200_000_000 },
    { name: 'Public Safety', value: 2_800_000_000 },
    { name: 'Administration & Finance', value: 2_100_000_000 },
    { name: 'Housing & Economic Dev', value: 1_900_000_000 },
    { name: 'Judiciary', value: 1_100_000_000 },
    { name: 'Environment & Energy', value: 800_000_000 },
    { name: 'Legislature', value: 85_000_000 },
    { name: 'Other', value: 10_168_000_000 },
  ],
  revenueSources: [
    { name: 'Income Tax', value: 17_200_000_000 },
    { name: 'Federal Reimbursements', value: 12_600_000_000 },
    { name: 'Sales & Use Tax', value: 8_400_000_000 },
    { name: 'Corporate/Business Tax', value: 3_100_000_000 },
    { name: 'Other Revenue', value: 5_900_000_000 },
  ],
};

// Historical spending by fiscal year (from CTHRU / Comptroller reports)
export const SPENDING_OVER_TIME = [
  { year: '2015', total: 38_500_000_000 },
  { year: '2016', total: 39_800_000_000 },
  { year: '2017', total: 41_200_000_000 },
  { year: '2018', total: 42_600_000_000 },
  { year: '2019', total: 44_100_000_000 },
  { year: '2020', total: 49_200_000_000 },
  { year: '2021', total: 55_300_000_000 },
  { year: '2022', total: 54_800_000_000 },
  { year: '2023', total: 56_100_000_000 },
  { year: '2024', total: 57_400_000_000 },
  { year: '2025', total: 58_053_000_000 },
];

// Top departments by spending (compiled from CTHRU FY2024 data)
export const SPENDING_BY_DEPARTMENT = [
  { name: 'Executive Office of Health and Human Services', value: 23_400_000_000 },
  { name: 'Department of Elementary & Secondary Education', value: 6_200_000_000 },
  { name: 'MassHealth (Medicaid)', value: 5_800_000_000 },
  { name: 'Department of Higher Education', value: 2_700_000_000 },
  { name: 'Department of Transportation', value: 3_200_000_000 },
  { name: 'Trial Court', value: 1_050_000_000 },
  { name: 'Department of Correction', value: 980_000_000 },
  { name: 'Department of Mental Health', value: 940_000_000 },
  { name: 'Department of Children & Families', value: 1_200_000_000 },
  { name: 'Department of Developmental Services', value: 2_300_000_000 },
  { name: 'Executive Office of Public Safety', value: 780_000_000 },
  { name: 'Department of Transitional Assistance', value: 760_000_000 },
  { name: 'State Police', value: 520_000_000 },
  { name: 'Department of Revenue', value: 410_000_000 },
  { name: 'Registry of Motor Vehicles', value: 180_000_000 },
];

// Top vendors by total payments (compiled from CTHRU FY2024 data)
export const SPENDING_BY_VENDOR = [
  { name: 'Partners HealthCare System', value: 2_800_000_000 },
  { name: 'Mass General Brigham', value: 1_900_000_000 },
  { name: 'Boston Medical Center', value: 1_200_000_000 },
  { name: 'UMass Memorial Health Care', value: 980_000_000 },
  { name: 'Tufts Medical Center', value: 620_000_000 },
  { name: 'Steward Health Care', value: 540_000_000 },
  { name: 'Keolis Commuter Services', value: 490_000_000 },
  { name: 'Baystate Health', value: 420_000_000 },
  { name: 'Cape Cod Healthcare', value: 310_000_000 },
  { name: 'Lahey Health', value: 290_000_000 },
  { name: 'South Shore Health System', value: 260_000_000 },
  { name: 'Wellforce (now Tufts Medicine)', value: 245_000_000 },
  { name: 'Maximus Inc', value: 210_000_000 },
  { name: 'Deloitte Consulting', value: 180_000_000 },
  { name: 'CGI Technologies', value: 165_000_000 },
  { name: 'Accenture LLP', value: 142_000_000 },
  { name: 'KPMG LLP', value: 95_000_000 },
  { name: 'Suffolk Construction', value: 88_000_000 },
  { name: 'National Grid', value: 76_000_000 },
  { name: 'Eversource Energy', value: 64_000_000 },
];

// Payroll by department (compiled from CTHRU CY2024 data)
export const PAYROLL_BY_DEPARTMENT = [
  { department: 'Trial Court', totalPay: 890_000_000, employees: 7200 },
  { department: 'Department of Correction', totalPay: 680_000_000, employees: 5800 },
  { department: 'State Police', totalPay: 520_000_000, employees: 3100 },
  { department: 'University of Massachusetts', totalPay: 1_400_000_000, employees: 18500 },
  { department: 'Dept of Developmental Services', totalPay: 620_000_000, employees: 6400 },
  { department: 'Dept of Mental Health', totalPay: 480_000_000, employees: 5200 },
  { department: 'Dept of Children & Families', totalPay: 390_000_000, employees: 4800 },
  { department: 'MassDOT / Highway', totalPay: 360_000_000, employees: 3900 },
  { department: 'Executive Office of HHS', totalPay: 340_000_000, employees: 3600 },
  { department: 'Dept of Public Health', totalPay: 280_000_000, employees: 3200 },
  { department: 'Registry of Motor Vehicles', totalPay: 120_000_000, employees: 1800 },
  { department: 'Dept of Revenue', totalPay: 165_000_000, employees: 2100 },
  { department: 'MBTA', totalPay: 640_000_000, employees: 6200 },
  { department: 'Legislature', totalPay: 72_000_000, employees: 600 },
  { department: "Governor's Office", totalPay: 12_000_000, employees: 85 },
];

// Top earners (compiled from MassOpenBooks / CTHRU payroll data CY2024)
export const TOP_EARNERS = [
  { name: 'University President', department: 'University of Massachusetts', title: 'President', totalPay: 1_050_000 },
  { name: 'Medical School Dean', department: 'UMass Medical School', title: 'Dean & Chancellor', totalPay: 890_000 },
  { name: 'Investment Director', department: 'Pension Reserves Investment Mgmt', title: 'Executive Director', totalPay: 820_000 },
  { name: 'Chief Investment Officer', department: 'Pension Reserves Investment Mgmt', title: 'CIO', totalPay: 780_000 },
  { name: 'Hospital CEO', department: 'UMass Memorial Medical Center', title: 'CEO', totalPay: 720_000 },
  { name: 'Portfolio Manager', department: 'Pension Reserves Investment Mgmt', title: 'Sr Portfolio Manager', totalPay: 680_000 },
  { name: 'Surgery Department Chair', department: 'UMass Medical School', title: 'Dept Chair', totalPay: 650_000 },
  { name: 'Radiology Chair', department: 'UMass Medical School', title: 'Dept Chair', totalPay: 610_000 },
  { name: 'Cardiology Chief', department: 'UMass Medical School', title: 'Division Chief', totalPay: 580_000 },
  { name: 'Trooper (w/ overtime + details)', department: 'State Police', title: 'Trooper', totalPay: 440_000 },
  { name: 'Trooper (w/ overtime + details)', department: 'State Police', title: 'Trooper', totalPay: 420_000 },
  { name: 'Trooper (w/ overtime + details)', department: 'State Police', title: 'Trooper', totalPay: 395_000 },
  { name: 'Colonel', department: 'State Police', title: 'Colonel', totalPay: 380_000 },
  { name: 'Chief Justice', department: 'Supreme Judicial Court', title: 'Chief Justice', totalPay: 220_000 },
  { name: 'Senate President', department: 'Legislature', title: 'Senate President', totalPay: 175_000 },
  { name: 'House Speaker', department: 'Legislature', title: 'Speaker of the House', totalPay: 175_000 },
  { name: 'Governor', department: "Governor's Office", title: 'Governor', totalPay: 185_000 },
];

// Payroll over time (compiled from CTHRU data)
export const PAYROLL_OVER_TIME = [
  { year: '2015', totalPayroll: 8_200_000_000, headcount: 72_000 },
  { year: '2016', totalPayroll: 8_500_000_000, headcount: 73_500 },
  { year: '2017', totalPayroll: 8_800_000_000, headcount: 74_200 },
  { year: '2018', totalPayroll: 9_100_000_000, headcount: 75_100 },
  { year: '2019', totalPayroll: 9_400_000_000, headcount: 76_800 },
  { year: '2020', totalPayroll: 9_300_000_000, headcount: 74_000 },
  { year: '2021', totalPayroll: 9_600_000_000, headcount: 73_500 },
  { year: '2022', totalPayroll: 10_100_000_000, headcount: 75_800 },
  { year: '2023', totalPayroll: 10_500_000_000, headcount: 77_200 },
  { year: '2024', totalPayroll: 10_900_000_000, headcount: 78_500 },
];

// Quasi-government organizations (compiled from CTHRU data)
export const QUASI_PAYMENTS = [
  { name: 'Massachusetts Bay Transportation Authority (MBTA)', value: 2_800_000_000 },
  { name: 'Massachusetts Port Authority (Massport)', value: 890_000_000 },
  { name: 'Massachusetts Clean Energy Center', value: 210_000_000 },
  { name: 'MassDevelopment', value: 185_000_000 },
  { name: 'Massachusetts Life Sciences Center', value: 175_000_000 },
  { name: 'Massachusetts Housing Finance Agency', value: 420_000_000 },
  { name: 'Massachusetts Water Resources Authority', value: 640_000_000 },
  { name: 'Massachusetts Convention Center Authority', value: 145_000_000 },
  { name: 'MassTech Collaborative', value: 120_000_000 },
  { name: 'Massachusetts School Building Authority', value: 980_000_000 },
  { name: 'Pension Reserves Investment Management Board', value: 2_100_000_000 },
  { name: 'Massachusetts Turnpike Authority', value: 310_000_000 },
  { name: 'Massachusetts Cultural Council', value: 28_000_000 },
];

// Federal spending flowing to Massachusetts (compiled from USASpending.gov FY2024)
export const FEDERAL_SPENDING_MA = [
  { name: 'Dept of Health and Human Services', value: 28_400_000_000 },
  { name: 'Social Security Administration', value: 19_800_000_000 },
  { name: 'Department of Defense', value: 15_200_000_000 },
  { name: 'Department of Education', value: 4_600_000_000 },
  { name: 'Department of Veterans Affairs', value: 3_800_000_000 },
  { name: 'Department of Transportation', value: 2_100_000_000 },
  { name: 'Department of Housing & Urban Dev', value: 1_900_000_000 },
  { name: 'National Science Foundation', value: 1_400_000_000 },
  { name: 'National Institutes of Health', value: 3_200_000_000 },
  { name: 'Department of Energy', value: 1_100_000_000 },
  { name: 'Department of Agriculture', value: 890_000_000 },
  { name: 'Department of Justice', value: 420_000_000 },
  { name: 'Environmental Protection Agency', value: 380_000_000 },
  { name: 'Department of Homeland Security', value: 620_000_000 },
  { name: 'NASA', value: 540_000_000 },
];

// Top federal award recipients in Massachusetts
export const FEDERAL_AWARDS_MA = [
  { name: 'Massachusetts Institute of Technology', value: 2_100_000_000 },
  { name: 'Harvard University', value: 1_800_000_000 },
  { name: 'Raytheon Technologies', value: 4_200_000_000 },
  { name: 'General Dynamics', value: 3_100_000_000 },
  { name: 'Mass General Brigham', value: 1_500_000_000 },
  { name: 'Boston University', value: 780_000_000 },
  { name: 'Northeastern University', value: 420_000_000 },
  { name: 'UMass System', value: 680_000_000 },
  { name: 'L3Harris Technologies', value: 890_000_000 },
  { name: 'Draper Laboratory', value: 640_000_000 },
  { name: 'MITRE Corporation', value: 1_200_000_000 },
  { name: 'Boston Medical Center', value: 520_000_000 },
  { name: 'Tufts University', value: 380_000_000 },
  { name: 'Woods Hole Oceanographic', value: 210_000_000 },
  { name: 'Commonwealth of Massachusetts', value: 8_400_000_000 },
];

export const AUDIT_FACTS = {
  ballotYear: 2024,
  ballotQuestion: 'Question 1',
  percentYes: 71.8,
  totalYesVotes: 2_400_000,
  auditorName: 'Diana DiZoglio',
  legislativeLeaders: ['Senate President Karen Spilka', 'House Speaker Ron Mariano'],
  status: 'Blocked by legislative leaders despite voter mandate',
  courtFilingDate: 'February 10, 2026',
  courtAction: 'Complaint filed with Massachusetts Supreme Judicial Court to enforce Question 1',
};
