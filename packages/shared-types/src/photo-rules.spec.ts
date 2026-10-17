import { describe, it } from 'node:test';
import assert from 'node:assert';
import { isPhotoRequiredForOrder } from './photo-rules';

describe('isPhotoRequiredForOrder', () => {
  it('requires photos for walk-in orders up to and including 50 pieces (non-weight-based)', () => {
    // 1. WALK-IN + 1 piece + non-weight-based => true
    assert.strictEqual(
      isPhotoRequiredForOrder({ isWalkIn: true, totalPieces: 1, isWeightBased: false }),
      true,
    );
    // 2. WALK-IN + 49 pieces + non-weight-based => true
    assert.strictEqual(
      isPhotoRequiredForOrder({ isWalkIn: true, totalPieces: 49, isWeightBased: false }),
      true,
    );
    // 3. WALK-IN + exactly 50 pieces + non-weight-based => true (up to and including 50 pieces is mandatory)
    assert.strictEqual(
      isPhotoRequiredForOrder({ isWalkIn: true, totalPieces: 50, isWeightBased: false }),
      true,
    );
  });

  it('makes photos optional for walk-in orders with more than 50 pieces (bulk, non-weight-based)', () => {
    // 4. WALK-IN + 51 pieces + non-weight-based => false (> 50 pieces is optional)
    assert.strictEqual(
      isPhotoRequiredForOrder({ isWalkIn: true, totalPieces: 51, isWeightBased: false }),
      false,
    );
    // 5. WALK-IN + 100 pieces + non-weight-based => false
    assert.strictEqual(
      isPhotoRequiredForOrder({ isWalkIn: true, totalPieces: 100, isWeightBased: false }),
      false,
    );
  });

  it('requires photos for walk-in weight-based orders regardless of piece count', () => {
    // 5. WALK-IN + 50 pieces + weight-based => true
    assert.strictEqual(
      isPhotoRequiredForOrder({ isWalkIn: true, totalPieces: 50, isWeightBased: true }),
      true,
    );
    // 6. WALK-IN + 100 pieces + weight-based => true
    assert.strictEqual(
      isPhotoRequiredForOrder({ isWalkIn: true, totalPieces: 100, isWeightBased: true }),
      true,
    );
  });

  it('makes photos optional for home delivery orders even if weight-based or under 50 pieces', () => {
    // 7. HOME_DELIVERY + weight-based => false
    assert.strictEqual(
      isPhotoRequiredForOrder({ isWalkIn: false, totalPieces: 50, isWeightBased: true }),
      false,
    );
    assert.strictEqual(
      isPhotoRequiredForOrder({ isWalkIn: false, totalPieces: 1, isWeightBased: true }),
      false,
    );
    // 8. HOME_DELIVERY + non-weight-based => false
    assert.strictEqual(
      isPhotoRequiredForOrder({ isWalkIn: false, totalPieces: 1, isWeightBased: false }),
      false,
    );
    assert.strictEqual(
      isPhotoRequiredForOrder({ isWalkIn: false, totalPieces: 100, isWeightBased: false }),
      false,
    );
  });
});
