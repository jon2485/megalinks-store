'use client';
import {AdminResponsiveTable} from '@/components/ui/table';
import React,{useState} from 'react';
import {Building2,CheckCircle2,Wallet,ChevronDown,ExternalLink} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {useData,api} from '@/lib/client';
import {money,when,type Row} from '@/lib/shared';
import {Heading,ErrorBox,Empty,Pick,type Ctx} from './workspace';
import {ActionForm} from './screens';
import {AdminWorkbench} from './admin-workbench';
import SiteReference from './site-reference';
function SupplierSettlementCards({ctx}:{ctx:Ctx}){
 const state=useData('supplier-finance',ctx.revision),[month,setMonth]=useState('');const rows=(state.data?.rows||[]).filter((r:Row)=>!month||r.month===month);
 return <section className="supplier-settlements" dir="rtl"><Heading title="פרסומים והתחשבנות ספקים" description="פירוט הפרסומים, הסכומים ששולמו והיתרה לכל ספק."/><label className="settlement-month">חודש התחשבנות<input type="month" value={month} onChange={e=>setMonth(e.target.value)}/>{month&&<Button variant="outline" onClick={()=>setMonth('')}>כל החודשים</Button>}</label><ErrorBox error={state.error}/>{state.loading&&!state.data&&<p role="status">טוען התחשבנות ספקים…</p>}<div className="settlement-grid">{rows.map((r:Row)=>{const paid=Number(r.payment?.amount_paid||0),due=Math.max(0,r.amount-paid);return <article className="settlement-card" key={r.id}><header><span className="settlement-icon"><Building2 size={25}/></span><div><h2>{r.supplier_name}</h2><p>{r.month} · {r.count} פרסומים</p></div><span className={'settlement-status '+(r.demo?'demo':due?'pending':'paid')}>{r.demo?'הדגמה':due?'ממתין לתשלום':r.payment?'שולם':'אין יתרה לתשלום'}</span></header><div className="settlement-amounts"><div><span>{r.demo?'סכום בהדגמה':'סה״כ לתשלום לספק'}</span><strong>{money(r.amount)}</strong></div><div><span>סכום ששולם</span><strong>{money(paid)}</strong></div><div className="settlement-due"><span>יתרה לתשלום</span><strong>{money(due)}</strong></div></div>{r.demo&&<p className="settlement-demo-note">רישום הדגמה בלבד — אינו יוצר חוב או תשלום כספי.</p>}{r.payment&&<div className="settlement-receipt"><CheckCircle2 size={18}/><span>אסמכתת תשלום: <bdi>{r.payment.reference}</bdi>{r.payment.paid_at&&<small>תועד ב־{when(r.payment.paid_at)}</small>}</span></div>}<details className="settlement-details"><summary><span>פירוט הפרסומים ({r.count})</span><ChevronDown size={18}/></summary>{r.articles.map((a:Row)=><div className="settlement-publication" key={a.id}><SiteReference name={a.website_name} url={a.website_url}/><p>{a.title||'ללא כותרת'}</p><div><span>עלות הפרסום: <b>{money(a.cost_cents)}</b></span>{a.url&&<a href={a.url} target="_blank" rel="noopener noreferrer"><ExternalLink size={14}/>לכתבה שפורסמה</a>}</div></div>)}</details>{ctx.adminMode&&due>0&&<Button className="settlement-pay" onClick={()=>ctx.open({kind:'admin-finance',title:r.demo?'תיעוד תשלום בהדגמה':'תיעוד תשלום לספק',description:r.supplier_name+' · '+r.month+' · '+money(due),render:(close:()=>void)=><ActionForm fields={[["reference","אסמכתת התשלום שבוצע","text"]]} submit={b=>ctx.run(()=>api('admin/supplier-payment','POST',{...b,settlement_key:r.id}),'התשלום תועד').then(close)}/>})}><Wallet size={18}/>{r.demo?'תיעוד תשלום בהדגמה':'תיעוד תשלום שבוצע'}</Button>}</article>;})}</div>{!state.loading&&!rows.length&&<Empty title="אין פרסומים בחודש שנבחר"/>}</section>;
}

export function SupplierSettlements({ctx}:{ctx:Ctx}){
 return ctx.adminMode&&ctx.user?.role==='admin'?<AdminSupplierSettlements ctx={ctx}/>:<SupplierSettlementCards ctx={ctx}/>;
}
function AdminSupplierSettlements({ctx}:{ctx:Ctx}){
 const state=useData('supplier-finance',ctx.revision),[month,setMonth]=useState(''),[supplier,setSupplier]=useState(''),[selected,setSelected]=useState('');
 const all:Row[]=state.data?.rows||[],rows=all.filter(r=>(!month||r.month===month)&&(!supplier||r.supplier_name===supplier));
 const row=rows.find(r=>r.id===selected)||rows[0];
 const due=(r:Row)=>Math.max(0,r.amount-Number(r.payment?.amount_paid||0));
 return <section className="supplier-settlements admin-settlements" dir="rtl">
  <Heading title="התחשבנות עם ספקים" description="פרסומים לפי חודש, עלות לספק ואסמכתאות לתשלומים שבוצעו."/>
  <div className="catalog-filters"><label className="settlement-month">חודש התחשבנות<input type="month" value={month} onChange={e=>{setMonth(e.target.value);setSelected('');}}/>{month&&<Button variant="outline" onClick={()=>{setMonth('');setSelected('');}}>כל החודשים</Button>}</label><label className="admin-settlement-supplier">ספק<Pick value={supplier||'all'} onChange={value=>{setSupplier(value==='all'?'':value);setSelected('');}} options={{all:'כל הספקים',...Object.fromEntries([...new Set(all.map(r=>r.supplier_name))].sort((a,b)=>a.localeCompare(b,'he')).map(name=>[name,name]))}}/></label></div>
  <ErrorBox error={state.error}/>
  <AdminWorkbench label="ספקים וחודשי התחשבנות" loading={state.loading} selectedId={row?.id||''} onSelect={setSelected} empty="אין פרסומים בחודש או אצל הספק שנבחר." items={rows.map(r=>({id:r.id,title:r.supplier_name,meta:r.month+' · '+r.count+' פרסומים',status:r.demo?'הדגמה':due(r)>0?'ממתין לתשלום':'אין יתרה לתשלום',attention:!r.demo&&due(r)>0}))}>
   {row&&<>
    <div className="settlement-amounts"><div><span>{row.demo?'סכום בהדגמה':'עלות הפרסומים לספק'}</span><strong><bdi>{money(row.amount)}</bdi></strong></div><div><span>סכום ששולם</span><strong><bdi>{money(Number(row.payment?.amount_paid||0))}</bdi></strong></div><div className={due(row)>0&&!row.demo?'settlement-due has-attention':'settlement-due'}><span>יתרה לתשלום</span><strong><bdi>{money(due(row))}</bdi></strong></div></div>
    {row.demo&&<p className="settlement-demo-note">רישום הדגמה בלבד — אינו יוצר חוב או תשלום כספי.</p>}
    <section className="admin-settlement-publications"><h3>פרסומים בחודש {row.month}</h3><div className="overflow-x-auto"><AdminResponsiveTable><thead><tr><th>אתר</th><th>כתבה</th><th>עלות לספק</th><th>פרסום</th></tr></thead><tbody>{row.articles.map((a:Row)=><tr key={a.id}><td><SiteReference name={a.website_name} url={a.website_url}/></td><td>{a.title||'ללא כותרת'}</td><td><bdi>{money(a.cost_cents)}</bdi></td><td>{a.url?<a href={a.url} target="_blank" rel="noopener noreferrer"><ExternalLink size={15}/>לכתבה שפורסמה</a>:'—'}</td></tr>)}</tbody></AdminResponsiveTable></div></section>
    <section className="admin-settlement-payment"><h3>תיעוד תשלום</h3>{row.payment?<div className="settlement-receipt"><CheckCircle2 size={18}/><span>אסמכתת תשלום: <bdi>{row.payment.reference}</bdi>{row.payment.paid_at&&<small>תועד ב־{when(row.payment.paid_at)}</small>}</span></div>:<p>לא תועד תשלום להתחשבנות זו.</p>}
    {due(row)>0&&<Button className="settlement-pay" onClick={()=>ctx.open({kind:'admin-finance',title:row.demo?'תיעוד תשלום בהדגמה':'תיעוד תשלום לספק',description:row.supplier_name+' · '+row.month+' · '+money(due(row)),render:(close:()=>void)=><ActionForm fields={[["reference","אסמכתת התשלום שבוצע","text"]]} submit={b=>ctx.run(()=>api('admin/supplier-payment','POST',{...b,settlement_key:row.id}),'התשלום תועד').then(close)}/>})}><Wallet size={18}/>{row.demo?'תיעוד תשלום בהדגמה':'תיעוד תשלום שבוצע'}</Button>}
    </section>
   </>}
  </AdminWorkbench>
 </section>;
}
