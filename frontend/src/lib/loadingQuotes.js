export const LOADING_QUOTES = [
  'Good things take time to load.',
  'Almost there — polishing the details.',
  'Connecting the dots for you…',
  'Gathering your latest data.',
  'Warming up the engines.',
  'Quality beats speed — hang tight.',
  'Your pipeline is worth the wait.',
  'Fetching fresh insights…',
  'Making sure nothing is missed.',
  'Syncing your workspace in the background.',
  'Great salespeople are patient — so are great tools.',
  'Loading smarter, not harder.',
  'One moment while we pull your records.',
  'Building your view…',
  'Still faster than a cold email follow-up.',
]

export function pickLoadingQuote() {
  return LOADING_QUOTES[Math.floor(Math.random() * LOADING_QUOTES.length)]
}

export const LOADING_MESSAGES = {
  default: 'Loading…',
  workspace: 'Loading your workspace…',
  marketing: 'Loading marketing…',
  contacts: 'Loading contacts…',
  calendar: 'Loading calendar…',
  activity: 'Loading activity…',
  team: 'Loading team metrics…',
  notes: 'Loading notes…',
  tasks: 'Loading tasks…',
  search: 'Searching our B2B database…',
  customers: 'Loading customers…',
}
