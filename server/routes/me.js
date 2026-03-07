const express = require('express')
const router = express.Router()

/** GET /api/me - Uses profiles.role for type (contractor vs employee) and isAdmin; employee details from employees when role is employee. */
router.get('/', async (req, res, next) => {
  try {
    const user = req.user
      ? { id: req.user.id, email: req.user.email ?? '' }
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
    res.json({ user, isAdmin, type: 'contractor' })
  } catch (err) {
    next(err)
  }
})

module.exports = router
