import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Pressable,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useBranch, ALL_BRANCHES_ID } from '../contexts/BranchContext';
import { useTheme } from '../contexts/ThemeContext';
import { type BranchDTO } from '@growfast/shared-types';

const Icon = Ionicons as unknown as React.ComponentType<{
  name: string;
  size?: number;
  color?: string;
  style?: any;
}>;

interface BranchSelectorProps {
  compact?: boolean;
  onBranchChange?: (branchId: string) => void;
}

export function BranchSelector({ compact = false, onBranchChange }: BranchSelectorProps) {
  const {
    branches,
    activeBranchId,
    activeBranch,
    isAllBranches,
    canSwitchBranch,
    setActiveBranchId,
  } = useBranch();
  const { colors, isDark } = useTheme();

  const [modalVisible, setModalVisible] = useState(false);

  const displayName = isAllBranches ? 'All Branches' : activeBranch?.name || 'Charholi Branch';

  const displayCode = isAllBranches ? 'ALL' : activeBranch?.code || 'CHARHOLI';

  const handleSelectBranch = async (branchId: string) => {
    setModalVisible(false);
    await setActiveBranchId(branchId);
    if (onBranchChange) {
      onBranchChange(branchId);
    }
  };

  const handlePillPress = () => {
    if (canSwitchBranch) {
      setModalVisible(true);
    } else {
      Alert.alert(
        'Assigned Branch',
        `Your account is restricted to ${displayName} (${displayCode}). Only Owner accounts can view or switch branches.`,
        [{ text: 'OK' }],
      );
    }
  };

  return (
    <>
      <TouchableOpacity
        style={[
          styles.selectorPill,
          compact ? styles.compactPill : styles.standardPill,
          {
            backgroundColor: isDark ? colors.surfaceSecondary : '#EFF6FF',
            borderColor: isDark ? colors.border : '#BFDBFE',
          },
        ]}
        onPress={handlePillPress}
        activeOpacity={canSwitchBranch ? 0.7 : 0.9}
        accessibilityRole="button"
        accessibilityLabel={`Active Branch: ${displayName}, ${canSwitchBranch ? 'tap to switch' : 'assigned'}`}
        accessibilityHint={canSwitchBranch ? 'Opens branch selection options' : 'Assigned branch'}
        testID="mobile-branch-selector-button"
      >
        <View style={styles.pillIconContainer}>
          <Icon
            name={isAllBranches ? 'globe-outline' : 'business-outline'}
            size={compact ? 14 : 16}
            color={colors.primary}
          />
        </View>

        <View style={styles.pillTextContainer}>
          <Text
            style={[
              styles.branchNameText,
              compact && styles.compactText,
              { color: colors.textPrimary },
            ]}
            numberOfLines={1}
            testID="mobile-branch-name-text"
          >
            {displayName}
          </Text>
          <View style={styles.codeBadge}>
            <Text style={styles.codeBadgeText}>{displayCode}</Text>
          </View>
        </View>

        {canSwitchBranch && (
          <Icon
            name="chevron-down"
            size={compact ? 13 : 15}
            color={colors.textSecondary}
            style={styles.chevronIcon}
          />
        )}
      </TouchableOpacity>

      {/* Switch Branch Modal (for OWNER) */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setModalVisible(false)}
          accessibilityRole="button"
          accessibilityLabel="Close branch selector modal"
        >
          <Pressable
            style={[
              styles.modalCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <View>
                <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                  Select Active Branch
                </Text>
                <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
                  Choose a store location or view consolidated data
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.closeButton, { backgroundColor: colors.surfaceSecondary }]}
                onPress={() => setModalVisible(false)}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <Icon name="close" size={18} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            {/* Branch Option: All Branches */}
            <TouchableOpacity
              style={[
                styles.optionRow,
                isAllBranches && styles.selectedOptionRow,
                {
                  backgroundColor: isAllBranches ? (isDark ? '#1E293B' : '#EFF6FF') : 'transparent',
                  borderBottomColor: colors.border,
                },
              ]}
              onPress={() => handleSelectBranch(ALL_BRANCHES_ID)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Select All Branches consolidated view"
              testID="option-all-branches"
            >
              <View
                style={[
                  styles.optionIconBox,
                  { backgroundColor: isAllBranches ? colors.primary : colors.surfaceSecondary },
                ]}
              >
                <Icon
                  name="globe-outline"
                  size={20}
                  color={isAllBranches ? '#FFFFFF' : colors.textPrimary}
                />
              </View>
              <View style={styles.optionDetails}>
                <View style={styles.optionTitleRow}>
                  <Text style={[styles.optionTitle, { color: colors.textPrimary }]}>
                    All Branches
                  </Text>
                  <View style={[styles.codeBadge, { backgroundColor: '#3B82F6' }]}>
                    <Text style={styles.codeBadgeText}>ALL</Text>
                  </View>
                </View>
                <Text style={[styles.optionAddress, { color: colors.textSecondary }]}>
                  Consolidated multi-store reporting & analytics
                </Text>
              </View>
              {isAllBranches && <Icon name="checkmark-circle" size={22} color={colors.primary} />}
            </TouchableOpacity>

            {/* Individual Branches (Charholi, Alephata) */}
            {branches.map((b) => {
              const isSelected = !isAllBranches && activeBranchId === b.id;
              return (
                <TouchableOpacity
                  key={b.id}
                  style={[
                    styles.optionRow,
                    isSelected && styles.selectedOptionRow,
                    {
                      backgroundColor: isSelected
                        ? isDark
                          ? '#1E293B'
                          : '#EFF6FF'
                        : 'transparent',
                      borderBottomColor: colors.border,
                    },
                  ]}
                  onPress={() => handleSelectBranch(b.id)}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={`Select ${b.name}`}
                  testID={`option-branch-${b.id}`}
                >
                  <View
                    style={[
                      styles.optionIconBox,
                      { backgroundColor: isSelected ? colors.primary : colors.surfaceSecondary },
                    ]}
                  >
                    <Icon
                      name="business-outline"
                      size={20}
                      color={isSelected ? '#FFFFFF' : colors.textPrimary}
                    />
                  </View>
                  <View style={styles.optionDetails}>
                    <View style={styles.optionTitleRow}>
                      <Text style={[styles.optionTitle, { color: colors.textPrimary }]}>
                        {b.name}
                      </Text>
                      {b.code && (
                        <View style={styles.codeBadge}>
                          <Text style={styles.codeBadgeText}>{b.code}</Text>
                        </View>
                      )}
                    </View>
                    {b.address && (
                      <Text
                        style={[styles.optionAddress, { color: colors.textSecondary }]}
                        numberOfLines={1}
                      >
                        {b.address}
                      </Text>
                    )}
                  </View>
                  {isSelected && <Icon name="checkmark-circle" size={22} color={colors.primary} />}
                </TouchableOpacity>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  selectorPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
  },
  standardPill: {
    height: 44, // Minimum 44dp touch target
    paddingHorizontal: 12,
    alignSelf: 'flex-start',
  },
  compactPill: {
    height: 44, // Minimum 44dp touch target for accessibility
    paddingHorizontal: 8,
  },
  pillIconContainer: {
    marginRight: 6,
  },
  pillTextContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  branchNameText: {
    fontSize: 13,
    fontWeight: '700',
    maxWidth: 160,
  },
  compactText: {
    fontSize: 12,
    maxWidth: 120,
  },
  codeBadge: {
    backgroundColor: '#0284C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  codeBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  chevronIcon: {
    marginLeft: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 440,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  modalSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    minHeight: 56, // >= 44dp touch target
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  selectedOptionRow: {
    borderLeftWidth: 3,
    borderLeftColor: '#0284C7',
  },
  optionIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  optionDetails: {
    flex: 1,
  },
  optionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  optionTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  optionAddress: {
    fontSize: 12,
    marginTop: 2,
  },
});
