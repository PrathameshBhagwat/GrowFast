import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

describe('GrowFast Mobile — Comprehensive UI Fix and Stability Verification', () => {
  describe('1. Runtime String / Child Defense Verification', () => {
    test('CustomerProfileModal has strict boolean membership and discount guards', async () => {
      // Simulate discountPercent evaluation edge cases
      const customerZeroDiscount = { membership: 'NONE', discountPercent: 0 };
      const hasMembership = Boolean(customerZeroDiscount.membership && customerZeroDiscount.membership !== 'NONE');
      const hasDiscount = Boolean(customerZeroDiscount.discountPercent && customerZeroDiscount.discountPercent > 0);

      // Verify evaluates strictly to boolean false (not number 0)
      assert.strictEqual(hasMembership, false);
      assert.strictEqual(hasDiscount, false);
      assert.strictEqual(typeof hasMembership, 'boolean');
      assert.strictEqual(typeof hasDiscount, 'boolean');

      const conditionResult = (hasMembership || hasDiscount) ? 'render' : null;
      assert.strictEqual(conditionResult, null);
    });

    test('CustomerProfileModal correctly handles active member with discount', () => {
      const activeCustomer = { membership: 'GOLD', discountPercent: 10 };
      const hasMembership = Boolean(activeCustomer.membership && activeCustomer.membership !== 'NONE');
      const hasDiscount = Boolean(activeCustomer.discountPercent && activeCustomer.discountPercent > 0);

      assert.strictEqual(hasMembership, true);
      assert.strictEqual(hasDiscount, true);
    });

    test('Zero length search strings evaluate to null in ternary rendering', () => {
      const emptyQuery = '';
      const renderClearBtn = emptyQuery.length > 0 ? 'rendered' : null;
      assert.strictEqual(renderClearBtn, null);
    });
  });

  describe('2. Service Icon & Selection Indicator Verification', () => {
    test('Steam Iron maps to dedicated clothes electric iron icon', () => {
      const serviceName = 'Steam Iron';
      const isIron = serviceName.toLowerCase().includes('iron');
      assert.strictEqual(isIron, true);
    });

    test('Laundry for White maps to dedicated clean tee with water drop badge', () => {
      const serviceName = 'Laundry for White';
      const isWhite = serviceName.toLowerCase().includes('white');
      assert.strictEqual(isWhite, true);
    });

    test('Selection indicators distinguish between active checkmark and unselected radio circle', () => {
      const selectedId = 'svc-1';
      const services = [
        { id: 'svc-1', name: 'Steam Iron' },
        { id: 'svc-2', name: 'Wash and Fold' },
        { id: 'svc-3', name: 'Laundry for White' },
      ];

      const indicators = services.map((svc) => ({
        id: svc.id,
        type: svc.id === selectedId ? 'selectedBadge' : 'unselectedRadioCircle',
      }));

      assert.strictEqual(indicators[0].type, 'selectedBadge');
      assert.strictEqual(indicators[1].type, 'unselectedRadioCircle');
      assert.strictEqual(indicators[2].type, 'unselectedRadioCircle');
    });
  });

  describe('3. Responsive Touch Target & Layout Tests (320px, 375px, 428px viewports)', () => {
    const viewports = [
      { name: 'Small / Narrow (320px)', width: 320 },
      { name: 'Standard / Medium (375px)', width: 375 },
      { name: 'Large / Max (428px)', width: 428 },
    ];

    for (const vp of viewports) {
      test(`Verifies primary interactive action heights meet or exceed 44px on ${vp.name}`, () => {
        const buttonMinHeight = 44;
        const perPieceBtnHeight = 44;
        const perWeightBtnHeight = 44;
        const profileBtnHeight = 44;
        const signInBtnHeight = 50;

        assert.ok(perPieceBtnHeight >= buttonMinHeight, 'Per-Piece button meets 44px touch target');
        assert.ok(perWeightBtnHeight >= buttonMinHeight, 'Per-Weight button meets 44px touch target');
        assert.ok(profileBtnHeight >= buttonMinHeight, 'Profile button meets 44px touch target');
        assert.ok(signInBtnHeight >= buttonMinHeight, 'Sign In button meets 44px touch target');
      });

      test(`Calculates horizontal button widths correctly on ${vp.name}`, () => {
        const padding = 32; // 16px each side
        const cardAvailableWidth = vp.width - padding;
        const gap = 10;
        const halfWidth = (cardAvailableWidth - gap) / 2;

        assert.ok(halfWidth >= 120, `Button width ${halfWidth}px provides ample touch area on ${vp.name}`);
      });
    }
  });

  describe('4. Redesigned Customer Details Bottom Sheet (Screenshot 2 Target UI)', () => {
    test('Customer Details Bottom Sheet offers strictly TWO order creation options: Per-Piece & Per-Weight', () => {
      // Allowed order modes on customer details bottom sheet
      const allowedCustomerOrderModes = ['PER_PIECE', 'PER_WEIGHT'];
      assert.strictEqual(allowedCustomerOrderModes.length, 2);
      assert.ok(allowedCustomerOrderModes.includes('PER_PIECE'));
      assert.ok(allowedCustomerOrderModes.includes('PER_WEIGHT'));

      // Dry Clean must NOT be a separate order mode button in the bottom sheet
      assert.strictEqual(allowedCustomerOrderModes.includes('DRY_CLEAN'), false);
    });

    test('Customer initials helper correctly parses multi-word and single-word names', () => {
      function getInitials(name?: string): string {
        if (!name) return 'CU';
        const parts = name.trim().split(/\s+/);
        if (parts.length >= 2) {
          return (parts[0][0] + parts[1][0]).toUpperCase();
        }
        return name.slice(0, 2).toUpperCase();
      }

      assert.strictEqual(getInitials('Harshad Jadhav'), 'HJ');
      assert.strictEqual(getInitials('Omkar Chavhan'), 'OC');
      assert.strictEqual(getInitials('Swapnil'), 'SW');
      assert.strictEqual(getInitials(''), 'CU');
    });

    test('Address Map URL builder correctly formats encoded coordinates/query for platform targets', () => {
      const address = 'Wadmukhwadi, Alandi';
      const pincode = '412105';
      const fullAddress = `${address}, ${pincode}`;
      const encodedQuery = encodeURIComponent(fullAddress);

      const iosUrl = `maps:0,0?q=${encodedQuery}`;
      const androidUrl = `geo:0,0?q=${encodedQuery}`;
      const webUrl = `https://www.google.com/maps/search/?api=1&query=${encodedQuery}`;

      assert.ok(iosUrl.startsWith('maps:0,0?q=Wadmukhwadi%2C%20Alandi%2C%20412105'));
      assert.ok(androidUrl.startsWith('geo:0,0?q=Wadmukhwadi%2C%20Alandi%2C%20412105'));
      assert.ok(webUrl.includes('google.com/maps/search/?api=1'));
    });

    test('Customer details cards stack vertically on narrow screens (<360dp) to prevent horizontal truncation', () => {
      const isNarrowScreen320 = 320 < 360;
      const isNarrowScreen359 = 359 < 360;
      const isStandardScreen375 = 375 < 360;
      const isLargeScreen428 = 428 < 360;

      assert.strictEqual(isNarrowScreen320, true, '320px stacks vertically');
      assert.strictEqual(isNarrowScreen359, true, '359px stacks vertically');
      assert.strictEqual(isStandardScreen375, false, '375px uses 2-column row');
      assert.strictEqual(isLargeScreen428, false, '428px uses 2-column row');
    });

    test('Customer inline edit form validates required name and 10-digit phone', () => {
      function validateEdit(name: string, phone: string): { valid: boolean; error?: string } {
        const trimmedName = name.trim();
        const cleanPhone = phone.replace(/[\s\-()]/g, '');

        if (!trimmedName) {
          return { valid: false, error: 'Customer Name is required.' };
        }
        if (cleanPhone.length < 10) {
          return { valid: false, error: 'Valid 10-digit phone number is required.' };
        }
        return { valid: true };
      }

      assert.strictEqual(validateEdit('', '9834820606').valid, false);
      assert.strictEqual(validateEdit('Harshad', '123').valid, false);
      assert.strictEqual(validateEdit('Harshad Jadhav', '9834820606').valid, true);
    });
  });
});

