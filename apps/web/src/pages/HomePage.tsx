import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button, Card, LoadingState, EmptyState, ErrorState } from '@growfast/ui';
import {
  MembershipTier,
  type CustomerDTO,
  type PaginatedResponse,
  type OrderSummaryDTO,
  OrderStatus,
  PickupType,
} from '@growfast/shared-types';
import { CustomerCreateModal } from '../components/CustomerCreateModal';
import { ThemeToggle } from '../components/ThemeToggle';
import { apiFetch, ApiError, friendlyErrorMessage } from '../services/api';
import {
  LogOut,
  Shirt,
  Shield,
  Users,
  Package,
  Truck,
  Search,
  X,
  Phone,
  Mail,
  MapPin,
  Plus,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  ArrowRight,
  Info,
  Calendar,
  Clock,
  Scale,
  AlertTriangle,
  RotateCw,
  ChevronDown,
  ChevronUp,
  Settings,
  Tag,
  BarChart3,
} from 'lucide-react';

const ROLE_CONFIG: Record<string, { icon: React.ReactNode; color: string; modules: string[] }> = {
  OWNER: {
    icon: <Shield size={24} />,
    color: '#7C3AED',
    modules: ['Dashboard', 'Orders', 'Customers', 'Employees', 'Analytics', 'Settings'],
  },
  MANAGER: {
    icon: <Users size={24} />,
    color: '#2563EB',
    modules: ['Dashboard', 'Orders', 'Customers', 'Processing', 'Reports'],
  },
  COUNTER: {
    icon: <Package size={24} />,
    color: '#059669',
    modules: ['New Order', 'Orders', 'Customers', 'Payments'],
  },
  DELIVERY: {
    icon: <Truck size={24} />,
    color: '#D97706',
    modules: ['Delivery Tasks', 'Route Map', 'Collections'],
  },
};

const MEMBERSHIP_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  NONE: {
    bg: 'var(--bg-surface-muted, #F1F5F9)',
    text: 'var(--text-secondary, #475569)',
    border: 'var(--border, #CBD5E1)',
  },
  SILVER: {
    bg: 'var(--bg-surface-muted, #F1F5F9)',
    text: 'var(--text-primary, #334155)',
    border: 'var(--border, #94A3B8)',
  },
  GOLD: {
    bg: 'var(--warning-bg, #FEF3C7)',
    text: 'var(--warning-text, #92400E)',
    border: 'var(--warning-border, #F59E0B)',
  },
  PLATINUM: {
    bg: 'rgba(124, 58, 237, 0.15)',
    text: '#a855f7',
    border: 'rgba(168, 85, 247, 0.3)',
  },
};

type SearchFilterMode = 'ALL' | 'NAME' | 'PHONE' | 'CUSTOMER_ID' | 'INVOICE';

function formatDueTime(isoDateString?: string | null): string {
  if (!isoDateString) return 'Due Today';
  try {
    const d = new Date(isoDateString);
    if (isNaN(d.getTime())) return 'Due Today';
    if (d.getHours() === 0 && d.getMinutes() === 0) {
      return 'Due Today';
    }
    return `Due: ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  } catch {
    return 'Due Today';
  }
}

function getStatusBadgeStyle(status: string) {
  switch (status) {
    case 'READY':
      return {
        bg: 'var(--success-bg, #DCFCE7)',
        text: 'var(--success-text, #166534)',
        border: 'var(--success-border, #86EFAC)',
      };
    case 'PROCESSING':
      return {
        bg: 'var(--warning-bg, #FEF3C7)',
        text: 'var(--warning-text, #92400E)',
        border: 'var(--warning-border, #F59E0B)',
      };
    case 'RECEIVED':
      return {
        bg: 'var(--bg-surface-muted, #F1F5F9)',
        text: 'var(--text-secondary, #475569)',
        border: 'var(--border, #CBD5E1)',
      };
    default:
      return {
        bg: 'var(--bg-surface-muted, #F1F5F9)',
        text: 'var(--text-secondary, #475569)',
        border: 'var(--border, #CBD5E1)',
      };
  }
}

export const HomePage: React.FC = () => {
  const { employee, token, logout } = useAuth();
  const navigate = useNavigate();

  // ─── Search State ──────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [filterMode, setFilterMode] = useState<SearchFilterMode>('ALL');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Customer search results (ONLY populated when user searches)
  const [customers, setCustomers] = useState<CustomerDTO[]>([]);
  const [totalCustomerCount, setTotalCustomerCount] = useState(0);
  const [isCustomerLoading, setIsCustomerLoading] = useState(false);
  const [customerError, setCustomerError] = useState<string | null>(null);

  // Invoice / Order search results
  const [matchedOrders, setMatchedOrders] = useState<OrderSummaryDTO[]>([]);
  const [isOrderSearching, setIsOrderSearching] = useState(false);

  // Selected customer for quick order creation seam
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerDTO | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Operational alert dismiss state
  const [isAlertDismissed, setIsAlertDismissed] = useState(false);

  // Find / Edit Order Modal State (CHANGE 2)
  const [isFindOrderModalOpen, setIsFindOrderModalOpen] = useState(false);
  const [findOrderQuery, setFindOrderQuery] = useState('');
  const [isFindingOrder, setIsFindingOrder] = useState(false);
  const [findOrderError, setFindOrderError] = useState<string | null>(null);

  // Owner Settings Navigation Dropdown State
  const [isOwnerMenuOpen, setIsOwnerMenuOpen] = useState(false);
  const ownerMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ownerMenuRef.current && !ownerMenuRef.current.contains(e.target as Node)) {
        setIsOwnerMenuOpen(false);
      }
    };
    if (isOwnerMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOwnerMenuOpen]);

  const handleFindOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = findOrderQuery.trim();
    if (!query) return;

    setIsFindingOrder(true);
    setFindOrderError(null);

    try {
      const cleanQuery = query.replace(/^#/, '');

      // Try direct ID lookup first
      try {
        const directRes = await apiFetch<{ id: string }>(
          `/orders/${encodeURIComponent(cleanQuery)}`,
          {
            token,
          },
        );
        if (directRes?.id) {
          setIsFindOrderModalOpen(false);
          setFindOrderQuery('');
          navigate(`/orders/${directRes.id}`);
          return;
        }
      } catch {
        // Direct ID not found, try search
      }

      // Try search query lookup
      const searchRes = await apiFetch<{ success: boolean; data: OrderSummaryDTO[] }>(
        `/orders?search=${encodeURIComponent(cleanQuery)}&pageSize=5`,
        { token },
      );

      const matches = searchRes.data || [];
      const exactMatch = matches.find(
        (o) =>
          o.orderNumber.toUpperCase() === cleanQuery.toUpperCase() ||
          o.id.toLowerCase() === cleanQuery.toLowerCase(),
      );

      const targetOrder = exactMatch || matches[0];

      if (targetOrder) {
        setIsFindOrderModalOpen(false);
        setFindOrderQuery('');
        navigate(`/orders/${targetOrder.id}`);
        return;
      }

      setFindOrderError(
        `No order found matching "${query}". Please verify the Order ID or Number.`,
      );
    } catch (err: any) {
      setFindOrderError(err.message || `Failed to search order "${query}".`);
    } finally {
      setIsFindingOrder(false);
    }
  };

  // ─── Today's Due Orders State ─────────────────────────────────────────────
  // IMPORTANT: The actual order list MUST NOT be visible initially.
  // It loads and expands ONLY when the user clicks "View Today's Due Orders".
  const [dueOrders, setDueOrders] = useState<OrderSummaryDTO[]>([]);
  const [dueOrdersCount, setDueOrdersCount] = useState<number | null>(null);
  const [isDueOrdersExpanded, setIsDueOrdersExpanded] = useState(false);
  const [isLoadingDueOrders, setIsLoadingDueOrders] = useState(false);
  const [dueOrdersError, setDueOrdersError] = useState<string | null>(null);
  const [hasFetchedDueOrders, setHasFetchedDueOrders] = useState(false);

  // Debounce search query (300ms)
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(searchQuery.trim());
      setPage(1);
    }, 300);

    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Lightweight badge count fetch on mount (only counts, does NOT fetch full orders)
  useEffect(() => {
    if (!token) return;

    let isMounted = true;
    apiFetch<{ success: boolean; count: number }>('/orders/due-today?countOnly=true', { token })
      .then((res) => {
        if (isMounted && typeof res.count === 'number') {
          setDueOrdersCount(res.count);
        }
      })
      .catch(() => {
        // Silently ignore badge count error; user can still click action to fetch
      });

    return () => {
      isMounted = false;
    };
  }, [token]);

  // Fetch Customers when debouncedQuery is NOT empty
  const fetchSearchResults = useCallback(
    async (query: string, currentPage: number, mode: SearchFilterMode) => {
      if (!token) return;

      // DO NOT show customers when query is empty!
      if (!query) {
        setCustomers([]);
        setTotalCustomerCount(0);
        setMatchedOrders([]);
        return;
      }

      const isInvoiceMode =
        mode === 'INVOICE' ||
        query.toUpperCase().startsWith('ORD-') ||
        query.toUpperCase().startsWith('GF-') ||
        query.startsWith('#');

      if (isInvoiceMode) {
        setIsOrderSearching(true);
        setCustomerError(null);
        try {
          const cleanOrderQuery = query.replace(/^#/, '');
          const res = await apiFetch<{ success: boolean; data: OrderSummaryDTO[] }>(
            `/orders?search=${encodeURIComponent(cleanOrderQuery)}&pageSize=5`,
            { token },
          );
          setMatchedOrders(res.data || []);
          setCustomers([]);
          setTotalCustomerCount(0);
        } catch (err: any) {
          setMatchedOrders([]);
        } finally {
          setIsOrderSearching(false);
        }
        return;
      }

      // Customer Directory Search
      setIsCustomerLoading(true);
      setCustomerError(null);
      setMatchedOrders([]);

      try {
        const queryParams = new URLSearchParams();
        queryParams.set('query', query);
        queryParams.set('page', String(currentPage));
        queryParams.set('pageSize', String(pageSize));

        const responseData = await apiFetch<PaginatedResponse<CustomerDTO>>(
          `/customers/search?${queryParams.toString()}`,
          { token, retries: 2, retryDelay: 1000 },
        );
        setCustomers(responseData.data || []);
        setTotalCustomerCount(responseData.total || 0);
      } catch (err: any) {
        if (err instanceof ApiError && err.code === 'UNAUTHORIZED') {
          logout();
          return;
        }
        setCustomerError(friendlyErrorMessage(err));
        setCustomers([]);
        setTotalCustomerCount(0);
      } finally {
        setIsCustomerLoading(false);
      }
    },
    [token, pageSize, logout],
  );

  // Trigger search ONLY when debouncedQuery changes
  useEffect(() => {
    fetchSearchResults(debouncedQuery, page, filterMode);
  }, [debouncedQuery, page, filterMode, fetchSearchResults]);

  // Fetch Today's Due Orders on click
  const fetchDueTodayOrders = useCallback(async () => {
    if (!token) return;

    setIsLoadingDueOrders(true);
    setDueOrdersError(null);

    try {
      const res = await apiFetch<{
        success: boolean;
        data: OrderSummaryDTO[];
        total: number;
      }>('/orders/due-today', { token, retries: 2, retryDelay: 1000 });

      setDueOrders(res.data || []);
      setDueOrdersCount(res.total ?? (res.data ? res.data.length : 0));
      setHasFetchedDueOrders(true);
    } catch (err: any) {
      if (err instanceof ApiError && err.code === 'UNAUTHORIZED') {
        logout();
        return;
      }
      setDueOrdersError(friendlyErrorMessage(err));
      setDueOrders([]);
    } finally {
      setIsLoadingDueOrders(false);
    }
  }, [token, logout]);

  // User explicitly clicks "View Today's Due Orders"
  const handleToggleDueOrders = () => {
    if (!isDueOrdersExpanded) {
      setIsDueOrdersExpanded(true);
      fetchDueTodayOrders();
    } else {
      setIsDueOrdersExpanded(false);
    }
  };

  const handleCustomerCreated = (newCustomer: CustomerDTO) => {
    setSelectedCustomer(newCustomer);
    setSearchQuery(newCustomer.phone);
    showNotice(`Customer "${newCustomer.name}" created successfully!`);
  };

  const showNotice = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  if (!employee) return null;

  const config = ROLE_CONFIG[employee.role] || ROLE_CONFIG.COUNTER!;
  const totalCustomerPages = Math.ceil(totalCustomerCount / pageSize) || 1;

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--bg-app, #F8FAFC)',
        fontFamily: "'Inter', sans-serif",
        color: 'var(--text-primary, #0F172A)',
        transition: 'background-color 0.2s ease, color 0.2s ease',
      }}
    >
      {/* Toast banner */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed',
            top: '16px',
            right: '16px',
            left: '16px',
            maxWidth: '480px',
            margin: '0 auto',
            zIndex: 1000,
            background: 'var(--bg-surface-elevated, #1E293B)',
            color: 'var(--text-primary, #FFFFFF)',
            padding: '12px 18px',
            borderRadius: '10px',
            boxShadow: '0 10px 15px -3px var(--shadow-lg, rgba(0, 0, 0, 0.2))',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '0.875rem',
            border: '1px solid var(--border, #334155)',
          }}
        >
          <Info size={20} color="#38BDF8" style={{ flexShrink: 0 }} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header */}
      <header
        style={{
          background: 'var(--bg-surface, #FFFFFF)',
          borderBottom: '1px solid var(--border, #E2E8F0)',
          padding: '12px 24px',
          position: 'sticky',
          top: 0,
          zIndex: 100,
          transition: 'background-color 0.2s ease, border-color 0.2s ease',
        }}
      >
        <div
          style={{
            maxWidth: '1280px',
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            flexWrap: 'wrap',
          }}
        >
          {/* Brand & User identity */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              flexShrink: 0,
              minWidth: 0,
            }}
          >
            <div
              style={{
                width: '42px',
                height: '42px',
                minWidth: '42px',
                minHeight: '42px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#FFFFFF',
                boxShadow: '0 4px 12px rgba(59, 130, 246, 0.25)',
              }}
            >
              <Shirt size={22} />
            </div>
            <div style={{ minWidth: 0 }}>
              <h1
                style={{
                  fontSize: '1.1rem',
                  fontWeight: 800,
                  margin: 0,
                  color: 'var(--text-primary, #0F172A)',
                  letterSpacing: '-0.01em',
                }}
              >
                GrowFast Laundry
              </h1>
              <span
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--text-muted, #64748B)',
                  display: 'block',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: '320px',
                }}
              >
                {employee.name} • {employee.role === 'COUNTER' ? 'COUNTER' : employee.role} (
                {employee.storeName})
              </span>
            </div>
          </div>

          {/* Navigation Actions */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              flexWrap: 'wrap',
              flexShrink: 0,
            }}
          >
            {employee.role === 'OWNER' && (
              <Button
                id="home-dashboard"
                variant="outline"
                size="sm"
                onClick={() => navigate('/dashboard')}
                icon={<Package size={15} />}
                aria-label="Daily Dashboard"
                style={{ minHeight: '38px', whiteSpace: 'nowrap' }}
              >
                <span className="hidden sm:inline">Dashboard</span>
              </Button>
            )}
            <Button
              id="home-deliveries"
              variant="outline"
              size="sm"
              onClick={() => navigate('/deliveries')}
              icon={<Truck size={15} />}
              aria-label="Deliveries"
              style={{ minHeight: '38px', whiteSpace: 'nowrap' }}
            >
              <span className="hidden sm:inline">Deliveries</span>
            </Button>
            {/* Owner Settings Area (Exclusively for OWNER role) */}
            {employee.role === 'OWNER' ? (
              <div className="relative" ref={ownerMenuRef}>
                <Button
                  id="owner-settings-nav"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsOwnerMenuOpen((prev) => !prev)}
                  icon={<Settings size={15} className="text-blue-600 dark:text-blue-400" />}
                  aria-label="Owner Settings"
                  aria-expanded={isOwnerMenuOpen}
                  style={{ minHeight: '38px', whiteSpace: 'nowrap' }}
                  className="font-bold border-blue-200 dark:border-blue-900 bg-blue-50/60 dark:bg-blue-950/30"
                >
                  <span className="hidden sm:inline">Owner Settings</span>
                  <span className="sm:hidden">Settings</span>
                  <ChevronDown size={14} className="ml-1 opacity-70" />
                </Button>

                {isOwnerMenuOpen && (
                  <div
                    id="owner-settings-dropdown-menu"
                    className="absolute right-0 mt-2 w-56 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl py-1.5 z-50 text-xs animate-in fade-in zoom-in-95 duration-100"
                  >
                    <div className="px-3 py-1.5 border-b border-gray-100 dark:border-slate-850 text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">
                      Owner Settings
                    </div>

                    {/* Section 1: Staff */}
                    <button
                      type="button"
                      id="owner-menu-staff"
                      onClick={() => {
                        setIsOwnerMenuOpen(false);
                        navigate('/owner/settings?tab=staff');
                      }}
                      className="w-full text-left px-3.5 py-2.5 flex items-center gap-2.5 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors font-medium text-gray-700 dark:text-slate-200 min-h-[44px] cursor-pointer"
                    >
                      <Users size={16} className="text-blue-600 dark:text-blue-400 shrink-0" />
                      <div>
                        <div className="font-bold text-gray-900 dark:text-slate-100">Staff</div>
                        <div className="text-[10px] text-gray-500 dark:text-slate-400">
                          Team roles & permissions
                        </div>
                      </div>
                    </button>

                    {/* Section 2: Design Tags */}
                    <button
                      type="button"
                      id="owner-menu-design-tags"
                      onClick={() => {
                        setIsOwnerMenuOpen(false);
                        navigate('/owner/settings?tab=design-tags');
                      }}
                      className="w-full text-left px-3.5 py-2.5 flex items-center gap-2.5 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors font-medium text-gray-700 dark:text-slate-200 min-h-[44px] cursor-pointer"
                    >
                      <Tag size={16} className="text-purple-600 dark:text-purple-400 shrink-0" />
                      <div>
                        <div className="font-bold text-gray-900 dark:text-slate-100">
                          Design Tags
                        </div>
                        <div className="text-[10px] text-gray-500 dark:text-slate-400">
                          Layout, barcode & typography
                        </div>
                      </div>
                    </button>

                    {/* Section 3: Catalog */}
                    <button
                      type="button"
                      id="owner-menu-catalog"
                      onClick={() => {
                        setIsOwnerMenuOpen(false);
                        navigate('/owner/settings?tab=catalog');
                      }}
                      className="w-full text-left px-3.5 py-2.5 flex items-center gap-2.5 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors font-medium text-gray-700 dark:text-slate-200 min-h-[44px] cursor-pointer"
                    >
                      <Shirt
                        size={16}
                        className="text-emerald-600 dark:text-emerald-400 shrink-0"
                      />
                      <div>
                        <div className="font-bold text-gray-900 dark:text-slate-100">Catalog</div>
                        <div className="text-[10px] text-gray-500 dark:text-slate-400">
                          Garment types & pricing
                        </div>
                      </div>
                    </button>

                    {/* Section 4: Reports */}
                    <button
                      type="button"
                      id="owner-menu-reports"
                      onClick={() => {
                        setIsOwnerMenuOpen(false);
                        navigate('/reports/daily-orders');
                      }}
                      className="w-full text-left px-3.5 py-2.5 flex items-center gap-2.5 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors font-medium text-gray-700 dark:text-slate-200 min-h-[44px] cursor-pointer"
                    >
                      <BarChart3
                        size={16}
                        className="text-amber-600 dark:text-amber-400 shrink-0"
                      />
                      <div>
                        <div className="font-bold text-gray-900 dark:text-slate-100">Reports</div>
                        <div className="text-[10px] text-gray-500 dark:text-slate-400">
                          Daily orders & summaries
                        </div>
                      </div>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              /* Non-owner staff navigation: Staff and Catalog buttons (No Design Tags) */
              <>
                {employee.role === 'MANAGER' && (
                  <>
                    <Button
                      id="home-staff-management"
                      variant="outline"
                      size="sm"
                      onClick={() => navigate('/staff')}
                      icon={<Users size={15} />}
                      aria-label="Staff Management"
                      style={{ minHeight: '38px', whiteSpace: 'nowrap' }}
                    >
                      <span className="hidden sm:inline">Staff</span>
                    </Button>
                    <Button
                      id="home-reports"
                      variant="outline"
                      size="sm"
                      onClick={() => navigate('/reports/daily-orders')}
                      icon={<BarChart3 size={15} />}
                      aria-label="Reports"
                      style={{ minHeight: '38px', whiteSpace: 'nowrap' }}
                    >
                      <span className="hidden sm:inline">Reports</span>
                    </Button>
                  </>
                )}
                <Button
                  id="home-garment-catalog"
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/catalog')}
                  icon={<Shirt size={15} />}
                  aria-label="Garment Catalog"
                  style={{ minHeight: '38px', whiteSpace: 'nowrap' }}
                >
                  <span className="hidden sm:inline">Catalog</span>
                </Button>
              </>
            )}

            <Button
              id="find-edit-order-btn"
              variant="outline"
              size="sm"
              onClick={() => setIsFindOrderModalOpen(true)}
              icon={<Search size={15} />}
              aria-label="Find / Edit Order"
              style={{
                minHeight: '38px',
                whiteSpace: 'nowrap',
                borderRadius: '9999px',
                fontSize: '0.825rem',
              }}
            >
              <span className="hidden sm:inline">Find / Edit Order</span>
              <span className="sm:hidden">Find Order</span>
            </Button>

            <div
              style={{
                width: '1px',
                height: '24px',
                background: 'var(--border, #E2E8F0)',
                margin: '0 4px',
                flexShrink: 0,
              }}
            />

            <ThemeToggle size="sm" />

            <Button
              variant="ghost"
              size="sm"
              onClick={logout}
              icon={<LogOut size={15} />}
              aria-label="Sign Out"
              style={{ minHeight: '38px', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}
            >
              <span className="hidden sm:inline">Sign Out</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Counter Screen Content */}
      <main style={{ maxWidth: '960px', margin: '0 auto', padding: '24px 16px' }}>
        {/* ─── 1. Operational Alert Banner ─────────────────────────────────── */}
        {!isAlertDismissed && (
          <div
            id="operational-alerts-banner"
            role="region"
            aria-label="Operational Notice"
            style={{
              background: 'var(--bg-surface, #FFFFFF)',
              border: '1px solid var(--border, #E2E8F0)',
              borderRadius: '16px',
              padding: '16px 20px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '14px',
              boxShadow: 'var(--shadow-neu-card-sm)',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: '240px' }}>
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#FFFFFF',
                  boxShadow: '0 4px 10px rgba(37, 99, 235, 0.25)',
                  flexShrink: 0,
                }}
              >
                <Calendar size={18} />
              </div>
              <div>
                <strong
                  style={{
                    fontSize: '0.95rem',
                    fontWeight: 700,
                    color: 'var(--text-primary, #0F172A)',
                    display: 'block',
                  }}
                >
                  Counter Operational Screen
                </strong>
                <span style={{ fontSize: '0.825rem', color: 'var(--text-muted, #64748B)' }}>
                  {dueOrdersCount != null && dueOrdersCount > 0
                    ? `${dueOrdersCount} orders requiring attention today. Click below to inspect #`
                    : "Ready for walk-in customer lookup, new order intake, and today's due order handovers."}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Button
                id="view-due-orders-alert-btn"
                variant="outline"
                size="sm"
                onClick={() => {
                  if (!isDueOrdersExpanded) {
                    setIsDueOrdersExpanded(true);
                    fetchDueTodayOrders();
                  }
                }}
                style={{
                  minHeight: '38px',
                  borderRadius: '9999px',
                  fontSize: '0.825rem',
                  fontWeight: 600,
                }}
                aria-label="Quick inspect due orders"
              >
                View Due Orders
              </Button>
              <button
                type="button"
                onClick={() => setIsAlertDismissed(true)}
                aria-label="Dismiss operational notice"
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  minHeight: '44px',
                  minWidth: '44px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-muted, #64748B)',
                  borderRadius: '8px',
                }}
              >
                <X size={18} />
              </button>
            </div>
          </div>
        )}

        {/* ─── 2. Customer Search / Invoice Section ───────────────────────── */}
        <Card
          padding="lg"
          elevated
          style={{
            marginBottom: '20px',
            borderRadius: '20px',
            border: '1px solid var(--border, #E2E8F0)',
            background: 'var(--bg-surface, #FFFFFF)',
            boxShadow: 'var(--shadow-neu-card)',
            padding: '24px 28px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '20px',
              flexWrap: 'wrap',
              gap: '14px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#FFFFFF',
                  boxShadow: '0 4px 10px rgba(37, 99, 235, 0.25)',
                  flexShrink: 0,
                }}
              >
                <Calendar size={20} />
              </div>
              <div>
                <h2
                  style={{
                    fontSize: '1.25rem',
                    fontWeight: 700,
                    margin: '0 0 2px',
                    color: 'var(--text-primary, #0F172A)',
                  }}
                >
                  Search Customer / Invoice
                </h2>
                <p style={{ fontSize: '0.825rem', color: 'var(--text-muted, #64748B)', margin: 0 }}>
                  Lookup customer by name, mobile, ID, address, or search invoice #
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              <Button
                id="find-edit-order-action-btn"
                variant="outline"
                size="md"
                icon={<Search size={16} />}
                onClick={() => setIsFindOrderModalOpen(true)}
                aria-label="Find / Edit Order"
                style={{
                  minHeight: '44px',
                  borderRadius: '9999px',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                }}
              >
                Find / Edit Order
              </Button>
              {/* Primary Action: + Add New Customer */}
              <Button
                id="add-new-customer-btn"
                variant="primary"
                size="md"
                icon={<Plus size={18} />}
                onClick={() => setIsCreateModalOpen(true)}
                aria-label="Add New Customer"
                style={{
                  minHeight: '44px',
                  borderRadius: '9999px',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                  boxShadow: '0 4px 14px rgba(37, 99, 235, 0.3)',
                }}
              >
                Add New Customer
              </Button>
            </div>
          </div>

          {/* Search Controls: [ Filter Select ▼ ] | [ Search icon ] [ Search Input... ] [ Clear X ] */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              background: 'var(--bg-surface-inset, #F8FAFC)',
              border: '1px solid var(--border, #E2E8F0)',
              borderRadius: '14px',
              boxShadow: 'var(--shadow-neu-inset)',
              padding: '4px 8px',
              gap: '6px',
              flexWrap: 'wrap',
              marginBottom: debouncedQuery ? '14px' : '0',
            }}
          >
            {/* Filter Mode Selector */}
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <select
                id="search-filter-mode"
                aria-label="Search criteria filter"
                value={filterMode}
                onChange={(e) => setFilterMode(e.target.value as SearchFilterMode)}
                style={{
                  height: '42px',
                  padding: '0 28px 0 10px',
                  fontSize: '0.875rem',
                  fontFamily: "'Inter', sans-serif",
                  fontWeight: 600,
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--text-primary, #0F172A)',
                  cursor: 'pointer',
                  appearance: 'none',
                  outline: 'none',
                }}
              >
                <option value="ALL">All Fields</option>
                <option value="NAME">Name</option>
                <option value="PHONE">WhatsApp Number</option>
                <option value="CUSTOMER_ID">Customer ID</option>
                <option value="INVOICE">Invoice #</option>
              </select>
              <ChevronDown
                size={14}
                color="var(--text-muted, #64748B)"
                style={{
                  position: 'absolute',
                  right: '8px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  pointerEvents: 'none',
                }}
              />
            </div>

            <div
              style={{
                width: '1px',
                height: '24px',
                background: 'var(--border, #CBD5E1)',
                flexShrink: 0,
              }}
            />

            {/* Search Input Box */}
            <div
              style={{
                position: 'relative',
                flex: '1 1 240px',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <Search
                size={18}
                color="var(--text-placeholder, #94A3B8)"
                style={{
                  position: 'absolute',
                  left: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  pointerEvents: 'none',
                }}
              />
              <input
                id="customer-search-input"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  filterMode === 'INVOICE'
                    ? 'Search invoice or order # (e.g. ORD-1024)...'
                    : filterMode === 'PHONE'
                      ? 'Search WhatsApp number (e.g. 9876543210)...'
                      : filterMode === 'CUSTOMER_ID'
                        ? 'Search customer ID (e.g. CUS-000001)...'
                        : filterMode === 'NAME'
                          ? 'Search customer name (e.g. Rahul)...'
                          : 'Search by WhatsApp number, name, customer ID, or invoice #...'
                }
                aria-label="Search Customer or Invoice"
                style={{
                  width: '100%',
                  padding: '11px 36px 11px 36px',
                  fontSize: '0.925rem',
                  fontFamily: "'Inter', sans-serif",
                  border: 'none',
                  outline: 'none',
                  boxSizing: 'border-box',
                  minHeight: '42px',
                  background: 'transparent',
                  color: 'var(--text-primary, #0F172A)',
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search input"
                  style={{
                    position: 'absolute',
                    right: '4px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    width: '44px',
                    height: '44px',
                    minWidth: '44px',
                    minHeight: '44px',
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--text-muted, #64748B)',
                  }}
                >
                  <X size={18} />
                </button>
              )}
            </div>
          </div>

          {/* Active Search Summary */}
          {debouncedQuery && (
            <div
              style={{
                fontSize: '0.85rem',
                color: 'var(--text-secondary, #475569)',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span>
                Search results for: <strong>"{debouncedQuery}"</strong> (
                {matchedOrders.length > 0
                  ? `${matchedOrders.length} orders`
                  : `${totalCustomerCount} customers`}{' '}
                found)
              </span>
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--accent, #2563EB)',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  fontWeight: 600,
                  padding: '4px 8px',
                  minHeight: '44px',
                  minWidth: '44px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                Clear Search
              </button>
            </div>
          )}

          {/* Search Result Display — ONLY shown when user searches */}
          {debouncedQuery && (
            <div>
              {isCustomerLoading || isOrderSearching ? (
                <LoadingState message="Searching records..." />
              ) : customerError ? (
                <ErrorState
                  title="Search Failed"
                  message={customerError}
                  onRetry={() => fetchSearchResults(debouncedQuery, page, filterMode)}
                />
              ) : matchedOrders.length > 0 ? (
                /* Invoice search results */
                <div style={{ display: 'grid', gap: '10px' }}>
                  {matchedOrders.map((ord) => (
                    <div
                      key={ord.id}
                      style={{
                        padding: '14px 16px',
                        borderRadius: '10px',
                        border: '1px solid var(--border, #E2E8F0)',
                        background: 'var(--bg-surface, #FFFFFF)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px',
                        flexWrap: 'wrap',
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span
                            style={{
                              fontFamily: 'monospace',
                              fontWeight: 700,
                              color: 'var(--accent, #2563EB)',
                              fontSize: '0.95rem',
                            }}
                          >
                            #{ord.orderNumber}
                          </span>
                          <span
                            style={{
                              fontSize: '0.75rem',
                              padding: '2px 8px',
                              borderRadius: '9999px',
                              fontWeight: 600,
                              ...getStatusBadgeStyle(ord.status),
                            }}
                          >
                            {ord.status}
                          </span>
                        </div>
                        <div
                          style={{
                            fontSize: '0.85rem',
                            color: 'var(--text-secondary, #475569)',
                            marginTop: '4px',
                          }}
                        >
                          {ord.customerName} ({ord.customerPhone}) · {ord.itemCount} items
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span
                          style={{
                            fontSize: '0.85rem',
                            fontWeight: 700,
                            color:
                              ord.amountDue > 0
                                ? 'var(--warning-text, #D97706)'
                                : 'var(--success-text, #166534)',
                          }}
                        >
                          {ord.amountDue > 0 ? `Balance: ₹${ord.amountDue}` : 'Paid'}
                        </span>
                        <Button
                          id={`find-edit-order-${ord.id}`}
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/orders/${ord.id}`)}
                          icon={<ArrowRight size={15} />}
                          aria-label={`Find and edit order ${ord.orderNumber}`}
                          style={{ minHeight: '44px' }}
                        >
                          Find / Edit Order
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : customers.length === 0 ? (
                <EmptyState
                  title="No results found"
                  message={`No customer record matches "${debouncedQuery}". Try another mobile number, name, or create a new customer.`}
                  action={
                    <Button variant="outline" size="sm" onClick={() => setIsCreateModalOpen(true)}>
                      + Create Customer
                    </Button>
                  }
                />
              ) : (
                /* Customer search results */
                <div>
                  <div style={{ display: 'grid', gap: '10px' }}>
                    {customers.map((c) => {
                      const isSelected = selectedCustomer?.id === c.id;
                      const tierStyle = MEMBERSHIP_COLORS[c.membership] || MEMBERSHIP_COLORS.NONE!;

                      return (
                        <div
                          key={c.id}
                          onClick={() => setSelectedCustomer(c)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') setSelectedCustomer(c);
                          }}
                          style={{
                            padding: '14px 16px',
                            borderRadius: '10px',
                            border: isSelected
                              ? '2px solid var(--accent, #2563EB)'
                              : '1px solid var(--border, #E2E8F0)',
                            background: isSelected
                              ? 'var(--accent-muted, #EFF6FF)'
                              : 'var(--bg-surface, #FFFFFF)',
                            cursor: 'pointer',
                            transition: 'all 150ms ease',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px',
                            minHeight: '44px',
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              flexWrap: 'wrap',
                              gap: '8px',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <span
                                style={{
                                  fontSize: '1rem',
                                  fontWeight: 700,
                                  color: 'var(--text-primary, #0F172A)',
                                }}
                              >
                                {c.name}
                              </span>
                              <span
                                style={{
                                  padding: '2px 8px',
                                  borderRadius: '9999px',
                                  fontSize: '0.7rem',
                                  fontWeight: 700,
                                  background: tierStyle.bg,
                                  color: tierStyle.text,
                                  border: `1px solid ${tierStyle.border}`,
                                }}
                              >
                                {c.membership} TIER
                              </span>
                              {c.discountPercent > 0 && (
                                <span
                                  style={{
                                    padding: '2px 8px',
                                    borderRadius: '9999px',
                                    fontSize: '0.7rem',
                                    fontWeight: 700,
                                    background: 'var(--success-bg, #DCFCE7)',
                                    color: 'var(--success-text, #166534)',
                                    border: '1px solid var(--success-border, #86EFAC)',
                                  }}
                                >
                                  {c.discountPercent}% OFF
                                </span>
                              )}
                              {(c.customerCode || c.id) && (
                                <span
                                  style={{
                                    padding: '2px 8px',
                                    borderRadius: '9999px',
                                    fontSize: '0.7rem',
                                    fontWeight: 700,
                                    fontFamily: 'monospace',
                                    background: 'var(--accent-muted, #EFF6FF)',
                                    color: 'var(--accent, #2563EB)',
                                    border: '1px solid var(--accent-subtle, #BFDBFE)',
                                  }}
                                >
                                  {c.customerCode || c.id}
                                </span>
                              )}
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/customers/${c.id}`);
                                }}
                                style={{
                                  background: 'var(--bg-surface-muted, #F1F5F9)',
                                  color: 'var(--text-primary, #0F172A)',
                                  border: '1px solid var(--border, #CBD5E1)',
                                  borderRadius: '6px',
                                  padding: '6px 12px',
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  minHeight: '44px',
                                  minWidth: '44px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                              >
                                View Profile
                              </button>
                            </div>
                          </div>

                          <div
                            style={{
                              display: 'flex',
                              flexWrap: 'wrap',
                              gap: '14px',
                              fontSize: '0.85rem',
                              color: 'var(--text-secondary, #475569)',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <Phone size={14} color="var(--text-muted, #64748B)" />
                              <strong style={{ color: 'var(--text-primary, #0F172A)' }}>
                                {c.phone}
                              </strong>
                            </div>
                            {c.email && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Mail size={14} color="var(--text-muted, #64748B)" />
                                <span>{c.email}</span>
                              </div>
                            )}
                            {c.address && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <MapPin size={14} color="var(--text-muted, #64748B)" />
                                <span>
                                  {c.address} {c.pincode ? `(${c.pincode})` : ''}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Pagination */}
                  {totalCustomerPages > 1 && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginTop: '16px',
                        paddingTop: '12px',
                        borderTop: '1px solid var(--border, #E2E8F0)',
                      }}
                    >
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={page <= 1}
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        icon={<ChevronLeft size={16} />}
                        aria-label="Previous Page"
                        style={{ minHeight: '44px' }}
                      >
                        Previous
                      </Button>

                      <span
                        style={{
                          fontSize: '0.85rem',
                          fontWeight: 600,
                          color: 'var(--text-secondary, #475569)',
                        }}
                      >
                        Page {page} of {totalCustomerPages} ({totalCustomerCount} total)
                      </span>

                      <Button
                        variant="outline"
                        size="sm"
                        disabled={page >= totalCustomerPages}
                        onClick={() => setPage((p) => Math.min(totalCustomerPages, p + 1))}
                        icon={<ChevronRight size={16} />}
                        aria-label="Next Page"
                        style={{ minHeight: '44px' }}
                      >
                        Next
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </Card>

        {/* ─── Selected Customer Seam (Order Intake) ────────────────────── */}
        {selectedCustomer && (
          <Card
            padding="md"
            elevated
            style={{
              marginBottom: '20px',
              borderLeft: '4px solid var(--accent, #2563EB)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '44px',
                    height: '44px',
                    minWidth: '44px',
                    minHeight: '44px',
                    borderRadius: '50%',
                    background: 'var(--accent-muted, #DBEAFE)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--accent, #2563EB)',
                  }}
                >
                  <UserCheck size={20} />
                </div>
                <div>
                  <div
                    style={{
                      fontSize: '0.75rem',
                      color: 'var(--text-muted, #64748B)',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}
                  >
                    Active Customer
                  </div>
                  <div
                    style={{
                      fontSize: '1.05rem',
                      fontWeight: 700,
                      color: 'var(--text-primary, #0F172A)',
                    }}
                  >
                    {selectedCustomer.name} ({selectedCustomer.phone})
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <Button
                  variant="outline"
                  size="md"
                  icon={<UserCheck size={16} />}
                  onClick={() => navigate(`/customers/${selectedCustomer.id}`)}
                  aria-label="View Customer Profile"
                  style={{ minHeight: '44px' }}
                >
                  Profile
                </Button>
                <Button
                  id="create-order-per-weight-customer-btn"
                  variant="secondary"
                  size="md"
                  icon={<Scale size={16} />}
                  onClick={() =>
                    navigate(
                      `/orders/new?customerId=${selectedCustomer.id}&workflow=LAUNDRY&mode=WEIGHT`,
                    )
                  }
                  aria-label="CREATE ORDER PER WEIGHT"
                  style={{ minHeight: '44px', fontWeight: 700 }}
                >
                  CREATE ORDER PER WEIGHT
                </Button>
                <Button
                  id="create-order-for-customer-btn"
                  variant="primary"
                  size="md"
                  icon={<ArrowRight size={16} />}
                  onClick={() =>
                    navigate(`/orders/new?customerId=${selectedCustomer.id}&mode=PIECES`)
                  }
                  aria-label="Create Order for Customer"
                  style={{ minHeight: '44px', fontWeight: 700 }}
                >
                  CREATE ORDER PER PIECES
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* ─── 3. TODAY'S DUE ORDERS — PRIMARY OPERATIONAL ACTION ──────────── */}
        <Card
          padding="lg"
          elevated
          className="todays-due-orders-card"
          style={{
            marginBottom: '24px',
            borderRadius: '20px',
            border: isDueOrdersExpanded
              ? '1px solid var(--accent, #2563EB)'
              : '1px solid var(--border, #E2E8F0)',
            background: 'var(--bg-surface, #FFFFFF)',
            boxShadow: 'var(--shadow-neu-card)',
            padding: '22px 28px',
            transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
          }}
        >
          {/* Action Header Banner */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '14px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  minWidth: '44px',
                  minHeight: '44px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#FFFFFF',
                  boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)',
                }}
              >
                <Clock size={22} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h2
                    style={{
                      fontSize: '1.25rem',
                      fontWeight: 700,
                      margin: 0,
                      color: 'var(--text-primary, #0F172A)',
                    }}
                  >
                    Today's Due Orders
                  </h2>
                  {dueOrdersCount != null && (
                    <span
                      id="due-orders-count-badge"
                      style={{
                        padding: '2px 8px',
                        borderRadius: '9999px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        background: '#2563eb',
                        color: '#FFFFFF',
                      }}
                    >
                      {dueOrdersCount}
                    </span>
                  )}
                </div>
                <p
                  style={{
                    fontSize: '0.875rem',
                    color: 'var(--text-muted, #64748B)',
                    margin: '3px 0 0',
                  }}
                >
                  Orders requiring attention today
                </p>
              </div>
            </div>

            {/* Primary Action Button: [ View Today's Due Orders ] */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {isDueOrdersExpanded && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchDueTodayOrders}
                  disabled={isLoadingDueOrders}
                  icon={<RotateCw size={14} className={isLoadingDueOrders ? 'animate-spin' : ''} />}
                  aria-label="Refresh today's due orders"
                  style={{ minHeight: '44px', borderRadius: '9999px' }}
                >
                  Refresh
                </Button>
              )}
              <Button
                id="view-todays-due-orders-btn"
                variant={isDueOrdersExpanded ? 'outline' : 'primary'}
                size="md"
                onClick={handleToggleDueOrders}
                icon={isDueOrdersExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                aria-expanded={isDueOrdersExpanded}
                aria-controls="todays-due-orders-list-container"
                style={{
                  minHeight: '44px',
                  borderRadius: '9999px',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  padding: '0 20px',
                  background: isDueOrdersExpanded
                    ? undefined
                    : 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                  boxShadow: isDueOrdersExpanded ? undefined : '0 4px 14px rgba(37, 99, 235, 0.35)',
                }}
              >
                {isDueOrdersExpanded ? 'Hide Due Orders' : "View Today's Due Orders"}
              </Button>
            </div>
          </div>

          {/* ─── ON-DEMAND DUE ORDER LIST (Visible ONLY after user clicks) ─── */}
          {isDueOrdersExpanded && (
            <div
              id="todays-due-orders-list-container"
              style={{
                marginTop: '20px',
                paddingTop: '20px',
                borderTop: '1px solid var(--border, #E2E8F0)',
              }}
            >
              {isLoadingDueOrders ? (
                <LoadingState message="Loading today's due orders..." />
              ) : dueOrdersError ? (
                <ErrorState
                  title="Unable to load today's due orders."
                  message={dueOrdersError}
                  onRetry={fetchDueTodayOrders}
                />
              ) : dueOrders.length === 0 ? (
                <EmptyState title="No orders are due today." message="You're all caught up." />
              ) : (
                <div style={{ display: 'grid', gap: '12px' }}>
                  {dueOrders.map((order) => {
                    const statusBadge = getStatusBadgeStyle(order.status);
                    const isReady = order.status === OrderStatus.READY;
                    const isProcessing =
                      order.status === OrderStatus.PROCESSING ||
                      order.status === OrderStatus.RECEIVED;
                    const isHomeDelivery = order.pickupType === PickupType.HOME_DELIVERY;

                    return (
                      <div
                        key={order.id}
                        id={`due-order-${order.id}`}
                        style={{
                          padding: '16px',
                          borderRadius: '12px',
                          border: '1px solid var(--border, #E2E8F0)',
                          background: 'var(--bg-surface, #FFFFFF)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '12px',
                          boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.04)',
                        }}
                      >
                        {/* Top Metadata Row: Order #, Service Type, Due Time, Status Badge */}
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: '8px',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span
                              style={{
                                fontFamily: 'monospace',
                                fontWeight: 700,
                                fontSize: '1rem',
                                color: 'var(--text-primary, #0F172A)',
                              }}
                            >
                              #{order.orderNumber}
                            </span>

                            {/* Store Pickup vs Home Delivery */}
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontSize: '0.75rem',
                                padding: '2px 8px',
                                borderRadius: '6px',
                                fontWeight: 600,
                                background: isHomeDelivery
                                  ? 'rgba(217, 119, 6, 0.1)'
                                  : 'rgba(5, 150, 105, 0.1)',
                                color: isHomeDelivery
                                  ? 'var(--warning-text, #D97706)'
                                  : 'var(--success-text, #059669)',
                              }}
                            >
                              {isHomeDelivery ? <Truck size={12} /> : <Package size={12} />}
                              {isHomeDelivery ? 'Home Delivery' : 'Store Pickup'}
                            </span>

                            {/* Express Badge */}
                            {order.isExpress && (
                              <span
                                style={{
                                  fontSize: '0.7rem',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  fontWeight: 700,
                                  background: 'rgba(239, 68, 68, 0.1)',
                                  color: '#DC2626',
                                  border: '1px solid rgba(239, 68, 68, 0.2)',
                                }}
                              >
                                EXPRESS
                              </span>
                            )}
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {/* Due Time */}
                            <span
                              style={{
                                fontSize: '0.8rem',
                                color: 'var(--text-muted, #64748B)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                              }}
                            >
                              <Clock size={13} />
                              {formatDueTime(order.effectiveDueDate)}
                            </span>

                            {/* Status Chip */}
                            <span
                              style={{
                                fontSize: '0.75rem',
                                padding: '2px 8px',
                                borderRadius: '9999px',
                                fontWeight: 700,
                                letterSpacing: '0.02em',
                                ...statusBadge,
                              }}
                            >
                              {order.status}
                            </span>
                          </div>
                        </div>

                        {/* Middle Content Row: Customer Information & Readiness Indicator */}
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: '12px',
                          }}
                        >
                          <div>
                            <div
                              style={{
                                fontSize: '0.95rem',
                                fontWeight: 700,
                                color: 'var(--text-primary, #0F172A)',
                              }}
                            >
                              {order.customerName}
                            </div>
                            <div
                              style={{
                                fontSize: '0.8rem',
                                color: 'var(--text-muted, #64748B)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                marginTop: '2px',
                              }}
                            >
                              <span>{order.customerPhone}</span>
                              <span>·</span>
                              <span>{order.itemCount} items</span>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            {/* Readiness Indication */}
                            <div style={{ textAlign: 'right' }}>
                              {isReady ? (
                                <span
                                  style={{
                                    fontSize: '0.75rem',
                                    fontWeight: 700,
                                    color: 'var(--success-text, #166534)',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    background: 'var(--success-bg, #DCFCE7)',
                                    padding: '2px 8px',
                                    borderRadius: '6px',
                                  }}
                                >
                                  Ready
                                </span>
                              ) : isProcessing ? (
                                <span
                                  style={{
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    color: 'var(--warning-text, #92400E)',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    background: 'var(--warning-bg, #FEF3C7)',
                                    padding: '2px 8px',
                                    borderRadius: '6px',
                                  }}
                                >
                                  Processing · Not Ready
                                </span>
                              ) : null}

                              {/* Authoritative Financial Balance */}
                              <div
                                style={{
                                  fontSize: '0.85rem',
                                  fontWeight: 700,
                                  marginTop: '4px',
                                  color:
                                    order.amountDue > 0
                                      ? 'var(--warning-text, #D97706)'
                                      : 'var(--success-text, #166534)',
                                }}
                              >
                                {order.amountDue > 0 ? `Balance: ₹${order.amountDue}` : 'Paid'}
                              </div>
                            </div>

                            {/* View Order Action Navigation */}
                            <Button
                              variant="outline"
                              size="md"
                              onClick={() => navigate(`/orders/${order.id}`)}
                              icon={<ArrowRight size={16} />}
                              aria-label={`View Order ${order.orderNumber}`}
                              style={{ minHeight: '44px', fontWeight: 600 }}
                            >
                              View Order
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </Card>
      </main>

      {/* ─── Find / Edit Order Modal (CHANGE 2) ───────────────────────── */}
      {isFindOrderModalOpen && (
        <div
          className="fixed inset-0 z-50 backdrop-blur-xs flex items-center justify-center p-4 modal-backdrop"
          style={{ background: 'var(--overlay, rgba(0, 0, 0, 0.5))' }}
        >
          <div
            className="rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col modal-panel"
            style={{
              background: 'var(--bg-surface, #FFFFFF)',
              border: '1px solid var(--border, #E2E8F0)',
            }}
          >
            <div
              className="flex items-center justify-between px-5 py-4"
              style={{
                borderBottom: '1px solid var(--border, #E2E8F0)',
                background: 'var(--bg-surface-muted, #F8FAFC)',
              }}
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                  <Search size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">Find / Edit Order</h3>
                  <p className="text-xs text-slate-500">
                    Lookup an existing order by ID or Order Number to inspect or edit
                  </p>
                </div>
              </div>
              <button
                type="button"
                id="close-find-order-modal-btn"
                onClick={() => {
                  setIsFindOrderModalOpen(false);
                  setFindOrderQuery('');
                  setFindOrderError(null);
                }}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
                aria-label="Close find order modal"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleFindOrderSubmit} className="p-5 space-y-4">
              <div>
                <label
                  htmlFor="find-order-input"
                  className="block text-xs font-bold text-slate-800 mb-1.5"
                >
                  Order ID or Order Number <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    id="find-order-input"
                    type="text"
                    value={findOrderQuery}
                    onChange={(e) => {
                      setFindOrderQuery(e.target.value);
                      setFindOrderError(null);
                    }}
                    placeholder="e.g. ORD-1024, GF-2026-0001, or UUID"
                    autoFocus
                    className="w-full text-sm font-semibold px-3 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                  />
                </div>
                {findOrderError && (
                  <p className="text-xs text-rose-600 font-semibold mt-1.5 flex items-center gap-1">
                    <span>⚠</span> {findOrderError}
                  </p>
                )}
              </div>

              <div className="text-xs text-slate-500 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-200">
                Opening an order allows authorized staff to edit permitted fields (items, defects,
                due dates, payments, and financial adjustments) with backend recalculations.
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setIsFindOrderModalOpen(false);
                    setFindOrderQuery('');
                    setFindOrderError(null);
                  }}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors min-h-[44px] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  id="find-order-submit-btn"
                  disabled={isFindingOrder || !findOrderQuery.trim()}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-colors shadow-2xs min-h-[44px] flex items-center gap-1.5 cursor-pointer"
                >
                  {isFindingOrder ? (
                    <span>Searching...</span>
                  ) : (
                    <>
                      <ArrowRight size={16} strokeWidth={2.5} />
                      <span>Find &amp; Open Order</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Customer Creation Modal */}
      <CustomerCreateModal
        open={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={handleCustomerCreated}
      />
    </div>
  );
};
