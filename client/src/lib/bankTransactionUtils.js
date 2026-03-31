/** True when a bank tx has both job and expense category (matches tagging rules in the UI). */
export function isBankTxTagged(row) {
  return row.job_id != null && row.expense_type != null && String(row.expense_type).length > 0
}
