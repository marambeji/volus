interface EmptyStateProps {
  title?: string;
  message?: string;
  icon?: string;
}

export default function EmptyState({
  title = 'Nothing here yet',
  message = 'No results found.',
  icon = '🔍',
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
      <span className="text-4xl">{icon}</span>
      <h3 className="text-slate-700 font-semibold text-base">{title}</h3>
      <p className="text-slate-400 text-sm max-w-xs">{message}</p>
    </div>
  );
}
