import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button, Card, LoadingState, EmptyState, ErrorState } from '@growfast/ui';
import { MembershipTier, type CustomerDTO, type ApiResponse } from '@growfast/shared-types';
import { CustomerEditModal } from '../components/CustomerEditModal';
import { CustomerOrderHistory } from '../components/CustomerOrderHistory';
import {
  ArrowLeft,
  User,
  Phone,
  Mail,
  MapPin,
  Sparkles,
  Shield,
  Calendar,
  Tag,
  ArrowRight,
  Edit3,
  Shirt,
  Info,
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const MOCK_CUSTOMERS: CustomerDTO[] = [
  {
    id: 'cust-001',
    name: 'Rahul Patil',
    phone: '+919876543210',
    email: 'rahul.patil@example.com',
    address: 'Flat 402, Rohan Vasanta, Baner Road, Pune',
    pincode: '411045',
    membership: MembershipTier.GOLD,
    discountPercent: 10,
    preferences: { fragrance: 'lavender', starch: 'medium', fold: 'hanger' },
    registrationSource: 'WALK_IN',
    createdAt: new Date('2026-01-10').toISOString(),
    updatedAt: new Date('2026-01-10').toISOString(),
  },
  {
    id: 'cust-002',
    name: 'Sneha Kulkarni',
    phone: '+919823456789',
    email: 'sneha.k@outlook.com',
    address: 'B-12, Hermes Nest, Koregaon Park, Pune',
    pincode: '411001',
    membership: MembershipTier.SILVER,
    discountPercent: 5,
    preferences: { fragrance: 'jasmine', starch: 'light', fold: 'standard_fold' },
    registrationSource: 'PHONE',
    createdAt: new Date('2026-01-15').toISOString(),
    updatedAt: new Date('2026-01-15').toISOString(),
  },
  {
    id: 'cust-003',
    name: 'Amit Shah',
    phone: '+919811122334',
    email: 'amit.shah@techcorp.in',
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
    email: 'priya.j@example.com',
    address: 'Flat 801, Marvel Bounty, Hadapsar, Pune',
    pincode: '411028',
    membership: MembershipTier.NONE,
    discountPercent: 0,
    preferences: null,
    registrationSource: 'REFERRAL',
    createdAt: new Date('2026-02-01').toISOString(),
    updatedAt: new Date('2026-02-01').toISOString(),
  },
  {
    id: 'cust-005',
    name: 'Neha Deshmukh',
    phone: '+919766654321',
    email: 'neha.d@example.com',
    address: 'Rowhouse 4, Green Acres, Viman Nagar, Pune',
    pincode: '411014',
    membership: MembershipTier.PLATINUM,
    discountPercent: 15,
    preferences: { fragrance: 'fresh_linen', starch: 'heavy', fold: 'flat_pack' },
    registrationSource: 'WEBSITE',
    createdAt: new Date('2026-02-05').toISOString(),
    updatedAt: new Date('2026-02-05').toISOString(),
  },
];

const MEMBERSHIP_BADGE_STYLE: Record<string, { bg: string; text: string; border: string }> = {
  NONE: { bg: '#F1F5F9', text: '#475569', border: '#CBD5E1' },
  SILVER: { bg: '#F1F5F9', text: '#334155', border: '#94A3B8' },
  GOLD: { bg: '#FEF3C7', text: '#92400E', border: '#F59E0B' },
  PLATINUM: { bg: '#F3E8FF', text: '#6B21A8', border: '#A855F7' },
};

const PREFERENCE_LABELS: Record<string, Record<string, string>> = {
  fragrance: {
    none: 'No Fragrance',
    lavender: 'Lavender',
    jasmine: 'Jasmine',
    fresh_linen: 'Fresh Linen',
  },
  starch: {
    none: 'No Starch',
    light: 'Light Starch',
    medium: 'Medium Starch',
    heavy: 'Heavy Crisp Starch',
  },
  fold: {
    standard_fold: 'Standard Fold',
    hanger: 'On Hanger',
    flat_pack: 'Flat Box Pack',
  },
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
    if (!customerId) {
      setIsNotFound(true);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    setIsNotFound(false);

    try {
      if (token && !token.startsWith('dev-mock-jwt-')) {
        let res: Response | null = null;
        try {
          res = await fetch(`${API_URL}/customers/${customerId}`, {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          });
        } catch {
          res = null;
        }

        if (res && res.ok) {
          const body: ApiResponse<CustomerDTO> = await res.json();
          setCustomer(body.data);
        } else if (res && res.status === 404) {
          setIsNotFound(true);
        } else if (res && res.status >= 400 && res.status < 500) {
          const errBody = await res.json().catch(() => ({}));
          throw new Error(errBody.message || `Failed to load customer (HTTP ${res.status})`);
        } else {
          // Dev offline / DB fallback
          const mockMatch = MOCK_CUSTOMERS.find((c) => c.id === customerId);
          if (mockMatch) {
            setCustomer(mockMatch);
          } else {
            setIsNotFound(true);
          }
        }
      } else {
        // Fallback for mock dev token
        const mockMatch = MOCK_CUSTOMERS.find((c) => c.id === customerId);
        if (mockMatch) {
          setCustomer(mockMatch);
        } else {
          setIsNotFound(true);
        }
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred while loading customer profile.');
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

  // Helper to format preferences safely
  const renderPreferences = (prefs: Record<string, any> | null | undefined) => {
    if (!prefs || typeof prefs !== 'object' || Object.keys(prefs).length === 0) {
      return (
        <span style={{ fontSize: '0.875rem', color: '#94A3B8', fontStyle: 'italic' }}>
          No custom garment preferences configured.
        </span>
      );
    }

    return (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: '12px',
        }}
      >
        {Object.entries(prefs).map(([key, val]) => {
          const readableCategory = key.charAt(0).toUpperCase() + key.slice(1);
          const readableVal = PREFERENCE_LABELS[key]?.[String(val)] || String(val);

          return (
            <div
              key={key}
              style={{
                background: '#F8FAFC',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid #E2E8F0',
              }}
            >
              <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>
                {readableCategory}
              </div>
              <div
                style={{
                  fontSize: '0.875rem',
                  color: '#1E293B',
                  fontWeight: 600,
                  marginTop: '2px',
                }}
              >
                {readableVal}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div
      style={{
        height: '100vh',
        overflowY: 'auto',
        background: '#F8FAFC',
        paddingBottom: '40px',
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
            background: '#1E293B',
            color: '#FFFFFF',
            padding: '12px 20px',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
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
          background: '#FFFFFF',
          borderBottom: '1px solid #E2E8F0',
          padding: '16px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          zIndex: 10,
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
            <h1 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: '#0F172A' }}>
              Customer Profile
            </h1>
            {customer && (
              <span style={{ fontSize: '0.8rem', color: '#64748B' }}>
                ID: <strong>{customer.id}</strong>
              </span>
            )}
          </div>
        </div>

        {customer && (
          <div style={{ display: 'flex', gap: '10px' }}>
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
          </div>
        )}
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
                      style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, color: '#0F172A' }}
                    >
                      {customer.name}
                    </h2>

                    {/* Membership Badge */}
                    {(() => {
                      const tierStyle =
                        MEMBERSHIP_BADGE_STYLE[customer.membership] || MEMBERSHIP_BADGE_STYLE.NONE!;
                      return (
                        <span
                          style={{
                            padding: '4px 12px',
                            borderRadius: '16px',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            background: tierStyle.bg,
                            color: tierStyle.text,
                            border: `1px solid ${tierStyle.border}`,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <Shield size={12} />
                          {customer.membership} MEMBER ({customer.discountPercent}% OFF)
                        </span>
                      );
                    })()}
                  </div>

                  <div style={{ display: 'flex', gap: '16px', marginTop: '8px', flexWrap: 'wrap' }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        color: '#475569',
                        fontSize: '0.9rem',
                      }}
                    >
                      <Phone size={16} color="#2563EB" />
                      <span>{customer.phone}</span>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        color: '#475569',
                        fontSize: '0.9rem',
                      }}
                    >
                      <Mail size={16} color="#2563EB" />
                      <span>{customer.email || 'No email provided'}</span>
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
                    color: '#0F172A',
                    margin: '0 0 16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <MapPin size={18} color="#2563EB" />
                  Contact & Address
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div>
                    <div style={{ fontSize: '0.8rem', color: '#64748B', fontWeight: 600 }}>
                      Phone Number
                    </div>
                    <div
                      style={{
                        fontSize: '0.95rem',
                        color: '#1E293B',
                        fontWeight: 600,
                        marginTop: '2px',
                      }}
                    >
                      {customer.phone}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '0.8rem', color: '#64748B', fontWeight: 600 }}>
                      Email Address
                    </div>
                    <div style={{ fontSize: '0.95rem', color: '#1E293B', marginTop: '2px' }}>
                      {customer.email || (
                        <span style={{ color: '#94A3B8', fontStyle: 'italic' }}>Not provided</span>
                      )}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '0.8rem', color: '#64748B', fontWeight: 600 }}>
                      Postal Address
                    </div>
                    <div
                      style={{
                        fontSize: '0.95rem',
                        color: '#1E293B',
                        marginTop: '2px',
                        lineHeight: '1.4',
                      }}
                    >
                      {customer.address || (
                        <span style={{ color: '#94A3B8', fontStyle: 'italic' }}>Not provided</span>
                      )}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '0.8rem', color: '#64748B', fontWeight: 600 }}>
                      Pincode
                    </div>
                    <div style={{ fontSize: '0.95rem', color: '#1E293B', marginTop: '2px' }}>
                      {customer.pincode || (
                        <span style={{ color: '#94A3B8', fontStyle: 'italic' }}>Not provided</span>
                      )}
                    </div>
                  </div>
                </div>
              </Card>

              {/* Membership & Preferences Card */}
              <Card style={{ padding: '20px' }}>
                <h3
                  style={{
                    fontSize: '1rem',
                    fontWeight: 700,
                    color: '#0F172A',
                    margin: '0 0 16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <Sparkles size={18} color="#D97706" />
                  Garment Processing Preferences
                </h3>

                {renderPreferences(customer.preferences)}

                <div
                  style={{
                    marginTop: '20px',
                    paddingTop: '16px',
                    borderTop: '1px solid #E2E8F0',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                  }}
                >
                  <h3
                    style={{
                      fontSize: '1rem',
                      fontWeight: 700,
                      color: '#0F172A',
                      margin: 0,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <Tag size={18} color="#059669" />
                    Account Details
                  </h3>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <div style={{ fontSize: '0.8rem', color: '#64748B', fontWeight: 600 }}>
                        Registration Source
                      </div>
                      <div
                        style={{
                          fontSize: '0.9rem',
                          color: '#1E293B',
                          fontWeight: 600,
                          marginTop: '2px',
                        }}
                      >
                        {customer.registrationSource || 'WALK_IN'}
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: '0.8rem', color: '#64748B', fontWeight: 600 }}>
                        Member Since
                      </div>
                      <div style={{ fontSize: '0.9rem', color: '#1E293B', marginTop: '2px' }}>
                        {formatDate(customer.createdAt)}
                      </div>
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
