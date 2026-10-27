'use client';
import React,{useEffect,useRef,useState} from 'react';
import {ArrowLeft,ArrowRight,Check,CheckCheck,ImagePlus,Pencil,Send} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Textarea} from '@/components/ui/textarea';
import {AlertDialog,AlertDialogAction,AlertDialogCancel,AlertDialogContent,AlertDialogDescription,AlertDialogFooter,AlertDialogHeader,AlertDialogTitle} from '@/components/ui/alert-dialog';
import {api} from '@/lib/client';
import {siteApplicationFields as fields,siteImageTypes,siteApplicationError,siteApplicationErrors,type SiteApplicationValues,type SiteApplicationKey,type SiteApplicationField} from '@/lib/site-application';
import type {Row} from '@/lib/shared';
import type {Ctx} from './workspace';
import {useSiteJourneyMotion} from './site-journey-motion';
import './site-application-brand.css';
type Page='intro'|'questions'|'review'|'edit'|'success';
type DismissGuard=(guard:(()=>boolean)|null)=>void;
type Errors=Partial<Record<SiteApplicationKey,string>>;

export default function SiteForm({ctx,site,close,onDismissGuard}:{ctx:Ctx;site?:Row;close:()=>void;onDismissGuard?:DismissGuard}){
 const initial=useRef<SiteApplicationValues>({name:site?.name||'',url:site?.url||'',example_url:site?.example_url||'',price_ils:site?.unit_fee!=null?String(site.unit_fee/100):'',delivery_email:site?.delivery_email||'',instructions:site?.instructions||''});
 const [values,setValues]=useState<SiteApplicationValues>(initial.current),[page,setPage]=useState<Page>(site?'edit':'intro');
 const [index,setIndex]=useState(0),[furthest,setFurthest]=useState(0),[errors,setErrors]=useState<Errors>({});
 const [file,setFile]=useState<File|null>(null),[preview,setPreview]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[discard,setDiscard]=useState(false);
 const [draft,setDraft]=useState<SiteApplicationValues|null>(site?initial.current:null),[editFile,setEditFile]=useState<File|null>(null),[editPreview,setEditPreview]=useState('');
 const saved=useRef(''),lock=useRef(false),dirty=useRef(false),success=useRef(false),fromReview=useRef(false),leave=useRef<()=>boolean>(()=>true);
 const heading='site-journey-heading',group=fields[index].group,transitionKey=page==='questions'?page+'-'+group:page;
 const motion=useSiteJourneyMotion(transitionKey,page==='questions'?'site-'+fields[index].key:heading);
 const logo=preview||(site?.logo_id?'/api/files/'+site.logo_id:''),hasLogo=!!(file||site?.logo_id);
 dirty.current=!!file||!!editFile||JSON.stringify(draft||values)!==JSON.stringify(initial.current);
 leave.current=()=>{if(lock.current)return false;if(!success.current&&dirty.current){setDiscard(true);return false;}return true;};
 const requestClose=()=>{if(leave.current())close();};
 useEffect(()=>{onDismissGuard?.(()=>leave.current());return()=>onDismissGuard?.(null);},[onDismissGuard]);
 useEffect(()=>{const protect=(event:BeforeUnloadEvent)=>{if(!success.current&&dirty.current){event.preventDefault();event.returnValue='';}};window.addEventListener('beforeunload',protect);return()=>window.removeEventListener('beforeunload',protect);},[]);
 useEffect(()=>()=>{if(preview)URL.revokeObjectURL(preview);},[preview]);
 useEffect(()=>()=>{if(editPreview)URL.revokeObjectURL(editPreview);},[editPreview]);
 useEffect(()=>{
  const dialog=motion.viewport.current?.closest<HTMLElement>('[data-slot=dialog-content]'),visual=window.visualViewport;
  if(!dialog||!visual)return;
  const resize=()=>{dialog.style.setProperty('--journey-dialog-height',Math.max(180,visual.height)+'px');dialog.style.setProperty('--journey-dialog-top',visual.offsetTop+visual.height/2+'px');};
  resize();visual.addEventListener('resize',resize);visual.addEventListener('scroll',resize);
  return()=>{visual.removeEventListener('resize',resize);visual.removeEventListener('scroll',resize);dialog.style.removeProperty('--journey-dialog-height');dialog.style.removeProperty('--journey-dialog-top');};
 },[motion.viewport]);
 const clearError=(key:SiteApplicationKey)=>{setErrors(e=>({...e,[key]:''}));setError('');};
 const change=(key:Exclude<SiteApplicationKey,'logo'>,value:string,edit=false)=>{if(lock.current)return;if(edit)setDraft(v=>({...v!,[key]:value}));else setValues(v=>({...v,[key]:value}));clearError(key);};
 const chooseFile=(selected:File|null,edit:boolean,event:React.ChangeEvent<HTMLInputElement>)=>{
  if(!selected||lock.current)return;
  if(!siteImageTypes.includes(selected.type)){setErrors(e=>({...e,logo:'יש לבחור תמונה בפורמט PNG, JPG או WEBP'}));event.target.value='';return;}
  const url=URL.createObjectURL(selected);if(edit){setEditFile(selected);setEditPreview(url);}else{setFile(selected);setPreview(url);saved.current='';}clearError('logo');
 };
 const focusField=(key:SiteApplicationKey,edit=false)=>requestAnimationFrame(()=>document.getElementById('site-'+(edit?'edit-':'')+key)?.focus());
 const go=(next:Page,direction=1)=>{if(lock.current||!motion.prepare(direction))return false;setPage(next);return true;};
 const advance=()=>{
  if(lock.current||motion.locked.current)return;
  const key=fields[index].key,nextError=siteApplicationError(key,values,hasLogo);setErrors(e=>({...e,[key]:nextError}));if(nextError){focusField(key);return;}
  setFurthest(n=>Math.max(n,index+1));if(index===fields.length-1){go('review');return;}
  const next=index+1;if(fields[next].group!==group&&!motion.prepare())return;setIndex(next);
 };
 useEffect(()=>{if(page!=='questions'||motion.locked.current)return;const frame=focusField(fields[index].key);return()=>cancelAnimationFrame(frame);},[index,page,motion.locked]);
 const back=()=>{if(lock.current||motion.locked.current)return;if(page==='review'){setIndex(fields.length-1);go('questions',-1);}else if(page==='questions'&&index>0){if(fields[index-1].group!==group&&!motion.prepare(-1))return;setIndex(n=>n-1);}else if(page==='questions')go('intro',-1);};
 const openEdit=()=>{if(!go('edit',-1))return;fromReview.current=true;setDraft({...values});setEditFile(null);setEditPreview('');setErrors({});};
 const saveEdit=()=>{
  if(lock.current||motion.locked.current||!draft)return;const next=siteApplicationErrors(draft,!!(editFile||file||site?.logo_id));setErrors(next);const first=Object.keys(next)[0] as SiteApplicationKey|undefined;if(first){focusField(first,true);return;}
  if(!go('review'))return;setValues({...draft});setDraft(null);if(editFile){setFile(editFile);setPreview(URL.createObjectURL(editFile));saved.current='';setEditFile(null);setEditPreview('');}
 };
 const cancelEdit=()=>{if(site&&!fromReview.current){requestClose();return;}if(!go('review'))return;setDraft(null);setEditFile(null);setEditPreview('');setErrors({});};
 const submit=async()=>{
  if(lock.current||motion.locked.current)return;const next=siteApplicationErrors(values,hasLogo);setErrors(next);const first=Object.keys(next)[0] as SiteApplicationKey|undefined;
  if(first){setDraft({...values});setPage('edit');focusField(first,true);return;}
  lock.current=true;setBusy(true);setError('');
  try{let logo_id=site?.logo_id||'';if(file){if(!saved.current){const form=new FormData();form.append('file',file);saved.current=(await api('files','POST',form)).id;}logo_id=saved.current;}
   await ctx.run(()=>api('selling/sites','POST',{...values,kind:site?'edit':'create',site_id:site?.id,logo_id}),site?'בקשת העדכון נשלחה לבדיקה':'האתר נשלח לבדיקה');success.current=true;motion.prepare();setPage('success');
  }catch(e){setError((e as Error).message);requestAnimationFrame(()=>document.getElementById('site-submit-error')?.focus());}finally{lock.current=false;setBusy(false);}
 };
 const input=(field:SiteApplicationField,edit=false)=>{
  const key=field.key,id='site-'+(edit?'edit-':'')+key,source=edit?draft!:values,image=edit?(editPreview||logo):logo,selected=edit?(editFile||file):file;
  const described=[errors[key]?id+'-error':'',field.hint?id+'-hint':''].filter(Boolean).join(' ')||undefined;
  if(key==='logo')return <label className="journey-upload" htmlFor={id}><span className="journey-upload-symbol">{image?<img src={image} alt="תצוגה מקדימה של תמונת האתר"/>:<ImagePlus size={28} aria-hidden="true"/>}</span><span><strong>{selected?.name||(site?.logo_id?'החלפת תמונת האתר':'בחירת לוגו או תמונה')}</strong><small>PNG · JPG · WEBP</small></span><input id={id} className="journey-file-input" name="logo" type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} aria-invalid={!!errors.logo} aria-describedby={described} onChange={event=>chooseFile(event.target.files?.[0]||null,edit,event)}/></label>;
  const common={id,name:key,disabled:busy,value:source[key],maxLength:field.max,placeholder:field.placeholder,'aria-invalid':!!errors[key],'aria-describedby':described,onChange:(event:React.ChangeEvent<HTMLInputElement|HTMLTextAreaElement>)=>change(key,event.target.value,edit)};
  return field.type==='textarea'?<Textarea {...common} className="journey-input resize-none" rows={3}/>:<Input {...common} className="journey-input" type={field.type} dir={['url','email','number'].includes(field.type)?'ltr':'rtl'} min={field.type==='number'?0:undefined} step={field.type==='number'?'0.01':undefined} inputMode={field.type==='number'?'decimal':undefined} autoComplete="off" required={!field.optional}/>;
 };
 const feedback=(field:SiteApplicationField,edit=false)=>{const id='site-'+(edit?'edit-':'')+field.key;return <>{field.hint&&<small className="journey-helper" id={id+'-hint'}>{field.hint}</small>}<p id={id+'-error'} className="journey-error" role={errors[field.key]?'alert':undefined}>{errors[field.key]||''}</p></>;};
 const answer=(field:SiteApplicationField)=>field.key==='logo'?(file?.name||'תמונת האתר שנבחרה'):field.key==='price_ils'?values.price_ils+' ₪ לפני מע״מ':values[field.key]||'ללא הנחיות נוספות';
 const progress=page==='intro'?0:page==='questions'?group:3;
 const header=(title:string,description:string)=><div className="journey-section-heading"><h2 id={heading} tabIndex={-1}>{title}</h2><p>{description}</p></div>;
 return <div className="site-journey" dir="rtl" data-page={page}>
  <header className="journey-header"><span>הוספת אתר לקטלוג</span><img src="/brand/megalinks-logo.png" alt="MegaLinks" width={166} height={37}/></header>
  <nav className="journey-path" aria-label="שלבי הוספת אתר">{['מתחילים','פרטי האתר','פרטי הפרסום','סיכום'].map((label,n)=><span key={label} className={n===progress?'is-current':n<progress?'is-done':''} aria-current={n===progress?'step':undefined}>{label}</span>)}</nav>
  <div ref={motion.viewport} className="journey-viewport" aria-busy={busy}><div ref={motion.ghost} className="journey-ghost" aria-hidden="true" inert/><div ref={motion.page} className={'journey-page journey-page-'+page}>
   {page==='intro'&&<section className="journey-intro"><img className="journey-art" src="/brand/site-earning-intro-20261027.webp" alt="אתר שמקבל כתבות ומייצר הכנסות מכל פרסום" width={520} height={347}/><div className="journey-intro-text"><h2 id={heading}>זה הזמן להרוויח כסף<span>מהאתר שלך!</span></h2><p>מוסיפים את האתר שלך ל־MegaLinks<br/>ומרוויחים מכל כתבה שמתפרסמת בו.</p><p className="journey-intro-hint">כמה פרטים קצרים, והאתר שלך בדרך לבדיקה.</p><Button type="button" className="journey-primary" onClick={()=>go('questions')}>בוא נמשיך<ArrowLeft size={22} aria-hidden="true"/></Button><small><Check size={16} aria-hidden="true"/>האתר יפורסם לאחר בדיקה ואישור מנהל</small></div></section>}
   {page==='questions'&&<section className="journey-questions-page">{header(group===1?'נכיר את האתר שלך':'נכין אותו לפרסום',group===1?'':'עוד כמה פרטים, ומגיעים לסיכום.')}<div className="journey-questions">{fields.map((field,i)=>{
    if(field.group!==group||i>index&&i>=furthest)return null;const active=i===index,id='site-'+field.key;
    return <div key={field.key} className={'journey-question '+(active?'is-active':'is-complete')}>
     {active?<div className="journey-question-title"><span className="journey-sequence" aria-hidden="true">{i+1}</span><label htmlFor={id}>{field.title}{field.optional&&<small>לא חובה</small>}</label></div>:<button type="button" className="journey-completed" disabled={busy} aria-label={'עריכת '+field.label} onClick={()=>{if(!motion.locked.current)setIndex(i);}}><span className="journey-sequence"><Check size={16} aria-hidden="true"/></span><span><small>{field.label}</small><span className="journey-answer" dir={['url','email'].includes(field.type)?'ltr':'rtl'}>{answer(field)}</span></span><Pencil size={16} aria-hidden="true"/></button>}
     {active&&<form noValidate className="journey-question-body" key={field.key} onSubmit={event=>{event.preventDefault();advance();}}><div className="journey-input-row">{input(field)}<Button type="submit" className="journey-next" disabled={busy} aria-label={field.optional?'המשך לסיכום':'אישור והמשך'}><ArrowLeft size={22} aria-hidden="true"/></Button></div>{feedback(field)}</form>}
    </div>;
   })}</div><Button type="button" className="journey-back" variant="ghost" onClick={back}><ArrowRight size={18} aria-hidden="true"/>חזרה</Button></section>}
   {page==='review'&&<section className="journey-review">{header('האתר שלך, לפני השליחה','מבט אחרון על הפרטים — ואפשר לשלוח לבדיקה.')}<div className="journey-review-layout"><div className="journey-review-site"><div className="journey-review-logo">{logo?<img src={logo} alt="תמונת האתר שנבחרה"/>:<span>{values.name.charAt(0)}</span>}</div><div><strong>{values.name}</strong><bdi>{values.url}</bdi></div></div><div><dl className="journey-summary">{fields.filter(field=>field.key!=='name').map(field=><div key={field.key}><dt>{field.key==='price_ils'?'מחיר לכתבה':field.key==='logo'?'תמונת האתר':field.label}</dt><dd dir={['url','email'].includes(field.type)?'ltr':'rtl'}>{answer(field)}</dd></div>)}</dl><Button type="button" variant="outline" className="journey-edit-all" onClick={openEdit} disabled={busy}><Pencil size={18} aria-hidden="true"/>עריכת כל הפרטים</Button><p className="journey-approval-note">האתר יפורסם בקטלוג לאחר בדיקה ואישור מנהל.</p>{error&&<p id="site-submit-error" tabIndex={-1} role="alert" className="journey-submit-error">{error}</p>}<Button type="button" className="journey-primary journey-full" onClick={submit} disabled={busy} aria-busy={busy}><Send size={20} aria-hidden="true"/>{busy?'שולח לבדיקה…':site?'שליחת העדכון לבדיקה':'אישור ושליחה למנהל'}</Button><Button type="button" variant="ghost" className="journey-back" onClick={back} disabled={busy}><ArrowRight size={18} aria-hidden="true"/>חזרה</Button></div></div></section>}
   {page==='edit'&&draft&&<section className="journey-edit">{header('כל הפרטים, במסך אחד','משנים מה שצריך וחוזרים לסיכום.')}<form noValidate onSubmit={event=>{event.preventDefault();saveEdit();}}><fieldset disabled={busy} className="journey-edit-fields">{fields.map(field=><div key={field.key} className={field.key==='instructions'?'journey-edit-wide':''}><label className="journey-edit-label" htmlFor={'site-edit-'+field.key}>{field.label}{field.optional&&<small>לא חובה</small>}</label>{input(field,true)}{feedback(field,true)}</div>)}</fieldset><div className="journey-edit-actions"><Button type="submit" className="journey-primary">שמירת הפרטים וחזרה לסיכום<Check size={20} aria-hidden="true"/></Button><Button type="button" variant="ghost" className="journey-back" onClick={cancelEdit}>ביטול העריכה</Button></div></form></section>}
   {page==='success'&&<section className="journey-success"><div className="journey-success-mark"><CheckCheck size={44} aria-hidden="true"/></div><h2 id={heading} tabIndex={-1}>{site?'בקשת העדכון נשלחה לבדיקה!':'האתר נשלח לבדיקה!'}</h2><p>הפרטים הועברו למנהל לבדיקה ואישור.</p><Button type="button" className="journey-primary" onClick={close}>חזרה לאתרים שלי<ArrowLeft size={20} aria-hidden="true"/></Button></section>}
  </div></div>
  <footer className="journey-footer">{page==='questions'?<span role="status" aria-live="polite">שאלה {index+1} מתוך {fields.length}</span>:<span/>}{page!=='success'&&<Button type="button" className="journey-close" variant="ghost" onClick={requestClose} disabled={busy}>סגירה</Button>}</footer>
  <AlertDialog open={discard} onOpenChange={setDiscard}><AlertDialogContent dir="rtl"><AlertDialogHeader><AlertDialogTitle>לסגור בלי לשמור?</AlertDialogTitle><AlertDialogDescription>פרטי האתר שהזנת עדיין לא נשלחו למנהל.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>המשך עריכה</AlertDialogCancel><AlertDialogAction onClick={()=>{success.current=true;setDiscard(false);close();}}>סגירה ללא שמירה</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
 </div>;
}
