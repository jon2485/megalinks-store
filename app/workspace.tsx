'use client';
import ClientHub from './client-hub';
import KnowledgeAdmin from './knowledge-admin';
import {BrandLoadingScreen} from './brand-loading';
import {clientHubRoute,isClientHub,preserveAccountScroll} from '@/lib/client-hub-navigation';
import {clientPageSeo} from '@/lib/seo';
import {AdminNavigation,AdminControlCenter,AdminSectionTabs,AdminHeader,AdminMobileDock} from './admin-shell';
import {AdminAttentionBoundary} from './admin-attention';
import {AdminEditorialSurface} from './admin-editorial-surface';
import './admin-design-v172.css';
import './admin-complete.css';
import './admin-approved-glass.css';
import {AdminOrderPage,AdminSupportPage} from './admin-record-pages';
import {AdminPaymentReports} from './payment-reports';
import UsersAdmin from './users-admin';
import CustomerAccountAdmin from './customer-account-admin';
import PricingWarningDialog from './pricing-warning';
import {useLivePricing} from '@/lib/pricing-sync';
import {PricingAdmin,PersonalPricebook} from './pricing-admin';
import React, { useEffect, useMemo, useState, useRef } from 'react';
import { Globe, LayoutDashboard, ShoppingCart, FileText, Link2, Users, Gift, Wallet, FolderOpen, LifeBuoy, Settings, ChevronLeft, ChevronRight, Search, SlidersHorizontal, Heart, ArrowUpLeft, Plus, Check, Clock, ShieldCheck, Sparkles, Send, Download, Upload, X, ExternalLink, BarChart3, Building2, Tag, BookOpen, Plug, Zap, History, Code2, Bell, Copy, Trash2, Pencil, CheckCircle2, ImageIcon, Filter, ArrowDownWideNarrow, LogOut, Menu, Percent, Calendar, MoreHorizontal, RefreshCw, Eye, LoaderCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import WorkspaceHeader from './workspace-navigation';
import CustomersView from './customers-view';
import WorkspaceFooter from './workspace-footer';
import TermsContent from './terms-content';
import { Toaster, toast } from 'sonner';
import { pricingApi, api, useData, download, csv, decodeHtml } from '@/lib/client';
import { Row, money, when, stages, writingStyles, articleTransitions } from '@/lib/shared';
import { CreditAccounts, MonthlyView, ApprovalBoard, NoticesView, SupplierFinance } from './management';
import { CartFlow, ArticleStudio, PurchasedView, SupplierInbox } from './purchase-flow';
import { OffersView, SuppliersView } from './commerce';
import CatalogGrid from './catalog-pricing-workspace';
import CatalogWebsiteForm from './catalog-website-form';
import BillingWorkspace from './billing-workspace';
import SellerWorkspace from './seller-workspace';
import AdminMonthClose from './admin-month-close';
import './admin-guide-workspace.css';
import {AdminTopups,AdminInvoices} from './admin-finance';
import PremiumCatalog from './catalog-view';
import {notifyCartAdded} from './cart-add-feedback';
import { CartView, OrdersView, ArticlesView, ArticleEditor, Dashboard, WalletView, FilesView, RecordView, SettingsView, ReportsView, UsersView, CouponsView, LogsView, ApiView, ProfileView, BulkView, SupplierView } from './screens';
export const categories: Record<string, string> = { news_national: 'חדשות ארציות', news_local: 'חדשות מקומיות', tech: 'טכנולוגיה', finance: 'כלכלה ופיננסים', business: 'עסקים', lifestyle: 'לייף סטייל', magazines: 'מגזינים', real_estate: 'נדל״ן', health: 'בריאות', legal: 'משפטים', education: 'חינוך', tourism: 'תיירות', food: 'אוכל', sports: 'ספורט', entertainment: 'בידור', religion: 'דת ומסורת', israeli_foreign_lang: 'שפות זרות', general: 'כללי' };
export const navClient = [['catalog', 'קטלוג אתרים', Globe], ['offers', 'מבצעים וחבילות', Gift], ['purchased', 'אזור אישי', FileText]] as const;
const clientContentView = clientHubRoute;
const orderPages = ['orders', 'purchased', 'articles', 'links', 'bulk', 'files', 'supplier-workspace', 'supplier-finance'];
const secondaryTitles: Record<string, string> = { 'admin-pricebooks':'מחירונים אישיים', purchased: 'הקישורים שלי', articles: 'כל הכתבות שלי', links: 'קישורים שפורסמו', files: 'ספריית קבצים', bulk: 'הזמנה מרוכזת', monthly: 'חשבון חודשי', support: 'תמיכה', api: 'חיבור API', 'supplier-workspace': 'פורטל ספקים', 'supplier-finance': 'הפרסומים והתשלומים שלי', notifications: 'התראות' };

export const navAdmin = [['admin', 'מרכז הבקרה', LayoutDashboard], ['admin-orders', 'הזמנות', ShoppingCart], ['admin-month-close','סגירת חודש',Calendar], ['admin-payment-reports','דיווחי תשלום',ShieldCheck], ['admin-topups','בקשות הטענת יתרה',Wallet], ['admin-invoices','חשבוניות וקבלות',FileText], ['admin-approvals','לוח אישורים',ShieldCheck], ['admin-monthly','חשבונות חודשיים',Wallet], ['admin-supplier-finance','התחשבנות ספקים',Building2], ['admin-notifications','התראות ודיוור',Bell], ['admin-articles', 'אישור ועריכת תוכן', FileText], ['admin-publication', 'תור פרסום לספקים', Send], ['admin-websites', 'ניהול אתרים — טבלה', Globe], ['admin-pricing','רמות והנחות',Wallet], ['admin-users', 'משתמשים והרשאות', Users], ['admin-suppliers', 'ספקים', Building2], ['admin-seller-requests','בקשות ספקים וחשבוניות',Building2], ['admin-promotions', 'מבצעים וקופונים', Tag], ['admin-instructions', 'הנחיות כתיבה', BookOpen], ['admin-connections', 'חיבורים והגדרות', Plug], ['admin-reports', 'דוחות', BarChart3], ['admin-support', 'פניות שירות', LifeBuoy], ['admin-jobs', 'יומן חיבורים', Zap], ['admin-audit', 'יומן פעילות', History]] as const;
export function Pick({ value, onChange, options, placeholder = 'בחירה', className = '', disabled = false }: {
    value: string;
    onChange: (value: string) => void;
    options: Record<string, string>;
    placeholder?: string;
    className?: string;
    disabled?: boolean;
}) { return <Select dir="rtl" value={value || undefined} onValueChange={onChange} disabled={disabled}><SelectTrigger className={'w-full ' + className}><SelectValue placeholder={placeholder}/></SelectTrigger><SelectContent>{Object.entries(options).map(([v, t]) => <SelectItem value={v} key={v}>{t}</SelectItem>)}</SelectContent></Select>; }
export function Field({ label, children, wide = false, hint = '' }: {
    label: string;
    children: React.ReactNode;
    wide?: boolean;
    hint?: string;
}) { return <label className={'field' + (wide ? ' wide' : '')}>{label}{children}{hint && <small>{hint}</small>}</label>; }
export function Badge({ status, children, tone }: any) { const color = tone || (status === 'published' || status === 'paid' || status === 'approved' || status === 'completed' ? 'green' : status === 'pending' || status === 'review' || status === 'requested' ? 'amber' : status === 'cancelled' || status === 'failed' ? 'red' : 'blue'); return <span className={'badge ' + color}>{children || stages[status] || status}</span>; }
export function Empty({ title = 'עדיין אין כאן נתונים', text = 'המידע יופיע כאן לאחר הפעולה הראשונה.', action, icon: Icon = FileText }: any) { return <div className="empty"><Icon size={33}/><h3>{title}</h3><p>{text}</p>{action}</div>; }
export function ErrorBox({ error }: any) { return error ? <div className="error-box" role="alert">{error}</div> : null; }
export function Heading({ title, description, eyebrow, actions }: any) { return <div className="page-heading"><div>{eyebrow && <div className="eyebrow">{eyebrow}</div>}<h1>{title}</h1>{description && <p>{description}</p>}</div>{actions && <div className="heading-actions">{actions}</div>}</div>; }
export function Stats({ items }: any) { return <div className="stat-grid">{items.map((s: any, i: number) => <div className="stat" key={i}><div className="stat-icon">{s.icon || <BarChart3 size={17}/>}</div><div className="label">{s.label}</div><div className="value">{s.value}</div><div className={'sub ' + (s.positive ? 'positive' : '')}>{s.sub}</div></div>)}</div>; }
export type Ctx = {
    user: Row | null;
    revision: number;
    pricingRevision?: number;
    refresh: () => void;
    go: (v: string) => void;
    open: (m: Row) => void;
    run: (fn: () => Promise<any>, success?: string) => Promise<any>;
    catalog: Row[];
    adminMode: boolean;
    pendingApprovals?: number;
};
export default function Workspace({ initialCatalog, initialView = 'catalog' }: {
    initialCatalog: Row[];
    initialView?: string;
}) {
    const [view, setView] = useState(clientContentView(initialView)), [revision, setRevision] = useState(0), [modal, setModal] = useState<Row | null>(null), [dirty, setDirty] = useState(false);
    const busyLock = useRef(false);
    const dirtyNavigation = useRef(false);
    const [catalogSearch, setCatalogSearch] = useState('');
    useEffect(()=>{if(clientContentView(initialView)!==initialView)window.history.replaceState({},'', '/'+clientContentView(initialView));},[initialView]);
    const premiumCatalog = view === 'catalog';
    const premiumShell = view === 'purchased/selling' || isClientHub(view) || ['profile','wallet','monthly','admin-topups','admin-invoices','customers','support','admin-support'].includes(view) || view === 'admin-promotions' || premiumCatalog || view === 'offers' || view === 'cart' || view === 'checkout' || view === 'purchased' || view.startsWith('article/') || view.startsWith('admin-article/');
    const me = useData('me', revision);const branding=useData('branding',revision);const brand=branding.data?.brand||'פוסטפלואו';
    const [pricingRevision,setPricingRevision]=useState(0);
    const catalogPath=view.startsWith('admin')?'catalog?scope=admin':'catalog';
    const catalogData = useData(catalogPath, revision);
    const user = me.data?.user || null;
    useEffect(()=>{if(!user)return;const timer=setInterval(()=>api('me','GET',undefined,{background:true}).then(me.setData).catch(()=>{}),45000);return()=>clearInterval(timer);},[user?.id]);
    const catalog = catalogData.data?.websites || (premiumCatalog&&!user?initialCatalog:[]);
    const adminMode = view.startsWith('admin');
    useEffect(()=>{
        const seo=clientPageSeo(view);document.title=seo.title;
        for(const [name,content] of [['description',seo.description],['robots',seo.robots]]){
            let tag=document.head.querySelector<HTMLMetaElement>('meta[name="'+name+'"]');
            if(!tag){tag=document.createElement('meta');tag.name=name;document.head.appendChild(tag);}tag.content=content;
        }
        let canonical=document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
        if(!seo.canonical){canonical?.remove();return;}
        if(!canonical){canonical=document.createElement('link');canonical.rel='canonical';document.head.appendChild(canonical);}canonical.href=seo.canonical;
    },[view]);
    useLivePricing(catalogData.data?.pricing_version,async active=>{
        const updated=await api(catalogPath,'GET',undefined,{background:true});
        if(active()){catalogData.setData(updated);setPricingRevision(x=>x+1);}
    },!adminMode,user?.id||'guest');
    const refresh = () => setRevision(x => x + 1);
    useEffect(()=>{const update=(event:Event)=>{if((event as CustomEvent).detail?.status!=='writing')setRevision(x=>x+1);};window.addEventListener('megalinks:ai-generation',update);return()=>window.removeEventListener('megalinks:ai-generation',update);},[]);
    const navigate = (v: string) => { v=clientContentView(v); if(v==='knowledge'){window.location.assign('/knowledge');return;} if(adminMode && v.startsWith('article/'))v='admin-'+v; dirtyNavigation.current=false; setDirty(false); setView(v); window.history.pushState({}, '', v === 'catalog' ? '/' : '/' + v); if(!preserveAccountScroll(view,v))window.scrollTo(0, 0); };
    const go = (v: string) => { v=clientContentView(v); if(adminMode&&v.startsWith('article/'))v='admin-'+v; if(view===v)return; if (adminMode?dirtyNavigation.current:dirty) {
        setModal({ title: 'יש שינויים שלא נשמרו', description: 'חזרו לעריכה כדי לשמור אותם, או צאו ללא שמירה.', render: (close: () => void) => <div className="flex-row"><Button onClick={close}>חזרה לעריכה</Button><Button variant="outline" onClick={() => { close(); navigate(v); }}>יציאה ללא שמירה</Button></div> });
        return;
    } navigate(v); };
    useEffect(() => { const dirtyListener = (e: Event) => {dirtyNavigation.current=!!(e as CustomEvent).detail;setDirty(dirtyNavigation.current);}; window.addEventListener('postflow:dirty', dirtyListener); return () => window.removeEventListener('postflow:dirty', dirtyListener); }, []);
    useEffect(() => { const listener = () => { const next=clientContentView(window.location.pathname.slice(1) || 'catalog'); setView(next); if(next!==(window.location.pathname.slice(1)||'catalog'))window.history.replaceState({},'', '/'+next); }; window.addEventListener('popstate', listener); return () => window.removeEventListener('popstate', listener); }, []);
    const run = async (fn: () => Promise<any>, success = 'נשמר בהצלחה') => { if (busyLock.current) {
        toast.info('פעולה קודמת עדיין בטיפול');
        throw new Error('פעולה קודמת עדיין בטיפול');
    } busyLock.current = true; try {
        const result = await fn();
        if (success)
            toast.success(success);
        refresh();
        return result;
    }
    catch (e) {
        toast.error((e as Error).message);
        throw e;
    }
    finally {
        busyLock.current = false;
    } };
    const open = (modal: Row | null) => { if(modal?.kind==='order') { if(!user){window.location.href='/signin-with-chatgpt?return_to=/';return;} if(busyLock.current)return;busyLock.current=true;api('cart','POST',{website_id:modal.site.id,topic:'כתבה עבור '+modal.site.name,words:500,quantity:1},{background:true}).then(()=>{notifyCartAdded(modal.site.id);return api('me','GET',undefined,{background:true});}).then(me.setData).catch(e=>toast.error((e as Error).message)).finally(()=>{busyLock.current=false;});return;}setModal(modal); };
    const ctx: Ctx = { user, revision, pricingRevision, refresh, go, open, run, catalog, adminMode, pendingApprovals: (me.data?.counts?.approvals || 0)+(me.data?.counts?.payments||0) };
    const title = [...navClient, ...navAdmin].find(x => x[0] === view)?.[1] || secondaryTitles[view] || ({ cart: 'סל פרסום', checkout:'סיכום הזמנה ותשלום', bulk: 'הזמנה מרוכזת', profile: 'פרטי חשבון' } as Row)[view] || 'הכתבה שלי';
    useEffect(() => { const mc = (document as any).modelContext; if (!mc?.registerTool)
        return; const life = new AbortController(); const register = (tool: any) => Promise.resolve(mc.registerTool(tool, { signal: life.signal })).catch(() => { }); register({ name: 'search_publication_sites', description: 'Search the current publication catalog by name or domain; returns current advertised prices.', inputSchema: { type: 'object', properties: { query: { type: 'string' }, maxPriceILS: { type: 'number' } }, additionalProperties: false }, annotations: { readOnlyHint: true, untrustedContentHint: true }, execute: (input: any) => { if (input.query !== undefined && typeof input.query !== 'string')
            throw new Error('query must be a string'); if (input.maxPriceILS !== undefined && (!Number.isFinite(input.maxPriceILS) || input.maxPriceILS < 0))
            throw new Error('maxPriceILS must be nonnegative'); return catalog.filter((w: Row) => w.active !== 0 && (!input.query || (w.name + ' ' + w.url).toLowerCase().includes(input.query.toLowerCase())) && (input.maxPriceILS === undefined || w.price_cents <= input.maxPriceILS * 100)).slice(0, 30).map((w: Row) => ({ id: w.id, name: w.name, priceILS: w.price_cents / 100, category: categories[w.category], url: w.url })); } }); register({ name: 'navigate_publication_workspace', description: 'Navigate to an existing workspace page without submitting or changing records.', inputSchema: { type: 'object', properties: { page: { type: 'string', enum: navClient.map(x => x[0]) } }, required: ['page'], additionalProperties: false }, annotations: { readOnlyHint: true }, execute: (input: any) => { if (!navClient.some(x => x[0] === input.page))
            throw new Error('Unsupported page'); go(input.page); return { page: input.page }; } }); return () => life.abort(); }, [catalog]);
    if (initialView.startsWith('supplier/'))
        return <div dir="rtl" className="workspace-page-shell"><WorkspaceHeader ctx={ctx} view={view} brand={brand} counts={me.data?.counts||{}}/><div className="workspace-page-content"><main className="w-full min-w-0"><SupplierView token={initialView.split('/')[1]}/></main><WorkspaceFooter go={go} adminMode={false}/></div><Toaster dir="rtl" position="bottom-left" richColors/></div>;
    return <AdminAttentionBoundary ctx={ctx}><div dir="rtl" className={'workspace-page-shell'+(premiumShell?' premium-catalog-shell':'')+(adminMode?' admin-unified-shell':'')+(adminMode&&user?.role==='admin'?' admin-design-v172':'')+((['catalog','cart','checkout','purchased','dashboard','strategies'].includes(view)||isClientHub(view)||view.startsWith('article/')||view.startsWith('admin-article/'))?' megalinks-azure-shell':'')}>{adminMode&&user?.role==='admin'?<AdminHeader ctx={ctx} view={view}/>:<WorkspaceHeader ctx={ctx} view={view} brand={brand} counts={me.data?.counts||{}}/>}<div className="workspace-page-content"><main className={premiumShell && (premiumCatalog || user) ? "w-full min-w-0" : "main"}>{adminMode&&user?.role==='admin'&&<AdminNavigation ctx={ctx} view={view}/>}<AdminEditorialSurface ctx={ctx} view={view} active={adminMode&&user?.role==='admin'}><div id={adminMode&&user?.role==='admin'?'admin-workspace-content':undefined} tabIndex={adminMode&&user?.role==='admin'?-1:undefined} className={adminMode?'admin-workspace-body'+(['admin-orders','admin-month-close','admin-payment-reports','admin-topups','admin-invoices','admin-monthly'].includes(view)?' orders-unified':''):'contents'}>{adminMode&&user?.role==='admin'&&<AdminSectionTabs ctx={ctx} view={view}/>} {adminMode && user?.role !== 'admin' ? <Empty title="נדרשת הרשאת מנהל" text="כניסה לניהול זמינה לחשבונות מורשים בלבד."/> : view==='admin-knowledge'||view.startsWith('admin-knowledge/') ? <KnowledgeAdmin key={view} ctx={ctx} id={view.split('/')[1]}/> : view.startsWith('admin-order/') ? <AdminOrderPage key={view} ctx={ctx} id={view.split('/')[1]}/> : view.startsWith('admin-support/') ? <AdminSupportPage key={view} ctx={ctx} id={view.split('/')[1]}/> : view === 'catalog' ? (catalogData.error?<ErrorBox error={catalogData.error}/>:<PremiumCatalog ctx={ctx} search={catalogSearch} onSearch={setCatalogSearch} loading={catalogData.loading&&!catalogData.data}/>) : view === 'admin-websites' ? <CatalogGrid key={view} ctx={ctx}/> : view === 'terms' ? <TermsContent/> : !user ? <Empty title="המרחב שלך מתחיל כאן" text="התחברו כדי לשמור כתבות, ליצור הזמנות ולנהל פרסום." action={<a href={'/signin-with-chatgpt?return_to=/' + view} target="_top"><Button>כניסה למערכת</Button></a>}/> : view==='purchased/selling' ? <section dir="rtl" className="standalone-customer-sites"><header className="seller-hub-return"><Button variant="outline" onClick={()=>ctx.go('purchased')}>חזרה לאזור האישי</Button></header><SellerWorkspace ctx={ctx}/></section> : isClientHub(view) ? <ClientHub ctx={ctx} view={view}/> : view === 'cart' || view === 'checkout' ? <CartFlow ctx={ctx} checkoutOnly={view==='checkout'}/> : view === 'purchased' ? <PurchasedView ctx={ctx}/> : view === 'admin-publication' || view === 'supplier-workspace' ? <SupplierInbox ctx={ctx}/> : view === 'bulk' ? <BulkView ctx={ctx}/> : view === 'dashboard' || view === 'strategies' ? <PurchasedView ctx={ctx}/> : view === 'admin' ? <AdminControlCenter ctx={ctx}/> : view === 'admin-seller-requests' ? <SellerWorkspace ctx={ctx} manager/> : view === 'admin-month-close' ? <AdminMonthClose ctx={ctx}/> : view === 'orders' || view === 'admin-orders' ? <OrdersView ctx={ctx}/> : view === 'articles' || view === 'admin-articles' || view === 'links' ? <ArticlesView ctx={ctx} onlyPublished={view === 'links'}/> : (view.startsWith('article/') || view.startsWith('admin-article/')) ? <ArticleStudio ctx={ctx} key={view.split('/')[1]} id={view.split('/')[1]} initialAi={view.split('/')[2]==='ai'}/> : view === 'customers' ? <CustomersView ctx={ctx}/> : view === 'wallet' ? <WalletView ctx={ctx}/> : view === 'files' ? <FilesView ctx={ctx}/> : view === 'admin-payment-reports' ? <AdminPaymentReports ctx={ctx}/> : view === 'admin-topups' ? <AdminTopups ctx={ctx}/> : view === 'admin-invoices' ? <AdminInvoices ctx={ctx}/> : view === 'admin-pricebooks' ? <CatalogGrid key={view} ctx={ctx} initialTab="customers"/> : view === 'admin-pricing' ? <CatalogGrid key={view} ctx={ctx} initialTab="tiers"/> : view.startsWith('admin-pricebook/') ? <CatalogGrid key={view} ctx={ctx} initialTab="customers" customerId={view.split('/')[1]}/> : view.startsWith('admin-customer-account/') ? <CustomerAccountAdmin key={view} ctx={ctx} id={view.split('/')[1]} initialTab={['payments','monthly','articles','profile','history'].includes(view.split('/')[2])?view.split('/')[2]:'orders'}/> : view === 'admin-users' ? <UsersAdmin ctx={ctx}/> : view === 'monthly' ? <BillingWorkspace ctx={ctx} monthly/> : view === 'admin-monthly' ? <MonthlyView ctx={ctx}/> : view === 'admin-approvals' ? <ApprovalBoard ctx={ctx}/> : view === 'notifications' || view === 'admin-notifications' ? <NoticesView ctx={ctx}/> : view === 'supplier-finance' || view === 'admin-supplier-finance' ? <SupplierFinance ctx={ctx}/> : view === 'offers' ? (catalogData.error?<ErrorBox error={catalogData.error}/>:catalogData.loading&&!catalogData.data?<div role="status" className="p-8 text-center font-semibold text-[#09234b]">טוען מבצעים ומחירים...</div>:<OffersView ctx={ctx}/>) : view === 'admin-suppliers' ? <SuppliersView ctx={ctx}/> : view === 'admin-promotions' ? <CouponsView ctx={ctx}/> : view === 'admin-connections' ? <SettingsView ctx={ctx}/> : view === 'admin-reports' ? <ReportsView ctx={ctx}/> : view === 'admin-audit' || view === 'admin-jobs' ? <LogsView ctx={ctx} jobs={view === 'admin-jobs'}/> : view === 'api' ? <ApiView ctx={ctx}/> : view === 'profile' ? <ProfileView ctx={ctx}/> : <RecordView ctx={ctx} view={view}/>}</div></AdminEditorialSurface></main><WorkspaceFooter go={go} adminMode={adminMode}/></div><PricingWarningDialog/><Toaster dir="rtl" position="bottom-left" richColors/><Dialog open={!!modal} onOpenChange={open => {if(!open&&(!modal?.beforeClose||modal.beforeClose()))setModal(null);}}><DialogContent dir="rtl" className={modal?.kind==='connection'?'reviewed-connection-dialog max-h-[90dvh] overflow-y-auto sm:max-w-lg':modal?.kind==='payment-report'?'payment-report-dialog': ['wallet-topup','admin-finance','support-ticket'].includes(modal?.kind) ? 'modal-small max-h-[90dvh] overflow-y-auto sm:max-w-lg' : modal?.kind==='website'?'catalog-website-dialog':['order', 'bulk', 'supplier-site'].includes(modal?.kind) ? 'modal-wide' : 'modal-small'}><DialogHeader><DialogTitle>{modal?.title || 'פרטים'}</DialogTitle><DialogDescription>{modal?.description || 'עדכון הנתונים במערכת'}</DialogDescription></DialogHeader>{modal?.kind === 'order' ? <OrderForm key={modal.site?.id} ctx={ctx} site={modal.site} close={() => setModal(null)}/> : modal?.kind === 'website' ? <WebsiteForm key={modal.site?.id || 'new'} ctx={ctx} site={modal.site} close={() => setModal(null)}/> : modal?.render ? modal.render(() => setModal(null)) : null}</DialogContent></Dialog>{adminMode&&user?.role==='admin'&&<AdminMobileDock ctx={ctx} view={view}/>}</div></AdminAttentionBoundary>;
}
function CatalogView({ ctx, managing = false }: {
    ctx: Ctx;
    managing?: boolean;
}) {
    const [search, setSearch] = useState(''), [category, setCategory] = useState('all'), [sort, setSort] = useState('recommended'), [sale, setSale] = useState(false), [favoriteOnly, setFavoriteOnly] = useState(false), [maxPrice, setMaxPrice] = useState(''), [minDR, setMinDR] = useState(''), [page, setPage] = useState(1);
    const fav = useData('favorites', ctx.revision, !!ctx.user);
    const favoriteIds = (fav.data?.favorites || []).filter((x: Row) => x.kind === 'favorite').map((x: Row) => x.website_id);
    const searchQuery = search.trim().toLowerCase();
    const searchableValues = (value: unknown): string[] => {
        if (Array.isArray(value)) return value.flatMap(searchableValues);
        if (value && typeof value === 'object') return Object.values(value).flatMap(searchableValues);
        if (value == null) return [];
        const text = String(value);
        return [text, categories[text] || ''];
    };
    const matchesSearch = (w: Row) => !searchQuery || [w.name, w.url, w.city, w.category, w.categories, w.tags]
        .flatMap(searchableValues)
        .some(value => value.toLowerCase().includes(searchQuery));
    const filtered = useMemo(() => ctx.catalog.filter(w => (managing || w.active !== 0) && (category === 'all' || w.category === category) && (!sale || w.is_on_sale) && (!favoriteOnly || favoriteIds.includes(w.id)) && matchesSearch(w) && (!maxPrice || w.price_cents <= Number(maxPrice) * 100) && (!minDR || Number(w.dr || 0) >= Number(minDR))).sort((a, b) => sort === 'low' ? a.price_cents - b.price_cents : sort === 'high' ? b.price_cents - a.price_cents : sort === 'dr' ? Number(b.dr || 0) - Number(a.dr || 0) : sort === 'name' ? a.name.localeCompare(b.name, 'he') : Number(b.dr || 0) - Number(a.dr || 0)), [ctx.catalog, category, sale, favoriteOnly, search, maxPrice, minDR, sort, favoriteIds.join(',')]);
    useEffect(() => setPage(1), [search, category, sort, sale, favoriteOnly, maxPrice, minDR]);
    const pageSize = 24, pages = Math.ceil(filtered.length / pageSize);
    const shown = filtered.slice((page - 1) * pageSize, page * pageSize);
    const pick = (w: Row) => ctx.open({ kind: managing ? 'website' : 'order', site: w, title: managing ? 'עריכת אתר' : 'פרסום כתבה ב־' + w.name, description: managing ? 'מחיר, זמינות ונתוני אתר' : 'מלאו את פרטי הכתבה. ניתן לערוך אותה לפני אישור הפרסום.' });
    const prices = ctx.catalog.map(w => w.price_cents).filter(x => x > 0);
    const toggleFav = (w: Row) => { if (!ctx.user) {
        toast.info('התחברו כדי לשמור אתרים');
        return;
    } ctx.run(() => api('favorites', 'POST', { website_id: w.id, kind: 'favorite' }), '').catch(() => { }); };
    return <><Heading eyebrow={managing ? 'CATALOG MANAGEMENT' : 'PUBLICATION CATALOG'} title={managing ? 'ניהול קטלוג האתרים' : 'כל האתרים. כל האפשרויות.'} description={managing ? 'עריכת המחירים, ההנחיות וחיבורי הפרסום של כל אתר.' : 'מצאו את הבמה הנכונה לכתבה הבאה שלכם.'} actions={<><Button variant="outline" className="rounded-xl border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100" onClick={() => download('postflow-catalog.csv', csv(ctx.catalog.map(w => ({ name: w.name, url: w.url, category: categories[w.category], price_ils: w.price_cents / 100, DR: w.dr || 0 })), ['name', 'url', 'category', 'price_ils', 'DR']))}><Download size={15}/>ייצוא קטלוג</Button><Button className="rounded-xl bg-[#071f4b] text-white shadow-sm hover:bg-[#123465]" onClick={() => managing ? ctx.open({ kind: 'website', title: 'הוספת אתר', site: null }) : ctx.go('bulk')}><Plus size={15}/>{managing ? 'הוספת אתר' : 'הזמנה מרוכזת'}</Button></>}/><Stats items={[{ label: 'אתרים בקטלוג', value: ctx.catalog.length.toLocaleString('he-IL'), sub: 'כל הקטלוג הציבורי, במקום אחד', icon: <Globe size={17}/> }, { label: 'תחומי תוכן', value: Object.keys(categories).length, sub: 'מחדשות וטכנולוגיה ועד לייף סטייל', icon: <FolderOpen size={17}/> }, { label: 'מחירי פרסום החל מ־', value: money(Math.min(...prices)), sub: 'מחיר לכתבה, לפני מע״מ', icon: <Wallet size={17}/> }, { label: 'אתרים במבצע', value: ctx.catalog.filter(w => w.is_on_sale).length, sub: 'מחירים לפי הקטלוג שהתקבל', icon: <Percent size={17}/>, positive: true }]}/><div className="catalog-layout"><div><div className="catalog-filters"><div className="search"><Search /><Input value={search} onChange={e => setSearch(e.target.value)} placeholder="חיפוש שם אתר, תחום או כתובת..." aria-label="חיפוש בקטלוג"/></div><Pick value={category} onChange={setCategory} options={{ all: 'כל התחומים', ...categories }} className="filter-select"/><Pick value={sort} onChange={setSort} options={{ recommended: 'מומלצים תחילה', low: 'מחיר: נמוך לגבוה', high: 'מחיר: גבוה לנמוך', dr: 'דירוג DR', name: 'שם האתר' }} className="filter-select"/></div><div className="filter-caption"><span><b className="text-foreground">{filtered.length.toLocaleString('he-IL')}</b> אתרים מתאימים</span><div className="chips"><button className={'chip ' + (sale ? 'active' : '')} onClick={() => setSale(!sale)}><Tag size={12}/>במבצע</button><button className={'chip ' + (favoriteOnly ? 'active' : '')} onClick={() => setFavoriteOnly(!favoriteOnly)}><Heart size={12}/>מועדפים</button><button className="chip" onClick={() => ctx.open({ title: 'סינון מתקדם', description: 'טווח המחירים ודירוג האתר', render: (close: () => void) => <div className="stack"><Field label="מחיר מקסימלי, בש״ח"><Input type="number" min="0" value={maxPrice} onChange={e => setMaxPrice(e.target.value)}/></Field><Field label="DR מינימלי"><Input type="number" min="0" max="100" value={minDR} onChange={e => setMinDR(e.target.value)}/></Field><Button onClick={close}>הצגת תוצאות</Button></div> })}><SlidersHorizontal size={12}/>עוד מסננים</button></div></div>{(maxPrice || minDR) && <div className="flex-row mb-4"><span className="badge green">{maxPrice && 'עד ' + money(Number(maxPrice) * 100)} {minDR && 'DR ' + minDR + ' ומעלה'}</span><Button variant="ghost" size="xs" onClick={() => { setMaxPrice(''); setMinDR(''); }}>ניקוי</Button></div>}{shown.length ? <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">{shown.map(w => <article className="site-card" style={{containerType:'inline-size'}} key={w.id}><button className={'favorite-button z-10 rounded-full bg-white/95 shadow-sm transition-colors hover:bg-rose-50 hover:text-rose-600 ' + (favoriteIds.includes(w.id) ? 'active' : '')} aria-label={'שמירת ' + w.name + ' במועדפים'} onClick={() => toggleFav(w)}><Heart size={15} fill={favoriteIds.includes(w.id) ? 'currentColor' : 'none'}/></button><div className="flex flex-col gap-4 px-4 pt-4 pb-4"><div className="relative flex h-32 sm:h-36 w-full items-center justify-center overflow-hidden rounded-xl border border-slate-100 bg-white px-5 py-4"><span aria-hidden="true" className={(w.logo_url ? 'hidden' : 'grid') + ' absolute inset-0 place-items-center text-3xl font-bold text-slate-400'}>{w.name.slice(0, 1)}</span>{w.logo_url && <img src={w.logo_url} alt={w.name} loading="lazy" className="relative w-full h-full max-w-60 object-contain" onError={e => { e.currentTarget.style.display = 'none'; const fallback = e.currentTarget.previousElementSibling; fallback?.classList.remove('hidden'); fallback?.classList.add('grid'); }}/>}</div><div className="flex min-w-0 flex-col items-center gap-3 text-center"><div className="flex max-w-full flex-wrap items-center justify-center gap-2"><h3 className="break-words text-xl font-bold leading-snug text-slate-800">{w.name}</h3>{(w.public_notes||w.publishing_restrictions||w.customer_notes)&&<button className="site-notes-button" aria-label={'הערות על '+w.name} title="הערות האתר" onClick={()=>ctx.open({title:'הערות — '+w.name,description:w.url,render:()=> <div className="stack whitespace-pre-wrap"><p>{w.public_notes||''}</p><p>{typeof w.publishing_restrictions==='string'?w.publishing_restrictions:JSON.stringify(w.publishing_restrictions||'')}</p><p>{w.customer_notes||''}</p></div>})}>ⓘ</button>}</div><a href={w.url} target="_blank" rel="noreferrer" dir="ltr" className="max-w-full rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-2.5 text-base font-medium leading-relaxed text-cyan-900 transition-colors hover:bg-cyan-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6174ee]" style={{overflowWrap:'anywhere'}}>{w.url}</a></div></div><div className="flex flex-wrap justify-center gap-3 px-4 pb-5"><span className="inline-flex min-h-10 items-center rounded-full border border-indigo-100 bg-indigo-50 px-4 py-2 text-base font-semibold text-indigo-900">{categories[w.category] || w.category}</span>{w.features?.includes('dofollow') && <span className="inline-flex min-h-10 items-center rounded-full border border-cyan-200 bg-cyan-50 px-4 py-2 text-base font-semibold text-cyan-900" dir="ltr">Dofollow</span>}{w.is_on_sale && <span className="inline-flex min-h-10 items-center rounded-full bg-amber-50 px-4 py-2 text-base font-semibold text-amber-800">מבצע</span>}{w.active === 0 && <span className="inline-flex min-h-10 items-center rounded-full bg-red-50 px-4 py-2 text-base font-semibold text-red-700">לא פעיל</span>}</div><div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 border-t border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-600"><span>DR <b className="text-base font-bold text-slate-700">{w.dr || '—'}</b></span><span>UR <b className="text-base font-bold text-slate-700">{w.ur || '—'}</b></span><span className="inline-flex items-center gap-1.5"><Clock size={14}/>{w.turnaround_days || '—'} ימים</span></div><div className="flex min-w-0 flex-col gap-4 border-t border-slate-100 px-4 py-4">
    <div className="flex min-w-0 flex-col items-center gap-3 text-center">
        <div className="flex w-full min-w-0 flex-col items-center rounded-xl bg-[#eef3ff] px-3 py-4">
            {w.regular_price_cents > w.price_cents && <div className="mb-2 text-xl font-semibold text-slate-500"><span className="sr-only">מחיר לפני הנחה: </span><s>{money(w.regular_price_cents)}</s></div>}
            <div className="font-extrabold leading-tight tracking-tight text-[#071f4b]" style={{fontSize:'clamp(1.75rem, 10cqi, 2.25rem)'}}><span className="sr-only">מחיר ללקוח: </span>{money(w.price_cents)}</div>
            <p className="mt-2 text-base text-slate-600">לכתבה · לפני מע״מ</p>
        </div>
        <a href={w.url} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700 transition-colors hover:bg-indigo-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">לאתר<ExternalLink size={14}/></a>
    </div>
    <Button className="h-11 w-full rounded-xl bg-[#071f4b] text-base font-bold text-white shadow-sm transition-all hover:bg-[#123465] hover:shadow-md focus-visible:ring-[#6174ee]" onClick={() => pick(w)}>{managing ? <Pencil size={16}/> : <ShoppingCart size={16}/>}{managing ? 'עריכת האתר' : 'הוספה לסל'}</Button>
</div></article>)}</div> : <Empty title="לא נמצאו אתרים" text="נסו להרחיב את החיפוש או לנקות את המסננים." action={<Button variant="outline" onClick={() => { setSearch(''); setCategory('all'); setSale(false); setFavoriteOnly(false); setMaxPrice(''); setMinDR(''); }}>ניקוי מסננים</Button>}/>}<div className="pagination"><Button variant="ghost" size="icon-sm" disabled={page <= 1} onClick={() => setPage(x => x - 1)} aria-label="עמוד קודם"><ChevronRight size={15}/></Button>{Array.from({ length: Math.min(5, pages) }, (_, i) => Math.min(Math.max(1, page - 2), Math.max(1, pages - 4)) + i).map(n => <Button variant={page === n ? 'default' : 'ghost'} size="sm" key={n} onClick={() => setPage(n)}>{n}</Button>)}{pages > 5 && <span className="muted">מתוך {pages}</span>}<Button variant="ghost" size="icon-sm" disabled={page >= pages} onClick={() => setPage(x => x + 1)} aria-label="עמוד הבא"><ChevronLeft size={15}/></Button></div></div><aside className="catalog-aside"><div className="aside-card soft"><div className="aside-icon"><Sparkles size={19}/></div><h3>תוכן שעובד בשבילכם</h3><p>בנו תכנית תוכן, התאימו את הכתבות לקהל שלכם ומצאו את האתרים המתאימים.</p><Button variant="outline" className="w-full bg-white" onClick={() => ctx.go('strategies')}>לתכנון התוכן<ArrowUpLeft size={14}/></Button></div><div className="aside-card"><h3>מוכנים לפרסום הבא?</h3><div className="mini-number">{ctx.user ? '01' : '03'}</div><p>בחירת אתר, הכנת כתבה ואישור לפרסום. תהליך אחד, שקוף וברור.</p><div className="info-line"><span className="flex-row"><CheckCircle2 size={13}/>בחירת במה</span><b>לפי תקציב ותחום</b></div><div className="info-line"><span className="flex-row"><FileText size={13}/>הכנת כתבה</span><b>AI או העלאת תוכן</b></div><div className="info-line"><span className="flex-row"><ShieldCheck size={13}/>אישור שלכם</span><b>לפני הפרסום</b></div><div className="aside-footer"><Button className="w-full" onClick={() => ctx.go('cart')}>לסל הפרסום<ShoppingCart size={14}/></Button></div></div><div className="aside-card"><div className="flex-row"><LifeBuoy size={17} className="text-primary"/><h3>צריכים יד מכוונת?</h3></div><p>שלחו פנייה לצוות עם פרטי ההזמנה או הכתבה.</p><Button variant="ghost" className="p-0 h-auto" onClick={() => ctx.go('support')}>פתיחת פנייה<ChevronLeft size={13}/></Button></div><p className="source-note">הקטלוג יובא מהמידע הציבורי של BuyPost ב־4.10.2026. מחירי מקור לצורכי תכנון. זמינות וספקי פרסום דורשים אימות בניהול.</p></aside></div></>;
}
export function UploadField({ onUploaded, accept = 'image/*', label = 'העלאת תמונה' }: {
    onUploaded: (file: Row) => void;
    accept?: string;
    label?: string;
}) { const [busy, setBusy] = useState(false), [error, setError] = useState(''); return <div><label className="upload-drop"><Upload size={22} className="text-primary"/><div><b>{label}</b><div className="muted small">עד 15MB · נשמר בחשבון שלכם</div><input type="file" accept={accept} disabled={busy} onChange={async (e) => { const f = e.target.files?.[0]; if (!f)
    return; setBusy(true); setError(''); try {
    const form = new FormData();
    form.append('file', f);
    const saved = await api('files', 'POST', form);
    onUploaded(saved);
    toast.success('הקובץ הועלה');
}
catch (e) {
    setError((e as Error).message);
}
finally {
    setBusy(false);
} }}/></div>{busy && <LoaderCircle className="animate-spin" size={17}/>}</label><ErrorBox error={error}/></div>; }
function OrderForm({ ctx, site, close }: {
    ctx: Ctx;
    site: Row;
    close: () => void;
}) { const [form, setForm] = useState<Row>({ topic: '', brand: '', audience: '', style: writingStyles[0], words: 500, quantity: 1, content_type: 'ai', target_url: '', anchor: '', target_url_2: '', anchor_2: '', notes: '', scheduled: '', image_id: '', document_id: '', customer_id: '' }); const [error, setError] = useState(''), [busy, setBusy] = useState(false); const customers = useData('records/customer', ctx.revision, !!ctx.user); const f = (k: string, v: any) => setForm(x => ({ ...x, [k]: v })); return <form onSubmit={async (e) => { e.preventDefault(); if (!ctx.user) {
    setError('יש להתחבר כדי ליצור הזמנה');
    return;
} setBusy(true); setError(''); try {
    await api('cart', 'POST', { ...form, website_id: site.id });
    notifyCartAdded(site.id);
    ctx.refresh();
    close();
    toast.success('הכתבה נוספה לסל');
}
catch (e) {
    setError((e as Error).message);
}
finally {
    setBusy(false);
} }}><Tabs dir="rtl" defaultValue="brief"><TabsList className="w-full mb-5"><TabsTrigger value="brief" className="flex-1">פרטי הכתבה</TabsTrigger><TabsTrigger value="links" className="flex-1">קישורים והנחיות</TabsTrigger><TabsTrigger value="files" className="flex-1">קבצים ותזמון</TabsTrigger></TabsList><TabsContent value="brief"><div className="form-grid"><Field label="נושא הכתבה *" wide><Input value={form.topic} required onChange={e => f('topic', e.target.value)} placeholder="על מה תרצו לכתוב?" maxLength={500}/></Field><Field label="שם המותג"><Input value={form.brand} onChange={e => f('brand', e.target.value)} placeholder="שם החברה או העסק"/></Field><Field label="קהל יעד"><Input value={form.audience} onChange={e => f('audience', e.target.value)} placeholder="למי הכתבה מיועדת?"/></Field><Field label="סגנון כתיבה"><Pick value={form.style} onChange={v => f('style', v)} options={Object.fromEntries(writingStyles.map(s => [s, s]))}/></Field><Field label="אורך הכתבה"><Pick value={String(form.words)} onChange={v => f('words', Number(v))} options={{ '500': '500 מילים', '800': '800 מילים', '1000': '1,000 מילים', '1500': '1,500 מילים' }}/></Field><Field label="סוג התוכן"><Pick value={form.content_type} onChange={v => f('content_type', v)} options={{ ai: 'כתיבה בעזרת AI', upload: 'תוכן מוכן שלי' }}/></Field><Field label="מספר כתבות"><Input type="number" min={1} max={20} value={form.quantity} onChange={e => f('quantity', e.target.value)}/></Field>{customers.data?.records?.length > 0 && <Field label="שיוך ללקוח" wide><Pick value={form.customer_id || 'none'} onChange={v => f('customer_id', v === 'none' ? '' : v)} options={{ none: 'החשבון שלי', ...Object.fromEntries(customers.data.records.map((c: Row) => [c.id, c.name])) }}/></Field>}</div></TabsContent><TabsContent value="links"><div className="form-grid"><Field label="טקסט העוגן של הקישור"><Input value={form.anchor} onChange={e => f('anchor', e.target.value)}/></Field><Field label="כתובת הקישור"><Input type="url" dir="ltr" value={form.target_url} onChange={e => f('target_url', e.target.value)} placeholder="https://"/></Field>{!site.single_link_only && <><Field label="טקסט עוגן נוסף"><Input value={form.anchor_2} onChange={e => f('anchor_2', e.target.value)}/></Field><Field label="קישור נוסף"><Input type="url" dir="ltr" value={form.target_url_2} onChange={e => f('target_url_2', e.target.value)} placeholder="https://"/></Field></>}<Field label="מילות מפתח" wide><Input value={form.keywords || ''} onChange={e => f('keywords', e.target.value)} placeholder="מילות מפתח מופרדות בפסיק"/></Field><Field label="דגשים לכתיבה" wide><Textarea value={form.notes} onChange={e => f('notes', e.target.value)} placeholder="עובדות חשובות, מסרים, פרטים שצריך לכלול..."/></Field></div>{site.publishing_restrictions && <div className="notice mt-4">הנחיות האתר: {typeof site.publishing_restrictions === 'string' ? site.publishing_restrictions : JSON.stringify(site.publishing_restrictions)}</div>}</TabsContent><TabsContent value="files"><div className="stack"><UploadField onUploaded={file => f('image_id', file.id)}/>{form.image_id && <img src={'/api/files/' + form.image_id} alt="התמונה שנבחרה" className="max-h-40 rounded-lg object-contain"/>}<UploadField accept=".docx,.txt,.html,.pdf" label="מסמך הכתבה" onUploaded={file => f('document_id', file.id)}/>{form.document_id && <Badge tone="green">מסמך מצורף</Badge>}<Field label="תאריך פרסום מבוקש" hint="השאירו ריק לטיפול מיידי; הפרסום תלוי באישור הספק."><Input type="date" value={form.scheduled} min={new Date().toISOString().slice(0, 10)} onChange={e => f('scheduled', e.target.value)}/></Field><label className="checkbox-label"><Checkbox checked={form.shared || false} onCheckedChange={v => f('shared', v)}/>כתבה משותפת עם מותגים נוספים</label>{site.pixel_option !== 'none' && <label className="checkbox-label"><Checkbox checked={form.pixel || false} onCheckedChange={v => f('pixel', v)}/>בקשה לפיקסל מדידה — הצעת מחיר נפרדת</label>}</div></TabsContent></Tabs><ErrorBox error={error}/><div className="modal-footer"><div><b className="text-lg">{money(site.price_cents * Number(form.quantity))}</b><div className="muted small">מחיר הפרסום לפני מע״מ · כתיבת AI לפי החיבור שהוגדר</div></div><Button type="submit" disabled={busy}>{busy ? <LoaderCircle className="animate-spin" size={15}/> : <Plus size={15}/>}הוספה לסל</Button></div></form>; }
export function WebsiteForm(props:{ctx:Ctx;site:Row|null;close:()=>void;defaultSupplier?:string}){return <CatalogWebsiteForm {...props}/>;}
function LegacyWebsiteForm({ ctx, site, close, defaultSupplier = '' }: {
    ctx: Ctx;
    site: Row | null;
    defaultSupplier?: string;
    close: () => void;
}) { const [f, setF] = useState<Row>({ ...site, price_ils: (site?.regular_price_cents ?? site?.price_cents ?? 0) / 100, cost_ils: site?.cost_cents==null?'':site.cost_cents/100,expected_updated:site?.updated, supplier_id: site?.supplier_id || defaultSupplier, sale_price_ils: site?.sale_price_cents == null ? '' : site.sale_price_cents / 100, category: site?.category || 'general', active: site?.active !== 0, procurement_verified: site?.procurement_verified || false }), [error, setError] = useState(''); const suppliers = useData('records/supplier', ctx.revision); const set = (k: string, v: any) => setF(x => ({ ...x, [k]: v })); return <form onSubmit={async (e) => { e.preventDefault(); setError(''); try {
    await ctx.run(() => pricingApi('admin/websites' + (site ? '/' + site.id : ''), site ? 'PATCH' : 'POST', f));
    close();
}
catch (e) {
    setError((e as Error).message);
} }} className="stack"><div className="form-grid"><Field label="שם אתר"><Input value={f.name || ''} required onChange={e => set('name', e.target.value)}/></Field><Field label="כתובת האתר"><Input type="url" required dir="ltr" value={f.url || ''} onChange={e => set('url', e.target.value)}/></Field><Field label="תחום"><Pick value={f.category} onChange={v => set('category', v)} options={categories}/></Field><Field label="מחיר רגיל ללקוח, בש״ח"><Input type="number" min={0} step=".01" value={f.price_ils} required onChange={e => set('price_ils', e.target.value)}/></Field><Field label="DR"><Input type="number" min={0} max={100} value={f.dr || 0} onChange={e => set('dr', Number(e.target.value))}/></Field><Field label="זמן טיפול בימים"><Input type="number" min={1} value={f.turnaround_days || 1} onChange={e => set('turnaround_days', Number(e.target.value))}/></Field><Field label="הנחיות ומגבלות פרסום" wide><Textarea value={typeof f.publishing_restrictions === 'string' ? f.publishing_restrictions : JSON.stringify(f.publishing_restrictions || '')} onChange={e => set('publishing_restrictions', e.target.value)}/></Field><Field label="הערות להצגה בקטלוג" wide><Textarea value={f.public_notes||''} onChange={e=>set('public_notes',e.target.value)}/></Field><Field label="הערות מנהל ללקוחות האתר" wide><Textarea value={f.customer_notes||''} onChange={e=>set('customer_notes',e.target.value)}/></Field><Field label="ספק אחראי"><Pick value={f.supplier_id || 'none'} onChange={v => set('supplier_id', v === 'none' ? '' : v)} options={{ none: 'ללא ספק', ...Object.fromEntries((suppliers.data?.records || []).map((s: Row) => [s.id, s.name])) }}/></Field><Field label="מחיר עלות, בש״ח" hint="גלוי למנהל בלבד"><Input type="number" min={0} step=".01" required value={f.cost_ils} onChange={e => set('cost_ils', e.target.value)}/></Field><Field label="מחיר מבצע ללקוח, בש״ח" hint="השאירו ריק אם אין מחיר מבצע נפרד"><Input type="number" min={0} step=".01" value={f.sale_price_ils} onChange={e => set('sale_price_ils', e.target.value)}/></Field><Field label="שם המבצע"><Input value={f.sale_title || ''} onChange={e => set('sale_title', e.target.value)}/></Field><Field label="סיום המבצע (אופציונלי)"><Input type="date" value={(f.sale_ends || '').slice(0,10)} onChange={e => set('sale_ends', e.target.value ? e.target.value + 'T23:59:59.999Z' : '')}/></Field><Field label="חיבור WordPress"><Pick value={f.wordpress_connection || 'none'} onChange={v => set('wordpress_connection', v === 'none' ? '' : v)} options={{ none: 'ללא חיבור', primary: 'החיבור הראשי שהוגדר' }}/></Field></div><div className="flex-row flex-wrap"><label className="checkbox-label"><Checkbox checked={f.active} onCheckedChange={v => set('active', v)}/>פעיל בקטלוג</label><label className="checkbox-label"><Checkbox checked={f.is_on_sale || false} onCheckedChange={v => set('is_on_sale', v)}/>במבצע</label><label className="checkbox-label"><Checkbox checked={f.procurement_verified} onCheckedChange={v => set('procurement_verified', v)}/>הסכם הפרסום אומת</label></div><ErrorBox error={error}/><Button type="submit">שמירת אתר</Button></form>; }
