# Bulk order ("הזמנה מרוכזת") redesign: build handoff

Approved by the owner on 26.11.2026 ("מאושר"). This branch holds design files only: no application code was changed.
Read `spec.md` (Hebrew, owner-facing, the source of truth) before writing code. Talk to the owner in short, plain Hebrew.

## Files in this folder
- `spec.md`: the approved spec and the owner's decisions.
- `mockup.html`: the page. `?s=empty` is before upload: the explanation panel plus the "מתחילים כאן" action column, in the cart layout. `?s=review` is after upload: the rows as cart-style cards plus the "סיכום הקובץ" column. Check both at desktop width and at 390px.
- `excel-preview.html`: a picture of the order sheet as opened in Excel.
- `הזמנה מרוכזת - מגה לינקס (הדמיה).xlsx`: a real workbook built to the spec (openpyxl). Use it as the reference for layout, colours, validations and sheets. Site names and prices in it come from the Staging catalog, and the customers are fictional. The app must generate the real file per user.

## What to build (current code: `app/bulk-order-view.tsx`, `app/bulk-instructions.tsx`, `app/bulk-order-approved.css`, `lib/bulk-order.ts`, `lib/bulk-template.ts`, `lib/office.ts`)
1. **The page** follows `mockup.html`:
   - cart look (`cart-checkout-refresh.css`): stepper, hero with the cart art;
   - the explanation in four steps, with the owner's original text kept in full;
   - three content tiles, the tip line and the details disclosure;
   - an action column with the download button and a drop zone with a Hebrew "בחירת קובץ" button (today it is the native English "Choose File");
   - the review: filter tabs, rows that need fixing first with the exact reason at the top and their fields open, valid rows collapsed with a "פרטי הכתבה" bar, and a sticky "סיכום הקובץ" with the add-to-cart button (disabled while any row needs fixing, as today);
   - an "אולי התכוונתם?" suggestion for a mistyped site name.
2. **The template** (`lib/bulk-template.ts`) is generated per user. It has four sheets:
   - **הזמנה**: columns אתר★, איך התוכן יוכן, נושא, מספר מילים, מותג, מילת מפתח (עוגן), קישור, לקוח הסוכנות, הנחיות, and a hidden "סוג שורה". It has a title row, a hint row, an orange example banner and the example row, and list validations for site (from "אתרים"), content and customer (from "הלקוחות שלי"). Words must be a whole number from 100 to 5,000. The words cell turns red when "כתיבה מקצועית" is chosen and words is empty. The sheet is RTL with frozen headers.
   - **איך ממלאים**: the explanation.
   - **אתרים**: the active sites with the price the customer sees.
   - **הלקוחות שלי**: the user's agency customers. Leave it empty if they have none.
   - The file name is "הזמנה מרוכזת - מגה לינקס.xlsx".
3. **The example row must be impossible to miss** (owner, 26.11): an orange full-width banner above it, and orange cells with a border and "דוגמה:" in each cell. Both rows are excluded by the hidden marker column.
4. **Parsing** (`lib/bulk-order.ts`):
   - read the new columns and skip the title, hint, banner and example rows;
   - keep old files working (the "מילים לכתיבה בתשלום" column means professional writing) and keep CSV working;
   - "כתיבה מקצועית" needs 100 to 5,000 words;
   - "כתיבה עם AI" needs at least one of topic, keyword or link (topic is not required).
5. **AI after payment**:
   - store the chosen content method on the cart item and the article;
   - once the order is paid (credit card at once; bank transfer when the admin approves), queue the AI articles;
   - generate a few per minute from the existing per-minute maintenance tick, reusing the generation in `app/api/[...path]/route.ts` (the `ai_generation` jobs);
   - the draft waits for the customer to review and send. Do not auto-send it;
   - send one email per order saying the drafts are ready;
   - on failure, show the existing retry in the article;
   - hide the option when AI is not configured.

## Rules
- Work on a new branch from this one, one screen at a time, and commit small steps. No N+1 queries (see CLAUDE.md).
- Test only locally with fictional data:
  - template download;
  - re-upload of a filled file, an old-format file and a CSV;
  - every error message;
  - phone and desktop screenshots.
- Push and Staging deploy only after the owner's explicit approval. Never touch production and never merge into main.
