'use client';
import React,{useEffect,useRef,useState} from 'react';
import {Search,Users,FileText,Wallet,Settings,Tag,ShieldCheck,UserRound,ArrowRight,X} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {useData,api} from '@/lib/client';
import {money,type Row} from '@/lib/shared';
import {Field,Pick,ErrorBox,type Ctx} from './workspace';
import {ActionForm} from './screens';
const roleNames:Row={customer:'לקוח',agency:'סוכנות',supplier:'ספק',admin:'מנהל'};
function UserSettings({ctx,user,close}:{ctx:Ctx;user:Row;close:()=>void}){
 const [role,setRole]=useState(user.role);
 return <section className="users-settings"><Field label="תפקיד והרשאות"><Pick value={role} onChange={setRole} options={{customer:'לקוח',agency:'סוכנות',supplier:'ספק',admin:'מנהל מערכת'}}/></Field><ActionForm initial={user} fields={[["name","שם מלא","text"],["phone","טלפון","tel"],["company","חברה / סוכנות","text"]]} submit={b=>ctx.run(()=>api('admin/users/'+user.id,'PATCH',{...b,role}),'פרטי הלקוח והרשאותיו עודכנו').then(close)}/><div className="users-settings-finance"><h3>פעולות בחשבון</h3><Button variant="outline" onClick={()=>ctx.open({kind:'admin-finance',title:'מסגרת חשבון חודשי — '+user.name,description:'הגדרת מסגרת והרשאה לרכישה בחשבון חודשי',render:(done:()=>void)=><MonthlyPermission ctx={ctx} user={user} close={done}/>})}>מסגרת חשבון חודשי</Button><Button variant="outline" onClick={()=>ctx.open({kind:'admin-finance',title:'עדכון יתרת קרדיט — '+user.name,description:'סכום שלילי מפחית יתרה. נדרשת אסמכתא ייחודית לכל פעולה.',render:(done:()=>void)=><ActionForm fields={[["amount","סכום התנועה (₪)","number"],["reason","סיבת העדכון","text"],["reference","אסמכתא ייחודית","text"]]} submit={b=>ctx.run(()=>api('credits','POST',{...b,user_id:user.id}),'יתרת הקרדיט עודכנה').then(done)} label="אישור עדכון יתרה"/>})}>תנועת קרדיט ידנית</Button></div></section>;
}
function MonthlyPermission({ctx,user,close}:{ctx:Ctx;user:Row;close:()=>void}){const[enabled,setEnabled]=useState(!!user.monthly_enabled);return <div className="users-settings"><label className="payment-report-confirm"><input type="checkbox" checked={enabled} onChange={e=>setEnabled(e.target.checked)}/>הרשאה לחשבון חודשי</label><ActionForm fields={[["limit_ils","מסגרת מאושרת (₪)","number"]]} initial={{limit_ils:Number(user.credit_limit||0)/100}} submit={b=>ctx.run(()=>api('admin/credit-accounts','PATCH',{...b,user_id:user.id,enabled}),'המסגרת והרשאת החשבון נשמרו').then(close)}/></div>;}
function ClientActions({ctx,user}:{ctx:Ctx;user:Row}){return <div className="client-action-grid"><Button onClick={()=>ctx.go('admin-customer-account/'+user.id)}><FileText size={20}/>הזמנות וכתבות</Button><Button onClick={()=>ctx.go('admin-customer-account/'+user.id+'/payments')}><Wallet size={20}/>תשלומים</Button><Button variant="outline" onClick={()=>ctx.go('admin-pricebook/'+user.id)}><Tag size={20}/>מחירון אישי</Button><Button variant="outline" onClick={()=>ctx.open({kind:'admin-finance',title:'פרטים והרשאות — '+user.name,description:user.email,render:(close:()=>void)=><UserSettings ctx={ctx} user={user} close={close}/>})}><Settings size={20}/>פרטים והרשאות</Button></div>;}
function ClientBalances({user}:{user:Row}){return <div className="client-balance-grid"><div><span>קרדיט בארנק</span><strong>{money(user.credits||0)}</strong></div><div><span>חוב חודשי לתשלום</span><strong>{money(user.monthly_balance||0)}</strong></div></div>;}
export default function UsersAdmin({ctx}:{ctx:Ctx}){
 const state=useData('admin/users',ctx.revision,true,15000),[search,setSearch]=useState(''),[role,setRole]=useState('all'),[selected,setSelected]=useState('');const all:Row[]=state.data?.users||[];const rows=all.filter(u=>(role==='all'||u.role===role)&&[u.name,u.email,u.company,u.phone].some(v=>String(v||'').toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())));const user=all.find(u=>u.id===selected)||rows[0];
 const [detailsOpen,setDetailsOpen]=useState(false);
 const searchInput=useRef<HTMLInputElement>(null),detailsHeading=useRef<HTMLHeadingElement>(null),userList=useRef<HTMLDivElement>(null);
 useEffect(()=>{if(detailsOpen)detailsHeading.current?.focus();},[detailsOpen,selected]);
 const backToUsers=()=>{setDetailsOpen(false);requestAnimationFrame(()=>userList.current?.querySelector<HTMLButtonElement>('button[aria-pressed="true"]')?.focus());};
 return <section className={'users-admin admin-foundation-users'+(detailsOpen?' is-detail-open':'')} dir="rtl">
  <header className="users-admin-heading"><h1><Users size={25} aria-hidden="true"/>משתמשים והרשאות</h1><p>בחרו חשבון לצפייה ביתרות, בהזמנות ובהרשאות שלו.</p></header>
  <div className="users-search-controls">
   <label className="users-search"><Search size={20} aria-hidden="true"/><Input ref={searchInput} aria-label="חיפוש לקוח לפי שם, מייל או טלפון" placeholder="חיפוש לפי שם, מייל, חברה או טלפון" value={search} onChange={e=>{setSearch(e.target.value);setSelected('');}}/>{search&&<button type="button" className="admin-foundation-clear" aria-label="ניקוי חיפוש משתמשים" onClick={()=>{setSearch('');setSelected('');searchInput.current?.focus();}}><X size={17} aria-hidden="true"/></button>}</label>
   <div className="users-role-filters" role="group" aria-label="סינון לפי סוג חשבון">{[['all','הכל'],['customer','לקוחות'],['agency','סוכנויות'],['supplier','ספקים'],['admin','מנהלים']].map(([key,label])=><button type="button" key={key} aria-pressed={role===key} onClick={()=>{setRole(key);setSelected('');}}>{label}</button>)}</div>
   <p aria-live="polite">{rows.length} חשבונות בתצוגה</p>
  </div>
  <ErrorBox error={state.error}/>
  {state.loading&&!state.data?<p role="status">טוען חשבונות לקוח…</p>:!rows.length?<p className="users-no-results">לא נמצאו לקוחות מתאימים. נסו שם, מייל או מספר טלפון אחר.</p>:<div className="users-admin-layout">
   <div className="admin-foundation-user-list"><h2>רשימת משתמשים <span>{rows.length}</span></h2><div ref={userList} className="users-list" role="group" aria-label="רשימת לקוחות">{rows.map(u=><article key={u.id} className={'user-list-card '+(user?.id===u.id?'selected':'')}><button type="button" className="user-select" aria-pressed={user?.id===u.id} aria-controls="admin-selected-user" onClick={()=>{setSelected(u.id);setDetailsOpen(true);}}><span className="client-avatar"><UserRound size={21} aria-hidden="true"/></span><span><strong>{u.name}</strong><bdi>{u.email}</bdi>{u.company&&<span>{u.company}</span>}</span><span className="client-role">{roleNames[u.role]||u.role}</span></button></article>)}</div></div>
   {user&&<aside id="admin-selected-user" className="client-selected-panel" aria-labelledby="admin-selected-user-heading">
    <button type="button" className="admin-foundation-users-back" onClick={backToUsers}><ArrowRight size={18} aria-hidden="true"/>חזרה לרשימת המשתמשים</button>
    <header><span className="client-avatar"><UserRound size={30} aria-hidden="true"/></span><div><h2 id="admin-selected-user-heading" ref={detailsHeading} tabIndex={-1}>{user.name}</h2><p><bdi>{user.email}</bdi></p>{user.phone&&<a href={'tel:'+user.phone}><bdi>{user.phone}</bdi></a>}</div><span className="client-role">{roleNames[user.role]}</span></header>
    <div className="admin-foundation-user-detail-body">
     {user.pending_payment_reports>0&&<button className="client-report-badge" onClick={()=>ctx.go('admin-payment-reports')}><ShieldCheck size={18}/>{user.pending_payment_reports} דיווחי תשלום ממתינים לבדיקה</button>}
     <ClientBalances user={user}/><h3 className="admin-foundation-actions-heading">פעולות בחשבון</h3><ClientActions ctx={ctx} user={user}/>
     <div className="client-monthly-summary"><h3>חשבון חודשי</h3><p>{user.monthly_enabled?'מאושר לרכישה בחשבון חודשי':'ללא הרשאה לחשבון חודשי'}</p><p>מסגרת מאושרת: <strong>{money(user.credit_limit||0)}</strong></p><p>מסגרת פנויה: <strong>{money(Math.max(0,Number(user.credit_limit||0)-Number(user.monthly_balance||0)))}</strong></p></div>
    </div>
   </aside>}
  </div>}
 </section>;
}
