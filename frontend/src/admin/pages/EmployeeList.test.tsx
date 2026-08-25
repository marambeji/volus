import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import EmployeeList from './EmployeeList';
import { apiFetch } from '../../services/apiClient';

import { MemoryRouter } from 'react-router-dom';
import { AdminProvider } from '../store/AdminContext';

vi.mock('../../services/apiClient', () => ({
  apiFetch: vi.fn(),
}));

const mockedApiFetch = vi.mocked(apiFetch);

describe('EmployeeList Page Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedApiFetch.mockImplementation((endpoint: string) => {
      if (endpoint.startsWith('/employees')) {
        return Promise.resolve({
          data: [
            { id: 'emp-1', fullName: 'Alice Smith', email: 'alice@novelus.com', department: 'Engineering', status: 'ACTIVE' },
          ],
          total: 1,
        });
      }
      return Promise.resolve([]);
    });
  });

  it('renders employee directory list', async () => {
    await act(async () => {
      render(
        <MemoryRouter>
          <AdminProvider>
            <EmployeeList />
          </AdminProvider>
        </MemoryRouter>
      );
    });

    expect(screen.getAllByText(/Alice Smith/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/alice@novelus.com/i)).toBeInTheDocument();
  });
});
