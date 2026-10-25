import type {Row} from './shared';
import {websitePricing} from './shared';

const select=(source:Row,fields:readonly string[])=>Object.fromEntries(fields.filter(k=>source[k]!==undefined).map(k=>[k,source[k]]));
// Default-deny projections: adding an internal database field never publishes it.
const websiteFields=['id','name','url','category','dr','ur','active','is_active','logo_url','language','website_type','city','description','content_tags','recommended_topics','features','tags','turnaround_days','single_link_only','pixel_option','pixel_price','public_notes','customer_notes','publishing_restrictions','example_articles','is_on_sale','sale_price_cents','sale_ends','sale_title','site_status','sort_order','tier_badge'];
export function customerWebsiteData(source:Row):Row {
    const result=select(source,websiteFields);
    // Nested arbitrary objects are not public metadata either.
    for(const key of ['features','tags','content_tags','recommended_topics'])if(key in result)result[key]=Array.isArray(result[key])?result[key].filter((x:unknown)=>typeof x==='string'):[];
    if('example_articles' in result)result.example_articles=Array.isArray(result.example_articles)?result.example_articles.flatMap((x:unknown)=>typeof x==='string'?[x]:x&&typeof x==='object'&&typeof (x as Row).url==='string'?[(x as Row).url]:[]):[];
    const lists=['features','tags','content_tags','recommended_topics','example_articles'];
    for(const key of websiteFields)if(result[key]!==null&&typeof result[key]==='object'&&!lists.includes(key))delete result[key];
    return result;
}
const briefFields=['editorial','editorial_words','topic','brand','audience','style','keywords','target_url','anchor','target_url_2','anchor_2','notes','words','content_type','scheduled','customer_id','image_id','image_credit','image_credit_url','secondary_image_id','secondary_image_credit','document_id','pixel','shared','client_notes','meta_description','publish_without_review'];
const articleDataFields=[...briefFields,'demo','on_account','workflow','editorial_price','publication_price','website_name','website_url','purchased_at','unit_price','paid_amount','paid_net_amount','writing_net_amount','writing_gross_amount','vat_percent','writing_requested_at','writing_request_fingerprint','writing_revision_note','writing_revision_requested_at','writing_revisions','writing_returned_at','writing_completed_at','writing_completed_by','writing_submitted_version','writing_customer_approved_at','writing_customer_approved_version','writing_review_status','writing_status','writing_submitted_at','writing_review_requested_at','published_month','publication_refunded','writing_refunded','refund_total','refund_net','refunded_at','cancel_pending','cancel_reason','cancel_mode','cancelled_at','cancelled_by','writing_customer_review','writing_delivery_mode','writing_client_review','validation'];
const articleFields=['id','order_id','user_id','website_id','status','title','content','published_url','version','updated','number','paid','purchased_at','website_name','website_url','website_logo','user_name','order_vat_percent','created'];
export function customerArticleData(source:Row):Row {
    const raw=typeof source.data==='string'?JSON.parse(source.data):source.data||source;
    const data=select(raw,articleDataFields);
    for(const key of Object.keys(data))if(data[key]!==null&&typeof data[key]==='object')delete data[key];
    if(raw.validation&&typeof raw.validation==='object')data.validation={...select(raw.validation,['checked_at','article_version','ok']),errors:Array.isArray(raw.validation.errors)?raw.validation.errors.filter((x:unknown)=>typeof x==='string'):[],links:Array.isArray(raw.validation.links)?raw.validation.links.map((x:Row)=>select(x,['url','final_url','ok','status','message'])):[]};
    if(raw.writing_brief_snapshot)data.writing_brief_snapshot=select(raw.writing_brief_snapshot,briefFields);
    return {...data,...select(source,articleFields),data};
}
// Activity data is an internal audit record, not a customer message channel.
// Keep the timeline without exposing raw JSON, supplier identities or notes.
export function customerActivity(event:Row,user:Row):Row {
    return {id:event.id,resource:event.resource,action:event.action,created:event.created,actor:event.user_id===user.id?user.name:'צוות האתר',data:'{}'};
}
const sharedFields:Record<string,string[]>={
    bundle:['name','title','description','price_cents','price_ils','website_ids','active','coupon','discount','percent'],
    package:['name','title','description','credits','price','price_cents','price_ils','website_ids','active','features'],
    announcement:['name','title','description','text','content','active','starts','expires'],
};
export function customerSharedRecord(row:Row,kind:string):Row {
    const raw=typeof row.data==='string'?JSON.parse(row.data):row.data||row;
    const data=select(raw,sharedFields[kind]||[]);
    for(const key of Object.keys(data))if(data[key]!==null&&typeof data[key]==='object'){
        if(['features','website_ids'].includes(key)&&Array.isArray(data[key]))data[key]=data[key].filter((x:unknown)=>typeof x==='string');
        else delete data[key];
    }
    return {...select(row,['id','kind','created','updated']),...data,data};
}
export function supplierDelivery(row:Row):Row {
    return select(row,['id','article_id','website_id','website_name','title','status','created','updated','demo']);
}
const orderDataFields=['paid_at','wallet_amount','card_amount','demo','on_account','invoice_name','workflow','name','phone','company','email','bank_reference','notes','coupon','vat_percent','refund_total','paid_refund_total','purchase_closed_at','purchase_closed_by','invoice_file_id','invoice_attached_at','invoice_attached_by','invoice_document_type','invoice_document_number','invoice_history','invoice_event','payment_date','settlement_payment_method','payment_method','payment_reference','closed_at'];
const orderFields=['id','order_id','user_id','number','status','subtotal','discount','vat','total','payment','paid','idempotency','created','updated','paid_date','payment_date','confirmed_payment_method','billing_month','month','demo','amount','settled','monthly_closed','monthly_closed_at','item_preview','site_search','article_count','fully_refunded_count','refunded_count','cancel_pending_count','item_count','payment_settled','order_status','invoice_filename','mail_status','payment_report_status','payment_reported_at'];
function customerOrder(source:Row):Row {
    const raw=typeof source.data==='string'?JSON.parse(source.data):source.data||{};
    const data=select(raw,orderDataFields);
    for(const key of Object.keys(data))if(data[key]!==null&&typeof data[key]==='object')delete data[key];
    if(Array.isArray(raw.invoice_history))data.invoice_history=raw.invoice_history.map((item:Row)=>select(item,['file_id','attached_at','attached_by','document_type','document_number']));
    return {...data,...select(source,orderFields),data:typeof source.data==='string'?JSON.stringify(data):data};
}

// Defense in depth for all non-admin JSON replies, including alternate routes,
// nested objects and older JSON-string data columns. Projections above remain
// the primary privacy boundary, so unknown fields cannot slip through a blacklist.
export function privateField(key:string) {
    const normalized=key.replace(/([a-z0-9])([A-Z])/g,'$1_$2').toLowerCase();
    return /(^|_)(supplier|vendor|cost|costs|stock|inventory|margin|procurement|internal|private|wholesale)(_|$)/.test(normalized)||/^(admin_notes|purchase_price|buy_price|checked_cost|reviewed_cost|pricing_hints|pricing_overrides|pricing_tiers|pricing_alert_count|wordpress_connection|sent_real|sent_demo)$/.test(normalized)||/ספק|עלות|מלאי/.test(key);
}
export function customerJson(value:unknown):any {
    if(Array.isArray(value))return value.map(customerJson);
    if(!value||typeof value!=='object')return value;
    let record=value as Row;
    if(record.kind==='supplier')return null;
    if(record.order_id&&record.website_id&&record.status&&record.data)record=customerArticleData(record);
    else if(record.number!==undefined&&record.subtotal!==undefined&&record.payment!==undefined&&record.data)record=customerOrder(record);
    else if(record.name&&record.url&&record.category&&record.data){const raw=typeof record.data==='string'?JSON.parse(record.data):record.data;record={...customerWebsiteData(raw),...select(record,['id','name','url','category','dr','active']),...websitePricing({...raw,price:record.price})};}
    return Object.fromEntries(Object.entries(record).filter(([key])=>!privateField(key)).map(([key,v])=>{
        if(typeof v==='string'&&['data','metadata','payload','details'].includes(key)){
            try{const parsed=JSON.parse(v);return [key,JSON.stringify(customerJson(parsed))];}catch{return [key,'{}'];}
        }
        return [key,customerJson(v)];
    }));
}
export async function protectCustomerResponse(response:Response,privileged:boolean):Promise<Response> {
    if(privileged||!response.headers.get('content-type')?.includes('application/json'))return response;
    const value=await response.json(),headers=new Headers(response.headers);
    headers.delete('content-length');headers.set('Cache-Control','private, no-store');
    return new Response(JSON.stringify(customerJson(value)),{status:response.status,statusText:response.statusText,headers});
}
