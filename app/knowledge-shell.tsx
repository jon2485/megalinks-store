'use client';
import type {ReactNode} from 'react';
import {useData} from '@/lib/client';
import type {Ctx} from './workspace';
import WorkspaceHeader from './workspace-navigation';
import BrandLogo from './brand-logo';
import {Toaster} from 'sonner';
export default function KnowledgeShell({children,preview=false}:{children:ReactNode;preview?:boolean}){
 const {data}=useData('me',0,!preview);const go=(page:string)=>window.location.assign(page==='catalog'?'/':'/'+page);
 const ctx:Ctx={user:data?.user||null,revision:0,refresh:()=>{},go,open:()=>{},run:fn=>fn(),catalog:[],adminMode:false};
 return <div className="knowledge-site workspace-page-shell premium-catalog-shell megalinks-azure-shell" dir="rtl"><WorkspaceHeader ctx={ctx} view="knowledge" brand="MegaLinks" counts={data?.counts||{}}/>{children}<footer className="knowledge-footer"><a href="/" aria-label="MegaLinks — דף הבית"><BrandLogo light/></a><nav aria-label="קישורים בתחתית האתר"><a href="/">דף הבית</a><a href="/knowledge">מדריכים וידע</a><a href="/purchased">אזור אישי</a><a href="/terms">תנאי שימוש</a></nav><small>© {new Date().getFullYear()} MegaLinks. כל הזכויות שמורות.</small></footer><Toaster dir="rtl" position="bottom-left" richColors/></div>;
}
