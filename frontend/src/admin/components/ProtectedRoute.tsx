import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { getCurrentUser } from '../utils/useHrPermissions';
import type { HrModule } from '../types/hrPermissions';

export function ProtectedRoute({ module, children }: { module: HrModule; children: ReactNode }) {
  const user = getCurrentUser();
  const allowed = !!user.isSuperAdmin || user.permissions?.[module]?.canView !== false;
  if (!allowed) return <Navigate to="/admin/dashboard" replace />;
  return <>{children}</>;
}

export function SuperAdminRoute({ children }: { children: ReactNode }) {
  const user = getCurrentUser();
  if (!user.isSuperAdmin) return <Navigate to="/admin/dashboard" replace />;
  return <>{children}</>;
}
