/**
 * Mock data for the Contractors page. Enable by setting VITE_USE_CONTRACTORS_MOCK=true in .env.
 */
import type { Contractor } from '@/types/global'

const now = new Date().toISOString()

export const mockContractors: Contractor[] = [
  {
    id: 'con-1',
    name: 'Valdez Electric',
    trade: 'Electrical',
    email: 'bids@valdezelectric.com',
    phone: '801-555-1001',
    created_at: now,
    updated_at: now,
  },
  {
    id: 'con-2',
    name: 'Mountain View Plumbing',
    trade: 'Plumbing',
    email: 'office@mountainviewplumbing.com',
    phone: '801-555-1002',
    created_at: now,
    updated_at: now,
  },
  {
    id: 'con-3',
    name: 'Summit HVAC',
    trade: 'HVAC',
    email: 'dispatch@summithvac.com',
    phone: undefined,
    created_at: now,
    updated_at: now,
  },
  {
    id: 'con-4',
    name: 'Reyes Drywall & Finish',
    trade: 'Drywall',
    email: 'reyes.drywall@email.com',
    phone: '801-555-1004',
    created_at: now,
    updated_at: now,
  },
  {
    id: 'con-5',
    name: 'Premier Flooring Co',
    trade: 'Flooring',
    email: 'estimates@premierflooring.com',
    phone: '801-555-1005',
    created_at: now,
    updated_at: now,
  },
]
