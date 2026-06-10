/** Fire-and-forget sync of pipeline entries → public.leads (encrypted_* plaintext; DB trigger seals). */

export function queueEnterpriseLeadSync(entries) {
  const list = Array.isArray(entries) ? entries.filter(Boolean) : entries ? [entries] : []
  if (!list.length) return

  void import('./enterpriseLeadsTable.js')
    .then(({ syncEnterpriseLeadsFromEntries }) => syncEnterpriseLeadsFromEntries(list, { batchSize: 25 }))
    .catch((err) => {
      console.warn('enterprise leads sync:', err?.message || err)
    })
}
