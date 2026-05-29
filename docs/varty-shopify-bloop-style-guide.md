# Varty Shopify / Bloop Page-Build Guide

This is the working Varty storefront guide for carrying the homepage look into the rest of the Shopify pages. The newest copy source is `/Users/michaelkerr/Downloads/Varty All Natural - Shopify Website Copy.docx.md`.

## Operating Rules

- Work in `/Users/michaelkerr/Documents/Second Brain/05_PROJECTS/varty/build/cursor Shopify/bloop-build`.
- Keep commits local unless Michael explicitly asks for a git push.
- Theme pushes must be surgical: `shopify theme push --store=hbsj00-23 --theme=186033373473 --only=<file> --nodelete --allow-live`.
- Pull back pushed files to `/private/tmp` and compare them after every Shopify push. Shopify may add a leading comment to JSON files, so compare JSON semantically after stripping that comment.
- Before editing global theme settings, pull live `config/settings_data.json`; otherwise local stale settings can overwrite admin/header changes.
- Run validation before any theme push: JSON parse for edited templates, `node scripts/validate-shopify-template.js <template>`, `git diff --check`, and `shopify theme check --fail-level error`.
- Current theme-check baseline is 29 errors / 326 warnings. A clean pass means no delta from that baseline.

## Bloop Gotchas

- `assets/varty-homepage-polish.css` is index-only. Do not expect it to style other pages.
- Bloop heading classes often win with strong selectors. Override `font-size`, `line-height`, and `text-transform` together, usually with `!important`, when matching Wix/Varty display type.
- Shopify schema text fields reject blank defaults. Use a non-empty default, or make the Liquid tolerate absent values.
- Every new `<img>` needs explicit `width` and `height` attributes for theme check.
- Product label classes are `.product-labels__*`, not `.icons-with-text__*`.
- The hero subtitle intentionally stores the translation key as wrapped richtext, e.g. `<p>t:varty.hero.subtext</p>`. The section unwraps and translates it.
- New reusable Varty sections should prefer `image_picker` for admin-editable images. Hardcoded `asset_url` images are acceptable for tightly directed Wix-match sections, but push the assets surgically with the template/section.

## Visual Language

- Core purple: `#5463B3` or local section variant `#5865ad`.
- Core cream: `#fcf2d3`.
- Soft green: `#bfe4d0`.
- Accent pink: `#FFD6E0` for the top global promo banner only.
- Lower homepage announcement/promo strip: `#C5C9E8`, with Varty purple text.
- Why Choose / cream bands should use cream backgrounds close to Wix, with cards either transparent or barely tinted. Avoid extra icon outlines when client notes ask for cleaner icons.

## Type Scale

- Hero H1: big uppercase Avenir-style display, about `clamp(72px, 6.2vw, 96px)` desktop, `clamp(52px, 15vw, 64px)` mobile, `line-height: 0.95`, `letter-spacing: 0`.
- Page/section editorial H1: large serif for Wix-style secondary pages, about `clamp(64px, 6vw, 110px)` when set in Georgia-style editorial panels, with generous line-height near `1.02`.
- Section H2: either uppercase Avenir display at `clamp(46px, 4vw, 76px)` for callout headings, or serif editorial at `clamp(42px, 3.2vw, 72px)` for story/mission copy.
- Feature-card H2: `clamp(42px, 4.6vw, 70px) !important`, `line-height: 0.98 !important`, `text-transform: none`.
- H3/card titles: use serif at roughly `clamp(36px, 3vw, 72px)` for large Wix-style values cards, or Avenir bold for dense product/FAQ cards.
- Body copy: `clamp(17px, 1.25vw, 20px)` for homepage feature panels; `clamp(20px, 1.45vw, 36px)` for large Wix story pages. Keep body line-height between `1.42` and `1.5`.
- Buttons: pill buttons, 2px border, Varty purple/cream pair, `font-weight: 800`, `line-height: 1`, and no negative letter spacing.

## Layout Patterns

- Match Wix section order visually, but use the new copy document as the only copy source.
- For two-column feature bands, confirm `image_position` by visual result. In `varty-home-feature`, `image_position: left` means image left and copy right; `right` means copy left and image right.
- Keep proof/certification bands constrained to the same max width when the design asks for alignment. Current homepage cert/proof width target is 1040px.
- Use actual product/lifestyle imagery whenever possible. The recent richer homepage assets are:
  - `varty-label-truth-main-rich.jpg`
  - `varty-label-truth-thumb-mug-rich.jpg`
  - `varty-label-truth-thumb-vanilla-rich.jpg`
  - `varty-home-step-inside-rich.jpg`
  - `varty-home-pantry-smarter-rich.jpg`
  - `varty-home-never-run-out-rich.jpg`
  - `varty-home-wholesale-rich.jpg`
  - `varty-home-stockists-rich.jpg`
- For mobile, stack content above media unless the Wix reference clearly expects the image first. Keep fixed-format media stable with `aspect-ratio`, `min-height`, and `object-fit: cover`.

## Page Order From Current Copy Doc

1. Home: `/organic-oat-beverage-canada`
2. About: `/about-varty-all-natural-oat-beverage`
3. Shop: `/shop-varty-oat-beverage`
4. Subscribe: `/subscribe-varty-oat-beverage`
5. FAQs: `/faq`
6. Press & Awards: `/press-awards`
7. Where to Find Varty: `/where-to-buy-varty`
8. Wholesale: `/wholesale-oat-beverage`
9. Recipes: `/oat-beverage-recipes`
10. Contact: `/contact`

## Known Implementation Blockers

- Shop page needs real bundle/product architecture, including Mix 6-pack per-bottle SKU selection and subscription eligibility rules.
- Subscribe page depends on the active subscription app/toggle behavior.
- Where to Find page depends on the Stockist/store-locator app and client-managed CSV/dashboard.
- Press & Awards needs final award assets, press links, media logos, and certification logo placement.
- Recipes should be built as a Shopify blog collection with SKU/category tags, then reused on product pages.
