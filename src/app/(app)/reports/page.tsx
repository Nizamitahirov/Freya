'use client';

import { useAppStore, selectBudget } from '@/stores/appStore';
import { money, signed } from '@/lib/format';
import { Card, Stat, StatusBadge, Button } from '@/components/ui/primitives';

export default function ReportsPage() {
  const state = useAppStore();
  const { planningItems, employees, cycles, activeCycleId } = state;
  const cycle = cycles.find((c) => c.id === activeCycleId)!;
  const budget = selectBudget(state, cycle.structureId);
  const items = planningItems.filter((i) => i.cycleId === cycle.id);
  const empName = (id: string) => employees.find((e) => e.id === id)?.fullName ?? id;

  const totalDelta = items.filter((i) => i.status === 'approved').reduce((s, i) => s + i.deltaGrossAnnual, 0);

  const exportCsv = () => {
    const header = 'Əməkdaş,Cari net,Yeni net,Yeni gross,Δ büdcə (il),Səbəb,Status';
    const lines = items.map(
      (i) => `${empName(i.employeeId)},${i.currentNet},${i.newNet},${i.newGross},${i.deltaGrossAnnual},${i.reason},${i.status}`,
    );
    const blob = new Blob([[header, ...lines].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `freya-${cycle.id}-report.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold">Hesabatlar</h1>
        <Button variant="outline" onClick={exportCsv} disabled={items.length === 0}>
          ⤓ CSV ixrac
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Plan sətri" value={items.length} />
        <Stat label="Təsdiqlənən" value={items.filter((i) => i.status === 'approved').length} accent="var(--color-success)" />
        <Stat label="Təsdiq Δgross (il)" value={money(totalDelta)} accent="var(--color-primary)" />
        <Stat label="Büdcə qalığı" value={budget ? money(budget.remaining) : '—'} accent={budget?.status === 'over' ? 'var(--color-destructive)' : 'var(--color-success)'} />
      </div>

      <Card title="Büdcə icra hesabatı">
        {budget ? (
          <table className="w-full text-sm">
            <tbody>
              {[
                ['Ayrılmış (allocated)', budget.allocatedGross],
                ['Rezerv (committed)', budget.committedGross],
                ['Xərclənmiş (spent)', budget.spentGross],
                ['Qalıq (remaining)', budget.remaining],
              ].map(([k, v]) => (
                <tr key={k as string} className="border-b border-border last:border-0">
                  <td className="py-2 text-muted-foreground">{k}</td>
                  <td className="py-2 text-right mono">{money(v as number)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-muted-foreground">Büdcə yoxdur.</p>
        )}
      </Card>

      <Card title="Before / After (əməkdaş üzrə)">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground border-b border-border">
                <th className="px-2 py-2">Əməkdaş</th>
                <th className="px-2 py-2 text-right">Cari net</th>
                <th className="px-2 py-2 text-right">Yeni net</th>
                <th className="px-2 py-2 text-right">Δ gross (il)</th>
                <th className="px-2 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr><td colSpan={5} className="py-6 text-center text-muted-foreground text-sm">Sətir yoxdur.</td></tr>
              )}
              {items.map((i) => (
                <tr key={i.id} className="border-b border-border last:border-0">
                  <td className="px-2 py-2 font-medium">{empName(i.employeeId)}</td>
                  <td className="px-2 py-2 text-right mono">{money(i.currentNet)}</td>
                  <td className="px-2 py-2 text-right mono">{money(i.newNet)}</td>
                  <td className={`px-2 py-2 text-right mono ${i.deltaGrossAnnual >= 0 ? 'text-success' : 'text-destructive'}`}>{signed(i.deltaGrossAnnual)}</td>
                  <td className="px-2 py-2"><StatusBadge status={i.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          Excel (ExcelJS) və PDF (html2pdf.js) ixracı Faza 2-də. Hazırda CSV ixrac aktivdir.
        </p>
      </Card>
    </div>
  );
}
