'use client';

import { useAppStore, selectBudget } from '@/stores/appStore';
import { money } from '@/lib/format';
import { Card, Stat } from '@/components/ui/primitives';
import type { Structure } from '@/types';

export default function StructurePage() {
  const state = useAppStore();
  const { structures, employees, activeCompanyId } = state;
  const roots = structures.filter((s) => s.companyId === activeCompanyId && s.parentId === null);

  const renderNode = (node: Structure, depth: number) => {
    const children = structures.filter((s) => s.parentId === node.id);
    const empCount = employees.filter((e) => e.positionId === node.id).length;
    const budget = selectBudget(state, node.id);
    return (
      <div key={node.id}>
        <div
          className="flex items-center justify-between py-2.5 border-b border-border"
          style={{ paddingLeft: depth * 20 }}
        >
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">{depth > 0 ? '└─' : '▪'}</span>
            <span className="font-semibold">{node.name}</span>
            <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">{node.type}</span>
            {empCount > 0 && <span className="text-xs text-muted-foreground">{empCount} əməkdaş</span>}
          </div>
          {budget && (
            <span className="text-xs mono text-muted-foreground">
              büdcə: {money(budget.allocatedGross)} · qalıq {money(budget.remaining)}
            </span>
          )}
        </div>
        {children.map((c) => renderNode(c, depth + 1))}
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-extrabold">Təşkilati struktur</h1>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Stat label="Node sayı" value={structures.filter((s) => s.companyId === activeCompanyId).length} />
        <Stat label="Əməkdaş" value={employees.filter((e) => e.companyId === activeCompanyId).length} />
        <Stat label="Division" value={structures.filter((s) => s.companyId === activeCompanyId && s.type === 'division').length} />
      </div>
      <Card title="İyerarxiya (Company → Division → Department → Team)">
        {roots.map((r) => renderNode(r, 0))}
      </Card>
    </div>
  );
}
