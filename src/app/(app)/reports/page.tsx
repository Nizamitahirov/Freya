'use client';

import { useState } from 'react';
import { useAppStore, selectBudget } from '@/stores/appStore';
import { money, signed } from '@/lib/format';
import { Card, Stat, StatusBadge, Button } from '@/components/ui/primitives';
import { exportExcel, exportPdf, type ReportData } from '@/lib/export/reports';

export default function ReportsPage() {
  const state = useAppStore();
  const { planningItems, employees, cycles, activeCycleId, companies, activeCompanyId } = state;
  const cycle = cycles.find((c) => c.id === activeCycleId)!;
  const company = companies.find((c) => c.id === activeCompanyId)!;
  const budget = selectBudget(state, cycle.structureId);
  const items = planningItems.filter((i) => i.cycleId === cycle.id);
  const empName = (id: string) => employees.find((e) => e.id === id)?.fullName ?? id;
  const [busy, setBusy] = useState<string | null>(null);

  const totalDelta = items.filter((i) => i.status === 'approved').reduce((s, i) => s + i.deltaGrossAnnual, 0);

  const reportData = (): ReportData => ({
    companyName: company.name,
    cycleName: cycle.name,
    budget: budget
      ? { allocated: budget.allocatedGross, committed: budget.committedGross, spent: budget.spentGross, remaining: budget.remaining }
      : null,
    rows: items.map((i) => ({
      employee: empName(i.employeeId),
      currentNet: i.currentNet,
      newNet: i.newNet,
      newGross: i.newGross,
      newSuperGross: i.newSuperGross,
      delta: i.deltaGrossAnnual,
      reason: i.reason,
      status: i.status,
    })),
  });

  const run = async (kind: 'excel' | 'pdf') => {
    setBusy(kind);
    try {
      if (kind === 'excel') await exportExcel(reportData());
      else await exportPdf(reportData());
    } finally {
      setBusy(null);
    }
  };

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
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCsv} disabled={items.length === 0}>
            ⤓ CSV
          </Button>
          <Button variant="outline" onClick={() => run('excel')} disabled={items.length === 0 || busy !== null}>
            {busy === 'excel' ? '…' : '⤓ Excel'}
          </Button>
          <Button variant="outline" onClick={() => run('pdf')} disabled={items.length === 0 || busy !== null}>
            {busy === 'pdf' ? '…' : '⤓ PDF'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Plan sətri" value={items.length} />
        <Stat label="Təsdiqlənən" value={items.filter((i) => i.status === 'approved').length} accent="var(--color-success)" />
        <Stat label="Təsdiq Δgross (il)" value={money(totalDelta)} accent="var(--color-primary)" />
        <Stat label="Büdcə qalığı" value={budget ? money(budget.remaining) : '—'} accent={budget?.status === 'over' ? 'var(--color-destructive)' : 'var(--color-success)'} />
      </div>

      <Card title="Büdcə icra hesabatı">
        {budget ? (
          <table className="tbl">
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
          <table className="tbl">
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
          İxrac formatları: CSV · Excel (ExcelJS) · PDF (jsPDF) — hamısı aktivdir.
        </p>
      </Card>
    </div>
  );
}
