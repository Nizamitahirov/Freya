'use client';

import { useAppStore } from '@/stores/appStore';
import { taxConfig } from '@/lib/comp';
import { money } from '@/lib/format';
import { Card, Input, Stat } from '@/components/ui/primitives';

export default function SettingsPage() {
  const state = useAppStore();
  const { companies, budgets, activeCompanyId } = state;
  const company = companies.find((c) => c.id === activeCompanyId)!;
  const budget = budgets.find((b) => b.companyId === activeCompanyId);

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-extrabold">Tənzimləmələr</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Valyuta" value={company.currency} />
        <Stat label="Sektor / il" value={`${company.taxProfile.sector} · ${company.taxProfile.year}`} />
        <Stat label="Yemək limiti" value={money(company.mealLimit)} />
        <Stat label="Vergi uyğunlaşma" value={taxConfig.lastUpdated} sub="taxConfig (SRS §11.6)" />
      </div>

      <Card title="Büdcə təyini">
        {budget ? (
          <div className="flex items-center gap-3">
            <label className="text-sm text-muted-foreground w-40">Ayrılmış gross ({budget.year})</label>
            <div className="w-56">
              <Input
                type="number"
                defaultValue={budget.allocatedGross}
                onBlur={(e) => state.setAllocation(budget.id, Number(e.target.value) || 0)}
              />
            </div>
            <span className="text-xs text-muted-foreground">Dəyişiklik fokus itən kimi saxlanılır.</span>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Büdcə yoxdur.</p>
        )}
      </Card>

      <Card title="Siyasət default-ları (SRS §23)">
        <ul className="text-sm space-y-2 text-muted-foreground">
          <li>• Level max müqayisəsi: <b className="text-foreground">gross</b> üzərindən</li>
          <li>• Over-budget final approve: <b className="text-foreground">HRAdmin + Finance</b></li>
          <li>• HR "edit" → <b className="text-foreground">auto-approve</b> (audit ilə)</li>
          <li>• Yemək pulu limiti / min gross fərqi: <b className="text-foreground">{money(company.mealLimit)} / {money(company.minGrossDiff.branch)} / {money(company.minGrossDiff.hq)}</b></li>
          <li>• effectiveMonths fiscal year-a görə avtomatik</li>
        </ul>
      </Card>

      <Card title="Firebase statusu">
        <p className="text-sm text-muted-foreground">
          Hazırda <b className="text-foreground">demo mode</b> (localStorage). Firebase env qoşulanda
          Firestore-a real oxu/yazma aktivləşəcək. Admin SDK seed artıq test edilib.
        </p>
      </Card>
    </div>
  );
}
