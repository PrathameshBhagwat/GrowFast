import React, { useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import {
  ServiceTypeDTO,
  GarmentCategory,
  ServiceCategory,
  OrderWorkflowType,
  OrderEntryMode,
  formatCatalogServiceName,
  filterCategoriesForService,
  resolveCatalogSelectionOnServiceSelect,
  resolveCatalogSelectionOnCategoryChange,
  isWeightBasedCategory,
  isServiceAllowedInWorkflow,
  isCategoryAllowedInWorkflow,
  isDryCleanService,
} from '@growfast/shared-types';

export interface ServiceCategoryStepProps {
  workflow: OrderWorkflowType;
  onWorkflowChange: (workflow: OrderWorkflowType) => void;
  selectedServiceId: string;
  onSelectService: (serviceId: string) => void;
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
  services: ServiceTypeDTO[];
  isLoadingServices?: boolean;
  cartItemCount: number;
  onContinue: () => void;
  entryMode?: OrderEntryMode;
  onEntryModeChange?: (mode: OrderEntryMode) => void;
}

const CATEGORIES: { key: string; label: string; icon: string }[] = [
  { key: 'ALL', label: 'All Items', icon: '🔲' },
  { key: GarmentCategory.MEN, label: 'Men', icon: '👔' },
  { key: GarmentCategory.WOMEN, label: 'Women', icon: '👗' },
  { key: GarmentCategory.KIDS, label: 'Kids', icon: '🧒' },
  { key: GarmentCategory.HOUSEHOLD, label: 'Household', icon: '🛏️' },
  { key: GarmentCategory.SHOES, label: 'Shoes', icon: '👟' },
  { key: GarmentCategory.OTHERS, label: 'Others', icon: '📦' },
];

import { isWeightBasedPricing, CANONICAL_WEIGHT_SERVICES } from '../../services/catalog-rules';
export { CANONICAL_WEIGHT_SERVICES, isWeightBasedPricing };

export function ServiceCategoryStep({
  workflow,
  onWorkflowChange,
  selectedServiceId,
  onSelectService,
  selectedCategory,
  onSelectCategory,
  services,
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
      // Per-Weight mode: Display the five existing website laundry services
      return CANONICAL_WEIGHT_SERVICES.map((canonical) => {
        const match = services.find((s) => {
          const sId = (s.id || '').toLowerCase();
          const sName = (s.name || '').trim().toLowerCase();
          if (sId === 'svc-wash' || sName === 'standard wash') return false;

          if (canonical.id === 'svc-wash-iron') {
            return (
              sId === 'svc-wash-iron' ||
              sId === 'srv-wash-iron' ||
              sName === 'wash and steam iron' ||
              sName === 'wash & steam iron' ||
              sName === 'wash + steam iron' ||
              (sName.includes('steam') && sName.includes('iron'))
            );
          }
          if (canonical.id === 'svc-wash-fold') {
            return (
              sId === 'svc-wash-fold' ||
              sId === 'srv-wash-fold' ||
              sName === 'wash and fold' ||
              sName === 'wash & fold' ||
              (sName.includes('fold') && !sName.includes('iron'))
            );
          }
          if (canonical.id === 'svc-laundry-white') {
            return sId === 'svc-laundry-white' || sName.includes('white');
          }
          if (canonical.id === 'svc-laundry-premium') {
            return (
              sId === 'svc-laundry-premium' ||
              sId === 'srv-premium-wash' ||
              sName.includes('premium')
            );
          }
          if (canonical.id === 'svc-laundry-woolen') {
            return sId === 'svc-laundry-woolen' || sName.includes('woolen');
          }
          return false;
        });

        if (match) {
          return {
            ...match,
            name: canonical.name,
            estimatedDays: match.estimatedDays ?? canonical.estimatedDays,
          };
        }
        return { ...canonical };
      });
    }

    // Per-Piece mode:
    // Retain existing per-piece services (Dry Clean, Steam Iron, Wash + Steam Iron, Standard Wash, Starching, Shoe Cleaning).
    // Do NOT display per-weight-only services (Wash and Fold, Laundry for White, Premium Laundry, Woolen Laundry).
    // Remove Steam Press Only completely from selectable services.
    // Rename Wash & Iron to Starching while preserving IDs, pricing, turnaround times, and backend integration.
    const pieceServices = services.filter((svc) => {
      if (!svc.isActive) return false;
      const name = svc.name.trim().toLowerCase();
      const sId = (svc.id || '').toLowerCase();
      if (name === 'free shoe' || sId === 'srv-free-shoe') return false;

      // 1. Remove Steam Press Only completely from the selectable service list
      if (
        name === 'steam press only' ||
        sId === 'srv-steam-press' ||
        sId === 'svc-steam-press-only'
      ) {
        return false;
      }

      // Exclude weight-only services
      const isWeightOnly =
        sId === 'svc-wash-fold' ||
        sId === 'srv-wash-fold' ||
        name === 'wash and fold' ||
        name === 'wash & fold' ||
        sId === 'svc-laundry-white' ||
        name.includes('white') ||
        sId === 'svc-laundry-premium' ||
        sId === 'srv-premium-wash' ||
        name.includes('premium') ||
        sId === 'svc-laundry-woolen' ||
        name.includes('woolen');

      if (isWeightOnly) return false;
      return true;
    });

    const seenNames = new Set<string>();
    const result: ServiceTypeDTO[] = [];

    for (const svc of pieceServices) {
      const lower = svc.name.trim().toLowerCase();
      const isWashIron = lower === 'wash & iron' || lower === 'wash and iron';
      const resolvedName = isWashIron ? 'Starching' : svc.name;
      const displayKey = formatCatalogServiceName(resolvedName).toLowerCase();

      // Avoid duplicate service definitions if an existing Starching service is already in list
      if (seenNames.has(displayKey)) {
        continue;
      }
      seenNames.add(displayKey);

      if (isWashIron) {
        result.push({
          ...svc,
          name: 'Starching',
        });
      } else {
        result.push(svc);
      }
    }

    return result;
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

  // Is weight-based pricing active?
  const isWeightBased = useMemo(() => {
    return isWeightBasedPricing(workflow, activeService, entryMode, selectedCategory);
  }, [workflow, activeService, entryMode, selectedCategory]);

  // Filter available categories based on active service and workflow (for per-piece services only)
  const availableCategories = useMemo(() => {
    if (isWeightMode) {
      // Critical business rule: Per-weight laundry must not display garment-category selector
      return [];
    }
    const baseCategories = CATEGORIES.filter(
      (cat) =>
        cat.key !== GarmentCategory.WEIGHT_BASED &&
        cat.key !== GarmentCategory.HOME_CLEANING &&
        cat.key !== 'HOME_CLEANING' &&
        (cat.key === 'ALL' || isCategoryAllowedInWorkflow(cat.key as GarmentCategory, workflow)),
    );
    const filteredKeys = filterCategoriesForService(
      baseCategories.map((c) => c.key),
      selectedServiceId,
      availableServices.length > 0 ? availableServices : services,
      workflow,
    );
    return baseCategories.filter((c) => filteredKeys.includes(c.key));
  }, [isWeightMode, workflow, selectedServiceId, services, availableServices]);

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
    if (isWeightMode) {
      onSelectService(svcId);
      onWorkflowChange('LAUNDRY');
      return;
    }

    const svc = services.find((s) => s.id === svcId);
    const isDc = svc ? isDryCleanService(svc.id, services) : false;
    const targetWorkflow: OrderWorkflowType = isDc ? 'DRY_CLEANING' : 'LAUNDRY';
    onWorkflowChange(targetWorkflow);

    const resolved = resolveCatalogSelectionOnServiceSelect(
      svcId,
      selectedCategory,
      services,
      targetWorkflow,
    );
    onSelectService(resolved.serviceId);
    if (resolved.category && String(resolved.category) !== selectedCategory) {
      onSelectCategory(String(resolved.category));
    }
  };

  const handleSelectCategory = (catKey: string) => {
    onSelectCategory(catKey);
    const resolvedSvcId = resolveCatalogSelectionOnCategoryChange(
      catKey,
      selectedServiceId,
      services,
      workflow,
    );
    if (resolvedSvcId !== selectedServiceId) {
      onSelectService(resolvedSvcId);
    }
  };

  const getServiceIcon = (name: string): string => {
    const lower = name.toLowerCase();
    if (lower.includes('dry clean')) return '✨';
    if (
      lower.includes('starch') ||
      lower.includes('wash & iron') ||
      lower.includes('wash and iron')
    )
      return '👔';
    if (lower.includes('iron') || lower.includes('press')) return '♨️';
    if (lower.includes('fold')) return '🧺';
    if (lower.includes('white')) return '🫧';
    if (lower.includes('premium')) return '🌟';
    if (lower.includes('woolen')) return '🧶';
    if (lower.includes('shoe')) return '👟';
    return '🧺';
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {/* Step 2: Select Order Mode */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Select Order Mode</Text>
        <Text style={styles.sectionSubtitle}>
          Choose primary handling and pricing mode for this order
        </Text>
      </View>

      <View style={styles.modeRow}>
        <TouchableOpacity
          style={[styles.modeCard, !isWeightMode && styles.modeCardActive]}
          onPress={() => {
            if (!isWeightMode) return;
            onEntryModeChange?.('PIECES');
          }}
          accessible={true}
          accessibilityRole="radio"
          accessibilityState={{ selected: !isWeightMode }}
          accessibilityLabel="Per-Piece Order"
        >
          <View style={styles.modeCardContent}>
            <View style={[styles.radioCircle, !isWeightMode && styles.radioCircleActive]}>
              {!isWeightMode && <View style={styles.radioDot} />}
            </View>
            <View style={styles.modeTextContainer}>
              <Text style={[styles.modeTitle, !isWeightMode && styles.modeTitleActive]}>
                Per-Piece
              </Text>
              <Text style={styles.modeDesc}>Individual garment pricing & dry clean</Text>
            </View>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.modeCard, isWeightMode && styles.modeCardActive]}
          onPress={() => {
            if (isWeightMode) return;
            onEntryModeChange?.('WEIGHT');
          }}
          accessible={true}
          accessibilityRole="radio"
          accessibilityState={{ selected: isWeightMode }}
          accessibilityLabel="Per-Weight Order"
        >
          <View style={styles.modeCardContent}>
            <View style={[styles.radioCircle, isWeightMode && styles.radioCircleActive]}>
              {isWeightMode && <View style={styles.radioDot} />}
            </View>
            <View style={styles.modeTextContainer}>
              <Text style={[styles.modeTitle, isWeightMode && styles.modeTitleActive]}>
                Per-Weight
              </Text>
              <Text style={styles.modeDesc}>Batch laundry weighed in kg (min 2.0 kg)</Text>
            </View>
          </View>
        </TouchableOpacity>
      </View>

      {/* Service Selection Grid */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>
          {isWeightMode ? 'Select Laundry Service' : 'Select Service Type'}
        </Text>
        <Text style={styles.sectionSubtitle}>
          Applies context to catalog prices and estimated turnaround
        </Text>
      </View>

      {isLoadingServices ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#2563eb" />
          <Text style={styles.loadingText}>Loading available services...</Text>
        </View>
      ) : availableServices.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No services available for this mode.</Text>
        </View>
      ) : (
        <View style={styles.serviceGrid}>
          {availableServices.map((svc) => {
            const isSelected = svc.id === selectedServiceId;
            const displayName =
              svc.name.trim().toLowerCase() === 'wash & iron' ||
              svc.name.trim().toLowerCase() === 'wash and iron'
                ? 'Starching'
                : formatCatalogServiceName(svc.name);
            return (
              <TouchableOpacity
                key={svc.id}
                style={[styles.serviceCard, isSelected && styles.serviceCardActive]}
                onPress={() => handleSelectService(svc.id)}
                accessible={true}
                accessibilityLabel={`Select service ${displayName}`}
              >
                <View
                  style={[
                    styles.serviceIconContainer,
                    isSelected && styles.serviceIconContainerActive,
                  ]}
                >
                  <Text style={styles.serviceIconEmoji}>{getServiceIcon(svc.name)}</Text>
                </View>
                <Text
                  style={[styles.serviceName, isSelected && styles.serviceNameActive]}
                  numberOfLines={2}
                >
                  {displayName}
                </Text>
                {svc.estimatedDays != null && (
                  <Text
                    style={[styles.serviceTurnaround, isSelected && styles.serviceTurnaroundActive]}
                  >
                    ⏱ {svc.estimatedDays} {svc.estimatedDays === 1 ? 'day' : 'days'}
                  </Text>
                )}
                {isSelected && (
                  <View style={styles.selectedBadge}>
                    <Text style={styles.selectedBadgeText}>✓</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Critical Business Rule: Per-Weight Laundry hides garment category selector */}
      {isWeightMode ? (
        <View style={styles.weightIntakeNotice}>
          <View style={styles.weightNoticeHeader}>
            <View style={styles.weightNoticeIconCircle}>
              <Text style={styles.weightNoticeIcon}>⚖️</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.weightNoticeTitle}>Per-Kg Weight Laundry</Text>
              <Text style={styles.weightNoticeDesc}>
                Garment-category filtering is hidden for per-kg laundry (min 2.00 kg). Batch laundry
                is weighed directly with piece counts and photos in the next step.
              </Text>
            </View>
          </View>
          <View style={styles.weightBadgeRow}>
            <View style={styles.weightBadge}>
              <Text style={styles.weightBadgeText}>Min 2.00 kg</Text>
            </View>
            <View style={styles.weightBadge}>
              <Text style={styles.weightBadgeText}>Bulk Weighing</Text>
            </View>
            <View style={styles.weightBadge}>
              <Text style={styles.weightBadgeText}>Piece Tag Tracking</Text>
            </View>
          </View>
        </View>
      ) : (
        <>
          {/* Category Selection Grid (Only rendered for per-piece services) */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Filter Garment Category</Text>
            <Text style={styles.sectionSubtitle}>
              Narrow down catalog garments or select All Items
            </Text>
          </View>

          <View style={styles.categoryGrid}>
            {availableCategories.map((cat) => {
              const isSelected = selectedCategory === cat.key;
              return (
                <TouchableOpacity
                  key={cat.key}
                  style={[styles.categoryCard, isSelected && styles.categoryCardActive]}
                  onPress={() => handleSelectCategory(cat.key)}
                  accessible={true}
                  accessibilityLabel={`Select category ${cat.label}`}
                >
                  <Text style={styles.categoryIcon}>{cat.icon}</Text>
                  <Text
                    style={[styles.categoryLabel, isSelected && styles.categoryLabelActive]}
                    numberOfLines={1}
                  >
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </>
      )}

      {/* Bottom Action */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.continueButton}
          onPress={onContinue}
          accessible={true}
          accessibilityLabel={
            isWeightMode
              ? `Continue to Weight Intake (${cartItemCount} in cart)`
              : `Continue to Garment Catalog (${cartItemCount} in cart)`
          }
        >
          <Text style={styles.continueButtonText}>
            {isWeightMode
              ? `Continue to Weight Intake (${cartItemCount} in cart) →`
              : `Continue to Garment Catalog (${cartItemCount} in cart) →`}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollContent: {
    padding: 12,
    paddingBottom: 28,
  },
  sectionHeader: {
    marginTop: 8,
    marginBottom: 6,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 1,
  },
  modeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  modeCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    padding: 10,
    minHeight: 70,
  },
  modeCardActive: {
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff',
  },
  modeCardContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  radioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#94a3b8',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  radioCircleActive: {
    borderColor: '#2563eb',
  },
  radioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2563eb',
  },
  modeTextContainer: {
    flex: 1,
  },
  modeTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  modeTitleActive: {
    color: '#1d4ed8',
  },
  modeDesc: {
    fontSize: 10.5,
    color: '#64748b',
    marginTop: 2,
    lineHeight: 14,
  },
  workflowRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  workflowCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    minHeight: 72,
  },
  workflowCardActive: {
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff',
  },
  workflowIcon: {
    fontSize: 20,
    marginBottom: 2,
  },
  workflowTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e293b',
  },
  workflowTitleActive: {
    color: '#1d4ed8',
  },
  workflowDesc: {
    fontSize: 10.5,
    color: '#64748b',
    marginTop: 2,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 8,
  },
  loadingText: {
    color: '#64748b',
    fontSize: 12,
  },
  emptyContainer: {
    padding: 16,
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  emptyText: {
    color: '#94a3b8',
    fontSize: 12,
  },
  serviceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  serviceCard: {
    width: '48.5%',
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 8,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    position: 'relative',
    minHeight: 70,
  },
  serviceCardActive: {
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff',
  },
  serviceIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  serviceIconContainerActive: {
    backgroundColor: '#dbeafe',
  },
  serviceIconEmoji: {
    fontSize: 15,
  },
  serviceName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1e293b',
    lineHeight: 15,
  },
  serviceNameActive: {
    color: '#1d4ed8',
  },
  serviceTurnaround: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 2,
  },
  serviceTurnaroundActive: {
    color: '#2563eb',
    fontWeight: '600',
  },
  selectedBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
  },
  weightIntakeNotice: {
    backgroundColor: '#eff6ff',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#bfdbfe',
    padding: 12,
    marginTop: 2,
    marginBottom: 14,
  },
  weightNoticeHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  weightNoticeIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  weightNoticeIcon: {
    fontSize: 17,
  },
  weightNoticeTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e40af',
  },
  weightNoticeDesc: {
    fontSize: 11,
    color: '#3b82f6',
    marginTop: 2,
    lineHeight: 16,
  },
  weightBadgeRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#dbeafe',
  },
  weightBadge: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  weightBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#1d4ed8',
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 14,
  },
  categoryCard: {
    width: '31.5%',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    minHeight: 48,
  },
  categoryCardActive: {
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff',
  },
  categoryIcon: {
    fontSize: 14,
    marginBottom: 2,
  },
  categoryLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#334155',
    textAlign: 'center',
  },
  categoryLabelActive: {
    color: '#1d4ed8',
    fontWeight: '700',
  },
  bottomBar: {
    marginTop: 8,
  },
  continueButton: {
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 46,
  },
  continueButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
});
