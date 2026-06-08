import { useEffect } from 'react'
import { isEditableTarget, shouldAllowBrowserShortcut } from '../lib/keyboardShortcuts'

const PIPELINE_SEARCH_ID = 'ci-pipeline-search'

/**
 * Global keyboard behavior for the CRM shell.
 * - Never blocks Ctrl/Cmd+C/V/X/Z/A/Y or Ctrl/Cmd+F
 * - "/" focuses pipeline search when on the pipeline panel
 */
export default function useAppKeyboardShortcuts({
  enabled = true,
  activePanel,
  onCommandPalette,
} = {}) {
  useEffect(() => {
    if (!enabled) return undefined

    const onKeyDown = (event) => {
      if (shouldAllowBrowserShortcut(event)) return

      if (
        (event.metaKey || event.ctrlKey) &&
        event.key.toLowerCase() === 'k' &&
        !isEditableTarget(event.target)
      ) {
        event.preventDefault()
        onCommandPalette?.()
        return
      }

      if (
        event.key === '/' &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        !isEditableTarget(event.target) &&
        activePanel === 'pipeline'
      ) {
        const search = document.getElementById(PIPELINE_SEARCH_ID)
        if (search && !search.disabled) {
          event.preventDefault()
          search.focus()
          if (typeof search.select === 'function') search.select()
        }
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [enabled, activePanel, onCommandPalette])
}

export { PIPELINE_SEARCH_ID }
