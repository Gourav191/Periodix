import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface StatusCardProps {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
  actions?: ReactNode;
}

export function StatusCard({ title, icon, children, className, actions }: StatusCardProps) {
  return (
    <div className={cn('card-soft p-5', className)}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {icon && <div className="text-muted-foreground">{icon}</div>}
          <h3 className="font-medium text-foreground">{title}</h3>
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
}

interface StatItemProps {
  label: string;
  value: string | number;
  status?: 'success' | 'warning' | 'error' | 'neutral';
}

export function StatItem({ label, value, status = 'neutral' }: StatItemProps) {
  const statusClasses = {
    success: 'text-success',
    warning: 'text-warning',
    error: 'text-destructive',
    neutral: 'text-foreground',
  };

  return (
    <div className="flex items-center justify-between py-2 border-b border-border last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={cn('text-sm font-medium', statusClasses[status])}>{value}</span>
    </div>
  );
}

interface WarningItemProps {
  message: string;
  level?: 'high' | 'medium' | 'low';
}

export function WarningItem({ message, level = 'medium' }: WarningItemProps) {
  const levelClasses = {
    high: 'bg-destructive/10 text-destructive border-destructive/20',
    medium: 'bg-warning/10 text-warning-foreground border-warning/20',
    low: 'bg-muted text-muted-foreground border-muted',
  };

  return (
    <div className={cn('px-3 py-2 rounded-md text-sm border', levelClasses[level])}>
      {message}
    </div>
  );
}
