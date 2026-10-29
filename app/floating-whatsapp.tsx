'use client';

import { useEffect, useRef } from 'react';

export default function FloatingWhatsApp() {
 const linkRef = useRef<HTMLAnchorElement>(null);

 useEffect(() => {
  const link = linkRef.current;
  if (!link) return;
  const updateVisibility = () => {
   link.dataset.motionPaused = String(document.hidden);
  };
  updateVisibility();
  document.addEventListener('visibilitychange', updateVisibility);
  return () => document.removeEventListener('visibilitychange', updateVisibility);
 }, []);

 return (
  <a ref={linkRef} className="floating-whatsapp" href="https://wa.me/972507508850" target="_blank" rel="noopener noreferrer" aria-label="פתיחת שיחה עם MegaLinks בוואטסאפ, 050-750-8850" title="דברו איתנו בוואטסאפ">
   <span className="floating-whatsapp__orbit" aria-hidden="true" />
   <svg className="floating-whatsapp__icon" viewBox="0 0 24 24" width="32" height="32" fill="currentColor" aria-hidden="true"><path d="M20.52 3.48A11.85 11.85 0 0 0 12.05 0C5.47 0 .12 5.35.12 11.93c0 2.1.55 4.16 1.59 5.97L.02 24l6.24-1.64a11.9 11.9 0 0 0 5.78 1.47h.01C18.63 23.83 24 18.48 24 11.9c0-3.18-1.24-6.17-3.48-8.42ZM12.05 21.82h-.01a9.87 9.87 0 0 1-5.04-1.38l-.36-.21-3.7.97.99-3.61-.24-.37a9.85 9.85 0 0 1-1.51-5.29c0-5.47 4.45-9.92 9.93-9.92a9.85 9.85 0 0 1 7.02 2.91 9.86 9.86 0 0 1 2.9 7.02c0 5.47-4.45 9.92-9.98 9.88Zm5.44-7.43c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.64.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.76-1.66-2.06-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.91-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.87 1.21 3.07c.15.2 2.1 3.2 5.09 4.49.71.31 1.26.49 1.69.63.71.22 1.36.19 1.88.12.57-.08 1.76-.72 2-1.41.25-.69.25-1.29.18-1.41-.08-.13-.28-.2-.58-.35Z"/></svg>
   <span className="floating-whatsapp__label">דברו איתנו</span>
  </a>
 );
}
