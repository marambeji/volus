import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MyInfo from './MyInfo';
import { apiFetch } from '../services/apiClient';

vi.mock('../services/apiClient', () => ({
  apiFetch: vi.fn(),
}));

const mockedApiFetch = vi.mocked(apiFetch);

const baseRequest = {
  id: 'req-1',
  leaveType: { key: 'annual', label: 'Annual Leave' },
  leaveTypeId: 'lt-1',
  startDate: '2026-12-16',
  endDate: '2026-12-20',
  reason: 'Family trip',
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z',
  approvalInstances: [],
  durationDays: 5,
  status: 'pending',
};

function mockApi(requests: any[]) {
  mockedApiFetch.mockImplementation((endpoint: string) => {
    if (endpoint.startsWith('/leave-requests/my-requests')) return Promise.resolve(requests);
    if (endpoint.startsWith('/employees/me/leave-balances')) return Promise.resolve({ balances: [] });
    if (endpoint.startsWith('/employees/me')) return Promise.resolve({ id: 'emp-1', fullName: 'Test User' });
    if (endpoint.startsWith('/leave-balances/ledger')) return Promise.resolve({ data: [] });
    if (endpoint.startsWith('/leave-types')) return Promise.resolve([]);
    if (endpoint.includes('/cancel')) return Promise.resolve({ ...requests[0], status: 'CANCELLED' });
    return Promise.resolve(null);
  });
}

async function renderMyInfo() {
  await act(async () => {
    render(<MyInfo />);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.setItem('currentUser', JSON.stringify({ id: 'emp-1' }));
});

describe('MyInfo — leave request cancellation', () => {
  it('shows the Cancel action for a PENDING request', async () => {
    mockApi([{ ...baseRequest, status: 'pending' }]);
    await renderMyInfo();

    expect(screen.getByTitle('Cancel request')).toBeInTheDocument();
  });

  it('hides the Cancel action for an APPROVED request', async () => {
    mockApi([{ ...baseRequest, status: 'approved' }]);
    await renderMyInfo();

    expect(screen.getByText('Approved')).toBeInTheDocument();
    expect(screen.queryByTitle('Cancel request')).not.toBeInTheDocument();
  });

  it('hides the Cancel action for a REJECTED request', async () => {
    mockApi([{ ...baseRequest, status: 'rejected' }]);
    await renderMyInfo();

    expect(screen.getByText('Rejected')).toBeInTheDocument();
    expect(screen.queryByTitle('Cancel request')).not.toBeInTheDocument();
  });

  it('hides the Cancel action for an already-CANCELLED request', async () => {
    mockApi([{ ...baseRequest, status: 'cancelled' }]);
    await renderMyInfo();

    expect(screen.getByText('Cancelled')).toBeInTheDocument();
    expect(screen.queryByTitle('Cancel request')).not.toBeInTheDocument();
  });

  it('opens a confirmation dialog and only calls the cancel API after confirming', async () => {
    const user = userEvent.setup();
    mockApi([{ ...baseRequest, status: 'pending' }]);
    await renderMyInfo();

    await user.click(screen.getByTitle('Cancel request'));

    expect(screen.getByText('Cancel Leave Request')).toBeInTheDocument();
    expect(mockedApiFetch).not.toHaveBeenCalledWith(
      expect.stringContaining('/cancel'),
      expect.anything(),
    );

    await user.click(screen.getByRole('button', { name: 'Cancel Request' }));

    await waitFor(() => {
      expect(mockedApiFetch).toHaveBeenCalledWith('/leave-requests/req-1/cancel', { method: 'PATCH' });
    });
  });

  it('disables the row action while a cancellation is in flight and prevents a second submission', async () => {
    const user = userEvent.setup();

    let resolveCancel: (v: any) => void;
    mockedApiFetch.mockImplementation((endpoint: string) => {
      if (endpoint.includes('/cancel')) {
        return new Promise((resolve) => { resolveCancel = resolve; });
      }
      if (endpoint.startsWith('/leave-requests/my-requests')) return Promise.resolve([{ ...baseRequest, status: 'pending' }]);
      if (endpoint.startsWith('/employees/me/leave-balances')) return Promise.resolve({ balances: [] });
      if (endpoint.startsWith('/employees/me')) return Promise.resolve({ id: 'emp-1', fullName: 'Test User' });
      if (endpoint.startsWith('/leave-balances/ledger')) return Promise.resolve({ data: [] });
      if (endpoint.startsWith('/leave-types')) return Promise.resolve([]);
      return Promise.resolve(null);
    });

    await renderMyInfo();
    await user.click(screen.getByTitle('Cancel request'));
    await user.click(screen.getByRole('button', { name: 'Cancel Request' }));

    await waitFor(() => {
      expect(screen.getByTitle('Cancel request')).toBeDisabled();
    });

    const cancelCalls = mockedApiFetch.mock.calls.filter((c) => String(c[0]).includes('/cancel'));
    expect(cancelCalls).toHaveLength(1);

    await act(async () => {
      resolveCancel!({ status: 'cancelled' });
    });
  });

  it('refreshes request data after a successful cancellation', async () => {
    const user = userEvent.setup();
    mockApi([{ ...baseRequest, status: 'pending' }]);
    await renderMyInfo();

    const callsBefore = mockedApiFetch.mock.calls.filter((c) => String(c[0]).startsWith('/leave-requests/my-requests')).length;

    await user.click(screen.getByTitle('Cancel request'));
    await user.click(screen.getByRole('button', { name: 'Cancel Request' }));

    await waitFor(() => {
      const callsAfter = mockedApiFetch.mock.calls.filter((c) => String(c[0]).startsWith('/leave-requests/my-requests')).length;
      expect(callsAfter).toBeGreaterThan(callsBefore);
    });
  });
});
