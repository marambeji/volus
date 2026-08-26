import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RequestModal from './RequestModal';
import { getMyLeaveBalances, submitLeaveRequest, getMyLeaveRequests, getEmployees } from '../../services/employeesApi';
import { getLeaveTypes } from '../../services/leaveTypesApi';
import { getHolidays } from '../../services/holidaysApi';

vi.mock('../../services/employeesApi', () => ({
  getMyLeaveBalances: vi.fn(),
  submitLeaveRequest: vi.fn(),
  getMyLeaveRequests: vi.fn(),
  getEmployees: vi.fn(),
}));
vi.mock('../../services/leaveTypesApi', () => ({
  getLeaveTypes: vi.fn(),
}));
vi.mock('../../services/holidaysApi', () => ({
  getHolidays: vi.fn(),
}));

const mockedGetMyLeaveBalances = vi.mocked(getMyLeaveBalances);
const mockedSubmitLeaveRequest = vi.mocked(submitLeaveRequest);
const mockedGetMyLeaveRequests = vi.mocked(getMyLeaveRequests);
const mockedGetEmployees = vi.mocked(getEmployees);
const mockedGetLeaveTypes = vi.mocked(getLeaveTypes);
const mockedGetHolidays = vi.mocked(getHolidays);

describe('RequestModal half-day portion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('currentUser', JSON.stringify({ id: 'emp-1' }));

    mockedGetMyLeaveBalances.mockResolvedValue({
      countryId: 'c-1',
      balances: [
        {
          leaveTypeId: 'lt-annual',
          code: 'ANNUAL',
          name: 'Annual Leave',
          availableBalance: 20,
          usageYtd: 0,
          trackingMode: 'AVAILABLE_BALANCE',
          allowsHalfDay: true,
          requiresNote: false,
          requiresPositiveBalance: true,
          eligible: true,
        },
      ],
    });
    mockedGetLeaveTypes.mockResolvedValue([{ id: 'lt-annual', key: 'annual', label: 'Annual Leave', trackingMode: 'AVAILABLE_BALANCE' } as any]);
    mockedGetMyLeaveRequests.mockResolvedValue([]);
    mockedGetHolidays.mockResolvedValue([]);
    mockedGetEmployees.mockResolvedValue([{ id: 'emp-1', countryId: 'c-1', countryCode: 'LB', country: 'Lebanon', gender: 'MALE' } as any]);
    mockedSubmitLeaveRequest.mockResolvedValue({});
  });

  it('shows First/Second Half options only once a single day is set to 0.5, and submits the chosen portion', async () => {
    const user = userEvent.setup();
    const { container } = render(<RequestModal isOpen={true} onClose={() => {}} />);

    await waitFor(() => {
      expect(container.querySelectorAll('input[type="date"]').length).toBe(2);
    });

    // Native date inputs: set via fireEvent.change (userEvent.type does not
    // reliably drive type="date" inputs in jsdom), then wait for the
    // dailyAmounts effect (keyed on [startDate, endDate]) to settle.
    const [fromDate, toDate] = Array.from(container.querySelectorAll('input[type="date"]'));
    fireEvent.change(fromDate, { target: { value: '2026-09-10' } });
    fireEvent.change(toDate, { target: { value: '2026-09-10' } });

    // Half Day option should not surface a portion picker until 0.5 is chosen
    expect(screen.queryByText(/Second Half/i)).not.toBeInTheDocument();

    const amountSelect = await screen.findByDisplayValue('1 (Full Day)');
    await user.selectOptions(amountSelect, '0.5');

    const secondHalfBtn = await screen.findByRole('button', { name: /Second Half/i });
    await user.click(secondHalfBtn);

    await user.type(screen.getByPlaceholderText(/Add any comments/i), 'Doctor appointment');

    const submitBtn = screen.getByRole('button', { name: /Submit Request/i });
    await waitFor(() => expect(submitBtn).not.toBeDisabled());
    await user.click(submitBtn);

    await waitFor(() => {
      expect(mockedSubmitLeaveRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          leaveTypeId: 'lt-annual',
          startDate: '2026-09-10',
          endDate: '2026-09-10',
          durationDays: 0.5,
          dayPortion: 'SECOND_HALF',
        }),
      );
    });
  });
});
