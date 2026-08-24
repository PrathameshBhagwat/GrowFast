import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { NumericKeypadInput, Card } from '@growfast/ui';
import { Shirt, ChevronDown } from 'lucide-react';

const EMPLOYEES = [
  { id: 'emp-owner-001', name: 'Prathamesh Bhagwat', role: 'OWNER', initials: 'PB' },
  { id: 'emp-mgr-001', name: 'Rajesh Nair', role: 'MANAGER', initials: 'RN' },
  { id: 'emp-counter-001', name: 'Swapnil Shinde', role: 'COUNTER', initials: 'SS' },
  { id: 'emp-delivery-001', name: 'Kiran More', role: 'DELIVERY', initials: 'KM' },
];

export const LoginPage: React.FC = () => {
  const { login, error } = useAuth();
  const navigate = useNavigate();
  const [selectedEmployee, setSelectedEmployee] = useState(EMPLOYEES[0]!);
  const [pin, setPin] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  const handleLogin = async () => {
    if (pin.length !== 6) return;
    setIsLoggingIn(true);
    try {
      await login(selectedEmployee.id, pin);
      navigate('/', { replace: true });
    } catch {
      setPin('');
    } finally {
      setIsLoggingIn(false);
    }
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
      <Card padding="lg" elevated style={{ maxWidth: '400px', width: '100%' }}>
        {/* Logo & Title */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '16px',
              background: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)',
            }}
          >
            <Shirt size={28} color="#FFFFFF" />
          </div>
          <h1 style={{ fontSize: '1.375rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
            GrowFast Laundry
          </h1>
          <p style={{ fontSize: '0.84rem', color: '#64748B', marginTop: '4px' }}>
            Enter your PIN to continue
          </p>
        </div>

        {/* Employee Selector */}
        <div style={{ marginBottom: '28px', position: 'relative' }}>
          <button
            onClick={() => setShowPicker(!showPicker)}
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
        {error && (
          <div
            style={{
              padding: '10px 14px',
              background: '#FEF2F2',
              border: '1px solid #FECACA',
              borderRadius: '8px',
              color: '#991B1B',
              fontSize: '0.84rem',
              fontWeight: 500,
              marginBottom: '20px',
              textAlign: 'center',
            }}
          >
            {error}
          </div>
        )}

        {/* PIN Keypad */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <NumericKeypadInput
            value={pin}
            onChange={setPin}
            maxLength={6}
            masked
            onSubmit={handleLogin}
          />
        </div>

        {isLoggingIn && (
          <p
            style={{
              textAlign: 'center',
              fontSize: '0.84rem',
              color: '#2563EB',
              marginTop: '16px',
              fontWeight: 500,
            }}
          >
            Authenticating...
          </p>
        )}

        {/* Dev hint */}
        <div
          style={{
            marginTop: '24px',
            padding: '12px',
            background: '#FFFBEB',
            border: '1px solid #FDE68A',
            borderRadius: '8px',
            fontSize: '0.7rem',
            color: '#92400E',
            textAlign: 'center',
          }}
        >
          <strong>Dev Mode:</strong> Owner=111111 · Manager=222222 · Counter=333333 ·
          Delivery=444444
        </div>
      </Card>
    </div>
  );
};
