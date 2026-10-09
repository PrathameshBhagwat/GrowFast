import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import {
  PhysicalTag,
  PhysicalTagData,
  getServiceCode,
  formatTagDate,
  formatStoreHeader,
} from './PhysicalTag';
import { TagCalibrationCard } from './TagCalibrationCard';
import { TagPrintLayout } from './TagPrintLayout';
import { TagPreviewModal } from './TagPreviewModal';
import { OrderTagsSection } from './OrderTagsSection';
import {
  OrderDetailDTO,
  OrderStatus,
  PaymentStatus,
  PickupType,
  OrderPriority,
  GarmentCategory,
  ServiceCategory,
  ItemStatus,
  PhotoType,
  DEFAULT_TAG_DESIGN,
  type TagDesignConfig,
} from '@growfast/shared-types';

describe('Phase T2: Tag UI & 40×40 mm Tag Preview & Printing Tests', () => {
  const baseOrder: OrderDetailDTO = {
    id: 'ord-test-t2',
    orderNumber: 'ORD-T2-001',
    customerId: 'cust-1',
    customerName: 'Aishwarya Gangam',
    customerPhone: '9876543210',
    orderDate: '2026-09-02T10:00:00.000Z',
    systemDueDate: '2026-09-05T18:00:00.000Z',
    effectiveDueDate: '2026-09-05T18:00:00.000Z',
    dueDateOverrideReason: null,
    dueDateOverriddenBy: null,
    isExpress: false,
    priority: OrderPriority.STANDARD,
    status: OrderStatus.RECEIVED,
    subtotal: 500,
    discountAmount: 0,
    expressSurcharge: 0,
    taxAmount: 0,
    totalAmount: 500,
    amountPaid: 0,
    amountDue: 500,
    paymentStatus: PaymentStatus.PENDING,
    pickupType: PickupType.STORE_PICKUP,
    serviceSummary: 'Dry Cleaning',
    storeId: 'store-1',
    storeName: 'A Laundry',
    storeAddress: 'Airoli, Navi Mumbai',
    storePhone: '+91 9988776655',
    createdById: 'emp-1',
    createdByName: 'Staff Member',
    itemCount: 5,
    readyAmount: 0,
    remainingAmount: 500,
    collectedAmount: 0,
    cancelledAmount: 0,
    payableAmount: 500,
    payments: [],
    items: [
      {
        id: 'item-shirt-5',
        garmentName: 'Shirt',
        garmentCategory: GarmentCategory.MEN,
        serviceType: ServiceCategory.DRY_CLEAN,
        quantity: 5,
        unitPrice: 100,
        lineTotal: 500,
        colorTags: ['Blue', 'White'],
        defectNotes: null,
        itemStatus: ItemStatus.RECEIVED,
        deliveredQuantity: 0,
        itemDueDate: '2026-09-05T18:00:00.000Z',
        photos: [],
        physicalGarments: [1, 2, 3, 4, 5].map((u) => ({
          id: `pg-shirt-${u}`,
          orderItemId: 'item-shirt-5',
          unitNumber: u,
          tagId: `GF-TAG00${u}`,
          isReady: u <= 2,
          isCancelled: false,
          isDelivered: false,
          deliveredAt: null,
          createdAt: '2026-09-02T10:00:00.000Z',
          updatedAt: '2026-09-02T10:00:00.000Z',
          photos:
            u === 3
              ? [
                  {
                    id: 'photo-pg3',
                    orderItemId: 'item-shirt-5',
                    physicalGarmentId: 'pg-shirt-3',
                    type: PhotoType.FRONT,
                    url: 'https://example.com/photo3.jpg',
                    uploadedAt: '2026-09-02T10:05:00.000Z',
                  },
                ]
              : [],
        })),
      },
    ],
  };

  // ─────────────────────────────────────────────────────────────
  // Helper / Formatting Tests
  // ─────────────────────────────────────────────────────────────
  it('formats compact service codes matching the reference tag conventions', () => {
    expect(getServiceCode('DRY_CLEAN')).toBe('DC');
    expect(getServiceCode('DRY_CLEANING')).toBe('DC');
    expect(getServiceCode('STEAM_PRESS')).toBe('SI');
    expect(getServiceCode('WASH_IRON')).toBe('WSI');
    expect(getServiceCode('WASH')).toBe('W');
    expect(getServiceCode('SHOE_CLEAN')).toBe('SC');
  });

  it('formats dates into compact "D Mon YY Day" format', () => {
    // 2 Sep 2026 Wednesday
    const formatted = formatTagDate('2026-09-02T10:00:00.000Z');
    expect(formatted).toMatch(/2 Sep 26/);
  });

  it('formats store headers compactly', () => {
    expect(formatStoreHeader('A Laundry', 'Airoli')).toBe('A LAUNDRY / AIROLI');
    expect(formatStoreHeader('GrowFast Koramangala')).toBe('GROWFAST KORAMANGALA');
  });

  // ─────────────────────────────────────────────────────────────
  // PhysicalTag Visual Structure (40×40 mm)
  // ─────────────────────────────────────────────────────────────
  it('renders a 40×40 mm square tag with all required reference elements', () => {
    const tagData: PhysicalTagData = {
      tagId: 'T12645',
      unitNumber: 12,
      totalPieces: 50,
      customerName: 'Aishwarya Gangam',
      serviceType: 'STEAM_PRESS',
      garmentName: 'Garment 2 90',
      storeName: 'A Laundry',
      storeLocation: 'Airoli',
      orderDate: '2026-09-02T10:00:00.000Z',
      isCancelled: false,
    };

    const { container } = render(<PhysicalTag data={tagData} />);
    const tagEl = container.querySelector('.physical-tag-40mm') as HTMLElement;

    expect(tagEl).toBeInTheDocument();
    expect(tagEl.style.width).toBe('40mm');
    expect(tagEl.style.height).toBe('40mm');

    // Line 1: Store & Location
    expect(screen.getByText('A LAUNDRY / AIROLI')).toBeInTheDocument();
    // Line 2: Tag ID (prominent)
    expect(screen.getByText('T12645')).toBeInTheDocument();
    // Line 3: Customer Name
    expect(screen.getByText('Aishwarya Gangam')).toBeInTheDocument();
    // Line 4: Service Code + Piece position (SI 12/50)
    expect(screen.getByText(/SI/)).toBeInTheDocument();
    expect(screen.getByText(/12\/50/)).toBeInTheDocument();
    // Line 5: Date
    expect(screen.getByText(/2 Sep 26/)).toBeInTheDocument();
    // Line 6: Garment Name
    expect(screen.getByText('Garment 2 90')).toBeInTheDocument();
  });

  // ─────────────────────────────────────────────────────────────
  // TEST A: Tags render 1/5, 2/5, 3/5, 4/5, 5/5
  // ─────────────────────────────────────────────────────────────
  it('TEST A — TAGS RENDER: renders piece positions 1/5, 2/5, 3/5, 4/5, 5/5 in OrderTagsSection', () => {
    const onViewPhotos = vi.fn();
    render(<OrderTagsSection order={baseOrder} onViewPhotos={onViewPhotos} />);

    expect(screen.getByText('Piece 1/5')).toBeInTheDocument();
    expect(screen.getByText('Piece 2/5')).toBeInTheDocument();
    expect(screen.getByText('Piece 3/5')).toBeInTheDocument();
    expect(screen.getByText('Piece 4/5')).toBeInTheDocument();
    expect(screen.getByText('Piece 5/5')).toBeInTheDocument();
  });

  // ─────────────────────────────────────────────────────────────
  // TEST B: Tag IDs render correctly
  // ─────────────────────────────────────────────────────────────
  it('TEST B — TAG IDS RENDER: displays authoritative tagId for each piece', () => {
    const onViewPhotos = vi.fn();
    render(<OrderTagsSection order={baseOrder} onViewPhotos={onViewPhotos} />);

    expect(screen.getByText('GF-TAG001')).toBeInTheDocument();
    expect(screen.getByText('GF-TAG002')).toBeInTheDocument();
    expect(screen.getByText('GF-TAG003')).toBeInTheDocument();
    expect(screen.getByText('GF-TAG004')).toBeInTheDocument();
    expect(screen.getByText('GF-TAG005')).toBeInTheDocument();
  });

  // ─────────────────────────────────────────────────────────────
  // TEST C: Selection
  // ─────────────────────────────────────────────────────────────
  it('TEST C — SELECTION: selects 1, 3, 5 and updates selection count to 3', () => {
    const onViewPhotos = vi.fn();
    render(<OrderTagsSection order={baseOrder} onViewPhotos={onViewPhotos} />);

    // Select piece 1
    const cb1 = screen.getByRole('button', { name: /select tag for piece 1\/5/i });
    fireEvent.click(cb1);

    // Select piece 3
    const cb3 = screen.getByRole('button', { name: /select tag for piece 3\/5/i });
    fireEvent.click(cb3);

    // Select piece 5
    const cb5 = screen.getByRole('button', { name: /select tag for piece 5\/5/i });
    fireEvent.click(cb5);

    expect(screen.getByText('Print Selected (3)')).toBeInTheDocument();
  });

  // ─────────────────────────────────────────────────────────────
  // TEST D: Print Selected includes only selected tags
  // ─────────────────────────────────────────────────────────────
  it('TEST D — PRINT SELECTED: opens preview and print layout with only the selected tags', () => {
    const onViewPhotos = vi.fn();
    render(<OrderTagsSection order={baseOrder} onViewPhotos={onViewPhotos} />);

    // Select pieces 1 and 4
    fireEvent.click(screen.getByRole('button', { name: /select tag for piece 1\/5/i }));
    fireEvent.click(screen.getByRole('button', { name: /select tag for piece 4\/5/i }));

    const printSelectedBtn = screen.getByRole('button', { name: /print selected \(2\)/i });
    fireEvent.click(printSelectedBtn);

    // Preview modal opened with 2 tags
    expect(screen.getByText('2 tags ready')).toBeInTheDocument();

    const printableContainer = document.getElementById('printable-tags');
    expect(printableContainer).toBeInTheDocument();

    // Check tags inside printable container
    const printTags = printableContainer!.querySelectorAll('.physical-tag-40mm');
    expect(printTags.length).toBe(2);
    expect(printableContainer!.textContent).toContain(baseOrder.orderNumber);
    expect(printableContainer!.textContent).toContain('1/5');
    expect(printableContainer!.textContent).toContain('4/5');
    expect(printableContainer!.textContent).not.toContain('2/5');
  });

  // ─────────────────────────────────────────────────────────────
  // TEST E: Print All includes all active applicable tags in deterministic order
  // ─────────────────────────────────────────────────────────────
  it('TEST E — PRINT ALL: includes all 5 active tags in deterministic order', () => {
    const onViewPhotos = vi.fn();
    render(<OrderTagsSection order={baseOrder} onViewPhotos={onViewPhotos} />);

    const printAllBtn = screen.getByRole('button', { name: /print all tags \(5\)/i });
    fireEvent.click(printAllBtn);

    const printableContainer = document.getElementById('printable-tags');
    expect(printableContainer).toBeInTheDocument();

    const printTags = printableContainer!.querySelectorAll('.physical-tag-40mm');
    expect(printTags.length).toBe(5);

    // Verify deterministic order: unit numbers 1, 2, 3, 4, 5
    const renderedUnits = Array.from(printTags).map((el) => el.getAttribute('data-unit-number'));
    expect(renderedUnits).toEqual(['1', '2', '3', '4', '5']);
  });

  // ─────────────────────────────────────────────────────────────
  // TEST F: Cancelled piece is excluded from Print All
  // ─────────────────────────────────────────────────────────────
  it('TEST F — CANCELLED PIECE: excluded from Print All and shows CANCELLED badge', () => {
    const orderWithCancelled: OrderDetailDTO = {
      ...baseOrder,
      items: [
        {
          ...baseOrder.items[0],
          physicalGarments: baseOrder.items[0].physicalGarments!.map((pg) =>
            pg.unitNumber === 2 ? { ...pg, isCancelled: true } : pg,
          ),
        },
      ],
    };

    const onViewPhotos = vi.fn();
    render(<OrderTagsSection order={orderWithCancelled} onViewPhotos={onViewPhotos} />);

    // Card 2 has CANCELLED badge
    const card2 = screen.getByTestId('tag-card-2');
    expect(within(card2).getByText('CANCELLED')).toBeInTheDocument();

    // Cancelled checkbox is disabled
    const cb2 = screen.getByRole('button', { name: /select tag for piece 2\/5/i });
    expect(cb2).toBeDisabled();

    // Print All button should only target 4 active tags
    const printAllBtn = screen.getByRole('button', { name: /print all tags \(4\)/i });
    expect(printAllBtn).toBeInTheDocument();
    fireEvent.click(printAllBtn);

    const printableContainer = document.getElementById('printable-tags');
    const printTags = printableContainer!.querySelectorAll('.physical-tag-40mm');
    expect(printTags.length).toBe(4);
    expect(printableContainer!.textContent).not.toContain('GF-TAG002');
  });

  // ─────────────────────────────────────────────────────────────
  // TEST G & H: Reprint & Refresh reuse the same tagId
  // ─────────────────────────────────────────────────────────────
  it('TEST G & H — REPRINT & STABILITY: uses the same stable tagId across reprint and re-render', () => {
    const onViewPhotos = vi.fn();
    const { rerender } = render(<OrderTagsSection order={baseOrder} onViewPhotos={onViewPhotos} />);

    expect(screen.getByText('GF-TAG003')).toBeInTheDocument();

    // Trigger single print on piece 3
    const card3 = screen.getByTestId('tag-card-3');
    const printSingleBtn = within(card3).getByRole('button', { name: /print/i });
    fireEvent.click(printSingleBtn);

    const printContainer = document.getElementById('printable-tags');
    expect(printContainer!.textContent).toContain(baseOrder.orderNumber);
    expect(printContainer!.textContent).toContain('3/5');

    // Simulate page re-render / reload with same authoritative order data
    rerender(<OrderTagsSection order={baseOrder} onViewPhotos={onViewPhotos} />);
    expect(screen.getAllByText('GF-TAG003').length).toBeGreaterThanOrEqual(1);
  });

  // ─────────────────────────────────────────────────────────────
  // TEST I: Photo Relationship
  // ─────────────────────────────────────────────────────────────
  it('TEST I — PHOTOS: clicking garment photos button opens photo viewer with correct garment label', () => {
    const onViewPhotos = vi.fn();
    render(<OrderTagsSection order={baseOrder} onViewPhotos={onViewPhotos} />);

    // Piece 3 has 1 photo
    const viewPhotosBtn = screen.getByRole('button', { name: /1 photos/i });
    fireEvent.click(viewPhotosBtn);

    expect(onViewPhotos).toHaveBeenCalledTimes(1);
    expect(onViewPhotos).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ id: 'photo-pg3' })]),
      0,
      expect.stringContaining('Piece 3/5 • Tag GF-TAG003'),
    );
  });

  // ─────────────────────────────────────────────────────────────
  // TEST J: Weight-Based Laundry Behavior
  // ─────────────────────────────────────────────────────────────
  it('TEST J — WEIGHT-BASED LAUNDRY: weight-only items produce 0 fake tags and display informative notice', () => {
    const weightOnlyOrder: OrderDetailDTO = {
      ...baseOrder,
      items: [
        {
          id: 'item-laundry-kg',
          garmentName: 'Mixed Laundry',
          garmentCategory: GarmentCategory.WEIGHT_BASED,
          serviceType: ServiceCategory.WEIGHT_BASED,
          quantity: 1,
          weight: 5.5,
          unitPrice: 80,
          lineTotal: 440,
          colorTags: null,
          defectNotes: null,
          itemStatus: ItemStatus.RECEIVED,
          deliveredQuantity: 0,
          itemDueDate: null,
          photos: [],
          physicalGarments: [], // No physical garments for weight batch
        },
      ],
    };

    const onViewPhotos = vi.fn();
    render(<OrderTagsSection order={weightOnlyOrder} onViewPhotos={onViewPhotos} />);

    // No tag cards
    expect(screen.queryByTestId(/tag-card-/)).not.toBeInTheDocument();
    // Informative message
    expect(screen.getByText(/Weight-Based Laundry Batch/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Weight-based batches do not produce individual physical garment tags/i),
    ).toBeInTheDocument();
  });

  // ─────────────────────────────────────────────────────────────
  // TagPreviewModal and Print Execution
  // ─────────────────────────────────────────────────────────────
  it('TagPreviewModal triggers window.print without application chrome', () => {
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});
    const onClose = vi.fn();

    const sampleTags: PhysicalTagData[] = [
      {
        tagId: 'GF-TEST01',
        unitNumber: 1,
        totalPieces: 2,
        customerName: 'Aishwarya Gangam',
        serviceType: 'DRY_CLEAN',
        garmentName: 'Shirt',
        orderDate: '2026-09-02T10:00:00.000Z',
      },
    ];

    render(<TagPreviewModal open={true} onClose={onClose} tags={sampleTags} />);

    const printBtn = screen.getByRole('button', { name: /print tag/i });
    expect(printBtn).toBeInTheDocument();

    fireEvent.click(printBtn);
    expect(printSpy).toHaveBeenCalled();

    printSpy.mockRestore();
  });

  // ─────────────────────────────────────────────────────────────
  // Accessibility & Touch Target Constraints
  // ─────────────────────────────────────────────────────────────
  it('satisfies touch target minimums (>=44px) for all primary tag action controls', () => {
    const onViewPhotos = vi.fn();
    render(<OrderTagsSection order={baseOrder} onViewPhotos={onViewPhotos} />);

    const selectAllBtn = screen.getByRole('button', { name: /select all/i });
    const printAllBtn = screen.getByRole('button', { name: /print all tags/i });
    const selectCheckbox1 = screen.getByRole('button', { name: /select tag for piece 1\/5/i });
    const previewBtn1 = screen.getAllByRole('button', { name: /preview/i })[0];
    const testTagBtn = screen.getByRole('button', { name: /test tag/i });

    expect(selectAllBtn.className).toContain('min-h-[44px]');
    expect(printAllBtn.className).toContain('min-h-[44px]');
    expect(selectCheckbox1.className).toContain('min-h-[44px]');
    expect(previewBtn1.className).toContain('min-h-[44px]');
    expect(testTagBtn.className).toContain('min-h-[44px]');
  });

  // ─────────────────────────────────────────────────────────────
  // PHASE T3: CALIBRATION CARD & TEST TAG WORKFLOW
  // ─────────────────────────────────────────────────────────────
  describe('Phase T3: Hardening & Calibration', () => {
    it('renders 40×40 mm calibration test card with crosshair and scale guidelines', () => {
      const { container } = render(<TagCalibrationCard />);
      const card = container.querySelector('.tag-calibration-card') as HTMLElement;

      expect(card).toBeInTheDocument();
      expect(card.style.width).toBe('40mm');
      expect(card.style.height).toBe('40mm');
      expect(screen.getByText('TARGET: 40 × 40 mm')).toBeInTheDocument();
      expect(screen.getByText(/SCALE 100%/)).toBeInTheDocument();
      expect(screen.getByText('GF-CALIB-001 (1/1)')).toBeInTheDocument();
      expect(screen.getByText(/MEASURE WITH RULER/)).toBeInTheDocument();
      expect(screen.getByText(/20mm \(CTR\)/)).toBeInTheDocument();
    });

    it('opens Calibration modal when operator clicks "Test Tag" button', () => {
      const onViewPhotos = vi.fn();
      render(<OrderTagsSection order={baseOrder} onViewPhotos={onViewPhotos} />);

      const testTagBtn = screen.getByRole('button', { name: /test tag/i });
      fireEvent.click(testTagBtn);

      expect(screen.getByText('40 × 40 mm Tag Calibration Test')).toBeInTheDocument();
      expect(screen.getByText('Print Calibration Tag')).toBeInTheDocument();
      expect(screen.getAllByTestId('tag-calibration-card').length).toBeGreaterThanOrEqual(1);
    });

    it('TagPrintLayout renders single calibration card with avoid page-break when isCalibration is true', () => {
      const { container } = render(<TagPrintLayout isCalibration={true} tags={[]} />);
      const wrappers = container.querySelectorAll('.printable-tag-wrapper');
      expect(wrappers.length).toBe(1);

      const wrapper = wrappers[0] as HTMLElement;
      expect(wrapper.style.width).toBe('40mm');
      expect(wrapper.style.height).toBe('40mm');
      expect(screen.getByTestId('tag-calibration-card')).toBeInTheDocument();
    });

    // ─────────────────────────────────────────────────────────────
    // LONG TEXT RESILIENCE WITHIN 40×40 MM
    // ─────────────────────────────────────────────────────────────
    it('handles long customer, garment, store, and service values without overflowing 40×40 mm boundary', () => {
      const longData: PhysicalTagData = {
        tagId: 'GF-LONG099',
        unitNumber: 1,
        totalPieces: 50,
        customerName: 'Alexandra Elizabeth Johnson',
        garmentName: 'Premium Traditional Trousers',
        storeName: 'GrowFast Laundry & Dry Cleaning',
        storeLocation: 'Navi Mumbai Central Hub',
        serviceType: 'Wash & Steam Iron',
        orderDate: '2026-10-08T10:00:00.000Z',
        isCancelled: false,
      };

      const { container } = render(<PhysicalTag data={longData} />);
      const tagEl = container.querySelector('.physical-tag-40mm') as HTMLElement;

      expect(tagEl).toBeInTheDocument();
      expect(tagEl.style.width).toBe('40mm');
      expect(tagEl.style.height).toBe('40mm');
      expect(tagEl.style.overflow).toBe('hidden');

      // Canonical mapping for "Wash & Steam Iron"
      expect(getServiceCode('Wash & Steam Iron')).toBe('WSI');
      expect(screen.getByText(/WSI/)).toBeInTheDocument();

      // Long text values are in DOM with truncation containers
      expect(screen.getByText('Alexandra Elizabeth Johnson')).toBeInTheDocument();
      expect(screen.getByText('Premium Traditional Trousers')).toBeInTheDocument();
      expect(screen.getByText('GF-LONG099')).toBeInTheDocument();

      // Date formatting for 08 Oct 26 Thu
      expect(screen.getByText(/08 Oct 26 Thu/)).toBeInTheDocument();
    });

    // ─────────────────────────────────────────────────────────────
    // PIECE POSITIONS: 1/50 AND 50/50
    // ─────────────────────────────────────────────────────────────
    it('correctly renders piece positions 1/50 and 50/50 in physical tags', () => {
      const tag1: PhysicalTagData = {
        tagId: 'GF-P01',
        unitNumber: 1,
        totalPieces: 50,
        customerName: 'Rajesh Kumar',
        serviceType: 'DRY_CLEAN',
        garmentName: 'Suit Jacket',
        orderDate: '2026-10-08T10:00:00.000Z',
      };

      const tag50: PhysicalTagData = {
        tagId: 'GF-P50',
        unitNumber: 50,
        totalPieces: 50,
        customerName: 'Rajesh Kumar',
        serviceType: 'DRY_CLEAN',
        garmentName: 'Suit Trousers',
        orderDate: '2026-10-08T10:00:00.000Z',
      };

      const { rerender } = render(<PhysicalTag data={tag1} />);
      expect(screen.getByText(/1\/50/)).toBeInTheDocument();

      rerender(<PhysicalTag data={tag50} />);
      expect(screen.getByText(/50\/50/)).toBeInTheDocument();
    });

    // ─────────────────────────────────────────────────────────────
    // LARGE BATCH PERFORMANCE: 50 TAGS, 0 IMAGES, DETERMINISTIC
    // ─────────────────────────────────────────────────────────────
    it('renders large 50-tag batch with deterministic ordering and 0 img tags in print DOM', () => {
      const batch50: PhysicalTagData[] = Array.from({ length: 50 }, (_, i) => ({
        tagId: `GF-BATCH-${String(i + 1).padStart(3, '0')}`,
        unitNumber: i + 1,
        totalPieces: 50,
        customerName: `Customer ${i + 1}`,
        serviceType: 'DRY_CLEAN',
        garmentName: `Garment Item ${i + 1}`,
        orderDate: '2026-10-08T10:00:00.000Z',
      }));

      // Shuffle array to test deterministic sorting in TagPrintLayout
      const shuffled = [...batch50].sort(() => Math.random() - 0.5);

      const { container } = render(<TagPrintLayout tags={shuffled} />);
      const renderedTags = container.querySelectorAll('.physical-tag-40mm');
      expect(renderedTags.length).toBe(50);

      // Verify deterministic sorting: 1 to 50
      const unitNumbers = Array.from(renderedTags).map((el) => el.getAttribute('data-unit-number'));
      const expectedUnits = Array.from({ length: 50 }, (_, i) => String(i + 1));
      expect(unitNumbers).toEqual(expectedUnits);

      // Verify zero <img> elements inside print layout for optimal print spooling
      const imgElements = container.querySelectorAll('img');
      expect(imgElements.length).toBe(0);
    });

    // ─────────────────────────────────────────────────────────────
    // SAFETY: PRINTING NEVER MUTATES FINANCIAL OR STATUS STATE
    // ─────────────────────────────────────────────────────────────
    it('printing actions never alter order amounts, paymentStatus, or item status', () => {
      const onViewPhotos = vi.fn();
      render(<OrderTagsSection order={baseOrder} onViewPhotos={onViewPhotos} />);

      // Order financial and status baselines
      expect(baseOrder.totalAmount).toBe(500);
      expect(baseOrder.amountDue).toBe(500);
      expect(baseOrder.paymentStatus).toBe(PaymentStatus.PENDING);
      expect(baseOrder.status).toBe(OrderStatus.RECEIVED);

      // Open print all
      const printAllBtn = screen.getByRole('button', { name: /print all tags \(5\)/i });
      fireEvent.click(printAllBtn);

      const printTrigger = screen.getByRole('button', { name: /print all selected/i });
      fireEvent.click(printTrigger);

      // State remains strictly immutable
      expect(baseOrder.totalAmount).toBe(500);
      expect(baseOrder.amountDue).toBe(500);
      expect(baseOrder.paymentStatus).toBe(PaymentStatus.PENDING);
      expect(baseOrder.status).toBe(OrderStatus.RECEIVED);
    });
  });

  // ═════════════════════════════════════════════════════════════════
  // PHASE T4: ADMIN TAG DESIGNER & CUSTOM PRESENTATION TESTS
  // ═════════════════════════════════════════════════════════════════
  describe('Phase T4: Admin Tag Designer Layout & Customization Tests', () => {
    const sampleTag: PhysicalTagData = {
      tagId: 'GF-DESIGN-01',
      unitNumber: 1,
      totalPieces: 5,
      customerName: 'Aishwarya Gangam',
      serviceType: 'DRY_CLEAN',
      garmentName: 'Silk Saree',
      storeName: 'A Laundry',
      storeLocation: 'Airoli',
      orderDate: '2026-09-02T10:00:00.000Z',
    };

    it('renders with default canonical design matching approved T2/T3 structure', () => {
      const { container } = render(<PhysicalTag data={sampleTag} design={DEFAULT_TAG_DESIGN} />);
      const tag = container.querySelector('.physical-tag-40mm');
      expect(tag).toBeInTheDocument();
      expect(screen.getByText('GF-DESIGN-01')).toBeInTheDocument();
      expect(screen.getByText('Aishwarya Gangam')).toBeInTheDocument();
      expect(screen.getByText('Silk Saree')).toBeInTheDocument();
      expect(screen.getByText(/A LAUNDRY \/ AIROLI/i)).toBeInTheDocument();
    });

    it('custom field sequence renders fields in customized vertical order', () => {
      const customDesign: TagDesignConfig = {
        ...DEFAULT_TAG_DESIGN,
        fields: [
          {
            field: 'tagId',
            enabled: true,
            fontSize: 16,
            alignment: 'center',
            isBold: true,
            label: 'Tag ID',
          },
          {
            field: 'customerName',
            enabled: true,
            fontSize: 10,
            alignment: 'center',
            label: 'Customer Name',
          },
          {
            field: 'storeHeader',
            enabled: true,
            fontSize: 8,
            alignment: 'center',
            label: 'Store',
          },
          {
            field: 'garmentName',
            enabled: true,
            fontSize: 9,
            alignment: 'center',
            label: 'Garment',
          },
        ],
      };

      const { container } = render(<PhysicalTag data={sampleTag} design={customDesign} />);
      const tag = container.querySelector('.physical-tag-40mm')!;
      const children = Array.from(tag.children);

      expect(children[0]).toHaveTextContent('GF-DESIGN-01');
      expect(children[1]).toHaveTextContent('Aishwarya Gangam');
    });

    it('field visibility controls: disables hidden fields from DOM', () => {
      const hiddenFieldsDesign: TagDesignConfig = {
        ...DEFAULT_TAG_DESIGN,
        fields: DEFAULT_TAG_DESIGN.fields.map((f) =>
          f.field === 'customerName' || f.field === 'storeHeader' ? { ...f, enabled: false } : f,
        ),
      };

      render(<PhysicalTag data={sampleTag} design={hiddenFieldsDesign} />);

      expect(screen.getByText('GF-DESIGN-01')).toBeInTheDocument();
      expect(screen.getByText('Silk Saree')).toBeInTheDocument();
      expect(screen.queryByText('Aishwarya Gangam')).not.toBeInTheDocument();
      expect(screen.queryByText(/A LAUNDRY/i)).not.toBeInTheDocument();
    });

    it('alignment classes apply text-center and text-right correctly', () => {
      const alignedDesign: TagDesignConfig = {
        ...DEFAULT_TAG_DESIGN,
        fields: [
          {
            field: 'tagId',
            enabled: true,
            fontSize: 15,
            alignment: 'center',
          },
          {
            field: 'customerName',
            enabled: true,
            fontSize: 9,
            alignment: 'right',
          },
        ],
      };

      const { container } = render(<PhysicalTag data={sampleTag} design={alignedDesign} />);
      const tagIdWrapper = container
        .querySelector('[title="GF-DESIGN-01"]')
        ?.closest('div.overflow-hidden');
      expect(tagIdWrapper).toHaveClass('text-center');

      const customerWrapper = container
        .querySelector('[title="Aishwarya Gangam"]')
        ?.closest('div.overflow-hidden');
      expect(customerWrapper).toHaveClass('text-right');
    });

    it('safe padding and border styles apply to physical tag container', () => {
      const styledDesign: TagDesignConfig = {
        ...DEFAULT_TAG_DESIGN,
        containerPaddingMm: { top: 3.0, right: 3.5, bottom: 3.0, left: 3.5 },
        borderStyle: 'solid',
        borderColor: '#000000',
      };

      const { container } = render(<PhysicalTag data={sampleTag} design={styledDesign} />);
      const tagEl = container.querySelector('.physical-tag-40mm') as HTMLElement;
      expect(tagEl.style.paddingTop).toBe('3mm');
      expect(tagEl.style.paddingRight).toBe('3.5mm');
      expect(tagEl.style.paddingBottom).toBe('3mm');
      expect(tagEl.style.paddingLeft).toBe('3.5mm');
      expect(tagEl.style.border).toContain('solid');
    });

    it('borderStyle "none" removes border styling', () => {
      const noBorderDesign: TagDesignConfig = {
        ...DEFAULT_TAG_DESIGN,
        borderStyle: 'none',
      };

      const { container } = render(<PhysicalTag data={sampleTag} design={noBorderDesign} />);
      const tagEl = container.querySelector('.physical-tag-40mm') as HTMLElement;
      // In CSS / jsdom, border: 'none' may be serialized as 'none', 'medium', or borderStyle 'none'
      expect(
        tagEl.style.border === 'none' ||
          tagEl.style.borderStyle === 'none' ||
          tagEl.style.border === 'medium',
      ).toBe(true);
    });

    it('long customer and garment names remain safely truncated with custom design', () => {
      const longData: PhysicalTagData = {
        ...sampleTag,
        customerName: 'Dr. Rajeshwari Swaminathan-Venkatesh-Ramanujan',
        garmentName:
          'Embroidered Heavy Pure Zari Designer Wedding Sherwani with Matching Dupatta and Churidar',
      };

      const { container } = render(<PhysicalTag data={longData} design={DEFAULT_TAG_DESIGN} />);
      const customerEl = container.querySelector(
        '[title="Dr. Rajeshwari Swaminathan-Venkatesh-Ramanujan"]',
      );
      expect(customerEl).toBeInTheDocument();
      expect(customerEl).toHaveClass('truncate');

      const garmentEl = container.querySelector(
        '[title="Embroidered Heavy Pure Zari Designer Wedding Sherwani with Matching Dupatta and Churidar"]',
      );
      expect(garmentEl).toBeInTheDocument();
      expect(garmentEl).toHaveClass('truncate');
    });

    it('TagPrintLayout renders all tags using the active design', () => {
      const customDesign: TagDesignConfig = {
        ...DEFAULT_TAG_DESIGN,
        fields: [
          {
            field: 'tagId',
            enabled: true,
            fontSize: 14,
            alignment: 'center',
          },
        ],
      };

      const tags: PhysicalTagData[] = [
        { ...sampleTag, unitNumber: 1 },
        { ...sampleTag, unitNumber: 2, tagId: 'GF-DESIGN-02' },
      ];

      const { container } = render(<TagPrintLayout tags={tags} design={customDesign} />);
      const renderedTags = container.querySelectorAll('.physical-tag-40mm');
      expect(renderedTags.length).toBe(2);

      expect(screen.getByText('GF-DESIGN-01')).toBeInTheDocument();
      expect(screen.getByText('GF-DESIGN-02')).toBeInTheDocument();
      expect(screen.queryByText('Aishwarya Gangam')).not.toBeInTheDocument();
    });

    it('OrderTagsSection renders Tag Designer button when onOpenDesigner callback is provided', () => {
      const onViewPhotos = vi.fn();
      const onOpenDesigner = vi.fn();

      render(
        <OrderTagsSection
          order={baseOrder}
          onViewPhotos={onViewPhotos}
          onOpenDesigner={onOpenDesigner}
        />,
      );

      const designerBtn = screen.getByRole('button', { name: /tag designer/i });
      expect(designerBtn).toBeInTheDocument();

      fireEvent.click(designerBtn);
      expect(onOpenDesigner).toHaveBeenCalledTimes(1);
    });

    it('TagPreviewModal renders live preview with active custom design', () => {
      const customDesign: TagDesignConfig = {
        ...DEFAULT_TAG_DESIGN,
        fields: [
          {
            field: 'tagId',
            enabled: true,
            fontSize: 16,
            alignment: 'center',
          },
        ],
      };

      render(
        <TagPreviewModal open={true} onClose={vi.fn()} tags={[sampleTag]} design={customDesign} />,
      );

      expect(screen.getAllByText('GF-DESIGN-01').length).toBeGreaterThanOrEqual(1);
      expect(screen.queryByText('Aishwarya Gangam')).not.toBeInTheDocument();
    });
  });
});
