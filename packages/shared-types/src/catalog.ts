import { GarmentCategory } from './enums';

/** Service names that are hidden when Shoe category is selected. */
const SHOE_HIDDEN_SERVICES = ['steam iron', 'wash + steam iron', 'starching dc', 'starching'];

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
 * Filters services based on category and catalog visibility rules:
 * - Removes "Free Shoe" and "Reprocess Cleaning" everywhere.
 * - Shoe category: hides Steam Iron, Wash + Steam Iron, Starching.
 * - All other categories: returns all other non-excluded services.
 */
export function filterServicesForCategory<T extends { name: string }>(
  services: T[],
  category: string | GarmentCategory,
): T[] {
  // Always filter out Free Shoe and Reprocess Cleaning from visible buttons
  const availableServices = services.filter(
    (s) => !CATALOG_EXCLUDED_SERVICES.includes(s.name.trim().toLowerCase()),
  );

  if (!isShoeCategory(category)) {
    return availableServices;
  }
  return availableServices.filter(
    (s) => !SHOE_HIDDEN_SERVICES.includes(s.name.trim().toLowerCase()),
  );
}

/**
 * Filters visible categories based on active service:
 * - When Starching is selected: returns ONLY [Men, Women, Kids].
 * - When other services are selected: returns all categories unchanged.
 */
export function filterCategoriesForService<T extends string>(
  categories: T[],
  activeServiceId: string,
  services: Array<{ id: string; name: string }>,
): T[] {
  if (isStarchingService(activeServiceId, services)) {
    const allowed = [GarmentCategory.MEN, GarmentCategory.WOMEN, GarmentCategory.KIDS].map((c) =>
      String(c).trim().toUpperCase(),
    );
    return categories.filter((c) => allowed.includes(String(c).trim().toUpperCase()));
  }
  return categories;
}

/**
 * Resolves the service selection when the user changes the category.
 * Business Rules:
 * 1. When Category becomes Shoe: keep current service if it is one of the valid shoe services (Standard Wash, Dry Clean, Shoe Cleaning); otherwise auto-select Shoe Cleaning.
 * 2. When leaving Shoe category with Shoe Cleaning selected: switch to Standard Wash.
 * 3. When switching to a category not compatible with Starching (e.g. non-Men/Women/Kids while Starching is active): switch to Standard Wash.
 */
export function resolveCatalogSelectionOnCategoryChange<T extends { id: string; name: string }>(
  newCategory: string | GarmentCategory,
  currentServiceId: string,
  services: T[],
): string {
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

  const currentService = services.find((s) => s.id === currentServiceId);
  if (currentService) {
    const name = currentService.name.trim().toLowerCase();
    if (name === 'shoe cleaning' || name === 'free shoe') {
      const standardWash = services.find((s) => s.name.trim().toLowerCase() === 'standard wash');
      if (standardWash) {
        return standardWash.id;
      }
    }

    if (isStarchingService(currentServiceId, services)) {
      const allowed = [GarmentCategory.MEN, GarmentCategory.WOMEN, GarmentCategory.KIDS].map((c) =>
        String(c).trim().toUpperCase(),
      );
      if (!allowed.includes(String(newCategory).trim().toUpperCase())) {
        const standardWash = services.find((s) => s.name.trim().toLowerCase() === 'standard wash');
        if (standardWash) {
          return standardWash.id;
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
 * 3. For all other services: keep current category.
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

  return currentCategory;
}
