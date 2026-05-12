import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface KpiCardProps {
  label: string;
  value: string | number;
  hint?: string;
  Icon?: React.ComponentType<{ className?: string }>;
  accent?: 'default' | 'success' | 'warning';
}

export function KpiCard({ label, value, hint, Icon, accent = 'default' }: KpiCardProps) {
  const accentClass =
    accent === 'success'
      ? 'text-green-700'
      : accent === 'warning'
        ? 'text-yellow-700'
        : 'text-foreground';
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${accentClass}`}>{value}</div>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}
