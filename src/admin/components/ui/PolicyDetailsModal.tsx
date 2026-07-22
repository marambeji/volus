import { X, Edit2, ShieldCheck, FileText } from 'lucide-react';
import type { CountryPolicy, ApprovalConfiguration } from '../../types/adminTypes';

interface PolicyDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEdit: () => void;
  policy: CountryPolicy | null;
  workflows: ApprovalConfiguration[];
}

const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function PolicyDetailsModal({
  isOpen,
  onClose,
  onEdit,
  policy,
  workflows,
}: PolicyDetailsModalProps) {
  if (!isOpen || !policy) return null;

  const workflowName =
    workflows.find((w) => w.id === policy.approvalWorkflow)?.name ||
    policy.approvalWorkflow ||
    'Standard Approval';

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      {/* Backdrop overlay click to close */}
      <div className="fixed inset-0" onClick={onClose} />

      {/* Pop-up Dialog Container */}
      <div className="relative z-10 w-full max-w-4xl bg-white dark:bg-slate-800 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-700 flex flex-col max-h-[90vh] overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-slate-700 bg-gradient-to-r from-violet-600 to-indigo-700 text-white flex-shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-3xl bg-white/20 p-2 rounded-2xl backdrop-blur-xs">
              {policy.flag}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-extrabold text-xl leading-tight">{policy.policyName}</h2>
                <span className="bg-white/20 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                  {policy.countryCode}
                </span>
              </div>
              <p className="text-xs text-violet-100 mt-0.5">
                {policy.country} · Working Hours: {policy.workingHoursPerDay}h/day
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-violet-100 hover:text-white p-2 rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Section 1: General Policy Overview */}
          <div className="space-y-3">
            <h3 className="text-xs font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-violet-600 dark:text-violet-400" />
              General Policy Information
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 bg-slate-50 dark:bg-slate-700/50 rounded-2xl border border-slate-100 dark:border-slate-700">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                  Country
                </span>
                <span className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
                  <span>{policy.flag}</span> {policy.country}
                </span>
              </div>

              <div className="p-3.5 bg-slate-50 dark:bg-slate-700/50 rounded-2xl border border-slate-100 dark:border-slate-700">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                  Working Hours
                </span>
                <span className="text-sm font-bold text-slate-800 dark:text-white">
                  {policy.workingHoursPerDay} hrs / day
                </span>
              </div>

              <div className="p-3.5 bg-slate-50 dark:bg-slate-700/50 rounded-2xl border border-slate-100 dark:border-slate-700">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                  Approval Workflow
                </span>
                <span className="text-xs font-bold text-violet-600 dark:text-violet-400 truncate block">
                  {workflowName}
                </span>
              </div>

              <div className="p-3.5 bg-slate-50 dark:bg-slate-700/50 rounded-2xl border border-slate-100 dark:border-slate-700">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                  Division
                </span>
                <span className="text-sm font-bold text-slate-800 dark:text-white truncate block">
                  {policy.divisionAssignment || 'All Divisions'}
                </span>
              </div>
            </div>

            {/* Weekend Days */}
            <div className="p-3.5 bg-slate-50 dark:bg-slate-700/50 rounded-2xl border border-slate-100 dark:border-slate-700 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                Weekend Days
              </span>
              <div className="flex flex-wrap gap-1.5">
                {dayNames.map((name, idx) => {
                  const isWeekend = policy.weekendDays.includes(idx);
                  return (
                    <span
                      key={idx}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                        isWeekend
                          ? 'bg-violet-600 text-white shadow-xs'
                          : 'bg-slate-200/60 dark:bg-slate-600 text-slate-500 dark:text-slate-300'
                      }`}
                    >
                      {name.slice(0, 3)}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Section 2: Complete Leave Quotas & Rules Overview */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <FileText size={14} className="text-violet-600 dark:text-violet-400" />
                Configured Leave Rules & Quotas ({policy.leaveQuotas.length})
              </h3>
              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2.5 py-1 rounded-full uppercase tracking-wider">
                Full Details View
              </span>
            </div>

            {/* Quotas Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {policy.leaveQuotas.map((quota, idx) => (
                <div
                  key={idx}
                  className="bg-white dark:bg-slate-800/90 rounded-2xl border border-slate-200/70 dark:border-slate-700 p-4 shadow-xs hover:border-violet-300 transition-colors flex flex-col justify-between space-y-3"
                >
                  {/* Quota Header */}
                  <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-700/80 pb-2.5">
                    <div>
                      <h4 className="font-extrabold text-base text-slate-800 dark:text-white capitalize">
                        {quota.leaveType}
                      </h4>
                      <span className="text-[10px] font-bold text-slate-400">
                        ID: {quota.leaveTypeId || quota.leaveType}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-black text-violet-600 dark:text-violet-400">
                        {quota.entitlementDays}d
                      </span>
                      <span className="text-[10px] text-slate-400 block font-medium">per year</span>
                    </div>
                  </div>

                  {/* Quota Key Properties Grid */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2 bg-slate-50 dark:bg-slate-700/40 rounded-xl">
                      <span className="text-[9px] font-extrabold text-slate-400 uppercase block">
                        Accrual Strategy
                      </span>
                      <span className="font-bold text-slate-700 dark:text-slate-200">
                        {quota.isAccrued
                          ? `Accrued (${quota.accrualRate}d/${quota.accrualInterval || 'mo'})`
                          : 'Frontloaded'}
                      </span>
                    </div>

                    <div className="p-2 bg-slate-50 dark:bg-slate-700/40 rounded-xl">
                      <span className="text-[9px] font-extrabold text-slate-400 uppercase block">
                        Max Consecutive
                      </span>
                      <span className="font-bold text-slate-700 dark:text-slate-200">
                        {quota.maxConsecutiveDays ?? quota.maxConsecutive ?? 'Unlimited'} days
                      </span>
                    </div>

                    <div className="p-2 bg-slate-50 dark:bg-slate-700/40 rounded-xl">
                      <span className="text-[9px] font-extrabold text-slate-400 uppercase block">
                        Max Balance Cap
                      </span>
                      <span className="font-bold text-slate-700 dark:text-slate-200">
                        {quota.maxBalanceCap !== null && quota.maxBalanceCap !== undefined
                          ? `${quota.maxBalanceCap} days`
                          : 'Unlimited'}
                      </span>
                    </div>

                    <div className="p-2 bg-slate-50 dark:bg-slate-700/40 rounded-xl">
                      <span className="text-[9px] font-extrabold text-slate-400 uppercase block">
                        Min / Max Request
                      </span>
                      <span className="font-bold text-slate-700 dark:text-slate-200">
                        {quota.minRequestDays ?? 0.5}d - {quota.maxRequestDays ?? '∞'}
                      </span>
                    </div>
                  </div>

                  {/* Rules Badges */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <span
                      className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md ${
                        quota.allowsHalfDay
                          ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-300'
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-400'
                      }`}
                    >
                      {quota.allowsHalfDay ? '✓ Half Day Allowed' : '✕ No Half Day'}
                    </span>

                    <span
                      className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md ${
                        quota.requiresPositiveBalance
                          ? 'bg-violet-50 dark:bg-violet-900/30 text-violet-600 dark:text-violet-300'
                          : 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-300'
                      }`}
                    >
                      {quota.requiresPositiveBalance ? '✓ Positive Balance Req.' : '⚠ Negative Balance Allowed'}
                    </span>

                    <span
                      className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md ${
                        quota.requiresNote
                          ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300'
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-400'
                      }`}
                    >
                      {quota.requiresNote ? '✓ Reason Req.' : '✕ Reason Optional'}
                    </span>

                    <span
                      className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md ${
                        quota.requiresDocument
                          ? 'bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-300'
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-400'
                      }`}
                    >
                      {quota.requiresDocument ? '✓ Document Req.' : '✕ Document Optional'}
                    </span>
                  </div>

                  {/* Cut off & Carry Over details */}
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-700/60 text-[11px] text-slate-500 flex justify-between">
                    <span>
                      Cut-off:{' '}
                      <strong className="text-slate-700 dark:text-slate-300">
                        {quota.isCutOffDifferentFromHireDate
                          ? `Fixed (${quota.cutOffDate || '01-01'})`
                          : 'Hire Date'}
                      </strong>
                    </span>
                    <span>
                      Carry Over:{' '}
                      <strong className="text-slate-700 dark:text-slate-300">
                        {quota.carryOverEnabled ? `Max ${quota.maxCarryOver}d` : 'Disabled'}
                      </strong>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 flex items-center justify-between flex-shrink-0">
          <span className="text-xs font-medium text-slate-400">
            Policy ID: {policy.id}
          </span>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-5 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-300 bg-slate-200/70 dark:bg-slate-700 rounded-xl hover:bg-slate-300 transition-colors cursor-pointer"
            >
              Close
            </button>
            <button
              onClick={() => {
                onClose();
                onEdit();
              }}
              className="px-5 py-2.5 text-sm font-bold text-white bg-violet-600 rounded-xl hover:bg-violet-700 transition-colors shadow-md shadow-violet-500/20 cursor-pointer flex items-center gap-2"
            >
              <Edit2 size={15} /> Edit Policy
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
