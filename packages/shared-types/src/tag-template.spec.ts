import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  DEFAULT_TAG_DESIGN,
  CANONICAL_7FIELD_TAG_DESIGN,
  sanitizeTagDesign,
  resolveServiceShortcut,
  resolveGarmentCategory,
  formatPieceNumber,
  formatGarmentTagLine,
  formatTagDueDate,
  type TagDesignConfig,
} from './tag-template';

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

  describe('Garment Category & Piece Numbering Improvements (12 Test Cases)', () => {
    it('Case 1: One shirt for Dry Clean -> DC | SHIRT | 1/1', () => {
      const shortcut = resolveServiceShortcut('Dry Clean');
      const category = resolveGarmentCategory('MEN', 'Shirt');
      const piece = formatPieceNumber(1, 1);
      const line = formatGarmentTagLine({
        serviceShortcut: shortcut,
        garmentCategory: category,
        pieceNumber: piece,
      });

      assert.strictEqual(shortcut, 'DC');
      assert.strictEqual(category, 'SHIRT');
      assert.strictEqual(piece, '1/1');
      assert.strictEqual(line, 'DC | SHIRT | 1/1');
    });

    it('Case 2: Five shirts for Dry Clean -> DC | SHIRT | 1/5 through 5/5', () => {
      const shortcut = resolveServiceShortcut('DRY_CLEAN');
      const category = resolveGarmentCategory('MEN', 'Shirts');
      const lines = [1, 2, 3, 4, 5].map((u) => {
        const piece = formatPieceNumber(u, 5);
        return formatGarmentTagLine({
          serviceShortcut: shortcut,
          garmentCategory: category,
          pieceNumber: piece,
        });
      });

      assert.deepStrictEqual(lines, [
        'DC | SHIRT | 1/5',
        'DC | SHIRT | 2/5',
        'DC | SHIRT | 3/5',
        'DC | SHIRT | 4/5',
        'DC | SHIRT | 5/5',
      ]);
    });

    it('Case 3: Three pants for Dry Clean -> DC | PANT | 1/3 through 3/3', () => {
      const shortcut = resolveServiceShortcut('DRY_CLEAN');
      const category = resolveGarmentCategory('MEN', 'Pants');
      const lines = [1, 2, 3].map((u) => {
        const piece = formatPieceNumber(u, 3);
        return formatGarmentTagLine({
          serviceShortcut: shortcut,
          garmentCategory: category,
          pieceNumber: piece,
        });
      });

      assert.deepStrictEqual(lines, ['DC | PANT | 1/3', 'DC | PANT | 2/3', 'DC | PANT | 3/3']);
    });

    it('Case 4: Shirts and pants in the same order -> each category gets independent numbering', () => {
      // Simulating order with 5 shirts and 3 pants
      const orderItems = [
        { garmentCategory: 'MEN', garmentName: 'Shirt', serviceType: 'DRY_CLEAN', quantity: 5 },
        { garmentCategory: 'MEN', garmentName: 'Pants', serviceType: 'DRY_CLEAN', quantity: 3 },
      ];

      // Group totals
      const totals = new Map<string, number>();
      for (const item of orderItems) {
        const cat = resolveGarmentCategory(item.garmentCategory, item.garmentName);
        const svc = resolveServiceShortcut(item.serviceType);
        const key = `${cat}::${svc}`;
        totals.set(key, (totals.get(key) || 0) + item.quantity);
      }

      assert.strictEqual(totals.get('SHIRT::DC'), 5);
      assert.strictEqual(totals.get('PANT::DC'), 3);

      const counters = new Map<string, number>();
      const generatedTags: string[] = [];

      for (const item of orderItems) {
        const cat = resolveGarmentCategory(item.garmentCategory, item.garmentName);
        const svc = resolveServiceShortcut(item.serviceType);
        const key = `${cat}::${svc}`;
        const total = totals.get(key)!;

        for (let i = 1; i <= item.quantity; i++) {
          const current = (counters.get(key) || 0) + 1;
          counters.set(key, current);
          const piece = formatPieceNumber(current, total);
          generatedTags.push(
            formatGarmentTagLine({
              serviceShortcut: svc,
              garmentCategory: cat,
              pieceNumber: piece,
            }),
          );
        }
      }

      assert.deepStrictEqual(generatedTags, [
        'DC | SHIRT | 1/5',
        'DC | SHIRT | 2/5',
        'DC | SHIRT | 3/5',
        'DC | SHIRT | 4/5',
        'DC | SHIRT | 5/5',
        'DC | PANT | 1/3',
        'DC | PANT | 2/3',
        'DC | PANT | 3/3',
      ]);
    });

    it('Case 5: The same category with different services -> correct service appears on each tag', () => {
      // 2 Shirts for Steam Iron, 3 Shirts for Dry Clean
      const items = [
        { garmentCategory: 'MEN', garmentName: 'Shirt', serviceType: 'STEAM_PRESS', quantity: 2 },
        { garmentCategory: 'MEN', garmentName: 'Shirt', serviceType: 'DRY_CLEAN', quantity: 3 },
      ];

      const totals = new Map<string, number>();
      for (const item of items) {
        const cat = resolveGarmentCategory(item.garmentCategory, item.garmentName);
        const svc = resolveServiceShortcut(item.serviceType);
        const key = `${cat}::${svc}`;
        totals.set(key, (totals.get(key) || 0) + item.quantity);
      }

      assert.strictEqual(totals.get('SHIRT::SI'), 2);
      assert.strictEqual(totals.get('SHIRT::DC'), 3);

      const counters = new Map<string, number>();
      const tags: string[] = [];
      for (const item of items) {
        const cat = resolveGarmentCategory(item.garmentCategory, item.garmentName);
        const svc = resolveServiceShortcut(item.serviceType);
        const key = `${cat}::${svc}`;
        const total = totals.get(key)!;

        for (let i = 1; i <= item.quantity; i++) {
          const current = (counters.get(key) || 0) + 1;
          counters.set(key, current);
          tags.push(
            formatGarmentTagLine({
              serviceShortcut: svc,
              garmentCategory: cat,
              pieceNumber: formatPieceNumber(current, total),
            }),
          );
        }
      }

      assert.deepStrictEqual(tags, [
        'SI | SHIRT | 1/2',
        'SI | SHIRT | 2/2',
        'DC | SHIRT | 1/3',
        'DC | SHIRT | 2/3',
        'DC | SHIRT | 3/3',
      ]);
    });

    it('Case 6: Long garment names are normalized and formatted properly', () => {
      const longName = 'Embroidered Heavy Designer Sherwani (Special)';
      const resolved = resolveGarmentCategory('MEN', longName);
      assert.strictEqual(resolved, 'EMBROIDERED HEAVY DESIGNER SHERWANI');

      const tagLine = formatGarmentTagLine({
        serviceShortcut: 'DC',
        garmentCategory: resolved,
        pieceNumber: '1/1',
      });
      assert.strictEqual(tagLine, 'DC | EMBROIDERED HEAVY DESIGNER SHERWANI | 1/1');
    });

    it('Case 7: Missing category falls back to item name, or GARMENT if both empty', () => {
      // Demographics fall back to item name
      assert.strictEqual(resolveGarmentCategory('WOMEN', 'Silk Saree'), 'SILK SAREE');
      assert.strictEqual(resolveGarmentCategory('HOUSEHOLD', 'Curtains'), 'CURTAIN');
      assert.strictEqual(resolveGarmentCategory(null, 'Jacket'), 'JACKET');
      assert.strictEqual(resolveGarmentCategory('', 'T-Shirts'), 'T-SHIRT');
      // If both missing
      assert.strictEqual(resolveGarmentCategory(null, null), 'GARMENT');
      assert.strictEqual(resolveGarmentCategory('', ''), 'GARMENT');
    });

    it('Case 8: Due date formatting strictly follows "03 Nov 26" format', () => {
      const formatted = formatTagDueDate('2026-11-03T18:00:00.000Z');
      assert.strictEqual(formatted, '03 Nov 26');
    });

    it('Case 9: CANONICAL_7FIELD_TAG_DESIGN contains all 7 required fields enabled by default', () => {
      assert.strictEqual(CANONICAL_7FIELD_TAG_DESIGN.fields.length, 7);
      const keys = CANONICAL_7FIELD_TAG_DESIGN.fields.map((f) => f.field);
      assert.deepStrictEqual(keys, [
        'shopName',
        'orderNumber',
        'customerName',
        'serviceShortcut',
        'garmentCategory',
        'pieceNumber',
        'dueDate',
      ]);
      assert.strictEqual(
        CANONICAL_7FIELD_TAG_DESIGN.fields.every((f) => f.enabled),
        true,
      );
    });

    it('Case 10: sanitizeTagDesign guarantees all 7 canonical fields are present and safe', () => {
      const sanitized = sanitizeTagDesign({
        version: 1,
        fields: [
          { field: 'shopName', enabled: true, fontSize: 10, alignment: 'center' },
          { field: 'orderNumber', enabled: true, fontSize: 14, alignment: 'center' },
        ],
      });

      assert.strictEqual(sanitized.fields.length, 7);
      const keys = sanitized.fields.map((f) => f.field);
      assert.ok(keys.includes('garmentCategory'));
      assert.ok(keys.includes('pieceNumber'));
      assert.ok(keys.includes('dueDate'));
      assert.ok(keys.includes('serviceShortcut'));
      assert.ok(keys.includes('customerName'));
    });

    it('Case 11: formatGarmentTagLine handles partial field disabling cleanly', () => {
      // Without service
      assert.strictEqual(
        formatGarmentTagLine({ garmentCategory: 'SHIRT', pieceNumber: '1/5' }),
        'SHIRT | 1/5',
      );
      // Without piece
      assert.strictEqual(
        formatGarmentTagLine({ serviceShortcut: 'DC', garmentCategory: 'SHIRT' }),
        'DC | SHIRT',
      );
      // Without category
      assert.strictEqual(
        formatGarmentTagLine({ serviceShortcut: 'DC', pieceNumber: '1/5' }),
        'DC | 1/5',
      );
      // Category only
      assert.strictEqual(formatGarmentTagLine({ garmentCategory: 'SHIRT' }), 'SHIRT');
    });

    it('Case 12: Jacketed orders with Steam Iron resolve to SI | JACKET | 1/2', () => {
      const shortcut = resolveServiceShortcut('Steam Iron');
      const cat = resolveGarmentCategory('MEN', 'Jackets');
      const piece = formatPieceNumber(1, 2);
      assert.strictEqual(
        formatGarmentTagLine({
          serviceShortcut: shortcut,
          garmentCategory: cat,
          pieceNumber: piece,
        }),
        'SI | JACKET | 1/2',
      );
    });
  });
});
