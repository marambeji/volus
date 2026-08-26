import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LeaveTracking from './LeaveTracking';
import { apiFetch } from '../services/apiClient';

vi.mock('../services/apiClient', () => ({
  apiFetch: vi.fn(),
}));

const mockedApiFetch = vi.mocked(apiFetch);

describe('LeaveTracking Page Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('currentUser', JSON.stringify({ id: 'emp-1', role: 'employee' }));

    mockedApiFetch.mockImplementation((endpoint: string) => {
      if (endpoint.startsWith('/leave-requests/my-requests')) {
        return Promise.resolve([
          {
            id: 'req-101',
            leaveTypeId: 'lt-1',
            leaveType: { id: 'lt-1', key: 'annual', label: 'Annual Leave' },
            startDate: '2026-09-01',
            endDate: '2026-09-05',
            durationDays: 5,
            reason: 'Annual Vacation',
            status: 'PENDING',
            createdAt: '2026-08-20T10:00:00.000Z',
            approvalInstances: [],
          },
        ]);
      }
      if (endpoint.includes('/cancel')) {
        return Promise.resolve({ success: true });
      }
      return Promise.resolve(null);
    });
  });

  it('renders approval progress dashboard and request list', async () => {
    render(<LeaveTracking />);

    expect(screen.getByText('Approval Progress')).toBeInTheDocument();
    
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Annual Leave' })).toBeInTheDocument();
      expect(screen.getAllByText('Pending').length).toBeGreaterThan(0);
    });
  });

  it('allows clicking a request to view details', async () => {
    const user = userEvent.setup();
    render(<LeaveTracking />);

    let detailsBtn: HTMLElement | null = null;
    await waitFor(() => {
      detailsBtn = screen.getByRole('button', { name: /Details/i });
      expect(detailsBtn).toBeInTheDocument();
    });

    await user.click(detailsBtn!);

    // Should display slide drawer details
    await waitFor(() => {
      expect(screen.getByText('Leave Request Details')).toBeInTheDocument();
      expect(screen.getByText('"Annual Vacation"')).toBeInTheDocument();
    });
  });

  it('handles cancelling a pending request', async () => {
    const user = userEvent.setup();
    render(<LeaveTracking />);

    let detailsBtn: HTMLElement | null = null;
    await waitFor(() => {
      detailsBtn = screen.getByRole('button', { name: /Details/i });
      expect(detailsBtn).toBeInTheDocument();
    });

    await user.click(detailsBtn!);

    // Find the cancel button in the drawer
    let cancelBtn: HTMLElement | null = null;
    await waitFor(() => {
      cancelBtn = screen.getByRole('button', { name: /Cancel Request/i });
      expect(cancelBtn).toBeInTheDocument();
    });
    await user.click(cancelBtn!);

    // Confirm cancel confirmation dialog/actions if any
    let confirmCancelBtn: HTMLElement | null = null;
    await waitFor(() => {
      confirmCancelBtn = screen.getByRole('button', { name: /Yes, Cancel/i });
      expect(confirmCancelBtn).toBeInTheDocument();
    });
    await user.click(confirmCancelBtn!);

    await waitFor(() => {
      expect(mockedApiFetch).toHaveBeenCalledWith(
        expect.stringContaining('/cancel'),
        expect.anything()
      );
    });
  });

  it('shows a Second Half badge for a half-day request', async () => {
    // Local override (not the shared beforeEach list) so this stays the
    // only request in the list — the other tests above rely on exactly
    // one "Details" button being present.
    mockedApiFetch.mockImplementation((endpoint: string) => {
      if (endpoint.startsWith('/leave-requests/my-requests')) {
        return Promise.resolve([
          {
            id: 'req-102',
            leaveTypeId: 'lt-1',
            leaveType: { id: 'lt-1', key: 'annual', label: 'Annual Leave' },
            startDate: '2026-09-10',
            endDate: '2026-09-10',
            durationDays: 0.5,
            dayPortion: 'SECOND_HALF',
            reason: 'Doctor appointment',
            status: 'PENDING',
            createdAt: '2026-09-01T10:00:00.000Z',
            approvalInstances: [],
          },
        ]);
      }
      return Promise.resolve(null);
    });

    render(<LeaveTracking />);

    await waitFor(() => {
      expect(screen.getByText(/Second Half/i)).toBeInTheDocument();
    });
  });
});
