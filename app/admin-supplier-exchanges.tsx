'use client';
// Admin: an exchange supplier's exchanges (owner 23.11.2026, spec docs/exchange-suppliers-spec.md). Every publication at
// the supplier with what was taken in return and the cost booked for it, the default cost and a manual correction.
import React,{useState} from 'react';
import {ArrowLeftRight,Minus,Plus} from 'lucide-react';
import {Input} from '@/components/ui/input';
import {Textarea} from '@/components/ui/textarea';
import {api,useData} from '@/lib/client';
import {money,type Row} from '@/lib/shared';
import {type Ctx,ErrorBox} from './workspace';
import './admin-supplier-exchanges.css';

const day=(v:unknown)=>{const d=new Date(String(v||''));return isNaN(+d)?'':new Intl.DateTimeFormat('he-IL',{timeZone:'Asia/Jerusalem',day:'2-digit',month:'2-digit',year:'numeric'}).format(d);};
const monthName=(m:unknown)=>{const s=String(m||'');return /^\d{4}-\d{2}$/.test(s)?new Intl.DateTimeFormat('he-IL',{timeZone:'UTC',month:'long',year:'numeric'}).format(new Date(s+'-01T12:00:00Z')):'';};
const host=(u:unknown)=>{try{return new URL(String(u)).host.replace(/^www\./,'');}catch{return String(u||'');}};

export function AdminSupplierExchanges({ctx,supplierId,state}:{ctx:Ctx;supplierId:string;state:Row}){
 const d:Row|undefined=state.data;
 if(!d)return <ErrorBox error={state.error}/>;
 const adjust=(delta:1|-1)=>ctx.open({kind:'admin-finance',title:delta===1?'הוספת החלפה ידנית':'הסרת החלפה ידנית',render:(close:()=>void)=><AdjustForm ctx={ctx} supplierId={supplierId} delta={delta} close={close}/>});
 const settings=()=>ctx.open({kind:'admin-finance',title:'עלות ברירת מחדל להחלפה',render:(close:()=>void)=><DefaultForm ctx={ctx} cents={d.default_cents} close={close}/>});
 const rows:Row[]=d.exchanges||[];
 return <section className="sv2-card axc" aria-label="החלפות">
  <div className="axc-head"><span className="axc-badge"><ArrowLeftRight size={15} aria-hidden="true"/>ספק החלפות</span><span className="axc-sp"/>
   <button type="button" className="sv2-btn quiet sm" onClick={()=>adjust(1)}><Plus size={15} aria-hidden="true"/>הוספת החלפה</button>
   <button type="button" className="sv2-btn quiet sm" onClick={()=>adjust(-1)} disabled={d.balance<1}><Minus size={15} aria-hidden="true"/>הסרת החלפה</button>
   <button type="button" className="sv2-btn quiet sm" onClick={settings}>ברירת מחדל: {money(d.default_cents)}</button></div>
  <div className="axc-tiles">
   <div><small>פורסמו אצל הספק</small><b>{d.published}</b><i>כתבות שאומתו</i></div>
   <div><small>לקח בתמורה</small><b>{d.taken}</b><i>{rows.filter(r=>r.target_status==='published').length} פורסמו</i></div>
   <div className="is-blue"><small>יתרה פתוחה</small><b>{d.balance}</b><i>עוד לא בחר אתר</i></div>
   <div><small>עלות ממוצעת להחלפה</small><b>{d.average_cents==null?'—':money(d.average_cents)}</b><i>רק למנהל</i></div>
   <div><small>התאמות החודש</small><b><bdi>{d.month_adjustments>0?'+':''}{money(d.month_adjustments)}</bdi></b><i>בחירה אחרי סוף החודש</i></div>
  </div>
  {!rows.length?<div className="sv2-empty"><h3>עדיין אין החלפות</h3><p>החלפה נפתחת כשכתבה שנשלחה לספק מתפרסמת והקישור שלה מאומת.</p></div>:
  <div className="axc-table" role="table" aria-label="ההחלפות של הספק">
   <div className="axc-tr axc-th" role="row"><span>#</span><span>פרסום אצל הספק</span><span>מה לקח בתמורה</span><span>העלות שלי</span><span>חודש</span></div>
   {rows.map(r=><div key={r.id} className={'axc-tr'+(r.status==='void'?' is-void':'')} role="row">
    <span className="axc-n">{r.n}</span>
    <span>{r.source_title?<><b>{r.source_title}</b><small>הלקוח: {r.customer_name||'—'} · פורסם {day(r.earned_at)}</small></>:<><b>החלפה ידנית</b><small>{r.note||''}</small></>}</span>
    <span>{r.status==='open'?<span className="axc-mut">טרם נבחר <em className="axc-pill is-open">ממתין לספק</em></span>:r.status==='void'?<span className="axc-mut">בוטלה <em className="axc-pill">{r.note||'הכתבה בוטלה'}</em></span>:
     <><b>{r.target_site}</b> <em className={'axc-pill '+(r.target_status==='published'?'is-ok':'is-wait')}>{r.target_status==='published'?'✓ פורסם':r.status==='debt'?'חוב: הכתבה אצל הספק בוטלה':'בתהליך'}</em><small>{host(r.target_site_url)}{r.target_number?' · הזמנה '+r.target_number:''}{r.chosen_at?' · נבחר '+day(r.chosen_at):''}</small></>}</span>
    <span className="axc-cost">{r.status==='void'?<span className="axc-mut">—</span>:<><b><bdi>{money(r.effective_cents)}</bdi></b>{r.estimate?<em className="axc-pill">הערכה, ברירת מחדל</em>:r.adjustments?<small className="axc-adj">{money(r.booked_cents)} בחודש המקורי, התאמה <bdi>{r.adjustments>0?'+':''}{money(r.adjustments)}</bdi> בחודש הבחירה</small>:<small>מה שאני משלם על {r.target_site||'האתר'}</small>}</>}</span>
    <span>{monthName(r.source_month)}</span>
   </div>)}
  </div>}
 </section>;
}

function AdjustForm({ctx,supplierId,delta,close}:{ctx:Ctx;supplierId:string;delta:1|-1;close:()=>void}){
 const [note,setNote]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 return <form className="om-dialog" onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');try{await api('admin/exchanges/adjust','POST',{supplier_id:supplierId,delta,note});close();ctx.refresh();}catch(err){setError((err as Error).message);}finally{setBusy(false);}}}>
  <p>{delta===1?'תיווסף לספק החלפה אחת לבחירה, בלי כתבה מקורית. העלות תירשם כברירת מחדל עד שיבחר אתר.':'ההחלפה הפתוחה האחרונה של הספק תוסר.'}</p>
  <label className="om-dialog-field"><span>סיבה (חובה)</span><Textarea value={note} onChange={e=>setNote(e.target.value)} required maxLength={300}/></label>
  <ErrorBox error={error}/><div className="om-dialog-actions"><button type="submit" className="om-btn is-primary" disabled={busy||!note.trim()}>{delta===1?'הוספת החלפה':'הסרת החלפה'}</button><button type="button" className="om-btn" onClick={close}>ביטול</button></div>
 </form>;
}

function DefaultForm({ctx,cents,close}:{ctx:Ctx;cents:number;close:()=>void}){
 const [value,setValue]=useState(String(cents/100)),[busy,setBusy]=useState(false),[error,setError]=useState('');
 return <form className="om-dialog" onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');try{await api('admin/exchanges/settings','PATCH',{default_ils:Number(value)});close();ctx.refresh();}catch(err){setError((err as Error).message);}finally{setBusy(false);}}}>
  <p>העלות שנרשמת לפרסום אצל ספק החלפות עד שהוא בוחר אתר, וגם כשהחודש מסתיים לפני שבחר.</p>
  <label className="om-dialog-field"><span>סכום בש״ח</span><Input type="number" min={0} step="1" inputMode="decimal" value={value} onChange={e=>setValue(e.target.value)}/></label>
  <ErrorBox error={error}/><div className="om-dialog-actions"><button type="submit" className="om-btn is-primary" disabled={busy}>שמירה</button><button type="button" className="om-btn" onClick={close}>ביטול</button></div>
 </form>;
}

// Catalog: open a site for exchanges (only a site with a known cost, and not an exchange supplier's own site).
export function ExchangeSiteToggle({ctx,site}:{ctx:Ctx;site:Row}){
 const [on,setOn]=useState(!!Number(site.exchange_available||0)),[busy,setBusy]=useState(false),[error,setError]=useState('');
 if(site.stock_mode==='exchange')return <p className="axc-mut" style={{margin:0,fontSize:13}}>אתר של ספק החלפות: לא נפתח לבחירה בהחלפה.</p>;
 return <div className="axc-toggle"><label><input type="checkbox" checked={on} disabled={busy} onChange={async e=>{const next=e.target.checked;setBusy(true);setError('');try{await api('admin/exchanges/sites','POST',{website_id:site.id,available:next});setOn(next);ctx.refresh();}catch(err){setError((err as Error).message);}finally{setBusy(false);}}}/><span><b>זמין להחלפה</b><small>ספקי החלפות יוכלו לבחור את האתר בתמורה לפרסום אצלם. העלות שלך היא מחיר העלות של האתר.</small></span></label><ErrorBox error={error}/></div>;
}
