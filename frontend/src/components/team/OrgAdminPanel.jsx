import { useState } from 'react'
import SqlInfraBanner from './SqlInfraBanner'
import OrgHierarchyPanel from './OrgHierarchyPanel'
import OrgPermissionsPanel from './OrgPermissionsPanel'

const TABS = [
  { id: 'team', label: 'Team' },
  { id: 'hierarchy', label: 'Departments & teams' },
  { id: 'permissions', label: 'Permissions' },
  { id: 'import', label: 'Import' },
  { id: 'branding', label: 'Branding' },
  { id: 'integrations', label: 'Integrations' },
]

export default function OrgAdminPanel({
  user,
  teamMembers,
  activeTab: controlledTab,
  onTabChange,
  childrenByTab = {},
}) {
  const [internalTab, setInternalTab] = useState('team')
  const activeTab = controlledTab || internalTab

  const setTab = (id) => {
    setInternalTab(id)
    onTabChange?.(id)
  }

  return (
    <>
      <div className="flex flex-wrap gap-1 border-b border-gray-200 pb-0 mb-4 -mx-1 px-1 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setTab(tab.id)}
            className={`shrink-0 px-3 py-2 text-sm font-semibold rounded-t-lg border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-[#FF773D] text-gray-900'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <SqlInfraBanner />

      {activeTab === 'team' && childrenByTab.team}
      {activeTab === 'hierarchy' && <OrgHierarchyPanel teamMembers={teamMembers} />}
      {activeTab === 'permissions' && <OrgPermissionsPanel />}
      {activeTab === 'import' && childrenByTab.import}
      {activeTab === 'branding' && childrenByTab.branding}
      {activeTab === 'integrations' && childrenByTab.integrations}
    </>
  )
}
