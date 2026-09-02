'use client';

import { useMemo, useState } from 'react';
import { useAppStore, selectBudget } from '@/stores/appStore';
import { money, signed } from '@/lib/format';
import { canFinalize } from '@/lib/review/workflow';
import { Button, Card, Input, Select, StatusBadge, Stat } from '@/components/ui/primitives';
import type { PlanningItem } from '@/types';
import { Loading } from '@/components/ui/EmptyState';

const FILTERS = ['hamısı', 'submitted', 'edited_pending', 'approved', 'rejected', 'returned'] as const;

export default function ReviewPage() {
  const state = useAppStore();
  const { planningItems, employees, cycles, activeCycleId, role } = state;

  // Hook-lar hər render-də eyni sırada çağırılmalıdır — erkən return-dan ƏVVƏL.
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('hamısı');
  const [selected, setSelected] = useState<string[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [editNet, setEditNet] = useState<number>(0);

  const cycle = cycles.find((c) => c.id === activeCycleId) ?? cycles[0];
  const items = useMemo(
    () => (cycle ? planningItems.filter((i) => i.cycleId === cycle.id) : []),
    [planningItems, cycle],
  );
  const summary = useMemo(() => {
    const g = (s: string) => items.filter((i) => i.status === s).length;
    return { approved: g('approved'), rejected: g('rejected'), returned: g('returned'), pending: g('submitted') + g('edited_pending') };
  }, [items]);

  if (!cycle) return <Loading what="Review" />;

  const budget = selectBudget(state, cycle.structureId);

  const isHR = role === 'HRAdmin' || role === 'HRReviewer' || role === 'CompanyAdmin';
  const canFinal = role === 'HRAdmin' || role === 'Finance' || role === 'CompanyAdmin';

  const visible = items.filter((i) => (filter === 'hamısı' ? true : i.status === filter));
  const empName = (id: string) => employees.find((e) => e.id === id)?.fullName ?? id;

  const finalizeReady = items.length > 0 && canFinalize(items.map((i) => i.status));
  const actionable = (s: string) => s === 'submitted' || s === 'edited_pending';
  const selectable = visible.filter((i) => actionable(i.status)).map((i) => i.id);

  if (cycle.status === 'open') {
    return (
      <Card title="Review">
        <p className="text-sm text-muted-foreground">
          Bu dövr hələ review-ə göndərilməyib. Planlaşdırma ekranından "Review-ə göndər" düyməsini
          istifadə edin.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold">Review (HR)</h1>
          <p className="text-sm text-muted-foreground">
            {cycle.name} · <StatusBadge status={cycle.status} /> · round {cycle.round}
          </p>
        </div>
        <Button
          variant="success"
          disabled={!canFinal || !finalizeReady || cycle.status === 'finalized'}
          onClick={() => state.finalizeCycle(cycle.id)}
        >
          {cycle.status === 'finalized' ? 'Finalized ✓' : 'Finalize'}
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Gözləyən" value={summary.pending} accent="var(--color-info)" />
        <Stat label="Təsdiq" value={summary.approved} accent="var(--color-success)" />
        <Stat label="Qaytarılan" value={summary.returned} accent="var(--color-warning)" />
        <Stat label="Rədd" value={summary.rejected} accent="var(--color-destructive)" />
      </div>

      {budget && budget.status === 'over' && (
        <Card className="border-destructive/40">
          <p className="text-sm text-destructive font-semibold">
            ⚠ Büdcə aşılıb: qalıq {money(budget.remaining)}. Finalize üçün Finance/HRAdmin təsdiqi
            lazımdır (siyasət).
          </p>
        </Card>
      )}

      {/* Filter + bulk bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-2">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-xs px-3 py-1.5 rounded-full font-medium ${
                filter === f ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        {isHR && selected.length > 0 && (
          <div className="flex items-center gap-2 bg-card border border-border rounded-xl px-3 py-2 shadow-card">
            <span className="text-sm font-semibold">{selected.length} seçildi</span>
            <Button size="sm" variant="success" onClick={() => { state.bulkHrAction(selected, 'approve'); setSelected([]); }}>
              Approve
            </Button>
            <Button size="sm" variant="warn" onClick={() => { state.bulkHrAction(selected, 'return'); setSelected([]); }}>
              Return
            </Button>
            <Button size="sm" variant="danger" onClick={() => { state.bulkHrAction(selected, 'reject'); setSelected([]); }}>
              Reject
            </Button>
          </div>
        )}
      </div>

      <Card className="!p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground border-b border-border">
                {isHR && (
                  <th className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectable.length > 0 && selected.length === selectable.length}
                      onChange={(e) => setSelected(e.target.checked ? selectable : [])}
                    />
                  </th>
                )}
                <th className="px-4 py-3">Əməkdaş</th>
                <th className="px-4 py-3 text-right">Yeni net</th>
                <th className="px-4 py-3 text-right">Yeni gross</th>
                <th className="px-4 py-3 text-right">Δ Büdcə</th>
                <th className="px-4 py-3">Səbəb</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Aksiya</th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground text-sm">
                    Bu filterdə sətir yoxdur.
                  </td>
                </tr>
              )}
              {visible.map((i: PlanningItem) => {
                const act = actionable(i.status) && isHR;
                return (
                  <tr key={i.id} className="border-b border-border last:border-0">
                    {isHR && (
                      <td className="px-4 py-3">
                        {act && (
                          <input
                            type="checkbox"
                            checked={selected.includes(i.id)}
                            onChange={(e) =>
                              setSelected((s) => (e.target.checked ? [...s, i.id] : s.filter((x) => x !== i.id)))
                            }
                          />
                        )}
                      </td>
                    )}
                    <td className="px-4 py-3 font-semibold">{empName(i.employeeId)}</td>
                    <td className="px-4 py-3 text-right mono">{money(i.newNet)}</td>
                    <td className="px-4 py-3 text-right mono">{money(i.newGross)}</td>
                    <td className={`px-4 py-3 text-right mono ${i.deltaGrossAnnual >= 0 ? 'text-success' : 'text-destructive'}`}>
                      {signed(i.deltaGrossAnnual)}
                    </td>
                    <td className="px-4 py-3 text-xs">{i.reason}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={i.status} />
                      {i.hrComment && <div className="text-xs text-muted-foreground mt-1">💬 {i.hrComment}</div>}
                    </td>
                    <td className="px-4 py-3">
                      {act && editing === i.id ? (
                        <div className="flex gap-1 items-center">
                          <Input
                            type="number"
                            value={editNet}
                            onChange={(e) => setEditNet(Number(e.target.value) || 0)}
                            className="!w-24 !py-1.5"
                          />
                          <Button size="sm" onClick={() => { state.hrAction(i.id, 'edit', { newNet: editNet }); setEditing(null); }}>
                            OK
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                            ✕
                          </Button>
                        </div>
                      ) : act ? (
                        <div className="flex gap-1">
                          <Button size="sm" variant="success" onClick={() => state.hrAction(i.id, 'approve')}>✓</Button>
                          <Button size="sm" variant="warn" onClick={() => state.hrAction(i.id, 'return')}>↩</Button>
                          <Button size="sm" variant="outline" onClick={() => { setEditing(i.id); setEditNet(i.newNet); }}>✎</Button>
                          <Button size="sm" variant="danger" onClick={() => state.hrAction(i.id, 'reject')}>✕</Button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">round {i.round}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
