#!/usr/bin/env node
/**
 * Smoke test for QuickBooks-style product export parsing.
 * Run: npm run test:qb-parser (from server/)
 */
const fs = require('fs')
const path = require('path')
const { parseQuickBooksProductsExport } = require('../lib/parseQuickBooksProductsExport')

const fixture = path.join(__dirname, '../fixtures/quickbooks-products-sample.csv')
const buf = fs.readFileSync(fixture)
const result = parseQuickBooksProductsExport(buf, 'quickbooks-products-sample.csv')

if (result.rows.length !== 2) {
  console.error('Expected 2 rows, got', result.rows.length)
  process.exit(1)
}
if (result.rows[0].name !== 'Concrete pour' || result.rows[1].item_type !== 'product') {
  console.error('Unexpected parse output:', result)
  process.exit(1)
}
console.log('parseQuickBooksProductsExport OK:', result.rows.length, 'rows')
process.exit(0)
