'use client';

import { Card } from './primitives';

/**
 * Live rejimdə Firestore datası hələ gəlməyibsə və ya şirkətdə dövr/şirkət yoxdursa
 * göstərilən boş vəziyyət (SRS §15 — ekranlar data olmadan da düzgün davranmalıdır).
 */
export function Loading({ what = 'Data' }: { what?: string }) {
  return (
    <Card>
      <p className="text-sm text-muted-foreground">{what} yüklənir…</p>
    </Card>
  );
}

export function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <Card title={title}>
      <p className="text-sm text-muted-foreground">{hint}</p>
    </Card>
  );
}
