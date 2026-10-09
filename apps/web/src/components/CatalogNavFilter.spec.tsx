import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { CatalogNavFilter, DEFAULT_CATEGORIES, DEFAULT_CATEGORY_LABELS } from './CatalogNavFilter';
import { GarmentCategory } from '@growfast/shared-types';

describe('CatalogNavFilter Service & Category Rules', () => {
  const sampleServices = [
    { id: 'svc-wash', name: 'Standard Wash', isActive: true },
    { id: 'svc-dc', name: 'Dry Clean', isActive: true },
    { id: 'svc-iron', name: 'Steam Iron', isActive: true },
    { id: 'svc-shoe', name: 'Shoe Cleaning', isActive: true },
    { id: 'svc-free-shoe', name: 'Free Shoe', isActive: true },
    { id: 'svc-reprocess', name: 'Reprocess Cleaning', isActive: true },
    { id: 'svc-starch', name: 'Starching Dc', isActive: true },
  ];

  it('Requirement 1: removes "Free Shoe" and "Reprocess Cleaning" from visible service buttons', () => {
    render(
      <CatalogNavFilter
        services={sampleServices}
        activeServiceId="svc-wash"
        onServiceChange={vi.fn()}
        activeCategory={GarmentCategory.MEN}
        onCategoryChange={vi.fn()}
        searchQuery=""
        onSearchChange={vi.fn()}
      />,
    );

    expect(screen.queryByRole('button', { name: /free shoe/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /reprocess cleaning/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /standard wash/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /dry clean/i })).toBeInTheDocument();
  });

  it('Requirement 2: renames "Starching Dc" to "Starching" on the visible service button', () => {
    render(
      <CatalogNavFilter
        services={sampleServices}
        activeServiceId="svc-wash"
        onServiceChange={vi.fn()}
        activeCategory={GarmentCategory.MEN}
        onCategoryChange={vi.fn()}
        searchQuery=""
        onSearchChange={vi.fn()}
      />,
    );

    expect(screen.queryByRole('button', { name: /^starching dc$/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^starching$/i })).toBeInTheDocument();
  });

  it('Requirement 3: when "Starching" is selected, shows ONLY Men, Women, Kids categories', () => {
    render(
      <CatalogNavFilter
        services={sampleServices}
        activeServiceId="svc-starch"
        onServiceChange={vi.fn()}
        activeCategory={GarmentCategory.MEN}
        onCategoryChange={vi.fn()}
        searchQuery=""
        onSearchChange={vi.fn()}
      />,
    );

    // Visible: Men, Women, Kids
    expect(screen.getByRole('button', { name: /^men$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^women$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^kids$/i })).toBeInTheDocument();

    // Hidden: Household, Home Cleaning, Shoe, Other, Weight Based
    expect(screen.queryByRole('button', { name: /^household$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^home cleaning$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^shoe$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^other$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^weight based$/i })).not.toBeInTheDocument();
  });

  it('Requirement 4: when switching to another service, restores normal category options', () => {
    const { rerender } = render(
      <CatalogNavFilter
        services={sampleServices}
        activeServiceId="svc-starch"
        onServiceChange={vi.fn()}
        activeCategory={GarmentCategory.MEN}
        onCategoryChange={vi.fn()}
        searchQuery=""
        onSearchChange={vi.fn()}
      />,
    );

    // When Starching is active, Household is not visible
    expect(screen.queryByRole('button', { name: /^household$/i })).not.toBeInTheDocument();

    // Now switch to Standard Wash
    rerender(
      <CatalogNavFilter
        services={sampleServices}
        activeServiceId="svc-wash"
        onServiceChange={vi.fn()}
        activeCategory={GarmentCategory.MEN}
        onCategoryChange={vi.fn()}
        searchQuery=""
        onSearchChange={vi.fn()}
      />,
    );

    // All categories should now be restored
    expect(screen.getByRole('button', { name: /^men$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^women$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^kids$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^household$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^home cleaning$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^shoe$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^other$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^weight based$/i })).toBeInTheDocument();
  });

  it('Requirement 5: correctly invokes callbacks on service and category clicks', () => {
    const handleServiceChange = vi.fn();
    const handleCategoryChange = vi.fn();

    render(
      <CatalogNavFilter
        services={sampleServices}
        activeServiceId="svc-wash"
        onServiceChange={handleServiceChange}
        activeCategory={GarmentCategory.MEN}
        onCategoryChange={handleCategoryChange}
        searchQuery=""
        onSearchChange={vi.fn()}
      />,
    );

    const starchingBtn = screen.getByRole('button', { name: /^starching$/i });
    fireEvent.click(starchingBtn);
    expect(handleServiceChange).toHaveBeenCalledWith('svc-starch');

    const womenBtn = screen.getByRole('button', { name: /^women$/i });
    fireEvent.click(womenBtn);
    expect(handleCategoryChange).toHaveBeenCalledWith(GarmentCategory.WOMEN);
  });
});
