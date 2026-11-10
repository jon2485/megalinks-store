// Feedback for the control the person just pressed (Apple-style: respond on
// press, show progress while the action runs, then confirm success or failure
// on the same control, with a light haptic on touch devices).
let last:HTMLElement|null=null,at=0;
const pick=(t:EventTarget|null)=>(t as HTMLElement|null)?.closest?.('button,a[href],[role=button],[role=menuitem]') as HTMLElement|null;
export function trackPresses(){
 const down=(e:Event)=>{const el=pick(e.target);if(el){last=el;at=Date.now();}};
 const key=(e:KeyboardEvent)=>{if(e.key==='Enter'||e.key===' ')down(e);};
 document.addEventListener('pointerdown',down,true);document.addEventListener('keydown',key,true);
 return()=>{document.removeEventListener('pointerdown',down,true);document.removeEventListener('keydown',key,true);};
}
// Marks the pressed control as busy; the returned function settles it.
export function pressBusy(){
 const el=last&&Date.now()-at<4000&&document.contains(last)&&last.getAttribute('role')!=='menuitem'?last:null;last=null;
 if(el){el.classList.add('fx-busy');el.setAttribute('aria-busy','true');}
 return(ok:boolean)=>{haptic(ok);if(!el)return;el.classList.remove('fx-busy');el.removeAttribute('aria-busy');if(!document.contains(el))return;const cls=ok?'fx-done':'fx-fail';el.classList.add(cls);setTimeout(()=>el.classList.remove(cls),ok?1200:700);};
}
export function haptic(ok:boolean){try{if(window.matchMedia('(pointer:coarse)').matches&&'vibrate' in navigator)navigator.vibrate(ok?12:[30,40,30]);}catch{}}
