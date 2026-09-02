# Compensation Planning Tool — Texniki Şərt (SRS)

**Versiya:** 1.0
**Tarix:** 2026-09-02
**Status:** Draft
**Stack:** Next.js (App Router) + React + TypeScript · Firebase (Firestore + Auth + Storage) · Vercel · GitHub

---

## 0. Sənəd haqqında

Bu sənəd **Compensation Planning Tool**-un tam texniki şərtidir (Software Requirements Specification). Məqsəd — şirkət daxilində əməkhaqqı büdcəsinin planlaşdırılması, rəhbərin əməkdaş bazında (per-employee) maaş/vəzifə dəyişikliyi draftını hazırlaması, **HR-a review üçün göndərməsi**, HR-ın **hər sətir üzrə (row-level) təsdiq / geri qaytarma / redaktə** etməsi və bu **dövrün (cycle) son təsdiqə qədər** davam etməsidir.

Dizayn dili və memarlıq nümunəsi istifadəçinin iki reposundan götürülüb:

- **Gradex** (`github.com/Nizamitahirov/Gradex`) — dizayn sistemi (periwinkle `#5B5BF5`, Montserrat, soft layered shadows, dark mode), Next.js App Router memarlığı, "pure engine + Zod schema → TS type + Zustand store mirror + Firestore multi-tenant rules" pattern-i.
- **Mycalcpro / BirCalc** (`github.com/Nizamitahirov/Mycalcpro`) — Azərbaycan üzrə **net → gross → supergross** çevrilmə düsturları, vergi/DSMF/İTS/işsizlik/HİK pillələri və **yemək pulu (meal allowance)** məntiqi. Bu düsturlar §11-də olduğu kimi köçürülür.

> **Qeyd:** Vergi düsturları 13 fevral 2026 tarixinə uyğundur (BirCalc-dakı kimi). Qanunvericilik dəyişdikdə `taxConfig` bir yerdən yenilənir (§11.6).

---

## 1. Məhsulun icmalı (Product Overview)

### 1.1 Problem
Əməkhaqqı planlaması adətən Excel-lərdə səpələnmiş, versiyasız, audit izi olmayan, büdcə nəzarəti zəif bir prosesdir. Rəhbər artımı **net** olaraq düşünür, maliyyə isə büdcəni **gross** olaraq idarə edir — bu uyğunsuzluq səhvlərə gətirir.

### 1.2 Həll
Vahid platforma:
- Rəhbər əməkdaşa **net** artım yazır → sistem avtomatik **gross** hesablayır → büdcə **gross əsasında draft azaldılır**.
- Çoxpilləli **review cycle** (Manager → HR → (opsional Finance) → Final).
- Row-level HR aksiyaları: **Approve / Reject / Send-back / Edit / Bulk action**.
- Real-time büdcə qalığı, market analitikası, tam audit trail.
- **Multi-company** (bir platformada bir neçə şirkət yaratma və idarəetmə).

### 1.3 Əsas istifadəçi dəyəri
| Rol | Dəyər |
|---|---|
| Rəhbər | Net düşünür, sistem grossu özü çıxarır; büdcə limitini canlı görür |
| HR | Hər sətri ayrı idarə edir, geri qaytarır, düzəldir; dövrü nəzarətdə saxlayır |
| Maliyyə | Büdcə gross-la nəzarətdə; supergross = tam şirkət xərci |
| Rəhbərlik | Şirkət/bölmə üzrə aqreqat, ssenari müqayisəsi |

---

## 2. Əhatə dairəsi (Scope)

### 2.1 Daxildir (MVP + genişləndirmə)
- Multi-company idarəetmə
- Struktur ağacı (Company → Division → Department → Team → Position → Employee)
- Grade / Level / Salary band
- İllik büdcə (gross) təyini və real-time draft azalma
- Əməkdaş kompensasiya datası (cari net/gross/supergross/meal)
- Per-employee planlama: net-lə və ya faizlə artım → yeni net → yeni gross/meal
- Level max validasiyası (grade daxilindəki level max-ı aşmamaq)
- Review workflow (draft → send to review → HR row actions → cycle → final)
- Market data yükləmə (CSV/XLSX) + compa-ratio
- RBAC (rollar + strukturların rollara/istifadəçilərə assign edilməsi)
- Audit trail, hesabatlar, ixrac

### 2.2 Daxil deyil (gələcək fazalar)
- Bonus/equity/total-comp modeli (Faza 3)
- Pay equity (gender pay gap) analitikası (Faza 3)
- Performance/merit sistemi ilə dərin inteqrasiya (Faza 3)
- Payroll sisteminə birbaşa push (yalnız export API)

---

## 3. İstifadəçi rolları və RBAC

### 3.1 Rollar
| Rol | Təsvir | Əsas icazələr |
|---|---|---|
| **Platform Owner** | Platforma sahibi | Şirkət yaratma/silmə, billing, qlobal admin |
| **Company Admin** | Şirkət administratoru | Şirkət daxili tam giriş, rol təyini, struktur qurma |
| **HR Admin** | HR | Bütün strukturlar üzrə əməkdaş datası, büdcə, market data, **review approve/reject** |
| **HR Reviewer** | Review edən HR | Row-level approve/reject/send-back/edit (yalnız review) |
| **Finance** | Maliyyə | Büdcə təsdiqi, gross/supergross parametrləri, hesabatlar |
| **Manager (Rəhbər)** | Bölmə rəhbəri | Yalnız assign olunmuş struktur(lar) üzrə draft yaratma və send-to-review |
| **Viewer** | Baxış | Read-only dashboard/hesabat |

### 3.2 Prinsiplər
- **Row-level security:** Manager yalnız öz strukturunun əməkdaşlarını görür (Firestore rules + query filter).
- **Struktur ↔ rol assignment:** many-to-many. Bir user birdən çox struktura Manager ola bilər; bir struktura bir neçə reviewer təyin oluna bilər.
- **Least privilege:** default olaraq heç bir giriş yoxdur; assignment ilə açılır.
- **Company isolation:** hər sənəddə `companyId`; cross-company giriş qadağan (multi-tenant).

### 3.3 İcazə matrisi (nümunə)
| Əməliyyat | Owner | CompanyAdmin | HRAdmin | HRReviewer | Finance | Manager | Viewer |
|---|---|---|---|---|---|---|---|
| Şirkət yaratma | ✅ | — | — | — | — | — | — |
| Struktur qurma | ✅ | ✅ | ✅ | — | — | — | — |
| Büdcə təyini | ✅ | ✅ | ✅ | — | ✅ | — | — |
| Draft yaratma | — | ✅ | ✅ | — | — | ✅ | — |
| Send to review | — | ✅ | ✅ | — | — | ✅ | — |
| Row approve/reject | — | ✅ | ✅ | ✅ | — | — | — |
| Final approve | — | ✅ | ✅ | — | ✅(opsional) | — | — |
| Market data upload | — | ✅ | ✅ | — | — | — | — |
| Hesabat ixracı | ✅ | ✅ | ✅ | ✅ | ✅ | ✅(öz) | ✅ |

---

## 4. Multi-company idarəetmə

- Bir istifadəçi bir neçə şirkətə üzv ola bilər (`memberships`).
- Aktiv şirkət **company switcher** (top bar) ilə dəyişir.
- Hər şirkətin öz strukturları, büdcələri, əməkdaşları, rolları, market datası, cycle-ları var.
- Data izolyasiyası: bütün query-lər `where('companyId','==',activeCompanyId)` ilə məhdudlaşır və Firestore rules ilə möhkəmləndirilir.
- Şirkət səviyyəli konfiqurasiya: valyuta, ölkə/vergi profili, fiscal year, yemək pulu limiti, default artım siyasəti.

---

## 5. Təşkilati struktur (Org Structure)

### 5.1 İyerarxiya
```
Company
  └─ Division            (məs. Technology, Commercial)
       └─ Department      (məs. Engineering, Sales)
            └─ Team        (məs. Backend, Field Sales)
                 └─ Position (job seat, grade-ə bağlı)
                      └─ Employee
```

### 5.2 Xüsusiyyətlər
- Ağac struktur: hər node `parentId` ilə. Sürüklə-burax (drag reorder) opsional.
- Hər struktura təyin olunur: **manager(lar)**, **reviewer(lər)**, **approval chain**, **illik büdcə**.
- Bir əməkdaş bir Position-a bağlıdır; Position bir Grade-ə.
- Struktur silinməsi: yalnız boşdursa və ya arxivlənərək (soft-delete `archived:true`).

---

## 6. Grade / Level / Salary Band

### 6.1 Model
- **Grade** — geniş bağlama (məs. G7, G8 və ya 1–25 Gradex-vari şkala).
- **Level** — grade daxilində pillə (məs. Junior / Mid / Senior və ya L1–L4).
- **Salary band** — hər grade üçün `min / mid / max` (gross baza). Hər level üçün alt-window da saxlanıla bilər (`levelMin`, `levelMax`).

### 6.2 Level max qaydası (kritik validasiya)
Planlaşdırılan yeni maaş, **əməkdaşın (yeni) grade-inin həmin level-inin max-ından çox ola bilməz.**

- Müqayisə vahidi konfiqurasiya olunur: default **gross** (çünki band gross-dur). Net yazıldıqda əvvəl grossa çevrilir, sonra band max ilə tutuşdurulur.
- Aşıldıqda: **sərt bloklama** (submit qadağan) + izah mesajı, və ya (siyasətə görə) **override** yalnız HRAdmin icazəsi ilə + səbəb qeydi.

```
validateAgainstBand(newGross, grade, level):
    band = getBand(grade, level)
    if newGross > band.max:  → ERROR "Level max aşılıb: {band.max}"
    if newGross < band.min:  → WARN  "Band altındadır (below range)"
```

### 6.3 Compa-ratio & range penetration
- `compaRatio = employeeGross / band.mid`
- `rangePenetration = (employeeGross − band.min) / (band.max − band.min)`
- UI-da rəngli göstərici: below (<0.8) / at (0.8–1.2) / above (>1.2).

---

## 7. Büdcə idarəetməsi

### 7.1 Prinsip
Büdcə **gross** olaraq təyin edilir. Rəhbər əməkhaqqını **net** yazır. Sistem net→gross çevirir və büdcəni **gross fərqi qədər draft azaldır**.

### 7.2 Büdcə vəziyyətləri
| Status | Məna |
|---|---|
| `allocated` | Struktura ayrılmış illik büdcə (gross) |
| `committed` | Draft/review-də olan planların gross təsiri (rezerv) |
| `spent` | Final təsdiqlənmiş planların gross təsiri |
| `remaining` | `allocated − committed − spent` |

### 7.3 Draft azalma məntiqi
Bir plan sətri üçün büdcə təsiri:
```
Δgross_monthly = newGross − currentGross
Δgross_annual  = Δgross_monthly × effectiveMonths     // effektiv tarixdən ilin sonuna
committed += Δgross_annual                             // draft/review mərhələsində
```
- Plan **draft** və **in-review** ikən → `committed`-ə düşür (rezerv).
- Plan **final approved** olduqda → `committed`-dən çıxır, `spent`-ə keçir.
- Plan **rejected/withdrawn** olduqda → `committed`-dən azad olunur.

### 7.4 Vizual
- Progress bar: yaşıl (<80%) → sarı (80–100%) → qırmızı (>100%, over-budget xəbərdarlığı).
- Over-budget draft **saxlanıla** bilər, amma **final approve** üçün Finance/HRAdmin icazəsi (siyasətə görə).

---

## 8. Əməkdaş kompensasiya datası

Hər əməkdaş üçün saxlanılır (§13 modelinə bax):
- Şəxsi: ad, badge/ID, struktur (positionId), grade, level, effektiv tarix.
- Kompensasiya: `currentNet`, `currentGross`, `currentSuperGross`, `currentMeal (yemək pulu)`, valyuta.
- Kontekst: sektor (private / public / texnopark), workplace (main / secondary), tətbiq olunan vergi güzəşti (VM 102), HİK (union) faizi.

> Cari **gross** verilibsə net avtomatik çıxarılır; yalnız net verilibsə gross `solveGross` ilə tapılır (§11.4).

---

## 9. Per-employee planlaşdırma (rəhbərin drafti)

### 9.1 Giriş üsulları
Rəhbər əməkdaş sətrində artımı iki cür verə bilər (toggle):

1. **Faizlə (%):** `newNet = currentNet × (1 + pct/100)`
2. **Məbləğlə (net artım):** `newNet = currentNet + amount`
   - və ya birbaşa **yeni net** yazır.

Hər iki halda **yekun dəyər — yeni net-dir.** Sonra:
```
newGross = solveGross(newNet, …)        // §11.4
newSuperGross = newGross + employerCosts(newGross)   // §11.5
newMeal = mealAllowance(...)            // §11.7 (recruitment/artım qaydası)
Δbudget = (newGross − currentGross) × effectiveMonths
```

### 9.2 Planlana bilən sahələr
- Yeni net (rəqəm/faiz)
- Vəzifə/grade/level dəyişikliyi (promotion)
- Effektiv tarix
- Səbəb: `merit | promotion | market_adjustment | retention | correction`
- Qeyd (comment)

### 9.3 Validasiyalar
- Level max (§6.2) — sərt.
- Büdcə (§7) — soft/hard (siyasət).
- Band min — warning.
- Meal limit (§11.7) — avtomatik tənzimlənir.

### 9.4 Before / After görünüşü
Sətirdə iki sütun bloku: **Cari** (net/gross/supergross/meal) və **Planlaşdırılan** (eyni sahələr + Δ və %). Rəngli delta göstəriciləri.

---

## 10. Review Workflow (əsas biznes axını)

### 10.1 Rollar və mərhələlər
```
[Manager] draft yaradır
   │  planningItem hər sətir: status = "draft"
   ▼
[Manager] "Send to Review"  ──►  cycle.status = "in_review"
   │  bütün sətirlər: status = "submitted"
   ▼
[HR / HR Reviewer]  hər SƏTİR üzrə aksiya alır:
   ├─ Approve          → item.status = "approved"
   ├─ Reject           → item.status = "rejected" (səbəblə)
   ├─ Send back (geri) → item.status = "returned" (rəhbərə qayıdır)
   ├─ Edit             → dəyəri düzəldir, item.status = "edited_pending"
   └─ Bulk action      → seçilmiş sətirlərə toplu approve/reject/return
   ▼
[Manager] "returned" sətirləri düzəldib yenidən göndərir (yeni round)
   ▼   ... cycle təkrarlanır (round++) ...
   ▼
Bütün sətirlər terminal vəziyyətdə (approved/rejected) olduqda
   │
   ▼
[HRAdmin / Finance] "Finalize"  ──►  cycle.status = "finalized"
   approved sətirlər: committed → spent, employee datası update
```

### 10.2 Sətir (item) statusları
| Status | Kim qoyur | Məna |
|---|---|---|
| `draft` | Manager | Hazırlanır |
| `submitted` | Manager (send to review) | HR-a düşdü |
| `approved` | HR | Təsdiqləndi |
| `rejected` | HR | Rədd (səbəblə, terminal) |
| `returned` | HR (send back) | Rəhbərə düzəlişə qaytarıldı |
| `edited_pending` | HR (edit) | HR düzəltdi, təsdiq gözləyir / auto-approve (siyasət) |
| `withdrawn` | Manager | Rəhbər geri çəkdi |

### 10.3 Cycle statusları
`open → in_review → changes_requested → in_review → … → finalized | cancelled`

### 10.4 Row-level HR panel (UI)
Hər sətirdə HR üçün:
- ✅ Approve  🔁 Send back  ✏️ Edit  ❌ Reject  💬 Comment
- Toplu seçim (checkbox) → bulk bar: "Approve 12 · Return 3 · Reject 1"
- Filter: status, struktur, delta böyüklüyü, over-band, over-budget
- Hər sətrin **round tarixçəsi** (kim, nə vaxt, nə etdi, hansı dəyər).

### 10.5 Bildirişlər
- Send to review → HR-a (email + in-app).
- Send back / reject → Manager-a.
- Finalize → bütün iştirakçılara + hər əməkdaşa (opsional comp letter).

### 10.6 Konkurentlik və kilid
- Cycle `in_review` ikən Manager həmin sətri redaktə edə bilməz (yalnız `returned` olanları).
- Optimistic concurrency: hər item-də `version`/`updatedAt`; toqquşmada son yazan xəbərdarlıq alır.

---

## 11. Hesablama motoru (Net ↔ Gross ↔ SuperGross + Yemək pulu)

> Bu bölmə **Mycalcpro/BirCalc** məntiqindən köçürülüb. Bütün düsturlar **pure function** kimi `src/lib/comp/engine.ts`-də saxlanılır, unit-testlə örtülür (Gradex-in "engine is the heart" pattern-i).

### 11.1 Kontekst parametrləri
```ts
type CompContext = {
  sector: 'private' | 'public' | 'texnopark';
  workplace: 'main' | 'secondary';   // əsas / əlavə iş yeri
  year: '2025' | '2026';
  benefit: number;                   // VM 102 vergi güzəşti (məs. 200)
  unionPct: number;                  // HİK faizi
};
```

### 11.2 İşçi tutulmaları — `getDeductions(gross, ctx)`
**Private, 2026:**
```
taxable = max(0, gross − benefit)
# Gəlir vergisi (main iş yeri):
  taxable ≤ 200        → tax = 0
  taxable ≤ 2500       → tax = (taxable − 200) × 0.03
  taxable ≤ 8000       → tax = 75 + (taxable − 2500) × 0.10
  taxable > 8000       → tax = 625 + (taxable − 8000) × 0.14
# (secondary iş yeri: 200 güzəşti yoxdur, ilk pillə taxable×0.03)
DSMF     = (gross ≤ 200) ? gross×0.03 : 6 + (gross − 200) × 0.10
İşsizlik = gross × 0.005
Tibbi    = (gross ≤ 2500) ? gross×0.02 : 50 + (gross − 2500) × 0.005
HİK      = gross × unionPct/100
total    = tax + DSMF + İşsizlik + Tibbi + HİK
net      = gross − total
```

**Private, 2025 (əvvəlki):**
```
tax   = (taxable > 8000) ? (taxable − 8000) × 0.14 : 0
DSMF  = (gross ≤ 200) ? gross×0.03 : 6 + (gross − 200) × 0.10
İşsiz = gross × 0.005
Tibbi = (gross ≤ 8000) ? gross×0.02 : 160 + (gross − 8000) × 0.005
```

**Public (dövlət):**
```
bt = (main) ? max(0, taxable − 200) : taxable
tax = (bt ≤ 2500) ? bt×0.14 : 350 + (bt − 2500) × 0.25
# DSMF/Tibbi il profilinə görə (2026: DSMF=gross×0.03, Tibbi 2500 pilləli; əks halda köhnə)
İşsiz = gross × 0.005
```

**Texnopark:** ayrıca `getDeductionsTexnopar(gross,'local',unionPct)`; taxable = (gross≤2500)?max(0,gross−200):gross.

### 11.3 İşəgötürən xərcləri — `getEmployerCosts(gross, sector, year)`
```
private:
  DSMF = (gross ≤ 200) ? gross×0.22 : 44 + (gross − 200) × 0.15   (≤8000)
         gross > 8000   → 1214 + (gross − 8000) × 0.11
  Tibbi(işəgötürən) = (gross ≤ 8000) ? gross×0.02 : 160 + (gross − 8000) × 0.005
public:
  DSMF = (gross ≤ 200) ? gross×0.22 : 44 + (gross − 200) × 0.15
  Tibbi = eyni formul
```

### 11.4 Net → Gross — `solveGross(targetNet, ctx)` (binary search)
```
low = targetNet; high = targetNet × 3
repeat 38 iterations:
    mid = (low + high) / 2
    d = getDeductions(mid, ctx)
    if (mid − d.total) < targetNet → low = mid
    else                          → high = mid
return high
```
Nəticə: verilmiş **net**-i verən **gross**. Presisiya ~1e-6 (38 iterasiya).

### 11.5 SuperGross
```
superGross = gross + sum(getEmployerCosts(gross, sector, year))
```
= şirkətin bir əməkdaşa tam aylıq xərci.

### 11.6 `taxConfig` (tək mənbə)
Bütün faiz/pillə/limit dəyərləri `src/lib/comp/taxConfig.ts`-də il+sektor+ölkə üzrə saxlanılır. Qanun dəyişəndə yalnız bura yenilənir; UI-də "son uyğunlaşma tarixi" göstərilir.

### 11.7 Yemək pulu (Meal allowance) məntiqi
İşəqəbul/artım rejimlərində (BirCalc "Recruitment" qaydaları):

- **Yemək pulu limiti:** default **100 AZN** (şirkət konfiqurasiyasında dəyişir).
- **Artım paylanması:**
  - Əgər `cari yemək pulu + net artım ≤ 100` → **gross dəyişmir**, bütün artım yemək puluna gedir.
  - Əgər 100-ü keçirsə → yemək pulu **100-ə çatdırılır**, qalan hissə **gross-a** əlavə olunur.
- **Minimum gross fərqi:** artımda yeni gross cari grossdan az olmamalı; müəyyən min fərq (məs. **Filial 20 AZN / Baş ofis 50 AZN**) təmin olunmalı. Təmin olunmursa, yemək pulu kifayət qədər azaldılır ki, gross artım min şərti ödəsin.
- **Rotasiya:** cəm net dəyişmirsə maaş eyni qalır; azalırsa yemək pulu sabit saxlanılıb yeni gross təyin olunur.
- **Uyğunluq yoxlaması:** əməkhaqqının band/şkalaya uyğunluğu yoxlananda **net + yemək pulu birlikdə** nəzərə alınır (UI-da xəbərdarlıq).

### 11.8 Büdcə ilə əlaqə
Rəhbər **net** yazır → `newGross = solveGross(newNet)` → yemək pulu qaydası tətbiq olunur → **büdcə `Δgross` qədər draft azalır** (§7.3). Yəni büdcə həmişə gross-la nəzarətdə, giriş isə net-lə.

---

## 12. Market (bazar) analiz datası

- **Yükləmə:** CSV/XLSX → Firebase Storage; parse (SheetJS/ExcelJS) → `marketData` kolleksiyası.
- **Sahələr:** `grade/position`, `P25`, `P50 (median)`, `P75`, `P90`, `currency`, `source`, `year`.
- **Analitika:** compa-ratio (median-ə görə), range penetration, below/at/above market göstəricisi.
- **Planlama ekranında:** əməkdaşın market mövqeyi rəngli badge; artım tövsiyəsi (opsional merit matrix ilə).
- **Şablon:** yükləmə üçün nümunə CSV şablonu (`Employee Badge, Cari Gross, Cari Yemek Pulu, Net Artim` — BirCalc bulk formatına uyğun).

---

## 13. Data modeli (Firestore)

> Gradex pattern-i: hər domen sənədi üçün **Zod schema → TS type**; Zustand store Firestore modelini güzgüləyir.

```
companies/{companyId}
  { name, country, currency, fiscalYearStart, taxProfile, mealLimit,
    minGrossDiff:{branch, hq}, createdBy, createdAt }

memberships/{userId_companyId}
  { userId, companyId, roles:[...], structureIds:[...], active }

structures/{structureId}
  { companyId, type:'division|department|team|position',
    parentId, name, managerIds:[], reviewerIds:[],
    approvalChain:[roleOrUserRef...], archived }

grades/{gradeId}
  { companyId, code, order, levels:[{id,name,min,mid,max}] }

employees/{employeeId}
  { companyId, positionId, gradeId, levelId, badge, fullName,
    currentNet, currentGross, currentSuperGross, currentMeal, currency,
    ctx:{sector, workplace, benefit, unionPct}, effectiveDate }

budgets/{budgetId}
  { companyId, structureId, year, allocatedGross,
    committedGross, spentGross }   // remaining = allocated − committed − spent

cycles/{cycleId}
  { companyId, structureId, year, name, status, round,
    createdBy, createdAt, submittedAt, finalizedAt }

planningItems/{itemId}
  { companyId, cycleId, employeeId, structureId,
    inputMode:'percent|amount|absolute', inputValue,
    currentNet, newNet, newGross, newSuperGross, newMeal,
    newGradeId, newLevelId, effectiveDate, effectiveMonths,
    deltaGrossAnnual, reason, status, round,
    hrComment, managerComment, version, updatedAt }

marketData/{marketId}
  { companyId, gradeId, position, p25, p50, p75, p90, source, year }

auditLog/{logId}
  { companyId, entity, entityId, action, actorId, actorRole,
    before, after, timestamp }
```

---

## 14. Firestore Security Rules (prinsip)

> Gradex-dəki `firestore.rules` (multi-tenant + role-based) nümunəsinə uyğun.

```
match /databases/{db}/documents {
  function member(cid) {
    return exists(/.../memberships/$(request.auth.uid + '_' + cid));
  }
  function role(cid, r) {
    return get(/.../memberships/$(request.auth.uid+'_'+cid)).data.roles.hasAny([r]);
  }
  function inStructure(cid, sid) {
    return sid in get(/.../memberships/$(request.auth.uid+'_'+cid)).data.structureIds;
  }

  match /companies/{cid} {
    allow read: if member(cid);
    allow write: if role(cid,'CompanyAdmin') || role(cid,'PlatformOwner');

    match /planningItems/{id} {
      allow read: if member(cid) &&
        (role(cid,'HRAdmin') || role(cid,'HRReviewer') ||
         (role(cid,'Manager') && inStructure(cid, resource.data.structureId)));
      allow create,update: if
        (role(cid,'Manager') && inStructure(cid, request.resource.data.structureId)
           && request.resource.data.status in ['draft','submitted','withdrawn'])
        || (role(cid,'HRAdmin') || role(cid,'HRReviewer'));
    }
  }
}
```
- Manager yalnız öz strukturunun sətirlərini oxuyur/yazır və yalnız draft/submit/withdraw statuslarına.
- Approve/reject/edit/final yalnız HR/Finance rollarına.
- Bütün kritik status keçidləri həm client, həm **server (server action / Cloud Function)** validasiyası ilə.

---

## 15. Frontend memarlıq və dizayn

### 15.1 Stack (Gradex ilə eyni)
| Layer | Seçim |
|---|---|
| Framework | Next.js (App Router) + React + TypeScript (strict) |
| Styling | Tailwind CSS v4 + shadcn-style komponent kitabxanası |
| Animasiya | Framer Motion |
| İkonlar | lucide-react |
| Qrafiklər | Recharts |
| State | Zustand (persisted) + TanStack Query |
| Forms/validation | React Hook Form + Zod |
| Auth/DB | Firebase Web SDK (client) + Admin SDK (server) |
| Deploy | Vercel |

### 15.2 Dizayn tokenləri (Gradex-dən)
```css
--radius: 0.75rem;                 /* 12px */
--background:#f7f8fc; --foreground:#0f1129;
--card:#ffffff;
--primary:#5b5bf5;  --primary-foreground:#ffffff; --primary-soft:#eeeefe; /* periwinkle */
--secondary:#f2f3f8; --muted:#f2f3f8; --muted-foreground:#6b6f8a;
--destructive:#ff6a6a; --success:#16c098; --warning:#f5a524; --info:#4dabf7;
--border:#e7e9f2; --ring:#5b5bf5;
--shadow-card: 0 4px 16px -4px rgba(15,17,41,.08), 0 2px 4px -2px rgba(15,17,41,.04);
--shadow-glow: 0 8px 24px -6px rgba(91,91,245,.35);
/* Dark mode: --background:#0e1024; --card:#181b33; --primary:#6e6cff; ... */
```
- **Font:** Montserrat (400–800) + Geist Mono (rəqəmlər/mono).
- **Estetika:** light-first productivity, yumşaq səthlər, layered kölgələr, primary glow, 12px radius, birinci-dərəcəli dark mode.

### 15.3 Əsas ekranlar
1. **Landing / Auth** — login/signup (Email + Google).
2. **Company switcher + App shell** — sidebar + top bar + global search (Gradex app-shell pattern).
3. **Dashboard** — büdcə istifadəsi, cycle statusları, market mövqeyi, aqreqatlar (Recharts).
4. **Structure** — org ağacı, büdcə təyini, rol/assignment.
5. **Grades & Bands** — grade/level/band redaktoru (Gradex "structure grid" ilhamı).
6. **Planning (Manager)** — əməkdaş cədvəli, net/faiz giriş, canlı gross/meal/supergross, büdcə qalığı, "Send to Review".
7. **Review (HR)** — row-level action paneli, bulk bar, filter, round tarixçəsi.
8. **Market Data** — upload, şablon, compa-ratio görünüşü.
9. **Reports / Export** — Excel (ExcelJS) / PDF (html2pdf.js) ixracı.
10. **Settings** — vergi profili, valyuta, meal limiti, siyasətlər, audit log.

### 15.4 Planning cədvəli — sütun sxemi
`Əməkdaş | Grade/Level | Cari Net | Cari Gross | Giriş(%/₼) | Yeni Net | Yeni Gross | Yeni Meal | SuperGross | Δ Büdcə | Band | Status | Aksiya`

---

## 16. API / Server actions

Next.js Server Actions (və ya `/api/*`) + Admin SDK (server-only). Nümunə əməliyyatlar:
- `createCompany`, `inviteMember`, `assignRole`
- `upsertStructure`, `setBudget`
- `createCycle`, `savePlanningItem`, `submitCycleForReview`
- `hrAction(itemId, action, payload)` — approve/reject/return/edit
- `bulkHrAction(itemIds, action)`
- `finalizeCycle` — approved sətirləri commit→spent, employee update, audit yaz
- `uploadMarketData`, `exportReport`
- Bütün mutasiyalar **server-side validasiya** (Zod + biznes qaydaları: level max, budget, status keçidi) + **audit log** yazır.

---

## 17. Hesabatlar və ixrac
- Büdcə icra hesabatı (struktur üzrə allocated/committed/spent/remaining).
- Cycle nəticə hesabatı (approved/rejected/returned sayları, ümumi Δgross/Δsupergross).
- Əməkdaş üzrə before/after cədvəli.
- Market mövqe hesabatı (compa-ratio bölgüsü).
- İxrac: **Excel** (ExcelJS) və **PDF** (html2pdf.js) — Gradex-dəki asılılıqlarla eyni.
- (Opsional) təsdiqdən sonra **compensation letter** generasiyası.

---

## 18. Qeyri-funksional tələblər (NFR)
- **Təhlükəsizlik:** multi-tenant izolyasiya, RBAC, server-side validasiya, həssas maaş datası yalnız icazəli rollara.
- **Auth:** Firebase Auth (Email/Password + Google); server tərəf Admin SDK (private key yalnız serverdə, `\n` un-escape).
- **Performans:** real-time hesablamalar client-side (pure engine); kritik validasiya server-side; TanStack Query cache.
- **Etibarlılıq:** audit trail dəyişməz (append-only); optimistic concurrency.
- **Lokalizasiya:** AZ/EN; valyuta multi-currency; vergi profili ölkə üzrə.
- **Əlçatanlıq:** klaviatura naviqasiyası, kontrast, ARIA (shadcn/Radix bazası).
- **Deploy:** Vercel; env dəyişənləri (`NEXT_PUBLIC_FIREBASE_*` client, `FIREBASE_*` server). Demo mode: Firebase olmadan seed data ilə işləmə (Gradex-dəki kimi, opsional).

---

## 19. Env dəyişənləri (nümunə)
```
# Client (safe)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
# Server-only (Admin SDK)
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=      # literal \n saxlanılır, runtime-da un-escape
```

---

## 20. Repo strukturu (təklif)
```
src/
  app/
    (app)/           # authenticated shell
      dashboard/  structure/  grades/  planning/  review/
      market/  reports/  settings/
    (auth)/          # login, signup
    page.tsx         # landing
  components/
    ui/              # shadcn-style: button, card, dialog, table, select…
    app-shell/       # sidebar, topbar, company-switcher, global search
    charts/          # Recharts
    planning/  review/  budget/  bands/
  lib/
    comp/            # PURE engine: getDeductions, solveGross, employerCosts, meal, taxConfig  (unit-tested)
    budget/          # büdcə hesablamaları (pure)
    firebase/        # client.ts + admin.ts
    demo/            # seed data (engine ilə qurulmuş)
  stores/            # Zustand (Firestore modelini güzgüləyir)
  types/             # Zod → TS (bütün domen sənədləri)
firestore.rules
storage.rules
scripts/seed.ts
.env.example
```

---

## 21. Fazalaşdırma (Roadmap)

**Faza 1 — MVP**
Multi-company · struktur · grade/band · büdcə (gross) · per-employee planning (net/%/level max) · net→gross→supergross + meal engine · draft büdcə azalma · review workflow (row-level HR approve/reject/return/edit/bulk, cycle → finalize) · RBAC · audit · Excel export.

**Faza 2**
Market data + compa-ratio · dashboard analitikası · notification (email) · PDF export · demo mode.

**Faza 3**
Merit matrix · scenario/what-if · total comp (bonus/equity) · pay equity · compensation letters · payroll export API.

---

## 22. Kəbul meyarları (Acceptance — nümunə)
- Rəhbər net artım yazır → gross, supergross, meal düzgün hesablanır və büdcə **gross Δ** qədər azalır. ✔
- Yeni maaş level max-ı aşdıqda submit **bloklanır**. ✔
- "Send to Review" sonrası HR **hər sətri** ayrı approve/reject/return/edit edə bilir; bulk işləyir. ✔
- Returned sətir rəhbərə qayıdır, düzəldilib yenidən göndərilir; round artır; cycle son təsdiqə qədər davam edir. ✔
- Finalize-də approved sətirlər `committed → spent` keçir, employee datası yenilənir, audit yazılır. ✔
- Manager başqa strukturun və ya başqa şirkətin datasını **görə bilmir** (rules ilə). ✔

---

## 23. Açıq suallar / konfiqurasiyalar
- Level max müqayisəsi **gross** üzərindənmi, yoxsa net+meal üzərindənmi? (default: gross)
- Over-budget final approve icazəsi kimə? (default: HRAdmin + Finance)
- HR "edit" avtomatik approve olsun, yoxsa Manager təsdiqi tələb etsin? (default: auto, audit ilə)
- Yemək pulu limiti və min gross fərqi şirkət səviyyəli konfiqurasiya (default: 100 / 20 / 50).
- Effektiv aylar (`effectiveMonths`) fiscal year-a görə avtomatik hesablansın.

---

*Bu SRS icra üçün hazırdır. Vergi düsturları və dizayn tokenləri istifadəçinin öz repolarındakı (Mycalcpro, Gradex) dəqiq dəyərlərlə birbaşa uzlaşdırılıb; qanunvericilik dəyişikliyində yalnız `taxConfig` yenilənməlidir.*
