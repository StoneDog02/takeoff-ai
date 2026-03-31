/**
 * Company branding for public token portals (estimate / invoice / bid).
 * Maps company_settings rows to a safe JSON shape (no internal IDs).
 */

function companyRowToPublic(row) {
  if (!row) return null
  const name = row.name != null ? String(row.name).trim() : ''
  const logoRaw = row.logo_url != null ? String(row.logo_url).trim() : ''
  const logoUrl = logoRaw || null
  const phone = row.phone != null && String(row.phone).trim() ? String(row.phone).trim() : null
  const email = row.email != null && String(row.email).trim() ? String(row.email).trim() : null
  const website = row.website != null && String(row.website).trim() ? String(row.website).trim() : null
  const licenseNumber =
    row.license_number != null && String(row.license_number).trim() ? String(row.license_number).trim() : null
  const line1 = row.address_line_1 != null ? String(row.address_line_1).trim() : ''
  const line2 = row.address_line_2 != null ? String(row.address_line_2).trim() : ''
  const city = row.city != null ? String(row.city).trim() : ''
  const state = row.state != null ? String(row.state).trim() : ''
  const zip = row.postal_code != null ? String(row.postal_code).trim() : ''
  const cityStateZip = [city, [state, zip].filter(Boolean).join(' ')].filter(Boolean).join(', ')
  const addressParts = [line1, line2, cityStateZip].filter(Boolean)
  const addressLine = addressParts.length ? addressParts.join(', ') : null

  if (!name && !logoUrl && !phone && !email && !addressLine && !website && !licenseNumber) return null

  return {
    name: name || null,
    logoUrl,
    phone,
    email,
    website,
    licenseNumber,
    addressLine,
  }
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} [userId]
 * @returns {Promise<object|null>}
 */
async function fetchPublicCompanyProfile(supabase, userId) {
  if (!userId) return null
  const { data, error } = await supabase
    .from('company_settings')
    .select(
      'name, logo_url, phone, email, website, license_number, address_line_1, address_line_2, city, state, postal_code'
    )
    .eq('user_id', userId)
    .maybeSingle()
  if (error) {
    console.error('[fetchPublicCompanyProfile]', error)
    return null
  }
  return companyRowToPublic(data)
}

module.exports = {
  companyRowToPublic,
  fetchPublicCompanyProfile,
}
