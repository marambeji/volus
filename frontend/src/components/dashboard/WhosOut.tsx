import { useState, useEffect } from 'react';
import { Users, Calendar, ChevronRight, RefreshCw } from 'lucide-react';
import { employeesToday, employeesTomorrow } from '../../data/mockData';
import EmployeeCard from './EmployeeCard';
import EmptyState from '../ui/EmptyState';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../../services/apiClient';

type Tab = 'today' | 'tomorrow';

export default function WhosOut() {
  const [activeTab, setActiveTab] = useState<Tab>('today');
  const [loading, setLoading] = useState(false);
  const [todayList, setTodayList] = useState<any[]>([]);
  const [tomorrowList, setTomorrowList] = useState<any[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    async function loadWhosOut() {
      try {
        setLoading(true);
        // Fetch active requests and employees directory
        const [requests, employeesRes] = await Promise.all([
          apiFetch<any[]>('/leave-requests/whos-out').catch(() => []),
          apiFetch<any>('/employees?limit=100').catch(() => null),
        ]);

        const allEmps = employeesRes?.data || [];
        const allRequests = Array.isArray(requests) ? requests : [];

        const todayStr = new Date().toISOString().split('T')[0];
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString().split('T')[0];

        // Filter requests active today (only APPROVED)
        const activeToday = allRequests.filter((r) => {
          const isApproved = r.currentStatus === 'APPROVED' || r.status === 'APPROVED';
          const s = r.startDate ? r.startDate.split('T')[0] : '';
          const e = r.endDate ? r.endDate.split('T')[0] : '';
          return isApproved && s <= todayStr && e >= todayStr;
        });

        // Filter requests active tomorrow (only APPROVED)
        const activeTomorrow = allRequests.filter((r) => {
          const isApproved = r.currentStatus === 'APPROVED' || r.status === 'APPROVED';
          const s = r.startDate ? r.startDate.split('T')[0] : '';
          const e = r.endDate ? r.endDate.split('T')[0] : '';
          return isApproved && s <= tomorrowStr && e >= tomorrowStr;
        });

        const mappedToday = activeToday.map((r, idx) => ({
          id: r.requestId || r.id || idx,
          name: r.employeeName || 'Employee',
          department: r.department || 'Engineering',
          status: 'out-today',
          leaveType: r.leaveTypeName || 'Annual Leave',
          dayAmount: r.requestedDuration === 0.5 ? 0.5 : 1,
        }));
        setTodayList(mappedToday);

        const mappedTomorrow = activeTomorrow.map((r, idx) => ({
          id: r.requestId || r.id || idx,
          name: r.employeeName || 'Employee',
          department: r.department || 'Engineering',
          status: 'out-tomorrow',
          leaveType: r.leaveTypeName || 'Annual Leave',
          dayAmount: r.requestedDuration === 0.5 ? 0.5 : 1,
        }));
        setTomorrowList(mappedTomorrow);
      } catch (err) {
        console.error('Error loading Who’s Out data:', err);
      } finally {
        setLoading(false);
      }
    }

    void loadWhosOut();
    const handleRefresh = () => { void loadWhosOut(); };
    window.addEventListener('leave-request-submitted', handleRefresh);
    return () => { window.removeEventListener('leave-request-submitted', handleRefresh); };
  }, []);

  const employees = activeTab === 'today' ? todayList : tomorrowList;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
            <Users size={16} className="text-blue-600" />
          </div>
          <h2 className="text-slate-800 font-semibold text-base">Who's Out</h2>
          {loading && <RefreshCw size={14} className="animate-spin text-blue-600 ml-2" />}
        </div>

        <button
          onClick={() => navigate('/employee/full-calendar')}
          className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
        >
          <Calendar size={13} />
          Full Calendar
          <ChevronRight size={13} />
        </button>
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 px-6 pt-4">
        {(['today', 'tomorrow'] as Tab[]).map((tab) => {
          const list = tab === 'today' ? todayList : tomorrowList;
          const count = list.length;
          const isActive = activeTab === tab;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150 cursor-pointer ${
                isActive
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {tab === 'today' ? 'Today' : 'Tomorrow'}
              <span
                className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold ${
                  isActive ? 'bg-blue-500 text-white' : 'bg-white text-slate-600'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Employee Grid ── */}
      <div className="p-6">
        {employees.length === 0 ? (
          <EmptyState
            title="Everyone is in!"
            message="No employees are out on this day."
            icon="🎉"
          />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {employees.map((emp) => (
              <EmployeeCard key={emp.id} employee={emp} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
