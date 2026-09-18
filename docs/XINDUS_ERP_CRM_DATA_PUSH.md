# Xindus ERP → CRM — data push requirements

**Goal:** Push the same customer, shipment, revenue, invoice, owner, and tag facts that reps already see in ERP (dashboard, customer list, customer page, “new customers”) into CRM, every day, so managers and reps can work accounts without opening ERP for basic truth.

CRM is already live. We overlay ERP onto pipeline leads. Wrong or missing dates is why accounts like **XLP ENGINEERS** sat in **New Account** with Last shipment blank even though ERP showed **10 shipments, last transacted 11 Jul 2026**.

This document is the exact contract. Please expose these fields as a **stable JSON/CSV feed** (preferred: daily API + incremental since last sync). One **customer account** per row. Dates as `YYYY-MM-DD` (ISO). Large IDs as **strings**, not JSON numbers.

---

## 1. Why this exists (business)

| Role | What they do in CRM today | What they need from ERP |
| --- | --- | --- |
| **Rep** | Own a book, call, follow up, see “is this account shipping?” | Last shipment, pending invoice, their assigned accounts, tags (Commercial / Courier / B2B / B2C) |
| **Manager** | Team dashboard, owner filter, onboarding vs retention | New customers on the rep who have **not traded**, plus who went quiet after last shipment |
| **Company admin** | Pipeline stages, Unique customers, Home revenue | Unique shippers in a month/week, lifetime + period revenue, stage counts that match ERP truth |

Without ERP facts, CRM stages and Home dashboards are guesses. Reps will not trust the tool.

---

## 2. Where each ERP fact is used in CRM

```
ERP customer + shipments + invoices + owner + tags
        │
        ▼
  Match to CRM lead (keys in §4)
        │
        ├── Home → Unique customers (count + revenue by year/month/week, owner, tag)
        ├── Home → New customer onboarding / Retention (first shipment or created date, by team + owner)
        ├── Home → Pipeline snapshot (counts per stage)
        ├── Pipeline list → Status, Last shipment, Owner, Tags, Phone
        ├── Lead workspace → Lifetime revenue, shipment count, last/first shipment,
        │                    pending invoice, credit/overdue, ERP tags, owner
        └── Auto stage (unless a rep set status by hand)
```

Teams in CRM (Commercial, Courier, B2B, B2C, etc.) are created in **Team → org structure**. ERP **tags / customer type / channel / ship type** should map onto those teams and onto CRM **lead tags**, so a manager can filter “Courier book this month” without a spreadsheet.

---

## 3. Pipeline stages CRM already applies (do not invent a second model)

Qualified / Unqualified stay **manual** (sales judgement). ERP drives the trading stages.

| CRM stage | ERP rule | Why |
| --- | --- | --- |
| **Onboarding** | Customer exists in ERP (KYC/created) **and has never shipped** | Rep onboarded them; they are not a New Account until first shipment |
| **New Account** | **First shipment date** exists, and we are still inside **60 days from first shipment** | Hold new logos so the team does not treat them as “Active Trader” on day 2 |
| **Active Trader** | Last shipment **&lt; 60 days** ago (after New Account hold) | Working book |
| **Sales Opportunity** | Regular shipper (2+ shipments) idle **30–60 days** | Call now, before churn |
| **Churned** | Last shipment **&gt; 60 days** | Win-back |
| **Lost** | No shipment **2 years**, or **negative / overdue balance &gt; 1 year** | Stop wasting dials |
| **At Risk / Declining** | *(needs monthly volume — §5 P1)* volume down **&gt; 30% over 60 days** | Manager alert |

**Example already verified in ERP:** XLP ENGINEERS PVT LTD — shipment count 10, last transacted **2026-07-11** → **Churned**, not New Account. Last shipment in CRM must show that date.

If last shipment is missing, CRM cannot stage. Do not send `0` shipments without a clear `first_shipment_at = null`.

---

## 4. Identity keys — how we map ERP customer → CRM lead

Auto-match in this order. **Send every key you have on every row.**

| Priority | Field | Format | Why |
| --- | --- | --- | --- |
| **P0** | `xindus_customer_id` | string, e.g. `"1443"` | Stable ERP primary key. Store on CRM as `erp.revenue.xindusId`. |
| **P0** | `crm_id` | **string** (Zoho/CRM id, 18-digit). Never a JSON number | We already see this on the customer export (`Crm ID`). Matches existing pipeline `lead.id` when the lead came from Zoho. |
| **P0** | `gstin` | A–Z0–9 only, e.g. `06AAACX0076C1ZR` | Legal identity when names differ |
| **P0** | `phone` | last 10 digits of mobile | Fast match for India mobiles |
| **P0** | `email` | lowercase | Contact match |
| **P0** | `company_legal_name` | as in ERP | Display + fallback match |
| P1 | `pan` | 10-char | Duplicate companies |
| P1 | `crn` | e.g. `XIN-01225` | Xindus CRN |
| P1 | `iec` | string | Exporter identity |
| P1 | `parent_customer_id` | string | Group / child accounts |
| P1 | `sales_owner_user_id` | **ERP staff id, string** | Map to CRM user (see §6) |

**Manual fallback for reps:** if auto-match fails, CRM will let a rep paste **Xindus customer id** or **ERP staff id** onto the lead. For that to work, both IDs must be visible in ERP UI and in this feed.

**Do not** send Zoho ids as IEEE floats. 18-digit ids must be strings.

---

## 5. Field catalogue (push these)

### P0 — without these CRM is wrong (ship first)

| API / column name | Type | Source in ERP UI (as we see it) | Used in CRM |
| --- | --- | --- | --- |
| `xindus_customer_id` | string | Customer page ID | Match + lead header |
| `crm_id` | string | Customer field “Crm ID” | Match existing pipeline |
| `company_legal_name` | string | Company | Pipeline name, match |
| `contact_name` | string | Contact name | Lead person |
| `phone` | string | Phone | Pipeline, WhatsApp, match |
| `email` | string | Email | Match, outreach |
| `gstin` | string | GSTN | Match, finance |
| `city`, `state`, `country` | string | Address | Filters |
| `customer_created_at` | date | Created On | Onboarding dashboard if never shipped |
| `first_shipment_at` | date **or null** | Need on customer page / dashboard | **New Account hold**; Retention “onboarded” |
| `last_shipment_at` | date **or null** | Last Transacted Date | Pipeline **Last shipment**, all trading stages, Unique customers period |
| `shipment_count_lifetime` | number | Shipment Count | Lead, regular-shipper test |
| `lifetime_revenue` | number | Customer / dashboard lifetime value (INR) | Lead workspace, Unique customers total |
| `currency` | string | Billing Currency (`INR`) | Money display |
| `pending_invoice_amount` | number | Pending / outstanding invoices | Lead finance, Lost/risk, collections |
| `overdue` | boolean | Overdues | Block / At risk |
| `last_invoice_at` | date | Last Invoice Date | Finance panel |
| `sales_owner_user_id` | string | Sales owner in ERP | Assign CRM owner + team |
| `sales_owner_name` | string | e.g. Dakash Rantiya | Display + fuzzy map |
| `sales_owner_email` | string | e.g. dakash.rantiya@xindus.net | **Best map to CRM login** |
| `sales_owner_phone` | string | Owner mobile | Map + WhatsApp |
| `tags[]` | list of `{id, name, type}` | Customer tags: Commercial, Courier, B2B, B2C, Platinum, Active, … | CRM tags, Home filters, team views |
| `customer_type` | string | DIRECT / etc. | Segment |
| `business_type` | string | b2b / b2c | Team mapping |
| `ship_type` | string | manufacturer / trader | Segment |
| `status` | string | APPROVED / etc. | Hide blocked vs live |

`first_shipment_at` is **not** “Created On”. Created On = account opened. First shipment = first actual movement. Mixing them made thousands of fake New Accounts.

### P1 — needed for managers and “CRM actually used daily”

| Field | Type | Why / where |
| --- | --- | --- |
| `revenue_this_month`, `revenue_last_month` | number | Home Unique customers month; At Risk if drop &gt; 30% |
| `shipments_this_month`, `shipments_last_month` | number | Same |
| `avg_shipment_value` | number | Lead: typical order size |
| `avg_shipment_chargeable_weight_kg` | number | Ops + commercial quality |
| `monthly_avg_revenue_3m` | number | Manager book quality |
| `monthly_avg_shipments_3m` | number | Cadence |
| `kam_user_id`, `kam_name`, `kam_email` | | KAM vs sales owner (ERP “Kam Info”) |
| `account_owner_user_id` | | If different from sales owner |
| `credit_limit`, `credit_period_days` | | Lead finance |
| `should_block` | boolean | Do not push sales on blocked |
| `pending_payment_limit` | number | Already on customer export |
| `countries[]` | strings | Lanes (US, AE, UK, …) |
| `shipment_types[]` | strings | COMMERCIAL / courier-type |
| `tax_types[]` | strings | GST / LUT |
| `inco_term` | string | Lead ops |
| `payment_method` | string | CREDITS etc. |
| `last_payment_at`, `last_payment_amount` | | Collections |
| `zoho_books_id` | string | Finance join |
| `parent_customer_id` | string | Group rollup |

**Monthly series (preferred over only two months):**  
`monthly[]`: `{ "year": 2026, "month": 7, "revenue": 0, "shipments": 0, "chargeable_weight_kg": 0 }`  
Home Unique customers and Retention filter by **year / month / ISO week**. Week needs **shipment-level dates** or a weekly rollup.

### P2 — shipment-level feed (best long-term)

One row per shipment (or per invoice) so CRM can rebuild any period without asking ERP again.

| Field | Type |
| --- | --- |
| `xindus_customer_id` | string |
| `shipment_id` | string |
| `shipped_at` | date or datetime ISO |
| `revenue` | number |
| `chargeable_weight_kg` | number |
| `pieces` | number |
| `origin`, `destination_country` | string |
| `shipment_type` | commercial / courier / … |
| `invoice_id`, `invoice_amount`, `invoice_status` | |
| `sales_owner_user_id` | string |

This is what the ERP **dashboard** already aggregates (unique customers, revenue, new onboarded). Pushing the same grain lets CRM match that dashboard.

### New customers (ERP “new customers” list)

Same customer object, filtered by `customer_created_at` or `first_shipment_at` in range. CRM Retention widget: **onboarded = first_shipment_at else customer_created_at**, grouped by **sales owner → CRM team**.

If the rep onboarded them and `shipment_count_lifetime = 0`, CRM stage = **Onboarding**, not New Account.

---

## 6. Mapping ERP reps → CRM users → teams

CRM already has org **departments / teams** (example: Commercial, Courier, B2B, B2C) and members with login email.

| ERP | CRM |
| --- | --- |
| `sales_owner_email` | Match `users.email` (primary) |
| `sales_owner_phone` | Fallback |
| `sales_owner_user_id` | Store on membership as `erpStaffId` so it never breaks when email changes |
| ERP tag Commercial / Courier / B2B / B2C | CRM **team** and/or **lead tag** |

**Please also send a staff table:**

| Field | Why |
| --- | --- |
| `erp_staff_id` | Stable |
| `name`, `email`, `phone` | Match CRM invite |
| `role` | sales / kam / ops |
| `team_name` or `desk` | Align with CRM teams |
| `active` | Hide leavers |

If auto-map fails, the manager assigns the CRM user once; we store `erp_staff_id` on that user. Reps can also paste Xindus customer id on a lead.

---

## 7. Tags from ERP we will reuse in CRM

From the customer screen we already see tag objects like Commercial, Active, Platinum, Reconciled (id + name + colour + manual/automatic).

**Must push as a list, not a blob of JSON text.**

Suggested mapping:

| ERP tag / type | CRM use |
| --- | --- |
| Commercial / Courier | Team + pipeline filter |
| B2B / B2C | Team + Unique customers filter |
| Platinum / gold-style | Priority book |
| Active (auto) | Optional; CRM prefers last-shipment stage instead of this tag |
| Channel / sales channel | Source of book |

Do not rely on ERP “Active” tag for pipeline stage. CRM stage comes from **dates** in §3.

---

## 8. Suggested API (minimum to start)

`GET /erp/crm/customers?updated_since=2026-09-01T00:00:00Z`

```json
{
  "xindus_customer_id": "1443",
  "crm_id": "426904000018309832",
  "company_legal_name": "XLP ENGINEERS PVT LTD",
  "contact_name": "Aseem Datta",
  "phone": "9310951010",
  "email": "aseem@cosmogroup.in",
  "gstin": "06AAACX0076C1ZR",
  "pan": "AAACX0076C",
  "crn": "XIN-01225",
  "iec": "0510023266",
  "city": "gurgaon",
  "state": "OH",
  "customer_created_at": "2024-08-16",
  "first_shipment_at": "2024-09-01",
  "last_shipment_at": "2026-07-11",
  "shipment_count_lifetime": 10,
  "lifetime_revenue": 253497.04,
  "currency": "INR",
  "avg_shipment_value": 25349.70,
  "avg_shipment_chargeable_weight_kg": 12.5,
  "monthly_avg_revenue_3m": 0,
  "pending_invoice_amount": 0,
  "overdue": false,
  "should_block": false,
  "last_invoice_at": "2026-07-20",
  "credit_limit": 0,
  "credit_period_days": 15,
  "payment_method": "CREDITS",
  "business_type": "b2b",
  "ship_type": "manufacturer",
  "status": "APPROVED",
  "countries": ["US", "AE", "UK"],
  "sales_owner": {
    "erp_staff_id": "0",
    "name": "Dakash Rantiya",
    "email": "dakash.rantiya@xindus.net",
    "phone": "9926475785"
  },
  "kam": {
    "erp_staff_id": "0",
    "name": "Navya",
    "email": "navya@xindus.net",
    "phone": "919289955087"
  },
  "tags": [
    { "id": "11", "name": "Commercial", "type": "manual" },
    { "id": "17", "name": "Active", "type": "automatic" }
  ],
  "monthly": [
    { "year": 2026, "month": 7, "revenue": 180000, "shipments": 2, "chargeable_weight_kg": 40 }
  ]
}
```

Cadence: **full snapshot nightly** + **incremental hourly** on `updated_at`. Same payload as one customer page in ERP.

Optional second endpoint: `GET /erp/crm/shipments?from=2026-01-01` for P2.

---

## 9. What we already get vs what to add

Customer Excel export already has most P0 identity + last transacted + shipment count + owner JSON + tags JSON + GST/PAN/CRN/IEC + last invoice.

**Please add or stabilize:**

1. `first_shipment_at` (dedicated column — not Created On)  
2. `lifetime_revenue` as a real number (not only “total savings”)  
3. `pending_invoice_amount` (outstanding AR), not only overdue boolean  
4. `sales_owner_user_id` as a real staff id (today id is often `0` in Kam/Sales JSON)  
5. Tags as array, not stringified JSON  
6. Monthly (or shipment-level) revenue, count, weight  
7. Average shipment value and chargeable weight  
8. String-typed `crm_id` / Zoho ids  

Until (1) and last shipment are reliable, CRM Home and New Account will keep drifting from ERP.

---

## 10. Acceptance checks (tech + ops)

1. Customer **1443 / XLP ENGINEERS PVT LTD**: last shipment `2026-07-11`, count `10` → CRM Last shipment July 2026, stage **Churned**.  
2. Brand-new ERP customer, count `0`, created this week → CRM **Onboarding**, Unique customers **does not** count them as a shipper.  
3. First shipment 10 days ago → CRM **New Account** for 60 days from first shipment.  
4. Shipped 5 days ago, first shipment &gt; 60 days ago → **Active Trader**.  
5. Owner email `dakash.rantiya@xindus.net` → CRM lead owner Dakash, visible in that team’s pipeline.  
6. Tag Commercial → filterable on Home Unique customers and pipeline.  
7. Month filter July 2026 Unique customers count/revenue **matches ERP dashboard** for the same month (± rounding).  
8. Incremental update of last shipment same day appears in CRM after the next pull (target &lt; 1 hour).

---

## 11. Security / hygiene

- No full bank account numbers (we already mask).  
- No secrets in the payload.  
- Org is Xindus only; include `xindus_customer_id` on every object.  
- Auth: service token to the CRM backfill endpoint, or a dedicated ERP webhook we will provide.

---

## 12. Ask of ERP tech (order of work)

1. **Lock P0 fields** in a versioned customer API (especially `first_shipment_at`, `last_shipment_at`, `lifetime_revenue`, `pending_invoice_amount`, string ids).  
2. **Staff table** with real `erp_staff_id` + email.  
3. **Tags array** + business_type / channel for Commercial, Courier, B2B, B2C.  
4. **Monthly or shipment lines** so Home dashboards match ERP.  
5. Point CRM to the API (we already overlay Excel; API replaces the dump).

Questions while building: CRM team. Sample customer for QA: **XLP ENGINEERS PVT LTD / id 1443**.
