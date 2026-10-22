# Approved catalog glass, knowledge hub and SEO

Staging-only release, based on deployed commit `2c1f6faa037dc13001cb160438c19af9dfe36eee`.

## Approved presentation

- Silver-blue frosted DR/UR strip and category/Dofollow tags, using existing Heebo.
- Public notes replace the displayed delivery cell; real metrics and pricing stay unchanged.
- Notes action has its chevron to the left of the Hebrew label, a distinct open state,
  short disclosure animation, viewport-bounded shared Radix popover and focus restoration.
- Illustration-free knowledge hub with centered navy/cyan heading, search, category
  filters, photographic article cards and reading links. No demonstration articles are seeded.
- Metadata uses the current Railway URL, a 1200×630 branded sharing image, Open Graph,
  Twitter large cards and article-cover/fallback images. Sitemap origins are consistent.
- Existing staging gateway authentication and noindex headers remain in force.

The unapproved cart price redesign and flying-product animation are excluded. Administrative
work-center/orders mockups are separate proposals, with no administrative UI changes here.

## Verification

- Production build and TypeScript pass.
- SEO: 52 checks against the actual built Worker with isolated D1/R2 fixtures.
- Knowledge: 55 HTTP checks for publication, privacy, metadata and editor behavior.
- Catalog home actions, mobile layout and existing success-only cart feedback pass.
- Real Chromium: 1365, 390 and 320px; six screen/viewport captures. Notes click,
  keyboard Enter/Escape, both close buttons, focus restoration, RTL arrow, collision
  bounds, missing-note disabled state, original favorite/add actions, search/clear,
  category filtering, empty/error/retry and reduced motion pass.
- Visual review compares the actual components and production CSS with the approved
  references. The only correction batch softened hub waves and aligned its mobile
  featured-card footer; the confirmation browser pass passed.
- Existing scoped static-audit findings remain unchanged: four before/four after,
  zero new findings. They concern untouched catalog filters. ESLint retains existing
  anchor/hook diagnostics; no new rule/message finding after normalizing source locations.

Browser data is synthetic and local. No real order, payment, publication, supplier
dispatch or customer-data mutation is performed by the verification.
