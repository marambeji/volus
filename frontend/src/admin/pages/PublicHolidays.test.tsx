import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import PublicHolidays from './PublicHolidays';
import { getCountries } from '../../services/countriesApi';
import { getHolidays } from '../../services/holidaysApi';

vi.mock('../../services/countriesApi', () => ({
  getCountries: vi.fn(),
}));

vi.mock('../../services/holidaysApi', () => ({
  getHolidays: vi.fn(),
  createHoliday: vi.fn(),
  updateHoliday: vi.fn(),
  deleteHoliday: vi.fn(),
}));

const mockedGetCountries = vi.mocked(getCountries);
const mockedGetHolidays = vi.mocked(getHolidays);

describe('PublicHolidays Admin Page Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetCountries.mockResolvedValue([
      { id: 'c-1', name: 'Lebanon', code: 'LB', flag: '🇱🇧' },
    ]);
    mockedGetHolidays.mockResolvedValue([
      { id: 'h-1', name: 'New Year Day', date: '2026-01-01', countryId: 'c-1', countryName: 'Lebanon', countryFlag: '🇱🇧', recurring: true, isObserved: true },
    ] as any);
  });

  it('renders holidays list and configuration controls', async () => {
    await act(async () => {
      render(<PublicHolidays />);
    });

    expect(screen.getByText(/New Year Day/i)).toBeInTheDocument();
  });
});
