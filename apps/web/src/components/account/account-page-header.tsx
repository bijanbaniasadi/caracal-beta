// ─── Account page header ───────────────────────────────────────────────────────

interface AccountPageHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function AccountPageHeader({ title, description, action }: AccountPageHeaderProps) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div>
        <h1 className="font-display text-xl font-bold text-brand-text">{title}</h1>
        {description && (
          <p className="mt-0.5 text-sm text-brand-muted">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
