'use client';

import { useMemo, useState } from 'react';
import { useAppStore, selectBudget, type PlanPatch } from '@/stores/appStore';
import { planCompensation, validateAgainstBand, type CompContext } from '@/lib/comp';
import { money, signed } from '@/lib/format';
import { monthsToYearEnd } from '@/lib/format';
import { Button, Card, Input, Select, StatusBadge, ProgressBar, Stat } from '@/components/ui/primitives';
import type { Employee, PlanningItem } from '@/types';

const REASONS: PlanningItem['reason'][] = [
  'merit',
  'promotion',
  'market_adjustment',
  'retention',
  'correction',
];

export default function PlanningPage() {
  const state = useAppStore();
  const { employees, cycles, activeCycleId, activeCompanyId, companies, planningItems, role } = state;
  const cycle = cycles.find((c) => c.id === activeCycleId)!;
  const company = companies.find((c) => c.id === activeCompanyId)!;
  const budget = selectBudget(state, cycle.structureId);
  const roster = employees.filter((e) => e.companyId === activeCompanyId);

  const canEdit = role === 'Manager' || role === 'HRAdmin' || role === 'CompanyAdmin';
  const cycleLocked = cycle.status === 'finalized';

  const drafts = planningItems.filter((i) => i.cycleId === cycle.id && i.status === 'draft');
  const returned = planningItems.filter((i) => i.cycleId === cycle.id && i.status === 'returned');

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold">Planlaşdırma</h1>
          <p className="text-sm text-muted-foreground">
            {cycle.name} · <StatusBadge status={cycle.status} />
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => confirm('Demo datanı sıfırlamaq?') && state.resetDemo()}
          >
            Reset
          </Button>
          <Button
            disabled={!canEdit || cycleLocked || drafts.length === 0}
            onClick={() => state.submitCycle(cycle.id)}
          >
            Review-ə göndər ({drafts.length})
          </Button>
        </div>
      </div>

      {budget && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Stat label="Ayrılmış (gross)" value={money(budget.allocatedGross)} />
          <Stat label="Rezerv (committed)" value={money(budget.committedGross)} accent="var(--color-warning)" />
          <Stat label="Xərclənmiş (spent)" value={money(budget.spentGross)} accent="var(--color-info)" />
          <Stat
            label="Qalıq (remaining)"
            value={money(budget.remaining)}
            accent={budget.status === 'over' ? 'var(--color-destructive)' : 'var(--color-success)'}
            sub={<ProgressBar value={budget.utilization} status={budget.status} />}
          />
        </div>
      )}

      {returned.length > 0 && (
        <Card className="border-warning/40">
          <p className="text-sm">
            <b className="text-warning">{returned.length}</b> sətir HR tərəfindən qaytarılıb — düzəldib
            yenidən göndərin.
          </p>
        </Card>
      )}

      <Card className="!p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground border-b border-border">
                <th className="px-4 py-3">Əməkdaş</th>
                <th className="px-4 py-3">Grade/Level</th>
                <th className="px-4 py-3 text-right">Cari net</th>
                <th className="px-4 py-3">Giriş</th>
                <th className="px-4 py-3 text-right">Yeni net</th>
                <th className="px-4 py-3 text-right">Yeni gross</th>
                <th className="px-4 py-3 text-right">Meal</th>
                <th className="px-4 py-3 text-right">Δ Büdcə (il)</th>
                <th className="px-4 py-3">Band</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {roster.map((emp) => (
                <PlanningRow
                  key={emp.id}
                  emp={emp}
                  cycleYear={cycle.year}
                  cycleId={cycle.id}
                  taxYear={company.taxProfile.year}
                  mealLimit={company.mealLimit}
                  item={planningItems.find((i) => i.employeeId === emp.id && i.cycleId === cycle.id)}
                  canEdit={canEdit && !cycleLocked}
                />
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function PlanningRow({
  emp,
  item,
  cycleId,
  cycleYear,
  taxYear,
  mealLimit,
  canEdit,
}: {
  emp: Employee;
  item?: PlanningItem;
  cycleId: string;
  cycleYear: number;
  taxYear: '2025' | '2026';
  mealLimit: number;
  canEdit: boolean;
}) {
  const upsert = useAppStore((s) => s.upsertPlanningItem);
  // Grade obyektini birbaşa seç (referens stabil qalır); band-i render body-də hesabla —
  // selektor hər render-də yeni obyekt qaytarsa sonsuz re-render olur (React #185).
  const grade = useAppStore((s) => s.grades.find((g) => g.id === emp.gradeId));
  const level = grade?.levels.find((l) => l.id === emp.levelId);
  const band = level ? { min: level.min, mid: level.mid, max: level.max, name: level.name } : null;

  const [mode, setMode] = useState<PlanPatch['inputMode']>(item?.inputMode ?? 'percent');
  const [value, setValue] = useState<number>(item?.inputValue ?? 0);
  const [reason, setReason] = useState<PlanningItem['reason']>(item?.reason ?? 'merit');

  const editable = canEdit && (!item || ['draft', 'returned'].includes(item.status));

  const ctx: CompContext = { ...emp.ctx, year: taxYear };
  const preview = useMemo(
    () =>
      planCompensation({
        mode,
        value,
        currentNet: emp.currentNet,
        currentGross: emp.currentGross,
        currentMeal: emp.currentMeal,
        ctx,
        mealLimit,
        effectiveMonths: monthsToYearEnd(`${cycleYear}-01-01`, cycleYear),
      }),
    [mode, value, emp, mealLimit, cycleYear, taxYear],
  );

  const bandCheck = band ? validateAgainstBand(preview.newGross, band) : { level: 'ok' as const, message: undefined };
  const shown = item && !editable ? item : preview;
  const deltaColor =
    shown.deltaGrossAnnual > 0 ? 'text-success' : shown.deltaGrossAnnual < 0 ? 'text-destructive' : 'text-muted-foreground';

  return (
    <tr className="border-b border-border last:border-0 align-middle">
      <td className="px-4 py-3">
        <div className="font-semibold">{emp.fullName}</div>
        <div className="text-xs text-muted-foreground mono">{emp.badge}</div>
      </td>
      <td className="px-4 py-3 text-xs">
        {emp.gradeId} / {band?.name ?? emp.levelId}
      </td>
      <td className="px-4 py-3 text-right mono">{money(emp.currentNet)}</td>
      <td className="px-4 py-3">
        {editable ? (
          <div className="flex gap-1 items-center min-w-[190px]">
            <Select value={mode} onChange={(e) => setMode(e.target.value as PlanPatch['inputMode'])} className="!w-24 !py-1.5">
              <option value="percent">%</option>
              <option value="amount">+₼</option>
              <option value="absolute">=net</option>
            </Select>
            <Input
              type="number"
              value={value}
              onChange={(e) => setValue(Number(e.target.value) || 0)}
              className="!w-24 !py-1.5"
            />
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">
            {item?.inputMode} {item?.inputValue}
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-right mono">{money(shown.newNet)}</td>
      <td className="px-4 py-3 text-right mono">{money(shown.newGross)}</td>
      <td className="px-4 py-3 text-right mono">{money(shown.newMeal)}</td>
      <td className={`px-4 py-3 text-right mono ${deltaColor}`}>{signed(shown.deltaGrossAnnual)}</td>
      <td className="px-4 py-3">
        {bandCheck.level === 'error' ? (
          <span className="text-xs text-destructive font-semibold" title={bandCheck.message}>
            ⚠ max aşılıb
          </span>
        ) : bandCheck.level === 'warn' ? (
          <span className="text-xs text-warning" title={bandCheck.message}>
            below
          </span>
        ) : (
          <span className="text-xs text-success">ok</span>
        )}
      </td>
      <td className="px-4 py-3">
        <StatusBadge status={item?.status ?? 'draft'} />
      </td>
      <td className="px-4 py-3">
        {editable && (
          <div className="flex gap-1">
            <Select value={reason} onChange={(e) => setReason(e.target.value as PlanningItem['reason'])} className="!w-28 !py-1.5 !text-xs">
              {REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </Select>
            <Button
              size="sm"
              disabled={bandCheck.level === 'error' || value === 0}
              onClick={() => upsert(emp.id, cycleId, { inputMode: mode, inputValue: value, reason })}
            >
              {item?.status === 'returned' ? 'Yenidən' : 'Saxla'}
            </Button>
          </div>
        )}
      </td>
    </tr>
  );
}
