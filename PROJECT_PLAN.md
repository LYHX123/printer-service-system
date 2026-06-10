# Printer & Office Equipment Service System — Project Plan (v4)

---

## 1. Project Overview

A web-based service management system for a **printer and office equipment service company**.
Covers the complete business workflow: quotation → job creation → engineer assignment → diagnosis → repair → spare parts tracking → PDF report → customer digital sign-off → delivery → warranty tracking.

**Equipment serviced:** Printers · Copiers · Laptops · Desktop Computers · Projectors · CCTV Systems

**Stack:** Next.js 16 (App Router, Turbopack) · TypeScript · Tailwind CSS v4 · PostgreSQL 16 (Docker) · Prisma v7 · NextAuth v5 · React 19

---

## 2. User Roles & Permissions

| Feature | Admin | Manager | Engineer | Receptionist |
|---|:---:|:---:|:---:|:---:|
| Manage companies / settings | ✅ | ❌ | ❌ | ❌ |
| Manage users | ✅ | ❌ | ❌ | ❌ |
| Manage customers & branches | ✅ | ✅ | ❌ | ✅ |
| Manage equipment records | ✅ | ✅ | ✅ | ✅ |
| Create / manage quotations | ✅ | ✅ | ❌ | ✅ |
| Convert quotation to job | ✅ | ✅ | ❌ | ✅ |
| Create service jobs | ✅ | ✅ | ❌ | ✅ |
| Assign engineer to job | ✅ | ✅ | ❌ | ❌ |
| Update job status | ✅ | ✅ | ✅ | ❌ |
| Write technician notes | ✅ | ✅ | ✅ | ❌ |
| Write repair reports | ✅ | ✅ | ✅ | ❌ |
| Record spare parts used | ✅ | ✅ | ✅ | ❌ |
| Upload device photos | ✅ | ✅ | ✅ | ✅ |
| Capture customer signature | ✅ | ✅ | ❌ | ✅ |
| Manage inventory / stock | ✅ | ✅ | ❌ | ❌ |
| View inventory | ✅ | ✅ | ✅ | ✅ |
| Export PDF report / quotation | ✅ | ✅ | ✅ | ✅ |
| View dashboard (all engineers) | ✅ | ✅ | ❌ | ❌ |
| View dashboard (own jobs only) | ✅ | ✅ | ✅ | ✅ |
| View engineer productivity | ✅ | ✅ | ✅ (own) | ❌ |
| Delete records | ✅ | ❌ | ❌ | ❌ |

---

## 3. Database Design (v4)

### 3.1 Entity Map

```
Company
  └─< User                          (staff, roles)
  └─< Customer
        └─< CustomerBranch          (offices / project sites)
              └─< Equipment         (devices at each branch)
              └─< ServiceJob        (jobs at each branch)
              └─< Quotation         (quotes for branch)
  └─< Equipment                     (also linked direct to customer if no branch)
  └─< ServiceJob
  └─< Quotation
        └─< QuotationItem           (line items on quotation)
        └──1 ServiceJob             (job created when quotation is converted)
  └─< SparePart
        └──1 InventoryStock         (current stock level)
        └─< InventoryTransaction    (stock movements)
        └─< PurchaseOrderItem
  └─< PurchaseOrder
        └─< PurchaseOrderItem

ServiceJob
  └──1 RepairReport
        └─< JobPart                 (parts used, links to SparePart optionally)
  └─< JobPhoto                      (before / after)
  └─< JobStatusLog                  (immutable audit trail)
  └─< InventoryTransaction          (stock OUT when parts are used)
```

### 3.2 Full Table List (21 tables)

| Table | Purpose |
|---|---|
| Company | Service company (tenant) |
| User | Staff: Admin · Manager · Engineer · Receptionist |
| Customer | Client company or individual |
| **CustomerBranch** | Offices / project sites per customer |
| **CustomerContract** | Service contracts, maintenance agreements, warranty docs |
| Equipment | Registered devices |
| **EquipmentPhoto** | Device photo gallery (independent of jobs) |
| **MeterReading** | Time-series page counter history (Printer / Copier) |
| ServiceJob | Service job lifecycle |
| Quotation | Pre-job quotation |
| QuotationItem | Line items on a quotation |
| JobPhoto | Before / after photos per job |
| RepairReport | Engineer's structured repair report |
| JobPart | Spare parts used in a repair |
| JobStatusLog | Immutable status-change audit trail |
| SparePart | Spare parts catalog |
| InventoryStock | Current stock level per part |
| InventoryTransaction | Stock movement history |
| PurchaseOrder | Purchase orders to suppliers |
| PurchaseOrderItem | Line items on a purchase order |

### 3.3 New & Updated Models

#### `CustomerContract` *(new)*
> Stores service contracts, maintenance agreements, and warranty documents as file attachments.

| Field | Type | Notes |
|---|---|---|
| id | UUID PK | |
| companyId | UUID FK → Company | |
| customerId | UUID FK → Customer | |
| branchId | UUID? FK → CustomerBranch | optional: branch-specific contract |
| title | String | e.g. "Annual Maintenance 2026" |
| contractType | ContractType | SERVICE_CONTRACT · MAINTENANCE_AGREEMENT · WARRANTY_DOCUMENT · OTHER |
| status | ContractStatus | ACTIVE · EXPIRED · TERMINATED |
| startDate | Date? | |
| endDate | Date? | |
| fileUrl | String? | path to uploaded PDF/document |
| fileName | String? | original file name |
| fileSizeBytes | Int? | |
| notes | String? | |
| createdById | UUID FK → User | |

**ContractType:** `SERVICE_CONTRACT` · `MAINTENANCE_AGREEMENT` · `WARRANTY_DOCUMENT` · `OTHER`
**ContractStatus:** `ACTIVE` · `EXPIRED` · `TERMINATED`

Contract expiry alerts: contracts expiring within 30 days surfaced on the dashboard.

#### `EquipmentPhoto` *(new)*
> Equipment-level photo gallery — independent of service jobs.

| Field | Type | Notes |
|---|---|---|
| equipmentId | UUID FK → Equipment | |
| fileUrl | String | |
| fileName | String | |
| mimeType | String | |
| sizeBytes | Int | |
| caption | String? | |
| uploadedById | UUID FK → User | |

Stored at `/public/uploads/equipment/[id]/`. Shown on the equipment detail page alongside (but separate from) job photos. Useful for documenting device condition at registration, or before/after a service visit not already covered by job photos.

#### `MeterReading` *(new)*
> Time-series page counter history for Printers and Copiers.

| Field | Type | Notes |
|---|---|---|
| equipmentId | UUID FK → Equipment | |
| jobId | UUID? FK → ServiceJob | set when reading is taken at job intake |
| readingDate | DateTime | |
| blackPages | Int? | cumulative B&W page count |
| colorPages | Int? | cumulative colour page count |
| recordedById | UUID FK → User | |
| notes | String? | |

A `MeterReading` record is automatically created when:
1. A service job is created for a PRINTER or COPIER (job intake reading; `jobId` set)
2. An engineer manually records a reading outside a job (monthly usage tracking)

**Usage trend analysis:**
- Delta between consecutive readings = pages printed in that period
- Charts: monthly page volume (line), B&W vs Colour split (stacked bar)
- Average monthly usage used to predict maintenance intervals

#### `CustomerBranch` *(new)*
> Branches, offices, or project sites belonging to a customer.

| Field | Type | Notes |
|---|---|---|
| id | UUID PK | |
| companyId | UUID FK → Company | |
| customerId | UUID FK → Customer | |
| name | String | e.g. "KL HQ", "PJ Branch", "Setia Alam Site" |
| address | Text? | |
| phone | String? | |
| contactPerson | String? | |
| isPrimary | Boolean | default false |
| isActive | Boolean | default true |

Equipment and ServiceJobs can be linked to a branch via `branchId` (optional). If no branch, the job is linked directly to the customer.

#### `Equipment` *(updated)*
New fields:
- `branchId` — optional: which branch/site the device lives at
- `assetNumber` — optional internal asset tag (e.g. ASSET-0042)
- `warrantyExpiry` — manufacturer warranty expiry date (distinct from service warranty)

#### `ServiceJob` *(updated)*
New fields:
- `branchId` — optional: which branch/site the job is for
- `quotationId` — optional: links back to the Quotation this job was created from
- `technicianNotes` — raw field observations written by engineer; used as AI input for auto-generating the repair report

#### `Quotation` *(new)*
> Created before repair begins. Can be sent to customer, approved, and converted to a ServiceJob.

| Field | Type | Notes |
|---|---|---|
| id | UUID PK | |
| quotationNumber | String UNIQUE | Q-YYYY-NNNN |
| companyId | UUID FK | |
| customerId | UUID FK | |
| branchId | UUID? FK | |
| equipmentId | UUID? FK | optional at creation |
| serviceType | Enum | |
| status | QuotationStatus | DRAFT → SENT → APPROVED → CONVERTED |
| validUntil | Date? | |
| problemDesc | Text | |
| labourCost | Decimal | |
| partsCost | Decimal | |
| totalCost | Decimal | |
| remarks | Text? | customer-facing remarks |
| internalNotes | Text? | |
| createdById | UUID FK | |
| approvedAt | DateTime? | |

**QuotationStatus flow:**
```
DRAFT → SENT → APPROVED → CONVERTED (job created)
                └→ REJECTED
                └→ EXPIRED (past validUntil)
```

#### `QuotationItem` *(new)*
> Line items on a quotation (parts, labour descriptions).

| Field | Type |
|---|---|
| quotationId | UUID FK |
| description | String |
| quantity | Int |
| unitPrice | Decimal |
| subtotal | Decimal (auto) |

#### `RepairReport` *(updated)*
New fields:
- `rawInput` — the technician notes passed to AI for generating the report
- `isAiGenerated` — flag: was the diagnosis/workDone generated by AI?

#### `SparePart` *(updated)*
New field: `category` (PartCategory enum) — enables filtering by equipment type.

#### `Company` *(updated)*
New field: `stampUrl` — company stamp image embedded in PDF.

#### `User` *(updated)*
New field: `signatureUrl` — engineer's hand-drawn or uploaded signature, embedded in PDF sign-off.

### 3.3 Equipment Types

| Value | Equipment |
|---|---|
| `PRINTER` | All printer types (laser, inkjet, dot-matrix) |
| `COPIER` | Standalone copiers and MFPs |
| `LAPTOP` | Notebooks, ultrabooks |
| `DESKTOP_COMPUTER` | Tower PCs, all-in-ones |
| `PROJECTOR` | DLP/LCD projectors |
| `CCTV_SYSTEM` | IP/analog cameras, DVR/NVR systems |
| `OTHER` | Any other office equipment |

### 3.4 Part Categories (PartCategory enum)

| Value | Covers |
|---|---|
| `TONER` | Toner cartridges (all brands) |
| `DRUM` | Drum units / OPC drum |
| `DEVELOPER` | Developer units |
| `FUSER` | Fuser assemblies |
| `MAINTENANCE_KIT` | Maintenance kits |
| `ROLLER` | Pickup, feed, transfer rollers |
| `LAPTOP_PART` | RAM, SSD, battery, keyboard, fan, LCD |
| `DESKTOP_PART` | RAM, HDD/SSD, PSU, GPU, case fan |
| `CCTV_PART` | Camera, DVR HDD, POE switch, cables |
| `PROJECTOR_PART` | Lamp, DMD chip, air filter, lens |
| `GENERAL` | Consumables and miscellaneous |

### 3.5 AI Report Generation Design

The schema is structured so Claude AI can auto-generate repair reports from technician field notes:

```
Engineer writes → ServiceJob.technicianNotes
  (raw observations during the job: what was found, what was done, parts used)

AI reads:
  - ServiceJob.technicianNotes       (primary input)
  - Equipment.type + brand + model   (context: what kind of device)
  - ServiceJob.serviceType           (repair / maintenance / upgrade)
  - ServiceJob.problemDesc           (original reported complaint)
  - JobPart[]                        (parts already recorded)

AI writes (pre-fills for engineer to review):
  - RepairReport.diagnosis
  - RepairReport.workDone
  - RepairReport.recommendations

Stored:
  - RepairReport.rawInput = the technician notes used
  - RepairReport.isAiGenerated = true
```

The engineer reviews the AI output, edits if needed, and saves. The `isAiGenerated` flag marks AI-assisted reports for audit purposes.

---

## 4. Page Structure

```
/                                        → Redirect: /dashboard or /login
/login

/dashboard                               → KPI cards · charts · active jobs · warranty alerts

/quotations                              → Quotation list (filter: status, customer, date)
/quotations/new                          → Create quotation
/quotations/[id]                         → Quotation detail + approve/reject/convert actions
/quotations/[id]/edit                    → Edit quotation (DRAFT only)
/quotations/[id]/pdf                     → Quotation PDF preview + download

/customers                               → Customer list
/customers/new                           → Add customer
/customers/[id]                          → Customer profile · branches · equipment · jobs · contracts
/customers/[id]/edit                     → Edit customer
/customers/[id]/branches/new             → Add branch/site
/customers/[id]/branches/[bid]/edit      → Edit branch
/customers/[id]/contracts/new            → Upload contract / agreement document
/customers/[id]/contracts/[cid]          → Contract detail + download

/equipment                               → Equipment list (filter: type, brand, customer, branch)
/equipment/new                           → Register equipment (select customer → branch → specs)
/equipment/[id]                          → Equipment detail · photos · meter history · service history
/equipment/[id]/edit                     → Edit equipment
/equipment/[id]/photos                   → Equipment photo gallery (upload + manage)
/equipment/[id]/meters                   → Meter reading history + usage trend chart (PRINTER/COPIER only)
/equipment/[id]/meters/new               → Record manual meter reading

/jobs                                    → Job list (filter: status, type, engineer, equip type)
/jobs/new                                → Create job (3-step: customer/equip → details → assign)
/jobs/[id]                               → Job detail: Info · Status · Photos · Report · Cost
/jobs/[id]/edit                          → Edit job core info
/jobs/[id]/status                        → Update status (allowed transitions + mandatory note)
/jobs/[id]/photos                        → Before / after photo upload + gallery
/jobs/[id]/signature                     → Customer digital signature capture
/jobs/[id]/report                        → Repair report: diagnosis + parts table + AI assist
/jobs/[id]/report/pdf                    → PDF preview (equipment-specific template) + download

/inventory                               → Spare parts list + stock levels (filter: category)
/inventory/new                           → Add spare part
/inventory/[id]                          → Part detail + transaction history
/inventory/[id]/adjust                   → Stock adjustment (IN / OUT / ADJUSTMENT)

/reports                                 → All repair reports list
/reports/engineers                       → Engineer productivity: jobs · open · completed · revenue

/users                                   → User list (Admin only)
/users/new                               → Add user
/users/[id]/edit                         → Edit user · role · active status · upload signature

/settings                                → Company profile · logo · stamp upload
/profile                                 → My profile · password change · upload signature
```

---

## 5. Development Phases

### ✅ Phase 1 — Project Setup & Auth (COMPLETE)
- Next.js 16 + TypeScript + Tailwind CSS v4
- PostgreSQL via Docker (`printer-service-db`)
- Full Prisma schema (all tables)
- NextAuth v5 Credentials + bcrypt
- `proxy.ts` route protection (Next.js 16 convention)
  - `auth.config.ts` — edge-safe (no Prisma)
  - `lib/auth.ts` — full server-side auth
- Login page UI

---

### Phase 2 — App Shell & Shared UI

**Goal:** Complete navigable shell and all reusable components, built once and reused everywhere.

#### 2.1 Layout
- **Sidebar**: collapsible on mobile, fixed on desktop
- **Topbar**: breadcrumb / page title, user avatar, role badge, sign-out
- Active link highlighting; smooth collapse animation

#### 2.2 Role-gated Navigation
| Link | Icon | Min role |
|---|---|---|
| Dashboard | ChartBar | Receptionist |
| Quotations | DocumentText | Receptionist |
| Customers | UserGroup | Receptionist |
| Equipment | DeviceTablet | Receptionist |
| Jobs | Wrench | Receptionist |
| Inventory | Archive | Manager |
| Reports | ClipboardList | Engineer |
| Engineer Productivity | ChartPie | Engineer (own) / Manager+ (all) |
| Users | Users | Admin |
| Settings | Cog | Admin |

#### 2.3 Reusable Components (`src/components/ui/`)

| Component | Details |
|---|---|
| `Button` | primary / secondary / danger / ghost; size sm/md/lg; loading spinner |
| `Input` | text · number · date · email; label; error message |
| `Select` | single dropdown; grouped options |
| `Textarea` | auto-resize; char count optional |
| `Badge` | colour-coded: status · priority · equipment type · quotation status |
| `StatusBadge` | maps JobStatus → colour + label |
| `QuotationStatusBadge` | maps QuotationStatus → colour + label |
| `EquipmentTypeBadge` | type icon + label |
| `PartCategoryBadge` | part category label |
| `Table` | sortable headers; striped; empty state; pagination |
| `Modal` | confirm dialogs; portal |
| `Toast` | success · error · warning; auto-dismiss |
| `PageHeader` | title + subtitle + action slot |
| `MetricCard` | KPI card for dashboard |
| `Skeleton` | list and detail page loading states |
| `EmptyState` | illustration + message + CTA |
| `FileUploader` | drag-drop + preview; max 5MB; jpg/png/webp |
| `SignatureCanvas` | react-signature-canvas; clear + save |

#### 2.4 Colour System

**Job Status:**
| Status | Colour |
|---|---|
| RECEIVED | Blue |
| DIAGNOSING | Yellow |
| WAITING_SPARE_PARTS | Orange |
| WAITING_CUSTOMER_APPROVAL | Purple |
| REPAIRING | Indigo |
| TESTING | Cyan |
| READY_FOR_COLLECTION | Green |
| DELIVERED | Slate |
| CANCELLED | Red |

**Quotation Status:**
| Status | Colour |
|---|---|
| DRAFT | Slate |
| SENT | Blue |
| APPROVED | Green |
| REJECTED | Red |
| CONVERTED | Violet |
| EXPIRED | Amber |

**Priority:**
| Priority | Colour |
|---|---|
| LOW | Slate |
| NORMAL | Blue |
| HIGH | Orange |
| URGENT | Red |

---

### Phase 3 — Customer, Branch & Equipment Management

**Goal:** Full CRUD for customers, their branches/sites, and all registered equipment with complete service history.

#### 3.1 Customers

**List** `/customers`:
- Search: name, phone, company name
- Columns: code · name · company · phone · branch count · equipment count · last job

**Profile** `/customers/[id]`:
- Info card
- Tabs: **Branches** · **Equipment** · **Service History** · **Quotations** · **Contracts**
- Branches tab: list of branches/sites with address, contact person; add/edit/deactivate
- Equipment tab: all equipment across all branches, with type badge and last service date
- History tab: all service jobs sorted by date
- Quotations tab: all quotations (open and closed)
- **Contracts tab**: list of contracts + agreements with status badge and expiry date
- Quick action button: "New Quotation" / "New Job" pre-filled with this customer

#### 3.2 Customer Contracts `/customers/[id]/contracts`

**Upload Contract**:
- Fields: title (required), contract type, start date, end date, notes
- File upload: PDF or DOCX, max 10MB
- Stored at `/public/uploads/contracts/[customerId]/`
- Optional: scope to a specific branch

**Contract List** (tab on customer profile):
- Columns: title · type badge · status badge · start date · end date · file size · actions
- Status auto-computed: ACTIVE (within date range), EXPIRED (past end date), TERMINATED (manual)
- Download button opens/downloads the stored PDF/document

**Expiry Alerts** (dashboard widget):
- Contracts expiring within 30 days shown alongside warranty alerts
- Alert badge on customer list if any contract is expiring or expired

#### 3.3 Customer Branches

**Add/Edit** `/customers/[id]/branches/new`:
- Fields: name (required), address, phone, contact person, isPrimary toggle
- A customer can have unlimited branches
- Equipment and jobs can be linked to a specific branch

**Branch-aware filtering:**
- Equipment list: filter by branch
- Job list: filter by branch
- Customer profile: equipment and history grouped by branch

#### 3.4 Equipment

**List** `/equipment`:
- Filters: equipment type · brand · customer · branch
- Search: serial number · asset number · model
- Columns: type badge · brand · model · serial # · asset # · customer · branch · warranty status · last service

**Register** `/equipment/new`:
1. Select customer → optional select branch
2. Equipment type → form adapts:
   - All types: brand (required), model (required), serial number (required)
   - Asset number (optional, auto-suggest: ASSET-NNNN)
   - Purchase date, Manufacturer warranty expiry
   - Notes (pre-filled template by equipment type)
3. Meter reading capture: shown only for PRINTER / COPIER

**Detail** `/equipment/[id]` — Tabs:
- **Info**: type badge · serial # · asset # · brand/model · purchase date
  - Manufacturer warranty badge: Active (green) / Expired (red) / None (grey)
  - "New Job" / "New Quotation" buttons pre-filled with this equipment
- **Photos**: equipment photo gallery (add, caption, delete) — see §3.5
- **Meter History**: reading chart + table — shown only for PRINTER / COPIER — see §3.6
- **Service History**: all jobs in chronological order: job# · date · type · status · engineer · cost

#### 3.5 Equipment Photo Gallery `/equipment/[id]/photos`

- Dedicated gallery separate from job photos (which live on `/jobs/[id]/photos`)
- Typical use: device condition on registration, annual inspection photos, damage documentation
- Upload: drag-drop or click; jpg / png / webp; max 5MB; up to 20 photos per device
- Each photo: caption field, upload date, uploaded-by name
- Sharp: resize to max 1200px, strip EXIF
- Lightbox viewer; delete (Admin / Manager)
- Stored at `/public/uploads/equipment/[equipmentId]/`
- API route: `POST /api/equipment/[id]/photos`

#### 3.6 Printer / Copier Meter History `/equipment/[id]/meters`

Visible only when equipment type is `PRINTER` or `COPIER`.

**Reading capture (automatic):**
- When a service job is created for a PRINTER/COPIER and meter readings are entered, a `MeterReading` record is auto-created with `jobId` set and `readingDate = job.receivedDate`

**Manual reading entry** `/equipment/[id]/meters/new`:
- Fields: reading date, black pages (cumulative), colour pages (cumulative), notes
- Used for monthly usage tracking between service visits

**Meter History page:**
- **Usage trend chart** (line): B&W pages over time · Colour pages over time
- **Monthly usage bar chart**: pages printed per month (delta between readings)
- **Reading table**: date · B&W counter · Colour counter · delta since last reading · recorded by · linked job (if any)
- Average monthly pages (last 6 months) shown as summary stat
- Readings linked to a job show the job number as a clickable link

---

### Phase 4 — Quotation Module & Service Job Management

**Goal:** Full quotation workflow and service job lifecycle with branch and quotation linkage.

#### 4.1 Quotation Module

**List** `/quotations`:
- Filter: status · customer · engineer · date range
- Columns: Q# · customer · branch · equipment · service type · status badge · total · valid until · created by
- Highlight expired quotations (past validUntil, not yet CONVERTED/REJECTED)

**Create Quotation** `/quotations/new`:
1. Select customer → optional branch
2. Optional: select existing equipment (or describe equipment for new customers)
3. Service type
4. Problem description
5. Line items (QuotationItem): description · qty · unit price → auto-subtotal → auto-total
6. Labour cost (separate field)
7. Valid until date, remarks

**Quotation Detail** `/quotations/[id]`:
- Info panel: customer, branch, equipment, service type, created by, valid until
- Status badge + action bar:
  - DRAFT → **Send to Customer** (→ SENT) + Edit + Delete
  - SENT → **Mark Approved** + **Mark Rejected** + Resend
  - APPROVED → **Convert to Service Job** (one click → creates job, sets status CONVERTED)
  - REJECTED / EXPIRED → Read-only
  - CONVERTED → Link to converted job number
- Items table: description · qty · unit price · subtotal
- Cost summary: parts + labour + total
- Remarks (customer-facing) and internal notes

**Convert to Job flow:**
- Pre-fills the new service job with: customer, branch, equipment, service type, problem description from the quotation
- Sets `ServiceJob.quotationId` → `Quotation.id`
- Sets Quotation status → CONVERTED
- Redirects to the new job detail page

**Quotation PDF** `/quotations/[id]/pdf`:
- Branded header (company logo + stamp)
- Q# · date · valid until
- Customer / branch info
- Equipment info (if set)
- Items table + cost summary
- Remarks section
- Download: `[company]-Q-YYYY-NNNN.pdf`

#### 4.2 Service Jobs

**List** `/jobs`:
- Filters: status · service type · equipment type · engineer · priority · branch · date range
- Columns: job# · customer · branch · equipment · type · status · priority · engineer · due date
- Overdue jobs highlighted in red

**Create Job** `/jobs/new` (3-step form):
1. **Customer & Equipment**: search customer → optional branch → select equipment
   - Or: "Convert from Quotation" which pre-fills everything
2. **Job Details**:
   - Service type (UPGRADE only selectable for LAPTOP / DESKTOP_COMPUTER)
   - Priority · due date · problem description
   - Meter readings: shown only for PRINTER / COPIER
   - Technician notes (pre-filled placeholder by equipment type)
3. **Assignment**: select engineer (required, shows open job count per engineer)

Auto-generate: `JOB-YYYY-NNNN`

**Job Detail** `/jobs/[id]` — Tabs:
- **Info**: customer, branch, equipment (serial# + asset#), service type, priority, quotation link if applicable
- **Status**: current status + transition buttons + status log timeline
- **Photos**: before/after gallery
- **Report**: repair report inline view + parts table + AI assist button
- **Signature**: digital signature display or capture prompt
- **Cost**: labour + parts breakdown, warranty info

**Status Update** `/jobs/[id]/status`:
- Shows allowed next statuses per transition table
- Mandatory note field for every transition
- On DELIVERED: prompt for warranty period (days) → auto-compute warrantyExpires
- On CANCELLED: confirm dialog with reason

---

### Phase 5 — Photos, Customer Signature & Warranty

#### 5.1 Photo Upload `/jobs/[id]/photos`
- Two sections: Before Repair · After Repair
- Drag-drop or click (jpg / png / webp, max 5MB)
- Sharp: resize max 1200px, strip EXIF
- Up to 10 photos per section; caption per photo
- Delete (Admin/Manager); lightbox viewer
- Photos appear in repair report and PDF

#### 5.2 Customer Digital Signature `/jobs/[id]/signature`
- Signature canvas (react-signature-canvas) with clear + redo
- Saves as PNG → `/public/uploads/jobs/[id]/signature/`
- Records `signedAt` timestamp
- Shows existing signature with timestamp if already captured
- "Customer declines to sign" option → records note in statusLog
- **Signature required** before status can move to DELIVERED
- Signature displayed in PDF

#### 5.3 Warranty Tracking
- Warranty period set at DELIVERED status transition
- `warrantyExpires = completedAt + warrantyPeriod`
- Warranty badge on job/equipment detail: **Active** · **Expired** · **None**
- Dashboard: warranty-expiring-in-30-days list
- Equipment detail: service warranty history across all past jobs

---

### Phase 6 — Repair Report & Equipment-Specific PDF Templates

**Goal:** Structured repair reports with AI assist; 6 equipment-specific PDF layouts.

#### 6.1 Repair Report Form `/jobs/[id]/report`

- **Technician Notes** (free-text field): raw observations from the field
  - Placeholder text customised by equipment type
  - This is the AI input field
- **AI Assist button**: sends technician notes + job context to Claude → pre-fills Diagnosis, Work Done, Recommendations
  - `RepairReport.isAiGenerated = true`; `rawInput` stores the notes used
  - Engineer reviews AI output and saves (editable)
- **Manual fields** (always present, can bypass AI):
  - Diagnosis (what was found)
  - Work Done (what was performed)
  - Recommendations (for customer)
- **Labour Cost**
- **Spare Parts Table**:
  - Add row: part name · qty · unit price → auto-subtotal
  - Optional: link to inventory (search SparePart catalog; auto-deducts stock)
  - Parts total auto-calculated; total = labour + parts
- Save as draft (can re-edit); Mark complete (locks report)

#### 6.2 PDF Templates — 6 Equipment-Specific Layouts

Each template shares a common structure but has equipment-specific sections:

**Common to all templates:**
| Section | Source |
|---|---|
| Company header | logo · name · address · phone |
| Company stamp | `company.stampUrl` (bottom of page) |
| Report # + print date | generated |
| Job info | job# · received date · service type · priority |
| Customer info | name · company · branch name · phone · email |
| Equipment info | type · brand · model · serial # · asset # |
| Problem description | `serviceJob.problemDesc` |
| Spare parts table | `jobPart.*` (name · qty · unit price · subtotal) |
| Cost summary | labour · parts · **total** |
| Warranty | period + expiry date |
| Recommendations | `repairReport.recommendations` |
| Customer signature | embedded PNG |
| Engineer sign-off | engineer name · `user.signatureUrl` · completion date |
| AI-generated notice | shown if `isAiGenerated = true` |

**Template-specific sections:**

| Template | Extra Section |
|---|---|
| **Printer Report** | Meter readings (B&W pages · Colour pages at intake) |
| **Copier Report** | Meter readings + copy/scan/fax functions serviced |
| **Laptop Report** | Hardware spec (CPU · RAM · Storage · Display · Battery) + upgrade details |
| **Desktop Report** | Hardware spec (CPU · RAM · Storage · GPU · OS) + upgrade details |
| **Projector Report** | Lamp hours at intake · lamp replaced Y/N · brightness test result |
| **CCTV Report** | Camera count · DVR/NVR model · channels serviced · recording test |

**PDF naming:** `[CustomerCode]-JOB-YYYY-NNNN-[EquipmentType]-Report.pdf`

---

### Phase 7 — Spare Parts Inventory Management

**Goal:** Activate the inventory module — full CRUD, stock tracking, and integration with jobs.

#### 7.1 Spare Parts Catalog `/inventory`
- List with filters: category · brand · stock level (in stock / low / out of stock)
- Search: part number · name · compatible with
- Columns: category badge · part# · name · brand · stock qty · reorder level · status · unit price
- Low stock alert: quantity ≤ reorder level highlighted in orange
- Out of stock: highlighted in red

#### 7.2 Add / Edit Part `/inventory/new` and `/inventory/[id]`
- Fields: part number (auto or manual), name, category, brand, compatible with, unit, unit price, reorder level
- Stock tab: current quantity · location · last counted date
- Transaction history: every stock movement with date, type, reference, performed by

#### 7.3 Stock Movements `/inventory/[id]/adjust`
- Add stock (IN): reference/PO number, quantity, unit price
- Manual adjustment: reason note
- Stock OUT is auto-recorded when parts are used in a repair report job
- Receives stock from Purchase Orders

#### 7.4 Part-to-Job Integration
- When engineer records a spare part in a repair report:
  - If linked to inventory: stock OUT transaction auto-created
  - Job part cost pulled from catalog unit price (editable)
  - `InventoryTransaction.jobId` set for traceability

#### 7.5 Part Categories by Equipment
| When working on… | Show categories… |
|---|---|
| Printer / Copier | Toner · Drum · Developer · Fuser · Maintenance Kit · Roller |
| Laptop | Laptop Part |
| Desktop | Desktop / PC Part |
| Projector | Projector Part |
| CCTV | CCTV Part |
| Any | General |

---

### Phase 8 — Dashboard, Analytics & Engineer Productivity

**Goal:** Real-time KPIs, equipment-type breakdowns, and per-engineer productivity tracking.

#### 8.1 Dashboard `/dashboard`

**KPI Cards (row 1):**
| Card | Metric |
|---|---|
| Open Jobs | All non-terminal jobs |
| Overdue Jobs | Past due date, not DELIVERED/CANCELLED |
| Completed This Month | DELIVERED this calendar month |
| Revenue (MTD) | Sum of `totalCost` for DELIVERED this month |

**Charts:**
- **Jobs by Status** (donut) — current open jobs snapshot
- **Jobs by Equipment Type** (bar) — across all 6 categories
- **Jobs per Engineer** (horizontal bar) — current open job count per engineer
- **Monthly Job Trend** (line) — daily job intake over 30 days

**Lists:**
- Recent 10 jobs with status badge + equipment type
- **Warranty Expiring Soon** (30 days): job# · customer · equipment · expiry date
- **Contract Expiring Soon** (30 days): customer · contract title · type · end date
- **Low Stock Alerts**: parts at or below reorder level

Engineer-filtered view: ENGINEER role sees only their own jobs in all widgets.

#### 8.2 Engineer Productivity `/reports/engineers`

**Per-engineer metrics (all time + current month filter):**
| Metric | Source |
|---|---|
| Open Jobs | `ServiceJob` where assignedToId, non-terminal status |
| Completed Jobs | `ServiceJob` where assignedToId, status = DELIVERED |
| Average Days to Complete | completedAt − receivedDate average |
| Revenue Generated | Sum of `totalCost` for completed jobs |

**Productivity table** (Manager / Admin view — all engineers):
| Column | Description |
|---|---|
| Engineer | Name + role |
| Open Jobs | Current open |
| Completed (month) | DELIVERED this month |
| Avg Days | Average completion time |
| Revenue (MTD) | Total from completed jobs |

**Individual view** (Engineer sees own metrics + jobs list filtered to themselves).

#### 8.3 Reports List `/reports`
- Filter: engineer · equipment type · customer · service type · date range
- Columns: job# · customer · equipment type · engineer · date · parts count · total cost
- CSV export (Admin / Manager)
- Link to PDF for each report

---

### Phase 9 — Branding, Polish & Seed

#### 9.1 Company Branding

**Settings page** `/settings`:
- Company name, address, phone, email
- **Logo upload**: shown in PDF header; preview on page
- **Stamp upload**: shown in PDF footer/corner; preview on page
- Both images: jpg/png, max 1MB; Sharp resizes to standard dimensions

**Profile page** `/profile` + **User edit** `/users/[id]/edit`:
- **Engineer signature upload / draw**: capture via canvas OR upload image
- Saved to `/public/uploads/signatures/[userId]/signature.png`
- Preview shown in profile; embedded in PDF sign-off section

#### 9.2 UX Polish
- Loading skeletons on all list and detail pages
- Error boundaries + custom 404/500 pages
- Empty state: illustration + CTA for every list
- Toast notifications for every create / update / delete
- Confirm dialog for all destructive actions
- Disable submit button while saving, re-enable on error
- Mobile-responsive review: all pages

#### 9.3 Comprehensive Seed Data

| Entity | Count | Variety |
|---|---|---|
| Company | 1 | TechFix Services |
| Users | 4 | 1 per role; engineers have signature |
| Customers | 10 | Mix of individual + corporate |
| CustomerBranches | 8 | 2 branches each for 4 corporate customers |
| Equipment | 18 | 3× each of 6 equipment types |
| ServiceJobs | 24 | 4 jobs per equipment type; spread across all statuses |
| Quotations | 8 | 3 DRAFT · 2 SENT · 2 APPROVED · 1 CONVERTED |
| RepairReports | 12 | For jobs at TESTING / DELIVERED; mix of manual + AI-generated |
| JobParts | 30 | Realistic parts per equipment type (see below) |
| JobPhotos | 24 | 1 before + 1 after per completed report |
| Signatures | 8 | READY_FOR_COLLECTION + DELIVERED jobs |
| CustomerContracts | 6 | 2× SERVICE_CONTRACT · 2× MAINTENANCE_AGREEMENT · 1× WARRANTY_DOCUMENT · 1× expired |
| EquipmentPhotos | 12 | 2-3 gallery photos per equipment for the first 5 devices |
| MeterReadings | 20 | 10 readings per 2 copiers; linked to jobs where applicable |
| SpareParts | 20 | 3-4 per category |
| InventoryStock | 20 | Linked 1:1 to SpareParts |

**Realistic part names by category:**
- **Toner**: HP 85A Black Toner, Canon 057 Toner, Kyocera TK-1175
- **Drum**: HP CF219A Drum Unit, Brother DR-2455, Ricoh Type 1 Drum
- **Fuser**: HP RM1-8395 Fuser Assembly, Canon FM4-8213 Fuser
- **Maintenance Kit**: HP CE731A Maint Kit, Kyocera MK-1150
- **Laptop Part**: DDR4 8GB RAM, M.2 NVMe 512GB SSD, Laptop Cooling Fan, 65W Charger
- **Desktop Part**: DDR4 16GB RAM, 1TB SATA SSD, 550W PSU, 120mm Case Fan
- **CCTV Part**: 2MP IP Camera, 2TB Surveillance HDD, POE Switch 8-Port, CAT6 Cable 50m
- **Projector Part**: Epson ELPLP78 Lamp, BenQ 5J Lamp, Projector Air Filter

#### 9.4 End-to-End Walkthrough
1. **Receptionist** → Create customer (corporate, 2 branches) → Register copier at Branch A
2. **Receptionist** → Create quotation for copier repair → Set valid until 2 weeks
3. **Manager** → Review quotation → Mark Approved → Convert to Service Job → Assign engineer
4. **Engineer** → Open job → Update RECEIVED → DIAGNOSING → Write technician notes
5. **Manager** → Update DIAGNOSING → WAITING_SPARE_PARTS (parts ordered)
6. **Manager** → Update WAITING_SPARE_PARTS → REPAIRING (parts arrived)
7. **Engineer** → Upload 2 before-photos → Click AI Assist → Review generated report
8. **Engineer** → Add 3 spare parts from inventory (auto-deducts stock) → Mark report complete
9. **Engineer** → Upload 2 after-photos → REPAIRING → TESTING → READY_FOR_COLLECTION
10. **Receptionist** → Capture customer signature → Set 90-day warranty → DELIVERED
11. **Any role** → Download PDF report (Copier template with meter readings + signature + stamp)
12. **Admin** → Dashboard: KPIs updated · chart shows 1 completed · inventory reduced

---

## 6. Folder Structure

```
src/
├── app/
│   ├── (auth)/login/
│   ├── (dashboard)/
│   │   ├── layout.tsx              ← sidebar + topbar
│   │   ├── dashboard/
│   │   ├── quotations/
│   │   │   ├── page.tsx
│   │   │   ├── new/
│   │   │   └── [id]/
│   │   │       ├── page.tsx
│   │   │       ├── edit/
│   │   │       └── pdf/
│   │   ├── customers/
│   │   │   ├── page.tsx
│   │   │   ├── new/
│   │   │   └── [id]/
│   │   │       ├── page.tsx
│   │   │       ├── edit/
│   │   │       └── branches/
│   │   │           ├── new/
│   │   │           └── [bid]/edit/
│   │   ├── equipment/
│   │   │   ├── page.tsx
│   │   │   ├── new/
│   │   │   └── [id]/
│   │   │       ├── page.tsx
│   │   │       └── edit/
│   │   ├── jobs/
│   │   │   ├── page.tsx
│   │   │   ├── new/
│   │   │   └── [id]/
│   │   │       ├── page.tsx
│   │   │       ├── edit/
│   │   │       ├── status/
│   │   │       ├── photos/
│   │   │       ├── signature/
│   │   │       └── report/
│   │   │           ├── page.tsx
│   │   │           └── pdf/
│   │   ├── inventory/
│   │   │   ├── page.tsx
│   │   │   ├── new/
│   │   │   └── [id]/
│   │   │       ├── page.tsx
│   │   │       └── adjust/
│   │   ├── reports/
│   │   │   ├── page.tsx
│   │   │   └── engineers/
│   │   ├── users/
│   │   ├── settings/
│   │   └── profile/
│   └── api/
│       ├── auth/[...nextauth]/
│       ├── customers/
│       │   └── [id]/
│       │       └── contracts/      ← POST upload contract document
│       ├── equipment/
│       │   └── [id]/
│       │       ├── photos/         ← POST equipment photo upload
│       │       └── meters/         ← GET history, POST new reading
│       ├── quotations/
│       │   └── [id]/
│       │       └── convert/        ← POST: convert quotation to job
│       ├── jobs/
│       │   └── [id]/
│       │       ├── photos/
│       │       ├── signature/
│       │       ├── status/
│       │       └── report/
│       │           └── ai-assist/  ← POST: AI report generation endpoint
│       ├── inventory/
│       └── users/
├── auth.config.ts                  ← edge-safe (used by proxy.ts)
├── proxy.ts                        ← Next.js 16 route protection
├── components/
│   ├── ui/
│   ├── forms/
│   ├── layout/
│   ├── photos/
│   ├── signature/
│   └── pdf/
│       ├── PrinterReport.tsx
│       ├── CopierReport.tsx
│       ├── LaptopReport.tsx
│       ├── DesktopReport.tsx
│       ├── ProjectorReport.tsx
│       ├── CctvReport.tsx
│       └── QuotationPDF.tsx
├── lib/
│   ├── auth.ts
│   ├── prisma.ts
│   ├── uploads.ts
│   ├── job-number.ts
│   ├── quotation-number.ts         ← Q-YYYY-NNNN generator
│   ├── ai-report.ts                ← Claude API integration (Phase 6)
│   └── validations/
└── types/index.ts
```

---

## 7. Key Design Decisions

| Decision | Choice | Reasoning |
|---|---|---|
| Customer branches | Separate `CustomerBranch` model | Corporate customers have multiple sites; equipment and jobs need site linkage |
| Branch optional | `branchId` is nullable on Equipment + ServiceJob | Single-location customers don't need branch management |
| Asset number | Optional field on Equipment | Internal tracking separate from manufacturer serial# |
| Manufacturer warranty | `Equipment.warrantyExpiry` | Distinct from service warranty (`ServiceJob.warrantyExpires`) |
| Quotation module | Pre-job workflow | Allows cost approval before work begins; converts cleanly to a job |
| Quotation → Job | `ServiceJob.quotationId @unique` | One quotation = one job; bidirectional link for traceability |
| Technician notes | `ServiceJob.technicianNotes` | Separate from formal report; raw input for AI generation |
| AI report design | rawInput + isAiGenerated on RepairReport | Audit trail; engineer reviews before saving; not auto-committed |
| 6 PDF templates | One component per equipment type | Copier/Printer show meter readings; Laptop/Desktop show specs; CCTV/Projector show equipment-specific fields |
| Inventory activated | `SparePart` + `InventoryStock` + `PartCategory` | Tracks toner, drum, laptop parts, CCTV parts by category |
| Part-to-job link | `JobPart.partId` optional FK to SparePart | Can record free-text parts OR link to inventory for auto stock deduction |
| Company stamp | `Company.stampUrl` | Embedded in PDF footer alongside logo for official documents |
| Engineer signature | `User.signatureUrl` | Individual engineer sign-off per PDF report |
| Engineer productivity | Derived from ServiceJob data | No separate table; computed in queries |
| Customer contracts | `CustomerContract` model with file attachment | PDF/DOCX stored locally; expiry alerts on dashboard |
| Equipment photo gallery | Separate `EquipmentPhoto` model from `JobPhoto` | Job photos are before/after workflow; equipment photos are device-level documentation |
| Meter reading history | Separate `MeterReading` table, not just fields on ServiceJob | Enables time-series usage trends and predictive maintenance intervals |
| Meter reading auto-create | When job is created for PRINTER/COPIER, auto-create `MeterReading` with jobId | Single source of truth; trend chart includes all readings (job + manual) |
| Auth split | `auth.config.ts` (edge) + `lib/auth.ts` (Node) | Next.js 16 proxy runs in Edge Runtime; Prisma is Node.js-only |

---

*Last updated: 2026-06-08 — v4 (10 business requirements integrated)*
