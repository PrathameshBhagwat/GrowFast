import {
  GarmentCategory,
  ServiceCategory,
  OrderWorkflowType,
  OrderEntryMode,
  ServiceTypeDTO,
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
  if (entryMode === 'PIECES') return false;
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

export const CANONICAL_WEIGHT_SERVICES = [
  {
    id: 'svc-wash-iron',
    name: 'Steam Iron',
    category: ServiceCategory.WASH_IRON,
    estimatedDays: 1,
    isActive: true,
  },
  {
    id: 'svc-wash-fold',
    name: 'Wash and Fold',
    category: ServiceCategory.WASH,
    estimatedDays: 2,
    isActive: true,
  },
  {
    id: 'svc-laundry-white',
    name: 'Laundry for White',
    category: ServiceCategory.WASH,
    estimatedDays: 2,
    isActive: true,
  },
  {
    id: 'svc-laundry-premium',
    name: 'Premium Laundry',
    category: ServiceCategory.WASH,
    estimatedDays: 3,
    isActive: true,
  },
  {
    id: 'svc-laundry-woolen',
    name: 'Woolen Laundry',
    category: ServiceCategory.WASH,
    estimatedDays: 3,
    isActive: true,
  },
] as const;

/**
 * Exactly four Per-Piece services allowed in Per-Piece mode:
 * 1. Dry Clean
 * 2. Starching
 * 3. Shoe Cleaning
 * 4. Steam Iron
 */
export const CANONICAL_PIECE_SERVICES = [
  {
    id: 'svc-dry-clean',
    name: 'Dry Clean',
    category: ServiceCategory.DRY_CLEAN,
    estimatedDays: 2,
    isActive: true,
  },
  {
    id: 'svc-wash-iron',
    name: 'Starching',
    category: ServiceCategory.WASH_IRON,
    estimatedDays: 2,
    isActive: true,
  },
  {
    id: 'svc-shoe-clean',
    name: 'Shoe Cleaning',
    category: ServiceCategory.SHOE_CLEAN,
    estimatedDays: 3,
    isActive: true,
  },
  {
    id: 'svc-steam-press',
    name: 'Steam Iron',
    category: ServiceCategory.STEAM_PRESS,
    estimatedDays: 1,
    isActive: true,
  },
] as const;

/**
 * Resolves the service list for Per-Piece mode.
 * Strictly returns exactly four options:
 * 1. Dry Clean
 * 2. Starching
 * 3. Shoe Cleaning
 * 4. Steam Iron
 * Excludes Reprocess Cleaning, Standard Wash, Wash + Steam Iron, Steam Press Only, and Free Shoe.
 */
export function resolvePieceServices(services: ServiceTypeDTO[]): ServiceTypeDTO[] {
  return CANONICAL_PIECE_SERVICES.map((canonical) => {
    const match = services.find((s) => {
      if (s.isActive === false) return false;
      const sId = (s.id || '').toLowerCase();
      const sName = (s.name || '').trim().toLowerCase();

      if (canonical.id === 'svc-dry-clean') {
        return (
          sId === 'svc-dry-clean' ||
          sId === 'srv-dry-clean' ||
          sName === 'dry clean' ||
          sName === 'dry cleaning' ||
          s.category === ServiceCategory.DRY_CLEAN
        );
      }

      if (canonical.id === 'svc-wash-iron') {
        return (
          sId === 'svc-starching' ||
          sId === 'srv-starching' ||
          sId === 'svc-starching-orig' ||
          sId === 'svc-weight' ||
          sId === 'srv-wash-iron' ||
          sId === 'svc-wash-iron' ||
          sName === 'starching' ||
          sName === 'starching dc' ||
          sName === 'starching dc.' ||
          sName === 'wash & iron' ||
          sName === 'wash and iron' ||
          sName.includes('starch')
        );
      }

      if (canonical.id === 'svc-shoe-clean') {
        if (sName === 'free shoe' || sId === 'srv-free-shoe' || sId === 'svc-stain') return false;
        return (
          sId === 'svc-shoe-clean' ||
          sId === 'srv-shoe-clean' ||
          s.category === ServiceCategory.SHOE_CLEAN ||
          sName === 'shoe cleaning' ||
          sName.includes('shoe')
        );
      }

      if (canonical.id === 'svc-steam-press') {
        if (
          sName === 'steam press only' ||
          sId === 'svc-steam-press-only' ||
          (sId === 'srv-steam-press' && sName === 'steam press only')
        ) {
          return false;
        }
        return (
          sId === 'svc-steam-press' ||
          sId === 'srv-steam-press' ||
          sId === 'svc-steam-iron' ||
          sId === 'srv-steam-iron' ||
          s.category === ServiceCategory.STEAM_PRESS ||
          sName === 'steam iron' ||
          sName === 'steam press'
        );
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

/**
 * Resolves the service list for Per-Weight mode.
 * Strictly returns the five website laundry services in canonical order:
 * 1. Steam Iron
 * 2. Wash and Fold
 * 3. Laundry for White
 * 4. Premium Laundry
 * 5. Woolen Laundry
 */
export function resolveWeightServices(services: ServiceTypeDTO[]): ServiceTypeDTO[] {
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
