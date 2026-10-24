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
  OrderWorkflowType,
  formatCatalogServiceName,
  filterServicesForCategory,
  isShoeCategory,
  isWeightBasedCategory,
  isServiceAllowedInWorkflow,
  isCategoryAllowedInWorkflow,
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
}

const CATEGORIES: { key: string; label: string; icon: string }[] = [
  { key: 'ALL', label: 'All Items', icon: '🔲' },
  { key: GarmentCategory.MEN, label: 'Men', icon: '👔' },
  { key: GarmentCategory.WOMEN, label: 'Women', icon: '👗' },
  { key: GarmentCategory.KIDS, label: 'Kids', icon: '🧒' },
  { key: GarmentCategory.HOUSEHOLD, label: 'Household', icon: '🛏️' },
  { key: GarmentCategory.WEIGHT_BASED, label: 'Per Kg Laundry', icon: '⚖️' },
  { key: GarmentCategory.OTHERS, label: 'Others', icon: '📦' },
];

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
}: ServiceCategoryStepProps) {
  // Filter available services based on workflow and active category
  const availableServices = useMemo(() => {
    return services.filter((svc) => {
      if (!svc.isActive) return false;
      if (!isServiceAllowedInWorkflow(svc, workflow)) return false;
      if (selectedCategory && selectedCategory !== 'ALL') {
        const catServices = filterServicesForCategory(services, selectedCategory, workflow);
        return catServices.some((s) => s.id === svc.id);
      }
      return true;
    });
  }, [services, workflow, selectedCategory]);

  // Filter available categories based on workflow
  const availableCategories = useMemo(() => {
    return CATEGORIES.filter((cat) => {
      if (cat.key === 'ALL') return true;
      return isCategoryAllowedInWorkflow(cat.key as GarmentCategory, workflow);
    });
  }, [workflow]);

  // Auto-select first compatible service if current is invalid
  React.useEffect(() => {
    if (availableServices.length > 0) {
      const exists = availableServices.some((s) => s.id === selectedServiceId);
      if (!exists) {
        onSelectService(availableServices[0].id);
      }
    }
  }, [availableServices, selectedServiceId, onSelectService]);

  const getServiceIcon = (name: string): string => {
    const lower = name.toLowerCase();
    if (lower.includes('dry clean')) return '✨';
    if (lower.includes('iron') || lower.includes('press')) return '♨️';
    if (lower.includes('shoe')) return '👟';
    if (lower.includes('premium')) return '🫧';
    return '🧺';
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {/* Workflow Selector (Laundry vs Dry Cleaning) */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Processing Workflow</Text>
        <Text style={styles.sectionSubtitle}>Choose primary handling track for this order</Text>
      </View>

      <View style={styles.workflowRow}>
        <TouchableOpacity
          style={[styles.workflowCard, workflow === 'LAUNDRY' && styles.workflowCardActive]}
          onPress={() => onWorkflowChange('LAUNDRY')}
          accessible={true}
          accessibilityLabel="Switch to Standard Laundry Workflow"
        >
          <Text style={styles.workflowIcon}>🧺</Text>
          <Text
            style={[styles.workflowTitle, workflow === 'LAUNDRY' && styles.workflowTitleActive]}
          >
            Laundry
          </Text>
          <Text style={styles.workflowDesc}>Wash, Iron & Per-Kg</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.workflowCard, workflow === 'DRY_CLEANING' && styles.workflowCardActive]}
          onPress={() => onWorkflowChange('DRY_CLEANING')}
          accessible={true}
          accessibilityLabel="Switch to Dry Cleaning Workflow"
        >
          <Text style={styles.workflowIcon}>✨</Text>
          <Text
            style={[
              styles.workflowTitle,
              workflow === 'DRY_CLEANING' && styles.workflowTitleActive,
            ]}
          >
            Dry Cleaning
          </Text>
          <Text style={styles.workflowDesc}>Strictly Per-Piece</Text>
        </TouchableOpacity>
      </View>

      {/* Service Selection Grid */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Select Service Type</Text>
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
          <Text style={styles.emptyText}>No services available for this workflow.</Text>
        </View>
      ) : (
        <View style={styles.serviceGrid}>
          {availableServices.map((svc) => {
            const isSelected = svc.id === selectedServiceId;
            const displayName = formatCatalogServiceName(svc.name);
            return (
              <TouchableOpacity
                key={svc.id}
                style={[styles.serviceCard, isSelected && styles.serviceCardActive]}
                onPress={() => onSelectService(svc.id)}
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

      {/* Category Selection Grid */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Filter Garment Category</Text>
        <Text style={styles.sectionSubtitle}>Narrow down catalog garments or select All Items</Text>
      </View>

      <View style={styles.categoryGrid}>
        {availableCategories.map((cat) => {
          const isSelected = selectedCategory === cat.key;
          return (
            <TouchableOpacity
              key={cat.key}
              style={[styles.categoryCard, isSelected && styles.categoryCardActive]}
              onPress={() => onSelectCategory(cat.key)}
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

      {/* Bottom Action */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.continueButton}
          onPress={onContinue}
          accessible={true}
          accessibilityLabel="Continue to Garment Catalog"
        >
          <Text style={styles.continueButtonText}>
            Continue to Garments ({cartItemCount} in cart) →
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
    padding: 16,
    paddingBottom: 40,
  },
  sectionHeader: {
    marginTop: 12,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  workflowRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  workflowCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    minHeight: 88,
  },
  workflowCardActive: {
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff',
  },
  workflowIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  workflowTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1e293b',
  },
  workflowTitleActive: {
    color: '#1d4ed8',
  },
  workflowDesc: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 8,
  },
  loadingText: {
    color: '#64748b',
    fontSize: 13,
  },
  emptyContainer: {
    padding: 24,
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  emptyText: {
    color: '#94a3b8',
    fontSize: 13,
  },
  serviceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  serviceCard: {
    width: '48%',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    position: 'relative',
    minHeight: 90,
  },
  serviceCardActive: {
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff',
  },
  serviceIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  serviceIconContainerActive: {
    backgroundColor: '#dbeafe',
  },
  serviceIconEmoji: {
    fontSize: 18,
  },
  serviceName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1e293b',
  },
  serviceNameActive: {
    color: '#1d4ed8',
  },
  serviceTurnaround: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 4,
  },
  serviceTurnaroundActive: {
    color: '#2563eb',
    fontWeight: '600',
  },
  selectedBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedBadgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 24,
  },
  categoryCard: {
    width: '31%',
    backgroundColor: '#ffffff',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    minHeight: 58,
  },
  categoryCardActive: {
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff',
  },
  categoryIcon: {
    fontSize: 16,
    marginBottom: 2,
  },
  categoryLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
    textAlign: 'center',
  },
  categoryLabelActive: {
    color: '#1d4ed8',
    fontWeight: '700',
  },
  bottomBar: {
    marginTop: 12,
  },
  continueButton: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  continueButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
});
