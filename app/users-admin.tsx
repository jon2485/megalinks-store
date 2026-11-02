'use client';
import React,{useState} from 'react';
import {Building2,ChevronLeft,Plus,FileText,History,PenLine,Settings,ShieldCheck,ShoppingCart,SlidersHorizontal,Tag,UserRound,Wallet} from 'lucide-react';
import {useData,api} from '@/lib/client';
import {exportSpreadsheet} from '@/lib/office';
import {money,type Row} from '@/lib/shared';
import {Field,Pick,type Ctx} from './workspace';
import {ActionForm} from './screens';
import {orderDateLabel} from './order-presentation';
import {openCustomerOrder} from './customer-account-admin';
import {OrderExport,OrderFilter,OrderPager,OrderRecord,OrderSearch,OrderViews,plainClick} from './order-list-parts';

const roleNames:Row={customer:'לקוח',agency:'סוכנות',supplier:'ספק',admin:'מנהל'};
const roleTones:Row={customer:'unreported',agency:'month',supplier:'work',admin:'cancelled'};
const accountsText=(n:number)=>n===1?'חשבון אחד':n+' חשבונות';
const available=(u:Row)=>Math.max(0,Number(u.credit_limit||0)-Number(u.monthly_balance||0));
function UserSettings({ctx,user,close}:{ctx:Ctx;user:Row;close:()=>void}){
 const [role,setRole]=useState(user.role);
 return <section className="users-settings"><Field label="סוג החשבון"><Pick value={role} onChange={setRole} options={{customer:'לקוח',agency:'סוכנות',supplier:'ספק',admin:'מנהל מערכת'}}/></Field><ActionForm initial={user} fields={[["name","שם מלא","text"],["phone","טלפון","tel"],["company","חברה / סוכנות","text"]]} submit={b=>ctx.run(()=>api('admin/users/'+user.id,'PATCH',{...b,role}),'פרטי החשבון והרשאותיו עודכנו').then(close)} label="שמירת הפרטים"/></section>;
}
function MonthlyPermission({ctx,user,close}:{ctx:Ctx;user:Row;close:()=>void}){const[enabled,setEnabled]=useState(!!user.monthly_enabled);return <div className="users-settings"><label className="payment-report-confirm"><input type="checkbox" checked={enabled} onChange={e=>setEnabled(e.target.checked)}/>הרשאה לרכישה בחשבון חודשי</label><ActionForm fields={[["limit_ils","מסגרת מאושרת (₪)","number"]]} initial={{limit_ils:Number(user.credit_limit||0)/100}} submit={b=>ctx.run(()=>api('admin/credit-accounts','PATCH',{...b,user_id:user.id,enabled}),'המסגרת והרשאת החשבון נשמרו').then(close)} label="שמירת המסגרת"/></div>;}
function CreditMovement({ctx,user,close}:{ctx:Ctx;user:Row;close:()=>void}){return <ActionForm fields={[["amount","סכום התנועה (₪)","number"],["reason","סיבת העדכון","text"],["reference","אסמכתא ייחודית","text"]]} submit={b=>ctx.run(()=>api('credits','POST',{...b,user_id:user.id}),'יתרת הקרדיט עודכנה').then(close)} label="אישור עדכון יתרה"/>;}
function UserPanel({ctx,user}:{ctx:Ctx;user:Row}){
 const account='admin-customer-account/'+user.id,go=(page:string)=>(e:React.MouseEvent)=>{if(!plainClick(e))return;e.preventDefault();ctx.go(page);};
 const link=(page:string,Icon:typeof FileText,label:React.ReactNode)=><a className="om-link" href={'/'+page} onClick={go(page)}><Icon size={16} aria-hidden="true"/><span>{label}</span><ChevronLeft size={15} aria-hidden="true"/></a>;
 const settings=()=>ctx.open({kind:'admin-finance',title:'פרטים והרשאות',description:user.name+' · '+user.email,render:(close:()=>void)=><UserSettings ctx={ctx} user={user} close={close}/>});
 const monthly=()=>ctx.open({kind:'admin-finance',title:'מסגרת חשבון חודשי',description:user.name,render:(close:()=>void)=><MonthlyPermission ctx={ctx} user={user} close={close}/>});
 const credit=()=>ctx.open({kind:'admin-finance',title:'תנועת קרדיט ידנית',description:'סכום שלילי מפחית יתרה. לכל פעולה נדרשת אסמכתא ייחודית.',render:(close:()=>void)=><CreditMovement ctx={ctx} user={user} close={close}/>});
 return <div className="om-panel om-user-panel" dir="rtl">
  <section className="om-payment"><h3>פרטי החשבון</h3><dl><div><dt>סוג החשבון</dt><dd>{roleNames[user.role]||user.role}</dd></div><div><dt>מייל</dt><dd><bdi>{user.email}</bdi></dd></div><div><dt>טלפון</dt><dd>{user.phone?<a href={'tel:'+user.phone}><bdi>{user.phone}</bdi></a>:'לא נמסר'}</dd></div><div><dt>חברה</dt><dd>{user.company||'לא נמסרה'}</dd></div><div><dt>רמת מחיר</dt><dd>{user.tier_name||'לקוחות רגילים'}</dd></div><div><dt>הצטרף</dt><dd><bdi>{orderDateLabel(user.created)}</bdi></dd></div></dl></section>
  <section className="om-payment"><h3>כספים</h3><dl><div><dt>קרדיט בארנק</dt><dd><bdi>{money(user.credits||0)}</bdi></dd></div><div><dt>חשבון חודשי</dt><dd>{user.monthly_enabled?'מאושר':'ללא הרשאה'}</dd></div><div><dt>חוב חודשי פתוח</dt><dd><bdi>{money(user.monthly_balance||0)}</bdi></dd></div><div><dt>מסגרת מאושרת</dt><dd><bdi>{money(user.credit_limit||0)}</bdi></dd></div><div><dt>מסגרת פנויה</dt><dd><bdi>{money(available(user))}</bdi></dd></div></dl>{Number(user.pending_payment_reports)>0&&<a className="om-link om-user-alert" href="/admin-payment-reports" onClick={go('admin-payment-reports')}><ShieldCheck size={16} aria-hidden="true"/><span>{Number(user.pending_payment_reports)===1?'דיווח תשלום ממתין לבדיקה':user.pending_payment_reports+' דיווחי תשלום ממתינים לבדיקה'}</span><ChevronLeft size={15} aria-hidden="true"/></a>}</section>
  <section className="om-customer"><h3>מעבר מהיר</h3>
   {link(account+'/orders',ShoppingCart,'הזמנות ותשלומים')}
   {link(account+'/articles',FileText,'כתבות')}
   {link(account+'/history',History,'היסטוריית פעולות')}
   {link('admin-pricebook/'+user.id,Tag,'מחירון אישי')}
   {user.supplier_id&&link('admin-supplier/'+user.supplier_id,Building2,'פרטי הספק והאתרים')}
  </section>
  <footer className="om-panel-foot"><a className="om-btn is-primary" href={'/'+account} onClick={go(account)}><UserRound size={17} aria-hidden="true"/>תיק לקוח</a><button type="button" className="om-btn" onClick={()=>openCustomerOrder(ctx,user.id,user.name)}><Plus size={17} aria-hidden="true"/>הזמנה עבור הלקוח</button><button type="button" className="om-btn" onClick={settings}><Settings size={17} aria-hidden="true"/>עריכת פרטים והרשאות</button><button type="button" className="om-btn" onClick={monthly}><PenLine size={17} aria-hidden="true"/>מסגרת חשבון חודשי</button><button type="button" className="om-btn" onClick={credit}><Wallet size={17} aria-hidden="true"/>תנועת קרדיט ידנית</button></footer>
 </div>;
}
export default function UsersAdmin({ctx}:{ctx:Ctx}){
 const state=useData('admin/users',ctx.revision,true,15000),[search,setSearch]=useState(''),[role,setRole]=useState('all'),[funds,setFunds]=useState('all'),[open,setOpen]=useState(''),[page,setPage]=useState(1);
 const all:Row[]=state.data?.users||[],term=search.trim().toLocaleLowerCase();
 const scoped=all.filter(u=>!term||[u.name,u.email,u.company,u.phone].some(v=>String(v||'').toLocaleLowerCase().includes(term)));
 const rows=scoped.filter(u=>(role==='all'||u.role===role)&&(funds==='all'||funds==='monthly'&&u.monthly_enabled||funds==='debt'&&Number(u.monthly_balance)>0||funds==='credit'&&Number(u.credits)>0||funds==='reports'&&Number(u.pending_payment_reports)>0)),shown=Math.min(page,Math.max(1,Math.ceil(rows.length/30)));
 const count=(r:string)=>scoped.filter(u=>u.role===r).length,reset=()=>{setPage(1);setOpen('');};
 const exportRows=()=>exportSpreadsheet('accounts.xlsx',[['שם','מייל','טלפון','חברה','סוג חשבון','רמת מחיר','קרדיט בארנק','חשבון חודשי','חוב חודשי','מסגרת מאושרת','הזמנות'],...rows.map(u=>[u.name,u.email,u.phone||'',u.company||'',roleNames[u.role]||u.role,u.tier_name||'',Number(u.credits||0)/100,u.monthly_enabled?'מאושר':'לא',Number(u.monthly_balance||0)/100,Number(u.credit_limit||0)/100,Number(u.order_count||0)])],'חשבונות');
 return <section className="orders-match-screen om-finance om-content om-users" dir="rtl">
  <header className="orders-unified-heading"><h1>לקוחות והרשאות</h1><p>כל החשבונות, היתרות וההרשאות במקום אחד.</p></header>
  <div className="om-top-actions"><OrderExport run={exportRows} disabled={!rows.length}/></div>
  <div className="orders-reference-panel">
   <div className="orders-reference-toolbar om-toolbar is-one"><OrderSearch label="חיפוש לפי שם, מייל, חברה או טלפון" value={search} onChange={v=>{setSearch(v);reset();}}/><OrderFilter label="סינון לפי כספים" icon={<SlidersHorizontal size={20}/>} value={funds} onChange={v=>{setFunds(v);reset();}} options={{all:'כל החשבונות',monthly:'עם חשבון חודשי',debt:'עם חוב חודשי פתוח',credit:'עם קרדיט בארנק',reports:'עם דיווח תשלום ממתין'}}/></div>
   <OrderViews label="סוג החשבון" value={role} onChange={v=>{setRole(v);reset();}} views={[['all','הכול',scoped.length],['customer','לקוחות',count('customer')],['agency','סוכנויות',count('agency')],['supplier','ספקים',count('supplier')],['admin','מנהלים',count('admin')]]}/>
   {!state.data&&!state.error?<div className="orders-reference-loading" role="status">טוען חשבונות…</div>:state.error&&!rows.length?<div className="orders-reference-error" role="alert"><p>{state.error}</p><button type="button" onClick={ctx.refresh}>ניסיון נוסף</button></div>:!rows.length?<div className="orders-reference-empty"><h3>לא נמצאו חשבונות</h3><p>אפשר לנסות שם, מייל או טלפון אחר, או לשנות את הסינון.</p></div>:<>
    <div className="om-head om-user-head" aria-hidden="true"><span>חשבון</span><span>סוג</span><span>חשבון חודשי</span><span>קרדיט בארנק</span><span>הזמנות</span><span/><span/></div>
    <div className="om-list" aria-label="רשימת החשבונות">{rows.slice((shown-1)*30,shown*30).map(u=>{const isOpen=open===u.id,account='admin-customer-account/'+u.id;return <OrderRecord key={u.id} id={u.id} label={u.name} open={isOpen} onToggle={()=>setOpen(isOpen?'':u.id)} panel={<UserPanel ctx={ctx} user={u}/>}>
      <div className="om-who om-user-name"><b>{u.name}</b><span><bdi>{u.email}</bdi></span>{u.company&&<span>{u.company}</span>}</div>
      <div className="om-user-role"><span className={'om-pill is-'+(roleTones[u.role]||'unreported')}>{roleNames[u.role]||u.role}</span>{u.tier_id&&u.tier_id!=='regular'&&<small>{u.tier_name}</small>}</div>
      <div className="om-user-monthly">{u.monthly_enabled?<><span className="om-pill is-month">מאושר</span><small>{Number(u.monthly_balance)>0?<>חוב <bdi>{money(u.monthly_balance)}</bdi></>:<>פנוי <bdi>{money(available(u))}</bdi></>}</small></>:<span className="om-muted">ללא</span>}</div>
      <div className="om-user-credit"><small className="om-phone-label">קרדיט בארנק</small><bdi>{money(u.credits||0)}</bdi></div>
      <div className="om-user-orders"><small className="om-phone-label">הזמנות</small>{Number(u.order_count)>0?<><b>{u.order_count}</b><small>אחרונה <bdi>{orderDateLabel(u.last_order_at)}</bdi></small></>:<span className="om-muted">אין</span>}{Number(u.pending_payment_reports)>0&&<small className="om-report-warn">דיווח תשלום ממתין</small>}</div>
      <a className="om-btn om-action" href={'/'+account} onClick={e=>{e.stopPropagation();if(!plainClick(e))return;e.preventDefault();ctx.go(account);}}><span>תיק לקוח</span><ChevronLeft size={16} aria-hidden="true"/></a>
     </OrderRecord>;})}</div>
   </>}
   <OrderPager page={shown} total={rows.length} size={30} onChange={setPage}/>
   {rows.length>0&&<p className="om-note">{accountsText(rows.length)} בתצוגה.</p>}
  </div>
 </section>;
}
