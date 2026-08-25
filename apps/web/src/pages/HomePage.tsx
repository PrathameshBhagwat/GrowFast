import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Button, Card, Input, LoadingState, EmptyState, ErrorState } from '@growfast/ui';
import type { CustomerDTO, PaginatedResponse } from '@growfast/shared-types';
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
  Award,
  Plus,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  ArrowRight,
  Info,
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || '/api';

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
  NONE: { bg: '#F1F5F9', text: '#475569', border: '#CBD5E1' },
  SILVER: { bg: '#F1F5F9', text: '#334155', border: '#94A3B8' },
  GOLD: { bg: '#FEF3C7', text: '#92400E', border: '#F59E0B' },
  PLATINUM: { bg: '#F3E8FF', text: '#6B21A8', border: '#A855F7' },
};

export const HomePage: React.FC = () => {
  const { employee, token, logout } = useAuth();

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Data fetching state
  const [customers, setCustomers] = useState<CustomerDTO[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Selected customer state for integration seam
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerDTO | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Debounce search query (300ms)
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(searchQuery.trim());
      setPage(1); // Reset to page 1 on new search
    }, 300);

    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Fetch customers API call
  const fetchCustomers = useCallback(
    async (query: string, currentPage: number) => {
      if (!token) return;

      setIsLoading(true);
      setError(null);

      try {
        const queryParams = new URLSearchParams();
        if (query) queryParams.set('query', query);
        queryParams.set('page', String(currentPage));
        queryParams.set('pageSize', String(pageSize));

        const res = await fetch(`${API_URL}/customers/search?${queryParams.toString()}`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          throw new Error(errBody.message || `HTTP ${res.status}: Failed to search customers`);
        }

        const responseData: PaginatedResponse<CustomerDTO> = await res.json();
        setCustomers(responseData.data || []);
        setTotalCount(responseData.total || 0);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred while fetching customers');
        setCustomers([]);
        setTotalCount(0);
      } finally {
        setIsLoading(false);
      }
    },
    [token, pageSize],
  );

  // Trigger search on debounced query or page change
  useEffect(() => {
    fetchCustomers(debouncedQuery, page);
  }, [debouncedQuery, page, fetchCustomers]);

  if (!employee) return null;

  const config = ROLE_CONFIG[employee.role] || ROLE_CONFIG.COUNTER!;
  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  const showNotice = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#F8FAFC',
        fontFamily: "'Inter', sans-serif",
        color: '#0F172A',
      }}
    >
      {/* Toast banner */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            top: '16px',
            right: '16px',
            left: '16px',
            maxWidth: '500px',
            margin: '0 auto',
            zIndex: 1000,
            background: '#1E293B',
            color: '#FFFFFF',
            padding: '12px 18px',
            borderRadius: '10px',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.2)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '0.875rem',
          }}
        >
          <Info size={20} color="#38BDF8" style={{ flexShrink: 0 }} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header */}
      <header
        style={{
          background: '#FFFFFF',
          borderBottom: '1px solid #E2E8F0',
          padding: '16px 24px',
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}
      >
        <div
          style={{
            maxWidth: '960px',
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '12px',
                background: `linear-gradient(135deg, ${config.color} 0%, ${config.color}CC 100%)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#FFFFFF',
              }}
            >
              <Shirt size={22} />
            </div>
            <div>
              <h1 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: '#0F172A' }}>
                GrowFast Laundry
              </h1>
              <span style={{ fontSize: '0.75rem', color: '#64748B' }}>
                {employee.name} · {employee.role} ({employee.storeName})
              </span>
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={logout}
            icon={<LogOut size={16} />}
            aria-label="Sign Out"
          >
            Sign Out
          </Button>
        </div>
      </header>

      {/* Main Container */}
      <main style={{ maxWidth: '960px', margin: '0 auto', padding: '24px 16px' }}>
        {/* Customer Search Section Card */}
        <Card padding="lg" elevated style={{ marginBottom: '24px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '20px',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 4px' }}>
                Customer Search
              </h2>
              <p style={{ fontSize: '0.875rem', color: '#64748B', margin: 0 }}>
                Lookup customers by phone number, name, or customer ID
              </p>
            </div>

            {/* Customer Creation Placeholder Seam */}
            <Button
              variant="outline"
              size="md"
              icon={<Plus size={18} />}
              onClick={() =>
                showNotice(
                  'Customer Creation flow will be implemented in its dedicated feature branch (Phase 1).',
                )
              }
              aria-label="Create Customer"
            >
              Create Customer
            </Button>
          </div>

          {/* Search Input Controls */}
          <div
            style={{
              position: 'relative',
              display: 'flex',
              gap: '10px',
              alignItems: 'center',
              marginBottom: '16px',
            }}
          >
            <div style={{ position: 'relative', flex: 1 }}>
              <Search
                size={20}
                color="#94A3B8"
                style={{
                  position: 'absolute',
                  left: '14px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  pointerEvents: 'none',
                }}
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by phone (e.g. 98765), name (e.g. Rahul), or ID..."
                aria-label="Search Customers"
                style={{
                  width: '100%',
                  padding: '12px 40px 12px 44px',
                  fontSize: '0.95rem',
                  fontFamily: "'Inter', sans-serif",
                  border: '1px solid #CBD5E1',
                  borderRadius: '10px',
                  outline: 'none',
                  boxSizing: 'border-box',
                  minHeight: '44px',
                  background: '#FFFFFF',
                }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search input"
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#64748B',
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
                color: '#475569',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span>
                Results for: <strong>"{debouncedQuery}"</strong> ({totalCount} found)
              </span>
              <button
                onClick={() => setSearchQuery('')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#2563EB',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  fontWeight: 600,
                  padding: '4px 8px',
                }}
              >
                Clear Filter
              </button>
            </div>
          )}

          {/* UI State Machine: Loading, Error, Empty, Results */}
          {isLoading ? (
            <LoadingState message="Searching customer directory..." />
          ) : error ? (
            <ErrorState
              title="Search Request Failed"
              message={error}
              onRetry={() => fetchCustomers(debouncedQuery, page)}
            />
          ) : customers.length === 0 ? (
            <EmptyState
              title={debouncedQuery ? 'No customers found' : 'Start Customer Search'}
              message={
                debouncedQuery
                  ? `No customer record matches "${debouncedQuery}". Try another phone number or name.`
                  : 'Type a phone number or customer name above to search existing customer records.'
              }
              action={
                debouncedQuery ? (
                  <Button variant="outline" size="sm" onClick={() => setSearchQuery('')}>
                    Reset Search
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div>
              {/* Results Grid / List */}
              <div style={{ display: 'grid', gap: '12px' }}>
                {customers.map((c) => {
                  const isSelected = selectedCustomer?.id === c.id;
                  const tierStyle =
                    MEMBERSHIP_COLORS[c.membership] || MEMBERSHIP_COLORS.NONE!;

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
                        padding: '16px',
                        borderRadius: '12px',
                        border: isSelected ? '2px solid #2563EB' : '1px solid #E2E8F0',
                        background: isSelected ? '#EFF6FF' : '#FFFFFF',
                        cursor: 'pointer',
                        transition: 'all 200ms ease',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px',
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
                              fontSize: '1.05rem',
                              fontWeight: 700,
                              color: '#0F172A',
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
                              letterSpacing: '0.04em',
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
                                background: '#DCFCE7',
                                color: '#166534',
                                border: '1px solid #86EFAC',
                              }}
                            >
                              {c.discountPercent}% OFF
                            </span>
                          )}
                        </div>

                        <span
                          style={{
                            fontSize: '0.75rem',
                            color: '#64748B',
                            background: '#F1F5F9',
                            padding: '4px 8px',
                            borderRadius: '6px',
                          }}
                        >
                          ID: {c.id}
                        </span>
                      </div>

                      {/* Customer Details info row */}
                      <div
                        style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: '16px',
                          fontSize: '0.85rem',
                          color: '#475569',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Phone size={14} color="#64748B" />
                          <strong style={{ color: '#0F172A' }}>{c.phone}</strong>
                        </div>
                        {c.email && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Mail size={14} color="#64748B" />
                            <span>{c.email}</span>
                          </div>
                        )}
                        {c.address && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <MapPin size={14} color="#64748B" />
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

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginTop: '20px',
                    paddingTop: '16px',
                    borderTop: '1px solid #E2E8F0',
                  }}
                >
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    icon={<ChevronLeft size={16} />}
                    aria-label="Previous Page"
                  >
                    Previous
                  </Button>

                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>
                    Page {page} of {totalPages} ({totalCount} total)
                  </span>

                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    icon={<ChevronRight size={16} />}
                    aria-label="Next Page"
                  >
                    Next
                  </Button>
                </div>
              )}
            </div>
          )}
        </Card>

        {/* Selected Customer Seam Preview */}
        {selectedCustomer && (
          <Card padding="md" elevated style={{ borderLeft: '4px solid #2563EB' }}>
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
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    background: '#DBEAFE',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#2563EB',
                  }}
                >
                  <UserCheck size={20} />
                </div>
                <div>
                  <div style={{ fontSize: '0.8rem', color: '#64748B', fontWeight: 600 }}>
                    Selected Customer
                  </div>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: '#0F172A' }}>
                    {selectedCustomer.name} ({selectedCustomer.phone})
                  </div>
                </div>
              </div>

              {/* Order Creation Seam Button */}
              <Button
                variant="primary"
                size="md"
                icon={<ArrowRight size={16} />}
                onClick={() =>
                  showNotice(
                    `Integration Seam Contract: Navigating to Developer B Order Wizard via /orders/new?customerId=${selectedCustomer.id}`,
                  )
                }
                aria-label="Create Order for Customer"
              >
                Create Order
              </Button>
            </div>
          </Card>
        )}
      </main>
    </div>
  );
};
