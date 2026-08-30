import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import AdminDashboard from './AdminDashboard';
import { apiFetch } from '../../services/apiClient';

import { AdminProvider } from '../store/AdminContext';

vi.mock('../../services/apiClient', () => ({
  apiFetch: vi.fn(),
}));

const mockedApiFetch = vi.mocked(apiFetch);

describe('AdminDashboard Page Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedApiFetch.mockImplementation((endpoint: string) => {
      if (endpoint.startsWith('/employees')) {
        return Promise.resolve({
          data: [],
          total: 0,
        });
      }
      if (endpoint.includes('/leave-balances/employee/')) {
        return Promise.resolve({ balances: [] });
      }
      return Promise.resolve([]);
    });
  });

  it('renders admin dashboard metrics and navigation cards', async () => {
    await act(async () => {
      render(
        <AdminProvider>
          <AdminDashboard />
        </AdminProvider>
      );
    });

    expect(screen.getByText(/HR Dashboard/i)).toBeInTheDocument();
  });
});
