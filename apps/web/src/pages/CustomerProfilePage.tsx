import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button, Card, LoadingState, EmptyState, ErrorState } from '@growfast/ui';
import { MembershipTier, type CustomerDTO, type ApiResponse } from '@growfast/shared-types';
import { CustomerEditModal } from '../components/CustomerEditModal';
import { CustomerOrderHistory } from '../components/CustomerOrderHistory';
import { ThemeToggle } from '../components/ThemeToggle';
import { ArrowLeft, Phone, MapPin, Shield, Tag, ArrowRight, Edit3, Info } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const MOCK_CUSTOMERS: CustomerDTO[] = [
  {
    id: 'cust-001',
    name: 'Rahul Patil',
    phone: '+919876543210',
    email: null,
    address: 'Flat 402, Rohan Vasanta, Baner Road, Pune',
    pincode: '411045',
    membership: MembershipTier.GOLD,
    discountPercent: 10,
    preferences: null,
    registrationSource: 'WALK_IN',
    createdAt: new Date('2026-01-10').toISOString(),
    updatedAt: new Date('2026-01-10').toISOString(),
  },
  {
    id: 'cust-002',
    name: 'Sneha Kulkarni',
    phone: '+919823456789',
    email: null,
    address: 'B-12, Hermes Nest, Koregaon Park, Pune',
    pincode: '411001',
    membership: MembershipTier.SILVER,
    discountPercent: 5,
    preferences: null,
    registrationSource: 'WALK_IN',
    createdAt: new Date('2026-01-15').toISOString(),
    updatedAt: new Date('2026-01-15').toISOString(),
  },
  {
    id: 'cust-003',
    name: 'Amit Shah',
    phone: '+919811122334',
    email: null,
    address: 'Villa 7, Pride World City, Charholi, Pune',
    pincode: '412105',
    membership: MembershipTier.NONE,
    discountPercent: 0,
    preferences: null,
    registrationSource: 'WALK_IN',
    createdAt: new Date('2026-01-20').toISOString(),
    updatedAt: new Date('2026-01-20').toISOString(),
  },
  {
    id: 'cust-004',
    name: 'Priya Joshi',
    phone: '+919855566778',
    email: null,
    address: 'Flat 801, Marvel Bounty, Hadapsar, Pune',
    pincode: '411028',
    membership: MembershipTier.NONE,
    discountPercent: 0,
    preferences: null,
    registrationSource: 'WALK_IN',
    createdAt: new Date('2026-02-01').toISOString(),
    updatedAt: new Date('2026-02-01').toISOString(),
  },
  {
    id: 'cust-005',
    name: 'Neha Deshmukh',
    phone: '+919766654321',
    email: null,
    address: 'Rowhouse 4, Green Acres, Viman Nagar, Pune',
    pincode: '411014',
    membership: MembershipTier.PLATINUM,
    discountPercent: 15,
    preferences: null,
    registrationSource: 'WALK_IN',
    createdAt: new Date('2026-02-05').toISOString(),
    updatedAt: new Date('2026-02-05').toISOString(),
  },
];

const getMembershipBadgeClass = (tier: string) => {
  switch (tier) {
    case 'GOLD':
      return 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-700/60';
    case 'PLATINUM':
      return 'bg-purple-100 text-purple-900 border-purple-300 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-700/60';
    case 'SILVER':
      return 'bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700';
    case 'NONE':
    default:
      return 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/80 dark:text-slate-400 dark:border-slate-700';
  }
};

export const CustomerProfilePage: React.FC = () => {
  const { customerId } = useParams<{ customerId: string }>();
  const navigate = useNavigate();
  const { token } = useAuth();

  const [customer, setCustomer] = useState<CustomerDTO | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isNotFound, setIsNotFound] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const showNotice = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 4000);
  };

  const fetchCustomer = useCallback(async () => {
    if (!customerId) return;

    setIsLoading(true);
    setError(null);
    setIsNotFound(false);

    try {
      const res = await fetch(`${API_URL}/customers/${customerId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (res.ok) {
        const body: ApiResponse<CustomerDTO> = await res.json();
        setCustomer(body.data);
      } else if (res.status === 404) {
        const mock = MOCK_CUSTOMERS.find((c) => c.id === customerId);
        if (mock) {
          setCustomer(mock);
        } else {
          setIsNotFound(true);
        }
      } else {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.message || `Failed to load customer (HTTP ${res.status})`);
      }
    } catch (err: any) {
      const mock = MOCK_CUSTOMERS.find((c) => c.id === customerId);
      if (mock) {
        setCustomer(mock);
      } else {
        setError(err.message || 'Failed to connect to server.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [customerId, token]);

  useEffect(() => {
    fetchCustomer();
  }, [fetchCustomer]);

  const formatDate = (isoString?: string) => {
    if (!isoString) return 'Not available';
    try {
      return new Date(isoString).toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--bg-app, #F8FAFC)',
        color: 'var(--text-primary, #0F172A)',
        paddingBottom: '40px',
        transition: 'background-color 0.2s ease, color 0.2s ease',
      }}
    >
      {/* Toast Notice Banner */}
      {notice && (
        <div
          style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            zIndex: 9999,
            background: 'var(--bg-surface-elevated, #1E293B)',
            color: 'var(--text-primary, #FFFFFF)',
            padding: '12px 20px',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
            border: '1px solid var(--border, #334155)',
            fontSize: '0.9rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Info size={18} color="#60A5FA" />
          <span>{notice}</span>
        </div>
      )}

      {/* Header Bar */}
      <header
        style={{
          background: 'var(--bg-surface, #FFFFFF)',
          borderBottom: '1px solid var(--border, #E2E8F0)',
          padding: '16px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          zIndex: 10,
          transition: 'background-color 0.2s ease, border-color 0.2s ease',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Button
            variant="outline"
            size="sm"
            icon={<ArrowLeft size={16} />}
            onClick={() => navigate('/')}
            aria-label="Back to Customer Search"
          >
            Back to Search
          </Button>
          <div>
            <h1
              style={{
                fontSize: '1.25rem',
                fontWeight: 700,
                margin: 0,
                color: 'var(--text-primary, #0F172A)',
              }}
            >
              Customer Profile
            </h1>
            {customer && (
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted, #64748B)' }}>
                Customer ID: <strong>{customer.customerCode || customer.id}</strong>
              </span>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <ThemeToggle size="sm" />
          {customer && (
            <>
              <Button
                variant="outline"
                size="md"
                icon={<Edit3 size={16} />}
                onClick={() => setIsEditModalOpen(true)}
                aria-label="Edit Customer Profile"
              >
                Edit Customer
              </Button>
              <Button
                variant="primary"
                size="md"
                icon={<ArrowRight size={16} />}
                onClick={() => navigate(`/orders/new?customerId=${customer.id}`)}
                aria-label="Create Order for Customer"
              >
                Create Order
              </Button>
            </>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main style={{ maxWidth: '960px', margin: '24px auto', padding: '0 16px' }}>
        {isLoading ? (
          <Card style={{ padding: '40px' }}>
            <LoadingState message="Loading customer profile..." />
          </Card>
        ) : isNotFound ? (
          <Card style={{ padding: '40px', textAlign: 'center' }}>
            <EmptyState
              title="Customer Not Found"
              message={`No customer record exists with ID "${customerId}". Please check the customer ID or perform a search.`}
              action={
                <Button variant="primary" size="md" onClick={() => navigate('/')}>
                  Back to Customer Search
                </Button>
              }
            />
          </Card>
        ) : error ? (
          <Card style={{ padding: '40px' }}>
            <ErrorState title="Failed to Load Profile" message={error} onRetry={fetchCustomer} />
          </Card>
        ) : customer ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Identity Banner Card */}
            <Card style={{ padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
                <div
                  style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#FFFFFF',
                    fontWeight: 700,
                    fontSize: '1.5rem',
                    flexShrink: 0,
                    boxShadow: '0 4px 10px rgba(37, 99, 235, 0.2)',
                  }}
                >
                  {customer.name.charAt(0).toUpperCase()}
                </div>

                <div style={{ flex: 1, minWidth: '220px' }}>
                  <div
                    style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}
                  >
                    <h2
                      style={{
                        fontSize: '1.5rem',
                        fontWeight: 700,
                        margin: 0,
                        color: 'var(--text-primary, #0F172A)',
                      }}
                    >
                      {customer.name}
                    </h2>

                    {/* Membership Badge */}
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold border inline-flex items-center gap-1.5 transition-colors ${getMembershipBadgeClass(
                        customer.membership,
                      )}`}
                    >
                      <Shield size={12} />
                      {customer.membership} MEMBER ({customer.discountPercent}% OFF)
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '16px', marginTop: '8px', flexWrap: 'wrap' }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        color: 'var(--text-secondary, #475569)',
                        fontSize: '0.9rem',
                      }}
                    >
                      <Phone size={16} color="var(--accent, #2563EB)" />
                      <span>{customer.phone}</span>
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Profile Grid: Left 2 Cols, Right 1 Col */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                gap: '20px',
              }}
            >
              {/* Contact & Address Card */}
              <Card style={{ padding: '20px' }}>
                <h3
                  style={{
                    fontSize: '1rem',
                    fontWeight: 700,
                    color: 'var(--text-primary, #0F172A)',
                    margin: '0 0 16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <MapPin size={18} color="var(--accent, #2563EB)" />
                  Contact & Address
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div>
                    <div
                      style={{
                        fontSize: '0.8rem',
                        color: 'var(--text-muted, #64748B)',
                        fontWeight: 600,
                      }}
                    >
                      Customer ID
                    </div>
                    <div
                      style={{
                        fontSize: '0.95rem',
                        color: 'var(--text-primary, #1E293B)',
                        fontWeight: 700,
                        fontFamily: 'monospace',
                        marginTop: '2px',
                      }}
                    >
                      {customer.customerCode || customer.id}
                    </div>
                  </div>

                  <div>
                    <div
                      style={{
                        fontSize: '0.8rem',
                        color: 'var(--text-muted, #64748B)',
                        fontWeight: 600,
                      }}
                    >
                      WhatsApp Number
                    </div>
                    <div
                      style={{
                        fontSize: '0.95rem',
                        color: 'var(--text-primary, #1E293B)',
                        fontWeight: 600,
                        marginTop: '2px',
                      }}
                    >
                      {customer.phone}
                    </div>
                  </div>

                  <div>
                    <div
                      style={{
                        fontSize: '0.8rem',
                        color: 'var(--text-muted, #64748B)',
                        fontWeight: 600,
                      }}
                    >
                      Postal Address
                    </div>
                    <div
                      style={{
                        fontSize: '0.95rem',
                        color: 'var(--text-primary, #1E293B)',
                        marginTop: '2px',
                        lineHeight: '1.4',
                      }}
                    >
                      {customer.address || (
                        <span
                          style={{ color: 'var(--text-placeholder, #94A3B8)', fontStyle: 'italic' }}
                        >
                          Not provided
                        </span>
                      )}
                    </div>
                  </div>

                  <div>
                    <div
                      style={{
                        fontSize: '0.8rem',
                        color: 'var(--text-muted, #64748B)',
                        fontWeight: 600,
                      }}
                    >
                      Pincode
                    </div>
                    <div
                      style={{
                        fontSize: '0.95rem',
                        color: 'var(--text-primary, #1E293B)',
                        marginTop: '2px',
                      }}
                    >
                      {customer.pincode || (
                        <span
                          style={{ color: 'var(--text-placeholder, #94A3B8)', fontStyle: 'italic' }}
                        >
                          Not provided
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </Card>

              {/* Membership & Account Details Card */}
              <Card style={{ padding: '20px' }}>
                <h3
                  style={{
                    fontSize: '1rem',
                    fontWeight: 700,
                    color: 'var(--text-primary, #0F172A)',
                    margin: '0 0 16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <Tag size={18} color="#059669" />
                  Membership & Account
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div>
                    <div
                      style={{
                        fontSize: '0.8rem',
                        color: 'var(--text-muted, #64748B)',
                        fontWeight: 600,
                      }}
                    >
                      Membership Tier
                    </div>
                    <div
                      style={{
                        fontSize: '0.95rem',
                        color: 'var(--text-primary, #1E293B)',
                        fontWeight: 600,
                        marginTop: '2px',
                      }}
                    >
                      {customer.membership} ({customer.discountPercent}% Discount)
                    </div>
                  </div>

                  <div>
                    <div
                      style={{
                        fontSize: '0.8rem',
                        color: 'var(--text-muted, #64748B)',
                        fontWeight: 600,
                      }}
                    >
                      Member Since
                    </div>
                    <div
                      style={{
                        fontSize: '0.95rem',
                        color: 'var(--text-primary, #1E293B)',
                        marginTop: '2px',
                      }}
                    >
                      {formatDate(customer.createdAt)}
                    </div>
                  </div>
                </div>
              </Card>
            </div>

            {/* Customer Order History Section */}
            <CustomerOrderHistory
              customerId={customer.id}
              customerName={customer.name}
              onNotice={showNotice}
            />
          </div>
        ) : null}
      </main>

      {/* Customer Edit Modal */}
      {customer && (
        <CustomerEditModal
          open={isEditModalOpen}
          customer={customer}
          onClose={() => setIsEditModalOpen(false)}
          onSuccess={(updatedCustomer) => {
            setCustomer(updatedCustomer);
            showNotice(`Customer "${updatedCustomer.name}" updated successfully!`);
          }}
        />
      )}
    </div>
  );
};
