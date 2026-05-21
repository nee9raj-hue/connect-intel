import * as XLSX from 'xlsx'

/**
 * Canonical column names for Connect Intel imports.
 * Keep this sheet as the first row header; do not rename columns.
 */
export const IMPORT_TEMPLATE_COLUMNS = [
  'company',
  'legal_name',
  'industry',
  'city',
  'state',
  'country',
  'website',
  'employees',
  'revenue_range',
  'company_type',
  'exporter',
  'shipping',
  'first_name',
  'last_name',
  'title',
  'email',
  'phone',
  'linkedin',
  'seniority',
  'source_confidence',
  'pipeline_status',
  'notes',
]

/** Example rows — replace with your data; structure must stay the same. */
export const IMPORT_TEMPLATE_SAMPLE_ROWS = [
  {
    company: 'Rajasthan Handicrafts Export House',
    legal_name: 'Rajasthan Handicrafts Export House Pvt Ltd',
    industry: 'Handicrafts & Textiles',
    city: 'Jaipur',
    state: 'Rajasthan',
    country: 'India',
    website: 'rajasthanhandicrafts.in',
    employees: '51-200',
    revenue_range: '₹10–50 Cr',
    company_type: 'Exporter',
    exporter: 'yes',
    shipping: 'no',
    first_name: 'Priya',
    last_name: 'Sharma',
    title: 'Export Manager',
    email: 'priya.sharma@rajasthanhandicrafts.in',
    phone: '+91-141-2550198',
    linkedin: 'linkedin.com/in/priya-sharma-export',
    seniority: 'Manager',
    source_confidence: 'verified',
    pipeline_status: 'contacted',
    notes: 'Met at trade fair — follow up on samples',
  },
  {
    company: 'Ganesh Marble & Granite Exports',
    legal_name: 'Ganesh Marble Exports LLP',
    industry: 'Stone & Marble',
    city: 'Jaipur',
    state: 'Rajasthan',
    country: 'India',
    website: 'ganeshmarbleexports.com',
    employees: '201-500',
    revenue_range: '₹50–100 Cr',
    company_type: 'Exporter',
    exporter: 'yes',
    shipping: 'no',
    first_name: 'Vikram',
    last_name: 'Meena',
    title: 'Director — International Sales',
    email: 'vikram@ganeshmarbleexports.com',
    phone: '+91-141-2783344',
    linkedin: 'linkedin.com/in/vikram-meena-marble',
    seniority: 'Director',
    source_confidence: 'verified',
  },
  {
    company: 'Mumbai Pharma Exports Ltd',
    legal_name: 'Mumbai Pharma Exports Limited',
    industry: 'Pharmaceuticals',
    city: 'Mumbai',
    state: 'Maharashtra',
    country: 'India',
    website: 'mumbaipharmaexports.in',
    employees: '501-1000',
    revenue_range: '₹100+ Cr',
    company_type: 'Exporter',
    exporter: 'yes',
    shipping: 'no',
    first_name: 'Anita',
    last_name: 'Desai',
    title: 'Head of Business Development',
    email: 'anita.desai@mumbaipharmaexports.in',
    phone: '+91-22-49871200',
    linkedin: 'linkedin.com/in/anita-desai-pharma',
    seniority: 'Director',
    source_confidence: 'imported',
  },
  {
    company: 'Coastal Freight Logistics',
    legal_name: 'Coastal Freight Logistics Pvt Ltd',
    industry: 'Logistics & Shipping',
    city: 'Chennai',
    state: 'Tamil Nadu',
    country: 'India',
    website: 'coastalfreightlogistics.in',
    employees: '51-200',
    revenue_range: '₹10–50 Cr',
    company_type: 'Logistics',
    exporter: 'no',
    shipping: 'yes',
    first_name: 'Karthik',
    last_name: 'Rajan',
    title: 'Key Account Manager',
    email: 'karthik.rajan@coastalfreightlogistics.in',
    phone: '+91-44-61234567',
    linkedin: 'linkedin.com/in/karthik-rajan-logistics',
    seniority: 'Manager',
    source_confidence: 'imported',
  },
  {
    company: 'Surat Diamond Export Consortium',
    legal_name: 'Surat Diamond Export Consortium',
    industry: 'Gems & Jewellery',
    city: 'Surat',
    state: 'Gujarat',
    country: 'India',
    website: 'suratdiamondexport.com',
    employees: '11-50',
    revenue_range: '₹10–50 Cr',
    company_type: 'Exporter',
    exporter: 'yes',
    shipping: 'no',
    first_name: 'Harsh',
    last_name: 'Patel',
    title: 'Proprietor',
    email: 'harsh@suratdiamondexport.com',
    phone: '+91-261-2345678',
    linkedin: '',
    seniority: 'Owner',
    source_confidence: 'verified',
  },
  {
    company: 'Bengal Agro Exports',
    legal_name: 'Bengal Agro Exports Pvt Ltd',
    industry: 'Agriculture & Food',
    city: 'Kolkata',
    state: 'West Bengal',
    country: 'India',
    website: 'bengalagroexports.in',
    employees: '51-200',
    revenue_range: '₹10–50 Cr',
    company_type: 'Exporter',
    exporter: 'yes',
    shipping: 'no',
    first_name: 'Sourav',
    last_name: 'Banerjee',
    title: 'Export Operations Lead',
    email: 'sourav.b@bengalagroexports.in',
    phone: '+91-33-40112233',
    linkedin: 'linkedin.com/in/sourav-banerjee-agro',
    seniority: 'Manager',
    source_confidence: 'imported',
  },
]

const INSTRUCTIONS_ROWS = [
  ['Connect Intel — Import template'],
  [''],
  ['How to use'],
  ['1. Fill the "Data" sheet — one row per contact (company columns repeat per contact).'],
  ['2. Keep column names exactly as row 1 in the Data sheet.'],
  ['3. Required: company. For search results with email/phone, include contact fields.'],
  ['4. In Admin, choose dataset type (Exporters / Shipping / General) then upload this file.'],
  ['5. Delete sample rows before importing your real list (or replace them).'],
  [''],
  ['Column reference'],
  ['company', 'Required. Business name shown in search results.'],
  ['legal_name', 'Optional registered legal name.'],
  ['industry', 'e.g. Handicrafts & Textiles, Pharmaceuticals — used in filters.'],
  ['city', 'e.g. Jaipur, Mumbai — used in keyword and city filters.'],
  ['state', 'Indian state — used in state filters.'],
  ['country', 'Default India if empty.'],
  ['website', 'Domain or URL (no https required).'],
  ['employees', 'Use: 1-10, 11-50, 51-200, 201-500, 501-1000'],
  ['revenue_range', 'Optional internal field.'],
  ['company_type', 'Optional label: Exporter, Logistics, etc.'],
  ['exporter', 'yes/no — auto-set when dataset type is Exporters.'],
  ['shipping', 'yes/no — auto-set when dataset type is Shipping.'],
  ['first_name', 'Contact first name.'],
  ['last_name', 'Contact last name.'],
  ['title', 'Job title — matches job title filters.'],
  ['email', 'Work email — unlockable in app.'],
  ['phone', 'Phone with country code e.g. +91-...'],
  ['linkedin', 'Profile URL or path.'],
  ['seniority', 'Optional: Owner, Director, Manager.'],
  ['source_confidence', 'verified | imported | likely'],
  ['pipeline_status', 'Optional CRM stage: new, contacted, follow_up, replied, won, lost'],
  ['notes', 'Optional free-text note shown in Pipeline'],
]

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export function downloadImportTemplateXlsx(filename = 'connect-intel-import-template.xlsx') {
  const workbook = XLSX.utils.book_new()
  const dataSheet = XLSX.utils.json_to_sheet(IMPORT_TEMPLATE_SAMPLE_ROWS, {
    header: IMPORT_TEMPLATE_COLUMNS,
  })
  const instructionsSheet = XLSX.utils.aoa_to_sheet(INSTRUCTIONS_ROWS)

  dataSheet['!cols'] = IMPORT_TEMPLATE_COLUMNS.map(() => ({ wch: 18 }))
  instructionsSheet['!cols'] = [{ wch: 22 }, { wch: 72 }]

  XLSX.utils.book_append_sheet(workbook, dataSheet, 'Data')
  XLSX.utils.book_append_sheet(workbook, instructionsSheet, 'Instructions')
  XLSX.writeFile(workbook, filename)
}

export function downloadImportTemplateCsv(filename = 'connect-intel-import-template.csv') {
  const sheet = XLSX.utils.json_to_sheet(IMPORT_TEMPLATE_SAMPLE_ROWS, {
    header: IMPORT_TEMPLATE_COLUMNS,
  })
  const csv = XLSX.utils.sheet_to_csv(sheet)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  triggerDownload(blob, filename)
}
