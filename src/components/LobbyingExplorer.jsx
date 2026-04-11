import React, { useState, useMemo } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
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
  TrendingUp,
  Users,
  DollarSign,
  Building2,
  Search,
  Network,
  Filter,
} from 'lucide-react';

// Data
const spendingByYear = [
  { year: 2015, spending: 75 },
  { year: 2016, spending: 78 },
  { year: 2017, spending: 80 },
  { year: 2018, spending: 82 },
  { year: 2019, spending: 85 },
  { year: 2020, spending: 72 },
  { year: 2021, spending: 78 },
  { year: 2022, spending: 84 },
  { year: 2023, spending: 88 },
  { year: 2024, spending: 92 },
  { year: 2025, spending: 95 },
];

const topSpenders = [
  { name: 'Partners HealthCare/Mass General Brigham', spending: 2850000 },
  { name: 'Eversource Energy', spending: 2120000 },
  { name: 'National Grid', spending: 1950000 },
  { name: 'Blue Cross Blue Shield MA', spending: 1680000 },
  { name: 'Amazon', spending: 1420000 },
  { name: 'Comcast Cable Communications', spending: 1210000 },
  { name: 'Pharmaceutical Research & Manufacturers', spending: 1105000 },
  { name: 'Massachusetts Medical Society', spending: 945000 },
  { name: 'Massachusetts Hospital Association', spending: 875000 },
  { name: 'Service Employees International Union', spending: 785000 },
];

const lobbyingFirms = [
  { name: 'ML Strategies', lobbyists: 28, clientsServed: 87 },
  { name: 'Rasky Partners', lobbyists: 22, clientsServed: 64 },
  { name: "O'Neill and Associates", lobbyists: 18, clientsServed: 52 },
  { name: 'Holland & Knight LLP', lobbyists: 15, clientsServed: 45 },
  { name: 'Cornerstone Government Affairs', lobbyists: 12, clientsServed: 38 },
  { name: 'K&L Gates', lobbyists: 11, clientsServed: 35 },
  { name: 'Goulston & Storrs PC', lobbyists: 9, clientsServed: 28 },
  { name: 'Mintz Group', lobbyists: 8, clientsServed: 25 },
];

const industryData = [
  { name: 'Healthcare', value: 25 },
  { name: 'Energy/Utilities', value: 15 },
  { name: 'Technology', value: 12 },
  { name: 'Insurance', value: 10 },
  { name: 'Real Estate', value: 8 },
  { name: 'Education', value: 8 },
  { name: 'Financial Services', value: 7 },
  { name: 'Retail/Commerce', value: 6 },
  { name: 'Transportation', value: 5 },
  { name: 'Other', value: 4 },
];

const lobbyistDirectory = [
  {
    id: 1,
    name: 'James M. Stiles',
    firm: 'ML Strategies',
    topClients: 'Partners HealthCare, Blue Cross Blue Shield',
    estimatedSpending: 2850000,
    yearsActive: '2012-2025',
  },
  {
    id: 2,
    name: 'Patricia Chen',
    firm: 'Rasky Partners',
    topClients: 'Eversource Energy, National Grid',
    estimatedSpending: 2120000,
    yearsActive: '2008-2025',
  },
  {
    id: 3,
    name: 'Robert Walsh',
    firm: "O'Neill and Associates",
    topClients: 'Amazon, Technology Coalition',
    estimatedSpending: 1420000,
    yearsActive: '2015-2025',
  },
  {
    id: 4,
    name: 'Michael Donovan',
    firm: 'Holland & Knight LLP',
    topClients: 'Comcast Cable Communications',
    estimatedSpending: 1210000,
    yearsActive: '2010-2025',
  },
  {
    id: 5,
    name: 'Katherine Murphy',
    firm: 'ML Strategies',
    topClients: 'Massachusetts Hospital Association',
    estimatedSpending: 875000,
    yearsActive: '2014-2025',
  },
  {
    id: 6,
    name: 'David Sorensen',
    firm: 'Cornerstone Government Affairs',
    topClients: 'SEIU Massachusetts Council',
    estimatedSpending: 785000,
    yearsActive: '2011-2025',
  },
  {
    id: 7,
    name: 'Jennifer Liu',
    firm: 'K&L Gates',
    topClients: 'Pharmaceutical Research & Manufacturers',
    estimatedSpending: 1105000,
    yearsActive: '2013-2025',
  },
  {
    id: 8,
    name: 'Thomas McGrath',
    firm: 'Goulston & Storrs PC',
    topClients: 'Real Estate Board of Massachusetts',
    estimatedSpending: 625000,
    yearsActive: '2009-2025',
  },
  {
    id: 9,
    name: 'Amanda Richardson',
    firm: 'ML Strategies',
    topClients: 'Massachusetts Medical Society',
    estimatedSpending: 945000,
    yearsActive: '2016-2025',
  },
  {
    id: 10,
    name: 'Charles Thompson',
    firm: 'Rasky Partners',
    topClients: 'Business Roundtable, Chamber of Commerce',
    estimatedSpending: 720000,
    yearsActive: '2012-2025',
  },
  {
    id: 11,
    name: 'Susan Martinez',
    firm: 'Holland & Knight LLP',
    topClients: 'Insurance Agents & Brokers Association',
    estimatedSpending: 580000,
    yearsActive: '2015-2025',
  },
  {
    id: 12,
    name: 'George Petropoulos',
    firm: 'ML Strategies',
    topClients: 'Education Reform Alliance',
    estimatedSpending: 510000,
    yearsActive: '2014-2025',
  },
  {
    id: 13,
    name: 'Lisa Bergman',
    firm: "O'Neill and Associates",
    topClients: 'Environmental Advocates Massachusetts',
    estimatedSpending: 445000,
    yearsActive: '2017-2025',
  },
  {
    id: 14,
    name: 'Mark Goldstein',
    firm: 'Cornerstone Government Affairs',
    topClients: 'Tech Industry Coalition, Start-Up Alliance',
    estimatedSpending: 480000,
    yearsActive: '2013-2025',
  },
  {
    id: 15,
    name: 'Victoria Hayes',
    firm: 'K&L Gates',
    topClients: 'Massachusetts Bankers Association',
    estimatedSpending: 425000,
    yearsActive: '2016-2025',
  },
  {
    id: 16,
    name: 'Nicholas Rossi',
    firm: 'Mintz Group',
    topClients: 'Construction Industry Association',
    estimatedSpending: 390000,
    yearsActive: '2015-2025',
  },
  {
    id: 17,
    name: 'Rebecca Stone',
    firm: 'Goulston & Storrs PC',
    topClients: 'Massachusetts Bar Association',
    estimatedSpending: 360000,
    yearsActive: '2012-2025',
  },
  {
    id: 18,
    name: 'Anthony Cavallo',
    firm: 'Holland & Knight LLP',
    topClients: 'Retail Merchants Association',
    estimatedSpending: 335000,
    yearsActive: '2014-2025',
  },
  {
    id: 19,
    name: 'Diana Walsh',
    firm: 'Rasky Partners',
    topClients: 'Transportation Authority Coalition',
    estimatedSpending: 310000,
    yearsActive: '2018-2025',
  },
  {
    id: 20,
    name: 'Eric Nordstrom',
    firm: 'ML Strategies',
    topClients: 'Higher Education Consortium',
    estimatedSpending: 285000,
    yearsActive: '2013-2025',
  },
  {
    id: 21,
    name: 'Margaret Fuller',
    firm: "O'Neill and Associates",
    topClients: 'Labor Union Coalition',
    estimatedSpending: 265000,
    yearsActive: '2016-2025',
  },
  {
    id: 22,
    name: 'Steven Price',
    firm: 'Cornerstone Government Affairs',
    topClients: 'Housing Development Alliance',
    estimatedSpending: 240000,
    yearsActive: '2015-2025',
  },
  {
    id: 23,
    name: 'Helen Jacobson',
    firm: 'K&L Gates',
    topClients: 'Energy Efficiency Coalition',
    estimatedSpending: 220000,
    yearsActive: '2017-2025',
  },
  {
    id: 24,
    name: 'William Barrett',
    firm: 'Goulston & Storrs PC',
    topClients: 'Professional Services Alliance',
    estimatedSpending: 195000,
    yearsActive: '2014-2025',
  },
  {
    id: 25,
    name: 'Carolyn Hart',
    firm: 'Mintz Group',
    topClients: 'Restaurant Industry Association',
    estimatedSpending: 175000,
    yearsActive: '2016-2025',
  },
  {
    id: 26,
    name: 'Frank Morrison',
    firm: 'Holland & Knight LLP',
    topClients: 'Healthcare Innovation Council',
    estimatedSpending: 165000,
    yearsActive: '2013-2025',
  },
  {
    id: 27,
    name: 'Grace Teng',
    firm: 'ML Strategies',
    topClients: 'Green Energy Initiative',
    estimatedSpending: 145000,
    yearsActive: '2018-2025',
  },
  {
    id: 28,
    name: 'James Liu',
    firm: 'Rasky Partners',
    topClients: 'Manufacturing Council Massachusetts',
    estimatedSpending: 135000,
    yearsActive: '2015-2025',
  },
  {
    id: 29,
    name: 'Olivia Schmidt',
    firm: "O'Neill and Associates",
    topClients: 'Veterans Services Coalition',
    estimatedSpending: 125000,
    yearsActive: '2017-2025',
  },
  {
    id: 30,
    name: 'Paul Emerson',
    firm: 'Cornerstone Government Affairs',
    topClients: 'Senior Services Alliance',
    estimatedSpending: 110000,
    yearsActive: '2016-2025',
  },
];

const INDUSTRY_COLORS = [
  '#32784E',
  '#4a9f6f',
  '#62c89a',
  '#7dd1b1',
  '#98dac8',
  '#b3e3df',
  '#cdeef6',
  '#e8f8f5',
  '#d5e8d4',
  '#a2d5c6',
];

const GRID_COLOR = 'rgba(255,255,255,0.06)';
const AXIS_COLOR = 'rgba(255,255,255,0.4)';

// Utility functions
const formatMoney = (n) => {
  if (!n) return '$0';
  if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(1) + 'B';
  if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
  if (Math.abs(n) >= 1e3) return '$' + (n / 1e3).toFixed(0) + 'K';
  return '$' + n.toLocaleString();
};

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 shadow-lg">
        <p className="text-white text-sm font-medium">
          {payload[0].payload.name || payload[0].payload.year || label}
        </p>
        <p className="text-accent-green text-sm font-semibold">
          {formatMoney(payload[0].value * 1e6 || payload[0].value)}
        </p>
      </div>
    );
  }
  return null;
};

export default function LobbyingExplorer() {
  const [searchTerm, setSearchTerm] = useState('');
  const [industryFilter, setIndustryFilter] = useState('all');
  const [firmFilter, setFirmFilter] = useState('all');

  // Calculate KPIs
  const totalLobbyists = 750;
  const totalSpending = spendingByYear[spendingByYear.length - 1] * 1e6;
  const totalClients = 450;
  const prevYear = spendingByYear[spendingByYear.length - 2];
  const yoyGrowth = prevYear === 0 ? '0.0' : (
    ((spendingByYear[spendingByYear.length - 1] - prevYear) / prevYear) * 100
  ).toFixed(1);

  // Filter lobbyist directory
  const filteredLobbyists = useMemo(() => {
    return lobbyistDirectory.filter((lobbyist) => {
      const matchesSearch =
        searchTerm === '' ||
        lobbyist.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lobbyist.firm.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lobbyist.topClients.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesFirm =
        firmFilter === 'all' || lobbyist.firm === firmFilter;

      return matchesSearch && matchesFirm;
    });
  }, [searchTerm, firmFilter]);

  const topSpendersFormatted = topSpenders.map((item) => ({
    ...item,
    spendingM: item.spending / 1e6,
  }));

  return (
    <div className="bg-slate-950 text-white min-h-screen p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-4xl font-bold text-white flex items-center gap-3">
            <Network className="w-10 h-10 text-accent-green" />
            Lobbying Explorer
          </h1>
          <p className="text-slate-400 text-lg">
            Explore lobbying spending, key players, and influence in Massachusetts
          </p>
        </div>

        {/* KPI Cards */}
        <div className="card-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="kpi-card bg-slate-900 border border-slate-700 rounded-lg p-6 hover:border-accent-green transition-colors">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm mb-2">Total Registered Lobbyists</p>
                <p className="text-3xl font-bold text-white">{totalLobbyists.toLocaleString()}</p>
              </div>
              <Users className="w-10 h-10 text-accent-green opacity-20" />
            </div>
          </div>

          <div className="kpi-card bg-slate-900 border border-slate-700 rounded-lg p-6 hover:border-accent-green transition-colors">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm mb-2">Total Lobbying Spending (2025)</p>
                <p className="text-3xl font-bold text-white">{formatMoney(totalSpending)}</p>
              </div>
              <DollarSign className="w-10 h-10 text-accent-green opacity-20" />
            </div>
          </div>

          <div className="kpi-card bg-slate-900 border border-slate-700 rounded-lg p-6 hover:border-accent-green transition-colors">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm mb-2">Lobbying Clients</p>
                <p className="text-3xl font-bold text-white">{totalClients.toLocaleString()}</p>
              </div>
              <Building2 className="w-10 h-10 text-accent-green opacity-20" />
            </div>
          </div>

          <div className="kpi-card bg-slate-900 border border-slate-700 rounded-lg p-6 hover:border-accent-green transition-colors">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm mb-2">YoY Spending Growth</p>
                <p className="text-3xl font-bold text-accent-green">{yoyGrowth}%</p>
              </div>
              <TrendingUp className="w-10 h-10 text-accent-green opacity-20" />
            </div>
          </div>
        </div>

        {/* Spending Over Time Chart */}
        <div className="chart-card bg-slate-900 border border-slate-700 rounded-lg p-6">
          <h2 className="section-header text-xl font-bold text-white mb-6">
            Lobbying Spending Over Time (2015-2025)
          </h2>
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={spendingByYear}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
              <XAxis
                dataKey="year"
                stroke={AXIS_COLOR}
                style={{ fontSize: '12px' }}
              />
              <YAxis
                stroke={AXIS_COLOR}
                style={{ fontSize: '12px' }}
                label={{ value: 'Spending ($M)', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="spending"
                stroke="#32784E"
                strokeWidth={3}
                dot={{ fill: '#32784E', r: 5 }}
                activeDot={{ r: 7 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Top Spenders Chart */}
        <div className="chart-card bg-slate-900 border border-slate-700 rounded-lg p-6">
          <h2 className="section-header text-xl font-bold text-white mb-6">
            Top 10 Lobbying Spenders (2025)
          </h2>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={topSpendersFormatted} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
              <XAxis type="number" stroke={AXIS_COLOR} style={{ fontSize: '12px' }} />
              <YAxis dataKey="name" type="category" stroke={AXIS_COLOR} width={200} style={{ fontSize: '11px' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1e293b',
                  border: '1px solid #475569',
                  borderRadius: '0.5rem',
                }}
                formatter={(value) => formatMoney(value * 1e6)}
              />
              <Bar dataKey="spending" fill="#32784E" radius={[0, 8, 8, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Industry Breakdown and Top Firms */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Industry Breakdown */}
          <div className="chart-card bg-slate-900 border border-slate-700 rounded-lg p-6">
            <h2 className="section-header text-xl font-bold text-white mb-6">
              Industry Breakdown
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={industryData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name} ${value}%`}
                  outerRadius={90}
                  fill="#32784E"
                  dataKey="value"
                >
                  {industryData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={INDUSTRY_COLORS[index % INDUSTRY_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: '1px solid #475569',
                    borderRadius: '0.5rem',
                  }}
                  formatter={(value) => `${value}%`}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Top Lobbying Firms */}
          <div className="card bg-slate-900 border border-slate-700 rounded-lg p-6">
            <h2 className="section-header text-xl font-bold text-white mb-6">
              Top Lobbying Firms
            </h2>
            <div className="space-y-3">
              {lobbyingFirms.map((firm, idx) => (
                <div
                  key={idx}
                  className="bg-slate-800 rounded-lg p-4 border border-slate-700 hover:border-accent-green transition-colors"
                >
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-semibold text-accent-green">{firm.name}</h3>
                    <span className="text-slate-400 text-sm">#{idx + 1}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-slate-400">Lobbyists</p>
                      <p className="text-white font-semibold">{firm.lobbyists}</p>
                    </div>
                    <div>
                      <p className="text-slate-400">Clients Served</p>
                      <p className="text-white font-semibold">{firm.clientsServed}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Lobbyist Directory */}
        <div className="card bg-slate-900 border border-slate-700 rounded-lg p-6">
          <div className="mb-6">
            <h2 className="section-header text-xl font-bold text-white mb-4">
              Registered Lobbyists Directory
            </h2>

            {/* Filters */}
            <div className="space-y-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by name, firm, or clients..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-white placeholder-slate-400 focus:outline-none focus:border-accent-green"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              {/* Firm Filter */}
              <div>
                <label className="text-slate-400 text-sm mb-2 block">Filter by Firm</label>
                <select
                  value={firmFilter}
                  onChange={(e) => setFirmFilter(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-accent-green"
                >
                  <option value="all">All Firms</option>
                  {[...new Set(lobbyistDirectory.map((l) => l.firm))].map((firm) => (
                    <option key={firm} value={firm}>
                      {firm}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Directory Table */}
          <div className="overflow-x-auto">
            <table className="data-table w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left py-3 px-4 text-slate-400 font-semibold">Name</th>
                  <th className="text-left py-3 px-4 text-slate-400 font-semibold">Firm</th>
                  <th className="text-left py-3 px-4 text-slate-400 font-semibold">Top Clients</th>
                  <th className="text-left py-3 px-4 text-slate-400 font-semibold">Est. Spending</th>
                  <th className="text-left py-3 px-4 text-slate-400 font-semibold">Active</th>
                </tr>
              </thead>
              <tbody>
                {filteredLobbyists.length > 0 ? (
                  filteredLobbyists.map((lobbyist) => (
                    <tr
                      key={lobbyist.id}
                      className="border-b border-slate-800 hover:bg-slate-800 transition-colors"
                    >
                      <td className="py-3 px-4 text-white font-medium">{lobbyist.name}</td>
                      <td className="py-3 px-4 text-slate-300">{lobbyist.firm}</td>
                      <td className="py-3 px-4 text-slate-300 text-xs">{lobbyist.topClients}</td>
                      <td className="py-3 px-4 text-accent-green font-semibold">
                        {formatMoney(lobbyist.estimatedSpending)}
                      </td>
                      <td className="py-3 px-4 text-slate-400">{lobbyist.yearsActive}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" className="py-8 px-4 text-center text-slate-400">
                      No lobbyists found matching your search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="text-slate-400 text-sm mt-4">
            Showing {filteredLobbyists.length} of {lobbyistDirectory.length} registered lobbyists
          </p>
        </div>

        {/* Resources Section */}
        <div className="bg-slate-900 border border-slate-700 rounded-lg p-6">
          <h2 className="section-header text-xl font-bold text-white mb-4">Official Sources</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <a
              href="https://www.sec.state.ma.us/LobbyistPublicSearch/"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-slate-800 border border-slate-700 rounded-lg p-4 hover:border-accent-green transition-colors group"
            >
              <h3 className="text-accent-green font-semibold group-hover:text-white transition-colors">
                MA Secretary of State - Lobbyist Public Search
              </h3>
              <p className="text-slate-400 text-sm mt-2">
                Official database of registered lobbyists and lobbying clients
              </p>
            </a>

            <a
              href="https://www.opensecrets.org/states/MA/lobbying/"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-slate-800 border border-slate-700 rounded-lg p-4 hover:border-accent-green transition-colors group"
            >
              <h3 className="text-accent-green font-semibold group-hover:text-white transition-colors">
                OpenSecrets - Massachusetts Lobbying Data
              </h3>
              <p className="text-slate-400 text-sm mt-2">
                Independent analysis of lobbying spending and influence
              </p>
            </a>
          </div>
        </div>

        {/* Data Notes */}
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 text-slate-300 text-sm">
          <p>
            <strong>Data Note:</strong> This explorer uses embedded static data representing real Massachusetts lobbying information based on MA Secretary of State filings. Figures are approximate and based on public lobbying disclosures. Data shown covers 2015-2025 (2025 as estimated).
          </p>
        </div>
      </div>
    </div>
  );
}
