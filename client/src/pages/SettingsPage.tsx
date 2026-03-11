import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Building2,
  Users,
  Bell,
  MapPin,
  CreditCard,
  Link2,
  Palette,
  ClipboardList,
  Download,
  AlertTriangle,
  type LucideIcon,
} from 'lucide-react'
import { CompanyProfileSection } from '@/components/settings/CompanyProfileSection'
import { UserRoleManagementSection } from '@/components/settings/UserRoleManagementSection'
import { NotificationPreferencesSection } from '@/components/settings/NotificationPreferencesSection'
import { GeofenceDefaultsSection } from '@/components/settings/GeofenceDefaultsSection'
import { BillingSection } from '@/components/settings/BillingSection'
import { IntegrationsSection } from '@/components/settings/IntegrationsSection'
import { BrandingSection } from '@/components/settings/BrandingSection'
import { TaxComplianceSection } from '@/components/settings/TaxComplianceSection'
import { DataExportSection } from '@/components/settings/DataExportSection'
import { DangerZoneSection } from '@/components/settings/DangerZoneSection'

export type SettingsSectionId =
  | 'company'
  | 'users'
  | 'notifications'
  | 'geofence'
  | 'billing'
  | 'integrations'
  | 'branding'
  | 'tax'
  | 'export'
  | 'danger'

const NAV: {
  id: SettingsSectionId
  label: string
  Icon: LucideIcon
  desc: string
  danger?: boolean
}[] = [
  { id: 'company', label: 'Company Profile', Icon: Building2, desc: 'Name, logo, address' },
  { id: 'users', label: 'User & Roles', Icon: Users, desc: 'Team & permissions' },
  { id: 'notifications', label: 'Notifications', Icon: Bell, desc: 'Alerts & channels' },
  { id: 'geofence', label: 'Geofence Defaults', Icon: MapPin, desc: 'GPS & boundaries' },
  { id: 'billing', label: 'Billing & Subscription', Icon: CreditCard, desc: 'Plan & usage' },
  { id: 'integrations', label: 'Integrations', Icon: Link2, desc: 'Connected apps' },
  { id: 'branding', label: 'Branding', Icon: Palette, desc: 'Logo & colors' },
  { id: 'tax', label: 'Tax & Compliance', Icon: ClipboardList, desc: 'Rates & license' },
  { id: 'export', label: 'Data & Export', Icon: Download, desc: 'Export your data' },
  { id: 'danger', label: 'Danger Zone', Icon: AlertTriangle, desc: 'Irreversible actions', danger: true },
]

export default function SettingsPage() {
  const [active, setActive] = useState<SettingsSectionId>('company')
  const [searchParams] = useSearchParams()

  useEffect(() => {
    if (searchParams.get('quickbooks') === 'connected') {
      setActive('integrations')
    }
  }, [searchParams])

  return (
    <div
      className="min-h-screen flex"
      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
    >
      <style>{`* { box-sizing: border-box; } ::placeholder { color: #c4bfb8; }`}</style>

      {/* Sidebar */}
      <aside
        className="border-r border-gray-200 dark:border-border-dark"
        style={{
          width: 240,
          flexShrink: 0,
          padding: '32px 0',
          position: 'sticky',
          top: 0,
          height: '100vh',
          overflowY: 'auto',
        }}
        aria-label="Settings sections"
      >
        <div
          className="border-b border-gray-200 dark:border-border-dark"
          style={{
            padding: '0 20px 24px',
            marginBottom: 8,
          }}
        >
          <h1
            style={{
              fontSize: 22,
              fontWeight: 800,
              color: '#111',
              letterSpacing: '-0.02em',
              margin: 0,
            }}
          >
            Settings
          </h1>
        </div>
        {NAV.map((item) => {
          const isActive = active === item.id
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActive(item.id)}
              style={{
                width: '100%',
                textAlign: 'left',
                background: isActive ? '#fff' : 'transparent',
                border: 'none',
                borderRight: isActive ? '3px solid #b91c1c' : '3px solid transparent',
                padding: '11px 20px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                transition: 'all 0.15s',
                marginBottom: 1,
              }}
            >
              <item.Icon
                size={16}
                strokeWidth={2}
                style={{
                  flexShrink: 0,
                  color: item.danger
                    ? isActive
                      ? '#b91c1c'
                      : '#ef4444'
                    : isActive
                      ? '#111'
                      : '#9ca3af',
                }}
              />
              <div>
                <div
                  style={{
                    fontSize: 13.5,
                    fontWeight: isActive ? 700 : 500,
                    color: item.danger
                      ? isActive
                        ? '#b91c1c'
                        : '#ef4444'
                      : isActive
                        ? '#111'
                        : '#6b7280',
                    lineHeight: 1.2,
                  }}
                >
                  {item.label}
                </div>
                <div style={{ fontSize: 11, color: '#c4bfb8', marginTop: 1 }}>{item.desc}</div>
              </div>
            </button>
          )
        })}
      </aside>

      {/* Content */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          padding: '36px 48px',
          overflowY: 'auto',
        }}
      >
        {active === 'company' && <CompanyProfileSection />}
        {active === 'users' && <UserRoleManagementSection />}
        {active === 'notifications' && <NotificationPreferencesSection />}
        {active === 'geofence' && <GeofenceDefaultsSection />}
        {active === 'billing' && <BillingSection />}
        {active === 'integrations' && <IntegrationsSection />}
        {active === 'branding' && <BrandingSection />}
        {active === 'tax' && <TaxComplianceSection />}
        {active === 'export' && <DataExportSection />}
        {active === 'danger' && <DangerZoneSection />}
      </div>
    </div>
  )
}
