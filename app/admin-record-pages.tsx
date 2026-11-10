'use client';
import React,{useCallback,useEffect,useRef} from 'react';
import {Button} from '@/components/ui/button';
import {SupportTicketForm} from './screens';
import {AdminOrderManagement} from './admin-order-approved';
import type {Ctx} from './workspace';
import type {Row} from '@/lib/shared';
import {TicketConversationPage} from './ticket-conversation';

export function AdminOrderPage({ctx,id}:{ctx:Ctx;id:string}){return <AdminOrderManagement ctx={ctx} id={id}/>;}
export function AdminSupportPage({ctx,id}:{ctx:Ctx;id:string}){
 const dirty=useRef(false),parts=useRef({reply:false,form:false}),path=useRef(''),open=ctx.open;
 // A reply being written or an edited details form both count as unsaved work.
 const mark=useCallback((key:'reply'|'form',value:boolean)=>{parts.current[key]=value;const next=parts.current.reply||parts.current.form;if(dirty.current===next)return;dirty.current=next;window.dispatchEvent(new CustomEvent('postflow:dirty',{detail:next}));},[]);
 const replyDirty=useCallback((value:boolean)=>mark('reply',value),[mark]),formDirty=useCallback((value:boolean)=>mark('form',value),[mark]);
 useEffect(()=>{path.current=window.location.pathname;return()=>{window.dispatchEvent(new CustomEvent('postflow:dirty',{detail:false}));};},[]);
 // Same browser-exit contract as the existing knowledge editor; opt-in to this full-page form.
 useEffect(()=>{const before=(e:BeforeUnloadEvent)=>{if(dirty.current){e.preventDefault();e.returnValue='';}};const back=(e:PopStateEvent)=>{if(!dirty.current)return;const target=window.location.pathname+window.location.search;e.stopImmediatePropagation();window.history.pushState({},'',path.current);open({title:'יש שינויים שלא נשמרו',description:'שלחו את התשובה או צאו ללא שמירה.',render:(close:()=>void)=><div className="flex-row"><Button onClick={close}>חזרה לעריכה</Button><Button variant="outline" onClick={()=>{dirty.current=false;close();window.location.assign(target);}}>יציאה ללא שמירה</Button></div>});};window.addEventListener('beforeunload',before);window.addEventListener('popstate',back,true);return()=>{window.removeEventListener('beforeunload',before);window.removeEventListener('popstate',back,true);};},[open]);
 return <TicketConversationPage ctx={ctx} id={id} onDirty={replyDirty} details={(row:Row,done:()=>void)=><SupportTicketForm key={row.id} ctx={ctx} row={row} admin detailsOnly onDirtyChange={formDirty} close={()=>{formDirty(false);done();}}/>}/>;
}

