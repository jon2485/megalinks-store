'use client';
import {useState} from 'react';
import {LogOut,LoaderCircle} from 'lucide-react';

/* Owner 22.11.2026: "יציאה מהחשבון" at the bottom of the phone menu, with a clear exit icon and feedback once tapped. */
export function MobileSignout({name}:{name:string}){
 const [leaving,setLeaving]=useState(false);
 return <a className="workspace-mobile-drawer-link workspace-mobile-signout" href="/signout-with-chatgpt?return_to=/" target="_top" data-leaving={leaving||undefined} aria-busy={leaving||undefined} onClick={()=>setLeaving(true)}>
  <span className="mobile-glass-icon">{leaving?<LoaderCircle size={20} className="animate-spin" aria-hidden="true"/>:<LogOut size={20} aria-hidden="true" style={{transform:'scaleX(-1)'}}/>}</span>
  <span className="mobile-glass-copy"><span>{leaving?'יוצאים מהחשבון…':'יציאה מהחשבון'}</span><small>מחובר: {name}</small></span>
  <span className="workspace-mobile-signout-go" aria-hidden="true"><LogOut size={16} style={{transform:'scaleX(-1)'}}/>יציאה</span>
  <span className="sr-only" role="status">{leaving?'יוצאים מהחשבון':''}</span>
 </a>;
}
