import React, { useState, useMemo } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  DollarSign,
  Home,
  Heart,
  Car,
  ShoppingCart,
  Users,
  TrendingUp,
  Info,
} from 'lucide-react';
// Styles use existing index.css classes

// Massachusetts data (based on real 2024-2025 figures)
const MA_DATA = {
  minimumWage: 15.0,
  livingWages: {
    '1_adult_0_children': 23.81,
    '1_adult_1_child': 45.37,
    '2_adults_2_children': 30.33,
    '2_adults_1_child': 25.63,
  },
  medianHouseholdIncome: 96505,
  population: 7030000,
  stateBudget: 58800000000,
  costIndices: {
    housing: 159,
    healthcare: 115,
    transportation: 108,
    food: 105,
    childcare: 112,
  },
  averageRent1BR: 2200,
  averageHomePrice: 575000,
  nationalAverageRent1BR: 1300,
  nationalAverageHomePrice: 350000,
};

// Annual cost breakdown for 1 adult, 0 children (based on MIT Living Wage)
const ANNUAL_COSTS_1ADULT = {
  housing: 18720, // rent
  food: 4260,
  transportation: 8100,
  healthcare: 4104,
  childcare: 0,
  taxes: 12960,
  other: 1856,
};

const ANNUAL_COSTS_1ADULT_1CHILD = {
  housing: 18720,
  food: 7560,
  transportation: 8100,
  healthcare: 4104,
  childcare: 19200,
  taxes: 12960,
  other: 3564,
};

const ANNUAL_COSTS_2ADULTS_2CHILDREN = {
  housing: 20400,
  food: 9600,
  transportation: 10000,
  healthcare: 8400,
  childcare: 28800,
  taxes: 15600,
  other: 5200,
};

const COLORS = {
  housing: '#FF6B6B',
  food: '#4ECDC4',
  transportation: '#45B7D1',
  healthcare: '#FFA07A',
  childcare: '#98D8C8',
  taxes: '#F7DC6F',
  other: '#BB8FCE',
  ma: '#0052CC',
  national: '#6C757D',
};

const COST_CATEGORIES = [
  { key: 'housing', label: 'Housing', icon: Home },
  { key: 'food', label: 'Food', icon: ShoppingCart },
  { key: 'transportation', label: 'Transportation', icon: Car },
  { key: 'healthcare', label: 'Healthcare', icon: Heart },
  { key: 'childcare', label: 'Childcare', icon: Users },
  { key: 'taxes', label: 'Taxes', icon: DollarSign },
  { key: 'other', label: 'Other', icon: TrendingUp },
];

function CostOfLivingCalculator() {
  const [annualIncome, setAnnualIncome] = useState(60000);
  const [familySize, setFamilySize] = useState('1_adult_0_children');
  const [showComparison, setShowComparison] = useState(false);

  // Get cost breakdown based on family size
  const getCostBreakdown = (size) => {
    const breakdowns = {
      '1_adult_0_children': ANNUAL_COSTS_1ADULT,
      '1_adult_1_child': ANNUAL_COSTS_1ADULT_1CHILD,
      '2_adults_2_children': ANNUAL_COSTS_2ADULTS_2CHILDREN,
    };
    return breakdowns[size] || ANNUAL_COSTS_1ADULT;
  };

  const costBreakdown = getCostBreakdown(familySize);
  const totalAnnualCost = Object.values(costBreakdown).reduce((a, b) => a + b, 0);
  const requiredHourlyWage = totalAnnualCost / 2080;
  const livingWage = MA_DATA.livingWages[familySize];

  // Budget breakdown based on user income
  const userBudgetBreakdown = useMemo(() => {
    const income = annualIncome;
    const breakdown = getCostBreakdown(familySize);
    const totalExpected = Object.values(breakdown).reduce((a, b) => a + b, 0);

    return Object.entries(breakdown).map(([key, cost]) => {
      const percentage = (cost / totalExpected) * 100;
      const userAllocation = (income * percentage) / 100;
      const difference = userAllocation - cost;
      return {
        category: key,
        expectedAnnual: cost,
        userAllocation,
        percentage,
        difference,
      };
    });
  }, [annualIncome, familySize]);

  // Cost comparison data (MA vs National average)
  const comparisonData = [
    {
      name: 'Housing (1BR)',
      ma: MA_DATA.averageRent1BR * 12,
      national: MA_DATA.nationalAverageRent1BR * 12,
    },
    {
      name: 'Healthcare',
      ma: 8200,
      national: 7100,
    },
    {
      name: 'Transportation',
      ma: 8400,
      national: 7800,
    },
    {
      name: 'Food (Annual)',
      ma: 4500,
      national: 4300,
    },
    {
      name: 'Childcare (Annual)',
      ma: 19200,
      national: 17100,
    },
  ];

  // Living wage by family size
  const livingWageData = [
    {
      name: '1 Adult',
      wage: MA_DATA.livingWages['1_adult_0_children'],
      minWage: MA_DATA.minimumWage,
    },
    {
      name: '1A + 1C',
      wage: MA_DATA.livingWages['1_adult_1_child'],
      minWage: MA_DATA.minimumWage,
    },
    {
      name: '2A + 1C',
      wage: MA_DATA.livingWages['2_adults_1_child'],
      minWage: MA_DATA.minimumWage,
    },
    {
      name: '2A + 2C',
      wage: MA_DATA.livingWages['2_adults_2_children'],
      minWage: MA_DATA.minimumWage,
    },
  ];

  // Budget pie chart data
  const budgetPieData = userBudgetBreakdown.map((item) => ({
    name: item.category,
    value: Math.round(item.userAllocation),
  }));

  // State spending per capita
  const spendingPerCapita = MA_DATA.stateBudget / MA_DATA.population;
  const educationSpendingPerStudent = MA_DATA.stateBudget * 0.33 / 800000; // ~33% of budget, ~800k students
  const healthcareSpendingPerCapita = MA_DATA.stateBudget * 0.18 / MA_DATA.population;
  const transportationSpendingPerCapita = MA_DATA.stateBudget * 0.07 / MA_DATA.population;

  // Estimate state/local taxes from income
  const estimatedStateTaxes = annualIncome * 0.05; // ~5% state income tax
  const estimatedLocalTaxes = annualIncome * 0.01; // ~1% local property/other taxes

  const incomeBreakdown = [
    { name: 'Take Home', value: annualIncome - estimatedStateTaxes - estimatedLocalTaxes },
    { name: 'State Taxes', value: estimatedStateTaxes },
    { name: 'Local Taxes', value: estimatedLocalTaxes },
  ];

  return (
    <div className="cost-of-living-calculator">
      <div className="calculator-header">
        <h1>
          <DollarSign className="header-icon" />
          Cost of Living Calculator
        </h1>
        <p>
          Understand how Massachusetts living costs compare to national averages and
          how public spending affects your daily life.
        </p>
      </div>

      {/* Interactive Inputs Section */}
      <div className="inputs-section">
        <div className="input-group">
          <label htmlFor="income-input">Annual Household Income</label>
          <div className="input-wrapper">
            <span className="currency">$</span>
            <input
              id="income-input"
              type="number"
              value={annualIncome}
              onChange={(e) => setAnnualIncome(Math.max(0, parseInt(e.target.value) || 0))}
              className="income-input"
            />
          </div>
          <input
            type="range"
            min="10000"
            max="250000"
            step="5000"
            value={annualIncome}
            onChange={(e) => setAnnualIncome(parseInt(e.target.value))}
            className="income-slider"
          />
          <div className="slider-labels">
            <span>$10k</span>
            <span>$250k</span>
          </div>
        </div>

        <div className="input-group">
          <label htmlFor="family-size">Family Composition</label>
          <select
            id="family-size"
            value={familySize}
            onChange={(e) => setFamilySize(e.target.value)}
            className="family-select"
          >
            <option value="1_adult_0_children">1 Adult, 0 Children</option>
            <option value="1_adult_1_child">1 Adult, 1 Child</option>
            <option value="2_adults_1_child">2 Adults, 1 Child</option>
            <option value="2_adults_2_children">2 Adults, 2 Children</option>
          </select>
        </div>
      </div>

      {/* Living Wage Summary */}
      <div className="section-header">Living Wage Analysis</div>
      <div className="kpi-grid">
        <div className="kpi-card living-wage-card">
          <div className="kpi-label">Estimated Living Wage</div>
          <div className="kpi-value">${livingWage.toFixed(2)}/hr</div>
          <div className="kpi-subtext">For selected family</div>
          <div className="kpi-comparison">
            {livingWage > MA_DATA.minimumWage ? (
              <span className="badge warning">
                {((livingWage / MA_DATA.minimumWage - 1) * 100).toFixed(0)}% above minimum wage
              </span>
            ) : (
              <span className="badge success">Above minimum wage</span>
            )}
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-label">Annual Cost of Living</div>
          <div className="kpi-value">${totalAnnualCost.toLocaleString()}</div>
          <div className="kpi-subtext">Based on MA averages</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-label">Massachusetts Minimum Wage</div>
          <div className="kpi-value">${MA_DATA.minimumWage.toFixed(2)}/hr</div>
          <div className="kpi-subtext">Federal: $7.25/hr</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-label">Your Annual Taxes</div>
          <div className="kpi-value">${(estimatedStateTaxes + estimatedLocalTaxes).toLocaleString()}</div>
          <div className="kpi-subtext">State + Local estimate</div>
        </div>
      </div>

      {/* Living Wage Comparison Chart */}
      <div className="section-header">Living Wage by Family Size</div>
      <div className="chart-card">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={livingWageData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#444" />
            <XAxis dataKey="name" stroke="#999" />
            <YAxis stroke="#999" label={{ value: 'Hourly Wage ($)', angle: -90, position: 'insideLeft' }} />
            <Tooltip
              formatter={(value) => `$${value.toFixed(2)}/hr`}
              contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #444' }}
            />
            <Legend />
            <Bar dataKey="wage" fill={COLORS.ma} name="Living Wage" />
            <Bar dataKey="minWage" fill={COLORS.national} name="Minimum Wage" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Cost Breakdown */}
      <div className="section-header">Your Budget Breakdown</div>
      <div className="budget-layout">
        <div className="chart-card">
          <ResponsiveContainer width="100%" height={350}>
            <PieChart>
              <Pie
                data={budgetPieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) =>
                  `${name}: $${(value / 1000).toFixed(0)}k`
                }
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {budgetPieData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[entry.name] || '#8884d8'}
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={(value) => `$${(value / 1000).toFixed(1)}k`}
                contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #444' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="budget-table">
          <div className="table-header">
            <div className="header-cell">Category</div>
            <div className="header-cell">Expected</div>
            <div className="header-cell">Your Budget</div>
            <div className="header-cell">Difference</div>
          </div>
          {userBudgetBreakdown.map((item) => {
            const Icon = COST_CATEGORIES.find((c) => c.key === item.category)?.icon || DollarSign;
            return (
              <div key={item.category} className="table-row">
                <div className="cell category-cell">
                  <Icon size={16} />
                  {COST_CATEGORIES.find((c) => c.key === item.category)?.label}
                </div>
                <div className="cell">${(item.expectedAnnual / 1000).toFixed(1)}k</div>
                <div className="cell">${(item.userAllocation / 1000).toFixed(1)}k</div>
                <div className={`cell diff ${item.difference >= 0 ? 'positive' : 'negative'}`}>
                  {item.difference >= 0 ? '+' : '-'}${Math.abs(item.difference / 1000).toFixed(1)}k
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Cost Comparison Section */}
      <div className="section-header">Massachusetts vs National Average Costs</div>
      <div className="chart-card">
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={comparisonData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#444" />
            <XAxis dataKey="name" stroke="#999" />
            <YAxis stroke="#999" label={{ value: 'Annual Cost ($)', angle: -90, position: 'insideLeft' }} />
            <Tooltip
              formatter={(value) => `$${(value / 1000).toFixed(1)}k`}
              contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #444' }}
            />
            <Legend />
            <Bar dataKey="ma" fill={COLORS.ma} name="Massachusetts" />
            <Bar dataKey="national" fill={COLORS.national} name="National Average" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Cost Index Comparison */}
      <div className="section-header">Cost Index: Massachusetts vs US (100 = US Average)</div>
      <div className="cost-index-grid">
        {Object.entries(MA_DATA.costIndices).map(([key, index]) => {
          const Icon = COST_CATEGORIES.find((c) => c.key === key)?.icon || DollarSign;
          const isAbove = index > 100;
          return (
            <div key={key} className="cost-index-card">
              <div className="index-header">
                <Icon size={20} className="index-icon" />
                <span className="index-name">
                  {COST_CATEGORIES.find((c) => c.key === key)?.label}
                </span>
              </div>
              <div className="index-value">{index}</div>
              <div className="index-bar">
                <div
                  className="index-fill"
                  style={{
                    width: `${Math.min(index / 2, 100)}%`,
                    backgroundColor: isAbove ? '#FF6B6B' : '#4ECDC4',
                  }}
                />
              </div>
              <div className="index-label">
                {isAbove ? '+' : ''}{(index - 100).toFixed(0)}% vs US
              </div>
            </div>
          );
        })}
      </div>

      {/* Income and Tax Breakdown */}
      <div className="section-header">Your Income and Taxes</div>
      <div className="income-layout">
        <div className="chart-card">
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={incomeBreakdown}
                cx="50%"
                cy="50%"
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
                label={({ name, value }) =>
                  `${name}: $${(value / 1000).toFixed(0)}k`
                }
              >
                {incomeBreakdown.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={[COLORS.ma, COLORS.taxes, '#9B59B6'][index]}
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={(value) => `$${(value / 1000).toFixed(1)}k`}
                contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #444' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="income-summary">
          <div className="income-item">
            <span className="income-label">Annual Gross Income</span>
            <span className="income-value">${annualIncome.toLocaleString()}</span>
          </div>
          <div className="divider" />
          <div className="income-item">
            <span className="income-label">State Income Tax (~5%)</span>
            <span className="income-value">${estimatedStateTaxes.toLocaleString()}</span>
          </div>
          <div className="income-item">
            <span className="income-label">Local Taxes (~1%)</span>
            <span className="income-value">${estimatedLocalTaxes.toLocaleString()}</span>
          </div>
          <div className="divider" />
          <div className="income-item highlight">
            <span className="income-label">Take-Home Pay</span>
            <span className="income-value">
              ${(annualIncome - estimatedStateTaxes - estimatedLocalTaxes).toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* Public Spending Section */}
      <div className="section-header">Massachusetts Public Spending Per Capita</div>
      <div className="spending-grid">
        <div className="spending-card">
          <div className="spending-label">Total State Budget Per Capita</div>
          <div className="spending-value">${spendingPerCapita.toLocaleString('en-US', { maximumFractionDigits: 0 })}</div>
          <div className="spending-source">MA Population: {(MA_DATA.population / 1000000).toFixed(2)}M</div>
        </div>

        <div className="spending-card">
          <div className="spending-label">Education Spending Per Student</div>
          <div className="spending-value">${educationSpendingPerStudent.toLocaleString('en-US', { maximumFractionDigits: 0 })}</div>
          <div className="spending-source">~33% of state budget</div>
        </div>

        <div className="spending-card">
          <div className="spending-label">Healthcare Spending Per Capita</div>
          <div className="spending-value">${healthcareSpendingPerCapita.toLocaleString('en-US', { maximumFractionDigits: 0 })}</div>
          <div className="spending-source">~18% of state budget</div>
        </div>

        <div className="spending-card">
          <div className="spending-label">Transportation Spending Per Capita</div>
          <div className="spending-value">${transportationSpendingPerCapita.toLocaleString('en-US', { maximumFractionDigits: 0 })}</div>
          <div className="spending-source">~7% of state budget</div>
        </div>
      </div>

      {/* Key Insights */}
      <div className="section-header">Key Insights</div>
      <div className="insights-grid">
        <div className="insight-card">
          <div className="insight-icon">
            <Home size={24} />
          </div>
          <h3>Housing Crisis</h3>
          <p>
            MA housing costs are 59% above the national average. The median home price is
            $575,000, requiring significant income to afford without financial stress.
          </p>
        </div>

        <div className="insight-card">
          <div className="insight-icon">
            <TrendingUp size={24} />
          </div>
          <h3>Living Wage Gap</h3>
          <p>
            A single parent with one child needs to earn $45.37/hour to meet basic needsâover
            6 times the federal minimum wage. This is $21.56 above the state minimum wage.
          </p>
        </div>

        <div className="insight-card">
          <div className="insight-icon">
            <Heart size={24} />
          </div>
          <h3>Healthcare Costs</h3>
          <p>
            MA healthcare costs are 15% above the national average. Despite having higher costs,
            the state maintains excellent healthcare quality and coverage rates.
          </p>
        </div>

        <div className="insight-card">
          <div className="insight-icon">
            <DollarSign size={24} />
          </div>
          <h3>Tax Burden</h3>
          <p>
            MA residents pay approximately 6% of income in state and local taxes. Understanding
            where these taxes go helps inform citizen participation in budget decisions.
          </p>
        </div>
      </div>

      {/* Data Source Note */}
      <div className="data-note">
        <Info size={16} />
        <span>
          Data based on 2024-2025 figures from MIT Living Wage Calculator, U.S. Census Bureau,
          and Massachusetts Department of Revenue. Figures are estimates for illustration purposes.
        </span>
      </div>
    </div>
  );
}

export default CostOfLivingCalculator;
