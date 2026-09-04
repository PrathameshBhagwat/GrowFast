import { GarmentCategory } from './enums';
import {
  filterServicesForCategory,
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

describe('filterServicesForCategory', () => {
  it('returns all 8 services for non-Shoe categories', () => {
    const result = filterServicesForCategory(mockServices, GarmentCategory.MEN);
    expect(result).toHaveLength(8);
  });

  it('returns only 5 services for Shoe category', () => {
    const result = filterServicesForCategory(mockServices, GarmentCategory.SHOES);
    expect(result).toHaveLength(5);
    const names = result.map((s) => s.name);
    expect(names).toContain('Standard Wash');
    expect(names).toContain('Dry Clean');
    expect(names).toContain('Shoe Cleaning');
    expect(names).toContain('Reprocess Cleaning');
    expect(names).toContain('Free Shoe');
  });

  it('hides Steam Iron, Wash + Steam Iron, and Starching Dc for Shoe', () => {
    const result = filterServicesForCategory(mockServices, GarmentCategory.SHOES);
    const names = result.map((s) => s.name);
    expect(names).not.toContain('Steam Iron');
    expect(names).not.toContain('Wash + Steam Iron');
    expect(names).not.toContain('Starching Dc');
  });

  it('restores all 8 services when leaving Shoe for another category', () => {
    const shoeResult = filterServicesForCategory(mockServices, GarmentCategory.SHOES);
    expect(shoeResult).toHaveLength(5);
    const menResult = filterServicesForCategory(mockServices, GarmentCategory.MEN);
    expect(menResult).toHaveLength(8);
  });
});

describe('resolveCatalogSelectionOnCategoryChange', () => {
  it('auto-selects Shoe Cleaning when switching to Shoe from an invalid service', () => {
    // Steam Iron (id=3) is not valid for Shoe
    const result = resolveCatalogSelectionOnCategoryChange(GarmentCategory.SHOES, '3', mockServices);
    expect(result).toBe('5'); // Shoe Cleaning
  });

  it('keeps Standard Wash when switching to Shoe (valid shoe service)', () => {
    const result = resolveCatalogSelectionOnCategoryChange(GarmentCategory.SHOES, '1', mockServices);
    expect(result).toBe('1');
  });

  it('keeps Dry Clean when switching to Shoe (valid shoe service)', () => {
    const result = resolveCatalogSelectionOnCategoryChange(GarmentCategory.SHOES, '2', mockServices);
    expect(result).toBe('2');
  });

  it('keeps Shoe Cleaning when switching to Shoe', () => {
    const result = resolveCatalogSelectionOnCategoryChange(GarmentCategory.SHOES, '5', mockServices);
    expect(result).toBe('5');
  });

  it('keeps Free Shoe when switching to Shoe', () => {
    const result = resolveCatalogSelectionOnCategoryChange(GarmentCategory.SHOES, '7', mockServices);
    expect(result).toBe('7');
  });

  it('keeps Reprocess Cleaning when switching to Shoe', () => {
    const result = resolveCatalogSelectionOnCategoryChange(GarmentCategory.SHOES, '6', mockServices);
    expect(result).toBe('6');
  });

  it('auto-selects Shoe Cleaning when switching to Shoe from Wash + Steam Iron', () => {
    const result = resolveCatalogSelectionOnCategoryChange(GarmentCategory.SHOES, '4', mockServices);
    expect(result).toBe('5');
  });

  it('auto-selects Shoe Cleaning when switching to Shoe from Starching Dc', () => {
    const result = resolveCatalogSelectionOnCategoryChange(GarmentCategory.SHOES, '8', mockServices);
    expect(result).toBe('5');
  });

  it('keeps current service when switching to a non-Shoe category', () => {
    const result = resolveCatalogSelectionOnCategoryChange(GarmentCategory.MEN, '3', mockServices);
    expect(result).toBe('3');
  });

  it('auto-selects Standard Wash when leaving Shoe with Shoe Cleaning selected (Shoe → Men)', () => {
    const result = resolveCatalogSelectionOnCategoryChange(GarmentCategory.MEN, '5', mockServices);
    expect(result).toBe('1'); // Standard Wash
  });

  it('auto-selects Standard Wash when leaving Shoe with Free Shoe selected (Shoe → Women)', () => {
    const result = resolveCatalogSelectionOnCategoryChange(GarmentCategory.WOMEN, '7', mockServices);
    expect(result).toBe('1'); // Standard Wash
  });

  it('keeps Standard Wash when leaving Shoe with Standard Wash selected', () => {
    const result = resolveCatalogSelectionOnCategoryChange(GarmentCategory.MEN, '1', mockServices);
    expect(result).toBe('1');
  });

  it('keeps Dry Clean when leaving Shoe with Dry Clean selected', () => {
    const result = resolveCatalogSelectionOnCategoryChange(GarmentCategory.KIDS, '2', mockServices);
    expect(result).toBe('2');
  });
});

describe('resolveCatalogSelectionOnServiceChange', () => {
  it('auto-selects Shoe category when Shoe Cleaning is selected', () => {
    const result = resolveCatalogSelectionOnServiceChange('5', GarmentCategory.MEN, mockServices);
    expect(result).toBe(GarmentCategory.SHOES);
  });

  it('auto-selects Shoe category when Free Shoe is selected', () => {
    const result = resolveCatalogSelectionOnServiceChange('7', GarmentCategory.WOMEN, mockServices);
    expect(result).toBe(GarmentCategory.SHOES);
  });

  it('keeps current category when Dry Clean is selected', () => {
    const result = resolveCatalogSelectionOnServiceChange('2', GarmentCategory.SHOES, mockServices);
    expect(result).toBe(GarmentCategory.SHOES);
  });

  it('keeps current category when Standard Wash is selected', () => {
    const result = resolveCatalogSelectionOnServiceChange('1', GarmentCategory.MEN, mockServices);
    expect(result).toBe(GarmentCategory.MEN);
  });
});
