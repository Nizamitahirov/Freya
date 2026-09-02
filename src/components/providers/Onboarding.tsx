'use client';

/**
 * Onboarding — ilk daxil olan istifadəçi üçün şirkət yaratma (SRS §4).
 *
 * Üzvlüyü olmayan istifadəçi heç bir data görə bilmir (least privilege, §3.2).
 * Buradan yaradılan şirkətdə istifadəçi avtomatik CompanyAdmin + HRAdmin + Manager olur.
 */

import { useState } from 'react';
import { createCompanyAction } from '@/app/actions/company';
import { currentIdToken, signOutUser } from '@/lib/firebase/auth';
import { Button, Card, Input, Select } from '@/components/ui/primitives';
import type { CreateCompanyInput } from '@/lib/server/actionSchemas';

export default function Onboarding({
  email,
  onDone,
}: {
  email: string | null;
  onDone: () => void;
}) {
  const [name, setName] = useState('');
  const [sector, setSector] = useState<CreateCompanyInput['sector']>('private');
  const [taxYear, setTaxYear] = useState<CreateCompanyInput['taxYear']>('2026');
  const [mealLimit, setMealLimit] = useState(100);
  const [withSampleData, setWithSampleData] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const token = await currentIdToken();
      const res = await createCompanyAction(token, {
        name,
        sector,
        taxYear,
        currency: 'AZN',
        mealLimit,
        year: Number(taxYear),
        withSampleData,
      });
      if (!res.ok) setError(res.error);
      else onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Xəta baş verdi.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center bg-background text-foreground p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <span className="inline-grid place-items-center w-11 h-11 rounded-xl bg-primary text-primary-foreground font-extrabold shadow-glow mb-3">
            F
          </span>
          <h1 className="text-xl font-extrabold">Xoş gəlmisiniz</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {email} hesabı hələ heç bir şirkətə bağlı deyil. Başlamaq üçün şirkət yaradın.
          </p>
        </div>

        <Card>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="text-sm font-medium">Şirkətin adı</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Məsələn: Bir MMC"
                required
                minLength={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Sektor</label>
                <Select
                  value={sector}
                  onChange={(e) => setSector(e.target.value as CreateCompanyInput['sector'])}
                >
                  <option value="private">Özəl</option>
                  <option value="public">Dövlət</option>
                  <option value="texnopark">Texnopark</option>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Vergi ili</label>
                <Select
                  value={taxYear}
                  onChange={(e) => setTaxYear(e.target.value as CreateCompanyInput['taxYear'])}
                >
                  <option value="2026">2026</option>
                  <option value="2025">2025</option>
                </Select>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Yemək pulu limiti (₼)</label>
              <Input
                type="number"
                value={mealLimit}
                onChange={(e) => setMealLimit(Number(e.target.value) || 0)}
              />
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={withSampleData}
                onChange={(e) => setWithSampleData(e.target.checked)}
              />
              Nümunə struktur, grade və əməkdaşlarla başlat
            </label>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button type="submit" disabled={busy || name.trim().length < 2} className="w-full">
              {busy ? 'Yaradılır…' : 'Şirkəti yarat'}
            </Button>
          </form>
        </Card>

        <button
          onClick={() => signOutUser()}
          className="mt-4 w-full text-xs text-muted-foreground hover:text-foreground"
        >
          Başqa hesabla daxil ol
        </button>
      </div>
    </div>
  );
}
