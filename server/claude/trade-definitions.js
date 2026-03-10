/**
 * trade-definitions.js
 *
 * Defines the v1 trade scope filter set for the takeoff trade selector.
 * MEP trades (plumbing, electrical, HVAC) are intentionally excluded from v1
 * — they require fully drawn MEP sheets to produce reliable quantities, and
 * most residential permit sets do not include them.
 *
 * To add a trade: add an entry to TRADE_MAP and add its key to TRADE_ORDER.
 * To enable MEP in a future version: add entries and add to TRADE_ORDER.
 */

const TRADE_MAP = {
  concrete: {
    label: 'Concrete / Foundations',
    csi: 'Division 03',
    categories: [
      'Concrete',
      'Footings',
      'Foundation Walls',
      'Slabs',
      'Flatwork',
      'Rebar',
      'Anchor Bolts',
      'Form Work',
    ],
    prompt: `Extract ONLY concrete and foundation materials. Include:
- Footings: dimensions, volume (CY), rebar (#size × LF → sticks)
- Foundation walls: dimensions, volume (CY), rebar
- Slabs / flatwork: SF, thickness, volume (CY), wire mesh or rebar
- Anchor bolts, hold-downs, embedded hardware
- Forming materials if called out on plans
Apply Burt Override Rule 1 to all rebar (20-ft sticks, 0% waste).
Apply Burt Override Rule 6 if a suspended slab or B-deck is present.
Do NOT include framing, sheathing, roofing, or any above-grade non-concrete items.`,
  },

  framing: {
    label: 'Rough Framing / Carpentry',
    csi: 'Division 06',
    categories: [
      'Framing',
      'Rough Carpentry',
      'Wall Framing',
      'Floor Framing',
      'Roof Framing',
      'Sheathing',
      'Engineered Lumber',
      'Connectors & Hardware',
      'Subfloor',
    ],
    prompt: `Extract ONLY rough framing and carpentry materials. Include:
- Wall framing: studs (by size, spacing, count), double top plates, bottom plates
  - Flag PT (pressure treated) on bottom plates for any wall on concrete (Burt Override Rule 2)
- Floor framing: joists, rim joist, blocking, LVL / engineered beams
- Roof framing: rafters or truss count, ridge board, hip/valley, blocking
- Wall sheathing OSB (apply 12% waste — not overridden)
- Roof sheathing OSB: exact sheet count, 0% waste (Burt Override Rule 4)
- Subfloor T&G: exact sheet count, 0% waste (Burt Override Rule 5)
- LVL beams, PSL, glulam: extract from structural sheets
- Connectors, joist hangers, post caps, hold-downs, structural screws
Do NOT include concrete, roofing, drywall, or finish carpentry items.`,
  },

  roofing: {
    label: 'Roofing',
    csi: 'Division 07',
    categories: [
      'Roofing',
      'Shingles',
      'Underlayment',
      'Ice & Water Shield',
      'Flashing',
      'Ridge Cap',
      'Drip Edge',
      'Gutters & Downspouts',
      'Roof Vents',
    ],
    prompt: `Extract ONLY roofing materials. Include:
- Shingles: total roof SF → squares (100 SF each), apply 12% waste for cuts/hips/valleys
- Underlayment (15# or 30# felt / synthetic): roof SF + 10% waste
- Ice & water shield: eave length × 3 ft wide (or per plan spec)
- Ridge cap: total ridge LF
- Drip edge: perimeter LF of all eaves and rakes
- Flashing: count all roof penetrations, step flashing LF at walls
- Gutters: eave LF; downspouts: count per plan
- Roof vents / ridge vent: LF or EA per plan
Do NOT include roof sheathing (that belongs to framing trade).
Do NOT include wall or window flashing (that belongs to exterior finish scope).`,
  },

  drywall: {
    label: 'Drywall / Finishes',
    csi: 'Division 09',
    categories: [
      'Drywall',
      'Insulation',
      'Ceiling',
      'Finish Carpentry',
      'Trim',
      'MDF',
      'Corner Bead',
      'Joint Compound',
    ],
    prompt: `Extract ONLY drywall, insulation, and interior finish materials. Include:
- Drywall sheets: wall SF + ceiling SF ÷ 32, apply 12% waste, report as EA (4×8 sheets)
  - Separate 5/8" Type X (garage, fire-rated walls) from 1/2" standard
- Corner bead: count all outside corners (LF)
- Joint compound: calculated from drywall SF (standard rate: 1 bucket per 500 SF)
- Drywall tape: rolls from total joint LF
- Wall insulation: SF by R-value (R-15, R-21, etc.) per wall type
- Ceiling / attic insulation: SF by R-value
- MDF trim: estimate per Burt Override Rule 7 (door count × 21 LF + window count × 14 LF + base LF × 1.15)
- Crown molding: LF if called out
Do NOT include roofing, sheathing, paint, or doors/windows.`,
  },

  painting: {
    label: 'Painting',
    csi: 'Division 09',
    categories: [
      'Painting',
      'Interior Paint',
      'Exterior Paint',
      'Primer',
      'Stain',
      'Sealers',
    ],
    prompt: `Extract ONLY painting and coating materials. Include:
- Interior walls: net paintable SF per room (deduct doors/windows), report by room group
- Interior ceilings: SF per level
- Interior trim / doors: count (doors × 20 SF equivalent, windows × 15 SF equivalent)
- Exterior walls: gross SF minus openings, by surface type (siding, trim, soffit)
- Exterior trim: LF converted to SF
- Primer: same SF as finish coats (1 coat assumed unless spec says otherwise)
- Number of coats: assume 2 finish coats unless noted on plans or in specs
- Calculate gallons: 1 gallon covers 350–400 SF (use 350 SF for estimating)
Flag all quantities as confidence: "medium" — painting SF depends on finish schedule and room heights not always shown on plans.
Do NOT include roofing coatings, concrete sealers, or waterproofing membranes.`,
  },

  doors_windows: {
    label: 'Doors / Windows / Millwork',
    csi: 'Division 08',
    categories: [
      'Exterior Doors',
      'Interior Doors',
      'Windows',
      'Skylights',
      'Garage Doors',
      'Door Hardware',
      'Shelving',
      'Bath Accessories',
    ],
    prompt: `Extract ONLY doors, windows, and millwork materials. Include:
- Exterior doors: count by size and type (entry, sliding, French, etc.)
- Interior doors: classify ALL types per Burt Override Rule 3:
  SW (single swing), PD (pocket), DB (double bi-fold), BF (single bi-fold),
  BD (barn/sliding), BP (bypass), FR (French interior), OH (overhead/garage)
  Output one line item per type per size.
- Windows: count by size from window schedule or plan marks
- Skylights: count and size if present
- Garage doors: count and size
- Door hardware: locksets, deadbolts, hinges — count from door schedule
- Shelving: count per Burt Override Rule 8 (WIC, reach-in, pantry, linen)
- Bath accessories: count per Burt Override Rule 8 (full bath kit vs. half bath kit)
Do NOT include trim/casing (that belongs to drywall/finishes trade).`,
  },

  earthwork: {
    label: 'Earthwork / Grading / Site',
    csi: 'Divisions 31–32',
    categories: [
      'Earthwork',
      'Cut',
      'Fill',
      'Import / Export',
      'Gravel Base',
      'Paving',
      'Curb & Gutter',
      'Erosion Control',
      'Site Utilities',
    ],
    prompt: `Extract ONLY site, earthwork, and civil materials. Include:
- Cut / fill volumes (CY) from grading plan — flag confidence as "low" if no surface model
- Import fill or export material (CY)
- Gravel / aggregate base: SF × depth → CY (under slab, under paving, trench bedding)
- Paving: SF by type (asphalt, concrete, pavers) with thickness
- Curb and gutter: LF by type
- Sidewalk / flatwork on site: SF
- Site utilities: pipe by material, diameter, and LF per sheet
  - Apply Keynote Cross-Reference Protocol — never aggregate by keynote number
- Erosion control BMP: silt fence (LF), inlet protection (EA), straw wattles (LF)
- Topsoil stripping and replacement (CY or SF) if shown on plans
Flag all earthwork volumes as confidence: "low" unless contours and spot elevations are sufficient for average end area calculation.
Do NOT include building foundation concrete (that belongs to concrete trade).`,
  },

  masonry: {
    label: 'Masonry / CMU',
    csi: 'Division 04',
    categories: [
      'Masonry',
      'CMU Block',
      'Mortar',
      'Grout',
      'Rebar in CMU',
      'Bond Beam',
      'Lintels',
    ],
    prompt: `Extract ONLY masonry materials. Include:
- CMU block: count by size (4", 6", 8", 12") — calculate from wall SF ÷ block face area
  Standard 8×8×16 CMU: 1.125 block per SF
- Mortar: 1 bag mortar per 35 block (standard estimate)
- Grout: SF of grouted cells × cell volume (8" CMU = ~0.067 CF/cell)
- Horizontal rebar in bond beams: LF by bar size
- Vertical rebar in cells: count grouted cells × wall height ÷ bar lap → sticks
  Apply Burt Override Rule 1 (20-ft sticks, 0% waste)
- Pre-cast lintels or steel angles over openings: count by span
- Control joints: LF from plans or assume every 20 LF of wall
Do NOT include poured concrete walls, wood framing, or any non-masonry items.`,
  },
}

/**
 * Display order for the UI selector.
 * "all" is handled separately as the default null state.
 */
const TRADE_ORDER = [
  'concrete',
  'framing',
  'roofing',
  'drywall',
  'painting',
  'doors_windows',
  'earthwork',
  'masonry',
]

/**
 * Returns the trade definition(s) for a given selection.
 * Never returns a partial or malformed object; unrecognized keys → null (full takeoff).
 *
 * @param {string|string[]|null} tradeKeys - Single key, array of keys, 'all', or null for full takeoff
 * @returns {{ label: string, csi: string, categories: string[], prompt: string }|null}
 *   Returns null for full takeoff (no filter).
 *   Returns single trade definition or merged definition if multiple trades selected.
 */
function getTradeFilter(tradeKeys) {
  if (tradeKeys == null || tradeKeys === '' || tradeKeys === 'all') return null
  if (Array.isArray(tradeKeys)) {
    const filtered = tradeKeys.filter((k) => typeof k === 'string' && TRADE_MAP[k.trim()])
    const validKeys = filtered.map((k) => k.trim()).filter(Boolean)
    if (validKeys.length === 0) return null
    if (validKeys.some((k) => k === 'all')) return null
    if (validKeys.length === 1) return TRADE_MAP[validKeys[0]]
    // Multi-trade: merge definitions
    const trades = validKeys.map((k) => TRADE_MAP[k])
    return {
      label: trades.map((t) => t.label).join(' + '),
      csi: trades.map((t) => t.csi).join(', '),
      categories: [...new Set(trades.flatMap((t) => t.categories))],
      prompt: trades.map((t, i) => `--- TRADE ${i + 1}: ${t.label} (${t.csi}) ---\n${t.prompt}`).join('\n\n'),
    }
  }
  const key = String(tradeKeys).trim()
  return TRADE_MAP[key] || null
}

module.exports = {
  TRADE_MAP,
  TRADE_ORDER,
  getTradeFilter,
}
