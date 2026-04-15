import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Building2,
  Users,
  Bell,
  MapPin,
  CreditCard,
  Palette,
  Download,
  AlertTriangle,
  Gift,
  ChevronRight,
  type LucideIcon,
} from 'lucide-react'
import { CompanyProfileSection } from '@/components/settings/CompanyProfileSection'
import { UserRoleManagementSection } from '@/components/settings/UserRoleManagementSection'
import { NotificationPreferencesSection } from '@/components/settings/NotificationPreferencesSection'
import { GeofenceDefaultsSection } from '@/components/settings/GeofenceDefaultsSection'
import Billing from '@/pages/settings/Billing'
import { IntegrationsSection } from '@/components/settings/IntegrationsSection'
import { BrandingSection } from '@/components/settings/BrandingSection'
import { TaxComplianceSection } from '@/components/settings/TaxComplianceSection'
import { DataExportSection } from '@/components/settings/DataExportSection'
import { DangerZoneSection } from '@/components/settings/DangerZoneSection'
import { SettingsMobileNavContext } from '@/components/settings/SettingsMobileNavContext'
import { ReferralWidget } from '@/components/ReferralWidget'

export type SettingsSectionId =
  | 'company'
  | 'users'
  | 'notifications'
  | 'geofence'
  | 'billing'
  | 'referrals'
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
  { id: 'referrals', label: 'Referrals', Icon: Gift, desc: 'Share your code & earn credits' },
  { id: 'branding', label: 'Branding', Icon: Palette, desc: 'Logo & colors' },
  { id: 'export', label: 'Data & Export', Icon: Download, desc: 'Export your data' },
  { id: 'danger', label: 'Danger Zone', Icon: AlertTriangle, desc: 'Irreversible actions', danger: true },
]

/** Sections not listed in the sidebar; still reachable via ?section= (e.g. integrations OAuth return, tax while WIP). */
const SETTINGS_SECTION_IDS_HIDDEN_FROM_NAV: SettingsSectionId[] = ['integrations', 'tax']

type MobileSettingsPanel = 'list' | 'detail'

export default function SettingsPage() {
  const [active, setActive] = useState<SettingsSectionId>('company')
  const [searchParams] = useSearchParams()
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches
  )
  const [mobilePanel, setMobilePanel] = useState<MobileSettingsPanel>('list')

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const sync = () => setIsMobile(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  useEffect(() => {
    if (searchParams.get('quickbooks') === 'connected') {
      setActive('integrations')
      if (window.matchMedia('(max-width: 767px)').matches) {
        setMobilePanel('detail')
      }
    }
  }, [searchParams])

  useEffect(() => {
    const section = searchParams.get('section') as SettingsSectionId | null
    const inNav = section && NAV.some((n) => n.id === section)
    const hiddenOk = section && SETTINGS_SECTION_IDS_HIDDEN_FROM_NAV.includes(section)
    if (section && (inNav || hiddenOk)) {
      setActive(section)
      if (window.matchMedia('(max-width: 767px)').matches) {
        setMobilePanel('detail')
      }
    }
  }, [searchParams])

  useEffect(() => {
    if (!isMobile) setMobilePanel('list')
  }, [isMobile])

  const openSection = (id: SettingsSectionId) => {
    setActive(id)
    if (isMobile) setMobilePanel('detail')
  }

  const backToList = () => setMobilePanel('list')

  const sectionContent = (
    <>
      {active === 'company' && <CompanyProfileSection />}
      {active === 'users' && <UserRoleManagementSection />}
      {active === 'notifications' && <NotificationPreferencesSection />}
      {active === 'geofence' && <GeofenceDefaultsSection />}
      {active === 'billing' && <Billing />}
      {active === 'referrals' && <ReferralWidget />}
      {active === 'integrations' && <IntegrationsSection />}
      {active === 'branding' && <BrandingSection />}
      {active === 'tax' && <TaxComplianceSection />}
      {active === 'export' && <DataExportSection />}
      {active === 'danger' && <DangerZoneSection />}
    </>
  )

  return (
    <div
      className="settings-page-root flex w-full grow-0 flex-col bg-[var(--bg-page)] text-[var(--text-primary)] min-h-min md:min-h-screen md:flex-row"
      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
    >
      <style>{`* { box-sizing: border-box; } ::placeholder { color: #c4bfb8; }`}</style>

      {/* ——— Mobile: list of sections ——— */}
      {isMobile && mobilePanel === 'list' && (
        <div className="flex w-full flex-col md:hidden">
          <div className="border-b border-[var(--border)] px-4 pb-4 pt-6">
            <h1 className="m-0 text-[28px] font-extrabold tracking-tight text-[var(--text-primary)]">
              Settings
            </h1>
          </div>
          <nav className="w-full" aria-label="Settings sections">
            {NAV.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => openSection(item.id)}
                className="flex w-full items-center gap-3 border-b border-[var(--border)] px-4 py-3.5 text-left transition-colors hover:bg-[var(--bg-hover)]"
              >
                <div
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] ${
                    item.danger ? 'border-red-200/50 bg-red-50 dark:border-red-900/40 dark:bg-red-950/30' : ''
                  }`}
                >
                  <item.Icon
                    size={20}
                    strokeWidth={2}
                    className={
                      item.danger
                        ? 'text-[var(--red)]'
                        : 'text-[var(--text-muted)]'
                    }
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div
                    className={`text-[15px] font-semibold leading-tight ${
                      item.danger ? 'text-[var(--red)]' : 'text-[var(--text-primary)]'
                    }`}
                  >
                    {item.label}
                  </div>
                  <div className="mt-0.5 text-[12px] leading-snug text-[var(--text-muted)]">
                    {item.desc}
                  </div>
                </div>
                <ChevronRight
                  size={18}
                  className="shrink-0 text-[var(--text-muted)]"
                  aria-hidden
                />
              </button>
            ))}
          </nav>
        </div>
      )}

      {/* ——— Mobile: section detail (back control lives in SectionHeader via SettingsMobileNavContext) ——— */}
      {isMobile && mobilePanel === 'detail' && (
        <SettingsMobileNavContext.Provider value={{ onBack: backToList }}>
          {/* Single scroll: parent .content-wrap scrolls — avoid nested overflow + min-h-screen (100vh) which causes extra rubber-band past content on mobile */}
          <div className="w-full min-w-0 px-4 py-5 md:hidden">{sectionContent}</div>
        </SettingsMobileNavContext.Provider>
      )}

      {/* ——— Desktop: sidebar + content (single mount of section — no duplicate with mobile) ——— */}
      {!isMobile && (
        <>
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
                className="dark:!text-[var(--text-primary)]"
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
                  className="dark:bg-transparent dark:hover:bg-[var(--bg-hover)]"
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
                    className="dark:!text-[inherit]"
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
                      className="dark:!text-[inherit]"
                    >
                      {item.label}
                    </div>
                    <div style={{ fontSize: 11, color: '#c4bfb8', marginTop: 1 }}>{item.desc}</div>
                  </div>
                </button>
              )
            })}
          </aside>

          <div
            className="min-h-0 min-w-0 flex-1 overflow-y-auto"
            style={{
              padding: '36px 48px',
            }}
          >
            {sectionContent}
          </div>
        </>
      )}
    </div>
  )
}
