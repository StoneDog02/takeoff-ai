#!/usr/bin/env node
/**
 * Reads SVG files from client/src/components/projects/work-type-icons/svg-sources/
 * and updates the corresponding *Icon.tsx components with the real SVG content.
 *
 * Prerequisite: Download each icon from Iconscout and save as labor.svg, tile.svg, etc.
 * See svg-sources/README.md for the exact URLs and filenames.
 */

const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const SOURCES_DIR = path.join(ROOT, 'client/src/components/projects/work-type-icons/svg-sources')
const ICONS_DIR = path.join(ROOT, 'client/src/components/projects/work-type-icons')

const FILE_MAP = {
  labor: 'LaborIcon',
  tile: 'TileIcon',
  plumbing: 'PlumbingIcon',
  demolition: 'DemolitionIcon',
  framing: 'FramingIcon',
  concrete: 'ConcreteIcon',
  cabinets: 'CabinetsIcon',
  equipment: 'EquipmentIcon',
}

const SOURCE_URLS = {
  labor: 'https://iconscout.com/icon/labor-icon_1602072',
  tile: 'https://iconscout.com/icon/tile-icon_7779137',
  plumbing: 'https://iconscout.com/icon/plumbing-icon_1195647',
  demolition: 'https://iconscout.com/icon/demolition-icon_13219176',
  framing: 'https://iconscout.com/icon/framing-icon_11392924',
  concrete: 'https://iconscout.com/icon/concrete-icon_2657213',
  cabinets: 'https://iconscout.com/icon/cabinets-icon_5245161',
  equipment: 'https://iconscout.com/icon/skid-steer-icon_8911191',
}

function extractViewBox(svgString) {
  const m = svgString.match(/<svg[^>]*\sviewBox\s*=\s*["']([^"']+)["']/i)
  return m ? m[1].trim() : '0 0 24 24'
}

function extractInnerContent(svgString) {
  const open = svgString.indexOf('<svg')
  if (open === -1) return ''
  const tagEnd = svgString.indexOf('>', open)
  if (tagEnd === -1) return ''
  const close = svgString.indexOf('</svg>', tagEnd)
  if (close === -1) return ''
  let inner = svgString.slice(tagEnd + 1, close).trim()
  // So the icon inherits theme color, replace fill with currentColor
  inner = inner.replace(/\bfill\s*=\s*["'][^"']*["']/gi, 'fill="currentColor"')
  return inner
}

function escapeForTemplateLiteral(inner) {
  return inner.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${')
}

function updateTsxFile(key, viewBox, innerContent) {
  const componentName = FILE_MAP[key]
  const fileName = `${componentName}.tsx`
  const filePath = path.join(ICONS_DIR, fileName)
  const url = SOURCE_URLS[key]
  const title = key.charAt(0).toUpperCase() + key.slice(1)

  const content = `/**
 * ${title} work type icon.
 * Source: ${url}
 * Generated from downloaded Iconscout SVG – run scripts/update-work-type-icons.js after re-downloading.
 */
export function ${componentName}({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="${viewBox}"
      fill="currentColor"
      className={className}
      aria-hidden
    >
      ${escapeForTemplateLiteral(innerContent)}
    </svg>
  )
}
`
  fs.writeFileSync(filePath, content, 'utf8')
  console.log('Updated', fileName)
}

function main() {
  if (!fs.existsSync(SOURCES_DIR)) {
    console.error('Sources directory not found:', SOURCES_DIR)
    console.error('Create it and add SVG files (labor.svg, tile.svg, etc.). See svg-sources/README.md')
    process.exit(1)
  }

  let updated = 0
  for (const [key, componentName] of Object.entries(FILE_MAP)) {
    const svgPath = path.join(SOURCES_DIR, `${key}.svg`)
    if (!fs.existsSync(svgPath)) {
      console.warn('Skip (file not found):', `${key}.svg`)
      continue
    }
    const svgString = fs.readFileSync(svgPath, 'utf8')
    const viewBox = extractViewBox(svgString)
    const innerContent = extractInnerContent(svgString)
    if (!innerContent) {
      console.warn('Skip (no inner content):', `${key}.svg`)
      continue
    }
    updateTsxFile(key, viewBox, innerContent)
    updated++
  }

  console.log('Done. Updated', updated, 'icon(s).')
}

main()
