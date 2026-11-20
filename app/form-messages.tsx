'use client';

// Hebrew messages for the browser's own form checks (WCAG 3.3.1, accessibility audit 20.11.2026). A required field left
// empty used to show the browser's message in the browser's language (English in an English browser). One listener for
// the whole site: when a field is invalid it gets a Hebrew message, and the message is cleared as soon as the field changes.
// Messages that the site's own code set on a field are left alone.
import {useEffect} from 'react';

type Field = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

function message(field: Field) {
 const v = field.validity;
 const checkbox = field instanceof HTMLInputElement && (field.type === 'checkbox' || field.type === 'radio');
 if (v.valueMissing) return checkbox ? 'יש לסמן את האפשרות כדי להמשיך.' : field instanceof HTMLInputElement && field.type === 'file' ? 'יש לבחור קובץ.' : field instanceof HTMLSelectElement ? 'יש לבחור אפשרות מהרשימה.' : 'יש למלא את השדה הזה.';
 if (v.typeMismatch) return field.type === 'email' ? 'יש להזין כתובת דוא"ל תקינה, למשל name@example.com.' : field.type === 'url' ? 'יש להזין כתובת אתר מלאה, שמתחילה ב-https://' : 'הערך שהוזן אינו בפורמט הנכון.';
 if (v.badInput) return field.type === 'number' ? 'יש להזין מספר.' : field.type === 'date' ? 'יש להזין תאריך תקין.' : 'הערך שהוזן אינו תקין.';
 if (v.tooShort) return 'יש להזין לפחות ' + (field as HTMLInputElement).minLength + ' תווים.';
 if (v.tooLong) return 'אפשר להזין עד ' + (field as HTMLInputElement).maxLength + ' תווים.';
 if (v.rangeUnderflow) return 'הערך המינימלי הוא ' + (field as HTMLInputElement).min + '.';
 if (v.rangeOverflow) return 'הערך המרבי הוא ' + (field as HTMLInputElement).max + '.';
 if (v.stepMismatch) return 'יש להזין ערך בקפיצות של ' + ((field as HTMLInputElement).step || '1') + '.';
 if (v.patternMismatch) return field.title ? field.title : 'הערך שהוזן אינו בפורמט הנדרש.';
 return '';
}

export default function FormMessages() {
 useEffect(() => {
  const ours = new WeakSet<Field>();
  const invalid = (e: Event) => {
   const field = e.target as Field;
   if (!(field instanceof HTMLInputElement || field instanceof HTMLSelectElement || field instanceof HTMLTextAreaElement)) return;
   if (field.validity.customError && !ours.has(field)) return;
   field.setCustomValidity('');
   const text = message(field);
   if (text) { field.setCustomValidity(text); ours.add(field); }
  };
  const changed = (e: Event) => {
   const field = e.target as Field;
   if (ours.has(field)) { field.setCustomValidity(''); ours.delete(field); }
  };
  // Before a form is checked again, drop our old messages, so a value filled in by code is not still reported as missing.
  const submitting = (e: Event) => {
   const button = (e.target as Element | null)?.closest?.('button,input[type=submit]') as HTMLButtonElement | HTMLInputElement | null;
   const form = button?.form;
   if (!form || button.type !== 'submit') return;
   for (const el of Array.from(form.elements)) if (ours.has(el as Field)) { (el as Field).setCustomValidity(''); ours.delete(el as Field); }
  };
  document.addEventListener('invalid', invalid, true);
  document.addEventListener('input', changed, true);
  document.addEventListener('change', changed, true);
  document.addEventListener('click', submitting, true);
  return () => { document.removeEventListener('invalid', invalid, true); document.removeEventListener('input', changed, true); document.removeEventListener('change', changed, true); document.removeEventListener('click', submitting, true); };
 }, []);
 return null;
}
