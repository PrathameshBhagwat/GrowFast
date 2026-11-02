import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { Appearance, ColorSchemeName } from 'react-native';
import { getStorageAdapter } from '../storage/secure-store';
import {
  ThemeMode,
  ThemeColors,
  LIGHT_COLORS,
  DARK_COLORS,
  THEME_STORAGE_KEY,
} from '../constants/theme';

export type { ThemeMode, ThemeColors };
export { LIGHT_COLORS, DARK_COLORS, THEME_STORAGE_KEY };

export interface ThemeContextType {
  theme: ThemeMode;
  resolvedTheme: 'light' | 'dark';
  isDark: boolean;
  colors: ThemeColors;
  setTheme: (theme: ThemeMode) => Promise<void>;
  toggleTheme: () => Promise<void>;
}

const defaultThemeContext: ThemeContextType = {
  theme: 'light',
  resolvedTheme: 'light',
  isDark: false,
  colors: LIGHT_COLORS,
  setTheme: async () => {},
  toggleTheme: async () => {},
};

export const ThemeContext = createContext<ThemeContextType>(defaultThemeContext);

export const ThemeProvider: React.FC<{
  children: React.ReactNode;
  initialTheme?: ThemeMode;
}> = ({ children, initialTheme }) => {
  const [theme, setThemeState] = useState<ThemeMode>(initialTheme || 'light');
  const [systemScheme, setSystemScheme] = useState<ColorSchemeName>(
    Appearance.getColorScheme() || 'light',
  );

  // Load persisted theme preference on mount
  useEffect(() => {
    let isMounted = true;
    async function loadStoredTheme() {
      try {
        const adapter = getStorageAdapter();
        const stored = await adapter.getItem(THEME_STORAGE_KEY);
        if (isMounted && stored && (stored === 'light' || stored === 'dark' || stored === 'system')) {
          setThemeState(stored as ThemeMode);
        }
      } catch (err) {
        console.warn('[ThemeContext] Could not load stored theme:', err);
      }
    }
    loadStoredTheme();
    return () => {
      isMounted = false;
    };
  }, []);

  // Listen to system color scheme changes
  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemScheme(colorScheme || 'light');
    });
    return () => {
      subscription.remove();
    };
  }, []);

  // Determine resolved theme ('light' or 'dark')
  const resolvedTheme: 'light' | 'dark' = useMemo(() => {
    if (theme === 'system') {
      return systemScheme === 'dark' ? 'dark' : 'light';
    }
    return theme === 'dark' ? 'dark' : 'light';
  }, [theme, systemScheme]);

  const isDark = resolvedTheme === 'dark';
  const colors = isDark ? DARK_COLORS : LIGHT_COLORS;

  const setTheme = useCallback(async (newTheme: ThemeMode) => {
    setThemeState(newTheme);
    try {
      const adapter = getStorageAdapter();
      await adapter.setItem(THEME_STORAGE_KEY, newTheme);
    } catch (err) {
      console.warn('[ThemeContext] Could not persist theme:', err);
    }
  }, []);

  const toggleTheme = useCallback(async () => {
    const nextTheme: ThemeMode = resolvedTheme === 'dark' ? 'light' : 'dark';
    await setTheme(nextTheme);
  }, [resolvedTheme, setTheme]);

  const value = useMemo<ThemeContextType>(
    () => ({
      theme,
      resolvedTheme,
      isDark,
      colors,
      setTheme,
      toggleTheme,
    }),
    [theme, resolvedTheme, isDark, colors, setTheme, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  return context || defaultThemeContext;
};
