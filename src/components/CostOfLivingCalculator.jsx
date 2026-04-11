import React, { useState, useMemo } from 'react';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { DollarSign, Home, Heart, Car, ShoppingCart, TrendingUp, Info } from 'lucide-react';

const MA_DATA = {
  minimumWage: 15.0,
  livingWages: { '1_adult_0_children': 23.81, '1_adult_1_child': 45.37, '2_adults_2_children': 30.33, '2_adults_1_child': 25.63, '2_adults_3_children': 35.12, '2_adults_4_children': 39.87 },
  medianHouseholdIncome: 96505, population: 7030000, stateBudget: 58800000000,
  costIndices: { housing: 159, healthcare: 115, transportation: 108, food: 105, childcare: 112 },
  averageRent1BR: 2200, averageRent2BR: 2800, averageRent3BR: 3300, averageHomePrice: 575000, nationalAverageRent1BR: 1300, nationalAverageRent2BR: 1650, nationalAverageRent3BR: 1950, nationalAverageHomePrice: 350000,
};

const ANNUAL_COSTS = {
  '1_adult_0_children': { housing: 18720, food: 4260, transportation: 8100, healthcare: 4104, childcare: 0, taxes: 12960, other: 1856 },
  '1_adult_1_child': { housing: 18720, food: 7560, transportation: 8100, healthcare: 4104, childcare: 19200, taxes: 12960, other: 3564 },
  '2_adults_1_child': { housing: 20400, food: 8400, transportation: 9000, healthcare: 6800, childcare: 19200, taxes: 14400, other: 4200 },
  '2_adults_2_children': { housing: 20400, food: 9600, transportation: 10000, healthcare: 8400, childcare: 28800, taxes: 15600, other: 5200 },
  '2_adults_3_children': { housing: 22000, food: 11000, transportation: 11000, healthcare: 9800, childcare: 38400, taxes: 16800, other: 6200 },
  '2_adults_4_children': { housing: 24000, food: 12500, transportation: 12000, healthcare: 11200, childcare: 48000, taxes: 18000, other: 7200 },
};

const COLORS = { housing: '#680A1D', food: '#32784E', transportation: '#14558F', healthcare: '#E67E22', childcare: '#9B59B6', taxes: '#FFC72C', other: '#00A9CE' };
const LABELS = { housing: 'Housing', food: 'Food', transportation: 'Transportation', healthcare: 'Healthcare', childcare: 'Childcare', taxes: 'Taxes', other: 'Other' };
const ICONS = { housing: Home, food: ShoppingCart, transportation: Car, healthcare: Heart, childcare: DollarSign, taxes: DollarSign, other: DollarSign };

const tooltipStyle = { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13 };
const fmt = (n) => '$' + (n >= 1000 ? (n/1000).toFixed(1) + 'k' : n.toLocaleString());

export default function CostOfLivingCalculator() {
  const [annualIncome, setAnnualIncome] = useState(MA_DATA.medianHouseholdIncome);
  const [familySize, setFamilySize] = useState('1_adult_0_children');

  const livingWage = MA_DATA.livingWages[familySize];
  const costs = ANNUAL_COSTS[familySize];
  const totalAnnualCost = Object.values(costs).reduce((a, b) => a + b, 0);

  const userBudgetBreakdown = useMemo(() => {
    const ratio = annualIncome / totalAnnualCost;
    return Object.entries(costs).map(([key, expected]) => ({
      category: key, expectedAnnual: expected, userAllocation: Math.round(expected * ratio),
      difference: Math.round(expected * ratio - expected),
    }));
  }, [annualIncome, familySize, costs, totalAnnualCost]);

  const comparisonData = [
    { name: 'Housing (2BR)', ma: MA_DATA.averageRent2BR * 12, national: MA_DATA.nationalAverageRent2BR * 12 },
    { name: 'Housing (3BR)', ma: MA_DATA.averageRent3BR * 12, national: MA_DATA.nationalAverageRent3BR * 12 },
    { name: 'Healthcare', ma: 8200, national: 7100 },
    { name: 'Transportation', ma: 8400, national: 7800 },
    { name: 'Food (Annual)', ma: 4500, national: 4300 },
    { name: 'Childcare', ma: 19200, national: 17100 },
  ];

  const livingWageData = [
    { name: '1 Adult', wage: MA_DATA.livingWages['1_adult_0_children'], minWage: MA_DATA.minimumWage },
    { name: '1A + 1C', wage: MA_DATA.livingWages['1_adult_1_child'], minWage: MA_DATA.minimumWage },
    { name: '2A + 1C', wage: MA_DATA.livingWages['2_adults_1_child'], minWage: MA_DATA.minimumWage },
    { name: '2A + 2C', wage: MA_DATA.livingWages['2_adults_2_children'], minWage: MA_DATA.minimumWage },
    { name: '2A + 3C', wage: MA_DATA.livingWages['2_adults_3_children'], minWage: MA_DATA.minimumWage },
    { name: '2A + 4C', wage: MA_DATA.livingWages['2_adults_4_children'], minWage: MA_DATA.minimumWage },
  ];

  const budgetPieData = userBudgetBreakdown.map(i => ({ name: LABELS[i.category], value: Math.round(i.userAllocation), color: COLORS[i.category] }));
  const estimatedStateTaxes = annualIncome * 0.05;
  const estimatedLocalTaxes = annualIncome * 0.01;

  return (
    <div className="section">
      <div className="section-header">
        <span className="section-tag red" style={{ background: 'rgba(0,169,206,0.12)', color: '#00A9CE' }}>Impact Calculator</span>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <DollarSign size={28} style={{ color: '#00A9CE' }} /> Cost of Living Calculator
        </h2>
        <p>Understand how Massachusetts living costs compare to national averages and how public spending affects your daily life.</p>
      </div>

      {/* Input Controls */}
      <div className="chart-card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: 1, minWidth: 280 }}>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: 8, fontSize: '0.9rem', color: 'var(--text-primary)' }}>Annual Household Income</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontWeight: 700, color: 'var(--text-muted)' }}>$</span>
              <input type="number" value={annualIncome}
                onChange={(e) => setAnnualIncome(Math.max(0, parseInt(e.target.value) || 0))}
                style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: '1.1rem', fontWeight: 600, fontFamily: 'JetBrains Mono', outline: 'none' }} />
            </div>
            <input type="range" min="10000" max="250000" step="5000" value={annualIncome}
              onChange={(e) => setAnnualIncome(parseInt(e.target.value))}
              style={{ width: '100%', marginTop: 10, accentColor: 'var(--accent-blue)' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              <span>$10k</span><span>$250k</span>
            </div>
          </div>
          <div style={{ minWidth: 220 }}>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: 8, fontSize: '0.9rem', color: 'var(--text-primary)' }}>Family Composition</label>
            <select value={familySize} onChange={(e) => setFamilySize(e.target.value)}
              style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: '0.9rem', outline: 'none' }}>
              <option value="1_adult_0_children">1 Adult, 0 Children</option>
              <option value="1_adult_1_child">1 Adult, 1 Child</option>
              <option value="2_adults_1_child">2 Adults, 1 Child</option>
              <option value="2_adults_2_children">2 Adults, 2 Children</option>
              <option value="2_adults_3_children">2 Adults, 3 Children</option>
              <option value="2_adults_4_children">2 Adults, 4 Children</option>
            </select>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="kpi-row" style={{ marginBottom: 32 }}>
        <div className="kpi-card">
          <div className="kpi-label">Estimated Living Wage</div>
          <div className="kpi-value" style={{ color: 'var(--accent-red)' }}>${livingWage.toFixed(2)}/hr</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4 }}>
            {((livingWage / MA_DATA.minimumWage - 1) * 100).toFixed(0)}% above minimum wage
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Annual Cost of Living</div>
          <div className="kpi-value">${totalAnnualCost.toLocaleString()}</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4 }}>Based on MA averages</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">MA Minimum Wage</div>
          <div className="kpi-value">${MA_DATA.minimumWage.toFixed(2)}/hr</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4 }}>Federal: $7.25/hr</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Your Annual Taxes (est.)</div>
          <div className="kpi-value">${(estimatedStateTaxes + estimatedLocalTaxes).toLocaleString()}</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4 }}>State + Local (~6%)</div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="card-grid" style={{ marginBottom: 24 }}>
        <div className="chart-card">
          <h3>Living Wage by Family Size</h3>
          <div className="chart-subtitle">Hourly wage needed to meet basic needs</div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={livingWageData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
              <XAxis dataKey="name" stroke="rgba(0,0,0,0.4)" style={{ fontSize: 12 }} />
              <YAxis stroke="rgba(0,0,0,0.4)" style={{ fontSize: 12 }} tickFormatter={v => `$${v}`} />
              <Tooltip formatter={(v) => [`$${v.toFixed(2)}/hr`]} contentStyle={tooltipStyle} />
              <Legend />
              <Bar dataKey="wage" fill="#680A1D" name="Living Wage" radius={[4,4,0,0]} />
              <Bar dataKey="minWage" fill="#95A5A6" name="Minimum Wage" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h3>Your Budget Breakdown</h3>
          <div className="chart-subtitle">Estimated annual allocation based on your income</div>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={budgetPieData} cx="50%" cy="50%" labelLine={false}
                label={({ name, value }) => `${name}: ${fmt(value)}`}
                outerRadius={90} dataKey="value">
                {budgetPieData.map((e, i) => <Cell key={i} fill={e.color} />)}
              </Pie>
              <Tooltip formatter={(v) => [fmt(v)]} contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Budget Table */}
      <div className="chart-card" style={{ marginBottom: 24 }}>
        <h3>Detailed Budget Comparison</h3>
        <div className="chart-subtitle">Expected costs vs. your proportional allocation</div>
        <div style={{ background: 'rgba(50, 120, 78, 0.06)', border: '1px solid rgba(50, 120, 78, 0.15)', borderRadius: 8, padding: '12px 16px', fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: 8, lineHeight: 1.6 }}>
          <strong style={{ color: 'var(--accent-green)' }}>What is "Proportional Allocation"?</strong> This table compares what the average Massachusetts household spends in each category (Expected) against what your household would spend if your income were distributed in the same proportions. If your income is above the average cost of living, each category gets more budget; if below, each gets less. The "Difference" column shows the gap â green means you have more room in that category, red means you're stretched thin.
        </div>
        <div style={{ overflowX: 'auto', marginTop: 16 }}>
          <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Category', 'Expected', 'Your Budget', 'Difference'].map(h => (
                  <th key={h} style={{ textAlign: h === 'Category' ? 'left' : 'right', padding: '10px 12px', color: 'var(--text-muted)', fontWeight: 600, borderBottom: '2px solid var(--border)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {userBudgetBreakdown.map(item => {
                const Icon = ICONS[item.category] || DollarSign;
                return (
                  <tr key={item.category} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8, fontWeight: 500 }}>
                      <Icon size={14} style={{ color: COLORS[item.category] }} /> {LABELS[item.category]}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'JetBrains Mono', color: 'var(--text-secondary)' }}>{fmt(item.expectedAnnual)}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'JetBrains Mono', fontWeight: 600 }}>{fmt(item.userAllocation)}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'JetBrains Mono', fontWeight: 600, color: item.difference >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                      {item.difference >= 0 ? '+' : '-'}{fmt(Math.abs(item.difference))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* MA vs National */}
      <div className="chart-card" style={{ marginBottom: 24 }}>
        <h3>Massachusetts vs National Average Costs</h3>
        <div className="chart-subtitle">Annual cost comparison across key categories</div>
        <div style={{ background: 'rgba(20,85,143,0.06)', border: '1px solid rgba(20,85,143,0.15)', borderRadius: 10, padding: '12px 16px', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.6 }}>
          <strong style={{ color: 'var(--accent-blue)' }}>All figures represent annual per-household costs</strong>
        </div>
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={comparisonData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
            <XAxis dataKey="name" stroke="rgba(0,0,0,0.4)" style={{ fontSize: 12 }} />
            <YAxis stroke="rgba(0,0,0,0.4)" style={{ fontSize: 12 }} tickFormatter={v => fmt(v)} />
            <Tooltip formatter={(v) => [fmt(v)]} contentStyle={tooltipStyle} />
            <Legend />
            <Bar dataKey="ma" fill="#14558F" name="Massachusetts" radius={[4,4,0,0]} />
            <Bar dataKey="national" fill="#95A5A6" name="National Average" radius={[4,4,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Cost Index Cards */}
      <div style={{ background: 'rgba(20,85,143,0.06)', border: '1px solid rgba(20,85,143,0.15)', borderRadius: 10, padding: '14px 18px', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.6 }}>
        <strong style={{ color: 'var(--accent-blue)' }}>Understanding Cost Index Scores:</strong> Each score compares Massachusetts costs to the national average of 100. A score of 159 for housing means MA housing costs are 59% higher than the U.S. average. Scores above 100 indicate higher-than-average costs; below 100 means lower. Source: Council for Community and Economic Research (C2ER) Cost of Living Index.
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, marginBottom: 24 }}>
        {Object.entries(MA_DATA.costIndices).map(([key, index]) => {
          const Icon = ICONS[key] || DollarSign;
          const isAbove = index > 100;
          return (
            <div key={key} className="chart-card" style={{ textAlign: 'center' }}>
              <Icon size={24} style={{ color: isAbove ? 'var(--accent-red)' : 'var(--accent-green)', marginBottom: 8 }} />
              <h3 style={{ fontSize: '0.95rem' }}>{LABELS[key] || key}</h3>
              <div style={{ fontSize: '2rem', fontWeight: 800, fontFamily: 'JetBrains Mono', margin: '8px 0', color: isAbove ? 'var(--accent-red)' : 'var(--accent-green)' }}>{index}</div>
              <div style={{ background: 'var(--bg-primary)', borderRadius: 6, height: 8, marginBottom: 8, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.min(index / 2, 100)}%`, background: isAbove ? 'var(--accent-red)' : 'var(--accent-green)', borderRadius: 6 }} />
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{isAbove ? '+' : ''}{index - 100}% vs US average</div>
            </div>
          );
        })}
      </div>

      {/* Key Insights */}
      <div className="card-grid" style={{ marginBottom: 24 }}>
        {[
          { icon: Home, title: 'Housing Crisis', color: 'var(--accent-red)', text: 'MA housing costs are 59% above the national average. The median home price is $575,000, requiring significant income to afford.' },
          { icon: TrendingUp, title: 'Living Wage Gap', color: 'var(--accent-blue)', text: 'A single parent with one child needs $45.37/hour to meet basic needs - over 3x the state minimum wage of $15.00/hr.' },
          { icon: Heart, title: 'Healthcare Costs', color: '#E67E22', text: 'MA healthcare costs are 15% above the national average, though the state maintains excellent quality and coverage rates.' },
          { icon: DollarSign, title: 'Tax Burden', color: '#9B59B6', text: 'MA residents pay ~6% of income in state and local taxes. Understanding where these taxes go helps inform participation in budget decisions.' },
        ].map(({ icon: Icon, title, color, text }) => (
          <div key={title} className="chart-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={18} style={{ color }} />
              </div>
              <h3 style={{ margin: 0 }}>{title}</h3>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.6, margin: 0 }}>{text}</p>
          </div>
        ))}
      </div>

      <div style={{ background: 'var(--bg-card-hover)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 18px', fontSize: '0.82rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <Info size={16} style={{ flexShrink: 0, marginTop: 2 }} />
        <span>Data based on 2024-2025 figures from MIT Living Wage Calculator, U.S. Census Bureau, and Massachusetts Department of Revenue. Figures are estimates for illustration purposes.</span>
      </div>
    </div>
  );
}
