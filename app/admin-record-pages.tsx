'use client';
import React,{useEffect,useRef} from 'react';
import {ArrowRight,ShieldCheck} from 'lucide-react';
import {useData} from '@/lib/client';
import {Button} from '@/components/ui/button';
import {OrderDetails,SupportTicketForm} from './screens';
import {ReportReview} from './payment-reports';
import {Heading,ErrorBox,type Ctx} from './workspace';

export function AdminOrderPage({ctx,id}:{ctx:Ctx;id:string}){
 const reports=useData('admin/payment-reports',ctx.revision),report=reports.data?.reports?.find((r:{order_id:string})=>r.order_id===id);
 return <section className="admin-record-page"><Heading title="פירוט ההזמנה" description="פרטי הפרסומים, התשלום והמסמכים של הזמנה זו." actions={<><Button variant="outline" onClick={()=>ctx.go('admin')}><ArrowRight size={17}/>חזרה לעדכונים</Button><Button variant="outline" onClick={()=>ctx.go('admin-orders')}>לכל ההזמנות</Button></>}/><div className="admin-record-surface"><ErrorBox error={reports.error}/>{report&&<section className="admin-exact-report"><div><h2>דיווח תשלום ממתין לבדיקה</h2><p>בדקו את האסמכתא לפני אישור קבלת הכסף.</p></div><Button onClick={()=>ctx.open({kind:'admin-finance',title:'בדיקת דיווח תשלום '+report.number,description:report.user_name,render:(close:()=>void)=><ReportReview ctx={ctx} report={report} close={close}/>})}><ShieldCheck size={17}/>בדיקת הדיווח והאסמכתא</Button></section>}<OrderDetails ctx={ctx} id={id} close={()=>{}}/></div></section>;
}
export function AdminSupportPage({ctx,id}:{ctx:Ctx;id:string}){
 const state=useData('records/ticket/'+encodeURIComponent(id),ctx.revision),row=state.data?.record;
 const dirty=useRef(false),path=useRef(''),open=ctx.open;
 const markDirty=(value:boolean)=>{dirty.current=value;window.dispatchEvent(new CustomEvent('postflow:dirty',{detail:value}));};
 useEffect(()=>{path.current=window.location.pathname;return()=>{window.dispatchEvent(new CustomEvent('postflow:dirty',{detail:false}));};},[]);
 // Same browser-exit contract as the existing knowledge editor; opt-in to this full-page form.
 useEffect(()=>{const before=(e:BeforeUnloadEvent)=>{if(dirty.current){e.preventDefault();e.returnValue='';}};const back=(e:PopStateEvent)=>{if(!dirty.current)return;const target=window.location.pathname+window.location.search;e.stopImmediatePropagation();window.history.pushState({},'',path.current);open({title:'יש שינויים שלא נשמרו',description:'שמרו את התשובה או צאו ללא שמירה.',render:(close:()=>void)=><div className="flex-row"><Button onClick={close}>חזרה לעריכה</Button><Button variant="outline" onClick={()=>{dirty.current=false;close();window.location.assign(target);}}>יציאה ללא שמירה</Button></div>});};window.addEventListener('beforeunload',before);window.addEventListener('popstate',back,true);return()=>{window.removeEventListener('beforeunload',before);window.removeEventListener('popstate',back,true);};},[open]);
 return <section className="admin-record-page"><Heading title={row?.name||'פרטי הפנייה'} description={row?.user_name?'פנייה מאת '+row.user_name:'פרטי הבקשה והטיפול בפנייה.'} actions={<><Button variant="outline" onClick={()=>ctx.go('admin')}><ArrowRight size={17}/>חזרה לעדכונים</Button><Button variant="outline" onClick={()=>ctx.go('admin-support')}>לכל הפניות</Button></>}/><div className="admin-record-surface"><ErrorBox error={state.error}/>{state.loading&&!state.data?<p role="status">טוען את הפנייה…</p>:row?<SupportTicketForm key={row.id} ctx={ctx} row={row} admin onDirtyChange={markDirty} close={()=>ctx.go('admin-support')}/>:!state.error?<p>הפנייה לא נמצאה או שאינה זמינה עוד.</p>:<Button variant="outline" onClick={ctx.refresh}>ניסיון נוסף</Button>}</div></section>;
}
