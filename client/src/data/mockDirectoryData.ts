/**
 * Mock data for Directory (contractors + messages). Single source for Directory page when using mock.
 */

export type DirectoryContractorStatus = 'online' | 'away' | 'offline'

export interface DirectoryContractor {
  id: string
  name: string
  trade: string
  email: string
  phone: string
  notes: string
  rating: number
  jobs: string[]
  avatar: string
  color: string
  status: DirectoryContractorStatus
  lastMsg: string
  lastTime: string
  unread: number
  /** When set, Message button can start a real conversation (e.g. employee.auth_user_id) */
  auth_user_id?: string
}

export interface ThreadMessage {
  id: number
  from: 'me' | 'them'
  text: string
  time: string
}

export const TRADES = [
  'Electrical',
  'Plumbing',
  'HVAC',
  'Drywall',
  'Flooring',
  'Framing',
  'Roofing',
  'Concrete',
  'Painting',
  'Tile',
  'Landscaping',
  'Other',
] as const

export const INITIAL_DIRECTORY_CONTRACTORS: DirectoryContractor[] = [
  {
    id: 'dir-1',
    name: 'Valdez Electric',
    trade: 'Electrical',
    email: 'bids@valdezelectric.com',
    phone: '801-555-1001',
    notes: 'Licensed master electrician. Fast turnaround on bids.',
    rating: 5,
    jobs: ['Kitchen Remodel – 123 Main St', 'Master Bath – 442 Oak St'],
    avatar: 'VE',
    color: '#1d4ed8',
    status: 'online',
    lastMsg: 'We can start Monday, just confirm the scope.',
    lastTime: '1h ago',
    unread: 2,
  },
  {
    id: 'dir-2',
    name: 'Mountain View Plumbing',
    trade: 'Plumbing',
    email: 'office@mountainviewplumbing.com',
    phone: '801-555-1002',
    notes: 'Great on remodels. Prefer 2-week notice.',
    rating: 4,
    jobs: ['Kitchen Remodel – 123 Main St'],
    avatar: 'MV',
    color: '#0891b2',
    status: 'away',
    lastMsg: 'Permit pulled, rough-in next week.',
    lastTime: '3h ago',
    unread: 0,
  },
  {
    id: 'dir-3',
    name: 'Summit HVAC',
    trade: 'HVAC',
    email: 'dispatch@summithvac.com',
    phone: '',
    notes: 'Handles commercial and residential. No phone — email only.',
    rating: 4,
    jobs: ['Deck & Patio – 55 Maple Dr'],
    avatar: 'SH',
    color: '#047857',
    status: 'offline',
    lastMsg: 'Quote is in your inbox.',
    lastTime: 'Yesterday',
    unread: 0,
  },
  {
    id: 'dir-4',
    name: 'Reyes Drywall & Finish',
    trade: 'Drywall',
    email: 'reyes.drywall@email.com',
    phone: '801-555-1004',
    notes: 'Excellent finish work. Books out 3 weeks.',
    rating: 5,
    jobs: [],
    avatar: 'RD',
    color: '#7c3aed',
    status: 'online',
    lastMsg: 'Do you need Level 5 finish or Level 4?',
    lastTime: '2d ago',
    unread: 1,
  },
  {
    id: 'dir-5',
    name: 'Premier Flooring Co',
    trade: 'Flooring',
    email: 'estimates@premierflooring.com',
    phone: '801-555-1005',
    notes: 'Hardwood specialists. Ask for Tony.',
    rating: 3,
    jobs: ['Master Bath – 442 Oak St'],
    avatar: 'PF',
    color: '#b45309',
    status: 'offline',
    lastMsg: 'Samples delivered to the job site.',
    lastTime: '4d ago',
    unread: 0,
  },
]

export const INITIAL_THREAD_MESSAGES: Record<string, ThreadMessage[]> = {
  'dir-1': [
    { id: 1, from: 'them', text: 'Hey, got your message about the kitchen panel upgrade.', time: 'Mon 9:00 AM' },
    { id: 2, from: 'me', text: 'Yeah, the homeowner wants to go 200A. Can you quote it?', time: 'Mon 9:05 AM' },
    { id: 3, from: 'them', text: "Sure thing. I'll swing by Thursday to assess.", time: 'Mon 9:07 AM' },
    { id: 4, from: 'me', text: "Perfect. Key's under the mat.", time: 'Mon 9:10 AM' },
    { id: 5, from: 'them', text: 'We can start Monday, just confirm the scope.', time: 'Today 8:45 AM' },
  ],
  'dir-2': [
    { id: 1, from: 'me', text: 'Need rough-in done before drywall goes up — Friday latest.', time: 'Mon 7:30 AM' },
    { id: 2, from: 'them', text: "Doable. I'll have my guy out Wed/Thu.", time: 'Mon 8:00 AM' },
    { id: 3, from: 'them', text: 'Permit pulled, rough-in next week.', time: 'Today 7:15 AM' },
  ],
  'dir-3': [{ id: 1, from: 'them', text: 'Quote is in your inbox.', time: 'Yesterday 2:00 PM' }],
  'dir-4': [
    { id: 1, from: 'me', text: "We'll need drywall hung and finished in the master — about 800sqft.", time: 'Tue 10:00 AM' },
    { id: 2, from: 'them', text: 'Do you need Level 5 finish or Level 4?', time: 'Tue 10:20 AM' },
  ],
  'dir-5': [{ id: 1, from: 'them', text: 'Samples delivered to the job site.', time: 'Mon 3:00 PM' }],
}

export const TRADE_COLORS: Record<string, string> = {
  Electrical: '#1d4ed8',
  Plumbing: '#0891b2',
  HVAC: '#047857',
  Drywall: '#7c3aed',
  Flooring: '#b45309',
  Framing: '#374151',
  Roofing: '#9a3412',
  Concrete: '#6b7280',
  Painting: '#be185d',
  Tile: '#0f766e',
  Landscaping: '#15803d',
  Other: '#9ca3af',
}

export const STATUS_COLOR: Record<DirectoryContractorStatus, string> = {
  online: '#22c55e',
  away: '#f59e0b',
  offline: '#d1d5db',
}
