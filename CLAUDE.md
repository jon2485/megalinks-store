# Mega Links

Hebrew publishing, orders, suppliers and payments system. Reply to the owner in plain, short Hebrew.

**Before scanning the code, read `docs/admin-qa-handoff.md`.** It holds the architecture, 32 findings with status, the next step and how to run locally. Read only the files a task needs instead of re-analyzing the project.

Rules:
- Commit, push and Railway Staging deployment only with explicit approval for that action. Never touch Production or merge into `main`.
- Test only locally with fictional data.
- Change one screen at a time. No broad rewrites, and never remove existing functionality or approved designs without approval.

## ניהול עבודה ושמירת הקשר

הקוד עולה בסוף ל-GitHub, והזיכרון שלך בשיחה לא אמין. לכן git ו-NOTES.md הם מקור האמת.

### Commit
- עבוד על branch ייעודי לכל שינוי, לא על main.
- אחרי כל שלב שעובד (קומפוננטה, עמוד, תיקון), בצע commit קטן עם הודעה שמסבירה מה השתנה ולמה.
- לפני כל commit הרץ git status וודא שלא נכנסו .env, מפתחות, או קבצי הגדרות מקומיות.
- אל תעשה push ואל תמזג ל-main בלי שאישרתי במפורש.

### NOTES.md
עדכן את NOTES.md (צור אותו אם הוא לא קיים) בכל אחד מהמקרים:
- סיימת שלב או שינוי לוגי.
- לפני ש-/compact או /clear עומדים לקרות, או כשאני אומר שאני עומד לעבור לשיחה חדשה.
- כשעשית משהו זמני שאסור שיעלה (כתובת מקומית, נתוני דמה, הגדרה זמנית). סמן אותו ב"לפני העלאה".

מבנה הקובץ: מה הוחלט ולמה, אילו קבצים שונו, מה נשאר לא גמור, מה זמני, מה השלב הבא.

### בתחילת שיחה
אם NOTES.md קיים, קרא אותו לפני שאתה מתחיל לעבוד.

### לפני העלאה
כשאני אומר "מעלים", "מסיימים" או "PR":
1. הרץ git status ו-git diff main...HEAD.
2. עבור על הרשימה "לפני העלאה" ב-NOTES.md ווודא שאין שאריות זמניות.
3. הרץ את הבנייה והבדיקות.
4. כתוב לי סיכום לתיאור ה-PR לפי ה-diff האמיתי, לא לפי הזיכרון שלך.
5. חכה לאישור שלי לפני push.
