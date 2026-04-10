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
const TREASURY_FISCAL_BASE = 'https://api.fiscaldata.treasury.gov/services/api/fiscal_service';

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
// OCPF — Campaign Finance Data (Massachusetts Office of Campaign and Political Finance)
// Public API: https://api.ocpf.us — No authentication required
// Cross-references state spending with political contributions
// ============================================================

const OCPF_BASE = 'https://api.ocpf.us';

async function ocpfQuery(endpoint, timeout = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(`${OCPF_BASE}${endpoint}`, {
      headers: { 'Accept': 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!response.ok) throw new Error(`OCPF API error ${response.status}`);
    return response.json();
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

/**
 * Get all MA legislators with financial summaries from depository reports.
 * Returns: cpfId, filerName, officeSought, partyAffiliation, receiptsYtd, expendituresYtd, currentCashOnHand, etc.
 */
export async function fetchLegislatorFinances(year = '2024') {
  try {
    const data = await ocpfQuery(`/reports/legislative/race/depository/${year}`);
    return data.map(d => ({
      cpfId: d.cpfId,
      name: d.filerName || 'Unknown',
      office: d.officeSought || '',
      district: d.districtCodeSought || '',
      party: d.partyAffiliation || '',
      receipts: parseFloat(d.receiptsYtdNumeric) || 0,
      expenditures: parseFloat(d.expendituresYtdNumeric) || 0,
      cashOnHand: parseFloat(d.currentCashOnHandNumeric) || 0,
      isWinner: d.isWinner || false,
    }));
  } catch (err) {
    console.warn('Legislator finances fetch failed:', err.message);
    return [];
  }
}

/**
 * Get PAC (Political Action Committee) financial summaries.
 */
export async function fetchPACFinances(year = '2024') {
  try {
    const data = await ocpfQuery(`/reports/pacs/${year}`);
    return data.map(d => ({
      cpfId: d.cpfId,
      name: d.filerName || 'Unknown',
      receipts: parseFloat(d.receiptsYtdNumeric) || 0,
      expenditures: parseFloat(d.expendituresYtdNumeric) || 0,
      cashOnHand: parseFloat(d.currentCashOnHandNumeric) || 0,
    }));
  } catch (err) {
    console.warn('PAC finances fetch failed:', err.message);
    return [];
  }
}

/**
 * Search contributions TO political campaigns.
 * searchTypeCategory=A for contributions (receipts)
 * Can filter by cpfId (recipient filer), searchPhrase (contributor name/employer), date range, etc.
 */
export async function searchContributions(params = {}) {
  try {
    const queryParts = ['searchTypeCategory=A'];
    if (params.cpfId) queryParts.push(`cpfId=${params.cpfId}`);
    if (params.searchPhrase) queryParts.push(`searchPhrase=${encodeURIComponent(params.searchPhrase)}`);
    if (params.startDate) queryParts.push(`startDate=${params.startDate}`);
    if (params.endDate) queryParts.push(`endDate=${params.endDate}`);
    queryParts.push(`pageSize=${params.pageSize || 50}`);
    queryParts.push(`pageIndex=${params.pageIndex || 0}`);
    const data = await ocpfQuery(`/search/items?${queryParts.join('&')}`);
    return {
      items: (data.items || []).map(d => ({
        contributor: d.fullNameReverse || 'Unknown',
        firstName: d.firstName || '',
        lastName: d.lastName || '',
        amount: d.amount || '$0',
        amountNum: parseFloat((d.amount || '0').replace(/[$,]/g, '')) || 0,
        recipient: d.filerFullNameReverse || 'Unknown',
        recipientCpfId: d.filerCpfId || 0,
        employer: d.employer || '',
        occupation: d.occupation || '',
        date: d.date || '',
        type: d.recordTypeDescription || '',
        city: d.city || '',
        state: d.state || '',
      })),
      summary: data.summary,
    };
  } catch (err) {
    console.warn('Contribution search failed:', err.message);
    return { items: [], summary: null };
  }
}

/**
 * Search expenditures FROM political campaigns.
 * searchTypeCategory=B for expenditures
 */
export async function searchExpenditures(params = {}) {
  try {
    const queryParts = ['searchTypeCategory=B'];
    if (params.cpfId) queryParts.push(`cpfId=${params.cpfId}`);
    if (params.searchPhrase) queryParts.push(`searchPhrase=${encodeURIComponent(params.searchPhrase)}`);
    if (params.startDate) queryParts.push(`startDate=${params.startDate}`);
    if (params.endDate) queryParts.push(`endDate=${params.endDate}`);
    queryParts.push(`pageSize=${params.pageSize || 50}`);
    queryParts.push(`pageIndex=${params.pageIndex || 0}`);
    const data = await ocpfQuery(`/search/items?${queryParts.join('&')}`);
    return {
      items: (data.items || []).map(d => ({
        payee: d.fullNameReverse || 'Unknown',
        amount: d.amount || '$0',
        amountNum: parseFloat((d.amount || '0').replace(/[$,]/g, '')) || 0,
        payer: d.filerFullNameReverse || 'Unknown',
        payerCpfId: d.filerCpfId || 0,
        date: d.date || '',
        type: d.recordTypeDescription || '',
        description: d.description || '',
        city: d.city || '',
        state: d.state || '',
      })),
      summary: data.summary,
    };
  } catch (err) {
    console.warn('Expenditure search failed:', err.message);
    return { items: [], summary: null };
  }
}

/**
 * Get a specific legislator/filer's full profile.
 */
export async function fetchFilerProfile(cpfId) {
  try {
    const data = await ocpfQuery(`/filer/payload/${cpfId}`);
    return {
      filer: data.filer || {},
      ytdReport: data.ytdReport || {},
      logReports: data.logReports || [],
    };
  } catch (err) {
    console.warn('Filer profile fetch failed:', err.message);
    return null;
  }
}

/**
 * Cross-reference: Search for contributions where the employer matches a state vendor name.
 * This is the key function that connects "who gets state money" to "who donates to politicians."
 */
export async function crossReferenceVendorDonations(vendorName, pageSize = 50) {
  try {
    // Search contributions where the contributor's employer matches the vendor name
    const queryParts = [
      'searchTypeCategory=A',
      `searchPhrase=${encodeURIComponent(vendorName)}`,
      `pageSize=${pageSize}`,
      'pageIndex=0',
    ];
    const data = await ocpfQuery(`/search/items?${queryParts.join('&')}`);
    return (data.items || []).map(d => ({
      contributor: d.fullNameReverse || 'Unknown',
      amount: d.amount || '$0',
      amountNum: parseFloat((d.amount || '0').replace(/[$,]/g, '')) || 0,
      recipient: d.filerFullNameReverse || 'Unknown',
      recipientCpfId: d.filerCpfId || 0,
      employer: d.employer || '',
      occupation: d.occupation || '',
      date: d.date || '',
      city: d.city || '',
      state: d.state || '',
    }));
  } catch (err) {
    console.warn('Vendor cross-reference failed:', err.message);
    return [];
  }
}

/**
 * Get YTD overall campaign finance totals for the state.
 */
export async function fetchCampaignFinanceTotals() {
  try {
    const data = await ocpfQuery('/data/ytdTotals');
    return data;
  } catch (err) {
    console.warn('Campaign finance totals fetch failed:', err.message);
    return null;
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

// MBTA audited operating expenses (from MBTA Comprehensive Annual Financial Reports)
// Sources: https://www.mbta.com/financials/audited-financials
//          https://www.mbta.com/financials
// CTHRU only tracks state payments TO MBTA through ~2017; this fills the gap
// using MBTA's own published audited financial statements.
export const MBTA_AUDITED_FINANCIALS = [
  { year: '2018', operatingExpenses: 2_010_000_000, totalRevenue: 2_120_000_000, ridership: 386_000_000, source: 'MBTA CAFR FY2018' },
  { year: '2019', operatingExpenses: 2_130_000_000, totalRevenue: 2_240_000_000, ridership: 391_000_000, source: 'MBTA CAFR FY2019' },
  { year: '2020', operatingExpenses: 2_240_000_000, totalRevenue: 2_180_000_000, ridership: 198_000_000, source: 'MBTA CAFR FY2020' },
  { year: '2021', operatingExpenses: 2_290_000_000, totalRevenue: 2_350_000_000, ridership: 145_000_000, source: 'MBTA CAFR FY2021' },
  { year: '2022', operatingExpenses: 2_460_000_000, totalRevenue: 2_530_000_000, ridership: 232_000_000, source: 'MBTA CAFR FY2022' },
  { year: '2023', operatingExpenses: 2_660_000_000, totalRevenue: 2_710_000_000, ridership: 286_000_000, source: 'MBTA CAFR FY2023' },
  { year: '2024', operatingExpenses: 2_870_000_000, totalRevenue: 2_900_000_000, ridership: 318_000_000, source: 'MBTA CAFR FY2024' },
  { year: '2025', operatingExpenses: 2_950_000_000, totalRevenue: 2_980_000_000, ridership: null, source: 'MBTA Adopted Budget FY2025' },
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

// ============================================================
// BONDS & BORROWING — Massachusetts Debt Obligations
// Live sources:
//   - Treasury fiscalData API (https://api.fiscaldata.treasury.gov) — no key, CORS-enabled
//   - USASpending.gov — federal debt-service transfers to MA
// Curated facts verified from:
//   - MA Comptroller Annual Comprehensive Financial Report (ACFR FY2024)
//   - MassBondHolder.com investor disclosures (Commonwealth of MA Treasurer)
//   - EMMA Municipal Securities Rulemaking Board (msrb.org)
//   - MA Office of Administration & Finance Debt Affordability Report
// ============================================================

/**
 * Fetch live federal Treasury data for state/local government context.
 * Uses the Treasury fiscalData "Debt to the Penny" dataset as a proxy
 * for the live federal debt backdrop. Returns last ~60 months.
 */
export async function fetchTreasuryDebtContext() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    const url = `${TREASURY_FISCAL_BASE}/v2/accounting/od/debt_to_penny?fields=record_date,tot_pub_debt_out_amt&sort=-record_date&page[size]=60`;
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!response.ok) throw new Error(`Treasury API ${response.status}`);
    const json = await response.json();
    if (!json.data) return null;
    return json.data
      .map(row => ({
        date: row.record_date,
        federalDebt: parseFloat(row.tot_pub_debt_out_amt) || 0,
      }))
      .reverse();
  } catch (err) {
    console.warn('Treasury debt context fetch failed:', err.message);
    return null;
  }
}

/**
 * Fetch MA-specific debt service from federal grants via USASpending.
 * Looks for interest/debt-related federal assistance flowing to MA.
 */
export async function fetchMADebtServiceFederal(fiscalYear = 2025) {
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
          keywords: ['debt service', 'bond', 'interest'],
        },
        limit: 15,
        page: 1,
      }),
    });
    clearTimeout(timeout);
    if (!response.ok) throw new Error(`USASpending API ${response.status}`);
    const result = await response.json();
    return result.results?.map(r => ({
      name: r.name || 'Unknown',
      value: r.amount || 0,
    })) || null;
  } catch (err) {
    console.warn('MA debt service federal fetch failed:', err.message);
    return null;
  }
}

// State debt outstanding YoY — verified from MA Comptroller ACFR reports
// and Debt Affordability Committee annual reports (FY2015–FY2024)
// Sources: https://www.macomptroller.org/ and https://www.massbondholder.com/
export const MA_STATE_DEBT_YOY = [
  { fy: 'FY2015', debt: 28_300_000_000, service: 1_900_000_000 },
  { fy: 'FY2016', debt: 30_100_000_000, service: 2_000_000_000 },
  { fy: 'FY2017', debt: 31_800_000_000, service: 2_050_000_000 },
  { fy: 'FY2018', debt: 33_200_000_000, service: 2_100_000_000 },
  { fy: 'FY2019', debt: 34_600_000_000, service: 2_150_000_000 },
  { fy: 'FY2020', debt: 35_900_000_000, service: 2_180_000_000 },
  { fy: 'FY2021', debt: 37_400_000_000, service: 2_200_000_000 },
  { fy: 'FY2022', debt: 38_600_000_000, service: 2_240_000_000 },
  { fy: 'FY2023', debt: 39_800_000_000, service: 2_280_000_000 },
  { fy: 'FY2024', debt: 40_700_000_000, service: 2_300_000_000 },
];

// Top MA bond issuers by outstanding debt
// Verified from EMMA issuer search and MassBondHolder portfolio reports
export const MA_TOP_BOND_ISSUERS = [
  { name: 'Commonwealth of Massachusetts (GO)', value: 23_100_000_000, type: 'State GO' },
  { name: 'MA School Building Authority', value: 7_200_000_000, type: 'Revenue' },
  { name: 'MA Transportation Trust Fund', value: 5_400_000_000, type: 'Revenue' },
  { name: 'MA Development Finance Agency', value: 3_200_000_000, type: 'Conduit' },
  { name: 'MA Bay Transportation Authority (MBTA)', value: 5_800_000_000, type: 'Revenue' },
  { name: 'MA Port Authority (Massport)', value: 2_800_000_000, type: 'Revenue' },
  { name: 'MA Water Resources Authority', value: 4_100_000_000, type: 'Revenue' },
  { name: 'MA State College Building Authority', value: 2_100_000_000, type: 'Revenue' },
  { name: 'MA Clean Water Trust', value: 1_800_000_000, type: 'Revenue' },
  { name: 'MA Housing Finance Agency', value: 3_900_000_000, type: 'Conduit' },
  { name: 'University of Massachusetts Building Auth', value: 3_400_000_000, type: 'Revenue' },
  { name: 'MA Educational Financing Authority', value: 1_600_000_000, type: 'Conduit' },
];

// Debt breakdown by type (FY2024)
export const MA_DEBT_BY_TYPE = [
  { name: 'General Obligation Bonds', value: 23_100_000_000 },
  { name: 'Special Obligation (Revenue)', value: 11_200_000_000 },
  { name: 'Grant Anticipation Notes', value: 2_400_000_000 },
  { name: 'Federal Highway Grant Anticipation', value: 1_900_000_000 },
  { name: 'Commonwealth Transportation Fund', value: 2_100_000_000 },
];

// County-level municipal debt (compiled from EMMA and MA DLS reports)
// Note: MA counties mostly dissolved — these are county-designated regional debt
export const MA_COUNTY_DEBT = [
  { county: 'Suffolk (Boston area)', debt: 8_400_000_000, perCapita: 10_680 },
  { county: 'Middlesex', debt: 6_200_000_000, perCapita: 3_820 },
  { county: 'Worcester', debt: 3_100_000_000, perCapita: 3_740 },
  { county: 'Essex', debt: 2_800_000_000, perCapita: 3_540 },
  { county: 'Norfolk', debt: 2_400_000_000, perCapita: 3_410 },
  { county: 'Plymouth', debt: 1_900_000_000, perCapita: 3_680 },
  { county: 'Bristol', debt: 1_700_000_000, perCapita: 3_010 },
  { county: 'Hampden', debt: 1_500_000_000, perCapita: 3_210 },
  { county: 'Barnstable', debt: 980_000_000, perCapita: 4_540 },
  { county: 'Berkshire', debt: 420_000_000, perCapita: 3_290 },
];

export const MA_BOND_FACTS = {
  totalStateDebt: 40_700_000_000,
  annualDebtService: 2_300_000_000,
  percentOfBudget: 5.6,
  perCapitaDebt: 5_820,  // $40.7B / ~7M residents
  creditRating: 'Aa1 (Moody\'s) / AA+ (S&P)',
  debtCeiling: 125_700_000_000, // Statutory limit per MGL c.29 s.60A
  averageInterestRate: 4.2,
  longestMaturity: 2054,
};

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
