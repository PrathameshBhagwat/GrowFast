import { GarmentCategory } from './enums';

/** Service names that are hidden when Shoe category is selected. */
const SHOE_HIDDEN_SERVICES = [
  'steam iron',
  'wash + steam iron',
  'wash and steam iron',
  'starching dc',
  'starching',
];

/** Service names that are excluded from visible catalog service buttons across all catalog views. */
const CATALOG_EXCLUDED_SERVICES = ['free shoe', 'reprocess cleaning'];

/** Service names that are valid shoe-oriented services. */
const SHOE_VALID_SERVICES = ['standard wash', 'dry clean', 'shoe cleaning'];

/** Categories allowed when Starching service is selected. */
export const STARCHING_ALLOWED_CATEGORIES: GarmentCategory[] = [
  GarmentCategory.MEN,
  GarmentCategory.WOMEN,
  GarmentCategory.KIDS,
];

/**
 * Returns whether a category value represents the Shoe category.
 */
function isShoeCategory(category: string | GarmentCategory): boolean {
  return (
    category === GarmentCategory.SHOES ||
    category.toLowerCase() === 'shoe' ||
    category.toLowerCase() === 'shoes'
  );
}

/**
 * Returns whether a service name represents the Starching service.
 */
export function isStarchingService<T extends { id?: string; name: string }>(
  serviceIdOrName: string,
  services?: T[],
): boolean {
  if (!serviceIdOrName) return false;
  if (services) {
    const svc = services.find(
      (s) =>
        s.id === serviceIdOrName ||
        s.name.trim().toLowerCase() === serviceIdOrName.trim().toLowerCase(),
    );
    if (svc) {
      return svc.name.trim().toLowerCase().includes('starch');
    }
  }
  return serviceIdOrName.trim().toLowerCase().includes('starch');
}

/**
 * Returns customer/operator display name for a catalog service button.
 * Renames "Starching Dc" -> "Starching".
 */
export function formatCatalogServiceName(name: string): string {
  if (!name) return '';
  const trimmed = name.trim();
  if (trimmed.toLowerCase() === 'starching dc' || trimmed.toLowerCase() === 'starching dc.') {
    return 'Starching';
  }
  return trimmed;
}

/**
 * Returns whether a service name represents the Dry Clean service.
 */
export function isDryCleanService<T extends { id?: string; name: string }>(
  serviceIdOrName: string,
  services?: T[],
): boolean {
  if (!serviceIdOrName) return false;
  if (services) {
    const svc = services.find(
      (s) =>
        s.id === serviceIdOrName ||
        s.name.trim().toLowerCase() === serviceIdOrName.trim().toLowerCase(),
    );
    if (svc) {
      return svc.name.trim().toLowerCase() === 'dry clean';
    }
  }
  return serviceIdOrName.trim().toLowerCase() === 'dry clean';
}

/**
 * Returns whether a category represents weight-based laundry.
 */
export function isWeightBasedCategory(category: string | GarmentCategory): boolean {
  return (
    category === GarmentCategory.WEIGHT_BASED ||
    String(category).trim().toUpperCase() === 'WEIGHT_BASED'
  );
}

/** Workflow type for order creation: Laundry vs Dry Cleaning */
export type OrderWorkflowType = 'LAUNDRY' | 'DRY_CLEANING';

/** Entry mode for order creation: Per Weight vs Per Pieces */
export type OrderEntryMode = 'WEIGHT' | 'PIECES';

/**
 * Returns whether an order entry mode is allowed in the given workflow.
 * Dry Cleaning is strictly per-piece; WEIGHT mode is not allowed.
 */
export function isEntryModeAllowedInWorkflow(
  mode: OrderEntryMode,
  workflow: OrderWorkflowType,
): boolean {
  if (workflow === 'DRY_CLEANING') {
    return mode === 'PIECES';
  }
  return true;
}

export interface WorkflowOption {
  id: OrderWorkflowType;
  name: string;
  shortDescription: string;
  badge: string;
}

export const WORKFLOW_OPTIONS: Record<OrderWorkflowType, WorkflowOption> = {
  LAUNDRY: {
    id: 'LAUNDRY',
    name: 'Laundry',
    shortDescription: 'Primarily weight-based (min 2.00 kg) & piece-based washing',
    badge: 'Weight & Piece • Batch Washing',
  },
  DRY_CLEANING: {
    id: 'DRY_CLEANING',
    name: 'Dry Cleaning',
    shortDescription: 'Strictly per-piece garment care with individual tag & physical tracking',
    badge: 'Per-Piece Only • Individual Tags',
  },
};

/**
 * Returns whether a service belongs to the given order workflow.
 * - LAUNDRY: includes Wash and Steam Iron, Wash and Fold, Premium Laundry, Woolen Laundry,
 *   Laundry for White, Standard Wash, Steam Iron, and Starching. Strictly excludes Dry Clean.
 * - DRY_CLEANING: includes Dry Clean, Steam Iron, Starching, and Shoe Cleaning. Strictly excludes washing services.
 */
export function isServiceAllowedInWorkflow<T extends { name: string; category?: string }>(
  service: T,
  workflow: OrderWorkflowType,
): boolean {
  const name = service.name.trim().toLowerCase();
  if (CATALOG_EXCLUDED_SERVICES.includes(name)) return false;

  if (workflow === 'DRY_CLEANING') {
    const laundryServiceNames = [
      'wash and fold',
      'wash + steam iron',
      'wash and steam iron',
      'premium laundry',
      'woolen laundry',
      'laundry for white',
      'standard wash',
    ];
    if (laundryServiceNames.includes(name)) return false;
    if (service.category === 'WASH' || service.category === 'WASH_IRON') return false;
    return true;
  }

  if (workflow === 'LAUNDRY') {
    if (name === 'dry clean' || service.category === 'DRY_CLEAN') return false;
    return true;
  }

  return true;
}

/**
 * Returns whether a garment category is allowed in the given order workflow.
 * - DRY_CLEANING: per-piece workflow, allows piece categories and WEIGHT_BASED as an exception.
 * - LAUNDRY: supports both weight-based and piece categories.
 */
export function isCategoryAllowedInWorkflow(
  category: string | GarmentCategory,
  workflow: OrderWorkflowType,
): boolean {
  // WEIGHT_BASED is allowed in DRY_CLEANING as a weight-based exception category
  return true;
}

/**
 * Returns whether an added order item is compatible with the given target workflow.
 */
export function isItemCompatibleWithWorkflow(
  item: {
    isWeightBased?: boolean;
    weight?: number | null;
    serviceName?: string;
    serviceTypeId?: string;
    category?: string | GarmentCategory;
  },
  workflow: OrderWorkflowType,
  services?: Array<{ id: string; name: string; category?: string }>,
): boolean {
  if (workflow === 'DRY_CLEANING') {
    if (item.isWeightBased || (item.weight != null && item.weight > 0)) {
      return false;
    }
    if (item.category && isWeightBasedCategory(item.category)) {
      return false;
    }
    const serviceName = item.serviceName || '';
    if (services) {
      const svc = services.find(
        (s) =>
          s.id === item.serviceTypeId ||
          s.name.trim().toLowerCase() === serviceName.trim().toLowerCase(),
      );
      if (svc) return isServiceAllowedInWorkflow(svc, 'DRY_CLEANING');
    }
    const laundryServiceNames = [
      'wash and fold',
      'wash + steam iron',
      'wash and steam iron',
      'premium laundry',
      'woolen laundry',
      'laundry for white',
      'standard wash',
    ];
    if (laundryServiceNames.includes(serviceName.trim().toLowerCase())) {
      return false;
    }
    return true;
  }

  if (workflow === 'LAUNDRY') {
    const serviceName = item.serviceName || '';
    if (isDryCleanService(serviceName)) return false;
    if (services) {
      const svc = services.find(
        (s) =>
          s.id === item.serviceTypeId ||
          s.name.trim().toLowerCase() === serviceName.trim().toLowerCase(),
      );
      if (svc) return isServiceAllowedInWorkflow(svc, 'LAUNDRY');
    }
    return true;
  }

  return true;
}

/**
 * Filters services based on category, workflow, and catalog visibility rules:
 * - Removes "Free Shoe" and "Reprocess Cleaning" everywhere.
 * - When category is Weight Based (exception or laundry): returns weight/wash services, excludes Dry Clean.
 * - When workflow is provided: filters to services allowed in that workflow.
 * - Shoe category: hides Steam Iron, Wash + Steam Iron, Starching.
 * - All other categories: returns all other non-excluded services.
 */
export function filterServicesForCategory<T extends { name: string; category?: string }>(
  services: T[],
  category: string | GarmentCategory,
  workflow?: OrderWorkflowType,
): T[] {
  // Always filter out Free Shoe and Reprocess Cleaning from visible buttons
  let availableServices = services.filter(
    (s) => !CATALOG_EXCLUDED_SERVICES.includes(s.name.trim().toLowerCase()),
  );

  // If category is weight-based (exception in dry cleaning or laundry), return wash/weight services
  if (isWeightBasedCategory(category)) {
    return availableServices.filter(
      (s) => s.name.trim().toLowerCase() !== 'dry clean' && s.category !== 'DRY_CLEAN',
    );
  }

  if (workflow) {
    availableServices = availableServices.filter((s) => isServiceAllowedInWorkflow(s, workflow));
  }

  if (isShoeCategory(category)) {
    return availableServices.filter(
      (s) => !SHOE_HIDDEN_SERVICES.includes(s.name.trim().toLowerCase()),
    );
  }

  return availableServices;
}

/**
 * Filters visible categories based on active service and workflow:
 * - When Starching is selected: returns ONLY [Men, Women, Kids].
 * - Weight Based is kept available as an exception option in categories.
 * - When other services are selected: returns all categories unchanged.
 */
export function filterCategoriesForService<T extends string>(
  categories: T[],
  activeServiceId: string,
  services: Array<{ id: string; name: string }>,
  _workflow?: OrderWorkflowType,
): T[] {
  let result = categories;

  if (isStarchingService(activeServiceId, services)) {
    const allowed = [GarmentCategory.MEN, GarmentCategory.WOMEN, GarmentCategory.KIDS].map((c) =>
      String(c).trim().toUpperCase(),
    );
    return result.filter((c) => allowed.includes(String(c).trim().toUpperCase()));
  }

  return result;
}

/**
 * Resolves the service and category selection when switching workflows.
 */
export function resolveCatalogSelectionOnWorkflowChange<
  T extends { id: string; name: string; category?: string },
>(
  newWorkflow: OrderWorkflowType,
  currentServiceId: string,
  currentCategory: string | GarmentCategory,
  services: T[],
): { serviceId: string; category: string | GarmentCategory } {
  let serviceId = currentServiceId;
  let category = currentCategory;

  if (newWorkflow === 'DRY_CLEANING') {
    if (isWeightBasedCategory(category)) {
      category = GarmentCategory.MEN;
    }
    const curSvc = services.find((s) => s.id === currentServiceId);
    if (!curSvc || !isServiceAllowedInWorkflow(curSvc, 'DRY_CLEANING')) {
      const dryCleanSvc = services.find(
        (s) => isDryCleanService(s.name) || s.category === 'DRY_CLEAN',
      );
      if (dryCleanSvc) {
        serviceId = dryCleanSvc.id;
      } else {
        const firstAllowed = services.find((s) => isServiceAllowedInWorkflow(s, 'DRY_CLEANING'));
        if (firstAllowed) serviceId = firstAllowed.id;
      }
    }
  } else if (newWorkflow === 'LAUNDRY') {
    const curSvc = services.find((s) => s.id === currentServiceId);
    if (!curSvc || !isServiceAllowedInWorkflow(curSvc, 'LAUNDRY')) {
      const preferredLaundryNames = [
        'wash and steam iron',
        'wash + steam iron',
        'wash and fold',
        'standard wash',
        'premium laundry',
      ];
      const laundrySvc = services.find((s) =>
        preferredLaundryNames.includes(s.name.trim().toLowerCase()),
      );
      if (laundrySvc) {
        serviceId = laundrySvc.id;
      } else {
        const firstAllowed = services.find((s) => isServiceAllowedInWorkflow(s, 'LAUNDRY'));
        if (firstAllowed) serviceId = firstAllowed.id;
      }
    }
  }

  return { serviceId, category };
}

/**
 * Resolves the service selection when the user changes the category.
 * Business Rules:
 * 1. When Category becomes Shoe: keep current service if it is one of the valid shoe services (Standard Wash, Dry Clean, Shoe Cleaning); otherwise auto-select Shoe Cleaning.
 * 2. When leaving Shoe category with Shoe Cleaning selected: switch to Standard Wash.
 * 3. When switching to a category not compatible with Starching (e.g. non-Men/Women/Kids while Starching is active): switch to Standard Wash.
 * 4. When switching to Weight Based category while Dry Clean is active: switch to Standard Wash (Dry Clean cannot be weight-based).
 */
export function resolveCatalogSelectionOnCategoryChange<
  T extends { id: string; name: string; category?: string },
>(
  newCategory: string | GarmentCategory,
  currentServiceId: string,
  services: T[],
  workflow?: OrderWorkflowType,
): string {
  const getFallbackService = (): T | undefined => {
    if (workflow === 'DRY_CLEANING' && !isWeightBasedCategory(newCategory)) {
      return (
        services.find((s) => isDryCleanService(s.name) || s.category === 'DRY_CLEAN') ||
        services.find((s) => isServiceAllowedInWorkflow(s, 'DRY_CLEANING'))
      );
    }
    const preferredLaundryNames = [
      'wash and steam iron',
      'wash + steam iron',
      'standard wash',
      'wash and fold',
      'premium laundry',
    ];
    const laundry = services.find((s) =>
      preferredLaundryNames.includes(s.name.trim().toLowerCase()),
    );
    if (laundry) return laundry;
    const standardWash = services.find((s) => s.name.trim().toLowerCase() === 'standard wash');
    if (standardWash) return standardWash;
    return services.find((s) => isServiceAllowedInWorkflow(s, 'LAUNDRY'));
  };

  if (isShoeCategory(newCategory)) {
    const currentService = services.find((s) => s.id === currentServiceId);
    if (currentService && SHOE_VALID_SERVICES.includes(currentService.name.trim().toLowerCase())) {
      return currentServiceId;
    }
    const shoeCleaning = services.find((s) => s.name.trim().toLowerCase() === 'shoe cleaning');
    if (shoeCleaning) {
      return shoeCleaning.id;
    }
  }

  if (isWeightBasedCategory(newCategory)) {
    if (isDryCleanService(currentServiceId, services)) {
      const fallback = getFallbackService();
      if (fallback) {
        return fallback.id;
      }
    }
  }

  // When switching away from Weight Based (or an incompatible service) in DRY_CLEANING workflow
  if (workflow === 'DRY_CLEANING' && !isWeightBasedCategory(newCategory)) {
    const curSvc = services.find((s) => s.id === currentServiceId);
    if (!curSvc || !isServiceAllowedInWorkflow(curSvc, 'DRY_CLEANING')) {
      const fallback = getFallbackService();
      if (fallback) {
        return fallback.id;
      }
    }
  }

  const currentService = services.find((s) => s.id === currentServiceId);
  if (currentService) {
    const name = currentService.name.trim().toLowerCase();
    if (name === 'shoe cleaning' || name === 'free shoe') {
      const fallback = getFallbackService();
      if (fallback) {
        return fallback.id;
      }
    }

    if (isStarchingService(currentServiceId, services)) {
      const allowed = [GarmentCategory.MEN, GarmentCategory.WOMEN, GarmentCategory.KIDS].map((c) =>
        String(c).trim().toUpperCase(),
      );
      if (!allowed.includes(String(newCategory).trim().toUpperCase())) {
        const fallback = getFallbackService();
        if (fallback) {
          return fallback.id;
        }
      }
    }
  }

  return currentServiceId;
}

/**
 * Resolves the category selection when the user changes the service.
 * Business Rules:
 * 1. When Service becomes Shoe Cleaning or Free Shoe: auto-select Shoe category.
 * 2. When Service becomes Starching: if current category is NOT Men, Women, or Kids, auto-select Men.
 * 3. When Service becomes Dry Clean: if current category is Weight Based, auto-select Men (Dry Clean is strictly per-piece).
 * 4. For all other services: keep current category.
 */
export function resolveCatalogSelectionOnServiceChange<T extends { id: string; name: string }>(
  newServiceId: string,
  currentCategory: string | GarmentCategory,
  services: T[],
): string | GarmentCategory {
  const newService = services.find((s) => s.id === newServiceId);
  if (!newService) return currentCategory;

  const name = newService.name.trim().toLowerCase();

  if (name === 'shoe cleaning' || name === 'free shoe') {
    return GarmentCategory.SHOES;
  }

  if (isStarchingService(newServiceId, services)) {
    const allowed = [GarmentCategory.MEN, GarmentCategory.WOMEN, GarmentCategory.KIDS].map((c) =>
      String(c).trim().toUpperCase(),
    );
    if (!allowed.includes(String(currentCategory).trim().toUpperCase())) {
      return GarmentCategory.MEN;
    }
  }

  if (isDryCleanService(newServiceId, services)) {
    if (isWeightBasedCategory(currentCategory)) {
      return GarmentCategory.MEN;
    }
  }

  return currentCategory;
}
