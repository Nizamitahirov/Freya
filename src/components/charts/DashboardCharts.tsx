'use client';

import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { money } from '@/lib/format';

const AXIS = { fontSize: 11, fill: 'var(--color-muted-foreground)' };
const GRID = 'var(--color-border)';

function ChartTip({ active, payload, label, fmt }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-xl shadow-card px-3 py-2 text-xs">
      <div className="font-semibold mb-0.5">{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="mono">
          {p.name}: {fmt ? fmt(p.value) : p.value}
        </div>
      ))}
    </div>
  );
}

/** Büdcə tərkibi — tək-hue sequential (primary açıq→tünd) + neytral qalıq (part-to-whole). */
export function BudgetComposition({
  committed,
  spent,
  remaining,
}: {
  committed: number;
  spent: number;
  remaining: number;
}) {
  const data = [{ name: 'Büdcə', committed, spent, remaining: Math.max(0, remaining) }];
  return (
    <ResponsiveContainer width="100%" height={90}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
        <XAxis type="number" hide />
        <YAxis type="category" dataKey="name" hide />
        <Tooltip content={<ChartTip fmt={money} />} cursor={{ fill: 'transparent' }} />
        <Bar dataKey="committed" name="Rezerv" stackId="a" fill="var(--color-primary)" radius={[6, 0, 0, 6]} barSize={26} />
        <Bar dataKey="spent" name="Xərclənmiş" stackId="a" fill="#3a3ad4" barSize={26} />
        <Bar dataKey="remaining" name="Qalıq" stackId="a" fill="var(--color-secondary)" radius={[0, 6, 6, 0]} barSize={26} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Δ gross (illik) əməkdaş üzrə — tək seriya, primary hue, birbaşa etiket. */
export function DeltaByEmployee({ data }: { data: { name: string; delta: number }[] }) {
  if (data.length === 0) return <Empty />;
  return (
    <ResponsiveContainer width="100%" height={Math.max(140, data.length * 44)}>
      <BarChart data={data} layout="vertical" margin={{ top: 8, right: 56, bottom: 8, left: 8 }}>
        <XAxis type="number" tick={AXIS} axisLine={{ stroke: GRID }} tickLine={false} tickFormatter={(v) => `${v}`} />
        <YAxis type="category" dataKey="name" width={120} tick={AXIS} axisLine={false} tickLine={false} />
        <Tooltip content={<ChartTip fmt={money} />} cursor={{ fill: 'var(--color-secondary)' }} />
        <ReferenceLine x={0} stroke={GRID} />
        <Bar dataKey="delta" name="Δ gross (il)" fill="var(--color-primary)" radius={4} barSize={18}>
          <LabelList dataKey="delta" position="right" formatter={(v: number) => money(v)} style={{ fontSize: 11, fill: 'var(--color-foreground)' }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Compa-ratio əməkdaş üzrə — status rəngi yalnız band mənası üçün (below/at/above) + 1.0 referens. */
export function CompaRatioChart({
  data,
}: {
  data: { name: string; ratio: number; position: 'below' | 'at' | 'above' }[];
}) {
  if (data.length === 0) return <Empty />;
  const color = (p: string) =>
    p === 'below' ? 'var(--color-info)' : p === 'above' ? 'var(--color-warning)' : 'var(--color-success)';
  return (
    <ResponsiveContainer width="100%" height={Math.max(140, data.length * 44)}>
      <BarChart data={data} layout="vertical" margin={{ top: 8, right: 48, bottom: 8, left: 8 }}>
        <XAxis type="number" domain={[0, 'dataMax + 0.3']} tick={AXIS} axisLine={{ stroke: GRID }} tickLine={false} />
        <YAxis type="category" dataKey="name" width={120} tick={AXIS} axisLine={false} tickLine={false} />
        <Tooltip content={<ChartTip />} cursor={{ fill: 'var(--color-secondary)' }} />
        <ReferenceLine x={1} stroke="var(--color-muted-foreground)" strokeDasharray="4 3" label={{ value: 'mid 1.0', fontSize: 10, fill: 'var(--color-muted-foreground)', position: 'top' }} />
        <Bar dataKey="ratio" name="Compa-ratio" radius={4} barSize={18}>
          {data.map((d) => (
            <Cell key={d.name} fill={color(d.position)} />
          ))}
          <LabelList dataKey="ratio" position="right" style={{ fontSize: 11, fill: 'var(--color-foreground)' }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function Empty() {
  return (
    <div className="h-32 grid place-items-center text-sm text-muted-foreground">
      Məlumat yoxdur — planlaşdırmaya başlayın.
    </div>
  );
}
