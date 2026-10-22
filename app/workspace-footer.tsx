'use client';
import { Phone, Headphones, FileText } from 'lucide-react';
import BrandLogo from './brand-logo';

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
                    <div className="megalinks-footer-link-list"><a href="/terms"><FileText size={18} aria-hidden="true"/>תקנון ותנאי שימוש</a></div>
                </nav>
            </div>
            <div className="megalinks-footer-copyright"><span>© {new Date().getFullYear()} <bdi>MegaLinks</bdi>. כל הזכויות שמורות.</span></div>
        </div>
    </footer>;
}
