'use client';
import React from 'react';
import {ChevronDown,MessageSquare} from 'lucide-react';
import {displayUpdateDate} from '@/lib/client-updates';
import type {Row} from '@/lib/shared';

/** Owner 22.11.2026: an article returned for a fix shows the admin's note at the top of the editor, open at first and
 *  folded to one line with a tap, so it never covers the text. The note is the one sent in the email (revision_note). */
export default function ArticleFixNote({article}:{article:Row}){
 const note=String(article.revision_note||'').trim();
 if(article.status!=='revisions'||!note)return null;
 return <details className="article-fix-note" open>
  <summary><span className="article-fix-note-icon" aria-hidden="true"><MessageSquare size={18}/></span><span className="article-fix-note-head"><strong>המנהל ביקש תיקון</strong>{article.revision_requested_at&&<small>נשלח ב-<bdi>{displayUpdateDate(article.revision_requested_at)}</bdi></small>}</span><span className="article-fix-note-toggle"><span className="is-open">הסתרה</span><span className="is-closed">קריאה</span><ChevronDown size={16} aria-hidden="true"/></span></summary>
  <div className="article-fix-note-body"><p className="article-fix-note-text">{note}</p><p className="article-fix-note-hint">אחרי התיקון לוחצים על "שליחה לפרסום", והמאמר חוזר אלינו לבדיקה.</p></div>
 </details>;
}
