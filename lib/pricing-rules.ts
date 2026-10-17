import {websitePricing,type Row} from './shared';
export function customerPrice(site:Row,tier:Row,personal?:number,tierFixed?:number){
 const base=Number(site.price??site.regular_price_cents??site.price_cents),sale=websitePricing({...site,price:base});
 // An explicit customer price is authoritative, including 0 and prices above list.
 // General promotions only compete with the fallback tier/list price.
 const hasPersonal=personal!=null,hasTierFixed=tierFixed!=null;
 const normal=hasPersonal?personal:hasTierFixed?tierFixed:Math.round(base*(10000-Number(tier.discount_bps||0))/10000);
 const final=!hasPersonal&&sale.is_on_sale?Math.min(normal,sale.price_cents):normal;
 const onSale=!hasPersonal&&sale.is_on_sale&&sale.price_cents<base;
 return {regular_price_cents:base,price_cents:final,customer_normal_price_cents:normal,price_source:hasPersonal?'personal':final<normal?'sale':hasTierFixed?'tier_fixed':Number(tier.discount_bps||0)>0?'tier_discount':'regular',is_on_sale:onSale,sale_price_cents:onSale?sale.price_cents:undefined};
}
export function minimumWarning(name:string,price:number,cost:any){
 if(price===0)return name+': המחיר הוא 0 ₪';
 if(cost===undefined||cost===null)return name+': חסר מחיר עלות, לא ניתן לבדוק את מחיר המינימום';
 if(price<Number(cost)+3000)return name+': המחיר נמוך מעלות + 30 ₪ (מינימום '+((Number(cost)+3000)/100).toFixed(2)+' ₪)';
 return '';
}
