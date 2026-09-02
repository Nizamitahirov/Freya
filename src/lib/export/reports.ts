/**
 * reports.ts — Excel (ExcelJS) və PDF (jsPDF) ixracı (SRS §17).
 *
 * Client-side işləyir; ağır kitabxanalar yalnız çağırış zamanı dynamic import olunur.
 */

export type ReportRow = {
  employee: string;
  currentNet: number;
  newNet: number;
  newGross: number;
  newSuperGross: number;
  delta: number;
  reason: string;
  status: string;
};

export type ReportData = {
  companyName: string;
  cycleName: string;
  budget: { allocated: number; committed: number; spent: number; remaining: number } | null;
  rows: ReportRow[];
};

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const HEADERS = ['Əməkdaş', 'Cari net', 'Yeni net', 'Yeni gross', 'SuperGross', 'Δ gross (il)', 'Səbəb', 'Status'];

/** Excel ixracı — büdcə + sətir cədvəli (ExcelJS). */
export async function exportExcel(data: ReportData) {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Freya · Compensation Planning Tool';
  wb.created = new Date();

  const info = wb.addWorksheet('Xülasə');
  info.columns = [{ width: 24 }, { width: 20 }];
  info.addRow(['Şirkət', data.companyName]);
  info.addRow(['Dövr', data.cycleName]);
  info.addRow([]);
  if (data.budget) {
    info.addRow(['Büdcə (gross)', '']);
    info.addRow(['Ayrılmış', data.budget.allocated]);
    info.addRow(['Rezerv (committed)', data.budget.committed]);
    info.addRow(['Xərclənmiş (spent)', data.budget.spent]);
    info.addRow(['Qalıq (remaining)', data.budget.remaining]);
  }
  info.getColumn(2).numFmt = '#,##0.00';
  info.getRow(1).font = { bold: true };

  const ws = wb.addWorksheet('Planlar');
  ws.addRow(HEADERS);
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEEEFE' } };
  for (const r of data.rows) {
    ws.addRow([r.employee, r.currentNet, r.newNet, r.newGross, r.newSuperGross, r.delta, r.reason, r.status]);
  }
  ws.columns.forEach((c, i) => {
    c.width = i === 0 ? 24 : 14;
    if (i >= 1 && i <= 5) c.numFmt = '#,##0.00';
  });

  const buf = await wb.xlsx.writeBuffer();
  download(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `freya-${slug(data.cycleName)}.xlsx`);
}

/** PDF ixracı — başlıq + büdcə + sətir cədvəli (jsPDF + autotable). */
export async function exportPdf(data: ReportData) {
  const { jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;
  const doc = new jsPDF();

  doc.setFontSize(16);
  doc.text('Compensation Planning — Hesabat', 14, 18);
  doc.setFontSize(10);
  doc.setTextColor(110);
  doc.text(`${data.companyName} · ${data.cycleName}`, 14, 25);

  let y = 32;
  if (data.budget) {
    autoTable(doc, {
      startY: y,
      head: [['Büdcə (gross)', 'Məbləğ']],
      body: [
        ['Ayrılmış', fmt(data.budget.allocated)],
        ['Rezerv (committed)', fmt(data.budget.committed)],
        ['Xərclənmiş (spent)', fmt(data.budget.spent)],
        ['Qalıq (remaining)', fmt(data.budget.remaining)],
      ],
      theme: 'grid',
      headStyles: { fillColor: [91, 91, 245] },
      styles: { fontSize: 9 },
      margin: { left: 14 },
      tableWidth: 90,
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  autoTable(doc, {
    startY: y,
    head: [HEADERS],
    body: data.rows.map((r) => [
      r.employee,
      fmt(r.currentNet),
      fmt(r.newNet),
      fmt(r.newGross),
      fmt(r.newSuperGross),
      fmt(r.delta),
      r.reason,
      r.status,
    ]),
    theme: 'striped',
    headStyles: { fillColor: [91, 91, 245] },
    styles: { fontSize: 8 },
    margin: { left: 14, right: 14 },
  });

  doc.save(`freya-${slug(data.cycleName)}.pdf`);
}

const fmt = (n: number) => n.toLocaleString('az-AZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
