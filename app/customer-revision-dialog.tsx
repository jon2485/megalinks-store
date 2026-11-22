'use client';
import React from 'react';
import {ArrowLeft,MessageSquare} from 'lucide-react';
import {displayUpdateDate,type ClientUpdate} from '@/lib/client-updates';
import SiteReference from './site-reference';

/** "נדרש תיקון במאמר" (owner, 22.11.2026): the article, and what the admin asked to fix, in the approved customer popup style. */
export default function CustomerRevisionDialog({event,open,close}:{event:ClientUpdate;open:()=>void;close:()=>void}){
 const note=String(event.note||'').trim();
 return <section className="customer-order-glass customer-cancellation-glass customer-revision-glass" dir="rtl">
  <header className="customer-order-glass-heading"><h2>נדרש תיקון במאמר</h2><p>{event.siteName||'המאמר שלך'}{event.orderNumber&&<> · <bdi>{event.orderNumber}</bdi></>}</p><span className="customer-finance-status is-pending">מחכה לתיקון שלך</span></header>
  <div className="customer-order-glass-body">
   <section className="customer-cancellation-section" aria-label="המאמר"><h3>המאמר</h3><SiteReference name={event.siteName} url={event.siteUrl}/><p className="customer-cancellation-title">{event.title}</p><dl className="customer-cancellation-facts">{event.orderNumber&&<div><dt>מספר הזמנה</dt><dd><bdi>{event.orderNumber}</bdi></dd></div>}<div><dt>{event.dateLabel}</dt><dd>{displayUpdateDate(event.date)}</dd></div></dl></section>
   <section className="customer-cancellation-section customer-fix-reason" aria-label="מה צריך לתקן"><h3><MessageSquare size={18} aria-hidden="true"/>מה צריך לתקן</h3><p>{note||'לא צורף פירוט. אפשר לפתוח את המאמר ולבדוק את ההערות בו.'}</p></section>
   <p className="customer-fix-hint">אחרי התיקון לוחצים שוב על "שליחה לפרסום", והמאמר חוזר אלינו לבדיקה.</p>
  </div>
  <footer className="customer-order-glass-actions"><button type="button" className="customer-finance-primary" onClick={()=>{close();open();}}>פתיחת המאמר לתיקון<ArrowLeft size={17} aria-hidden="true"/></button><button type="button" onClick={close}>סגירה</button></footer>
 </section>;
}
