import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import Reports from './Reports';
import { getRequestsReport, getBalancesReport, getOverlapsReport } from '../services/reportsApi';
import { getLeaveTypes } from '../services/leaveTypesApi';

vi.mock('../services/reportsApi', () => ({
  getRequestsReport: vi.fn(),
  getBalancesReport: vi.fn(),
  getOverlapsReport: vi.fn(),
}));

vi.mock('../services/leaveTypesApi', () => ({
  getLeaveTypes: vi.fn(),
}));

const mockedGetRequests = vi.mocked(getRequestsReport);
const mockedGetBalances = vi.mocked(getBalancesReport);
const mockedGetOverlaps = vi.mocked(getOverlapsReport);
const mockedGetLeaveTypes = vi.mocked(getLeaveTypes);

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.setItem(
    'currentUser',
    JSON.stringify({ id: 'mgr-1', name: 'Maram Manager', role: 'manager' })
  );
  mockedGetLeaveTypes.mockResolvedValue([
    { id: 'lt-1', key: 'annual', label: 'Annual Leave', defaultDaysPerYear: 25, isPaid: true, requiresAttachment: false },
  ]);
  mockedGetBalances.mockResolvedValue([
    {
      employeeId: 'emp-1',
      employeeName: 'Salim Employee',
      department: 'Engineering',
      country: 'Lebanon',
      balances: { annual: { entitlement: 25, used: 10, available: 15 } },
      totalAvailable: 15,
    },
  ]);
  mockedGetRequests.mockResolvedValue([
    {
      id: 'req-1',
      employeeId: 'emp-1',
      employeeName: 'Salim Employee',
      department: 'Engineering',
      country: 'Lebanon',
      leaveTypeId: 'lt-1',
      leaveTypeName: 'Annual Leave',
      startDate: '2026-08-10',
      endDate: '2026-08-15',
      durationDays: 5,
      status: 'APPROVED',
      createdAt: '2026-08-01',
    },
  ]);
  mockedGetOverlaps.mockResolvedValue({
    clusters: [],
    dailyCounts: [],
    peakConcurrent: 0,
    totalOverlapDays: 0,
  });
});

describe('Reports page — Executive HR PDF Report integration', () => {
  it('fetches complete datasets and renders team report dashboard', async () => {
    await act(async () => {
      render(<Reports />);
    });

    expect(mockedGetBalances).toHaveBeenCalled();
    expect(mockedGetRequests).toHaveBeenCalled();
    expect(mockedGetOverlaps).toHaveBeenCalled();

    expect(screen.getByText('Team Reports')).toBeInTheDocument();
    expect(screen.getByText('Print / Save PDF')).toBeInTheDocument();
    expect(screen.getByText('Export CSV')).toBeInTheDocument();
  });

  it('renders official corporate PDF report document in print container', async () => {
    await act(async () => {
      render(<Reports />);
    });

    expect(screen.getByText(/Rapport Officiel de Gestion des Congés/i)).toBeInTheDocument();
    expect(screen.getByText(/DOCUMENT INTERNE ET CONFIDENTIEL/i)).toBeInTheDocument();
    expect(screen.getByText(/Synthèse Exécutive et Analyse Managériale/i)).toBeInTheDocument();
  });
});
