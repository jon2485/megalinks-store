'use client';
import React,{useEffect,useMemo,useRef,useState} from 'react';
import {ArrowRight,Download,Eye,FileText,Loader2,Lock,Plus,Printer,Send,Sparkles,Trash2,X} from 'lucide-react';
import {toast} from 'sonner';
import {api,useData} from '@/lib/client';
import type {Row} from '@/lib/shared';
import type {Ctx} from './workspace';
import './price-quotes.css';

// "הצעות מחיר" (owner 27.11.2026, mockups design/quotes 1-5): a free chat with Claude about one customer's quote, and
// beside it the quote itself. The cost and profit columns are the admin's only; the customer's document is built by
// the server from its own fields.
const STATUS:Record<string,[string,string]>={draft:['טיוטה','gray'],sent:['נשלחה','blue'],accepted:['אושרה, בסל','green'],ordered:['הוזמנה','green'],declined:['הלקוח הסיר מהסל','amber'],expired:['פג תוקף','amber'],revising:['בעריכה, עוד לא נשלחה מחדש','amber'],cancelled:['בוטלה','gray']};
// Whole shekels without ".00", so the table stays narrow.
const money=(cents:number)=>'₪'+(Math.round(cents)/100).toLocaleString('he-IL',{maximumFractionDigits:2});
const dateHe=(iso?:string|null)=>iso?new Intl.DateTimeFormat('he-IL',{day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(iso)):'';
const Pill=({status}:{status:string})=>{const [label,tone]=STATUS[status]||[status,'gray'];return <span className={'pq-pill is-'+tone}>{label}</span>;};

export default function PriceQuotes({ctx}:{ctx:Ctx}){
 const [open,setOpen]=useState('');
 return open?<QuoteEditor ctx={ctx} id={open} onBack={()=>{setOpen('');ctx.refresh();}}/>:<QuoteList ctx={ctx} onOpen={setOpen}/>;
}

function QuoteList({ctx,onOpen}:{ctx:Ctx;onOpen:(id:string)=>void}){
 const state=useData('admin/quotes',ctx.revision);
 const [who,setWho]=useState(''),[target,setTarget]=useState(''),[budget,setBudget]=useState(''),[busy,setBusy]=useState(false);
 const customers:Row[]=state.data?.customers||[],quotes:Row[]=state.data?.quotes||[];
 const label=(c:Row)=>(c.name||c.email)+(c.company?' · '+c.company:'')+' · '+c.email;
 const picked=useMemo(()=>customers.find(c=>label(c)===who)||null,[customers,who]);
 const create=async(e:React.FormEvent)=>{e.preventDefault();if(busy)return;if(!picked){toast.error('בחרו לקוח מהרשימה');return;}setBusy(true);
  try{const q=await api('admin/quotes','POST',{customer_id:picked.id,target_url:target,budget_ils:Number(budget)||0},{background:true});onOpen(q.id);}catch(err){toast.error((err as Error).message);}finally{setBusy(false);}};
 return <div className="pq" dir="rtl">
  <header className="pq-head"><div><h1>הצעות מחיר</h1><p>בוחרים לקוח, מתכתבים עם Claude על האתרים והמחירים, ושולחים ללקוח הצעה עם כפתור אישור.</p></div></header>
  <form className="pq-card pq-new" onSubmit={create}>
   <label className="pq-f pq-f-wide"><span>לקוח</span><input list="pq-customers" value={who} onChange={e=>setWho(e.target.value)} placeholder="התחילו להקליד שם או מייל"/><datalist id="pq-customers">{customers.map(c=><option key={c.id} value={label(c)}/>)}</datalist></label>
   <label className="pq-f"><span>האתר של הלקוח</span><input dir="ltr" value={target} onChange={e=>setTarget(e.target.value)} placeholder="example.co.il"/></label>
   <label className="pq-f pq-f-narrow"><span>תקציב (₪)</span><input type="number" min={0} step={100} value={budget} onChange={e=>setBudget(e.target.value)}/></label>
   <button type="submit" className="pq-btn" disabled={busy}>{busy?<Loader2 className="pq-spin" size={18}/>:<Plus size={18}/>}הצעה חדשה</button>
  </form>
  <section className="pq-card pq-listcard">{state.loading&&!state.data?<p className="pq-empty">טוענים…</p>:!quotes.length?<p className="pq-empty">עוד אין הצעות מחיר. בחרו לקוח למעלה כדי להתחיל.</p>:
   <div className="pq-scroll"><table className="pq-t"><thead><tr><th>מס׳</th><th>לקוח</th><th>לאתר</th><th>אתרים</th><th>סה״כ</th><th>מצב</th><th>בתוקף עד</th><th><span className="sr-only">פתיחה</span></th></tr></thead>
    <tbody>{quotes.map(q=><tr key={q.id}><td><b>{q.number}</b></td><td><b>{q.customer_name||'—'}</b><small>{q.customer_email}</small></td><td><bdi dir="ltr">{q.target_url||'—'}</bdi></td><td>{q.count}</td><td>{q.count?money(q.total_cents):'—'}</td><td><Pill status={q.status}/></td><td>{dateHe(q.expires)||'—'}</td><td><button type="button" className="pq-btn is-white is-small" onClick={()=>onOpen(q.id)}>פתיחה</button></td></tr>)}</tbody></table></div>}
  </section>
 </div>;
}

// A Claude answer: paragraphs, and Markdown tables as real tables. Text only, nothing is rendered as HTML.
function Answer({text}:{text:string}){
 const blocks:React.ReactNode[]=[];let rows:string[][]=[],para:string[]=[];
 const flush=()=>{if(para.length){blocks.push(<p key={blocks.length}>{para.join('\n')}</p>);para=[];}if(rows.length){const [head,...body]=rows;blocks.push(<table key={blocks.length}><thead><tr>{head.map((c,i)=><th key={i}>{c}</th>)}</tr></thead><tbody>{body.map((r,i)=><tr key={i}>{r.map((c,j)=><td key={j}>{c}</td>)}</tr>)}</tbody></table>);rows=[];}};
 for(const raw of text.split('\n')){const line=raw.trim();
  if(/^\|.*\|$/.test(line)){if(para.length)flush();if(!/^\|[\s:|-]+\|$/.test(line))rows.push(line.slice(1,-1).split('|').map(c=>c.trim().replace(/\*\*/g,'')));}
  else{if(rows.length)flush();if(line)para.push(line.replace(/\*\*/g,''));else flush();}}
 flush();return <>{blocks}</>;
}

function QuoteEditor({ctx,id,onBack}:{ctx:Ctx;id:string;onBack:()=>void}){
 const state=useData('admin/quotes/'+id,0);
 const [q,setQ]=useState<Row|null>(null),[text,setText]=useState(''),[thinking,setThinking]=useState(false),[pending,setPending]=useState(''),[busy,setBusy]=useState(''),[preview,setPreview]=useState(''),[confirmSend,setConfirmSend]=useState(false),[prices,setPrices]=useState<Record<string,string>>({}),[daysText,setDaysText]=useState('');
 const end=useRef<HTMLDivElement>(null),frame=useRef<HTMLIFrameElement>(null);
 useEffect(()=>{if(state.data)setQ(state.data);},[state.data]);
 useEffect(()=>{if(q){setPrices(Object.fromEntries(q.items.map((i:Row)=>[i.website_id,String(i.price_cents/100)])));setDaysText(String(q.days));}},[q]);
 useEffect(()=>{end.current?.scrollIntoView({block:'end'});},[q?.messages?.length,thinking]);
 if(state.error&&!q)return <div className="pq" dir="rtl"><p className="pq-empty">{state.error}</p><button type="button" className="pq-btn is-white" onClick={onBack}>חזרה</button></div>;
 if(!q)return <div className="pq" dir="rtl"><p className="pq-empty">טוענים…</p></div>;
 const locked=!['draft','sent','expired','declined','accepted','revising'].includes(q.status);
 const say=async(e?:React.FormEvent)=>{e?.preventDefault();const message=text.trim();if(!message||thinking||locked)return;setText('');setPending(message);setThinking(true);
  try{setQ(await api('admin/quotes/'+id+'/chat','POST',{message},{background:true}));}catch(err){toast.error((err as Error).message);setText(message);}finally{setThinking(false);setPending('');}};
 const patch=async(body:Row,key:string)=>{setBusy(key);try{setQ(await api('admin/quotes/'+id,'PATCH',body,{background:true}));}catch(err){toast.error((err as Error).message);setQ(x=>x?{...x}:x);}finally{setBusy('');}};
 const items=(change:(list:Row[])=>Row[])=>patch({items:change(q.items.map((i:Row)=>({website_id:i.website_id,price_cents:i.price_cents})))},'items');
 const savePrice=(wid:string)=>{const cents=Math.round(Number(prices[wid])*100),now=q.items.find((i:Row)=>i.website_id===wid)?.price_cents;if(!Number.isFinite(cents)||cents<=0){setPrices(p=>({...p,[wid]:String(now/100)}));return;}if(cents!==now)void items(list=>list.map(i=>i.website_id===wid?{...i,price_cents:cents}:i));};
 const saveDays=()=>{const n=Math.floor(Number(daysText));if(!n||n<1||n>90){setDaysText(String(q.days));return;}if(n!==q.days)void patch({days:n},'days');};
 const showPreview=async()=>{setBusy('preview');try{setPreview((await api('admin/quotes/'+id+'/preview','GET',undefined,{background:true})).html);}catch(err){toast.error((err as Error).message);}finally{setBusy('');}};
 const send=async()=>{setBusy('send');try{setQ(await api('admin/quotes/'+id+'/send','POST',{},{background:true}));setConfirmSend(false);toast.success('ההצעה נשלחה ל־'+q.customer.email);}catch(err){toast.error((err as Error).message);}finally{setBusy('');}};
 const until=q.expires||new Date(Date.now()+q.days*86400000).toISOString();
 return <div className="pq" dir="rtl">
  <header className="pq-head"><div><button type="button" className="pq-back" onClick={onBack}><ArrowRight size={16}/>כל ההצעות</button><h1>הצעה מס׳ {q.number} <Pill status={q.status}/></h1><p>{q.customer.name} · {q.customer.email}</p></div><span className="pq-pill is-green"><Sparkles size={14}/>Claude Opus 5.5</span></header>
  <div className="pq-cols">
   <section className="pq-card pq-chat" aria-label="שיחה עם Claude">
    <div className="pq-msgs" aria-live="polite">
     {!q.messages.length&&!pending&&<div className="pq-hint"><b>כתבו חופשי, למשל:</b><span>״אני מחפש 5 אתרי ספורט עד 600 ₪ לאתר, בתקציב 2,500״</span><span>״ביז פורטל, וואלה בריאות ומאקו. כמה זה במחירון שלו וכמה עולה לי?״</span><span>״תן את ביז פורטל ב־920 ועל השאר תוריד בערך 6%״</span></div>}
     {q.messages.map((m:Row,i:number)=>m.role==='assistant'?<div key={i} className="pq-ai"><b className="pq-who"><Sparkles size={13}/>Claude</b><Answer text={m.text}/></div>:<div key={i} className="pq-me">{m.text}</div>)}
     {pending&&<div className="pq-me">{pending}</div>}
     {thinking&&<div className="pq-ai is-wait" role="status"><Loader2 className="pq-spin" size={16}/>Claude בודק במערכת…</div>}
     <div ref={end}/>
    </div>
    <form className="pq-in" onSubmit={say}><textarea value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();void say();}}} rows={2} maxLength={4000} disabled={locked} placeholder={locked?'ההצעה סגורה לשינויים':'כתבו הודעה ל-Claude'} aria-label="הודעה ל-Claude"/><button type="submit" className="pq-btn" disabled={thinking||locked||!text.trim()}>{thinking?<Loader2 className="pq-spin" size={18}/>:<Send size={18}/>}שליחה</button></form>
   </section>
   <section className="pq-card pq-quote" aria-label="ההצעה">
    <div className="pq-meta">
     <div><small>לאתר</small><b><bdi dir="ltr">{q.target_url||'—'}</bdi></b></div>
     <div><small>תקציב</small><b>{q.budget_ils?money(q.budget_ils*100):'—'}</b></div>
     <div><small>כמות אתרים</small><b>{q.items.length}</b></div>
     <label className="is-edit"><small>תוקף (ימים)</small><span><input type="number" min={1} max={90} value={daysText} disabled={locked||busy==='days'} onChange={e=>setDaysText(e.target.value)} onBlur={saveDays} onKeyDown={e=>{if(e.key==='Enter')(e.target as HTMLInputElement).blur();}}/><em>עד {dateHe(until)}</em></span></label>
    </div>
    {!q.items.length?<p className="pq-empty">עוד אין אתרים בהצעה. בקשו מ-Claude למצוא אתרים, או תנו לו רשימה.</p>:<div className="pq-scroll"><table className="pq-t pq-items"><thead><tr><th>אתר</th><th>מחירון הלקוח</th><th className="is-own">עלות שלך</th><th>מחיר בהצעה</th><th className="is-own">רווח</th><th><span className="sr-only">הסרה</span></th></tr></thead>
     <tbody>{q.items.map((i:Row)=><tr key={i.website_id} className={i.below_cost?'is-below':''}><td><b>{i.name}</b><small><bdi dir="ltr">{String(i.url).replace(/^https?:\/\/(www\.)?/,'').replace(/\/$/,'')}</bdi>{!i.active&&' · לא פעיל'}</small></td><td><s>{money(i.list_cents)}</s>{i.base_cents>i.list_cents&&<small>מקורי {money(i.base_cents)}</small>}</td><td className="is-own">{i.cost_cents===null?'—':money(i.cost_cents)}</td>
      <td><span className="pq-price">₪<input type="number" min={1} step={10} aria-label={'מחיר בהצעה עבור '+i.name} value={prices[i.website_id]??''} disabled={locked||busy==='items'} onChange={e=>setPrices(p=>({...p,[i.website_id]:e.target.value}))} onBlur={()=>savePrice(i.website_id)} onKeyDown={e=>{if(e.key==='Enter')(e.target as HTMLInputElement).blur();}}/></span></td>
      <td className={'is-own pq-gain'+(i.below_cost?' is-bad':'')}>{i.profit_cents===null?'—':money(i.profit_cents)}</td><td>{!locked&&<button type="button" className="pq-x" aria-label={'הסרת '+i.name+' מההצעה'} disabled={busy==='items'} onClick={()=>void items(list=>list.filter(x=>x.website_id!==i.website_id))}><Trash2 size={16}/></button>}</td></tr>)}</tbody>
     <tfoot><tr><td>סה״כ</td><td><s>{money(q.totals.list_cents)}</s></td><td className="is-own">{q.totals.cost_known?money(q.totals.cost_cents):'—'}</td><td>{money(q.totals.price_cents)}</td><td className="is-own pq-gain">{q.totals.cost_known?money(q.totals.profit_cents):'—'}</td><td/></tr></tfoot></table></div>}
    {q.items.some((i:Row)=>i.below_cost)&&<p className="pq-note is-bad" role="alert">יש אתר שהמחיר שלו בהצעה נמוך מהעלות שלך.</p>}
    {q.budget_ils>0&&q.totals.price_cents>q.budget_ils*100&&<p className="pq-note is-bad">ההצעה גבוהה מהתקציב ב־{money(q.totals.price_cents-q.budget_ils*100)}.</p>}
    <p className="pq-note"><Lock size={15}/>העמודות הצהובות (עלות ורווח) נראות רק לכם. הן לא נכנסות למסמך ולא למייל של הלקוח.</p>
    <div className="pq-acts">
     <button type="button" className="pq-btn is-white" disabled={!q.items.length||!!busy} onClick={()=>void showPreview()}>{busy==='preview'?<Loader2 className="pq-spin" size={18}/>:<Eye size={18}/>}תצוגה מקדימה</button>
     <a className={'pq-btn is-white'+(!q.items.length?' is-off':'')} href={'/api/admin/quotes/'+id+'/pdf'} download aria-disabled={!q.items.length}><Download size={18}/>הורדת PDF</a>
     {!locked&&(confirmSend?<><button type="button" className="pq-btn is-orange" disabled={!!busy} onClick={()=>void send()}>{busy==='send'?<Loader2 className="pq-spin" size={18}/>:<Send size={18}/>}כן, לשלוח ל־{q.customer.email}</button><button type="button" className="pq-btn is-white" onClick={()=>setConfirmSend(false)}>ביטול</button></>
      :<button type="button" className="pq-btn is-orange" disabled={!q.items.length||!!busy} onClick={()=>setConfirmSend(true)}><Send size={18}/>{q.status==='draft'?'שליחה במייל ללקוח':'שליחת ההצעה המתוקנת'}</button>)}
    </div>
    {q.status==='revising'&&<p className="pq-note is-bad" role="status">ההצעה שונתה אחרי שנשלחה. הגרסה הקודמת כבר לא תקפה אצל הלקוח. שלחו מחדש כדי שיקבל את ההצעה המתוקנת.</p>}
    {q.status==='accepted'&&<p className="pq-note">הלקוח אישר את ההצעה והיא בסל שלו. שינוי של אתר או מחיר יוציא את אתרי ההצעה מהסל שלו, עד שתשלחו את ההצעה המתוקנת והוא יאשר שוב.</p>}
    {q.status==='sent'&&<p className="pq-note">נשלחה ב־{dateHe(q.sent_at)}, עם קובץ PDF מצורף. הלקוח יקבל תזכורת 24 שעות לפני סוף התוקף.</p>}
   </section>
  </div>
  {preview&&<div className="pq-scrim" onMouseDown={e=>{if(e.target===e.currentTarget)setPreview('');}}><div className="pq-preview" role="dialog" aria-modal="true" aria-label="תצוגה מקדימה של ההצעה"><header><b><FileText size={18}/>כך הלקוח יראה את ההצעה</b><span><button type="button" className="pq-btn is-white is-small" onClick={()=>frame.current?.contentWindow?.print()}><Printer size={16}/>הדפסה / שמירה כ-PDF</button><button type="button" className="pq-x" aria-label="סגירה" onClick={()=>setPreview('')}><X size={18}/></button></span></header><iframe ref={frame} title="הצעת המחיר" sandbox="allow-same-origin allow-modals" srcDoc={preview}/></div></div>}
 </div>;
}
