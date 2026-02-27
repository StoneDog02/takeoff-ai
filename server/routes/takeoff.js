const express = require('express')
const multer = require('multer')
const path = require('path')
const { runTakeoff } = require('../claude/takeoff')
const { supabase: defaultSupabase } = require('../db/supabase')

const router = express.Router()

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
    ]
    if (allowed.includes(file.mimetype)) cb(null, true)
    else cb(new Error('Invalid file type. Use PDF or image (JPEG, PNG, WebP, GIF).'))
  },
})

router.post('/', (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'File too large (max 25MB)' })
      return res.status(400).json({ error: err.message || 'Invalid file' })
    }
    next()
  })
}, async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' })
    }
    const name = (req.body && req.body.name) || req.file.originalname || 'Unnamed takeoff'
    const { materialList } = await runTakeoff(req.file.buffer, req.file.mimetype)

    let id = null
    const supabase = req.supabase || defaultSupabase
    if (supabase) {
      const { data, error } = await supabase
        .from('takeoffs')
        .insert({
          name,
          plan_file_name: req.file.originalname,
          material_list: materialList,
          status: 'completed',
          user_id: req.user?.id ?? null,
        })
        .select('id, created_at')
        .single()
      if (!error) id = data.id
    }

    res.status(201).json({
      id: id || `temp-${Date.now()}`,
      name,
      materialList,
      createdAt: id ? new Date().toISOString() : undefined,
    })
  } catch (err) {
    next(err)
  }
})

module.exports = router