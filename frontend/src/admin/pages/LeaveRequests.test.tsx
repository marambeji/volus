import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LeaveRequests from './LeaveRequests';
import { AdminProvider } from '../store/AdminContext';
import { hrGetLeaveRequests } from '../../services/adminApi';

vi.mock('../../services/adminApi', () => ({
  hrGetLeaveRequests: vi.fn(),
  hrApproveLeaveRequest: vi.fn(),
  hrRejectLeaveRequest: vi.fn(),
  hrDeleteLeaveRequest: vi.fn(),
}));

const mockedHrGetLeaveRequests = vi.mocked(hrGetLeaveRequests);

function renderPage() {
  return render(
    <MemoryRouter>
      <AdminProvider>
        <LeaveRequests />
      </AdminProvider>
    </MemoryRouter>,
  );
}

describe('Admin LeaveRequests half-day badge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedHrGetLeaveRequests.mockResolvedValue([
      {
        requestId: 'req-1',
        employeeId: 'emp-1',
        employeeName: 'Ahmad Staff',
        department: 'Engineering',
        country: 'Lebanon',
        leaveTypeId: 'lt-1',
        leaveTypeName: 'Annual Leave',
        startDate: '2026-09-10',
        endDate: '2026-09-10',
        requestedDuration: 0.5,
        dayPortion: 'FIRST_HALF',
        currentStatus: 'PENDING',
        canApprove: false,
        canReject: false,
        submittedAt: '2026-09-01T10:00:00.000Z',
      } as any,
    ]);
  });

  it('shows a First Half badge in the table for a half-day request', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/First Half/i)).toBeInTheDocument();
    });
  });
});
