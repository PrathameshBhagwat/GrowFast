import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Card, Button, LoadingState, EmptyState, ErrorState } from '@growfast/ui';
import { ThemeToggle } from '../components/ThemeToggle';
import { BranchSelector } from '../components/BranchSelector';
import { useBranch } from '../contexts/BranchContext';
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
  Camera,
  FileText,
  MapPin,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  UploadCloud,
  CheckSquare,
  Square,
  ShieldCheck,
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const getRoleBadgeClass = (role: Role) => {
  switch (role) {
    case Role.OWNER:
      return 'bg-purple-100 text-purple-900 border-purple-300 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-700/60';
    case Role.MANAGER:
      return 'bg-blue-100 text-blue-900 border-blue-300 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-700/60';
    case Role.COUNTER:
      return 'bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-700/60';
    case Role.DELIVERY:
      return 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-700/60';
    default:
      return 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
  }
};

export const StaffManagementPage: React.FC = () => {
  const navigate = useNavigate();
  const { employee: currentEmployee, token } = useAuth();
  const { activeBranchId, isAllBranches, branches } = useBranch();

  const [employees, setEmployees] = useState<EmployeeDTO[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState<string>('ALL');
  const [notice, setNotice] = useState<string | null>(null);

  // Create / Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<EmployeeDTO | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [showAdditionalInfo, setShowAdditionalInfo] = useState(false);

  // Permanent Delete Modal State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingEmployee, setDeletingEmployee] = useState<EmployeeDTO | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Form Basic Fields
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>(Role.COUNTER);
  const [formStoreId, setFormStoreId] = useState<string>(
    currentEmployee?.storeId || 'store-kp-001',
  );
  const [pin, setPin] = useState('');
  const [isActive, setIsActive] = useState(true);

  // Form Optional Profile Fields
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [passportPhotoUrl, setPassportPhotoUrl] = useState<string | null>(null);
  const [aadhaarFrontUrl, setAadhaarFrontUrl] = useState<string | null>(null);
  const [aadhaarBackUrl, setAadhaarBackUrl] = useState<string | null>(null);
  const [currentAddress, setCurrentAddress] = useState('');
  const [permanentAddress, setPermanentAddress] = useState('');
  const [sameAsCurrentAddress, setSameAsCurrentAddress] = useState(false);

  // Upload progress tracking
  const [uploadingDocType, setUploadingDocType] = useState<string | null>(null);

  // File input refs
  const photoInputRef = useRef<HTMLInputElement>(null);
  const passportPhotoInputRef = useRef<HTMLInputElement>(null);
  const aadhaarFrontInputRef = useRef<HTMLInputElement>(null);
  const aadhaarBackInputRef = useRef<HTMLInputElement>(null);

  const showNotice = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 4500);
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
      console.warn('Backend unavailable, using preview fallback for staff:', err?.message);
      const fallbackEmployees: EmployeeDTO[] = [
        {
          id: 'emp-owner-001',
          name: 'Vikram Malhotra',
          role: Role.OWNER,
          phone: '+91 98200 11223',
          email: 'vikram.owner@growfast.in',
          storeId: 'store-pune-01',
          storeName: 'GrowFast Pune Main',
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'emp-counter-002',
          name: 'Pooja Kulkarni',
          role: Role.COUNTER,
          phone: '+91 88881 23456',
          email: 'pooja.counter@growfast.in',
          storeId: 'store-pune-01',
          storeName: 'GrowFast Pune Main',
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];
      setEmployees(fallbackEmployees);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees, activeBranchId]);

  const openCreateModal = () => {
    setEditingEmployee(null);
    setName('');
    setPhone('');
    setEmail('');
    setRole(Role.COUNTER);
    const defaultStoreId =
      !isAllBranches && activeBranchId
        ? activeBranchId
        : branches[0]?.id || currentEmployee?.storeId || 'store-kp-001';
    setFormStoreId(defaultStoreId);
    setPin('');
    setIsActive(true);
    setPhotoUrl(null);
    setPassportPhotoUrl(null);
    setAadhaarFrontUrl(null);
    setAadhaarBackUrl(null);
    setCurrentAddress('');
    setPermanentAddress('');
    setSameAsCurrentAddress(false);
    setShowAdditionalInfo(false);
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (emp: EmployeeDTO) => {
    if (currentEmployee?.role === Role.MANAGER && emp.role === Role.OWNER) {
      showNotice('Managers are not authorized to edit Owner accounts.');
      return;
    }

    setEditingEmployee(emp);
    setName(emp.name);
    setPhone(emp.phone || '');
    setEmail(emp.email || '');
    setRole(emp.role);
    setFormStoreId(emp.storeId || currentEmployee?.storeId || 'store-kp-001');
    setPin(''); // Blank unless updating
    setIsActive(emp.isActive);
    setPhotoUrl(emp.photoUrl || null);
    setPassportPhotoUrl(emp.passportPhotoUrl || null);
    setAadhaarFrontUrl(
      emp.aadhaarFrontUrl && emp.aadhaarFrontUrl !== '[PROTECTED]' ? emp.aadhaarFrontUrl : null,
    );
    setAadhaarBackUrl(
      emp.aadhaarBackUrl && emp.aadhaarBackUrl !== '[PROTECTED]' ? emp.aadhaarBackUrl : null,
    );
    setCurrentAddress(emp.currentAddress || '');
    setPermanentAddress(emp.permanentAddress || '');
    setSameAsCurrentAddress(Boolean(emp.sameAsCurrentAddress));
    // If any optional profile fields exist, expand the section
    const hasOptionalInfo = Boolean(
      emp.photoUrl ||
      emp.passportPhotoUrl ||
      emp.aadhaarFrontUrl ||
      emp.aadhaarBackUrl ||
      emp.currentAddress ||
      emp.permanentAddress,
    );
    setShowAdditionalInfo(hasOptionalInfo);
    setFormError(null);
    setIsModalOpen(true);
  };

  // Upload document or photo helper
  const handleFileUpload = async (file: File, docType: string) => {
    if (!token) return;

    // Validate size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setFormError(`File "${file.name}" exceeds the 5MB size limit.`);
      return;
    }

    setUploadingDocType(docType);
    setFormError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      if (currentEmployee?.storeId) {
        formData.append('storeId', currentEmployee.storeId);
      }

      const res = await fetch(`${API_URL}/employees/upload-document`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.message || 'Failed to upload document.');
      }

      const body = await res.json();
      const storedUrl = body.data?.storedUrl;

      if (!storedUrl) {
        throw new Error('Upload succeeded but no file reference returned.');
      }

      // Assign to the relevant state
      switch (docType) {
        case 'photo':
          setPhotoUrl(storedUrl);
          break;
        case 'passport':
          setPassportPhotoUrl(storedUrl);
          break;
        case 'aadhaar-front':
          setAadhaarFrontUrl(storedUrl);
          break;
        case 'aadhaar-back':
          setAadhaarBackUrl(storedUrl);
          break;
      }
      showNotice(`${docType === 'photo' ? 'Photo' : 'Document'} uploaded successfully.`);
    } catch (err: any) {
      setFormError(err.message || 'File upload failed.');
    } finally {
      setUploadingDocType(null);
    }
  };

  // Address sync handler
  const handleCurrentAddressChange = (val: string) => {
    setCurrentAddress(val);
    if (sameAsCurrentAddress) {
      setPermanentAddress(val);
    }
  };

  const handleSameAddressToggle = (checked: boolean) => {
    setSameAsCurrentAddress(checked);
    if (checked) {
      setPermanentAddress(currentAddress);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

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
          storeId: formStoreId,
          isActive,
          photoUrl: photoUrl || null,
          passportPhotoUrl: passportPhotoUrl || null,
          aadhaarFrontUrl: aadhaarFrontUrl || null,
          aadhaarBackUrl: aadhaarBackUrl || null,
          currentAddress: currentAddress.trim() || null,
          permanentAddress: sameAsCurrentAddress
            ? currentAddress.trim() || null
            : permanentAddress.trim() || null,
          sameAsCurrentAddress,
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
          storeId: formStoreId || currentEmployee?.storeId || 'store-kp-001',
          photoUrl: photoUrl || undefined,
          passportPhotoUrl: passportPhotoUrl || undefined,
          aadhaarFrontUrl: aadhaarFrontUrl || undefined,
          aadhaarBackUrl: aadhaarBackUrl || undefined,
          currentAddress: currentAddress.trim() || undefined,
          permanentAddress: sameAsCurrentAddress
            ? currentAddress.trim() || undefined
            : permanentAddress.trim() || undefined,
          sameAsCurrentAddress,
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
    if (emp.id === currentEmployee?.id) {
      showNotice('You cannot deactivate your own account.');
      return;
    }

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

  // Open permanent delete dialog
  const promptPermanentDelete = (emp: EmployeeDTO) => {
    if (emp.id === currentEmployee?.id) {
      showNotice('You cannot delete your own account.');
      return;
    }

    if (currentEmployee?.role === Role.MANAGER && emp.role === Role.OWNER) {
      showNotice('Managers are not authorized to delete Owner accounts.');
      return;
    }

    setDeletingEmployee(emp);
    setDeleteError(null);
    setIsDeleteModalOpen(true);
  };

  // Execute permanent delete workflow
  const handleConfirmPermanentDelete = async () => {
    if (!deletingEmployee || isDeleting) return;

    setIsDeleting(true);
    setDeleteError(null);

    try {
      const res = await fetch(`${API_URL}/employees/${deletingEmployee.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const resBody = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(resBody.message || 'Failed to permanently delete staff member.');
      }

      // Deletion confirmed by server
      setEmployees((prev) => prev.filter((e) => e.id !== deletingEmployee.id));
      setIsDeleteModalOpen(false);
      setDeletingEmployee(null);
      showNotice(
        resBody.message || `Staff member "${deletingEmployee.name}" deleted successfully.`,
      );
    } catch (err: any) {
      setDeleteError(err.message || 'An error occurred during deletion.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Filter employees
  const filteredEmployees = employees.filter((emp) => {
    if (emp.isDeleted) return false;

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
        minHeight: '100vh',
        background: 'var(--bg-app, #F8FAFC)',
        color: 'var(--text-primary, #0F172A)',
        paddingBottom: '40px',
        transition: 'background-color 0.2s ease, color 0.2s ease',
      }}
    >
      {/* Toast Notice */}
      {notice && (
        <div
          role="alert"
          style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            zIndex: 9999,
            backgroundColor: '#1E293B',
            color: '#FFFFFF',
            padding: '12px 20px',
            borderRadius: '10px',
            boxShadow: '0 10px 15px -3px rgba(0,0,0,0.2)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '0.875rem',
            fontWeight: 500,
          }}
        >
          <Info size={16} color="#38BDF8" />
          <span>{notice}</span>
        </div>
      )}

      {/* Header Bar */}
      <header
        style={{
          background: 'var(--bg-surface, #FFFFFF)',
          borderBottom: '1px solid var(--border, #E2E8F0)',
          padding: '16px 24px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
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
            <button
              onClick={() => navigate('/home')}
              aria-label="Back to dashboard"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: '44px',
                minHeight: '44px',
                borderRadius: '10px',
                border: '1px solid var(--border)',
                background: 'var(--bg-surface)',
                color: 'var(--text-primary)',
                cursor: 'pointer',
              }}
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <h1
                style={{
                  fontSize: '1.25rem',
                  fontWeight: 800,
                  color: 'var(--text-primary, #0F172A)',
                  margin: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <Users size={22} color="#7C3AED" />
                Staff Management
              </h1>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #64748B)' }}>
                Store Staff Accounts & Access Roles ({filteredEmployees.length} total)
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <BranchSelector />
            <ThemeToggle />
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
                  borderRadius: '12px',
                  border: '1px solid var(--border)',
                  background: 'var(--bg-surface-inset)',
                  boxShadow: 'var(--shadow-neu-inset)',
                  color: 'var(--text-primary)',
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
                  padding: '0 14px',
                  borderRadius: '12px',
                  border: '1px solid var(--border)',
                  fontSize: '0.875rem',
                  background: 'var(--bg-surface-inset)',
                  color: 'var(--text-primary)',
                  boxShadow: 'var(--shadow-neu-inset)',
                  fontWeight: 600,
                  cursor: 'pointer',
                  outline: 'none',
                }}
              >
                <option value="ALL">All Roles</option>
                <option value="OWNER">Owner</option>
                <option value="MANAGER">Manager</option>
                <option value="COUNTER">Counter</option>
                <option value="DELIVERY">Delivery</option>
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
              const isSelf = emp.id === currentEmployee?.id;
              const isManagerEditingOwner =
                currentEmployee?.role === Role.MANAGER && emp.role === Role.OWNER;

              return (
                <Card
                  key={emp.id}
                  style={{
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '14px',
                    borderLeft: emp.isActive ? '4px solid #10B981' : '4px solid #94A3B8',
                  }}
                >
                  <div>
                    {/* Top Row: Avatar/Photo & Role Badge */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: '10px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {emp.photoUrl ? (
                          <div
                            style={{
                              width: '40px',
                              height: '40px',
                              borderRadius: '20px',
                              background: '#F1F5F9',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              overflow: 'hidden',
                              border: '1px solid var(--border)',
                            }}
                          >
                            <img
                              src={
                                emp.photoUrl.startsWith('/')
                                  ? `${API_URL.replace('/api', '')}${emp.photoUrl}`
                                  : emp.photoUrl
                              }
                              alt={emp.name}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = 'none';
                              }}
                            />
                          </div>
                        ) : (
                          <div
                            style={{
                              width: '40px',
                              height: '40px',
                              borderRadius: '20px',
                              background: emp.role === Role.OWNER ? '#F3E8FF' : '#E0E7FF',
                              color: emp.role === Role.OWNER ? '#6B21A8' : '#3730A3',
                              fontWeight: 700,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '0.9rem',
                            }}
                          >
                            {emp.name
                              .split(' ')
                              .map((n) => n[0])
                              .join('')
                              .substring(0, 2)
                              .toUpperCase()}
                          </div>
                        )}
                        <div>
                          <h3
                            style={{
                              fontSize: '0.95rem',
                              fontWeight: 700,
                              margin: 0,
                              color: 'var(--text-primary, #0F172A)',
                            }}
                          >
                            {emp.name}
                            {isSelf && (
                              <span
                                style={{
                                  marginLeft: '6px',
                                  fontSize: '0.7rem',
                                  padding: '1px 6px',
                                  background: '#EFF6FF',
                                  color: '#2563EB',
                                  borderRadius: '6px',
                                  fontWeight: 600,
                                }}
                              >
                                You
                              </span>
                            )}
                          </h3>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #64748B)' }}>
                            {emp.storeName || 'Assigned Store'}
                          </div>
                        </div>
                      </div>

                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${getRoleBadgeClass(
                          emp.role,
                        )}`}
                      >
                        {emp.role}
                      </span>
                    </div>

                    {/* Contact & Address Details */}
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                        fontSize: '0.8rem',
                        color: 'var(--text-secondary, #475569)',
                      }}
                    >
                      {emp.phone && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Phone size={13} color="#64748B" />
                          <span>{emp.phone}</span>
                        </div>
                      )}
                      {emp.email && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Mail size={13} color="#64748B" />
                          <span>{emp.email}</span>
                        </div>
                      )}
                      {emp.currentAddress && (
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                          <MapPin
                            size={13}
                            color="#64748B"
                            style={{ marginTop: '2px', flexShrink: 0 }}
                          />
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {emp.currentAddress}
                          </span>
                        </div>
                      )}

                      {/* Documents / Verification indicator */}
                      <div
                        style={{ display: 'flex', gap: '6px', marginTop: '4px', flexWrap: 'wrap' }}
                      >
                        {emp.photoUrl && (
                          <span
                            style={{
                              fontSize: '0.65rem',
                              background: '#F0FDF4',
                              color: '#166534',
                              padding: '1px 6px',
                              borderRadius: '4px',
                              border: '1px solid #BBF7D0',
                            }}
                          >
                            Photo Attached
                          </span>
                        )}
                        {(emp.aadhaarFrontUrl || emp.aadhaarBackUrl) && (
                          <span
                            style={{
                              fontSize: '0.65rem',
                              background: '#EFF6FF',
                              color: '#1E40AF',
                              padding: '1px 6px',
                              borderRadius: '4px',
                              border: '1px solid #BFDBFE',
                            }}
                          >
                            Aadhaar Attached
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions Row */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      paddingTop: '12px',
                      borderTop: '1px solid var(--border, #F1F5F9)',
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

                    {/* Permanent Delete Button */}
                    <button
                      type="button"
                      onClick={() => promptPermanentDelete(emp)}
                      disabled={isSelf || isManagerEditingOwner}
                      title="Permanently Delete Staff Member"
                      aria-label={`Permanently Delete ${emp.name}`}
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

      {/* ─── PERMANENT DELETE CONFIRMATION MODAL ─── */}
      {isDeleteModalOpen && deletingEmployee && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1100,
            background: 'rgba(15, 23, 42, 0.7)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
        >
          <div
            style={{
              background: 'var(--bg-surface, #FFFFFF)',
              border: '1px solid #FECACA',
              borderRadius: '16px',
              maxWidth: '460px',
              width: '100%',
              padding: '24px',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.3)',
            }}
          >
            {/* Modal Header */}
            <div
              style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}
            >
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '20px',
                  background: '#FEE2E2',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <AlertTriangle size={22} color="#DC2626" />
              </div>
              <h2
                style={{
                  fontSize: '1.15rem',
                  fontWeight: 800,
                  margin: 0,
                  color: '#991B1B',
                }}
              >
                Permanently Delete Staff Member?
              </h2>
            </div>

            {/* Warning Message */}
            <p
              style={{
                fontSize: '0.875rem',
                color: 'var(--text-secondary, #334155)',
                lineHeight: 1.5,
                margin: '0 0 16px 0',
              }}
            >
              Are you sure you want to permanently delete this staff member? This action cannot be
              undone. Their associated records may need to be retained where required for historical
              records or business operations.
            </p>

            {/* Target Staff Preview Badge */}
            <div
              style={{
                background: '#F8FAFC',
                border: '1px solid var(--border, #E2E8F0)',
                borderRadius: '12px',
                padding: '12px 14px',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.925rem', color: '#0F172A' }}>
                  {deletingEmployee.name}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '2px' }}>
                  {deletingEmployee.phone || deletingEmployee.email || 'No phone/email'}
                </div>
              </div>
              <span
                className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${getRoleBadgeClass(
                  deletingEmployee.role,
                )}`}
              >
                {deletingEmployee.role}
              </span>
            </div>

            {/* Error Message if Deletion Failed */}
            {deleteError && (
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
                {deleteError}
              </div>
            )}

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  if (!isDeleting) {
                    setIsDeleteModalOpen(false);
                    setDeletingEmployee(null);
                  }
                }}
                disabled={isDeleting}
                style={{ minHeight: '44px' }}
              >
                Cancel
              </Button>
              <button
                type="button"
                onClick={handleConfirmPermanentDelete}
                disabled={isDeleting}
                style={{
                  minHeight: '44px',
                  padding: '0 20px',
                  borderRadius: '10px',
                  border: 'none',
                  background: isDeleting ? '#9CA3AF' : '#DC2626',
                  color: '#FFFFFF',
                  fontWeight: 700,
                  fontSize: '0.875rem',
                  cursor: isDeleting ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'background-color 0.15s ease',
                }}
              >
                {isDeleting ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 size={16} />
                    Permanently Delete
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── CREATE / EDIT STAFF MODAL ─── */}
      {isModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
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
              background: 'var(--bg-surface, #FFFFFF)',
              border: '1px solid var(--border, #E2E8F0)',
              borderRadius: '16px',
              maxWidth: '560px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '24px',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.3)',
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
              <h2
                style={{
                  fontSize: '1.15rem',
                  fontWeight: 700,
                  margin: 0,
                  color: 'var(--text-primary, #0F172A)',
                }}
              >
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
              {/* SECTION 1: Basic Information */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    color: 'var(--text-secondary, #334155)',
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
                    border: '1px solid var(--border, #CBD5E1)',
                    background: 'var(--bg-input, #FFFFFF)',
                    color: 'var(--text-primary, #0F172A)',
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
                      color: 'var(--text-secondary, #334155)',
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
                      border: '1px solid var(--border, #CBD5E1)',
                      background: 'var(--bg-input, #FFFFFF)',
                      color: 'var(--text-primary, #0F172A)',
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
                      color: 'var(--text-secondary, #334155)',
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
                      border: '1px solid var(--border, #CBD5E1)',
                      background: 'var(--bg-input, #FFFFFF)',
                      color: 'var(--text-primary, #0F172A)',
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
                      color: 'var(--text-secondary, #334155)',
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
                      border: '1px solid var(--border, #CBD5E1)',
                      fontSize: '0.875rem',
                      background: 'var(--bg-input, #FFFFFF)',
                      color: 'var(--text-primary, #0F172A)',
                      outline: 'none',
                    }}
                  >
                    {currentEmployee?.role === Role.OWNER && <option value="OWNER">Owner</option>}
                    <option value="MANAGER">Store Manager</option>
                    <option value="COUNTER">Counter Staff</option>
                    <option value="DELIVERY">Delivery Rider</option>
                  </select>
                </div>

                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      color: 'var(--text-secondary, #334155)',
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
                      border: '1px solid var(--border, #CBD5E1)',
                      background: 'var(--bg-input, #FFFFFF)',
                      color: 'var(--text-primary, #0F172A)',
                      fontSize: '0.875rem',
                      outline: 'none',
                    }}
                  />
                </div>
              </div>

              {/* Branch Assignment */}
              {currentEmployee?.role === Role.OWNER ? (
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      color: 'var(--text-secondary, #334155)',
                      marginBottom: '4px',
                    }}
                  >
                    Assigned Store / Branch *
                  </label>
                  <select
                    value={formStoreId}
                    onChange={(e) => setFormStoreId(e.target.value)}
                    style={{
                      width: '100%',
                      minHeight: '44px',
                      padding: '0 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border, #CBD5E1)',
                      fontSize: '0.875rem',
                      background: 'var(--bg-input, #FFFFFF)',
                      color: 'var(--text-primary, #0F172A)',
                      outline: 'none',
                    }}
                  >
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} {b.code ? `(${b.code})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    background: 'var(--bg-surface-muted, #F8FAFC)',
                    border: '1px solid var(--border, #E2E8F0)',
                    fontSize: '0.8rem',
                    color: 'var(--text-secondary, #475569)',
                  }}
                >
                  <StoreIcon size={14} color="#7C3AED" />
                  <span>
                    Assigned Store:{' '}
                    <strong>
                      {branches.find((b) => b.id === formStoreId)?.name ||
                        currentEmployee?.storeName ||
                        'Current Store'}
                    </strong>
                  </span>
                </div>
              )}

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

              {/* ─── SECTION 2: ADDITIONAL INFORMATION (OPTIONAL) ─── */}
              <div
                style={{
                  borderTop: '1px solid var(--border, #E2E8F0)',
                  paddingTop: '12px',
                  marginTop: '6px',
                }}
              >
                <button
                  type="button"
                  onClick={() => setShowAdditionalInfo(!showAdditionalInfo)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    padding: '8px 4px',
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    color: '#4F46E5',
                    fontWeight: 700,
                    fontSize: '0.875rem',
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <ShieldCheck size={16} />
                    Additional Information (Optional)
                  </span>
                  {showAdditionalInfo ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>

                {showAdditionalInfo && (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '14px',
                      marginTop: '12px',
                      background: 'var(--bg-surface-inset, #F8FAFC)',
                      padding: '14px',
                      borderRadius: '12px',
                      border: '1px solid var(--border, #E2E8F0)',
                    }}
                  >
                    {/* A. Staff Photograph */}
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
                        Staff Photo (Optional)
                      </label>
                      <input
                        type="file"
                        ref={photoInputRef}
                        accept="image/jpeg,image/png,image/webp,image/heic"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileUpload(file, 'photo');
                        }}
                        style={{ display: 'none' }}
                      />
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {photoUrl ? (
                          <div
                            style={{
                              position: 'relative',
                              width: '56px',
                              height: '56px',
                              borderRadius: '8px',
                              overflow: 'hidden',
                              border: '1px solid #CBD5E1',
                            }}
                          >
                            <img
                              src={
                                photoUrl.startsWith('/')
                                  ? `${API_URL.replace('/api', '')}${photoUrl}`
                                  : photoUrl
                              }
                              alt="Staff Photo Preview"
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                          </div>
                        ) : (
                          <div
                            style={{
                              width: '56px',
                              height: '56px',
                              borderRadius: '8px',
                              background: '#E2E8F0',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <Camera size={20} color="#94A3B8" />
                          </div>
                        )}
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            type="button"
                            onClick={() => photoInputRef.current?.click()}
                            disabled={uploadingDocType === 'photo'}
                            style={{
                              padding: '6px 12px',
                              borderRadius: '6px',
                              border: '1px solid #CBD5E1',
                              background: '#FFFFFF',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              minHeight: '36px',
                            }}
                          >
                            {uploadingDocType === 'photo'
                              ? 'Uploading...'
                              : photoUrl
                                ? 'Replace Photo'
                                : 'Select Photo'}
                          </button>
                          {photoUrl && (
                            <button
                              type="button"
                              onClick={() => setPhotoUrl(null)}
                              style={{
                                padding: '6px 10px',
                                borderRadius: '6px',
                                border: '1px solid #FECACA',
                                background: '#FEF2F2',
                                color: '#DC2626',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                minHeight: '36px',
                              }}
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* B. Passport-Size Photograph */}
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
                        Passport-Size Photo (Optional)
                      </label>
                      <input
                        type="file"
                        ref={passportPhotoInputRef}
                        accept="image/jpeg,image/png,image/webp,image/heic"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileUpload(file, 'passport');
                        }}
                        style={{ display: 'none' }}
                      />
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {passportPhotoUrl ? (
                          <div
                            style={{
                              position: 'relative',
                              width: '56px',
                              height: '56px',
                              borderRadius: '8px',
                              overflow: 'hidden',
                              border: '1px solid #CBD5E1',
                            }}
                          >
                            <img
                              src={
                                passportPhotoUrl.startsWith('/')
                                  ? `${API_URL.replace('/api', '')}${passportPhotoUrl}`
                                  : passportPhotoUrl
                              }
                              alt="Passport Photo Preview"
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                          </div>
                        ) : (
                          <div
                            style={{
                              width: '56px',
                              height: '56px',
                              borderRadius: '8px',
                              background: '#E2E8F0',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <Camera size={20} color="#94A3B8" />
                          </div>
                        )}
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            type="button"
                            onClick={() => passportPhotoInputRef.current?.click()}
                            disabled={uploadingDocType === 'passport'}
                            style={{
                              padding: '6px 12px',
                              borderRadius: '6px',
                              border: '1px solid #CBD5E1',
                              background: '#FFFFFF',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              minHeight: '36px',
                            }}
                          >
                            {uploadingDocType === 'passport'
                              ? 'Uploading...'
                              : passportPhotoUrl
                                ? 'Replace'
                                : 'Upload Passport Photo'}
                          </button>
                          {passportPhotoUrl && (
                            <button
                              type="button"
                              onClick={() => setPassportPhotoUrl(null)}
                              style={{
                                padding: '6px 10px',
                                borderRadius: '6px',
                                border: '1px solid #FECACA',
                                background: '#FEF2F2',
                                color: '#DC2626',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                minHeight: '36px',
                              }}
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* C. Aadhaar Card — Front */}
                    <div>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginBottom: '4px',
                        }}
                      >
                        <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#334155' }}>
                          Aadhaar Card — Front (Optional)
                        </label>
                        <span
                          style={{
                            fontSize: '0.7rem',
                            color: '#1E40AF',
                            background: '#DBEAFE',
                            padding: '1px 6px',
                            borderRadius: '4px',
                          }}
                        >
                          Confidential Identity Document
                        </span>
                      </div>
                      <input
                        type="file"
                        ref={aadhaarFrontInputRef}
                        accept="image/jpeg,image/png,image/webp,application/pdf"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileUpload(file, 'aadhaar-front');
                        }}
                        style={{ display: 'none' }}
                      />
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div
                          style={{
                            width: '56px',
                            height: '40px',
                            borderRadius: '6px',
                            background: aadhaarFrontUrl ? '#DCFCE7' : '#E2E8F0',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <FileText size={18} color={aadhaarFrontUrl ? '#16A34A' : '#94A3B8'} />
                        </div>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <button
                            type="button"
                            onClick={() => aadhaarFrontInputRef.current?.click()}
                            disabled={uploadingDocType === 'aadhaar-front'}
                            style={{
                              padding: '6px 12px',
                              borderRadius: '6px',
                              border: '1px solid #CBD5E1',
                              background: '#FFFFFF',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              minHeight: '36px',
                            }}
                          >
                            {uploadingDocType === 'aadhaar-front'
                              ? 'Uploading...'
                              : aadhaarFrontUrl
                                ? 'Replace File'
                                : 'Upload Aadhaar Front'}
                          </button>
                          {aadhaarFrontUrl && (
                            <button
                              type="button"
                              onClick={() => setAadhaarFrontUrl(null)}
                              style={{
                                padding: '6px 10px',
                                borderRadius: '6px',
                                border: '1px solid #FECACA',
                                background: '#FEF2F2',
                                color: '#DC2626',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                minHeight: '36px',
                              }}
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* D. Aadhaar Card — Back */}
                    <div>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginBottom: '4px',
                        }}
                      >
                        <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#334155' }}>
                          Aadhaar Card — Back (Optional)
                        </label>
                        <span
                          style={{
                            fontSize: '0.7rem',
                            color: '#1E40AF',
                            background: '#DBEAFE',
                            padding: '1px 6px',
                            borderRadius: '4px',
                          }}
                        >
                          Confidential Identity Document
                        </span>
                      </div>
                      <input
                        type="file"
                        ref={aadhaarBackInputRef}
                        accept="image/jpeg,image/png,image/webp,application/pdf"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileUpload(file, 'aadhaar-back');
                        }}
                        style={{ display: 'none' }}
                      />
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div
                          style={{
                            width: '56px',
                            height: '40px',
                            borderRadius: '6px',
                            background: aadhaarBackUrl ? '#DCFCE7' : '#E2E8F0',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <FileText size={18} color={aadhaarBackUrl ? '#16A34A' : '#94A3B8'} />
                        </div>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <button
                            type="button"
                            onClick={() => aadhaarBackInputRef.current?.click()}
                            disabled={uploadingDocType === 'aadhaar-back'}
                            style={{
                              padding: '6px 12px',
                              borderRadius: '6px',
                              border: '1px solid #CBD5E1',
                              background: '#FFFFFF',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              minHeight: '36px',
                            }}
                          >
                            {uploadingDocType === 'aadhaar-back'
                              ? 'Uploading...'
                              : aadhaarBackUrl
                                ? 'Replace File'
                                : 'Upload Aadhaar Back'}
                          </button>
                          {aadhaarBackUrl && (
                            <button
                              type="button"
                              onClick={() => setAadhaarBackUrl(null)}
                              style={{
                                padding: '6px 10px',
                                borderRadius: '6px',
                                border: '1px solid #FECACA',
                                background: '#FEF2F2',
                                color: '#DC2626',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                minHeight: '36px',
                              }}
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* E. Current Residential Address */}
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
                        Current Residential Address (Optional)
                      </label>
                      <textarea
                        rows={2}
                        placeholder="House / Flat No., Street, Area, City, State, PIN code"
                        value={currentAddress}
                        onChange={(e) => handleCurrentAddressChange(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          borderRadius: '8px',
                          border: '1px solid var(--border, #CBD5E1)',
                          background: 'var(--bg-input, #FFFFFF)',
                          color: 'var(--text-primary, #0F172A)',
                          fontSize: '0.85rem',
                          outline: 'none',
                          resize: 'vertical',
                        }}
                      />
                    </div>

                    {/* F. Permanent Address */}
                    <div>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          marginBottom: '6px',
                        }}
                      >
                        <input
                          type="checkbox"
                          id="same-address-check"
                          checked={sameAsCurrentAddress}
                          onChange={(e) => handleSameAddressToggle(e.target.checked)}
                          style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                        />
                        <label
                          htmlFor="same-address-check"
                          style={{
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            color: '#334155',
                            cursor: 'pointer',
                          }}
                        >
                          Permanent address is the same as current address
                        </label>
                      </div>

                      <textarea
                        rows={2}
                        disabled={sameAsCurrentAddress}
                        placeholder="Permanent residential address..."
                        value={sameAsCurrentAddress ? currentAddress : permanentAddress}
                        onChange={(e) => setPermanentAddress(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          borderRadius: '8px',
                          border: '1px solid var(--border, #CBD5E1)',
                          background: sameAsCurrentAddress ? '#F1F5F9' : 'var(--bg-input, #FFFFFF)',
                          color: 'var(--text-primary, #0F172A)',
                          fontSize: '0.85rem',
                          outline: 'none',
                          resize: 'vertical',
                          opacity: sameAsCurrentAddress ? 0.7 : 1,
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Buttons */}
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
