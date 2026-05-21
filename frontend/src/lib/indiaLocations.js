/** India states and cities for search filters — empty selection = all */

export const INDIAN_STATES = [
  'Andhra Pradesh',
  'Assam',
  'Bihar',
  'Chhattisgarh',
  'Delhi NCR',
  'Goa',
  'Gujarat',
  'Haryana',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Tamil Nadu',
  'Telangana',
  'Uttar Pradesh',
  'West Bengal',
]

export const CITIES_BY_STATE = {
  'Andhra Pradesh': [
    'Visakhapatnam', 'Vijayawada', 'Guntur', 'Nellore', 'Kurnool', 'Tirupati', 'Kakinada', 'Rajahmundry', 'Kadapa', 'Anantapur',
  ],
  Assam: [
    'Guwahati', 'Dibrugarh', 'Silchar', 'Jorhat', 'Tezpur', 'Nagaon', 'Tinsukia', 'Goalpara',
  ],
  Bihar: [
    'Patna', 'Gaya', 'Muzaffarpur', 'Bhagalpur', 'Darbhanga', 'Purnia', 'Arrah', 'Begusarai', 'Munger',
  ],
  Chhattisgarh: ['Raipur', 'Bhilai', 'Bilaspur', 'Korba', 'Durg', 'Rajnandgaon'],
  'Delhi NCR': [
    'Delhi', 'New Delhi', 'Noida', 'Greater Noida', 'Gurugram', 'Faridabad', 'Ghaziabad', 'Sonipat', 'Panipat',
  ],
  Goa: ['Panaji', 'Margao', 'Vasco da Gama', 'Mapusa', 'Ponda'],
  Gujarat: [
    'Ahmedabad', 'Surat', 'Vadodara', 'Rajkot', 'Gandhinagar', 'Bhavnagar', 'Jamnagar', 'Junagadh', 'Anand', 'Morbi', 'Nadiad',
  ],
  Haryana: [
    'Gurugram', 'Faridabad', 'Panipat', 'Ambala', 'Karnal', 'Hisar', 'Rohtak', 'Sonipat', 'Panchkula', 'Yamunanagar',
  ],
  Jharkhand: ['Ranchi', 'Jamshedpur', 'Dhanbad', 'Bokaro', 'Deoghar', 'Hazaribagh'],
  Karnataka: [
    'Bengaluru', 'Mysuru', 'Mangaluru', 'Hubballi', 'Belagavi', 'Davangere', 'Ballari', 'Tumakuru', 'Shivamogga', 'Raichur',
  ],
  Kerala: [
    'Kochi', 'Thiruvananthapuram', 'Kozhikode', 'Thrissur', 'Kollam', 'Alappuzha', 'Palakkad', 'Kannur', 'Kottayam',
  ],
  'Madhya Pradesh': [
    'Indore', 'Bhopal', 'Jabalpur', 'Gwalior', 'Ujjain', 'Sagar', 'Ratlam', 'Satna', 'Rewa', 'Burhanpur',
  ],
  Maharashtra: [
    'Mumbai', 'Pune', 'Nagpur', 'Nashik', 'Thane', 'Aurangabad', 'Solapur', 'Kolhapur', 'Amravati', 'Nanded', 'Sangli', 'Jalgaon', 'Akola',
  ],
  Odisha: ['Bhubaneswar', 'Cuttack', 'Rourkela', 'Berhampur', 'Sambalpur', 'Puri', 'Balasore'],
  Punjab: [
    'Ludhiana', 'Amritsar', 'Jalandhar', 'Patiala', 'Bathinda', 'Mohali', 'Pathankot', 'Hoshiarpur', 'Moga',
  ],
  Rajasthan: [
    'Jaipur', 'Jodhpur', 'Udaipur', 'Kota', 'Ajmer', 'Bikaner', 'Alwar', 'Bhilwara', 'Sikar', 'Pali', 'Tonk', 'Bharatpur',
    'Sri Ganganagar', 'Hanumangarh', 'Churu', 'Nagaur', 'Jhunjhunu', 'Barmer', 'Jaisalmer', 'Dungarpur', 'Banswara',
  ],
  'Tamil Nadu': [
    'Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli', 'Salem', 'Tirunelveli', 'Tiruppur', 'Erode', 'Vellore', 'Thoothukudi',
  ],
  Telangana: [
    'Hyderabad', 'Warangal', 'Nizamabad', 'Karimnagar', 'Khammam', 'Ramagundam', 'Mahbubnagar', 'Nalgonda',
  ],
  'Uttar Pradesh': [
    'Lucknow', 'Kanpur', 'Noida', 'Ghaziabad', 'Agra', 'Varanasi', 'Meerut', 'Prayagraj', 'Bareilly', 'Aligarh', 'Moradabad', 'Gorakhpur',
  ],
  'West Bengal': [
    'Kolkata', 'Howrah', 'Durgapur', 'Siliguri', 'Asansol', 'Bardhaman', 'Malda', 'Kharagpur', 'Haldia',
  ],
}

export function getCitiesForStates(states = []) {
  if (!states?.length) return getAllCities()
  const cities = new Set()
  for (const state of states) {
    for (const city of CITIES_BY_STATE[state] || []) {
      cities.add(city)
    }
  }
  return [...cities].sort((a, b) => a.localeCompare(b))
}

export function getAllCities() {
  const cities = new Set()
  for (const list of Object.values(CITIES_BY_STATE)) {
    for (const city of list) cities.add(city)
  }
  return [...cities].sort((a, b) => a.localeCompare(b))
}

export function pruneCitiesForStates(states, cities) {
  const allowed = new Set(getCitiesForStates(states))
  return (cities || []).filter((city) => allowed.has(city))
}

export function isAllStatesSelected(states) {
  return !states?.length || states.length >= INDIAN_STATES.length
}

export function isAllCitiesSelected(states, cities) {
  const all = getCitiesForStates(states)
  return !cities?.length || cities.length >= all.length
}
