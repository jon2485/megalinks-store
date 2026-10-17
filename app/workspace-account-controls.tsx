'use client';

import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Ctx } from './workspace';

export function WorkspaceAccountControls({ ctx }: { ctx: Ctx }) {
    const name = typeof ctx.user?.name === 'string' ? ctx.user.name.trim() : '';
    return <div className="workspace-account-controls">
        {ctx.user && <button type="button" className="workspace-greeting" onClick={() => ctx.go('profile')} aria-label="פתיחת הגדרות החשבון" title={name ? `שלום ${name}` : 'שלום וברוכים הבאים'}>
            <span className="workspace-greeting-avatar" aria-hidden="true">{name.slice(0, 1) || 'מ'}</span>
            <span className="workspace-greeting-text">{name ? `שלום ${name}` : 'שלום וברוכים הבאים'}</span>
        </button>}
        <Button variant="ghost" size="icon" className="workspace-notification-button" aria-label="התראות ואישורים" onClick={() => ctx.go(ctx.adminMode ? 'admin' : 'notifications')}>
            <Bell size={21} strokeWidth={1.7}/>
            {(ctx.pendingApprovals || 0) > 0 && <span className="workspace-notification-dot" aria-label="יש בקשות ממתינות לבדיקה"/>}
        </Button>
    </div>;
}
