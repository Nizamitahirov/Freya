'use client';

import { useAppStore } from '@/stores/appStore';
import { money } from '@/lib/format';
import { compaRatio, rangePenetration, bandPosition } from '@/lib/comp';
import { Card, StatusBadge } from '@/components/ui/primitives';

export default function GradesPage() {
  const { grades, employees, activeCompanyId } = useAppStore();
  const companyGrades = grades.filter((g) => g.companyId === activeCompanyId);

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-extrabold">Grade & Salary Band</h1>
      <p className="text-sm text-muted-foreground">
        Hər grade daxilində level-lər (min/mid/max gross). Level max — planlaşdırmada sərt validasiya (§6.2).
      </p>

      {companyGrades.map((g) => (
        <Card key={g.id} title={`${g.code} · order ${g.order}`}>
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b border-border">
                  <th className="px-2 py-2">Level</th>
                  <th className="px-2 py-2 text-right">Min</th>
                  <th className="px-2 py-2 text-right">Mid</th>
                  <th className="px-2 py-2 text-right">Max</th>
                  <th className="px-2 py-2">Əməkdaşlar (compa-ratio)</th>
                </tr>
              </thead>
              <tbody>
                {g.levels.map((l) => {
                  const emps = employees.filter((e) => e.gradeId === g.id && e.levelId === l.id);
                  return (
                    <tr key={l.id} className="border-b border-border last:border-0">
                      <td className="px-2 py-2 font-medium">{l.name}</td>
                      <td className="px-2 py-2 text-right mono">{money(l.min)}</td>
                      <td className="px-2 py-2 text-right mono">{money(l.mid)}</td>
                      <td className="px-2 py-2 text-right mono">{money(l.max)}</td>
                      <td className="px-2 py-2">
                        <div className="flex flex-wrap gap-2">
                          {emps.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
                          {emps.map((e) => {
                            const ratio = compaRatio(e.currentGross, l.mid);
                            return (
                              <span key={e.id} className="inline-flex items-center gap-1 text-xs">
                                {e.fullName}
                                <StatusBadge status={bandPosition(ratio)} />
                                <span className="mono text-muted-foreground">
                                  {ratio} · {(rangePenetration(e.currentGross, l.min, l.max) * 100).toFixed(0)}%
                                </span>
                              </span>
                            );
                          })}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      ))}
    </div>
  );
}
