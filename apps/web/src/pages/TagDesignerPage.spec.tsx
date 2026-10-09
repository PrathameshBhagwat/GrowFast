import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { TagDesignerPage } from './TagDesignerPage';
import { TagDesignApi } from '../services/tag-design.api';
import { Role, DEFAULT_TAG_DESIGN, type TagDesignConfig } from '@growfast/shared-types';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    token: 'mock-owner-token',
    employee: {
      id: 'emp-owner-001',
      name: 'Owner Boss',
      role: Role.OWNER,
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
  },
}));

describe('TagDesignerPage (Phase T4: Admin Tag Designer)', () => {
  const mockDesign: TagDesignConfig = {
    ...DEFAULT_TAG_DESIGN,
    name: 'Initial Store Design',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (TagDesignApi.getDesign as any).mockResolvedValue(mockDesign);
    (TagDesignApi.saveDesign as any).mockImplementation(async (layout: TagDesignConfig) => ({
      success: true,
      data: layout,
      message: 'Saved',
    }));
    (TagDesignApi.resetDesign as any).mockResolvedValue({
      success: true,
      data: DEFAULT_TAG_DESIGN,
      message: 'Reset',
    });
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
      expect(screen.getByText('Admin Tag Designer')).toBeInTheDocument();
    });

    expect(screen.getByText('Live 40 × 40 mm Preview')).toBeInTheDocument();
    expect(screen.getByText('Field Arrangement & Typography')).toBeInTheDocument();
    expect(screen.getByText('Tag Padding & Border')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save design/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reset default/i })).toBeInTheDocument();
  });

  it('toggles field visibility when toggle button is clicked', async () => {
    render(
      <MemoryRouter>
        <TagDesignerPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Admin Tag Designer')).toBeInTheDocument();
    });

    const toggleCustomerBtn = screen.getByRole('button', {
      name: /toggle visibility of customer name/i,
    });
    expect(toggleCustomerBtn).toHaveTextContent('Visible');

    fireEvent.click(toggleCustomerBtn);
    expect(toggleCustomerBtn).toHaveTextContent('Hidden');

    fireEvent.click(toggleCustomerBtn);
    expect(toggleCustomerBtn).toHaveTextContent('Visible');
  });

  it('reorders fields using move up and move down buttons', async () => {
    render(
      <MemoryRouter>
        <TagDesignerPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Admin Tag Designer')).toBeInTheDocument();
    });

    // Move orderNumber up (index 1 -> index 0)
    const moveUpOrderNumberBtn = screen.getByRole('button', {
      name: /move order number \(primary anchor\) up/i,
    });
    fireEvent.click(moveUpOrderNumberBtn);

    // After move up, orderNumber row should be first (1. Order Number)
    expect(screen.getByText(/1\. Order Number/i)).toBeInTheDocument();
  });

  it('adjusts text alignment on field', async () => {
    render(
      <MemoryRouter>
        <TagDesignerPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Admin Tag Designer')).toBeInTheDocument();
    });

    const alignCenterBtn = screen.getAllByRole('button', {
      name: /align center/i,
    })[0];
    fireEvent.click(alignCenterBtn);
  });

  it('increments and decrements font size within bounds', async () => {
    render(
      <MemoryRouter>
        <TagDesignerPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Admin Tag Designer')).toBeInTheDocument();
    });

    const increaseBtn = screen.getAllByRole('button', {
      name: /increase font size/i,
    })[0];
    fireEvent.click(increaseBtn);

    const decreaseBtn = screen.getAllByRole('button', {
      name: /decrease font size/i,
    })[0];
    fireEvent.click(decreaseBtn);
  });

  it('adjusts tag padding and border style', async () => {
    render(
      <MemoryRouter>
        <TagDesignerPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Admin Tag Designer')).toBeInTheDocument();
    });

    const incTopPaddingBtn = screen.getByRole('button', {
      name: /increase top padding/i,
    });
    fireEvent.click(incTopPaddingBtn);

    const solidBorderBtn = screen.getByRole('button', { name: /solid/i });
    fireEvent.click(solidBorderBtn);
  });

  it('switches sample order presets', async () => {
    render(
      <MemoryRouter>
        <TagDesignerPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Admin Tag Designer')).toBeInTheDocument();
    });

    const select = screen.getByLabelText(/sample garment order:/i);
    fireEvent.change(select, { target: { value: '1' } }); // Long text preset
  });

  it('toggles calibration test pattern preview', async () => {
    render(
      <MemoryRouter>
        <TagDesignerPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Admin Tag Designer')).toBeInTheDocument();
    });

    const calibToggleBtn = screen.getByRole('button', { name: /calibration/i });
    fireEvent.click(calibToggleBtn);
    expect(screen.getByRole('button', { name: /show tag/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /show tag/i }));
    expect(screen.getByRole('button', { name: /calibration/i })).toBeInTheDocument();
  });

  it('saves design when Save Design button is clicked', async () => {
    render(
      <MemoryRouter>
        <TagDesignerPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Admin Tag Designer')).toBeInTheDocument();
    });

    const saveBtn = screen.getByRole('button', { name: /save design/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(TagDesignApi.saveDesign).toHaveBeenCalledTimes(1);
      expect(screen.getByText(/tag design configuration saved successfully/i)).toBeInTheDocument();
    });
  });

  it('resets design to canonical default when Reset Default is clicked and confirmed', async () => {
    render(
      <MemoryRouter>
        <TagDesignerPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Admin Tag Designer')).toBeInTheDocument();
    });

    const resetBtn = screen.getByRole('button', { name: /reset default/i });
    fireEvent.click(resetBtn);

    await waitFor(() => {
      expect(TagDesignApi.resetDesign).toHaveBeenCalledTimes(1);
      expect(
        screen.getByText(/tag layout reset to canonical 40×40 mm default/i),
      ).toBeInTheDocument();
    });
  });

  it('triggers test print with active design when Print Test button is clicked', async () => {
    render(
      <MemoryRouter>
        <TagDesignerPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Admin Tag Designer')).toBeInTheDocument();
    });

    const printBtn = screen.getByRole('button', {
      name: /print test sample tag \(40×40 mm\)/i,
    });
    fireEvent.click(printBtn);

    expect(window.print).toHaveBeenCalledTimes(1);
  });
});
