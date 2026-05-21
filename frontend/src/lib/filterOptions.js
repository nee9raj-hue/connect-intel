/** B2B filters tuned for India — states linked to cities */

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

/** Cities available per state — drives linked city filter */
export const CITIES_BY_STATE = {
  Maharashtra: ['Mumbai', 'Pune', 'Nagpur', 'Nashik', 'Thane', 'Aurangabad'],
  Karnataka: ['Bengaluru', 'Mysuru', 'Mangaluru', 'Hubballi'],
  'Delhi NCR': ['Delhi', 'New Delhi', 'Noida', 'Gurugram', 'Faridabad', 'Ghaziabad'],
  'Tamil Nadu': ['Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli'],
  Gujarat: ['Ahmedabad', 'Surat', 'Vadodara', 'Rajkot', 'Gandhinagar'],
  Rajasthan: ['Jaipur', 'Jodhpur', 'Udaipur', 'Kota', 'Ajmer'],
  'West Bengal': ['Kolkata', 'Howrah', 'Durgapur', 'Siliguri'],
  Telangana: ['Hyderabad', 'Warangal', 'Nizamabad'],
  'Uttar Pradesh': ['Lucknow', 'Noida', 'Kanpur', 'Varanasi', 'Agra'],
  Kerala: ['Kochi', 'Thiruvananthapuram', 'Kozhikode'],
  Punjab: ['Ludhiana', 'Amritsar', 'Chandigarh', 'Jalandhar'],
  Haryana: ['Gurugram', 'Faridabad', 'Panipat', 'Ambala'],
  'Madhya Pradesh': ['Indore', 'Bhopal', 'Jabalpur', 'Gwalior'],
  Bihar: ['Patna', 'Gaya', 'Muzaffarpur'],
  Odisha: ['Bhubaneswar', 'Cuttack', 'Rourkela'],
  'Andhra Pradesh': ['Visakhapatnam', 'Vijayawada', 'Guntur'],
  Assam: ['Guwahati', 'Dibrugarh', 'Silchar'],
  Chhattisgarh: ['Raipur', 'Bhilai', 'Bilaspur'],
  Jharkhand: ['Ranchi', 'Jamshedpur', 'Dhanbad'],
  Goa: ['Panaji', 'Margao', 'Vasco da Gama'],
}

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

export function getCitiesForStates(states = []) {
  if (!states.length) return []
  const cities = new Set()
  for (const state of states) {
    for (const city of CITIES_BY_STATE[state] || []) {
      cities.add(city)
    }
  }
  return [...cities].sort((a, b) => a.localeCompare(b))
}

export function pruneCitiesForStates(states, cities) {
  const allowed = new Set(getCitiesForStates(states))
  return (cities || []).filter((city) => allowed.has(city))
}
