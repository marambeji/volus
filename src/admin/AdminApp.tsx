import { Routes, Route, Navigate } from 'react-router-dom';
import { AdminProvider } from './store/AdminContext';
import AdminLayout from './components/layout/AdminLayout';
import AdminDashboard from './pages/AdminDashboard';
import EmployeeList from './pages/EmployeeList';
import LeaveRequests from './pages/LeaveRequests';
import BalanceManagement from './pages/BalanceManagement';
import LeavePolicies from './pages/LeavePolicies';
import PublicHolidays from './pages/PublicHolidays';
import Departments from './pages/Departments';
import Reports from './pages/Reports';
import AuditLog from './pages/AuditLog';
import Notifications from './pages/Notifications';
import Settings from './pages/Settings';
import ApprovalLevels from './pages/ApprovalLevels';
import AccrualHistory from './pages/AccrualHistory';

export default function AdminApp({ onLogout }: { onLogout?: () => void }) {
  return (
    <AdminProvider>
      <AdminLayout onLogout={onLogout}>
        <Routes>
          <Route path="/" element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="/dashboard" element={<AdminDashboard />} />
          <Route path="/employees" element={<EmployeeList />} />
          <Route path="/leaves" element={<LeaveRequests />} />
          <Route path="/balances" element={<BalanceManagement />} />
          <Route path="/accrual-history" element={<AccrualHistory />} />
          <Route path="/policies" element={<LeavePolicies />} />
          <Route path="/approval-levels" element={<ApprovalLevels />} />
          <Route path="/countries" element={<Navigate to="/admin/policies" replace />} />
          <Route path="/holidays" element={<PublicHolidays />} />
          <Route path="/departments" element={<Departments />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/audit" element={<AuditLog />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
        </Routes>
      </AdminLayout>
    </AdminProvider>
  );
}
