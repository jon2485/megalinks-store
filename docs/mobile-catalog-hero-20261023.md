# Approved phone catalog hero

Scope: phone viewport <=700px only; approved desktop mockup is not implemented.
Keep original logo/header, Heebo, artwork and wave asset. Reserve the complete
first viewport for the hero, then show all existing catalog content in normal
document flow. Refine the existing CTA and add the approved small glass arrow.
Both use the same scroll handler and existing catalog destination, preserving
reduced-motion preferences and keyboard focus. No new API call or financial,
catalog-card, navigation, permission or administrative change.

Source base: 8ff49e1df4f1aed4f11bebd811f170d56096fe02, which includes the previously
prepared administrative release. This commit adds only the mobile hero change.
No Railway operations or deployment are requested or performed for this update.

Verification:

- TypeScript `--noEmit` and production build passed.
- Real component callback fixtures passed for both scroll controls, focus without
  an early jump, reduced motion, missing target, actual header measurements,
  scrolling/resize stability, desktop exclusion and observer/listener cleanup.
- Catalog search/clear, all 18 categories, filtering, sorting, export, favorites,
  bulk navigation and original order-dialog action fixtures passed.
- Actual Button/Radix SSR plus source and built CSS checks passed at 320–2560px,
  including mobile viewport reservation and desktop arrow exclusion.
- Existing catalog motion fixtures passed.
- Lint compared with the immutable base: no new findings (the same inherited
  two errors and 14 warnings). Scoped strict static audit likewise introduces no
  findings; its four reports on unchanged catalog controls match the base.
- Original catalog-experience.css and PublicationCard are byte-identical to the
  immutable base. New layout/style rules are mobile-only; existing desktop hero
  markup/text/classes are preserved except refs/accessibility and the hidden arrow.

Browser transport timed out before the preview could be opened. Pixel-exact
visual comparison and real iOS Safari scrolling remain unverified; source/SSR
layout checks are not a substitute for that final browser review.
