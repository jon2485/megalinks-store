'use client';

import React from 'react';
import { Bell, ChevronDown, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import type { Ctx } from './workspace';

type MenuEntry = readonly [string, string, React.ElementType];
const shekels = (cents: unknown) => new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }).format(Math.max(0, Number(cents) || 0) / 100);

export function WorkspaceAccountControls({ ctx, compactGreeting = false, menu = [], counts = {} }: { ctx: Ctx; compactGreeting?: boolean; menu?: readonly MenuEntry[]; counts?: Record<string, any> }) {
    const name = typeof ctx.user?.name === 'string' ? ctx.user.name.trim() : '';
    const balance = ctx.user?.credits_available ?? ctx.user?.credits;
    const pending = ctx.pendingApprovals || 0;
    const greeting = <>
        {!compactGreeting && <span className="workspace-greeting-avatar" aria-hidden="true">{name.slice(0, 1) || 'מ'}</span>}
        <span className="workspace-greeting-text">{compactGreeting ? <><span>{name ? <>שלום, <bdi>{name}</bdi></> : 'שלום וברוכים הבאים'}</span>{balance != null && <small className="workspace-greeting-balance">יתרה {shekels(balance)}</small>}</> : <><bdi>{name || 'החשבון שלי'}</bdi>{balance != null && <small className="workspace-greeting-balance">יתרה {shekels(balance)}</small>}</>}</span>
        {!compactGreeting && menu.length > 0 && <ChevronDown size={15} className="workspace-greeting-chevron" aria-hidden="true"/>}
    </>;
    return <div className="workspace-account-controls">
        {ctx.user && (compactGreeting || !menu.length
            ? <button type="button" className="workspace-greeting" onClick={() => ctx.go('profile')} aria-label="פתיחת הגדרות החשבון" title={name ? `שלום ${name}` : 'שלום וברוכים הבאים'}>{greeting}</button>
            : <Popover>
                <PopoverTrigger asChild><button type="button" className="workspace-greeting" aria-label="תפריט החשבון" title={name ? `שלום ${name}` : 'החשבון שלי'}>{greeting}</button></PopoverTrigger>
                <PopoverContent align="end" sideOffset={12} className="account-apple-menu" dir="rtl">
                    <div className="account-apple-head"><span className="account-apple-avatar" aria-hidden="true">{name.slice(0, 1) || 'מ'}</span><span><strong><bdi>{name || 'החשבון שלי'}</bdi></strong>{ctx.user?.email && <small dir="ltr">{ctx.user.email}</small>}</span></div>
                    {balance != null && <div className="account-apple-balance"><span>יתרה לשימוש<strong>{shekels(balance)}</strong></span><button type="button" onClick={() => ctx.go('purchased/payments')}>טעינת יתרה</button></div>}
                    <ul className="account-apple-grid">{menu.map(([page, label, Icon]) => <li key={page}><button type="button" data-page={page} onClick={() => ctx.go(page)}><span className="account-apple-tile" aria-hidden="true"><Icon size={18}/></span><span>{label}</span>{page === 'purchased' && pending > 0 && <span className="account-apple-count">{pending}</span>}{page === 'purchased/orders' && counts.orders > 0 && <span className="account-apple-count is-quiet">{counts.orders}</span>}</button></li>)}</ul>
                    <a className="account-apple-signout" href="/signout-with-chatgpt?return_to=/" target="_top"><LogOut size={17} aria-hidden="true"/>יציאה מהחשבון</a>
                </PopoverContent>
            </Popover>)}
        <Button variant="ghost" size="icon" className="workspace-notification-button" aria-label={pending > 0 ? `התראות ואישורים, ${pending} ממתינים` : 'התראות ואישורים'} onClick={() => ctx.go(ctx.adminMode ? 'admin' : 'notifications')}>
            <Bell size={21} strokeWidth={1.7}/>
            {pending > 0 && <span className="workspace-notification-dot" aria-hidden="true">{pending > 9 ? '9+' : pending}</span>}
        </Button>
    </div>;
}
