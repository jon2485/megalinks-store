'use client';
import React from 'react';
import {Input} from '@/components/ui/input';
import {Textarea} from '@/components/ui/textarea';
import {customerFields} from '@/lib/customer-fields';
import type {Row} from '@/lib/shared';

/** Shared fields for My Customers and the article's embedded create form. No navigation. */
export function CustomerFields({values,onChange,busy=false,errors={},prefix='customer'}:{values:Row;onChange:(key:string,value:string)=>void;busy?:boolean;errors?:Record<string,string>;prefix?:string}) {
    return <div className="customer-fields">{customerFields.map(([key,label,type,max])=><label key={key} htmlFor={prefix+'-'+key}><span>{label}{key==='name'&&' *'}</span><Input id={prefix+'-'+key} type={type} dir={type==='email'||type==='tel'?'ltr':'rtl'} required={key==='name'} maxLength={max} disabled={busy} value={values[key]||''} onChange={e=>onChange(key,e.target.value)} aria-invalid={!!errors[key]} aria-describedby={errors[key]?prefix+'-'+key+'-error':undefined}/>{errors[key]&&<span id={prefix+'-'+key+'-error'} className="article-customer-field-error">{errors[key]}</span>}</label>)}<label className="customer-notes" htmlFor={prefix+'-notes'}><span>הערות</span><Textarea className="resize-none" id={prefix+'-notes'} rows={4} maxLength={6000} disabled={busy} value={values.notes||''} aria-invalid={!!errors.notes} aria-describedby={errors.notes?prefix+'-notes-error':undefined} onChange={e=>onChange('notes',e.target.value)}/>{errors.notes&&<span id={prefix+'-notes-error'} className="article-customer-field-error">{errors.notes}</span>}</label></div>;
}
