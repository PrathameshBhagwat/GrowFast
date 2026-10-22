import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type {
  DashboardActionQueuesDTO,
  DashboardActionOrder,
  DashboardReadyOrder,
} from '@growfast/shared-types';
import { Card, Button, StatusChip } from '@growfast/ui';

export type ActionQueueType =
  'OVERDUE' | 'DUE_TODAY' | 'DUE_TOMORROW' | 'READY_FOR_PICKUP' | 'PENDING_PAYMENT';

export interface DashboardActionCenterProps {
  actionQueues?: DashboardActionQueuesDTO;
  readyOrders?: DashboardReadyOrder[];
  currencyFormatter?: (v: number) => string;
  className?: string;
  initialQueue?: ActionQueueType;
  activeQueue?: ActionQueueType;
  onQueueChange?: (q: ActionQueueType) => void;
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

function formatShortDate(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleDateString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return isoString;
  }
}

function getRelativeDays(isoString: string): number {
  try {
    const d = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    return Math.floor(diffMs / (24 * 60 * 60 * 1000));
  } catch {
    return 0;
  }
}

export const DashboardActionCenter: React.FC<DashboardActionCenterProps> = ({
  actionQueues,
  readyOrders = [],
  currencyFormatter = defaultCurrency,
  className = '',
  initialQueue = 'OVERDUE',
  activeQueue: propActiveQueue,
  onQueueChange,
}) => {
  const navigate = useNavigate();
  const [internalQueue, setInternalQueue] = useState<ActionQueueType>(initialQueue);

  const isControlled = propActiveQueue !== undefined;
  const activeQueue = isControlled ? propActiveQueue : internalQueue;

  const handleSelectQueue = (q: ActionQueueType) => {
    if (!isControlled) {
      setInternalQueue(q);
    }
    onQueueChange?.(q);
  };

  // Normalize queues
  const overdueItems = actionQueues?.overdue?.items || [];
  const overdueCount = actionQueues?.overdue?.count ?? overdueItems.length;

  const dueTodayItems = actionQueues?.dueToday?.items || [];
  const dueTodayCount = actionQueues?.dueToday?.count ?? dueTodayItems.length;

  const dueTomorrowItems = actionQueues?.dueTomorrow?.items || [];
  const dueTomorrowCount = actionQueues?.dueTomorrow?.count ?? dueTomorrowItems.length;

  // Fallback to readyOrders if readyForPickup queue is not populated
  const readyPickupItems = actionQueues?.readyForPickup?.items?.length
    ? actionQueues.readyForPickup.items
    : readyOrders.map((ro) => ({
        id: ro.id,
        orderNumber: ro.orderNumber,
        customerName: ro.customerName,
        customerPhone: ro.customerPhone,
        totalAmount: ro.totalAmount,
        amountPaid: ro.amountPaid,
        amountDue: ro.amountDue,
        status: 'READY' as any,
        effectiveDueDate: new Date().toISOString(),
        orderDate: new Date().toISOString(),
        itemCount: ro.readyItems.length + ro.remainingItems.length,
      }));
  const readyPickupCount =
    actionQueues?.readyForPickup?.count ?? (readyOrders.length || readyPickupItems.length);

  const pendingPaymentItems = actionQueues?.pendingPayment?.items || [];
  const pendingPaymentCount = actionQueues?.pendingPayment?.count ?? pendingPaymentItems.length;
  const pendingPaymentTotal = actionQueues?.pendingPayment?.totalAmountDue ?? 0;

  // Map active items
  let currentItems: DashboardActionOrder[] = [];
  let queueTitle = '';
  let queueDescription = '';
  let emptyTitle = '';
  let emptySub = '';
  let reasonForAttention = '';

  switch (activeQueue) {
    case 'OVERDUE':
      currentItems = overdueItems;
      queueTitle = 'Overdue Orders';
      queueDescription =
        'Orders past their effective due date. Expedited processing & customer communication required.';
      emptyTitle = '🎉 No Overdue Orders!';
      emptySub = 'All active orders are strictly within promised turnaround dates.';
      reasonForAttention = 'Past effective due date — immediate turnaround required';
      break;
    case 'DUE_TODAY':
      currentItems = dueTodayItems;
      queueTitle = 'Due Today';
      queueDescription =
        'Orders scheduled for completion today (Asia/Kolkata). Prioritize washing, pressing & packing.';
      emptyTitle = '✨ No Orders Due Today';
      emptySub = 'All scheduled orders for today have already been fulfilled or none are due.';
      reasonForAttention = 'Promised fulfillment date is today';
      break;
    case 'DUE_TOMORROW':
      currentItems = dueTomorrowItems;
      queueTitle = 'Due Tomorrow';
      queueDescription =
        'Orders due for delivery or pickup tomorrow. Verify garments are at the drying or pressing stage.';
      emptyTitle = '📅 No Orders Due Tomorrow';
      emptySub = 'No active orders are currently scheduled for completion tomorrow.';
      reasonForAttention = 'Scheduled for tomorrow — verify processing stage';
      break;
    case 'READY_FOR_PICKUP':
      currentItems = readyPickupItems;
      queueTitle = 'Ready for Pickup';
      queueDescription =
        'Orders fully processed and packaged. Awaiting customer counter pickup or delivery rider assignment.';
      emptyTitle = '📦 No Orders Awaiting Pickup';
      emptySub = 'No orders are currently waiting in the ready queue.';
      reasonForAttention = 'Order processed & packed — awaiting customer collection';
      break;
    case 'PENDING_PAYMENT':
      currentItems = pendingPaymentItems;
      queueTitle = 'Pending Payment';
      queueDescription = `Orders with an outstanding positive balance across store operations. Total balance due: ${currencyFormatter(
        pendingPaymentTotal,
      )}.`;
      emptyTitle = '💳 No Pending Payments';
      emptySub = 'All store orders have been fully paid. Zero outstanding balances!';
      reasonForAttention = 'Outstanding balance due upon delivery/pickup';
      break;
  }

  const tabs: {
    key: ActionQueueType;
    label: string;
    icon: string;
    count: number;
    badgeVariant: 'danger' | 'warning' | 'info' | 'success' | 'neutral';
  }[] = [
    {
      key: 'OVERDUE',
      label: 'Overdue',
      icon: '🚨',
      count: overdueCount,
      badgeVariant: overdueCount > 0 ? 'danger' : 'neutral',
    },
    {
      key: 'DUE_TODAY',
      label: 'Due Today',
      icon: '⚡',
      count: dueTodayCount,
      badgeVariant: dueTodayCount > 0 ? 'warning' : 'neutral',
    },
    {
      key: 'DUE_TOMORROW',
      label: 'Due Tomorrow',
      icon: '📅',
      count: dueTomorrowCount,
      badgeVariant: 'info',
    },
    {
      key: 'READY_FOR_PICKUP',
      label: 'Ready for Pickup',
      icon: '📦',
      count: readyPickupCount,
      badgeVariant: readyPickupCount > 0 ? 'success' : 'neutral',
    },
    {
      key: 'PENDING_PAYMENT',
      label: 'Pending Payment',
      icon: '💳',
      count: pendingPaymentCount,
      badgeVariant: pendingPaymentCount > 0 ? 'warning' : 'neutral',
    },
  ];

  return (
    <section
      id="dashboard-action-center"
      aria-labelledby="action-center-heading"
      className={`space-y-3 ${className}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2
              id="action-center-heading"
              className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100"
            >
              Action Center
            </h2>
            {overdueCount > 0 ? (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200 border border-amber-200 dark:border-amber-800">
                {overdueCount} Overdue Action Items
              </span>
            ) : (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800">
                Queues on Track
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Operational exceptions, overdue dates, and customer pickup queues requiring staff
            attention
          </p>
        </div>
      </div>

      {/* Queue Switcher Toolbar / Tabs */}
      <div
        role="tablist"
        aria-label="Action Center Queues"
        className="flex gap-2 overflow-x-auto pb-1 select-none scrollbar-thin"
      >
        {tabs.map((tab) => {
          const isActive = activeQueue === tab.key;
          let badgeBg = 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
          if (tab.badgeVariant === 'danger') {
            badgeBg = 'bg-rose-500 text-white';
          } else if (tab.badgeVariant === 'warning') {
            badgeBg = 'bg-amber-500 text-white';
          } else if (tab.badgeVariant === 'success') {
            badgeBg = 'bg-emerald-600 text-white';
          } else if (tab.badgeVariant === 'info') {
            badgeBg = 'bg-blue-600 text-white';
          }

          return (
            <button
              key={tab.key}
              role="tab"
              id={`tab-${tab.key.toLowerCase()}`}
              aria-controls={`panel-${tab.key.toLowerCase()}`}
              aria-selected={isActive}
              type="button"
              onClick={() => handleSelectQueue(tab.key)}
              className={`px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap inline-flex items-center gap-2 min-h-[44px] min-w-[44px] border ${
                isActive
                  ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-400 dark:border-blue-700 shadow-2xs font-bold'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
              <span
                className={`ml-1 px-2 py-0.5 rounded-full text-xs font-mono font-bold ${badgeBg}`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Active Queue Container */}
      <div
        role="tabpanel"
        id={`panel-${activeQueue.toLowerCase()}`}
        aria-labelledby={`tab-${activeQueue.toLowerCase()}`}
        className="space-y-2.5"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs px-1">
          <div className="font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2">
            <span>{queueTitle}</span>
            <span className="text-slate-400 dark:text-slate-500 font-normal">
              ({currentItems.length} displayed of{' '}
              {tabs.find((t) => t.key === activeQueue)?.count || 0})
            </span>
          </div>
          <div className="text-slate-500 dark:text-slate-400 text-[11px]">{queueDescription}</div>
        </div>

        {/* Empty State */}
        {currentItems.length === 0 ? (
          <Card
            className="p-8 text-center border-dashed border-2 flex flex-col items-center justify-center space-y-2 select-none"
            style={{
              background: 'var(--bg-surface, #ffffff)',
              borderColor: 'var(--border, #e5e7eb)',
            }}
          >
            <div className="text-3xl mb-1">
              {tabs.find((t) => t.key === activeQueue)?.icon || '✨'}
            </div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">{emptyTitle}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md">{emptySub}</p>
          </Card>
        ) : (
          /* List of Queue Order Cards */
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3" role="list">
            {currentItems.map((item) => {
              const overdueDays = getRelativeDays(item.effectiveDueDate);

              const leftBorderAccent =
                activeQueue === 'OVERDUE'
                  ? 'border-l-4 border-l-rose-500'
                  : activeQueue === 'DUE_TODAY'
                    ? 'border-l-4 border-l-amber-500'
                    : activeQueue === 'READY_FOR_PICKUP'
                      ? 'border-l-4 border-l-emerald-500'
                      : activeQueue === 'PENDING_PAYMENT'
                        ? 'border-l-4 border-l-blue-500'
                        : 'border-l-4 border-l-slate-300';

              return (
                <Card
                  key={item.id}
                  id={`action-order-${item.id}`}
                  role="listitem"
                  className={`p-3.5 flex flex-col justify-between transition-all hover:shadow-md cursor-pointer border border-slate-200 dark:border-slate-700 ${leftBorderAccent} focus-within:ring-2 focus-within:ring-blue-500 rounded-xl`}
                  style={{
                    background: 'var(--bg-surface, #ffffff)',
                  }}
                  onClick={() => navigate(`/orders/${item.id}`)}
                >
                  <div className="space-y-2">
                    {/* Header: Order Number, Customer, Status */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm text-slate-900 dark:text-slate-100 hover:text-blue-600 transition-colors">
                            #{item.orderNumber}
                          </span>
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            • {item.itemCount} items
                          </span>
                        </div>
                        <div className="text-xs font-medium text-slate-700 dark:text-slate-300 mt-0.5 flex items-center gap-2 flex-wrap">
                          <span className="truncate max-w-[140px] sm:max-w-[200px]">
                            {item.customerName}
                          </span>
                          {item.customerPhone && (
                            <a
                              href={`tel:${item.customerPhone}`}
                              onClick={(e) => e.stopPropagation()}
                              className="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1 font-mono text-[11px] min-h-[24px]"
                              aria-label={`Call ${item.customerName} at ${item.customerPhone}`}
                            >
                              📞 {item.customerPhone}
                            </a>
                          )}
                        </div>
                      </div>

                      {/* Status chip */}
                      <StatusChip status={item.status} />
                    </div>

                    {/* Due Date & Attention Reason */}
                    <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800 text-xs flex flex-wrap items-center justify-between gap-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-400 dark:text-slate-500">Due Date:</span>
                        <span className="font-medium text-slate-700 dark:text-slate-300 font-mono">
                          {formatShortDate(item.effectiveDueDate)}
                        </span>
                        {activeQueue === 'OVERDUE' && overdueDays > 0 && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                            +{overdueDays}d late
                          </span>
                        )}
                        {activeQueue === 'DUE_TODAY' && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                            Today
                          </span>
                        )}
                      </div>

                      <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 italic">
                        {reasonForAttention}
                      </div>
                    </div>

                    {/* Garments breakdown for Ready for Pickup */}
                    {activeQueue === 'READY_FOR_PICKUP' &&
                      (() => {
                        const ro = readyOrders.find((r) => r.id === item.id);
                        if (!ro || ro.readyItems.length === 0) return null;
                        return (
                          <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800 text-xs">
                            <div className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 mb-0.5">
                              READY GARMENTS:
                            </div>
                            <div className="space-y-0.5 text-slate-600 dark:text-slate-300">
                              {ro.readyItems.map((gi, idx) => (
                                <div key={idx} className="flex items-center gap-1.5 pl-1">
                                  <span className="text-emerald-500 font-bold">✓</span>
                                  <span>
                                    {gi.garmentName} ×{gi.quantity}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })()}
                  </div>

                  {/* Financials & Action Row */}
                  <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-3 text-xs">
                      <div>
                        <span className="text-slate-400">Total: </span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200 font-mono">
                          {currencyFormatter(item.totalAmount)}
                        </span>
                      </div>

                      <div>
                        {item.amountDue > 0 ? (
                          <span className="text-rose-600 dark:text-rose-400 font-semibold font-mono">
                            Due: {currencyFormatter(item.amountDue)}
                          </span>
                        ) : (
                          <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                            ✓ Paid in Full
                          </span>
                        )}
                      </div>
                    </div>

                    <Button
                      variant="primary"
                      className="min-h-[44px] min-w-[44px] text-xs font-semibold px-3.5 py-1.5 cursor-pointer inline-flex items-center justify-center gap-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/orders/${item.id}`);
                      }}
                      aria-label={`Open order #${item.orderNumber}`}
                    >
                      Open Order →
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};
