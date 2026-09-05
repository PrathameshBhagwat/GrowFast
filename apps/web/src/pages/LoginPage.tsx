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
  const [keepSignedIn, setKeepSignedIn] = useState(false);
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
    <div className="min-h-screen bg-slate-50/50 flex items-center justify-center relative overflow-hidden font-sans selection:bg-primary-100 selection:text-primary-900">
      {/* ── Background Decorative Elements ── */}
      {/* Top Left Shape */}
      <div className="absolute -top-40 -left-40 w-[600px] h-[600px] bg-primary-100/40 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-0 left-0 w-[40vw] h-[40vh] pointer-events-none opacity-20">
        <svg viewBox="0 0 400 400" className="w-full h-full text-primary-200" fill="currentColor">
          <path d="M0 0 L 400 0 C 200 0 0 200 0 400 Z" />
        </svg>
      </div>

      {/* Bottom Right Shape */}
      <div className="absolute -bottom-60 -right-40 w-[800px] h-[800px] bg-primary-50/60 rounded-full blur-2xl pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[50vw] h-[50vh] pointer-events-none opacity-20">
        <svg
          viewBox="0 0 400 400"
          className="w-full h-full text-primary-300"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
        >
          <circle cx="400" cy="400" r="300" />
          <circle cx="400" cy="400" r="350" />
          <circle cx="400" cy="400" r="250" />
        </svg>
      </div>

      {/* ── Top Right Pill ── */}
      <div className="absolute top-6 right-6 hidden sm:flex items-center gap-2 px-3 py-1.5 bg-slate-100/80 backdrop-blur-sm border border-slate-200/60 rounded-full">
        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
        <span className="text-xs font-medium text-slate-500">Laundry Management</span>
      </div>

      {/* ── Bottom Left Branding ── */}
      <div className="absolute bottom-10 left-10 hidden lg:flex items-center gap-4 pointer-events-none">
        <div className="w-0.5 h-12 bg-primary-500 rounded-full" />
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
        <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-600">
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
          <div className="text-center mb-10">
            <h1 className="text-[2.5rem] font-bold tracking-tight text-slate-900 mb-1 flex items-center justify-center gap-1">
              <span>Grow</span>
              <span className="text-primary-600">Fast</span>
            </h1>
            <p className="text-sm font-medium text-slate-400">
              Simpler Operations. Cleaner Tomorrow.
            </p>

            <h2 className="text-[1.75rem] font-bold text-slate-900 mt-10 mb-2">Welcome Back</h2>
            <p className="text-[0.95rem] text-slate-500">Sign in to continue to your account</p>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="flex flex-col gap-6">
            {/* Global Error/Lockout State */}
            {(error || lockoutUntil) && (
              <div className="bg-red-50/80 border border-red-100 text-red-600 text-sm font-medium p-4 rounded-xl text-center">
                {lockoutUntil
                  ? `Too many failed attempts. Try again in ${timeLeft}s.`
                  : `${error} (Attempt ${failedAttempts}/5)`}
              </div>
            )}

            {/* Username / Employee Dropdown disguised as text input */}
            <div className="flex flex-col gap-2">
              <label htmlFor="employeeId" className="text-[0.9rem] font-bold text-slate-800">
                Username or Email
              </label>
              <div
                className={`relative flex items-center h-14 rounded-xl border transition-all duration-200 ${
                  isFocusedEmp
                    ? 'border-primary-500 shadow-[0_0_0_4px_rgba(16,185,129,0.1)] bg-white'
                    : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-300'
                } ${lockoutUntil ? 'opacity-60 pointer-events-none' : ''}`}
              >
                <div className="absolute left-4 text-slate-400 flex items-center justify-center pointer-events-none">
                  <User size={20} strokeWidth={2.5} />
                </div>

                {isFetchingDirectory ? (
                  <div className="w-full pl-12 pr-4 h-full flex items-center text-sm text-slate-400">
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
                    className={`w-full h-full pl-12 pr-10 bg-transparent outline-none appearance-none cursor-pointer text-sm font-medium ${
                      employeeId ? 'text-slate-900' : 'text-slate-400'
                    }`}
                  >
                    <option value="" disabled className="text-slate-400">
                      Enter your username or email
                    </option>
                    {directory.map((emp) => (
                      <option key={emp.id} value={emp.id} className="text-slate-900 font-medium">
                        {emp.name}
                      </option>
                    ))}
                  </select>
                )}

                {/* Custom select arrow to match standard inputs */}
                <div className="absolute right-4 pointer-events-none text-slate-400">
                  <svg
                    width="12"
                    height="8"
                    viewBox="0 0 12 8"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M1.5 1.5L6 6L10.5 1.5"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              </div>
            </div>

            {/* Password / PIN Input */}
            <div className="flex flex-col gap-2">
              <label htmlFor="password" className="text-[0.9rem] font-bold text-slate-800">
                Password
              </label>
              <div
                className={`relative flex items-center h-14 rounded-xl border transition-all duration-200 ${
                  isFocusedPin
                    ? 'border-primary-500 shadow-[0_0_0_4px_rgba(16,185,129,0.1)] bg-white'
                    : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-300'
                } ${lockoutUntil ? 'opacity-60 pointer-events-none' : ''}`}
              >
                <div className="absolute left-4 text-slate-400 flex items-center justify-center pointer-events-none">
                  <Lock size={20} strokeWidth={2.5} />
                </div>

                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  onFocus={() => setIsFocusedPin(true)}
                  onBlur={() => setIsFocusedPin(false)}
                  disabled={!!lockoutUntil}
                  placeholder="Enter your password"
                  className="w-full h-full pl-12 pr-12 bg-transparent outline-none text-sm font-medium text-slate-900 placeholder:text-slate-400 placeholder:font-medium"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={!!lockoutUntil}
                  className="absolute right-4 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer outline-none focus-visible:text-primary-600"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <EyeOff size={20} strokeWidth={2} />
                  ) : (
                    <Eye size={20} strokeWidth={2} />
                  )}
                </button>
              </div>
            </div>

            {/* Secondary Actions (Keep signed in / Forgot) */}
            <div className="flex items-center justify-between mt-1">
              <label className="flex items-center gap-3 cursor-pointer group">
                <div
                  className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
                    keepSignedIn
                      ? 'bg-primary-600 border-primary-600 text-white'
                      : 'bg-white border-slate-300 text-transparent group-hover:border-primary-400'
                  }`}
                >
                  <Check size={14} strokeWidth={3} />
                </div>
                <input
                  type="checkbox"
                  className="hidden"
                  checked={keepSignedIn}
                  onChange={(e) => setKeepSignedIn(e.target.checked)}
                />
                <span className="text-sm font-semibold text-slate-600 select-none">
                  Keep me signed in
                </span>
              </label>

              <button
                type="button"
                className="text-sm font-bold text-primary-600 hover:text-primary-700 transition-colors"
                onClick={() =>
                  alert(
                    'Password recovery is disabled for POS environments. Please contact your manager.',
                  )
                }
              >
                Forgot password?
              </button>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoggingIn || !!lockoutUntil}
              className={`mt-4 w-full h-14 rounded-xl flex items-center justify-center gap-2 text-[1.05rem] font-bold text-white transition-all shadow-sm ${
                isLoggingIn || !!lockoutUntil
                  ? 'bg-primary-400 cursor-not-allowed'
                  : 'bg-primary-600 hover:bg-primary-700 hover:shadow-md cursor-pointer active:scale-[0.99]'
              }`}
            >
              {isLoggingIn ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  Sign In <ArrowRight size={20} strokeWidth={2.5} />
                </>
              )}
            </button>
          </form>

          {/* Footer Security Label */}
          <div className="mt-10 flex items-center justify-center gap-4 opacity-70">
            <div className="h-px bg-slate-200 flex-1"></div>
            <span className="text-xs font-semibold text-slate-400 tracking-wide uppercase">
              Secure access to your business
            </span>
            <div className="h-px bg-slate-200 flex-1"></div>
          </div>
        </div>
      </div>
    </div>
  );
};
