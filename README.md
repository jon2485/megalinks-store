# MegaLinks — פוסטפלואו

מערכת עצמאית בעברית לניהול פרסום כתבות. כוללת קטלוג אמיתי של 1,186 אתרים שנלקח מהקטלוג הציבורי של https://ai.buypost.co.il/ ב־4 באוקטובר 2026. הנתונים אינם מהווים הסכמי פרסום, חיבור לספקי BuyPost או התחייבות לזמינות ולמחיר אצלם.

## עבודה במערכת

1. הקטלוג הציבורי מוצג ללא התחברות; פעולות חשבון והזמנות דורשות התחברות. חשבון הבעלים מוגדר באמצעות `POSTFLOW_OWNER_EMAIL` באירוח, ומנהלים נוספים מוגדרים באמצעות `POSTFLOW_ADMIN_EMAILS`; המבקר הראשון לעולם אינו מקבל הרשאת מנהל באופן אוטומטי. אין חשבון הדגמה או סיסמה משותפת.
2. בוחרים אתר, ממלאים נושא, קהל, מותג, מילות מפתח, קישורי עוגן, קבצים ותאריך פרסום.
3. מוסיפים לסל ומאשרים את הסכום המחושב בצד השרת. משלמים מתוך יתרה או יוצרים הזמנה לאימות תשלום חיצוני.
   אתרי הקטלוג הציבורי ניתנים לתכנון ולהצעת מחיר, אך יצירת הזמנה חסומה עד שמנהל מאמת את הסכם הפרסום והמחיר של כל אתר ומסמן אותו כמאומת.
4. מנהל מאמת תקבול לפי אסמכתה. הלקוח או המנהל עורכים את הכתבה, מייבאים Word/טקסט, מוסיפים תמונה ושומרים גרסאות.
5. כתיבה בעזרת AI דורשת מפתח מוגדר. התוצאה היא טיוטה לבדיקה, ואינה מתפרסמת בעצמה.
6. אחרי אישור לקוח, מנהל שולח לספק באמצעות קישור מוגבל בתוקף, או לחיבור WordPress שהוגדר ואומת לאותו דומיין.
7. שומרים קישור פרסום וההזמנה מושלמת כאשר כל הכתבות פורסמו.

מעבר בין סביבת לקוח לניהול זמין למנהלים בלבד. הרשאות נבדקות בכל בקשת שרת. ניהול אנשי קשר של סוכנות נעשה במסך הלקוחות; חשבונות מחוברים ותפקידיהם מנוהלים במסך המשתמשים. שיתוף או שינוי קהל האתר מנוהלים בנפרד מהתפקידים באפליקציה.

## מסכים ויכולות

- קטלוג מלא, סינון, דירוגים, השוואת עד ארבעה אתרים, מועדפים וייצוא CSV.
- סל, חישוב מחירים והנחות, מע״מ ניתן להגדרה, קופונים אישיים ומגבלת שימושים.
- הזמנות, תקבולים, יתרות, החזרים ותיעוד לפי אסמכתה; מניעת חיוב כפול ויתרה שלילית.
- כתבות, גרסאות, אישורים, בקשות תיקונים, קישורי עוגן, SEO, תזמון מבוקש, תמונות ומסמכים.
- ייבוא DOCX, טקסט ו־HTML. PDF נשמר כקובץ מצורף ואינו עובר OCR.
- ייצוא DOCX; ייבוא וייצוא XLSX/CSV להזמנות מרוכזות. הייבוא מטפל בגיליון הראשון ובנתוני תאים, ולא בפקודות מאקרו או בחישוב נוסחאות.
- קבצים פרטיים, לקוחות סוכנות, אסטרטגיות תוכן, ספקים, חבילות, פניות ותשובות שירות.
- הגדרות חיבורים, הנחיות כתיבה, דוחות, יומן פעילות ותור אירועים לשליחה לספקי הודעות.
- API מוגבל לחשבון, מפתחות מוצגים פעם אחת, ושמירת סודות מוצפנת באמצעות AES-GCM.

## חיבורים חיצוניים

החיבורים כבויים עד להגדרת חשבונות והרשאות משלכם. אין מפתחות של BuyPost בקוד.

- AI: OpenAI, Groq או xAI באמצעות Chat Completions. ספק ומזהה מודל מוגדרים בניהול.
- WordPress: כתובת HTTPS, משתמש וסיסמת אפליקציה. יש לשייך את החיבור לאתר באותו דומיין ולאשר הסכם פרסום. ברירת המחדל היא טיוטה, עם אפשרות מפורשת לפרסום חי לאחר אישור.
- תמונות: מפתח Pexels, חיפוש ובחירה במאגר, עם קרדיט לצלם. ניתן גם להעלות תמונות פרטיות ללא שירות חיצוני.
- דוא״ל ו־WhatsApp: Webhook עם Bearer token. מנהל שולח אירועים מתור החיבורים. אין שליחה אוטומטית לספק לא מוגדר.
- סליקה: Webhook מותאם ליצירת קישור תשלום; אימות תשלום חתום או אימות ידני של מנהל. אין סליקה אמיתית ללא ספק מחובר.

### חוזה Webhook לסליקה

בקשת POST כוללת `event: create_payment`, `order_id`, `order_number`, `amount_cents`, `currency: ILS`, `customer`, `callback_url`. הבקשה נשלחת עם `Authorization: Bearer <secret>` ו־`Idempotency-Key` ייחודי להזמנה. הספק מחזיר JSON עם `payment_url` ב־HTTPS.

הספק מאשר תשלום ב־POST אל `/api/payment-callback`, עם גוף JSON הכולל `order_id`, `amount_cents`, `currency: ILS`, `status: paid`, `event_id`. הכותרת `X-Postflow-Signature` היא HMAC-SHA256 של גוף הבקשה המדויק עם אותו secret, בקידוד hex. סכום מדויק, חתימה ומזהה אירוע נבדקים לפני שינוי הסטטוס. כיוון שהאתר פרטי, ספק שירות צריך גם הרשאת שירות תקפה של האירוח כדי להגיע ל־callback. אין להסתמך על חזרה מהדפדפן כהוכחת תשלום.

### API

מפתח אישי נדרש בכותרת `Authorization: Bearer pf_...`. באתר פרטי נדרשת בנוסף הרשאת שירות האירוח. קיימים `/api/v1/pricelist`, `/api/v1/cart`, `/api/v1/quote`, `/api/v1/checkout`, `/api/v1/orders`, `/api/v1/articles`. `expected_total` באגורות חייב להתאים להצעת המחיר; `idempotency` מונע הזמנות חוזרות. מפתח אישי אינו מאפשר ניהול מערכת.

## נתונים ותשתית

נתונים נשמרים ב־D1 וקבצים ב־R2; דפדפן אינו מקור האמת לנתוני עסק. סכומים נשמרים באגורות. עסקאות של יתרה והזמנה מבוצעות ב־D1 batch אטומי, עם אילוצי CHECK למניעת יתרה שלילית ומעבר מגבלת קופון. מיגרציות יוצרות סכימה בלבד; הקטלוג מאותחל באופן חוזר ובטוח מהצילום הציבורי שבקוד.

`SETTINGS_ENCRYPTION_KEY` הוא סוד של האירוח, מפתח AES של 32 בתים ב־base64. אין לשנות אותו בלי להמיר את הסודות הקיימים. מפתחות שירות נשמרים מוצפנים במסד ולעולם אינם מוחזרים לדפדפן.

`POSTFLOW_OWNER_EMAIL` חייב להיות כתובת הדוא״ל המאומתת של בעל האתר ב־Sites. מנהלים נוספים מוגדרים ב־`POSTFLOW_ADMIN_EMAILS` כרשימת כתובות מופרדות בפסיקים. זיהוי משתמש דורש גם מזהה משתמש וגם דוא״ל בכותרות שהאירוח מעביר; דוא״ל לבדו אינו מספיק. סביבת הייצור מוגבלת לבעלים בשלב זה. כדי לאפשר לקוחות וספקים, יש לשנות את מדיניות הגישה של האתר במפורש או להוסיף נמענים מורשים, ולבדוק את התהליכים בחשבונות שלהם.

## בדיקות

- `node node_modules/typescript/bin/tsc --noEmit`
- בנייה דרך תהליך Sites.
- `node tests/integration.mjs` מול Worker בנוי, D1 ו־R2 מבודדים בזיכרון; נתוני הבדיקה אינם מועלים לייצור.
- `node --experimental-strip-types tests/office.mjs`

הבדיקות מכסות הרשאות, כל 1,186 האתרים, יחידות מטבע, קופונים, הצעת מחיר, הזמנות חוזרות, שמירה מקבילית של גרסאות, אישורי לקוח, קישורי ספק חד פעמיים, טעינה וחיוב יתרה, החזר שאינו מוכפל, ניסיונות חיוב בו זמניים, קבצים פרטיים, פניות שירות, מפתחות API, סודות מוצפנים ו־callback חתום. ביצועי שירותי סליקה, AI, WordPress והודעות אמיתיים דורשים בדיקות מול החשבונות שיוגדרו. בדיקה חזותית בדפדפן לא התאפשרה בסביבת ההקמה.

## גבולות תפעול

תאריך פרסום הוא מועד מבוקש, אינו מבטיח ביצוע אצל מפרסם ואינו מפעיל משימה אוטומטית. יצירת תוכן ושליחה לחיבורים מתבצעות בפעולה מפורשת במערכת. אישור הזמנה אינו חשבונית מס. שינוי מחיר מקור או זמינות דורש אימות מול הספק. ניהול הפעלה ציבורית, סליקה, הסכמי מפרסמים וחיבורי שירות צריך להסתיים לפני מכירה ללקוחות אמיתיים.


## Commerce updates
- Supplier records own multiple catalog websites via `supplier_id`, with private `cost_cents` and per-site retail prices. Costs and supplier identifiers are excluded from public catalog and customer article details.
- Site promotions use `sale_price_cents`, optional `sale_title` and `sale_ends`. Catalog, cart, API price list, and checkout share effective price calculation; expiry restores retail price. Coupons apply after site sale pricing.
- Unverified catalog sites accept invoice requests in `awaiting_approval`, without charging credits. Administrators verify all sites, approve the existing quoted amount, and then verify payment. Payment callbacks and payment links cannot charge unapproved requests.
- Admin orders includes a customer catalog link and a customer-flow entry point. For an example, choose a site, enter a topic, add to cart, enter a phone, accept the summary, and submit. View the same request in admin orders; cancel when finished testing.


## Editorial purchasing and fulfillment
- Catalog actions add directly to the persistent cart. Optional editorial service defaults to 400 words at 15 agorot per word per article. Server totals include quantities, promotions, coupons and VAT.
- Checkout UI remains in explicitly marked demo mode. Demo card/bank/wallet/monthly paths do not create real paid revenue. Demo monthly balances and statements are separate from real credit debt.
- Rich HTML is sanitized with Cloudflare HTMLRewriter. Submission checks title, text, image credits and all article hyperlinks (up to 10). Redirect targets are revalidated; private/unsafe URLs and inaccessible links block submission.
- Only administrators approve. Approval creates one supplier portal task and one email job with DOCX plus embedded images/credits and a 30-day hashed one-time reporting token. Demo orders never send external email or publish externally. Actual reporting must be reachable and match the purchased site's domain.
- Supplier accounts require administrator-assigned supplier role plus the exact email stored in their supplier record. Finance pages show only that supplier's snapshotted publication costs, grouped by publication month; demo totals are separate.
- Configure AI and email under admin connections. Email webhook accepts `{event:send_email,idempotency_key,to,subject,text,button:{label,url},attachments:[{filename,content_type,content_base64}]}` and must honor Idempotency-Key. A successful job means accepted by the email adapter, not guaranteed inbox delivery. Missing connections leave visible blocked email jobs, which an admin can retry.

## Monthly billing automation
The site exports authenticated MCP tools `monthly_billing_summary` (read-only) and `close_previous_billing_month` (administrator-only). The latter closes the previous completed month in Europe/Bucharest by default, creates idempotent per-customer statements, and invokes the configured email adapter; demo statements do not send email. No rebuild is needed.
Before scheduling: connect the site's provisioned personal plugin, call `monthly_billing_summary` through that connection to verify administrator identity, then call `close_previous_billing_month` and read the summaries. Once verified, schedule the linked Sites task for 00:15 Europe/Bucharest on day 1 of each month. Each run calls the close tool without arguments and reports blocked mail deliveries. Do not embed credentials in task prompts. The schedule is not active until the connected writer has been verified.
A separately configured external scheduler may use POST /api/maintenance/month-close with POSTFLOW_AUTOMATION_KEY and a YYYY-MM body; that secret is not provisioned by default.

## עריכת קטלוג מרוכזת
מנהל נכנס ל״ניהול״ → ״ניהול אתרים — טבלה״ (`/admin-websites`). הטבלה מציגה 25 שדות, בהם מחירים בש״ח לפני מע״מ, מחיר עלות פרטי, ספק, מבצעים, הערות, לוגו וסטטוס פעילות.
- עריכה ישירות בתאים; Tab בין תאים ו-Enter לתא בשורה הבאה.
- להוספה מרוכזת: לחצו ״הוספת שורה״ והדביקו בתא הראשון טווח מאקסל, ללא שורת כותרות ובהתאם לסדר העמודות. הדבקה בשורה חדשה מוסיפה שורות חדשות ואינה דורסת אתרים קיימים. ההדבקה מוגבלת ל-1,000 שורות לפעולה.
- בחרו שורות או את כל תוצאות הסינון, והפעילו/הסתירו אותן או החילו ערך אחיד על עמודה. רשימות מופרדות בפסיקים; שדות כן/לא מקבלים ״כן״/״לא״.
- ״שמירת שינויים״ מעדכנת את מסד הנתונים ואת הקטלוג. השמירה נעשית בקבוצות של עד 100 שורות, עם אימות לפני כל קבוצה ועסקת D1 אטומית. עדכון מקביל מזוהה לפי updated ואינו נדרס. אם קבוצה מאוחרת נכשלת, הקבוצות הקודמות נשארות שמורות והשורות שנותרו נשארות בטבלה.
- הסרה היא הסתרה (active=false), לא מחיקה: הזמנות, מאמרים והתחשבנות קודמים נשמרים.
- ייצוא XLSX זמין לכל תוצאות הסינון. אין צורך בקובץ חיצוני לעבודה היומיומית.
- הרשאות מנהל נבדקות גם בצד השרת. אין גישה לטבלה או לכתיבה הקבוצתית ללקוח.

## מייל ספק ומלאי לכל אתר
בטבלת הקטלוג ניתן לערוך או להדביק מייל ספק שונה בכל שורה. כתובת חדשה יוצרת רשומת ספק אוטומטית; כתובת שכבר קיימת מקשרת לאותו ספק. לכל אתר מלאי ומונה נפרדים גם כאשר אותו ספק מחזיק כמה אתרים.
- ״סה״כ מלאי״ ריק: ללא הגבלה, עם מונה רציף מ-1.
- ״סה״כ מלאי״ מספרי: מכסה מצטברת; למשל 50 מאפשר 50 משימות מסירה. עמודות ״נשלחו בפועל״ ו״נותרו במלאי״ הן לקריאה בלבד. לחידוש מלאי מגדילים את הסה״כ, בלי לאפס מספרים קיימים.
- אחרי אישור מנהל, הקצאת מספר, ניצול מקום במלאי, יצירת משימת ספק, יצירת מייל והעברת הכתבה ל״נשלח״ מתבצעים יחד בעסקת D1. המספר והמכסה באותו רגע נשמרים בכתבה ובמייל. תזכורת או ניסיון חוזר אינם צורכים מקום נוסף.
- כשהמלאי נגמר הכתבה נשארת מאושרת, ומשימת המסירה נחסמת. לאחר הגדלת המכסה המנהל לוחץ ״ניסיון מסירה״ בתור הספקים.
- הזמנות הדגמה משתמשות במונה נפרד, אינן צורכות מלאי אמיתי ואינן שולחות מייל חיצוני.
- המספר נוצר עם המסירה לפורטל ויצירת המייל בתור; אין הבטחה שהמייל הגיע לתיבת הדואר. מצב שירות הדיוור מופיע בהתראות ודיוור.
- המייל והמלאי הם נתוני ניהול פרטיים, ואינם מופיעים בקטלוג הציבורי.

### חבילות פרסום במחיר משותף
בניהול → מבצעים וקופונים → חבילות פרסום → יצירת חבילה, בוחרים 2–30 אתרים ומגדירים מחיר כולל לפני מע״מ. ניתן לערוך חבילה קיימת ולהסתיר אותה. הלקוח רואה את האתרים, הלוגואים, המחיר המשותף והחיסכון, ומוסיף את כל החבילה לסל בלי חלונית פרטים.
המחיר מחושב בשרת ומחולק בין האתרים באגורות שלמות. הטבת החבילה תקפה כשההרכב מלא והכמויות אחידות; הסרת אתר או שינוי כמות לא אחיד מבטלים רק את הטבת אותה חבילה. כל הוספה יוצרת קבוצה נפרדת. כתיבת עורך נוספת למחיר החבילה, ומע״מ מחושב בסיכום. חבילות הקופון הישנות ממשיכות לפעול.

### מסך ניהול המבצעים
מסך /admin-promotions מציג חבילות פרסום, מבצעי אתרים, קופונים וחבילות יתרה באזורים גלויים ללא לשוניות. כרטיסי האתרים והחבילות משתמשים בעיצוב הלקוח עם פעולת עריכה בניהול. מחיר המקור והחיסכון בחבילה מבוססים על המחירים המקוריים של האתרים לפני כל הנחת אתר; המחיר הסופי ממשיך להתאים לחישוב הסל.
