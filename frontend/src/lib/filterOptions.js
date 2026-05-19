/** B2B filters tuned for India — states, industries, titles */

export const INDIAN_STATES = [
  'Maharashtra',
  'Karnataka',
  'Delhi NCR',
  'Tamil Nadu',
  'Gujarat',
  'Rajasthan',
  'West Bengal',
  'Telangana',
  'Uttar Pradesh',
  'Kerala',
  'Punjab',
  'Haryana',
  'Madhya Pradesh',
  'Bihar',
  'Odisha',
  'Andhra Pradesh',
  'Assam',
  'Chhattisgarh',
  'Jharkhand',
  'Goa',
]

export const INDIAN_CITIES = [
  'Mumbai',
  'Bengaluru',
  'Delhi',
  'Chennai',
  'Hyderabad',
  'Ahmedabad',
  'Pune',
  'Jaipur',
  'Kolkata',
  'Surat',
  'Lucknow',
  'Kochi',
  'Indore',
  'Nagpur',
  'Coimbatore',
]

export const JOB_TITLES = [
  'CEO / Founder',
  'Managing Director',
  'CMO',
  'VP Sales',
  'Head of Marketing',
  'Marketing Manager',
  'Business Development',
  'Export Manager',
  'Director Operations',
  'Procurement Head',
]

export const INDUSTRIES = [
  'IT & Software',
  'Textiles & Garments',
  'Pharmaceuticals',
  'Engineering & Manufacturing',
  'FMCG',
  'Agri & Food Export',
  'Chemicals',
  'Gems & Jewellery',
  'Logistics & Freight',
  'E-commerce',
  'Automotive Components',
  'Handicrafts',
]

export const COMPANY_SIZES = [
  '1-10',
  '11-50',
  '51-200',
  '201-500',
  '501-1000',
  '1000+',
]

export const FILTER_SECTIONS = {
  jobTitles: { label: 'Job titles', options: JOB_TITLES, icon: '👤' },
  states: { label: 'State', options: INDIAN_STATES, icon: '📍' },
  cities: { label: 'City', options: INDIAN_CITIES, icon: '🏙' },
  industries: { label: 'Industry & keywords', options: INDUSTRIES, icon: '🏭' },
  companySizes: { label: 'Company size', options: COMPANY_SIZES, icon: '🏢' },
}
