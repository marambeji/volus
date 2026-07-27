import { apiFetch } from './apiClient';
import type { PaginatedResponse } from './apiClient';
import {
  frontendPolicyToCreateDto,
  frontendPolicyToUpdateDto,
  policyResponseToFrontendPolicy,
} from './mappers/policyMapper';
import type { BackendPolicyResponse } from './mappers/policyMapper';
import type { CountryPolicy } from '../admin/types/adminTypes';

export async function getPolicies(
  signal?: AbortSignal,
  limit = 100
): Promise<CountryPolicy[]> {
  const res = await apiFetch<PaginatedResponse<BackendPolicyResponse>>(
    `/policies?limit=${limit}`,
    { signal }
  );

  const summaries = res.data || [];

  const fullPolicies = await Promise.all(
    summaries.map(async (summary) => {
      try {
        return await getPolicyById(summary.id, signal);
      } catch {
        return policyResponseToFrontendPolicy(summary);
      }
    })
  );

  return fullPolicies;
}

export async function getPolicyById(
  id: string,
  signal?: AbortSignal
): Promise<CountryPolicy> {
  const res = await apiFetch<BackendPolicyResponse>(`/policies/${id}`, {
    signal,
  });
  return policyResponseToFrontendPolicy(res);
}

export async function createPolicy(
  policy: Partial<CountryPolicy>
): Promise<CountryPolicy> {
  const payload = frontendPolicyToCreateDto(policy);
  const res = await apiFetch<BackendPolicyResponse>('/policies', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  if (res.id) {
    try {
      return await getPolicyById(res.id);
    } catch {
      return policyResponseToFrontendPolicy(res);
    }
  }
  return policyResponseToFrontendPolicy(res);
}

export async function updatePolicy(
  id: string,
  policy: Partial<CountryPolicy>
): Promise<CountryPolicy> {
  const payload = frontendPolicyToUpdateDto(policy);
  const res = await apiFetch<BackendPolicyResponse>(`/policies/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });

  if (res.id) {
    try {
      return await getPolicyById(res.id);
    } catch {
      return policyResponseToFrontendPolicy(res);
    }
  }
  return policyResponseToFrontendPolicy(res);
}

export async function deletePolicy(id: string): Promise<void> {
  await apiFetch<void>(`/policies/${id}`, {
    method: 'DELETE',
  });
}
