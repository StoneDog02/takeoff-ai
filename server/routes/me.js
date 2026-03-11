const express = require('express')
const router = express.Router()

/** GET /api/me - Uses profiles.role for type (contractor vs employee) and isAdmin; employee details from employees when role is employee. */
function displayNameFromUser(user) {
  const meta = user?.user_metadata
  if (meta?.full_name) return meta.full_name
  if (meta?.name) return meta.name
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
  }
  return labels[profile.role] ?? profile.role
}

router.get('/', async (req, res, next) => {
  try {
    const user = req.user
      ? {
          id: req.user.id,
          email: req.user.email ?? '',
          full_name: req.user.user_metadata?.full_name ?? req.user.user_metadata?.name ?? null,
          display_name: displayNameFromUser(req.user),
        }
      : null
    const profile = req.profile
    const isAdmin = profile?.role === 'admin'
    if (profile?.role === 'employee') {
      if (req.employee) {
        const { id, name, email, role, phone, status, current_compensation, created_at, updated_at } = req.employee
        return res.json({
          user,
          isAdmin,
          type: 'employee',
          employee_id: id,
          employee: {
            id,
            name,
            email,
            role,
            phone: phone || '',
            status,
            current_compensation: current_compensation ?? null,
            created_at,
            updated_at,
          },
        })
      }
      return res.json({ user, isAdmin, type: 'employee', employee_id: null, employee: null })
    }
    const role_label = roleLabelFromProfile(profile)
    res.json({ user, isAdmin, type: 'contractor', role_label })
  } catch (err) {
    next(err)
  }
})

module.exports = router
