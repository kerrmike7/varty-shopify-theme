# Store Finder — Metaobject Setup Guide

The `custom-store-finder` section works in two modes:
1. **Block mode (active now):** All 22 retailer blocks are pre-populated in the section preset. Use this immediately — no admin setup required.
2. **Metaobject mode (recommended long-term):** Create the `retailer` metaobject definition, import the CSV data, and the section will automatically switch to reading from metaobjects. This allows managing stockists from the Shopify admin without editing the theme.

---

## Step 1 — Create the Metaobject Definition

In Shopify admin: **Settings → Custom data → Metaobjects → Add definition**

- **Name:** Retailer
- **Handle (auto-set):** `retailer`

Add the following fields:

| Field name   | API handle    | Type            | Required | Notes                        |
|---|---|---|---|---|
| Name         | `name`        | Single-line text | Yes      | Store name                   |
| Address      | `address`     | Single-line text | Yes      | Street address               |
| City         | `city`        | Single-line text | Yes      | City                         |
| Region       | `region`      | Single-line text | Yes      | Province (e.g. QC)           |
| Postal code  | `postal_code` | Single-line text | Yes      | Canadian postal code         |
| URL          | `url`         | URL             | No       | Optional: directions/website |

Save the definition.

---

## Step 2 — Run the Import Script

From the `bloop-build/` directory, run:

```bash
python3 scripts/import-retailers.py
```

This reads `varty_retailers_stockist.csv` (must be placed in `bloop-build/`) and creates all 22 metaobject entries via the Shopify Admin API.

**Before running:** ensure `shopify store auth --store hbsj00-23.myshopify.com --scopes write_metaobjects` has been run.

---

## Step 3 — Verify

After import, visit the store finder page in the theme preview. The section will automatically detect the metaobject entries and switch from block mode to metaobject mode.

---

## Notes

- Do not delete the retailer blocks from the section yet — they act as a fallback if the metaobject definition is not found.
- To add a new stockist: go to **Content → Metaobjects → Retailer → Add entry**.
- To remove a stockist: delete its metaobject entry in admin (no theme code change needed).
