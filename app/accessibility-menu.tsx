'use client';

// The homepage's accessibility menu, inside the system too (owner, 18.11.2026: "להוסיף גם למערכת").
// Same three options as the homepage (larger text, higher contrast, stop animations); the choice is kept in
// localStorage under the same key the homepage uses, so it follows the visitor between the two.
import { useEffect, useRef, useState } from 'react';

const KEY = 'ml-a11y';
const OPTIONS = [['big', 'הגדלת טקסט'], ['contrast', 'ניגודיות גבוהה'], ['still', 'עצירת אנימציות']] as const;
type Option = typeof OPTIONS[number][0];

function read(): Option[] {
 try { const v = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(v) ? v.filter((x): x is Option => OPTIONS.some(([id]) => id === x)) : []; } catch { return []; }
}
function apply(on: Option[]) {
 const root = document.documentElement;
 for (const [id] of OPTIONS) root.classList.toggle('a11y-' + id, on.includes(id));
 try { localStorage.setItem(KEY, JSON.stringify(on)); } catch { /* private mode: the choice lasts for this page only */ }
}

export default function AccessibilityMenu() {
 const [open, setOpen] = useState(false);
 const [on, setOn] = useState<Option[]>([]);
 const button = useRef<HTMLButtonElement>(null);
 const panel = useRef<HTMLDivElement>(null);

 useEffect(() => { const saved = read(); setOn(saved); apply(saved); }, []);
 useEffect(() => {
  if (!open) return;
  const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); button.current?.focus(); } };
  const click = (e: MouseEvent) => { const t = e.target as Node; if (!panel.current?.contains(t) && !button.current?.contains(t)) setOpen(false); };
  document.addEventListener('keydown', key); document.addEventListener('click', click);
  return () => { document.removeEventListener('keydown', key); document.removeEventListener('click', click); };
 }, [open]);

 const toggle = (id: Option) => { const next = on.includes(id) ? on.filter(x => x !== id) : [...on, id]; setOn(next); apply(next); };
 const reset = () => { setOn([]); apply([]); };

 return <>
  <button ref={button} type="button" className="ml-a11y-fab" aria-expanded={open} aria-controls="ml-a11y-panel" aria-label="תפריט נגישות" title="נגישות" onClick={() => setOpen(v => !v)}>
   <svg viewBox="0 0 24 24" width="25" height="25" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="4.4" r="1.7" fill="currentColor" stroke="none"/><path d="M5 8.6c4.6 1.4 9.4 1.4 14 0M12 9.6v5m0 0-3 6m3-6 3 6"/></svg>
  </button>
  <div ref={panel} id="ml-a11y-panel" className="ml-a11y-panel" role="dialog" aria-label="אפשרויות נגישות" hidden={!open} dir="rtl">
   <h2>נגישות</h2>
   {OPTIONS.map(([id, label]) => <button key={id} type="button" aria-pressed={on.includes(id)} onClick={() => toggle(id)}>{label}</button>)}
   <button type="button" className="reset" onClick={reset}>איפוס</button>
   <a href="/accessibility">הצהרת נגישות</a>
  </div>
 </>;
}
