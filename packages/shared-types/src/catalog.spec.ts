import { describe, it } from 'node:test';
import assert from 'node:assert';
import { GarmentCategory } from './enums';
import {
  filterServicesForCategory,
  filterCategoriesForService,
  formatCatalogServiceName,
  resolveCatalogSelectionOnCategoryChange,
  resolveCatalogSelectionOnServiceChange,
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

  it('restores all categories when switching to any other service', () => {
    const washResult = filterCategoriesForService(allCategories, '1', mockServices);
    assert.strictEqual(washResult.length, 8);
    const dryCleanResult = filterCategoriesForService(allCategories, '2', mockServices);
    assert.strictEqual(dryCleanResult.length, 8);
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

  it('keeps Women when Starching is selected and Women was already selected', () => {
    const result = resolveCatalogSelectionOnServiceChange('8', GarmentCategory.WOMEN, mockServices);
    assert.strictEqual(result, GarmentCategory.WOMEN);
  });

  it('keeps Kids when Starching is selected and Kids was already selected', () => {
    const result = resolveCatalogSelectionOnServiceChange('8', GarmentCategory.KIDS, mockServices);
    assert.strictEqual(result, GarmentCategory.KIDS);
  });

  it('keeps current category when Standard Wash or Dry Clean is selected', () => {
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

  it('keeps Starching when switching between Men and Women', () => {
    const result = resolveCatalogSelectionOnCategoryChange(
      GarmentCategory.WOMEN,
      '8',
      mockServices,
    );
    assert.strictEqual(result, '8');
  });
});
