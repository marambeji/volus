import { AlertTriangle, X } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  confirming?: boolean;
}

export default function ConfirmModal({ isOpen, onClose, onConfirm, title, message, confirmLabel = 'Confirm', danger = false, confirming = false }: Props) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-start gap-4">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${danger ? 'bg-red-100' : 'bg-amber-100'}`}>
            <AlertTriangle size={20} className={danger ? 'text-red-600' : 'text-amber-600'} />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-slate-800 dark:text-white text-sm">{title}</h3>
            <p className="text-slate-500 dark:text-slate-400 text-xs mt-1 leading-relaxed whitespace-pre-line">{message}</p>
          </div>
          <button onClick={onClose} disabled={confirming} className="text-slate-400 hover:text-slate-600 disabled:opacity-50 cursor-pointer"><X size={16} /></button>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} disabled={confirming} className="flex-1 px-4 py-2.5 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 rounded-xl transition-colors cursor-pointer">Cancel</button>
          <button onClick={onConfirm} disabled={confirming} className={`flex-1 px-4 py-2.5 text-sm font-bold text-white rounded-xl transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 ${danger ? 'bg-red-600 hover:bg-red-700' : 'bg-violet-600 hover:bg-violet-700'}`}>
            {confirming ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
