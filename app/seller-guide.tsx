import {Globe,FileCheck2,Wallet,CalendarDays} from 'lucide-react';
export function SellerTitle({first,accent}:{first:string;accent:string}){return <h2 className="seller-hub-title">{first}<span>{accent}</span></h2>;}
export default function SellerGuide({payments=false}:{payments?:boolean}){
 const steps=payments?[
 {title:'סוגרים חודש',body:'בסוף החודש נסגר סיכום הפרסומים.',Icon:CalendarDays},
 {title:'שולחים חשבונית',body:'עד ל־3 בחודש העוקב.',Icon:FileCheck2},
 {title:'מקבלים תשלום',body:'עד ל־10 באותו חודש, לאחר אישור החשבונית וביצוע ההעברה.',Icon:Wallet}
 ]:[
 {title:'מוסיפים אתר',body:'ממלאים את פרטי האתר ואת המחיר המבוקש לפרסום. לאחר בדיקה ואישור, האתר יוצג בקטלוג.',Icon:Globe},
 {title:'מפרסמים ומרוויחים',body:'כשמתקבלת הזמנה, הכתבה נשלחת אליך במייל. מפרסמים באתר ומדווחים כאן או במייל על הקישור שעלה.',Icon:FileCheck2},
 {title:'מקבלים תשלום בכל חודש',body:'בסוף החודש נסגר סיכום הפרסומים לתשלום.',Icon:Wallet}
 ];
 return <ol className={'seller-hub-steps'+(payments?' seller-hub-steps-compact':'')}>{steps.map(({title,body,Icon},i)=><li key={title}><span className="seller-hub-number" aria-hidden="true">{i+1}</span><div><h3>{title}</h3><p>{body}</p>{!payments&&i===2&&<div className="seller-hub-dates"><p>חשבונית עד ל־<strong>3</strong> בחודש העוקב</p><p>תשלום עד ל־<strong>10</strong> באותו חודש</p></div>}</div><Icon aria-hidden="true" size={32}/></li>)}</ol>;
}
