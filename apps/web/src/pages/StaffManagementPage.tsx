import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Card, Button, LoadingState, EmptyState, ErrorState } from '@growfast/ui';
import { Role, type EmployeeDTO, type ApiResponse } from '@growfast/shared-types';
import {
  Users,
  UserPlus,
  Shield,
  Phone,
  Mail,
  Store as StoreIcon,
  CheckCircle,
  XCircle,
  Edit3,
  Key,
  ArrowLeft,
  Search,
  RefreshCw,
  Info,
  X,
  Trash2,
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const ROLE_BADGE_STYLE: Record<Role, { bg: string; text: string; border: string }> = {
  OWNER: { bg: '#F3E8FF', text: '#6B21A8', border: '#A855F7' },
  MANAGER: { bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' },
  COUNTER: { bg: '#ECFDF5', text: '#047857', border: '#A7F3D0' },
  DELIVERY: { bg: '#FEF3C7', text: '#B45309', border: '#FDE68A' },
};

export const StaffManagementPage: React.FC = () => {
  const navigate = useNavigate();
  const { employee: currentEmployee, token } = useAuth();

  const [employees, setEmployees] = useState<EmployeeDTO[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState<string>('ALL');
  const [notice, setNotice] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<EmployeeDTO | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form Fields
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>(Role.COUNTER);
  const [pin, setPin] = useState('');
  const [isActive, setIsActive] = useState(true);

  const showNotice = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 4000);
  };

  const fetchEmployees = useCallback(async () => {
    if (!token) return;

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/employees`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.message || `Failed to fetch employees (HTTP ${res.status})`);
      }

      const body: ApiResponse<EmployeeDTO[]> = await res.json();
      setEmployees(body.data || []);
    } catch (err: any) {
      setError(err.message || 'An error occurred while loading staff directory.');
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  const openCreateModal = () => {
    setEditingEmployee(null);
    setName('');
    setPhone('');
    setEmail('');
    setRole(Role.COUNTER);
    setPin('');
    setIsActive(true);
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (emp: EmployeeDTO) => {
    // UI Role Protection: Manager cannot edit Owner
    if (currentEmployee?.role === Role.MANAGER && emp.role === Role.OWNER) {
      showNotice('Managers are not authorized to edit Owner accounts.');
      return;
    }

    setEditingEmployee(emp);
    setName(emp.name);
    setPhone(emp.phone || '');
    setEmail(emp.email || '');
    setRole(emp.role);
    setPin(''); // Leave blank unless updating
    setIsActive(emp.isActive);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Client-side Validation
    if (!name.trim()) {
      setFormError('Employee name is required.');
      return;
    }

    if (!editingEmployee && !pin) {
      setFormError('Security PIN (4-6 digits) is required for new employees.');
      return;
    }

    if (pin && !/^\d{4,6}$/.test(pin)) {
      setFormError('PIN must be 4 to 6 numeric digits.');
      return;
    }

    setFormLoading(true);

    try {
      if (editingEmployee) {
        const updatePayload: any = {
          name: name.trim(),
          phone: phone.trim() || null,
          email: email.trim() || null,
          role,
          isActive,
        };
        if (pin) updatePayload.pin = pin;

        const res = await fetch(`${API_URL}/employees/${editingEmployee.id}`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updatePayload),
        });

        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          throw new Error(errBody.message || 'Failed to update employee details.');
        }

        const body: ApiResponse<EmployeeDTO> = await res.json();
        setEmployees((prev) => prev.map((emp) => (emp.id === body.data.id ? body.data : emp)));
        showNotice(`Staff member "${body.data.name}" updated successfully!`);
        setIsModalOpen(false);
      } else {
        // Create Employee
        const createPayload = {
          name: name.trim(),
          phone: phone.trim() || undefined,
          email: email.trim() || undefined,
          pin,
          role,
          storeId: currentEmployee?.storeId,
        };

        const res = await fetch(`${API_URL}/employees`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(createPayload),
        });

        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          throw new Error(errBody.message || 'Failed to create employee account.');
        }

        const body: ApiResponse<EmployeeDTO> = await res.json();
        setEmployees((prev) => [body.data, ...prev]);
        showNotice(`Employee account created for "${body.data.name}"!`);
        setIsModalOpen(false);
      }
    } catch (err: any) {
      setFormError(err.message || 'Failed to save staff information.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleToggleActive = async (emp: EmployeeDTO) => {
    // Protection: Self-deactivation
    if (emp.id === currentEmployee?.id) {
      showNotice('You cannot deactivate your own account.');
      return;
    }

    // Protection: Manager editing Owner
    if (currentEmployee?.role === Role.MANAGER && emp.role === Role.OWNER) {
      showNotice('Managers are not authorized to modify Owner accounts.');
      return;
    }

    const newActiveState = !emp.isActive;

    try {
      const res = await fetch(`${API_URL}/employees/${emp.id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isActive: newActiveState }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.message || 'Failed to update employee status.');
      }

      const body: ApiResponse<EmployeeDTO> = await res.json();
      setEmployees((prev) => prev.map((e) => (e.id === body.data.id ? body.data : e)));
      showNotice(
        `Employee "${body.data.name}" is now ${body.data.isActive ? 'ACTIVE' : 'INACTIVE'}.`,
      );
    } catch (err: any) {
      showNotice(err.message || 'Failed to update status.');
    }
  };

  const handleDeleteEmployee = async (emp: EmployeeDTO) => {
    // Protection: Self-deletion
    if (emp.id === currentEmployee?.id) {
      showNotice('You cannot delete your own account.');
      return;
    }

    // Protection: Manager deleting Owner
    if (currentEmployee?.role === Role.MANAGER && emp.role === Role.OWNER) {
      showNotice('Managers are not authorized to delete Owner accounts.');
      return;
    }

    if (
      !window.confirm(
        `Are you sure you want to completely delete "${emp.name}"? This action cannot be undone.`,
      )
    ) {
      return;
    }

    try {
      const res = await fetch(`${API_URL}/employees/${emp.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.message || 'Failed to delete employee account.');
      }

      setEmployees((prev) => prev.filter((e) => e.id !== emp.id));
      showNotice(`Employee "${emp.name}" deleted successfully.`);
    } catch (err: any) {
      showNotice(err.message || 'Failed to delete employee.');
    }
  };

  // Filter employees
  const filteredEmployees = employees.filter((emp) => {
    const matchesSearch =
      emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (emp.phone && emp.phone.includes(searchQuery)) ||
      (emp.email && emp.email.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesRole = filterRole === 'ALL' || emp.role === filterRole;

    return matchesSearch && matchesRole;
  });

  return (
    <div
      style={{
        height: '100vh',
        overflowY: 'auto',
        background: '#F8FAFC',
        paddingBottom: '40px',
      }}
    >
      {/* Toast Notice */}
      {notice && (
        <div
          style={{
            position: 'fixed',
            top: '16px',
            right: '16px',
            left: '16px',
            maxWidth: '500px',
            margin: '0 auto',
            zIndex: 1100,
            background: '#1E293B',
            color: '#FFFFFF',
            padding: '12px 18px',
            borderRadius: '10px',
            boxShadow: '0 10px 15px -3px rgba(0,0,0,0.2)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '0.875rem',
          }}
        >
          <Info size={18} color="#38BDF8" style={{ flexShrink: 0 }} />
          <span>{notice}</span>
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
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Button
              variant="ghost"
              size="sm"
              icon={<ArrowLeft size={16} />}
              onClick={() => navigate('/')}
              aria-label="Back to Dashboard"
            >
              Dashboard
            </Button>
            <div>
              <h1
                style={{
                  fontSize: '1.2rem',
                  fontWeight: 800,
                  color: '#0F172A',
                  margin: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <Users size={22} color="#7C3AED" />
                Staff Management
              </h1>
              <span style={{ fontSize: '0.75rem', color: '#64748B' }}>
                Store Staff Accounts & Access Roles ({employees.length} total)
              </span>
            </div>
          </div>

          <Button
            variant="primary"
            size="sm"
            icon={<UserPlus size={16} />}
            onClick={openCreateModal}
            aria-label="Add New Staff Member"
            style={{ minHeight: '44px' }}
          >
            Add Staff Member
          </Button>
        </div>
      </header>

      {/* Main Container */}
      <main style={{ maxWidth: '960px', margin: '0 auto', padding: '24px 16px' }}>
        {/* Filters Card */}
        <Card style={{ padding: '16px', marginBottom: '20px' }}>
          <div
            style={{
              display: 'flex',
              gap: '12px',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
            }}
          >
            <div
              style={{
                position: 'relative',
                flex: '1 1 240px',
                minWidth: '240px',
              }}
            >
              <Search
                size={16}
                color="#94A3B8"
                style={{ position: 'absolute', left: '12px', top: '14px' }}
              />
              <input
                type="text"
                placeholder="Search staff by name, phone, email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  minHeight: '44px',
                  paddingLeft: '36px',
                  paddingRight: '12px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  fontSize: '0.875rem',
                  outline: 'none',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <select
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
                style={{
                  minHeight: '44px',
                  padding: '0 12px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  fontSize: '0.875rem',
                  background: '#FFFFFF',
                  color: '#334155',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <option value="ALL">All Roles</option>
                <option value="OWNER">Owner</option>
                <option value="COUNTER">Employee</option>
              </select>

              <Button
                variant="ghost"
                size="sm"
                icon={<RefreshCw size={14} />}
                onClick={fetchEmployees}
                disabled={isLoading}
                aria-label="Refresh Staff List"
                style={{ minHeight: '44px' }}
              >
                Refresh
              </Button>
            </div>
          </div>
        </Card>

        {/* Content Body */}
        {isLoading ? (
          <LoadingState message="Loading store staff directory..." />
        ) : error ? (
          <ErrorState
            title="Unable to Load Staff Directory"
            message={error}
            onRetry={fetchEmployees}
          />
        ) : filteredEmployees.length === 0 ? (
          <EmptyState
            title="No Staff Accounts Found"
            message={
              searchQuery
                ? `No staff members matched "${searchQuery}".`
                : 'No employee accounts match the selected role filter.'
            }
            action={
              <Button
                variant="primary"
                size="sm"
                icon={<UserPlus size={14} />}
                onClick={openCreateModal}
                style={{ minHeight: '44px' }}
              >
                Add Staff Account
              </Button>
            }
          />
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))',
              gap: '16px',
            }}
          >
            {filteredEmployees.map((emp) => {
              const badgeStyle = ROLE_BADGE_STYLE[emp.role] || ROLE_BADGE_STYLE.COUNTER;
              const isSelf = emp.id === currentEmployee?.id;
              const isManagerEditingOwner =
                currentEmployee?.role === Role.MANAGER && emp.role === Role.OWNER;

              return (
                <Card
                  key={emp.id}
                  style={{
                    padding: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    opacity: emp.isActive ? 1 : 0.65,
                    border: isSelf ? '2px solid #7C3AED' : '1px solid #E2E8F0',
                  }}
                >
                  <div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'space-between',
                        gap: '8px',
                        marginBottom: '12px',
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontSize: '1rem',
                            fontWeight: 700,
                            color: '#0F172A',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                          }}
                        >
                          {emp.name}
                          {isSelf && (
                            <span
                              style={{
                                background: '#F3E8FF',
                                color: '#7C3AED',
                                fontSize: '0.65rem',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                fontWeight: 700,
                              }}
                            >
                              YOU
                            </span>
                          )}
                        </div>
                        <div
                          style={{
                            fontSize: '0.75rem',
                            color: '#64748B',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            marginTop: '2px',
                          }}
                        >
                          <StoreIcon size={12} /> {emp.storeName}
                        </div>
                      </div>

                      <span
                        style={{
                          background: badgeStyle.bg,
                          color: badgeStyle.text,
                          border: `1px solid ${badgeStyle.border}`,
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontSize: '0.7rem',
                          fontWeight: 700,
                        }}
                      >
                        {emp.role}
                      </span>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                        fontSize: '0.825rem',
                        color: '#475569',
                        marginBottom: '16px',
                      }}
                    >
                      {emp.phone && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Phone size={14} color="#64748B" />
                          <span>{emp.phone}</span>
                        </div>
                      )}
                      {emp.email && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Mail size={14} color="#64748B" />
                          <span
                            style={{
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {emp.email}
                          </span>
                        </div>
                      )}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          marginTop: '4px',
                        }}
                      >
                        {emp.isActive ? (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              color: '#166534',
                              fontWeight: 600,
                              fontSize: '0.75rem',
                            }}
                          >
                            <CheckCircle size={14} color="#16A34A" /> Active Account
                          </span>
                        ) : (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              color: '#991B1B',
                              fontWeight: 600,
                              fontSize: '0.75rem',
                            }}
                          >
                            <XCircle size={14} color="#DC2626" /> Account Deactivated
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      paddingTop: '12px',
                      borderTop: '1px solid #F1F5F9',
                    }}
                  >
                    <Button
                      variant="outline"
                      size="sm"
                      icon={<Edit3 size={14} />}
                      onClick={() => openEditModal(emp)}
                      disabled={isManagerEditingOwner}
                      style={{ flex: 1, minHeight: '44px' }}
                    >
                      Edit
                    </Button>

                    <Button
                      variant={emp.isActive ? 'secondary' : 'primary'}
                      size="sm"
                      onClick={() => handleToggleActive(emp)}
                      disabled={isSelf || isManagerEditingOwner}
                      style={{ flex: 1, minHeight: '44px' }}
                    >
                      {emp.isActive ? 'Deactivate' : 'Activate'}
                    </Button>

                    {/* Delete only allowed if not self, and not manager deleting owner */}
                    <button
                      type="button"
                      onClick={() => handleDeleteEmployee(emp)}
                      disabled={isSelf || isManagerEditingOwner}
                      title="Delete Employee"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minHeight: '44px',
                        minWidth: '44px',
                        borderRadius: '8px',
                        border: '1px solid #FECACA',
                        background: '#FEF2F2',
                        color: '#DC2626',
                        cursor: isSelf || isManagerEditingOwner ? 'not-allowed' : 'pointer',
                        opacity: isSelf || isManagerEditingOwner ? 0.5 : 1,
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </main>

      {/* Create / Edit Staff Modal */}
      {isModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
        >
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: '16px',
              maxWidth: '480px',
              width: '100%',
              padding: '24px',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '16px',
              }}
            >
              <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: '#0F172A' }}>
                {editingEmployee ? `Edit Staff: ${editingEmployee.name}` : 'Add New Staff Member'}
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  padding: '4px',
                }}
                aria-label="Close modal"
              >
                <X size={20} color="#64748B" />
              </button>
            </div>

            {formError && (
              <div
                style={{
                  background: '#FEF2F2',
                  border: '1px solid #FCA5A5',
                  color: '#991B1B',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  fontSize: '0.825rem',
                  marginBottom: '16px',
                }}
              >
                {formError}
              </div>
            )}

            <form
              onSubmit={handleSubmit}
              style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}
            >
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    color: '#334155',
                    marginBottom: '4px',
                  }}
                >
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Swapnil Shinde"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={{
                    width: '100%',
                    minHeight: '44px',
                    padding: '0 12px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    fontSize: '0.875rem',
                    outline: 'none',
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      color: '#334155',
                      marginBottom: '4px',
                    }}
                  >
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    placeholder="+91 98765 43210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    style={{
                      width: '100%',
                      minHeight: '44px',
                      padding: '0 12px',
                      borderRadius: '8px',
                      border: '1px solid #CBD5E1',
                      fontSize: '0.875rem',
                      outline: 'none',
                    }}
                  />
                </div>

                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      color: '#334155',
                      marginBottom: '4px',
                    }}
                  >
                    Email Address
                  </label>
                  <input
                    type="email"
                    placeholder="staff@growfast.in"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    style={{
                      width: '100%',
                      minHeight: '44px',
                      padding: '0 12px',
                      borderRadius: '8px',
                      border: '1px solid #CBD5E1',
                      fontSize: '0.875rem',
                      outline: 'none',
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      color: '#334155',
                      marginBottom: '4px',
                    }}
                  >
                    Role *
                  </label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as Role)}
                    disabled={editingEmployee?.id === currentEmployee?.id}
                    style={{
                      width: '100%',
                      minHeight: '44px',
                      padding: '0 12px',
                      borderRadius: '8px',
                      border: '1px solid #CBD5E1',
                      fontSize: '0.875rem',
                      background: '#FFFFFF',
                      outline: 'none',
                    }}
                  >
                    {currentEmployee?.role === Role.OWNER && <option value="OWNER">Owner</option>}
                    <option value="COUNTER">Employee</option>
                  </select>
                </div>

                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      color: '#334155',
                      marginBottom: '4px',
                    }}
                  >
                    {editingEmployee ? 'New PIN (Optional)' : 'Security PIN *'}
                  </label>
                  <input
                    type="password"
                    maxLength={6}
                    placeholder={editingEmployee ? 'Leave blank to keep' : '4-6 numeric digits'}
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    style={{
                      width: '100%',
                      minHeight: '44px',
                      padding: '0 12px',
                      borderRadius: '8px',
                      border: '1px solid #CBD5E1',
                      fontSize: '0.875rem',
                      outline: 'none',
                    }}
                  />
                </div>
              </div>

              {editingEmployee && (
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}
                >
                  <input
                    type="checkbox"
                    id="edit-is-active"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    disabled={editingEmployee.id === currentEmployee?.id}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                  <label
                    htmlFor="edit-is-active"
                    style={{ fontSize: '0.875rem', color: '#334155', cursor: 'pointer' }}
                  >
                    Account Active Status
                  </label>
                </div>
              )}

              <div
                style={{
                  display: 'flex',
                  gap: '12px',
                  justifyContent: 'flex-end',
                  marginTop: '12px',
                }}
              >
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsModalOpen(false)}
                  disabled={formLoading}
                  style={{ minHeight: '44px' }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  loading={formLoading}
                  style={{ minHeight: '44px' }}
                >
                  {editingEmployee ? 'Save Changes' : 'Create Staff Account'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
