'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/** Progressive enhancement: server-rendered cards remain readable without JS/IO. */
export function observeCatalogCards(root: HTMLElement, preference: MediaQueryList) {
    const cards = Array.from(root.querySelectorAll<HTMLElement>('[data-catalog-reveal]'));
    const show = (card: HTMLElement, delay = 0) => {
        card.style.setProperty('--catalog-reveal-delay', `${delay}ms`);
        card.dataset.catalogReveal = 'visible';
    };
    const revealAll = () => cards.forEach(card => show(card));
    if (preference.matches || typeof IntersectionObserver === 'undefined') {
        revealAll();
        return () => {};
    }
    const observer = new IntersectionObserver(entries => {
        const entering = entries.filter(entry => entry.isIntersecting)
            .sort((a, b) => cards.indexOf(a.target as HTMLElement) - cards.indexOf(b.target as HTMLElement));
        entering.forEach((entry, index) => {
            show(entry.target as HTMLElement, Math.min(index * 55, 110));
            observer.unobserve(entry.target);
        });
    }, { threshold: 0, rootMargin: '0px 0px -24px 0px' });
    cards.forEach(card => {
        if (card.dataset.catalogReveal === 'visible') return;
        card.dataset.catalogReveal = 'pending';
        observer.observe(card);
    });
    const focus = (event: FocusEvent) => {
        const card = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-catalog-reveal]') : null;
        if (card) { show(card); observer.unobserve(card); }
    };
    const preferenceChanged = () => {
        if (preference.matches) { revealAll(); observer.disconnect(); }
    };
    root.addEventListener('focusin', focus);
    preference.addEventListener('change', preferenceChanged);
    return () => {
        observer.disconnect();
        root.removeEventListener('focusin', focus);
        preference.removeEventListener('change', preferenceChanged);
        // No hidden content remains when filtering, unmounting or changing preference.
        revealAll();
    };
}

export function CatalogMotionGrid({ children, resultKey }: { children: ReactNode; resultKey: string }) {
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (!ref.current) return;
        const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
        const stopReveal = observeCatalogCards(ref.current, preference);
        return stopReveal;
    }, [resultKey]);
    return <div ref={ref} className="catalog-motion-grid grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">{children}</div>;
}

/** One delegated pointer listener and one animation frame for the entire grid. */
export function attachCatalogDepth(root: HTMLElement, preference: MediaQueryList) {
    let card: HTMLElement | null = null;
    let frame = 0;
    let pointerX = 0;
    let pointerY = 0;
    const clear = () => {
        cancelAnimationFrame(frame);
        frame = 0;
        card?.style.removeProperty('--catalog-tilt-x');
        card?.style.removeProperty('--catalog-tilt-y');
        card?.classList.remove('catalog-depth-tracking');
        card = null;
    };
    const move = (event: PointerEvent) => {
        if (event.pointerType !== 'mouse' || preference.matches || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
        const next = event.target instanceof Element ? event.target.closest<HTMLElement>('.publication-catalog-card') : null;
        if (!next || !root.contains(next)) { clear(); return; }
        if (next !== card) { clear(); card = next; }
        pointerX = event.clientX;
        pointerY = event.clientY;
        if (frame) return;
        frame = requestAnimationFrame(() => {
            frame = 0;
            if (!card) return;
            const rect = card.getBoundingClientRect();
            const x = Math.max(-1, Math.min(1, (pointerX - rect.left) / Math.max(1, rect.width) * 2 - 1));
            const y = Math.max(-1, Math.min(1, (pointerY - rect.top) / Math.max(1, rect.height) * 2 - 1));
            card.style.setProperty('--catalog-tilt-x', `${-y * 1.6}deg`);
            card.style.setProperty('--catalog-tilt-y', `${x * 1.6}deg`);
            card.classList.add('catalog-depth-tracking');
        });
    };
    const preferenceChanged = () => { if (preference.matches) clear(); };
    root.addEventListener('pointermove', move);
    root.addEventListener('pointerleave', clear);
    root.addEventListener('pointercancel', clear);
    preference.addEventListener('change', preferenceChanged);
    return () => {
        clear();
        root.removeEventListener('pointermove', move);
        root.removeEventListener('pointerleave', clear);
        root.removeEventListener('pointercancel', clear);
        preference.removeEventListener('change', preferenceChanged);
    };
}
