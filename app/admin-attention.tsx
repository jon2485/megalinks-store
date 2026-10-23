'use client';
import React,{createContext,useContext} from 'react';
import {useData} from '@/lib/client';
import type {Row} from '@/lib/shared';
import type {Ctx} from './workspace';
import {adminPageQueues} from '@/lib/admin-attention';

type AttentionState=ReturnType<typeof useData>;
const AttentionContext=createContext<AttentionState|null>(null);
export const adminMenuSections=[
 {label:'עבודה שוטפת',areas:['admin','admin-orders','admin-approvals','admin-support']},
 {label:'מסחר וחשבונות',areas:['admin-users','admin-websites','admin-suppliers','admin-promotions']},
 {label:'מערכת ובקרה',areas:['admin-connections']},
] as const;
export const adminQueueSections=[
 {label:'תוכן ופרסום',queues:['content','publication']},
 {label:'תשלומים וחשבונות',queues:['payment_reports','topups','cancellations','monthly']},
 {label:'שירות ותקינות',queues:['support','catalog','issues']},
] as const;
export function adminAreaLabel(id:string,fallback:string){return id==='admin'?'מרכז העבודה':id==='admin-users'?'משתמשים והרשאות':fallback;}

// Presentation-only ownership: one existing GET/poll for both sidebar and lobby.
// Unauthenticated/customer/supplier surfaces do not mount this provider.
function AttentionProvider({ctx,children}:{ctx:Ctx;children:React.ReactNode}){
 const state=useData('admin/control-center',ctx.revision,true,30000);
 return <AttentionContext.Provider value={state}>{children}</AttentionContext.Provider>;
}
export function AdminAttentionBoundary({ctx,children}:{ctx:Ctx;children:React.ReactNode}){
 return ctx.adminMode&&ctx.user?.role==='admin'?<AttentionProvider ctx={ctx}>{children}</AttentionProvider>:<>{children}</>;
}
export function useAdminAttention(ctx:Ctx){
 const shared=useContext(AttentionContext);
 // Retain standalone admin rendering for component fixtures and isolated previews.
 const local=useData('admin/control-center',ctx.revision,shared===null&&ctx.adminMode&&ctx.user?.role==='admin',30000);
 return shared??local;
}

const pageQueues=adminPageQueues;
export function attentionForPages(pages:readonly string[],data:Row|null|undefined){
 const queues:Row[]=Array.isArray(data?.queues)?data.queues:[];
 const ids=new Set(pages.includes('admin')?queues.map(q=>q.id):pages.flatMap(p=>pageQueues[p]??[]));
 const pending=queues.filter(q=>ids.has(q.id)&&Number.isSafeInteger(q.count)&&q.count>0);
 const email=pages.some(p=>p==='admin'||p==='admin-connections')&&data?.email_ready===false;
 const label=[...pending.map(q=>`${q.label||'פריטים לטיפול'}: ${q.count.toLocaleString('he-IL')}`),...(email?['חיבור הדוא״ל אינו פעיל']:[])].join(' · ');
 // Different queues may overlap or count different entities. Never add them.
 const count=pages.length===1&&(pageQueues[pages[0]]?.length===1)&&pending.length===1&&!email?pending[0].count:null;
 return {pending:pending.length>0||email,count,label};
}
export function AdminAttentionBadge({pages,state,scope}:{pages:readonly string[];state:AttentionState;scope?:string}){
 const item=attentionForPages(pages,state.data);
 const exact=state.data?.attention_counts?.[scope||pages[0]];
 const count=Number.isSafeInteger(exact)&&exact>=0?exact:item.count;
 if(count===0||(!item.pending&&!(count&&count>0)))return null;
 const stale=!!state.error;
 return <span className={'admin-v172-attention'+(count===null?' is-dot':'')+(stale?' is-stale':'')} title={count===1?'פריט אחד דורש טיפול':count?`${count} פריטים דורשים טיפול`:item.label}>
  <span aria-hidden="true">{count===null?'':count.toLocaleString('he-IL')}</span>
  <span className="admin-v172-visually-hidden">{stale?'נתוני הטיפול האחרונים; הרענון נכשל. ':''}{count===1?'פריט אחד דורש טיפול. ':count?count+' פריטים דורשים טיפול. ':''}</span>
 </span>;
}
