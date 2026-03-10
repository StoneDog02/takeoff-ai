import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'
import { settingsApi } from '@/api/settings'
import { SectionHeader, Btn } from './SettingsPrimitives'

export function DangerZoneSection() {
  const navigate = useNavigate()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmWipe, setConfirmWipe] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [wiping, setWiping] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleWipe = async () => {
    setWiping(true)
    setError(null)
    try {
      await settingsApi.wipeData()
      setConfirmWipe(false)
      window.location.reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Wipe failed')
    } finally {
      setWiping(false)
    }
  }

  const handleDeleteAccount = async () => {
    setDeleting(true)
    setError(null)
    try {
      await settingsApi.deleteAccount()
      await supabase?.auth.signOut()
      navigate('/sign-in', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      {error && <div style={{ marginBottom: 16, padding: 12, background: '#fef2f2', color: '#b91c1c', borderRadius: 8 }}>{error}</div>}
      <SectionHeader title="Danger Zone" desc="Irreversible actions. Confirmation required." />
      <div style={{ border: '1.5px solid #fecaca', borderRadius: 16, overflow: 'hidden', background: '#fff' }}>
        <div style={{ height: 4, background: 'linear-gradient(90deg, #b91c1c, #ef4444)' }} />

        <div style={{ padding: '22px 24px', borderBottom: '1px solid #fef2f2' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: '#111', marginBottom: 4 }}>Delete account</div>
              <div style={{ fontSize: 13, color: '#9ca3af' }}>Permanently delete your account and all associated data. This cannot be undone.</div>
            </div>
            {!confirmDelete ? (
              <Btn variant="danger" onClick={() => setConfirmDelete(true)}>Delete account</Btn>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fef2f2', padding: '10px 14px', borderRadius: 10, border: '1px solid #fecaca' }}>
                <span style={{ fontSize: 13, color: '#b91c1c', fontWeight: 500 }}>Are you sure?</span>
                <Btn variant="dangerSolid" style={{ padding: '7px 14px', fontSize: 12 }} onClick={handleDeleteAccount} disabled={deleting}>{deleting ? 'Deleting…' : 'Yes, delete'}</Btn>
                <Btn variant="ghost" style={{ padding: '7px 14px', fontSize: 12 }} onClick={() => setConfirmDelete(false)} disabled={deleting}>Cancel</Btn>
              </div>
            )}
          </div>
        </div>

        <div style={{ padding: '22px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: '#111', marginBottom: 4 }}>Wipe all data</div>
              <div style={{ fontSize: 13, color: '#9ca3af' }}>Remove all projects, employees, and financial records. Account remains active.</div>
            </div>
            {!confirmWipe ? (
              <Btn variant="danger" onClick={() => setConfirmWipe(true)}>Wipe data</Btn>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fef2f2', padding: '10px 14px', borderRadius: 10, border: '1px solid #fecaca' }}>
                <span style={{ fontSize: 13, color: '#b91c1c', fontWeight: 500 }}>Are you sure?</span>
                <Btn variant="dangerSolid" style={{ padding: '7px 14px', fontSize: 12 }} onClick={handleWipe} disabled={wiping}>{wiping ? 'Wiping…' : 'Yes, wipe'}</Btn>
                <Btn variant="ghost" style={{ padding: '7px 14px', fontSize: 12 }} onClick={() => setConfirmWipe(false)} disabled={wiping}>Cancel</Btn>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
