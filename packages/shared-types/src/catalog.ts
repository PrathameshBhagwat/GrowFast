import { GarmentCategory } from './enums';

/** Service names that are hidden when Shoe category is selected. */
const SHOE_HIDDEN_SERVICES = ['steam iron', 'wash + steam iron', 'starching dc'];

/** Service names that are valid shoe-oriented services. */
const SHOE_VALID_SERVICES = ['standard wash', 'dry clean', 'shoe cleaning', 'reprocess cleaning', 'free shoe'];

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
 * Filters services based on the selected category.
 * - Shoe category: returns only the 5 valid shoe services (hides Steam Iron, Wash + Steam Iron, Starching Dc).
 * - All other categories: returns all services unchanged.
 */
export function filterServicesForCategory<T extends { name: string }>(
  services: T[],
  category: string | GarmentCategory
): T[] {
  if (!isShoeCategory(category)) {
    return services;
  }
  return services.filter(
    (s) => !SHOE_HIDDEN_SERVICES.includes(s.name.toLowerCase())
  );
}

/**
 * Resolves the service selection when the user changes the category.
 * Business Rule: When Category becomes Shoe, keep current service if it is
 * one of the 5 valid shoe services; otherwise auto-select Shoe Cleaning.
 */
export function resolveCatalogSelectionOnCategoryChange<T extends { id: string; name: string }>(
  newCategory: string | GarmentCategory,
  currentServiceId: string,
  services: T[]
): string {
  if (isShoeCategory(newCategory)) {
    const currentService = services.find((s) => s.id === currentServiceId);
    if (currentService && SHOE_VALID_SERVICES.includes(currentService.name.toLowerCase())) {
      // Current service is one of the valid 5 shoe services — keep it
      return currentServiceId;
    }
    // Otherwise, auto-select Shoe Cleaning (if available)
    const shoeCleaning = services.find((s) => s.name.toLowerCase() === 'shoe cleaning');
    if (shoeCleaning) {
      return shoeCleaning.id;
    }
  }
  // Leaving Shoe category: if current service is shoe-exclusive, switch to Standard Wash
  const currentService = services.find((s) => s.id === currentServiceId);
  if (currentService) {
    const name = currentService.name.toLowerCase();
    if (name === 'shoe cleaning' || name === 'free shoe') {
      const standardWash = services.find((s) => s.name.toLowerCase() === 'standard wash');
      if (standardWash) {
        return standardWash.id;
      }
    }
  }

  // For all other cases, keep current service
  return currentServiceId;
}

/**
 * Resolves the category selection when the user changes the service.
 * Business Rule: When Service becomes Shoe Cleaning or Free Shoe, auto-select Shoe category.
 */
export function resolveCatalogSelectionOnServiceChange<T extends { id: string; name: string }>(
  newServiceId: string,
  currentCategory: string | GarmentCategory,
  services: T[]
): string | GarmentCategory {
  const newService = services.find((s) => s.id === newServiceId);
  if (!newService) return currentCategory;

  const name = newService.name.toLowerCase();

  if (name === 'shoe cleaning' || name === 'free shoe') {
    return GarmentCategory.SHOES;
  }

  // For all other services, keep current category
  return currentCategory;
}
