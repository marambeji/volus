import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import NotificationManager from './NotificationManager';
import { getReminderSettings, getReminderHistory } from '../../services/remindersApi';

vi.mock('../../services/remindersApi', () => ({
  getReminderSettings: vi.fn(),
  updateReminderSettings: vi.fn(),
  getReminderHistory: vi.fn(),
  runReminderCheckNow: vi.fn(),
}));

const mockedGetSettings = vi.mocked(getReminderSettings);
const mockedGetHistory = vi.mocked(getReminderHistory);

describe('NotificationManager Admin Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetSettings.mockResolvedValue({
      id: 's-1',
      enabled: true,
      delayHours: 48,
      updatedAt: '2026-08-01T00:00:00.000Z',
    });
    mockedGetHistory.mockResolvedValue([
      {
        id: 'n-1',
        approvalInstanceId: 'ai-1',
        requestId: 'req-1',
        approverId: 'mgr-1',
        approverEmail: 'maram@volus.app',
        sentAt: '2026-08-10T09:00:00.000Z',
        approver: { fullName: 'Maram Beji' },
        request: {
          employee: { fullName: 'Salim' },
          leaveType: { label: 'Annual Leave' },
          startDate: '2026-08-01',
          endDate: '2026-08-05',
        },
      },
    ]);
  });

  it('renders reminder settings and sent-reminder history', async () => {
    await act(async () => {
      render(<NotificationManager />);
    });

    expect(screen.getByText('Notification Manager')).toBeInTheDocument();
    expect(screen.getByText('Enabled')).toBeInTheDocument();
    expect(screen.getAllByText('48h').length).toBeGreaterThan(0);
    expect(screen.getByText('Salim')).toBeInTheDocument();
    expect(screen.getByText('Maram Beji')).toBeInTheDocument();
  });

  it('shows an empty state when no reminders have been sent', async () => {
    mockedGetHistory.mockResolvedValue([]);

    await act(async () => {
      render(<NotificationManager />);
    });

    expect(screen.getByText('No reminders sent yet')).toBeInTheDocument();
  });
});
