import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { NumericKeypadInput, Card } from '@growfast/ui';
import { Shirt, ChevronDown, Zap } from 'lucide-react';

const EMPLOYEES = [
  { id: 'emp-owner-001', name: 'Prathamesh Bhagwat', role: 'OWNER', initials: 'PB', pin: '111111' },
  { id: 'emp-mgr-001', name: 'Rajesh Nair', role: 'MANAGER', initials: 'RN', pin: '222222' },
  { id: 'emp-counter-001', name: 'Swapnil Shinde', role: 'COUNTER', initials: 'SS', pin: '333333' },
  { id: 'emp-delivery-001', name: 'Kiran More', role: 'DELIVERY', initials: 'KM', pin: '444444' },
];

export const LoginPage: React.FC = () => {
  const { login, error } = useAuth();
  const navigate = useNavigate();
  const [selectedEmployee, setSelectedEmployee] = useState(EMPLOYEES[0]!);
  const [pin, setPin] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);
  const [shake, setShake] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);

  // Lockout timer effect
  useEffect(() => {
    if (!lockoutUntil) return;
    const interval = setInterval(() => {
      const remaining = Math.ceil((lockoutUntil - Date.now()) / 1000);
      if (remaining <= 0) {
        setLockoutUntil(null);
        setFailedAttempts(0);
        setTimeLeft(0);
        clearInterval(interval);
      } else {
        setTimeLeft(remaining);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutUntil]);

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 400);
  };

  const handleLogin = async (overrideEmpId?: string, overridePin?: string) => {
    const empId = overrideEmpId || selectedEmployee.id;
    const pinToUse = overridePin || pin;
    if (pinToUse.length !== 6 || lockoutUntil) return;

    setIsLoggingIn(true);
    try {
      await login(empId, pinToUse);
      // Reset attempts on success
      setFailedAttempts(0);
      navigate('/', { replace: true });
    } catch {
      setPin('');
      triggerShake();
      const attempts = failedAttempts + 1;
      setFailedAttempts(attempts);
      if (attempts >= 5) {
        setLockoutUntil(Date.now() + 60000); // 60 seconds lockout
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleQuickLogin = async (emp: (typeof EMPLOYEES)[0]) => {
    setSelectedEmployee(emp);
    setPin(emp.pin);
    await handleLogin(emp.id, emp.pin);
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 50%, #0F172A 100%)',
        padding: '24px',
        fontFamily: "'Inter', sans-serif",
      }}
    >
      <div style={{ animation: shake ? 'shake 0.4s ease-in-out' : 'none' }}>
        <Card padding="lg" elevated style={{ maxWidth: '420px', width: '100%' }}>
          {/* Logo & Title */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '16px',
              background: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 14px',
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)',
            }}
          >
            <Shirt size={28} color="#FFFFFF" />
          </div>
          <h1 style={{ fontSize: '1.375rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
            GrowFast Laundry
          </h1>
          <p style={{ fontSize: '0.84rem', color: '#64748B', marginTop: '4px' }}>
            Select your profile and enter PIN
          </p>
        </div>

        {/* Employee Selector */}
        <div style={{ marginBottom: '20px', position: 'relative' }}>
          <button
            onClick={() => setShowPicker(!showPicker)}
            aria-label="Select Employee"
            style={{
              width: '100%',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              border: '1px solid #E2E8F0',
              borderRadius: '12px',
              background: '#F8FAFC',
              cursor: 'pointer',
              fontFamily: "'Inter', sans-serif",
            }}
          >
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #2563EB 0%, #7C3AED 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#FFFFFF',
                fontSize: '0.8rem',
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {selectedEmployee.initials}
            </div>
            <div style={{ flex: 1, textAlign: 'left' }}>
              <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#0F172A' }}>
                {selectedEmployee.name}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748B' }}>{selectedEmployee.role}</div>
            </div>
            <ChevronDown size={18} color="#94A3B8" />
          </button>

          {showPicker && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                marginTop: '4px',
                background: '#FFFFFF',
                borderRadius: '12px',
                border: '1px solid #E2E8F0',
                boxShadow: '0 10px 15px -3px rgba(15, 23, 42, 0.08)',
                zIndex: 10,
                overflow: 'hidden',
              }}
            >
              {EMPLOYEES.map((emp) => (
                <button
                  key={emp.id}
                  onClick={() => {
                    setSelectedEmployee(emp);
                    setShowPicker(false);
                    setPin('');
                  }}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    border: 'none',
                    background: emp.id === selectedEmployee.id ? '#EFF6FF' : 'transparent',
                    cursor: 'pointer',
                    fontFamily: "'Inter', sans-serif",
                    borderBottom: '1px solid #F1F5F9',
                  }}
                >
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      background:
                        emp.id === selectedEmployee.id
                          ? 'linear-gradient(135deg, #2563EB 0%, #7C3AED 100%)'
                          : '#E2E8F0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: emp.id === selectedEmployee.id ? '#FFFFFF' : '#64748B',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                    }}
                  >
                    {emp.initials}
                  </div>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: '0.84rem', fontWeight: 600, color: '#0F172A' }}>
                      {emp.name}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#64748B' }}>{emp.role}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Error message */}
        {error && !lockoutUntil && (
          <div
            style={{
              padding: '10px 14px',
              background: '#FEF2F2',
              border: '1px solid #FECACA',
              borderRadius: '8px',
              color: '#991B1B',
              fontSize: '0.84rem',
              fontWeight: 500,
              marginBottom: '16px',
              textAlign: 'center',
            }}
          >
            {error} (Attempt {failedAttempts}/5)
          </div>
        )}

        {lockoutUntil && (
          <div
            style={{
              padding: '10px 14px',
              background: '#FEF2F2',
              border: '1px solid #FECACA',
              borderRadius: '8px',
              color: '#991B1B',
              fontSize: '0.84rem',
              fontWeight: 600,
              marginBottom: '16px',
              textAlign: 'center',
            }}
          >
            Too many failed attempts. Try again in {timeLeft}s.
          </div>
        )}

        {/* PIN Keypad */}
        <div style={{ display: 'flex', justifyContent: 'center', opacity: lockoutUntil ? 0.5 : 1, pointerEvents: lockoutUntil ? 'none' : 'auto' }}>
          <NumericKeypadInput
            value={pin}
            onChange={setPin}
            maxLength={6}
            masked
            onSubmit={() => handleLogin()}
          />
        </div>

        {isLoggingIn && (
          <p
            style={{
              textAlign: 'center',
              fontSize: '0.84rem',
              color: '#2563EB',
              marginTop: '12px',
              fontWeight: 500,
            }}
          >
            Authenticating...
          </p>
        )}

        {/* Dev Mode 1-Click Quick Login */}
        <div
          style={{
            marginTop: '20px',
            padding: '12px',
            background: '#F8FAFC',
            border: '1px solid #E2E8F0',
            borderRadius: '12px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.75rem',
              fontWeight: 700,
              color: '#475569',
              marginBottom: '8px',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            <Zap size={14} color="#D97706" />
            <span>Dev Quick Login</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
            {EMPLOYEES.map((emp) => (
              <button
                key={emp.id}
                type="button"
                onClick={() => handleQuickLogin(emp)}
                style={{
                  padding: '8px 10px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  background: '#FFFFFF',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: '#0F172A',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  transition: 'all 120ms ease',
                }}
              >
                <span>{emp.role}</span>
                <span style={{ color: '#64748B', fontFamily: 'monospace', fontSize: '0.7rem' }}>
                  {emp.pin}
                </span>
              </button>
            ))}
          </div>
        </div>
      </Card>
      </div>
    </div>
  );
};
