export type ThemeMode = 'light' | 'dark' | 'system';

export interface ThemeColors {
  background: string;
  surface: string;
  surfaceSecondary: string;
  surfaceElevated: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  borderLight: string;
  primary: string;
  primaryBg: string;
  primaryLight: string;
  success: string;
  successBg: string;
  warning: string;
  warningBg: string;
  error: string;
  errorBg: string;
  inputBackground: string;
  inputBorder: string;
  tabBarBackground: string;
  tabBarBorder: string;
  statusBarStyle: 'light' | 'dark';
}

export const LIGHT_COLORS: ThemeColors = {
  background: '#F8FAFC',
  surface: '#FFFFFF',
  surfaceSecondary: '#F1F5F9',
  surfaceElevated: '#FFFFFF',
  textPrimary: '#0F172A',
  textSecondary: '#64748B',
  textMuted: '#94A3B8',
  border: '#E2E8F0',
  borderLight: '#F1F5F9',
  primary: '#1765F5',
  primaryBg: '#EFF6FF',
  primaryLight: '#DBEAFE',
  success: '#16A34A',
  successBg: '#DCFCE7',
  warning: '#D97706',
  warningBg: '#FEF3C7',
  error: '#DC2626',
  errorBg: '#FEE2E2',
  inputBackground: '#FFFFFF',
  inputBorder: '#E2E8F0',
  tabBarBackground: '#FFFFFF',
  tabBarBorder: '#E2E8F0',
  statusBarStyle: 'dark',
};

export const DARK_COLORS: ThemeColors = {
  background: '#0F172A',
  surface: '#1E293B',
  surfaceSecondary: '#334155',
  surfaceElevated: '#1E293B',
  textPrimary: '#F8FAFC',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',
  border: '#334155',
  borderLight: '#1E293B',
  primary: '#3B82F6',
  primaryBg: 'rgba(37, 99, 235, 0.22)',
  primaryLight: '#1E3A8A',
  success: '#22C55E',
  successBg: 'rgba(34, 197, 94, 0.2)',
  warning: '#FBBF24',
  warningBg: 'rgba(251, 191, 36, 0.2)',
  error: '#F87171',
  errorBg: 'rgba(248, 113, 113, 0.2)',
  inputBackground: '#0F172A',
  inputBorder: '#334155',
  tabBarBackground: '#1E293B',
  tabBarBorder: '#334155',
  statusBarStyle: 'light',
};

export const THEME_STORAGE_KEY = 'growfast_theme';
