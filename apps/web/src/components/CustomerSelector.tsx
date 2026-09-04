import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Button, LoadingState, EmptyState, ErrorState } from '@growfast/ui';
import { MembershipTier, type CustomerDTO, type PaginatedResponse } from '@growfast/shared-types';
import { Search, X, Phone, Mail, MapPin } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || '/api';

interface CustomerSelectorProps {
  onSelect: (customer: CustomerDTO) => void;
}

const MEMBERSHIP_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  NONE: { bg: '#F1F5F9', text: '#475569', border: '#CBD5E1' },
  SILVER: { bg: '#F1F5F9', text: '#334155', border: '#94A3B8' },
  GOLD: { bg: '#FEF3C7', text: '#92400E', border: '#F59E0B' },
  PLATINUM: { bg: '#F3E8FF', text: '#6B21A8', border: '#A855F7' },
};

export const CustomerSelector: React.FC<CustomerSelectorProps> = ({ onSelect }) => {
  const { token, logout } = useAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [customers, setCustomers] = useState<CustomerDTO[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(searchQuery.trim());
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  const fetchCustomers = useCallback(
    async (query: string) => {
      if (!token) return;

      setIsLoading(true);
      setError(null);

      try {
        const queryParams = new URLSearchParams();
        if (query) queryParams.set('query', query);
        queryParams.set('page', '1');
        queryParams.set('pageSize', '5'); // Only load top 5 for quick selection

        const res = await fetch(`${API_URL}/customers/search?${queryParams.toString()}`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (!res.ok) {
          if (res.status === 401) {
            logout();
            return;
          }
          throw new Error(`HTTP ${res.status}: Failed to search customers`);
        }

        const responseData: PaginatedResponse<CustomerDTO> = await res.json();
        setCustomers(responseData.data || []);
      } catch (err: any) {
        setError(err.message || 'Failed to search customers');
      } finally {
        setIsLoading(false);
      }
    },
    [token, logout],
  );

  useEffect(() => {
    fetchCustomers(debouncedQuery);
  }, [debouncedQuery, fetchCustomers]);

  return (
    <div className="space-y-4">
      <div style={{ position: 'relative', display: 'flex', gap: '10px', alignItems: 'center' }}>
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
            placeholder="Search by phone or name..."
            aria-label="Search Customers"
            style={{
              width: '100%',
              padding: '12px 40px 12px 44px',
              fontSize: '0.95rem',
              border: '1px solid #CBD5E1',
              borderRadius: '10px',
              outline: 'none',
              minHeight: '44px',
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{
                position: 'absolute',
                right: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#64748B',
              }}
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <LoadingState message="Searching..." />
      ) : error ? (
        <ErrorState message={error} onRetry={() => fetchCustomers(debouncedQuery)} />
      ) : customers.length === 0 ? (
        <EmptyState
          title={debouncedQuery ? 'No customers found' : 'Start Customer Search'}
          message={
            debouncedQuery
              ? `No customer record matches "${debouncedQuery}".`
              : 'Search to find an existing customer.'
          }
        />
      ) : (
        <div style={{ display: 'grid', gap: '12px' }}>
          {customers.map((c) => {
            const tierStyle = MEMBERSHIP_COLORS[c.membership] || MEMBERSHIP_COLORS.NONE!;
            return (
              <div
                key={c.id}
                onClick={() => onSelect(c)}
                style={{
                  padding: '16px',
                  borderRadius: '12px',
                  border: '1px solid #E2E8F0',
                  background: '#FFFFFF',
                  cursor: 'pointer',
                  transition: 'all 200ms ease',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
                <div
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0F172A' }}>
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
                  </div>
                </div>
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
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
