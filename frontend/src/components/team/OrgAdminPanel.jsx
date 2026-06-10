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
  onMembersChanged,
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
      <div className="sticky top-0 z-10 -mx-1 px-1 mb-4 bg-white/95 backdrop-blur-sm border-b border-gray-200">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 pt-1 px-1">Organization setup</p>
        <div className="flex gap-1 overflow-x-auto pb-0 scrollbar-thin">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setTab(tab.id)}
              className={`shrink-0 px-3 py-2.5 text-sm font-semibold rounded-t-lg border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-[#FF773D] text-gray-900 bg-[#FFF7F2]/80'
                  : 'border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <SqlInfraBanner />

      {activeTab === 'team' && childrenByTab.team}
      {activeTab === 'hierarchy' && (
        <OrgHierarchyPanel teamMembers={teamMembers} onMembersChanged={onMembersChanged} />
      )}
      {activeTab === 'permissions' && <OrgPermissionsPanel />}
      {activeTab === 'import' && childrenByTab.import}
      {activeTab === 'branding' && childrenByTab.branding}
      {activeTab === 'integrations' && childrenByTab.integrations}
    </>
  )
}
