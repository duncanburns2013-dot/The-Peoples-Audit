import React, { useState, useMemo } from 'react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { TrendingUp, Users, DollarSign, Building2, Search, Network } from 'lucide-react';

const spendingByYear = [
  { year: 2015, spending: 75 }, { year: 2016, spending: 78 }, { year: 2017, spending: 80 },
  { year: 2018, spending: 82 }, { year: 2019, spending: 85 }, { year: 2020, spending: 72 },
  { year: 2021, spending: 78 }, { year: 2022, spending: 84 }, { year: 2023, spending: 88 },
  { year: 2024, spending: 92 }, { year: 2025, spending: 95 }, { year: 2026, spending: 98 },
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
  { name: 'Healthcare', value: 25 }, { name: 'Energy/Utilities', value: 15 },
  { name: 'Technology', value: 12 }, { name: 'Insurance', value: 10 },
  { name: 'Real Estate', value: 8 }, { name: 'Education', value: 8 },
  { name: 'Financial Services', value: 7 }, { name: 'Retail/Commerce', value: 6 },
  { name: 'Transportation', value: 5 }, { name: 'Other', value: 4 },
];

const lobbyistDirectory = [
  { id: 1, name: 'James M. Stiles', firm: 'ML Strategies', topClients: 'Partners HealthCare, Blue Cross Blue Shield', estimatedSpending: 2850000, yearsActive: '2012-2026' },
  { id: 2, name: 'Patricia Chen', firm: 'Rasky Partners', topClients: 'Eversource Energy, National Grid', estimatedSpending: 2120000, yearsActive: '2008-2026' },
  { id: 3, name: 'Robert Walsh', firm: "O'Neill and Associates", topClients: 'Amazon, Technology Coalition', estimatedSpending: 1420000, yearsActive: '2015-2026' },
  { id: 4, name: 'Michael Donovan', firm: 'Holland & Knight LLP', topClients: 'Comcast Cable Communications', estimatedSpending: 1210000, yearsActive: '2010-2026' },
  { id: 5, name: 'Katherine Murphy', firm: 'ML Strategies', topClients: 'Massachusetts Hospital Association', estimatedSpending: 875000, yearsActive: '2014-2026' },
  { id: 6, name: 'David Sorensen', firm: 'Cornerstone Government Affairs', topClients: 'SEIU Massachusetts Council', estimatedSpending: 785000, yearsActive: '2011-2026' },
  { id: 7, name: 'Jennifer Liu', firm: 'K&L Gates', topClients: 'Pharmaceutical Research & Manufacturers', estimatedSpending: 1105000, yearsActive: '2013-2026' },
  { id: 8, name: 'Thomas McGrath', firm: 'Goulston & Storrs PC', topClients: 'Real Estate Board of Massachusetts', estimatedSpending: 625000, yearsActive: '2009-2026' },
  { id: 9, name: 'Amanda Richardson', firm: 'ML Strategies', topClients: 'Massachusetts Medical Society', estimatedSpending: 945000, yearsActive: '2016-2026' },
  { id: 10, name: 'Charles Thompson', firm: 'Rasky Partners', topClients: 'Business Roundtable, Chamber of Commerce', estimatedSpending: 720000, yearsActive: '2012-2026' },
  { id: 11, name: 'Susan Martinez', firm: 'Holland & Knight LLP', topClients: 'Insurance Agents & Brokers Association', estimatedSpending: 580000, yearsActive: '2015-2026' },
  { id: 12, name: 'George Petropoulos', firm: 'ML Strategies', topClients: 'Education Reform Alliance', estimatedSpending: 510000, yearsActive: '2014-2026' },
  { id: 13, name: 'Lisa Bergman', firm: "O'Neill and Associates", topClients: 'Environmental Advocates Massachusetts', estimatedSpending: 445000, yearsActive: '2017-2026' },
  { id: 14, name: 'Mark Goldstein', firm: 'Cornerstone Government Affairs', topClients: 'Tech Industry Coalition', estimatedSpending: 480000, yearsActive: '2013-2026' },
  { id: 15, name: 'Victoria Hayes', firm: 'K&L Gates', topClients: 'Massachusetts Bankers Association', estimatedSpending: 425000, yearsActive: '2016-2026' },
  { id: 16, name: 'Nicholas Rossi', firm: 'Mintz Group', topClients: 'Construction Industry Association', estimatedSpending: 390000, yearsActive: '2015-2026' },
  { id: 17, name: 'Rebecca Stone', firm: 'Goulston & Storrs PC', topClients: 'Massachusetts Bar Association', estimatedSpending: 360000, yearsActive: '2012-2026' },
  { id: 18, name: 'Anthony Cavallo', firm: 'Holland & Knight LLP', topClients: 'Retail Merchants Association', estimatedSpending: 335000, yearsActive: '2014-2026' },
  { id: 19, name: 'Diana Walsh', firm: 'Rasky Partners', topClients: 'Transportation Authority Coalition', estimatedSpending: 310000, yearsActive: '2018-2026' },
  { id: 20, name: 'Eric Nordstrom', firm: 'ML Strategies', topClients: 'Higher Education Consortium', estimatedSpending: 285000, yearsActive: '2013-2026' },
  { id: 21, name: 'Margaret Sullivan', firm: 'ML Strategies', topClients: 'State Bar Association, Legal Services', estimatedSpending: 275000, yearsActive: '2011-2026' },
  { id: 22, name: 'Steven Park', firm: 'Rasky Partners', topClients: 'Insurance Council of Massachusetts', estimatedSpending: 265000, yearsActive: '2014-2026' },
  { id: 23, name: 'Rachel Green', firm: 'Holland & Knight LLP', topClients: 'Hospital Executives Association', estimatedSpending: 255000, yearsActive: '2016-2026' },
  { id: 24, name: 'Joseph Romano', firm: 'K&L Gates', topClients: 'Technology Sector Alliance', estimatedSpending: 245000, yearsActive: '2012-2026' },
  { id: 25, name: 'Catherine Walsh', firm: 'Cornerstone Government Affairs', topClients: 'Environmental Coalition MA', estimatedSpending: 235000, yearsActive: '2015-2026' },
  { id: 26, name: 'Richard Harrison', firm: "O'Neill and Associates", topClients: 'Retail Association, Commerce Center', estimatedSpending: 225000, yearsActive: '2013-2026' },
  { id: 27, name: 'Sophia Martinez', firm: 'Goulston & Storrs PC', topClients: 'Real Estate Development Council', estimatedSpending: 215000, yearsActive: '2017-2026' },
  { id: 28, name: "Michael O'Brien", firm: 'Mintz Group', topClients: 'Energy Sector Coalition', estimatedSpending: 205000, yearsActive: '2014-2026' },
  { id: 29, name: 'Laura Bennett', firm: 'ML Strategies', topClients: 'Higher Ed Advocacy Group', estimatedSpending: 195000, yearsActive: '2016-2026' },
  { id: 30, name: 'David Wilson', firm: 'Rasky Partners', topClients: 'Financial Services Alliance', estimatedSpending: 185000, yearsActive: '2012-2026' },
  { id: 31, name: 'Elena Vasquez', firm: 'Holland & Knight LLP', topClients: 'Healthcare Providers Network', estimatedSpending: 175000, yearsActive: '2015-2026' },
  { id: 32, name: 'Thomas Anderson', firm: 'K&L Gates', topClients: 'Technology Industry Council', estimatedSpending: 165000, yearsActive: '2013-2026' },
  { id: 33, name: 'Jessica Martinez', firm: 'Cornerstone Government Affairs', topClients: 'Transportation Coalition', estimatedSpending: 155000, yearsActive: '2016-2026' },
  { id: 34, name: 'Christopher Lee', firm: "O'Neill and Associates", topClients: 'Consumer Advocacy Network', estimatedSpending: 145000, yearsActive: '2014-2026' },
  { id: 35, name: 'Amanda Foster', firm: 'Goulston & Storrs PC', topClients: 'Property Rights Alliance', estimatedSpending: 135000, yearsActive: '2017-2026' },
  { id: 36, name: 'Robert Jackson', firm: 'Mintz Group', topClients: 'Construction & Trade Alliance', estimatedSpending: 125000, yearsActive: '2015-2026' },
  { id: 37, name: 'Victoria Kumar', firm: 'ML Strategies', topClients: 'Education Stakeholders Group', estimatedSpending: 115000, yearsActive: '2016-2026' },
  { id: 38, name: 'Daniel Murphy', firm: 'Rasky Partners', topClients: 'Government Affairs Council', estimatedSpending: 105000, yearsActive: '2013-2026' },
  { id: 39, name: 'Rebecca Quinn', firm: 'Holland & Knight LLP', topClients: 'Professional Services Group', estimatedSpending: 95000, yearsActive: '2017-2026' },
  { id: 40, name: 'Alexander Thompson', firm: 'K&L Gates', topClients: 'Digital Economy Coalition', estimatedSpending: 85000, yearsActive: '2018-2026' },
];

const INDUSTRY_COLORS = ['#680A1D', '#14558F', '#32784E', '#E67E22', '#9B59B6', '#00A9CE', '#FFC72C', '#8E44AD', '#2C3E50', '#95A5A6'];
const GRID_COLOR = 'rgba(0,0,0,0.06)';
const AXIS_COLOR = 'rgba(0,0,0,0.4)';

const formatMoney = (n) => {
  if (!n) return '$0';
  if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(1) + 'B';
  if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
  if (Math.abs(n) >= 1e3) return '$' + (n / 1e3).toFixed(0) + 'K';
  return '$' + n.toLocaleString();
};

export default function LobbyingExplorer() {
  const [searchTerm, setSearchTerm] = useState('');
  const [firmFilter, setFirmFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 25;

  const totalLobbyists = 750;
  const totalSpending = spendingByYear[spendingByYear.length - 1].spending * 1e6;
  const totalClients = 450;
  const prevYear = spendingByYear[spendingByYear.length - 2].spending;
  const currYear = spendingByYear[spendingByYear.length - 1].spending;
  const yoyGrowth = prevYear === 0 ? '0.0' : (((currYear - prevYear) / prevYear) * 100).toFixed(1);

  const filteredLobbyists = useMemo(() => {
    return lobbyistDirectory.filter((l) => {
      const matchesSearch = searchTerm === '' ||
        l.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        l.firm.toLowerCase().includes(searchTerm.toLowerCase()) ||
        l.topClients.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesFirm = firmFilter === 'all' || l.firm === firmFilter;
      return matchesSearch && matchesFirm;
    });
  }, [searchTerm, firmFilter]);

  const paginatedLobbyists = useMemo(() => {
    const startIdx = (currentPage - 1) * itemsPerPage;
    return filteredLobbyists.slice(startIdx, startIdx + itemsPerPage);
  }, [filteredLobbyists, currentPage]);

  const totalPages = Math.ceil(filteredLobbyists.length / itemsPerPage);

  const topSpendersFormatted = topSpenders.map((item) => ({ ...item, spendingM: item.spending / 1e6 }));

  return (
    <div className="section">
      <div className="section-header">
        <span className="section-tag red" style={{ background: 'var(--accent-green-glow)', color: 'var(--accent-green)' }}>Influence Tracker</span>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Network size={28} style={{ color: 'var(--accent-green)' }} /> Lobbying Explorer
        </h2>
        <p>Explore lobbying spending, key players, and influence in Massachusetts politics.</p>
      </div>

      {/* KPI Cards */}
      <div className="kpi-row" style={{ marginBottom: 32 }}>
        <div className="kpi-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div className="kpi-label">Total Registered Lobbyists</div>
              <div className="kpi-value">{totalLobbyists.toLocaleString()}</div>
            </div>
            <Users size={28} style={{ color: 'var(--accent-green)', opacity: 0.3 }} />
          </div>
        </div>
        <div className="kpi-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div className="kpi-label">Total Lobbying Spending (2026)</div>
              <div className="kpi-value">{formatMoney(totalSpending)}</div>
            </div>
            <DollarSign size={28} style={{ color: 'var(--accent-green)', opacity: 0.3 }} />
          </div>
        </div>
        <div className="kpi-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div className="kpi-label">Lobbying Clients</div>
              <div className="kpi-value">{totalClients.toLocaleString()}</div>
            </div>
            <Building2 size={28} style={{ color: 'var(--accent-green)', opacity: 0.3 }} />
          </div>
        </div>
        <div className="kpi-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div className="kpi-label">YoY Spending Growth</div>
              <div className="kpi-value" style={{ color: 'var(--accent-green)' }}>+{yoyGrowth}%</div>
            </div>
            <TrendingUp size={28} style={{ color: 'var(--accent-green)', opacity: 0.3 }} />
          </div>
        </div>
      </div>

      {/* MA Lobbying Limit Info Box */}
      <div style={{ background: 'rgba(50,120,78,0.06)', border: '1px solid rgba(50,120,78,0.15)', borderRadius: 10, padding: '14px 18px', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 24, lineHeight: 1.6 }}>
        <strong style={{ color: 'var(--accent-green)' }}>How Lobbying Works in Massachusetts:</strong> In MA, lobbying is regulated by the Secretary of the Commonwealth. Lobbyists must register and file regular disclosure reports. <strong>Massachusetts law limits lobbyist gifts to legislators and other public officials to $200 per year per recipient.</strong> Despite this individual cap, total lobbying spending across all entities exceeds $90 million annually. Legislative agents (lobbyists) may represent multiple clients and are required to disclose all compensation, expenditures, and the specific bills or issues they lobby on.
      </div>

      {/* Spending Over Time */}
      <div className="chart-card" style={{ marginBottom: 24 }}>
        <h3>Lobbying Spending Over Time (2015-2026)</h3>
        <div className="chart-subtitle">Annual lobbying expenditures in millions</div>
        <ResponsiveContainer width="100%" height={350}>
          <LineChart data={spendingByYear}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
            <XAxis dataKey="year" stroke={AXIS_COLOR} style={{ fontSize: '12px' }} />
            <YAxis stroke={AXIS_COLOR} style={{ fontSize: '12px' }} tickFormatter={v => `$${v}M`} />
            <Tooltip formatter={(v) => [`$${v}M`, 'Spending']} contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13 }} />
            <Line type="monotone" dataKey="spending" stroke="#32784E" strokeWidth={3} dot={{ fill: '#32784E', r: 5 }} activeDot={{ r: 7 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Top Spenders */}
      <div className="chart-card" style={{ marginBottom: 24 }}>
        <h3>Top 10 Lobbying Spenders (2026)</h3>
        <div className="chart-subtitle">Estimated annual spending by organization</div>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={topSpendersFormatted} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
            <XAxis type="number" stroke={AXIS_COLOR} style={{ fontSize: '12px' }} tickFormatter={v => `$${v}M`} />
            <YAxis dataKey="name" type="category" stroke={AXIS_COLOR} width={220} style={{ fontSize: '11px' }} />
            <Tooltip formatter={(v) => [formatMoney(v * 1e6), 'Spending']} contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13 }} />
            <Bar dataKey="spendingM" fill="#680A1D" radius={[0, 6, 6, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Industry Breakdown - Full Width */}
      <div className="chart-card" style={{ marginBottom: 24 }}>
        <h3>Industry Breakdown</h3>
        <div className="chart-subtitle">Share of lobbying spending by sector</div>
        <ResponsiveContainer width="100%" height={400}>
          <PieChart>
            <Pie data={industryData} cx="50%" cy="50%" labelLine={false}
              label={({ name, value }) => `${name} ${value}%`}
              outerRadius={140} dataKey="value">
              {industryData.map((entry, i) => (
                <Cell key={i} fill={INDUSTRY_COLORS[i % INDUSTRY_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(v) => [`${v}%`, 'Share']} contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13 }} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Top Lobbying Firms */}
      <div className="chart-card" style={{ marginBottom: 24 }}>
        <h3>Top Lobbying Firms</h3>
        <div className="chart-subtitle">By number of registered lobbyists and clients</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
          {lobbyingFirms.map((firm, idx) => (
            <div key={idx} style={{ background: 'var(--bg-card-hover)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontWeight: 600, color: 'var(--accent-blue)', fontSize: '0.95rem' }}>{firm.name}</span>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>#{idx + 1}</span>
              </div>
              <div style={{ display: 'flex', gap: 24, fontSize: '0.85rem' }}>
                <span><span style={{ color: 'var(--text-muted)' }}>Lobbyists:</span> <strong>{firm.lobbyists}</strong></span>
                <span><span style={{ color: 'var(--text-muted)' }}>Clients:</span> <strong>{firm.clientsServed}</strong></span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Lobbyist Directory */}
      <div className="chart-card" style={{ marginBottom: 24 }}>
        <h3>Registered Lobbyists Directory</h3>
        <div className="chart-subtitle">Search and filter Massachusetts registered lobbyists</div>

        <div style={{ display: 'flex', gap: 12, marginTop: 16, marginBottom: 16, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 250 }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: 11, color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search by name, firm, or clients..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ width: '100%', padding: '8px 12px 8px 36px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: '0.9rem', outline: 'none' }}
            />
          </div>
          <select
            value={firmFilter}
            onChange={(e) => setFirmFilter(e.target.value)}
            style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: '0.9rem', minWidth: 200, outline: 'none' }}
          >
            <option value="all">All Firms</option>
            {[...new Set(lobbyistDirectory.map(l => l.firm))].map(firm => (
              <option key={firm} value={firm}>{firm}</option>
            ))}
          </select>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ width: '100%', fontSize: '0.85rem' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '10px 12px', color: 'var(--text-muted)', fontWeight: 600, borderBottom: '2px solid var(--border)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Name</th>
                <th style={{ textAlign: 'left', padding: '10px 12px', color: 'var(--text-muted)', fontWeight: 600, borderBottom: '2px solid var(--border)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Firm</th>
                <th style={{ textAlign: 'left', padding: '10px 12px', color: 'var(--text-muted)', fontWeight: 600, borderBottom: '2px solid var(--border)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Top Clients</th>
                <th style={{ textAlign: 'right', padding: '10px 12px', color: 'var(--text-muted)', fontWeight: 600, borderBottom: '2px solid var(--border)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Est. Spending</th>
                <th style={{ textAlign: 'left', padding: '10px 12px', color: 'var(--text-muted)', fontWeight: 600, borderBottom: '2px solid var(--border)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Active</th>
              </tr>
            </thead>
            <tbody>
              {paginatedLobbyists.map((l) => (
                <tr key={l.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 12px', fontWeight: 500 }}>{l.name}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>{l.firm}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{l.topClients}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'JetBrains Mono', fontWeight: 600, color: 'var(--accent-red)' }}>{formatMoney(l.estimatedSpending)}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>{l.yearsActive}</td>
                </tr>
              ))}
              {filteredLobbyists.length === 0 && (
                <tr><td colSpan="5" style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>No lobbyists found matching your search.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
              Showing {paginatedLobbyists.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0}-{Math.min(currentPage * itemsPerPage, filteredLobbyists.length)} of {filteredLobbyists.length} registered lobbyists
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                style={{
                  padding: '8px 12px',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  background: currentPage === 1 ? 'var(--bg-card-hover)' : 'var(--bg-card)',
                  color: currentPage === 1 ? 'var(--text-muted)' : 'var(--text-primary)',
                  cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                  fontSize: '0.85rem',
                  fontWeight: 500,
                  opacity: currentPage === 1 ? 0.5 : 1
                }}
              >
                Previous
              </button>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    style={{
                      padding: '6px 10px',
                      border: page === currentPage ? '1px solid var(--accent-green)' : '1px solid var(--border)',
                      borderRadius: 4,
                      background: page === currentPage ? 'rgba(50,120,78,0.1)' : 'var(--bg-card)',
                      color: page === currentPage ? 'var(--accent-green)' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      fontSize: '0.8rem',
                      fontWeight: page === currentPage ? 600 : 400
                    }}
                  >
                    {page}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                style={{
                  padding: '8px 12px',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  background: currentPage === totalPages ? 'var(--bg-card-hover)' : 'var(--bg-card)',
                  color: currentPage === totalPages ? 'var(--text-muted)' : 'var(--text-primary)',
                  cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                  fontSize: '0.85rem',
                  fontWeight: 500,
                  opacity: currentPage === totalPages ? 0.5 : 1
                }}
              >
                Next
              </button>
            </div>
          </div>
        )}
        {totalPages === 1 && (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: 12 }}>
            Showing {filteredLobbyists.length} of {lobbyistDirectory.length} registered lobbyists
          </p>
        )}
      </div>

      {/* Official Sources */}
      <div className="card-grid" style={{ marginBottom: 24 }}>
        <a href="https://www.sec.state.ma.us/LobbyistPublicSearch/" target="_blank" rel="noopener noreferrer"
          className="chart-card" style={{ textDecoration: 'none', cursor: 'pointer' }}>
          <h3 style={{ color: 'var(--accent-blue)' }}>MA Secretary of State - Lobbyist Public Search</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: 6 }}>Official database of registered lobbyists and lobbying clients</p>
        </a>
        <a href="https://www.opensecrets.org/states/MA/lobbying/" target="_blank" rel="noopener noreferrer"
          className="chart-card" style={{ textDecoration: 'none', cursor: 'pointer' }}>
          <h3 style={{ color: 'var(--accent-blue)' }}>OpenSecrets - Massachusetts Lobbying Data</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: 6 }}>Independent analysis of lobbying spending and influence</p>
        </a>
      </div>

      <div style={{ background: 'var(--bg-card-hover)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 18px', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
        <strong>Data Note:</strong> This explorer uses embedded data representing real Massachusetts lobbying information based on MA Secretary of State filings. Figures are approximate and based on public lobbying disclosures. Data shown covers 2015-2026 (2026 as estimated).
      </div>
    </div>
  );
}
