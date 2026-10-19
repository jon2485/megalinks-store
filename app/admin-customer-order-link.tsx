'use client';
import React from 'react';
import {Copy} from 'lucide-react';
import {toast} from 'sonner';
import {Button} from '@/components/ui/button';
import {Heading,type Ctx} from './workspace';
export function AdminCustomerOrderLink({ctx}:{ctx:Ctx}){return <details className="admin-customer-order-link"><summary>קישור להזמנת לקוח</summary><div className="panel"><Heading title="קישור להזמנת לקוח" description="הלקוח מתחבר, בוחר אתר, מוסיף כתבה לסל ושולח הזמנה. ההזמנה מופיעה בניהול תחת הזמנות." actions={<Button variant="outline" onClick={() => navigator.clipboard.writeText(window.location.origin + '/').then(() => toast.success('קישור הקטלוג הועתק')).catch(() => toast.error('לא ניתן להעתיק. אפשר להעתיק את כתובת האתר מהדפדפן.'))}><Copy size={16}/>העתקת קישור ללקוח</Button>}/><Button onClick={() => ctx.go('catalog')}>בדיקת הזמנה בסביבת לקוח</Button></div></details>;}
