import type {Row} from './shared';

export const customerFields = [
    ['name', 'שם הלקוח', 'text', 200],
    ['company', 'שם החברה', 'text', 200],
    ['email', 'מייל', 'email', 254],
    ['phone', 'טלפון', 'tel', 254],
] as const;
export const emptyCustomer = () => ({name:'', company:'', email:'', phone:'', notes:''});
export function customerInput(input:Row) {
    return Object.fromEntries(['name','company','email','phone','notes'].map(key=>[key,String(input[key]??'').trim()]));
}
export function customerErrors(values:Row):Record<string,string> {
    const errors:Record<string,string> = {};
    if (!String(values.name||'').trim()) errors.name='יש להזין את שם הלקוח';
    for (const [key,label,,max] of customerFields) if (String(values[key]||'').length>max) errors[key]=label+' ארוך מדי';
    if (values.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) errors.email='יש להזין כתובת מייל תקינה';
    if (String(values.notes||'').length>6000) errors.notes='אפשר להזין עד 6,000 תווים';
    return errors;
}
