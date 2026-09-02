'use client';

/**
 * review/page.tsx — HR Review (SRS §10).
 *
 * HR/Admin şirkətin BÜTÜN dövrlərindəki sətirləri görür və struktur/status üzrə
 * filtrləyib row-level və bulk aksiya ala bilir. Manager yalnız ona təyin olunmuş
 * strukturların sətirlərini görür (data qatı onsuz da filtrləyir, §3.2).
 */

import { useMemo, useState } from 'react';
import { useAppStore, selectBudget, selectStructureSubtree } from '@/stores/appStore';
import { money, signed } from '@/lib/format';
import { canFinalize } from '@/lib/review/workflow';
import { Button, Card, Input, Select, StatusBadge, Stat } from '@/components/ui/primitives';
import type { PlanningItem } from '@/types';

const STATUS_FILTERS = [
  'hamısı',
  'submitted',
  'edited_pending',
  'approved',
  'rejected',
  'returned',
  'draft',
] as const;

export default function ReviewPage() {
  const state = useAppStore();
  const { planningItems, employees, cycles, structures, activeCompanyId, role } = state;

  const [status, setStatus] = useState<(typeof STATUS_FILTERS)[number]>('hamısı');
  const [structureId, setStructureId] = useState<string>('hamısı');
  const [selected, setSelected] = useState<string[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [editNet, setEditNet] = useState<number>(0);
  const [commenting, setCommenting] = useState<{ id: string; action: 'return' | 'reject' } | null>(
    null,
  );
  const [comment, setComment] = useState('');

  const isHR =
    role === 'HRAdmin' || role === 'HRReviewer' || role === 'CompanyAdmin' || role === 'PlatformOwner';
  const canFinal =
    role === 'HRAdmin' || role === 'Finance' || role === 'CompanyAdmin' || role === 'PlatformOwner';

  const companyCycles = useMemo(
    () => cycles.filter((c) => c.companyId === activeCompanyId),
    [cycles, activeCompanyId],
  );
  const cycleIds = useMemo(() => new Set(companyCycles.map((c) => c.id)), [companyCycles]);

  /** Bütün dövrlərin sətirləri — HR şirkət üzrə tam mənzərəni görür. */
  const items = useMemo(
    () => planningItems.filter((i) => cycleIds.has(i.cycleId)),
    [planningItems, cycleIds],
  );

  // Struktur filtri: seçilmiş node + bütün alt strukturları.
  const scope = useMemo(
    () => (structureId === 'hamısı' ? null : new Set(selectStructureSubtree(state, structureId))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [structureId, structures],
  );

  const visible = items.filter(
    (i) =>
      (status === 'hamısı' ? true : i.status === status) &&
      (scope ? scope.has(i.structureId) : true),
  );

  const summary = useMemo(() => {
    const g = (s: string) => items.filter((i) => i.status === s).length;
    return {
      approved: g('approved'),
      rejected: g('rejected'),
      returned: g('returned'),
      pending: g('submitted') + g('edited_pending'),
      delta: items
        .filter((i) => i.status === 'approved')
        .reduce((s, i) => s + i.deltaGrossAnnual, 0),
    };
  }, [items]);

  const empName = (id: string) => employees.find((e) => e.id === id)?.fullName ?? id;
  const structureName = (id: string) => structures.find((s) => s.id === id)?.name ?? id;
  const cycleName = (id: string) => cycles.find((c) => c.id === id)?.name ?? id;

  const actionable = (s: string) => s === 'submitted' || s === 'edited_pending';
  const selectable = visible.filter((i) => actionable(i.status)).map((i) => i.id);

  /** Finalize üçün hazır dövrlər (bütün sətirlər terminal). */
  const finalizable = companyCycles.filter((c) => {
    if (c.status === 'finalized' || c.status === 'cancelled') return false;
    const own = items.filter((i) => i.cycleId === c.id);
    return own.length > 0 && canFinalize(own.map((i) => i.status));
  });

  const run = (id: string, action: 'approve' | 'return' | 'reject') => {
    if (action === 'approve') {
      state.hrAction(id, 'approve');
      return;
    }
    setCommenting({ id, action });
    setComment('');
  };

  const confirmComment = () => {
    if (!commenting) return;
    state.hrAction(commenting.id, commenting.action, { hrComment: comment });
    setCommenting(null);
    setComment('');
  };

  const companyStructures = structures.filter((s) => s.companyId === activeCompanyId);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-extrabold">Review (HR)</h1>
          <p className="text-sm text-muted-foreground">
            {isHR
              ? `${companyCycles.length} dövr · ${items.length} sətir · şirkət üzrə tam görünüş`
              : 'Sizə təyin olunmuş strukturların sətirləri'}
          </p>
        </div>
        {canFinal && finalizable.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {finalizable.map((c) => (
              <Button key={c.id} variant="success" size="sm" onClick={() => state.finalizeCycle(c.id)}>
                Finalize: {c.name.replace(/^\d+ İllik Review — /, '')}
              </Button>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Stat label="Gözləyən" value={summary.pending} accent="var(--color-info)" />
        <Stat label="Təsdiq" value={summary.approved} accent="var(--color-success)" />
        <Stat label="Qaytarılan" value={summary.returned} accent="var(--color-warning)" />
        <Stat label="Rədd" value={summary.rejected} accent="var(--color-destructive)" />
        <Stat label="Təsdiqlənən Δ (il)" value={money(summary.delta)} />
      </div>

      {/* Filterlər */}
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div className="flex items-end gap-3 flex-wrap">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Struktur</label>
            <Select
              value={structureId}
              onChange={(e) => {
                setStructureId(e.target.value);
                setSelected([]);
              }}
              className="w-56"
            >
              <option value="hamısı">Bütün strukturlar</option>
              {companyStructures.map((s) => (
                <option key={s.id} value={s.id}>
                  {'— '.repeat(s.type === 'team' ? 2 : s.type === 'department' ? 1 : 0)}
                  {s.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Status</label>
            <div className="flex gap-1.5 flex-wrap">
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f}
                  onClick={() => setStatus(f)}
                  className={`text-xs px-3 py-1.5 rounded-full font-medium ${
                    status === f
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-muted-foreground'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
        </div>

        {isHR && selected.length > 0 && (
          <div className="flex items-center gap-2 bg-card border border-border rounded-xl px-3 py-2 shadow-card">
            <span className="text-sm font-semibold">{selected.length} seçildi</span>
            <Button
              size="sm"
              variant="success"
              onClick={() => {
                state.bulkHrAction(selected, 'approve');
                setSelected([]);
              }}
            >
              Approve
            </Button>
            <Button
              size="sm"
              variant="warn"
              onClick={() => {
                state.bulkHrAction(selected, 'return');
                setSelected([]);
              }}
            >
              Return
            </Button>
            <Button
              size="sm"
              variant="danger"
              onClick={() => {
                state.bulkHrAction(selected, 'reject');
                setSelected([]);
              }}
            >
              Reject
            </Button>
          </div>
        )}
      </div>

      {commenting && (
        <Card className="border-warning/40">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold">
              {commenting.action === 'return' ? 'Geri qaytarma' : 'Rədd'} səbəbi:
            </span>
            <Input
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Səbəbi yazın (rəhbər görəcək)"
              className="flex-1"
              autoFocus
            />
            <Button size="sm" onClick={confirmComment} disabled={comment.trim().length === 0}>
              Təsdiqlə
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setCommenting(null)}>
              ✕
            </Button>
          </div>
        </Card>
      )}

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
                <th className="px-4 py-3">Struktur</th>
                <th className="px-4 py-3 text-right">Cari net</th>
                <th className="px-4 py-3 text-right">Yeni net</th>
                <th className="px-4 py-3 text-right">Yeni gross</th>
                <th className="px-4 py-3 text-right">Δ Büdcə (il)</th>
                <th className="px-4 py-3">Səbəb</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Aksiya</th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center text-muted-foreground text-sm">
                    {items.length === 0
                      ? 'Hələ review-ə göndərilmiş sətir yoxdur. Planlaşdırma ekranından artım yazıb "Review-ə göndər" düyməsini basın.'
                      : 'Bu filtrdə sətir yoxdur.'}
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
                              setSelected((s) =>
                                e.target.checked ? [...s, i.id] : s.filter((x) => x !== i.id),
                              )
                            }
                          />
                        )}
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <div className="font-semibold">{empName(i.employeeId)}</div>
                      <div className="text-xs text-muted-foreground">{cycleName(i.cycleId)}</div>
                    </td>
                    <td className="px-4 py-3 text-xs">{structureName(i.structureId)}</td>
                    <td className="px-4 py-3 text-right mono text-muted-foreground">
                      {money(i.currentNet)}
                    </td>
                    <td className="px-4 py-3 text-right mono">{money(i.newNet)}</td>
                    <td className="px-4 py-3 text-right mono">{money(i.newGross)}</td>
                    <td
                      className={`px-4 py-3 text-right mono ${
                        i.deltaGrossAnnual >= 0 ? 'text-success' : 'text-destructive'
                      }`}
                    >
                      {signed(i.deltaGrossAnnual)}
                    </td>
                    <td className="px-4 py-3 text-xs">{i.reason}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={i.status} />
                      {i.round > 0 && (
                        <span className="text-xs text-muted-foreground ml-1">r{i.round}</span>
                      )}
                      {i.hrComment && (
                        <div className="text-xs text-muted-foreground mt-1">💬 {i.hrComment}</div>
                      )}
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
                          <Button
                            size="sm"
                            onClick={() => {
                              state.hrAction(i.id, 'edit', { newNet: editNet });
                              setEditing(null);
                            }}
                          >
                            OK
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                            ✕
                          </Button>
                        </div>
                      ) : act ? (
                        <div className="flex gap-1">
                          <Button size="sm" variant="success" title="Approve" onClick={() => run(i.id, 'approve')}>
                            ✓
                          </Button>
                          <Button size="sm" variant="warn" title="Send back" onClick={() => run(i.id, 'return')}>
                            ↩
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            title="Edit"
                            onClick={() => {
                              setEditing(i.id);
                              setEditNet(i.newNet);
                            }}
                          >
                            ✎
                          </Button>
                          <Button size="sm" variant="danger" title="Reject" onClick={() => run(i.id, 'reject')}>
                            ✕
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {i.status === 'draft' ? 'göndərilməyib' : '—'}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Dövr üzrə büdcə mənzərəsi */}
      <Card title="Dövrlər üzrə büdcə">
        <div className="space-y-2">
          {companyCycles.map((c) => {
            const b = selectBudget(state, c.structureId);
            const own = items.filter((i) => i.cycleId === c.id);
            return (
              <div
                key={c.id}
                className="flex items-center justify-between gap-4 py-2 border-b border-border last:border-0"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <StatusBadge status={c.status} />
                  <span className="font-medium truncate">{c.name}</span>
                  <span className="text-xs text-muted-foreground shrink-0">{own.length} sətir</span>
                </div>
                {b && (
                  <span className="text-xs mono text-muted-foreground shrink-0">
                    rezerv {money(b.committedGross)} · xərc {money(b.spentGross)} · qalıq{' '}
                    <b className={b.status === 'over' ? 'text-destructive' : 'text-foreground'}>
                      {money(b.remaining)}
                    </b>
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
