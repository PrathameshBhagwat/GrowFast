import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Eye, EyeOff, User, Lock, ArrowRight, Check } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { login, error } = useAuth();
  const navigate = useNavigate();
  const [employeeId, setEmployeeId] = useState('');
  const [pin, setPin] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);

  // UI-only states
  const [showPassword, setShowPassword] = useState(false);
  const [isFocusedEmp, setIsFocusedEmp] = useState(false);
  const [isFocusedPin, setIsFocusedPin] = useState(false);

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

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!employeeId.trim() || pin.length < 4 || lockoutUntil) return;

    setIsLoggingIn(true);
    try {
      await login(employeeId.trim(), pin);
      setFailedAttempts(0);
      navigate('/', { replace: true });
    } catch {
      setPin('');
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
    <div className="min-h-screen bg-slate-50/80 flex items-center justify-center relative overflow-hidden font-sans selection:bg-blue-100 selection:text-blue-900">
      {/* ── Background Decorative Elements ── */}
      {/* Top Left Shape */}
      <div className="absolute -top-40 -left-40 w-[600px] h-[600px] bg-blue-100/60 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-0 left-0 w-[40vw] h-[40vh] pointer-events-none opacity-20">
        <svg viewBox="0 0 400 400" className="w-full h-full text-blue-300" fill="currentColor">
          <path d="M0 0 L 400 0 C 200 0 0 200 0 400 Z" />
        </svg>
      </div>

      {/* Bottom Right Shape */}
      <div className="absolute -bottom-60 -right-40 w-[800px] h-[800px] bg-blue-50/80 rounded-full blur-2xl pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[50vw] h-[50vh] pointer-events-none opacity-20">
        <svg
          viewBox="0 0 400 400"
          className="w-full h-full text-blue-300"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
        >
          <circle cx="400" cy="400" r="300" />
          <circle cx="400" cy="400" r="350" />
          <circle cx="400" cy="400" r="250" />
        </svg>
      </div>

      {/* ── Creative Laundry & Employee Floating Illustrations ── */}
      {/* Hanging Shirt - Top Right */}
      <div className="absolute top-24 right-10 md:right-32 text-blue-500/20 pointer-events-none rotate-12 transform scale-150">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="64"
          height="64"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M20.38 3.46L16 2a4 4 0 01-8 0L3.62 3.46a2 2 0 00-1.34 2.23l.58 3.47a1 1 0 00.99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 002-2V10h2.15a1 1 0 00.99-.84l.58-3.47a2 2 0 00-1.34-2.23z" />
        </svg>
      </div>

      {/* Washing Machine - Bottom Left */}
      <div className="absolute bottom-32 left-10 md:left-32 text-blue-500/20 pointer-events-none -rotate-6 transform scale-150">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="64"
          height="64"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <path d="M3 9h18" />
          <path d="M9 6h.01" />
          <path d="M13 6h.01" />
          <circle cx="12" cy="15" r="4" />
          <path d="M12 15h.01" />
        </svg>
      </div>

      {/* Hanger - Top Left Center */}
      <div className="absolute top-32 left-1/4 text-blue-500/15 pointer-events-none -rotate-12 transform scale-125">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 7a2 2 0 01-2-2 2 2 0 114 0" />
          <path d="M4 19l8-10 8 10" />
          <path d="M4 19h16" />
        </svg>
      </div>

      {/* Shop / Storefront - Center Right */}
      <div className="absolute top-1/2 right-1/4 text-blue-500/10 pointer-events-none rotate-6 transform scale-[2] -translate-y-1/2">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
          <polyline points="9 22 9 12 15 12 15 22"></polyline>
        </svg>
      </div>

      {/* Tag/Receipt - Bottom Right */}
      <div className="absolute bottom-20 right-1/3 text-blue-500/15 pointer-events-none rotate-12 transform scale-[1.5]">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1-2-1Z" />
          <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" />
          <path d="M12 17V7" />
        </svg>
      </div>

      {/* ── Top Right Pill ── */}
      <div className="absolute top-6 right-6 hidden sm:flex items-center gap-2 px-3 py-1.5 bg-slate-100/80 backdrop-blur-sm border border-slate-200/60 rounded-full">
        <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
        <span className="text-xs font-medium text-slate-500">Employee Login</span>
      </div>

      {/* ── Bottom Left Branding ── */}
      <div className="absolute bottom-10 left-10 hidden lg:flex items-center gap-4 pointer-events-none">
        <div className="w-0.5 h-12 bg-blue-500 rounded-full" />
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-slate-600">Clean spaces.</span>
          <span className="text-sm font-semibold text-slate-500">Happier people.</span>
        </div>
      </div>

      {/* ── Bottom Right Branding ── */}
      <div className="absolute bottom-10 right-12 hidden lg:flex items-center gap-3 pointer-events-none">
        <div className="flex flex-col text-right">
          <span className="text-sm font-semibold text-slate-500">Better</span>
          <span className="text-sm font-semibold text-slate-500">Faster</span>
          <span className="text-sm font-semibold text-slate-600">Cleaner</span>
        </div>
        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="opacity-90"
          >
            <path d="M12 22C12 22 2.5 16 2.5 7.5C2.5 3.35786 5.85786 0 10 0C11.5173 0 12.9298 0.450379 14.1166 1.22238C13.4116 2.14667 13 3.27581 13 4.5C13 8.64214 16.3579 12 20.5 12C20.672 12 20.8427 11.9942 21.0119 11.9829C21.6508 13.5188 22 15.2155 22 17C22 19.7614 19.7614 22 17 22H12Z" />
            <path d="M22.5 4.5C22.5 6.70914 20.7091 8.5 18.5 8.5C16.2909 8.5 14.5 6.70914 14.5 4.5C14.5 2.29086 16.2909 0.5 18.5 0.5C20.7091 0.5 22.5 2.29086 22.5 4.5Z" />
          </svg>
        </div>
      </div>

      {/* ── Main Login Card ── */}
      <div className="relative z-10 w-full max-w-[620px] px-4 sm:px-6">
        <div className="bg-white rounded-[24px] shadow-[0_8px_40px_-12px_rgba(0,0,0,0.08)] p-8 sm:p-14 border border-slate-100 relative">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-[2.5rem] font-bold tracking-tight text-slate-900 mb-1 flex items-center justify-center gap-1">
              <span>Grow</span>
              <span className="text-blue-600">Fast</span>
            </h1>
            <p className="text-sm font-medium text-slate-400">
              Simpler Operations. Cleaner Tomorrow.
            </p>

            <h2 className="text-[1.75rem] font-bold text-slate-900 mt-10 mb-2">Staff Portal</h2>
            <p className="text-[0.95rem] text-slate-500">Sign in to access the system</p>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="flex flex-col gap-5">
            {/* Global Error/Lockout State */}
            {(error || lockoutUntil) && (
              <div className="bg-red-50/80 border border-red-100 text-red-600 text-sm font-medium p-4 rounded-xl text-center">
                {lockoutUntil
                  ? `Too many failed attempts. Try again in ${timeLeft}s.`
                  : `${error} (Attempt ${failedAttempts}/5)`}
              </div>
            )}

            {/* Username / Employee Dropdown */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="employeeId" className="text-[0.95rem] font-bold text-slate-800">
                Role of You
              </label>
              <div
                className={`relative flex items-center h-[56px] rounded-xl border px-4 gap-3 transition-all duration-200 ${
                  isFocusedEmp
                    ? 'border-blue-500 shadow-[0_0_0_4px_rgba(59,130,246,0.1)] bg-white'
                    : 'border-slate-200 bg-slate-50/80 hover:bg-slate-50 hover:border-slate-300'
                } ${lockoutUntil ? 'opacity-60 pointer-events-none' : ''}`}
              >
                <User
                  size={20}
                  strokeWidth={2.5}
                  className="text-blue-400 shrink-0 pointer-events-none"
                />

                {isFetchingDirectory ? (
                  <div className="flex-1 text-[0.95rem] text-slate-400">
                    Loading staff directory...
                  </div>
                ) : (
                  <select
                    id="employeeId"
                    value={employeeId}
                    onChange={(e) => setEmployeeId(e.target.value)}
                    onFocus={() => setIsFocusedEmp(true)}
                    onBlur={() => setIsFocusedEmp(false)}
                    disabled={!!lockoutUntil}
                    className={`flex-1 h-full bg-transparent outline-none appearance-none cursor-pointer text-[0.95rem] font-medium ${
                      employeeId ? 'text-slate-900' : 'text-slate-400'
                    }`}
                  >
                    <option value="" disabled className="text-slate-400">
                      Select who you are
                    </option>
                    {directory.map((emp) => (
                      <option key={emp.id} value={emp.id} className="text-slate-900 font-medium">
                        {emp.name} ({emp.role})
                      </option>
                    ))}
                  </select>
                )}

                {/* Custom select arrow to match standard inputs */}
                <svg
                  width="12"
                  height="8"
                  viewBox="0 0 12 8"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="text-slate-400 shrink-0 pointer-events-none"
                >
                  <path
                    d="M1.5 1.5L6 6L10.5 1.5"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </div>

            {/* Password / PIN Input */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="password" className="text-[0.95rem] font-bold text-slate-800">
                PIN
              </label>
              <div
                className={`relative flex items-center h-[56px] rounded-xl border px-4 gap-3 transition-all duration-200 ${
                  isFocusedPin
                    ? 'border-blue-500 shadow-[0_0_0_4px_rgba(59,130,246,0.1)] bg-white'
                    : 'border-slate-200 bg-slate-50/80 hover:bg-slate-50 hover:border-slate-300'
                } ${lockoutUntil ? 'opacity-60 pointer-events-none' : ''}`}
              >
                <Lock
                  size={20}
                  strokeWidth={2.5}
                  className="text-blue-400 shrink-0 pointer-events-none"
                />

                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  onFocus={() => setIsFocusedPin(true)}
                  onBlur={() => setIsFocusedPin(false)}
                  disabled={!!lockoutUntil}
                  placeholder="Enter your PIN"
                  className="flex-1 h-full bg-transparent outline-none text-[0.95rem] font-medium text-slate-900 placeholder:text-slate-400 placeholder:font-medium placeholder:tracking-normal tracking-widest"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={!!lockoutUntil}
                  className="shrink-0 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer outline-none focus-visible:text-blue-600"
                  aria-label={showPassword ? 'Hide PIN' : 'Show PIN'}
                >
                  {showPassword ? (
                    <EyeOff size={20} strokeWidth={2.5} />
                  ) : (
                    <Eye size={20} strokeWidth={2.5} />
                  )}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoggingIn || !!lockoutUntil}
              className={`mt-4 w-full h-[56px] rounded-xl flex items-center justify-center gap-2 text-[1.1rem] font-bold text-white transition-all shadow-sm ${
                isLoggingIn || !!lockoutUntil
                  ? 'bg-blue-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 hover:shadow-md cursor-pointer active:scale-[0.99]'
              }`}
            >
              {isLoggingIn ? (
                <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  Sign In <ArrowRight size={22} strokeWidth={2.5} />
                </>
              )}
            </button>
          </form>

          {/* Footer Security Label */}
          <div className="mt-8 flex items-center justify-center gap-4 opacity-70">
            <div className="h-px bg-slate-200 flex-1"></div>
            <span className="text-[0.8rem] font-semibold text-slate-400 tracking-wider uppercase">
              Secure Staff Portal
            </span>
            <div className="h-px bg-slate-200 flex-1"></div>
          </div>
        </div>
      </div>
    </div>
  );
};
