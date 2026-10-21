import { describe, it } from 'node:test';
import assert from 'node:assert';
import { GarmentCategory } from './enums';
import {
  filterServicesForCategory,
  filterCategoriesForService,
  formatCatalogServiceName,
  resolveCatalogSelectionOnCategoryChange,
  resolveCatalogSelectionOnServiceChange,
  isServiceAllowedInWorkflow,
  isCategoryAllowedInWorkflow,
  isItemCompatibleWithWorkflow,
  resolveCatalogSelectionOnWorkflowChange,
  GARMENT_COLLECTION_NOTICE,
  STAIN_REMOVAL_NOTICE,
  adjustDueDateForThursday,
  getDayOfWeekInTimezone,
  DEFAULT_TOP_UP_SERVICES,
} from './catalog';

const mockServices = [
  { id: '1', name: 'Standard Wash' },
  { id: '2', name: 'Dry Clean' },
  { id: '3', name: 'Steam Iron' },
  { id: '4', name: 'Wash + Steam Iron' },
  { id: '5', name: 'Shoe Cleaning' },
  { id: '6', name: 'Reprocess Cleaning' },
  { id: '7', name: 'Free Shoe' },
  { id: '8', name: 'Starching Dc' },
];

const allCategories = [
  GarmentCategory.MEN,
  GarmentCategory.WOMEN,
  GarmentCategory.KIDS,
  GarmentCategory.HOUSEHOLD,
  GarmentCategory.HOME_CLEANING,
  GarmentCategory.SHOES,
  GarmentCategory.OTHERS,
  GarmentCategory.WEIGHT_BASED,
];

describe('filterServicesForCategory', () => {
  it('excludes Free Shoe and Reprocess Cleaning, returning 6 services for non-Shoe categories', () => {
    const result = filterServicesForCategory(mockServices, GarmentCategory.MEN);
    assert.strictEqual(result.length, 6);
    const names = result.map((s) => s.name);
    assert.ok(!names.includes('Free Shoe'));
    assert.ok(!names.includes('Reprocess Cleaning'));
    assert.ok(names.includes('Standard Wash'));
    assert.ok(names.includes('Dry Clean'));
    assert.ok(names.includes('Steam Iron'));
    assert.ok(names.includes('Wash + Steam Iron'));
    assert.ok(names.includes('Shoe Cleaning'));
    assert.ok(names.includes('Starching Dc'));
  });

  it('returns only 3 services for Shoe category (Standard Wash, Dry Clean, Shoe Cleaning)', () => {
    const result = filterServicesForCategory(mockServices, GarmentCategory.SHOES);
    assert.strictEqual(result.length, 3);
    const names = result.map((s) => s.name);
    assert.ok(names.includes('Standard Wash'));
    assert.ok(names.includes('Dry Clean'));
    assert.ok(names.includes('Shoe Cleaning'));
    assert.ok(!names.includes('Free Shoe'));
    assert.ok(!names.includes('Reprocess Cleaning'));
    assert.ok(!names.includes('Steam Iron'));
    assert.ok(!names.includes('Wash + Steam Iron'));
    assert.ok(!names.includes('Starching Dc'));
  });

  it('returns 5 services for Weight-based category, strictly excluding Dry Clean', () => {
    const result = filterServicesForCategory(mockServices, GarmentCategory.WEIGHT_BASED);
    assert.strictEqual(result.length, 5);
    const names = result.map((s) => s.name);
    assert.ok(!names.includes('Dry Clean'));
    assert.ok(names.includes('Standard Wash'));
    assert.ok(names.includes('Steam Iron'));
    assert.ok(names.includes('Wash + Steam Iron'));
    assert.ok(names.includes('Shoe Cleaning'));
    assert.ok(names.includes('Starching Dc'));
  });
});

describe('formatCatalogServiceName', () => {
  it('renames Starching Dc to Starching', () => {
    assert.strictEqual(formatCatalogServiceName('Starching Dc'), 'Starching');
    assert.strictEqual(formatCatalogServiceName('starching dc'), 'Starching');
    assert.strictEqual(formatCatalogServiceName('Starching Dc.'), 'Starching');
  });

  it('preserves other service names', () => {
    assert.strictEqual(formatCatalogServiceName('Dry Clean'), 'Dry Clean');
    assert.strictEqual(formatCatalogServiceName('Standard Wash'), 'Standard Wash');
  });
});

describe('filterCategoriesForService', () => {
  it('shows ONLY Men, Women, Kids when Starching is selected', () => {
    const result = filterCategoriesForService(allCategories, '8', mockServices);
    assert.deepStrictEqual(result, [
      GarmentCategory.MEN,
      GarmentCategory.WOMEN,
      GarmentCategory.KIDS,
    ]);
  });

  it('preserves Weight Based category as an exception when Dry Clean is selected', () => {
    const dryCleanResult = filterCategoriesForService(allCategories, '2', mockServices);
    assert.strictEqual(dryCleanResult.length, 8);
    assert.ok(dryCleanResult.includes(GarmentCategory.WEIGHT_BASED));
    assert.ok(dryCleanResult.includes(GarmentCategory.MEN));
    assert.ok(dryCleanResult.includes(GarmentCategory.WOMEN));
    assert.ok(dryCleanResult.includes(GarmentCategory.KIDS));
    assert.ok(dryCleanResult.includes(GarmentCategory.HOUSEHOLD));
    assert.ok(dryCleanResult.includes(GarmentCategory.HOME_CLEANING));
    assert.ok(dryCleanResult.includes(GarmentCategory.SHOES));
    assert.ok(dryCleanResult.includes(GarmentCategory.OTHERS));
  });

  it('restores all categories when switching to Standard Wash', () => {
    const washResult = filterCategoriesForService(allCategories, '1', mockServices);
    assert.strictEqual(washResult.length, 8);
    assert.ok(washResult.includes(GarmentCategory.WEIGHT_BASED));
  });
});

describe('resolveCatalogSelectionOnServiceChange', () => {
  it('auto-selects Shoe category when Shoe Cleaning is selected', () => {
    const result = resolveCatalogSelectionOnServiceChange('5', GarmentCategory.MEN, mockServices);
    assert.strictEqual(result, GarmentCategory.SHOES);
  });

  it('auto-selects Men when Starching is selected from an incompatible category (e.g. Household)', () => {
    const result = resolveCatalogSelectionOnServiceChange(
      '8',
      GarmentCategory.HOUSEHOLD,
      mockServices,
    );
    assert.strictEqual(result, GarmentCategory.MEN);
  });

  it('auto-selects Men when Starching is selected from Shoe category', () => {
    const result = resolveCatalogSelectionOnServiceChange('8', GarmentCategory.SHOES, mockServices);
    assert.strictEqual(result, GarmentCategory.MEN);
  });

  it('auto-selects Men when Dry Clean is selected while on Weight Based category', () => {
    const result = resolveCatalogSelectionOnServiceChange(
      '2',
      GarmentCategory.WEIGHT_BASED,
      mockServices,
    );
    assert.strictEqual(result, GarmentCategory.MEN);
  });

  it('keeps Women when Starching is selected and Women was already selected', () => {
    const result = resolveCatalogSelectionOnServiceChange('8', GarmentCategory.WOMEN, mockServices);
    assert.strictEqual(result, GarmentCategory.WOMEN);
  });

  it('keeps Kids when Starching is selected and Kids was already selected', () => {
    const result = resolveCatalogSelectionOnServiceChange('8', GarmentCategory.KIDS, mockServices);
    assert.strictEqual(result, GarmentCategory.KIDS);
  });

  it('keeps current category when Standard Wash or Dry Clean is selected with compatible category', () => {
    const result = resolveCatalogSelectionOnServiceChange('2', GarmentCategory.WOMEN, mockServices);
    assert.strictEqual(result, GarmentCategory.WOMEN);
  });
});

describe('resolveCatalogSelectionOnCategoryChange', () => {
  it('auto-selects Shoe Cleaning when switching to Shoe from Starching', () => {
    const result = resolveCatalogSelectionOnCategoryChange(
      GarmentCategory.SHOES,
      '8',
      mockServices,
    );
    assert.strictEqual(result, '5'); // Shoe Cleaning
  });

  it('auto-selects Shoe Cleaning when switching to Shoe from Dry Clean', () => {
    const result = resolveCatalogSelectionOnCategoryChange(
      GarmentCategory.SHOES,
      '2',
      mockServices,
    );
    assert.strictEqual(result, '5'); // Shoe Cleaning
  });

  it('auto-selects Standard Wash when leaving Shoe with Shoe Cleaning selected', () => {
    const result = resolveCatalogSelectionOnCategoryChange(GarmentCategory.MEN, '5', mockServices);
    assert.strictEqual(result, '1'); // Standard Wash
  });

  it('auto-selects Standard Wash when switching to Household while Starching is active', () => {
    const result = resolveCatalogSelectionOnCategoryChange(
      GarmentCategory.HOUSEHOLD,
      '8',
      mockServices,
    );
    assert.strictEqual(result, '1'); // Standard Wash
  });

  it('auto-selects Standard Wash when switching to Weight Based category while Dry Clean is active', () => {
    const result = resolveCatalogSelectionOnCategoryChange(
      GarmentCategory.WEIGHT_BASED,
      '2',
      mockServices,
    );
    assert.strictEqual(result, '1'); // Standard Wash
  });

  it('keeps Starching when switching between Men and Women', () => {
    const result = resolveCatalogSelectionOnCategoryChange(
      GarmentCategory.WOMEN,
      '8',
      mockServices,
    );
    assert.strictEqual(result, '8');
  });
});

describe('resolveCatalogSelectionOnServiceChange', () => {
  it('auto-selects Shoe category when switching to Shoe Cleaning service', () => {
    const result = resolveCatalogSelectionOnServiceChange('5', GarmentCategory.MEN, mockServices);
    assert.strictEqual(result, GarmentCategory.SHOES);
  });

  it('auto-switches to Men when Shoe is selected and user picks an incompatible service (Dry Clean)', () => {
    const result = resolveCatalogSelectionOnServiceChange('2', GarmentCategory.SHOES, mockServices);
    assert.strictEqual(result, GarmentCategory.MEN);
  });

  it('auto-switches to Men when Shoe is selected and user picks Standard Wash', () => {
    const result = resolveCatalogSelectionOnServiceChange('1', GarmentCategory.SHOES, mockServices);
    assert.strictEqual(result, GarmentCategory.MEN);
  });

  it('auto-switches to Men when Weight Based is selected and user picks Dry Clean', () => {
    const result = resolveCatalogSelectionOnServiceChange(
      '2',
      GarmentCategory.WEIGHT_BASED,
      mockServices,
    );
    assert.strictEqual(result, GarmentCategory.MEN);
  });

  it('keeps Women when switching between standard piece services (Dry Clean -> Steam Iron)', () => {
    const result = resolveCatalogSelectionOnServiceChange('3', GarmentCategory.WOMEN, mockServices);
    assert.strictEqual(result, GarmentCategory.WOMEN);
  });
});

describe('Order Creation Workflows - Laundry vs Dry Cleaning Separation', () => {
  it('isServiceAllowedInWorkflow restricts Laundry workflow to washing/add-ons and excludes Dry Clean', () => {
    assert.strictEqual(isServiceAllowedInWorkflow({ name: 'Standard Wash' }, 'LAUNDRY'), true);
    assert.strictEqual(
      isServiceAllowedInWorkflow({ name: 'Wash and Steam Iron' }, 'LAUNDRY'),
      true,
    );
    assert.strictEqual(isServiceAllowedInWorkflow({ name: 'Wash and Fold' }, 'LAUNDRY'), true);
    assert.strictEqual(isServiceAllowedInWorkflow({ name: 'Premium Laundry' }, 'LAUNDRY'), true);
    assert.strictEqual(isServiceAllowedInWorkflow({ name: 'Woolen Laundry' }, 'LAUNDRY'), true);
    assert.strictEqual(isServiceAllowedInWorkflow({ name: 'Laundry for White' }, 'LAUNDRY'), true);
    assert.strictEqual(isServiceAllowedInWorkflow({ name: 'Steam Iron' }, 'LAUNDRY'), true);
    assert.strictEqual(isServiceAllowedInWorkflow({ name: 'Starching' }, 'LAUNDRY'), true);
    assert.strictEqual(isServiceAllowedInWorkflow({ name: 'Dry Clean' }, 'LAUNDRY'), false);
    assert.strictEqual(isServiceAllowedInWorkflow({ name: 'Free Shoe' }, 'LAUNDRY'), false);
  });

  it('isServiceAllowedInWorkflow restricts Dry Cleaning workflow to dry cleaning/steam/starch and excludes wash services', () => {
    assert.strictEqual(isServiceAllowedInWorkflow({ name: 'Dry Clean' }, 'DRY_CLEANING'), true);
    assert.strictEqual(isServiceAllowedInWorkflow({ name: 'Steam Iron' }, 'DRY_CLEANING'), true);
    assert.strictEqual(isServiceAllowedInWorkflow({ name: 'Starching' }, 'DRY_CLEANING'), true);
    assert.strictEqual(isServiceAllowedInWorkflow({ name: 'Shoe Cleaning' }, 'DRY_CLEANING'), true);
    assert.strictEqual(
      isServiceAllowedInWorkflow({ name: 'Standard Wash' }, 'DRY_CLEANING'),
      false,
    );
    assert.strictEqual(
      isServiceAllowedInWorkflow({ name: 'Wash and Steam Iron' }, 'DRY_CLEANING'),
      false,
    );
    assert.strictEqual(
      isServiceAllowedInWorkflow({ name: 'Wash and Fold' }, 'DRY_CLEANING'),
      false,
    );
    assert.strictEqual(
      isServiceAllowedInWorkflow({ name: 'Premium Laundry' }, 'DRY_CLEANING'),
      false,
    );
    assert.strictEqual(
      isServiceAllowedInWorkflow({ name: 'Woolen Laundry' }, 'DRY_CLEANING'),
      false,
    );
    assert.strictEqual(
      isServiceAllowedInWorkflow({ name: 'Laundry for White' }, 'DRY_CLEANING'),
      false,
    );
    assert.strictEqual(isServiceAllowedInWorkflow({ name: 'Free Shoe' }, 'DRY_CLEANING'), false);
  });

  it('isCategoryAllowedInWorkflow allows WEIGHT_BASED in Laundry and allows WEIGHT_BASED as exception in Dry Cleaning', () => {
    assert.strictEqual(isCategoryAllowedInWorkflow(GarmentCategory.WEIGHT_BASED, 'LAUNDRY'), true);
    assert.strictEqual(isCategoryAllowedInWorkflow(GarmentCategory.MEN, 'LAUNDRY'), true);
    assert.strictEqual(isCategoryAllowedInWorkflow(GarmentCategory.WOMEN, 'LAUNDRY'), true);
    assert.strictEqual(
      isCategoryAllowedInWorkflow(GarmentCategory.WEIGHT_BASED, 'DRY_CLEANING'),
      true,
    );
    assert.strictEqual(isCategoryAllowedInWorkflow(GarmentCategory.MEN, 'DRY_CLEANING'), true);
    assert.strictEqual(
      isCategoryAllowedInWorkflow(GarmentCategory.HOUSEHOLD, 'DRY_CLEANING'),
      true,
    );
  });

  it('filterServicesForCategory applies workflow filters correctly', () => {
    const laundryServices = filterServicesForCategory(mockServices, GarmentCategory.MEN, 'LAUNDRY');
    const dryCleanServices = filterServicesForCategory(
      mockServices,
      GarmentCategory.MEN,
      'DRY_CLEANING',
    );

    assert.ok(laundryServices.some((s) => s.name === 'Standard Wash'));
    assert.ok(!laundryServices.some((s) => s.name === 'Dry Clean'));

    assert.ok(dryCleanServices.some((s) => s.name === 'Dry Clean'));
    assert.ok(!dryCleanServices.some((s) => s.name === 'Standard Wash'));
    assert.ok(!dryCleanServices.some((s) => s.name === 'Wash + Steam Iron'));
  });

  it('filterCategoriesForService keeps WEIGHT_BASED as an exception category in Dry Cleaning workflow', () => {
    const result = filterCategoriesForService(allCategories, '1', mockServices, 'DRY_CLEANING');
    assert.ok(result.includes(GarmentCategory.WEIGHT_BASED));
    assert.ok(result.includes(GarmentCategory.MEN));
  });

  it('isItemCompatibleWithWorkflow identifies incompatible items when switching workflows', () => {
    // Weight-based item is incompatible with Dry Cleaning
    const weightItem = { isWeightBased: true, weight: 3.5, serviceName: 'Standard Wash' };
    assert.strictEqual(isItemCompatibleWithWorkflow(weightItem, 'DRY_CLEANING'), false);
    assert.strictEqual(isItemCompatibleWithWorkflow(weightItem, 'LAUNDRY'), true);

    // Wash item is incompatible with Dry Cleaning
    const washItem = { isWeightBased: false, serviceName: 'Standard Wash' };
    assert.strictEqual(isItemCompatibleWithWorkflow(washItem, 'DRY_CLEANING'), false);
    assert.strictEqual(isItemCompatibleWithWorkflow(washItem, 'LAUNDRY'), true);

    // Dry clean item is incompatible with Laundry
    const dryCleanItem = { isWeightBased: false, serviceName: 'Dry Clean' };
    assert.strictEqual(isItemCompatibleWithWorkflow(dryCleanItem, 'LAUNDRY'), false);
    assert.strictEqual(isItemCompatibleWithWorkflow(dryCleanItem, 'DRY_CLEANING'), true);

    // Starching piece item is compatible with BOTH
    const starchItem = { isWeightBased: false, serviceName: 'Starching' };
    assert.strictEqual(isItemCompatibleWithWorkflow(starchItem, 'LAUNDRY'), true);
    assert.strictEqual(isItemCompatibleWithWorkflow(starchItem, 'DRY_CLEANING'), true);
  });

  it('resolveCatalogSelectionOnWorkflowChange switches selections to valid options', () => {
    // Switching to Dry Cleaning from WEIGHT_BASED and Standard Wash
    const toDryClean = resolveCatalogSelectionOnWorkflowChange(
      'DRY_CLEANING',
      '1', // Standard Wash
      GarmentCategory.WEIGHT_BASED,
      mockServices,
    );
    assert.strictEqual(toDryClean.category, GarmentCategory.MEN);
    assert.strictEqual(toDryClean.serviceId, '2'); // Dry Clean

    // Switching to Laundry from Dry Clean
    const toLaundry = resolveCatalogSelectionOnWorkflowChange(
      'LAUNDRY',
      '2', // Dry Clean
      GarmentCategory.MEN,
      mockServices,
    );
    assert.strictEqual(toLaundry.category, GarmentCategory.MEN);
    assert.strictEqual(toLaundry.serviceId, '1'); // Standard Wash (first preferred laundry service in mockServices)
  });

  it('resolveCatalogSelectionOnCategoryChange respects workflow when falling back from incompatible category', () => {
    // In Dry Cleaning workflow, switching away from Shoe Cleaning falls back to Dry Clean, NOT Standard Wash
    const dcResult = resolveCatalogSelectionOnCategoryChange(
      GarmentCategory.MEN,
      '5', // Shoe Cleaning
      mockServices,
      'DRY_CLEANING',
    );
    assert.strictEqual(dcResult, '2'); // Dry Clean

    // In Laundry workflow, switching away from Shoe Cleaning falls back to Standard Wash
    const laundryResult = resolveCatalogSelectionOnCategoryChange(
      GarmentCategory.MEN,
      '5', // Shoe Cleaning
      mockServices,
      'LAUNDRY',
    );
    assert.strictEqual(laundryResult, '1'); // Standard Wash
  });
});

describe('Receipt Notices & Bill Conditions', () => {
  it('defines the canonical garment collection notice', () => {
    assert.strictEqual(
      GARMENT_COLLECTION_NOTICE,
      'Please collect your garments within 15 days. We cannot guarantee the safety or availability of garments left uncollected after 15 days.',
    );
  });

  it('defines the canonical stain removal notice', () => {
    assert.strictEqual(
      STAIN_REMOVAL_NOTICE,
      'We make every effort to remove stains; however, 100% stain removal cannot be guaranteed. Results depend on the fabric, stain type, and garment condition.',
    );
  });
});

describe('Thursday Weekly Off - Due Date Adjustment', () => {
  it('moves Thursday due dates to Friday', () => {
    // 2026-10-15 is Thursday
    const thursdayDate = new Date('2026-10-15T18:00:00.000Z');
    const adjusted = adjustDueDateForThursday(thursdayDate, 'UTC');
    // Day of week in UTC: 5 (Friday)
    assert.strictEqual(adjusted.getUTCDay(), 5);
    assert.strictEqual(adjusted.getUTCDate(), 16);
    assert.strictEqual(adjusted.getUTCHours(), 18);
  });

  it('leaves Friday due dates unchanged', () => {
    // 2026-10-16 is Friday
    const fridayDate = new Date('2026-10-16T18:00:00.000Z');
    const adjusted = adjustDueDateForThursday(fridayDate, 'UTC');
    assert.strictEqual(adjusted.getUTCDay(), 5);
    assert.strictEqual(adjusted.getUTCDate(), 16);
  });

  it('leaves Wednesday due dates unchanged', () => {
    // 2026-10-14 is Wednesday
    const wednesdayDate = new Date('2026-10-14T18:00:00.000Z');
    const adjusted = adjustDueDateForThursday(wednesdayDate, 'UTC');
    assert.strictEqual(adjusted.getUTCDay(), 3);
    assert.strictEqual(adjusted.getUTCDate(), 14);
  });

  it('handles month boundaries (Thursday Oct 29 -> Friday Oct 30)', () => {
    // 2026-10-29 is Thursday
    const endOfMonthThursday = new Date('2026-10-29T10:00:00.000Z');
    const adjusted = adjustDueDateForThursday(endOfMonthThursday, 'UTC');
    assert.strictEqual(adjusted.getUTCDay(), 5);
    assert.strictEqual(adjusted.getUTCDate(), 30);
    assert.strictEqual(adjusted.getUTCMonth(), 9); // October (0-indexed)
  });

  it('handles year boundaries (Thursday Dec 31, 2026 -> Friday Jan 1, 2027)', () => {
    // 2026-12-31 is Thursday
    const yearEndThursday = new Date('2026-12-31T12:00:00.000Z');
    const adjusted = adjustDueDateForThursday(yearEndThursday, 'UTC');
    assert.strictEqual(adjusted.getUTCDay(), 5);
    assert.strictEqual(adjusted.getUTCDate(), 1);
    assert.strictEqual(adjusted.getUTCMonth(), 0); // January
    assert.strictEqual(adjusted.getUTCFullYear(), 2027);
  });

  it('is idempotent: running multiple times does not shift dates repeatedly', () => {
    const thursdayDate = new Date('2026-10-15T18:00:00.000Z');
    const firstAdjustment = adjustDueDateForThursday(thursdayDate, 'UTC');
    const secondAdjustment = adjustDueDateForThursday(firstAdjustment, 'UTC');
    const thirdAdjustment = adjustDueDateForThursday(secondAdjustment, 'UTC');

    assert.strictEqual(firstAdjustment.getTime(), secondAdjustment.getTime());
    assert.strictEqual(secondAdjustment.getTime(), thirdAdjustment.getTime());
  });

  it('respects timezone conventions (Asia/Kolkata)', () => {
    // 2026-10-15 14:00:00 UTC is 19:30:00 in Asia/Kolkata (Thursday evening)
    const kolkataThursday = new Date('2026-10-15T14:00:00.000Z');
    const adjusted = adjustDueDateForThursday(kolkataThursday, 'Asia/Kolkata');
    const dayOfWeek = getDayOfWeekInTimezone(adjusted, 'Asia/Kolkata');
    assert.strictEqual(dayOfWeek, 5); // Friday in Asia/Kolkata
  });
});

describe('Top Up Service Configuration Defaults', () => {
  it('provides default top up service configurations with non-negative prices', () => {
    assert.strictEqual(DEFAULT_TOP_UP_SERVICES.length, 4);
    const first = DEFAULT_TOP_UP_SERVICES[0]!;
    assert.strictEqual(first.id, 'addon-starch');
    assert.strictEqual(first.name, 'Starching');
    assert.strictEqual(first.price, 30);

    for (const addon of DEFAULT_TOP_UP_SERVICES) {
      assert.ok(addon.id);
      assert.ok(addon.name);
      assert.ok(addon.price >= 0);
    }
  });
});
