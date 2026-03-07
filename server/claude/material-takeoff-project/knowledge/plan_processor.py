"""
AI Construction Plan Measurement Processor
==========================================
Mimics Bluebeam Revu's takeoff workflow using AI vision.
Feeds plan images to an AI model and extracts structured quantity takeoffs.

Requirements:
    pip install anthropic pillow pandas openpyxl

Usage:
    python plan_processor.py --image site_plan.jpg --scale "1in=20ft" --sheet "C-101"
    python plan_processor.py --image floor_plan.png --type architectural
    python plan_processor.py --batch ./plan_images/ --output takeoff.xlsx
"""

import anthropic
import base64
import json
import argparse
import sys
import os
from pathlib import Path
from datetime import datetime

try:
    import pandas as pd
    PANDAS_AVAILABLE = True
except ImportError:
    PANDAS_AVAILABLE = False

try:
    from PIL import Image
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False


# ── Configuration ─────────────────────────────────────────────────────────────

MODEL = "claude-opus-4-5"          # Use the most capable model for plan reading
MAX_TOKENS = 4096

PLAN_TYPES = ["civil", "architectural", "structural", "mep", "landscape", "industrial", "auto"]
OUTPUT_FORMATS = ["json", "csv", "excel", "text"]


# ── Master AI System Prompt ───────────────────────────────────────────────────

SYSTEM_PROMPT = """You are an expert construction quantity takeoff specialist with 20+ years of experience reading and measuring all types of construction plan sets. You process plan images and extract precise measurements, counts, areas, and volumes — exactly as a professional would in Bluebeam Revu.

CORE RULES:
1. Never guess a dimension that is clearly labeled. Always read labeled values first.
2. Always state which location on the plan a measurement came from.
3. Flag every calculated or estimated value with [CALCULATED] or [ESTIMATED].
4. Flag missing, illegible, or contradictory information with [FLAG].
5. Always report units explicitly (LF, SF, CY, EA, etc.).
6. If no scale is provided and none is visible, state [NO SCALE] and do not measure.

ALWAYS respond with valid JSON only. No preamble. No markdown fences. Pure JSON.

Response schema:
{
  "sheet_info": {
    "sheet_number": "string or null",
    "sheet_title": "string or null", 
    "scale": "string or null",
    "scale_confirmed": true/false,
    "discipline": "civil|architectural|structural|mep|landscape|industrial|unknown",
    "north_arrow": "string or null"
  },
  "quantities": [
    {
      "category": "string (e.g. Sewer Pipe, Asphalt Paving, Doors)",
      "item": "string (specific item description)",
      "size_type": "string (e.g. 8-inch PVC, Type B, 3x7 HM)",
      "location": "string (where on plan)",
      "quantity": number,
      "unit": "string (LF, SF, CY, EA, etc.)",
      "confidence": "CONFIRMED|MEASURED|CALCULATED|ESTIMATED|FLAG",
      "notes": "string or null"
    }
  ],
  "flags": [
    {
      "type": "MISSING_SCALE|ILLEGIBLE|CONTRADICTION|MISSING_SHEET|PARTIAL_DIMENSION|OTHER",
      "description": "string",
      "location": "string",
      "action_required": "string"
    }
  ],
  "summary": {
    "total_items_found": number,
    "overall_confidence": "string (e.g. High 90-95%, Medium 75-89%, Low below 75%)",
    "notes": "string"
  }
}"""


# ── Measurement User Prompts by Plan Type ─────────────────────────────────────

PLAN_TYPE_PROMPTS = {
    "civil": """Process this civil/site plan and extract ALL of the following:

REQUIRED EXTRACTIONS:
1. UTILITY PIPES: All pipe runs. For each: material, diameter, length (LF), start/end point.
   - Separate sewer, water, storm drain, gas, conduit into different line items.
   - If pipe size changes mid-run, split into separate line items per size.
2. STRUCTURES: All manholes, inlets, cleanouts, valves, hydrants, meters. Count by type.
3. PAVING: All paved areas. Measure SF by type (asphalt, concrete, gravel, etc.).
4. CURB & GUTTER: Total LF. Separate ribbon curb, rolled curb, vertical curb if present.
5. SIDEWALK: Total SF.
6. ROADS: Centerline length (LF) and width (FT) per road segment.
7. GRADING: All labeled spot elevations (existing and finished). Note cut/fill zones if marked.
8. SITE AREA: Total site area if boundary is shown.
9. RETAINING WALLS: LF and height if shown.

Confirm the scale from the title block before measuring. State it explicitly.""",

    "architectural": """Process this architectural plan and extract ALL of the following:

REQUIRED EXTRACTIONS:
1. ROOM DIMENSIONS: Every room's length and width. Calculate area (SF). Label each room by name.
2. TOTAL FLOOR AREA: Gross SF of the entire floor plan.
3. WALLS - EXTERIOR: Total LF of exterior walls. Note wall type/assembly if shown in legend.
4. WALLS - INTERIOR: Total LF of all interior partitions. Note wall types.
5. DOORS: Count by type. Cross-reference with door schedule if shown. Note size (W x H).
6. WINDOWS: Count by type. Cross-reference with window schedule if shown. Note size.
7. CEILING HEIGHTS: Per room if shown. Note any vaulted, raised, or dropped ceilings.
8. STAIRS: Width, number of risers, landing dimensions.
9. BUILT-INS: Cabinets, counters, islands — measure LF and SF.
10. STRUCTURAL OPENINGS: Beam pockets, column locations if shown.

Confirm the scale from the title block before measuring. State it explicitly.""",

    "structural": """Process this structural plan and extract ALL of the following:

REQUIRED EXTRACTIONS:
1. COLUMN GRID: All grid line labels (A, B, C... / 1, 2, 3...) and spacing dimensions.
2. COLUMNS: Count by size. Note size from schedule or callout (e.g., W8x31, 12x12 HSS).
3. BEAMS/GIRDERS: Measure LF by size. Note from schedule or callout.
4. CONCRETE SLABS: Area (SF) and thickness (IN) per zone. Volume (CY) if calculable.
5. FOOTINGS: Count individual footings by size. Measure continuous footings in LF.
6. WALLS: Concrete or CMU walls — measure LF and height (FT). Calculate SF of wall face.
7. OPENINGS: All structural openings, beam pockets, anchor bolt patterns.
8. REBAR: Note any rebar schedule or general rebar notes (#3, #4, #5, etc.).

Confirm the scale from the title block before measuring. State it explicitly.""",

    "mep": """Process this MEP (Mechanical/Electrical/Plumbing) plan and extract ALL of the following:

FOR MECHANICAL (HVAC):
1. DUCTWORK: All duct runs. Measure LF by size (width x height or diameter). Separate supply, return, exhaust.
2. EQUIPMENT: All HVAC units, AHUs, RTUs, FCUs. Count by type. Note tonnage/CFM if labeled.
3. DIFFUSERS/GRILLES: Count by type (supply diffuser, return grille, exhaust grille).

FOR PLUMBING:
1. PIPE RUNS: All pipe runs. Measure LF by size and material. Separate: cold water, hot water, waste, vent, gas.
2. FIXTURES: Count all fixtures by type (WC, LAV, shower, tub, sink, FD, DF, etc.).
3. EQUIPMENT: Water heaters, pumps, backflow preventers. Count by type.

FOR ELECTRICAL:
1. CONDUIT: Measure LF by size and type (EMT, RGS, PVC). Separate power from low-voltage.
2. PANELS: Count by type. Note amperage if labeled.
3. DEVICES: Count receptacles, switches, data ports, fire alarm devices by type.
4. LIGHTING: Count fixtures by type. Cross-reference with fixture schedule.

Confirm the scale before measuring. State discipline clearly.""",

    "landscape": """Process this landscape plan and extract ALL of the following:

REQUIRED EXTRACTIONS:
1. LAWN/SOD AREAS: Measure SF by zone. Note grass species if labeled.
2. GROUNDCOVER/SHRUB BEDS: Measure SF by zone. Note species if labeled.
3. MULCH/GRAVEL AREAS: Measure SF by zone. Calculate volume (CY) using 3-inch depth as default if not specified.
4. HARDSCAPE: All paved areas — SF by type (concrete, pavers, decomposed granite, flagstone).
5. TREES: Count by species and size (caliper/height from plant schedule). Note planted vs. preserved.
6. SHRUBS/PERENNIALS: Count by species from plant schedule.
7. IRRIGATION ZONES: Count zones. Note zone type (drip, spray, rotor) if labeled.
8. SITE FURNISHINGS: Count benches, bollards, bike racks, trash receptacles, signage.
9. FENCING: Measure LF by type. Count gates.
10. TOTAL LANDSCAPED AREA: Gross SF of all planted/landscaped zones combined.

Confirm scale before measuring.""",

    "industrial": """Process this industrial/warehouse plan and extract ALL of the following:

REQUIRED EXTRACTIONS:
1. BUILDING FOOTPRINT: Overall length x width (FT). Gross area (SF).
2. COLUMN GRID: All grid line labels and bay spacing dimensions.
3. CLEAR HEIGHT: Note from plan, section, or general notes. Critical dimension.
4. DOCK DOORS: Count. Note size (width x height). Note if leveler pits are shown.
5. DRIVE-IN DOORS: Count. Note size.
6. OFFICE AREA: Measure SF. Note if mezzanine.
7. MEZZANINE: Measure SF. Note elevation.
8. FLOOR SLAB: Area (SF) and thickness. Note any special floor specs or saw-cut joints.
9. ROOF DRAINS: Count. Note primary vs. overflow.
10. TRUCK COURT DEPTH: Note from plan (standard 130 ft for 53-ft trailers).
11. FIRE SUPPRESSION: Note ordinary vs. extra hazard classification if shown.

Confirm scale before measuring.""",

    "auto": """Process this construction plan and extract ALL measurable quantities. 

First, identify the plan type from the title block, sheet content, and visual cues.
Then apply the full extraction checklist appropriate for that plan type.

Always extract at minimum:
1. All linear items (pipes, walls, roads, conduit) — measure LF by type/size
2. All area items (paving, floors, roofing, landscaping) — measure SF by type
3. All counted items (fixtures, doors, manholes, trees) — count by type
4. All volume items (concrete, earthwork, fill) — calculate CY
5. All labeled elevations and heights

Confirm scale, then extract every measurable item visible on the plan."""
}


# ── Core Functions ────────────────────────────────────────────────────────────

def encode_image(image_path: str) -> tuple[str, str]:
    """Encode image to base64 and detect media type."""
    path = Path(image_path)
    ext = path.suffix.lower()
    
    media_type_map = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".gif": "image/gif",
        ".webp": "image/webp"
    }
    
    media_type = media_type_map.get(ext, "image/jpeg")
    
    with open(image_path, "rb") as f:
        image_data = base64.standard_b64encode(f.read()).decode("utf-8")
    
    return image_data, media_type


def build_user_message(image_path: str, plan_type: str, 
                       scale: str = None, sheet_name: str = None) -> list:
    """Build the user message with image and instructions."""
    image_data, media_type = encode_image(image_path)
    
    # Build context prefix
    context_parts = []
    if sheet_name:
        context_parts.append(f"Sheet: {sheet_name}")
    if scale:
        context_parts.append(f"Drawing Scale: {scale}")
    
    context = ""
    if context_parts:
        context = "USER-PROVIDED CONTEXT:\n" + "\n".join(context_parts) + "\n\n"
    
    # Get the appropriate prompt
    prompt_text = PLAN_TYPE_PROMPTS.get(plan_type, PLAN_TYPE_PROMPTS["auto"])
    full_prompt = context + prompt_text
    
    return [
        {
            "type": "image",
            "source": {
                "type": "base64",
                "media_type": media_type,
                "data": image_data,
            },
        },
        {
            "type": "text",
            "text": full_prompt
        }
    ]


def process_plan_image(image_path: str, plan_type: str = "auto",
                       scale: str = None, sheet_name: str = None,
                       client: anthropic.Anthropic = None) -> dict:
    """
    Process a single plan image and return structured quantities.
    
    Args:
        image_path: Path to the plan image file
        plan_type: Type of plan (civil/architectural/structural/mep/landscape/industrial/auto)
        scale: Drawing scale as string (e.g., "1in=20ft", "1/4in=1ft")
        sheet_name: Sheet identifier (e.g., "C-101")
        client: Anthropic client instance
    
    Returns:
        dict with keys: sheet_info, quantities, flags, summary
    """
    if client is None:
        client = anthropic.Anthropic()
    
    print(f"\n  Processing: {Path(image_path).name}")
    if sheet_name:
        print(f"  Sheet: {sheet_name}")
    if scale:
        print(f"  Scale: {scale}")
    print(f"  Plan type: {plan_type}")
    
    content = build_user_message(image_path, plan_type, scale, sheet_name)
    
    response = client.messages.create(
        model=MODEL,
        max_tokens=MAX_TOKENS,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": content}]
    )
    
    raw_text = response.content[0].text.strip()
    
    # Clean up any accidental markdown fences
    if raw_text.startswith("```"):
        raw_text = raw_text.split("```")[1]
        if raw_text.startswith("json"):
            raw_text = raw_text[4:]
        raw_text = raw_text.strip()
    
    try:
        result = json.loads(raw_text)
        result["_source_file"] = str(image_path)
        result["_processed_at"] = datetime.now().isoformat()
        return result
    except json.JSONDecodeError as e:
        print(f"  WARNING: Could not parse AI response as JSON: {e}")
        return {
            "sheet_info": {"sheet_number": sheet_name, "sheet_title": None,
                          "scale": scale, "scale_confirmed": False,
                          "discipline": plan_type},
            "quantities": [],
            "flags": [{"type": "OTHER", "description": f"JSON parse error: {e}",
                       "location": "AI response", "action_required": "Review raw output"}],
            "summary": {"total_items_found": 0, "overall_confidence": "Failed",
                       "notes": raw_text[:500]},
            "_source_file": str(image_path),
            "_processed_at": datetime.now().isoformat(),
            "_raw_response": raw_text
        }


def process_batch(image_dir: str, plan_type: str = "auto",
                  client: anthropic.Anthropic = None) -> list:
    """
    Process all images in a directory.
    
    Args:
        image_dir: Directory containing plan images
        plan_type: Plan type to apply to all images
        client: Anthropic client instance
    
    Returns:
        List of result dicts
    """
    if client is None:
        client = anthropic.Anthropic()
    
    image_extensions = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
    image_files = sorted([
        f for f in Path(image_dir).iterdir()
        if f.suffix.lower() in image_extensions
    ])
    
    if not image_files:
        print(f"No image files found in {image_dir}")
        return []
    
    print(f"\nFound {len(image_files)} plan image(s) to process:")
    for f in image_files:
        print(f"  - {f.name}")
    
    results = []
    for i, image_file in enumerate(image_files, 1):
        print(f"\n[{i}/{len(image_files)}] Processing {image_file.name}...")
        result = process_plan_image(
            str(image_file),
            plan_type=plan_type,
            sheet_name=image_file.stem,
            client=client
        )
        results.append(result)
        print(f"  Found {result.get('summary', {}).get('total_items_found', '?')} items")
    
    return results


# ── Output Formatters ─────────────────────────────────────────────────────────

def format_as_text(results: list) -> str:
    """Format results as a readable text report."""
    lines = []
    lines.append("=" * 70)
    lines.append("CONSTRUCTION PLAN QUANTITY TAKEOFF REPORT")
    lines.append(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    lines.append("=" * 70)
    
    all_quantities = []
    all_flags = []
    
    for result in results:
        sheet = result.get("sheet_info", {})
        lines.append(f"\nSHEET: {sheet.get('sheet_number', 'Unknown')} — "
                     f"{sheet.get('sheet_title', 'Unknown')}")
        lines.append(f"  Scale: {sheet.get('scale', 'Not confirmed')} | "
                     f"Discipline: {sheet.get('discipline', 'Unknown')}")
        lines.append(f"  Source: {Path(result.get('_source_file', '')).name}")
        lines.append("-" * 50)
        
        quantities = result.get("quantities", [])
        if quantities:
            lines.append(f"\n  QUANTITIES ({len(quantities)} items):")
            lines.append(f"  {'Category':<20} {'Item':<30} {'Size/Type':<20} "
                        f"{'Qty':>10} {'Unit':<6} {'Conf.':<12}")
            lines.append("  " + "-" * 100)
            for q in quantities:
                lines.append(
                    f"  {q.get('category',''):<20} "
                    f"{q.get('item',''):<30} "
                    f"{q.get('size_type',''):<20} "
                    f"{q.get('quantity', 0):>10.1f} "
                    f"{q.get('unit',''):<6} "
                    f"[{q.get('confidence','')}]"
                )
                all_quantities.append(q)
        
        flags = result.get("flags", [])
        if flags:
            lines.append(f"\n  FLAGS ({len(flags)}):")
            for flag in flags:
                lines.append(f"  !! [{flag.get('type')}] {flag.get('description')}")
                lines.append(f"     Action: {flag.get('action_required')}")
                all_flags.append(flag)
        
        summary = result.get("summary", {})
        if summary:
            lines.append(f"\n  Confidence: {summary.get('overall_confidence', 'N/A')}")
    
    # Master summary
    lines.append("\n" + "=" * 70)
    lines.append("CONSOLIDATED QUANTITY SUMMARY")
    lines.append("=" * 70)
    
    # Group by category
    from collections import defaultdict
    by_category = defaultdict(lambda: defaultdict(float))
    unit_map = {}
    
    for q in all_quantities:
        cat = q.get("category", "Other")
        item_key = f"{q.get('item', '')} — {q.get('size_type', '')}".strip(" —")
        by_category[cat][item_key] += float(q.get("quantity", 0))
        unit_map[item_key] = q.get("unit", "")
    
    for category, items in sorted(by_category.items()):
        lines.append(f"\n{category.upper()}")
        for item, total in sorted(items.items()):
            unit = unit_map.get(item, "")
            lines.append(f"  {item:<55} {total:>10.1f} {unit}")
    
    lines.append(f"\nTotal line items: {len(all_quantities)}")
    lines.append(f"Total flags requiring attention: {len(all_flags)}")
    
    return "\n".join(lines)


def format_as_dataframe(results: list):
    """Convert results to a pandas DataFrame."""
    if not PANDAS_AVAILABLE:
        raise ImportError("pandas is required. Run: pip install pandas")
    
    rows = []
    for result in results:
        sheet = result.get("sheet_info", {})
        for q in result.get("quantities", []):
            rows.append({
                "Sheet Number": sheet.get("sheet_number", ""),
                "Sheet Title": sheet.get("sheet_title", ""),
                "Scale": sheet.get("scale", ""),
                "Discipline": sheet.get("discipline", ""),
                "Category": q.get("category", ""),
                "Item": q.get("item", ""),
                "Size / Type": q.get("size_type", ""),
                "Location": q.get("location", ""),
                "Quantity": q.get("quantity", 0),
                "Unit": q.get("unit", ""),
                "Confidence": q.get("confidence", ""),
                "Notes": q.get("notes", ""),
                "Source File": Path(result.get("_source_file", "")).name,
            })
    
    return pd.DataFrame(rows)


def export_to_excel(results: list, output_path: str):
    """Export results to a formatted Excel workbook."""
    if not PANDAS_AVAILABLE:
        raise ImportError("pandas and openpyxl required. Run: pip install pandas openpyxl")
    
    df = format_as_dataframe(results)
    
    with pd.ExcelWriter(output_path, engine="openpyxl") as writer:
        # Sheet 1: Full detail
        df.to_excel(writer, sheet_name="Detailed Takeoff", index=False)
        
        # Sheet 2: Summary pivot by category
        if not df.empty:
            summary = df.groupby(
                ["Discipline", "Category", "Item", "Size / Type", "Unit"]
            )["Quantity"].sum().reset_index()
            summary.columns = ["Discipline", "Category", "Item",
                               "Size / Type", "Unit", "Total Quantity"]
            summary.to_excel(writer, sheet_name="Summary by Category", index=False)
        
        # Sheet 3: Flags
        flags_rows = []
        for result in results:
            sheet = result.get("sheet_info", {})
            for flag in result.get("flags", []):
                flags_rows.append({
                    "Sheet": sheet.get("sheet_number", ""),
                    "Flag Type": flag.get("type", ""),
                    "Description": flag.get("description", ""),
                    "Location": flag.get("location", ""),
                    "Action Required": flag.get("action_required", ""),
                })
        if flags_rows:
            flags_df = pd.DataFrame(flags_rows)
            flags_df.to_excel(writer, sheet_name="Flags & Issues", index=False)
        
        # Sheet 4: Confidence report
        conf_rows = []
        for result in results:
            sheet = result.get("sheet_info", {})
            summary = result.get("summary", {})
            conf_rows.append({
                "Sheet": sheet.get("sheet_number", ""),
                "Discipline": sheet.get("discipline", ""),
                "Items Found": summary.get("total_items_found", 0),
                "Overall Confidence": summary.get("overall_confidence", ""),
                "Notes": summary.get("notes", ""),
            })
        conf_df = pd.DataFrame(conf_rows)
        conf_df.to_excel(writer, sheet_name="Confidence Report", index=False)
    
    print(f"\nExcel takeoff exported to: {output_path}")


def export_to_csv(results: list, output_path: str):
    """Export results to CSV."""
    if not PANDAS_AVAILABLE:
        raise ImportError("pandas required. Run: pip install pandas")
    df = format_as_dataframe(results)
    df.to_csv(output_path, index=False)
    print(f"\nCSV takeoff exported to: {output_path}")


def save_json(results: list, output_path: str):
    """Save raw results as JSON."""
    with open(output_path, "w") as f:
        json.dump(results, f, indent=2)
    print(f"\nJSON results saved to: {output_path}")


# ── Interactive Session ────────────────────────────────────────────────────────

def interactive_session():
    """Run an interactive multi-turn session for plan processing."""
    client = anthropic.Anthropic()
    
    print("\n" + "=" * 60)
    print("AI PLAN MEASUREMENT PROCESSOR")
    print("Bluebeam-Style Quantity Takeoff Using AI Vision")
    print("=" * 60)
    print("\nCommands:")
    print("  process <image_path>     — Process a plan image")
    print("  batch <directory>        — Process all images in a folder")
    print("  export <format> <path>   — Export results (json/csv/excel/text)")
    print("  clear                    — Clear all results")
    print("  quit                     — Exit")
    print()
    
    all_results = []
    
    while True:
        try:
            user_input = input("\n> ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\nExiting.")
            break
        
        if not user_input:
            continue
        
        parts = user_input.split()
        command = parts[0].lower()
        
        if command == "quit" or command == "exit":
            break
        
        elif command == "clear":
            all_results = []
            print("Results cleared.")
        
        elif command == "process" and len(parts) >= 2:
            image_path = parts[1]
            plan_type = parts[2] if len(parts) > 2 else "auto"
            scale = parts[3] if len(parts) > 3 else None
            sheet = parts[4] if len(parts) > 4 else None
            
            if not os.path.exists(image_path):
                print(f"Error: File not found: {image_path}")
                continue
            
            result = process_plan_image(image_path, plan_type, scale, sheet, client)
            all_results.append(result)
            
            # Print quick summary
            summary = result.get("summary", {})
            flags = result.get("flags", [])
            print(f"\nResult: {summary.get('total_items_found', 0)} items found")
            print(f"Confidence: {summary.get('overall_confidence', 'N/A')}")
            if flags:
                print(f"Flags: {len(flags)} item(s) need attention")
            
            # Show quantities
            quantities = result.get("quantities", [])
            if quantities:
                print(f"\nTop quantities:")
                for q in quantities[:10]:
                    print(f"  {q.get('category')}: {q.get('item')} {q.get('size_type')} "
                          f"= {q.get('quantity')} {q.get('unit')} [{q.get('confidence')}]")
                if len(quantities) > 10:
                    print(f"  ... and {len(quantities)-10} more (export for full list)")
        
        elif command == "batch" and len(parts) >= 2:
            image_dir = parts[1]
            plan_type = parts[2] if len(parts) > 2 else "auto"
            
            if not os.path.isdir(image_dir):
                print(f"Error: Directory not found: {image_dir}")
                continue
            
            results = process_batch(image_dir, plan_type, client)
            all_results.extend(results)
            print(f"\nBatch complete. Processed {len(results)} sheets.")
            total_items = sum(r.get("summary", {}).get("total_items_found", 0) 
                            for r in results)
            print(f"Total items found: {total_items}")
        
        elif command == "export" and len(parts) >= 3:
            fmt = parts[1].lower()
            output_path = parts[2]
            
            if not all_results:
                print("No results to export. Process some plans first.")
                continue
            
            if fmt == "json":
                save_json(all_results, output_path)
            elif fmt == "csv":
                export_to_csv(all_results, output_path)
            elif fmt == "excel" or fmt == "xlsx":
                export_to_excel(all_results, output_path)
            elif fmt == "text" or fmt == "txt":
                report = format_as_text(all_results)
                with open(output_path, "w") as f:
                    f.write(report)
                print(f"\nText report saved to: {output_path}")
            else:
                print(f"Unknown format: {fmt}. Use: json, csv, excel, text")
        
        elif command == "help":
            print("\nprocess <image> [plan_type] [scale] [sheet_name]")
            print("  plan_type: auto, civil, architectural, structural, mep, landscape, industrial")
            print("  scale: e.g. '1in=20ft' or '1/4in=1ft'")
            print("  sheet_name: e.g. C-101\n")
            print("batch <directory> [plan_type]")
            print("  Processes all JPG/PNG images in the given folder\n")
            print("export <format> <output_path>")
            print("  format: json, csv, excel, text\n")
        
        else:
            print(f"Unknown command: {user_input}")
            print("Type 'help' for available commands.")


# ── Command Line Interface ─────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="AI Construction Plan Measurement Processor — Bluebeam-style takeoffs using AI vision",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Process a single plan image
  python plan_processor.py --image site_plan.jpg

  # Process with known scale and sheet name
  python plan_processor.py --image floor_plan.png --scale "1/4in=1ft" --sheet A-101 --type architectural

  # Process all images in a folder and export to Excel
  python plan_processor.py --batch ./plans/ --output takeoff.xlsx --format excel

  # Interactive session
  python plan_processor.py --interactive
        """
    )
    
    parser.add_argument("--image", help="Path to a single plan image")
    parser.add_argument("--batch", help="Directory of plan images to process")
    parser.add_argument("--type", default="auto", choices=PLAN_TYPES,
                       help="Plan type (default: auto-detect)")
    parser.add_argument("--scale", help="Drawing scale (e.g., '1in=20ft')")
    parser.add_argument("--sheet", help="Sheet name/number (e.g., C-101)")
    parser.add_argument("--output", help="Output file path")
    parser.add_argument("--format", default="text",
                       choices=OUTPUT_FORMATS, help="Output format (default: text)")
    parser.add_argument("--interactive", action="store_true",
                       help="Start interactive session")
    
    args = parser.parse_args()
    
    # Interactive mode
    if args.interactive or (not args.image and not args.batch):
        interactive_session()
        return
    
    # Single image or batch
    client = anthropic.Anthropic()
    results = []
    
    if args.image:
        if not os.path.exists(args.image):
            print(f"Error: File not found: {args.image}")
            sys.exit(1)
        result = process_plan_image(
            args.image, args.type, args.scale, args.sheet, client
        )
        results.append(result)
    
    elif args.batch:
        if not os.path.isdir(args.batch):
            print(f"Error: Directory not found: {args.batch}")
            sys.exit(1)
        results = process_batch(args.batch, args.type, client)
    
    if not results:
        print("No results to output.")
        return
    
    # Output
    output_path = args.output
    fmt = args.format
    
    if fmt == "json":
        if output_path:
            save_json(results, output_path)
        else:
            print(json.dumps(results, indent=2))
    
    elif fmt == "csv":
        if not output_path:
            output_path = f"takeoff_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        export_to_csv(results, output_path)
    
    elif fmt == "excel":
        if not output_path:
            output_path = f"takeoff_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
        export_to_excel(results, output_path)
    
    elif fmt == "text":
        report = format_as_text(results)
        if output_path:
            with open(output_path, "w") as f:
                f.write(report)
            print(f"Report saved to: {output_path}")
        else:
            print(report)


if __name__ == "__main__":
    main()
