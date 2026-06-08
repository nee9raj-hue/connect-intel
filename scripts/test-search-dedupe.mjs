import { dedupeSearchLeads } from '../lib/server/search.js'

const leads = [
  { id: '1', firstName: 'Rahul', lastName: 'Mehta', company: 'Jaipur Textile Exports', email: 'rahul@x.com', city: 'Jaipur', state: 'Rajasthan', score: 90 },
  { id: '2', firstName: 'Rahul', lastName: 'Mehta', company: 'Jaipur Textile Exports', email: 'rahul@x.com', city: 'Jaipur', state: 'Rajasthan', score: 88 },
  { id: '3', firstName: 'Priya', lastName: 'Sharma', company: 'Spice Co', email: 'priya@y.com', city: 'Mumbai', state: 'Maharashtra', score: 85 },
]

const out = dedupeSearchLeads(leads)
if (out.length !== 2) {
  console.error('Expected 2 unique leads, got', out.length)
  process.exit(1)
}

console.log('✓ Search dedupe regression passed')
