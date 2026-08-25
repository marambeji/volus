import type { CountryItem } from '../countriesApi';

export interface BackendHolidayResponse {
  id: string;
  name: string;
  date: string;
  countryId: string;
  isRecurring: boolean;
  country?: {
    id: string;
    name: string;
    code: string;
    flag: string;
  };
  _projectedYear?: number;
}

export interface CreateHolidayDto {
  name: string;
  date: string;
  countryId: string;
  isRecurring: boolean;
}

export interface UpdateHolidayDto {
  name?: string;
  date?: string;
  countryId?: string;
  isRecurring?: boolean;
}

export interface FrontendHoliday {
  id: string;
  name: string;
  date: string;
  country: string;
  countryCode: string;
  flag: string;
  recurring: boolean;
  countryId: string;
}

export function frontendHolidayToCreateDto(form: {
  name: string;
  date: string;
  countryId: string;
  recurring: boolean;
}): CreateHolidayDto {
  return {
    name: form.name.trim(),
    date: form.date,
    countryId: form.countryId,
    isRecurring: Boolean(form.recurring),
  };
}

export function frontendHolidayToUpdateDto(form: {
  name?: string;
  date?: string;
  countryId?: string;
  recurring?: boolean;
}): UpdateHolidayDto {
  return {
    ...(form.name && { name: form.name.trim() }),
    ...(form.date && { date: form.date }),
    ...(form.countryId && { countryId: form.countryId }),
    ...(form.recurring !== undefined && { isRecurring: Boolean(form.recurring) }),
  };
}

export function holidayResponseToFrontendHoliday(
  res: BackendHolidayResponse,
  countries: CountryItem[] = []
): FrontendHoliday {
  let countryName = 'Unknown';
  let countryCode = 'UN';
  let flag = '🏳️';

  if (res.country) {
    countryName = res.country.name;
    countryCode = res.country.code;
    flag = res.country.flag;
  } else if (res.countryId && countries.length > 0) {
    const found = countries.find((c) => c.id === res.countryId || c.code === res.countryId);
    if (found) {
      countryName = found.name;
      countryCode = found.code;
      flag = found.flag;
    }
  }

  return {
    id: res.id,
    name: res.name,
    date: res.date,
    country: countryName,
    countryCode: countryCode,
    flag: flag,
    recurring: Boolean(res.isRecurring),
    countryId: res.countryId || res.country?.id || '',
  };
}
