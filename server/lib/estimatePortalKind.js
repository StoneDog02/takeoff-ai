/**
 * Estimates created from "send change order" use titles like:
 *   "Change Order: …" or "Change Order (Approved): …"
 */
function isChangeOrderEstimateTitle(title) {
  return /^Change Order(?:\s*\(Approved\))?:/i.test(String(title || '').trim())
}

module.exports = { isChangeOrderEstimateTitle }
