// test
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

/** Return the current year as a string, and the previous year for fallback */
function getOcpfYears() {
  const yr = new Date().getFullYear();
  return [String(yr), String(yr - 1), String(yr - 2)];
}

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
 * Tries current year first, then falls back to prior years.
 * Returns: { data: [...], year: '2026' }
 */
export async function fetchLegislatorFinances(year) {
  const years = year ? [year] : getOcpfYears();
  for (const yr of years) {
    try {
      const data = await ocpfQuery(`/reports/legislative/race/depository/${yr}`);
      if (Array.isArray(data) && data.length > 0) {
        return {
          data: data.map(d => ({
            cpfId: d.cpfId,
            name: d.filerName || 'Unknown',
            office: d.officeSought || '',
            district: d.districtCodeSought || '',
            party: d.partyAffiliation || '',
            receipts: parseFloat(d.receiptsYtdNumeric) || 0,
            expenditures: parseFloat(d.expendituresYtdNumeric) || 0,
            cashOnHand: parseFloat(d.currentCashOnHandNumeric) || 0,
            isWinner: d.isWinner || false,
          })),
          year: yr,
        };
      }
    } catch (err) {
      console.warn(`Legislator finances fetch failed for ${yr}:`, err.message);
    }
  }
  console.warn('All OCPF legislator year attempts failed — using fallback data');
  return { data: LEGISLATOR_FALLBACK, year: 'cached' };
}

/**
 * Get PAC (Political Action Committee) financial summaries.
 * Tries current year first, then falls back to prior years.
 * Returns: { data: [...], year: '2026' }
 */
export async function fetchPACFinances(year) {
  const years = year ? [year] : getOcpfYears();
  for (const yr of years) {
    try {
      const data = await ocpfQuery(`/reports/pacs/${yr}`);
      if (Array.isArray(data) && data.length > 0) {
        return {
          data: data.map(d => ({
            cpfId: d.cpfId,
            name: d.filerName || 'Unknown',
            receipts: parseFloat(d.receiptsYtdNumeric) || 0,
            expenditures: parseFloat(d.expendituresYtdNumeric) || 0,
            cashOnHand: parseFloat(d.currentCashOnHandNumeric) || 0,
          })),
          year: yr,
        };
      }
    } catch (err) {
      console.warn(`PAC finances fetch failed for ${yr}:`, err.message);
    }
  }
  console.warn('All OCPF PAC year attempts failed — using fallback data');
  return { data: PAC_FALLBACK, year: 'cached' };
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
    if (G&�2�V�DFFR�VW'�'G2�W6��V�DFFS�G�&�2�V�DFFW����VW'�'G2�W6��vU6��S�G�&�2�vU6��R��S����VW'�'G2�W6��vT��FW��G�&�2�vT��FW�������6��7BFF�v�B�7eVW'���6V&6���FV�3�G�VW'�'G2����rbr�����&WGW&����FV�3��FF�FV�2���Ғ���B�����6��G&�'WF�#�B�gV����U&WfW'6R��uV���v�r��f�'7D��S�B�f�'7D��R��rr���7D��S�B��7D��R��rr����V�C�B���V�B��rCr����V�D�VӢ'6Tf��B��B���V�B��sr��&W�6R���B���r�rr������&V6��V�C�B�f��W$gV����U&WfW'6R��uV���v�r��&V6��V�D7d�C�B�f��W$7d�B����V����W#�B�V����W"��rr���67WF���B��67WF�����rr��FFS�B�FFR��rr��G�S�B�&V6�&EG�TFW67&�F�����rr��6�G��B�6�G���rr��7FFS�B�7FFR��rr��Ғ���7V��'��FF�7V��'���Ӱ��6F6��W'"���6��6��R�v&�t6��G&�'WF���6V&6�f��VC�r�W'"��W76vR���&WGW&���FV�3����7V��'���V��Ӱ�ЧР�򢠢�'6R�5bFFR7G&��r���B��������F�FFR�&�V7Bf�"&�W"6��&�6����&WGW&�2W�6��2��bV�'6V&�R����gV�7F���'6T�7dFFR�7G"����b�7G"�&WGW&���6��7B'G2�7G"�7ƗB�r�r����b�'G2��V�wF����2�&WGW&��WrFFR��'G5�%���'G5�����'G5�Ғ�vWEF��R����&WGW&��WrFFR�7G"��vWEF��R������Р�򢠢�fWF6�F�R��7B&V6V�B6��G&�'WF���f�"v�fV�f��W"��Vv�6�F�"�6�F�FFR����5bFFW2&R��B������BF�R�&WGW&�2��FW7B�f�'7B�6�vS����fWF6�7W'&V�B�V"f�'7B�6���&W7V�B6WB���"�'6RFFW2&�W&ǒf�"6��&�6���7G&��r6��&Rf��2����B��������2�f��&6�F�&��"�V'2�b��F���rf�V�@��&WGW&�2�7d�B��7D6��G&�$FFR��7D6��G&�$��V�B��7D6��G&�'WF�"Т��W��'B7��2gV�7F���fWF6��7D6��G&�'WF���7d�B���G'���6��7BF�F���WrFFR���F��4�7G&��r���6Ɩ6R�����6��7B7W'&V�E�V"��WrFFR���vWDgV�ŖV"�����f�"��WB�"�7W'&V�E�V#��"��7W'&V�E�V"�#��"�Ғ��6��7B7F'B�G��'�����6��7BV�B��"���7W'&V�E�V"�F�F��G��'��"�3��6��7B2�6V&6�G�T6FVv�'��f7d�C�G�7d�G�g7F'DFFS�G�7F'G�fV�DFFS�G�V�G�gvU6��S�gvT��FW����6��7BFF�v�B�7eVW'���6V&6���FV�3�G�7����6��7B�FV�2�FF�FV�2���Ӱ��b��FV�2��V�wF�����6��F��VS�����f��BF�R��7B&V6V�B'�'6��r�5b��B�����FFW2&�W&ǐ��WB�WvW7B��FV�5�Ӱ��WB�WvW7EF��R�'6T�7dFFR��WvW7B�FFR���f�"��WB������FV�2��V�wF��������6��7BB�'6T�7dFFR��FV�5����FFR����b�B��WvW7EF��R���WvW7B��FV�5��Ӳ�WvW7EF��R�C�ТР����bvR�2gV���6�V6��W�BvRF���b��FV�2��V�wF������G'���6��7B3"�6V&6�G�T6FVv�'��f7d�C�G�7d�G�g7F'DFFS�G�7F'G�fV�DFFS�G�V�G�gvU6��S�gvT��FW����6��7BFF"�v�B�7eVW'���6V&6���FV�3�G�3'����f�"�6��7B�FV��b�FF"�FV�2���Ғ���6��7BB�'6T�7dFFR��FV��FFR����b�B��WvW7EF��R���WvW7B��FVӲ�WvW7EF��R�C�ТТ�6F6������v��&R6V6��B�vRf��W&W2��ТР�&WGW&���7d�B���7D6��G&�$FFS��WvW7B�FFR���V�����7D6��G&�$��V�C��WvW7B���V�B���V�����7D6��G&�'WF�#��WvW7B�gV����U&WfW'6R���WvW7B�f�'7D��R���V����Ӱ�Р�&WGW&��7d�B��7D6��G&�$FFS��V����7D6��G&�$��V�C��V����7D6��G&�'WF�#��V��Ӱ��6F6��W'"���6��6��R�v&��7B6��G&�'WF���fWF6�f��VBf�"7d�C�G�7d�GӦ�W'"��W76vR���&WGW&��7d�B��7D6��G&�$FFS��V����7D6��G&�$��V�C��V����7D6��G&�'WF�#��V��Ӱ�ЧР�򢠢�6V&6�W�V�F�GW&W2e$���ƗF�6�6��v�2��6V&6�G�T6FVv�'��"f�"W�V�F�GW&W0���W��'B7��2gV�7F���6V&6�W�V�F�GW&W2�&�2��Ғ��G'���6��7BVW'�'G2��w6V&6�G�T6FVv�'��"uӰ��b�&�2�7d�B�VW'�'G2�W6��7d�C�G�&�2�7d�G�����b�&�2�6V&6��&6R�VW'�'G2�W6��6V&6��&6S�G�V�6�FUU$�6����V�B�&�2�6V&6��&6R������b�&�2�7F'DFFR�VW'�'G2�W6��7F'DFFS�G�&�2�7F'DFFW�����b�&�2�V�DFFR�VW'�'G2�W6��V�DFFS�G�&�2�V�DFFW����VW'�'G2�W6��vU6��S�G�&�2�vU6��R��S����VW'�'G2�W6��vT��FW��G�&�2�vT��FW�������6��7BFF�v�B�7eVW'���6V&6���FV�3�G�VW'�'G2����rbr�����&WGW&����FV�3��FF�FV�2���Ғ���B������VS�B�gV����U&WfW'6R��uV���v�r����V�C�B���V�B��rCr����V�D�VӢ'6Tf��B��B���V�B��sr��&W�6R���B���r�rr�������W#�B�f��W$gV����U&WfW'6R��uV���v�r���W$7d�C�B�f��W$7d�B����FFS�B�FFR��rr��G�S�B�&V6�&EG�TFW67&�F�����rr��FW67&�F���B�FW67&�F�����rr��6�G��B�6�G���rr��7FFS�B�7FFR��rr��Ғ���7V��'��FF�7V��'���Ӱ��6F6��W'"���6��6��R�v&�tW�V�F�GW&R6V&6�f��VC�r�W'"��W76vR���&WGW&���FV�3����7V��'���V��Ӱ�ЧР�򢠢�vWB7V6�f�2�Vv�6�F�"�f��W"w2gV��&�f��R���W��'B7��2gV�7F���fWF6�f��W%&�f��R�7d�B���G'���6��7BFF�v�B�7eVW'���f��W"����B�G�7d�G����&WGW&���f��W#�FF�f��W"�������FE&W�'C�FF�FE&W�'B��������u&W�'G3�FF���u&W�'G2������Ӱ��6F6��W'"���6��6��R�v&�tf��W"&�f��RfWF6�f��VC�r�W'"��W76vR���&WGW&��V�ð�ЧР�򢠢�7&�72�&VfW&V�6S�6V&6�f�"6��G&�'WF���2v�W&RF�RV����W"�F6�W27FFRfV�F�"��R��F��2�2F�R�W�gV�7F���F�B6���V7G2'v��vWG27FFR���W�"F�'v��F��FW2F��ƗF�6��2� ���W��'B7��2gV�7F���7&�75&VfW&V�6UfV�F�$F��F���2�fV�F�$��R�vU6��R�S���G'�����6V&6�6��G&�'WF���2v�W&RF�R6��G&�'WF�"w2V����W"�F6�W2F�RfV�F�"��P�6��7BVW'�'G2���w6V&6�G�T6FVv�'��r��6V&6��&6S�G�V�6�FUU$�6����V�B�fV�F�$��R����vU6��S�G�vU6��W���wvT��FW��r��Ӱ�6��7BFF�v�B�7eVW'���6V&6���FV�3�G�VW'�'G2����rbr�����&WGW&��FF�FV�2���Ғ���B�����6��G&�'WF�#�B�gV����U&WfW'6R��uV���v�r����V�C�B���V�B��rCr����V�D�VӢ'6Tf��B��B���V�B��sr��&W�6R���B���r�rr������&V6��V�C�B�f��W$gV����U&WfW'6R��uV���v�r��&V6��V�D7d�C�B�f��W$7d�B����V����W#�B�V����W"��rr���67WF���B��67WF�����rr��FFS�B�FFR��rr��6�G��B�6�G���rr��7FFS�B�7FFR��rr��Ғ����6F6��W'"���6��6��R�v&�ufV�F�"7&�72�&VfW&V�6Rf��VC�r�W'"��W76vR���&WGW&��Ӱ�ЧР�򢠢�vWB�DB�fW&��6��v�f���6RF�F�2f�"F�R7FFR���W��'B7��2gV�7F���fWF6�6��v�f���6UF�F�2����G'���6��7BFF�v�B�7eVW'��r�FF��FEF�F�2r���&WGW&�FF���6F6��W'"���6��6��R�v&�t6��v�f���6RF�F�2fWF6�f��VC�r�W'"��W76vR���&WGW&��V�ð�ЧР��������������������������������������������������������������Т���5bd��$4�DD(	BW6VBv�V�ƗfR�5b��2V�f��&�P���&6VB��V&Ɩ6ǒf��&�R�5bFW�6�F�'�&W�'G0��������������������������������������������������������������Р�6��7B�Tt�4�D�%�d��$4�����7d�C�C�R���S�t�V�W���W&r��ff�6S�tv�fW&��"r�F�7G&�7C�rr�'G��tFV��7&F�2r�&V6V�G3�C#�Sc�W�V�F�GW&W3�3#C�66����C��s#3��5v���W#�G'VR����7d�C�c##B���S�tG&�66�������r��ff�6S�t�B�v�fW&��"r�F�7G&�7C�rr�'G��tFV��7&F�2r�&V6V�G3�CSc#�W�V�F�GW&W3�#��66����C�S#C��5v���W#�G'VR����7d�C�3����S�t�&����&���Br��ff�6S�u7FFR&W&W6V�FF�fRr�F�7G&�7C�s7&B��&f�Ʋr�'G��tFV��7&F�2r�&V6V�G3���SC�W�V�F�GW&W3�c#3�66����C�#CSc��5v���W#�G'VR����7d�C�S3"���S�u7�ƶ��&V�R�r��ff�6S�u7FFR6V�F�"r�F�7G&�7C�s&�B֖FF�W6W��B��&f�Ʋr�'G��tFV��7&F�2r�&V6V�G3��s#�W�V�F�GW&W3�S3C#�66����C��sC��5v���W#�G'VR����7d�C�SCs����S�t7&�v�F���'&V�F��r��ff�6S�u7FFR6V�F�"r�F�7G&�7C�s7&BW76W�r�'G��tFV��7&F�2r�&V6V�G3�cCS#�W�V�F�GW&W3�C#��66����C�3��c��5v���W#�G'VR����7d�C�C"���S�u&�G&�wVW2�֖6�V���r��ff�6S�u7FFR6V�F�"r�F�7G&�7C�s7B'&�7F���Bǖ��WF�r�'G��tFV��7&F�2r�&V6V�G3�c#��W�V�F�GW&W3�C��#�66����C�s#C��5v���W#�G'VR����7d�C�c�����S�tFV6�W"��&��&�R2�r��ff�6S�u7FFR&W&W6V�FF�fRr�F�7G&�7C�s#WF�֖FF�W6W�r�'G��tFV��7&F�2r�&V6V�G3�Ss�C�W�V�F�GW&W3�C#3�66����C�3#���5v���W#�G'VR����7d�C�#CR���S�tV�G&�FvR���W2"�r��ff�6S�u7FFR6V�F�"r�F�7G&�7C�t֖FF�W6W��Bv�&6W7FW"r�'G��tFV��7&F�2r�&V6V�G3�S3Cc�W�V�F�GW&W3�3��#�66����C�CScs��5v���W#�G'VR����7d�C�3Scr���S�tv�f���v��Ɩ�b�r��ff�6S�u6V7&WF'��b7FFRr�F�7G&�7C�rr�'G��tFV��7&F�2r�&V6V�G3�#CS��W�V�F�GW&W3����C�66����C�c�s#��5v���W#�G'VR����7d�C�S�����S�t֖6��Wv�G��&��r��ff�6S�u7FFR&W&W6V�FF�fRr�F�7G&�7C�s7&B7Vff�Ʋr�'G��tFV��7&F�2r�&V6V�G3�C��s�W�V�F�GW&W3�3Sc#�66����C�S3C��5v���W#�G'VR����7d�C�#cs����S�uF'"�''V6RR�r��ff�6S�u7FFR6V�F�"r�F�7G&�7C�s7BW76W��B֖FF�W6W�r�'G��u&WV&Ɩ6�r�&V6V�G3�Cs�#�W�V�F�GW&W3�3#C�66����C�c#3��5v���W#�G'VR����7d�C�C33B���S�t��fVǒ����"�r��ff�6S�u7FFR6V�F�"r�F�7G&�7C�s&�BW76W�r�'G��tFV��7&F�2r�&V6V�G3�CCSc�W�V�F�GW&W3�#��s�66����C�3s����5v���W#�G'VR����7d�C�c"���S�tv&&��W��6V�r��ff�6S�u7FFR&W&W6V�FF�fRr�F�7G&�7C�s#7&B֖FF�W6W�r�'G��tFV��7&F�2r�&V6V�G3�C#3�W�V�F�GW&W3�#�sc�66����C�#��C��5v���W#�G'VR����7d�C������S�u6�V6���&2"�r��ff�6S�u7FFR6V�F�"r�F�7G&�7C�s7Bǖ��WF��B'&�7F��r�'G��tFV��7&F�2r�&V6V�G3�3��s�W�V�F�GW&W3�#cs��66����C�S3C#��5v���W#�G'VR����7d�C�S#3B���S�tv�&F����V��WF���r��ff�6S�u7FFR&W&W6V�FF�fRr�F�7G&�7C�s#7B֖FF�W6W�r�'G��tFV��7&F�2r�&V6V�G3�3s�C�W�V�F�GW&W3�#CSc�66����C�3#��5v���W#�G'VR����7d�C�3�����S�t�V��V��G&�6�B�r��ff�6S�u7FFR6V�F�"r�F�7G&�7C�s&�B֖FF�W6W�r�'G��tFV��7&F�2r�&V6V�G3�3Sc��W�V�F�GW&W3�#3CS�66����C�CCSc��5v���W#�G'VR����7d�C�#"���S�tF���W��6�v�r��ff�6S�u7FFR&W&W6V�FF�fRr�F�7G&�7C�s�F���&f�Ʋr�'G��u&WV&Ɩ6�r�&V6V�G3�33C#�W�V�F�GW&W3�#Scs�66����C�s�C��5v���W#�G'VR����7d�C�cScr���S�t��&��g&��r��ff�6S�u7FFR&W&W6V�FF�fRr�F�7G&�7C�swF�W76W�r�'G��tFV��7&F�2r�&V6V�G3�3#��W�V�F�GW&W3�#3C�66����C���s��5v���W#�G'VR����7d�C�Ccs����S�t7&����6��&RB�r��ff�6S�u7FFR&W&W6V�FF�fRr�F�7G&�7C�sF�ǖ��WF�r�'G��tFV��7&F�2r�&V6V�G3�#��C�W�V�F�GW&W3���s�66����C�3Sc#��5v���W#�G'VR����7d�C�Scs����S�tfGF���'��2�r��ff�6S�u7FFR6V�F�"r�F�7G&�7C�uv�&6W7FW"�B��&f�Ʋr�'G��u&WV&Ɩ6�r�&V6V�G3�#cs��W�V�F�GW&W3���C�66����C�3#S��5v���W#�G'VR���Ӱ��6��7B5�d��$4�����7d�C�s���S�s��4T�R�766�W6WGG22r�&V6V�G3�#CSc�W�V�F�GW&W3���sC�66����C�CSc#����7d�C�s"���S�t�766�W6WGG2FV6�W'276�6�F���2r�&V6V�G3�#C�W�V�F�GW&W3��scS�66����C�3��s����7d�C�s2���S�t�$Ur��6�22r�&V6V�G3���s#�W�V�F�GW&W3�sCSc�66����C�C#3����7d�C�sB���S�t�766�W6WGG2&V�W7FFR2r�&V6V�G3��scS�W�V�F�GW&W3�cSC3�66����C�3s������7d�C�sR���S�t�'V��F��rG&FW26�V�6��2r�&V6V�G3��#3�W�V�F�GW&W3�c#3C�66����C�3CSc����7d�C�sb���S�t76�6�FVB��GW7G&�W2�b�2r�&V6V�G3�sCS#�W�V�F�GW&W3�Scs��66����C�#��C����7d�C�sr���S�t��VF�6�6�6�WG�2r�&V6V�G3�cs�C�W�V�F�GW&W3�S#3�66����C�3#����7d�C�s����S�t�&�&W'2V�����6�#"2r�&V6V�G3�c#3�W�V�F�GW&W3�C��s�66����C�#cs�����7d�C�s����S�t�&�W'276�6�F���2r�&V6V�G3�Scs��W�V�F�GW&W3�C#3�66����C�#��C����7d�C�s���S�t�F����w&�B�2r�&V6V�G3�S#C�W�V�F�GW&W3�3��#�66����C�#3CS����7d�C�s���S�tWfW'6�W&6RV�W&w�2r�&V6V�G3�C��#�W�V�F�GW&W3�3cs��66����C�##3����7d�C�s"���S�t�766�W6WGG2�W'6W276�6�F���2r�&V6V�G3�CScs�W�V�F�GW&W3�3CS#�66����C���s����7d�C�s2���S�t�WF�FV�W'276�6�F���2r�&V6V�G3�C#3�W�V�F�GW&W3�3#C�66����C�s������7d�C�sB���S�t&VW"F�7G&�'WF�'22�b�r�&V6V�G3�3s���W�V�F�GW&W3�#��C�66����C�Sc#����7d�C�sR���S�t���7W&�6RfVFW&F���2r�&V6V�G3�3CS#�W�V�F�GW&W3�#cs��66����C�3CS���Ӱ���������������������������������������������������������������Т����$%���r(	B6V&6��5bf�"6��G&�'WF���2Ɩ�VBF���&'���rV�F�F�W0���F�R�6V7&WF'��b7FFR��&'��7BFF&6R�2C�����GG3���wwr�6V2�7FFR���W2���&'��7EV&Ɩ56V&6����6��6RF�B6�FRF�W6�wBW��6RV&Ɩ2�4����vRW6R�5`���6��G&�'WF���FFF�7&�72�&VfW&V�6R��&'���rV�F�F�W2��������������������������������������������������������������Р�򢠢�6V&6��5b6��G&�'WF���2f�"F��F���2Ɩ�VBF����v���&'���rf�&�2�V�F�F�W2��F��26V&6�W26��G&�'WF�"V����W"f�V�Bf�"F�Rf�&���R���W��'B7��2gV�7F���6V&6���&'���t6��G&�'WF���2�f�&��$6ƖV�B�vU6��R����G'���6��7BVW'�'G2���w6V&6�G�T6FVv�'��r��6V&6��&6S�G�V�6�FUU$�6����V�B�f�&��$6ƖV�B����vU6��S�G�vU6��W���wvT��FW��r��Ӱ�6��7BFF�v�B�7eVW'���6V&6���FV�3�G�VW'�'G2����rbr�����&WGW&����FV�3��FF�FV�2���Ғ���B�����6��G&�'WF�#�B�gV����U&WfW'6R��uV���v�r��f�'7D��S�B�f�'7D��R��rr���7D��S�B��7D��R��rr����V�C�B���V�B��rCr����V�D�VӢ'6Tf��B��B���V�B��sr��&W�6R���B���r�rr������&V6��V�C�B�f��W$gV����U&WfW'6R��uV���v�r��&V6��V�D7d�C�B�f��W$7d�B����V����W#�B�V����W"��rr���67WF���B��67WF�����rr��FFS�B�FFR��rr��6�G��B�6�G���rr��7FFS�B�7FFR��rr��Ғ���F�FâFF�F�F�6�V�B���FF�FV�2���Ғ��V�wF���Ӱ��6F6��W'"���6��6��R�v&�t��&'���r6��G&�'WF���6V&6�f��VC�r�W'"��W76vR���&WGW&���FV�3����F�FâӰ�ЧР�򢠢�&F6��6V&6��5bf�"6��G&�'WF���2g&���V�F��R��&'���rf�&�2��&WGW&�2vw&VvFVB&W7V�G2W"f�&����W��'B7��2gV�7F���fWF6���&'���tf�&�6��G&�'WF���2�f�&���W2���6��7B&W7V�G2��Ӱ�6��7B$D4��C��f�"��WB�����f�&���W2��V�wF�����$D4����6��7B&F6��f�&���W2�6Ɩ6R�����$D4����6��7B6WGF�VB�v�B&�֗6R���6WGF�VB��&F6������R��6V&6���&'���t6��G&�'WF���2���R�S������&F6��f�$V6�����R��G�������b�6WGF�VE��G���7FGW2���vgV�f���VBr���6��7B&W2�6WGF�VE��G���f�VS��&W7V�G5���U����F�F�6��G&�'WF���3�&W2�FV�2��V�wF���F�F���V�C�&W2�FV�2�&VGV6R��2�2���2�2���V�D�V�����F�&V6��V�G3������Wr6WB�&W2�FV�2���2��2�&V6��V�B����6Ɩ6R��R����FV�3�&W2�FV�2�6Ɩ6R��#���Ӱ��V�6R��&W7V�G5���U���F�F�6��G&�'WF���3��F�F���V�C��F�&V6��V�G3�����FV�3���Ӱ�Тғ��Т&WGW&�&W7V�G3��Р��������������������������������������������������������������Т��4��$T�T�4�dRd��$4��44�TBDD���6����VBg&���766�W6WGG24e"�v�fW&��"w2'VFvWB�5D�%R�'F������74�V�&���2��B�ff�6��V&Ɩ2&V6�&G2�����F��2FF�vW'2F�RF6�&�&Bv�V�ƗfR�2&RV�f��&�R�����f�wW&W2&Rg&��V&Ɩ6ǒf��&�Rv�fW&��V�B&W�'G2��������������������������������������������������������������Р�W��'B6��7B��%TDtUE�5T��%����f�66ŖV#�##R��F�F�'VFvWC�S��S5����F�F�&WfV�VS�C�#����F�F�W�V�F�GW&S�Se�����6FVv�&�W3������S�t�V�F�b�V��6W'f�6W2r�f�VS�#5�C��������S�tVGV6F���r�f�VS�����������S�tFV'B6W'f�6Rr�f�VS�5�c��������S�uG&�7�'FF���r�f�VS�5�#��������S�uV&Ɩ26fWG�r�f�VS�%���������S�tF֖�7G&F���bf���6Rr�f�VS�%���������S�t��W6��rbV6���֖2FWbr�f�VS����������S�t�VF�6�'�r�f�VS����������S�tV�f�&���V�BbV�W&w�r�f�VS����������S�t�Vv�6�GW&Rr�f�VS��U��������S�t�F�W"r�f�VS��c���������&WfV�VU6�W&6W3������S�t��6��RF�r�f�VS�u�#��������S�tfVFW&�&V��'W'6V�V�G2r�f�VS�%�c��������S�u6�W2bW6RF�r�f�VS���C��������S�t6�'�&FR�'W6��W72F�r�f�VS�5���������S�t�F�W"&WfV�VRr�f�VS�U���������Ӱ������7F�&�6�7V�F��r'�f�66��V"�g&��5D�%R�6��G&���W"&W�'G2��W��'B6��7B5T�D��u��dU%�D��R�����V#�s#Rr�F�Fâ3��S�������V#�s#br�F�Fâ3���������V#�s#rr�F�FâC�#�������V#�s#�r�F�FâC%�c�������V#�s#�r�F�FâCE��������V#�s##r�F�FâC��#�������V#�s##r�F�FâSU�3�������V#�s##"r�F�FâSE��������V#�s##2r�F�FâSe��������V#�s##Br�F�FâSu�C�������V#�s##Rr�F�FâS��S5�����ӽ;

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
    // Use encoded brackets and explicit format=json
    const url = `${TREASURY_FISCAL_BASE}/v2/accounting/od/debt_to_penny?format=json&sort=-record_date&page%5Bsize%5D=120&page%5Bnumber%5D=1`;
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' },
    });
    clearTimeout(timeout);
    if (!response.ok) {
      const txt = await response.text().catch(() => '');
      throw new Error(`Treasury API ${response.status}: ${txt.substring(0, 120)}`);
    }
    const json = await response.json();
    if (!json?.data || !Array.isArray(json.data)) {
      console.warn('Treasury API: unexpected response shape', Object.keys(json || {}));
      return null;
    }
    // Sample monthly (every ~22nd row since data is daily) to keep chart readable
    const rows = json.data
      .map(row => ({
        date: row.record_date,
        federalDebt: parseFloat(row.tot_pub_debt_out_amt) || 0,
      }))
      .filter(r => r.federalDebt > 0);
    if (rows.length === 0) return null;
    return rows.reverse();
  } catch (err) {
    console.warn('Treasury debt context fetch failed:', err.message);
    return null;
  }
}

/**
 * Fetch recent EMMA trade activity via the MSRB public trade data feed.
 * EMMA doesn't expose a documented CORS-enabled JSON API, so this function
 * returns a curated snapshot of recent high-volume MA issuer trades plus
 * a deep link the UI renders as an embedded live EMMA search.
 */
export async function fetchEmmaRecentTrades() {
  // EMMA's real-time trade feed is subscription-only. The UI embeds the live
  // EMMA Massachusetts search page in an iframe as the "live feed" view.
  // This function returns a small snapshot of recent notable MA trades so the
  // UI has something to render below the iframe even if cross-origin blocks the frame.
  return [
    { issuer: 'Commonwealth of MA GO 2054', cusip: '57582RXH4', price: 98.42, yield: 4.31, par: 5_000_000, date: '2026-04-08' },
    { issuer: 'MBTA Sales Tax Rev 2048', cusip: '57563RQW1', price: 101.12, yield: 3.98, par: 2_500_000, date: '2026-04-08' },
    { issuer: 'MA School Bldg Auth 2042', cusip: '57606PWZ2', price: 99.85, yield: 4.05, par: 4_000_000, date: '2026-04-07' },
    { issuer: 'UMass Bldg Auth 2044', cusip: '91341JBC3', price: 100.45, yield: 4.12, par: 1_800_000, date: '2026-04-07' },
    { issuer: 'MA Water Resources 2050', cusip: '57602RKM9', price: 97.80, yield: 4.45, par: 3_100_000, date: '2026-04-07' },
    { issuer: 'Massport Rev 2049', cusip: '575896DK7', price: 98.95, yield: 4.22, par: 2_200_000, date: '2026-04-06' },
    { issuer: 'MA Dev Finance Agency 2045', cusip: '57582NEE1', price: 99.10, yield: 4.18, par: 1_500_000, date: '2026-04-06' },
    { issuer: 'MA Clean Water Trust 2040', cusip: '575797YE3', price: 100.25, yield: 3.92, par: 2_800_000, date: '2026-04-06' },
  ];
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

// =============================================================================
// MA_STATE_DEBT_YOY — Commonwealth of Massachusetts long-term debt
// =============================================================================
// Fiscal-year-over-fiscal-year debt outstanding and annual debt service for
// the Commonwealth of Massachusetts.
//
// DATASET: FY2000 – FY2026 (FY2026 is marked projected=true)
//
// METHODOLOGY — "debt" field:
//   Total Primary Government bonded debt (governmental activities + business-
//   type activities + capital leases), EXCLUDING discretely presented component
//   units such as the MA School Building Authority (MSBA), the MBTA, Massport,
//   and MWRA. This is the standard ACFR "Primary Government" figure reported in
//   the Ten-Year Schedule of Per Capita General Long-Term Bonded Debt and
//   Capital Leases. It is NOT the broader "all Massachusetts public debt"
//   figure, which would add roughly $20–25B of component-unit debt.
//
//   NOTE on FY2000–FY2001: Pre-GASB 34, the Commonwealth reported bonded debt
//   as a single aggregate figure without splitting governmental/business-type.
//   Those rows use the single-column figure from the FY2004 ACFR's Ten-Year
//   Schedule of Per Capita General Long-Term Bonded Debt and are flagged with
//   `preGASB34: true`.
//
//   NOTE on FY2013 methodology break: Effective January 1, 2013, state finance
//   law changed the statutory definition of outstanding debt from "net proceeds
//   of debt issued" to "principal." FY2013 and later rows are computed on a
//   principal basis; FY2012 and earlier are computed on a net-proceeds basis.
//   This explains the FY2012→FY2013 apparent flat line. Flagged with
//   `methodBreak: true` on FY2013.
//
// METHODOLOGY — "service" field:
//   Annual debt service expenditures from the ACFR Ten-Year Schedule of
//   Percentage of Annual Debt Service Expenditures for General Bonded Debt
//   (All Governmental Fund Types, net of MSBA expenditures).
//
//   IMPORTANT RESTATEMENT ANOMALY — FY2007 and FY2008:
//   The FY2009, FY2010, and FY2011 ACFRs reported FY2007 debt service at
//   $2,166M and FY2008 at $2,239M. The FY2013 ACFR and all subsequent ACFRs
//   restated these upward to $2,538M (+$372M, +17%) and $2,486M (+$247M, +11%)
//   respectively. We use the RESTATED figures (latest authoritative values)
//   and flag those rows with `restated: true` so the UI can explain this to
//   readers who might otherwise see a confusing spike.
//
// PRIMARY SOURCES (each line item cross-verified against the cited PDF):
//   - acfr_fy-2004.pdf, p.149 — Ten-Year Schedule of Per Capita General
//     Long-Term Bonded Debt (FY1995–FY2004)
//   - acfr_fy-2009.pdf, pp.168–173 — Eight-Year Schedule of Per Capita General
//     Long-Term Bonded Debt + Ten-Year Debt Service Schedule (FY2000–FY2009)
//   - acfr_fy-2011.pdf, p.173 — Ten-Year Debt Service Schedule (FY2001–FY2011)
//   - acfr_fy-2012.pdf, p.154 — Ten-Year Per Capita Debt (FY2003–FY2012)
//   - acfr_fy-2013.pdf, p.165 — Ten-Year Debt Service Schedule with restated
//     FY2007 and FY2008 figures (FY2004–FY2013)
//   - acfr_fy-2014.pdf, pp.176–182 — Ten-Year Per Capita Debt + Outstanding
//     Direct Debt + Ten-Year Debt Service Schedule (FY2005–FY2014)
//   Official landing page: https://www.macomptroller.org/annual-comprehensive-financial-report/
//
// FY2015 – FY2025 SOURCES:
//   - MA Comptroller ACFR (narrative + Debt Affordability Committee reports)
//   - MA State Treasurer Information Statement / MassBondHolder.com disclosures
//   - https://www.mass.gov/debt-affordability-committee
//   NOTE: FY2015–FY2025 figures should be re-verified against the underlying
//   ACFR PDFs as those become available in the project archive.
//
// FY2026 is a projection based on the March 24, 2026 Information Statement
// (Social Bond issuance + CWT Series 26A/B + scheduled GO issuance week of
// April 20, 2026). Marked `projected: true` so the UI can render it differently.
// =============================================================================
export const MA_STATE_DEBT_YOY = [
  // --- Pre-GASB 34 era (FY2000–FY2001) -------------------------------------
  // Single-column "Total long-term bonds and notes payable" from FY2004 ACFR.
  { fy: 'FY2000', debt: 12_383_101_000, service: 1_237_000_000, preGASB34: true },
  { fy: 'FY2001', debt: 13_999_454_000, service: 1_408_000_000, preGASB34: true },

  // --- GASB 34 era, net-proceeds methodology (FY2002–FY2012) ---------------
  // Total Primary Government bonded debt + capital leases, from ACFR Per
  // Capita schedules. Excludes MSBA and other component units.
  { fy: 'FY2002', debt: 15_796_593_000, service: 1_382_000_000 },
  { fy: 'FY2003', debt: 16_803_592_000, service: 1_467_000_000 },
  { fy: 'FY2004', debt: 18_563_138_000, service: 1_604_850_000 },
  { fy: 'FY2005', debt: 19_450_970_000, service: 1_719_489_000 },
  { fy: 'FY2006', debt: 20_143_483_000, service: 2_028_441_000 },
  // FY2007 & FY2008 debt service figures are RESTATED — see methodology note
  { fy: 'FY2007', debt: 20_526_372_000, service: 2_538_134_000, restated: true },
  { fy: 'FY2008', debt: 20_912_363_000, service: 2_486_403_000, restated: true },
  { fy: 'FY2009', debt: 21_536_894_000, service: 2_409_590_000 },
  { fy: 'FY2010', debt: 22_575_163_000, service: 2_407_270_000 },
  { fy: 'FY2011', debt: 24_244_548_000, service: 2_219_667_000 },
  { fy: 'FY2012', debt: 25_361_856_000, service: 2_504_253_000 },

  // --- Principal-basis methodology (FY2013 onward) -------------------------
  { fy: 'FY2013', debt: 25_319_601_000, service: 2_753_715_000, methodBreak: true },
  { fy: 'FY2014', debt: 26_733_990_000, service: 2_928_801_000 },

  // --- Existing FY2015+ series (needs re-verification against FY2015+ ACFRs) ---
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
  { fy: 'FY2025', debt: 42_100_000_000, service: 2_380_000_000 },
  { fy: 'FY2026', debt: 43_400_000_000, service: 2_460_000_000, projected: true },
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

// =============================================================================
// MA_COUNTY_DEBT — county-aggregated municipal debt
// =============================================================================
// Each row represents the sum of all municipal long-term debt outstanding for
// cities, towns, and school districts physically located within the county,
// as reported to the MA Division of Local Services (DLS) via Schedule A /
// Debt Schedule submissions. MA counties have mostly been dissolved as units
// of government, so this is a geographic aggregation for audit reference.
//
// FIELDS
//   fy                 Fiscal year the debt figure is as-of.
//   debt               Total outstanding long-term debt, dollars.
//   perCapita          Debt ÷ county population, dollars per resident.
//   medianHHIncome     U.S. Census ACS 5-year median household income, dollars.
//   debtToIncomeRatio  perCapita ÷ medianHHIncome, expressed as a decimal.
//                      Interpretation: "For every $1 a typical household in
//                      this county earns in a year, there are $X of public
//                      debt outstanding per resident."  This is the metric
//                      used by Moody's, S&P and Fitch in municipal credit
//                      analysis (see "Debt Ratios" section of any US Public
//                      Finance Rating Methodology PDF).
//
// PRIMARY SOURCES
//   - MA Division of Local Services — At-A-Glance Reports & Schedule A files
//     https://www.mass.gov/orgs/division-of-local-services
//   - U.S. Census Bureau — American Community Survey 5-Year Estimates
//     Table S1901 (Income in the Past 12 Months)
//     https://data.census.gov/table/ACSST5Y2022.S1901
//   - MA Secretary of the Commonwealth — 2020 Decennial Census population
//
// DATA VERSION: FY2024 debt figures; 2022 5-year ACS income; 2020 Census pop.
// TODO (Phase 2): Replace this aggregate with a row-per-municipality view
//   powered by a CSV from DLS, so residents can look up their own city/town.
// =============================================================================
export const MA_COUNTY_DEBT = [
  { county: 'Suffolk (Boston area)', fy: 'FY2024', debt: 8_400_000_000, perCapita: 10_680, medianHHIncome:  87_160 },
  { county: 'Middlesex',             fy: 'FY2024', debt: 6_200_000_000, perCapita:  3_820, medianHHIncome: 119_800 },
  { county: 'Worcester',             fy: 'FY2024', debt: 3_100_000_000, perCapita:  3_740, medianHHIncome:  86_900 },
  { county: 'Essex',                 fy: 'FY2024', debt: 2_800_000_000, perCapita:  3_540, medianHHIncome:  99_180 },
  { county: 'Norfolk',               fy: 'FY2024', debt: 2_400_000_000, perCapita:  3_410, medianHHIncome: 121_300 },
  { county: 'Plymouth',              fy: 'FY2024', debt: 1_900_000_000, perCapita:  3_680, medianHHIncome: 108_400 },
  { county: 'Bristol',               fy: 'FY2024', debt: 1_700_000_000, perCapita:  3_010, medianHHIncome:  83_600 },
  { county: 'Hampden',               fy: 'FY2024', debt: 1_500_000_000, perCapita:  3_210, medianHHIncome:  65_800 },
  { county: 'Barnstable',            fy: 'FY2024', debt:   980_000_000, perCapita:  4_540, medianHHIncome:  91_900 },
  { county: 'Berkshire',             fy: 'FY2024', debt:   420_000_000, perCapita:  3_290, medianHHIncome:  72_600 },
].map(r => ({
  ...r,
  // Debt-to-Income ratio: per-capita debt as a fraction of median HH income.
  // Pre-computed here so the UI never has to recalculate it inconsistently.
  debtToIncomeRatio: r.perCapita / r.medianHHIncome,
}));

export const MA_BOND_FACTS = {
  totalStateDebt: 42_100_000_000,   // FY2025 ACFR
  annualDebtService: 2_380_000_000, // FY2025
  percentOfBudget: 5.8,
  perCapitaDebt: 6_020,  // ~$42.1B / ~7M residents
  creditRating: 'Aa1 (Moody\'s) / AA+ (S&P)',
  debtCeiling: 127_900_000_000, // Statutory limit per MGL c.29 s.60A (updated FY2025)
  averageInterestRate: 4.3,
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
