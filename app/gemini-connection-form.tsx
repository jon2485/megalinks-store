'use client';
import React,{useRef,useState} from 'react';
import {KeyRound,ShieldCheck,Save,Plug} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {api} from '@/lib/client';
import {GEMINI_DEFAULT_MODEL,GEMINI_MODEL_FORMAT_ERROR,normalizeGeminiModel,validGeminiModel} from '@/lib/gemini-model';
import type {Row} from '@/lib/shared';
import type {Ctx} from './workspace';

export default function GeminiConnectionForm({ctx,connection,enabled,close}:{ctx:Ctx;connection:Row;enabled:boolean;close:()=>void}){
 const same=connection.provider==='gemini';
 const[storage,setStorage]=useState(same&&connection.secret_storage==='encrypted_server'?'encrypted_server':'environment'),[key,setKey]=useState(''),[model,setModel]=useState(same&&connection.model&&connection.has_secret?normalizeGeminiModel(connection.model):GEMINI_DEFAULT_MODEL),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');const lock=useRef(false);
 const[models,setModels]=useState<string[]|null>(null);
 const[hasStored,setHasStored]=useState(!!(same&&connection.has_stored_secret));const hasEnvironment=!!connection.has_environment_secret;
 const loadModels=async()=>{
  if(lock.current)return;setError('');setMessage('');
  if(storage==='encrypted_server'&&!key.trim()&&!hasStored){setError('הדביקו את מפתח ה־API של Gemini.');return;}
  if(storage==='environment'&&!hasEnvironment){setError('לא הוגדר GEMINI_API_KEY. להזנה כאן, בחרו ״סוד מוצפן בשרת״.');return;}
  lock.current=true;setBusy(true);
  try{const result=await api('admin/integration/ai/models','POST',{secret_storage:storage,...(storage==='encrypted_server'&&key.trim()?{secret:key.trim()}:{})});setModels(result.models);setMessage(result.models.length?'הרשימה התקבלה מ־Google. בחרו מודל ולחצו ״שמירה ובדיקת חיבור״.':'Google לא החזירה מודלים מתאימים לכתיבה עבור המפתח הזה.');}
  catch(e){setModels(null);setError((e as Error).message);}
  finally{lock.current=false;setBusy(false);}
 };
 const submit=async(test=false)=>{
  if(lock.current)return;setError('');setMessage('');
  const selectedModel=normalizeGeminiModel(model);
  if(!validGeminiModel(selectedModel)){setError(GEMINI_MODEL_FORMAT_ERROR);return;}
  if(models!==null&&!models.includes(selectedModel)){setError('המודל הזה אינו מופיע ברשימה שהתקבלה מ־Google. בחרו מודל מהרשימה.');return;}
  setModel(selectedModel);
  if(storage==='encrypted_server'&&!key.trim()&&!hasStored){setError('הדביקו את מפתח ה־API של Gemini.');return;}
  if(storage==='environment'&&enabled&&!hasEnvironment){setError('לא הוגדר GEMINI_API_KEY בסודות האירוח. להזנה כאן, בחרו ״סוד מוצפן בשרת״.');return;}
  lock.current=true;setBusy(true);
  try{
   await api('admin/integration/ai','PATCH',{provider:'gemini',enabled,model:selectedModel,secret_storage:storage,...(storage==='encrypted_server'&&key.trim()?{secret:key.trim()}: {})});
   setKey('');setHasStored(storage==='encrypted_server');ctx.refresh();
   if(test){await api('admin/integration/ai/test','POST',{});setMessage('ההגדרות נשמרו והחיבור ל־Gemini אומת.');}
   else close();
  }catch(e){setError((e as Error).message);}
  finally{lock.current=false;setBusy(false);}
 };
 return <form dir="rtl" className="gemini-connection-form grid gap-4 text-right text-[#071f4b]" onSubmit={e=>{e.preventDefault();void submit();}}>
  <div className="flex items-center gap-3 rounded-2xl border border-cyan-200 bg-cyan-50 p-4"><KeyRound size={24}/><div><h3 className="!text-lg font-bold">מפתח API של Google Gemini</h3><p className="text-sm leading-6">המפתח משמש בשרת בלבד ואינו נשלח בחזרה לדפדפן.</p></div></div>
  <label className="grid gap-2 font-bold">אופן שמירת המפתח<select className="h-12 w-full rounded-xl border border-cyan-200 bg-white px-3 text-base" value={storage} disabled={busy} onChange={e=>{setStorage(e.target.value);setKey('');setModels(null);setError('');setMessage('');}}><option value="environment">משתנה סביבה סודי - GEMINI_API_KEY</option><option value="encrypted_server">סוד מוצפן בשרת - הזנה מהניהול</option></select></label>
  {storage==='encrypted_server'?<><label className="grid gap-2 font-bold">{hasStored?'מפתח חדש (ריק לשמירת הקיים)':'מפתח API של Gemini'}<Input type="password" autoComplete="new-password" spellCheck={false} dir="ltr" className="h-12 rounded-xl text-left text-base" maxLength={4000} value={key} disabled={busy} onChange={e=>{setKey(e.target.value);setModels(null);setError('');setMessage('');}} placeholder={hasStored?'מפתח כבר נשמר - לא ניתן להציגו':'הדביקו כאן את מפתח ה־API'}/></label><p className="rounded-xl border border-teal-200 bg-teal-50 p-3 text-sm leading-6"><ShieldCheck className="ml-2 inline" size={18}/>המפתח נשמר מוצפן בשרת. הפענוח תלוי בסוד SETTINGS_ENCRYPTION_KEY שבסביבת השרת. זו שמירה מוצפנת בהגדרות השרת, ולא שינוי משתני הסביבה של האירוח.</p></>:<p className="rounded-xl border border-cyan-200 bg-cyan-50 p-3 text-sm leading-6">{hasEnvironment?'משתנה הסביבה הסודי מוגדר.':'משתנה הסביבה GEMINI_API_KEY טרם הוגדר.'} במצב זה המפתח מנוהל בסודות האירוח. להזנת מפתח בפאנל, בחרו באפשרות ״סוד מוצפן בשרת״.</p>}
  <label className="grid gap-2 font-bold">מזהה מודל<Input dir="ltr" spellCheck={false} autoCapitalize="none" autoCorrect="off" aria-describedby="gemini-model-help" className="h-12 rounded-xl text-left text-base" value={model} disabled={busy} onChange={e=>setModel(e.target.value)} maxLength={100}/><small id="gemini-model-help" className="text-sm font-normal leading-6">ברירת המחדל: <bdi>{GEMINI_DEFAULT_MODEL}</bdi>. בדיקת החיבור מאמתת שהמודל זמין למפתח שלכם.</small></label>
  <div className="gemini-model-picker grid min-w-0 gap-3"><Button type="button" variant="outline" disabled={busy} onClick={()=>void loadModels()}>טעינת מודלים זמינים</Button>{models!==null&&models.length>0&&<label className="grid min-w-0 gap-2 font-bold">בחירת מודל מהרשימה<select aria-label="בחירת מודל זמין ב־Gemini" dir="ltr" className="min-h-11 w-full min-w-0 rounded-lg border border-cyan-200 bg-white px-3 text-base" disabled={busy} value={models.includes(normalizeGeminiModel(model))?normalizeGeminiModel(model):''} onChange={e=>{setModel(e.target.value);setError('');}}><option value="" disabled>בחירת מודל</option>{models.map(id=><option key={id} value={id}>{id}</option>)}</select></label>}<p className="text-sm leading-6">הרשימה נטענת מהשרת באמצעות המפתח שבחרתם. טעינת הרשימה אינה משנה את החיבור.</p></div>
  {error&&<p role="alert" className="rounded-xl bg-red-50 p-3 font-semibold text-red-800">{error}</p>}{message&&<p role="status" className="rounded-xl bg-teal-50 p-3 font-semibold text-teal-900">{message}</p>}
  <div className="gemini-connection-actions grid grid-cols-2 gap-3"><Button type="submit" disabled={busy} className="min-h-12 rounded-xl bg-[#071f4b] font-bold text-white"><Save size={18}/>{busy?'שומר…':'שמירת החיבור'}</Button><Button type="button" variant="outline" disabled={busy} className="min-h-12 rounded-xl border-teal-300 bg-teal-50 font-bold text-teal-900" onClick={()=>void submit(true)}><Plug size={18}/>שמירה ובדיקת חיבור</Button></div>
  {hasStored&&storage==='encrypted_server'&&<Button type="button" variant="outline" disabled={busy} className="reviewed-danger rounded-lg border-red-200 font-bold text-red-700" onClick={async()=>{if(lock.current)return;lock.current=true;setBusy(true);setError('');try{await ctx.run(()=>api('admin/integration/ai','PATCH',{provider:'gemini',secret_storage:'encrypted_server',enabled:false,clear_secret:true}),'המפתח הוסר והחיבור הושבת');setKey('');close();}catch(e){setError((e as Error).message);}finally{lock.current=false;setBusy(false);}}}>הסרת המפתח והשבתת החיבור</Button>}
 </form>;
}
