'use client';
import React,{useState} from 'react';
import {Check,Copy,CreditCard,Loader2,Plug,TriangleAlert,Webhook,X} from 'lucide-react';
import {toast} from 'sonner';
import {api} from '@/lib/client';
import type {Row} from '@/lib/shared';
import type {Ctx} from './workspace';
import {ConnectionForm} from './screens';
import './payments-connection.css';

// "סליקה ותשלומים" (owner 27.11.2026, mockup in design/payplus): PayPlus or the original generic webhook.
// PayPlus keys are Railway variables only (one set per environment), so this window shows whether each one exists,
// the environment (test or live), the callback address to paste in the PayPlus panel, a connection test and saving.
const keys:[string,string,string][]=[['api_key','מפתח API','PAYPLUS_API_KEY'],['secret_key','מפתח סודי','PAYPLUS_SECRET_KEY'],['page_uid','מזהה דף התשלום','PAYPLUS_PAGE_UID']];

export function PaymentsConnectionForm({ctx,connection,close}:{ctx:Ctx;connection:Row;close:()=>void}){
 const [provider,setProvider]=useState<'payplus'|'webhook'>(connection.provider==='payplus'||!connection.url?'payplus':'webhook');
 const [enabled,setEnabled]=useState(connection.provider==='payplus'?!!connection.enabled:true);
 const [busy,setBusy]=useState<''|'save'|'test'>('');
 const [result,setResult]=useState<{ok:boolean;text:string}|null>(null);
 const pp:Row=connection.payplus||{},live=pp.environment==='production',ready=keys.every(([k])=>pp[k]);
 const callback=(typeof window!=='undefined'?window.location.origin:'')+'/api/payplus/callback';
 const copy=()=>{navigator.clipboard?.writeText(callback).then(()=>toast.success('הכתובת הועתקה'),()=>toast.error('לא הצלחנו להעתיק. אפשר לסמן ולהעתיק ידנית'));};
 const save=()=>{if(busy)return;setBusy('save');ctx.run(()=>api('admin/integration/payments','PATCH',{provider:'payplus',enabled}),'החיבור נשמר').then(close).catch(()=>{}).finally(()=>setBusy(''));};
 const test=()=>{if(busy)return;setBusy('test');setResult(null);
  api('admin/integration/payments','PATCH',{provider:'payplus',enabled})
   .then(()=>api('admin/integration/payments/test','POST',{}))
   .then((r:Row)=>setResult({ok:true,text:'PayPlus החזיר קישור לדף תשלום ב'+(r?.environment==='production'?'סביבה האמיתית':'סביבת הבדיקה')+'. לא בוצע שום חיוב.'}))
   .catch((e:Error)=>setResult({ok:false,text:e?.message||'הבדיקה נכשלה'}))
   .finally(()=>{setBusy('');ctx.refresh();});};
 return <div className="stack pp-form">
  <div className="pp-sec"><span className="pp-lbl" id="pp-provider">ספק הסליקה</span>
   <div className="pp-seg" role="radiogroup" aria-labelledby="pp-provider">
    <button type="button" role="radio" aria-checked={provider==='payplus'} className={provider==='payplus'?'on':''} onClick={()=>setProvider('payplus')}><CreditCard size={17} aria-hidden="true"/>PayPlus</button>
    <button type="button" role="radio" aria-checked={provider==='webhook'} className={provider==='webhook'?'on':''} onClick={()=>setProvider('webhook')}><Webhook size={17} aria-hidden="true"/>Webhook כללי</button>
   </div>
  </div>
  {provider==='webhook'?<ConnectionForm ctx={ctx} name="payments" connection={connection.provider==='payplus'?{...connection,enabled:false,has_secret:false,has_stored_secret:false}:connection} close={close}/>:<>
   <div className="pp-switch"><span><b id="pp-on">הפעלת התשלום באשראי</b><small>לקוחות ישלמו בדף המאובטח של PayPlus: אשראי, ביט, Apple Pay ו-Google Pay</small></span>
    <button type="button" role="switch" aria-checked={enabled} aria-labelledby="pp-on" className={'pp-tog'+(enabled?' on':'')} onClick={()=>setEnabled(v=>!v)}><i/></button></div>
   <div className="pp-keys"><header><b>מפתחות ב-Railway</b><span className={'pp-env'+(live?' is-live':'')}>{live?'סביבה אמיתית':'סביבת בדיקה'}</span></header>
    {keys.map(([k,label,env])=><div className="pp-key" key={k}><span className={pp[k]?'pp-ok':'pp-miss'} aria-hidden="true">{pp[k]?<Check size={14} strokeWidth={3}/>:<X size={14} strokeWidth={3}/>}</span><span><b>{label}</b><code>{env}</code></span><em className={pp[k]?'':'is-miss'}>{pp[k]?'מוגדר':'חסר'}</em></div>)}
    <p className="pp-note">המפתחות נכנסים ב-Railway, לכל סביבה בנפרד: ב-Staging מפתחות בדיקה, וב-Production מפתחות אמיתיים עם <bdi dir="ltr">PAYPLUS_ENV=production</bdi>. הם לא נשמרים ולא מוצגים כאן.</p>
   </div>
   {!ready&&<p className="pp-warn" role="status"><TriangleAlert size={16} aria-hidden="true"/><span>חסרים משתנים ב-Railway. אפשר לשמור עכשיו כבוי, ולהפעיל אחרי שמוסיפים אותם.</span></p>}
   <div className="pp-sec"><span className="pp-lbl">כתובת לאישור תשלומים</span>
    <div className="pp-cb"><code dir="ltr" title={callback}>{callback}</code><button type="button" className="pp-copy" onClick={copy}><Copy size={15} aria-hidden="true"/>העתקה</button></div>
    <p className="pp-hint">מדביקים אותה בפאנל של PayPlus, בהגדרות דף התשלום.</p>
   </div>
   {result&&<div className={'pp-res'+(result.ok?'':' is-fail')} role="status"><i aria-hidden="true">{result.ok?<Check size={15} strokeWidth={3}/>:<TriangleAlert size={15}/>}</i><span><b>{result.ok?'החיבור תקין':'הבדיקה נכשלה'}</b>{result.text}</span></div>}
   <div className="pp-acts">
    <button type="button" className="pp-test" onClick={test} disabled={!!busy||!ready} title={ready?undefined:'אפשר לבדוק אחרי שמגדירים את המשתנים ב-Railway'} aria-busy={busy==='test'||undefined}>{busy==='test'?<Loader2 className="om-spin" size={17} aria-hidden="true"/>:<Plug size={17} aria-hidden="true"/>}בדיקת חיבור</button>
    <button type="button" className="pp-save" onClick={save} disabled={!!busy} aria-busy={busy==='save'||undefined}>{busy==='save'?<Loader2 className="om-spin" size={17} aria-hidden="true"/>:<Check size={17} aria-hidden="true"/>}שמירה</button>
   </div>
  </>}
 </div>;
}
