'use client';
import React from 'react';
import './account-navigation-refinements.css';
import {Home,FileText,ShoppingCart,Wallet,Users,Settings,Plus,Globe,Headphones,FolderOpen,Bell,Code2} from 'lucide-react';
import {Button} from '@/components/ui/button';
import AccountFirstScreen from './account-first-screen';
import MobileAccountMenu from './mobile-personal-menu';
import {useData} from '@/lib/client';
import {clientHubTabs,clientHubTab} from '@/lib/client-hub-navigation';
import {purchaseStages} from '@/lib/purchased-history';
import {type Ctx,ErrorBox} from './workspace';
import PurchasedView from './purchased-view';
import {CustomerOrdersView} from './customer-orders';
import BillingWorkspace from './billing-workspace';
import CustomersView from './customers-view';
import AccountSettings from './account-settings';
import {FilesView,RecordView,ApiView} from './screens';
import {NoticesView} from './management';
import SellerWorkspace from './seller-workspace';
import ClientUpdates from './client-updates';
const icons={selling:Globe,lobby:Home,articles:FileText,orders:ShoppingCart,payments:Wallet,customers:Users,profile:Settings};
export default function ClientHub({ctx,view}:{ctx:Ctx;view:string}){
 const part=view.split('/')[1]||'lobby',selected=clientHubTab(view);
 const approved=true;
 const title=part==='selling'?'האתרים שלי':part==='articles'?'הכתבות שלי':part==='orders'||part==='monthly'?'ההזמנות שלי':part==='payments'?'יתרה וזיכויים':part==='customers'?'הלקוחות שלי':part==='profile'?'פרטי החשבון':'האזור האישי שלי';
 const subtitle=part==='articles'?'ניהול התוכן והפרסומים שלך':part==='orders'||part==='monthly'?'כל ההזמנות שלך, במקום אחד':part==='payments'?'היתרה והתנועות שלך, במקום אחד':part==='lobby'?'פרסומים, תשלומים ועדכונים שמחכים לך':part==='customers'?'הלקוחות, הכתבות והפרסומים שלהם':part==='profile'?'הפרטים שיופיעו בהזמנות שלך':'כל הפעילות שלך, במקום אחד';
 return <section dir="rtl" className={'client-hub'+(approved?' approved-account approved-account-'+selected:'')}><AccountFirstScreen><header className="client-hub-heading"><div className="client-hub-heading-copy"><h1><span className="account-heading-desktop">{title}</span><span className="account-heading-mobile">האזור <em>האישי</em></span></h1><div className="client-hub-greeting"><span>שלום <bdi>{ctx.user?.name?.trim()||'לך'}</bdi></span><p>שמחים לראות אותך שוב!</p></div><p className="account-mobile-subtitle">כל הפעילות שלך, במקום אחד.</p>{part!=='lobby'&&<p className="account-desktop-subtitle">{subtitle}</p>}</div><div className="client-hub-welcome">{approved&&<img className="approved-account-art" src="/brand/account-workspace.webp" width="220" height="160" alt="" aria-hidden="true"/>}<Button onClick={()=>ctx.go('catalog')}><Plus size={18}/>רכישת פרסום</Button></div></header><MobileAccountMenu ctx={ctx} view={view}/></AccountFirstScreen><nav className="client-hub-tabs" aria-label="קטגוריות האזור האישי">{clientHubTabs.map(tab=>{const Icon=icons[tab.id];return <button key={tab.id} type="button" aria-current={selected===tab.id?'page':undefined} onClick={()=>ctx.go(tab.path)}><Icon size={25}/><span>{tab.label}</span></button>;})}</nav><Button className="personal-desktop-sites personal-sites-cta" onClick={()=>ctx.go('purchased/selling')}><Globe size={20}/>האתרים שלי</Button><div id="client-hub-page-content" tabIndex={-1} className="client-hub-content account-content-transition" key={part}>
 {part==='selling'?<SellerWorkspace ctx={ctx}/>:part==='lobby'?<ClientUpdates ctx={ctx}/>:part==='articles'?<PurchasedView key={view} ctx={ctx} compact={approved} initialStage={purchaseStages.find(s=>s.key===view.split('/')[2])?.key} initialOrderId={view.split('/')[2]==='order'?decodeURIComponent(view.split('/')[3]||''):undefined}/>:part==='orders'||part==='monthly'?<CustomerOrdersView ctx={ctx}/>:part==='payments'?<BillingWorkspace ctx={ctx} balanceOnly/>:part==='customers'?<CustomersView ctx={ctx}/>:part==='profile'?<><AccountSettings ctx={ctx}/><AccountLinks ctx={ctx}/></>:part==='files'?<FilesView ctx={ctx}/>:part==='notifications'?<NoticesView ctx={ctx}/>:part==='api'?<ApiView ctx={ctx}/>:part==='support'?<RecordView ctx={ctx} view="support"/>:<div className="client-hub-panel"><p>העמוד המבוקש לא נמצא.</p><Button onClick={()=>ctx.go('purchased')}>חזרה ללובי</Button></div>}
 </div></section>;
}
function AccountLinks({ctx}:{ctx:Ctx}){return <div className="client-hub-account-links">{[{path:'support',label:'פנייה לתמיכה',icon:Headphones},{path:'files',label:'ספריית הקבצים',icon:FolderOpen},{path:'notifications',label:'התראות ועדכונים',icon:Bell},{path:'api',label:'חיבור API',icon:Code2}].map(({path,label,icon:Icon})=><Button key={path} variant="outline" onClick={()=>ctx.go('purchased/'+path)}><Icon size={19}/>{label}</Button>)}</div>;}
