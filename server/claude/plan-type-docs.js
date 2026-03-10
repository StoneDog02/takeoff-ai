/**
 * Plan-type → TIER 3 document mapping.
 * Matches knowledge/ tier folders: tier3-residential, tier3-civil, tier3-commercial, shared.
 * Files are loaded from knowledge cache (keyed by basename).
 */

const DOC_MAP = {
  residential: [
    'construction-manual.pdf',
    'takeoff-rulebook-ai-formulas-and-extraction-logic.pdf',
    'common-assumptions-checklist.pdf',
    'unit-conversion-purchase-units.pdf',
    'waste-overage.pdf',
    'material-specs-standards.pdf',
    'house-plans-material-takeoff-creation-layout.pdf',
    // Add when available: 'residential-library.pdf',
  ],
  civil: [
    'Civil_Engineering_Drawing_Guide.pdf',
    'Heavy_Civil_Roadway_Utility_Takeoff_Rulebook.pdf',
    'Erosion_Control_BMP_Landscape_Industrial_Rules.pdf',
    'Engineer_Pipe_Length_Schedule.pdf',
    'civil-takeoff-guide.pdf',
    'civil-standard-detail-library.pdf',
  ],
  commercial: [
    'Structural_Steel_Takeoff_Rulebook.pdf',
    'CMU_Masonry_Precast_Tiltup_Takeoff_Rules.pdf',
    'Commercial_Assemblies_Roofing_ACT_Glazing_Sprinkler.pdf',
  ],
  auto: [
    // Lean set — shared + core refs
    'unit-conversion-purchase-units.pdf',
    'common-assumptions-checklist.pdf',
    'Engineers_Measuring_Tool_Knowledge_Guide.pdf',
    '3d-modeling-construction-plans.pdf',
  ],
}

/**
 * Return the list of TIER 3 document filenames for the given plan type.
 * Unknown planType falls back to 'auto'.
 *
 * @param {string} planType - 'residential' | 'civil' | 'commercial' | 'auto'
 * @returns {string[]} Basenames of files in knowledge/ to inject into the prompt
 */
function selectRelevantDocs(planType) {
  return DOC_MAP[planType] || DOC_MAP.auto
}

module.exports = {
  DOC_MAP,
  selectRelevantDocs,
}
