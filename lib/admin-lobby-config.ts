export const lobbyGroups=[
 {id:'content',label:'כתבות ותוכן',queues:['content','writing'],page:'admin-approvals',action:'בדיקת תוכן',tabs:[['admin-approvals','לאישור'],['lobby-writing','כתיבה מקצועית']]},
 {id:'publication',label:'פרסום וספקים',queues:['publication','tracking','delivery','supplier_due'],page:'lobby-publication-ready',action:'פתיחת תור הפרסום',tabs:[['lobby-publication-ready','מוכנות לשליחה'],['admin-publication','מעקב ותקלות'],['admin-supplier-finance','התחשבנות ספקים']]},
 {id:'payment_reports',label:'דיווחי תשלום',queues:['payment_reports','bank'],page:'lobby-payment-reports',action:'בדיקה ואישור',tabs:[['lobby-payment-reports','דיווחים לאישור'],['lobby-unpaid','תשלומים למעקב']]},
 {id:'topups',label:'הטענות יתרה',queues:['topups'],page:'admin-topups',action:'בדיקת הבקשות',tabs:[]},
 {id:'cancellations',label:'ביטולים וזיכויים',queues:['cancellations'],page:'lobby-cancellations',action:'טיפול בביטול',tabs:[],tone:'danger'},
 {id:'support',label:'פניות שירות',queues:['support'],page:'admin-support',action:'פתיחת הפניות',tabs:[]},
 {id:'monthly',label:'חשבונות חודשיים',queues:['monthly'],page:'admin-monthly',action:'לחשבונות החודשיים',tabs:[]},
 {id:'catalog',label:'מחירים וסנכרון',queues:['prices','pricing_review','sync'],page:'lobby-prices',action:'בדיקת העדכונים',tabs:[['lobby-prices','שינויי מחירים'],['admin-websites','אתרים וסנכרון'],['admin-pricing','רמות והנחות']]},
 {id:'issues',label:'מסמכים וחיבורים',queues:['invoices','mail','connections'],page:'admin-invoices',action:'פתיחת הטיפול',tabs:[['admin-invoices','מסמכים חסרים'],['admin-notifications','דיוור'],['admin-jobs','תקלות חיבור'],['admin-connections','הגדרות החיבור']],tone:'warning'},
] as const;
export function lobbyGroupForPage(page:string){return lobbyGroups.find(g=>g.page===page||g.tabs.some(([p])=>p===page));}
