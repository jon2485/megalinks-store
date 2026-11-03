'use client';
import React,{useRef,useState} from 'react';
import {Plus,Minus,FileText,ChevronDown} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {money,type Row} from '@/lib/shared';

export default function EditorialAddon({item,save,dirty,customers=[],customersError,customersLoading=false}:{item:Row;customers?:Row[];customersError?:string;customersLoading?:boolean;save:(b:Row)=>Promise<void>;dirty:(value:boolean)=>void}){
 const [expanded,setExpanded]=useState(false),[words,setWords]=useState(String(item.editorial_words||400)),[custom,setCustom]=useState(!!item.editorial&&![400,600].includes(Number(item.editorial_words))),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const pending=useRef(false),[infoOpen,setInfoOpen]=useState(false);
 const changeWords=(count:number)=>{const next=String(Math.min(5000,Math.max(100,count)));setCustom(true);setWords(next);dirty(!item.editorial||Number(next)!==Number(item.editorial_words));};
 const update=async(enabled:boolean,count=Number(words))=>{
  if(pending.current)return;
  if(enabled&&(!Number.isInteger(count)||count<100||count>5000)){setError('בחרו בין 100 ל־5,000 מילים');return;}
  pending.current=true;setBusy(true);setError('');
  try{await save({editorial:enabled,editorial_words:enabled?count:Number(item.editorial_words||400)});if(enabled){setWords(String(count));setCustom(![400,600].includes(count));}dirty(false);}
  catch(e){setError((e as Error).message);}finally{pending.current=false;setBusy(false);}
 };
 return <section className="cart-writing-addon" aria-label={'כתיבה מקצועית עבור '+item.name}>
  <Button type="button" variant="ghost" className="cart-writing-toggle" aria-expanded={expanded} aria-controls={'cart-writing-'+item.id} onClick={()=>setExpanded(!expanded)}><span>כתיבה ושיוך ללקוח{!!item.editorial&&<small>נבחרו {item.editorial_words||400} מילים · {money(item.editorial_price??Number(item.editorial_words||400)*15)} לכל כתבה</small>}</span><span className="cart-writing-toggle-end"><span className="cart-writing-badge" data-on={!!item.editorial}>{item.editorial?'+ '+(item.editorial_words||400)+' מילים':'רשות'}</span><ChevronDown className="cart-writing-chevron" size={18} aria-hidden="true"/></span></Button>
  {expanded&&<div id={'cart-writing-'+item.id} className="cart-writing-panel">
   <label className="cart-customer-assignment"><span>שיוך ללקוח (לא חובה)</span><select aria-label={'שיוך ללקוח עבור '+item.name} value={item.customer_id||''} disabled={busy||customersLoading||!!customersError} onChange={async e=>{const customer_id=e.target.value;if(pending.current)return;pending.current=true;setBusy(true);setError('');try{await save({customer_id});}catch(e){setError((e as Error).message);}finally{pending.current=false;setBusy(false);}}}><option value="">ללא שיוך ללקוח</option>{customers.map(customer=><option key={customer.id} value={customer.id}>{customer.name}{customer.company?' · '+customer.company:''}</option>)}</select><small>{customersLoading?'טוען לקוחות…':customersError?'לא ניתן לטעון לקוחות. נסו לרענן את העמוד.':'הכתבות יופיעו אצל הלקוח שנבחר ב״הלקוחות שלי״ לאחר הרכישה. השיוך אינו מוסיף שירות כתיבה.'}</small></label>
   <div className="cart-writing-title"><span>הוספת כתיבה מקצועית</span><span className="cart-writing-tag">תוספת</span><button type="button" className="cart-writing-info" aria-label="מה אם לא מוסיפים כתיבה?" aria-expanded={infoOpen} onClick={()=>setInfoOpen(!infoOpen)}>i</button></div>
   <p className="cart-writing-note" data-open={infoOpen} role="note"><b>לא חובה להוסיף כתיבה.</b> אפשר לכתוב את הכתבה בעצמכם, או בעזרת כלי ה-AI המובנה, ללא עלות. אפשר להוסיף כתיבה גם אחרי רכישת האתר.</p>
   <div className="cart-writing-options" role="group" aria-label="אפשרויות כתיבה מקצועית">
    {/* Writing is an add-on: pressing the chosen preset again removes it. */}
    {[400,600].map(count=>{const chosen=!!item.editorial&&!custom&&Number(words)===count;return <Button key={count} type="button" variant="outline" disabled={busy} aria-pressed={chosen} onClick={()=>void update(!chosen,count)}><FileText size={21}/><span>כתיבה מקצועית — {count} מילים</span><strong>{money(count*15)}</strong></Button>;})}
    <div className="cart-writing-custom-choice" data-selected={custom}>
     <Button type="button" variant="ghost" className="cart-writing-custom-pick" disabled={busy} aria-pressed={custom} onClick={()=>{setCustom(true);dirty(!item.editorial||Number(words)!==Number(item.editorial_words));}}><FileText size={21}/><span>בחירת כמות מילים</span></Button>
     <div className="cart-writing-custom"><label htmlFor={'editorial-words-'+item.id}>מספר מילים במאמר</label><div className="cart-writing-word-stepper" dir="ltr"><Button type="button" variant="ghost" disabled={busy||Number(words)<=100} aria-label="הפחתת מספר המילים" onClick={()=>changeWords((Number(words)||400)-1)}><Minus size={14}/></Button><Input id={'editorial-words-'+item.id} type="number" dir="ltr" min={100} max={5000} step={1} value={words} disabled={busy} onChange={e=>{setCustom(true);setWords(e.target.value);dirty(!item.editorial||Number(e.target.value)!==Number(item.editorial_words));}}/><Button type="button" variant="ghost" disabled={busy||Number(words)>=5000} aria-label="הגדלת מספר המילים" onClick={()=>changeWords((Number(words)||400)+1)}><Plus size={14}/></Button></div><Button type="button" className="cart-writing-save" aria-label="שמירת מספר מילים" disabled={busy} onClick={()=>void update(true)}>{busy?'שומר…':'שמירה'}</Button><span>₪0.15 לכל מילה · <bdi>{money((Number(words)||0)*15)}</bdi></span></div>
    </div>
   </div>
   <p className="cart-writing-help">כתיבה בידי כותב מקצועי · תוספת לבחירה בלבד · ₪0.15 למילה · לפני מע״מ{item.quantity>1?` · הסכום יוכפל ב־${item.quantity} כתבות`:''}</p>
   {item.editorial&&<Button type="button" variant="ghost" disabled={busy} className="cart-writing-remove" onClick={()=>void update(false)}>הסרת שירות הכתיבה</Button>}
   {error&&<p role="alert" className="error-box">{error}</p>}
  </div>}
 </section>;
}
