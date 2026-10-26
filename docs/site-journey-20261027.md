# Approved site application journey — 2026-10-27

The owner approved the full animated preview (40 seconds) and requested publication
to the existing staging environment, with desktop/mobile adaptation and Hebrew RTL.
The entry point remains My Sites → Add site. No production deployment is in scope.

## Direction

Operate, with one introductory brand moment: the existing glass link/publication
artwork accompanies “זה הזמן להרוויח כסף מהאתר שלך!” and “בוא נמשיך”. Desktop pairs
the copy at right with artwork at left; mobile stacks the artwork above the copy.
Navy, white/ice, teal/blue actions and a four-part underline path match the preview.
Scoped local Rubik regular/bold replaces the narrow form lettering only.

Seven existing fields remain: site name, full URL, sample article URL, image,
price before VAT, delivery email and optional publication instructions. Questions
unfold in two chapters, with completed answers editable in place. A summary
includes a consolidated edit form, cancel-without-applying edits and final manager
submission. Existing-site updates start in the full edit form, then review.

## Behavior and ownership

`app/seller-site-form.tsx` owns draft, upload/retry and the wizard. Shared Input,
Textarea, Button, Radix Dialog/AlertDialog, `api`, `ctx.run` and Sonner remain the
canonical controls, mutation and feedback owners. `lib/site-application.ts` owns
the unchanged client field/validation contract; `lib/customer-sellers.ts` still
owns permissions, file ownership, pending approval, price and publication policy.
No upload or application request occurs during navigation or review. The final
request keeps the existing payload and endpoint. Busy locks prevent duplicate
submission and dismissal; retries reuse a successfully uploaded file. Unsent
details are guarded on close/Escape/backdrop and browser unload.

`app/site-journey-motion.ts` keeps the departing chapter inert while the next
chapter slides in over 420ms, with faster exit and clean cancellation. Question
bodies reveal over 280ms. Reduced motion uses immediate transitions. One bounded
Radix dialog owns vertical scrolling; visualViewport updates keep it within the
visible keyboard area. Desktop uses up to 1040px and two edit columns, mobile one.
URLs/emails retain LTR isolation inside RTL layout. Demo data/controls never ship.

## Verification and release boundary

Passed: typecheck, production build, scoped lint (0 errors; four form img warnings
and two pre-existing seller-workspace img warnings),
journey validation/handler tests, seller UI and 48 seller API requests, existing
cart/checkout/catalog handler checks. The real-component browser fixture covers
390px mobile, 1440px desktop, 320px short viewport, validation, file/request failure,
cached-upload retry, duplicate-submit lock, guarded close, edit/cancel, existing
site update payload, keyboard and reduced motion. APIs are isolated fixtures;
these are not authenticated live account or physical iOS Safari checks.

The global strict static audit reports 76 legacy/ownership findings, none in the
new journey/form/schema/motion files; no whole-application compliance is claimed.
The legacy blanket dialog type rules now exclude only this named journey with
a zero-specificity `:where` condition, preserving other dialogs' specificity.

Restore branch: `restore/before-site-journey-20261027` at
`a4162c8f12605a11c714b060a73e321d6e6623b0`. Source publication and deployment
remain pending. Any Railway source/config update stays within the existing staging
service/environment; runtime secrets and data stay put. No live release is claimed.


## Maintained design record

The scoped runtime values are mirrored in DESIGN.md frontmatter and the
`.impeccable/design.json` extension. The approved journey supersedes only the old
site-application three-frame/dark-fading-header guidance; other system records
remain authoritative. `.impeccable/surfaces/site-application-journey.md` records
responsive composition, unchanged asset/font provenance, Rubik OFL, ownership and
verification boundaries. UX-CONTRACT.md records draft/edit/discard/retry behavior.
Finish review disposition is ship, with no material issues. No PRODUCT.md was
found and no new business facts were invented.
