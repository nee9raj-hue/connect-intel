# Connect Intel — Import template guide

Use the **Admin → Download Excel template** button in the app, or follow the column rules below.

## Files

| File | Purpose |
|------|---------|
| `connect-intel-import-template.xlsx` | Download from Admin panel (Data + Instructions sheets) |
| `connect-intel-import-template.csv` | Same columns, single sheet |

## Rules

1. **Do not rename column headers** — the importer maps fixed names to the database.
2. **One row = one contact** at a company (repeat `company`, `city`, `state` on each row if needed).
3. **`company` is required** — rows without it are rejected.
4. Replace sample rows with your real data before importing.
5. Choose dataset type in Admin: **Exporters**, **Shipping**, or **General**.

## Columns

| Column | Required | Example |
|--------|----------|---------|
| company | Yes | Rajasthan Handicrafts Export House |
| legal_name | No | Rajasthan Handicrafts Export House Pvt Ltd |
| industry | Recommended | Handicrafts & Textiles |
| city | Recommended | Jaipur |
| state | Recommended | Rajasthan |
| country | No | India |
| website | No | company.in |
| employees | No | 51-200 |
| revenue_range | No | ₹10–50 Cr |
| company_type | No | Exporter |
| exporter | No | yes / no |
| shipping | No | yes / no |
| first_name | For contacts | Priya |
| last_name | For contacts | Sharma |
| title | Recommended | Export Manager |
| email | For unlock | name@company.in |
| phone | For unlock | +91-141-2550198 |
| linkedin | No | linkedin.com/in/... |
| seniority | No | Manager |
| source_confidence | No | verified / imported |

## Search behaviour

Imported records appear in **Find people** before Claude/demo data. Filters use:

- **keywords** → company, title, city, state, industry
- **states / cities / industries / job titles** → matching columns above

## Sample search after import

Try: `exporters in Jaipur` with state **Rajasthan** — template sample rows include Jaipur exporters.
