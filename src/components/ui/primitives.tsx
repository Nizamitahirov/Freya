'use client';

import type { ButtonHTMLAttributes, ReactNode } from 'react';

export function Card({
  children,
  className = '',
  title,
  action,
}: {
  children: ReactNode;
  className?: string;
  title?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div
      className={`bg-card border border-border rounded-xl shadow-card ${className}`}
    >
      {(title || action) && (
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          {typeof title === 'string' ? <h2 className="font-bold text-base">{title}</h2> : title}
          {action}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
}

type ButtonVariant = 'primary' | 'ghost' | 'success' | 'danger' | 'warn' | 'outline';

const btnClasses: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-primary-foreground hover:opacity-90 shadow-glow',
  success: 'bg-success text-white hover:opacity-90',
  danger: 'bg-destructive text-white hover:opacity-90',
  warn: 'bg-warning text-white hover:opacity-90',
  ghost: 'bg-transparent text-foreground hover:bg-secondary',
  outline: 'bg-transparent border border-border text-foreground hover:bg-secondary',
};

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...rest
}: {
  variant?: ButtonVariant;
  size?: 'sm' | 'md';
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  const sz = size === 'sm' ? 'text-sm px-2.5 py-1.5' : 'text-sm px-4 py-2';
  return (
    <button
      className={`inline-flex items-center justify-center gap-1.5 rounded-xl font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed ${sz} ${btnClasses[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

const statusStyles: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  submitted: 'bg-info/15 text-info',
  approved: 'bg-success/15 text-success',
  rejected: 'bg-destructive/15 text-destructive',
  returned: 'bg-warning/15 text-warning',
  edited_pending: 'bg-primary-soft text-primary',
  withdrawn: 'bg-muted text-muted-foreground',
  open: 'bg-muted text-muted-foreground',
  in_review: 'bg-info/15 text-info',
  finalized: 'bg-success/15 text-success',
  cancelled: 'bg-destructive/15 text-destructive',
  below: 'bg-info/15 text-info',
  at: 'bg-success/15 text-success',
  above: 'bg-warning/15 text-warning',
  ok: 'bg-success/15 text-success',
  warning: 'bg-warning/15 text-warning',
  over: 'bg-destructive/15 text-destructive',
};

const statusLabels: Record<string, string> = {
  draft: 'Qaralama',
  submitted: 'Göndərilib',
  approved: 'Təsdiq',
  rejected: 'Rədd',
  returned: 'Qaytarılıb',
  edited_pending: 'Düzəldilib',
  withdrawn: 'Geri çəkilib',
  open: 'Açıq',
  in_review: 'Review-də',
  finalized: 'Finalized',
  cancelled: 'Ləğv',
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${statusStyles[status] ?? 'bg-muted text-muted-foreground'}`}
    >
      {statusLabels[status] ?? status}
    </span>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-sm outline-none focus:ring-2 focus:ring-ring/40 mono ${props.className ?? ''}`}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-sm outline-none focus:ring-2 focus:ring-ring/40 ${props.className ?? ''}`}
    />
  );
}

export function Stat({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  accent?: string;
}) {
  return (
    <div className="bg-card border border-border rounded-xl shadow-card p-5">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-2xl font-extrabold mt-1 mono" style={accent ? { color: accent } : undefined}>
        {value}
      </div>
      {sub && <div className="text-sm text-muted-foreground mt-1">{sub}</div>}
    </div>
  );
}

export function ProgressBar({ value, status }: { value: number; status: 'ok' | 'warning' | 'over' }) {
  const color =
    status === 'over' ? 'var(--color-destructive)' : status === 'warning' ? 'var(--color-warning)' : 'var(--color-success)';
  return (
    <div className="w-full h-2.5 rounded-full bg-secondary overflow-hidden">
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${Math.min(100, value * 100)}%`, background: color }}
      />
    </div>
  );
}
