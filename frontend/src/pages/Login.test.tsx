import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Login from './Login';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

describe('Login Page Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    global.fetch = vi.fn();
  });

  it('renders landing page then shows login credentials form on click', async () => {
    const user = userEvent.setup();
    render(<Login onLogin={vi.fn()} />);

    // Initially in landing step
    const landingBtn = screen.getAllByRole('button', { name: /LOGIN/i })[0];
    expect(landingBtn).toBeInTheDocument();
    
    const formContainer = screen.getByPlaceholderText(/Username/i).closest('div.backdrop-blur-xl');
    expect(formContainer).toHaveClass('opacity-0');

    // Click to go to form step
    await user.click(landingBtn);
    expect(formContainer).toHaveClass('opacity-100');
  });

  it('allows quick selection of demo accounts', async () => {
    const user = userEvent.setup();
    render(<Login onLogin={vi.fn()} />);

    const landingBtn = screen.getAllByRole('button', { name: /LOGIN/i })[0];
    await user.click(landingBtn);

    const employeeAutoFill = screen.getByText(/Employee/i);
    await user.click(employeeAutoFill);

    const emailInput = screen.getByPlaceholderText(/Username/i) as HTMLInputElement;
    expect(emailInput.value).toBe('salim@novelus.com');
  });

  it('validates submission and authenticates successfully', async () => {
    const user = userEvent.setup();
    const mockOnLogin = vi.fn();
    
    // Mock successful fetch
    const mockUser = { id: 'emp-1', name: 'Gabriel', email: 'gabriel@novelus.com', role: 'employee', avatar: '' };
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => mockUser,
    });

    render(<Login onLogin={mockOnLogin} />);

    // Go to form
    const landingBtn = screen.getAllByRole('button', { name: /LOGIN/i })[0];
    await user.click(landingBtn);

    const emailInput = screen.getByPlaceholderText(/Username/i);
    const passwordInput = screen.getByPlaceholderText(/Password/i);
    
    // Enter credentials
    await user.clear(emailInput);
    await user.type(emailInput, 'gabriel@novelus.com');
    await user.clear(passwordInput);
    await user.type(passwordInput, 'admin'); // password must be 'admin' in Login.tsx

    const submitBtn = screen.getAllByRole('button', { name: /LOGIN/i })[1];
    await user.click(submitBtn);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
      expect(mockOnLogin).toHaveBeenCalledWith(mockUser);
    });
  });
});
