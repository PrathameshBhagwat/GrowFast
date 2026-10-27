import React from 'react';

export type LogoSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export interface GrowFastLogoProps {
  /**
   * Predefined size preset or custom numeric dimension in pixels:
   * - 'xs': 24x24
   * - 'sm': 32x32
   * - 'md': 44x44
   * - 'lg': 72x72
   * - 'xl': 100x100
   * Defaults to 'md' (44x44).
   */
  size?: LogoSize | number;
  width?: number | string;
  height?: number | string;
  className?: string;
  style?: React.CSSProperties;
  alt?: string;
  id?: string;
}

const SIZE_MAP: Record<LogoSize, number> = {
  xs: 24,
  sm: 32,
  md: 44,
  lg: 72,
  xl: 100,
};

export const GrowFastLogo: React.FC<GrowFastLogoProps> = ({
  size = 'md',
  width,
  height,
  className = '',
  style,
  alt = 'GrowFast Official Logo',
  id = 'growfast-logo',
}) => {
  const dimension = typeof size === 'number' ? size : SIZE_MAP[size] || SIZE_MAP.md;
  const finalWidth = width ?? dimension;
  const finalHeight = height ?? dimension;

  return (
    <img
      id={id}
      src="/Growfast_Logo_WithoutBG.png"
      alt={alt}
      width={finalWidth}
      height={finalHeight}
      className={`select-none shrink-0 ${className}`}
      style={{
        width: typeof finalWidth === 'number' ? `${finalWidth}px` : finalWidth,
        height: typeof finalHeight === 'number' ? `${finalHeight}px` : finalHeight,
        objectFit: 'contain',
        ...style,
      }}
    />
  );
};

export default GrowFastLogo;
