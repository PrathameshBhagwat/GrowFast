import React, { useState } from 'react';
import type { DashboardServiceBreakdown, DashboardCategoryBreakdown } from '@growfast/shared-types';
import { Card } from '@growfast/ui';

export type BreakdownDimension = 'SERVICE' | 'CATEGORY';
export type BreakdownMetric = 'VALUE' | 'ITEMS';

export interface DashboardBreakdownChartProps {
  serviceBreakdown?: DashboardServiceBreakdown[];
  categoryBreakdown?: DashboardCategoryBreakdown[];
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

// Visual color palette for breakdown categories
const PALETTE = [
  'bg-blue-500 text-blue-700 dark:text-blue-300',
  'bg-purple-500 text-purple-700 dark:text-purple-300',
  'bg-emerald-500 text-emerald-700 dark:text-emerald-300',
  'bg-amber-500 text-amber-700 dark:text-amber-300',
  'bg-indigo-500 text-indigo-700 dark:text-indigo-300',
  'bg-rose-500 text-rose-700 dark:text-rose-300',
  'bg-cyan-500 text-cyan-700 dark:text-cyan-300',
  'bg-teal-500 text-teal-700 dark:text-teal-300',
];

const BAR_COLORS = [
  '#3B82F6', // Blue
  '#8B5CF6', // Purple
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#6366F1', // Indigo
  '#F43F5E', // Rose
  '#06B6D4', // Cyan
  '#14B8A6', // Teal
];

export const DashboardBreakdownChart: React.FC<DashboardBreakdownChartProps> = ({
  serviceBreakdown = [],
  categoryBreakdown = [],
  currencyFormatter = defaultCurrency,
  className = '',
}) => {
  const [dimension, setDimension] = useState<BreakdownDimension>('CATEGORY');
  const [metric, setMetric] = useState<BreakdownMetric>('VALUE');

  // Normalize list based on active dimension
  const rawList =
    dimension === 'CATEGORY'
      ? categoryBreakdown.map((c) => ({
          name: c.category || 'Uncategorized',
          subtitle: '',
          itemCount: c.itemCount,
          totalAmount: c.totalAmount,
        }))
      : serviceBreakdown.map((s) => ({
          name: s.serviceName || 'Unknown Service',
          subtitle: s.serviceCategory || '',
          itemCount: s.itemCount,
          totalAmount: s.totalAmount,
        }));

  // Sort by active metric descending
  const sortedList = [...rawList].sort((a, b) =>
    metric === 'VALUE' ? b.totalAmount - a.totalAmount : b.itemCount - a.itemCount,
  );

  const totalValue = sortedList.reduce((acc, curr) => acc + curr.totalAmount, 0);
  const totalItems = sortedList.reduce((acc, curr) => acc + curr.itemCount, 0);

  const activeTotal = metric === 'VALUE' ? totalValue : totalItems;
  const isEmpty = sortedList.length === 0 || activeTotal === 0;

  return (
    <Card
      id="dashboard-breakdown-card"
      className={`p-4 sm:p-5 flex flex-col justify-between ${className}`}
      style={{
        background: 'var(--bg-surface, #ffffff)',
        border: '1px solid var(--border, #e5e7eb)',
      }}
    >
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h3
            className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2"
            id="breakdown-chart-title"
          >
            <span>Service &amp; Category Breakdown</span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Booked line items allocated by service &amp; garment category
          </p>
        </div>

        {/* Toggles */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Dimension Selector */}
          <div
            role="group"
            aria-label="Select Breakdown Dimension"
            className="inline-flex rounded-lg p-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
          >
            <button
              type="button"
              aria-pressed={dimension === 'CATEGORY'}
              onClick={() => setDimension('CATEGORY')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer min-h-[36px] ${
                dimension === 'CATEGORY'
                  ? 'bg-white dark:bg-slate-700 text-blue-700 dark:text-blue-300 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Categories
            </button>
            <button
              type="button"
              aria-pressed={dimension === 'SERVICE'}
              onClick={() => setDimension('SERVICE')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer min-h-[36px] ${
                dimension === 'SERVICE'
                  ? 'bg-white dark:bg-slate-700 text-blue-700 dark:text-blue-300 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Services
            </button>
          </div>

          {/* Metric Selector */}
          <div
            role="group"
            aria-label="Select Breakdown Metric"
            className="inline-flex rounded-lg p-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
          >
            <button
              type="button"
              aria-pressed={metric === 'VALUE'}
              onClick={() => setMetric('VALUE')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer min-h-[36px] ${
                metric === 'VALUE'
                  ? 'bg-white dark:bg-slate-700 text-purple-700 dark:text-purple-300 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Value (₹)
            </button>
            <button
              type="button"
              aria-pressed={metric === 'ITEMS'}
              onClick={() => setMetric('ITEMS')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer min-h-[36px] ${
                metric === 'ITEMS'
                  ? 'bg-white dark:bg-slate-700 text-blue-700 dark:text-blue-300 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Items (Qty)
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col justify-center">
        {isEmpty ? (
          <div className="w-full min-h-[220px] flex flex-col items-center justify-center border border-dashed border-slate-200 dark:border-slate-700 rounded-lg p-6 text-center text-slate-400 select-none">
            <span className="text-2xl mb-1">🏷️</span>
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              No breakdown data available
            </p>
            <p className="text-[11px] text-slate-400 max-w-xs mt-0.5">
              No garment line items were booked in the selected reporting period.
            </p>
          </div>
        ) : (
          <div className="space-y-3 my-2" role="list" aria-label="Breakdown Items">
            {sortedList.slice(0, 6).map((item, idx) => {
              const currentVal = metric === 'VALUE' ? item.totalAmount : item.itemCount;
              const pct = activeTotal > 0 ? (currentVal / activeTotal) * 100 : 0;
              const barColor = BAR_COLORS[idx % BAR_COLORS.length];

              return (
                <div
                  key={item.name + idx}
                  role="listitem"
                  className="space-y-1 focus:outline-none"
                  tabIndex={0}
                  aria-label={`${item.name}: ${
                    metric === 'VALUE'
                      ? currencyFormatter(item.totalAmount)
                      : `${item.itemCount} items`
                  } (${pct.toFixed(1)}%)`}
                >
                  <div className="flex items-center justify-between text-xs font-medium">
                    <div className="flex items-center gap-2 truncate max-w-[65%]">
                      <span
                        className="w-2.5 h-2.5 rounded-xs shrink-0"
                        style={{ backgroundColor: barColor }}
                        aria-hidden="true"
                      />
                      <span className="truncate font-semibold text-slate-800 dark:text-slate-200">
                        {item.name}
                      </span>
                      {item.subtitle && (
                        <span className="text-[11px] text-slate-400 truncate hidden sm:inline">
                          ({item.subtitle})
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-mono font-bold text-slate-700 dark:text-slate-200">
                        {metric === 'VALUE'
                          ? currencyFormatter(item.totalAmount)
                          : `${item.itemCount} pcs`}
                      </span>
                      <span className="font-mono text-[11px] text-slate-400 w-11 text-right">
                        {pct.toFixed(1)}%
                      </span>
                    </div>
                  </div>

                  {/* Horizontal Bar */}
                  <div
                    className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden"
                    role="progressbar"
                    aria-valuenow={Math.round(pct)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <div
                      className="h-full rounded-full transition-all duration-300 ease-out"
                      style={{
                        width: `${Math.max(pct, 2)}%`,
                        backgroundColor: barColor,
                      }}
                    />
                  </div>
                </div>
              );
            })}

            {sortedList.length > 6 && (
              <p className="text-[11px] text-slate-400 text-right pt-1">
                + {sortedList.length - 6} more{' '}
                {dimension === 'CATEGORY' ? 'categories' : 'services'}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Distinction & Semantics Footnote */}
      <div className="pt-3 mt-3 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1">
        <span>
          <strong className="font-medium text-slate-500 dark:text-slate-400">Note:</strong> Line
          item amounts reflect <em>booked garment value</em>, not cash collections or order-level
          fees.
        </span>
        <span className="font-mono shrink-0">
          Total: {metric === 'VALUE' ? currencyFormatter(totalValue) : `${totalItems} items`}
        </span>
      </div>

      {/* Screen Reader Table */}
      <div className="sr-only">
        <table>
          <caption>
            {dimension === 'CATEGORY' ? 'Category' : 'Service'} Breakdown by{' '}
            {metric === 'VALUE' ? 'Booked Value' : 'Item Count'}
          </caption>
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Booked Value</th>
              <th scope="col">Item Count</th>
              <th scope="col">Share (%)</th>
            </tr>
          </thead>
          <tbody>
            {sortedList.map((item, idx) => {
              const currentVal = metric === 'VALUE' ? item.totalAmount : item.itemCount;
              const pct = activeTotal > 0 ? (currentVal / activeTotal) * 100 : 0;
              return (
                <tr key={idx}>
                  <td>{item.name}</td>
                  <td>{item.totalAmount}</td>
                  <td>{item.itemCount}</td>
                  <td>{pct.toFixed(1)}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
};
