# Drop your Iconscout SVGs here

Download each icon from Iconscout and save it in this folder with the exact filename below. Then run the update script to push them into the React components.

| Save as       | Download from |
|---------------|----------------|
| `labor.svg`       | https://iconscout.com/icon/labor-icon_1602072 |
| `tile.svg`        | https://iconscout.com/icon/tile-icon_7779137 |
| `plumbing.svg`    | https://iconscout.com/icon/plumbing-icon_1195647 |
| `demolition.svg`  | https://iconscout.com/icon/demolition-icon_13219176 |
| `framing.svg`     | https://iconscout.com/icon/framing-icon_11392924 |
| `concrete.svg`    | https://iconscout.com/icon/concrete-icon_2657213 |
| `cabinets.svg`    | https://iconscout.com/icon/cabinets-icon_5245161 |
| `equipment.svg`   | https://iconscout.com/icon/skid-steer-icon_8911191 |

**Steps:**

1. Open each URL above in your browser.
2. Click **Download** (or **Free Download** if it’s a free icon). Choose **SVG**.
3. Rename the file to match the “Save as” name and put it in this folder (`svg-sources/`).
4. From the **project root** run:
   ```bash
   node scripts/update-work-type-icons.js
   ```
   That script reads these SVGs and updates the `*Icon.tsx` files in the parent folder so the app uses the real Iconscout artwork.

If you don’t run the script, you can still paste the SVG path(s) by hand: open the downloaded `.svg` in a text editor, copy the contents of the `<svg>` (the `viewBox` and the inner `<path>` / `<g>` etc.), and replace the placeholder in the matching `*Icon.tsx` file.
