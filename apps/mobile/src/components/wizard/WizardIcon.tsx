import React from 'react';
import { Text, StyleProp, TextStyle } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

const IoniconComponent = Ionicons as unknown as React.ComponentType<{
  name: string;
  size?: number;
  color?: string;
  style?: any;
}>;

const MciComponent = MaterialCommunityIcons as unknown as React.ComponentType<{
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
  family?: 'ionicons' | 'mci' | 'material-community';
}

export const WizardIcon: React.FC<WizardIconProps> = ({
  name,
  size = 18,
  color = '#0866F5',
  style,
  fallbackText,
  family = 'ionicons',
}) => {
  try {
    if (family === 'mci' || family === 'material-community') {
      if (MciComponent) {
        return <MciComponent name={name} size={size} color={color} style={style} />;
      }
    } else {
      if (IoniconComponent) {
        return <IoniconComponent name={name} size={size} color={color} style={style} />;
      }
    }
  } catch {
    // Fallback if vector icons native font is not loaded
  }
  return <Text style={[{ fontSize: size, color }, style]}>{fallbackText || '•'}</Text>;
};

export default WizardIcon;
