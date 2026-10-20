'use client';
import React from 'react';
import {CreditCard,Landmark,Wallet,RefreshCw} from 'lucide-react';
import {RadioGroup,RadioGroupItem} from '@/components/ui/radio-group';

export default function CheckoutPaymentTiles({value,onChange,options,disabled=false}:{value:string;onChange:(v:string)=>void;options:Record<string,string>;disabled?:boolean}){
 const icons={card:CreditCard,invoice:Landmark,credits:Wallet,monthly:RefreshCw};
 const descriptions={card:'המשך לשירות הסליקה',invoice:'אישור התשלום לאחר בדיקת ההעברה',credits:'שימוש ביתרה והשלמת ההפרש באשראי',monthly:'ללקוחות שאושרו להתחשבנות חודשית'};
 return <RadioGroup dir="rtl" aria-label="אמצעי תשלום" value={value} onValueChange={onChange} disabled={disabled} className="checkout-payment-tiles" style={{gridTemplateColumns:`repeat(${Object.keys(options).length}, minmax(0, 1fr))`}}>{Object.entries(options).map(([key,label])=>{const Icon=icons[key as keyof typeof icons]||CreditCard;return <label key={key} className="checkout-payment-tile" data-selected={key===value} data-disabled={disabled}><RadioGroupItem value={key}/><Icon size={27} aria-hidden="true"/><strong>{label}</strong><span>{descriptions[key as keyof typeof descriptions]}</span></label>;})}</RadioGroup>;
}
