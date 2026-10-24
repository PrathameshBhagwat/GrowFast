import '@testing-library/jest-dom';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { LoginPage } from './LoginPage';
import { apiFetch } from '../services/api';

const mockLogin = vi.fn();
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    login: mockLogin,
    error: null,
  }),
}));

vi.mock('../services/api', () => ({
  apiFetch: vi.fn(),
}));

describe('LoginPage - Role Restrictions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('filters login directory options to only OWNER and COUNTER', async () => {
    (apiFetch as any).mockResolvedValue({
      data: [
        { id: 'emp-1', name: 'Prathamesh', role: 'OWNER' },
        { id: 'emp-2', name: 'Rajesh', role: 'MANAGER' },
        { id: 'emp-3', name: 'Swapnil', role: 'COUNTER' },
        { id: 'emp-4', name: 'Kiran', role: 'DELIVERY' },
      ],
    });

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    // Wait for directory to be loaded and placeholder to appear
    await waitFor(() => {
      expect(screen.getByText('Select who you are')).toBeInTheDocument();
    });

    // Open dropdown to view options
    fireEvent.click(screen.getByText('Select who you are'));

    await waitFor(() => {
      expect(screen.getByText(/Prathamesh \(OWNER\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Swapnil \(COUNTER\)/i)).toBeInTheDocument();
    });

    // MANAGER and DELIVERY must not be in the document
    expect(screen.queryByText(/Rajesh \(MANAGER\)/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Kiran \(DELIVERY\)/i)).not.toBeInTheDocument();
  });
});
