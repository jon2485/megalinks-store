export type SiteApplicationValues={name:string;url:string;example_url:string;price_ils:string;delivery_email:string;instructions:string};
export type SiteApplicationKey=keyof SiteApplicationValues|'logo';
export type SiteApplicationField={key:SiteApplicationKey;title:string;label:string;type:'text'|'url'|'file'|'number'|'email'|'textarea';group:1|2;placeholder?:string;max?:number;hint?:string;optional?:boolean};
export function normalizeSiteUrl(value:string):string {
 const raw=value.trim();
 if(!raw)return '';
 const invalid=()=>new Error('יש להזין כתובת אתר תקינה, למשל example.co.il.');
 if(/[\u0000-\u0020\u007f\\]/.test(raw))throw invalid();
 // A bare host (with an optional port/path) gets HTTPS; explicit HTTP is retained.
 const hasScheme=/^[a-z][a-z\d+.-]*:/i.test(raw)&&!/^([^/?#:\s]+\.)+[^/?#:\s]+:\d+(?:[/?#]|$)/.test(raw);
 let url:URL;
 try{url=new URL(raw.startsWith('//')?'https:'+raw:hasScheme?raw:'https://'+raw);}catch{throw invalid();}
 const host=url.hostname.toLowerCase().replace(/\.$/,'');
 if(!['http:','https:'].includes(url.protocol)||url.username||url.password||host.length>253||!host.includes('.')||host.includes(':')||/^\d+(\.\d+){3}$/.test(host)||/(^|\.)(localhost|local|internal)$/.test(host)||/^\d+$/.test(host.split('.').at(-1)!)||!host.split('.').every(label=>/^[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?$/i.test(label)))throw invalid();
 url.hostname=host;
 return url.href;
}
export const normalizeSiteApplication=(values:SiteApplicationValues):SiteApplicationValues=>({...values,url:normalizeSiteUrl(values.url),example_url:normalizeSiteUrl(values.example_url)});
export const siteApplicationFields:SiteApplicationField[]=[
 {key:'name',title:'מה שם האתר?',label:'שם האתר',type:'text',group:1,placeholder:'שם האתר שלך',max:160},
 {key:'url',title:'מהי כתובת האתר?',label:'כתובת האתר',type:'url',group:1,placeholder:'example.co.il',max:1500,hint:'אפשר להזין גם דומיין בלבד. נשלים https:// אוטומטית.'},
 {key:'example_url',title:'קישור לכתבה לדוגמה באתר?',label:'כתבה לדוגמה',type:'url',group:1,placeholder:'example.co.il/article',max:1500},
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
 if(key==='url'||key==='example_url'){try{if(!normalizeSiteUrl(value))throw Error();return '';}catch{return 'יש להזין כתובת אתר תקינה, למשל example.co.il.';}}
 if(key==='price_ils')return value!==''&&Number.isFinite(Number(value))&&Number(value)>=0?'':'יש להזין מחיר תקין בשקלים.';
 if(key==='delivery_email')return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)?'':'יש להזין כתובת מייל תקינה.';
 return '';
}
export function siteApplicationErrors(values:SiteApplicationValues,hasLogo:boolean){const errors:Partial<Record<SiteApplicationKey,string>>={};for(const field of siteApplicationFields){const error=siteApplicationError(field.key,values,hasLogo);if(error)errors[field.key]=error;}return errors;}
