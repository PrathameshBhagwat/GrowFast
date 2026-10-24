import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Eye, EyeOff, User, Lock, ArrowRight, Shield, ShieldCheck } from 'lucide-react';
import { Dropdown, DropdownOption } from '@growfast/ui';
import { apiFetch } from '../services/api';
import { ThemeToggle } from '../components/ThemeToggle';

export const LoginPage: React.FC = () => {
  const { login, error } = useAuth();
  const navigate = useNavigate();
  const [employeeId, setEmployeeId] = useState('');
  const [pin, setPin] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);

  // UI states
  const [showPassword, setShowPassword] = useState(false);
  const [isFocusedPin, setIsFocusedPin] = useState(false);

  const [directory, setDirectory] = useState<{ id: string; name: string; role: string }[]>([]);
  const [isFetchingDirectory, setIsFetchingDirectory] = useState(true);

  // Fetch directory on mount
  useEffect(() => {
    const fetchDirectory = async () => {
      try {
        const body = await apiFetch<{ data: { id: string; name: string; role: string }[] }>(
          '/auth/directory',
          { noAuth: true, retries: 2, retryDelay: 1000 },
        );
        setDirectory(body.data || []);
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
    <div className="min-h-screen lg:h-screen w-full bg-[#edf3f8] dark:bg-[#0a1122] flex items-center justify-center relative font-sans selection:bg-blue-100 selection:text-blue-900 overflow-x-hidden lg:overflow-hidden transition-colors">
      {/* ── Top-Left: Rounded-Square Theme Toggle ── */}
      <div className="absolute top-6 left-6 sm:top-8 sm:left-8 z-40">
        <ThemeToggle className="!w-11 !h-11 !rounded-2xl !p-0 shadow-[0_4px_16px_rgba(160,175,200,0.35)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.6)] !border !border-white/90 dark:!border-slate-800/80 !bg-white dark:!bg-[#111a2e] hover:scale-105 active:scale-95 transition-all" />
      </div>

      {/* ── Top-Right: Security Badge ── */}
      <div className="absolute top-6 right-6 sm:top-8 sm:right-8 z-40">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-full bg-blue-50/90 dark:bg-blue-950/40 border border-blue-100/90 dark:border-blue-900/50 shadow-[0_2px_8px_rgba(160,175,200,0.2)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.4)]">
          <ShieldCheck
            size={16}
            strokeWidth={2.2}
            className="text-blue-600 dark:text-blue-400 shrink-0"
          />
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 tracking-tight">
            Secure staff access
          </span>
        </div>
      </div>

      {/* ── Large Sweeping Curved Background Arc & Neumorphic Shapes ── */}
      <div className="absolute top-[-15%] left-[-10%] w-[820px] h-[820px] rounded-full border-[60px] border-white/60 dark:border-blue-950/20 blur-sm pointer-events-none" />
      <div className="absolute top-[10%] right-[-10%] w-[750px] h-[750px] rounded-full bg-radial from-blue-200/50 via-blue-100/25 to-transparent dark:from-blue-900/20 dark:via-blue-950/10 dark:to-transparent blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-15%] left-[10%] w-[700px] h-[700px] rounded-full bg-radial from-white/90 via-blue-50/50 to-transparent dark:from-slate-900/40 dark:via-transparent dark:to-transparent blur-2xl pointer-events-none" />

      {/* ── Dot Matrix Patterns matching reference ── */}
      {/* Top Center-Right Dots */}
      <div className="absolute top-16 left-[40%] hidden lg:grid grid-cols-5 gap-2.5 opacity-35 dark:opacity-20 pointer-events-none">
        {Array.from({ length: 20 }).map((_, i) => (
          <div key={i} className="w-1.5 h-1.5 rounded-full bg-blue-400 dark:bg-blue-300" />
        ))}
      </div>
      {/* Mid Left-Center Dots */}
      <div className="absolute bottom-28 left-[35%] hidden lg:grid grid-cols-4 gap-2.5 opacity-30 dark:opacity-15 pointer-events-none">
        {Array.from({ length: 16 }).map((_, i) => (
          <div key={i} className="w-1.5 h-1.5 rounded-full bg-blue-400 dark:bg-blue-300" />
        ))}
      </div>

      {/* ── Floating Squircle Tiles matching reference ── */}
      {/* 1. Clothes Hanger Squircle Tile (Upper Center-Left) */}
      <div
        className="absolute top-[28%] left-[36%] xl:left-[37%] hidden lg:flex items-center justify-center w-18 h-18 xl:w-20 xl:h-20 rounded-3xl bg-white/95 dark:bg-[#111a2e]/95 border border-white/90 dark:border-slate-800/80 shadow-[0_16px_36px_rgba(160,175,200,0.35)] dark:shadow-[0_16px_36px_rgba(0,0,0,0.6)] rotate-12 pointer-events-none z-10 transition-transform hover:scale-105"
        style={{ backdropFilter: 'blur(8px)' }}
      >
        <svg
          width="36"
          height="36"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#2563eb"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-blue-600 dark:text-blue-400"
        >
          <path d="M12 4a3 3 0 0 1 3 3c0 1.2-.7 2.1-1.7 2.6L20 14a2 2 0 0 1-1 3.5H5A2 2 0 0 1 4 14l6.7-4.4C9.7 9.1 9 8.2 9 7a3 3 0 0 1 3-3z" />
        </svg>
      </div>

      {/* 2. T-Shirt Squircle Tile (Lower-Center, Left of Card) */}
      <div
        className="absolute bottom-[30%] left-[40%] xl:left-[41%] hidden lg:flex items-center justify-center w-18 h-18 xl:w-20 xl:h-20 rounded-3xl bg-white/95 dark:bg-[#111a2e]/95 border border-white/90 dark:border-slate-800/80 shadow-[0_16px_36px_rgba(160,175,200,0.35)] dark:shadow-[0_16px_36px_rgba(0,0,0,0.6)] -rotate-12 pointer-events-none z-10 transition-transform hover:scale-105"
        style={{ backdropFilter: 'blur(8px)' }}
      >
        <svg
          width="34"
          height="34"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#2563eb"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-blue-600 dark:text-blue-400"
        >
          <path d="M20.38 3.46L16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z" />
        </svg>
      </div>

      {/* ── Translucent Floating Gloss Bubbles ── */}
      {/* Bubble 1: Upper-left */}
      <div className="absolute top-[36%] left-[1.5%] w-7 h-7 rounded-full bg-gradient-to-br from-white/90 to-blue-200/50 dark:from-white/20 dark:to-blue-600/30 shadow-[0_4px_12px_rgba(160,175,200,0.35)] border border-white/70 dark:border-white/10 pointer-events-none hidden sm:block" />
      {/* Bubble 2: Mid-left near text */}
      <div className="absolute top-[46%] left-[5%] w-6 h-6 rounded-full bg-gradient-to-br from-white/90 to-blue-200/50 dark:from-white/20 dark:to-blue-600/30 shadow-[0_4px_10px_rgba(160,175,200,0.3)] border border-white/70 dark:border-white/10 pointer-events-none hidden sm:block" />
      {/* Bubble 3: Above towels */}
      <div className="absolute bottom-[35%] left-[27%] w-8 h-8 rounded-full bg-gradient-to-br from-white/90 to-blue-200/50 dark:from-white/20 dark:to-blue-600/30 shadow-[0_4px_14px_rgba(160,175,200,0.35)] border border-white/70 dark:border-white/10 pointer-events-none hidden lg:block" />
      {/* Bubble 4: Far Right of Card */}
      <div className="absolute top-[48%] -right-10 w-28 h-28 rounded-full bg-gradient-to-br from-blue-100/60 to-blue-300/20 dark:from-blue-900/30 dark:to-transparent blur-xs pointer-events-none hidden lg:block" />

      {/* ── Sweeping Landscape Wave in Lower-Left ── */}
      <div className="absolute bottom-0 left-0 w-full max-w-[660px] h-[360px] pointer-events-none z-0 hidden lg:block select-none">
        <svg
          viewBox="0 0 660 360"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full"
        >
          <defs>
            <linearGradient id="waveGradLg" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
              <stop offset="60%" stopColor="#e8f1fb" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#dce8f8" stopOpacity="0.65" />
            </linearGradient>
          </defs>
          <path
            d="M-40 260 Q 140 160 360 250 T 680 280 L 680 380 L -40 380 Z"
            fill="url(#waveGradLg)"
            className="dark:fill-[#0c1424]"
            opacity="0.85"
          />
          <path
            d="M-40 290 Q 180 220 400 280 T 680 310 L 680 380 L -40 380 Z"
            fill="#ffffff"
            className="dark:fill-[#080e1a]"
            opacity="0.95"
          />
        </svg>
      </div>

      {/* ── 3D Washing Machine, Towels & Leaves (Shifted right of bottom-left text) ── */}
      <div className="absolute bottom-0 left-[180px] sm:left-[200px] lg:left-[215px] xl:left-[230px] w-[340px] h-[300px] pointer-events-none z-10 hidden lg:block select-none">
        <svg
          viewBox="0 0 340 300"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full"
        >
          <defs>
            <linearGradient id="machineBody" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="70%" stopColor="#edf3fb" />
              <stop offset="100%" stopColor="#dbe7f7" />
            </linearGradient>

            <linearGradient id="machineTop" x1="0%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stopColor="#e2ecf9" />
              <stop offset="100%" stopColor="#ffffff" />
            </linearGradient>

            <linearGradient id="drumGlass" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#bae6fd" />
              <stop offset="50%" stopColor="#38bdf8" />
              <stop offset="100%" stopColor="#1d4ed8" />
            </linearGradient>

            <linearGradient id="waterWave" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#93c5fd" stopOpacity="0.9" />
            </linearGradient>

            <linearGradient id="towelWhite" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="100%" stopColor="#e2ecf8" />
            </linearGradient>
            <linearGradient id="towelBlue" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#eff6ff" />
              <stop offset="100%" stopColor="#dbeafe" />
            </linearGradient>

            <linearGradient id="leafGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#bae6fd" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#60a5fa" stopOpacity="0.6" />
            </linearGradient>

            <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow
                dx="0"
                dy="12"
                stdDeviation="16"
                floodColor="#94a3b8"
                floodOpacity="0.28"
              />
            </filter>
            <filter id="drumShadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow
                dx="0"
                dy="4"
                stdDeviation="8"
                floodColor="#1e3a8a"
                floodOpacity="0.25"
              />
            </filter>
          </defs>

          {/* Botanical Leaves Behind & Beside */}
          <g opacity="0.85">
            <path
              d="M10 200 C -2 150 20 120 30 115 C 30 140 24 185 10 200 Z"
              fill="url(#leafGrad)"
            />
            <path
              d="M20 210 C 2 180 6 145 18 135 C 28 155 30 190 20 210 Z"
              fill="url(#leafGrad)"
              opacity="0.7"
            />
            <path
              d="M220 240 C 245 210 265 205 275 210 C 270 225 250 245 220 240 Z"
              fill="url(#leafGrad)"
            />
            <path
              d="M230 250 C 260 225 285 225 290 235 C 280 250 255 260 230 250 Z"
              fill="url(#leafGrad)"
              opacity="0.65"
            />
          </g>

          {/* 3D Washing Machine */}
          <g filter="url(#softShadow)">
            {/* Top Bevel / Lid Surface */}
            <path
              d="M32 105 L58 88 L162 88 L138 105 Z"
              fill="url(#machineTop)"
              stroke="#cbd5e1"
              strokeWidth="0.5"
            />
            {/* Side Bevel */}
            <path d="M138 105 L162 88 L162 205 L138 225 Z" fill="#cbd5e1" opacity="0.6" />
            {/* Front Main Body */}
            <rect
              x="32"
              y="105"
              width="106"
              height="120"
              rx="18"
              fill="url(#machineBody)"
              stroke="#e2e8f0"
              strokeWidth="0.75"
            />

            {/* Top Control Panel Line */}
            <line x1="36" y1="132" x2="134" y2="132" stroke="#cbd5e1" strokeWidth="1" />

            {/* Detergent Drawer */}
            <rect
              x="44"
              y="113"
              width="28"
              height="12"
              rx="3"
              fill="#ffffff"
              stroke="#cbd5e1"
              strokeWidth="0.75"
            />
            <line
              x1="58"
              y1="117"
              x2="58"
              y2="121"
              stroke="#94a3b8"
              strokeWidth="1"
              strokeLinecap="round"
            />

            {/* Status LEDs */}
            <circle cx="88" cy="119" r="1.5" fill="#3b82f6" />
            <circle cx="94" cy="119" r="1.5" fill="#60a5fa" />
            <circle cx="100" cy="119" r="1.5" fill="#93c5fd" />

            {/* Program Dial Knob */}
            <circle cx="118" cy="119" r="6" fill="#ffffff" stroke="#94a3b8" strokeWidth="1" />
            <circle cx="118" cy="119" r="2.5" fill="#3b82f6" />

            {/* Front Circular Glass Door & Drum */}
            <circle
              cx="85"
              cy="174"
              r="36"
              fill="#f8fafc"
              stroke="#cbd5e1"
              strokeWidth="2"
              filter="url(#drumShadow)"
            />
            <circle cx="85" cy="174" r="30" fill="url(#drumGlass)" />

            {/* Drum Glass Water Ripples & Bubbles */}
            <path
              d="M57 180 Q 72 188 85 180 T 113 182 C 113 196 101 204 85 204 C 69 204 57 196 57 180 Z"
              fill="url(#waterWave)"
              opacity="0.85"
            />
            <circle cx="74" cy="186" r="2.5" fill="#ffffff" opacity="0.8" />
            <circle cx="88" cy="192" r="3.5" fill="#ffffff" opacity="0.9" />
            <circle cx="98" cy="187" r="2" fill="#ffffff" opacity="0.8" />
            <path
              d="M63 164 C 69 154 82 148 96 152"
              stroke="#ffffff"
              strokeWidth="2.5"
              strokeLinecap="round"
              opacity="0.6"
            />
          </g>

          {/* Stack of 3 Fluffy Folded Towels */}
          <g filter="url(#softShadow)">
            <rect
              x="150"
              y="212"
              width="76"
              height="18"
              rx="9"
              fill="url(#towelBlue)"
              stroke="#bfdbfe"
              strokeWidth="0.75"
            />
            <path
              d="M159 212 C 159 221 159 230 159 230"
              stroke="#93c5fd"
              strokeWidth="1"
              opacity="0.6"
            />

            <rect
              x="154"
              y="196"
              width="70"
              height="17"
              rx="8.5"
              fill="url(#towelWhite)"
              stroke="#e2e8f0"
              strokeWidth="0.75"
            />
            <path
              d="M162 196 C 162 204 162 213 162 213"
              stroke="#cbd5e1"
              strokeWidth="1"
              opacity="0.6"
            />

            <rect
              x="158"
              y="180"
              width="64"
              height="17"
              rx="8.5"
              fill="url(#towelBlue)"
              stroke="#bfdbfe"
              strokeWidth="0.75"
            />
            <path
              d="M166 180 C 166 188 166 197 166 197"
              stroke="#93c5fd"
              strokeWidth="1"
              opacity="0.6"
            />
          </g>
        </svg>
      </div>

      {/* ── Main Two-Column Layout Container ── */}
      <div className="relative z-20 w-full max-w-[1440px] mx-auto px-6 sm:px-12 lg:px-16 xl:px-20 py-8 lg:py-0 flex flex-col lg:flex-row items-center justify-between gap-12 lg:gap-14 xl:gap-20">
        {/* ── Left Column: GrowFast Branding & Statement ── */}
        <div className="w-full lg:w-1/2 flex flex-col justify-between py-2 lg:py-8 max-w-xl text-left">
          <div>
            {/* Brand Logo */}
            <h1 className="text-4xl sm:text-5xl lg:text-[3.5rem] xl:text-[3.75rem] font-black tracking-tight leading-none text-slate-900 dark:text-slate-100 flex items-center gap-0.5">
              <span>Grow</span>
              <span className="text-blue-600 dark:text-blue-500">Fast</span>
            </h1>

            {/* Tagline */}
            <p className="text-sm sm:text-base font-medium text-slate-500 dark:text-slate-400 mt-2.5 tracking-tight">
              Simpler Operations. Cleaner Tomorrow.
            </p>

            {/* Short Thin Blue Divider */}
            <div className="w-10 h-0.5 bg-blue-500/80 rounded-full my-6 sm:my-8" />

            {/* Section Heading & Subtitle */}
            <div className="mt-2">
              <h2 className="text-3xl sm:text-4xl lg:text-[2.65rem] font-extrabold text-slate-900 dark:text-slate-100 tracking-tight leading-tight">
                Staff Portal
              </h2>
              <p className="text-sm sm:text-base text-slate-500 dark:text-slate-400 mt-2 font-normal">
                Sign in to access your workspace
              </p>
            </div>
          </div>

          {/* Bottom-Left Brand Statement (Clean spaces. Happier people.) */}
          <div className="mt-14 lg:mt-32 flex items-center gap-3.5 text-xs sm:text-sm font-semibold relative z-20">
            <div className="w-1 h-9 bg-blue-600 dark:bg-blue-500 rounded-full shrink-0" />
            <div className="leading-snug">
              <div className="text-slate-700 dark:text-slate-200 font-bold">Clean spaces.</div>
              <div className="text-slate-500 dark:text-slate-400 font-medium">Happier people.</div>
            </div>
          </div>
        </div>

        {/* ── Right Column: Premium Hybrid-Neumorphic Login Card ── */}
        <div className="w-full lg:w-1/2 flex justify-center lg:justify-end">
          <div
            className="w-full max-w-[480px] sm:max-w-[540px] lg:max-w-[580px] xl:max-w-[625px] rounded-[36px] sm:rounded-[40px] bg-white dark:bg-[#111a2e] border border-white/90 dark:border-[#1e2d4a]/90 shadow-[0_24px_60px_-12px_rgba(160,175,200,0.35),0_8px_24px_-6px_rgba(160,175,200,0.15)] dark:shadow-[0_24px_60px_-12px_rgba(0,0,0,0.7),0_8px_24px_-6px_rgba(0,0,0,0.45)] p-7 sm:p-11 lg:p-14 xl:p-16 transition-all"
            style={{
              boxShadow:
                '0 25px 60px -15px rgba(160, 175, 200, 0.35), 0 10px 24px -6px rgba(160, 175, 200, 0.15), inset 0 1px 1px rgba(255, 255, 255, 0.95)',
            }}
          >
            {/* 1. Brand Icon */}
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-[20px] sm:rounded-[22px] bg-gradient-to-br from-blue-500 to-blue-600 text-white flex items-center justify-center shadow-[0_8px_20px_rgba(37,99,235,0.35)]">
              <svg
                width="30"
                height="30"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M20.38 3.46L16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z" />
              </svg>
            </div>

            {/* 2. Welcome Greeting */}
            <div className="mt-5 sm:mt-6">
              <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight leading-tight">
                Welcome back
              </h2>
              <p className="text-sm sm:text-base text-slate-500 dark:text-slate-400 mt-1 font-normal">
                Sign in to continue to GrowFast
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleLogin} className="mt-6 sm:mt-8 flex flex-col gap-5 sm:gap-6">
              {/* Global Error/Lockout Banner */}
              {(error || lockoutUntil) && (
                <div className="bg-red-50/90 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 text-red-600 dark:text-red-400 text-xs sm:text-sm font-semibold p-3.5 rounded-2xl text-center">
                  {lockoutUntil
                    ? `Too many failed attempts. Try again in ${timeLeft}s.`
                    : `${error} (Attempt ${failedAttempts}/5)`}
                </div>
              )}

              {/* 3. Role Selection */}
              <div className="flex flex-col gap-2">
                <label
                  htmlFor="employeeId"
                  className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 pl-0.5"
                >
                  Role of You
                </label>
                {isFetchingDirectory ? (
                  <div
                    className="relative flex items-center h-[56px] sm:h-[60px] rounded-2xl border border-slate-200 dark:border-[#1e2d4a] bg-[#f8fafc] dark:bg-[#0c1424] px-4 gap-3.5"
                    style={{ boxShadow: 'var(--shadow-neu-inset)' }}
                  >
                    <User
                      size={20}
                      strokeWidth={2.2}
                      className="text-blue-600 dark:text-blue-500 shrink-0 pointer-events-none"
                    />
                    <div className="flex-1 text-sm text-slate-400 dark:text-slate-500 font-medium">
                      Loading staff directory...
                    </div>
                  </div>
                ) : (
                  <div className="relative">
                    <Dropdown
                      id="employeeId"
                      name="employeeId"
                      value={employeeId}
                      onChange={setEmployeeId}
                      placeholder="Select who you are"
                      disabled={!!lockoutUntil}
                      error={error ?? undefined}
                      fullWidth={true}
                      prefixIcon={
                        <User
                          size={20}
                          strokeWidth={2.2}
                          className="text-blue-600 dark:text-blue-500"
                        />
                      }
                      buttonStyleOverrides={{
                        minHeight: '58px',
                        borderRadius: '18px',
                        backgroundColor: 'var(--bg-surface-inset)',
                        border: '1px solid var(--border)',
                        boxShadow: 'var(--shadow-neu-inset)',
                      }}
                      options={
                        directory
                          .filter((emp) => emp.role === 'OWNER' || emp.role === 'COUNTER')
                          .map((emp) => ({
                            value: emp.id,
                            label: `${emp.name} (${emp.role})`,
                          })) as DropdownOption[]
                      }
                    />
                  </div>
                )}
              </div>

              {/* 4. PIN Field */}
              <div className="flex flex-col gap-2">
                <label
                  htmlFor="password"
                  className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 pl-0.5"
                >
                  PIN
                </label>
                <div
                  className={`relative flex items-center h-[56px] sm:h-[60px] rounded-[18px] border px-4 gap-3.5 transition-all duration-200 ${
                    isFocusedPin
                      ? 'border-blue-500 ring-2 ring-blue-500/20 bg-white dark:bg-[#0c1424]'
                      : 'border-slate-200/90 dark:border-[#1e2d4a] bg-[#f8fafc] dark:bg-[#0c1424] hover:border-slate-300 dark:hover:border-[#2a3c60]'
                  } ${lockoutUntil ? 'opacity-60 pointer-events-none' : ''}`}
                  style={{ boxShadow: 'var(--shadow-neu-inset)' }}
                >
                  <Lock
                    size={20}
                    strokeWidth={2.2}
                    className="text-blue-600 dark:text-blue-500 shrink-0 pointer-events-none"
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
                    className="flex-1 h-full bg-transparent outline-none text-base font-semibold text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 placeholder:font-normal tracking-widest"
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={!!lockoutUntil}
                    className="shrink-0 w-9 h-9 flex items-center justify-center text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors cursor-pointer outline-none focus-visible:text-blue-600 rounded-xl"
                    aria-label={showPassword ? 'Hide PIN' : 'Show PIN'}
                  >
                    {showPassword ? (
                      <EyeOff size={19} strokeWidth={2.2} />
                    ) : (
                      <Eye size={19} strokeWidth={2.2} />
                    )}
                  </button>
                </div>
              </div>

              {/* 5. Sign-in Button */}
              <button
                type="submit"
                disabled={isLoggingIn || !!lockoutUntil}
                className={`group mt-3 w-full h-[56px] sm:h-[60px] rounded-[18px] flex items-center justify-center gap-2 text-base font-bold text-white transition-all duration-200 ${
                  isLoggingIn || !!lockoutUntil
                    ? 'bg-blue-400 dark:bg-blue-600/50 cursor-not-allowed shadow-none'
                    : 'bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 shadow-[0_8px_24px_rgba(37,99,235,0.4)] cursor-pointer active:scale-[0.99]'
                }`}
              >
                {isLoggingIn ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Sign In</span>
                    <ArrowRight
                      size={19}
                      strokeWidth={2.5}
                      className="transition-transform duration-200 group-hover:translate-x-1"
                    />
                  </>
                )}
              </button>

              {/* 6. Security Footer with Dividing Lines */}
              <div className="flex items-center gap-3 mt-4 sm:mt-5 pt-1">
                <div className="flex-1 h-px bg-slate-200/90 dark:bg-slate-800" />
                <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-bold tracking-widest text-slate-400 dark:text-slate-500 uppercase shrink-0">
                  <Shield
                    size={13}
                    strokeWidth={2.5}
                    className="text-blue-600 dark:text-blue-500"
                  />
                  <span>SECURE STAFF PORTAL</span>
                </div>
                <div className="flex-1 h-px bg-slate-200/90 dark:bg-slate-800" />
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
