'use client';
import { Phone, Headphones, FileText, ShieldCheck, Undo2, PackageCheck, Accessibility, Cookie } from 'lucide-react';
import BrandLogo from './brand-logo';
import { LEGAL_DOCS } from '@/lib/legal-docs';

// The legal pages of the site, each with its own small icon, in the same list style as before.
const legalIcons = { terms: FileText, privacy: ShieldCheck, cancellation: Undo2, supply: PackageCheck, accessibility: Accessibility, cookies: Cookie };

export default function WorkspaceFooter({ go, adminMode = false }: { go: (page: string) => void; adminMode?: boolean }) {
    return <footer className="megalinks-footer" dir="rtl">
        <div className="megalinks-footer-inner">
            <div className="megalinks-footer-grid">
                <div className="megalinks-footer-brand"><BrandLogo light className="megalinks-footer-logo"/></div>
                <nav className="megalinks-footer-pages megalinks-footer-group" aria-labelledby="footer-pages-title">
                    <h2 id="footer-pages-title">עמודי האתר</h2>
                    <div className="megalinks-footer-link-list">{[['catalog', 'קטלוג אתרים'], ['offers', 'מבצעים וחבילות'], ['knowledge','מדריכים וידע'], ['purchased', 'אזור אישי']].map(([page, label]) => <a key={page} href={page==='catalog'?'/':'/'+page} onClick={event=>{if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;event.preventDefault();go(page);}}>{label}</a>)}</div>
                </nav>
                <section className="megalinks-footer-contact megalinks-footer-group" aria-labelledby="footer-contact-title">
                    <h2 id="footer-contact-title">יצירת קשר ותמיכה</h2>
                    <div className="megalinks-footer-contact-actions"><a className="megalinks-footer-phone" href="tel:+972507508850" aria-label="התקשרו למגה לינקס: 050-750-8850"><Phone size={20} aria-hidden="true"/><bdi>050-750-8850</bdi></a><button type="button" className="megalinks-footer-support" onClick={() => go(adminMode ? 'admin-support' : 'support')}><Headphones size={20} aria-hidden="true"/>פנייה לתמיכה</button></div>
                </section>
                <nav className="megalinks-footer-legal megalinks-footer-group" aria-labelledby="footer-legal-title">
                    <h2 id="footer-legal-title">מידע משפטי</h2>
                    <div className="megalinks-footer-link-list megalinks-footer-legal-list">{LEGAL_DOCS.map(doc => { const Icon = legalIcons[doc.id]; return <a key={doc.id} href={doc.path} onClick={event=>{if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;event.preventDefault();go(doc.id);}}><Icon size={18} aria-hidden="true"/>{doc.title}</a>; })}</div>
                </nav>
            </div>
            <div className="megalinks-footer-copyright"><span>© {new Date().getFullYear()} <bdi>MegaLinks</bdi>. כל הזכויות שמורות.</span></div>
        </div>
    </footer>;
}
