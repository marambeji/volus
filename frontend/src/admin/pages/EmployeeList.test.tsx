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
    localStorage.clear();
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

  it('hides the Add Employee trigger button when canManage is false', async () => {
    localStorage.setItem('currentUser', JSON.stringify({
      isSuperAdmin: false,
      permissions: { employees: { canView: true, canManage: false } },
    }));
    await act(async () => {
      render(
        <MemoryRouter>
          <AdminProvider>
            <EmployeeList />
          </AdminProvider>
        </MemoryRouter>
      );
    });
    // The drawer's submit button also renders "Add Employee" text even while closed
    // (SlideDrawer keeps its children mounted, just visually hidden) — so with the
    // header trigger button gated off, only that one stale occurrence remains.
    expect(screen.queryAllByText('Add Employee')).toHaveLength(1);
  });

  it('shows Add Employee when canManage is true', async () => {
    localStorage.setItem('currentUser', JSON.stringify({
      isSuperAdmin: false,
      permissions: { employees: { canView: true, canManage: true } },
    }));
    await act(async () => {
      render(
        <MemoryRouter>
          <AdminProvider>
            <EmployeeList />
          </AdminProvider>
        </MemoryRouter>
      );
    });
    // Header trigger button + drawer's submit button, both rendering "Add Employee".
    expect(screen.queryAllByText('Add Employee')).toHaveLength(2);
  });
});
