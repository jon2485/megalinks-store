'use client';
import React,{useRef,useState} from 'react';
import {CheckCircle2,ExternalLink,FileUp,Receipt} from 'lucide-react';
import {useData} from '@/lib/client';
import {money,type Row} from '@/lib/shared';
import './supplier-hub.css';

// Public page behind the monthly email: a manual supplier sees the month's
// articles and attaches an invoice. No account or sign-in is needed.
const day=(v?:string)=>v?new Date(v.length===10?v+'T12:00:00Z':v).toLocaleDateString('he-IL',{day:'2-digit',month:'2-digit',year:'numeric'}):'';
const monthName=(m:string)=>{const [y,n]=m.split('-').map(Number);return new Date(Date.UTC(y,n-1,15)).toLocaleDateString('he-IL',{month:'long',year:'numeric'});};
export default function SupplierInvoiceView({token}:{token:string}){
 const[revision,setRevision]=useState(0),state=useData('supplier-invoice/'+token,revision),d:Row|undefined=state.data;
 const[file,setFile]=useState<File|null>(null),[number,setNumber]=useState(''),[vat,setVat]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[done,setDone]=useState(false),lock=useRef(false);
 if(state.error&&!d)return <main className="si-page" dir="rtl"><section className="si-card si-center"><Receipt size={28} aria-hidden="true"/><h1>הקישור אינו זמין</h1><p>{state.error}</p></section></main>;
 if(!d)return <main className="si-page" dir="rtl"><p className="si-loading" role="status">טוען את הסיכום…</p></main>;
 const missing=!file?'קובץ החשבונית':!number.trim()?'מספר החשבונית':'';
 const vatValue=vat===''?Math.round(d.net*0.18)/100:Number(vat);
 const submit=async(e:React.FormEvent)=>{e.preventDefault();if(lock.current)return;setError('');if(missing){setError('יש להוסיף '+missing+'.');return;}lock.current=true;setBusy(true);try{const form=new FormData();form.set('file',file!);form.set('number',number.trim());form.set('vat_ils',String(vatValue));const r=await fetch('/api/supplier-invoice/'+encodeURIComponent(token),{method:'POST',body:form,credentials:'same-origin'});const body=(await r.json().catch(()=>({}))) as Row;if(!r.ok)throw new Error(body.error||'השליחה לא הושלמה. נסו שוב.');setDone(true);setFile(null);setRevision(x=>x+1);}catch(err){setError((err as Error).message);}finally{lock.current=false;setBusy(false);}};
 return <main className="si-page" dir="rtl">
  <header className="si-head"><span className="si-badge" aria-hidden="true"><Receipt size={22}/></span><div><h1>סיכום פרסומים ל{monthName(d.month)}</h1><p>{d.recipient.contact||d.recipient.name} · {d.articles.length} כתבות</p></div></header>
  <section className="si-total"><span>סכום לתשלום לפני מע״מ</span><b><bdi>{money(d.net)}</bdi></b>{d.paid?<small className="is-paid"><CheckCircle2 size={15} aria-hidden="true"/>שולם ב־{day(d.paid.paid_on)}</small>:<small>התשלום יועבר אחרי שנקבל את החשבונית</small>}</section>
  <section className="si-card"><h2>הכתבות שנכללות בתשלום</h2><ol className="si-list">{d.articles.map((a:Row,i:number)=><li key={i}><span className="si-n">{i+1}</span><div><b>{a.title||'כתבה'}</b><span>{a.site_name}{a.date&&' · '+day(a.date)}</span>{a.url&&<a href={a.url} target="_blank" rel="noreferrer"><ExternalLink size={13} aria-hidden="true"/><bdi>{String(a.url).replace(/^https?:\/\//,'')}</bdi></a>}</div><bdi className="si-amount">{money(Number(a.fee||0))}</bdi></li>)}</ol></section>
  {d.invoice&&<section className="si-card si-done"><CheckCircle2 size={20} aria-hidden="true"/><div><b>חשבונית {d.invoice.number} התקבלה</b><span>ב־{day(d.invoice.uploaded_at)} · סה״כ <bdi>{money(d.invoice.total)}</bdi> כולל מע״מ</span></div></section>}
  {!d.paid&&<form className="si-card si-form" noValidate onSubmit={submit}>
   <h2>{d.invoice?'החלפת החשבונית':'הוספת חשבונית'}</h2>
   {done&&<p className="si-ok" role="status"><CheckCircle2 size={16} aria-hidden="true"/>החשבונית נשלחה. תודה!</p>}
   <label className={'si-drop'+(file?' has-file':'')}><FileUp size={22} aria-hidden="true"/><span>{file?file.name:'בחירת קובץ PDF של החשבונית'}</span><small>עד 10MB</small><input type="file" accept="application/pdf" onChange={e=>{setFile(e.target.files?.[0]||null);setDone(false);}}/></label>
   <div className="si-grid"><label>מספר חשבונית<input value={number} maxLength={100} onChange={e=>setNumber(e.target.value)}/></label><label>מע״מ בחשבונית (₪)<input inputMode="decimal" value={vat} placeholder={String(Math.round(d.net*0.18)/100)} onChange={e=>setVat(e.target.value.replace(/[^\d.]/g,''))}/></label></div>
   {error&&<p className="si-error" role="alert">{error}</p>}
   <div className="si-foot"><span className={missing?'':'is-ready'}>{missing?'חסר: '+missing:'מוכן לשליחה'}</span><button type="submit" disabled={busy}>{busy?'שולח…':d.invoice?'שליחת החשבונית המעודכנת':'שליחת החשבונית'}</button></div>
  </form>}
  <p className="si-note">הקישור אישי לחודש הזה. אין צורך בהרשמה למערכת.</p>
 </main>;
}
