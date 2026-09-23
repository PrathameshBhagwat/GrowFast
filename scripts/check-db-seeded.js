/**
 * Check if the database has already been seeded.
 * Exits with code 0 if seeded (store count > 0), code 1 if not seeded or error.
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  try {
    const storeCount = await prisma.store.count();
    await prisma.$disconnect();
    if (storeCount > 0) {
      process.exit(0);
    } else {
      process.exit(1);
    }
  } catch (err) {
    try {
      await prisma.$disconnect();
    } catch (_) {}
    process.exit(1);
  }
}

check();
