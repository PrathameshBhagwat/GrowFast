import { BillPdfService, BillOrderData } from './bill-pdf.service';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentStatus } from '@growfast/shared-types';

describe('BillPdfService', () => {
  let service: BillPdfService;
  let mockPrisma: any;

  const mockOrderData: BillOrderData = {
    orderNumber: 'T12843',
    orderDate: '2026-10-07T10:00:00Z',
    effectiveDueDate: '2026-10-11T18:00:00Z',
    pickupType: 'STORE_PICKUP',
    isExpress: true,
    expressDeliveryOption: 'SAME_DAY',
    expressSurcharge: 50,
    customerName: 'Prathamesh Bhagwat',
    customerCode: 'CUST-001',
    customerPhone: '+91 9876543210',
    createdByName: 'Staff Alice',
    items: [
      {
        id: 'item-1',
        garmentName: 'Shirt',
        serviceType: 'Dry Clean',
        quantity: 2,
        weight: null,
        unitPrice: 90,
        lineTotal: 180,
      },
    ],
    subtotal: 180,
    discountAmount: 0,
    taxAmount: 0,
    totalAmount: 230,
    amountPaid: 230,
    amountDue: 0,
    paymentStatus: PaymentStatus.PAID,
    paymentMode: 'CASH',
    storeName: 'GrowFast Laundry',
    storeAddress: '123 Market St, Pune',
    storePhone: '+91 9876543210',
  };

  beforeEach(() => {
    mockPrisma = {
      order: {
        findUnique: jest.fn(),
      },
    };
    service = new BillPdfService(mockPrisma as unknown as PrismaService);
  });

  describe('generateBillHtml', () => {
    it('should generate complete HTML containing store, order, customer and item details', () => {
      const html = service.generateBillHtml(mockOrderData);

      expect(html).toContain('GROWFAST');
      expect(html).toContain('Laundry &amp; Dry-Cleaning Services');
      expect(html).toContain('GrowFast Laundry');
      expect(html).toContain('123 Market St, Pune');
      expect(html).toContain('#T12843');
      expect(html).toContain('Prathamesh Bhagwat');
      expect(html).toContain('CUST-001');
      expect(html).toContain('+91 9876543210');
      expect(html).toContain('Shirt');
      expect(html).toContain('Dry Clean');
      expect(html).toContain('SAME-DAY EXPRESS (2×)');
      expect(html).toContain('₹230.00');
      expect(html).toContain('Garment collection notice:');
      expect(html).toContain('Stain removal notice:');
      expect(html).toContain('Thank you for choosing GrowFast!');
    });

    it('should display correct balance due and payment status', () => {
      const unpaidOrder: BillOrderData = {
        ...mockOrderData,
        amountPaid: 0,
        amountDue: 230,
        paymentStatus: PaymentStatus.PENDING,
      };

      const html = service.generateBillHtml(unpaidOrder);
      expect(html).toContain('PENDING');
      expect(html).toContain('₹230.00');
    });
  });

  describe('renderPdfFromOrderData', () => {
    it('should return a valid PDF buffer starting with %PDF', async () => {
      const buffer = await service.renderPdfFromOrderData(mockOrderData);
      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.length).toBeGreaterThan(100);
      const header = buffer.subarray(0, 4).toString('utf-8');
      expect(header).toBe('%PDF');
    }, 15000);

    it('should be idempotent across multiple generations without modifying state', async () => {
      const buffer1 = await service.renderPdfFromOrderData(mockOrderData);
      const buffer2 = await service.renderPdfFromOrderData(mockOrderData);
      expect(buffer1.length).toBeGreaterThan(100);
      expect(buffer2.length).toBeGreaterThan(100);
      expect(mockPrisma.order.findUnique).not.toHaveBeenCalled();
    }, 15000);
  });

  describe('fetchOrderData', () => {
    it('should fetch and map order entity correctly', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        id: 'order-123',
        orderNumber: 'T12843',
        orderDate: new Date('2026-10-07'),
        systemDueDate: new Date('2026-10-11'),
        effectiveDueDate: new Date('2026-10-11'),
        pickupType: 'STORE_PICKUP',
        isExpress: false,
        expressDeliveryOption: null,
        expressSurcharge: 0,
        subtotal: 100,
        discountAmount: 0,
        taxAmount: 0,
        totalAmount: 100,
        amountPaid: 100,
        amountDue: 0,
        paymentStatus: 'PAID',
        customer: { name: 'John Doe', code: 'C-01', phone: '1234567890' },
        createdBy: { name: 'Alice' },
        deliveredBy: null,
        store: { name: 'GrowFast Main', address: 'Main Street', phone: '123' },
        payments: [{ mode: 'UPI' }],
        items: [
          {
            id: 'it-1',
            quantity: 1,
            unitPrice: 100,
            lineTotal: 100,
            itemStatus: 'READY',
            deliveredQuantity: 0,
            garmentCatalog: { name: 'Suit' },
            serviceType: { name: 'Dry Clean' },
            physicalGarments: [],
          },
        ],
      });

      const result = await service.fetchOrderData('order-123', 'store-1');
      expect(result).not.toBeNull();
      expect(result?.orderNumber).toBe('T12843');
      expect(result?.customerName).toBe('John Doe');
      expect(result?.paymentMode).toBe('UPI');
      expect(result?.items[0].garmentName).toBe('Suit');
    });

    it('should return null if order does not exist', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(null);
      const result = await service.fetchOrderData('order-unknown');
      expect(result).toBeNull();
    });
  });
});
