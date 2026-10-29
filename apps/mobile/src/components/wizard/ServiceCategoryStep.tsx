import React, { useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import {
  ServiceTypeDTO,
  GarmentCatalogDTO,
  GarmentCategory,
  OrderWorkflowType,
  OrderEntryMode,
  formatCatalogServiceName,
  filterCategoriesForService,
  resolveCatalogSelectionOnServiceSelect,
  resolveCatalogSelectionOnCategoryChange,
  isCategoryAllowedInWorkflow,
  isDryCleanService,
} from '@growfast/shared-types';
import {
  isWeightBasedPricing,
  CANONICAL_WEIGHT_SERVICES,
  CANONICAL_PIECE_SERVICES,
  resolvePieceServices,
  resolveWeightServices,
} from '../../services/catalog-rules';
import { WizardIcon } from './WizardIcon';

export interface ServiceCategoryStepProps {
  workflow: OrderWorkflowType;
  onWorkflowChange?: (workflow: OrderWorkflowType) => void;
  selectedServiceId: string;
  onSelectService: (serviceId: string) => void;
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
  services: ServiceTypeDTO[];
  garments?: GarmentCatalogDTO[];
  isLoadingServices?: boolean;
  cartItemCount: number;
  onContinue: () => void;
  entryMode?: OrderEntryMode;
  onEntryModeChange?: (mode: OrderEntryMode) => void;
}

const DEFAULT_CATEGORIES: { key: string; label: string; icon: string }[] = [
  { key: 'ALL', label: 'All Items', icon: '🔲' },
  { key: GarmentCategory.MEN, label: 'Men', icon: '👔' },
  { key: GarmentCategory.WOMEN, label: 'Women', icon: '👗' },
  { key: GarmentCategory.KIDS, label: 'Kids', icon: '🧒' },
  { key: GarmentCategory.HOUSEHOLD, label: 'Household', icon: '🛏️' },
  { key: GarmentCategory.SHOES, label: 'Shoes', icon: '👟' },
  { key: GarmentCategory.SPECIAL, label: 'Special', icon: '🌟' },
  { key: GarmentCategory.OTHERS, label: 'Others', icon: '📦' },
  { key: GarmentCategory.WEIGHT_BASED, label: 'Weight Based (Exception)', icon: '⚖️' },
];

export const CATEGORIES = DEFAULT_CATEGORIES;
export {
  CANONICAL_WEIGHT_SERVICES,
  CANONICAL_PIECE_SERVICES,
  resolvePieceServices,
  resolveWeightServices,
  isWeightBasedPricing,
};

export function ServiceCategoryStep({
  workflow,
  onWorkflowChange,
  selectedServiceId,
  onSelectService,
  selectedCategory,
  onSelectCategory,
  services,
  garments,
  isLoadingServices = false,
  cartItemCount,
  onContinue,
  entryMode = 'PIECES',
  onEntryModeChange,
}: ServiceCategoryStepProps) {
  const isWeightMode = entryMode === 'WEIGHT';

  // Filter available services based on order mode (Per-Piece vs Per-Weight)
  const availableServices: ServiceTypeDTO[] = useMemo(() => {
    if (isWeightMode) {
      return resolveWeightServices(services);
    }
    return resolvePieceServices(services);
  }, [isWeightMode, services]);

  // Active service object
  const activeService = useMemo(() => {
    return (
      availableServices.find((s) => s.id === selectedServiceId) ||
      services.find((s) => s.id === selectedServiceId) ||
      availableServices[0] ||
      null
    );
  }, [services, selectedServiceId, availableServices]);

  // Auto-select first compatible service if current selection is invalid
  React.useEffect(() => {
    if (availableServices.length > 0) {
      const exists = availableServices.some((s) => s.id === selectedServiceId);
      if (!exists) {
        handleSelectService(availableServices[0].id);
      }
    }
  }, [availableServices, selectedServiceId]);

  const handleSelectService = (svcId: string) => {
    onSelectService(svcId);
    if (!isWeightMode) {
      const svc = services.find((s) => s.id === svcId);
      const isDc = svc ? isDryCleanService(svc.id, services) : false;
      const targetWorkflow: OrderWorkflowType = isDc ? 'DRY_CLEANING' : 'LAUNDRY';
      const resolved = resolveCatalogSelectionOnServiceSelect(
        svcId,
        selectedCategory,
        services,
        targetWorkflow,
      );
      if (resolved.category && String(resolved.category) !== selectedCategory) {
        onSelectCategory(String(resolved.category));
      }
    }
  };

  const getServiceIconName = (name: string): string => {
    const lower = name.toLowerCase();
    if (lower.includes('dry clean')) return 'sparkles';
    if (lower.includes('starch')) return 'shirt-outline';
    if (lower.includes('iron') || lower.includes('press')) return 'flame-outline';
    if (lower.includes('shoe')) return 'footsteps-outline';
    if (lower.includes('fold')) return 'cube-outline';
    if (lower.includes('white')) return 'water-outline';
    if (lower.includes('premium')) return 'ribbon-outline';
    if (lower.includes('woolen')) return 'shirt-outline';
    return 'sparkles-outline';
  };

  const getEstimatedTurnaroundText = (svc: ServiceTypeDTO): string => {
    const days = svc.estimatedDays || 2;
    return `${days} ${days === 1 ? 'day' : 'days'}`;
  };

  return (
    <View style={styles.outerContainer}>
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        {/* ── SECTION 1: SELECT ORDER MODE (Screenshot 2) ── */}
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionIconBox}>
            <WizardIcon name="layers-outline" size={20} color="#0866F5" fallbackText="📑" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionTitle}>Select Order Mode</Text>
            <Text style={styles.sectionSubtitle}>
              Choose primary handling and pricing mode for this order
            </Text>
          </View>
        </View>

        {/* Side-by-side Order Mode Cards */}
        <View style={styles.modeRow}>
          {/* Per-Piece Card */}
          <TouchableOpacity
            style={[
              styles.modeCard,
              !isWeightMode ? styles.modeCardActive : styles.modeCardInactive,
            ]}
            onPress={() => {
              if (isWeightMode) {
                onEntryModeChange?.('PIECES');
              }
            }}
            accessible={true}
            accessibilityRole="radio"
            accessibilityState={{ selected: !isWeightMode }}
            accessibilityLabel="Per-Piece Order Mode"
            activeOpacity={0.8}
          >
            <View style={styles.modeCardTop}>
              <View
                style={[
                  styles.radioOuter,
                  !isWeightMode ? styles.radioOuterActive : styles.radioOuterInactive,
                ]}
              >
                {!isWeightMode && <View style={styles.radioInnerDot} />}
              </View>
            </View>

            <View style={styles.modeIconCircle}>
              <WizardIcon name="shirt-outline" size={22} color="#0866F5" fallbackText="👕" />
            </View>

            <Text style={styles.modeTitle}>Per-Piece</Text>
            <Text style={styles.modeDesc}>Individual garment pricing & dry clean</Text>
          </TouchableOpacity>

          {/* Per-Weight Card */}
          <TouchableOpacity
            style={[
              styles.modeCard,
              isWeightMode ? styles.modeCardActive : styles.modeCardInactive,
            ]}
            onPress={() => {
              if (!isWeightMode) {
                onEntryModeChange?.('WEIGHT');
              }
            }}
            accessible={true}
            accessibilityRole="radio"
            accessibilityState={{ selected: isWeightMode }}
            accessibilityLabel="Per-Weight Order Mode"
            activeOpacity={0.8}
          >
            <View style={styles.modeCardTop}>
              <View
                style={[
                  styles.radioOuter,
                  isWeightMode ? styles.radioOuterActive : styles.radioOuterInactive,
                ]}
              >
                {isWeightMode && <View style={styles.radioInnerDot} />}
              </View>
            </View>

            <View style={styles.modeIconCircle}>
              <WizardIcon name="barbell-outline" size={22} color="#0866F5" fallbackText="⚖️" />
            </View>

            <Text style={styles.modeTitle}>Per-Weight</Text>
            <Text style={styles.modeDesc}>Batch laundry weighed in kg (min 2.0 kg)</Text>
          </TouchableOpacity>
        </View>

        {/* ── SECTION 2: SELECT SERVICE TYPE (Screenshot 2) ── */}
        <View style={[styles.sectionHeaderRow, { marginTop: 24 }]}>
          <View style={styles.sectionIconBox}>
            <WizardIcon name="sparkles-outline" size={20} color="#0866F5" fallbackText="✨" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionTitle}>Select Service Type</Text>
            <Text style={styles.sectionSubtitle}>
              Applies context to catalog prices and estimated turnaround
            </Text>
          </View>
        </View>

        {/* 2-Column Grid of Service Cards */}
        {isLoadingServices ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#0866F5" />
            <Text style={styles.loadingText}>Loading available services...</Text>
          </View>
        ) : (
          <View style={styles.servicesGrid}>
            {availableServices.map((svc) => {
              const isSelected = svc.id === selectedServiceId;
              const iconName = getServiceIconName(svc.name);
              const turnaround = getEstimatedTurnaroundText(svc);
              const displayName = formatCatalogServiceName(svc.name);

              return (
                <TouchableOpacity
                  key={svc.id}
                  style={[
                    styles.serviceCard,
                    isSelected ? styles.serviceCardActive : styles.serviceCardInactive,
                  ]}
                  onPress={() => handleSelectService(svc.id)}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel={`Service: ${displayName}, estimated turnaround ${turnaround}`}
                  activeOpacity={0.8}
                >
                  {/* Top Right Checkmark Badge when Selected */}
                  {isSelected && (
                    <View style={styles.selectedBadge}>
                      <WizardIcon name="checkmark" size={13} color="#FFFFFF" fallbackText="✓" />
                    </View>
                  )}

                  {/* Service Icon Circle */}
                  <View
                    style={[styles.serviceIconCircle, isSelected && styles.serviceIconCircleActive]}
                  >
                    <WizardIcon name={iconName} size={24} color="#0866F5" fallbackText="✨" />
                  </View>

                  {/* Service Name */}
                  <Text
                    style={[
                      styles.serviceTitle,
                      isSelected ? styles.serviceTitleActive : styles.serviceTitleInactive,
                    ]}
                    numberOfLines={1}
                  >
                    {displayName}
                  </Text>

                  {/* Turnaround with Clock Icon */}
                  <View style={styles.turnaroundRow}>
                    <WizardIcon
                      name="time-outline"
                      size={14}
                      color={isSelected ? '#0866F5' : '#647894'}
                      fallbackText="⏱"
                    />
                    <Text
                      style={[
                        styles.turnaroundText,
                        isSelected ? styles.turnaroundTextActive : styles.turnaroundTextInactive,
                      ]}
                    >
                      {turnaround}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Sticky Bottom Action (Screenshot 2) */}
      <View style={styles.bottomFooter}>
        <TouchableOpacity
          style={styles.continueButton}
          onPress={onContinue}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel={`Continue to Garment Catalog (${cartItemCount} in cart)`}
        >
          <Text style={styles.continueButtonText}>
            Continue to Garment Catalog ({cartItemCount} in cart) →
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 24,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  sectionIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#EDF5FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#101F3D',
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#647894',
    marginTop: 2,
    lineHeight: 18,
  },
  modeRow: {
    flexDirection: 'row',
    gap: 12,
  },
  modeCard: {
    flex: 1,
    borderRadius: 16,
    padding: 14,
    minHeight: 140,
    ...Platform.select({
      web: {
        boxShadow: '0 2px 8px rgba(8, 102, 245, 0.05)',
      },
      default: {
        shadowColor: '#0866F5',
        shadowOpacity: 0.05,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
        elevation: 2,
      },
    }),
  },
  modeCardActive: {
    backgroundColor: '#F0F7FF',
    borderWidth: 1.5,
    borderColor: '#0866F5',
  },
  modeCardInactive: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DCE5F0',
  },
  modeCardTop: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginBottom: 8,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterActive: {
    borderWidth: 2,
    borderColor: '#0866F5',
    backgroundColor: '#FFFFFF',
  },
  radioOuterInactive: {
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
  },
  radioInnerDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#0866F5',
  },
  modeIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EDF5FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  modeTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#101F3D',
    marginBottom: 4,
  },
  modeDesc: {
    fontSize: 12,
    color: '#647894',
    lineHeight: 16,
  },
  servicesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  serviceCard: {
    width: '48%',
    borderRadius: 16,
    padding: 14,
    minHeight: 125,
    position: 'relative',
    ...Platform.select({
      web: {
        boxShadow: '0 2px 8px rgba(8, 102, 245, 0.05)',
      },
      default: {
        shadowColor: '#0866F5',
        shadowOpacity: 0.05,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
        elevation: 2,
      },
    }),
  },
  serviceCardActive: {
    backgroundColor: '#F0F7FF',
    borderWidth: 1.5,
    borderColor: '#0866F5',
  },
  serviceCardInactive: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DCE5F0',
  },
  selectedBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#0866F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EDF5FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  serviceIconCircleActive: {
    backgroundColor: '#DBEAFE',
  },
  serviceTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 6,
  },
  serviceTitleActive: {
    color: '#0866F5',
  },
  serviceTitleInactive: {
    color: '#101F3D',
  },
  turnaroundRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  turnaroundText: {
    fontSize: 12,
    fontWeight: '500',
  },
  turnaroundTextActive: {
    color: '#0866F5',
    fontWeight: '600',
  },
  turnaroundTextInactive: {
    color: '#647894',
  },
  loadingContainer: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 13,
    color: '#647894',
    marginTop: 8,
  },
  bottomFooter: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  continueButton: {
    backgroundColor: '#0866F5',
    minHeight: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: {
        boxShadow: '0 4px 12px rgba(8, 102, 245, 0.25)',
      },
      default: {
        shadowColor: '#0866F5',
        shadowOpacity: 0.25,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 3 },
        elevation: 4,
      },
    }),
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
