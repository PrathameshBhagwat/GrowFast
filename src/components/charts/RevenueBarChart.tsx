import React from 'react';

interface RevenueDataPoint {
  day: string;
  revenue: number;
  orders: number;
}

const mockRevenueData: RevenueDataPoint[] = [
  { day: 'Mon', revenue: 14200, orders: 18 },
  { day: 'Tue', revenue: 16850, orders: 22 },
  { day: 'Wed', revenue: 19400, orders: 26 },
  { day: 'Thu', revenue: 17200, orders: 21 },
  { day: 'Fri', revenue: 23500, orders: 31 },
  { day: 'Sat', revenue: 28900, orders: 42 },
  { day: 'Sun', revenue: 24100, orders: 35 }
];

export const RevenueBarChart: React.FC = () => {
  const maxRevenue = Math.max(...mockRevenueData.map(d => d.revenue));
  const chartHeight = 160;

  return (
    <div style={{ width: '100%', padding: '0.5rem 0' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: `${chartHeight}px`, gap: '0.75rem', paddingBottom: '0.5rem' }}>
        {mockRevenueData.map((item, idx) => {
          const barHeight = Math.round((item.revenue / maxRevenue) * (chartHeight - 30));
          const isToday = item.day === 'Sat';

          return (
            <div
              key={idx}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.4rem',
                height: '100%',
                justifyContent: 'flex-end'
              }}
            >
              <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--slate-500)', fontFamily: 'var(--font-mono)' }}>
                ₹{(item.revenue / 1000).toFixed(1)}k
              </div>
              <div
                style={{
                  width: '100%',
                  maxWidth: '36px',
                  height: `${barHeight}px`,
                  borderRadius: '4px 4px 0 0',
                  backgroundColor: isToday ? 'var(--primary-600)' : 'var(--primary-200)',
                  transition: 'height 0.4s ease-out, background-color 0.2s',
                  cursor: 'pointer'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--primary-500)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = isToday ? 'var(--primary-600)' : 'var(--primary-200)'}
                title={`${item.day}: ₹${item.revenue} (${item.orders} Orders)`}
              />
              <div style={{ fontSize: '11px', fontWeight: isToday ? 700 : 500, color: isToday ? 'var(--primary-700)' : 'var(--slate-600)' }}>
                {item.day}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const ServiceDonutChart: React.FC = () => {
  const serviceSplit = [
    { label: 'Dry Cleaning', percentage: 48, color: '#2563EB', value: '₹58,400' },
    { label: 'Wash + Steam Iron', percentage: 24, color: '#0EA5E9', value: '₹29,200' },
    { label: 'Steam Pressing', percentage: 14, color: '#8B5CF6', value: '₹17,000' },
    { label: 'Shoe & Leather Spa', percentage: 9, color: '#F59E0B', value: '₹10,950' },
    { label: 'Weight Laundry', percentage: 5, color: '#10B981', value: '₹6,100' }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
        {/* SVG Donut */}
        <div style={{ position: 'relative', width: '120px', height: '120px', flexShrink: 0 }}>
          <svg viewBox="0 0 36 36" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
            {/* Background Ring */}
            <circle cx="18" cy="18" r="15.915" fill="transparent" stroke="#E2E8F0" strokeWidth="4" />
            {/* Segments */}
            <circle cx="18" cy="18" r="15.915" fill="transparent" stroke="#2563EB" strokeWidth="4.2" strokeDasharray="48 52" strokeDashoffset="0" />
            <circle cx="18" cy="18" r="15.915" fill="transparent" stroke="#0EA5E9" strokeWidth="4.2" strokeDasharray="24 76" strokeDashoffset="-48" />
            <circle cx="18" cy="18" r="15.915" fill="transparent" stroke="#8B5CF6" strokeWidth="4.2" strokeDasharray="14 86" strokeDashoffset="-72" />
            <circle cx="18" cy="18" r="15.915" fill="transparent" stroke="#F59E0B" strokeWidth="4.2" strokeDasharray="9 91" strokeDashoffset="-86" />
            <circle cx="18" cy="18" r="15.915" fill="transparent" stroke="#10B981" strokeWidth="4.2" strokeDasharray="5 95" strokeDashoffset="-95" />
          </svg>
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            lineHeight: 1.1
          }}>
            <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--slate-900)' }}>100%</span>
            <span style={{ fontSize: '9px', color: 'var(--slate-400)', textTransform: 'uppercase' }}>Volume</span>
          </div>
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', flex: 1 }}>
          {serviceSplit.map((s, idx) => (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 'var(--text-xs)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: s.color }} />
                <span style={{ color: 'var(--slate-700)', fontWeight: 500 }}>{s.label}</span>
              </div>
              <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--slate-900)' }}>{s.percentage}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
