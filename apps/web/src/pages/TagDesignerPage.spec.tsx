import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { TagDesignerPage } from './TagDesignerPage';
import { TagDesignApi } from '../services/tag-design.api';
import {
  Role,
  REFERENCE_TAG_DESIGN,
  type TagDesignConfig,
} from '@growfast/shared-types';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

let mockCurrentRole: Role = Role.OWNER;

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    token: 'mock-owner-token',
    employee: {
      id: 'emp-owner-001',
      name: 'Owner Boss',
      role: mockCurrentRole,
      storeId: 'store-1',
      storeName: 'A Laundry',
    },
    logout: vi.fn(),
  }),
}));

vi.mock('../services/tag-design.api', () => ({
  TagDesignApi: {
    getDesign: vi.fn(),
    saveDesign: vi.fn(),
    resetDesign: vi.fn(),
    getHistory: vi.fn(),
    downloadFont: vi.fn(),
  },
}));

describe('TagDesignerPage (Design Tags Specification)', { timeout: 15000 }, () => {
  const mockDesign: TagDesignConfig = {
    ...REFERENCE_TAG_DESIGN,
    name: 'Initial Store Design',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockCurrentRole = Role.OWNER;
    (TagDesignApi.getDesign as any).mockResolvedValue(mockDesign);
    (TagDesignApi.saveDesign as any).mockImplementation(async (layout: TagDesignConfig) => ({
      success: true,
      data: layout,
      message: 'Saved',
    }));
    (TagDesignApi.resetDesign as any).mockResolvedValue({
      success: true,
      data: REFERENCE_TAG_DESIGN,
      message: 'Reset',
    });
    (TagDesignApi.getHistory as any).mockResolvedValue({
      success: true,
      data: [
        {
          version: 1,
          updatedAt: '2026-10-18T10:00:00.000Z',
          updatedByName: 'Prathamesh',
          updatedByEmail: 'owner@growfast.com',
          changesSummary: 'Initial baseline canonical design.',
        },
      ],
    });
    (TagDesignApi.downloadFont as any).mockResolvedValue(undefined);
    window.print = vi.fn();
    window.confirm = vi.fn(() => true);
  });

  it('loads active design and displays controls and live preview', async () => {
    render(
      <MemoryRouter>
        <TagDesignerPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Design Tags')).toBeInTheDocument();
    });

    // General Tag Settings
    expect(screen.getByText('General Tag Settings')).toBeInTheDocument();
    expect(screen.getByLabelText('Width')).toHaveValue('1.5 in');
    expect(screen.getByLabelText('Height')).toHaveValue('1.5 in');
    expect(screen.getByLabelText('Printer')).toHaveValue('TSC TE244');
    expect(screen.getByLabelText(/Wet Strength Paper/i)).toBeInTheDocument();

    // 11 Reference Fields check
    expect(screen.getByText('BarCode')).toBeInTheDocument();
    expect(screen.getByText('QRCode')).toBeInTheDocument();
    expect(screen.getByText('Booking No.')).toBeInTheDocument();
    expect(screen.getByText('Customer')).toBeInTheDocument();
    expect(screen.getByText('Address')).toBeInTheDocument();
    expect(screen.getByText('Process')).toBeInTheDocument();
    expect(screen.getByText('Item Total')).toBeInTheDocument();
    expect(screen.getByText('Remark')).toBeInTheDocument();
    expect(screen.getByText('Colour')).toBeInTheDocument();
    expect(screen.getByText('Booking Date')).toBeInTheDocument();
    expect(screen.getByText('Due Date')).toBeInTheDocument();

    // Live preview
    expect(screen.getByText('Live Tag Preview')).toBeInTheDocument();
    expect(screen.getByText(/Preview Sample Data/i)).toBeInTheDocument();

    // Action buttons
    expect(screen.getByRole('button', { name: /save design/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reset default/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /download font/i })).toBeInTheDocument();
  });

  it('toggles print visibility on fields', async () => {
    render(
      <MemoryRouter>
        <TagDesignerPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Design Tags')).toBeInTheDocument();
    });

    const toggleCustomerBtn = screen.getByRole('button', {
      name: /toggle print for customer/i,
    });
    expect(toggleCustomerBtn).toHaveTextContent('Print: Yes');

    fireEvent.click(toggleCustomerBtn);
    expect(toggleCustomerBtn).toHaveTextContent('Print: No');

    fireEvent.click(toggleCustomerBtn);
    expect(toggleCustomerBtn).toHaveTextContent('Print: Yes');
  });

  it('reorders fields using move up and move down buttons', async () => {
    render(
      <MemoryRouter>
        <TagDesignerPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Design Tags')).toBeInTheDocument();
    });

    // Move QRCode up (from index 1 to index 0)
    const moveUpQRCodeBtn = screen.getByRole('button', {
      name: /move qrcode up/i,
    });
    fireEvent.click(moveUpQRCodeBtn);

    // QRCode is now first
    const firstRowMoveUpBtn = screen.getByRole('button', {
      name: /move qrcode up/i,
    });
    expect(firstRowMoveUpBtn).toBeDisabled();
  });

  it('updates general settings: width, height, printer, and wet strength paper', async () => {
    render(
      <MemoryRouter>
        <TagDesignerPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Design Tags')).toBeInTheDocument();
    });

    const widthSelect = screen.getByLabelText('Width');
    fireEvent.change(widthSelect, { target: { value: '2.0 in' } });
    expect(widthSelect).toHaveValue('2.0 in');

    const printerSelect = screen.getByLabelText('Printer');
    fireEvent.change(printerSelect, { target: { value: 'Zebra ZD220 / ZD230' } });
    expect(printerSelect).toHaveValue('Zebra ZD220 / ZD230');

    const wetStrengthCheckbox = screen.getByLabelText(/Wet Strength Paper/i);
    expect(wetStrengthCheckbox).toBeChecked();
    fireEvent.click(wetStrengthCheckbox);
    expect(wetStrengthCheckbox).not.toBeChecked();

    // Verify unsaved changes badge appears
    expect(screen.getByText('Unsaved Changes')).toBeInTheDocument();
  });

  it('handles workshop prepone due date toggle and days stepper', async () => {
    render(
      <MemoryRouter>
        <TagDesignerPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Design Tags')).toBeInTheDocument();
    });

    const preponeCheckbox = screen.getByLabelText(
      /Select to bring forward\/Prepone Due Date for Workshop tags only/i,
    );
    expect(preponeCheckbox).not.toBeChecked();

    fireEvent.click(preponeCheckbox);
    expect(preponeCheckbox).toBeChecked();

    const daysInput = document.getElementById('workshop-prepone-days-input') as HTMLInputElement;
    expect(daysInput).toBeEnabled();
    fireEvent.change(daysInput, { target: { value: '2' } });
    expect(daysInput.value).toBe('2');
  });

  it('saves design when Save Design button is clicked', async () => {
    render(
      <MemoryRouter>
        <TagDesignerPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Design Tags')).toBeInTheDocument();
    });

    const saveBtn = screen.getByRole('button', { name: /save design/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(TagDesignApi.saveDesign).toHaveBeenCalledTimes(1);
      expect(screen.getByText(/saved successfully/i)).toBeInTheDocument();
    });
  });

  it('resets design back to reference default layout on confirmation', async () => {
    render(
      <MemoryRouter>
        <TagDesignerPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Design Tags')).toBeInTheDocument();
    });

    const resetBtn = screen.getByRole('button', { name: /reset default/i });
    fireEvent.click(resetBtn);

    expect(window.confirm).toHaveBeenCalled();
    await waitFor(() => {
      expect(TagDesignApi.resetDesign).toHaveBeenCalledTimes(1);
      expect(screen.getByText(/reset to canonical reference default/i)).toBeInTheDocument();
    });
  });

  it('triggers font download when Download Font button is clicked', async () => {
    render(
      <MemoryRouter>
        <TagDesignerPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Design Tags')).toBeInTheDocument();
    });

    const downloadBtn = screen.getByRole('button', { name: /download font/i });
    fireEvent.click(downloadBtn);

    await waitFor(() => {
      expect(TagDesignApi.downloadFont).toHaveBeenCalledTimes(1);
      expect(screen.getByText(/C39HrP36DmT\.ttf downloaded successfully/i)).toBeInTheDocument();
    });
  });

  it('opens history modal when History button is clicked', async () => {
    render(
      <MemoryRouter>
        <TagDesignerPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Design Tags')).toBeInTheDocument();
    });

    const historyBtn = screen.getByRole('button', { name: /history/i });
    fireEvent.click(historyBtn);

    await waitFor(() => {
      expect(screen.getByText(/Tag Design Change History/i)).toBeInTheDocument();
      expect(screen.getByText(/Initial baseline canonical design/i)).toBeInTheDocument();
    });
  });

  it('rejects access for non-owner employees and renders access denied card', async () => {
    mockCurrentRole = Role.COUNTER;

    render(
      <MemoryRouter>
        <TagDesignerPage />
      </MemoryRouter>,
    );

    expect(screen.getByText('Owner Access Required')).toBeInTheDocument();
    expect(
      screen.getByText(/Only authenticated Store Owners have permission/i),
    ).toBeInTheDocument();
    expect(screen.queryByText('General Tag Settings')).not.toBeInTheDocument();
  });
});
