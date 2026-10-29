import React from 'react';
import { Text, StyleProp, TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const IconComponent = Ionicons as unknown as React.ComponentType<{
  name: string;
  size?: number;
  color?: string;
  style?: any;
}>;

export interface WizardIconProps {
  name: string;
  size?: number;
  color?: string;
  style?: StyleProp<TextStyle>;
  fallbackText?: string;
}

export const WizardIcon: React.FC<WizardIconProps> = ({
  name,
  size = 18,
  color = '#0866F5',
  style,
  fallbackText,
}) => {
  try {
    if (IconComponent) {
      return <IconComponent name={name} size={size} color={color} style={style} />;
    }
  } catch {
    // Fallback if vector icons native font is not loaded
  }
  return <Text style={[{ fontSize: size, color }, style]}>{fallbackText || '•'}</Text>;
};

export default WizardIcon;
