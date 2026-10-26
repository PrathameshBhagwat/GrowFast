import {
  GarmentCategory,
  ServiceCategory,
  OrderWorkflowType,
  OrderEntryMode,
  isWeightBasedCategory,
} from '@growfast/shared-types';

/**
 * Canonical helper to determine whether the selected workflow/service combination uses weight-based pricing.
 * In DRY_CLEANING workflow: strictly per-piece, weight mode is not allowed.
 * In LAUNDRY workflow:
 * - Service with category WEIGHT_BASED, WASH, or WASH_IRON is weight-based.
 * - Canonical weight service names (Wash & Fold, Wash & Steam Iron, White, Premium, Woolen, Standard Wash) are weight-based.
 * - Steam Iron (STEAM_PRESS) and Starching in Laundry are per-piece.
 */
export function isWeightBasedPricing(
  workflow: OrderWorkflowType,
  service?: { id?: string; name: string; category?: string | ServiceCategory } | null,
  entryMode?: OrderEntryMode,
  category?: string | GarmentCategory,
): boolean {
  if (workflow === 'DRY_CLEANING') return false;
  if (entryMode === 'WEIGHT') return true;
  if (category && isWeightBasedCategory(category)) return true;
  if (!service) return true; // Default laundry in GrowFast is weight-based
  const cat = service.category;
  if (
    cat === ServiceCategory.WEIGHT_BASED ||
    cat === 'WEIGHT_BASED' ||
    cat === ServiceCategory.WASH ||
    cat === 'WASH' ||
    cat === ServiceCategory.WASH_IRON ||
    cat === 'WASH_IRON'
  ) {
    return true;
  }
  const name = service.name.trim().toLowerCase();
  const canonicalNames = [
    'wash and steam iron',
    'wash & steam iron',
    'wash + steam iron',
    'wash and fold',
    'wash & fold',
    'laundry for white',
    'premium laundry',
    'woolen laundry',
    'standard wash',
  ];
  return canonicalNames.some((n) => name.includes(n));
}
