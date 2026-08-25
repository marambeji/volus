import type { BackendEmployee } from '../employeesApi';
import type { AdminEmployee } from '../../admin/types/adminTypes';

export function toAdminEmployee(backend: BackendEmployee): AdminEmployee {
  // Map backend status to frontend expected lowercase statuses
  let status: AdminEmployee['status'] = 'active';
  if (backend.status === 'INACTIVE') status = 'inactive';
  if (backend.status === 'ARCHIVED') status = 'archived';

  // Map backend role to frontend readable role
  let role = 'Employee';
  if (backend.role === 'HR_ADMIN') role = 'HR Admin';
  if (backend.role === 'MANAGER') role = 'Manager';

  // Map working schedule: check if remote or part time, else full time
  let workingSchedule: AdminEmployee['workingSchedule'] = 'full_time';
  if (backend.workMode === 'REMOTE') {
    workingSchedule = 'remote';
  } else if (backend.employmentType === 'PART_TIME') {
    workingSchedule = 'part_time';
  }

  return {
    id: backend.id,
    name: backend.fullName,
    email: backend.email,
    phone: backend.phone ?? undefined,
    avatar: backend.avatar ?? undefined,
    position: backend.jobTitle,
    department: backend.department,
    unit: backend.unit ?? '',
    managerId: backend.managerId ?? undefined,
    country: backend.country || 'Supprimé',
    countryCode: backend.countryCode || '',
    hireDate: backend.hireDate,
    gender: backend.gender === 'MALE' ? 'male' : backend.gender === 'FEMALE' ? 'female' : undefined,
    status,
    workingSchedule,
    emergencyContacts: backend.emergencyContacts ?? [],
    policyId: backend.policyId || '',
    role,
    division: backend.division || '',
    approvalLevelId: backend.approvalWorkflowId || 'app-1',
  };
}

export function toBackendEmployeePayload(admin: Omit<AdminEmployee, 'id'>) {
  // Map status back to uppercase
  let status = 'ACTIVE';

  if (admin.status === 'inactive') status = 'INACTIVE';
  if (admin.status === 'archived') status = 'ARCHIVED';

  // Map role back to uppercase enum
  let role = 'EMPLOYEE';
  if (admin.role === 'HR Admin') role = 'HR_ADMIN';
  if (admin.role === 'Manager') role = 'MANAGER';

  // Map working schedule back to employmentType / workMode
  let employmentType = 'FULL_TIME';
  let workMode = 'ONSITE';
  if (admin.workingSchedule === 'part_time') {
    employmentType = 'PART_TIME';
  } else if (admin.workingSchedule === 'remote') {
    workMode = 'REMOTE';
  }

  const payload: any = {
    fullName: admin.name,
    email: admin.email,
    phone: admin.phone || null,
    avatar: admin.avatar || null,
    jobTitle: admin.position,
    department: admin.department,
    unit: admin.unit || null,
    managerId: admin.managerId || null,
    // Only send countryCode when the country is valid (not deleted / empty).
    // Sending an empty or 'Supprimé' code would cause a backend validation error.
    countryCode: (admin.countryCode && admin.country !== 'Supprimé') ? admin.countryCode : undefined,
    hireDate: admin.hireDate,
    gender: admin.gender === 'male' ? 'MALE' : admin.gender === 'female' ? 'FEMALE' : null,
    employmentType,
    workMode,
    role,
    emergencyContacts: admin.emergencyContacts || [],
    divisionId: null,
    approvalWorkflowId: null,
    status,
  };

  // Always send policyId (null for "No Policy Assigned") so the backend can
  // tell "explicitly cleared" apart from "field not touched" — omitting it
  // when empty silently kept the previous policy assigned.
  payload.policyId = admin.policyId || null;

  return payload;
}
