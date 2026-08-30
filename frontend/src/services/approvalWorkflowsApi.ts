import { apiFetch } from './apiClient';
import type { PaginatedResponse } from './apiClient';
import {
  frontendWorkflowToCreateDto,
  frontendWorkflowToUpdateDto,
  workflowResponseToFrontendWorkflow,
} from './mappers/workflowMapper';
import type { BackendWorkflowResponse } from './mappers/workflowMapper';
import type { ApprovalConfiguration } from '../admin/types/adminTypes';

export async function getApprovalWorkflows(
  signal?: AbortSignal,
  limit = 100
): Promise<ApprovalConfiguration[]> {
  const res = await apiFetch<PaginatedResponse<BackendWorkflowResponse>>(
    `/approval-workflows?limit=${limit}`,
    { signal }
  );
  return (res.data || []).map(workflowResponseToFrontendWorkflow);
}

export async function getApprovalWorkflowById(
  id: string,
  signal?: AbortSignal
): Promise<ApprovalConfiguration> {
  const res = await apiFetch<BackendWorkflowResponse>(
    `/approval-workflows/${id}`,
    { signal }
  );
  return workflowResponseToFrontendWorkflow(res);
}

export async function createApprovalWorkflow(
  config: ApprovalConfiguration
): Promise<ApprovalConfiguration> {
  const payload = frontendWorkflowToCreateDto(config);
  const res = await apiFetch<BackendWorkflowResponse>('/approval-workflows', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return workflowResponseToFrontendWorkflow(res);
}

export async function updateApprovalWorkflow(
  id: string,
  config: ApprovalConfiguration
): Promise<ApprovalConfiguration> {
  const payload = frontendWorkflowToUpdateDto(config);
  const res = await apiFetch<BackendWorkflowResponse>(
    `/approval-workflows/${id}`,
    {
      method: 'PUT',
      body: JSON.stringify(payload),
    }
  );
  return workflowResponseToFrontendWorkflow(res);
}

export async function deleteApprovalWorkflow(id: string): Promise<void> {
  await apiFetch<void>(`/approval-workflows/${id}`, {
    method: 'DELETE',
  });
}
