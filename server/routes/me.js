const express = require('express')
const { supabase: supabaseAdmin } = require('../db/supabase')
const router = express.Router()

/** GET /api/me - Uses profiles.role for type (contractor vs employee) and isAdmin; employee details from employees when role is employee. */
function fullNameFromMetadata(meta) {
  if (!meta) return null
  if (meta.full_name) return meta.full_name
  if (meta.name) return meta.name
  const first = (meta.first_name || '').trim()
  const last = (meta.last_name || '').trim()
  if (first || last) return [first, last].filter(Boolean).join(' ')
  return null
}

function displayNameFromUser(user) {
  const meta = user?.user_metadata
  const fromMeta = fullNameFromMetadata(meta)
  if (fromMeta) return fromMeta
  const email = user?.email ?? ''
  const local = email.split('@')[0]
  if (local) return local.charAt(0).toUpperCase() + local.slice(1).toLowerCase()
  return 'User'
}

function roleLabelFromProfile(profile) {
  if (!profile?.role) return 'Project Manager'
  const labels = {
    admin: 'Admin',
    project_manager: 'Project Manager',
    field_supervisor: 'Field Supervisor',
    employee: 'Employee',
    subcontractor: 'Subcontractor',
    affiliate: 'Partner',
  }
  return labels[profile.role] ?? profile.role
}

router.get('/', async (req, res, next) => {
  try {
    const user = req.user
      ? {
          id: req.user.id,
          email: req.user.email ?? '',
          full_name: fullNameFromMetadata(req.user.user_metadata) ?? null,
          display_name: displayNameFromUser(req.user),
        }
      : null
    const profile = req.profile
    const isAdmin = profile?.role === 'admin'
    const bypassFeatureGates =
      isAdmin || (profile?.full_product_access === true)

    let hasAffiliatePortal = false
    if (user?.id && supabaseAdmin) {
      const { data: affRow } = await supabaseAdmin
        .from('affiliates')
        .select('id')
        .eq('auth_user_id', user.id)
        .maybeSingle()
      hasAffiliatePortal = Boolean(affRow)
    }

    if (req.actingAsEmployee && req.employee) {
      const { id, name, email, role, phone, status, current_compensation, created_at, updated_at, daily_log_access } =
        req.employee
      return res.json({
        user,
        isAdmin,
        bypass_feature_gates: bypassFeatureGates,
        type: 'employee',
        employee_id: id,
        employee: {
          id,
          name,
          email,
          role,
          phone: phone || '',
          status,
          daily_log_access: daily_log_access === true,
          current_compensation: current_compensation ?? null,
          created_at,
          updated_at,
        },
        acting_as_employee: true,
        has_affiliate_portal: hasAffiliatePortal,
      })
    }
    if (profile?.role === 'employee') {
      if (req.employee) {
        const { id, name, email, role, phone, status, current_compensation, created_at, updated_at, daily_log_access } =
          req.employee
        return res.json({
          user,
          isAdmin,
          bypass_feature_gates: bypassFeatureGates,
          type: 'employee',
          employee_id: id,
          employee: {
            id,
            name,
            email,
            role,
            phone: phone || '',
            status,
            daily_log_access: daily_log_access === true,
            current_compensation: current_compensation ?? null,
            created_at,
            updated_at,
          },
          has_affiliate_portal: hasAffiliatePortal,
        })
      }
      return res.json({
        user,
        isAdmin,
        bypass_feature_gates: bypassFeatureGates,
        type: 'employee',
        employee_id: null,
        employee: null,
        has_affiliate_portal: hasAffiliatePortal,
      })
    }
    const role_label = roleLabelFromProfile(profile)
    res.json({
      user,
      isAdmin,
      bypass_feature_gates: bypassFeatureGates,
      type: 'contractor',
      role_label,
      has_affiliate_portal: hasAffiliatePortal,
    })
  } catch (err) {
    next(err)
  }
})

module.exports = router
