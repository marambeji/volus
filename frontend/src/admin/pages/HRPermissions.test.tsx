import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import HRPermissions from './HRPermissions';
import { getHrAdmins, setHrPermissions } from '../../services/hrPermissionsApi';
import { FULL_HR_PERMISSIONS } from '../types/hrPermissions';

vi.mock('../../services/hrPermissionsApi', () => ({
  getHrAdmins: vi.fn(),
  setHrPermissions: vi.fn(),
}));

const mockedGetHrAdmins = vi.mocked(getHrAdmins);
const mockedSetHrPermissions = vi.mocked(setHrPermissions);

describe('HRPermissions Admin Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetHrAdmins.mockResolvedValue([
      { id: 'a1', fullName: 'HR Admin User', email: 'admin@novelus.com', isSuperAdmin: true, permissions: FULL_HR_PERMISSIONS },
      { id: 'a2', fullName: 'hr salim 1', email: 'salim.hizi@esprit.tn', isSuperAdmin: false, permissions: FULL_HR_PERMISSIONS },
    ]);
    mockedSetHrPermissions.mockResolvedValue(FULL_HR_PERMISSIONS);
  });

  it('lists HR admins and marks the Super Admin', async () => {
    await act(async () => { render(<HRPermissions />); });
    expect(screen.getByText('HR Admin User')).toBeInTheDocument();
    expect(screen.getByText('hr salim 1')).toBeInTheDocument();
    expect(screen.getByText(/Super Admin/i)).toBeInTheDocument();
  });

  it('saves an updated permission set for a restricted user', async () => {
    await act(async () => { render(<HRPermissions />); });

    fireEvent.click(screen.getByText('hr salim 1'));
    const employeesViewCheckbox = await screen.findByLabelText('employees-view');
    fireEvent.click(employeesViewCheckbox);
    fireEvent.click(screen.getByText(/Save/i));

    await waitFor(() => {
      expect(mockedSetHrPermissions).toHaveBeenCalledWith(
        'a2',
        expect.arrayContaining([
          expect.objectContaining({ module: 'employees', canView: false }),
        ]),
      );
    });
  });
});
