import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { NumericKeypadInput, Card } from '@growfast/ui';
import { Shirt } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { login, error } = useAuth();
  const navigate = useNavigate();
  const [employeeId, setEmployeeId] = useState('');
  const [pin, setPin] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);
  const [shake, setShake] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);

  const [directory, setDirectory] = useState<{ id: string; name: string; role: string }[]>([]);
  const [isFetchingDirectory, setIsFetchingDirectory] = useState(true);

  // Fetch directory on mount
  useEffect(() => {
    const fetchDirectory = async () => {
      try {
        const API_URL = import.meta.env.VITE_API_URL || '/api';
        const res = await fetch(`${API_URL}/auth/directory`);
        if (res.ok) {
          const body = await res.json();
          setDirectory(body.data || []);
        }
      } catch (err) {
        console.error('Failed to fetch employee directory', err);
      } finally {
        setIsFetchingDirectory(false);
      }
    };
    fetchDirectory();
  }, []);

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

  const handleLogin = async () => {
    if (!employeeId.trim() || pin.length !== 6 || lockoutUntil) return;

    setIsLoggingIn(true);
    try {
      await login(employeeId.trim(), pin);
      setFailedAttempts(0);
      navigate('/', { replace: true });
    } catch {
      setPin('');
      triggerShake();
      const attempts = failedAttempts + 1;
      setFailedAttempts(attempts);
      if (attempts >= 5) {
        setLockoutUntil(Date.now() + 60000);
      }
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
              Select your name and enter your PIN to sign in
            </p>
          </div>

          {/* Employee Dropdown */}
          <div style={{ marginBottom: '20px' }}>
            <label
              htmlFor="employee-select"
              style={{
                display: 'block',
                fontSize: '0.8rem',
                fontWeight: 600,
                color: '#334155',
                marginBottom: '6px',
              }}
            >
              Employee Name
            </label>
            {isFetchingDirectory ? (
              <div
                style={{
                  width: '100%',
                  minHeight: '48px',
                  padding: '0 14px',
                  borderRadius: '10px',
                  border: '1px solid #CBD5E1',
                  background: '#F1F5F9',
                  display: 'flex',
                  alignItems: 'center',
                  fontSize: '0.9rem',
                  color: '#64748B',
                }}
              >
                Loading staff directory...
              </div>
            ) : (
              <select
                id="employee-select"
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                disabled={!!lockoutUntil}
                style={{
                  width: '100%',
                  minHeight: '48px',
                  padding: '0 14px',
                  borderRadius: '10px',
                  border: '1px solid #CBD5E1',
                  fontSize: '0.9rem',
                  fontFamily: "'Inter', sans-serif",
                  outline: 'none',
                  background: lockoutUntil ? '#F1F5F9' : '#FFFFFF',
                  color: employeeId ? '#0F172A' : '#64748B',
                  cursor: lockoutUntil ? 'not-allowed' : 'pointer',
                  appearance: 'none',
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 14px center',
                }}
              >
                <option value="" disabled>
                  -- Select your name --
                </option>
                {directory.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} ({emp.role})
                  </option>
                ))}
              </select>
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

          {/* PIN Label */}
          <div style={{ marginBottom: '8px' }}>
            <label
              style={{
                display: 'block',
                fontSize: '0.8rem',
                fontWeight: 600,
                color: '#334155',
              }}
            >
              Security PIN
            </label>
          </div>

          {/* PIN Keypad */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              opacity: lockoutUntil ? 0.5 : 1,
              pointerEvents: lockoutUntil ? 'none' : 'auto',
            }}
          >
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
        </Card>
      </div>
    </div>
  );
};
