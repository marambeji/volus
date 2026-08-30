export const HR_MODULES = [
  'employees',
  'departments',
  'leaveRequests',
  'leaveBalances',
  'accrualHistory',
  'leavePolicies',
  'countries',
  'publicHolidays',
  'approvalLevels',
  'notificationManager',
  'reports',
  'auditLog',
  'notifications',
] as const;

export type HrModule = (typeof HR_MODULES)[number];

export interface HrModulePermission {
  canView: boolean;
  canManage: boolean;
}

export type HrPermissionMap = Record<HrModule, HrModulePermission>;

export const FULL_HR_PERMISSIONS: HrPermissionMap = HR_MODULES.reduce(
  (acc, module) => {
    acc[module] = { canView: true, canManage: true };
    return acc;
  },
  {} as HrPermissionMap,
);
