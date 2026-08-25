import { Routes, Route, Navigate } from 'react-router-dom';
import { AdminProvider } from './store/AdminContext';
import AdminLayout from './components/layout/AdminLayout';
import { ProtectedRoute, SuperAdminRoute } from './components/ProtectedRoute';
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
import Countries from './pages/Countries';
import NotificationManager from './pages/NotificationManager';
import HRPermissions from './pages/HRPermissions';

export default function AdminApp({ onLogout }: { onLogout?: () => void }) {
  return (
    <AdminProvider>
      <AdminLayout onLogout={onLogout}>
        <Routes>
          <Route path="/" element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="/dashboard" element={<AdminDashboard />} />
          <Route path="/employees" element={<ProtectedRoute module="employees"><EmployeeList /></ProtectedRoute>} />
          <Route path="/leaves" element={<ProtectedRoute module="leaveRequests"><LeaveRequests /></ProtectedRoute>} />
          <Route path="/balances" element={<ProtectedRoute module="leaveBalances"><BalanceManagement /></ProtectedRoute>} />
          <Route path="/accrual-history" element={<ProtectedRoute module="accrualHistory"><AccrualHistory /></ProtectedRoute>} />
          <Route path="/policies" element={<ProtectedRoute module="leavePolicies"><LeavePolicies /></ProtectedRoute>} />
          <Route path="/approval-levels" element={<ProtectedRoute module="approvalLevels"><ApprovalLevels /></ProtectedRoute>} />
          <Route path="/countries" element={<ProtectedRoute module="countries"><Countries /></ProtectedRoute>} />
          <Route path="/holidays" element={<ProtectedRoute module="publicHolidays"><PublicHolidays /></ProtectedRoute>} />
          <Route path="/departments" element={<ProtectedRoute module="departments"><Departments /></ProtectedRoute>} />
          <Route path="/reports" element={<ProtectedRoute module="reports"><Reports /></ProtectedRoute>} />
          <Route path="/audit" element={<ProtectedRoute module="auditLog"><AuditLog /></ProtectedRoute>} />
          <Route path="/notifications" element={<ProtectedRoute module="notifications"><Notifications /></ProtectedRoute>} />
          <Route path="/reminders" element={<ProtectedRoute module="notificationManager"><NotificationManager /></ProtectedRoute>} />
          <Route path="/hr-permissions" element={<SuperAdminRoute><HRPermissions /></SuperAdminRoute>} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
        </Routes>
      </AdminLayout>
    </AdminProvider>
  );
}
