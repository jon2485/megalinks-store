// The legal pages of the site. The text itself lives in design/legal/drafts/<id>.md (what the lawyer reviews) and is
// copied into lib/legal-content.generated.ts by scripts/build-legal-content.mjs. Every document is a draft until a
// lawyer approves it: the page shows "טיוטה לאישור עורך דין" and is kept out of search engines while `draft` is true.
export const LEGAL_DOCS=[
 {id:'terms',path:'/terms',title:'תקנון ותנאי שימוש',label:'תקנון',summary:'התנאים לשימוש באתר ולרכישת שירותי הפרסום והכתיבה.'},
 {id:'privacy',path:'/privacy',title:'מדיניות פרטיות',label:'פרטיות',summary:'איזה מידע נאסף, למה, עם מי הוא משותף ומהן הזכויות שלך.'},
 {id:'cancellation',path:'/cancellation',title:'מדיניות ביטולים והחזרות',label:'ביטולים והחזרות',summary:'איך מבטלים הזמנה, מתי מקבלים החזר ואיך פונים.'},
 {id:'supply',path:'/supply',title:'מדיניות אספקת השירות',label:'אספקת השירות',summary:'שלבי הטיפול בהזמנה, מועדי האספקה ומה קורה כשיש עיכוב.'},
 {id:'accessibility',path:'/accessibility',title:'הצהרת נגישות',label:'נגישות',summary:'מה נבדק ובוצע בנגישות האתר, מה עדיין מוגבל ואיך פונים אלינו.'},
 {id:'cookies',path:'/cookies',title:'מדיניות עוגיות',label:'עוגיות',summary:'באילו עוגיות ואחסון בדפדפן האתר משתמש ואיך שולטים בהם.'},
] as const;
export type LegalDocId=typeof LEGAL_DOCS[number]['id'];
export const LEGAL_IDS:readonly string[]=LEGAL_DOCS.map(doc=>doc.id);
export const isLegalView=(view:string):view is LegalDocId=>LEGAL_IDS.includes(view);
export const legalDoc=(id:string)=>LEGAL_DOCS.find(doc=>doc.id===id);
