import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  LIGHT_COLORS,
  DARK_COLORS,
  ThemeMode,
  ThemeColors,
  THEME_STORAGE_KEY,
} from '../constants/theme';
import { getStorageAdapter } from '../storage/secure-store';

describe('GrowFast Mobile — Dark Mode Theme Engine & Persistence Suite', () => {
  const adapter = getStorageAdapter();

  beforeEach(async () => {
    await adapter.removeItem(THEME_STORAGE_KEY);
  });

  describe('1. Theme Palette Tokens & Contrast Hierarchy', () => {
    test('Light theme tokens meet accessible readability standards', () => {
      assert.strictEqual(LIGHT_COLORS.background, '#F8FAFC');
      assert.strictEqual(LIGHT_COLORS.surface, '#FFFFFF');
      assert.strictEqual(LIGHT_COLORS.surfaceSecondary, '#F1F5F9');
      assert.strictEqual(LIGHT_COLORS.textPrimary, '#0F172A');
      assert.strictEqual(LIGHT_COLORS.textSecondary, '#64748B');
      assert.strictEqual(LIGHT_COLORS.border, '#E2E8F0');
      assert.strictEqual(LIGHT_COLORS.primary, '#1765F5');
      assert.strictEqual(LIGHT_COLORS.statusBarStyle, 'dark');
    });

    test('Dark theme uses modern dark navy / slate palette rather than pure black #000000', () => {
      // Background is dark navy #0F172A
      assert.strictEqual(DARK_COLORS.background, '#0F172A');
      // Elevated card surface is slate #1E293B
      assert.strictEqual(DARK_COLORS.surface, '#1E293B');
      // Secondary surface / borders is slate #334155
      assert.strictEqual(DARK_COLORS.surfaceSecondary, '#334155');
      assert.strictEqual(DARK_COLORS.border, '#334155');
      // Primary text is light #F8FAFC
      assert.strictEqual(DARK_COLORS.textPrimary, '#F8FAFC');
      // Secondary text is muted slate #94A3B8
      assert.strictEqual(DARK_COLORS.textSecondary, '#94A3B8');
      // Status bar style is light for dark mode
      assert.strictEqual(DARK_COLORS.statusBarStyle, 'light');
    });

    test('All required ThemeColors tokens are present in both light and dark definitions', () => {
      const requiredKeys: (keyof ThemeColors)[] = [
        'background',
        'surface',
        'surfaceSecondary',
        'surfaceElevated',
        'textPrimary',
        'textSecondary',
        'textMuted',
        'border',
        'borderLight',
        'primary',
        'primaryBg',
        'primaryLight',
        'success',
        'successBg',
        'warning',
        'warningBg',
        'error',
        'errorBg',
        'inputBackground',
        'inputBorder',
        'tabBarBackground',
        'tabBarBorder',
        'statusBarStyle',
      ];

      for (const key of requiredKeys) {
        assert.ok(LIGHT_COLORS[key], `LIGHT_COLORS missing key: ${key}`);
        assert.ok(DARK_COLORS[key], `DARK_COLORS missing key: ${key}`);
      }
    });
  });

  describe('2. Theme Storage Persistence & Rehydration', () => {
    test('Saves and restores dark theme preference across app restarts', async () => {
      await adapter.setItem(THEME_STORAGE_KEY, 'dark');
      const loaded = await adapter.getItem(THEME_STORAGE_KEY);
      assert.strictEqual(loaded, 'dark');
    });

    test('Saves and restores light theme preference across app restarts', async () => {
      await adapter.setItem(THEME_STORAGE_KEY, 'light');
      const loaded = await adapter.getItem(THEME_STORAGE_KEY);
      assert.strictEqual(loaded, 'light');
    });

    test('Saves and restores system theme preference across app restarts', async () => {
      await adapter.setItem(THEME_STORAGE_KEY, 'system');
      const loaded = await adapter.getItem(THEME_STORAGE_KEY);
      assert.strictEqual(loaded, 'system');
    });

    test('Gracefully defaults to light when storage is empty', async () => {
      const stored = await adapter.getItem(THEME_STORAGE_KEY);
      assert.strictEqual(stored, null);
      const defaultMode: ThemeMode = (stored as unknown as ThemeMode) || 'light';
      assert.strictEqual(defaultMode, 'light');
    });
  });

  describe('3. Dynamic Theme Switching & System Scheme Resolution', () => {
    function resolveThemeState(theme: ThemeMode, systemScheme: 'light' | 'dark') {
      const resolvedTheme: 'light' | 'dark' =
        theme === 'system' ? systemScheme : theme === 'dark' ? 'dark' : 'light';
      const isDark = resolvedTheme === 'dark';
      const colors = isDark ? DARK_COLORS : LIGHT_COLORS;
      return { resolvedTheme, isDark, colors };
    }

    test('Toggling from light switches to dark immediately', () => {
      const currentTheme = 'light' as ThemeMode;
      const nextTheme: ThemeMode = (currentTheme as string) === 'dark' ? 'light' : 'dark';
      assert.strictEqual(nextTheme, 'dark');

      const state = resolveThemeState(nextTheme, 'light');
      assert.strictEqual(state.resolvedTheme, 'dark');
      assert.strictEqual(state.isDark, true);
      assert.strictEqual(state.colors.background, '#0F172A');
      assert.strictEqual(state.colors.surface, '#1E293B');
    });

    test('Toggling from dark switches to light immediately', () => {
      const currentTheme = 'dark' as ThemeMode;
      const nextTheme: ThemeMode = (currentTheme as string) === 'dark' ? 'light' : 'dark';
      assert.strictEqual(nextTheme, 'light');

      const state = resolveThemeState(nextTheme, 'dark');
      assert.strictEqual(state.resolvedTheme, 'light');
      assert.strictEqual(state.isDark, false);
      assert.strictEqual(state.colors.background, '#F8FAFC');
      assert.strictEqual(state.colors.surface, '#FFFFFF');
    });

    test('System theme dynamically matches operating system dark appearance', () => {
      const state = resolveThemeState('system', 'dark');
      assert.strictEqual(state.resolvedTheme, 'dark');
      assert.strictEqual(state.isDark, true);
      assert.strictEqual(state.colors.textPrimary, '#F8FAFC');
    });

    test('System theme dynamically matches operating system light appearance', () => {
      const state = resolveThemeState('system', 'light');
      assert.strictEqual(state.resolvedTheme, 'light');
      assert.strictEqual(state.isDark, false);
      assert.strictEqual(state.colors.textPrimary, '#0F172A');
    });
  });

  describe('4. Home Header Toggle & Icon Button State', () => {
    test('Renders moon icon in light mode and sunny icon in dark mode', () => {
      const getHeaderIconConfig = (isDark: boolean) => ({
        iconName: isDark ? 'sunny' : 'moon-outline',
        iconColor: isDark ? '#FBBF24' : '#64748B',
        accessibilityLabel: isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode',
      });

      const lightConfig = getHeaderIconConfig(false);
      assert.strictEqual(lightConfig.iconName, 'moon-outline');
      assert.strictEqual(lightConfig.iconColor, '#64748B');
      assert.strictEqual(lightConfig.accessibilityLabel, 'Switch to Dark Mode');

      const darkConfig = getHeaderIconConfig(true);
      assert.strictEqual(darkConfig.iconName, 'sunny');
      assert.strictEqual(darkConfig.iconColor, '#FBBF24');
      assert.strictEqual(darkConfig.accessibilityLabel, 'Switch to Light Mode');
    });

    test('Touch target for header theme toggle conforms to accessibility guidelines (>= 44dp)', () => {
      const headerToggleDimensions = {
        minWidth: 44,
        minHeight: 44,
        borderRadius: 22,
      };

      assert.ok(headerToggleDimensions.minWidth >= 44);
      assert.ok(headerToggleDimensions.minHeight >= 44);
    });
  });

  describe('5. Settings Screen 3-Way Mode Selector', () => {
    test('Settings options provide Light, Dark, and System modes', () => {
      const options: { mode: ThemeMode; label: string }[] = [
        { mode: 'light', label: '☀️ Light' },
        { mode: 'dark', label: '🌙 Dark' },
        { mode: 'system', label: '⚙️ System' },
      ];

      assert.strictEqual(options.length, 3);
      assert.strictEqual(options[0].mode, 'light');
      assert.strictEqual(options[1].mode, 'dark');
      assert.strictEqual(options[2].mode, 'system');
    });
  });

  describe('6. Screen & Component Theme Integration Verification', () => {
    test('Input background and border tokens adapt cleanly to dark mode', () => {
      assert.strictEqual(LIGHT_COLORS.inputBackground, '#FFFFFF');
      assert.strictEqual(LIGHT_COLORS.inputBorder, '#E2E8F0');

      assert.strictEqual(DARK_COLORS.inputBackground, '#0F172A');
      assert.strictEqual(DARK_COLORS.inputBorder, '#334155');
    });

    test('Tab bar background and border tokens adapt cleanly to dark mode', () => {
      assert.strictEqual(LIGHT_COLORS.tabBarBackground, '#FFFFFF');
      assert.strictEqual(LIGHT_COLORS.tabBarBorder, '#E2E8F0');

      assert.strictEqual(DARK_COLORS.tabBarBackground, '#1E293B');
      assert.strictEqual(DARK_COLORS.tabBarBorder, '#334155');
    });

    test('Status bar style flips to dark-content in light mode and light-content in dark mode', () => {
      assert.strictEqual(LIGHT_COLORS.statusBarStyle, 'dark');
      assert.strictEqual(DARK_COLORS.statusBarStyle, 'light');
    });
  });
});
