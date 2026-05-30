const STORAGE_KEY = 'connect_intel_chithi_sound'

export function isChithiSoundEnabled() {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v != null) return v !== '0'
    return localStorage.getItem('connect_intel_team_hub_sound') !== '0'
  } catch {
    return true
  }
}

export function setChithiSoundEnabled(enabled) {
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0')
  } catch {
    // ignore
  }
}

/** Short two-tone chime for new Chithi messages (CRM open). */
export function playChithiMessageSound() {
  if (!isChithiSoundEnabled()) return
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    const now = ctx.currentTime
    const playTone = (freq, start, duration) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.0001, start)
      gain.gain.exponentialRampToValueAtTime(0.12, start + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(start)
      osc.stop(start + duration + 0.05)
    }
    playTone(523.25, now, 0.12)
    playTone(659.25, now + 0.14, 0.16)
    window.setTimeout(() => ctx.close().catch(() => {}), 500)
  } catch {
    // Autoplay may be blocked until user gesture — ignore.
  }
}
