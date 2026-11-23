'use client';
// "הערה ללקוח והגבלות" in a site card (owner 23.11.2026): a note the customer sees in the price list and in the article
// editor (the sheet's "הערות" column, public_notes), one link only in the article, and a maximum number of words.
// The limits are checked when the customer sends the article (lib/checks.ts) and shown with the note.
import React,{useState} from 'react';
import {Link2,ListChecks,PencilLine,Type} from 'lucide-react';

export function SiteRules({note,onNote,singleLink,onSingleLink,maxWords,onMaxWords,disabled}:{note:string;onNote:(v:string)=>void;singleLink:boolean;onSingleLink:(v:boolean)=>void;maxWords:string;onMaxWords:(v:string)=>void;disabled?:boolean}){
 const [noteOpen,setNoteOpen]=useState(!!note.trim()),[limitOpen,setLimitOpen]=useState(!!String(maxWords).trim());
 return <div className="nsp-group srl">
  <h3><ListChecks size={16} aria-hidden="true"/>הערה ללקוח והגבלות <small>הלקוח רואה אותן במחירון ובעריכת הכתבה</small></h3>
  {noteOpen?<label className="nsp-f"><span className="nsp-lbl">הערה ללקוח <small className="nsp-inline">מופיעה במחירון ובעריכת הכתבה</small></span><textarea rows={2} value={note} disabled={disabled} maxLength={1000} placeholder="למשל: האתר לא מפרסם כתבות הימורים" onChange={e=>onNote(e.target.value)}/></label>
   :<button type="button" className="srl-add" disabled={disabled} onClick={()=>setNoteOpen(true)}><PencilLine size={16} aria-hidden="true"/>+ הוספת הערה</button>}
  <label className={'srl-toggle'+(singleLink?' is-on':'')}><input type="checkbox" checked={singleLink} disabled={disabled} onChange={e=>onSingleLink(e.target.checked)}/><Link2 size={16} aria-hidden="true"/><span><b>קישור אחד בלבד במאמר</b><small>המערכת לא תאפשר לשלוח כתבה עם יותר מקישור אחד</small></span></label>
  <label className={'srl-toggle'+(limitOpen?' is-on':'')}><input type="checkbox" checked={limitOpen} disabled={disabled} onChange={e=>{setLimitOpen(e.target.checked);if(!e.target.checked)onMaxWords('');}}/><Type size={16} aria-hidden="true"/><span><b>הגבלת אורך הכתבה</b><small>הלקוח לא יוכל לשלוח כתבה ארוכה יותר, ויראה כמה לקצר</small></span></label>
  {limitOpen&&<label className="nsp-f srl-words"><span className="nsp-lbl">עד כמה מילים</span><span className="nsp-money"><input type="number" inputMode="numeric" min={50} max={20000} step={1} value={maxWords} disabled={disabled} placeholder="800" onChange={e=>onMaxWords(e.target.value)}/><i>מילים</i></span></label>}
 </div>;
}
export const maxWordsProblem=(v:string)=>{const s=String(v??'').trim();if(!s)return '';const n=Number(s);return Number.isInteger(n)&&n>=50&&n<=20000?'':'מגבלת המילים צריכה להיות מספר שלם בין 50 ל-20,000.';};
