/**
 * Canonical photo requirement calculation for orders.
 *
 * BUSINESS RULES:
 * For WALK-IN orders (STORE_PICKUP):
 * 1. Up to and including 50 pieces (totalPieces <= 50):
 *    - Photos are REQUIRED / MANDATORY.
 *    - Every individual physical piece must have at least 1 photo before the order can be created.
 *    - Additional photos per piece are allowed.
 *    - The UI must NOT label this as "Optional".
 * 2. More than 50 pieces (totalPieces > 50):
 *    - Treat this as a BULK order.
 *    - Photos are OPTIONAL.
 *    - Employee may skip photo capture and create the order.
 * 3. If the order is WEIGHT-BASED:
 *    - Photos are REQUIRED regardless of piece count.
 *    - Every applicable physical piece must have at least 1 photo.
 *
 * CANONICAL FORMULATION:
 * isWalkIn && (totalPieces <= 50 || isWeightBased) => photos required
 * isWalkIn && totalPieces > 50 && !isWeightBased => photos optional
 */

export interface PhotoRequirementContext {
  isWalkIn: boolean;
  totalPieces: number;
  isWeightBased: boolean;
}

export function isPhotoRequiredForOrder(ctx: PhotoRequirementContext): boolean {
  if (!ctx.isWalkIn) {
    return false;
  }
  return ctx.isWeightBased || ctx.totalPieces <= 50;
}
