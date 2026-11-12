'use client';
import React,{useState} from 'react';
import {Download,MailMinus,Megaphone,LoaderCircle} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Textarea} from '@/components/ui/textarea';
import {useData,api} from '@/lib/client';
import {type Row,when} from '@/lib/shared';
import {downloadAdminWorkbook} from './admin-export';
import {type Ctx,ErrorBox} from './workspace';
import './admin-marketing-list.css';

// The newsletter list in "התראות ודיוור": who agreed to marketing email, export for the external mailing tool, and
// removal of addresses that unsubscribed there. The law's four sending rules are listed once, short.
const SOURCES:Row={checkout:'בתשלום',account:'בהגדרות',admin:'מנהל'};
export default function AdminMarketingList({ctx}:{ctx:Ctx}){
 const state=useData('admin/marketing',ctx.revision),list:Row[]=state.data?.subscribers||[];
 const [text,setText]=useState(''),[busy,setBusy]=useState(''),[error,setError]=useState(''),[result,setResult]=useState<Row|null>(null);
 const exportList=async()=>{setBusy('export');setError('');try{await downloadAdminWorkbook('admin/marketing/export','megalinks-newsletter-'+new Date().toISOString().slice(0,10)+'.csv');}catch(e){setError((e as Error).message);}finally{setBusy('');}};
 const remove=async()=>{if(!text.trim())return;setBusy('remove');setError('');setResult(null);try{const out=await ctx.run(()=>api('admin/marketing/remove','POST',{text}),'הרשימה עודכנה');setResult(out);setText('');}catch(e){setError((e as Error).message);}finally{setBusy('');}};
 return <section className="panel admin-marketing" aria-labelledby="admin-marketing-title">
  <div className="admin-marketing-head">
   <div><h2 id="admin-marketing-title"><Megaphone size={20} aria-hidden="true"/>רשימת דיוור שיווקי</h2><p>לקוחות שאישרו לקבל עדכונים ומבצעים במייל.</p></div>
   <div className="admin-marketing-count"><strong>{state.data?list.length:'…'}</strong><span>רשומים</span>{!!state.data?.unsubscribed&&<small>{state.data.unsubscribed} הוסרו</small>}</div>
  </div>
  <ul className="admin-marketing-rules" aria-label="חובה בכל מייל שיווקי">
   <li>נושא שמתחיל ב<b>"פרסומת"</b></li><li>שם העסק, כתובת ודרך ליצירת קשר</li><li>קישור הסרה שעובד</li><li>שליחה רק לרשימה העדכנית מכאן</li>
  </ul>
  <ErrorBox error={state.error||error}/>
  <div className="admin-marketing-actions">
   <Button onClick={exportList} disabled={!!busy||!list.length}>{busy==='export'?<LoaderCircle size={16} className="animate-spin"/>:<Download size={16}/>}ייצוא לכלי הדיוור (CSV)</Button>
  </div>
  {list.length>0&&<details className="admin-marketing-table"><summary>הצגת הרשימה</summary><table><thead><tr><th scope="col">מייל</th><th scope="col">שם</th><th scope="col">אישור</th><th scope="col">איפה</th></tr></thead><tbody>{list.slice(0,200).map(row=><tr key={row.email}><td><bdi>{row.email}</bdi></td><td>{row.name}</td><td>{when(row.subscribed_at)}</td><td>{SOURCES[row.source]||row.source}</td></tr>)}</tbody></table>{list.length>200&&<p className="muted small">מוצגים 200 ראשונים. הקובץ כולל את כולם.</p>}</details>}
  <div className="admin-marketing-remove">
   <label htmlFor="admin-marketing-remove"><MailMinus size={17} aria-hidden="true"/>הסרת כתובות שביקשו להפסיק</label>
   <p>מדביקים כתובות שהוסרו בכלי הדיוור, או שביקשו הסרה בטלפון או בתשובה "הסר".</p>
   <Textarea id="admin-marketing-remove" dir="ltr" rows={3} value={text} disabled={!!busy} placeholder="name@example.com" onChange={e=>setText(e.target.value)}/>
   <Button variant="outline" onClick={remove} disabled={!!busy||!text.trim()}>{busy==='remove'?<LoaderCircle size={16} className="animate-spin"/>:<MailMinus size={16}/>}הסרה מהרשימה</Button>
   {result&&<p role="status" className="admin-marketing-result">נבדקו {result.checked}, הוסרו {result.removed}.{result.unknown?.length?<> לא נמצאו: <bdi>{result.unknown.join(', ')}</bdi></>:null}</p>}
  </div>
 </section>;
}
