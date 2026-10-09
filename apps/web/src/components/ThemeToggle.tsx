import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

export interface ThemeToggleProps {
  className?: string;
  size?: 'sm' | 'md';
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ className = '', size = 'md' }) => {
  const { resolvedTheme, toggleTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const iconSize = size === 'sm' ? 16 : 18;
  const padding = size === 'sm' ? '6px' : '8px';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`theme-toggle-btn inline-flex items-center justify-center rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${className}`}
      style={{
        padding,
        background: 'var(--bg-surface-muted)',
        border: '1px solid var(--border)',
        color: 'var(--text-secondary)',
        cursor: 'pointer',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        flexShrink: 0,
      }}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {isDark ? (
        <Sun
          size={iconSize}
          className="text-amber-400"
          style={{ transition: 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)' }}
        />
      ) : (
        <Moon
          size={iconSize}
          className="text-slate-600"
          style={{ transition: 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)' }}
        />
      )}
    </button>
  );
};
