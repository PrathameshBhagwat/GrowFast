import React from 'react';
import { useStore } from '../store';
import { RevenueBarChart, ServiceDonutChart } from '../components/charts/RevenueBarChart';
import { 
  BarChart3, 
  TrendingUp, 
  Clock, 
  Users, 
  ShoppingBag, 
  IndianRupee, 
  CheckCircle2, 
  AlertTriangle,
  Award,
  Zap
} from 'lucide-react';

export const AnalyticsView: React.FC = () => {
  const { orders, expenses, customers } = useStore();

  const topGarments = [
    { name: "Men's Formal Shirt", count: 284, revenue: 22720, service: 'Dry Clean & Press' },
    { name: "Women's Designer Saree", count: 142, revenue: 21300, service: 'Dry Clean Hydrocarbon' },
    { name: "Suit (2-Piece)", count: 48, revenue: 15360, service: 'Dry Clean & Vacuum Form' },
    { name: "Women's Party Dress", count: 64, revenue: 11520, service: 'Silk Hand Care' },
    { name: "Double Bedsheet", count: 98, revenue: 8820, service: 'Enzyme Wash + Iron' },
    { name: "Sneakers / Shoe Spa", count: 26, revenue: 7774, service: 'Deep Whitening Spa' }
  ];

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div className="page-title-group">
          <h1 className="page-title">Executive Analytics & Unit Economics</h1>
          <p className="page-subtitle">
            Revenue growth, average turnaround time, repeat customer loyalty & operating profit margins
          </p>
        </div>
      </div>

      {/* KPI Row */}
      <div className="metric-grid">
        <div className="metric-card">
          <div className="metric-top">
            <span className="metric-label">Average Order Value (AOV)</span>
            <div className="metric-icon-box" style={{ backgroundColor: 'var(--primary-50)', color: 'var(--primary-600)' }}>
              <IndianRupee size={20} />
            </div>
          </div>
          <div className="metric-value">₹1,180</div>
          <div className="metric-trend positive">
            <TrendingUp size={14} /> +12.5% vs store target
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-top">
            <span className="metric-label">Avg Turnaround Time</span>
            <div className="metric-icon-box" style={{ backgroundColor: 'var(--info-bg)', color: 'var(--info-text)' }}>
              <Clock size={20} />
            </div>
          </div>
          <div className="metric-value">28.4 Hrs</div>
          <div className="metric-trend positive" style={{ color: 'var(--success)' }}>
            ✓ Within 48-hr SLA
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-top">
            <span className="metric-label">Repeat Customer Rate</span>
            <div className="metric-icon-box" style={{ backgroundColor: 'var(--purple-bg)', color: 'var(--purple-text)' }}>
              <Users size={20} />
            </div>
          </div>
          <div className="metric-value">74.2%</div>
          <div className="metric-trend positive">
            High brand stickiness
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-top">
            <span className="metric-label">Estimated Gross Margin</span>
            <div className="metric-icon-box" style={{ backgroundColor: 'var(--success-bg)', color: 'var(--success-text)' }}>
              <Zap size={20} />
            </div>
          </div>
          <div className="metric-value" style={{ color: 'var(--success-text)' }}>86.4%</div>
          <div className="metric-trend positive">
            Excludes fixed premises rent
          </div>
        </div>
      </div>

      {/* Main Visual Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="card-title">Weekly Intake & Collection Trends</h3>
              <p className="form-helper">Revenue normalized across weekdays and weekends</p>
            </div>
          </div>
          <div className="card-body">
            <RevenueBarChart />
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="card-title">Service Mix Contribution</h3>
              <p className="form-helper">High margin dry cleaning vs daily wash</p>
            </div>
          </div>
          <div className="card-body">
            <ServiceDonutChart />
          </div>
        </div>
      </div>

      {/* Bottom Row: Top Garments & Profit Decomposition */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '1.5rem' }}>
        {/* Top-Selling Garments */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Top Revenue Generating Garment Types</h3>
          </div>
          <div className="data-table-container" style={{ border: 'none', borderRadius: 0 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Garment Category</th>
                  <th>Primary Treatment</th>
                  <th>Volume</th>
                  <th style={{ textAlign: 'right' }}>Total Revenue (₹)</th>
                </tr>
              </thead>
              <tbody>
                {topGarments.map((g, idx) => (
                  <tr key={idx}>
                    <td>
                      <div style={{ fontWeight: 700, color: 'var(--slate-900)' }}>{g.name}</div>
                    </td>
                    <td>
                      <span className="badge badge-neutral">{g.service}</span>
                    </td>
                    <td>{g.count} pcs</td>
                    <td style={{ textAlign: 'right', fontWeight: 800, fontFamily: 'var(--font-mono)' }}>
                      ₹{g.revenue.toLocaleString('en-IN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Operating Cost Breakdown */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Monthly Operating Cost Structure</h3>
          </div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', marginBottom: '3px' }}>
                <span style={{ fontWeight: 600 }}>Premises Rent (Koregaon Park)</span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>₹45,000 (64.6%)</span>
              </div>
              <div style={{ height: '6px', width: '100%', backgroundColor: 'var(--slate-100)', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ width: '64.6%', height: '100%', backgroundColor: '#3B82F6' }} />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', marginBottom: '3px' }}>
                <span style={{ fontWeight: 600 }}>Commercial Power & Boiler Electricity</span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>₹14,200 (20.4%)</span>
              </div>
              <div style={{ height: '6px', width: '100%', backgroundColor: 'var(--slate-100)', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ width: '20.4%', height: '100%', backgroundColor: '#F59E0B' }} />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', marginBottom: '3px' }}>
                <span style={{ fontWeight: 600 }}>Packaging Bags & Hangers</span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>₹4,800 (6.9%)</span>
              </div>
              <div style={{ height: '6px', width: '100%', backgroundColor: 'var(--slate-100)', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ width: '6.9%', height: '100%', backgroundColor: '#8B5CF6' }} />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', marginBottom: '3px' }}>
                <span style={{ fontWeight: 600 }}>Detergent & Hydrocarbon Solvents</span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>₹3,450 (5.0%)</span>
              </div>
              <div style={{ height: '6px', width: '100%', backgroundColor: 'var(--slate-100)', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ width: '5.0%', height: '100%', backgroundColor: '#10B981' }} />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', marginBottom: '3px' }}>
                <span style={{ fontWeight: 600 }}>Equipment Maintenance</span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>₹2,200 (3.1%)</span>
              </div>
              <div style={{ height: '6px', width: '100%', backgroundColor: 'var(--slate-100)', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ width: '3.1%', height: '100%', backgroundColor: '#EF4444' }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
