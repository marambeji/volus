import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/layout/Layout';
import Home from './pages/Home';
import MyInfo from './pages/MyInfo';
import People from './pages/People';
import ApprovalDashboard from './pages/ApprovalDashboard';
import FullCalendar from './pages/FullCalendar';
import Login from './pages/Login';
import AdminApp from './admin/AdminApp';

import LeaveTracking from './pages/LeaveTracking';

interface UserSession {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'manager' | 'employee';
  avatar: string;
}

export default function App() {
  const [currentUser, setCurrentUser] = useState<UserSession | null>(() => {
    const stored = localStorage.getItem('currentUser');
    if (stored) {
      const parsed = JSON.parse(stored);
      // Auto-logout if it's the old mock ID format (not a UUID)
      if (typeof parsed.id === 'number' || String(parsed.id).length < 20) {
        localStorage.removeItem('currentUser');
        return null;
      }
      return parsed;
    }
    return null;
  });

  const handleLogin = (user: UserSession) => {
    localStorage.setItem('currentUser', JSON.stringify(user));
    setCurrentUser(user);
  };

  const handleLogout = () => {
    localStorage.removeItem('currentUser');
    setCurrentUser(null);
  };

  // 1. Unauthenticated Routing Block
  if (!currentUser) {
    return (
      <Router>
        <Routes>
          <Route path="/login" element={<Login onLogin={handleLogin} />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Router>
    );
  }

  // 2. Authenticated State: HR Admin Routing Block
  if (currentUser.role === 'admin') {
    return (
      <Router>
        <Routes>
          <Route path="/admin/*" element={<AdminApp onLogout={handleLogout} />} />
          {/* Prevent HR Admin from opening employee routes by redirecting to /admin/dashboard */}
          <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
        </Routes>
      </Router>
    );
  }

  // 3. Authenticated State: Employee / Manager Routing Block
  return (
    <Router>
      <Layout onLogout={handleLogout}>
        <Routes>
          <Route path="/" element={<Navigate to="/employee/dashboard" replace />} />
          <Route path="/employee/dashboard" element={<Home />} />
          <Route path="/employee/my-info" element={<MyInfo />} />
          <Route path="/employee/leave-tracking" element={<LeaveTracking />} />
          <Route path="/employee/people" element={<People />} />
          
          {/* Protect Route: prevent employees (non-managers) from opening /employee/approval-dashboard */}
          <Route 
            path="/employee/approval-dashboard" 
            element={
              currentUser.role === 'manager' 
                ? <ApprovalDashboard /> 
                : <Navigate to="/employee/dashboard" replace />
            } 
          />
          <Route path="/employee/full-calendar" element={<FullCalendar />} />
          
          {/* Redirect any other manually typed URL or admin URL to employee dashboard */}
          <Route path="*" element={<Navigate to="/employee/dashboard" replace />} />
        </Routes>
      </Layout>
    </Router>
  );
}
