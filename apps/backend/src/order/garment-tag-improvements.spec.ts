import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../auth/roles.decorator';
import { StoreController } from '../store/store.controller';
import { StoreService } from '../store/store.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  Role,
  DEFAULT_TAG_DESIGN,
  DEFAULT_SERVICE_SHORTCUTS,
  resolveServiceShortcut,
  formatGarmentSequence,
  formatShopName,
  CANONICAL_5LINE_TAG_DESIGN,
} from '@growfast/shared-types';

describe('Garment Tag Generation & Printing Improvements (Tests A through J)', () => {
  let storeService: StoreService;
  let prismaService: any;

  beforeEach(async () => {
    prismaService = {
      store: {
        findUnique: jest.fn(),
      },
      tagTemplate: {
        findFirst: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        create: jest.fn(),
      },
      $transaction: jest.fn(async (cb: any) => cb(prismaService)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StoreService,
        {
          provide: PrismaService,
          useValue: prismaService,
        },
      ],
    }).compile();

    storeService = module.get<StoreService>(StoreService);
  });

  // ─────────────────────────────────────────────────────────────
  // TEST A: Single garment (Shirt 1/1)
  // ─────────────────────────────────────────────────────────────
  it('TEST A — SINGLE GARMENT: formats piece sequence as "Shirt 1/1"', () => {
    const formatted = formatGarmentSequence('Shirt', 1, 1);
    expect(formatted).toBe('Shirt 1/1');
  });

  // ─────────────────────────────────────────────────────────────
  // TEST B: Five shirts (Shirt 1/5 through Shirt 5/5)
  // ─────────────────────────────────────────────────────────────
  it('TEST B — FIVE SHIRTS: formats piece positions 1/5 through 5/5 independently', () => {
    const pieces = [1, 2, 3, 4, 5].map((u) => formatGarmentSequence('Shirt', u, 5));
    expect(pieces).toEqual([
      'Shirt 1/5',
      'Shirt 2/5',
      'Shirt 3/5',
      'Shirt 4/5',
      'Shirt 5/5',
    ]);
  });

  // ─────────────────────────────────────────────────────────────
  // TEST C: Mixed garment types (5 shirts and 3 pants)
  // ─────────────────────────────────────────────────────────────
  it('TEST C — MIXED GARMENTS: keeps sequences independent (Shirt 1/5..5/5, Pant 1/3..3/3)', () => {
    const shirtPieces = [1, 2, 3, 4, 5].map((u) => formatGarmentSequence('Shirt', u, 5));
    const pantPieces = [1, 2, 3].map((u) => formatGarmentSequence('Pants', u, 3));

    expect(shirtPieces).toEqual([
      'Shirt 1/5',
      'Shirt 2/5',
      'Shirt 3/5',
      'Shirt 4/5',
      'Shirt 5/5',
    ]);
    expect(pantPieces).toEqual([
      'Pant 1/3',
      'Pant 2/3',
      'Pant 3/3',
    ]);
  });

  // ─────────────────────────────────────────────────────────────
  // TEST D: Different services (Dry Cleaning -> DC, Steam Iron -> SI)
  // ─────────────────────────────────────────────────────────────
  it('TEST D — DIFFERENT SERVICES: resolves canonical shortcuts (Dry Cleaning -> DC, Steam Iron -> SI)', () => {
    expect(resolveServiceShortcut('Dry Cleaning')).toBe('DC');
    expect(resolveServiceShortcut('DRY_CLEAN')).toBe('DC');
    expect(resolveServiceShortcut('Steam Iron')).toBe('SI');
    expect(resolveServiceShortcut('STEAM_PRESS')).toBe('SI');
    expect(resolveServiceShortcut('Shoe Cleaning')).toBe('SC');
    expect(resolveServiceShortcut('Starching')).toBe('ST');
  });

  // ─────────────────────────────────────────────────────────────
  // TEST E: Owner changes shortcut (changing DC -> DRY)
  // ─────────────────────────────────────────────────────────────
  it('TEST E — OWNER CHANGES SHORTCUT: custom shortcut overrides default in resolution', async () => {
    const storeId = 'store-test-1';
    prismaService.store.findUnique.mockResolvedValue({ id: storeId, name: 'GrowFast Alpha' });
    prismaService.tagTemplate.findFirst.mockResolvedValue({
      id: 'tmpl-1',
      storeId,
      version: 1,
      layout: DEFAULT_TAG_DESIGN,
    });
    prismaService.tagTemplate.create.mockImplementation(({ data }: any) =>
      Promise.resolve({
        id: 'tmpl-2',
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );

    const customShortcuts = {
      ...DEFAULT_SERVICE_SHORTCUTS,
      DRY_CLEAN: 'DRY',
      'Dry Cleaning': 'DRY',
    };

    const updated = await storeService.updateTagDesign(
      storeId,
      {
        name: 'Custom Tag Design with DRY Shortcut',
        layout: {
          ...DEFAULT_TAG_DESIGN,
          serviceShortcuts: customShortcuts,
        },
      },
      { id: 'owner-1', name: 'Store Owner', email: 'owner@example.com' },
    );

    expect(updated.layout.serviceShortcuts?.['DRY_CLEAN']).toBe('DRY');
    const resolved = resolveServiceShortcut('DRY_CLEAN', updated.layout.serviceShortcuts);
    expect(resolved).toBe('DRY');
  });

  // ─────────────────────────────────────────────────────────────
  // TEST F: Owner changes shop name (GrowFast -> SuperClean)
  // ─────────────────────────────────────────────────────────────
  it('TEST F — OWNER CHANGES SHOP NAME: updates Line 1 shop name without branch/address details', async () => {
    const storeId = 'store-test-2';
    prismaService.store.findUnique.mockResolvedValue({
      id: storeId,
      name: 'SuperClean Laundry / Airoli Branch',
    });
    prismaService.tagTemplate.findFirst.mockResolvedValue(null);
    prismaService.tagTemplate.create.mockImplementation(({ data }: any) =>
      Promise.resolve({
        id: 'tmpl-3',
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );

    const updated = await storeService.updateTagDesign(
      storeId,
      {
        name: 'SuperClean Custom Tags',
        layout: {
          ...DEFAULT_TAG_DESIGN,
          shopName: 'SuperClean',
        },
      },
      { id: 'owner-1', name: 'Owner' },
    );

    expect(updated.layout.shopName).toBe('SuperClean');

    // Verify formatShopName extracts only shopName and strips location/branch
    const line1 = formatShopName(updated.layout.shopName, 'SuperClean Laundry / Airoli Branch');
    expect(line1).toBe('SuperClean');
    expect(line1).not.toContain('Airoli');
    expect(line1).not.toContain('Branch');
  });

  // ─────────────────────────────────────────────────────────────
  // TEST G: Reprinting idempotency and stability
  // ─────────────────────────────────────────────────────────────
  it('TEST G — REPRINTING IDEMPOTENCY: getting tag design multiple times does not alter layout or create duplicate records', async () => {
    const storeId = 'store-test-3';
    prismaService.store.findUnique.mockResolvedValue({ id: storeId, name: 'GrowFast Koramangala' });
    prismaService.tagTemplate.findFirst.mockResolvedValue({
      id: 'tmpl-active',
      storeId,
      version: 2,
      isActive: true,
      layout: {
        ...CANONICAL_5LINE_TAG_DESIGN,
        shopName: 'GrowFast',
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const fetch1 = await storeService.getTagDesign(storeId);
    const fetch2 = await storeService.getTagDesign(storeId);

    expect(fetch1.id).toBe('tmpl-active');
    expect(fetch2.id).toBe('tmpl-active');
    expect(fetch1.layout.shopName).toBe('GrowFast');
    expect(fetch2.layout.shopName).toBe('GrowFast');
    expect(prismaService.tagTemplate.create).not.toHaveBeenCalled();
  });

  // ─────────────────────────────────────────────────────────────
  // TEST H: Missing shortcut handles unconfigured service with graceful fallback
  // ─────────────────────────────────────────────────────────────
  it('TEST H — MISSING SHORTCUT: handles novel or unconfigured service with graceful fallback without failing', () => {
    // Novel multi-word service generates abbreviation from initials
    const srv1 = resolveServiceShortcut('Silk Embroidery Care');
    expect(srv1).toBe('SEC');

    // Single-word novel service truncates cleanly
    const srv2 = resolveServiceShortcut('Ozonation');
    expect(srv2).toBe('OZO');

    // Null or undefined returns GEN fallback
    expect(resolveServiceShortcut(null)).toBe('GEN');
    expect(resolveServiceShortcut(undefined)).toBe('GEN');
    expect(resolveServiceShortcut('')).toBe('GEN');
  });

  // ─────────────────────────────────────────────────────────────
  // TEST I: Non-owner roles rejected from updating tag settings
  // ─────────────────────────────────────────────────────────────
  it('TEST I — RBAC AUTHORIZATION: updateTagDesign is protected by Roles(Role.OWNER)', () => {
    const reflector = new Reflector();
    const updateRoles = reflector.get<Role[]>(ROLES_KEY, StoreController.prototype.updateTagDesign);
    const getRoles = reflector.get<Role[]>(ROLES_KEY, StoreController.prototype.getTagDesign);
    const resetRoles = reflector.get<Role[]>(ROLES_KEY, StoreController.prototype.resetTagDesign);

    expect(updateRoles).toEqual([Role.OWNER]);
    expect(getRoles).toEqual([Role.OWNER]);
    expect(resetRoles).toEqual([Role.OWNER]);

    // Ensure non-owner roles (MANAGER, COUNTER, DELIVERY) are NOT permitted
    expect(updateRoles).not.toContain(Role.MANAGER);
    expect(updateRoles).not.toContain(Role.COUNTER);
    expect(updateRoles).not.toContain(Role.DELIVERY);
  });

  // ─────────────────────────────────────────────────────────────
  // TEST J: Validation rules enforce valid shop name and shortcut formats
  // ─────────────────────────────────────────────────────────────
  it('TEST J — VALIDATION: rejects blank shop name or invalid shortcut formats', async () => {
    const storeId = 'store-test-4';
    prismaService.store.findUnique.mockResolvedValue({ id: storeId, name: 'Store' });

    // Blank shopName
    await expect(
      storeService.updateTagDesign(storeId, {
        layout: {
          ...DEFAULT_TAG_DESIGN,
          shopName: '   ',
        },
      }),
    ).rejects.toThrow(BadRequestException);

    // Shop name exceeding 50 characters
    await expect(
      storeService.updateTagDesign(storeId, {
        layout: {
          ...DEFAULT_TAG_DESIGN,
          shopName: 'A'.repeat(51),
        },
      }),
    ).rejects.toThrow(BadRequestException);

    // Shortcut exceeding 6 characters
    await expect(
      storeService.updateTagDesign(storeId, {
        layout: {
          ...DEFAULT_TAG_DESIGN,
          serviceShortcuts: { DRY_CLEAN: 'TOOLONG' },
        },
      }),
    ).rejects.toThrow(BadRequestException);

    // Shortcut with invalid characters
    await expect(
      storeService.updateTagDesign(storeId, {
        layout: {
          ...DEFAULT_TAG_DESIGN,
          serviceShortcuts: { DRY_CLEAN: 'DC@#$' },
        },
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
