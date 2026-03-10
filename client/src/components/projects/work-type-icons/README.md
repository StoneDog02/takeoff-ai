# Work type icons

These icons are used for work types (Labor, Tile, Plumbing, Demolition, Framing, Concrete, Cabinets, Equipment) in the app.

## Using the Iconscout icons you picked

The URLs you provided are in **`svg-sources/README.md`**. To get those exact designs into the app:

1. **Download each icon**  
   Open each URL in `svg-sources/README.md` in your browser. On the Iconscout page, click **Download** (or **Free Download**) and choose **SVG**. Save the file with the exact name listed there (e.g. `labor.svg`, `tile.svg`, …) into the **`svg-sources/`** folder (same folder as that README).

2. **Run the update script**  
   From the **project root** (the `takeoff-ai` folder), run:
   ```bash
   node scripts/update-work-type-icons.js
   ```
   The script reads the SVG files in `svg-sources/` and updates the `*Icon.tsx` files in this directory so the app uses the real Iconscout artwork. It also sets `fill="currentColor"` so the icons follow your theme colors.

After that, the icons in the app will match the ones from the Iconscout URLs you gave.

## Manual fallback

If you prefer to do it by hand: open the downloaded `.svg` in a text editor, copy everything inside the `<svg>…</svg>` (the `viewBox` and all `<path>` / `<g>` etc.), and replace the placeholder content in the matching `*Icon.tsx` file. Keep the `<svg>` wrapper’s `width={size}`, `height={size}`, and `className={className}` so sizing and theming still work.
