/**
 * Branding for client-facing invoices (portal + document viewer).
 * Reads contractor's branding_settings row.
 */

const DEFAULT_PRIMARY = '#b91c1c'
const DEFAULT_SECONDARY = '#1e293b'
const VALID_STYLES = new Set(['standard', 'minimal', 'detailed'])

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} [userId]
 * @returns {Promise<{ primaryColor: string, secondaryColor: string, invoiceTemplateStyle: string }>}
 */
async function fetchInvoiceBranding(supabase, userId) {
  if (!supabase || !userId) {
    return {
      primaryColor: DEFAULT_PRIMARY,
      secondaryColor: DEFAULT_SECONDARY,
      invoiceTemplateStyle: 'standard',
    }
  }
  const { data, error } = await supabase
    .from('branding_settings')
    .select('primary_color, secondary_color, invoice_template_style')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) {
    console.warn('[fetchInvoiceBranding]', error.message)
    return {
      primaryColor: DEFAULT_PRIMARY,
      secondaryColor: DEFAULT_SECONDARY,
      invoiceTemplateStyle: 'standard',
    }
  }
  const raw = data?.primary_color != null ? String(data.primary_color).trim() : ''
  const primaryColor = raw || DEFAULT_PRIMARY
  const rawSec = data?.secondary_color != null ? String(data.secondary_color).trim() : ''
  const secondaryColor = rawSec || DEFAULT_SECONDARY
  const st = data?.invoice_template_style != null ? String(data.invoice_template_style).trim() : 'standard'
  const invoiceTemplateStyle = VALID_STYLES.has(st) ? st : 'standard'
  return { primaryColor, secondaryColor, invoiceTemplateStyle }
}

module.exports = { fetchInvoiceBranding, DEFAULT_PRIMARY, DEFAULT_SECONDARY }
