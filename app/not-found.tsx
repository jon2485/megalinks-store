import type {Metadata} from 'next';
import './not-found.css';

// A missing page used to show the framework's English "404: This page could not be found." in a Hebrew page with no main
// region (WCAG 3.1.1/3.1.2, accessibility audit 20.11.2026). Now a short Hebrew page with ways back.
export const metadata: Metadata = {title: 'העמוד לא נמצא', robots: {index: false, follow: false}};

export default function NotFound() {
 return <><a className="ml-skip-link" href="#main-content">דילוג לתוכן הראשי</a><main id="main-content" tabIndex={-1} className="ml-not-found" dir="rtl">
  <p className="ml-not-found-code" aria-hidden="true">404</p>
  <h1>העמוד לא נמצא</h1>
  <p>ייתכן שהכתובת שגויה או שהעמוד הוסר.</p>
  <nav aria-label="המשך גלישה" className="ml-not-found-links">
   <a href="/">לדף הבית</a>
   <a href="/catalog">לקטלוג האתרים</a>
   <a href="/accessibility">הצהרת נגישות</a>
  </nav>
 </main></>;
}
