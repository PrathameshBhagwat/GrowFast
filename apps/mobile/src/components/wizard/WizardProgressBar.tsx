import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

export interface WizardProgressBarProps {
  currentStepIndex: number;
  steps: { key: string; label: string }[];
  onStepPress?: (stepIndex: number) => void;
}

export const WizardProgressBar: React.FC<WizardProgressBarProps> = ({
  currentStepIndex,
  steps,
  onStepPress,
}) => {
  return (
    <View style={styles.container}>
      {/* Background connecting lines spanning exactly between node centers */}
      <View style={styles.linesRow} pointerEvents="none">
        {steps.slice(0, steps.length - 1).map((_, idx) => (
          <View
            key={`line-${idx}`}
            style={[
              styles.lineSegment,
              idx < currentStepIndex ? styles.lineFilled : styles.lineEmpty,
            ]}
          />
        ))}
      </View>

      {/* 5 Step Nodes */}
      <View style={styles.nodesRow}>
        {steps.map((step, idx) => {
          const isCompleted = idx < currentStepIndex;
          const isActive = idx === currentStepIndex;
          const isClickable = isCompleted && onStepPress;

          return (
            <TouchableOpacity
              key={step.key}
              style={styles.nodeItem}
              disabled={!isClickable}
              onPress={() => isClickable && onStepPress(idx)}
              activeOpacity={isClickable ? 0.7 : 1}
              accessible={true}
              accessibilityRole={isClickable ? 'button' : 'none'}
              accessibilityLabel={`Step ${idx + 1}: ${step.label}${isActive ? ' (current)' : isCompleted ? ' (completed)' : ''}`}
            >
              <View
                style={[
                  styles.circle,
                  isCompleted || isActive ? styles.circleActive : styles.circleInactive,
                ]}
              >
                {isCompleted ? (
                  <Text style={styles.checkmarkText}>✓</Text>
                ) : (
                  <Text
                    style={[
                      styles.circleText,
                      isActive ? styles.circleTextActive : styles.circleTextInactive,
                    ]}
                  >
                    {idx + 1}
                  </Text>
                )}
              </View>

              <Text
                style={[styles.label, isActive ? styles.labelActive : styles.labelInactive]}
                numberOfLines={1}
              >
                {step.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 8,
    paddingTop: 12,
    paddingBottom: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  linesRow: {
    position: 'absolute',
    top: 24, // Vertically centered with circle (12pt padding + 12pt circle radius)
    left: '10%',
    right: '10%',
    flexDirection: 'row',
    height: 2,
    zIndex: 0,
  },
  lineSegment: {
    flex: 1,
    height: 2,
  },
  lineFilled: {
    backgroundColor: '#0866F5',
  },
  lineEmpty: {
    backgroundColor: '#E2E8F0',
  },
  nodesRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    zIndex: 1,
  },
  nodeItem: {
    flex: 1,
    alignItems: 'center',
  },
  circle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  circleActive: {
    backgroundColor: '#0866F5',
  },
  circleInactive: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  checkmarkText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 14,
  },
  circleText: {
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 14,
  },
  circleTextActive: {
    color: '#FFFFFF',
  },
  circleTextInactive: {
    color: '#94A3B8',
  },
  label: {
    fontSize: 11,
    marginTop: 6,
    textAlign: 'center',
  },
  labelActive: {
    color: '#0866F5',
    fontWeight: '700',
  },
  labelInactive: {
    color: '#647894',
    fontWeight: '500',
  },
});
