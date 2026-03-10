# Knowledge folder — tiered structure

Files here are loaded at server startup into the knowledge cache and injected into takeoff prompts by tier.

| Folder | Purpose |
|--------|--------|
| **tier1-overrides/** | Burt overrides only. Loaded first; supersede all other rules. |
| **tier2-process/** | Core takeoff process: Bluebeam, civil prompts, accuracy/measurement guides. |
| **tier3-residential/** | Plan type = Residential: construction manual, rulebook, assumptions, units, waste, specs, house plans. |
| **tier3-civil/** | Plan type = Civil: civil drawing guide, roadway/utility rulebook, erosion control, pipe schedule, civil guides. |
| **tier3-commercial/** | Plan type = Commercial: structural steel, CMU/masonry, commercial assemblies. |
| **shared/** | Shared across contexts: measuring tool guide, building code reference, 3D modeling. |

- **TIER 1** and **TIER 2** are injected for every custom-project takeoff.
- **TIER 3** is selected by plan type (see `plan-type-docs.js`: residential / civil / commercial / auto).
- **Shared** files are in the cache; include them in `DOC_MAP.auto` or a plan type in `plan-type-docs.js` to inject.

Supported formats: `.txt`, `.md`, `.pdf`, `.docx`, `.xlsx`, `.xls`, `.csv`, `.json`, `.py`.
