// "הצעות מחיר" (owner 27.11.2026, mockups design/quotes 1-5).
// The admin builds a quote for one customer in a free chat with Claude (through the API): which sites, the customer's
// list price, the admin's own cost, and the special price for this quote. The customer gets a branded e-mail with the
// sites, the price before and after, the expiry date and a button into the system. Approving puts the sites in the
// cart at the quote prices. Removing a quote item from the cart cancels the special prices of that quote.
//
// Privacy: everything the customer sees is built by customerQuote() from its own short list of fields. Cost, profit,
// supplier and the chat never enter it, so nothing Claude writes can leak into the customer's document.
// Numbers: Claude never computes money. The tools return figures computed here, in agorot.
import {env} from 'cloudflare:workers';
import type {Row} from './shared';
import {db,all,one,stmt,parse,now,uid,assert,admin,ApiError,externalFetch,setting,saveSetting,mapIn,connection,audit} from './server';
import {pricingContext,pricedSite} from './pricing';
import {aiProvider} from './anthropic-model';
import {anthropicClient,anthropicFailure} from './anthropic-request';
import {queueMail} from './mail';
import {escapeHtml} from './mail-template';
import {siteDomain} from './anchor-mix';
import {domainHistory} from './site-match';

const KIND='price_quote',DAY=86400000,MODEL='claude-opus-5-5';
export const QUOTE_DEFAULT_DAYS=14;
// list_cents: this customer's own price (tier, personal price, sale). base_cents: the catalog's original list price,
// with no sale and no customer discount; the customer's document shows it as the price before the discount (owner 27.11.2026).
type Item={website_id:string;price_cents:number;list_cents:number;base_cents?:number};
const beforeOf=(i:Item)=>Math.max(Number(i.base_cents??i.list_cents)||0,i.price_cents);
const percentOff=(before:number,price:number)=>before>price?Math.round((before-price)/before*100):0;
const ils=(cents:number)=>'₪'+(Math.round(cents)/100).toLocaleString('he-IL',{maximumFractionDigits:2});
const dateHe=(iso:string)=>new Intl.DateTimeFormat('he-IL',{timeZone:'Asia/Jerusalem',day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(iso));
const dateTimeHe=(iso:string)=>new Intl.DateTimeFormat('he-IL',{timeZone:'Asia/Jerusalem',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(iso)).replace(', ',' בשעה ');
const days=(v:unknown)=>Math.max(1,Math.min(90,Math.floor(Number(v)||QUOTE_DEFAULT_DAYS)));

/** The live status: a sent or approved quote past its date is expired, whatever is stored. */
export function quoteStatus(q:Row,at=Date.now()){
 return ['sent','accepted'].includes(q.status)&&q.expires&&new Date(q.expires).getTime()<=at?'expired':String(q.status||'draft');
}
async function load(id:string){const q=parse(await one('SELECT * FROM records WHERE id=? AND kind=?',id,KIND));assert(q,'הצעת המחיר לא נמצאה',404);return q as Row;}
async function save(q:Row,patch:Row){
 const data={...(typeof q.data==='object'&&q.data?q.data:{}),...patch};
 await stmt('UPDATE records SET data=?,updated=? WHERE id=? AND kind=?',JSON.stringify(data),now(),q.id,KIND).run();
 return {...q,...patch,data};
}
/** The sites of a list of ids, priced for one customer: the customer's own list price and the admin's cost. */
async function pricedFor(customerId:string,ids:string[]){
 const [ctx,rows]=await Promise.all([pricingContext(customerId),mapIn('websites','id',[...new Set(ids)])]);
 const out=new Map<string,Row>();
 for(const [id,row] of rows){const s=pricedSite(row,ctx,true);out.set(String(id),{id:String(id),name:s.name,url:s.url,dr:s.dr??null,category:s.category||'',active:!!row.active,list_cents:Number(s.price_cents)||0,base_cents:Number(s.regular_price_cents)||Number(row.price)||Number(s.price_cents)||0,cost_cents:Number.isFinite(Number(s.cost_cents))&&s.cost_cents!==null&&s.cost_cents!==undefined?Number(s.cost_cents):null});}
 return out;
}
function cleanItems(input:unknown,sites:Map<string,Row>):Item[]{
 assert(Array.isArray(input),'רשימת האתרים אינה תקינה');assert(input.length<=40,'אפשר עד 40 אתרים בהצעה אחת');
 const seen=new Set<string>(),items:Item[]=[];
 for(const raw of input as Row[]){
  const id=String(raw?.website_id||''),site=sites.get(id);assert(site,'אתר בהצעה לא נמצא בקטלוג');assert(site.active,'האתר '+site.name+' אינו פעיל בקטלוג');
  assert(!seen.has(id),'האתר '+site.name+' מופיע פעמיים בהצעה');seen.add(id);
  const price=Math.round(Number(raw.price_cents));assert(Number.isSafeInteger(price)&&price>0&&price<=100000000,'המחיר של '+site.name+' אינו תקין');
  items.push({website_id:id,price_cents:price,list_cents:site.list_cents,base_cents:site.base_cents});
 }
 return items;
}

// ---------- what the admin sees ----------
export async function adminQuote(q:Row){
 const items:Item[]=q.items||[];
 const [sites,customer]=await Promise.all([pricedFor(q.user_id,items.map(i=>i.website_id)),one('SELECT id,name,email,company FROM users WHERE id=?',q.user_id)]);
 const rows=items.map(i=>{const s=sites.get(i.website_id);const cost=s?.cost_cents??null;return {website_id:i.website_id,name:s?.name||'אתר שהוסר',url:s?.url||'',dr:s?.dr??null,active:!!s?.active,base_cents:s?.base_cents??i.base_cents??i.list_cents,list_cents:s?.list_cents??i.list_cents,cost_cents:cost,price_cents:i.price_cents,profit_cents:cost===null?null:i.price_cents-cost,below_cost:cost!==null&&i.price_cents<cost};});
 const sum=(k:string)=>rows.reduce((t,r)=>t+(Number((r as Row)[k])||0),0);
 return {id:q.id,number:q.number,status:quoteStatus(q),customer:customer||{id:q.user_id,name:'לקוח שנמחק',email:''},target_url:q.target_url||'',budget_ils:Number(q.budget_ils)||0,days:days(q.days),expires:q.expires||null,sent_at:q.sent_at||null,created:q.created,
  items:rows,totals:{list_cents:sum('list_cents'),cost_cents:sum('cost_cents'),price_cents:sum('price_cents'),profit_cents:sum('price_cents')-sum('cost_cents'),cost_known:rows.every(r=>r.cost_cents!==null)},
  messages:(q.messages||[]).map((m:Row)=>({role:m.role,text:m.text,at:m.at}))};
}
// ---------- what the customer sees: only these fields, nothing else from the record ----------
export async function customerQuote(q:Row){
 const items:Item[]=q.items||[];const sites=await mapIn('websites','id',items.map(i=>i.website_id));
 const rows=items.map(i=>{const s=sites.get(i.website_id);const before=beforeOf(i);return {website_id:i.website_id,name:String(s?.name||''),url:String(s?.url||''),before_cents:before,price_cents:i.price_cents,percent_off:percentOff(before,i.price_cents)};});
 const before=rows.reduce((t,r)=>t+r.before_cents,0),total=rows.reduce((t,r)=>t+r.price_cents,0);
 return {id:q.id,number:q.number,status:quoteStatus(q),target_url:q.target_url||'',domain:siteDomain(q.target_url||''),budget_ils:Number(q.budget_ils)||0,count:rows.length,expires:q.expires||null,items:rows,before_cents:before,total_cents:total,saving_cents:before-total,percent_off:percentOff(before,total),revised:Number(q.revision)>0};
}

// ---------- admin actions ----------
async function createQuote(u:Row,b:Row){
 const customer=await one('SELECT id,name FROM users WHERE id=?',String(b.customer_id||''));assert(customer,'יש לבחור לקוח');
 const number=Math.max(1000,Number(await setting('price_quote_seq',1000))||1000)+1;await saveSetting('price_quote_seq',number);
 const id=uid(),t=now(),target=String(b.target_url||'').trim().slice(0,300);
 const data={number,status:'draft',target_url:target,budget_ils:Math.max(0,Math.round(Number(b.budget_ils)||0)),days:QUOTE_DEFAULT_DAYS,items:[],messages:[],created_by:u.id};
 await stmt('INSERT INTO records(id,kind,user_id,data,created,updated) VALUES (?,?,?,?,?,?)',id,KIND,customer.id,JSON.stringify(data),t,t).run();
 await audit(u,'price_quote','create',{id,number,customer:customer.id});
 return load(id);
}
async function patchQuote(q:Row,b:Row){
 assert(['draft','sent','expired','declined','accepted','revising'].includes(quoteStatus(q)),'אי אפשר לשנות הצעה שכבר הוזמנה או בוטלה. פתחו הצעה חדשה.',409);
 const patch:Row={};
 if(b.items!==undefined){
  patch.items=cleanItems(b.items,await pricedFor(q.user_id,(Array.isArray(b.items)?b.items:[]).map((i:Row)=>String(i?.website_id||''))));
  // A quote that already went out and now changes: the earlier version stops being valid at once. Its lines leave
  // the customer's cart (approving the corrected quote adds them again; left behind they would double the order),
  // and the customer can approve only the corrected quote, once it is sent.
  const same=JSON.stringify((q.items||[]).map((i:Item)=>[i.website_id,i.price_cents]))===JSON.stringify(patch.items.map((i:Item)=>[i.website_id,i.price_cents]));
  if(q.sent_at&&!same){patch.status='revising';await stmt("DELETE FROM cart WHERE user_id=? AND json_extract(data,'$.quote_id')=?",q.user_id,q.id).run();}
 }
 if(b.days!==undefined){patch.days=days(b.days);if(q.sent_at&&quoteStatus(q)!=='draft'){patch.expires=new Date(new Date(q.sent_at).getTime()+patch.days*DAY).toISOString();patch.reminded=false;}}
 if(b.budget_ils!==undefined)patch.budget_ils=Math.max(0,Math.round(Number(b.budget_ils)||0));
 if(b.target_url!==undefined)patch.target_url=String(b.target_url||'').trim().slice(0,300);
 return save(q,patch);
}
async function sendQuote(u:Row,q:Row,origin:string){
 assert(['draft','sent','expired','declined','accepted','revising'].includes(quoteStatus(q)),'ההצעה כבר הוזמנה או בוטלה',409);assert((q.items||[]).length,'אין אתרים בהצעה');
 const customer=await one('SELECT id,name,email FROM users WHERE id=?',q.user_id);assert(customer?.email,'ללקוח אין כתובת מייל');
 // The "before" price is fixed at the moment of sending, so the document does not change later.
 const sites=await pricedFor(q.user_id,q.items.map((i:Item)=>i.website_id));
 const items=cleanItems(q.items,sites),sent=now(),expires=new Date(Date.now()+days(q.days)*DAY).toISOString();
 // Sent before: this is a corrected quote. An approved one that is sent again must be approved again.
 const revised=!!q.sent_at,revision=(Number(q.revision)||0)+(revised?1:0);
 if(revised)await stmt("DELETE FROM cart WHERE user_id=? AND json_extract(data,'$.quote_id')=?",q.user_id,q.id).run();
 const next=await save(q,{items,status:'sent',sent_at:sent,expires,reminded:false,revision});
 const view=await customerQuote(next);
 await queueMail('email:price-quote:'+q.id+':'+sent,customer.id,{to:customer.email,subject:(revised?'הצעת מחיר מתוקנת מס׳ ':'הצעת מחיר מס׳ ')+q.number+' ממגה לינקס',text:quoteMailText(view,customer.name,false),html:quoteMailHtml(view,customer.name,origin,false),origin,attach_price_quote:q.id});
 await audit(u,'price_quote',revised?'resend':'send',{id:q.id,number:q.number,total:view.total_cents,revision});
 return next;
}

// ---------- the customer's side ----------
/** Sent quotes that are still valid, for the prompt in the catalog. */
export async function pendingQuotes(u:Row){
 const rows=(await all("SELECT * FROM records WHERE kind=? AND user_id=? AND json_extract(data,'$.status')='sent' ORDER BY created DESC LIMIT 5",KIND,u.id)).map(r=>parse(r) as Row).filter(q=>quoteStatus(q)==='sent');
 if(!rows.length)return [];
 const sites=await mapIn('websites','id',rows.flatMap(q=>(q.items||[]).map((i:Item)=>i.website_id)));
 return rows.map(q=>{const items=(q.items||[]).map((i:Item)=>{const s=sites.get(i.website_id);return {website_id:i.website_id,name:String(s?.name||''),url:String(s?.url||''),before_cents:beforeOf(i),price_cents:i.price_cents,percent_off:percentOff(beforeOf(i),i.price_cents)};});
  const before=items.reduce((t:number,r:Row)=>t+r.before_cents,0),total=items.reduce((t:number,r:Row)=>t+r.price_cents,0);
  return {id:q.id,number:q.number,status:'sent',target_url:q.target_url||'',domain:siteDomain(q.target_url||''),budget_ils:Number(q.budget_ils)||0,count:items.length,expires:q.expires,items,before_cents:before,total_cents:total,saving_cents:before-total,percent_off:percentOff(before,total),revised:Number(q.revision)>0};});
}
type Brief=(input:Row,w:Row,u:Row)=>Promise<Row>;
async function acceptQuote(u:Row,q:Row,validBrief:Brief){
 assert(q.user_id===u.id,'ההצעה שייכת לחשבון אחר',403);
 const status=quoteStatus(q);assert(status!=='expired','תוקף ההצעה פג. אפשר לבקש מאיתנו הצעה מעודכנת.',410);assert(['sent','accepted'].includes(status),'ההצעה אינה זמינה לאישור',409);
 const items:Item[]=q.items||[];const sites=await mapIn('websites','id',items.map(i=>i.website_id));
 for(const i of items)assert(sites.get(i.website_id)?.active,'אחד האתרים בהצעה כבר לא זמין. פנו אלינו להצעה מעודכנת.',409);
 const target=/^https?:\/\//i.test(q.target_url||'')?q.target_url:q.target_url?'https://'+q.target_url:'';
 const lines=[];for(const i of items){const w=parse(sites.get(i.website_id)!) as Row;// The same starting topic as the catalog's quick add; the customer fills the brief in the cart.
  const brief=await validBrief({topic:'כתבה עבור '+w.name,target_url:target},w,u);lines.push(stmt('INSERT INTO cart(id,user_id,website_id,quantity,data,created) VALUES (?,?,?,?,?,?)',uid(),u.id,i.website_id,1,JSON.stringify({...brief,quote_id:q.id}),now()));}
 // One batch: the quote's earlier lines go, the new ones come, the quote is marked approved.
 const data={...(q.data||{}),status:'accepted',accepted_at:now()};
 await db().batch([stmt("DELETE FROM cart WHERE user_id=? AND json_extract(data,'$.quote_id')=?",u.id,q.id),...lines,stmt('UPDATE records SET data=?,updated=? WHERE id=? AND kind=?',JSON.stringify(data),now(),q.id,KIND)]);
 return {ok:true,number:q.number,count:items.length};
}

// ---------- the cart ----------
/** Quote prices on the cart lines. A quote applies only while it is approved, in date, and every one of its sites is
 *  still in the cart; then each line gets the quote price (per publication) and no coupon is added on top. */
export async function applyQuotePrices<T extends Row>(u:Row,items:T[]):Promise<T[]>{
 const groups=new Map<string,Row[]>();
 for(const item of items)if(item.quote_id)groups.set(String(item.quote_id),[...(groups.get(String(item.quote_id))||[]),item]);
 if(!groups.size)return items;
 const quotes=await mapIn('records','id',[...groups.keys()],'kind=?',KIND);
 for(const [id,group] of groups){
  const q=parse(quotes.get(id)||null) as Row|null;const list:Item[]=q?.items||[];
  const complete=!!q&&q.user_id===u.id&&quoteStatus(q)==='accepted'&&list.length>0&&list.every(i=>group.some(line=>line.website_id===i.website_id))&&group.every(line=>line.active&&list.some(i=>i.website_id===line.website_id));
  for(const line of group){
   line.quote_number=q?.number||null;line.quote_applied=complete;
   if(!complete)continue;
   const quotePrice=list.find(i=>i.website_id===line.website_id)!.price_cents,units=Math.max(1,Number(line.quantity)||1);
   // The quote price is for one publication. A line that holds more (it should not: the cart moves extra units to a
   // regular line) pays the regular price for the rest, spread evenly so the line total is right.
   const price=units===1?quotePrice:Math.round((quotePrice+(units-1)*line.publication_price)/units);
   line.quote_normal_price=line.publication_price;line.publication_price=price;line.sale_price=price;line.price=price+line.editorial_price;line.price_cents=line.price;line.bundle_applied=true;
  }
 }
 return items;
}
/** A quote line left the cart: the quote's special prices are cancelled for the lines that stay. */
export async function quoteLineRemoved(u:Row,line:Row){
 const id=String(JSON.parse(line.data||'{}').quote_id||'');if(!id)return;
 const q=parse(await one('SELECT * FROM records WHERE id=? AND kind=?',id,KIND)) as Row|null;
 await db().batch([stmt("UPDATE cart SET data=json_remove(data,'$.quote_id') WHERE user_id=? AND json_extract(data,'$.quote_id')=?",u.id,id),...(q&&quoteStatus(q)==='accepted'?[stmt('UPDATE records SET data=?,updated=? WHERE id=? AND kind=?',JSON.stringify({...(q.data||{}),status:'declined',declined_at:now()}),now(),id,KIND)]:[])]);
}
/** After an order: the quotes whose prices were used are closed. */
export async function quotesOrdered(items:Row[],orderId:string){
 const ids=[...new Set(items.filter(i=>i.quote_applied&&i.quote_id).map(i=>String(i.quote_id)))];if(!ids.length)return;
 const quotes=await mapIn('records','id',ids,'kind=?',KIND); await db().batch([...quotes.values()].map(row=>{const q=parse(row) as Row;return stmt('UPDATE records SET data=?,updated=? WHERE id=? AND kind=?',JSON.stringify({...(q.data||{}),status:'ordered',order_id:orderId,ordered_at:now()}),now(),q.id,KIND);}));
}

// ---------- the e-mail (this is also the quote document) ----------
function quoteMailText(v:Row,name:string,reminder:boolean){
 return ['שלום '+(name||'')+',','',reminder?'הצעת מחיר מס׳ '+v.number+' בתוקף לעוד 24 שעות.':v.revised?'מצורפת ההצעה המתוקנת, לבקשתך: הצעת מחיר מס׳ '+v.number+(v.domain?' לאתר '+v.domain:'')+'. ההצעה הקודמת אינה תקפה עוד.':'הכנו עבורך הצעת מחיר מס׳ '+v.number+(v.domain?' לאתר '+v.domain:'')+'.',
  ...v.items.map((i:Row,n:number)=>(n+1)+'. '+i.name+' ('+i.url+'): '+ils(i.before_cents)+' לפני הנחה, '+ils(i.price_cents)+' אחרי הנחה'+(i.percent_off?' ('+i.percent_off+'% הנחה)':'')),
  'סה״כ: '+ils(v.total_cents)+' לפני מע״מ (במקום '+ils(v.before_cents)+(v.percent_off?', '+v.percent_off+'% הנחה':'')+').','ההצעה בתוקף עד '+dateTimeHe(v.expires)+'.'].join('\n');
}
// One font and one text size (16px) for everything; only the title and the final price are larger. Mail programs do
// not load web fonts, so the font is one every computer and phone has.
export function quoteMailHtml(v:Row,name:string,origin:string,reminder:boolean){
 const e=escapeHtml,font="Arial,'Segoe UI',Helvetica,sans-serif",link=origin+'/catalog?quote='+encodeURIComponent(v.id);
 const cell='padding:13px 16px;border-bottom:1px solid #edf1f6;font-size:16px;line-height:1.4;font-family:'+font;
 const row=(label:string,value:string,style='',last=false)=>`<tr><td style="${cell};color:#3d526a${last?';border-bottom:0':''}${/background:#[0-9a-f]+/.exec(style)?.[0]?';'+/background:#[0-9a-f]+/.exec(style)![0]:''}">${label}</td><td align="left" style="${cell};font-weight:bold;color:#09234b;${style}${last?';border-bottom:0':''}">${value}</td></tr>`;
 const off=(n:number)=>n>0?`<span style="display:inline-block;background:#e7f7ed;color:#15803d;font-size:16px;font-weight:bold;padding:2px 8px;border-radius:8px;font-family:${font}" dir="ltr">-${n}%</span>`:'';
 const site=(i:Row,n:number)=>`<tr><td style="${cell};color:#52677e;width:28px">${n+1}</td><td style="${cell}"><span style="font-weight:bold;color:#09234b">${e(i.name)}</span><br><a href="${e(i.url)}" style="font-size:16px;color:#1467cf;font-family:${font}" dir="ltr">${e(String(i.url).replace(/^https?:\/\/(www\.)?/,'').replace(/\/$/,''))}</a></td><td align="left" style="${cell};color:#7a8aa0;white-space:nowrap">${i.before_cents>i.price_cents?'<s>'+e(ils(i.before_cents))+'</s>':''}</td><td align="left" style="${cell};white-space:nowrap">${off(i.percent_off)}</td><td align="left" style="${cell};font-weight:bold;color:#09234b;white-space:nowrap">${e(ils(i.price_cents))}</td></tr>`;
 const th=(t:string,a='right')=>`<th align="${a}" style="padding:11px 16px;background:#f5f8fc;border-bottom:1px solid #e3eaf3;font-size:16px;color:#52677e;font-weight:bold;font-family:${font};white-space:nowrap">${t}</th>`;
 const p='margin:0 0 18px;font-size:16px;line-height:1.6;color:#22364f;font-family:'+font;
 return `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>הצעת מחיר מס׳ ${e(v.number)}</title></head><body style="margin:0;background:#e9eef5;padding:24px 12px;font-family:${font}">
<table role="presentation" dir="rtl" cellpadding="0" cellspacing="0" align="center" style="width:100%;max-width:680px;background:#ffffff;border-radius:18px;overflow:hidden">
<tr><td style="background:#0b2850;padding:22px 28px"><table role="presentation" dir="rtl" width="100%" cellpadding="0" cellspacing="0"><tr><td style="font-size:24px;font-weight:bold;color:#ffffff;font-family:${font}">MegaLinks</td><td align="left" style="font-size:16px;font-weight:bold;color:#ffffff;font-family:${font}">${reminder?'תזכורת':(v.revised?'הצעת מחיר מתוקנת מס׳ ':'הצעת מחיר מס׳ ')+e(v.number)}</td></tr></table></td></tr>
<tr><td style="padding:28px">
<h1 style="margin:0 0 10px;font-size:22px;line-height:1.35;font-weight:bold;color:#09234b;font-family:${font}">${reminder?'ההצעה שלך בתוקף לעוד 24 שעות':(v.revised?'הצעת מחיר מתוקנת':'הצעת מחיר')+(v.domain?' לאתר <span dir="ltr">'+e(v.domain)+'</span>':'')}</h1>
<p style="${p}">שלום ${e(name||'')}, ${reminder?'קיבלת מאיתנו הצעת מחיר ועוד לא אישרת אותה.':v.revised?'מצורפת ההצעה המתוקנת, לבקשתך. ההצעה הקודמת אינה תקפה עוד.':'זו ההצעה שהכנו עבורך.'}</p>
<table role="presentation" dir="rtl" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e3eaf3;border-radius:14px;border-collapse:separate;overflow:hidden">
${row('מספר הצעה',e(v.number))}${v.domain?row('לאתר','<span dir="ltr">'+e(v.domain)+'</span>'):''}${v.budget_ils?row('תקציב',e(ils(v.budget_ils*100))):''}${row('כמות אתרים',String(v.count))}${v.before_cents>v.total_cents?row('מחיר מחירון','<s>'+e(ils(v.before_cents))+'</s>','color:#7a8aa0;font-weight:normal'):''}${v.percent_off?row('הנחה',off(v.percent_off)+' &nbsp;'+e(ils(v.saving_cents)),'color:#15803d'):''}${row('מחיר אחרי הנחה (לפני מע״מ)',e(ils(v.total_cents)),'font-size:20px;background:#f2f7ff')}${row('בתוקף עד',e(dateTimeHe(v.expires)),'color:#9a5b00',true)}
</table>
<h2 style="margin:24px 0 8px;font-size:16px;font-weight:bold;color:#3d526a;font-family:${font}">האתרים בהצעה</h2>
<table dir="rtl" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e3eaf3;border-radius:14px;border-collapse:separate;overflow:hidden"><tr>${th('#')}${th('שם האתר וכתובת')}${th('מחירון','left')}${th('הנחה','left')}${th('אחרי הנחה','left')}</tr>${v.items.map(site).join('')}</table>
<table role="presentation" dir="rtl" cellpadding="0" cellspacing="0" style="width:100%;margin-top:24px"><tr><td align="center"><a href="${e(link)}" style="display:block;background:#f47b16;color:#ffffff;text-decoration:none;font-size:18px;font-weight:bold;padding:17px 20px;border-radius:14px;text-align:center;font-family:${font}">${reminder?'לצפייה בהצעה ולאישור':'אישור ההצעה והוספה לסל'}</a></td></tr></table>
<p style="margin:18px 0 0;font-size:16px;line-height:1.6;color:#52677e;font-family:${font}">הכפתור מעביר למערכת מגה לינקס ומוסיף את האתרים לסל במחירי ההצעה. המחירים לפני מע״מ. המחירים המיוחדים חלים על ההצעה כולה: הסרת אתר מהסל מחזירה את שאר האתרים למחיר הרגיל. אחרי ${e(dateTimeHe(v.expires))} המחירים המיוחדים לא יחולו.</p>
</td></tr></table></body></html>`;
}
/** The quote as a PDF file: the customer's view only, with the brand font and logo. */
export async function quotePdfFile(id:string,origin:string){
 const q=await load(id);assert((q.items||[]).length,'אין אתרים בהצעה');
 const assets=(env as typeof env & {ASSETS?:Fetcher}).ASSETS;assert(assets,'קבצי הפקת המסמך אינם זמינים',503);
 const [font,logo,customer,sites]=await Promise.all([assets.fetch(new Request(origin+'/brand/pdf-hebrew.ttf')),assets.fetch(new Request(origin+'/brand/megalinks-logo.png')),one('SELECT name FROM users WHERE id=?',q.user_id),pricedFor(q.user_id,q.items.map((i:Item)=>i.website_id))]);
 assert(font.ok&&logo.ok,'קבצי המיתוג להפקת PDF אינם זמינים',503);
 // A draft has no sending date yet: the list prices and the expiry are the ones it would get if sent now.
 const view=await customerQuote(q.sent_at?q:{...q,items:cleanItems(q.items,sites),expires:new Date(Date.now()+days(q.days)*DAY).toISOString()});
 const {makePriceQuotePdf}=await import('./price-quote-pdf');
 const bytes=await makePriceQuotePdf(view,customer?.name||'',origin+'/catalog?quote='+encodeURIComponent(q.id),new Uint8Array(await font.arrayBuffer()),new Uint8Array(await logo.arrayBuffer()));
 return {filename:'megalinks-quote-'+q.number+'.pdf',bytes};
}
/** The maintenance tick: one reminder, 24 hours before a sent quote expires. */
export async function quoteReminders(origin:string){
 const at=Date.now();
 const due=(await all("SELECT * FROM records WHERE kind=? AND json_extract(data,'$.status')='sent' AND COALESCE(json_extract(data,'$.reminded'),0)=0 AND json_extract(data,'$.expires')>? AND json_extract(data,'$.expires')<=? LIMIT 20",KIND,new Date(at).toISOString(),new Date(at+DAY).toISOString())).map(r=>parse(r) as Row);
 if(!due.length)return 0;
 const [users,sites]=await Promise.all([mapIn('users','id',due.map(q=>q.user_id)),mapIn('websites','id',due.flatMap(q=>(q.items||[]).map((i:Item)=>i.website_id)))]);let sent=0;
 for(const q of due){
  const customer=users.get(q.user_id);await save(q,{reminded:true});if(!customer?.email)continue;
  const view=customerQuoteFrom(q,sites);
  await queueMail('email:price-quote-reminder:'+q.id+':'+q.sent_at,customer.id,{to:customer.email,subject:'הצעת מחיר מס׳ '+q.number+' בתוקף לעוד 24 שעות',text:quoteMailText(view,customer.name,true),html:quoteMailHtml(view,customer.name,origin,true),origin,attach_price_quote:q.id}).catch(()=>{});sent++;
 }
 return sent;
}
function customerQuoteFrom(q:Row,sites:Map<string,Row>){
 const items=(q.items||[]).map((i:Item)=>{const s=sites.get(i.website_id);return {website_id:i.website_id,name:String(s?.name||''),url:String(s?.url||''),before_cents:beforeOf(i),price_cents:i.price_cents,percent_off:percentOff(beforeOf(i),i.price_cents)};});
 const before=items.reduce((t:number,r:Row)=>t+r.before_cents,0),total=items.reduce((t:number,r:Row)=>t+r.price_cents,0);
 return {id:q.id,number:q.number,target_url:q.target_url||'',domain:siteDomain(q.target_url||''),budget_ils:Number(q.budget_ils)||0,count:items.length,expires:q.expires,items,before_cents:before,total_cents:total,saving_cents:before-total,percent_off:percentOff(before,total),revised:Number(q.revision)>0};
}

// ---------- the chat with Claude ----------
const TOOLS=[
 {name:'find_sites',description:'Search the catalog for sites that fit a need. Returns for each site: id, name, url, DR, category, the list price of THIS customer, the admin cost, and whether the customer already has a link from that site to the target domain. Use it when the admin describes what they look for (topic, budget, how many).',
  input_schema:{type:'object' as const,properties:{query:{type:'string',description:'Hebrew or English words about the topic, category or site name. Empty string for any site.'},max_price_ils:{type:'number',description:'Highest list price per site, in shekels. 0 for no limit.'},min_dr:{type:'number',description:'Lowest DR. 0 for no limit.'},limit:{type:'number',description:'How many sites to return, 1-25.'}},required:['query']}},
 {name:'lookup_sites',description:'Look up specific sites the admin named (by name or domain). Returns the same fields as find_sites, with the best matches for each name. Use it when the admin comes with a ready list.',
  input_schema:{type:'object' as const,properties:{names:{type:'array',items:{type:'string'},description:'Site names or domains, up to 15.'}},required:['names']}},
 {name:'set_quote',description:'Save the quote: the full list of sites with the price for this quote, and optionally the budget and the number of days the quote is valid. It REPLACES the current list. Returns the saved quote with totals computed by the system. Call it whenever the admin decides on sites or prices.',
  input_schema:{type:'object' as const,properties:{items:{type:'array',items:{type:'object',properties:{website_id:{type:'string'},price_ils:{type:'number',description:'The price for this quote, in shekels, before VAT.'}},required:['website_id','price_ils']}},budget_ils:{type:'number'},days:{type:'number',description:'Validity in days, 1-90.'}},required:['items']}}
];
const toIls=(cents:number|null)=>cents===null?null:Math.round(cents)/100;
async function siteRows(q:Row,rows:Row[]){
 const ctx=await pricingContext(q.user_id);const domain=siteDomain(q.target_url||'');
 const used=domain?new Set((await domainHistory({id:q.user_id},domain)).used.map((s:Row)=>String(s.id))):new Set<string>();
 return rows.map(row=>{const s=pricedSite(row,ctx,true);const cost=s.cost_cents===null||s.cost_cents===undefined||!Number.isFinite(Number(s.cost_cents))?null:Number(s.cost_cents);return {id:String(row.id),name:s.name,url:s.url,dr:s.dr??null,category:s.category||'',original_list_price_ils:toIls(Number(s.regular_price_cents)||Number(row.price)||0),list_price_ils:toIls(Number(s.price_cents)||0),cost_ils:toIls(cost),profit_at_list_ils:cost===null?null:toIls((Number(s.price_cents)||0)-cost),already_linked_to_target:used.has(String(row.id))};});
}
async function runTool(q:Row,name:string,input:Row):Promise<{out:unknown;q:Row}>{
 if(name==='find_sites'){
  const words=String(input.query||'').toLowerCase().split(/[^\p{L}\p{N}.]+/u).filter(w=>w.length>1).slice(0,6);
  const like=words.map(()=>"(lower(name) LIKE ? OR lower(url) LIKE ? OR lower(category) LIKE ? OR lower(COALESCE(json_extract(data,'$.ai_profile'),'')) LIKE ?)").join(' OR ');
  const rows=await all('SELECT * FROM websites WHERE active=1'+(like?' AND ('+like+')':'')+' ORDER BY dr DESC LIMIT 120',...words.flatMap(w=>Array(4).fill('%'+w+'%')));
  const max=Number(input.max_price_ils)||0,minDr=Number(input.min_dr)||0,limit=Math.max(1,Math.min(25,Math.floor(Number(input.limit)||12)));
  const list=(await siteRows(q,rows)).filter(s=>(!max||Number(s.list_price_ils)<=max)&&(!minDr||Number(s.dr)>=minDr));
  return {out:{count:list.length,sites:list.slice(0,limit)},q};
 }
 if(name==='lookup_sites'){
  const names=(Array.isArray(input.names)?input.names:[]).map(n=>String(n||'').trim().toLowerCase()).filter(n=>n.length>1).slice(0,15);
  if(!names.length)return {out:{matches:[]},q};
  const keys=names.map(n=>siteDomain(n)&&n.includes('.')?siteDomain(n):n);
  const rows=await all('SELECT * FROM websites WHERE '+keys.map(()=>'(lower(name) LIKE ? OR lower(url) LIKE ?)').join(' OR ')+' LIMIT 80',...keys.flatMap(k=>['%'+k+'%','%'+k+'%']));
  const priced=await siteRows(q,rows),active=new Map(rows.map(r=>[String(r.id),!!r.active]));
  return {out:{matches:names.map((n,i)=>({asked:n,found:priced.filter(s=>String(s.name).toLowerCase().includes(keys[i])||String(s.url).toLowerCase().includes(keys[i])).slice(0,4).map(s=>({...s,active_in_catalog:active.get(s.id)}))}))},q};
 }
 if(name==='set_quote'){
  const raw=(Array.isArray(input.items)?input.items:[]).map((i:Row)=>({website_id:String(i?.website_id||''),price_cents:Math.round(Number(i?.price_ils)*100)}));
  const next=await patchQuote(q,{items:raw,...(input.budget_ils!==undefined?{budget_ils:input.budget_ils}:{}),...(input.days!==undefined?{days:input.days}:{})});
  const v=await adminQuote(next);
  return {out:{saved:true,valid_days:v.days,budget_ils:v.budget_ils,items:v.items.map(i=>({website_id:i.website_id,name:i.name,list_price_ils:toIls(i.list_cents),cost_ils:toIls(i.cost_cents),quote_price_ils:toIls(i.price_cents),profit_ils:toIls(i.profit_cents),below_cost:i.below_cost})),totals:{list_ils:toIls(v.totals.list_cents),cost_ils:v.totals.cost_known?toIls(v.totals.cost_cents):null,quote_ils:toIls(v.totals.price_cents),profit_ils:v.totals.cost_known?toIls(v.totals.profit_cents):null}},q:next};
 }
 return {out:{error:'unknown tool'},q};
}
function systemPrompt(v:Row){
 return ['You help the owner of MegaLinks (an Israeli marketplace for sponsored articles and links) build a price quote for one customer. You talk only with the owner (the admin), never with the customer.',
  'Always answer in plain, short Hebrew. Use a small Markdown table when you list sites and prices.',
  'Money rules: never calculate or guess a price, cost, total or profit yourself. Every figure you state must come from a tool result. If you need a figure, call a tool. If the admin asks for "about 6% off", choose round prices and save them with set_quote, then report the totals the tool returned.',
  'When the admin names sites, call lookup_sites. When they describe a need (topic, count, budget), call find_sites and prefer sites that are not already linked to the target domain and that fit the budget. When several catalog sites match one name, ask which one.',
  'Whenever the admin decides on sites or prices, save with set_quote (the full list every time). Warn when a quote price is below the cost. Mention sites that already link to the target domain.',
  'Two list prices exist: original_list_price_ils is the catalog price with no sale and no customer discount; list_price_ils is what this customer pays today. The customer document shows the original list price as the price before the discount, with the discount percent.',
  'All prices are in shekels before VAT. The cost and the profit are for the admin only; the customer document is produced by the system and never contains them.',
  'Customer: '+(v.customer?.name||'')+'. Target site: '+(v.target_url||'not set')+'. Budget: '+(v.budget_ils?v.budget_ils+' ILS':'not set')+'. Valid for '+v.days+' days. Quote number '+v.number+'.',
  'The quote right now: '+JSON.stringify(v.items.map((i:Row)=>({website_id:i.website_id,name:i.name,list_price_ils:toIls(i.list_cents),cost_ils:toIls(i.cost_cents),quote_price_ils:toIls(i.price_cents)})))].join('\n');
}
async function chat(q:Row,message:string){
 const text=String(message||'').trim();assert(text.length>0&&text.length<=4000,'כתבו הודעה (עד 4,000 תווים)');
 assert(['draft','sent','expired','declined','accepted','revising'].includes(quoteStatus(q)),'אי אפשר לשנות הצעה שכבר הוזמנה או בוטלה. פתחו הצעה חדשה.',409);
 const c=await connection('ai');assert(c.enabled&&c.secret,'חיבור ה-AI אינו פעיל. מגדירים אותו ב״חיבורים והגדרות״.',503);
 assert(aiProvider(c)==='anthropic','הצ׳אט של הצעות המחיר עובד עם Claude. בחרו ב-Claude בהגדרת ״כתיבה עם AI״.',503);
 const client=anthropicClient(c.secret,externalFetch);
 const history=[...(q.messages||[]).slice(-30),{role:'user',text}];
 const messages:any[]=history.map((m:Row)=>({role:m.role==='assistant'?'assistant':'user',content:String(m.text)}));
 let current=q,answer='';
 try{
  for(let turn=0;turn<8;turn++){
   const reply:any=await client.messages.create({model:MODEL,max_tokens:4000,system:systemPrompt(await adminQuote(current)),tools:TOOLS as any,messages});
   if(reply.stop_reason==='refusal')throw new ApiError(502,'Claude לא ענה על הבקשה הזו. נסו לנסח אחרת.');
   const uses=reply.content.filter((b:any)=>b.type==='tool_use');
   answer=reply.content.filter((b:any)=>b.type==='text').map((b:any)=>b.text||'').join('').trim()||answer;
   if(reply.stop_reason!=='tool_use'||!uses.length)break;
   messages.push({role:'assistant',content:reply.content});
   const results=[];
   for(const use of uses){
    try{const r=await runTool(current,use.name,(use.input&&typeof use.input==='object'?use.input:{}) as Row);current=r.q;results.push({type:'tool_result',tool_use_id:use.id,content:JSON.stringify(r.out)});}
    catch(err){results.push({type:'tool_result',tool_use_id:use.id,is_error:true,content:err instanceof ApiError?err.message:'הפעולה נכשלה'});}
   }
   messages.push({role:'user',content:results});
  }
 }catch(err){throw anthropicFailure(err);}
 assert(answer,'לא התקבלה תשובה מ-Claude. נסו שוב.',502);
 const at=now();
 return save(await load(q.id),{messages:[...history.map((m:Row,i:number)=>i===history.length-1?{...m,at}:m),{role:'assistant',text:answer,at}].slice(-60)});
}

// ---------- routes ----------
export async function priceQuoteRoutes(r:Request,p:string[],u:Row,json:(r:Request)=>Promise<Row>,validBrief:Brief):Promise<unknown|null>{
 const method=r.method,origin=new URL(r.url).origin;
 if(p[0]==='admin'&&p[1]==='quotes'){
  admin(u);
  if(!p[2]&&method==='GET'){
   const [rows,customers]=await Promise.all([all('SELECT r.*,u.name AS customer_name,u.email AS customer_email FROM records r LEFT JOIN users u ON u.id=r.user_id WHERE r.kind=? ORDER BY r.created DESC LIMIT 200',KIND),all("SELECT id,name,email,company FROM users WHERE role<>'admin' ORDER BY name LIMIT 2000")]);
   return {quotes:rows.map(row=>{const q=parse(row) as Row;const items:Item[]=q.items||[];return {id:q.id,number:q.number,status:quoteStatus(q),customer_name:row.customer_name||'',customer_email:row.customer_email||'',target_url:q.target_url||'',count:items.length,total_cents:items.reduce((t,i)=>t+i.price_cents,0),expires:q.expires||null,created:q.created};}),customers};
  }
  if(!p[2]&&method==='POST')return adminQuote(await createQuote(u,await json(r)));
  const q=await load(p[2]);
  if(!p[3]&&method==='GET')return adminQuote(q);
  if(!p[3]&&method==='PATCH')return adminQuote(await patchQuote(q,await json(r)));
  if(p[3]==='chat'&&method==='POST')return adminQuote(await chat(q,(await json(r)).message));
  if(p[3]==='send'&&method==='POST')return adminQuote(await sendQuote(u,q,origin));
  if(p[3]==='preview'&&method==='GET'){assert((q.items||[]).length,'אין אתרים בהצעה');const customer=await one('SELECT name FROM users WHERE id=?',q.user_id);const sites=await pricedFor(q.user_id,q.items.map((i:Item)=>i.website_id));const view=await customerQuote({...q,items:cleanItems(q.items,sites),expires:q.expires||new Date(Date.now()+days(q.days)*DAY).toISOString()});return {html:quoteMailHtml(view,customer?.name||'',origin,false)};}
  if(p[3]==='pdf'&&method==='GET'){const file=await quotePdfFile(q.id,origin);return new Response(file.bytes as unknown as BodyInit,{headers:{'Content-Type':'application/pdf','Content-Disposition':'attachment; filename="'+file.filename+'"','Cache-Control':'no-store'}});}
  if(p[3]==='cancel'&&method==='POST'){assert(quoteStatus(q)!=='ordered','ההצעה כבר הוזמנה',409);await audit(u,'price_quote','cancel',{id:q.id});return adminQuote(await save(q,{status:'cancelled'}));}
  return null;
 }
 if(p[0]==='quotes'){
  if(p[1]==='pending'&&method==='GET')return {quotes:await pendingQuotes(u)};
  if(p[1]&&p[2]==='accept'&&method==='POST')return acceptQuote(u,await load(p[1]),validBrief);
 }
 return null;
}
