import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Settings from './Settings';

function setUser(user: Record<string, unknown>) {
  localStorage.setItem('currentUser', JSON.stringify(user));
}

describe('Settings Admin Page', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('shows the Roles & Permissions card for a Super Admin', () => {
    setUser({ isSuperAdmin: true });
    render(<MemoryRouter><Settings /></MemoryRouter>);
    expect(screen.getByText('Roles & Permissions')).toBeInTheDocument();
  });

  it('hides the Roles & Permissions card for a non-Super-Admin', () => {
    setUser({ isSuperAdmin: false });
    render(<MemoryRouter><Settings /></MemoryRouter>);
    expect(screen.queryByText('Roles & Permissions')).not.toBeInTheDocument();
  });
});
