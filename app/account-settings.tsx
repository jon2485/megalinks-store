'use client';
import React,{useState} from 'react';
import {Mail,UserRound,Save,LogOut,LoaderCircle,CheckCircle2} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {api} from '@/lib/client';
import {type Ctx,ErrorBox} from './workspace';

export default function AccountSettings({ctx}:{ctx:Ctx}){
 const [values,setValues]=useState(()=>({name:ctx.user?.name||'',phone:ctx.user?.phone||'',company:ctx.user?.company||''}));
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState(false);
 const save=async(event:React.FormEvent)=>{event.preventDefault();if(busy)return;setBusy(true);setError('');setSaved(false);try{await ctx.run(()=>api('me','PATCH',{...values,name:values.name.trim()}),'פרטי החשבון נשמרו');setSaved(true);}catch(e){setError((e as Error).message);}finally{setBusy(false);}};
 return <section className="account-settings-page azure-page-theme" dir="rtl"><header className="account-settings-hero"><h1>הגדרות חשבון</h1><p>עדכון הפרטים שיופיעו בהזמנות שלכם.</p></header><div className="account-settings-card"><div className="account-settings-heading"><UserRound size={24} aria-hidden="true"/><div><h2>פרטי החשבון</h2><p>{ctx.user?.name}</p></div></div><div className="account-settings-email"><Mail size={21} aria-hidden="true"/><div><span>החשבון המחובר</span><bdi>{ctx.user?.email}</bdi></div></div><form onSubmit={save}><div className="account-settings-fields">{[['name','שם מלא','text'],['phone','טלפון','tel'],['company','שם חברה','text']].map(([key,label,type])=><label key={key} htmlFor={'account-'+key}><span>{label}</span><Input id={'account-'+key} type={type} dir={type==='tel'?'ltr':'rtl'} className={type==='tel'?'text-left':'text-right'} required={key==='name'} maxLength={key==='phone'?50:200} disabled={busy} value={values[key as keyof typeof values]} onChange={e=>{setValues(v=>({...v,[key]:e.target.value}));setSaved(false);}}/></label>)}</div><ErrorBox error={error}/>{saved&&<p className="account-settings-success" role="status"><CheckCircle2 size={18}/>השינויים נשמרו בהצלחה</p>}<div className="account-settings-actions"><Button type="submit" disabled={busy} className="account-settings-save">{busy?<LoaderCircle size={18} className="animate-spin"/>:<Save size={18}/>} {busy?'שומר…':'שמירת שינויים'}</Button><Button asChild type="button" variant="outline" className="account-settings-signout"><a href="/signout-with-chatgpt?return_to=/" target="_top"><LogOut size={18}/>יציאה מהחשבון</a></Button></div></form></div></section>;
}
