import {Globe,FileCheck2,Wallet,CalendarDays} from 'lucide-react';
export function SellerTitle({first,accent}:{first:string;accent:string}){return <h2 className="seller-hub-title">{first}<span>{accent}</span></h2>;}
export default function SellerGuide({payments=false}:{payments?:boolean}){
 const steps=payments?[
 {title:'סוגרים חודש',body:'סיכום הפרסומים נסגר בסוף החודש.',Icon:CalendarDays},
 {title:'שולחים חשבונית',body:'עד ל־3 בחודש העוקב.',Icon:FileCheck2},
 {title:'מקבלים תשלום',body:'עד ל־10 באותו חודש, לאחר אישור החשבונית.',Icon:Wallet}
 ]:[
 {title:'מוסיפים אתר',body:'ממלאים פרטים ומחיר. האתר יוצג לאחר אישור מנהל.',Icon:Globe},
 {title:'מפרסמים ומרוויחים',body:'הכתבה מגיעה למייל. מדווחים כאן או במייל על הפרסום.',Icon:FileCheck2},
 {title:'מקבלים תשלום',body:'חשבונית עד ל־3 בחודש העוקב. תשלום עד ל־10 באותו חודש.',Icon:Wallet}
 ];
 return <ol className={'seller-hub-steps'+(payments?' seller-hub-steps-compact':'')}>{steps.map(({title,body,Icon},i)=><li key={title}><span className="seller-hub-number" aria-hidden="true">{i+1}</span><div><h3>{title}</h3><p>{body}</p></div><Icon aria-hidden="true" size={32}/></li>)}</ol>;
}
