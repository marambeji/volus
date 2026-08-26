import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ApprovalDashboard from './ApprovalDashboard';
import { apiFetch } from '../services/apiClient';

vi.mock('../services/apiClient', () => ({
  apiFetch: vi.fn(),
}));

const mockedApiFetch = vi.mocked(apiFetch);

describe('ApprovalDashboard Page Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('currentUser', JSON.stringify({ id: 'mgr-1', role: 'manager' }));

    mockedApiFetch.mockImplementation((endpoint: string) => {
      if (endpoint.startsWith('/leave-requests/my-approvals')) {
        return Promise.resolve([
          {
            stepInstanceId: 'step-101',
            requestId: 'req-101',
            stepOrder: 1,
            approverType: 'MANAGER',
            employeeId: 'emp-2',
            leaveTypeId: 'lt-1',
            employeeName: 'Ahmad Staff',
            leaveTypeName: 'Annual Leave',
            startDate: '2026-09-01',
            endDate: '2026-09-05',
            durationDays: 5,
            reason: 'Vacation',
            submittedAt: '2026-08-20',
          },
          {
            stepInstanceId: 'step-102',
            requestId: 'req-102',
            stepOrder: 1,
            approverType: 'MANAGER',
            employeeId: 'emp-2',
            leaveTypeId: 'lt-1',
            employeeName: 'Sara Khalil',
            leaveTypeName: 'Annual Leave',
            startDate: '2026-09-11',
            endDate: '2026-09-11',
            durationDays: 0.5,
            dayPortion: 'FIRST_HALF',
            reason: 'Personal errand',
            submittedAt: '2026-08-21',
          },
        ]);
      }
      if (endpoint.startsWith('/employees')) {
        return Promise.resolve({
          data: [
            { id: 'emp-2', fullName: 'Ahmad Staff', managerId: 'mgr-1' }
          ],
          total: 1
        });
      }
      if (endpoint.startsWith('/leave-types')) {
        return Promise.resolve({
          data: [{ id: 'lt-1', key: 'annual', label: 'Annual Leave' }],
        });
      }
      if (endpoint.startsWith('/leave-balances/employee/')) {
        return Promise.resolve({
          balances: [
            {
              leaveTypeId: 'lt-1',
              code: 'annual',
              name: 'Annual Leave',
              available: 15,
              entitlement: 25,
              earned: 10,
              adjustments: 0,
              used: 0,
              pending: 0,
              remaining: 15,
              requiresPositiveBalance: true
            }
          ]
        });
      }
      if (endpoint.includes('/approve') || endpoint.includes('/reject')) {
        return Promise.resolve({ success: true });
      }
      return Promise.resolve([]);
    });
  });

  it('renders pending approval requests for managers', async () => {
    await act(async () => {
      render(<ApprovalDashboard />);
    });

    expect(screen.getByText(/Ahmad Staff/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Annual Leave/i).length).toBeGreaterThan(0);
  });

  it('handles request approval action', async () => {
    const user = userEvent.setup();

    await act(async () => {
      render(<ApprovalDashboard />);
    });

    // Click primary row Approve button
    const approveButtons = screen.getAllByRole('button', { name: /^Approve$/i });
    expect(approveButtons.length).toBeGreaterThan(0);
    await user.click(approveButtons[0]);

    // Click Approve Request in confirmation modal
    const confirmBtn = screen.getByRole('button', { name: /Approve Request/i });
    await user.click(confirmBtn);

    await waitFor(() => {
      expect(mockedApiFetch).toHaveBeenCalledWith(
        expect.stringContaining('/approve'),
        expect.anything()
      );
    });
  });

  it('shows a First Half badge for a half-day approval request', async () => {
    await act(async () => {
      render(<ApprovalDashboard />);
    });

    await waitFor(() => {
      expect(screen.getByText(/First Half/i)).toBeInTheDocument();
    });
  });
});
