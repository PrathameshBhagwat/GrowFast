#!/usr/bin/env node

/**
 * validate-enum-sync.js
 *
 * CI script that verifies Prisma schema enums stay in sync with
 * @growfast/shared-types enums. Fails if any enum values diverge.
 *
 * Usage:
 *   node scripts/validate-enum-sync.js
 *
 * Exit codes:
 *   0 — all enums in sync
 *   1 — mismatch detected
 */

const fs = require('fs');
const path = require('path');

// ─── Configuration ──────────────────────────────────────────────────
// Map each Prisma enum name to the file and export name in shared-types.
const PRISMA_SCHEMA = path.resolve(__dirname, '..', 'prisma', 'schema.prisma');
const SHARED_ENUMS = path.resolve(__dirname, '..', 'packages', 'shared-types', 'src', 'enums.ts');

// ─── Parse Prisma enums ─────────────────────────────────────────────
function parsePrismaEnums(schemaPath) {
  const content = fs.readFileSync(schemaPath, 'utf-8');
  const enums = {};
  const enumRegex = /enum\s+(\w+)\s*\{([^}]+)\}/g;
  let match;
  while ((match = enumRegex.exec(content)) !== null) {
    const name = match[1];
    const values = match[2]
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('//') && !line.startsWith('@@'));
    enums[name] = values;
  }
  return enums;
}

// ─── Parse TypeScript enums ─────────────────────────────────────────
function parseTsEnums(tsPath) {
  const content = fs.readFileSync(tsPath, 'utf-8');
  const enums = {};
  const enumRegex = /export\s+enum\s+(\w+)\s*\{([^}]+)\}/g;
  let match;
  while ((match = enumRegex.exec(content)) !== null) {
    const name = match[1];
    const values = match[2]
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('//'))
      .map((line) => {
        // Extract the key from patterns like:  KEY = 'KEY',
        const keyMatch = line.match(/^(\w+)\s*=/);
        return keyMatch ? keyMatch[1] : line.replace(/,\s*$/, '');
      });
    enums[name] = values;
  }
  return enums;
}

// ─── Main ───────────────────────────────────────────────────────────
function main() {
  console.log('🔍 Validating Prisma ↔ shared-types enum sync...\n');

  const prismaEnums = parsePrismaEnums(PRISMA_SCHEMA);
  const tsEnums = parseTsEnums(SHARED_ENUMS);

  const prismaNames = Object.keys(prismaEnums);
  const tsNames = Object.keys(tsEnums);

  // Find enums that exist in both
  const commonEnums = prismaNames.filter((name) => tsNames.includes(name));

  if (commonEnums.length === 0) {
    console.log('⚠️  No overlapping enum names found between Prisma and shared-types.');
    console.log('   Prisma enums:', prismaNames.join(', '));
    console.log('   Shared-types enums:', tsNames.join(', '));
    process.exit(0);
  }

  let hasErrors = false;

  for (const name of commonEnums) {
    const prismaValues = prismaEnums[name].sort();
    const tsValues = tsEnums[name].sort();

    const prismaSet = new Set(prismaValues);
    const tsSet = new Set(tsValues);

    const onlyInPrisma = prismaValues.filter((v) => !tsSet.has(v));
    const onlyInTs = tsValues.filter((v) => !prismaSet.has(v));

    if (onlyInPrisma.length > 0 || onlyInTs.length > 0) {
      hasErrors = true;
      console.log(`❌ MISMATCH: enum ${name}`);
      if (onlyInPrisma.length > 0) {
        console.log(`   Only in Prisma:       ${onlyInPrisma.join(', ')}`);
      }
      if (onlyInTs.length > 0) {
        console.log(`   Only in shared-types: ${onlyInTs.join(', ')}`);
      }
      console.log();
    } else {
      console.log(`✅ ${name} — ${prismaValues.length} values in sync`);
    }
  }

  // Report enums only in one side (informational, not a failure)
  const onlyPrisma = prismaNames.filter((n) => !tsNames.includes(n));
  const onlyTs = tsNames.filter((n) => !prismaNames.includes(n));

  if (onlyPrisma.length > 0) {
    console.log(`\nℹ️  Prisma-only enums (no shared-types equivalent): ${onlyPrisma.join(', ')}`);
  }
  if (onlyTs.length > 0) {
    console.log(`\nℹ️  Shared-types-only enums (no Prisma equivalent): ${onlyTs.join(', ')}`);
  }

  if (hasErrors) {
    console.log(
      '\n💥 Enum sync validation FAILED. Update prisma/schema.prisma or packages/shared-types/src/enums.ts to match.',
    );
    process.exit(1);
  } else {
    console.log(`\n✅ All ${commonEnums.length} shared enums are in sync.`);
    process.exit(0);
  }
}

main();
