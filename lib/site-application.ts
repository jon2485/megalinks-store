export type SiteApplicationValues={name:string;url:string;example_url:string;price_ils:string;delivery_email:string;instructions:string};
export type SiteApplicationKey=keyof SiteApplicationValues|'logo';
export type SiteApplicationField={key:SiteApplicationKey;title:string;label:string;type:'text'|'url'|'file'|'number'|'email'|'textarea';group:1|2;placeholder?:string;max?:number;hint?:string;optional?:boolean};
export const siteApplicationFields:SiteApplicationField[]=[
 {key:'name',title:'מה שם האתר?',label:'שם האתר',type:'text',group:1,placeholder:'שם האתר שלך',max:160},
 {key:'url',title:'מהי כתובת האתר?',label:'כתובת האתר',type:'url',group:1,placeholder:'https://example.co.il',max:1500,hint:'אפשר להדביק כאן את הכתובת המלאה.'},
 {key:'example_url',title:'קישור לכתבה לדוגמה באתר?',label:'כתבה לדוגמה',type:'url',group:1,placeholder:'https://example.co.il/article',max:1500},
 {key:'logo',title:'נוסיף תמונה לאתר?',label:'לוגו או תמונת האתר',type:'file',group:2},
 {key:'price_ils',title:'מה המחיר שלך לכתבה?',label:'מחיר לכתבה לפני מע״מ (₪)',type:'number',group:2,placeholder:'המחיר המבוקש בשקלים',hint:'המחיר המבוקש לכתבה, לפני מע״מ.'},
 {key:'delivery_email',title:'לאיזה מייל נשלח כתבות?',label:'מייל לקבלת כתבות',type:'email',group:2,placeholder:'publish@example.co.il',max:254,hint:'הכתבות עצמן יישלחו למייל הזה.'},
 {key:'instructions',title:'משהו שחשוב לדעת לפני הפרסום?',label:'הנחיות לפרסום',type:'textarea',group:2,placeholder:'נושאים מתאימים, מספר קישורים ודגשים נוספים',max:3000,optional:true},
];
export const siteImageTypes=['image/png','image/jpeg','image/webp'];
// Same form contract as before; ownership and manager approval stay server-side.
export function siteApplicationError(key:SiteApplicationKey,values:SiteApplicationValues,hasLogo:boolean):string {
 if(key==='logo')return hasLogo?'':'יש לבחור לוגו או תמונת אתר כדי להמשיך.';
 const value=values[key].trim();
 if(key==='name')return value?'':'יש להזין את שם האתר.';
 if(key==='url'||key==='example_url'){try{const url=new URL(value);if(!['http:','https:'].includes(url.protocol))throw Error();return '';}catch{return 'יש להדביק כתובת מלאה שמתחילה ב־https://';}}
 if(key==='price_ils')return value!==''&&Number.isFinite(Number(value))&&Number(value)>=0?'':'יש להזין מחיר תקין בשקלים.';
 if(key==='delivery_email')return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)?'':'יש להזין כתובת מייל תקינה.';
 return '';
}
export function siteApplicationErrors(values:SiteApplicationValues,hasLogo:boolean){const errors:Partial<Record<SiteApplicationKey,string>>={};for(const field of siteApplicationFields){const error=siteApplicationError(field.key,values,hasLogo);if(error)errors[field.key]=error;}return errors;}
