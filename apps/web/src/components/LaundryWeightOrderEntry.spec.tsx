import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LaundryWeightOrderEntry } from './LaundryWeightOrderEntry';
import { GarmentCategory, ServiceCategory } from '@growfast/shared-types';

describe('LaundryWeightOrderEntry - UI Cleanup & Photo Security Fix', () => {
  const mockServices = [
    {
      id: 'svc-wash',
      name: 'Standard Wash',
      category: ServiceCategory.WEIGHT_BASED,
      isActive: true,
      estimatedDays: 2,
    },
    {
      id: 'svc-laundry-woolen',
      name: 'Woolen Laundry',
      category: ServiceCategory.WEIGHT_BASED,
      isActive: true,
      estimatedDays: 3,
    },
    {
      id: 'svc-wash-fold',
      name: 'Wash and Fold',
      category: ServiceCategory.WEIGHT_BASED,
      isActive: true,
      estimatedDays: 2,
    },
    {
      id: 'svc-laundry-white',
      name: 'Laundry for White',
      category: ServiceCategory.WEIGHT_BASED,
      isActive: true,
      estimatedDays: 2,
    },
    {
      id: 'svc-wash-iron',
      name: 'Wash and Steam Iron',
      category: ServiceCategory.WEIGHT_BASED,
      isActive: true,
      estimatedDays: 2,
    },
    {
      id: 'svc-laundry-premium',
      name: 'Premium Laundry',
      category: ServiceCategory.WEIGHT_BASED,
      isActive: true,
      estimatedDays: 2,
    },
  ];

  const mockWeightGarments = [
    {
      id: 'g-laundry',
      name: 'Bulk Laundry',
      category: GarmentCategory.WEIGHT_BASED,
      isActive: true,
    },
  ];

  const mockPrices = [
    { garmentCatalogId: 'g-laundry', serviceTypeId: 'svc-wash-iron', price: 95 },
    { garmentCatalogId: 'g-laundry', serviceTypeId: 'svc-wash-fold', price: 80 },
    { garmentCatalogId: 'g-laundry', serviceTypeId: 'svc-laundry-white', price: 110 },
    { garmentCatalogId: 'g-laundry', serviceTypeId: 'svc-laundry-premium', price: 120 },
    { garmentCatalogId: 'g-laundry', serviceTypeId: 'svc-laundry-woolen', price: 140 },
    { garmentCatalogId: 'g-laundry', serviceTypeId: 'svc-wash', price: 70 },
  ];

  let onAddToCart: any;
  let onRemoveItem: any;
  let onCheckout: any;

  beforeEach(() => {
    onAddToCart = vi.fn();
    onRemoveItem = vi.fn();
    onCheckout = vi.fn();
    global.URL.createObjectURL = vi.fn((file: File) => `blob:mock-url-${file.name}`);
    global.URL.revokeObjectURL = vi.fn();
  });

  const renderComponent = (
    props: Partial<React.ComponentProps<typeof LaundryWeightOrderEntry>> = {},
  ) => {
    return render(
      <LaundryWeightOrderEntry
        services={mockServices as any}
        prices={mockPrices as any}
        weightGarments={mockWeightGarments as any}
        items={[]}
        onAddToCart={onAddToCart}
        onRemoveItem={onRemoveItem}
        onCheckout={onCheckout}
        isSubmitting={false}
        pendingPickupsCount={10}
        {...props}
      />,
    );
  };

  it('1. Redundant yellow instructional banner no longer renders', async () => {
    renderComponent();

    // The yellow instructional banner with wording "Individual photos required: X garments = X photos..." must NOT exist
    expect(
      screen.queryByText(/Individual photos required:.*Upload one photo for each garment/i),
    ).not.toBeInTheDocument();
    expect(document.getElementById('laundry-photo-mandate-notice')).not.toBeInTheDocument();
  });

  it('2. Required-photo badge, section heading, and progress indicator still render correctly', async () => {
    renderComponent();

    // Section heading preserved
    expect(screen.getByText('Individual Garment Photos')).toBeInTheDocument();

    // Required count badge preserved
    expect(screen.getByText('1 Needed')).toBeInTheDocument();

    // Progress counter and bar preserved
    expect(screen.getByText('0 of 1 garment photos uploaded — 1 remaining.')).toBeInTheDocument();
    expect(document.getElementById('laundry-photo-progress-text')).toBeInTheDocument();

    // Slot 1 is rendered with Upload button
    expect(screen.getByText(/Garment 1 — Add Photo/i)).toBeInTheDocument();
    expect(screen.getByTitle(/Upload photo for garment 1/i)).toBeInTheDocument();
  });

  it('3. Standard Wash is absent from the Per-Weight service-selection interface', async () => {
    renderComponent();

    // Standard Wash must not be rendered as a radio option or visible text
    expect(screen.queryByRole('radio', { name: /standard wash/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/^Standard Wash$/i)).not.toBeInTheDocument();
  });

  it('4. The remaining service cards appear in the exact specified order', async () => {
    renderComponent();

    const serviceRadios = screen.getAllByRole('radio');
    expect(serviceRadios).toHaveLength(5);

    // 1. Wash and Steam Iron
    expect(within(serviceRadios[0]).getByText('Wash and Steam Iron')).toBeInTheDocument();
    // 2. Wash and Fold
    expect(within(serviceRadios[1]).getByText('Wash and Fold')).toBeInTheDocument();
    // 3. Laundry for White
    expect(within(serviceRadios[2]).getByText('Laundry for White')).toBeInTheDocument();
    // 4. Premium Laundry
    expect(within(serviceRadios[3]).getByText('Premium Laundry')).toBeInTheDocument();
    // 5. Woolen Laundry
    expect(within(serviceRadios[4]).getByText('Woolen Laundry')).toBeInTheDocument();
  });

  it('5. Existing service selection and pricing behavior remain intact', async () => {
    renderComponent();

    // Default active service is Wash and Steam Iron (price 95/kg)
    expect(screen.getByText('95')).toBeInTheDocument();

    // Select "Laundry for White" (3rd card, price 110/kg)
    const serviceRadios = screen.getAllByRole('radio');
    fireEvent.click(serviceRadios[2]);

    expect(screen.getByText('110')).toBeInTheDocument();

    // Add to cart with weight = 3.00 kg
    const weightInput = screen.getByLabelText(/Measured Weight in kilograms/i);
    fireEvent.change(weightInput, { target: { value: '3.00' } });

    const addToCartBtn = screen.getByRole('button', { name: /Add to Cart/i });
    fireEvent.click(addToCartBtn);

    expect(onAddToCart).toHaveBeenCalledTimes(1);
    const addedItem = onAddToCart.mock.calls[0][0];
    expect(addedItem.serviceName).toBe('Laundry for White');
    expect(addedItem.unitPrice).toBe(110);
    expect(addedItem.weight).toBe(3.0);
    expect(addedItem.lineTotal).toBe(330); // 3 kg * 110 = 330
  });

  it('6. Quick Snap All and per-garment Quick Snap controls are absent from this workflow', async () => {
    renderComponent();

    // Quick Snap All button must not exist
    expect(document.getElementById('laundry-snap-all-remaining-btn')).not.toBeInTheDocument();
    expect(screen.queryByText(/Quick Snap All/i)).not.toBeInTheDocument();

    // Per-garment Quick Snap button must not exist
    expect(screen.queryByTitle(/Quick snap/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Quick Snap/i })).not.toBeInTheDocument();
  });

  it('7. Individual file uploads still work, update progress, and allow replacement', async () => {
    renderComponent();

    const file1 = new File(['g1-photo'], 'g1.jpg', { type: 'image/jpeg' });
    fireEvent.change(screen.getByTestId('garment-photo-input-1'), { target: { files: [file1] } });

    await waitFor(() => {
      expect(screen.getByText('1 of 1 garment photos uploaded — 0 remaining.')).toBeInTheDocument();
      expect(screen.getByText('1/1 Complete')).toBeInTheDocument();
      expect(screen.getByTitle(/Replace Garment 1 photo/i)).toBeInTheDocument();
    });

    // Replace photo
    const file2 = new File(['g1-replaced'], 'g1-new.jpg', { type: 'image/jpeg' });
    fireEvent.change(screen.getByTestId('garment-replace-input-1'), { target: { files: [file2] } });

    await waitFor(() => {
      expect(screen.getByText('1 of 1 garment photos uploaded — 0 remaining.')).toBeInTheDocument();
      expect(global.URL.createObjectURL).toHaveBeenCalledWith(file2);
    });
  });

  it('8. Upload Multiple correctly associates files with individual garments in order', async () => {
    renderComponent();

    // Set garment count to 3
    const countInput = screen.getByLabelText(/Number of garments in laundry batch/i);
    fireEvent.change(countInput, { target: { value: '3' } });

    expect(screen.getByText('0 of 3 garment photos uploaded — 3 remaining.')).toBeInTheDocument();

    // Upload multiple files via Upload Multiple input
    const fileA = new File(['img-a'], 'garment-a.jpg', { type: 'image/jpeg' });
    const fileB = new File(['img-b'], 'garment-b.jpg', { type: 'image/jpeg' });
    const multiInput = document
      .getElementById('laundry-upload-multi-photos-btn')
      ?.parentElement?.parentElement?.querySelector('input[multiple]') as HTMLInputElement;

    fireEvent.change(multiInput, { target: { files: [fileA, fileB] } });

    await waitFor(() => {
      expect(screen.getByText('2 of 3 garment photos uploaded — 1 remaining.')).toBeInTheDocument();
      // Garment 1 and 2 are uploaded; Garment 3 is pending
      expect(screen.getByTitle(/Replace Garment 1 photo/i)).toBeInTheDocument();
      expect(screen.getByTitle(/Replace Garment 2 photo/i)).toBeInTheDocument();
      expect(screen.getByTitle(/Upload photo for garment 3/i)).toBeInTheDocument();
    });
  });

  it('9. Mandatory photo validation remains effective for 1–50 garments', async () => {
    renderComponent();

    const countInput = screen.getByLabelText(/Number of garments in laundry batch/i);

    // 1 garment
    expect(screen.getByText('1 Needed')).toBeInTheDocument();

    // 50 garments
    fireEvent.change(countInput, { target: { value: '50' } });
    expect(screen.getByText('50 Needed')).toBeInTheDocument();
    expect(screen.getByText('0 of 50 garment photos uploaded — 50 remaining.')).toBeInTheDocument();
  });

  it('10. Photos remain optional above 50 garments under existing rules', async () => {
    renderComponent();

    const countInput = screen.getByLabelText(/Number of garments in laundry batch/i);
    fireEvent.change(countInput, { target: { value: '51' } });

    expect(screen.getByText(/Optional \(>50\)/i)).toBeInTheDocument();
    expect(screen.getByText('0 of 51 garment photos uploaded (optional).')).toBeInTheDocument();
  });

  it('11. Minimum weight 2.00 kg is enforced', async () => {
    renderComponent();

    const weightInput = screen.getByLabelText(/Measured Weight in kilograms/i);
    fireEvent.change(weightInput, { target: { value: '1.80' } });

    expect(screen.getByText('Minimum permitted weight is 2.00 kg.')).toBeInTheDocument();

    const addToCartBtn = screen.getByRole('button', { name: /Add to Cart/i });
    expect(addToCartBtn).toBeDisabled();
    fireEvent.click(addToCartBtn);

    expect(onAddToCart).not.toHaveBeenCalled();
  });
});
