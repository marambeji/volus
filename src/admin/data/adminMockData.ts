import type { AdminEmployee, CountryPolicy, AdminLeaveRequest, Department, AuditLogEntry, AdminNotification } from '../types/adminTypes';

// ─── Country Policies ────────────────────────────────────────────────────────
export const countriesPolicies: CountryPolicy[] = [
  {
    id: 'pol-lb',
    policyName: 'Lebanon Standard',
    country: 'Lebanon',
    countryCode: 'LB',
    flag: '🇱🇧',
    weekendDays: [6],        // Saturday only
    workingHoursPerDay: 8,
    approvalWorkflow: 'manager_then_hr',
    createdAt: '2024-01-01',
    updatedAt: '2026-01-01',
    leaveQuotas: [
      { leaveType: 'annual',         entitlementDays: 15, isAccrued: true,  accrualRate: 1.25, carryOverEnabled: true,  maxCarryOver: 5,  maxConsecutive: 15, minNoticeDays: 3  },
      { leaveType: 'sick',           entitlementDays: 10, isAccrued: false, carryOverEnabled: false, maxCarryOver: 0,  maxConsecutive: 10, minNoticeDays: 0  },
      { leaveType: 'bereavement',    entitlementDays: 3,  isAccrued: false, carryOverEnabled: false, maxCarryOver: 0,  maxConsecutive: 3,  minNoticeDays: 0  },
      { leaveType: 'wedding',        entitlementDays: 5,  isAccrued: false, carryOverEnabled: false, maxCarryOver: 0,  maxConsecutive: 5,  minNoticeDays: 14 },
      { leaveType: 'paternity',      entitlementDays: 3,  isAccrued: false, carryOverEnabled: false, maxCarryOver: 0,  maxConsecutive: 3,  minNoticeDays: 7  },
      { leaveType: 'maternity',      entitlementDays: 49, isAccrued: false, carryOverEnabled: false, maxCarryOver: 0,  maxConsecutive: 49, minNoticeDays: 30 },
      { leaveType: 'public_holiday', entitlementDays: 10, isAccrued: true,  accrualRate: 0,   carryOverEnabled: false, maxCarryOver: 0,  maxConsecutive: 1,  minNoticeDays: 0  },
      { leaveType: 'compensation',   entitlementDays: 5,  isAccrued: true,  accrualRate: 0,   carryOverEnabled: true,  maxCarryOver: 3,  maxConsecutive: 5,  minNoticeDays: 1  },
      { leaveType: 'unpaid',         entitlementDays: 30, isAccrued: false, carryOverEnabled: false, maxCarryOver: 0,  maxConsecutive: 30, minNoticeDays: 7  },
      { leaveType: 'overtime',       entitlementDays: 10, isAccrued: true,  accrualRate: 0,   carryOverEnabled: true,  maxCarryOver: 5,  maxConsecutive: 5,  minNoticeDays: 1  },
    ],
  },
  {
    id: 'pol-tn',
    policyName: 'Tunisia Standard',
    country: 'Tunisia',
    countryCode: 'TN',
    flag: '🇹🇳',
    weekendDays: [5, 6],     // Friday + Saturday
    workingHoursPerDay: 8,
    approvalWorkflow: 'manager_then_hr',
    createdAt: '2024-01-01',
    updatedAt: '2026-01-01',
    leaveQuotas: [
      { leaveType: 'annual',         entitlementDays: 20, isAccrued: true,  accrualRate: 1.67, carryOverEnabled: true,  maxCarryOver: 10, maxConsecutive: 20, minNoticeDays: 3  },
      { leaveType: 'sick',           entitlementDays: 15, isAccrued: false, carryOverEnabled: false, maxCarryOver: 0,  maxConsecutive: 15, minNoticeDays: 0  },
      { leaveType: 'bereavement',    entitlementDays: 5,  isAccrued: false, carryOverEnabled: false, maxCarryOver: 0,  maxConsecutive: 5,  minNoticeDays: 0  },
      { leaveType: 'wedding',        entitlementDays: 7,  isAccrued: false, carryOverEnabled: false, maxCarryOver: 0,  maxConsecutive: 7,  minNoticeDays: 14 },
      { leaveType: 'paternity',      entitlementDays: 2,  isAccrued: false, carryOverEnabled: false, maxCarryOver: 0,  maxConsecutive: 2,  minNoticeDays: 7  },
      { leaveType: 'maternity',      entitlementDays: 60, isAccrued: false, carryOverEnabled: false, maxCarryOver: 0,  maxConsecutive: 60, minNoticeDays: 30 },
      { leaveType: 'public_holiday', entitlementDays: 12, isAccrued: true,  accrualRate: 0,   carryOverEnabled: false, maxCarryOver: 0,  maxConsecutive: 1,  minNoticeDays: 0  },
      { leaveType: 'compensation',   entitlementDays: 5,  isAccrued: true,  accrualRate: 0,   carryOverEnabled: true,  maxCarryOver: 3,  maxConsecutive: 5,  minNoticeDays: 1  },
      { leaveType: 'unpaid',         entitlementDays: 30, isAccrued: false, carryOverEnabled: false, maxCarryOver: 0,  maxConsecutive: 30, minNoticeDays: 7  },
      { leaveType: 'overtime',       entitlementDays: 10, isAccrued: true,  accrualRate: 0,   carryOverEnabled: true,  maxCarryOver: 5,  maxConsecutive: 5,  minNoticeDays: 1  },
    ],
  },
  {
    id: 'pol-fr',
    policyName: 'France Standard',
    country: 'France',
    countryCode: 'FR',
    flag: '🇫🇷',
    weekendDays: [0, 6],     // Saturday + Sunday
    workingHoursPerDay: 7,
    approvalWorkflow: 'manager_only',
    createdAt: '2024-01-01',
    updatedAt: '2026-01-01',
    leaveQuotas: [
      { leaveType: 'annual',         entitlementDays: 25, isAccrued: true,  accrualRate: 2.08, carryOverEnabled: true,  maxCarryOver: 10, maxConsecutive: 20, minNoticeDays: 7  },
      { leaveType: 'sick',           entitlementDays: 20, isAccrued: false, carryOverEnabled: false, maxCarryOver: 0,  maxConsecutive: 20, minNoticeDays: 0  },
      { leaveType: 'bereavement',    entitlementDays: 5,  isAccrued: false, carryOverEnabled: false, maxCarryOver: 0,  maxConsecutive: 5,  minNoticeDays: 0  },
      { leaveType: 'wedding',        entitlementDays: 4,  isAccrued: false, carryOverEnabled: false, maxCarryOver: 0,  maxConsecutive: 4,  minNoticeDays: 14 },
      { leaveType: 'paternity',      entitlementDays: 14, isAccrued: false, carryOverEnabled: false, maxCarryOver: 0,  maxConsecutive: 14, minNoticeDays: 7  },
      { leaveType: 'maternity',      entitlementDays: 112,isAccrued: false, carryOverEnabled: false, maxCarryOver: 0,  maxConsecutive: 112,minNoticeDays: 30 },
      { leaveType: 'public_holiday', entitlementDays: 11, isAccrued: true,  accrualRate: 0,   carryOverEnabled: false, maxCarryOver: 0,  maxConsecutive: 1,  minNoticeDays: 0  },
      { leaveType: 'compensation',   entitlementDays: 10, isAccrued: true,  accrualRate: 0,   carryOverEnabled: true,  maxCarryOver: 5,  maxConsecutive: 5,  minNoticeDays: 1  },
      { leaveType: 'unpaid',         entitlementDays: 30, isAccrued: false, carryOverEnabled: false, maxCarryOver: 0,  maxConsecutive: 30, minNoticeDays: 14 },
      { leaveType: 'overtime',       entitlementDays: 10, isAccrued: true,  accrualRate: 0,   carryOverEnabled: true,  maxCarryOver: 5,  maxConsecutive: 5,  minNoticeDays: 1  },
    ],
  },
  {
    id: 'pol-ae',
    policyName: 'UAE Standard',
    country: 'UAE',
    countryCode: 'AE',
    flag: '🇦🇪',
    weekendDays: [5, 6],
    workingHoursPerDay: 8,
    approvalWorkflow: 'manager_then_hr',
    createdAt: '2024-01-01',
    updatedAt: '2026-01-01',
    leaveQuotas: [
      { leaveType: 'annual',         entitlementDays: 30, isAccrued: true,  accrualRate: 2.5,  carryOverEnabled: true,  maxCarryOver: 15, maxConsecutive: 30, minNoticeDays: 7  },
      { leaveType: 'sick',           entitlementDays: 15, isAccrued: false, carryOverEnabled: false, maxCarryOver: 0,  maxConsecutive: 15, minNoticeDays: 0  },
      { leaveType: 'bereavement',    entitlementDays: 5,  isAccrued: false, carryOverEnabled: false, maxCarryOver: 0,  maxConsecutive: 5,  minNoticeDays: 0  },
      { leaveType: 'wedding',        entitlementDays: 3,  isAccrued: false, carryOverEnabled: false, maxCarryOver: 0,  maxConsecutive: 3,  minNoticeDays: 14 },
      { leaveType: 'paternity',      entitlementDays: 5,  isAccrued: false, carryOverEnabled: false, maxCarryOver: 0,  maxConsecutive: 5,  minNoticeDays: 7  },
      { leaveType: 'maternity',      entitlementDays: 60, isAccrued: false, carryOverEnabled: false, maxCarryOver: 0,  maxConsecutive: 60, minNoticeDays: 30 },
      { leaveType: 'public_holiday', entitlementDays: 14, isAccrued: true,  accrualRate: 0,   carryOverEnabled: false, maxCarryOver: 0,  maxConsecutive: 1,  minNoticeDays: 0  },
      { leaveType: 'compensation',   entitlementDays: 5,  isAccrued: true,  accrualRate: 0,   carryOverEnabled: true,  maxCarryOver: 3,  maxConsecutive: 5,  minNoticeDays: 1  },
      { leaveType: 'unpaid',         entitlementDays: 30, isAccrued: false, carryOverEnabled: false, maxCarryOver: 0,  maxConsecutive: 30, minNoticeDays: 7  },
      { leaveType: 'overtime',       entitlementDays: 10, isAccrued: true,  accrualRate: 0,   carryOverEnabled: true,  maxCarryOver: 5,  maxConsecutive: 5,  minNoticeDays: 1  },
    ],
  },
];

// ─── Employees (Extended) ────────────────────────────────────────────────────
export const adminEmployeesList: AdminEmployee[] = [
  { id: 1,  name: 'Gabriel Habre',     email: 'gabriel.habre@novelus.com',    phone: '+961 3 123 456', position: 'Senior Software Engineer', department: 'Engineering', unit: 'Web Dev',      managerId: 10, country: 'Lebanon',      countryCode: 'LB', hireDate: '2021-03-12', status: 'on_leave',  workingSchedule: 'full_time', policyId: 'pol-lb', emergencyContacts: [{ name: 'Maya Habre',   relationship: 'Spouse',  phone: '+961 3 654 321' }] },
  { id: 2,  name: 'Carla Daghfal',     email: 'carla.daghfal@novelus.com',    phone: '+212 6 111 222', position: 'Growth Marketing Manager',  department: 'Marketing',   unit: 'Growth',       managerId: 1,  country: 'Morocco',      countryCode: 'MA', hireDate: '2022-05-18', status: 'on_leave',  workingSchedule: 'full_time', policyId: 'pol-lb', emergencyContacts: [{ name: 'Jean Daghfal', relationship: 'Father',  phone: '+212 6 333 444' }] },
  { id: 3,  name: 'Anabel Masco',      email: 'anabel.masco@novelus.com',     phone: '+1 416 555 100', position: 'HR Recruiter',             department: 'HR',          unit: 'Recruitment',  managerId: 10, country: 'Canada',       countryCode: 'CA', hireDate: '2020-11-01', status: 'active',    workingSchedule: 'remote',    policyId: 'pol-fr', emergencyContacts: [{ name: 'Tom Masco',    relationship: 'Brother', phone: '+1 416 555 200' }] },
  { id: 4,  name: 'Elias Ghali',       email: 'elias.ghali@novelus.com',      phone: '+961 1 234 567', position: 'Accountant',               department: 'Finance',     unit: 'Accounting',   managerId: 1,  country: 'Lebanon',      countryCode: 'LB', hireDate: '2023-01-15', status: 'on_leave',  workingSchedule: 'full_time', policyId: 'pol-lb', emergencyContacts: [] },
  { id: 5,  name: 'Etienne Khoueiry',  email: 'etienne.khoueiry@novelus.com', phone: '+20 10 555 666', position: 'Enterprise Account Exec',   department: 'Sales',       unit: 'Enterprise',   managerId: 1,  country: 'Egypt',        countryCode: 'EG', hireDate: '2021-09-01', status: 'on_leave',  workingSchedule: 'full_time', policyId: 'pol-lb', emergencyContacts: [] },
  { id: 6,  name: 'Saad AlMutairi',    email: 'saad.almutairi@novelus.com',   phone: '+966 5 777 888', position: 'Logistics Manager',         department: 'Operations',  unit: 'Logistics',    managerId: 10, country: 'Saudi Arabia', countryCode: 'SA', hireDate: '2022-07-20', status: 'on_leave',  workingSchedule: 'full_time', policyId: 'pol-ae', emergencyContacts: [] },
  { id: 7,  name: 'Marie Dupont',      email: 'marie.dupont@novelus.com',     phone: '+33 6 123 456',  position: 'Legal Compliance Officer',  department: 'Legal',       unit: 'Compliance',   managerId: 10, country: 'France',       countryCode: 'FR', hireDate: '2023-06-10', status: 'on_leave',  workingSchedule: 'full_time', policyId: 'pol-fr', emergencyContacts: [{ name: 'Luc Dupont',   relationship: 'Father',  phone: '+33 6 654 321' }] },
  { id: 8,  name: 'Omar Benzara',      email: 'omar.benzara@novelus.com',     phone: '+213 5 999 000', position: 'Full Stack Developer',      department: 'Engineering', unit: 'Web Dev',      managerId: 1,  country: 'Algeria',      countryCode: 'DZ', hireDate: '2022-04-14', status: 'on_leave',  workingSchedule: 'remote',    policyId: 'pol-tn', emergencyContacts: [] },
  { id: 9,  name: 'Laura Sanchez',     email: 'laura.sanchez@novelus.com',    phone: '+34 6 111 222',  position: 'UI/UX Designer',           department: 'Design',      unit: 'UI/UX',        managerId: 1,  country: 'Spain',        countryCode: 'ES', hireDate: '2024-02-01', status: 'on_leave',  workingSchedule: 'full_time', policyId: 'pol-fr', emergencyContacts: [] },
  { id: 10, name: 'Riad Mansour',      email: 'riad.mansour@novelus.com',     phone: '+971 5 222 333', position: 'CEO',                      department: 'Executive',   unit: 'HQ',           managerId: undefined, country: 'UAE', countryCode: 'AE', hireDate: '2018-01-01', status: 'active',    workingSchedule: 'full_time', policyId: 'pol-ae', emergencyContacts: [] },
  { id: 11, name: 'Mazen Bou Monsef',  email: 'mazen.monsef@novelus.com',     phone: '+961 3 444 555', position: 'Software Engineer',        department: 'Engineering', unit: 'Web Dev',      managerId: 1,  country: 'Lebanon',      countryCode: 'LB', hireDate: '2023-08-11', status: 'active',    workingSchedule: 'full_time', policyId: 'pol-lb', emergencyContacts: [] },
  { id: 12, name: 'Gabriel Marchetti', email: 'gabriel.marchetti@novelus.com',phone: '+54 9 555 666',  position: 'Product Designer',         department: 'Design',      unit: 'UI/UX',        managerId: 10, country: 'Argentina',    countryCode: 'AR', hireDate: '2021-12-05', status: 'active',    workingSchedule: 'remote',    policyId: 'pol-fr', emergencyContacts: [] },
];

// ─── Departments ─────────────────────────────────────────────────────────────
export const adminDepartments: Department[] = [
  { id: 1, name: 'Engineering', headId: 1,  color: '#3B82F6', teams: [{ id: 1, name: 'Web Dev',     managerId: 1,  memberIds: [1, 8, 11] }] },
  { id: 2, name: 'Marketing',   headId: 2,  color: '#EC4899', teams: [{ id: 2, name: 'Growth',       managerId: 2,  memberIds: [2] }] },
  { id: 3, name: 'HR',          headId: 3,  color: '#8B5CF6', teams: [{ id: 3, name: 'Recruitment',  managerId: 3,  memberIds: [3] }] },
  { id: 4, name: 'Finance',     headId: 4,  color: '#F59E0B', teams: [{ id: 4, name: 'Accounting',   managerId: 4,  memberIds: [4] }] },
  { id: 5, name: 'Sales',       headId: 5,  color: '#10B981', teams: [{ id: 5, name: 'Enterprise',   managerId: 5,  memberIds: [5] }] },
  { id: 6, name: 'Operations',  headId: 6,  color: '#6B7280', teams: [{ id: 6, name: 'Logistics',    managerId: 6,  memberIds: [6] }] },
  { id: 7, name: 'Legal',       headId: 7,  color: '#EF4444', teams: [{ id: 7, name: 'Compliance',   managerId: 7,  memberIds: [7] }] },
  { id: 8, name: 'Design',      headId: 9,  color: '#14B8A6', teams: [{ id: 8, name: 'UI/UX',        managerId: 9,  memberIds: [9, 12] }] },
  { id: 9, name: 'Executive',   headId: 10, color: '#F97316', teams: [{ id: 9, name: 'HQ',           managerId: 10, memberIds: [10] }] },
];

// Canonical company department names for "pick a department" dropdowns
// (Add Employee, Approval Workflow's Specific Person picker, ...). Kept in
// sync with adminDepartments above, but "HR" is normalized to "Human
// Resources" to match the actual Employee.department string used by real
// backend/seeded data — using "HR" here would silently match zero employees.
export const CANONICAL_DEPARTMENT_NAMES = adminDepartments.map((d) =>
  d.name === 'HR' ? 'Human Resources' : d.name
);

// ─── Leave Balances (all employees, all types) ────────────────────────────────
import type { LeaveTypeKey } from '../../types';
const leaveTypes: LeaveTypeKey[] = ['annual','sick','bereavement','wedding','paternity','maternity','public_holiday','compensation','unpaid','overtime'];
const defaultBalances: Record<LeaveTypeKey, number> = {
  annual: 18, sick: 3, bereavement: 0, wedding: 0, paternity: 0, maternity: 0, public_holiday: 8, compensation: 3, unpaid: 5, overtime: 2
};
export const adminLeaveBalances = adminEmployeesList.flatMap(emp =>
  leaveTypes.map(lt => ({ employeeId: emp.id, leaveType: lt, amount: defaultBalances[lt] }))
);

// ─── Leave Requests ──────────────────────────────────────────────────────────
export const adminLeaveRequests: AdminLeaveRequest[] = [
  { id: 1,  employeeId: 2,  leaveType: 'annual',      startDate: '2026-07-16', endDate: '2026-07-27', dailyAmounts: {'2026-07-16':1,'2026-07-17':1,'2026-07-20':1,'2026-07-21':1,'2026-07-22':1,'2026-07-23':1,'2026-07-24':1,'2026-07-27':1}, note: 'Trip to Europe',      submittedDate: '2026-07-01', status: 'approved',  totalDays: 8,  balanceBefore: 18, balanceAfter: 10 },
  { id: 2,  employeeId: 4,  leaveType: 'sick',         startDate: '2026-07-08', endDate: '2026-07-09', dailyAmounts: {'2026-07-08':1,'2026-07-09':1},                                                                                           note: 'Fever',               submittedDate: '2026-07-07', status: 'pending',   totalDays: 2,  balanceBefore: 3,  balanceAfter: 1  },
  { id: 3,  employeeId: 5,  leaveType: 'annual',       startDate: '2026-07-14', endDate: '2026-07-17', dailyAmounts: {'2026-07-14':1,'2026-07-15':1,'2026-07-16':1,'2026-07-17':1},                                                           note: 'Family visit',        submittedDate: '2026-07-05', status: 'pending',   totalDays: 4,  balanceBefore: 18, balanceAfter: 14 },
  { id: 4,  employeeId: 7,  leaveType: 'sick',         startDate: '2026-07-10', endDate: '2026-07-10', dailyAmounts: {'2026-07-10':1},                                                                                                         note: 'Doctor appointment',  submittedDate: '2026-07-09', status: 'approved',  totalDays: 1,  balanceBefore: 3,  balanceAfter: 2  },
  { id: 5,  employeeId: 1,  leaveType: 'annual',       startDate: '2026-07-08', endDate: '2026-07-09', dailyAmounts: {'2026-07-08':1,'2026-07-09':1},                                                                                           note: '',                    submittedDate: '2026-07-06', status: 'approved',  totalDays: 2,  balanceBefore: 18, balanceAfter: 16 },
  { id: 6,  employeeId: 9,  leaveType: 'annual',       startDate: '2026-07-21', endDate: '2026-07-25', dailyAmounts: {'2026-07-21':1,'2026-07-22':1,'2026-07-23':1,'2026-07-24':1,'2026-07-25':1},                                            note: 'Personal travel',     submittedDate: '2026-07-10', status: 'pending',   totalDays: 5,  balanceBefore: 18, balanceAfter: 13 },
  { id: 7,  employeeId: 8,  leaveType: 'compensation', startDate: '2026-07-03', endDate: '2026-07-03', dailyAmounts: {'2026-07-03':1},                                                                                                         note: 'Overtime from June',  submittedDate: '2026-07-01', status: 'declined',  totalDays: 1,  balanceBefore: 3,  balanceAfter: 3,  approverComments: 'Business critical period' },
  { id: 8,  employeeId: 6,  leaveType: 'annual',       startDate: '2026-08-01', endDate: '2026-08-07', dailyAmounts: {'2026-08-03':1,'2026-08-04':1,'2026-08-05':1,'2026-08-06':1,'2026-08-07':1},                                            note: 'Summer vacation',     submittedDate: '2026-07-12', status: 'pending',   totalDays: 5,  balanceBefore: 18, balanceAfter: 13 },
  { id: 9,  employeeId: 11, leaveType: 'sick',         startDate: '2026-07-13', endDate: '2026-07-14', dailyAmounts: {'2026-07-13':1,'2026-07-14':1},                                                                                           note: 'Cold',                submittedDate: '2026-07-12', status: 'pending',   totalDays: 2,  balanceBefore: 3,  balanceAfter: 1  },
  { id: 10, employeeId: 3,  leaveType: 'annual',       startDate: '2026-09-01', endDate: '2026-09-05', dailyAmounts: {'2026-09-01':1,'2026-09-02':1,'2026-09-03':1,'2026-09-04':1,'2026-09-05':1},                                            note: 'Conference trip',     submittedDate: '2026-07-15', status: 'pending',   totalDays: 5,  balanceBefore: 18, balanceAfter: 13 },
];

// ─── Leave Ledger ────────────────────────────────────────────────────────────
export const adminLeaveLedger = [
  { id: 1,  employeeId: 1, leaveType: 'annual' as LeaveTypeKey, date: '2026-07-01', description: 'Monthly Accrual',             change: 1.25, balance: 18   },
  { id: 2,  employeeId: 1, leaveType: 'annual' as LeaveTypeKey, date: '2026-07-08', description: 'Annual Leave (08-09 Jul)',    change: -2,   balance: 16   },
  { id: 3,  employeeId: 1, leaveType: 'annual' as LeaveTypeKey, date: '2026-06-01', description: 'Monthly Accrual',             change: 1.25, balance: 18   },
  { id: 4,  employeeId: 2, leaveType: 'annual' as LeaveTypeKey, date: '2026-07-16', description: 'Annual Leave (16-27 Jul)',    change: -8,   balance: 10   },
  { id: 5,  employeeId: 4, leaveType: 'sick'   as LeaveTypeKey, date: '2026-07-08', description: 'Sick Leave submitted',        change: -2,   balance: 1    },
  { id: 6,  employeeId: 5, leaveType: 'annual' as LeaveTypeKey, date: '2026-07-01', description: 'Monthly Accrual',             change: 1.25, balance: 18   },
  { id: 7,  employeeId: 7, leaveType: 'sick'   as LeaveTypeKey, date: '2026-07-10', description: 'Sick Leave (10 Jul)',         change: -1,   balance: 2    },
];

// ─── Holidays ────────────────────────────────────────────────────────────────
export const adminHolidays = [
  { id: 1,  name: 'New Year\'s Day',        date: '2026-01-01', country: 'Lebanon',      countryCode: 'LB', flag: '🇱🇧', recurring: true  },
  { id: 2,  name: 'Labour Day',             date: '2026-05-01', country: 'Lebanon',      countryCode: 'LB', flag: '🇱🇧', recurring: true  },
  { id: 3,  name: 'Lebanese Independence',  date: '2026-11-22', country: 'Lebanon',      countryCode: 'LB', flag: '🇱🇧', recurring: true  },
  { id: 4,  name: 'Bastille Day',           date: '2026-07-14', country: 'France',       countryCode: 'FR', flag: '🇫🇷', recurring: true  },
  { id: 5,  name: 'Armistice Day',          date: '2026-11-11', country: 'France',       countryCode: 'FR', flag: '🇫🇷', recurring: true  },
  { id: 6,  name: 'New Year\'s Day',        date: '2026-01-01', country: 'France',       countryCode: 'FR', flag: '🇫🇷', recurring: true  },
  { id: 7,  name: 'Canada Day',             date: '2026-07-01', country: 'Canada',       countryCode: 'CA', flag: '🇨🇦', recurring: true  },
  { id: 8,  name: 'Thanksgiving',           date: '2026-10-12', country: 'Canada',       countryCode: 'CA', flag: '🇨🇦', recurring: true  },
  { id: 9,  name: 'National Day',           date: '2026-12-02', country: 'UAE',          countryCode: 'AE', flag: '🇦🇪', recurring: true  },
  { id: 10, name: 'Commemoration Day',      date: '2026-12-01', country: 'UAE',          countryCode: 'AE', flag: '🇦🇪', recurring: true  },
  { id: 11, name: 'Revolution Day',         date: '2026-07-25', country: 'Tunisia',      countryCode: 'TN', flag: '🇹🇳', recurring: true  },
  { id: 12, name: 'Independence Day',       date: '2026-03-20', country: 'Tunisia',      countryCode: 'TN', flag: '🇹🇳', recurring: true  },
];

// ─── Audit Log ───────────────────────────────────────────────────────────────
export const adminAuditLog: AuditLogEntry[] = [
  { id: 1,  user: 'HR Admin', action: 'LEAVE_APPROVED',   entity: 'LeaveRequest', entityId: 1,  description: 'Approved Annual Leave for Carla Daghfal',  previousValue: 'pending', newValue: 'approved',  timestamp: '2026-07-02T09:15:00Z' },
  { id: 2,  user: 'HR Admin', action: 'LEAVE_APPROVED',   entity: 'LeaveRequest', entityId: 5,  description: 'Approved Annual Leave for Gabriel Habre',   previousValue: 'pending', newValue: 'approved',  timestamp: '2026-07-07T10:30:00Z' },
  { id: 3,  user: 'HR Admin', action: 'LEAVE_REJECTED',   entity: 'LeaveRequest', entityId: 7,  description: 'Declined Compensation Leave for Omar Benzara',previousValue: 'pending', newValue: 'declined',  timestamp: '2026-07-03T14:00:00Z' },
  { id: 4,  user: 'HR Admin', action: 'BALANCE_ADJUSTED', entity: 'LeaveBalance', entityId: 1,  description: 'Adjusted Annual balance for Gabriel Habre',  previousValue: '20', newValue: '18',           timestamp: '2026-07-01T08:00:00Z' },
  { id: 5,  user: 'HR Admin', action: 'EMPLOYEE_ADDED',   entity: 'Employee',     entityId: 12, description: 'Added employee Gabriel Marchetti',           previousValue: '-',  newValue: 'active',        timestamp: '2026-06-15T11:00:00Z' },
  { id: 6,  user: 'HR Admin', action: 'POLICY_UPDATED',   entity: 'Policy',       entityId: 'pol-tn', description: 'Updated Tunisia policy annual leave days', previousValue: '18', newValue: '20',        timestamp: '2026-05-01T09:00:00Z' },
  { id: 7,  user: 'HR Admin', action: 'HOLIDAY_ADDED',    entity: 'Holiday',      entityId: 11, description: 'Added Revolution Day for Tunisia',           previousValue: '-',  newValue: '2026-07-25',    timestamp: '2026-04-01T10:00:00Z' },
  { id: 8,  user: 'HR Admin', action: 'LEAVE_APPROVED',   entity: 'LeaveRequest', entityId: 4,  description: 'Approved Sick Leave for Marie Dupont',       previousValue: 'pending', newValue: 'approved',  timestamp: '2026-07-10T11:00:00Z' },
];

// ─── Notifications ───────────────────────────────────────────────────────────
export const adminNotifications: AdminNotification[] = [
  { id: 1,  type: 'leave_submitted', title: 'New Leave Request',     message: 'Elias Ghali submitted a Sick Leave request (2 days)',     employeeId: 4,  read: false, timestamp: '2026-07-07T08:00:00Z' },
  { id: 2,  type: 'leave_submitted', title: 'New Leave Request',     message: 'Etienne Khoueiry submitted Annual Leave (4 days)',        employeeId: 5,  read: false, timestamp: '2026-07-05T09:00:00Z' },
  { id: 3,  type: 'leave_submitted', title: 'New Leave Request',     message: 'Laura Sanchez submitted Annual Leave (5 days)',           employeeId: 9,  read: false, timestamp: '2026-07-10T10:30:00Z' },
  { id: 4,  type: 'leave_submitted', title: 'New Leave Request',     message: 'Saad AlMutairi submitted Annual Leave (5 days)',          employeeId: 6,  read: false, timestamp: '2026-07-12T11:00:00Z' },
  { id: 5,  type: 'leave_approved',  title: 'Leave Approved',        message: 'Annual Leave for Carla Daghfal has been approved',        employeeId: 2,  read: true,  timestamp: '2026-07-02T09:15:00Z' },
  { id: 6,  type: 'leave_rejected',  title: 'Leave Declined',        message: 'Compensation Leave for Omar Benzara has been declined',   employeeId: 8,  read: true,  timestamp: '2026-07-03T14:00:00Z' },
  { id: 7,  type: 'balance_updated', title: 'Balance Updated',       message: 'Annual Leave balance updated for Gabriel Habre (18 days)',employeeId: 1,  read: true,  timestamp: '2026-07-01T08:00:00Z' },
  { id: 8,  type: 'leave_submitted', title: 'New Leave Request',     message: 'Mazen Bou Monsef submitted Sick Leave (2 days)',          employeeId: 11, read: false, timestamp: '2026-07-12T15:00:00Z' },
  { id: 9,  type: 'leave_submitted', title: 'New Leave Request',     message: 'Anabel Masco submitted Annual Leave (5 days)',            employeeId: 3,  read: false, timestamp: '2026-07-15T08:30:00Z' },
];
