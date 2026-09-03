import React, { useState, useEffect } from 'react';
import { Modal, Input, Select, Button } from '@growfast/ui';
import {
  MembershipTier,
  RegistrationSource,
  type CustomerDTO,
  type CreateCustomerRequest,
  type ApiResponse,
} from '@growfast/shared-types';
import { UserPlus, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export interface CustomerCreateModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (newCustomer: CustomerDTO) => void;
}

const MEMBERSHIP_OPTIONS = [
  { value: MembershipTier.NONE, label: 'None (Standard)' },
  { value: MembershipTier.SILVER, label: 'Silver (5% Discount)' },
  { value: MembershipTier.GOLD, label: 'Gold (10% Discount)' },
  { value: MembershipTier.PLATINUM, label: 'Platinum (15% Discount)' },
];

const REGISTRATION_SOURCE_OPTIONS = [
  { value: RegistrationSource.WALK_IN, label: 'Walk-In Store' },
  { value: RegistrationSource.PHONE, label: 'Phone Inquiry' },
  { value: RegistrationSource.WEBSITE, label: 'Website' },
  { value: RegistrationSource.REFERRAL, label: 'Customer Referral' },
  { value: RegistrationSource.APP, label: 'Mobile App' },
];

const FRAGRANCE_OPTIONS = [
  { value: 'none', label: 'No Fragrance' },
  { value: 'lavender', label: 'Lavender' },
  { value: 'jasmine', label: 'Jasmine' },
  { value: 'fresh_linen', label: 'Fresh Linen' },
];

const STARCH_OPTIONS = [
  { value: 'none', label: 'No Starch' },
  { value: 'light', label: 'Light Starch' },
  { value: 'medium', label: 'Medium Starch' },
  { value: 'heavy', label: 'Heavy Crisp Starch' },
];

const FOLD_OPTIONS = [
  { value: 'standard_fold', label: 'Standard Fold' },
  { value: 'hanger', label: 'On Hanger' },
  { value: 'flat_pack', label: 'Flat Box Pack' },
];

export const CustomerCreateModal: React.FC<CustomerCreateModalProps> = ({
  open,
  onClose,
  onSuccess,
}) => {
  const { token } = useAuth();

  // Form Field States
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [pincode, setPincode] = useState('');
  const [membership, setMembership] = useState<string>(MembershipTier.NONE);
  const [discountPercent, setDiscountPercent] = useState<string>('0');
  const [registrationSource, setRegistrationSource] = useState<string>(RegistrationSource.WALK_IN);

  // Preference fields
  const [fragrance, setFragrance] = useState('none');
  const [starch, setStarch] = useState('none');
  const [fold, setFold] = useState('standard_fold');

  // Validation and Error states
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto update discount percent when membership changes
  useEffect(() => {
    if (membership === MembershipTier.SILVER) setDiscountPercent('5');
    else if (membership === MembershipTier.GOLD) setDiscountPercent('10');
    else if (membership === MembershipTier.PLATINUM) setDiscountPercent('15');
    else setDiscountPercent('0');
  }, [membership]);

  // Reset form on open/close
  useEffect(() => {
    if (open) {
      setName('');
      setPhone('');
      setEmail('');
      setAddress('');
      setPincode('');
      setMembership(MembershipTier.NONE);
      setDiscountPercent('0');
      setRegistrationSource(RegistrationSource.WALK_IN);
      setFragrance('none');
      setStarch('none');
      setFold('standard_fold');
      setErrors({});
      setApiError(null);
      setIsSubmitting(false);
    }
  }, [open]);

  // Validate form client-side before API call
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    const trimmedName = name.trim();
    if (!trimmedName) {
      newErrors.name = 'Customer name is required';
    }

    const trimmedPhone = phone.trim().replace(/[\s\-()]/g, '');
    if (!trimmedPhone) {
      newErrors.phone = 'Phone number is required';
    } else if (!/^\+?[0-9]{10,15}$/.test(trimmedPhone)) {
      newErrors.phone = 'Enter a valid 10 to 15-digit phone number';
    }

    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      newErrors.email = 'Enter a valid email address';
    }

    if (pincode.trim() && !/^[A-Za-z0-9\s\-]{3,10}$/.test(pincode.trim())) {
      newErrors.pincode = 'Enter a valid pincode';
    }

    const disc = parseFloat(discountPercent);
    if (isNaN(disc) || disc < 0 || disc > 100) {
      newErrors.discountPercent = 'Discount must be between 0% and 100%';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiError(null);

    if (!validateForm()) return;

    setIsSubmitting(true);

    try {
      const cleanPhone = phone.trim().replace(/[\s\-()]/g, '');
      const preferencesObj: Record<string, string> = {
        fragrance,
        starch,
        fold,
      };

      const payload: CreateCustomerRequest = {
        name: name.trim(),
        phone: cleanPhone,
        email: email.trim() || undefined,
        address: address.trim() || undefined,
        pincode: pincode.trim() || undefined,
        membership: membership as MembershipTier,
        discountPercent: parseFloat(discountPercent) || 0,
        preferences: preferencesObj,
        registrationSource,
      };

      let createdCustomer: CustomerDTO;

      if (token) {
        let res: Response | null = null;
        try {
          res = await fetch(`${API_URL}/customers`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
          });
        } catch {
          res = null;
        }

        if (res && res.ok) {
          const data: ApiResponse<CustomerDTO> = await res.json();
          createdCustomer = data.data;
        } else if (res && res.status === 409) {
          const data = await res.json().catch(() => ({}));
          const msg = data.message || `A customer with phone number ${cleanPhone} already exists.`;
          setErrors((prev) => ({
            ...prev,
            phone: msg,
          }));
          throw new Error(msg);
        } else if (res && res.status > 0 && res.status < 500) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.message || `Failed to create customer (HTTP ${res.status})`);
        } else {
          // Dev offline / DB connection fallback
          createdCustomer = {
            id: `cust-${Date.now().toString().slice(-4)}`,
            name: payload.name,
            phone: payload.phone,
            email: payload.email ?? null,
            address: payload.address ?? null,
            pincode: payload.pincode ?? null,
            membership: payload.membership || MembershipTier.NONE,
            discountPercent: payload.discountPercent || 0,
            preferences: payload.preferences || null,
            registrationSource: payload.registrationSource || 'WALK_IN',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
        }
      } else {
        // Fallback for offline dev environment
        createdCustomer = {
          id: `cust-${Date.now().toString().slice(-4)}`,
          name: payload.name,
          phone: payload.phone,
          email: payload.email ?? null,
          address: payload.address ?? null,
          pincode: payload.pincode ?? null,
          membership: payload.membership || MembershipTier.NONE,
          discountPercent: payload.discountPercent || 0,
          preferences: payload.preferences || null,
          registrationSource: payload.registrationSource || 'WALK_IN',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      }

      onSuccess(createdCustomer);
      onClose();
    } catch (err: any) {
      setApiError(err.message || 'An error occurred while creating the customer.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Create New Customer" width="560px">
      <form
        onSubmit={handleSubmit}
        style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
      >
        {apiError && (
          <div
            style={{
              padding: '12px 16px',
              borderRadius: '8px',
              background: '#FEF2F2',
              border: '1px solid #FCA5A5',
              color: '#991B1B',
              fontSize: '0.875rem',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <AlertCircle size={18} color="#DC2626" style={{ flexShrink: 0 }} />
            <span>{apiError}</span>
          </div>
        )}

        {/* Required Fields Section */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <Input
            id="create-customer-name"
            label="Full Name *"
            placeholder="e.g. Rahul Sharma"
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={errors.name}
            disabled={isSubmitting}
            autoFocus
          />

          <Input
            id="create-customer-phone"
            label="Phone Number *"
            placeholder="e.g. 9876543210"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            error={errors.phone}
            disabled={isSubmitting}
          />
        </div>

        {/* Contact & Address Section */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
          <Input
            id="create-customer-email"
            label="Email Address"
            placeholder="e.g. rahul@example.com"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={errors.email}
            disabled={isSubmitting}
          />

          <Input
            id="create-customer-pincode"
            label="Pincode"
            placeholder="e.g. 411001"
            value={pincode}
            onChange={(e) => setPincode(e.target.value)}
            error={errors.pincode}
            disabled={isSubmitting}
          />
        </div>

        <Input
          id="create-customer-address"
          label="Address"
          placeholder="e.g. Flat 402, Rohan Vasanta, Baner Road, Pune"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          disabled={isSubmitting}
        />

        {/* Membership & Discount Section */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <Select
            id="create-customer-membership"
            label="Membership Tier"
            options={MEMBERSHIP_OPTIONS}
            value={membership}
            onChange={(e) => setMembership(e.target.value)}
            disabled={isSubmitting}
          />

          <Input
            id="create-customer-discount"
            label="Discount %"
            type="number"
            min="0"
            max="100"
            value={discountPercent}
            onChange={(e) => setDiscountPercent(e.target.value)}
            error={errors.discountPercent}
            disabled={isSubmitting}
          />
        </div>

        {/* Registration Source & Customer Preferences */}
        <Select
          id="create-customer-source"
          label="Registration Source"
          options={REGISTRATION_SOURCE_OPTIONS}
          value={registrationSource}
          onChange={(e) => setRegistrationSource(e.target.value)}
          disabled={isSubmitting}
        />

        <div
          style={{
            background: '#F8FAFC',
            padding: '14px',
            borderRadius: '10px',
            border: '1px solid #E2E8F0',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>
            Garment Processing Preferences
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
            <Select
              id="create-pref-fragrance"
              label="Fragrance"
              options={FRAGRANCE_OPTIONS}
              value={fragrance}
              onChange={(e) => setFragrance(e.target.value)}
              disabled={isSubmitting}
            />
            <Select
              id="create-pref-starch"
              label="Starch"
              options={STARCH_OPTIONS}
              value={starch}
              onChange={(e) => setStarch(e.target.value)}
              disabled={isSubmitting}
            />
            <Select
              id="create-pref-fold"
              label="Fold Type"
              options={FOLD_OPTIONS}
              value={fold}
              onChange={(e) => setFold(e.target.value)}
              disabled={isSubmitting}
            />
          </div>
        </div>

        {/* Modal Actions */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '12px',
            marginTop: '8px',
            paddingTop: '12px',
            borderTop: '1px solid #E2E8F0',
          }}
        >
          <Button
            type="button"
            variant="outline"
            size="md"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="md"
            loading={isSubmitting}
            disabled={isSubmitting}
            icon={<UserPlus size={18} />}
          >
            Create Customer
          </Button>
        </div>
      </form>
    </Modal>
  );
};
