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

async function hashPin(pin: string): Promise<string> {
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
      role: 'OWNER' as const,
      pin: '111111',
    },
    {
      id: 'emp-mgr-001',
      name: 'Rajesh Nair',
      email: 'rajesh@growfast.in',
      role: 'MANAGER' as const,
      pin: '222222',
    },
    {
      id: 'emp-counter-001',
      name: 'Swapnil Shinde',
      email: 'swapnil@growfast.in',
      role: 'COUNTER' as const,
      pin: '333333',
    },
    {
      id: 'emp-delivery-001',
      name: 'Kiran More',
      email: 'kiran@growfast.in',
      role: 'DELIVERY' as const,
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
    // ── MEN (existing 36 + Suit) ──
    { id: 'g-m-1', name: 'Track Pant', category: 'MEN' as const },
    { id: 'g-m-2', name: 'T Shirt', category: 'MEN' as const },
    { id: 'g-m-3', name: 'Pants', category: 'MEN' as const },
    { id: 'g-m-4', name: 'Jeans', category: 'MEN' as const },
    { id: 'garment-shirt', name: 'Shirt', category: 'MEN' as const },
    { id: 'g-m-6', name: 'Sweat Pants', category: 'MEN' as const },
    { id: 'g-m-7', name: 'Pyjama', category: 'MEN' as const },
    { id: 'garment-kurta', name: 'Kurta', category: 'MEN' as const },
    { id: 'g-m-9', name: 'Coat', category: 'MEN' as const },
    { id: 'g-m-10', name: 'Sweat Shirt', category: 'MEN' as const },
    { id: 'g-m-11', name: 'Swimming Costume', category: 'MEN' as const },
    { id: 'g-m-12', name: 'Leather Jacket', category: 'MEN' as const },
    { id: 'g-m-13', name: 'Suede Leather Jacket', category: 'MEN' as const },
    { id: 'g-m-14', name: 'Waist Coat', category: 'MEN' as const },
    { id: 'g-m-15', name: 'Achkan', category: 'MEN' as const },
    { id: 'g-m-16', name: 'Sherwani', category: 'MEN' as const },
    { id: 'g-m-17', name: 'Shorts', category: 'MEN' as const },
    { id: 'g-m-18', name: 'Capri', category: 'MEN' as const },
    { id: 'g-m-19', name: 'Jacket With Hood', category: 'MEN' as const },
    { id: 'g-m-20', name: 'Sweater Half', category: 'MEN' as const },
    { id: 'g-m-21', name: 'Vest', category: 'MEN' as const },
    { id: 'g-m-22', name: 'Dhoti', category: 'MEN' as const },
    { id: 'g-m-23', name: 'Under Wear', category: 'MEN' as const },
    { id: 'g-m-24', name: 'Safari Suit Coat', category: 'MEN' as const },
    { id: 'g-m-25', name: 'Safari Suit Pant', category: 'MEN' as const },
    { id: 'g-m-26', name: 'Shirt Silk', category: 'MEN' as const },
    { id: 'g-m-27', name: 'Shirt Woolen', category: 'MEN' as const },
    { id: 'g-m-28', name: 'Sweat Shirt With Hood', category: 'MEN' as const },
    { id: 'g-m-29', name: 'Jacket Full Sleeves', category: 'MEN' as const },
    { id: 'g-m-30', name: 'Jacket Half Sleeves', category: 'MEN' as const },
    { id: 'g-m-31', name: 'Kurta Heavy', category: 'MEN' as const },
    { id: 'g-m-32', name: 'Long Coat', category: 'MEN' as const },
    { id: 'g-m-33', name: 'Long Pullover', category: 'MEN' as const },
    { id: 'g-m-34', name: 'Sweater Full Sleeves Heavy', category: 'MEN' as const },
    { id: 'g-m-35', name: 'Sweater Full Sleeves Plain', category: 'MEN' as const },
    { id: 'g-m-36', name: 'Sweater Half Sleeves Heavy', category: 'MEN' as const },
    { id: 'garment-suit', name: 'Suit (2 Piece)', category: 'MEN' as const },

    // ── WOMEN (10+) ──
    { id: 'garment-saree', name: 'Saree', category: 'WOMEN' as const },
    { id: 'garment-dress', name: 'Women Dress', category: 'WOMEN' as const },
    { id: 'g-w-3', name: 'Blouse', category: 'WOMEN' as const },
    { id: 'g-w-4', name: 'Salwar', category: 'WOMEN' as const },
    { id: 'g-w-5', name: 'Kameez', category: 'WOMEN' as const },
    { id: 'g-w-6', name: 'Kurti', category: 'WOMEN' as const },
    { id: 'g-w-7', name: 'Skirt', category: 'WOMEN' as const },
    { id: 'g-w-8', name: 'Leggings', category: 'WOMEN' as const },
    { id: 'g-w-9', name: 'Dupatta', category: 'WOMEN' as const },
    { id: 'g-w-10', name: 'Shawl', category: 'WOMEN' as const },
    { id: 'g-w-11', name: 'Lehenga', category: 'WOMEN' as const },
    { id: 'g-w-12', name: 'Churidar', category: 'WOMEN' as const },

    // ── KIDS (10) ──
    { id: 'g-k-1', name: 'Kids Shirt', category: 'KIDS' as const },
    { id: 'g-k-2', name: 'Kids T Shirt', category: 'KIDS' as const },
    { id: 'g-k-3', name: 'Kids Pants', category: 'KIDS' as const },
    { id: 'g-k-4', name: 'Kids Jeans', category: 'KIDS' as const },
    { id: 'g-k-5', name: 'Kids Dress', category: 'KIDS' as const },
    { id: 'g-k-6', name: 'Kids Shorts', category: 'KIDS' as const },
    { id: 'g-k-7', name: 'Kids Jacket', category: 'KIDS' as const },
    { id: 'g-k-8', name: 'Kids Sweater', category: 'KIDS' as const },
    { id: 'g-k-9', name: 'Kids Uniform', category: 'KIDS' as const },
    { id: 'g-k-10', name: 'Kids Kurta', category: 'KIDS' as const },

    // ── HOUSEHOLD (10) ──
    { id: 'garment-bedsheet', name: 'Bedsheet (Double)', category: 'HOUSEHOLD' as const },
    { id: 'g-h-2', name: 'Bedsheet (Single)', category: 'HOUSEHOLD' as const },
    { id: 'g-h-3', name: 'Pillow Cover', category: 'HOUSEHOLD' as const },
    { id: 'g-h-4', name: 'Curtain', category: 'HOUSEHOLD' as const },
    { id: 'g-h-5', name: 'Blanket', category: 'HOUSEHOLD' as const },
    { id: 'g-h-6', name: 'Quilt', category: 'HOUSEHOLD' as const },
    { id: 'g-h-7', name: 'Table Cloth', category: 'HOUSEHOLD' as const },
    { id: 'g-h-8', name: 'Sofa Cover', category: 'HOUSEHOLD' as const },
    { id: 'g-h-9', name: 'Carpet (Small)', category: 'HOUSEHOLD' as const },
    { id: 'g-h-10', name: 'Rug', category: 'HOUSEHOLD' as const },

    // ── WEIGHT_BASED (10) ──
    { id: 'g-wb-1', name: 'Laundry 1kg', category: 'WEIGHT_BASED' as const },
    { id: 'g-wb-2', name: 'Laundry 2kg', category: 'WEIGHT_BASED' as const },
    { id: 'g-wb-3', name: 'Laundry 3kg', category: 'WEIGHT_BASED' as const },
    { id: 'g-wb-4', name: 'Laundry 4kg', category: 'WEIGHT_BASED' as const },
    { id: 'g-wb-5', name: 'Laundry 5kg', category: 'WEIGHT_BASED' as const },
    { id: 'g-wb-6', name: 'Blanket Weight', category: 'WEIGHT_BASED' as const },
    { id: 'g-wb-7', name: 'Curtain Weight', category: 'WEIGHT_BASED' as const },
    { id: 'g-wb-8', name: 'Carpet Weight', category: 'WEIGHT_BASED' as const },
    { id: 'g-wb-9', name: 'Mixed Laundry', category: 'WEIGHT_BASED' as const },
    { id: 'g-wb-10', name: 'Bulk Laundry', category: 'WEIGHT_BASED' as const },

    // ── OTHERS (10) ──
    { id: 'g-o-1', name: 'Bag', category: 'OTHERS' as const },
    { id: 'g-o-2', name: 'Backpack', category: 'OTHERS' as const },
    { id: 'g-o-3', name: 'Cap', category: 'OTHERS' as const },
    { id: 'g-o-4', name: 'Tie', category: 'OTHERS' as const },
    { id: 'g-o-5', name: 'Scarf', category: 'OTHERS' as const },
    { id: 'g-o-6', name: 'Belt', category: 'OTHERS' as const },
    { id: 'g-o-7', name: 'Gloves', category: 'OTHERS' as const },
    { id: 'g-o-8', name: 'Hat', category: 'OTHERS' as const },
    { id: 'g-o-9', name: 'Cushion', category: 'OTHERS' as const },
    { id: 'g-o-10', name: 'Soft Toy', category: 'OTHERS' as const },

    // ── HOME_CLEANING (10) ──
    { id: 'g-hc-1', name: 'Mattress', category: 'HOME_CLEANING' as const },
    { id: 'g-hc-2', name: 'Sofa', category: 'HOME_CLEANING' as const },
    { id: 'g-hc-3', name: 'Chair', category: 'HOME_CLEANING' as const },
    { id: 'g-hc-4', name: 'Dining Chair', category: 'HOME_CLEANING' as const },
    { id: 'g-hc-5', name: 'Office Chair', category: 'HOME_CLEANING' as const },
    { id: 'g-hc-6', name: 'Car Seat', category: 'HOME_CLEANING' as const },
    { id: 'g-hc-7', name: 'Curtain Cleaning', category: 'HOME_CLEANING' as const },
    { id: 'g-hc-8', name: 'Carpet Cleaning', category: 'HOME_CLEANING' as const },
    { id: 'g-hc-9', name: 'Rug Cleaning', category: 'HOME_CLEANING' as const },
    { id: 'g-hc-10', name: 'Floor Mat', category: 'HOME_CLEANING' as const },

    // ── SHOES (10) ──
    { id: 'garment-sneakers', name: 'Sneakers / Sports Shoes', category: 'SHOES' as const },
    { id: 'g-s-2', name: 'Formal Shoes', category: 'SHOES' as const },
    { id: 'g-s-3', name: 'Leather Shoes', category: 'SHOES' as const },
    { id: 'g-s-4', name: 'Suede Shoes', category: 'SHOES' as const },
    { id: 'g-s-5', name: 'Boots', category: 'SHOES' as const },
    { id: 'g-s-6', name: 'Sandals', category: 'SHOES' as const },
    { id: 'g-s-7', name: 'Slippers', category: 'SHOES' as const },
    { id: 'g-s-8', name: 'Canvas Shoes', category: 'SHOES' as const },
    { id: 'g-s-9', name: 'School Shoes', category: 'SHOES' as const },
    { id: 'g-s-10', name: 'Sports Shoes Premium', category: 'SHOES' as const },
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
    { id: 'svc-dry-clean', name: 'Dry Cleaning', category: 'DRY_CLEAN' as const, estimatedDays: 2 },
    {
      id: 'svc-steam-press',
      name: 'Steam Pressing',
      category: 'STEAM_PRESS' as const,
      estimatedDays: 1,
    },
    { id: 'svc-wash', name: 'Standard Wash', category: 'WASH' as const, estimatedDays: 2 },
    {
      id: 'svc-wash-iron',
      name: 'Wash + Steam Iron',
      category: 'WASH_IRON' as const,
      estimatedDays: 2,
    },
    {
      id: 'svc-shoe-clean',
      name: 'Premium Shoe Spa',
      category: 'SHOE_CLEAN' as const,
      estimatedDays: 3,
    },
    {
      id: 'svc-leather',
      name: 'Leather & Suede Spa',
      category: 'LEATHER_CLEAN' as const,
      estimatedDays: 4,
    },
    {
      id: 'svc-stain',
      name: 'Targeted Spotting',
      category: 'STAIN_REMOVAL' as const,
      estimatedDays: 2,
    },
    {
      id: 'svc-weight',
      name: 'Laundry by Weight',
      category: 'WEIGHT_BASED' as const,
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

  // ─── Service Garment Prices ─────────────────────────────────────
  // Deliberate pricing: only logical service×garment combinations
  const pricingData: { garmentId: string; serviceId: string; price: number }[] = [
    // ── DRY CLEAN: MEN ──
    { garmentId: 'g-m-1', serviceId: 'svc-dry-clean', price: 105 },
    { garmentId: 'g-m-2', serviceId: 'svc-dry-clean', price: 95 },
    { garmentId: 'g-m-3', serviceId: 'svc-dry-clean', price: 105 },
    { garmentId: 'g-m-4', serviceId: 'svc-dry-clean', price: 105 },
    { garmentId: 'garment-shirt', serviceId: 'svc-dry-clean', price: 105 },
    { garmentId: 'g-m-6', serviceId: 'svc-dry-clean', price: 130 },
    { garmentId: 'g-m-7', serviceId: 'svc-dry-clean', price: 95 },
    { garmentId: 'garment-kurta', serviceId: 'svc-dry-clean', price: 110 },
    { garmentId: 'g-m-9', serviceId: 'svc-dry-clean', price: 255 },
    { garmentId: 'g-m-10', serviceId: 'svc-dry-clean', price: 280 },
    { garmentId: 'g-m-11', serviceId: 'svc-dry-clean', price: 50 },
    { garmentId: 'g-m-12', serviceId: 'svc-dry-clean', price: 495 },
    { garmentId: 'g-m-13', serviceId: 'svc-dry-clean', price: 0 },
    { garmentId: 'g-m-14', serviceId: 'svc-dry-clean', price: 105 },
    { garmentId: 'g-m-15', serviceId: 'svc-dry-clean', price: 395 },
    { garmentId: 'g-m-16', serviceId: 'svc-dry-clean', price: 395 },
    { garmentId: 'g-m-17', serviceId: 'svc-dry-clean', price: 90 },
    { garmentId: 'g-m-18', serviceId: 'svc-dry-clean', price: 95 },
    { garmentId: 'g-m-19', serviceId: 'svc-dry-clean', price: 300 },
    { garmentId: 'g-m-20', serviceId: 'svc-dry-clean', price: 0 },
    { garmentId: 'g-m-21', serviceId: 'svc-dry-clean', price: 50 },
    { garmentId: 'g-m-22', serviceId: 'svc-dry-clean', price: 105 },
    { garmentId: 'g-m-23', serviceId: 'svc-dry-clean', price: 50 },
    { garmentId: 'g-m-24', serviceId: 'svc-dry-clean', price: 255 },
    { garmentId: 'g-m-25', serviceId: 'svc-dry-clean', price: 105 },
    { garmentId: 'g-m-26', serviceId: 'svc-dry-clean', price: 130 },
    { garmentId: 'g-m-27', serviceId: 'svc-dry-clean', price: 130 },
    { garmentId: 'g-m-28', serviceId: 'svc-dry-clean', price: 330 },
    { garmentId: 'g-m-29', serviceId: 'svc-dry-clean', price: 255 },
    { garmentId: 'g-m-30', serviceId: 'svc-dry-clean', price: 190 },
    { garmentId: 'g-m-31', serviceId: 'svc-dry-clean', price: 160 },
    { garmentId: 'g-m-32', serviceId: 'svc-dry-clean', price: 380 },
    { garmentId: 'g-m-33', serviceId: 'svc-dry-clean', price: 225 },
    { garmentId: 'g-m-34', serviceId: 'svc-dry-clean', price: 280 },
    { garmentId: 'g-m-35', serviceId: 'svc-dry-clean', price: 225 },
    { garmentId: 'g-m-36', serviceId: 'svc-dry-clean', price: 210 },
    { garmentId: 'garment-suit', serviceId: 'svc-dry-clean', price: 320 },

    // ── DRY CLEAN: WOMEN ──
    { garmentId: 'garment-saree', serviceId: 'svc-dry-clean', price: 280 },
    { garmentId: 'garment-dress', serviceId: 'svc-dry-clean', price: 180 },
    { garmentId: 'g-w-3', serviceId: 'svc-dry-clean', price: 80 },
    { garmentId: 'g-w-4', serviceId: 'svc-dry-clean', price: 95 },
    { garmentId: 'g-w-5', serviceId: 'svc-dry-clean', price: 105 },
    { garmentId: 'g-w-6', serviceId: 'svc-dry-clean', price: 95 },
    { garmentId: 'g-w-7', serviceId: 'svc-dry-clean', price: 110 },
    { garmentId: 'g-w-8', serviceId: 'svc-dry-clean', price: 85 },
    { garmentId: 'g-w-9', serviceId: 'svc-dry-clean', price: 75 },
    { garmentId: 'g-w-10', serviceId: 'svc-dry-clean', price: 150 },
    { garmentId: 'g-w-11', serviceId: 'svc-dry-clean', price: 450 },
    { garmentId: 'g-w-12', serviceId: 'svc-dry-clean', price: 95 },

    // ── DRY CLEAN: KIDS ──
    { garmentId: 'g-k-1', serviceId: 'svc-dry-clean', price: 70 },
    { garmentId: 'g-k-2', serviceId: 'svc-dry-clean', price: 60 },
    { garmentId: 'g-k-3', serviceId: 'svc-dry-clean', price: 70 },
    { garmentId: 'g-k-4', serviceId: 'svc-dry-clean', price: 70 },
    { garmentId: 'g-k-5', serviceId: 'svc-dry-clean', price: 90 },
    { garmentId: 'g-k-6', serviceId: 'svc-dry-clean', price: 55 },
    { garmentId: 'g-k-7', serviceId: 'svc-dry-clean', price: 130 },
    { garmentId: 'g-k-8', serviceId: 'svc-dry-clean', price: 110 },
    { garmentId: 'g-k-9', serviceId: 'svc-dry-clean', price: 80 },
    { garmentId: 'g-k-10', serviceId: 'svc-dry-clean', price: 75 },

    // ── DRY CLEAN: HOUSEHOLD ──
    { garmentId: 'garment-bedsheet', serviceId: 'svc-dry-clean', price: 180 },
    { garmentId: 'g-h-2', serviceId: 'svc-dry-clean', price: 120 },
    { garmentId: 'g-h-3', serviceId: 'svc-dry-clean', price: 50 },
    { garmentId: 'g-h-4', serviceId: 'svc-dry-clean', price: 200 },
    { garmentId: 'g-h-5', serviceId: 'svc-dry-clean', price: 350 },
    { garmentId: 'g-h-6', serviceId: 'svc-dry-clean', price: 400 },
    { garmentId: 'g-h-7', serviceId: 'svc-dry-clean', price: 100 },
    { garmentId: 'g-h-8', serviceId: 'svc-dry-clean', price: 250 },

    // ── DRY CLEAN: OTHERS ──
    { garmentId: 'g-o-1', serviceId: 'svc-dry-clean', price: 150 },
    { garmentId: 'g-o-2', serviceId: 'svc-dry-clean', price: 180 },
    { garmentId: 'g-o-3', serviceId: 'svc-dry-clean', price: 50 },
    { garmentId: 'g-o-4', serviceId: 'svc-dry-clean', price: 60 },
    { garmentId: 'g-o-5', serviceId: 'svc-dry-clean', price: 80 },
    { garmentId: 'g-o-7', serviceId: 'svc-dry-clean', price: 80 },
    { garmentId: 'g-o-8', serviceId: 'svc-dry-clean', price: 60 },
    { garmentId: 'g-o-9', serviceId: 'svc-dry-clean', price: 100 },
    { garmentId: 'g-o-10', serviceId: 'svc-dry-clean', price: 120 },

    // ── STEAM PRESS: MEN (core items) ──
    { garmentId: 'garment-shirt', serviceId: 'svc-steam-press', price: 30 },
    { garmentId: 'g-m-2', serviceId: 'svc-steam-press', price: 25 },
    { garmentId: 'g-m-3', serviceId: 'svc-steam-press', price: 35 },
    { garmentId: 'g-m-4', serviceId: 'svc-steam-press', price: 35 },
    { garmentId: 'garment-kurta', serviceId: 'svc-steam-press', price: 40 },
    { garmentId: 'g-m-9', serviceId: 'svc-steam-press', price: 80 },
    { garmentId: 'garment-suit', serviceId: 'svc-steam-press', price: 100 },
    { garmentId: 'g-m-22', serviceId: 'svc-steam-press', price: 30 },
    { garmentId: 'g-m-16', serviceId: 'svc-steam-press', price: 120 },
    { garmentId: 'g-m-15', serviceId: 'svc-steam-press', price: 110 },

    // ── STEAM PRESS: WOMEN ──
    { garmentId: 'garment-saree', serviceId: 'svc-steam-press', price: 100 },
    { garmentId: 'garment-dress', serviceId: 'svc-steam-press', price: 50 },
    { garmentId: 'g-w-5', serviceId: 'svc-steam-press', price: 35 },
    { garmentId: 'g-w-6', serviceId: 'svc-steam-press', price: 30 },
    { garmentId: 'g-w-7', serviceId: 'svc-steam-press', price: 35 },
    { garmentId: 'g-w-9', serviceId: 'svc-steam-press', price: 25 },
    { garmentId: 'g-w-11', serviceId: 'svc-steam-press', price: 150 },

    // ── STEAM PRESS: KIDS ──
    { garmentId: 'g-k-1', serviceId: 'svc-steam-press', price: 20 },
    { garmentId: 'g-k-3', serviceId: 'svc-steam-press', price: 20 },
    { garmentId: 'g-k-5', serviceId: 'svc-steam-press', price: 25 },
    { garmentId: 'g-k-9', serviceId: 'svc-steam-press', price: 20 },

    // ── WASH: MEN ──
    { garmentId: 'garment-shirt', serviceId: 'svc-wash', price: 40 },
    { garmentId: 'g-m-2', serviceId: 'svc-wash', price: 35 },
    { garmentId: 'g-m-3', serviceId: 'svc-wash', price: 40 },
    { garmentId: 'g-m-4', serviceId: 'svc-wash', price: 45 },
    { garmentId: 'g-m-1', serviceId: 'svc-wash', price: 40 },
    { garmentId: 'g-m-17', serviceId: 'svc-wash', price: 30 },
    { garmentId: 'g-m-23', serviceId: 'svc-wash', price: 20 },

    // ── WASH: WOMEN ──
    { garmentId: 'g-w-4', serviceId: 'svc-wash', price: 40 },
    { garmentId: 'g-w-5', serviceId: 'svc-wash', price: 40 },
    { garmentId: 'g-w-6', serviceId: 'svc-wash', price: 35 },
    { garmentId: 'g-w-8', serviceId: 'svc-wash', price: 30 },

    // ── WASH: KIDS ──
    { garmentId: 'g-k-1', serviceId: 'svc-wash', price: 25 },
    { garmentId: 'g-k-2', serviceId: 'svc-wash', price: 20 },
    { garmentId: 'g-k-3', serviceId: 'svc-wash', price: 25 },
    { garmentId: 'g-k-6', serviceId: 'svc-wash', price: 20 },
    { garmentId: 'g-k-9', serviceId: 'svc-wash', price: 30 },

    // ── WASH: HOUSEHOLD ──
    { garmentId: 'garment-bedsheet', serviceId: 'svc-wash', price: 60 },
    { garmentId: 'g-h-2', serviceId: 'svc-wash', price: 40 },
    { garmentId: 'g-h-3', serviceId: 'svc-wash', price: 20 },
    { garmentId: 'g-h-4', serviceId: 'svc-wash', price: 80 },
    { garmentId: 'g-h-7', serviceId: 'svc-wash', price: 50 },

    // ── WASH + IRON: MEN ──
    { garmentId: 'garment-shirt', serviceId: 'svc-wash-iron', price: 50 },
    { garmentId: 'g-m-2', serviceId: 'svc-wash-iron', price: 45 },
    { garmentId: 'g-m-3', serviceId: 'svc-wash-iron', price: 55 },
    { garmentId: 'g-m-4', serviceId: 'svc-wash-iron', price: 55 },
    { garmentId: 'garment-kurta', serviceId: 'svc-wash-iron', price: 70 },

    // ── WASH + IRON: WOMEN ──
    { garmentId: 'g-w-5', serviceId: 'svc-wash-iron', price: 55 },
    { garmentId: 'g-w-6', serviceId: 'svc-wash-iron', price: 50 },

    // ── WASH + IRON: HOUSEHOLD ──
    { garmentId: 'garment-bedsheet', serviceId: 'svc-wash-iron', price: 90 },
    { garmentId: 'g-h-2', serviceId: 'svc-wash-iron', price: 60 },
    { garmentId: 'g-h-3', serviceId: 'svc-wash-iron', price: 30 },
    { garmentId: 'g-h-4', serviceId: 'svc-wash-iron', price: 120 },
    { garmentId: 'g-h-7', serviceId: 'svc-wash-iron', price: 70 },

    // ── SHOE CLEAN: SHOES only ──
    { garmentId: 'garment-sneakers', serviceId: 'svc-shoe-clean', price: 250 },
    { garmentId: 'g-s-2', serviceId: 'svc-shoe-clean', price: 200 },
    { garmentId: 'g-s-3', serviceId: 'svc-shoe-clean', price: 300 },
    { garmentId: 'g-s-4', serviceId: 'svc-shoe-clean', price: 350 },
    { garmentId: 'g-s-5', serviceId: 'svc-shoe-clean', price: 400 },
    { garmentId: 'g-s-6', serviceId: 'svc-shoe-clean', price: 150 },
    { garmentId: 'g-s-7', serviceId: 'svc-shoe-clean', price: 100 },
    { garmentId: 'g-s-8', serviceId: 'svc-shoe-clean', price: 200 },
    { garmentId: 'g-s-9', serviceId: 'svc-shoe-clean', price: 180 },
    { garmentId: 'g-s-10', serviceId: 'svc-shoe-clean', price: 350 },

    // ── LEATHER CLEAN: leather/suede items ──
    { garmentId: 'g-m-12', serviceId: 'svc-leather', price: 650 },
    { garmentId: 'g-m-13', serviceId: 'svc-leather', price: 750 },
    { garmentId: 'g-s-3', serviceId: 'svc-leather', price: 400 },
    { garmentId: 'g-s-4', serviceId: 'svc-leather', price: 450 },
    { garmentId: 'g-s-5', serviceId: 'svc-leather', price: 500 },
    { garmentId: 'g-o-6', serviceId: 'svc-leather', price: 200 },
    { garmentId: 'g-o-7', serviceId: 'svc-leather', price: 250 },

    // ── STAIN REMOVAL: selected items ──
    { garmentId: 'garment-shirt', serviceId: 'svc-stain', price: 80 },
    { garmentId: 'g-m-3', serviceId: 'svc-stain', price: 80 },
    { garmentId: 'garment-saree', serviceId: 'svc-stain', price: 150 },
    { garmentId: 'garment-dress', serviceId: 'svc-stain', price: 100 },
    { garmentId: 'g-w-11', serviceId: 'svc-stain', price: 200 },
    { garmentId: 'garment-suit', serviceId: 'svc-stain', price: 150 },
    { garmentId: 'g-m-9', serviceId: 'svc-stain', price: 120 },
    { garmentId: 'g-h-8', serviceId: 'svc-stain', price: 180 },
    { garmentId: 'g-h-9', serviceId: 'svc-stain', price: 250 },
    { garmentId: 'g-h-10', serviceId: 'svc-stain', price: 200 },

    // ── WEIGHT BASED: weight items only ──
    { garmentId: 'g-wb-1', serviceId: 'svc-weight', price: 60 },
    { garmentId: 'g-wb-2', serviceId: 'svc-weight', price: 110 },
    { garmentId: 'g-wb-3', serviceId: 'svc-weight', price: 155 },
    { garmentId: 'g-wb-4', serviceId: 'svc-weight', price: 200 },
    { garmentId: 'g-wb-5', serviceId: 'svc-weight', price: 240 },
    { garmentId: 'g-wb-6', serviceId: 'svc-weight', price: 180 },
    { garmentId: 'g-wb-7', serviceId: 'svc-weight', price: 160 },
    { garmentId: 'g-wb-8', serviceId: 'svc-weight', price: 220 },
    { garmentId: 'g-wb-9', serviceId: 'svc-weight', price: 130 },
    { garmentId: 'g-wb-10', serviceId: 'svc-weight', price: 300 },

    // ── HOME CLEANING service priced via dry clean ──
    { garmentId: 'g-hc-1', serviceId: 'svc-dry-clean', price: 800 },
    { garmentId: 'g-hc-2', serviceId: 'svc-dry-clean', price: 1200 },
    { garmentId: 'g-hc-3', serviceId: 'svc-dry-clean', price: 400 },
    { garmentId: 'g-hc-4', serviceId: 'svc-dry-clean', price: 350 },
    { garmentId: 'g-hc-5', serviceId: 'svc-dry-clean', price: 500 },
    { garmentId: 'g-hc-6', serviceId: 'svc-dry-clean', price: 600 },
    { garmentId: 'g-hc-7', serviceId: 'svc-dry-clean', price: 300 },
    { garmentId: 'g-hc-8', serviceId: 'svc-dry-clean', price: 500 },
    { garmentId: 'g-hc-9', serviceId: 'svc-dry-clean', price: 400 },
    { garmentId: 'g-hc-10', serviceId: 'svc-dry-clean', price: 150 },
  ];

  for (const p of pricingData) {
    await prisma.serviceGarmentPrice.upsert({
      where: {
        garmentCatalogId_serviceTypeId_storeId: {
          garmentCatalogId: p.garmentId,
          serviceTypeId: p.serviceId,
          storeId: 'store-kp-001',
        },
      },
      update: { price: p.price },
      create: {
        garmentCatalogId: p.garmentId,
        serviceTypeId: p.serviceId,
        price: p.price,
        storeId: 'store-kp-001',
      },
    });
  }
  console.log(`✅ Service Garment Prices: ${pricingData.length} records`);

  // ─── Customers ────────────────────────────────────────────────
  const customers = [
    {
      id: 'cust-001',
      name: 'Rahul Patil',
      phone: '+919876543210',
      email: 'rahul.patil@example.com',
      address: 'Flat 402, Rohan Vasanta, Baner Road, Pune',
      pincode: '411045',
      membership: 'GOLD' as const,
      discountPercent: 10,
    },
    {
      id: 'cust-002',
      name: 'Sneha Kulkarni',
      phone: '+919823456789',
      email: 'sneha.k@outlook.com',
      address: 'B-12, Hermes Nest, Koregaon Park, Pune',
      pincode: '411001',
      membership: 'SILVER' as const,
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
