import { dedupeMasterDatabase, getCompanyKey } from '../lib/server/imports.js'

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

const store = {
  companies: [
    { id: 'c1', name: 'Acme Exports', city: 'Jaipur', state: 'Rajasthan', country: 'India', domain: 'acme.com' },
    { id: 'c2', name: 'Acme Exports', city: 'Jaipur', state: 'Rajasthan', country: 'India', domain: 'acme.com' },
    { id: 'c3', name: 'Beta Logistics', city: 'Mumbai', state: 'Maharashtra', country: 'India', domain: '' },
  ],
  contacts: [
    { id: 'p1', companyId: 'c1', email: 'a@acme.com', firstName: 'A', phone: '919999999999' },
    { id: 'p2', companyId: 'c2', email: 'a@acme.com', firstName: 'A', lastName: 'Kumar' },
    { id: 'p3', companyId: 'c3', email: 'b@beta.com', firstName: 'B' },
  ],
  importJobs: [],
}

const stats = dedupeMasterDatabase(store)

assert(store.companies.length === 2, `expected 2 companies, got ${store.companies.length}`)
assert(store.contacts.length === 2, `expected 2 contacts, got ${store.contacts.length}`)
assert(stats.companiesRemoved === 1, 'should remove 1 duplicate company')
assert(store.contacts.every((c) => c.companyId !== 'c2'), 'contacts should remap off duplicate company id')
assert(getCompanyKey(store.companies[0]) === getCompanyKey(store.companies.find((c) => c.id === 'c1')), 'canonical company kept')

console.log('✓ Master database dedupe regression passed')
console.log(`  removed companies=${stats.companiesRemoved} contacts=${stats.contactsRemoved}`)
