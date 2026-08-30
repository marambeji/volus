import { apiFetch } from './apiClient';
import type { PaginatedResponse } from './apiClient';

export interface CountryItem {
  id: string;
  name: string;
  code: string;
  flag: string;
}

export interface CountryPayload {
  name: string;
  code: string;
  flag?: string;
}

export async function getCountries(
  signal?: AbortSignal,
  limit = 100
): Promise<CountryItem[]> {
  const res = await apiFetch<PaginatedResponse<CountryItem>>(
    `/countries?limit=${limit}`,
    { signal }
  );
  return res.data;
}

export async function createCountry(payload: CountryPayload): Promise<CountryItem> {
  return apiFetch<CountryItem>('/countries', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateCountry(id: string, payload: Partial<CountryPayload>): Promise<CountryItem> {
  return apiFetch<CountryItem>(`/countries/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function deleteCountry(id: string): Promise<void> {
  return apiFetch<void>(`/countries/${id}`, { method: 'DELETE' });
}
