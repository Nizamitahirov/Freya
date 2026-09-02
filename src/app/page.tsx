import CompCalculator from '@/components/CompCalculator';

const features = [
  ['Net → Gross → SuperGross', 'Rəhbər net düşünür, sistem grossu binary-search ilə çıxarır (§11).'],
  ['Büdcə nəzarəti (gross)', 'Draft/review → committed, final → spent, canlı qalıq (§7).'],
  ['Row-level HR review', 'Hər sətir üzrə approve / reject / send-back / edit / bulk (§10).'],
  ['Yemək pulu məntiqi', 'Limitə qədər yemək pulu, qalan hissə grossa (§11.7).'],
  ['Grade / Level / Band', 'Level max validasiyası, compa-ratio, range penetration (§6).'],
  ['Multi-company + RBAC', 'Multi-tenant izolyasiya, rol-struktur assignment (§3–4).'],
];

export default function Home() {
  return (
    <main style={{ maxWidth: 960, margin: '0 auto', padding: '3rem 1.5rem 5rem' }}>
      <header style={{ textAlign: 'center', marginBottom: '3rem' }}>
        <div
          style={{
            display: 'inline-block',
            padding: '0.35rem 0.9rem',
            borderRadius: 999,
            background: 'var(--color-primary-soft)',
            color: 'var(--color-primary)',
            fontSize: 13,
            fontWeight: 600,
            marginBottom: '1rem',
          }}
        >
          Faza 1 · MVP foundation
        </div>
        <h1 style={{ fontSize: 42, fontWeight: 800, margin: '0 0 0.75rem', lineHeight: 1.1 }}>
          Compensation Planning Tool
        </h1>
        <p
          style={{
            fontSize: 18,
            color: 'var(--color-muted-foreground)',
            maxWidth: 640,
            margin: '0 auto',
          }}
        >
          Şirkət daxilində əməkhaqqı büdcəsinin planlaşdırılması, per-employee net/gross
          hesablaması və çoxpilləli HR review dövrü. Vergi motoru Azərbaycan qanunvericiliyinə
          (13.02.2026) uyğundur.
        </p>
      </header>

      <section style={{ marginBottom: '3rem' }}>
        <CompCalculator />
      </section>

      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '1rem',
        }}
      >
        {features.map(([title, desc]) => (
          <div
            key={title}
            style={{
              background: 'var(--color-card)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius)',
              boxShadow: 'var(--shadow-card)',
              padding: '1.25rem',
            }}
          >
            <h3 style={{ margin: '0 0 0.4rem', fontSize: 16, fontWeight: 700 }}>{title}</h3>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--color-muted-foreground)' }}>{desc}</p>
          </div>
        ))}
      </section>

      <footer
        style={{
          marginTop: '3rem',
          textAlign: 'center',
          fontSize: 13,
          color: 'var(--color-muted-foreground)',
        }}
      >
        Next.js · TypeScript · Firebase · Vercel — tam texniki şərt üçün{' '}
        <code>Compensation-Planning-Tool-SRS.md</code>
      </footer>
    </main>
  );
}
