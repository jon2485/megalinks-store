import type {ReactNode} from 'react';

// One short grey line under a form that collects personal data: what the data is used for, with a link to the privacy
// policy (owner's decision 20.11.2026). Its styles (privacy-note.css) load with the layout, so the component stays CSS-free. Every text must match what the code does and what the privacy policy says.
export default function PrivacyNote({children}: {children: ReactNode}) {
 return <p className="ml-privacy-note">{children} פרטים ב<a href="/privacy" target="_blank" rel="noopener noreferrer">מדיניות הפרטיות<span className="sr-only"> (נפתחת בלשונית חדשה)</span></a>.</p>;
}
