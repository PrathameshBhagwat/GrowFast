import React, { useState, useId } from 'react';
import type { DashboardTrendsDTO, DashboardTrendPoint } from '@growfast/shared-types';
import { Card } from '@growfast/ui';

export type TrendMetricSeries = 'ALL' | 'COLLECTIONS' | 'BOOKED_VALUE' | 'ORDERS';

export interface DashboardTrendChartProps {
  trends?: DashboardTrendsDTO;
  currencyFormatter?: (v: number) => string;
  className?: string;
}

function defaultCurrency(v?: number | null): string {
  const val = v ?? 0;
  return (
    '₹' +
    val.toLocaleString('en-IN', {
      minimumFractionDigits: Number.isInteger(val) ? 0 : 2,
      maximumFractionDigits: 2,
    })
  );
}

function formatShortDate(dateStr: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  const parts = dateStr.split('-');
  const monthIdx = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  return `${day} ${months[monthIdx] || parts[1]}`;
}

export const DashboardTrendChart: React.FC<DashboardTrendChartProps> = ({
  trends,
  currencyFormatter = defaultCurrency,
  className = '',
}) => {
  const chartId = useId();
  const [selectedSeries, setSelectedSeries] = useState<TrendMetricSeries>('ALL');
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const points = trends?.points || [];
  const isEmpty = points.length === 0;

  // Check if dataset is entirely zeroes
  const isAllZero =
    !isEmpty &&
    points.every(
      (p) =>
        p.collections === 0 &&
        p.bookedOrderValue === 0 &&
        p.orderCount === 0 &&
        p.refunds === 0 &&
        p.netCollections === 0,
    );

  // SVG Dimensions
  const svgWidth = 560;
  const svgHeight = 220;
  const padLeft = 60;
  const padRight = 24;
  const padTop = 24;
  const padBottom = 36;
  const graphW = svgWidth - padLeft - padRight;
  const graphH = svgHeight - padTop - padBottom;

  // Determine Max Value based on selected series
  let maxFinancial = 0;
  let maxOrders = 0;

  for (const p of points) {
    if (p.collections > maxFinancial) maxFinancial = p.collections;
    if (p.bookedOrderValue > maxFinancial) maxFinancial = p.bookedOrderValue;
    if (p.netCollections > maxFinancial) maxFinancial = p.netCollections;
    if (p.refunds > maxFinancial) maxFinancial = p.refunds;
    if (p.orderCount > maxOrders) maxOrders = p.orderCount;
  }

  // Graceful ceiling for Y-axis
  if (maxFinancial <= 0) maxFinancial = 1000;
  else {
    // Round up to clean ceiling (e.g., nearest 500, 1000, 5000, 10000)
    const factor = Math.pow(10, Math.floor(Math.log10(maxFinancial)));
    maxFinancial = Math.ceil((maxFinancial * 1.1) / factor) * factor;
  }

  if (maxOrders <= 0) maxOrders = 5;
  else {
    maxOrders = Math.ceil(maxOrders * 1.2);
  }

  const isOrderMode = selectedSeries === 'ORDERS';
  const effectiveMax = isOrderMode ? maxOrders : maxFinancial;

  // Helper coordinate functions
  const getX = (idx: number): number => {
    if (points.length <= 1) return padLeft + graphW / 2;
    return padLeft + (idx / (points.length - 1)) * graphW;
  };

  const getY = (val: number): number => {
    const clamped = Math.max(0, val);
    const ratio = Math.min(clamped / effectiveMax, 1);
    return padTop + graphH - ratio * graphH;
  };

  // Generate path data for SVG
  const generateLinePath = (getValue: (p: DashboardTrendPoint) => number): string => {
    if (points.length === 0) return '';
    return points
      .map((p, idx) => {
        const x = getX(idx);
        const y = getY(getValue(p));
        return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(' ');
  };

  const generateAreaPath = (getValue: (p: DashboardTrendPoint) => number): string => {
    if (points.length === 0) return '';
    const linePath = generateLinePath(getValue);
    const startX = getX(0);
    const endX = getX(points.length - 1);
    const baseY = padTop + graphH;
    return `${linePath} L ${endX.toFixed(1)} ${baseY.toFixed(1)} L ${startX.toFixed(1)} ${baseY.toFixed(1)} Z`;
  };

  // Series paths
  const collectionsLine = generateLinePath((p) => p.collections);
  const collectionsArea = generateAreaPath((p) => p.collections);

  const netCollectionsLine = generateLinePath((p) => p.netCollections);

  const bookedLine = generateLinePath((p) => p.bookedOrderValue);
  const bookedArea = generateAreaPath((p) => p.bookedOrderValue);

  const refundsLine = generateLinePath((p) => p.refunds);

  const ordersLine = generateLinePath((p) => p.orderCount);
  const ordersArea = generateAreaPath((p) => p.orderCount);

  // Determine tick steps for Y-axis (4 intervals = 5 tick lines)
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((pct) => ({
    pct,
    value: pct * effectiveMax,
    y: padTop + graphH - pct * graphH,
  }));

  // Determine date label display indices (e.g. max 6 labels)
  const xLabelIndices: number[] = [];
  if (points.length <= 6) {
    for (let i = 0; i < points.length; i++) xLabelIndices.push(i);
  } else {
    const step = (points.length - 1) / 5;
    for (let i = 0; i < 6; i++) {
      xLabelIndices.push(Math.round(i * step));
    }
  }

  const activePoint = hoveredIndex !== null && points[hoveredIndex] ? points[hoveredIndex] : null;

  return (
    <Card
      id="dashboard-trends-card"
      className={`p-4 sm:p-5 flex flex-col justify-between ${className}`}
      style={{
        background: 'var(--bg-surface, #ffffff)',
        border: '1px solid var(--border, #e5e7eb)',
      }}
    >
      {/* Header with Title and Mode Toggles */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h3
            className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2"
            id="trends-chart-title"
          >
            <span>Performance Trends</span>
            {trends?.interval && (
              <span className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                {trends.interval}
              </span>
            )}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Collections received (Payment dates) &amp; Order value booked (Order dates)
          </p>
        </div>

        {/* Series Filter Selector */}
        <div
          role="group"
          aria-label="Filter Trend Series"
          className="inline-flex rounded-lg p-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 self-start sm:self-auto"
        >
          <button
            type="button"
            aria-pressed={selectedSeries === 'ALL'}
            onClick={() => setSelectedSeries('ALL')}
            className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer min-h-[36px] ${
              selectedSeries === 'ALL'
                ? 'bg-white dark:bg-slate-700 text-blue-700 dark:text-blue-300 shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            Overview
          </button>
          <button
            type="button"
            aria-pressed={selectedSeries === 'COLLECTIONS'}
            onClick={() => setSelectedSeries('COLLECTIONS')}
            className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer min-h-[36px] ${
              selectedSeries === 'COLLECTIONS'
                ? 'bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-300 shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            Collections
          </button>
          <button
            type="button"
            aria-pressed={selectedSeries === 'BOOKED_VALUE'}
            onClick={() => setSelectedSeries('BOOKED_VALUE')}
            className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer min-h-[36px] ${
              selectedSeries === 'BOOKED_VALUE'
                ? 'bg-white dark:bg-slate-700 text-purple-700 dark:text-purple-300 shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            Booked Value
          </button>
          <button
            type="button"
            aria-pressed={selectedSeries === 'ORDERS'}
            onClick={() => setSelectedSeries('ORDERS')}
            className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer min-h-[36px] ${
              selectedSeries === 'ORDERS'
                ? 'bg-white dark:bg-slate-700 text-blue-700 dark:text-blue-300 shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            Order Volume
          </button>
        </div>
      </div>

      {/* Interactive Legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-3 text-xs">
        {(selectedSeries === 'ALL' || selectedSeries === 'COLLECTIONS') && (
          <div className="flex items-center gap-1.5" id="legend-collections">
            <span className="w-3 h-3 rounded-full bg-emerald-600 inline-block" />
            <span className="font-semibold text-slate-700 dark:text-slate-200">
              Collections Received
            </span>
          </div>
        )}
        {(selectedSeries === 'ALL' || selectedSeries === 'COLLECTIONS') && (
          <div className="flex items-center gap-1.5" id="legend-net-collections">
            <span className="w-3 h-3 rounded-sm bg-teal-600 inline-block" />
            <span className="font-medium text-slate-600 dark:text-slate-300">Net Collections</span>
          </div>
        )}
        {(selectedSeries === 'ALL' || selectedSeries === 'COLLECTIONS') && (
          <div className="flex items-center gap-1.5" id="legend-refunds">
            <span className="w-3 h-0.5 bg-rose-500 inline-block border-t border-rose-500" />
            <span className="font-medium text-slate-500 dark:text-slate-400">Refunds</span>
          </div>
        )}
        {(selectedSeries === 'ALL' || selectedSeries === 'BOOKED_VALUE') && (
          <div className="flex items-center gap-1.5" id="legend-booked-value">
            <span className="w-3 h-3 rounded-full bg-purple-600 inline-block" />
            <span className="font-semibold text-slate-700 dark:text-slate-200">
              Order Value Booked
            </span>
          </div>
        )}
        {(selectedSeries === 'ALL' || selectedSeries === 'ORDERS') && (
          <div className="flex items-center gap-1.5" id="legend-order-count">
            <span className="w-3 h-3 rounded-full bg-blue-600 inline-block" />
            <span className="font-semibold text-slate-700 dark:text-slate-200">Orders Created</span>
          </div>
        )}
      </div>

      {/* Main Chart Area */}
      <div className="relative w-full aspect-[21/9] min-h-[220px]">
        {isEmpty || isAllZero ? (
          <div className="w-full h-full flex flex-col items-center justify-center border border-dashed border-slate-200 dark:border-slate-700 rounded-lg p-6 text-center text-slate-400 select-none">
            <span className="text-2xl mb-1">📊</span>
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              {isEmpty ? 'No trend data available' : 'Zero activity in this period'}
            </p>
            <p className="text-[11px] text-slate-400 max-w-xs mt-0.5">
              No orders booked or collections received during the selected date range.
            </p>
          </div>
        ) : (
          <svg
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            className="w-full h-full overflow-visible select-none"
            role="img"
            aria-labelledby="trends-chart-title"
          >
            <defs>
              <linearGradient id={`${chartId}-collectionsGrad`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#059669" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#059669" stopOpacity="0.0" />
              </linearGradient>
              <linearGradient id={`${chartId}-bookedGrad`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#7C3AED" stopOpacity="0.20" />
                <stop offset="100%" stopColor="#7C3AED" stopOpacity="0.0" />
              </linearGradient>
              <linearGradient id={`${chartId}-ordersGrad`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2563EB" stopOpacity="0.20" />
                <stop offset="100%" stopColor="#2563EB" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Horizontal Gridlines & Y-Axis Labels */}
            {yTicks.map((tick, i) => (
              <g key={i}>
                <line
                  x1={padLeft}
                  y1={tick.y}
                  x2={padLeft + graphW}
                  y2={tick.y}
                  stroke="var(--border, #E5E7EB)"
                  strokeDasharray={i === 0 ? 'none' : '3 3'}
                  strokeWidth={1}
                />
                <text
                  x={padLeft - 8}
                  y={tick.y + 4}
                  textAnchor="end"
                  fontSize="10"
                  fontFamily="monospace"
                  fill="var(--text-muted, #64748B)"
                >
                  {isOrderMode
                    ? Math.round(tick.value)
                    : tick.value >= 1000
                      ? `₹${(tick.value / 1000).toFixed(tick.value % 1000 === 0 ? 0 : 1)}k`
                      : `₹${Math.round(tick.value)}`}
                </text>
              </g>
            ))}

            {/* Area Fills */}
            {(selectedSeries === 'ALL' || selectedSeries === 'BOOKED_VALUE') && (
              <path d={bookedArea} fill={`url(#${chartId}-bookedGrad)`} />
            )}
            {(selectedSeries === 'ALL' || selectedSeries === 'COLLECTIONS') && (
              <path d={collectionsArea} fill={`url(#${chartId}-collectionsGrad)`} />
            )}
            {selectedSeries === 'ORDERS' && (
              <path d={ordersArea} fill={`url(#${chartId}-ordersGrad)`} />
            )}

            {/* Lines */}
            {(selectedSeries === 'ALL' || selectedSeries === 'BOOKED_VALUE') && (
              <path
                d={bookedLine}
                fill="none"
                stroke="#7C3AED"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
            {(selectedSeries === 'ALL' || selectedSeries === 'COLLECTIONS') && (
              <>
                <path
                  d={collectionsLine}
                  fill="none"
                  stroke="#059669"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d={netCollectionsLine}
                  fill="none"
                  stroke="#0D9488"
                  strokeWidth={1.5}
                  strokeDasharray="4 2"
                  strokeLinecap="round"
                />
                <path
                  d={refundsLine}
                  fill="none"
                  stroke="#DC2626"
                  strokeWidth={1.5}
                  strokeDasharray="2 2"
                  strokeLinecap="round"
                />
              </>
            )}
            {(selectedSeries === 'ALL' || selectedSeries === 'ORDERS') && (
              <path
                d={ordersLine}
                fill="none"
                stroke="#2563EB"
                strokeWidth={selectedSeries === 'ORDERS' ? 2.5 : 1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Vertical Guide Line on Hover */}
            {hoveredIndex !== null && (
              <line
                x1={getX(hoveredIndex)}
                y1={padTop}
                x2={getX(hoveredIndex)}
                y2={padTop + graphH}
                stroke="var(--accent, #3B82F6)"
                strokeDasharray="2 2"
                strokeWidth={1.5}
              />
            )}

            {/* Interactive Data Point Dots */}
            {points.map((p, idx) => {
              const cx = getX(idx);
              const isHovered = hoveredIndex === idx;

              return (
                <g
                  key={idx}
                  onMouseEnter={() => setHoveredIndex(idx)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  onTouchStart={() => setHoveredIndex(idx)}
                  tabIndex={0}
                  role="button"
                  aria-label={`${p.date}: Collections ${currencyFormatter(p.collections)}, Booked ${currencyFormatter(p.bookedOrderValue)}, Orders ${p.orderCount}`}
                  onFocus={() => setHoveredIndex(idx)}
                  onBlur={() => setHoveredIndex(null)}
                  className="cursor-pointer focus:outline-none"
                >
                  {/* Invisible larger hit target */}
                  <circle cx={cx} cy={padTop + graphH / 2} r={16} fill="transparent" />

                  {/* Dot for Collections */}
                  {(selectedSeries === 'ALL' || selectedSeries === 'COLLECTIONS') && (
                    <circle
                      cx={cx}
                      cy={getY(p.collections)}
                      r={isHovered ? 5.5 : 3}
                      fill="#059669"
                      stroke="#ffffff"
                      strokeWidth={1.5}
                      className="transition-all"
                    />
                  )}

                  {/* Dot for Booked Order Value */}
                  {(selectedSeries === 'ALL' || selectedSeries === 'BOOKED_VALUE') && (
                    <circle
                      cx={cx}
                      cy={getY(p.bookedOrderValue)}
                      r={isHovered ? 5.5 : 3}
                      fill="#7C3AED"
                      stroke="#ffffff"
                      strokeWidth={1.5}
                      className="transition-all"
                    />
                  )}

                  {/* Dot for Orders */}
                  {selectedSeries === 'ORDERS' && (
                    <circle
                      cx={cx}
                      cy={getY(p.orderCount)}
                      r={isHovered ? 5.5 : 3}
                      fill="#2563EB"
                      stroke="#ffffff"
                      strokeWidth={1.5}
                      className="transition-all"
                    />
                  )}
                </g>
              );
            })}

            {/* Bottom X-Axis Date Labels */}
            {xLabelIndices.map((idx) => {
              const p = points[idx];
              if (!p) return null;
              return (
                <text
                  key={idx}
                  x={getX(idx)}
                  y={padTop + graphH + 16}
                  textAnchor="middle"
                  fontSize="10"
                  fontWeight="500"
                  fill="var(--text-muted, #64748B)"
                >
                  {formatShortDate(p.date)}
                </text>
              );
            })}
          </svg>
        )}

        {/* Floating Tooltip Card */}
        {activePoint && (
          <div
            className="absolute z-20 pointer-events-none p-2.5 rounded-lg shadow-md border text-xs"
            style={{
              left: `${Math.min(Math.max((getX(hoveredIndex!) / svgWidth) * 100, 15), 85)}%`,
              top: '8px',
              transform: 'translateX(-50%)',
              background: 'var(--bg-surface, #ffffff)',
              borderColor: 'var(--border, #e2e8f0)',
              color: 'var(--text-primary, #0f172a)',
              minWidth: 180,
            }}
          >
            <div className="font-bold border-b border-slate-100 dark:border-slate-800 pb-1 mb-1.5 flex items-center justify-between text-slate-800 dark:text-slate-100">
              <span>{formatShortDate(activePoint.date)}</span>
              <span className="text-[10px] text-slate-400 font-mono">{activePoint.date}</span>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between gap-3 text-emerald-600 dark:text-emerald-400 font-medium">
                <span>Collections:</span>
                <span className="font-bold font-mono">
                  {currencyFormatter(activePoint.collections)}
                </span>
              </div>

              {activePoint.refunds > 0 && (
                <div className="flex items-center justify-between gap-3 text-rose-600 dark:text-rose-400">
                  <span>Refunds:</span>
                  <span className="font-mono font-semibold">
                    - {currencyFormatter(activePoint.refunds)}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between gap-3 text-teal-600 dark:text-teal-400 text-[11px]">
                <span>Net Collections:</span>
                <span className="font-mono font-semibold">
                  {currencyFormatter(activePoint.netCollections)}
                </span>
              </div>

              <div className="flex items-center justify-between gap-3 text-purple-600 dark:text-purple-400 font-medium pt-0.5 border-t border-slate-100 dark:border-slate-800">
                <span>Booked Value:</span>
                <span className="font-bold font-mono">
                  {currencyFormatter(activePoint.bookedOrderValue)}
                </span>
              </div>

              <div className="flex items-center justify-between gap-3 text-blue-600 dark:text-blue-400 text-[11px]">
                <span>Orders Created:</span>
                <span className="font-bold font-mono">{activePoint.orderCount}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Screen Reader Accessible Table Summary */}
      <div className="sr-only">
        <table>
          <caption>Daily Performance Trends</caption>
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Collections Received</th>
              <th scope="col">Refunds</th>
              <th scope="col">Net Collections</th>
              <th scope="col">Booked Order Value</th>
              <th scope="col">Orders Created</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p, idx) => (
              <tr key={idx}>
                <td>{p.date}</td>
                <td>{p.collections}</td>
                <td>{p.refunds}</td>
                <td>{p.netCollections}</td>
                <td>{p.bookedOrderValue}</td>
                <td>{p.orderCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
};
