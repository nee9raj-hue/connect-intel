import { useMemo } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { DEFAULT_USAGE_POLICIES, getUsagePolicies } from '../lib/resourceProtection.js'

export function useUsagePolicies() {
  const { user } = useApp()
  return useMemo(() => {
    const fromOrg = user?.orgCrmSettings?.usagePolicies || user?.usagePolicies
    if (fromOrg) return getUsagePolicies({ usagePolicies: fromOrg })
    return { ...DEFAULT_USAGE_POLICIES }
  }, [user?.orgCrmSettings, user?.usagePolicies])
}
