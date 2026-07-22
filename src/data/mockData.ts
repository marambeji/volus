import type { Employee, LeaveType, LeaveBalance, LeaveLedgerEntry, LeaveRequest, Holiday, CompanyLink } from '../types';

// ─── 10 Leave Types ──────────────────────────────────────────────────────────
export const leaveTypesList: LeaveType[] = [
  { key: 'annual',         label: 'Annual Leave',       color: '#3B82F6', isAccrued: true },   // Blue
  { key: 'sick',           label: 'Sick Leave',         color: '#A855F7', isAccrued: false },  // Purple
  { key: 'bereavement',    label: 'Bereavement Leave',  color: '#EF4444', isAccrued: false },  // Red
  { key: 'wedding',        label: 'Wedding Leave',      color: '#14B8A6', isAccrued: false },  // Teal
  { key: 'paternity',      label: 'Paternity Leave',    color: '#6B7280', isAccrued: false },  // Gray
  { key: 'maternity',      label: 'Maternity Leave',    color: '#EC4899', isAccrued: false },  // Pink
  { key: 'public_holiday', label: 'Public Holiday',     color: '#22C55E', isAccrued: true },   // Green
  { key: 'compensation',   label: 'Compensation Leave', color: '#06B6D4', isAccrued: true },   // Cyan
  { key: 'unpaid',         label: 'Unpaid Leave',       color: '#1E3A8A', isAccrued: false },  // Dark Blue
  { key: 'overtime',       label: 'Overtime Leave',     color: '#B91C1C', isAccrued: true },   // Dark Red
];

// ─── Employees ────────────────────────────────────────────────────────────────
export const employeesList: Employee[] = [
  { id: 1,  name: 'Gabriel Habre',     role: 'Frontend Developer',         email: 'gabriel.habre@novelus.com',    hireDate: '2021-03-12', department: 'Engineering', unit: 'Web Dev',      managerId: 10, status: 'out-today',    country: 'Lebanon',       dayAmount: 1   },
  { id: 2,  name: 'Carla Daghfal',     role: 'Growth Marketing Manager',    email: 'carla.daghfal@novelus.com',    hireDate: '2022-05-18', department: 'Marketing',   unit: 'Growth',       managerId: 1,  status: 'out-today',    country: 'Morocco',       dayAmount: 0.5 },
  { id: 3,  name: 'Anabel Masco',      role: 'Talent Acquisition Lead',     email: 'anabel.masco@novelus.com',     hireDate: '2020-11-01', department: 'HR',          unit: 'Recruitment',  managerId: 10, status: 'out-today',    country: 'Canada',        dayAmount: 1   },
  { id: 4,  name: 'Elias Ghali',       role: 'Senior Accountant',           email: 'elias.ghali@novelus.com',      hireDate: '2023-01-15', department: 'Finance',     unit: 'Accounting',   managerId: 1,  status: 'out-today',    country: 'Lebanon',       dayAmount: 0.5 },
  { id: 5,  name: 'Etienne Khoueiry',  role: 'Enterprise Sales Executive',  email: 'etienne.khoueiry@novelus.com', hireDate: '2021-09-01', department: 'Sales',       unit: 'Enterprise',   managerId: 1,  status: 'out-today',    country: 'Egypt',         dayAmount: 1   },
  { id: 6,  name: 'Saad AlMutairi',    role: 'Logistics Operations Lead',   email: 'saad.almutairi@novelus.com',   hireDate: '2022-07-20', department: 'Operations',  unit: 'Logistics',    managerId: 10, status: 'out-today',    country: 'Saudi Arabia',  dayAmount: 1   },
  { id: 7,  name: 'Marie Dupont',      role: 'Compliance Officer',          email: 'marie.dupont@novelus.com',     hireDate: '2023-06-10', department: 'Legal',       unit: 'Compliance',   managerId: 10, status: 'out-today',    country: 'France',        dayAmount: 0.5 },
  { id: 8,  name: 'Omar Benzara',      role: 'Fullstack Developer',         email: 'omar.benzara@novelus.com',     hireDate: '2022-04-14', department: 'Engineering', unit: 'Web Dev',      managerId: 1,  status: 'out-today',    country: 'Algeria',       dayAmount: 1   },
  { id: 9,  name: 'Laura Sanchez',     role: 'UX/UI Designer',              email: 'laura.sanchez@novelus.com',    hireDate: '2024-02-01', department: 'Design',      unit: 'UI/UX',        managerId: 1,  status: 'out-today',    country: 'Spain',         dayAmount: 1   },
  { id: 10, name: 'Riad Mansour',      role: 'Chief Executive Officer',     email: 'riad.mansour@novelus.com',     hireDate: '2018-01-01', department: 'Executive',   unit: 'HQ',           managerId: undefined, status: 'in', country: 'UAE' },
  { id: 11, name: 'Mazen Bou Monsef',  role: 'Backend Developer',           email: 'mazen.monsef@novelus.com',     hireDate: '2023-08-11', department: 'Engineering', unit: 'Web Dev',      managerId: 1,  status: 'out-tomorrow', country: 'Lebanon',       dayAmount: 1   },
  { id: 12, name: 'Gabriel Marchetti', role: 'Product Designer',            email: 'gabriel.marchetti@novelus.com',hireDate: '2021-12-05', department: 'Design',      unit: 'UI/UX',        managerId: 10, status: 'out-tomorrow', country: 'Argentina',     dayAmount: 0.5 },
];

// ─── Leave Balances (For Gabriel Habre, id=1) ──────────────────────────────────
export const leaveBalancesList: LeaveBalance[] = [
  { employeeId: 1, leaveType: 'annual',         amount: 18 },
  { employeeId: 1, leaveType: 'sick',           amount: 2 },
  { employeeId: 1, leaveType: 'bereavement',    amount: 0 },
  { employeeId: 1, leaveType: 'wedding',        amount: 0 },
  { employeeId: 1, leaveType: 'paternity',      amount: 0 },
  { employeeId: 1, leaveType: 'maternity',      amount: 0 },
  { employeeId: 1, leaveType: 'public_holiday', amount: 8 },
  { employeeId: 1, leaveType: 'compensation',   amount: 3 },
  { employeeId: 1, leaveType: 'unpaid',         amount: 5 },
  { employeeId: 1, leaveType: 'overtime',       amount: 1.5 },
];

// ─── Leave Ledger History (For Gabriel Habre, id=1) ────────────────────────────
export const leaveLedgerList: LeaveLedgerEntry[] = [
  { id: 1, employeeId: 1, leaveType: 'annual', date: '2026-07-01', description: 'Annual Leave Accrual', change: 2.5, balance: 18 },
  { id: 2, employeeId: 1, leaveType: 'annual', date: '2026-06-15', description: 'Annual Leave from 15/06/2026 to 17/06/2026', change: -3.0, balance: 15.5 },
  { id: 3, employeeId: 1, leaveType: 'annual', date: '2026-06-01', description: 'Annual Leave Accrual', change: 2.5, balance: 18.5 },
  { id: 4, employeeId: 1, leaveType: 'annual', date: '2026-05-01', description: 'Annual Leave Accrual', change: 2.5, balance: 16.0 },
];

// ─── Leave Requests ───────────────────────────────────────────────────────────
export const leaveRequestsList: LeaveRequest[] = [
  {
    id: 1,
    employeeId: 2, // Carla
    leaveType: 'annual',
    startDate: '2026-07-16',
    endDate: '2026-07-27',
    dailyAmounts: { '2026-07-16': 1, '2026-07-17': 1, '2026-07-20': 1, '2026-07-21': 1, '2026-07-22': 1, '2026-07-23': 1, '2026-07-24': 1, '2026-07-27': 1 },
    note: 'Trip to Europe',
    submittedDate: '2026-07-01',
    status: 'approved',
    totalDays: 8
  },
  {
    id: 2,
    employeeId: 4, // Elias
    leaveType: 'sick',
    startDate: '2026-07-08',
    endDate: '2026-07-09',
    dailyAmounts: { '2026-07-08': 1, '2026-07-09': 1 },
    note: 'Fever',
    submittedDate: '2026-07-07',
    status: 'pending',
    totalDays: 2
  }
];

// ─── Upcoming Holidays ────────────────────────────────────────────────────────
export const upcomingHolidays: Holiday[] = [
  { id: 1, name: 'Bastille Day',          date: '2026-07-14', country: 'France',   countryCode: 'FR', flag: '🇫🇷' },
  { id: 2, name: 'Independence Day',      date: '2026-07-04', country: 'USA',      countryCode: 'US', flag: '🇺🇸' },
  { id: 3, name: 'Lebanese Independence', date: '2026-11-22', country: 'Lebanon',  countryCode: 'LB', flag: '🇱🇧' },
  { id: 4, name: 'Canada Day',            date: '2026-07-01', country: 'Canada',   countryCode: 'CA', flag: '🇨🇦' },
  { id: 5, name: 'National Day',          date: '2026-12-02', country: 'UAE',      countryCode: 'AE', flag: '🇦🇪' },
];

// ─── Company Links (Public Holidays by Country) ────────────────────────────
export const companyLinks: CompanyLink[] = [
  { id: 1,  country: 'Algeria',            flag: '🇩🇿', url: 'https://publicholidays.africa/algeria/' },
  { id: 2,  country: 'Argentina',          flag: '🇦🇷', url: 'https://publicholidays.com.ar/' },
  { id: 3,  country: 'Brazil',             flag: '🇧🇷', url: 'https://publicholidays.com.br/' },
  { id: 4,  country: 'Canada',             flag: '🇨🇦', url: 'https://publicholidays.ca/' },
  { id: 5,  country: 'Colombia',           flag: '🇨🇴', url: 'https://publicholidays.com.co/' },
  { id: 6,  country: 'Dominican Republic', flag: '🇩🇴', url: 'https://publicholidays.com.do/' },
  { id: 7,  country: 'Egypt',              flag: '🇪🇬', url: 'https://publicholidays.africa/egypt/' },
  { id: 8,  country: 'France',             flag: '🇫🇷', url: 'https://publicholidays.fr/' },
  { id: 9,  country: 'Germany',            flag: '🇩🇪', url: 'https://publicholidays.de/' },
  { id: 10, country: 'India',              flag: '🇮🇳', url: 'https://publicholidays.in/' },
  { id: 11, country: 'Lebanon',            flag: '🇱🇧', url: 'https://publicholidays.africa/lebanon/' },
  { id: 12, country: 'Mexico',             flag: '🇲🇽', url: 'https://publicholidays.com.mx/' },
  { id: 13, country: 'Morocco',            flag: '🇲🇦', url: 'https://publicholidays.africa/morocco/' },
  { id: 14, country: 'Saudi Arabia',       flag: '🇸🇦', url: 'https://publicholidays.com.sa/' },
  { id: 15, country: 'South Africa',       flag: '🇿🇦', url: 'https://publicholidays.co.za/' },
  { id: 16, country: 'Spain',              flag: '🇪🇸', url: 'https://publicholidays.es/' },
  { id: 17, country: 'Tunisia',            flag: '🇹🇳', url: 'https://publicholidays.africa/tunisia/' },
  { id: 18, country: 'UAE',                flag: '🇦🇪', url: 'https://publicholidays.ae/' },
  { id: 19, country: 'United Kingdom',     flag: '🇬🇧', url: 'https://publicholidays.co.uk/' },
  { id: 20, country: 'USA',                flag: '🇺🇸', url: 'https://publicholidays.us/' },
];

// Helper to filter out out-today and out-tomorrow for backwards compatibility
export const employeesToday = employeesList.filter(e => e.status === 'out-today');
export const employeesTomorrow = employeesList.filter(e => e.status === 'out-tomorrow');
export const dashboardStats = [
  { id: 1, label: 'Leave Balance',      value: '18 days', icon: '🏖️', color: 'bg-blue-50',    textColor: 'text-blue-600' },
  { id: 2, label: 'Pending Requests',   value: 2,         icon: '⏳', color: 'bg-amber-50',   textColor: 'text-amber-600' },
  { id: 3, label: 'Approved This Year', value: 12,        icon: '✅', color: 'bg-emerald-50', textColor: 'text-emerald-600' },
  { id: 4, label: 'Team Out Today',     value: 12,        icon: '👥', color: 'bg-purple-50',  textColor: 'text-purple-600' },
];
