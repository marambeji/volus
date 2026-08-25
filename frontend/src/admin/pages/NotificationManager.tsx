import { useEffect, useState } from 'react';
import {
  Mail,
  BellRing,
  Clock,
  Send,
  History as HistoryIcon,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Inbox,
} from 'lucide-react';
import StatCard from '../components/ui/StatCard';
import {
  getReminderSettings,
  updateReminderSettings,
  getReminderHistory,
  runReminderCheckNow,
  type ReminderSettings,
  type ReminderHistoryEntry,
} from '../../services/remindersApi';
import { ApiError } from '../../services/apiClient';

const DELAY_PRESETS = [24, 48, 72];

export default function NotificationManager() {
  const [settings, setSettings] = useState<ReminderSettings | null>(null);
  const [history, setHistory] = useState<ReminderHistoryEntry[]>([]);
  const [enabled, setEnabled] = useState(true);
  const [delayHours, setDelayHours] = useState(48);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [runResult, setRunResult] = useState<{ checked: number; sent: number } | null>(null);

  const loadData = async (signal?: AbortSignal) => {
    setLoading(true);
    setApiError(null);
    try {
      const [settingsRes, historyRes] = await Promise.all([
        getReminderSettings(signal),
        getReminderHistory(50, signal),
      ]);
      setSettings(settingsRes);
      setEnabled(settingsRes.enabled);
      setDelayHours(settingsRes.delayHours);
      setHistory(historyRes);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      const msg = err instanceof Error ? err.message : 'Failed to load reminder settings';
      setApiError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    void loadData(controller.signal);
    return () => controller.abort();
  }, []);

  const isDirty = settings ? enabled !== settings.enabled || delayHours !== settings.delayHours : false;

  async function handleSave() {
    setSaving(true);
    setSaveMessage(null);
    setApiError(null);
    try {
      const updated = await updateReminderSettings({ enabled, delayHours });
      setSettings(updated);
      setEnabled(updated.enabled);
      setDelayHours(updated.delayHours);
      setSaveMessage('Settings saved.');
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err: unknown) {
      const msg =
        err instanceof ApiError ? err.validationMessages.join(' | ') || err.message : 'Failed to save settings';
      setApiError(msg);
    } finally {
      setSaving(false);
    }
  }

  async function handleRunNow() {
    setRunning(true);
    setRunResult(null);
    setApiError(null);
    try {
      const result = await runReminderCheckNow();
      setRunResult(result);
      const historyRes = await getReminderHistory(50);
      setHistory(historyRes);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to run reminder check';
      setApiError(msg);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-violet-600 text-white flex items-center justify-center shadow-lg shadow-violet-600/20 flex-shrink-0">
            <Mail size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Notification Manager</h1>
            <p className="text-sm text-slate-400 mt-1">
              Configure automated email reminders for pending leave approvals
            </p>
          </div>
        </div>
      </div>

      {apiError && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl flex items-center justify-between text-red-600 dark:text-red-400 text-sm">
          <div className="flex items-center gap-2">
            <AlertCircle size={18} />
            <span>{apiError}</span>
          </div>
          <button onClick={() => void loadData()} className="flex items-center gap-1 text-xs font-bold underline hover:opacity-80">
            <RefreshCw size={12} /> Retry
          </button>
        </div>
      )}

      {loading ? (
        <div className="py-20 text-center text-slate-400 text-sm flex items-center justify-center gap-2">
          <RefreshCw size={18} className="animate-spin" /> Loading reminder settings...
        </div>
      ) : (
        <>
          {/* Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <StatCard
              title="Reminder Status"
              value={settings?.enabled ? 'Enabled' : 'Disabled'}
              icon={<BellRing size={18} />}
              color={settings?.enabled ? 'bg-emerald-500' : 'bg-slate-400'}
            />
            <StatCard
              title="Reminder Delay"
              value={`${settings?.delayHours ?? 48}h`}
              icon={<Clock size={18} />}
              color="bg-violet-500"
              subtitle="After a step becomes pending"
            />
            <StatCard
              title="Reminders Sent"
              value={history.length}
              icon={<Send size={18} />}
              color="bg-indigo-500"
              subtitle="Total logged"
            />
          </div>

          {/* Settings Card */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-bold text-slate-800 dark:text-white text-base">Reminder Configuration</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Emails the current approver (Manager, HR or Admin) when a leave request has been pending too long.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEnabled((v) => !v)}
                className={`w-12 h-6 rounded-full p-1 transition-colors focus:outline-none flex-shrink-0 cursor-pointer ${
                  enabled ? 'bg-violet-600' : 'bg-slate-200 dark:bg-slate-700'
                }`}
                title={enabled ? 'Disable reminders' : 'Enable reminders'}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white transition-transform ${
                    enabled ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <div className={`space-y-3 transition-opacity ${enabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Send reminder after step is pending for
              </label>
              <div className="flex flex-wrap items-center gap-2">
                {DELAY_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setDelayHours(preset)}
                    className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-colors cursor-pointer ${
                      delayHours === preset
                        ? 'bg-violet-600 text-white shadow-sm'
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-violet-100 dark:hover:bg-violet-950/40'
                    }`}
                  >
                    {preset}h
                  </button>
                ))}
                <div className="flex items-center gap-1.5 ml-1">
                  <input
                    type="number"
                    min={1}
                    max={720}
                    value={delayHours}
                    onChange={(e) => setDelayHours(Math.max(1, Math.min(720, Number(e.target.value) || 1)))}
                    className="w-20 px-3 py-1.5 text-sm bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500 font-semibold"
                  />
                  <span className="text-xs font-semibold text-slate-400">hours (custom)</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-slate-100 dark:border-slate-700">
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving || !isDirty}
                className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-violet-600/20 cursor-pointer"
              >
                {saving && <RefreshCw size={14} className="animate-spin" />}
                Save Settings
              </button>
              <button
                type="button"
                onClick={() => void handleRunNow()}
                disabled={running}
                className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-50 text-slate-700 dark:text-slate-200 rounded-xl font-bold text-sm transition-all cursor-pointer"
              >
                {running ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
                Run Check Now
              </button>

              {saveMessage && (
                <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 text-xs font-bold">
                  <CheckCircle2 size={14} /> {saveMessage}
                </span>
              )}
              {runResult && (
                <span className="flex items-center gap-1.5 text-violet-600 dark:text-violet-400 text-xs font-bold">
                  <CheckCircle2 size={14} /> Checked {runResult.checked} pending step(s), sent {runResult.sent} reminder(s).
                </span>
              )}
            </div>
          </div>

          {/* History */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <HistoryIcon size={16} className="text-slate-400" />
                <h2 className="font-bold text-slate-800 dark:text-white text-sm">Reminder History</h2>
              </div>
              <button
                onClick={() => void loadData()}
                className="flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-violet-600 transition-colors cursor-pointer"
              >
                <RefreshCw size={12} /> Refresh
              </button>
            </div>

            {history.length === 0 ? (
              <div className="py-14 text-center space-y-2">
                <Inbox size={32} className="mx-auto text-slate-300 dark:text-slate-600" />
                <p className="text-sm font-bold text-slate-500 dark:text-slate-400">No reminders sent yet</p>
                <p className="text-xs text-slate-400">
                  Reminders will appear here once a pending approval crosses the configured delay.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-900/40 text-slate-400 uppercase tracking-wider font-bold border-b border-slate-100 dark:border-slate-700">
                      <th className="px-6 py-3">Employee</th>
                      <th className="px-6 py-3">Leave Type</th>
                      <th className="px-6 py-3">Reminded Approver</th>
                      <th className="px-6 py-3">Dates</th>
                      <th className="px-6 py-3">Sent At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                    {history.map((entry) => (
                      <tr key={entry.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/30 transition-colors">
                        <td className="px-6 py-3 font-bold text-slate-700 dark:text-slate-200">
                          {entry.request?.employee?.fullName || '—'}
                        </td>
                        <td className="px-6 py-3 text-slate-500 dark:text-slate-400">
                          {entry.request?.leaveType?.label || '—'}
                        </td>
                        <td className="px-6 py-3 text-slate-500 dark:text-slate-400">
                          {entry.approver?.fullName || entry.approverEmail}
                        </td>
                        <td className="px-6 py-3 text-slate-500 dark:text-slate-400">
                          {entry.request ? `${entry.request.startDate} → ${entry.request.endDate}` : '—'}
                        </td>
                        <td className="px-6 py-3 text-slate-500 dark:text-slate-400">
                          {new Date(entry.sentAt).toLocaleString('en-GB', {
                            day: '2-digit',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
