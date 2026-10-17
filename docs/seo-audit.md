# בדיקת SEO — MegaLinks

תאריך הבדיקה: 17.10.2026. הבדיקה מתייחסת לקוד האתר, למסלולים הציבוריים
ולגבול שבין מידע ציבורי למערכת הלקוחות והניהול. אין כאן הבטחה לדירוג או
אישור ש־Google כבר סרקה או אינדקסה את הדומיין.

## ממצאים ותיקונים

| ממצא | טיפול |
|---|---|
| אנימציית האותיות החדשה לא אושרה | הוחזרה הכותרת המקורית, ללא פיצול לאותיות וללא ההגדלה. הצל שהוסר נשאר מוסר. |
| כותרת ותיאור כלליים של פוסטפלואו | עודכנו לשם MegaLinks ולתיאור השירות; לתקנון מטא־דאטה נפרדת. |
| אין canonical | כתובות קנוניות מוחלטות לבית ולתקנון; `/catalog` מפנה לצמיתות לבית. חיפוש וסינון לא יוצרים עמודים כפולים באינדקס. |
| ה־HTML הראשוני מכיל מסך טעינה במקום התוכן העיקרי | הכותרת והקטלוג מוצגים גם לפני JavaScript. עד 24 אתרים פעילים נטענים בשרת מהמסד הנוכחי, עם מחיר ציבורי של הרמה הרגילה בלבד. ה־API ממשיך להיות המקור לכל הקטלוג והתמחור האישי לאחר הטעינה. |
| רשימת המקור הישנה הועברה כפרופ לא מנוצל לכל מסך | הוסרה העברת כל 1,186 רשומות המקור. מסכים פרטיים מקבלים מערך התחלתי ריק, והבית מקבל רק הקרנה ציבורית מצומצמת. אין נפילה חזרה למחירון מקור מיושן. |
| אין robots.txt או sitemap.xml | נוספו מסלולים אמיתיים. המפה כוללת רק את הבית והתקנון. API ציבורי הדרוש להצגת האתר זמין לסריקה; מסלולי API אחרים אינם מיועדים לסריקה. |
| מסכי לקוח/ספק/ניהול לא סומנו מחוץ לאינדקס | נוספו מטא־תגי noindex ו־X-Robots-Tag למסכים פרטיים, ל־API ולקבצים המוגשים דרכו. HTML אינו נשמר במטמון משותף. הרשאות השרת המקוריות נשמרו; robots אינו תחליף להן. |
| ניווט ב־History API משאיר מטא־דאטה של העמוד הקודם | שינוי תצוגה מעדכן title, description, robots ו־canonical גם בניווט ללא טעינה מלאה. |
| מסלולים לא קיימים נענים כעמוד אפליקציה תקין | מסלול לא מוכר מחזיר 404 אמיתי. נשמרו גם מסלולי מאמרים, מצב AI, תתי מסכי לקוח, ספקים ולובי ניהול. |
| קישורי ניווט בפוטר היו כפתורים בלבד | נוספו קישורי href אמיתיים, עם אותה פעולת ניווט רגילה ותמיכה בפתיחה בלשונית חדשה. |
| חסרות הגדרות שיתוף ושם האתר | נוספו Open Graph, Twitter ו־JSON-LD מסוג WebSite/Organization. נעשה שימוש בלוגו הקיים; ללא דירוגים, ביקורות או נתונים מומצאים. |
| favicon של מותג ישן | הוגדר סמל MegaLinks הקיים. שפת he וכיוון RTL נשמרו. |
| קובץ מטמון TypeScript שמור במקור | הוסר הקובץ הנוצר אוטומטית ונוסף ל־gitignore. הוא אינו חלק מקוד המוצר או מסנכרון המקור. |

## פרטיות ותמחור ברינדור הציבורי

`lib/public-catalog-preview.ts` משתמש ברשימת שדות סגורה ומצומצמת. אין בה
מזהי ספק, שמות ספקים, מיילים, מלאי, הערות מכל סוג, מגבלות פרסום חופשיות,
שדות JSON שרירותיים או מחירי עלות. הרשומות אינן נשלחות כפי שהן מהמסד.
הטעינה הציבורית אינה קוראת לזהות המשתמש ואינה מציגה מחיר אישי. היא מוגבלת
לקריאה בלבד. נתוני הזמנות, תשלומים וחשבונות אינם חלק מסכימת האתר או ממפת האתר.

בדיקת `tests/seo.mjs` מריצה Worker בנוי ומסד מבודד עם סמני ספק, עלות ומחיר אישי,
ומוודאת שהם לא קיימים ב־HTML הראשוני או בנתונים המסודרים.

## מה אינו מאושר עדיין

- **נגישות Googlebot בייצור:** בקשות HTTP לא חתומות מסביבת הבדיקה אל הבית,
  robots.txt ו־sitemap.xml נענו ב־403 עם Cloudflare error 1010. שכבת האירוח
  מגדירה את האתר כציבורי, אך חסימת בקשת בדיקה אינה מוכיחה מה יקרה ל־Googlebot
  מזוהה. יש לבצע URL Inspection → Test live URL ב־Search Console. אם גם שם
  חסום, צריך לתקן את מדיניות ה־WAF/בוטים אצל ספק האירוח. לא שונתה מדיניות
  גישה ולא הוחלשה הגנת האתר לצורך הבדיקה.
- **אינדוקס בפועל:** לא אומתה בעלות Search Console, לא נשלחה מפת אתר דרכו,
  ולא נצפו דוחות אינדוקס או פעולות ידניות. יצירת sitemap אינה אישור אינדוקס.
- **Core Web Vitals:** לא הופקה מדידת CrUX, Lighthouse או PageSpeed. הסרת
  נתוני המקור הלא מנוצלים והצגת התוכן הראשוני מקטינות עבודה מיותרת, אך אין
  לדווח על שיפור מספרי ב־LCP/INP/CLS ללא מדידה. גם בדיקת תצוגה בדפדפן לא
  הייתה זמינה בסביבת העבודה.
- **קישורים בתשלום:** מדיניות Google מבחינה בין פרסום ממומן לבין מכירת
  קישורים להעברת דירוג. בקישורים שנרכשו בכתבות אצל המפרסמים נדרש סימון
  `rel="sponsored"` או `nofollow`. תווית Dofollow בקטלוג אינה אישור תאימות.
  נדרש לבדוק את דפי הפרסום בפועל ואת הסכמי הספקים. קישורי ניווט רגילים
  מהקטלוג לאתרי המפרסמים אינם מעידים כשלעצמם על קישור שנרכש.
- **איכות הכתבות ומוניטין האתר המפרסם:** קוד תקין אינו מאמת מקוריות,
  אמינות, פיקוח עריכתי, התאמה לקהל או עמידה במדיניות site reputation abuse.
  אין לפרסם תוכן רב רק כדי לנצל דירוג של דומיין אחר.
- **עמודי קטגוריות ואתר בודד:** המוצר נשאר קטלוג אינטראקטיבי אחד. לא נוצרו
  מאות עמודי SEO דלים או כפולים. אם רוצים לדרג עמודים נפרדים בהמשך, צריך
  להגדיר כתובות ותוכן מועיל ייחודי, ניווט וקישורי pagination מתאימים.

## בדיקות נדרשות לשחרור

תוצאות הבדיקה על ה־Worker שנבנה ב־17.10.2026: 47 בדיקות SEO עברו,
911 בדיקות פרטיות עברו, ובדיקות פעולות הקטלוג, המבנה ברוחבים 320–1440
ומסלולי הניהול עברו. אלו בדיקות מקומיות מבודדות; הן אינן מחליפות אימות
Search Console או מדידת דפדפן בייצור.

- TypeScript ללא פליטת קבצים.
- בניית Vinext/Worker מלאה.
- `node tests/seo.mjs` — HTTP, מטא־דאטה, canonical, JSON-LD, HTML לפני
  JavaScript, הקרנה ציבורית, robots/sitemap, מסכים פרטיים, הפניה ו־404.
- `node tests/supplier-privacy.mjs` — בדיקות פרטיות קיימות על API וקבצים.
- `node tests/catalog-home-actions.mjs` ו־`node tests/catalog-home-layout.mjs --built`.
- `node tests/admin-entry-routing.mjs` — מסלולי הניהול הקיימים.

## מקורות רשמיים שנבדקו

- [Search Essentials: Technical requirements](https://developers.google.com/search/docs/essentials/technical)
- [JavaScript SEO](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics)
- [Canonicalization](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)
- [Robots meta / X-Robots-Tag](https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag)
- [Robots.txt limitations](https://developers.google.com/search/docs/crawling-indexing/robots/intro)
- [Sitemaps](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)
- [Crawlable links](https://developers.google.com/search/docs/crawling-indexing/links-crawlable)
- [Structured data policies](https://developers.google.com/search/docs/appearance/structured-data/sd-policies)
- [Site names](https://developers.google.com/search/docs/appearance/site-names)
- [Page experience](https://developers.google.com/search/docs/appearance/page-experience)
- [Paid outbound links](https://developers.google.com/search/docs/crawling-indexing/qualify-outbound-links)
- [Spam policies](https://developers.google.com/search/docs/essentials/spam-policies)
