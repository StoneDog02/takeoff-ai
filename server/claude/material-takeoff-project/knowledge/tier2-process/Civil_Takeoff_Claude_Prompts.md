# Civil Takeoff Resolution — Claude AI Prompt File
## Project: Townhome + Commercial Development
## Sheets: C-001, C-004, C-101, C-102, C-103

---

## HOW TO USE THIS FILE

Each section below is a standalone prompt. Copy the prompt for the resolution type you are working on and paste it into Claude. Then upload a screenshot of the relevant plan sheet. Claude will process it and return structured results.

---

## TYPE 1 — SIDEWALK CLARIFICATION (No plan upload needed)

```
I have a civil site plan (sheet C-101, scale 1"=20') for a townhome development.

Keynote 8 on C-101 reads:
"Install concrete sidewalk 6 inches above asphalt grade with thickened edge — THIS SIDEWALK ONLY"

The phrase "THIS SIDEWALK ONLY" is ambiguous. I need to determine:

Option A: This is an entirely NEW/ADDITIONAL sidewalk at the Hwy 91 connection that
is NOT captured in the existing Detail F sidewalk quantity already in my takeoff.

Option B: This is the SAME Detail F sidewalk shown elsewhere on the plan, but with a
different thickness specification at this one location only. No new SF is added.

Based on standard civil plan conventions:
1. Which interpretation does the phrasing "THIS SIDEWALK ONLY" most commonly indicate?
2. What would change in my quantity takeoff under each scenario?
3. What is the most precise single-sentence RFI question I should send to the engineer
   to resolve this definitively?

My current sidewalk confidence is 82%. If this is Option A (additional SF), I need to
add a new line item and measure from C-101. If Option B, the existing quantity stands
and confidence updates to 93%.
```

---

## TYPE 2 — LANDSCAPE AREA SPLIT ON C-004

```
I am processing sheet C-004 (landscape plan, scale 1 inch = 40 feet).

[UPLOAD SCREENSHOT OF C-004 HERE]

CONFIRMED totals I already have locked:
- Total commercial landscaped area: 22,394 SF [CONFIRMED]
- Total townhome landscaped area: 36,852 SF [CONFIRMED/CALCULATED]

The plan shows hatched zone boundaries for four distinct areas:
  Zone 1: Hwy 91 gravel frontage strip (within commercial area)
  Zone 2: Commercial planter beds (within commercial area)
  Zone 3: Townhome center courtyard lawn
  Zone 4: Building-front planter strips (townhome area)

I do NOT need new totals. I only need to split each confirmed total into its zone types.

Please do the following:
  (a) Identify the boundary of each of the four zones from the hatch patterns on C-004
  (b) Measure the SF of each zone using the confirmed scale of 1" = 40'
  (c) Verify: Zone 1 + Zone 2 must sum to approximately 22,394 SF (±2%)
  (d) Verify: Zone 3 + Zone 4 must sum to approximately 36,852 SF (±2%)
  (e) If any boundary is ambiguous or the totals don't reconcile within 2%, flag it

Report format:
| Zone | Description | Measured SF | Confidence |
|------|-------------|-------------|------------|
| 1    | Hwy 91 gravel frontage | [SF] | [FLAG] |
| 2    | Commercial planter beds | [SF] | [FLAG] |
| 3    | Townhome courtyard lawn | [SF] | [FLAG] |
| 4    | Building-front strips | [SF] | [FLAG] |
| COMMERCIAL TOTAL (1+2) | | [SF] | should = 22,394 |
| TOWNHOME TOTAL (3+4) | | [SF] | should = 36,852 |
```

---

## TYPE 3 — WATER MAIN TRACE ON C-102

```
I am processing sheet C-102 (water/utility plan) for a townhome development.

[UPLOAD SCREENSHOT OF C-102 HERE]

CONFIRMED information I already have:
- Pipe sizes confirmed from keynotes: 8-inch main, 4-inch services
- 4-inch service count: 83 branches [CONFIRMED by unit count]
- Keynote 1 states: "each service not shown for clarity" — services are individually unlabeled
- Scale: confirm from C-102 title block before measuring

WHAT I NEED:

Part A — 8-inch Main:
  (a) Trace the 8-inch main polyline from start to end, following all bends
  (b) If the 8-inch main branches, measure each branch separately and report subtotals
  (c) Report total 8-inch main LF as [MEASURED]
  (d) Identify start point and end point (connection to existing main, meter vault, etc.)

Part B — 4-inch Services:
  (e) Since the 4-inch services are individually unlabeled per keynote 1, I cannot
      get confirmed lengths from the plan
  (f) From any services that ARE visible/scaled on the plan, estimate average service
      length (LF from main to meter)
  (g) Calculate: 83 services × estimated avg LF = estimated total 4-inch service LF
  (h) Flag this entire line item as [ESTIMATED] with the formula shown

IMPORTANT CEILING NOTE:
88% confidence is the maximum achievable on water mains without a pipe length schedule
from the engineer. Please note this in your response and flag what would be needed
to reach 95%+ (answer: engineer-provided pipe length schedule for the 4-inch services).

Report format:
| Item | Size | Quantity | Unit | Confidence | Notes |
|------|------|----------|------|------------|-------|
| Water Main | 8" | [LF] | LF | [MEASURED] | [segments] |
| Water Services | 4" | [LF] | LF | [ESTIMATED] | 83 × avg [LF] |
```

---

## TYPE 4 — MATCH LINE CHECK ON C-103 OR C-001

```
I am working with a civil plan set for a townhome development.

[UPLOAD SCREENSHOT OF C-103 OR C-001 HERE]

CONTEXT:
Sheet C-101 (road plan, scale 1"=20') shows the internal townhome road network.
At the top-left of C-101, there is a MATCH LINE where the internal road connects
to Wolf Pack Way (the external street connection to the north).

The entry road stub that crosses the match line is NOT fully dimensioned on C-101.
The missing dimension — the LF of this stub from the match line to Wolf Pack Way —
should be labeled on either C-103 (north section / grading plan) or C-001 (overall site plan).

The missing stub is estimated at 20-40 LF based on visual review of C-101.

WHAT I NEED:
  (a) Locate the Wolf Pack Way / townhome road connection on this sheet
  (b) Find any labeled dimension for the entry stub length at this connection
  (c) If a labeled dimension exists: report the value as [CONFIRMED]
  (d) If no label but the stub is scalable: measure it using this sheet's scale, report as [MEASURED]
  (e) If the stub cannot be found or measured on this sheet: report as [FLAG] — needs RFI

WHY THIS MATTERS:
This single dimension resolves TWO line items simultaneously:
  1. Townhome Paving — the stub SF = stub LF × road width (20 ft confirmed)
  2. Ribbon Curb — the stub LF adds directly to ribbon curb total
Both currently at 82% confidence. Both jump to 92% if this dimension is labeled.

Please confirm or correct the 20-40 LF estimate based on what you see on this sheet.
```

---

## COMBINED VERIFICATION PROMPT (Use after all 4 types are resolved)

```
I have completed all four resolution types for my civil quantity takeoff.
Please review my updated quantities and flag any remaining issues.

UPDATED QUANTITIES:

SIDEWALK (Type 1 resolved):
- Detail F Concrete Sidewalk: [SF from existing takeoff]
- Keynote 8 Thickened Edge Sidewalk: [NEW SF if applicable, or "same location — no new SF"]
- Confidence: [93% or updated value]

LANDSCAPE SPLIT (Type 2 resolved — C-004):
- Commercial: Hwy 91 Gravel Strip: [SF] | Planter Beds: [SF] | Total: 22,394 SF
- Townhome: Courtyard Lawn: [SF] | Building-Front Strips: [SF] | Total: 36,852 SF
- Commercial Gravel confidence: [93%] | Townhome Lawn confidence: [90%]

WATER MAINS (Type 3 resolved — C-102):
- 8-inch Main: [LF] [MEASURED]
- 4-inch Services: [LF] [ESTIMATED] — 83 services × [avg LF]
- Overall water confidence: [88% — ceiling without pipe schedule]

PAVING + CURB (Type 4 resolved — match line):
- Wolf Pack Way stub length: [LF] [CONFIRMED/MEASURED/FLAG]
- Townhome Paving total: [SF] at [confidence%]
- Ribbon Curb total: [LF] at [confidence%]

Please:
1. Confirm each updated confidence level is consistent with the evidence
2. Identify any remaining gaps that are still below 90% confidence
3. List any items still requiring RFI response before the bid is final
4. Summarize the overall takeoff readiness (ready to bid / needs RFI reply / needs more work)
```

---

## NOTES FOR CLAUDE

When processing any of these prompts:
- Always state the scale before measuring anything
- Always flag [CONFIRMED] / [MEASURED] / [ESTIMATED] on every line item
- The 88% ceiling on water mains is a known constraint — do not try to exceed it without a pipe schedule
- The total areas (22,394 SF commercial, 36,852 SF townhome) are locked — do not re-measure them
- Wolf Pack Way stub length resolves BOTH paving and curb — always update both when resolved
- Any item still [FLAG] after these 4 types must go to RFI before the bid is submitted
