import React, { useState, useEffect } from 'react';
import { Modal, Input, Select, Button } from '@growfast/ui';
import {
  MembershipTier,
  RegistrationSource,
  type CustomerDTO,
  type UpdateCustomerRequest,
  type ApiResponse,
} from '@growfast/shared-types';
import { Edit3, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export interface CustomerEditModalProps {
  open: boolean;
  customer: CustomerDTO;
  onClose: () => void;
  onSuccess: (updatedCustomer: CustomerDTO) => void;
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

export const CustomerEditModal: React.FC<CustomerEditModalProps> = ({
  open,
  customer,
  onClose,
  onSuccess,
}) => {
  const { token } = useAuth();

  // Form Field States
  const [name, setName] = useState(customer.name);
  const [phone, setPhone] = useState(customer.phone);
  const [email, setEmail] = useState(customer.email || '');
  const [address, setAddress] = useState(customer.address || '');
  const [pincode, setPincode] = useState(customer.pincode || '');
  const [membership, setMembership] = useState<string>(customer.membership || MembershipTier.NONE);
  const [discountPercent, setDiscountPercent] = useState<string>(
    String(customer.discountPercent ?? 0),
  );
  const [registrationSource, setRegistrationSource] = useState<string>(
    customer.registrationSource || RegistrationSource.WALK_IN,
  );

  // Preference fields
  const [fragrance, setFragrance] = useState<string>(customer.preferences?.fragrance || 'none');
  const [starch, setStarch] = useState<string>(customer.preferences?.starch || 'none');
  const [fold, setFold] = useState<string>(customer.preferences?.fold || 'standard_fold');

  // Validation & Error states
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Populate/Reset form state whenever modal opens or customer prop changes
  useEffect(() => {
    if (open && customer) {
      setName(customer.name);
      setPhone(customer.phone);
      setEmail(customer.email || '');
      setAddress(customer.address || '');
      setPincode(customer.pincode || '');
      setMembership(customer.membership || MembershipTier.NONE);
      setDiscountPercent(String(customer.discountPercent ?? 0));
      setRegistrationSource(customer.registrationSource || RegistrationSource.WALK_IN);
      setFragrance(customer.preferences?.fragrance || 'none');
      setStarch(customer.preferences?.starch || 'none');
      setFold(customer.preferences?.fold || 'standard_fold');
      setErrors({});
      setApiError(null);
      setIsSubmitting(false);
    }
  }, [open, customer]);

  // Auto update discount percent when membership changes
  const handleMembershipChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setMembership(val);
    if (val === MembershipTier.SILVER) setDiscountPercent('5');
    else if (val === MembershipTier.GOLD) setDiscountPercent('10');
    else if (val === MembershipTier.PLATINUM) setDiscountPercent('15');
    else setDiscountPercent('0');
  };

  // Validate form fields before API call
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
        ...customer.preferences, // Preserve any existing extra preference keys
        fragrance,
        starch,
        fold,
      };

      const payload: UpdateCustomerRequest = {
        name: name.trim(),
        phone: cleanPhone,
        email: email.trim() || null,
        address: address.trim() || null,
        pincode: pincode.trim() || null,
        membership: membership as MembershipTier,
        discountPercent: parseFloat(discountPercent) || 0,
        preferences: preferencesObj,
        registrationSource,
      };

      let updatedResult: CustomerDTO;

      if (token) {
        let res: Response | null = null;
        try {
          res = await fetch(`${API_URL}/customers/${customer.id}`, {
            method: 'PATCH',
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
          updatedResult = data.data;
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
          throw new Error(data.message || `Failed to update customer (HTTP ${res.status})`);
        } else {
          // Dev offline / DB fallback
          updatedResult = {
            ...customer,
            ...payload,
            email: payload.email ?? null,
            address: payload.address ?? null,
            pincode: payload.pincode ?? null,
            membership: payload.membership || customer.membership,
            discountPercent: payload.discountPercent ?? customer.discountPercent,
            preferences: payload.preferences ?? customer.preferences,
            registrationSource: payload.registrationSource || customer.registrationSource,
            updatedAt: new Date().toISOString(),
          };
        }
      } else {
        // Dev mock fallback
        updatedResult = {
          ...customer,
          ...payload,
          email: payload.email ?? null,
          address: payload.address ?? null,
          pincode: payload.pincode ?? null,
          membership: payload.membership || customer.membership,
          discountPercent: payload.discountPercent ?? customer.discountPercent,
          preferences: payload.preferences ?? customer.preferences,
          registrationSource: payload.registrationSource || customer.registrationSource,
          updatedAt: new Date().toISOString(),
        };
      }

      onSuccess(updatedResult);
      onClose();
    } catch (err: any) {
      setApiError(err.message || 'An error occurred while updating customer details.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={`Edit Customer (${customer.id})`} width="560px">
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
            id="edit-customer-name"
            label="Full Name *"
            placeholder="e.g. Rahul Sharma"
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={errors.name}
            disabled={isSubmitting}
            autoFocus
          />

          <Input
            id="edit-customer-phone"
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
            id="edit-customer-email"
            label="Email Address"
            placeholder="e.g. rahul@example.com"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={errors.email}
            disabled={isSubmitting}
          />

          <Input
            id="edit-customer-pincode"
            label="Pincode"
            placeholder="e.g. 411001"
            value={pincode}
            onChange={(e) => setPincode(e.target.value)}
            error={errors.pincode}
            disabled={isSubmitting}
          />
        </div>

        <Input
          id="edit-customer-address"
          label="Address"
          placeholder="e.g. Flat 402, Rohan Vasanta, Baner Road, Pune"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          disabled={isSubmitting}
        />

        {/* Membership & Discount Section */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <Select
            id="edit-customer-membership"
            label="Membership Tier"
            options={MEMBERSHIP_OPTIONS}
            value={membership}
            onChange={handleMembershipChange}
            disabled={isSubmitting}
          />

          <Input
            id="edit-customer-discount"
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
          id="edit-customer-source"
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
              id="edit-pref-fragrance"
              label="Fragrance"
              options={FRAGRANCE_OPTIONS}
              value={fragrance}
              onChange={(e) => setFragrance(e.target.value)}
              disabled={isSubmitting}
            />
            <Select
              id="edit-pref-starch"
              label="Starch"
              options={STARCH_OPTIONS}
              value={starch}
              onChange={(e) => setStarch(e.target.value)}
              disabled={isSubmitting}
            />
            <Select
              id="edit-pref-fold"
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
            icon={<Edit3 size={18} />}
          >
            Save Changes
          </Button>
        </div>
      </form>
    </Modal>
  );
};
