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
const SHOE_VALID_SERVICES = ['shoe cleaning', 'free shoe'];

/** Categories allowed when Starching service is selected. */
export const STARCHING_ALLOWED_CATEGORIES: GarmentCategory[] = [
  GarmentCategory.MEN,
  GarmentCategory.WOMEN,
  GarmentCategory.KIDS,
];

/**
 * Returns whether a category value represents the Shoe category.
 */
export function isShoeCategory(category: string | GarmentCategory): boolean {
  if (!category) return false;
  const upper = String(category).trim().toUpperCase();
  return (
    upper === GarmentCategory.SHOES ||
    upper === 'SHOE' ||
    upper === 'SHOES'
  );
}

/**
 * Returns whether a category value represents the Household category.
 */
export function isHouseholdCategory(category: string | GarmentCategory): boolean {
  if (!category) return false;
  const upper = String(category).trim().toUpperCase();
  return upper === GarmentCategory.HOUSEHOLD || upper === 'HOUSEHOLD';
}

/**
 * Returns whether a category value represents the Other / Others category.
 */
export function isOtherCategory(category: string | GarmentCategory): boolean {
  if (!category) return false;
  const upper = String(category).trim().toUpperCase();
  return (
    upper === GarmentCategory.OTHERS ||
    upper === 'OTHERS' ||
    upper === 'OTHER'
  );
}

/**
 * Returns whether a service name represents the Steam Iron service.
 */
export function isSteamIronService<T extends { id?: string; name: string; category?: string }>(
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
      const lower = svc.name.trim().toLowerCase();
      return (
        lower === 'steam iron' ||
        lower === 'steam press' ||
        lower.includes('steam iron') ||
        svc.category === 'STEAM_PRESS'
      );
    }
  }
  const lower = serviceIdOrName.trim().toLowerCase();
  return lower === 'steam iron' || lower === 'steam press' || lower.includes('steam iron');
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
      const lower = svc.name.trim().toLowerCase();
      return (
        lower === 'dry clean' ||
        lower === 'dry cleaning' ||
        (svc as { category?: string }).category === 'DRY_CLEAN'
      );
    }
  }
  const lower = serviceIdOrName.trim().toLowerCase();
  return lower === 'dry clean' || lower === 'dry cleaning';
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
  _workflow: OrderWorkflowType,
): boolean {
  if (
    category === GarmentCategory.HOME_CLEANING ||
    String(category).trim().toUpperCase() === 'HOME_CLEANING'
  ) {
    return false;
  }
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

  // If category is weight-based: in DRY_CLEANING it is a per-piece exception using dry clean services
  if (isWeightBasedCategory(category)) {
    if (workflow === 'DRY_CLEANING') {
      return availableServices.filter((s) => isServiceAllowedInWorkflow(s, 'DRY_CLEANING'));
    }
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
  let result = categories.filter(
    (c) =>
      String(c).trim().toUpperCase() !== GarmentCategory.HOME_CLEANING &&
      String(c).trim().toUpperCase() !== 'HOME_CLEANING',
  );

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
 * 2. When Category becomes Household: automatically select Dry Clean.
 * 3. When Category becomes Other: automatically select Dry Clean.
 * 4. When leaving Shoe category with Shoe Cleaning selected: switch to Standard Wash.
 * 5. When switching to a category not compatible with Starching (e.g. non-Men/Women/Kids while Starching is active): switch to Standard Wash.
 * 6. When switching to Weight Based category while Dry Clean is active: switch to Standard Wash (Dry Clean cannot be weight-based).
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
    if (workflow === 'DRY_CLEANING') {
      return (
        services.find((s) => isDryCleanService(s.name, services) || s.category === 'DRY_CLEAN') ||
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

  // Rule 1: Shoe category -> Shoe Cleaning
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

  // Rule 2: Household category -> Automatically select Dry Clean
  if (isHouseholdCategory(newCategory)) {
    const dryClean = services.find(
      (s) => isDryCleanService(s.name, services) || s.category === 'DRY_CLEAN',
    );
    if (dryClean) {
      return dryClean.id;
    }
  }

  // Rule 3: Other category -> Automatically select Dry Clean
  if (isOtherCategory(newCategory)) {
    const dryClean = services.find(
      (s) => isDryCleanService(s.name, services) || s.category === 'DRY_CLEAN',
    );
    if (dryClean) {
      return dryClean.id;
    }
  }

  if (isWeightBasedCategory(newCategory)) {
    if (workflow === 'DRY_CLEANING') {
      const curSvc = services.find((s) => s.id === currentServiceId);
      if (curSvc && isServiceAllowedInWorkflow(curSvc, 'DRY_CLEANING')) {
        return currentServiceId;
      }
      const fallback = getFallbackService();
      if (fallback) return fallback.id;
    }
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
 * Resolves the service selection when user clicks a service, enforcing category-service constraints:
 * - If Steam Iron is selected while Household or Other category is active: automatically switch service to Dry Clean.
 */
export function resolveServiceOnServiceChange<
  T extends { id: string; name: string; category?: string },
>(
  newServiceId: string,
  currentCategory: string | GarmentCategory,
  services: T[],
): string {
  if (
    isSteamIronService(newServiceId, services) &&
    (isHouseholdCategory(currentCategory) || isOtherCategory(currentCategory))
  ) {
    const dryClean = services.find(
      (s) => isDryCleanService(s.name, services) || s.category === 'DRY_CLEAN',
    );
    if (dryClean) {
      return dryClean.id;
    }
  }
  return newServiceId;
}

/**
 * Resolves the category selection when the user changes the service.
 * Business Rules:
 * 1. When Service becomes Shoe Cleaning or Free Shoe: auto-select Shoe category.
 * 2. When Shoe category is selected and user selects an incompatible service (e.g. Dry Clean, Standard Wash): auto-select Men.
 * 3. When Service becomes Starching: if current category is NOT Men, Women, or Kids, auto-select Men.
 * 4. When Service becomes Dry Clean: if current category is Weight Based, keep in DRY_CLEANING workflow as a per-piece exception, otherwise auto-select Men.
 * 5. For all other services: keep current category.
 */
export function resolveCatalogSelectionOnServiceChange<T extends { id: string; name: string }>(
  newServiceId: string,
  currentCategory: string | GarmentCategory,
  services: T[],
  workflow?: OrderWorkflowType,
): string | GarmentCategory {
  const newService = services.find((s) => s.id === newServiceId);
  if (!newService) return currentCategory;

  const name = newService.name.trim().toLowerCase();

  if (name === 'shoe cleaning' || name === 'free shoe') {
    return GarmentCategory.SHOES;
  }

  // If current category is Shoe and an incompatible service is selected, switch to Men
  if (isShoeCategory(currentCategory)) {
    return GarmentCategory.MEN;
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
      if (workflow === 'DRY_CLEANING') {
        return currentCategory;
      }
      return GarmentCategory.MEN;
    }
  }

  return currentCategory;
}

export interface CatalogSelectionResult {
  serviceId: string;
  category: string | GarmentCategory;
}

/**
 * Resolves both the active service and category when a service is selected by the user.
 * - If Steam Iron is selected while Household or Other is active: automatically switches service to Dry Clean.
 * - If Shoe Cleaning is selected: automatically switches category to Shoe.
 * - If Starching is selected from an incompatible category: automatically switches category to Men.
 * - If an incompatible service is selected from Shoe: automatically switches category to Men.
 */
export function resolveCatalogSelectionOnServiceSelect<
  T extends { id: string; name: string; category?: string },
>(
  selectedServiceId: string,
  currentCategory: string | GarmentCategory,
  services: T[],
  workflow?: OrderWorkflowType,
): CatalogSelectionResult {
  const serviceId = resolveServiceOnServiceChange(selectedServiceId, currentCategory, services);
  const category = resolveCatalogSelectionOnServiceChange(
    serviceId,
    currentCategory,
    services,
    workflow,
  );
  return { serviceId, category };
}

/**
 * Notice required on bills and receipts for garment collection deadline.
 */
export const GARMENT_COLLECTION_NOTICE =
  'Please collect your garments within 15 days. We cannot guarantee the safety or availability of garments left uncollected after 15 days.';

/**
 * Notice required on bills and receipts for stain removal limitations.
 */
export const STAIN_REMOVAL_NOTICE =
  'We make every effort to remove stains; however, 100% stain removal cannot be guaranteed. Results depend on the fabric, stain type, and garment condition.';

/**
 * Returns the day of the week (0 = Sunday ... 6 = Saturday) for a Date in a specific timezone.
 */
export function getDayOfWeekInTimezone(date: Date, timeZone: string = 'Asia/Kolkata'): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
  });
  const weekdayStr = formatter.format(date);
  switch (weekdayStr) {
    case 'Sun':
      return 0;
    case 'Mon':
      return 1;
    case 'Tue':
      return 2;
    case 'Wed':
      return 3;
    case 'Thu':
      return 4;
    case 'Fri':
      return 5;
    case 'Sat':
      return 6;
    default:
      return date.getDay();
  }
}

/**
 * Adjusts an applicable order due date for the Thursday weekly off day.
 * If the due date falls on Thursday in the given timezone, moves it to Friday (+1 calendar day).
 * Other due dates (and subsequent calls on an already adjusted date) remain unchanged.
 */
export function adjustDueDateForThursday(
  date: Date | string,
  timeZone: string = 'Asia/Kolkata',
): Date {
  const d = new Date(date);
  if (isNaN(d.getTime())) return d;
  const dayOfWeek = getDayOfWeekInTimezone(d, timeZone);
  if (dayOfWeek === 4) {
    // Thursday -> Friday
    d.setDate(d.getDate() + 1);
  }
  return d;
}

/**
 * Top Up Service Item contract
 */
export interface TopUpServiceItem {
  id: string;
  name: string;
  price: number;
  description?: string;
}

/**
 * Default Top Up Services seeded / configured for stores
 */
export const DEFAULT_TOP_UP_SERVICES: TopUpServiceItem[] = [
  { id: 'addon-starch', name: 'Starching', price: 30, description: 'Crisp starch finish per kg' },
  { id: 'addon-stain', name: 'Stain Treatment', price: 50, description: 'Spot stain removal' },
  {
    id: 'addon-fragrance',
    name: 'Fragrance Booster',
    price: 20,
    description: 'Long-lasting fresh scent',
  },
  {
    id: 'addon-antiseptic',
    name: 'Antiseptic Hygiene Wash',
    price: 25,
    description: 'Disinfectant sanitization',
  },
];
