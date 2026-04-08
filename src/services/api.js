/**
 * THE PEOPLE'S AUDIT - Data Services
 * Connects to Massachusetts public financial data via CTHRU (Socrata) and USASpending APIs
 * All data is publicly available under open records laws.
 */

const SOCRATA_BASE = 'https://cthru.data.socrata.com/resource';
const USASPENDING_BASE = 'https://api.usaspending.gov/api/v2';

// CTHRU Socrata Dataset IDs
const DATASETS = {
  spending: 'pegc-naaa',       // Comptroller of the Commonwealth Spending
  payroll: 'rxhc-k6iz',        // Commonwealth of Massachusetts Payroll v2
  quasiPayments: 'v9tf-ghmw',  // Quasi-Government Payments
};

// Socrata SODA API helper
async function socrataQuery(datasetId, params = {}) {
  const url = new URL(`${SOCRATA_BASE}/${datasetId}.json`);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.append(key, value);
  });
  // Anonymous access (no app token) — rate-limited but functional for public data

  const response = await fetch(url.toString(), {
    headers: { 'Accept': 'application/json' },
  });
  if (!response.ok) throw new Error(`Socrata API error: ${response.status}`);
  return response.json();
}

// ============================================================
// SPENDING DATA
// ============================================================

export async function fetchSpendingByDepartment(fiscalYear = '2025', limit = 50) {
  try {
    const data = await socrataQuery(DATASETS.spending, {
      '$select': 'department_name, SUM(amount) as total_spent',
      '$where': `fiscal_year='${fiscalYear}'`,
      '$group': 'department_name',
      '$order': 'total_spent DESC',
      '$limit': limit,
    });
    return data.map(d => ({
      name: d.department_name || 'Unknown',
      value: parseFloat(d.total_spent) || 0,
    }));
  } catch (err) {
    console.warn('Spending by department fetch failed, using cached data:', err);
    return null;
  }
}

export async function fetchSpendingByVendor(fiscalYear = '2025', limit = 25) {
  try {
    const data = await socrataQuery(DATASETS.spending, {
      '$select': 'vendor_name, SUM(amount) as total_paid',
      '$where': `fiscal_year='${fiscalYear}'`,
      '$group': 'vendor_name',
      '$order': 'total_paid DESC',
      '$limit': limit,
    });
    return data.map(d => ({
      name: d.vendor_name || 'Unknown',
      value: parseFloat(d.total_paid) || 0,
    }));
  } catch (err) {
    console.warn('Spending by vendor fetch failed:', err);
    return null;
  }
}

export async function fetchSpendingOverTime(limit = 15) {
  try {
    const data = await socrataQuery(DATASETS.spending, {
      '$select': 'fiscal_year, SUM(amount) as total_spent',
      '$group': 'fiscal_year',
      '$order': 'fiscal_year ASC',
      '$limit': limit,
    });
    return data.map(d => ({
      year: d.fiscal_year,
      total: parseFloat(d.total_spent) || 0,
    }));
  } catch (err) {
    console.warn('Spending over time fetch failed:', err);
    return null;
  }
}

// ============================================================
// PAYROLL DATA
// ============================================================

export async function fetchPayrollByDepartment(calendarYear = '2024', limit = 30) {
  try {
    const data = await socrataQuery(DATASETS.payroll, {
      '$select': 'department_name, SUM(pay_total_actual) as total_pay, COUNT(*) as employee_count',
      '$where': `calendar_year='${calendarYear}'`,
      '$group': 'department_name',
      '$order': 'total_pay DESC',
      '$limit': limit,
    });
    return data.map(d => ({
      department: d.department_name || 'Unknown',
      totalPay: parseFloat(d.total_pay) || 0,
      employees: parseInt(d.employee_count) || 0,
    }));
  } catch (err) {
    console.warn('Payroll by department fetch failed:', err);
    return null;
  }
}

export async function fetchTopEarners(calendarYear = '2024', limit = 50) {
  try {
    const data = await socrataQuery(DATASETS.payroll, {
      '$select': 'employee_name, department_name, title, pay_total_actual',
      '$where': `calendar_year='${calendarYear}'`,
      '$order': 'pay_total_actual DESC',
      '$limit': limit,
    });
    return data.map(d => ({
      name: d.employee_name || 'Unknown',
      department: d.department_name || 'Unknown',
      title: d.title || 'Unknown',
      totalPay: parseFloat(d.pay_total_actual) || 0,
    }));
  } catch (err) {
    console.warn('Top earners fetch failed:', err);
    return null;
  }
}

export async function fetchPayrollOverTime(limit = 15) {
  try {
    const data = await socrataQuery(DATASETS.payroll, {
      '$select': 'calendar_year, SUM(pay_total_actual) as total_payroll, COUNT(*) as headcount',
      '$group': 'calendar_year',
      '$order': 'calendar_year ASC',
      '$limit': limit,
    });
    return data.map(d => ({
      year: d.calendar_year,
      totalPayroll: parseFloat(d.total_payroll) || 0,
      headcount: parseInt(d.headcount) || 0,
    }));
  } catch (err) {
    console.warn('Payroll over time fetch failed:', err);
    return null;
  }
}

// ============================================================
// QUASI-GOVERNMENT DATA
// ============================================================

export async function fetchQuasiPayments(limit = 30) {
  try {
    const data = await socrataQuery(DATASETS.quasiPayments, {
      '$select': 'organization_name, SUM(amount) as total_paid',
      '$group': 'organization_name',
      '$order': 'total_paid DESC',
      '$limit': limit,
    });
    return data.map(d => ({
      name: d.organization_name || 'Unknown',
      value: parseFloat(d.total_paid) || 0,
    }));
  } catch (err) {
    console.warn('Quasi payments fetch failed:', err);
    return null;
  }
}

// ============================================================
// USA SPENDING (Federal money flowing to MA)
// ============================================================

export async function fetchFederalSpendingMA(fiscalYear = 2025) {
  try {
    const response = await fetch(`${USASPENDING_BASE}/search/spending_by_category/awarding_agency/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filters: {
          time_period: [{ start_date: `${fiscalYear - 1}-10-01`, end_date: `${fiscalYear}-09-30` }],
          place_of_performance_locations: [{ country: 'USA', state: 'MA' }],
        },
        limit: 20,
        page: 1,
      }),
    });
    if (!response.ok) throw new Error(`USASpending API error: ${response.status}`);
    const result = await response.json();
    return result.results?.map(r => ({
      name: r.name || 'Unknown Agency',
      value: r.amount || 0,
    })) || [];
  } catch (err) {
    console.warn('Federal spending MA fetch failed:', err);
    return null;
  }
}

export async function fetchFederalAwardsMA(fiscalYear = 2025) {
  try {
    const response = await fetch(`${USASPENDING_BASE}/search/spending_by_category/recipient/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filters: {
          time_period: [{ start_date: `${fiscalYear - 1}-10-01`, end_date: `${fiscalYear}-09-30` }],
          place_of_performance_locations: [{ country: 'USA', state: 'MA' }],
        },
        limit: 25,
        page: 1,
      }),
    });
    if (!response.ok) throw new Error(`USASpending API error: ${response.status}`);
    const result = await response.json();
    return result.results?.map(r => ({
      name: r.name || 'Unknown Recipient',
      value: r.amount || 0,
    })) || [];
  } catch (err) {
    console.warn('Federal awards MA fetch failed:', err);
    return null;
  }
}

// ============================================================
// FALLBACK / CACHED DATA
// Massachusetts CAFR and budget summary data compiled from public reports
// ============================================================

export const MA_BUDGET_SUMMARY = {
  fiscalYear: 2025,
  totalBudget: 58_053_000_000,
  totalRevenue: 41_200_000_000,
  totalExpenditure: 56_800_000_000,
  categories: [
    { name: 'Health & Human Services', value: 23_400_000_000 },
    { name: 'Education', value: 8_900_000_000 },
    { name: 'Transportation', value: 3_200_000_000 },
    { name: 'Public Safety', value: 2_800_000_000 },
    { name: 'Debt Service', value: 3_600_000_000 },
    { name: 'Housing & Economic Dev', value: 1_900_000_000 },
    { name: 'Environment & Energy', value: 800_000_000 },
    { name: 'Administration & Finance', value: 2_100_000_000 },
    { name: 'Judiciary', value: 1_100_000_000 },
    { name: 'Legislature', value: 85_000_000 },
    { name: 'Other', value: 10_168_000_000 },
  ],
  revenueSources: [
    { name: 'Income Tax', value: 17_200_000_000 },
    { name: 'Sales & Use Tax', value: 8_400_000_000 },
    { name: 'Federal Reimbursements', value: 12_600_000_000 },
    { name: 'Corporate/Business Tax', value: 3_100_000_000 },
    { name: 'Other Revenue', value: 5_900_000_000 },
  ],
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
  courtAction: 'Complaint filed with Massachusetts Supreme Court to enforce Question 1',
};
