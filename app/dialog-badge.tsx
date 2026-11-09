'use client';
import React from 'react';
import {CreditCard,Link2,Pencil,Sparkles,Trash2,Undo2,Wallet,FileText,ShieldCheck,UserRound} from 'lucide-react';

// Round-cornered icon at the start of every admin window header, same look as the AI-writing window (09.11.2026).
const pick=(title:string,kind?:string)=>/תשלום|חשבונית|יתרה|קרדיט/.test(title)?CreditCard:/זיכוי|ביטול/.test(title)?Undo2:/צירוף|שיוך/.test(title)?Link2:/הסרה|מחיקה/.test(title)?Trash2:/עריכה|פרטים|הרשאות|מסגרת/.test(title)?(/לקוח|חשבון|הרשאות/.test(title)?UserRound:Pencil):/אישור|בדיקה/.test(title)?ShieldCheck:/הזמנה|כתבה/.test(title)?FileText:kind==='wallet-topup'?Wallet:Sparkles;
export function DialogBadge({title,kind}:{title?:string;kind?:string}){const Icon=pick(String(title||''),kind);return <span className="admin-dialog-badge" aria-hidden="true"><Icon size={24} strokeWidth={1.9}/></span>;}
