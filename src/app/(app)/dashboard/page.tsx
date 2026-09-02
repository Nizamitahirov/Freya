'use client';

import Link from 'next/link';
import { useAppStore, selectBudget } from '@/stores/appStore';
import { money } from '@/lib/format';
import { compaRatio, bandPosition } from '@/lib/comp';
import { Card, Stat, StatusBadge, ProgressBar, Button } from '@/components/ui/primitives';
import { BudgetComposition, DeltaByEmployee, CompaRatioChart } from '@/components/charts/DashboardCharts';
import { Loading } from '@/components/ui/EmptyState';

export default function DashboardPage() {
  const state = useAppStore();
  const { employees, cycles, activeCompanyId, activeCycleId, planningItems, companies, grades } = state;
  const company = companies.find((c) => c.id === activeCompanyId);
  const cycle = cycles.find((c) => c.id === activeCycleId) ?? cycles[0];
  if (!company || !cycle) return <Loading what="Dashboard" />;
  const budget = selectBudget(state, cycle.structureId);
  const roster = employees.filter((e) => e.companyId === activeCompanyId);

  const totalGross = roster.reduce((s, e) => s + e.currentGross, 0);
  const totalSuper = roster.reduce((s, e) => s + e.currentSuperGross, 0);
  const items = planningItems.filter((i) => i.cycleId === cycle.id);

  const deltaData = items
    .filter((i) => i.deltaGrossAnnual !== 0)
    .map((i) => ({ name: employees.find((e) => e.id === i.employeeId)?.fullName ?? '', delta: i.deltaGrossAnnual }));

  const compaData = roster.map((e) => {
    const mid = grades.find((g) => g.id === e.gradeId)?.levels.find((l) => l.id === e.levelId)?.mid ?? e.currentGross;
    const ratio = compaRatio(e.currentGross, mid);
    return { name: e.fullName, ratio, position: bandPosition(ratio) };
  });

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-extrabold">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Stat label="Əməkdaş" value={roster.length} />
        <Stat label="Aylıq gross (cəm)" value={money(totalGross)} />
        <Stat label="Aylıq supergross (cəm)" value={money(totalSuper)} sub="tam şirkət xərci" />
        <Stat label="Aktiv plan sətri" value={items.length} accent="var(--color-primary)" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card title="Büdcə icrası" action={<Link href="/planning" className="text-sm text-primary font-semibold">Planlaşdır →</Link>}>
          {budget ? (
            <div className="space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">İstifadə</span>
                <span className="mono font-semibold">
                  {money(budget.committedGross + budget.spentGross)} / {money(budget.allocatedGross)}
                </span>
              </div>
              <ProgressBar value={budget.utilization} status={budget.status} />
              <BudgetComposition committed={budget.committedGross} spent={budget.spentGross} remaining={budget.remaining} />
              <div className="grid grid-cols-3 gap-3 text-center pt-2">
                <div>
                  <div className="text-xs text-muted-foreground">Committed</div>
                  <div className="mono font-semibold text-warning">{money(budget.committedGross)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Spent</div>
                  <div className="mono font-semibold text-info">{money(budget.spentGross)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Remaining</div>
                  <div className={`mono font-semibold ${budget.status === 'over' ? 'text-destructive' : 'text-success'}`}>
                    {money(budget.remaining)}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Büdcə təyin edilməyib.</p>
          )}
        </Card>

        <Card title="Aktiv dövr" action={<Link href="/review" className="text-sm text-primary font-semibold">Review →</Link>}>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="font-semibold">{cycle.name}</span>
              <StatusBadge status={cycle.status} />
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {(['submitted', 'approved', 'returned', 'rejected'] as const).map((s) => (
                <div key={s} className="flex justify-between border-b border-border py-1">
                  <StatusBadge status={s} />
                  <span className="mono">{items.filter((i) => i.status === s).length}</span>
                </div>
              ))}
            </div>
            {cycle.status === 'open' && (
              <Link href="/planning">
                <Button size="sm" className="w-full mt-2">Planlaşdırmaya başla</Button>
              </Link>
            )}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card title="Δ Büdcə təsiri (əməkdaş üzrə, illik gross)">
          <DeltaByEmployee data={deltaData} />
        </Card>
        <Card title="Compa-ratio (band mid-ə görə)">
          <div className="flex gap-3 mb-2 text-xs">
            <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--color-info)' }} /> below</span>
            <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--color-success)' }} /> at</span>
            <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--color-warning)' }} /> above</span>
          </div>
          <CompaRatioChart data={compaData} />
        </Card>
      </div>

      <Card title="Əməkdaş kompensasiyası (cari)">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground border-b border-border">
                <th className="px-2 py-2">Ad</th>
                <th className="px-2 py-2">Grade/Level</th>
                <th className="px-2 py-2 text-right">Net</th>
                <th className="px-2 py-2 text-right">Gross</th>
                <th className="px-2 py-2 text-right">SuperGross</th>
                <th className="px-2 py-2 text-right">Meal</th>
              </tr>
            </thead>
            <tbody>
              {roster.map((e) => (
                <tr key={e.id} className="border-b border-border last:border-0">
                  <td className="px-2 py-2 font-medium">{e.fullName}</td>
                  <td className="px-2 py-2 text-xs">{e.gradeId}/{e.levelId}</td>
                  <td className="px-2 py-2 text-right mono">{money(e.currentNet)}</td>
                  <td className="px-2 py-2 text-right mono">{money(e.currentGross)}</td>
                  <td className="px-2 py-2 text-right mono">{money(e.currentSuperGross)}</td>
                  <td className="px-2 py-2 text-right mono">{money(e.currentMeal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
