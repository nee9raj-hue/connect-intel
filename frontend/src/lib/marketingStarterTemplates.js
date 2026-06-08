/** Programmatic email starter templates (100+) for the template marketplace. */

const BASE_THEME = {
  primaryColor: '#111827',
  backgroundColor: '#f3f4f6',
  contentBackground: '#ffffff',
  contentWidth: 600,
  fontFamily: 'Arial, Helvetica, sans-serif',
}

const STOCK_IMAGES = [
  'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=600&h=320&fit=crop&q=80',
  'https://images.unsplash.com/photo-1497366216548-37526070297c?w=600&h=320&fit=crop&q=80',
  'https://images.unsplash.com/photo-1521791136064-7986c2920216?w=600&h=320&fit=crop&q=80',
  'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&h=320&fit=crop&q=80',
  'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&h=320&fit=crop&q=80',
  'https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=600&h=320&fit=crop&q=80',
  'https://images.unsplash.com/photo-1556761175-b413da4baf72?w=600&h=320&fit=crop&q=80',
  'https://images.unsplash.com/photo-1553877522-43269d4ea984?w=600&h=320&fit=crop&q=80',
  'https://images.unsplash.com/photo-1552664730-d307ca884978?w=600&h=320&fit=crop&q=80',
  'https://images.unsplash.com/photo-1542744173-8e7e53463bb8?w=600&h=320&fit=crop&q=80',
  'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=600&h=320&fit=crop&q=80',
  'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=600&h=320&fit=crop&q=80',
  'https://images.unsplash.com/photo-1573164713714-d95e436ab8d6?w=600&h=320&fit=crop&q=80',
  'https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=600&h=320&fit=crop&q=80',
  'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=600&h=320&fit=crop&q=80',
  'https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=600&h=320&fit=crop&q=80',
]

const PALETTES = [
  { primaryColor: '#ff773d', backgroundColor: '#fff7ed' },
  { primaryColor: '#2563eb', backgroundColor: '#eff6ff' },
  { primaryColor: '#059669', backgroundColor: '#ecfdf5' },
  { primaryColor: '#7c3aed', backgroundColor: '#f5f3ff' },
  { primaryColor: '#dc2626', backgroundColor: '#fef2f2' },
  { primaryColor: '#0891b2', backgroundColor: '#ecfeff' },
  { primaryColor: '#b45309', backgroundColor: '#fffbeb' },
  { primaryColor: '#6366f1', backgroundColor: '#eef2ff' },
  { primaryColor: '#be123c', backgroundColor: '#fff1f2' },
  { primaryColor: '#0f766e', backgroundColor: '#f0fdfa' },
  { primaryColor: '#1e293b', backgroundColor: '#f8fafc' },
  { primaryColor: '#ea580c', backgroundColor: '#fff7ed' },
]

const RECIPES = [
  {
    category: 'welcome',
    prefix: 'Welcome',
    subjects: ['Welcome to the team, {{firstName}}', 'Glad {{companyName}} is here', 'Your account is ready'],
    headings: ['Welcome aboard, {{firstName}}', 'Great to meet {{companyName}}', 'You are all set'],
    bodies: [
      'Thanks for joining us. Here is everything you need to get started in the next few minutes.',
      'We built this for teams like {{companyName}} — here is how to make the most of your first week.',
      'Your workspace is ready. Explore the dashboard, invite teammates, and import your first contacts.',
    ],
    cta: ['Get started', 'Open dashboard', 'Explore now'],
  },
  {
    category: 'newsletter',
    prefix: 'Newsletter',
    subjects: ['{{firstName}}, your monthly roundup', 'What is new for {{companyName}}', 'Insights for this month'],
    headings: ['This month at a glance', 'News you can use', 'Updates for {{companyName}}'],
    bodies: [
      'Hi {{firstName}},\n\nHere are the highlights our team picked for you this month.',
      'Three things worth your time:\n\n1. Product improvements\n2. Customer wins\n3. Events coming up',
      'A quick digest tailored for {{companyName}} — skim in under two minutes.',
    ],
    cta: ['Read more', 'View all updates', 'See highlights'],
  },
  {
    category: 'promo',
    prefix: 'Promotion',
    subjects: ['Special offer for {{companyName}}', '{{firstName}}, limited time inside', 'Save before Friday'],
    headings: ['Exclusive offer inside', 'Limited-time deal', 'Your pricing unlock'],
    bodies: [
      'Hi {{firstName}},\n\nWe reserved this offer for {{companyName}} through the end of the week.',
      'Upgrade now and get onboarding support included — no long contracts required.',
      'Use code WELCOME20 at checkout or reply and we will apply it for you.',
    ],
    cta: ['Claim offer', 'Shop now', 'Get the deal'],
  },
  {
    category: 'announcement',
    prefix: 'Announcement',
    subjects: ['Important update for {{companyName}}', 'News from our team', '{{firstName}}, please read'],
    headings: ['We have news', 'Big update today', 'Something new for you'],
    bodies: [
      'Hi {{firstName}},\n\nWe wanted you to be the first to know about a change that affects {{companyName}}.',
      'Effective immediately, we are rolling out improvements based on customer feedback.',
      'Full details are on our site — this email has the essentials.',
    ],
    cta: ['Learn more', 'Read announcement', 'See details'],
  },
  {
    category: 'event',
    prefix: 'Event',
    subjects: ['You are invited, {{firstName}}', 'Live session for {{companyName}}', 'Save your seat'],
    headings: ['Join us live', 'Upcoming webinar', 'Reserve your spot'],
    bodies: [
      'Hi {{firstName}},\n\nWe are hosting a session built for teams like {{companyName}}.',
      '45 minutes, live Q&A, recording sent to everyone who registers.',
      'Bring your questions — our product team will be on the call.',
    ],
    cta: ['Register free', 'Save my seat', 'Add to calendar'],
  },
  {
    category: 'welcome',
    prefix: 'Onboarding',
    subjects: ['Day 1 with us, {{firstName}}', 'Setup checklist for {{companyName}}', 'Three steps to start'],
    headings: ['Your onboarding checklist', 'First steps', 'Let us get you live'],
    bodies: [
      'Complete these three steps today:\n\n• Import contacts\n• Connect email\n• Create your first campaign',
      'Most teams finish setup in under 15 minutes. We are here if you want a guided tour.',
      'Reply anytime — a real person from our team will help {{companyName}} get rolling.',
    ],
    cta: ['Start setup', 'Book onboarding', 'Open checklist'],
  },
  {
    category: 'promo',
    prefix: 'Flash sale',
    subjects: ['Ends tonight — {{firstName}}', 'Last chance for {{companyName}}', 'Final hours'],
    headings: ['Flash sale ends soon', 'Do not miss this', 'Tonight only'],
    bodies: [
      'Hi {{firstName}},\n\nThis pricing for {{companyName}} expires at midnight.',
      'No extensions — grab it now or wait until our next seasonal offer.',
      'Questions? Reply and we will hold your spot for 24 hours.',
    ],
    cta: ['Shop flash sale', 'Buy now', 'Lock in price'],
  },
  {
    category: 'newsletter',
    prefix: 'Digest',
    subjects: ['Weekly digest for {{firstName}}', '{{companyName}} — week in review', 'Your Friday roundup'],
    headings: ['Your week in review', 'Friday digest', 'Five-minute roundup'],
    bodies: [
      'Pipeline momentum, campaign stats, and tasks due next week — all in one place.',
      'Hi {{firstName}}, here is what moved for {{companyName}} since Monday.',
      'Top story: customers like you are shipping campaigns 2× faster this quarter.',
    ],
    cta: ['Open dashboard', 'View report', 'See full digest'],
  },
  {
    category: 'announcement',
    prefix: 'Product',
    subjects: ['New features for {{companyName}}', '{{firstName}}, product update', 'Shipped this week'],
    headings: ['Fresh off the roadmap', 'What we shipped', 'Built for your workflow'],
    bodies: [
      'Hi {{firstName}},\n\nWe released updates inspired by teams like {{companyName}}.',
      '• Faster templates\n• Smarter automations\n• Cleaner reporting',
      'Everything is live in your account — no migration needed.',
    ],
    cta: ['See changelog', 'Try new features', 'Watch demo'],
  },
  {
    category: 'promo',
    prefix: 'Trial',
    subjects: ['Extend your trial, {{firstName}}', 'Still evaluating?', 'Extra days for {{companyName}}'],
    headings: ['Need more time?', 'Trial extension', 'Keep exploring free'],
    bodies: [
      'Hi {{firstName}},\n\nHappy to add 14 more days for {{companyName}} while you evaluate.',
      'Reply with one goal you are trying to hit — we will suggest the best workflow.',
      'No credit card required for the extension.',
    ],
    cta: ['Extend trial', 'Talk to us', 'Continue free'],
  },
  {
    category: 'event',
    prefix: 'Workshop',
    subjects: ['Hands-on workshop invite', '{{firstName}}, join the workshop', 'Practical session'],
    headings: ['Interactive workshop', 'Learn by doing', 'Workshop seats open'],
    bodies: [
      'Small group, practical exercises, templates you can reuse at {{companyName}}.',
      'Hi {{firstName}}, we limit seats so everyone gets attention.',
      'Bring a laptop — we will build a real campaign together.',
    ],
    cta: ['Reserve seat', 'Join workshop', 'Sign up'],
  },
  {
    category: 'newsletter',
    prefix: 'Insights',
    subjects: ['Market insights for {{companyName}}', 'Data drop for {{firstName}}', 'Benchmark report'],
    headings: ['Industry benchmarks', 'Data-backed insights', 'What peers are doing'],
    bodies: [
      'Hi {{firstName}},\n\nWe analyzed trends across exporters and B2B teams like {{companyName}}.',
      'Open rates, reply rates, and pipeline velocity — see where you stand.',
      'Use these benchmarks to plan next quarter.',
    ],
    cta: ['Download report', 'View benchmarks', 'Read analysis'],
  },
  {
    category: 'announcement',
    prefix: 'Case study',
    subjects: ['How {{companyName}} could grow', 'Customer story inside', 'Results like yours'],
    headings: ['Customer success story', 'Real results', 'Proof it works'],
    bodies: [
      'A team similar to {{companyName}} increased qualified meetings by 40% in 90 days.',
      'Hi {{firstName}}, thought this might resonate — happy to share the full playbook.',
      'Includes templates they used and the exact follow-up cadence.',
    ],
    cta: ['Read case study', 'Get playbook', 'See results'],
  },
  {
    category: 'promo',
    prefix: 'Bundle',
    subjects: ['Bundle pricing for {{companyName}}', '{{firstName}}, package deal', 'Better together'],
    headings: ['Bundle & save', 'Package offer', 'All-in-one pricing'],
    bodies: [
      'CRM, marketing, and collaboration — one bundle tailored for {{companyName}}.',
      'Hi {{firstName}}, we put together pricing that grows with your team.',
      'Compare tiers on our site or reply for a custom quote.',
    ],
    cta: ['Compare plans', 'View bundle', 'Request quote'],
  },
  {
    category: 'welcome',
    prefix: 'Re-engage',
    subjects: ['Still with us, {{firstName}}?', 'Checking in on {{companyName}}', 'We miss you'],
    headings: ['We have not heard from you', 'Quick check-in', 'Pick up where you left off'],
    bodies: [
      'Hi {{firstName}},\n\nIf timing changed, no worries. Your data is safe and waiting.',
      'If you are still exploring, I can send a 2-minute summary for {{companyName}}.',
      'Reply "yes" and we will schedule a short call — or "later" and we will pause outreach.',
    ],
    cta: ['I am still interested', 'Resume account', 'Talk to someone'],
  },
  {
    category: 'announcement',
    prefix: 'Thank you',
    subjects: ['Thank you, {{firstName}}', 'Grateful for {{companyName}}', 'Appreciation note'],
    headings: ['Thank you', 'We appreciate you', 'Grateful for your trust'],
    bodies: [
      'Hi {{firstName}},\n\nThank you for being part of our community.',
      'Teams like {{companyName}} are why we build what we build.',
      'If there is anything we can improve, reply anytime.',
    ],
    cta: ['Share feedback', 'Leave a review', 'Stay connected'],
  },
  {
    category: 'newsletter',
    prefix: 'Tips',
    subjects: ['Tips for {{firstName}}', 'Pro tips for {{companyName}}', 'Quick wins inside'],
    headings: ['3 tips this week', 'Work smarter', 'Quick wins'],
    bodies: [
      '1. Personalize subject lines with {{companyName}}\n2. Follow up within 48 hours\n3. Use templates to move faster',
      'Hi {{firstName}}, small changes compound — try one tip this week.',
      'Reply with your biggest bottleneck and we will suggest a workflow.',
    ],
    cta: ['More tips', 'Open library', 'Try templates'],
  },
  {
    category: 'promo',
    prefix: 'Seasonal',
    subjects: ['Seasonal offer for {{companyName}}', '{{firstName}}, holiday special', 'Year-end savings'],
    headings: ['Seasonal special', 'Holiday offer', 'Celebrate with savings'],
    bodies: [
      'Hi {{firstName}},\n\nA thank-you offer for {{companyName}} this season.',
      'Valid through month-end — share with teammates who should have access.',
      'Warm wishes from our entire team.',
    ],
    cta: ['Shop seasonal', 'Claim gift', 'See offer'],
  },
]

const LAYOUTS = ['hero-first', 'image-hero', 'image-mid', 'minimal', 'social-footer', 'double-cta']

function pick(arr, i) {
  return arr[i % arr.length]
}

function buildBlocks(layout, recipe, idx, imageUrl, palette) {
  const id = (s) => `${s}-${idx}`
  const hero = {
    id: id('hero'),
    type: 'hero',
    heading: pick(recipe.headings, idx),
    subtext: `Hi {{firstName}} — crafted for {{companyName}}.`,
  }
  const text1 = {
    id: id('t1'),
    type: 'text',
    content: pick(recipe.bodies, idx),
  }
  const text2 = {
    id: id('t2'),
    type: 'text',
    content: 'Reply to this email anytime — a teammate will get back to you quickly.',
  }
  const btn = {
    id: id('btn'),
    type: 'button',
    label: pick(recipe.cta, idx),
    url: 'https://connectintel.net',
    align: 'center',
  }
  const img = {
    id: id('img'),
    type: 'image',
    url: imageUrl,
    alt: recipe.prefix,
    align: 'center',
    width: 100,
  }
  const header = {
    id: id('hdr'),
    type: 'header',
    text: recipe.prefix,
    align: layout === 'minimal' ? 'left' : 'center',
  }
  const divider = { id: id('div'), type: 'divider' }
  const footer = { id: id('ftr'), type: 'footer', text: 'You are receiving this because you opted in.' }
  const social = {
    id: id('soc'),
    type: 'social',
    networks: ['linkedin', 'x', 'instagram'],
    align: 'center',
  }
  const btn2 = {
    id: id('btn2'),
    type: 'button',
    label: 'Contact sales',
    url: 'https://connectintel.net',
    align: 'center',
  }

  switch (layout) {
    case 'image-hero':
      return [header, img, hero, text1, btn, footer]
    case 'image-mid':
      return [header, hero, text1, img, divider, text2, btn, footer]
    case 'minimal':
      return [text1, btn, footer]
    case 'social-footer':
      return [header, hero, text1, btn, social, footer]
    case 'double-cta':
      return [header, hero, img, text1, btn, btn2, footer]
    default:
      return [header, hero, text1, divider, text2, btn, footer]
  }
}

/**
 * @returns {Array<{id:string,name:string,subject:string,design:object,blocks:array,category:string}>}
 */
export function buildExtendedStarterTemplates() {
  const out = []
  let n = 0
  for (const recipe of RECIPES) {
    for (let v = 0; v < 7; v += 1) {
      const layout = pick(LAYOUTS, n + v)
      const palette = pick(PALETTES, n)
      const imageUrl = pick(STOCK_IMAGES, n)
      const variant = v + 1
      const id = `${recipe.category}-${recipe.prefix.toLowerCase().replace(/\s+/g, '-')}-${String(variant).padStart(2, '0')}`
      out.push({
        id,
        name: `${recipe.prefix} ${variant}`,
        subject: pick(recipe.subjects, n),
        category: recipe.category,
        design: {
          ...BASE_THEME,
          primaryColor: palette.primaryColor,
          backgroundColor: palette.backgroundColor,
        },
        blocks: buildBlocks(layout, recipe, n, imageUrl, palette),
      })
      n += 1
    }
  }
  return out
}
