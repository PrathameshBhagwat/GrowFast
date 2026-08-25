/**
 * Prisma Seed Script — Development Data Only
 *
 * ⚠️  WARNING: These are NOT production credentials.
 * ⚠️  Development PINs are for local testing only.
 *
 * Usage: npx tsx prisma/seed.ts
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
const prisma = new PrismaClient();
const SALT_ROUNDS = 10;
async function hashPin(pin) {
  return bcrypt.hash(pin, SALT_ROUNDS);
}
async function main() {
  console.log('🌱 Seeding database...\n');
  // ─── Store ──────────────────────────────────────────────────────
  const store = await prisma.store.upsert({
    where: { id: 'store-kp-001' },
    update: {},
    create: {
      id: 'store-kp-001',
      name: 'Koregaon Park Branch',
      address: 'Shop 4, Lane 7, Koregaon Park, Pune 411001',
      phone: '+91 20 2615 0000',
    },
  });
  console.log(`✅ Store: ${store.name}`);
  // ─── Employees ────────────────────────────────────────────────
  // ⚠️ DEVELOPMENT-ONLY PINs — do NOT use in production
  const employees = [
    {
      id: 'emp-owner-001',
      name: 'Prathamesh Bhagwat',
      email: 'prathamesh@growfast.in',
      role: 'OWNER',
      pin: '111111',
    },
    {
      id: 'emp-mgr-001',
      name: 'Rajesh Nair',
      email: 'rajesh@growfast.in',
      role: 'MANAGER',
      pin: '222222',
    },
    {
      id: 'emp-counter-001',
      name: 'Swapnil Shinde',
      email: 'swapnil@growfast.in',
      role: 'COUNTER',
      pin: '333333',
    },
    {
      id: 'emp-delivery-001',
      name: 'Kiran More',
      email: 'kiran@growfast.in',
      role: 'DELIVERY',
      pin: '444444',
    },
  ];
  for (const emp of employees) {
    const pinHash = await hashPin(emp.pin);
    await prisma.employee.upsert({
      where: { id: emp.id },
      update: { pinHash },
      create: {
        id: emp.id,
        name: emp.name,
        email: emp.email,
        role: emp.role,
        pinHash,
        storeId: store.id,
      },
    });
    console.log(`✅ Employee: ${emp.name} (${emp.role}) — PIN: ${emp.pin}`);
  }
  // ─── Garment Catalog ──────────────────────────────────────────
  const garments = [
    { id: 'garment-shirt', name: 'Shirt', category: 'MEN' },
    { id: 'garment-trouser', name: 'Trouser / Pant', category: 'MEN' },
    { id: 'garment-kurta', name: 'Kurta (Men)', category: 'MEN' },
    { id: 'garment-saree', name: 'Saree', category: 'WOMEN' },
    { id: 'garment-dress', name: 'Women Dress', category: 'WOMEN' },
    { id: 'garment-bedsheet', name: 'Bedsheet (Double)', category: 'HOUSEHOLD' },
    { id: 'garment-sneakers', name: 'Sneakers / Sports Shoes', category: 'SHOES' },
    { id: 'garment-suit', name: 'Suit (2 Piece)', category: 'MEN' },
  ];
  for (const g of garments) {
    await prisma.garmentCatalog.upsert({
      where: { id: g.id },
      update: {},
      create: g,
    });
  }
  console.log(`✅ Garment catalog: ${garments.length} items`);
  // ─── Service Types ────────────────────────────────────────────
  const services = [
    { id: 'svc-dry-clean', name: 'Dry Cleaning', category: 'DRY_CLEAN', estimatedDays: 2 },
    {
      id: 'svc-steam-press',
      name: 'Steam Pressing',
      category: 'STEAM_PRESS',
      estimatedDays: 1,
    },
    { id: 'svc-wash', name: 'Standard Wash', category: 'WASH', estimatedDays: 2 },
    {
      id: 'svc-wash-iron',
      name: 'Wash + Steam Iron',
      category: 'WASH_IRON',
      estimatedDays: 2,
    },
    {
      id: 'svc-shoe-clean',
      name: 'Premium Shoe Spa',
      category: 'SHOE_CLEAN',
      estimatedDays: 3,
    },
    {
      id: 'svc-leather',
      name: 'Leather & Suede Spa',
      category: 'LEATHER_CLEAN',
      estimatedDays: 4,
    },
    {
      id: 'svc-stain',
      name: 'Targeted Spotting',
      category: 'STAIN_REMOVAL',
      estimatedDays: 2,
    },
    {
      id: 'svc-weight',
      name: 'Laundry by Weight',
      category: 'WEIGHT_BASED',
      estimatedDays: 2,
    },
  ];
  for (const s of services) {
    await prisma.serviceType.upsert({
      where: { id: s.id },
      update: {},
      create: s,
    });
  }
  console.log(`✅ Service types: ${services.length} items`);
  // ─── Customers ────────────────────────────────────────────────
  const customers = [
    {
      id: 'cust-001',
      name: 'Rahul Patil',
      phone: '+919876543210',
      email: 'rahul.patil@example.com',
      address: 'Flat 402, Rohan Vasanta, Baner Road, Pune',
      pincode: '411045',
      membership: 'GOLD',
      discountPercent: 10,
    },
    {
      id: 'cust-002',
      name: 'Sneha Kulkarni',
      phone: '+919823456789',
      email: 'sneha.k@outlook.com',
      address: 'B-12, Hermes Nest, Koregaon Park, Pune',
      pincode: '411001',
      membership: 'SILVER',
      discountPercent: 5,
    },
    {
      id: 'cust-003',
      name: 'Amit Shah',
      phone: '+919811122334',
      email: 'amit.shah@techcorp.in',
      address: 'Villa 7, Pride World City, Charholi, Pune',
      pincode: '412105',
    },
    {
      id: 'cust-004',
      name: 'Priya Joshi',
      phone: '+919855566778',
      address: 'Flat 801, Marvel Bounty, Hadapsar, Pune',
      pincode: '411028',
    },
    {
      id: 'cust-005',
      name: 'Neha Deshmukh',
      phone: '+919766654321',
      address: 'Rowhouse 4, Green Acres, Viman Nagar, Pune',
      pincode: '411014',
    },
  ];
  for (const c of customers) {
    await prisma.customer.upsert({
      where: { id: c.id },
      update: {},
      create: {
        id: c.id,
        name: c.name,
        phone: c.phone,
        email: c.email ?? null,
        address: c.address ?? null,
        pincode: c.pincode ?? null,
        membership: c.membership ?? 'NONE',
        discountPercent: c.discountPercent ?? 0,
      },
    });
  }
  console.log(`✅ Customers: ${customers.length} records`);
  // ─── Orders ───────────────────────────────────────────────────
  const now = new Date();
  const twoDaysFromNow = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
  const oneDayFromNow = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000);
  const yesterday = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
  // Order 1: Normal, partially paid
  const order1 = await prisma.order.upsert({
    where: { id: 'order-001' },
    update: {},
    create: {
      id: 'order-001',
      orderNumber: 'ORD-0001',
      customerId: 'cust-001',
      systemDueDate: twoDaysFromNow,
      effectiveDueDate: twoDaysFromNow,
      status: 'QUALITY_CHECK',
      subtotal: 735,
      discountAmount: 50,
      totalAmount: 685,
      amountPaid: 500,
      amountDue: 185,
      paymentStatus: 'PARTIAL',
      priority: 'STANDARD',
      pickupType: 'STORE_PICKUP',
      createdById: 'emp-counter-001',
      storeId: store.id,
    },
  });
  // Order 1 items
  await prisma.orderItem.upsert({
    where: { id: 'oi-001-1' },
    update: {},
    create: {
      id: 'oi-001-1',
      orderId: order1.id,
      garmentCatalogId: 'garment-dress',
      serviceTypeId: 'svc-dry-clean',
      quantity: 2,
      unitPrice: 180,
      lineTotal: 360,
      colorTags: ['Pastel Blue', 'Floral'],
      itemStatus: 'QUALITY_CHECK',
    },
  });
  await prisma.orderItem.upsert({
    where: { id: 'oi-001-2' },
    update: {},
    create: {
      id: 'oi-001-2',
      orderId: order1.id,
      garmentCatalogId: 'garment-shirt',
      serviceTypeId: 'svc-dry-clean',
      quantity: 2,
      unitPrice: 80,
      lineTotal: 160,
      colorTags: ['White'],
      defectNotes: 'Small 0.5cm tear near left cuff button.',
      itemStatus: 'QUALITY_CHECK',
    },
  });
  // Payment for order 1
  await prisma.payment.upsert({
    where: { id: 'pay-001' },
    update: {},
    create: {
      id: 'pay-001',
      orderId: order1.id,
      amount: 500,
      mode: 'UPI',
      reference: 'UPI/623489110023',
      receivedById: 'emp-counter-001',
    },
  });
  console.log(`✅ Order: ${order1.orderNumber} (Normal, Partial Payment)`);
  // Order 2: Express, fully paid
  const order2 = await prisma.order.upsert({
    where: { id: 'order-002' },
    update: {},
    create: {
      id: 'order-002',
      orderNumber: 'ORD-0002',
      customerId: 'cust-002',
      systemDueDate: oneDayFromNow,
      effectiveDueDate: oneDayFromNow,
      isExpress: true,
      status: 'PROCESSING',
      subtotal: 780,
      expressSurcharge: 150,
      totalAmount: 930,
      amountPaid: 930,
      amountDue: 0,
      paymentStatus: 'PAID',
      priority: 'EXPRESS',
      pickupType: 'HOME_DELIVERY',
      createdById: 'emp-counter-001',
      storeId: store.id,
    },
  });
  await prisma.orderItem.upsert({
    where: { id: 'oi-002-1' },
    update: {},
    create: {
      id: 'oi-002-1',
      orderId: order2.id,
      garmentCatalogId: 'garment-saree',
      serviceTypeId: 'svc-dry-clean',
      quantity: 2,
      unitPrice: 280,
      lineTotal: 560,
      itemStatus: 'PROCESSING',
    },
  });
  await prisma.payment.upsert({
    where: { id: 'pay-002' },
    update: {},
    create: {
      id: 'pay-002',
      orderId: order2.id,
      amount: 930,
      mode: 'CARD',
      reference: 'HDFC/POS-98124',
      receivedById: 'emp-counter-001',
    },
  });
  console.log(`✅ Order: ${order2.orderNumber} (Express, Fully Paid)`);
  // Order 3: Unpaid, delayed
  const order3 = await prisma.order.upsert({
    where: { id: 'order-003' },
    update: {},
    create: {
      id: 'order-003',
      orderNumber: 'ORD-0003',
      customerId: 'cust-003',
      systemDueDate: yesterday,
      effectiveDueDate: yesterday,
      status: 'IRONING',
      subtotal: 520,
      totalAmount: 520,
      amountPaid: 0,
      amountDue: 520,
      paymentStatus: 'PENDING',
      priority: 'STANDARD',
      pickupType: 'STORE_PICKUP',
      createdById: 'emp-counter-001',
      storeId: store.id,
    },
  });
  await prisma.orderItem.upsert({
    where: { id: 'oi-003-1' },
    update: {},
    create: {
      id: 'oi-003-1',
      orderId: order3.id,
      garmentCatalogId: 'garment-suit',
      serviceTypeId: 'svc-dry-clean',
      quantity: 1,
      unitPrice: 320,
      lineTotal: 320,
      itemStatus: 'PROCESSING',
    },
  });
  console.log(`✅ Order: ${order3.orderNumber} (Unpaid, Delayed)`);
  // Order 4: Packed, ready for pickup, fully paid
  const order4 = await prisma.order.upsert({
    where: { id: 'order-004' },
    update: {},
    create: {
      id: 'order-004',
      orderNumber: 'ORD-0004',
      customerId: 'cust-004',
      systemDueDate: now,
      effectiveDueDate: now,
      status: 'READY',
      subtotal: 360,
      totalAmount: 360,
      amountPaid: 360,
      amountDue: 0,
      paymentStatus: 'PAID',
      priority: 'STANDARD',
      pickupType: 'STORE_PICKUP',
      createdById: 'emp-counter-001',
      storeId: store.id,
    },
  });
  await prisma.orderItem.upsert({
    where: { id: 'oi-004-1' },
    update: {},
    create: {
      id: 'oi-004-1',
      orderId: order4.id,
      garmentCatalogId: 'garment-bedsheet',
      serviceTypeId: 'svc-wash-iron',
      quantity: 4,
      unitPrice: 90,
      lineTotal: 360,
      itemStatus: 'READY',
    },
  });
  await prisma.payment.upsert({
    where: { id: 'pay-004' },
    update: {},
    create: {
      id: 'pay-004',
      orderId: order4.id,
      amount: 360,
      mode: 'CASH',
      receivedById: 'emp-counter-001',
    },
  });
  console.log(`✅ Order: ${order4.orderNumber} (Ready, Fully Paid)`);
  // Order 5: Ready but unpaid (pending collection)
  const order5 = await prisma.order.upsert({
    where: { id: 'order-005' },
    update: {},
    create: {
      id: 'order-005',
      orderNumber: 'ORD-0005',
      customerId: 'cust-005',
      systemDueDate: yesterday,
      effectiveDueDate: yesterday,
      status: 'READY',
      subtotal: 1200,
      totalAmount: 1200,
      amountPaid: 0,
      amountDue: 1200,
      paymentStatus: 'PENDING',
      priority: 'STANDARD',
      pickupType: 'STORE_PICKUP',
      createdById: 'emp-counter-001',
      storeId: store.id,
    },
  });
  console.log(`✅ Order: ${order5.orderNumber} (Ready, Unpaid)`);
  console.log('\n🎉 Seed completed successfully!');
  console.log('\n⚠️  DEVELOPMENT CREDENTIALS — Do NOT use in production:');
  console.log('   Owner PIN:    111111');
  console.log('   Manager PIN:  222222');
  console.log('   Counter PIN:  333333');
  console.log('   Delivery PIN: 444444');
}
main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Seed failed:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
//# sourceMappingURL=seed.js.map
