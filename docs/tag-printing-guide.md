# GrowFast — 40×40 mm Washable Cloth Tag Printing Guide

> **Target Media**: 40 mm × 40 mm (1:1 square) washable cloth / resin-coated label stock attached to physical garments.  
> **Print Mechanism**: Browser Direct Print (`window.print()`) targeting a hardened print-only DOM container (`#printable-tags`).

---

## 1. Physical Stock & Dimensions

- **Tag Physical Size**: 40 mm width × 40 mm height (square).
- **Material**: Washable cloth tag / heat-seal cloth roll / resin-thermal label.
- **Attachment**: Physically pinned, stitched, or heat-sealed to individual garments.
- **Safe Area**: 35 mm × 35 mm internal boundary (with 2.5 mm top/bottom, 3.0 mm left/right padding).

---

## 2. Printer Hardware & Driver Configuration

> [!IMPORTANT]
> **No specific printer hardware model is hardcoded or assumed.**  
> Any thermal, direct thermal, or thermal-transfer label printer supporting 40×40 mm media stock can be used once correctly configured.  
> **Printer model must be configured for 40×40 mm stock.**

### Required Printer Driver Settings

When installing and setting up the printer on the operator workstation or POS terminal:

1. **Media / Paper Stock**:
   - Stock Type: Continuous roll, gap-separated, or die-cut label (matching physical roll).
   - Label Width: `40 mm` (or `1.57 in`).
   - Label Height: `40 mm` (or `1.57 in`).
   - Sensor Type: Gap / Black Mark / Continuous feed (per media specifications).
2. **Printer Scaling**:
   - Must be set to **100% (Actual Size)**.
   - **DISABLE** "Fit to page" / "Fit to printable area".
   - **DISABLE** "Shrink oversized pages".
   - **DISABLE** Automatic scale-to-fit options.
3. **Orientation**:
   - **Portrait** (`40 mm` width × `40 mm` height).
4. **Margins**:
   - Driver Margins: Set to **0 mm** (Hardware Edge) where supported.
   - Feed Offset: 0 mm (calibrate tear-off or cutter position using printer hardware calibration button).
5. **Print Speed & Darkness (DPI / Density)**:
   - For washable cloth / resin ribbon: Set darkness/heat level according to ribbon manufacturer recommendations (usually medium-high heat for resin ribbons on cloth).
   - Ensure print resolution matches the driver (typically 203 DPI or 300 DPI).

---

## 3. Browser Print Dialogue Configuration

When triggering print from Google Chrome, Microsoft Edge, or Firefox:

| Setting                 | Required Value                 | Notes                                        |
| :---------------------- | :----------------------------- | :------------------------------------------- |
| **Destination**         | Select configured Tag Printer  | Must point to the 40×40 mm label driver      |
| **Paper Size**          | `40mm x 40mm` / Custom 40×40mm | Defined in printer driver preferences        |
| **Pages**               | All                            | Tag engine generates 1 page per piece        |
| **Layout**              | Portrait                       | 1:1 square                                   |
| **Color**               | Monochrome / Black & White     | High-contrast thermal print                  |
| **Margins**             | **None**                       | GrowFast CSS declares `@page { margin: 0; }` |
| **Scale**               | **Default (100%)**             | Never select "Fit to printable area"         |
| **Headers & Footers**   | **Unchecked / Disabled**       | Prevents browser URLs/dates from printing    |
| **Background Graphics** | **Unchecked** (or Checked)     | Tag uses pure text & high-contrast CSS       |

---

## 4. Hardware Calibration & Physical Test Page

GrowFast provides a built-in **40×40 mm Calibration Test Page** directly accessible from the **Garment Tags** toolbar via the `Test Tag` button.

### How to Calibrate:

1. Open any order with or without garments.
2. In the **Garment Tags** card header, click **Test Tag**.
3. The **40 × 40 mm Tag Calibration Test** modal opens.
4. Click **Print Calibration Tag**.
5. Retrieve the printed test tag from the printer.
6. **Physical Measurement**:
   - Measure outer border with a metric ruler: Must measure exactly **40.0 mm × 40.0 mm**.
   - Check the **Center Crosshair**: Must be positioned at **20 mm** horizontal and **20 mm** vertical.
   - Verify alignment corner marks: Must align cleanly with label boundaries without clipping.
   - Verify text sharpness: Confirm `GF-CALIB-001 (1/1)` and safe-area guidelines are crisp and fully legible.
7. If the output is shifted, clipped, or too small:
   - **Too small / too large**: Disable browser scale or "Fit to page"; set scale to 100%.
   - **Shifted top/bottom**: Calibrate printer feed sensor (hold pause/feed on hardware or adjust Top-of-Form in driver).
   - **Extra blank label between pieces**: Verify `@page { margin: 0 }` and check that driver label height matches physical label gap pitch (40mm + gap).

---

## 5. Software Architecture & Guarantees

1. **Print DOM Isolation**:
   - The print DOM container (`#printable-tags`) is completely separate from the application screen UI.
   - When printing, `body *` has `visibility: hidden;`, while `#printable-tags` and its descendants have `visibility: visible;`.
   - Modals, navigation, sidebars, photos, and order detail cards are completely excluded from print output.
2. **Zero Image / Network Requests**:
   - Physical tag printing renders pure typography and CSS vector rules.
   - Zero `<img>` tags or photo assets are injected into the print DOM, ensuring fast spooling and instant preview even for 50+ pieces.
3. **Strict State Immutability**:
   - Printing (single, selected, all, or calibration test) **never** mutates database state, order status, financial balances, or physical garment identities.
   - Reprinting always reuses the stable, canonical `tagId` established in Phase T1.
4. **Weight-Based Laundry Batch Protection**:
   - Weight-based laundry items (e.g. 5.5 kg mixed wash) generate zero `PhysicalGarment` records and zero individual tags.
