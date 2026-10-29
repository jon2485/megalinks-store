export const adminAreas = [
 {id:'admin',label:'מרכז העבודה',description:'כל מה שממתין לטיפול, במקום אחד.',pages:[['admin','עדכונים ומשימות']]},
 {id:'admin-orders',label:'הזמנות וכספים',description:'הזמנות, דיווחי תשלום, יתרות וחשבונות חודשיים.',pages:[['admin-orders','הזמנות'],['admin-month-close','סגירת חודש'],['admin-payment-reports','דיווחי תשלום'],['admin-invoices','חשבוניות וקבלות'],['admin-topups','הטענות יתרה'],['admin-monthly','חשבונות חודשיים']]},
 {id:'admin-approvals',label:'תוכן ופרסום',description:'בדיקה, כתיבה, אישור ומעקב עד לפרסום.',pages:[['admin-approvals','ממתינים לאישור'],['admin-articles','כל הכתבות'],['admin-publication','תור פרסום'],['admin-instructions','הנחיות כתיבה'],['admin-knowledge','ספריית ידע']]},
 {id:'admin-users',label:'לקוחות והרשאות',description:'תיקי לקוח, הרשאות ומסגרות אשראי.',pages:[['admin-users','לקוחות והרשאות']]},
 {id:'admin-websites',label:'קטלוג ותמחור',description:'אתרים, סנכרון Google Sheets ומחירים ללקוחות.',pages:[['admin-websites','אתרים וסנכרון'],['admin-pricing','רמות והנחות'],['admin-pricebooks','מחירונים אישיים']]},
 {id:'admin-suppliers',label:'ספקים',description:'פרטי ספקים, האתרים שלהם ותשלומים על פרסומים.',pages:[['admin-suppliers','ספקים ואתרים'],['admin-seller-requests','בקשות וחשבוניות'],['admin-supplier-finance','התחשבנות']]},
 {id:'admin-promotions',label:'מבצעים וחבילות',description:'חבילות פרסום, מבצעים, קופונים וחבילות יתרה.',pages:[['admin-promotions','מבצעים וחבילות']]},
 {id:'admin-support',label:'פניות שירות',description:'פניות הלקוחות והמשך הטיפול בהן.',pages:[['admin-support','פניות']]},
 {id:'admin-connections',label:'מערכת ודוחות',description:'הגדרות, דוחות, דיוור והיסטוריית פעולות.',pages:[['admin-connections','חיבורים והגדרות'],['admin-reports','דוחות'],['admin-notifications','דיוור'],['admin-jobs','יומן חיבורים'],['admin-audit','יומן פעילות']]},
] as const;
export function adminArea(view:string){
 if(view.startsWith('admin-supplier/')||view.startsWith('admin-supplier-invoice/'))return adminAreas[5];
 if(view.startsWith('admin-order/'))return adminAreas[1];
 if(view.startsWith('admin-support/'))return adminAreas[7];
 if(view.startsWith('admin-knowledge/'))return adminAreas[2];
 if(view.startsWith('admin-article/'))return adminAreas[2];
 if(view.startsWith('admin-customer-account/'))return adminAreas[3];
 if(view.startsWith('admin-pricebook/')||(view==='admin-pricing'||view==='admin-pricebooks'))return adminAreas[4];
 return adminAreas.find(a=>a.pages.some(([page])=>page===view));
}
