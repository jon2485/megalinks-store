'use client';

import ArticleCustomerAssignment from './article-customer-assignment';
import './article-customer-assignment.css';
import {writingStatus,writingCustomerEditor,writingWaitingLabel} from '@/lib/writing-workflow';
import React, { useMemo, useState } from 'react';
import { CalendarDays, ExternalLink, FileText, Globe, Plus, Search, X, Sparkles, Clock, Pencil, Eye, Send, CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useData } from '@/lib/client';
import { type Row, stages } from '@/lib/shared';
import { displayPurchaseDate, groupPurchasesByMonth, publicationDate, publicationLink, purchaseStage, purchaseStages, type PurchaseStage } from '@/lib/purchased-history';
import { type Ctx, Empty, ErrorBox } from './workspace';

export function PurchaseRow({ article, site, ctx, compact=false,canAssign=false }: { article: Row; site?: Row; ctx: Ctx; compact?:boolean;canAssign?:boolean }) {
    const [logoFailed, setLogoFailed] = useState(false);
    const logo = article.website_logo || site?.logo_url;
    const websiteUrl = article.website_url || site?.url || '';
    const siteName=article.website_name||site?.name||'אתר לפרסום';
    const publishedDate = publicationDate(article), liveLink = publicationLink(article);
    const stage = purchaseStage(article), editable = stage === 'editing';
    const shortUrl = (url: string) => url.replace(/^https?:\/\//, '').replace(/\/$/, '');
    const actionBase='inline-flex h-auto min-h-11 items-center justify-center gap-2 whitespace-normal rounded-full px-4 py-2.5 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2';
    const primaryStyle=actionBase+' w-full min-w-0 bg-teal-400 text-slate-950 shadow-sm shadow-teal-500/20 hover:bg-teal-300';
    const publishedStyle=actionBase+' w-full min-w-0 bg-orange-400 text-slate-950 shadow-sm shadow-orange-500/20 hover:bg-orange-300';
    const secondaryStyle=actionBase+' w-full min-w-0 border border-slate-500 bg-white text-slate-950 shadow-none hover:border-teal-500 hover:bg-teal-50';
    const statusStyle=stage==='approval'?'bg-orange-100 text-orange-900':stage==='publication'?'bg-cyan-100 text-cyan-900':stage==='demo-completed'?'bg-slate-100 text-slate-700':'bg-teal-100 text-teal-900';
    const progress=stage==='approval'?'הכתבה נשלחה לבדיקת המנהל.':stage==='publication'?'הכתבה אושרה וממתינה לפרסום אצל הספק.':stage==='demo-completed'?'הדגמה בלבד · ללא פרסום חיצוני.':article.status==='revisions'?'הכתבה הוחזרה לתיקון. אפשר להמשיך בעריכה.':article.editorial?(article.writing_requested_at?writingStatus(article)||writingWaitingLabel:'שלחו פרטים לכותב כדי להתחיל.'):'טרם נשלחה לאישור.';
    return <Card className="purchase-modern-card">
        <CardContent className="purchase-modern-content">
            <div className="purchase-modern-site">
                <div className="purchase-modern-logo">{logo&&!logoFailed?<img alt={'לוגו '+siteName} src={logo} loading="lazy" onError={()=>setLogoFailed(true)}/>:<Globe className="text-teal-700" size={23}/>}</div>
                <h3>{siteName}</h3>{websiteUrl&&<a href={websiteUrl} dir="ltr" target="_blank" rel="noreferrer" title={websiteUrl}><ExternalLink size={14}/><span>{shortUrl(websiteUrl)}</span></a>}
            </div>
            <div className="purchase-modern-story">
                <h4>{article.title||'כתבה ללא כותרת'}</h4>
                {article.customer_name&&<p className="purchase-customer-label">לקוח: {article.customer_name}</p>}
                <div className="purchase-modern-badges"><span className={'rounded-full px-3 py-1 text-sm font-semibold '+statusStyle}>{writingStatus(article)||stages[article.status]||article.status}</span>{article.demo&&<span className="rounded-full bg-slate-100 px-2.5 py-1 text-sm text-slate-600">הדגמה · ללא חיוב</span>}</div>
                {stage==='published'?<>{publishedDate&&<time dateTime={publishedDate.toISOString()}><Clock size={14}/>{displayPurchaseDate(publishedDate)}</time>}</>:<p><Clock size={14}/>{progress}</p>}
                {!article.paid&&!article.demo&&<p className="purchase-writing-info"><strong>טרם שולם · חיוב בחשבון חודשי</strong></p>}
                {!!article.editorial&&<p className="purchase-writing-info"><FileText size={15}/>נרכשה כתיבה בידי כותב מקצועי · {article.editorial_words} מילים</p>}
            </div>
            <div className="purchase-order-column"><span aria-label={'מספר הזמנה '+(article.number||'לא זמין')} dir="ltr" className="purchase-order-pill"><FileText size={14}/>{article.number||'—'}</span></div>
            <div className="purchase-modern-actions"><div className="purchase-action-row"><div className="purchase-action-buttons">
                {stage==='published'?liveLink?<a href={liveLink} target="_blank" rel="noreferrer" className={publishedStyle}><ExternalLink size={16}/>קישור לכתבה</a>:<Button disabled className={publishedStyle}>קישור לכתבה</Button>:stage==='demo-completed'?<span className="rounded-full bg-slate-100 px-4 py-2 text-center text-sm font-semibold text-slate-600">הדגמה הושלמה</span>:<Button className={primaryStyle} onClick={()=>ctx.go('article/'+article.id)}>{editable?<FileText size={16}/>:<Eye size={16}/ >}{editable?(article.editorial?(writingCustomerEditor(article)?'עריכת המאמר המוכן':article.writing_requested_at?'צפייה בהנחיות ובסטטוס':'מילוי הוראות לכותב התוכן'):compact?'המשך עריכה':'הוספת והמשך עריכת מאמר'):'צפייה בסטטוס'}</Button>}
                {editable&&!article.editorial&&<div className="purchase-secondary-actions"><Button variant="outline" className={secondaryStyle} onClick={()=>ctx.go('article/'+article.id+'/ai')}><Sparkles size={16}/>יצירת תוכן AI</Button></div>}
                </div>
                {(canAssign||!!article.customer_id)&&<ArticleCustomerAssignment article={article} ctx={ctx} compact/>}</div>
            </div>
        </CardContent>
    </Card>;

}

export default function PremiumPurchasedView({ ctx,initialStage='editing',compact=false,initialOrderId }: { ctx: Ctx;initialStage?:PurchaseStage;compact?:boolean;initialOrderId?:string }) {
    const state = useData('articles', ctx.revision), [search, setSearch] = useState(''), [selectedStage, setSelectedStage] = useState<PurchaseStage>(initialStage), [selectedMonth,setSelectedMonth]=useState('all'),[orderId,setOrderId]=useState(initialOrderId||''),[stageChosen,setStageChosen]=useState(false);
    const customerOptions=useData('articles/customer-options',ctx.revision);
    const canAssign=!!customerOptions.data?.customers?.length||(state.data?.articles||[]).some((a:Row)=>!!a.customer_id);
    const sites = useMemo(()=>new Map<string,Row>(ctx.catalog.map(site=>[site.id,site])),[ctx.catalog]);
    const purchased: Row[] = (state.data?.articles || []).filter((article:Row)=>article.status!=='cancelled' && (article.paid || article.demo || article.on_account) && (!orderId||article.order_id===orderId));
    const query=search.trim().toLocaleLowerCase();
    const availableMonths=groupPurchasesByMonth(purchased);
    const monthPurchases=selectedMonth==='all'?purchased:availableMonths.find(group=>group.key===selectedMonth)?.articles||[];
    const matching=monthPurchases.filter(article=>[article.website_name,article.title,article.number,article.website_url,article.published_url,sites.get(article.website_id)?.url].some(value=>String(value||'').toLocaleLowerCase().includes(query)));
    const orderStages=purchaseStages.filter(stage=>purchased.some(a=>purchaseStage(a)===stage.key));
    const activeStage=orderId&&!stageChosen&&!orderStages.some(s=>s.key===selectedStage)?orderStages[0]?.key||selectedStage:selectedStage;
    const rows=matching.filter(article=>purchaseStage(article)===activeStage);
    const completedDemos=matching.filter(article=>purchaseStage(article)==='demo-completed');
    const counts=Object.fromEntries(purchaseStages.map(stage=>[stage.key,monthPurchases.filter(article=>purchaseStage(article)===stage.key).length]));
    const groups=groupPurchasesByMonth(rows);
    const emptyMessages:Record<PurchaseStage,string>={editing:'אין כרגע קישורים בעריכה.',approval:'אין כרגע כתבות שממתינות לאישור המנהל.',publication:'אין כרגע כתבות שממתינות לפרסום אצל הספק.',published:'עדיין אין קישורים שפורסמו בפועל.'};
    return <div dir="rtl" className="purchased-atmosphere personal-redesign w-full min-w-0 text-right">
        {orderId&&<div className="ml-order-focus"><span>כתבות להזמנה <bdi dir="ltr">{purchased[0]?.number||orderId}</bdi></span><Button variant="outline" onClick={()=>{setOrderId('');setSelectedMonth('all');}}>לכל הכתבות שלי</Button></div>}
        <section className="personal-modern-hero">
            <div aria-hidden="true" className="personal-wave-background"/>
            <div className="personal-hero-inner">
                <div className="personal-hero-intro">
                    <div className="min-w-0"><h1 className="!text-3xl font-bold !leading-tight text-white sm:!text-4xl">אזור <span className="azure-title-accent">אישי</span></h1><p className="mt-2 text-base leading-relaxed text-slate-200">התוכן והפרסומים שלכם, במקום אחד.</p></div>
                    <Button className="h-auto min-h-11 w-fit max-w-full shrink-0 whitespace-normal rounded-full bg-teal-400 px-5 py-2.5 text-sm font-bold text-slate-950 shadow-sm shadow-teal-500/20 hover:bg-teal-300 focus-visible:ring-teal-200" onClick={()=>ctx.go('catalog')}><Plus size={17} className="shrink-0"/>רכישת פרסום נוסף</Button>
                </div>
                <h2 className="approved-articles-title">ניהול כתבות</h2><div className="purchased-search personal-hero-search"><Search className="purchased-search-icon pointer-events-none absolute right-4 top-1/2 size-5 -translate-y-1/2 text-slate-700"/><Input value={search} onChange={e=>setSearch(e.target.value)} aria-label="חיפוש רכישה לפי אתר, כתבה, קישור או מספר הזמנה" placeholder="חיפוש אתר, כתבה או הזמנה" className="purchased-search-input h-12 w-full min-w-0 rounded-full border-slate-300 bg-white pr-12 pl-12 text-base text-slate-950 shadow-sm placeholder:text-slate-700 focus-visible:ring-teal-600"/>{search&&<button type="button" className="approved-search-clear" aria-label="ניקוי חיפוש" onClick={e=>{setSearch('');e.currentTarget.parentElement?.querySelector('input')?.focus();}}><X size={18}/></button>}</div>
            </div>

        </section>
        <div className="relative mx-auto w-full max-w-6xl px-4 pt-5 pb-10 sm:px-6"><Tabs dir="rtl" value={activeStage} onValueChange={value=>{setSelectedStage(value as PurchaseStage);setStageChosen(true);}} className="gap-6"><TabsList aria-label="סינון לפי מצב הכתבה" className="relative grid w-full grid-cols-2 gap-3 rounded-none bg-transparent p-0 shadow-none lg:grid-cols-4 group-data-[orientation=horizontal]/tabs:h-auto">{purchaseStages.map(stage=><TabsTrigger key={stage.key} value={stage.key} className="purchased-stage-trigger min-h-16 h-auto min-w-0 flex-row justify-between gap-2 whitespace-normal rounded-xl border border-[#d8e2ea] bg-white px-3 py-3 text-right text-sm font-semibold leading-snug text-[#26384b] shadow-sm transition-colors hover:border-teal-200 hover:bg-[#f7fbfc] data-[state=active]:border-[#0f766e] data-[state=active]:bg-[#99f6e4] data-[state=active]:text-[#0b2032] data-[state=active]:shadow-[0_0_0_2px_#0f766e24,0_6px_16px_#0f766e25] focus-visible:ring-teal-700 sm:px-4 sm:text-base"><span className={'purchased-stage-icon stage-'+stage.key} aria-hidden="true">{React.createElement(({editing:FileText,approval:Clock,publication:Send,published:CheckCheck})[stage.key],{size:20})}</span><span className="purchased-stage-copy"><span className="purchased-stage-label min-w-0 break-words"><span className="purchased-stage-desktop-label">{stage.key==='editing'?'בעריכה':stage.key==='published'?'פורסמו':stage.label}</span><span className="purchased-stage-mobile-label">{{editing:'בעריכה',approval:'לאישור',publication:'לפרסום',published:'פורסמו'}[stage.key]}</span></span><span className={'purchased-stage-number grid min-w-8 h-8 shrink-0 place-items-center rounded-full px-2 text-sm font-bold tabular-nums '+(counts[stage.key]>0?'bg-orange-400 text-slate-950':'bg-[#eff4f8] text-[#64748b]')}>{counts[stage.key]}</span></span></TabsTrigger>)}</TabsList><TabsContent value={activeStage} className="min-w-0 space-y-5"><div className="personal-month-toolbar"><span>{rows.length} כתבות</span>{availableMonths.length>1&&<Select dir="rtl" value={selectedMonth} onValueChange={setSelectedMonth}><SelectTrigger aria-label="סינון לפי חודש רכישה" className="personal-month-select"><CalendarDays size={18}/><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">כל החודשים</SelectItem>{availableMonths.map(month=><SelectItem key={month.key} value={month.key}>{month.label}</SelectItem>)}</SelectContent></Select>}</div><ErrorBox error={state.error}/>
            {state.loading && !state.data ? <Card className="items-center border-slate-100 py-10 text-slate-500" role="status">טוען רכישות…</Card> : !purchased.length ? <Card className="gap-0 rounded-2xl border-slate-200 py-0"><Empty title="הרכישות שלכם יופיעו כאן" action={<Button className="rounded-full bg-orange-400 text-slate-950 hover:bg-orange-300" onClick={()=>ctx.go('catalog')}>בחירת אתר</Button>}/></Card> : !rows.length ? <Card className="items-center gap-4 rounded-2xl border-slate-200 py-10 text-center"><Search size={28} className="text-slate-400"/><h2 className="!text-xl font-bold text-slate-800">{query?'לא נמצאו תוצאות בקטגוריה זו':emptyMessages[activeStage]}</h2><p className="text-base text-slate-500">{query?'נסו חיפוש אחר או עברו לקטגוריה אחרת.':'אפשר לעבור בין הקטגוריות כדי לראות את שאר הרכישות.'}</p>{query&&<Button variant="outline" className="rounded-full" onClick={()=>setSearch('')}>ניקוי חיפוש</Button>}</Card> : <><div className="space-y-6">{groups.map(group=><section key={group.key} aria-labelledby={'purchase-month-'+group.key}><div className="purchase-month-divider"><h2 id={'purchase-month-'+group.key}><CalendarDays size={18}/>{group.label}</h2><span aria-hidden="true"/><small>{group.articles.length} כתבות</small></div><div className="approved-article-columns" aria-hidden="true"><span>אתר הפרסום</span><span>פרטי הכתבה</span><span>הזמנה</span><span>פעולות</span></div><div className="approved-article-rows flex min-w-0 flex-col gap-4">{group.articles.map(article=><PurchaseRow key={article.id} article={article} site={sites.get(article.website_id)} ctx={ctx} compact={compact} canAssign={canAssign}/>)}</div></section>)}</div></>}
            </TabsContent></Tabs>
            {!!completedDemos.length&&<details className="mt-8 rounded-2xl border border-slate-200 bg-white p-4"><summary className="cursor-pointer text-sm font-medium text-slate-600">הדגמות שהושלמו ({completedDemos.length}) · ללא פרסום חיצוני</summary><div className="mt-4 flex min-w-0 flex-col gap-4">{completedDemos.map(article=><PurchaseRow key={article.id} article={article} site={sites.get(article.website_id)} ctx={ctx} compact={compact} canAssign={canAssign}/>)}</div></details>}
        </div>
    </div>;
}
