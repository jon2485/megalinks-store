'use client';
import './account-navigation-refinements.css';

import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ExternalLink, ArrowLeft, ArrowDownUp, ChevronDown, ChevronLeft, ChevronRight, Download, ShoppingCart, Pencil, Globe, Heart, MessageSquareText, Plus, Search, SlidersHorizontal, Tag, Wallet, ListFilter, RotateCcw, X, Check, Newspaper, Monitor, BriefcaseBusiness, House, Plane, HeartPulse, Gamepad2, Utensils, LayoutGrid } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
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
import './catalog-product-glass.css';
import './catalog-card-apple.css';
import './catalog-mobile-hero.css';
import './catalog-filter-apple.css';

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
    const [notesOpen, setNotesOpen] = useState(false);
    const notesTitleId = useId();
    const notes = [site.public_notes, typeof site.publishing_restrictions === 'string' ? site.publishing_restrictions : site.publishing_restrictions ? JSON.stringify(site.publishing_restrictions) : '', site.customer_notes].filter(Boolean);
    const hasDiscount = Number(site.regular_price_cents) > Number(site.price_cents) && Number(site.price_cents) >= 0;
    const discountPercent = hasDiscount ? Math.floor((site.regular_price_cents - site.price_cents) / site.regular_price_cents * 1000) / 10 : 0;
    const domain = site.url.replace(/^https?:\/\//, '').replace(/\/$/, '');
    // Apple-style card (approved 03.11.2026): numbers stand alone with a one-line explanation instead of a 0-100 bar.
    const [metricTip, setMetricTip] = useState<'DR' | 'UR' | null>(null);
    // An open explanation closes on any press outside its own "i" button.
    useEffect(() => {
        if (!metricTip) return;
        const close = (event: PointerEvent) => { const own = event.target instanceof Element ? event.target.closest('.pc-info')?.getAttribute('data-site') : null; if (own !== String(site.id)) setMetricTip(null); };
        document.addEventListener('pointerdown', close);
        return () => document.removeEventListener('pointerdown', close);
    }, [metricTip]);
    const metricHelp = { DR: 'חוזק הדומיין כולו (Domain Rating). ככל שהוא גבוה יותר, הקישור מעביר יותר כוח.', UR: 'חוזק העמוד הספציפי (URL Rating), כלומר העמוד שבו תפורסם הכתבה.' } as const;
    return <Card dir="rtl" className={'publication-catalog-card pc-apple' + (hasDiscount ? ' pc-on-sale' : '')}>
        <div className="pc-head">
            <div className="pc-logo">{site.logo_url && !logoFailed ? <img src={site.logo_url} alt={site.name} loading="lazy" onError={() => setLogoFailed(true)}/> : <span>{site.name}</span>}</div>
            <div className="pc-name"><h2>{site.name}</h2><a href={site.url} target="_blank" rel="noreferrer" dir="ltr" title={site.url}><span>{domain}</span><ExternalLink size={13} aria-hidden="true"/></a></div>
            {!managing && <button type="button" className="pc-fav" onClick={onFavorite} aria-label={(favorite ? 'הסרת ' : 'שמירת ') + site.name + ' במועדפים'} aria-pressed={favorite}><Heart size={18} fill={favorite ? 'currentColor' : 'none'} aria-hidden="true"/></button>}
        </div>
        <div className="pc-chips">{site.is_on_sale && <span className="pc-chip pc-chip-deal">מבצע</span>}<span className="pc-chip pc-chip-cat"><LayoutGrid size={13} aria-hidden="true"/>{categories[site.category] || site.category}</span>{site.features?.includes('dofollow') && <span className="pc-chip pc-chip-do"><Check size={13} aria-hidden="true"/>קישור <bdi dir="ltr">Dofollow</bdi></span>}<span className="pc-chip"><IsraelFlag/>ישראל</span></div>
        <div className="pc-metrics" role="group" aria-label="מדדי האתר">
            {(['DR', 'UR'] as const).map(key => <div className="pc-metric" key={key}><b>{(key === 'DR' ? site.dr : site.ur) ?? '—'}</b><span className="pc-metric-key"><bdi dir="ltr">{key}</bdi><button type="button" className="pc-info" data-site={site.id} aria-label={'מה זה ' + key + '?'} aria-expanded={metricTip === key} onClick={() => setMetricTip(metricTip === key ? null : key)}>i</button></span><span className="pc-tip" role="tooltip"><b dir="ltr">{key}:</b> {metricHelp[key]}</span></div>)}
        </div>
        <div className="pc-notes-row">
                <Popover open={notesOpen} onOpenChange={setNotesOpen}>
                    <PopoverTrigger asChild><button type="button" className="pc-notes" disabled={!notes.length} aria-label={'הערות לפרסום — ' + site.name} title={notes.length ? 'פתיחת הערות לפרסום' : 'לא פורסמו הערות לפרסום באתר זה'}><span><MessageSquareText size={17} aria-hidden="true"/>הערות לפרסום</span><ChevronLeft className="pc-notes-chevron" size={16} aria-hidden="true"/></button></PopoverTrigger>
                    <PopoverContent dir="rtl" side="top" align="end" sideOffset={10} collisionPadding={12} className="publication-notes-popover" aria-labelledby={notesTitleId}>
                        <header><h3 id={notesTitleId}>הערות לפרסום</h3><button type="button" className="publication-notes-close" aria-label="סגירת הערות לפרסום" onClick={()=>setNotesOpen(false)}><X size={18} aria-hidden="true"/></button></header>
                        <div className="publication-notes-copy">{notes.map((note,index)=><p key={index}>{note}</p>)}</div>
                        <button type="button" className="publication-notes-done" onClick={()=>setNotesOpen(false)}>הבנתי</button>
                    </PopoverContent>
                </Popover>
        </div>
        <div className="pc-buy" aria-label="מחיר הפרסום">
            <span className="pc-price-label">{priceLabel||(site.price_source==='personal'?'המחיר שלך':hasDiscount ? 'המחיר שלך' : 'מחיר לכתבה')}</span>
            {hasDiscount && <div className="pc-sale"><span className="pc-off"><bdi dir="ltr">{discountPercent > 0 ? `−${discountPercent.toLocaleString('he-IL', { maximumFractionDigits: 1 })}%` : '<0.1%'}</bdi></span><s aria-label="מחיר מחירון"><bdi>{money(site.regular_price_cents)}</bdi></s></div>}
            <div className="pc-price"><strong><bdi>{money(site.price_cents)}</bdi></strong><small>{hasDiscount ? <><span className="pc-saving">חיסכון של <bdi>{money(site.regular_price_cents - site.price_cents)}</bdi></span> · לפני מע״מ</> : 'לכתבה · לפני מע״מ'}</small></div>
            <div className="pc-actions"><CartFeedbackButton websiteId={site.id} enabled={!managing&&!customAction} onClick={customAction?.onClick||(() => ctx.open({kind:managing?'website':'order',site,title:managing?'עריכת מבצע — ' + site.name:'פרסום כתבה ב־' + site.name}))} className="pc-add" label={customAction?.label||(managing?(site.is_on_sale?'עריכת מבצע':'הוספת מבצע'):'הוספה לסל')} icon={managing||customAction?<Pencil size={15}/>:<Plus size={15}/>}/><a href={site.url} target="_blank" rel="noreferrer" className="pc-site" aria-label={'מעבר לאתר ' + site.name} title="לאתר"><ExternalLink size={18} aria-hidden="true"/></a></div>
        </div>
    </Card>;
}

export default function PremiumCatalog({ ctx, search, onSearch, loading = false }: { ctx: Ctx; search: string; onSearch: (value: string) => void; loading?: boolean }) {
    const heroRef = useRef<HTMLElement>(null);
    const resultsRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const hero = heroRef.current;
        if (!hero) return;
        const header = hero.closest('.workspace-page-shell')?.querySelector<HTMLElement>('.workspace-site-header');
        const measure = () => {
            if (!window.matchMedia('(max-width: 700px)').matches) return;
            // Stable small viewport: collapsing mobile browser chrome must not move the CTA.
            const top = Math.max(0, hero.getBoundingClientRect().top + window.scrollY);
            hero.style.setProperty('--catalog-mobile-hero-top', `${Math.ceil(top)}px`);
            resultsRef.current?.style.setProperty('--catalog-hero-scroll-offset', `${Math.ceil(header?.getBoundingClientRect().height ?? 62) + 16}px`);
        };
        measure();
        const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
        if (header) observer?.observe(header);
        window.addEventListener('resize', measure);
        return () => { observer?.disconnect(); window.removeEventListener('resize', measure); };
    }, []);
    const scrollToCatalog = () => {
        const results = document.getElementById('catalog-home-results');
        if (!results) return;
        results.focus({ preventScroll: true });
        results.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    };
    const searchRef = useRef<HTMLInputElement>(null);
    const searchTriggerRef = useRef<HTMLButtonElement>(null);
    const [searchOpen, setSearchOpen] = useState(Boolean(search));
    useEffect(() => { if (searchOpen) searchRef.current?.focus({preventScroll:true}); }, [searchOpen]);
    const closeSearch = () => { onSearch(''); setSearchOpen(false); searchTriggerRef.current?.focus({preventScroll:true}); };
    const categoryPanel=useRef<HTMLDivElement>(null);
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]), [draftCategories, setDraftCategories] = useState<string[]>([]), [categoryOpen, setCategoryOpen] = useState(false);
    const [filter, setFilter] = useState('all'), [sort, setSort] = useState('rec'), [maxPrice, setMaxPrice] = useState(''), [minDR, setMinDR] = useState(''), [page, setPage] = useState(1), [advanced, setAdvanced] = useState(false);
    const [listOpen, setListOpen] = useState(false), [listStage, setListStage] = useState<'input'|'review'>('input'), [listDraft, setListDraft] = useState('');
    const [listMatches, setListMatches] = useState<ListMatch[]>([]), [listUnmatched, setListUnmatched] = useState<string[]>([]), [listFilterIds, setListFilterIds] = useState<string[]>([]);
    const [listExpanded, setListExpanded] = useState(true);
    const [correction, setCorrection] = useState(''), [correcting, setCorrecting] = useState('');
    const fav = useData('favorites', ctx.revision, !!ctx.user);
    const favoriteIds: string[] = (fav.data?.favorites || []).filter((item: Row) => item.kind === 'favorite').map((item: Row) => item.website_id);
    const available = useMemo(() => ctx.catalog.filter(site => site.active !== 0), [ctx.catalog]);
    const values = (value: unknown): string[] => Array.isArray(value) ? value.flatMap(values) : value && typeof value === 'object' ? Object.values(value).flatMap(values) : value == null ? [] : [String(value), categories[String(value)] || ''];
    const inCategories = (site: Row, chosen: string[]) => !chosen.length || chosen.some(category => values([site.category, site.categories]).includes(category));
    // Every filter except categories, so the category sheet can count what each choice would show
    const beforeCategories = useMemo(() => {
        const query = search.trim().toLocaleLowerCase();
        return available.filter(site => (!listFilterIds.length || listFilterIds.includes(site.id)) && (!query || values([site.name, site.url, site.city, site.category, site.categories, site.tags]).some(value => value.toLocaleLowerCase().includes(query))) && (filter !== 'sale' || site.is_on_sale) && (filter !== 'favorites' || favoriteIds.includes(site.id)) && (!maxPrice || site.price_cents <= Number(maxPrice) * 100) && (!minDR || Number(site.dr || 0) >= Number(minDR)));
    }, [available, search, listFilterIds, filter, maxPrice, minDR, favoriteIds.join(',')]);
    const filtered = useMemo(() => beforeCategories.filter(site => inCategories(site, selectedCategories)).sort((a,b) => sort === 'low' ? a.price_cents - b.price_cents : sort === 'high' ? b.price_cents - a.price_cents : sort === 'name' ? a.name.localeCompare(b.name, 'he') : sort === 'rec' ? (Number(a.sort_order ?? 1e9) - Number(b.sort_order ?? 1e9)) || Number(b.dr || 0) - Number(a.dr || 0) : Number(b.dr || 0) - Number(a.dr || 0)), [beforeCategories, selectedCategories, sort]);
    const categoryCounts = useMemo(() => Object.fromEntries(Object.keys(categories).map(id => [id, beforeCategories.filter(site => inCategories(site, [id])).length])) as Record<string, number>, [beforeCategories]);
    const draftCount = useMemo(() => beforeCategories.filter(site => inCategories(site, draftCategories)).length, [beforeCategories, draftCategories]);
    const popularCategories = useMemo(() => Object.keys(categories).sort((a, b) => (categoryCounts[b] || 0) - (categoryCounts[a] || 0)).slice(0, 3), [categoryCounts]);
    const priceCeiling = useMemo(() => Math.max(1000, Math.ceil(Math.max(0, ...available.map(site => Number(site.price_cents) || 0)) / 100000) * 1000), [available]);
    const priceBins = useMemo(() => { const bins = Array(12).fill(0); for (const site of available) bins[Math.min(11, Math.floor((Number(site.price_cents) || 0) / 100 / priceCeiling * 12))]++; return bins; }, [available, priceCeiling]);
    const [categoryQuery, setCategoryQuery] = useState('');
    const shekel = (ils: number) => '₪' + ils.toLocaleString('he-IL');
    const showCount = (count: number) => count === 1 ? 'הצגת אתר אחד' : count ? `הצגת ${count.toLocaleString('he-IL')} אתרים` : 'אין אתרים מתאימים';
    useEffect(() => setPage(1), [search, selectedCategories, listFilterIds, filter, maxPrice, minDR, sort]);
    const pages = Math.max(1, Math.ceil(filtered.length / 24));
    const currentPage = Math.min(page, pages);
    const shown = filtered.slice((currentPage - 1) * 24, currentPage * 24);
    const reset = () => { onSearch(''); setSelectedCategories([]); setDraftCategories([]); setListFilterIds([]); setListMatches([]); setListUnmatched([]); setListDraft(''); setFilter('all'); setMaxPrice(''); setMinDR(''); setSort('rec'); };
    const hasFilters = Boolean(search || selectedCategories.length || listFilterIds.length || filter !== 'all' || maxPrice || minDR || sort !== 'rec');
    const activeFilterCount = Number(filter !== 'all') + Number(Boolean(maxPrice)) + Number(Boolean(minDR)) + Number(sort !== 'rec') + Number(Boolean(listFilterIds.length));
    const closeList = () => setListOpen(false);
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
        <section ref={heroRef} className="azure-catalog-hero" aria-label="חיפוש אתרים לפרסום">
            <div className="catalog-hero-composition">
                <div className="catalog-hero-intro">
                    <h1 className="catalog-hero-title"><span>איפה נפרסם</span><span className="azure-title-accent">את הכתבה הבאה שלך?</span></h1>
                    <p>חפשו לפי אתר או תחום, סננו ובחרו היכן לפרסם.</p>
                    <Button type="button" className="catalog-home-cta" aria-controls="catalog-home-results" onClick={scrollToCatalog}>לצפייה בקטלוג<ArrowLeft size={18} aria-hidden="true"/></Button>
                </div>
                <CatalogPublicationScene/>
            </div>
            <Button type="button" variant="ghost" className="catalog-mobile-scroll" aria-label="גלילה לקטלוג האתרים" aria-controls="catalog-home-results" onClick={scrollToCatalog}><ChevronDown size={21} aria-hidden="true"/></Button>
        </section>
        <div ref={resultsRef} id="catalog-home-results" tabIndex={-1} role="region" aria-label="קטלוג אתרים לפרסום" className="catalog-home-results relative mx-auto max-w-[1760px] px-4 pb-10 sm:px-8 lg:px-10">
            <div className="catalog-results-toolbar">
                <div className="catalog-results-heading"><h2 className="!text-xl font-bold text-slate-800">אתרים לפרסום</h2></div>
                <div className="catalog-home-tools">
                    <Popover open={categoryOpen} onOpenChange={open => {setCategoryOpen(open); if(open) {setDraftCategories(selectedCategories); setCategoryQuery('');}}}><PopoverTrigger asChild><Button variant="outline" aria-label="בחירת קטגוריות" className="catalog-home-category-trigger"><LayoutGrid size={25}/><span>{selectedCategories.length ? `${selectedCategories.length} קטגוריות נבחרו` : 'בחירת קטגוריות'}</span><ChevronDown size={19}/></Button></PopoverTrigger><PopoverContent ref={categoryPanel} dir="rtl" align="end" side="bottom" sideOffset={10} collisionPadding={16} onOpenAutoFocus={event=>{event.preventDefault();categoryPanel.current?.focus({preventScroll:true});}} aria-label="בחירת תחומי פרסום" className="catalog-category-glass catalog-home-category-panel catalog-filter-sheet catalog-category-sheet"><div className="catalog-sheet-grab" aria-hidden="true"/><div className="catalog-sheet-head"><button type="button" className="catalog-sheet-x" aria-label="סגירת הקטגוריות" onClick={()=>setCategoryOpen(false)}><X size={15}/></button><strong>קטגוריות</strong><button type="button" className="catalog-sheet-link" disabled={!draftCategories.length} onClick={()=>setDraftCategories([])}>ניקוי</button></div><div className="catalog-sheet-search"><Search size={17} aria-hidden="true"/><input type="text" value={categoryQuery} onChange={e=>setCategoryQuery(e.target.value)} placeholder="חיפוש תחום" aria-label="חיפוש תחום"/></div>{(()=>{const q=categoryQuery.trim();const ids=Object.keys(categories).filter(id=>!q||categories[id].includes(q));const top=ids.filter(id=>popularCategories.includes(id)).sort((a,b)=>popularCategories.indexOf(a)-popularCategories.indexOf(b)),rest=ids.filter(id=>!popularCategories.includes(id));return <>{top.length>0&&<><p className="catalog-sheet-section">הכי מבוקשות</p><div className="catalog-cat-chips">{top.map((id:string)=><label key={id} className="catalog-cat-chip" data-on={draftCategories.includes(id)} data-count={(categoryCounts[id]||0).toLocaleString('he-IL')}><Checkbox checked={draftCategories.includes(id)} onCheckedChange={checked=>setDraftCategories(old=>checked?[...old,id]:old.filter(item=>item!==id))} className="catalog-cat-check"/><Check size={14} aria-hidden="true" className="catalog-cat-tick"/>{categories[id]}</label>)}</div></>}{rest.length>0&&<><p className="catalog-sheet-section">כל התחומים</p><div className="catalog-cat-chips">{rest.map((id:string)=><label key={id} className="catalog-cat-chip" data-on={draftCategories.includes(id)} data-count={(categoryCounts[id]||0).toLocaleString('he-IL')}><Checkbox checked={draftCategories.includes(id)} onCheckedChange={checked=>setDraftCategories(old=>checked?[...old,id]:old.filter(item=>item!==id))} className="catalog-cat-check"/><Check size={14} aria-hidden="true" className="catalog-cat-tick"/>{categories[id]}</label>)}</div></>}{!ids.length&&<p className="catalog-sheet-empty">לא נמצא תחום בשם הזה.</p>}</>;})()}<div className="catalog-sheet-foot"><button type="button" className="catalog-sheet-secondary" onClick={()=>{setDraftCategories([]);setSelectedCategories([]);setCategoryOpen(false);}}>הכול</button><button type="button" className="catalog-sheet-primary" disabled={!draftCount} onClick={()=>{setSelectedCategories(draftCategories);setCategoryOpen(false);}}>{showCount(draftCount)}</button></div></PopoverContent></Popover>
                    <div className="catalog-inline-search-slot">
                        <div className="catalog-inline-search" data-open={searchOpen}>
                            <Button ref={searchTriggerRef} variant="ghost" className="catalog-home-search-trigger" aria-label="פתיחת חיפוש בקטלוג" aria-expanded={searchOpen} aria-controls="catalog-inline-search-input" onClick={()=>{setSearchOpen(true);searchRef.current?.focus({preventScroll:true});}}><Search size={21}/></Button>
                            <Input ref={searchRef} id="catalog-inline-search-input" type="search" aria-label="חיפוש לפי שם אתר, כתובת, קטגוריה או תגית" disabled={!searchOpen} value={search} onChange={e=>onSearch(e.target.value)} onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();closeSearch();}}} placeholder="חיפוש אתר או תחום" className="catalog-inline-search-input"/>
                            {searchOpen&&<Button variant="ghost" size="icon" className="catalog-search-close" aria-label="סגירת החיפוש" onClick={closeSearch}><X size={18}/></Button>}
                        </div>
                    </div>
                </div>
                <div className="catalog-results-actions" role="group" aria-label="פעולות קטלוג"><Button variant="outline" className="catalog-action-button catalog-sort-trigger" onClick={()=>setAdvanced(true)} aria-haspopup="dialog"><SlidersHorizontal size={17}/>סינון ומיון{activeFilterCount > 0 && <span className="catalog-sort-count" aria-label={`${activeFilterCount} סינונים פעילים`}>{activeFilterCount}</span>}</Button><Button variant="outline" className="catalog-action-button" onClick={()=>download('megalinks-catalog.csv',csv(filtered.map(site=>({name:site.name,url:site.url,category:categories[site.category],price_ils:site.price_cents/100,DR:site.dr||0})),['name','url','category','price_ils','DR']))}><Download size={15}/>ייצוא קטלוג</Button><Button variant="outline" className="catalog-action-button catalog-list-trigger" aria-haspopup="dialog" onClick={()=>{setListStage('input');setListOpen(true);}}><ListFilter size={17}/>הדבקת רשימת אתרים{listFilterIds.length > 0 && <span className="catalog-sort-count" aria-label={`${listFilterIds.length} אתרים מהרשימה`}>{listFilterIds.length}</span>}</Button><Button variant="outline" className="catalog-action-button" onClick={()=>ctx.go('bulk')}><Plus size={15}/>הזמנה מרוכזת</Button><Button className="catalog-add-site" onClick={()=>{if(ctx.user)ctx.go('purchased/selling');else window.location.assign('/signin-with-chatgpt?return_to=%2Fpurchased%2Fselling');}}><Plus size={17}/>הוספת אתר לקטלוג</Button></div></div>
            {(()=>{const active:[string,React.ReactNode,()=>void][]=[...selectedCategories.map(id=>['cat-'+id,categories[id],()=>setSelectedCategories(old=>old.filter(item=>item!==id))] as [string,React.ReactNode,()=>void]),...(filter==='sale'?[['sale','במבצע',()=>setFilter('all')] as [string,React.ReactNode,()=>void]]:[]),...(filter==='favorites'?[['fav','מועדפים',()=>setFilter('all')] as [string,React.ReactNode,()=>void]]:[]),...(maxPrice?[['price','עד '+shekel(Number(maxPrice)),()=>setMaxPrice('')] as [string,React.ReactNode,()=>void]]:[]),...(minDR?[['dr','‎DR '+minDR+'+‎',()=>setMinDR('')] as [string,React.ReactNode,()=>void]]:[]),...(listFilterIds.length?[['list',listFilterIds.length+' אתרים מהרשימה',()=>setListFilterIds([])] as [string,React.ReactNode,()=>void]]:[])];return active.length>0&&<div className="catalog-active-filters" aria-label="מסננים פעילים">{active.map(([key,labelText,remove])=><button type="button" key={key} className="catalog-active-chip" aria-label={'הסרת מסנן'} onClick={remove}>{labelText}<X size={12} aria-hidden="true"/></button>)}<span className="catalog-active-total">{filtered.length.toLocaleString('he-IL')} אתרים</span></div>;})()}

            {shown.length ? <CatalogMotionGrid resultKey={shown.map(site=>site.id).join(',')}>{shown.map(site=><div key={site.id} className="catalog-card-reveal" data-catalog-reveal="initial"><PublicationCard site={site} ctx={ctx} favorite={favoriteIds.includes(site.id)} onFavorite={()=>{if(!ctx.user){toast.info('התחברו כדי לשמור אתרים');return;}ctx.run(()=>api('favorites','POST',{website_id:site.id,kind:'favorite'}),'').catch(()=>{});}}/></div>)}</CatalogMotionGrid> : loading ? <div role="status" aria-label="טעינת הקטלוג" className="min-h-40"/> : <Card className="items-center border-dashed py-12 text-center"><Search size={30} className="text-slate-400"/><h2 className="!text-xl text-slate-800">לא נמצאו אתרים</h2><p className="text-base text-slate-500">נסו לשנות את החיפוש או לנקות את המסננים.</p><Button variant="outline" onClick={reset}>ניקוי מסננים</Button></Card>}
            <nav aria-label="עמודי קטלוג" className="mt-8 flex flex-wrap items-center justify-center gap-2"><Button variant="outline" size="icon" className="rounded-full" disabled={currentPage<=1} onClick={()=>setPage(currentPage-1)} aria-label="עמוד קודם"><ChevronRight size={16}/></Button>{Array.from({length:Math.min(5,pages)},(_,index)=>Math.min(Math.max(1,currentPage-2),Math.max(1,pages-4))+index).map(number=><Button key={number} variant={currentPage===number?'default':'ghost'} className={'size-10 rounded-full ' + (currentPage===number?'bg-slate-900 text-white':'text-slate-500')} onClick={()=>setPage(number)} aria-current={currentPage===number?'page':undefined}>{number}</Button>)}<span className="px-2 text-sm text-slate-500">מתוך {pages}</span><Button variant="outline" size="icon" className="rounded-full" disabled={currentPage>=pages} onClick={()=>setPage(currentPage+1)} aria-label="עמוד הבא"><ChevronLeft size={16}/></Button></nav>
        </div>
        <Dialog open={advanced} onOpenChange={setAdvanced}><DialogContent dir="rtl" showCloseButton={false} className="catalog-sort-dialog">
            <div className="catalog-sheet-grab" aria-hidden="true"/>
            <header className="catalog-sheet-head"><button type="button" className="catalog-sheet-x" aria-label="סגירת סינון ומיון" onClick={()=>setAdvanced(false)}><X size={15}/></button><DialogHeader><DialogTitle>סינון ומיון</DialogTitle><DialogDescription className="sr-only">מיון, מבצעים, מחיר ו-DR. הקטגוריות נבחרות בכפתור נפרד.</DialogDescription></DialogHeader><button type="button" className="catalog-sheet-link" disabled={!hasFilters} onClick={reset}>איפוס</button></header>
            <p className="catalog-sheet-section">מיון לפי</p>
            <ToggleGroup type="single" dir="rtl" value={sort} onValueChange={value=>{if(value)setSort(value);}} aria-label="מיון לפי" className="catalog-seg">{Object.entries({rec:'מומלץ',low:'מחיר ↑',high:'מחיר ↓',dr:'DR'}).map(([value,label])=><ToggleGroupItem key={value} value={value} className="catalog-seg-item">{label}</ToggleGroupItem>)}</ToggleGroup>
            <p className="catalog-sheet-section">הצגה מהירה</p>
            <div className="catalog-sheet-inset">
                <label className="catalog-sort-switch-row"><span className="catalog-sort-copy"><span className="catalog-sort-icon catalog-sort-sale"><Tag size={16}/></span><span><strong>רק אתרים במבצע</strong><small>מחיר מוזל לזמן מוגבל</small></span></span><input type="checkbox" role="switch" className="catalog-ios-switch" checked={filter==='sale'} onChange={()=>setFilter(filter==='sale'?'all':'sale')}/></label>
                <label className="catalog-sort-switch-row"><span className="catalog-sort-copy"><span className="catalog-sort-icon catalog-sort-heart"><Heart size={16}/></span><span><strong>המועדפים שלי</strong></span></span><input type="checkbox" role="switch" className="catalog-ios-switch" checked={filter==='favorites'} onChange={()=>setFilter(filter==='favorites'?'all':'favorites')}/></label>
            </div>
            <p className="catalog-sheet-section">מחיר לכתבה, לפני מע״מ</p>
            <div className="catalog-price-range">
                <div className="catalog-price-values"><span>{maxPrice?<>עד <b>{shekel(Number(maxPrice))}</b></>:<b>כל המחירים</b>}</span><span>מתוך {shekel(priceCeiling)}</span></div>
                <div className="catalog-price-hist" aria-hidden="true">{priceBins.map((count,index)=><i key={index} data-in={!maxPrice||index/12*priceCeiling<Number(maxPrice)} style={{height:Math.max(6,count/Math.max(1,...priceBins)*100)+'%'}}/>)}</div>
                <input type="range" min={200} max={priceCeiling} step={100} value={maxPrice||priceCeiling} onChange={e=>{const value=Number(e.target.value);setMaxPrice(value>=priceCeiling?'':String(value));}} aria-label="מחיר מרבי בש״ח" className="catalog-price-slider" style={{'--fill':(((Number(maxPrice)||priceCeiling)-200)/(priceCeiling-200)*100)+'%'} as React.CSSProperties}/>
                <div className="catalog-price-quick">{[500,1000,3000].filter(value=>value<priceCeiling).map(value=><button type="button" key={value} aria-pressed={maxPrice===String(value)} onClick={()=>setMaxPrice(String(value))}>עד {shekel(value)}</button>)}<button type="button" aria-pressed={!maxPrice} onClick={()=>setMaxPrice('')}>הכל</button></div>
            </div>
            <p className="catalog-sheet-section">DR מינימלי</p>
            <ToggleGroup type="single" dir="rtl" value={minDR||'all'} onValueChange={value=>{if(value)setMinDR(value==='all'?'':value);}} aria-label="DR מינימלי" className="catalog-seg catalog-seg-dr">{['all','10','20','30','50'].map(value=><ToggleGroupItem key={value} value={value} className="catalog-seg-item">{value==='all'?'הכל':'‎'+value+'+‎'}</ToggleGroupItem>)}</ToggleGroup>
            <footer className="catalog-sort-footer"><button type="button" className="catalog-sort-reset" onClick={reset} disabled={!hasFilters&&!listDraft.trim()}>איפוס סינונים</button><button type="button" className="catalog-sort-apply" disabled={!listDraft.trim()&&!filtered.length} onClick={()=>listDraft.trim()?reviewList():setAdvanced(false)}>{listDraft.trim()?'בדיקת הרשימה':showCount(filtered.length)}</button></footer>
        </DialogContent></Dialog>
        <Dialog open={listOpen} onOpenChange={open=>{if(open)setListOpen(true);else closeList();}}><DialogContent dir="rtl" showCloseButton={false} className="catalog-sort-dialog catalog-list-dialog">
            <div className="catalog-sort-handle" aria-hidden="true"/>
            <header className="catalog-sort-heading"><DialogHeader><DialogTitle>{listStage==='input'?'סינון לפי רשימת אתרים':'בדיקת האתרים שנמצאו'}</DialogTitle><DialogDescription className={listStage==='input'?'sr-only':undefined}>{listStage==='input'?'הדביקו רשימת אתרים למיון מתוך הקטלוג':'בדקו את הרשימה לפני הצגתה במחירון. אפשר להסיר, לתקן או להוסיף אתרים.'}</DialogDescription></DialogHeader><button type="button" className="catalog-sort-close" aria-label="סגירת רשימת האתרים" onClick={closeList}><X size={17}/></button></header>
            {listStage==='input'?<><div className="catalog-list-input-panel"><label htmlFor="catalog-list-input">הדביקו רשימת אתרים למיון מתוך הקטלוג</label><Textarea id="catalog-list-input" dir="auto" value={listDraft} onChange={e=>setListDraft(e.target.value)} onPaste={e=>{const input=e.currentTarget;const pasted=e.clipboardData.getData('text');const combined=listDraft.slice(0,input.selectionStart)+pasted+listDraft.slice(input.selectionEnd);const addresses=extractCatalogAddresses(combined);if(addresses.length){e.preventDefault();setListDraft(addresses.join('\n'));}}} placeholder="הדביקו כאן את רשימת האתרים"/><p>אפשר להדביק הודעה שלמה. כתובות האתרים יזוהו אוטומטית, ושאר המלל והמחירים יוסרו. דומיינים דומים לא יוחלפו זה בזה.</p></div><footer className="catalog-sort-footer"><button type="button" onClick={closeList} className="catalog-sort-reset">ביטול</button><button type="button" onClick={reviewList} disabled={!listDraft.trim()} className="catalog-sort-apply"><Search size={18}/>בדיקת הרשימה</button></footer></>
            :<div className="space-y-4 px-5 pb-6 pt-5 sm:px-7"><div className="flex items-center justify-between gap-2"><strong className="text-base text-slate-900">{listMatches.length} אתרים נמצאו</strong><Button variant="ghost" className="h-9 rounded-full text-sm text-teal-800" onClick={()=>setListStage('input')}><Pencil size={15}/>עריכת הרשימה</Button></div><div className="max-h-56 space-y-2 overflow-y-auto pr-1" aria-label="אתרים שנמצאו">{listMatches.map(item=>{const site=available.find(site=>site.id===item.siteId);return site&&<div key={item.siteId} className="flex min-w-0 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5"><span className="grid size-8 shrink-0 place-items-center rounded-full bg-teal-100 text-teal-700"><Check size={17}/></span><div className="min-w-0 flex-1"><strong className="block truncate text-sm text-slate-900">{site.name}</strong><span dir="ltr" className="block truncate text-right text-xs text-slate-500">{site.url}</span></div><Button variant="ghost" size="icon" aria-label={`הסרת ${site.name} מהרשימה`} onClick={()=>setListMatches(old=>old.filter(row=>row.siteId!==item.siteId))} className="size-9 shrink-0 rounded-full text-slate-500 hover:text-red-600"><X size={16}/></Button></div>})}{!listMatches.length&&<p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">לא נמצאו אתרים ברשימה. תקנו את הכתובות או נסו שמות אתרים.</p>}</div>
                {!!listUnmatched.length&&<div className="rounded-xl border border-amber-200 bg-amber-50 p-3"><strong className="text-sm text-amber-900">לא זוהו ({listUnmatched.length})</strong><p className="mt-1 text-xs text-amber-800">בדקו את הכתובת והוסיפו תיקון בשדה למטה.</p><div className="mt-2 flex flex-wrap gap-1.5">{listUnmatched.map(value=><span key={value} dir="auto" className="inline-flex max-w-full items-center gap-1 rounded-full bg-white px-2 py-1 text-xs text-amber-900"><span className="truncate">{value}</span><button type="button" className="font-bold underline" onClick={()=>{setCorrection(value);setCorrecting(value);}} aria-label={`תיקון ${value}`}>תיקון</button><button type="button" aria-label={`הסרת ${value} מהרשימה שלא זוהתה`} onClick={()=>setListUnmatched(old=>old.filter(item=>item!==value))}><X size={13}/></button></span>)}</div></div>}
                <div className="flex flex-col gap-2 sm:flex-row"><Input dir="auto" aria-label="הוספת או תיקון כתובת אתר" value={correction} onChange={e=>setCorrection(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();addCorrection();}}} placeholder="הוספת אתר או תיקון כתובת" className="h-11 flex-1 rounded-xl border-slate-300 bg-white text-right text-slate-900"/><Button variant="outline" onClick={addCorrection} disabled={!correction.trim()} className="h-11 rounded-xl border-slate-300 text-slate-800"><Plus size={17}/>הוספה לרשימה</Button></div><div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row"><Button variant="outline" onClick={()=>setListStage('input')} className="h-12 rounded-xl border-slate-200 text-slate-700">חזרה לעריכה</Button><Button disabled={!listMatches.length} onClick={()=>{setListFilterIds(listMatches.map(item=>item.siteId));setListOpen(false);}} className="h-12 flex-1 rounded-xl bg-[#0b2351] text-base font-bold text-white hover:bg-[#173a68] disabled:opacity-50">אישור והצגת {listMatches.length} אתרים</Button></div></div>}
        </DialogContent></Dialog>
    </div>;
}
