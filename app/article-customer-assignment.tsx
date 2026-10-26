'use client';
import React,{useEffect,useRef,useState} from 'react';
import {Plus,Search,Users,X,LoaderCircle,RefreshCw} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle,DialogTrigger} from '@/components/ui/dialog';
import {RadioGroup,RadioGroupItem} from '@/components/ui/radio-group';
import {Tabs,TabsContent,TabsList,TabsTrigger} from '@/components/ui/tabs';
import {AlertDialog,AlertDialogAction,AlertDialogCancel,AlertDialogContent,AlertDialogDescription,AlertDialogFooter,AlertDialogHeader,AlertDialogTitle} from '@/components/ui/alert-dialog';
import {api,useData} from '@/lib/client';
import {customerInput,customerErrors,emptyCustomer} from '@/lib/customer-fields';
import type {Row} from '@/lib/shared';
import type {Ctx} from './workspace';
import {CustomerFields} from './customer-fields';

export function ArticleCustomerForm({article,ctx,onSaved,onCancel,onDirty,onBusy}:{article:Row;ctx:Ctx;onSaved:()=>void;onCancel:()=>void;onDirty:(dirty:boolean)=>void;onBusy:(busy:boolean)=>void}) {
    const options=useData('articles/customer-options',ctx.revision);
    const [tab,setTab]=useState('existing'),[selected,setSelected]=useState(String(article.customer_id||'')),[version,setVersion]=useState(Number(article.assignment_version||0));
    const [search,setSearch]=useState(''),[limit,setLimit]=useState(20),[values,setValues]=useState<Row>(emptyCustomer),[errors,setErrors]=useState<Record<string,string>>({});
    const [error,setError]=useState(''),[message,setMessage]=useState(''),[conflict,setConflict]=useState(false),[busy,setBusy]=useState(false);
    const locked=useRef(false),requestId=useRef('');
    const prefix='article-customer-'+encodeURIComponent(article.id);
    useEffect(()=>onDirty(selected!==String(article.customer_id||'')||Object.values(values).some(Boolean)),[selected,values,article.customer_id,onDirty]);
    const all:Row[]=options.data?.customers||[],query=search.trim().toLocaleLowerCase('he-IL');
    const matching=all.filter(c=>[c.name,c.company].some(v=>String(v||'').toLocaleLowerCase('he-IL').includes(query)));
    const current=all.find(c=>c.id===selected);
    const changed=()=>{requestId.current='';setError('');setMessage('');};
    const start=()=>{if(locked.current)return false;locked.current=true;setBusy(true);onBusy(true);return true;};
    const finish=()=>{locked.current=false;setBusy(false);onBusy(false);};
    const save=async(event:React.FormEvent<HTMLFormElement>)=>{
        event.preventDefault();
        const nextErrors=tab==='new'?customerErrors(customerInput(values)):{};setErrors(nextErrors);
        if(Object.keys(nextErrors).length){requestAnimationFrame(()=>document.getElementById(prefix+'-'+Object.keys(nextErrors)[0])?.focus());return;}
        if(!start())return;setError('');setConflict(false);
        requestId.current||=crypto.randomUUID();
        try {
            await ctx.run(()=>api('articles/'+encodeURIComponent(article.id)+'/customer','POST',{assignment_version:version,request_id:requestId.current,...(tab==='new'?{new_customer:customerInput(values)}:{customer_id:selected})}),tab==='new'?'הלקוח נוסף והכתבה שויכה אליו':'שיוך הכתבה נשמר');
            onSaved();
        } catch(e) {setError((e as Error).message);setConflict((e as Error&{status?:number}).status===409);} finally {finish();}
    };
    const reload=async()=>{
        if(!start())return;
        try {const result=await api('articles/'+encodeURIComponent(article.id));setVersion(Number(result.article.assignment_version||0));requestId.current='';setConflict(false);setError('');setMessage('השיוך הנוכחי: '+(result.article.customer_name||'ללא שיוך')+'. בדקו את הבחירה ושמרו שוב.');ctx.refresh();} catch(e){setError((e as Error).message);} finally{finish();}
    };
    return <form noValidate onSubmit={save} className="article-customer-form">
        <Tabs dir="rtl" value={tab} onValueChange={value=>{if(!busy){setTab(value);changed();}}}>
            <TabsList className="article-customer-tabs" aria-label="בחירת לקוח קיים או הוספת לקוח"><TabsTrigger value="existing" disabled={busy}><Users size={16}/>לקוח קיים</TabsTrigger><TabsTrigger value="new" disabled={busy}><Plus size={16}/>הוספת לקוח</TabsTrigger></TabsList>
            <TabsContent value="existing" className="article-customer-panel">
                <label className="article-customer-search" htmlFor={prefix+'-search'}><Search size={18} aria-hidden="true"/><Input id={prefix+'-search'} placeholder="חיפוש לקוח" value={search} disabled={busy} onKeyDown={event=>{if(event.key==='Enter')event.preventDefault();}} onChange={e=>{setSearch(e.target.value);setLimit(20);}}/>{search&&<button type="button" aria-label="ניקוי חיפוש לקוחות" disabled={busy} onClick={()=>{setSearch('');setLimit(20);document.getElementById(prefix+'-search')?.focus();}}><X size={17}/></button>}</label>
                {options.error&&<div role="alert" className="article-customer-error"><p>לא ניתן לטעון את רשימת הלקוחות. {options.error}</p><Button type="button" variant="outline" onClick={ctx.refresh} disabled={busy}><RefreshCw size={16}/>ניסיון נוסף</Button></div>}
                {options.loading&&!options.data?<p role="status">טוען לקוחות…</p>:<>
                    <RadioGroup dir="rtl" aria-label="הלקוח שאליו תשויך הכתבה" value={selected||'__none'} onValueChange={value=>{setSelected(value==='__none'?'':value);changed();}} disabled={busy} className="article-customer-options">
                        {current&&!matching.slice(0,limit).some(c=>c.id===selected)&&<label className="article-customer-option is-selected" htmlFor={prefix+'-selected'}><RadioGroupItem value={current.id} id={prefix+'-selected'}/><span><strong>{current.name}</strong><small>הלקוח שנבחר</small></span></label>}
                        {matching.slice(0,limit).map(customer=><label key={customer.id} className={'article-customer-option'+(selected===customer.id?' is-selected':'')} htmlFor={prefix+'-'+customer.id}><RadioGroupItem value={customer.id} id={prefix+'-'+customer.id}/><span><strong>{customer.name||'לקוח ללא שם'}</strong>{customer.company&&<small>{customer.company}</small>}</span></label>)}
                        <label className={'article-customer-option'+(!selected?' is-selected':'')} htmlFor={prefix+'-none'}><RadioGroupItem value="__none" id={prefix+'-none'}/><span>ללא שיוך</span></label>
                    </RadioGroup>
                    {!matching.length&&<p className="article-customer-hint">{query?'לא נמצאו לקוחות שתואמים לחיפוש. אפשר להוסיף לקוח בלשונית ״הוספת לקוח״.':'עדיין אין לקוחות ברשימה. אפשר להוסיף כאן את הלקוח הראשון.'}</p>}
                    {matching.length>limit&&<Button type="button" variant="outline" onClick={()=>setLimit(n=>n+20)} disabled={busy}>הצגת לקוחות נוספים ({matching.length-limit})</Button>}
                </>}
            </TabsContent>
            <TabsContent value="new" className="article-customer-panel"><p className="article-customer-hint">הלקוח יתווסף ל״הלקוחות שלי״ והכתבה תשויך אליו.</p><CustomerFields values={values} busy={busy} errors={errors} prefix={prefix} onChange={(key,value)=>{setValues(v=>({...v,[key]:value}));setErrors(e=>({...e,[key]:''}));changed();}}/></TabsContent>
        </Tabs>
        {error&&<div role="alert" className="article-customer-error"><p>{error}</p>{conflict&&<Button type="button" variant="outline" disabled={busy} onClick={reload}><RefreshCw size={16}/>רענון השיוך</Button>}</div>}
        {message&&<p role="status" className="article-customer-hint">{message}</p>}
        <footer className="article-customer-footer"><Button type="submit" disabled={busy||(tab==='existing'&&(options.loading||!!options.error))}>{busy&&<LoaderCircle size={16} className="animate-spin"/>}{tab==='new'?'הוספה ושיוך':'שמירת שיוך'}</Button><Button type="button" variant="outline" onClick={onCancel} disabled={busy}>ביטול</Button></footer>
    </form>;
}

export default function ArticleCustomerAssignment({article,ctx}:{article:Row;ctx:Ctx}) {
    const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[dirty,setDirty]=useState(false),[discard,setDiscard]=useState(false);
    const cancel=()=>{if(busy)return;if(dirty)setDiscard(true);else setOpen(false);};
    return <><div className="article-customer-inline"><span><Users size={14} aria-hidden="true"/>משויך ללקוח: <strong>{article.customer_name||'ללא שיוך'}</strong></span><Dialog open={open} onOpenChange={value=>value?setOpen(true):cancel()}><DialogTrigger asChild><Button type="button" variant="outline" className="article-customer-trigger" onClick={()=>setOpen(true)} aria-label={(article.customer_name?'שינוי שיוך':'שיוך ללקוח')+' לכתבה '+(article.title||'ללא כותרת')}> <Users size={16} aria-hidden="true"/>{article.customer_name?'שינוי שיוך':'שיוך ללקוח'}</Button></DialogTrigger><DialogContent dir="rtl" className="article-customer-dialog" onEscapeKeyDown={event=>{if(busy)event.preventDefault();}} onPointerDownOutside={event=>{if(busy)event.preventDefault();}}><DialogHeader><DialogTitle>שיוך כתבה ללקוח</DialogTitle><DialogDescription>{article.title||'כתבה ללא כותרת'} · {article.website_name||'פרסום כתבה'}{article.number&&<> · <bdi>{article.number}</bdi></>}</DialogDescription></DialogHeader>{open&&<ArticleCustomerForm article={article} ctx={ctx} onSaved={()=>{setDirty(false);setOpen(false);}} onCancel={cancel} onDirty={setDirty} onBusy={setBusy}/>}</DialogContent></Dialog></div>
        <AlertDialog open={discard} onOpenChange={setDiscard}><AlertDialogContent dir="rtl"><AlertDialogHeader><AlertDialogTitle>לסגור בלי לשמור?</AlertDialogTitle><AlertDialogDescription>הבחירה ופרטי הלקוח שהוזנו בחלונית עדיין לא נשמרו.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>המשך עריכה</AlertDialogCancel><AlertDialogAction onClick={()=>{setDirty(false);setOpen(false);setDiscard(false);}}>סגירה ללא שמירה</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </>;
}
