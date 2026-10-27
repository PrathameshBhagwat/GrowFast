import React from 'react';
import { Image, ImageStyle, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

export type LogoSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export interface GrowFastLogoProps {
  /**
   * Predefined size preset or custom numeric dimension (width & height).
   * - 'xs': 24x24
   * - 'sm': 32x32
   * - 'md': 44x44
   * - 'lg': 72x72
   * - 'xl': 100x100
   * Defaults to 'md' (44x44).
   */
  size?: LogoSize | number;
  /** Explicit width override (maintains contain resizeMode) */
  width?: number;
  /** Explicit height override (maintains contain resizeMode) */
  height?: number;
  /** Additional image style overrides */
  style?: StyleProp<ImageStyle>;
  /** Optional container style */
  containerStyle?: StyleProp<ViewStyle>;
  /** Accessibility label for screen readers */
  accessibilityLabel?: string;
  /** Test identifier */
  testID?: string;
}

const SIZE_MAP: Record<LogoSize, number> = {
  xs: 24,
  sm: 32,
  md: 44,
  lg: 72,
  xl: 100,
};

// Official GrowFast logo asset with transparent background
const OFFICIAL_LOGO_SOURCE = require('../assets/Growfast_Logo_WithoutBG.png');

export const GrowFastLogo: React.FC<GrowFastLogoProps> = ({
  size = 'md',
  width,
  height,
  style,
  containerStyle,
  accessibilityLabel = 'GrowFast Official Logo',
  testID = 'growfast-logo',
}) => {
  const dimension = typeof size === 'number' ? size : SIZE_MAP[size] || SIZE_MAP.md;
  const finalWidth = width ?? dimension;
  const finalHeight = height ?? dimension;

  return (
    <View style={[styles.container, containerStyle]}>
      <Image
        source={OFFICIAL_LOGO_SOURCE}
        style={[
          {
            width: finalWidth,
            height: finalHeight,
          },
          style,
        ]}
        resizeMode="contain"
        accessible={true}
        accessibilityRole="image"
        accessibilityLabel={accessibilityLabel}
        testID={testID}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default GrowFastLogo;
