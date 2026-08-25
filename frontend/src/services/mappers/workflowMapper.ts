import type { ApprovalConfiguration, ApprovalLevel, ApproverType as FrontendApproverType } from '../../admin/types/adminTypes';

export const BackendApproverType = {
  MANAGER: 'MANAGER',
  MANAGERS_MANAGER: 'MANAGERS_MANAGER',
  SPECIFIC_PERSON: 'SPECIFIC_PERSON',
  HR: 'HR',
} as const;

export type BackendApproverType = (typeof BackendApproverType)[keyof typeof BackendApproverType];

export interface BackendWorkflowStepResponse {
  id: string;
  stepOrder: number;
  approverType: BackendApproverType;
  departmentId?: string | null;
  specificApproverEmployeeId?: string | null;
  specificApproverId: string | null;
  specificApproverEmail: string | null;
  isRequired: boolean;
}

export interface BackendWorkflowResponse {
  id: string;
  name: string;
  description: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  countryId?: string | null;
  leaveTypeId?: string | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  steps: BackendWorkflowStepResponse[];
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateWorkflowDto {
  name: string;
  description?: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  countryId?: string | null;
  leaveTypeId?: string | null;
  effectiveFrom: string;
  effectiveTo?: string | null;
  steps: {
    stepOrder: number;
    approverType: BackendApproverType;
    departmentId?: string | null;
    specificApproverEmployeeId?: string | null;
    specificApproverId?: string | null;
    specificApproverEmail?: string | null;
    isRequired: boolean;
  }[];
}

export interface UpdateWorkflowDto {
  name?: string;
  description?: string | null;
  status?: 'ACTIVE' | 'INACTIVE';
  countryId?: string | null;
  leaveTypeId?: string | null;
  effectiveFrom?: string;
  effectiveTo?: string | null;
  steps?: {
    stepOrder: number;
    approverType: BackendApproverType;
    departmentId?: string | null;
    specificApproverEmployeeId?: string | null;
    specificApproverId?: string | null;
    specificApproverEmail?: string | null;
    isRequired: boolean;
  }[];
}

export function mapFrontendApproverTypeToBackend(type: FrontendApproverType): BackendApproverType {
  switch (type) {
    case 'manager':
      return BackendApproverType.MANAGER;
    case 'manager_manager':
      return BackendApproverType.MANAGERS_MANAGER;
    case 'specific_employee':
      return BackendApproverType.SPECIFIC_PERSON;
    case 'hr':
      return BackendApproverType.HR;
    default:
      return BackendApproverType.MANAGER;
  }
}

export function mapBackendApproverTypeToFrontend(type: BackendApproverType): FrontendApproverType {
  switch (type) {
    case BackendApproverType.MANAGER:
      return 'manager';
    case BackendApproverType.MANAGERS_MANAGER:
      return 'manager_manager';
    case BackendApproverType.SPECIFIC_PERSON:
      return 'specific_employee';
    case BackendApproverType.HR:
      return 'hr';
    default:
      return 'manager';
  }
}

export function frontendWorkflowToCreateDto(config: ApprovalConfiguration): CreateWorkflowDto {
  const todayStr = new Date().toISOString().split('T')[0];
  return {
    name: config.name.trim(),
    description: config.description?.trim() || null,
    status: config.status || 'ACTIVE',
    countryId: config.countryId || null,
    leaveTypeId: config.leaveTypeId || null,
    effectiveFrom: config.effectiveFrom || todayStr,
    effectiveTo: config.effectiveTo || null,
    steps: config.levels.map((lvl, idx) => {
      const isSpecific = lvl.type === 'specific_employee' || (lvl.type as string) === 'SPECIFIC_PERSON';
      const emailVal = isSpecific && lvl.specificEmployeeEmail?.trim() ? lvl.specificEmployeeEmail.trim() : null;
      const deptId = isSpecific && lvl.departmentId ? lvl.departmentId : null;
      const empId = isSpecific && lvl.specificApproverEmployeeId ? lvl.specificApproverEmployeeId : null;
      return {
        stepOrder: idx + 1,
        approverType: mapFrontendApproverTypeToBackend(lvl.type),
        departmentId: isSpecific ? deptId : null,
        specificApproverEmployeeId: isSpecific ? empId : null,
        specificApproverId: isSpecific ? empId : null,
        specificApproverEmail: isSpecific ? emailVal : null,
        isRequired: true,
      };
    }),
  };
}

export function frontendWorkflowToUpdateDto(config: ApprovalConfiguration): UpdateWorkflowDto {
  return frontendWorkflowToCreateDto(config);
}

export function workflowResponseToFrontendWorkflow(res: BackendWorkflowResponse): ApprovalConfiguration {
  const sortedSteps = [...(res.steps || [])].sort((a, b) => a.stepOrder - b.stepOrder);
  const levels: ApprovalLevel[] = sortedSteps.map((s) => ({
    type: mapBackendApproverTypeToFrontend(s.approverType),
    departmentId: s.departmentId || undefined,
    specificApproverEmployeeId: s.specificApproverEmployeeId || s.specificApproverId || undefined,
    specificEmployeeEmail: s.specificApproverEmail || '',
  }));

  return {
    id: res.id,
    name: res.name,
    levelsCount: levels.length,
    levels: levels.length > 0 ? levels : [{ type: 'manager' }],
    description: res.description || undefined,
    countryId: res.countryId,
    leaveTypeId: res.leaveTypeId,
    effectiveFrom: res.effectiveFrom ? res.effectiveFrom.split('T')[0] : undefined,
    effectiveTo: res.effectiveTo ? res.effectiveTo.split('T')[0] : undefined,
    status: res.status,
    createdAt: res.createdAt ? res.createdAt.split('T')[0] : new Date().toISOString().split('T')[0],
  };
}
