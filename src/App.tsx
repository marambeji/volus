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

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [role, setRole] = useState<'employee' | 'admin'>('employee');

  const handleLogin = (selectedRole: 'employee' | 'admin' = 'employee') => {
    setRole(selectedRole);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
  };

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <Router>
      {role === 'admin' ? (
        <Routes>
          <Route path="/admin/*" element={<AdminApp onSwitchRole={setRole} />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      ) : (
        <Layout onLogout={handleLogout} onSwitchRole={setRole}>
          <Routes>
            <Route path="/"                   element={<Home />} />
            <Route path="/my-info"            element={<MyInfo />} />
            <Route path="/people"             element={<People />} />
            <Route path="/approval-dashboard" element={<ApprovalDashboard />} />
            <Route path="/full-calendar"      element={<FullCalendar />} />
            <Route path="*"                   element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      )}
    </Router>
  );
}
