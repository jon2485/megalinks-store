'use client';
import {useEffect, useState, useSyncExternalStore} from 'react';
import {createPortal} from 'react-dom';
import {getPendingRequests, getServerPendingRequests, subscribePendingRequests} from '@/lib/loading-state';

export function BrandLoadingScreen() {
    return <div className="brand-loading-screen" dir="rtl" role="status" aria-label="טעינה" aria-live="polite" aria-atomic="true">
        <div className="brand-loading-content">
            <div className="brand-loading-symbol" aria-hidden="true">
                <img className="brand-loading-ring" src="/brand/loader-ring.png" width="449" height="449" alt=""/>
                <img className="brand-loading-m" src="/brand/loader-m.png" width="449" height="449" alt=""/>
            </div>
        </div>
    </div>;
}

export default function BrandLoading() {
    const pending = useSyncExternalStore(subscribePendingRequests, getPendingRequests, getServerPendingRequests);
    const active = pending > 0;
    const [visible, setVisible] = useState(false);
    useEffect(() => {
        if (!active) { setVisible(false); return; }
        // No minimum duration or artificial delay to the underlying operation.
        const timer = window.setTimeout(() => setVisible(true), 450);
        return () => window.clearTimeout(timer);
    }, [active]);
    return active && visible ? createPortal(<BrandLoadingScreen/>, document.body) : null;
}
