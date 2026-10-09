import { describe, it } from 'node:test';
import assert from 'node:assert';
import { DEFAULT_TAG_DESIGN, sanitizeTagDesign, type TagDesignConfig } from './tag-template';

describe('Phase T4 & Business ID Rework: Tag Template & Layout Configuration Contracts', () => {
  it('DEFAULT_TAG_DESIGN contains canonical fields with orderNumber as primary anchor', () => {
    assert.strictEqual(DEFAULT_TAG_DESIGN.version, 1);
    assert.strictEqual(DEFAULT_TAG_DESIGN.fields.length, 7);

    const keys = DEFAULT_TAG_DESIGN.fields.map((f) => f.field);
    assert.deepStrictEqual(keys, [
      'storeHeader',
      'orderNumber',
      'customerName',
      'serviceAndPiece',
      'date',
      'garmentName',
      'tagId',
    ]);

    const orderNumberField = DEFAULT_TAG_DESIGN.fields.find((f) => f.field === 'orderNumber');
    assert.strictEqual(orderNumberField?.enabled, true);
    assert.strictEqual(orderNumberField?.fontSize, 15);
    assert.strictEqual(orderNumberField?.isMono, true);

    assert.strictEqual(DEFAULT_TAG_DESIGN.borderStyle, 'dashed');
    assert.strictEqual(DEFAULT_TAG_DESIGN.containerPaddingMm.top, 2.5);
    assert.strictEqual(DEFAULT_TAG_DESIGN.containerPaddingMm.right, 3.0);
    assert.strictEqual(DEFAULT_TAG_DESIGN.containerPaddingMm.bottom, 2.5);
    assert.strictEqual(DEFAULT_TAG_DESIGN.containerPaddingMm.left, 3.0);
  });

  it('sanitizeTagDesign clamps extreme font sizes into safe physical boundaries (6px - 18px)', () => {
    const extremeInput: any = {
      version: 2,
      name: 'Unsafe Template',
      fields: [
        { field: 'tagId', enabled: true, fontSize: 999, alignment: 'left' },
        { field: 'customerName', enabled: true, fontSize: 1, alignment: 'center' },
      ],
      containerPaddingMm: { top: 0, right: 99, bottom: -5, left: 10 },
      borderStyle: 'unknown_style',
    };

    const sanitized = sanitizeTagDesign(extremeInput);

    // tagId font size clamped to 18px max
    const tagIdField = sanitized.fields.find((f) => f.field === 'tagId');
    assert.strictEqual(tagIdField?.fontSize, 18);

    // customerName font size clamped to 6px min
    const customerField = sanitized.fields.find((f) => f.field === 'customerName');
    assert.strictEqual(customerField?.fontSize, 6);

    // Padding clamped to [1.5, 4.0] mm
    assert.strictEqual(sanitized.containerPaddingMm.top, 1.5);
    assert.strictEqual(sanitized.containerPaddingMm.right, 4.0);
    assert.strictEqual(sanitized.containerPaddingMm.bottom, 1.5);
    assert.strictEqual(sanitized.containerPaddingMm.left, 4.0);

    // Invalid border style defaulted to dashed
    assert.strictEqual(sanitized.borderStyle, 'dashed');
  });

  it('sanitizeTagDesign discards unknown arbitrary field keys', () => {
    const maliciousInput: any = {
      fields: [
        { field: 'tagId', enabled: true, fontSize: 14, alignment: 'left' },
        { field: 'sqlInjectionField', enabled: true, fontSize: 12, alignment: 'left' },
        { field: '<script>alert(1)</script>', enabled: true, fontSize: 12, alignment: 'left' },
      ],
    };

    const sanitized = sanitizeTagDesign(maliciousInput);
    assert.strictEqual(sanitized.fields.length, 7);
    assert.strictEqual(
      sanitized.fields.some((f) => (f as any).field === 'sqlInjectionField'),
      false,
    );
    assert.strictEqual(
      sanitized.fields.some((f) => (f as any).field === '<script>alert(1)</script>'),
      false,
    );
  });
});
