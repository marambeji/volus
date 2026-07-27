import { apiFetch } from './apiClient';
import type { CountryItem } from './countriesApi';
import {
  frontendHolidayToCreateDto,
  frontendHolidayToUpdateDto,
  holidayResponseToFrontendHoliday,
} from './mappers/holidayMapper';
import type { BackendHolidayResponse, FrontendHoliday } from './mappers/holidayMapper';

export async function getHolidays(
  countryId?: string,
  year?: string,
  countries: CountryItem[] = [],
  signal?: AbortSignal
): Promise<FrontendHoliday[]> {
  const params = new URLSearchParams();
  if (countryId) params.append('countryId', countryId);
  if (year) params.append('year', year);

  const queryStr = params.toString() ? `?${params.toString()}` : '';
  const res = await apiFetch<BackendHolidayResponse[] | { data: BackendHolidayResponse[] }>(
    `/holidays${queryStr}`,
    { signal }
  );

  const rawList = Array.isArray(res) ? res : res.data || [];
  return rawList.map((h) => holidayResponseToFrontendHoliday(h, countries));
}

export async function createHoliday(
  form: { name: string; date: string; countryId: string; recurring: boolean },
  countries: CountryItem[] = []
): Promise<FrontendHoliday> {
  const payload = frontendHolidayToCreateDto(form);
  const res = await apiFetch<BackendHolidayResponse>('/holidays', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return holidayResponseToFrontendHoliday(res, countries);
}

export async function updateHoliday(
  id: string,
  form: { name?: string; date?: string; countryId?: string; recurring?: boolean },
  countries: CountryItem[] = []
): Promise<FrontendHoliday> {
  const payload = frontendHolidayToUpdateDto(form);
  const res = await apiFetch<BackendHolidayResponse>(`/holidays/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  return holidayResponseToFrontendHoliday(res, countries);
}

export async function deleteHoliday(id: string): Promise<void> {
  await apiFetch<void>(`/holidays/${id}`, {
    method: 'DELETE',
  });
}
