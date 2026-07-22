import { Building2, Users } from 'lucide-react';
import { useAdmin } from '../store/AdminContext';

export default function Departments() {
  const { state } = useAdmin();

  return (
    <div className="max-w-7xl mx-auto flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Departments</h1>
          <p className="text-slate-400 text-sm mt-1">Company structure and team assignments</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {state.departments.map(dept => {
          const employees = state.employees.filter(e => e.department === dept.name);
          const head = state.employees.find(e => e.id === dept.headId);
          return (
            <div key={dept.id} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white" style={{ backgroundColor: dept.color }}><Building2 size={18} /></div>
                  <h3 className="font-bold text-slate-800 dark:text-white text-lg">{dept.name}</h3>
                </div>
                <div className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1">
                  <Users size={12}/> {employees.length}
                </div>
              </div>
              
              <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-3 mb-4">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Department Head</p>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-slate-200 dark:bg-slate-600 rounded-full flex items-center justify-center text-[10px] font-bold">{head?.name.charAt(0) || '?'}</div>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{head?.name || 'Unassigned'}</p>
                </div>
              </div>

              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Teams</p>
                <div className="flex flex-col gap-2">
                  {dept.teams.map(team => (
                    <div key={team.id} className="flex items-center justify-between text-sm">
                      <span className="text-slate-600 dark:text-slate-300 font-medium">{team.name}</span>
                      <span className="text-xs text-slate-400 bg-white dark:bg-slate-800 px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-600">{team.memberIds.length} members</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
