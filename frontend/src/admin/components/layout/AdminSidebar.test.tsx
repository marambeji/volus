import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AdminSidebar from './AdminSidebar';

function setUser(user: Record<string, unknown>) {
  localStorage.setItem('currentUser', JSON.stringify(user));
}

describe('AdminSidebar', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('shows every module by default (no stored permissions)', () => {
    render(<MemoryRouter><AdminSidebar isOpen onClose={() => {}} /></MemoryRouter>);
    expect(screen.getByText('Employees')).toBeInTheDocument();
    expect(screen.getByText('Leave Policies')).toBeInTheDocument();
  });

  it('hides a module the current HR admin cannot view', () => {
    setUser({
      isSuperAdmin: false,
      permissions: { employees: { canView: false, canManage: false } },
    });
    render(<MemoryRouter><AdminSidebar isOpen onClose={() => {}} /></MemoryRouter>);
    expect(screen.queryByText('Employees')).not.toBeInTheDocument();
  });

  // HR Permissions now lives as a card on the Settings page (see
  // admin/pages/Settings.test.tsx), not as a sidebar nav item.
});
