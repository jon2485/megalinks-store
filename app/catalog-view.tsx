'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ExternalLink, ArrowLeft, ArrowDownUp, ChevronDown, ChevronLeft, ChevronRight, Clock, Download, ShoppingCart, Pencil, Globe, Heart, MessageSquareText, Plus, Search, SlidersHorizontal, Tag, Wallet, ListFilter, RotateCcw, X, Check, Newspaper, Monitor, BriefcaseBusiness, House, Plane, HeartPulse, Gamepad2, Utensils, LayoutGrid } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { extractCatalogAddresses, parseCatalogList, type CatalogSite, type ListMatch } from '@/lib/catalog-list-filter';
import { toast } from 'sonner';
import { api, csv, download, useData } from '@/lib/client';
import { money, Row } from '@/lib/shared';
import { categories, type Ctx } from './workspace';
import { WorkspaceAccountControls } from './workspace-account-controls';
import './catalog-filter-dialog.css';
import { CatalogMotionGrid } from './catalog-motion';
import './catalog-motion.css';
import { CatalogPublicationScene } from './catalog-publication-scene';
import './catalog-experience.css';
import './approved-customer-glass.css';
import {CartFeedbackButton} from './cart-add-feedback';
import './catalog-action-feedback.css';

export function CatalogTopBar({ ctx, cartCount }: { ctx: Ctx; cartCount: number }) {
    return <div className="workspace-premium-topbar">
        <div className="workspace-header-actions"><WorkspaceAccountControls ctx={ctx}/><Button onClick={() => ctx.go('cart')} className="workspace-header-cart h-10 rounded-full bg-slate-900 px-3 text-sm font-semibold text-white hover:bg-slate-800">סל פרסום ({cartCount})</Button></div>
    </div>;
}

function IsraelFlag() {
    return <svg viewBox="0 0 30 20" className="h-4 w-6 rounded-sm ring-1 ring-slate-200" role="img" aria-label="ישראל"><rect width="30" height="20" fill="white"/><path d="M0 4H30M0 16H30" stroke="#3573ba" strokeWidth="2.5"/><path d="M15 6L19 13H11ZM15 14L11 7H19Z" fill="none" stroke="#3573ba" strokeWidth=".8"/></svg>;
}

const actionStyle = 'h-12 rounded-2xl border-2 border-teal-200 bg-teal-50 px-3 text-base font-bold text-teal-800 transition-colors hover:bg-teal-100 focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2';

const cartActionStyle = 'h-12 rounded-2xl bg-gradient-to-l from-orange-600 to-orange-500 px-3 text-base font-bold text-white shadow-lg shadow-orange-500/20 transition-all hover:from-orange-700 hover:to-orange-600 focus-visible:ring-2 focus-visible:ring-orange-600 focus-visible:ring-offset-2';
const tagStyle = 'rounded-full bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-600';

export function PublicationCard({ site, ctx, favorite, onFavorite, managing = false, customAction,priceLabel }: { site: Row; ctx: Ctx; favorite: boolean; onFavorite: () => void; managing?: boolean;customAction?:{label:string;onClick:()=>void};priceLabel?:string }) {
    const [logoFailed, setLogoFailed] = useState(false);
    const hasDiscount = Number(site.regular_price_cents) > Number(site.price_cents) && Number(site.price_cents) >= 0;
    const discountPercent = hasDiscount ? Math.floor((site.regular_price_cents - site.price_cents) / site.regular_price_cents * 1000) / 10 : 0;
    const domain = site.url.replace(/^https?:\/\//, '').replace(/\/$/, '');
    return <Card dir="rtl" className="publication-catalog-card @container group relative gap-0 overflow-hidden rounded-[28px] border-2 border-orange-200/70 bg-white py-0 shadow-[0_0_0_1px_#fed7aa66,0_0_18px_2px_#fb923c24,0_8px_24px_#fb923c12] transition-shadow hover:shadow-[0_0_0_1px_#fed7aa99,0_0_22px_3px_#fb923c30,0_10px_28px_#fb923c18]">

        <div className="publication-card-top flex items-center justify-between gap-3 px-5 pt-5"><span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-semibold text-slate-600"><IsraelFlag/>ישראל</span>{!managing && <Button variant="ghost" size="icon" onClick={onFavorite} aria-label={(favorite ? 'הסרת ' : 'שמירת ') + site.name + ' במועדפים'} aria-pressed={favorite} className={'size-10 rounded-full border border-slate-200 bg-slate-50 '+(favorite?'text-rose-500':'text-slate-500 hover:text-rose-500')}><Heart size={23} fill={favorite?'currentColor':'none'}/></Button>}</div>
        <CardContent className="flex flex-1 flex-col px-5 pb-5 pt-5">
            <div className="publication-card-logo mx-auto flex h-28 w-full max-w-64 items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-3 shadow-sm">{site.logo_url && !logoFailed ? <img src={site.logo_url} alt={site.name} loading="lazy" className="h-full w-full object-contain" onError={() => setLogoFailed(true)}/> : <span className="text-2xl font-bold text-slate-800">{site.name}</span>}</div>
            <div className="mt-3 flex items-center justify-center gap-2"><h2 className="!text-2xl font-extrabold leading-snug text-slate-950">{site.name}</h2>{(site.public_notes || site.publishing_restrictions || site.customer_notes) && <Button size="icon" variant="ghost" className="catalog-site-notes-trigger shrink-0 rounded-full" title="הערות האתר" aria-haspopup="dialog" aria-label={'הערות האתר — ' + site.name} onClick={() => ctx.open({title: 'הערות האתר', description: site.name + ' · ' + site.url, render: (close:()=>void) => <section className="catalog-site-notes"><div className="catalog-site-notes-copy">{[site.public_notes,typeof site.publishing_restrictions === 'string' ? site.publishing_restrictions : site.publishing_restrictions ? JSON.stringify(site.publishing_restrictions) : '',site.customer_notes].filter(Boolean).map((note,index)=><p key={index}>{note}</p>)}</div><div className="payment-glass-actions"><Button className="payment-glass-send" onClick={close}>הבנתי</Button></div></section>})}><MessageSquareText size={22} aria-hidden="true"/></Button>}</div>
            <a href={site.url} target="_blank" rel="noreferrer" dir="ltr" className="mt-1.5 block truncate text-center text-sm text-slate-500 underline-offset-4 hover:text-teal-700 hover:underline" title={site.url}><span>{domain}</span><ExternalLink className="ml-1 inline size-4"/></a>
            <div className="publication-card-tags mt-4 flex min-h-8 flex-wrap items-center justify-center gap-2"><span className={tagStyle}>{categories[site.category] || site.category}</span>{site.features?.includes('dofollow') && <span dir="ltr" className={tagStyle}>Dofollow</span>}{site.is_on_sale && <span className={tagStyle}>מבצע</span>}</div>
            <dl className="publication-card-metrics mt-5 grid grid-cols-3 rounded-2xl border border-slate-200 bg-slate-50 py-3 text-center"><div className="border-l border-slate-200"><dd className="text-xl font-bold leading-tight text-slate-950">{site.dr ?? '—'}</dd><dt dir="ltr" className="mt-1 text-sm font-bold text-slate-500">DR</dt></div><div className="border-l border-slate-200"><dd className="text-xl font-bold leading-tight text-slate-950">{site.ur ?? '—'}</dd><dt dir="ltr" className="mt-1 text-sm font-bold text-slate-500">UR</dt></div><div><dd className="flex items-center justify-center gap-1 text-lg font-extrabold text-slate-950"><Clock size={18}/>{site.turnaround_days ?? '—'} ימים</dd><dt className="mt-1 text-sm font-bold text-slate-500">אספקה</dt></div></dl>
            <div className="publication-card-pricing mt-5 flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-emerald-200 bg-gradient-to-br from-teal-50 to-slate-50 px-3 py-6 text-center" aria-label="מחיר הפרסום">
                {hasDiscount && <div className="flex flex-wrap items-center justify-center gap-1.5 rounded-full border border-slate-300 bg-slate-100 px-3 py-1.5 text-slate-500"><span className="text-sm font-semibold">מחיר מחירון:</span><s className="text-lg font-semibold tabular-nums decoration-red-500 decoration-[2px]"><bdi>{money(site.regular_price_cents)}</bdi></s></div>}
                <span className="text-lg font-bold text-[#14698b]">{priceLabel||(site.price_source==='personal'?'המחיר האישי שלך':hasDiscount ? 'המחיר שלך' : 'מחיר לכתבה')}</span>
                <strong className="max-w-full break-words text-3xl font-extrabold leading-tight tracking-tight text-slate-950 tabular-nums @min-[320px]:text-4xl"><bdi>{money(site.price_cents)}</bdi></strong>
                {hasDiscount && <span className="mt-2 rounded-full border-2 border-emerald-200 bg-emerald-100 px-4 py-1.5 text-base font-bold text-emerald-950 shadow-sm">{discountPercent > 0 ? `${discountPercent.toLocaleString('he-IL', { maximumFractionDigits: 1 })}% הנחה` : 'פחות מ־0.1% הנחה'}</span>}
                <p className="text-sm text-slate-600">לכתבה · לפני מע״מ</p>
            </div>
            <div className="publication-card-actions mt-auto grid grid-cols-[.8fr_1.2fr] gap-3 pt-4 @max-[290px]:grid-cols-1"><a href={site.url} target="_blank" rel="noreferrer" className={'inline-flex items-center justify-between gap-2 ' + actionStyle}><span className="flex-1 text-center">לאתר</span><span className="grid size-7 shrink-0 place-items-center"><ArrowLeft size={16}/></span></a><CartFeedbackButton websiteId={site.id} enabled={!managing&&!customAction} onClick={customAction?.onClick||(() => ctx.open({kind:managing?'website':'order',site,title:managing?'עריכת מבצע — ' + site.name:'פרסום כתבה ב־' + site.name}))} className={'justify-between gap-2 ' + cartActionStyle} label={customAction?.label||(managing?(site.is_on_sale?'עריכת מבצע':'הוספת מבצע'):'הוספה לסל')} icon={managing||customAction?<Pencil size={16}/>:<ShoppingCart size={16}/>}/></div>
        </CardContent>
    </Card>;
}

export default function PremiumCatalog({ ctx, search, onSearch, loading = false }: { ctx: Ctx; search: string; onSearch: (value: string) => void; loading?: boolean }) {
    const searchRef = useRef<HTMLInputElement>(null);
    const searchTriggerRef = useRef<HTMLButtonElement>(null);
    const [searchOpen, setSearchOpen] = useState(Boolean(search));
    useEffect(() => { if (searchOpen) searchRef.current?.focus({preventScroll:true}); }, [searchOpen]);
    const closeSearch = () => { onSearch(''); setSearchOpen(false); searchTriggerRef.current?.focus({preventScroll:true}); };
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]), [draftCategories, setDraftCategories] = useState<string[]>([]), [categoryOpen, setCategoryOpen] = useState(false);
    const [filter, setFilter] = useState('all'), [sort, setSort] = useState('dr'), [maxPrice, setMaxPrice] = useState(''), [minDR, setMinDR] = useState(''), [page, setPage] = useState(1), [advanced, setAdvanced] = useState(false);
    const [listOpen, setListOpen] = useState(false), [listStage, setListStage] = useState<'input'|'review'>('input'), [listDraft, setListDraft] = useState('');
    const [listMatches, setListMatches] = useState<ListMatch[]>([]), [listUnmatched, setListUnmatched] = useState<string[]>([]), [listFilterIds, setListFilterIds] = useState<string[]>([]);
    const [listExpanded, setListExpanded] = useState(true);
    const [correction, setCorrection] = useState(''), [correcting, setCorrecting] = useState('');
    const fav = useData('favorites', ctx.revision, !!ctx.user);
    const favoriteIds: string[] = (fav.data?.favorites || []).filter((item: Row) => item.kind === 'favorite').map((item: Row) => item.website_id);
    const available = useMemo(() => ctx.catalog.filter(site => site.active !== 0), [ctx.catalog]);
    const values = (value: unknown): string[] => Array.isArray(value) ? value.flatMap(values) : value && typeof value === 'object' ? Object.values(value).flatMap(values) : value == null ? [] : [String(value), categories[String(value)] || ''];
    const filtered = useMemo(() => {
        const query = search.trim().toLocaleLowerCase();
        return available.filter(site => (!selectedCategories.length || selectedCategories.some(category => values([site.category, site.categories]).includes(category))) && (!listFilterIds.length || listFilterIds.includes(site.id)) && (!query || values([site.name, site.url, site.city, site.category, site.categories, site.tags]).some(value => value.toLocaleLowerCase().includes(query))) && (filter !== 'sale' || site.is_on_sale) && (filter !== 'favorites' || favoriteIds.includes(site.id)) && (!maxPrice || site.price_cents <= Number(maxPrice) * 100) && (!minDR || Number(site.dr || 0) >= Number(minDR))).sort((a,b) => sort === 'low' ? a.price_cents - b.price_cents : sort === 'high' ? b.price_cents - a.price_cents : sort === 'name' ? a.name.localeCompare(b.name, 'he') : Number(b.dr || 0) - Number(a.dr || 0));
    }, [available, search, selectedCategories, listFilterIds, filter, maxPrice, minDR, sort, favoriteIds.join(',')]);
    useEffect(() => setPage(1), [search, selectedCategories, listFilterIds, filter, maxPrice, minDR, sort]);
    const pages = Math.max(1, Math.ceil(filtered.length / 24));
    const currentPage = Math.min(page, pages);
    const shown = filtered.slice((currentPage - 1) * 24, currentPage * 24);
    const reset = () => { onSearch(''); setSelectedCategories([]); setDraftCategories([]); setListFilterIds([]); setListMatches([]); setListUnmatched([]); setListDraft(''); setFilter('all'); setMaxPrice(''); setMinDR(''); setSort('dr'); };
    const hasFilters = Boolean(search || selectedCategories.length || listFilterIds.length || filter !== 'all' || maxPrice || minDR || sort !== 'dr');
    const activeFilterCount = Number(filter !== 'all') + Number(Boolean(maxPrice)) + Number(Boolean(minDR)) + Number(sort !== 'dr') + Number(Boolean(listFilterIds.length));
    const closeList = () => { setListOpen(false); setAdvanced(true); };
    const reviewList = () => {
        const addresses = extractCatalogAddresses(listDraft);
        if (addresses.length) setListDraft(addresses.join('\n'));
        const result = parseCatalogList(listDraft, available as CatalogSite[]);
        if (!result.matches.length && !result.unmatched.length) { toast.info('לא נמצאו כתובות אתרים או שמות מדויקים מהקטלוג'); return; }
        setListMatches(result.matches); setListUnmatched(result.unmatched); setListStage('review'); setAdvanced(false); setListOpen(true);
    };
    const addCorrection = () => {
        const result = parseCatalogList(correction, available as CatalogSite[]);
        setListMatches(old => [...old, ...result.matches.filter(item => !old.some(existing => existing.siteId === item.siteId))]);
        setListUnmatched(old => [...old, ...result.unmatched.filter(item => !old.includes(item))]);
        if (result.matches.length && correcting) setListUnmatched(old => old.filter(item => item !== correcting));
        setCorrection(''); setCorrecting('');
    };
    return <div dir="rtl" className="azure-catalog catalog-approved-home min-w-0 text-right">
        <section className="azure-catalog-hero" aria-label="חיפוש אתרים לפרסום">
            <div className="catalog-hero-composition">
                <div className="catalog-hero-intro">
                    <h1 className="catalog-hero-title"><span>איפה נפרסם</span><span className="azure-title-accent">את הכתבה הבאה שלך?</span></h1>
                    <p>חפשו לפי אתר או תחום, סננו ובחרו היכן לפרסם.</p>
                    <Button className="catalog-home-cta" onClick={()=>document.getElementById('catalog-home-results')?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'})}>לצפייה בקטלוג<ArrowLeft size={18}/></Button>
                </div>
                <CatalogPublicationScene/>
            </div>
        </section>
        <div id="catalog-home-results" className="catalog-home-results relative mx-auto max-w-[1760px] px-4 pb-10 sm:px-8 lg:px-10">
            <div className="catalog-results-toolbar">
                <div className="catalog-results-heading"><h2 className="!text-xl font-bold text-slate-800">אתרים לפרסום</h2></div>
                <div className="catalog-home-tools">
                    <Popover open={categoryOpen} onOpenChange={open => {setCategoryOpen(open); if(open) setDraftCategories(selectedCategories);}}><PopoverTrigger asChild><Button variant="outline" aria-label="בחירת קטגוריות" className="catalog-home-category-trigger"><LayoutGrid size={25}/><span>{selectedCategories.length ? `${selectedCategories.length} קטגוריות נבחרו` : 'בחירת קטגוריות'}</span><ChevronDown size={19}/></Button></PopoverTrigger><PopoverContent dir="rtl" align="center" className="catalog-category-glass catalog-home-category-panel w-[min(25rem,calc(100vw-2rem))] rounded-2xl border-slate-200 bg-white p-3 text-right shadow-2xl"><div className="border-b border-slate-100 px-2 pb-3"><strong className="text-base text-slate-900">בחרו תחומים לפרסום</strong><p className="mt-1 text-sm text-slate-500">אפשר לסמן כמה קטגוריות יחד.</p></div><div className="grid max-h-64 grid-cols-2 gap-1 overflow-y-auto py-2 sm:max-h-80">{Object.entries(categories).map(([id,name])=><label key={id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"><Checkbox checked={draftCategories.includes(id)} onCheckedChange={checked=>setDraftCategories(old=>checked?[...old,id]:old.filter(item=>item!==id))} className="border-slate-400 data-[state=checked]:border-teal-600 data-[state=checked]:bg-teal-600"/><span>{name}</span></label>)}</div><div className="flex gap-2 border-t border-slate-100 pt-3"><Button className="h-10 flex-1 rounded-xl bg-[#0b2351] text-white hover:bg-[#173a68]" onClick={()=>{setSelectedCategories(draftCategories);setCategoryOpen(false);}}>הצגת אתרים</Button><Button variant="outline" className="h-10 rounded-xl border-slate-200" onClick={()=>{setDraftCategories([]);setSelectedCategories([]);setCategoryOpen(false);}}>הכול</Button></div></PopoverContent></Popover>
                    <div className="catalog-inline-search-slot">
                        <div className="catalog-inline-search" data-open={searchOpen}>
                            <Button ref={searchTriggerRef} variant="ghost" className="catalog-home-search-trigger" aria-label="פתיחת חיפוש בקטלוג" aria-expanded={searchOpen} aria-controls="catalog-inline-search-input" onClick={()=>{setSearchOpen(true);searchRef.current?.focus({preventScroll:true});}}><Search size={21}/></Button>
                            <Input ref={searchRef} id="catalog-inline-search-input" type="search" aria-label="חיפוש לפי שם אתר, כתובת, קטגוריה או תגית" disabled={!searchOpen} value={search} onChange={e=>onSearch(e.target.value)} onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();closeSearch();}}} placeholder="חיפוש אתר או תחום" className="catalog-inline-search-input"/>
                            {searchOpen&&<Button variant="ghost" size="icon" className="catalog-search-close" aria-label="סגירת החיפוש" onClick={closeSearch}><X size={18}/></Button>}
                        </div>
                    </div>
                </div>
                <div className="catalog-results-actions" role="group" aria-label="פעולות קטלוג"><Button variant="outline" className="catalog-action-button catalog-sort-trigger" onClick={()=>setAdvanced(true)} aria-haspopup="dialog"><SlidersHorizontal size={17}/>סינון ומיון{activeFilterCount > 0 && <span className="catalog-sort-count" aria-label={`${activeFilterCount} סינונים פעילים`}>{activeFilterCount}</span>}</Button><Button variant="outline" className="catalog-action-button" onClick={()=>download('megalinks-catalog.csv',csv(filtered.map(site=>({name:site.name,url:site.url,category:categories[site.category],price_ils:site.price_cents/100,DR:site.dr||0})),['name','url','category','price_ils','DR']))}><Download size={15}/>ייצוא קטלוג</Button><Button variant="outline" className="catalog-action-button" onClick={()=>ctx.go('bulk')}><Plus size={15}/>הזמנה מרוכזת</Button></div></div>

            {shown.length ? <CatalogMotionGrid resultKey={shown.map(site=>site.id).join(',')}>{shown.map(site=><div key={site.id} className="catalog-card-reveal" data-catalog-reveal="initial"><PublicationCard site={site} ctx={ctx} favorite={favoriteIds.includes(site.id)} onFavorite={()=>{if(!ctx.user){toast.info('התחברו כדי לשמור אתרים');return;}ctx.run(()=>api('favorites','POST',{website_id:site.id,kind:'favorite'}),'').catch(()=>{});}}/></div>)}</CatalogMotionGrid> : loading ? <div role="status" aria-label="טעינת הקטלוג" className="min-h-40"/> : <Card className="items-center border-dashed py-12 text-center"><Search size={30} className="text-slate-400"/><h2 className="!text-xl text-slate-800">לא נמצאו אתרים</h2><p className="text-base text-slate-500">נסו לשנות את החיפוש או לנקות את המסננים.</p><Button variant="outline" onClick={reset}>ניקוי מסננים</Button></Card>}
            <nav aria-label="עמודי קטלוג" className="mt-8 flex flex-wrap items-center justify-center gap-2"><Button variant="outline" size="icon" className="rounded-full" disabled={currentPage<=1} onClick={()=>setPage(currentPage-1)} aria-label="עמוד קודם"><ChevronRight size={16}/></Button>{Array.from({length:Math.min(5,pages)},(_,index)=>Math.min(Math.max(1,currentPage-2),Math.max(1,pages-4))+index).map(number=><Button key={number} variant={currentPage===number?'default':'ghost'} className={'size-10 rounded-full ' + (currentPage===number?'bg-slate-900 text-white':'text-slate-500')} onClick={()=>setPage(number)} aria-current={currentPage===number?'page':undefined}>{number}</Button>)}<span className="px-2 text-sm text-slate-500">מתוך {pages}</span><Button variant="outline" size="icon" className="rounded-full" disabled={currentPage>=pages} onClick={()=>setPage(currentPage+1)} aria-label="עמוד הבא"><ChevronLeft size={16}/></Button></nav>
        </div>
        <Dialog open={advanced} onOpenChange={setAdvanced}><DialogContent dir="rtl" showCloseButton={false} className="catalog-sort-dialog">
            <header className="catalog-sort-heading"><DialogHeader><DialogTitle>סינון ומיון</DialogTitle><DialogDescription>כל האפשרויות, במקום אחד</DialogDescription></DialogHeader><button type="button" className="catalog-sort-close" aria-label="סגירת סינון ומיון" onClick={()=>setAdvanced(false)}><X size={17}/></button></header>
            <div className="catalog-sort-switches">
                <label className="catalog-sort-switch-row"><span className="catalog-sort-copy"><span className="catalog-sort-icon catalog-sort-sale"><Tag size={18}/></span><span><strong>במבצע</strong></span></span><input type="checkbox" role="switch" className="catalog-ios-switch" checked={filter==='sale'} onChange={()=>setFilter(filter==='sale'?'all':'sale')}/></label>
                <label className="catalog-sort-switch-row"><span className="catalog-sort-copy"><span className="catalog-sort-icon catalog-sort-heart"><Heart size={18}/></span><span><strong>מועדפים</strong></span></span><input type="checkbox" role="switch" className="catalog-ios-switch" checked={filter==='favorites'} onChange={()=>setFilter(filter==='favorites'?'all':'favorites')}/></label>
            </div>
            <div className="catalog-sort-fields">
                <div className="catalog-sort-order"><span id="catalog-sort-label">מיון לפי</span><Select dir="rtl" value={sort} onValueChange={setSort}><SelectTrigger aria-labelledby="catalog-sort-label"><SelectValue/></SelectTrigger><SelectContent position="popper" align="start" className="catalog-sort-select-content">{Object.entries({dr:'דירוג DR',low:'מחיר: נמוך לגבוה',high:'מחיר: גבוה לנמוך',name:'שם האתר'}).map(([value,label])=><SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
                <label>מחיר מרבי<div className="catalog-sort-input"><Input type="number" inputMode="decimal" min="0" value={maxPrice} onChange={e=>setMaxPrice(e.target.value)} placeholder="ללא הגבלה" aria-label="מחיר מרבי בש״ח"/><span aria-hidden="true">₪</span></div></label>
                <label>DR מינימלי<div className="catalog-sort-input"><Input type="number" inputMode="numeric" min="0" max="100" value={minDR} onChange={e=>setMinDR(e.target.value)} placeholder="0" aria-label="DR מינימלי"/><span aria-hidden="true">DR</span></div></label>
            </div>
            <div className="catalog-sort-list"><button type="button" className="catalog-sort-list-direct" aria-expanded={listExpanded} aria-controls="catalog-inline-list" onClick={()=>setListExpanded(value=>!value)}><span><ListFilter size={21}/>סינון לפי הרשימה{listFilterIds.length > 0 && <span className="catalog-sort-count">{listFilterIds.length}</span>}</span><ChevronDown size={20} className={listExpanded?'catalog-list-chevron-open':undefined}/></button>{listExpanded&&<div id="catalog-inline-list"><label htmlFor="catalog-inline-input" className="sr-only">הדביקו רשימת אתרים למיון מתוך הקטלוג</label><Textarea id="catalog-inline-input" dir="auto" value={listDraft} onChange={e=>setListDraft(e.target.value)} onPaste={e=>{const input=e.currentTarget;const pasted=e.clipboardData.getData('text');const combined=listDraft.slice(0,input.selectionStart)+pasted+listDraft.slice(input.selectionEnd);const addresses=extractCatalogAddresses(combined);if(addresses.length){e.preventDefault();setListDraft(addresses.join('\n'));}}} placeholder="הדביקו רשימת אתרים למיון מתוך הקטלוג"/></div>}</div>
            <footer className="catalog-sort-footer"><button type="button" className="catalog-sort-reset" onClick={reset} disabled={!hasFilters&&!listDraft.trim()}><RotateCcw size={20}/>איפוס סינונים</button><button type="button" className="catalog-sort-apply" onClick={()=>listDraft.trim()?reviewList():setAdvanced(false)}>החלת סינון</button></footer>
        </DialogContent></Dialog>
        <Dialog open={listOpen} onOpenChange={open=>{if(open)setListOpen(true);else closeList();}}><DialogContent dir="rtl" showCloseButton={false} className="catalog-sort-dialog catalog-list-dialog">
            <div className="catalog-sort-handle" aria-hidden="true"/>
            <header className="catalog-sort-heading"><DialogHeader><DialogTitle>{listStage==='input'?'סינון לפי רשימת אתרים':'בדיקת האתרים שנמצאו'}</DialogTitle><DialogDescription className={listStage==='input'?'sr-only':undefined}>{listStage==='input'?'הדביקו רשימת אתרים למיון מתוך הקטלוג':'בדקו את הרשימה לפני הצגתה במחירון. אפשר להסיר, לתקן או להוסיף אתרים.'}</DialogDescription></DialogHeader><button type="button" className="catalog-sort-close" aria-label="חזרה לסינון ומיון" onClick={closeList}><X size={17}/></button></header>
            {listStage==='input'?<><div className="catalog-list-input-panel"><label htmlFor="catalog-list-input">הדביקו רשימת אתרים למיון מתוך הקטלוג</label><Textarea id="catalog-list-input" dir="auto" value={listDraft} onChange={e=>setListDraft(e.target.value)} onPaste={e=>{const input=e.currentTarget;const pasted=e.clipboardData.getData('text');const combined=listDraft.slice(0,input.selectionStart)+pasted+listDraft.slice(input.selectionEnd);const addresses=extractCatalogAddresses(combined);if(addresses.length){e.preventDefault();setListDraft(addresses.join('\n'));}}} placeholder="הדביקו כאן את רשימת האתרים"/><p>אפשר להדביק הודעה שלמה. כתובות האתרים יזוהו אוטומטית, ושאר המלל והמחירים יוסרו. דומיינים דומים לא יוחלפו זה בזה.</p></div><footer className="catalog-sort-footer"><button type="button" onClick={closeList} className="catalog-sort-reset">חזרה לסינון ומיון</button><button type="button" onClick={reviewList} disabled={!listDraft.trim()} className="catalog-sort-apply"><Search size={18}/>בדיקת הרשימה</button></footer></>
            :<div className="space-y-4 px-5 pb-6 pt-5 sm:px-7"><div className="flex items-center justify-between gap-2"><strong className="text-base text-slate-900">{listMatches.length} אתרים נמצאו</strong><Button variant="ghost" className="h-9 rounded-full text-sm text-teal-800" onClick={()=>setListStage('input')}><Pencil size={15}/>עריכת הרשימה</Button></div><div className="max-h-56 space-y-2 overflow-y-auto pr-1" aria-label="אתרים שנמצאו">{listMatches.map(item=>{const site=available.find(site=>site.id===item.siteId);return site&&<div key={item.siteId} className="flex min-w-0 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5"><span className="grid size-8 shrink-0 place-items-center rounded-full bg-teal-100 text-teal-700"><Check size={17}/></span><div className="min-w-0 flex-1"><strong className="block truncate text-sm text-slate-900">{site.name}</strong><span dir="ltr" className="block truncate text-right text-xs text-slate-500">{site.url}</span></div><Button variant="ghost" size="icon" aria-label={`הסרת ${site.name} מהרשימה`} onClick={()=>setListMatches(old=>old.filter(row=>row.siteId!==item.siteId))} className="size-9 shrink-0 rounded-full text-slate-500 hover:text-red-600"><X size={16}/></Button></div>})}{!listMatches.length&&<p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">לא נמצאו אתרים ברשימה. תקנו את הכתובות או נסו שמות אתרים.</p>}</div>
                {!!listUnmatched.length&&<div className="rounded-xl border border-amber-200 bg-amber-50 p-3"><strong className="text-sm text-amber-900">לא זוהו ({listUnmatched.length})</strong><p className="mt-1 text-xs text-amber-800">בדקו את הכתובת והוסיפו תיקון בשדה למטה.</p><div className="mt-2 flex flex-wrap gap-1.5">{listUnmatched.map(value=><span key={value} dir="auto" className="inline-flex max-w-full items-center gap-1 rounded-full bg-white px-2 py-1 text-xs text-amber-900"><span className="truncate">{value}</span><button type="button" className="font-bold underline" onClick={()=>{setCorrection(value);setCorrecting(value);}} aria-label={`תיקון ${value}`}>תיקון</button><button type="button" aria-label={`הסרת ${value} מהרשימה שלא זוהתה`} onClick={()=>setListUnmatched(old=>old.filter(item=>item!==value))}><X size={13}/></button></span>)}</div></div>}
                <div className="flex flex-col gap-2 sm:flex-row"><Input dir="auto" aria-label="הוספת או תיקון כתובת אתר" value={correction} onChange={e=>setCorrection(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();addCorrection();}}} placeholder="הוספת אתר או תיקון כתובת" className="h-11 flex-1 rounded-xl border-slate-300 bg-white text-right text-slate-900"/><Button variant="outline" onClick={addCorrection} disabled={!correction.trim()} className="h-11 rounded-xl border-slate-300 text-slate-800"><Plus size={17}/>הוספה לרשימה</Button></div><div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row"><Button variant="outline" onClick={()=>setListStage('input')} className="h-12 rounded-xl border-slate-200 text-slate-700">חזרה לעריכה</Button><Button disabled={!listMatches.length} onClick={()=>{setListFilterIds(listMatches.map(item=>item.siteId));setListOpen(false);}} className="h-12 flex-1 rounded-xl bg-[#0b2351] text-base font-bold text-white hover:bg-[#173a68] disabled:opacity-50">אישור והצגת {listMatches.length} אתרים</Button></div></div>}
        </DialogContent></Dialog>
    </div>;
}
