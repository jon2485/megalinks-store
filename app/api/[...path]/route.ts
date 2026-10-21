import {articleGenerationStatus,articleGenerationStream} from '@/lib/article-generation';
import {integrationMetadata,integrationEnvironmentName,integrationEnvironmentSecret,updatedIntegration} from '@/lib/integration-security';
import {claimAiBudget,safeFailure} from '@/lib/security';
import {customerArticleData,customerActivity,customerSharedRecord,supplierDelivery,protectCustomerResponse} from '@/lib/customer-privacy';
import {geminiEnvironmentConfigured} from '@/lib/server';
import {geminiRequest,GeminiRequestError} from '@/lib/gemini-request';
import {availableGeminiModels} from '@/lib/gemini-model-list';
import {GEMINI_DEFAULT_MODEL,GEMINI_MODEL_FORMAT_ERROR,normalizeGeminiModel,validGeminiModel,geminiModelFailure} from '@/lib/gemini-model';
import {writingBriefLink} from '@/lib/writing-brief-validation';
import {writingAction} from '@/lib/writing-actions';
import {writingBriefFile} from '@/lib/writing-brief-file';
import {writingSubmitted,writingCustomerEditor} from '@/lib/writing-workflow';
import {storedOrderPdf} from '@/lib/order-statement';
import {paymentReports} from '@/lib/payment-reports';
import {adminControlCenter,reviewPriceChange} from '@/lib/admin-control-center';
import {adminLobbySearch} from '@/lib/admin-lobby-search';
import {sheetsAdmin,receiveSheets} from '@/lib/sheets-sync';
import {paymentEvidenceRows,orderPaymentEvidence} from '@/lib/payment-evidence';
import {canWorkOrder,isBankPayment,isCardPayment} from '@/lib/payment-state';
import {walletAvailable,cardAmount,completeOrderPayment} from '@/lib/split-payment';
import {walletUsageHistory} from '@/lib/wallet-usage';
import {ledgerView} from '@/lib/ledger-view';
import {orderSummarySql} from '@/lib/order-summary';
import {articleGuard,financialGuard,orderGuard} from '@/lib/monthly-order';
import {createOrder} from '@/lib/order-create';
import {accountManagementRoutes} from '@/lib/account-management';
import {pricingRoutes,pricingContext,pricedSite,catalogPricingMeta,warnPricing,pricingVersion,pricingGuard} from '@/lib/pricing';
import {minimumWarning,customerPrice} from '@/lib/pricing-rules';
import {saveCatalogBatch} from '@/lib/catalog-bulk';
import {financeRoutes,isTopUp} from '@/lib/finance';
import { workflowRoutes } from '@/lib/workflow-routes';
import { articleChecks, checkLink } from '@/lib/checks';
import { writingRequestMail, articleMail, queueMail } from '@/lib/mail';
import { articleDocx } from '@/lib/delivery-docx';
import { businessMonth, closeMonth } from '@/lib/monthly';
import { sanitizeRichHtml, inlineImages, supplierContent } from '@/lib/rich-content';
import { dispatchArticle } from '@/lib/publication';
import { contentHtml, signature, matchingSignature } from '@/lib/integrations';
import { aiArticleHtml } from '@/lib/ai-article-content';
import { env } from 'cloudflare:workers';
import { Row, websitePricing, calculateQuote, articleTransitions, httpUrl, plainText, textToHtml } from '@/lib/shared';
import { ApiError, db, stmt, one, all, parse, actor, admin, owns, assert, setting, saveSetting, audit, ensureCatalog, publicWebsite, website, uid, now, hash, encrypt, connection, geminiServerKey, externalFetch, externalUrl, notify, syncOrder, basicAuth } from '@/lib/server';
export const dynamic = 'force-dynamic';
const response = (data: any, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
const json = async (r: Request): Promise<Row> => { assert(Number(r.headers.get('content-length') || 0) <= 500000, 'הבקשה גדולה מדי', 413); const raw = await r.text(); assert(raw.length <= 500000, 'הבקשה גדולה מדי', 413); try {
    const result = JSON.parse(raw);
    assert(result && typeof result === 'object' && !Array.isArray(result), 'בקשה לא תקינה');
    return result;
}
catch {
    throw new ApiError(400, 'בקשה לא תקינה');
} };
const customerArticle=(a:Row,u:Row)=>{const row=u.role==='admin'?parse(a)!:customerArticleData(a);if(u.role!=='admin'&&writingSubmitted(row)&&['writing','revisions'].includes(row.status)&&!writingCustomerEditor(row)){row.content='';if(row.data)delete row.data.writing_brief_snapshot;}return row;};
const activityFor=(rows:Row[],u:Row)=>u.role==='admin'?rows:rows.map(row=>customerActivity(row,u));
const maxText = (s: any, max = 10000) => String(s || '').slice(0, max);
const adminKinds = ['supplier', 'bundle', 'instruction', 'package', 'announcement', 'newsletter', 'template'];
const ownKinds = ['customer', 'strategy', 'ticket', 'affiliate', 'payout'];
const aiDefaultModel = (provider = 'openai') => provider === 'gemini' ? GEMINI_DEFAULT_MODEL : provider === 'openai' ? 'gpt-4.1-mini' : '';
async function aiJson(c: Row, prompt: string) {
    const provider = c.provider || 'openai';
    const model = provider==='gemini'?normalizeGeminiModel(c.model||GEMINI_DEFAULT_MODEL):c.model||aiDefaultModel(provider);
    if (provider === 'gemini') {
        assert(validGeminiModel(model), GEMINI_MODEL_FORMAT_ERROR);
        const res = await geminiRequest('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': c.secret },
            body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json' } })
        }, externalFetch);
        const output: any = await res.json();
        const raw = output.candidates?.[0]?.content?.parts?.map((part: Row) => part.text || '').join('').trim();
        assert(raw, 'לא התקבל תוכן משירות ה-AI', 502);
        return { raw, provider, model };
    }
    const endpoint = provider === 'groq' ? 'https://api.groq.com/openai/v1/chat/completions' : provider === 'grok' ? 'https://api.x.ai/v1/chat/completions' : 'https://api.openai.com/v1/chat/completions';
    const res = await externalFetch(endpoint, { method: 'POST', headers: { 'Authorization': 'Bearer ' + c.secret, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: model || 'gpt-4.1-mini', messages: [{ role: 'user', content: prompt }], response_format: { type: 'json_object' } }) });
    assert(res.ok, 'שירות ה-AI דחה את הבקשה. בדקו מפתח, מודל ויתרה', 502);
    const output: any = await res.json();
    const raw = output.choices?.[0]?.message?.content;
    assert(raw, 'לא התקבל תוכן משירות ה-AI', 502);
    return { raw, provider, model: model || 'gpt-4.1-mini' };
}
async function coupon(code: string, u: Row, subtotal: number) { if (!code)
    return null; const c = await one('SELECT * FROM coupons WHERE code=?', code.trim().toUpperCase()); assert(c && c.active, 'הקופון אינו זמין'); assert(!c.expires || new Date(c.expires).getTime() > Date.now(), 'תוקף הקופון הסתיים'); assert(!c.max_uses || c.uses < c.max_uses, 'הקופון נוצל במלואו'); assert(!c.user_email || c.user_email.toLowerCase() === u.email, 'הקופון אישי ללקוח אחר'); assert(subtotal >= c.min_total, 'סכום ההזמנה נמוך מהמינימום לקופון'); return c; }
async function cartItems(u: Row) { const pricing=await pricingContext(u.id); const items = (await all('SELECT c.*,w.name,w.url,w.price,w.active,w.data AS website_data FROM cart c JOIN websites w ON c.website_id=w.id WHERE c.user_id=? ORDER BY c.created', u.id)).map(r => { const site = JSON.parse(r.website_data); const item = parse(r)!; const publicationPrice = pricedSite({...r,id:r.website_id,data:r.website_data},pricing,true).price_cents; const editorialPrice = item.editorial ? Number(item.editorial_words || 400) * 15 : 0; delete item.website_data; return { ...item, dr: site.dr ?? null, ur: site.ur ?? null, website: { id: r.website_id, name: r.name, url: r.url, procurement_verified: !!site.procurement_verified }, logo_url: site.logo_url || '', regular_price: Number(r.price), sale_price: publicationPrice, publication_price: publicationPrice, editorial_price: editorialPrice, price: publicationPrice + editorialPrice, price_cents: publicationPrice + editorialPrice }; });
    const groups = new Map<string, Row[]>();
    for (const item of items) if (item.bundle_group) groups.set(item.bundle_group, [...(groups.get(item.bundle_group) || []), item]);
    for (const group of groups.values()) {
        const bundle = parse(await one('SELECT * FROM records WHERE id=? AND kind=?', group[0].bundle_id, 'bundle'));
        const ids = bundle?.website_ids;
        const complete = bundle && bundle.active !== false && Number.isSafeInteger(bundle.price_cents) && Array.isArray(ids) && ids.length === group.length && ids.every((id: string) => group.filter(item => item.website_id === id).length === 1) && group.every(item => item.quantity === group[0].quantity && item.active);
        for (const item of group) { item.bundle_name = bundle?.name || 'חבילת פרסום'; item.bundle_applied = !!complete; }
        if (!complete) continue;
        const normal = group.reduce((sum, item) => sum + item.publication_price, 0);
        const target = bundle.price_cents;
        let allocated = 0;
        group.forEach((item, index) => {
            const price = index === group.length - 1 ? target - allocated : Math.floor(normal ? target * item.publication_price / normal : 0);
            allocated += price; item.publication_price = price; item.sale_price = price; item.price = price + item.editorial_price; item.price_cents = item.price;
        });
    }
    return items;
}
async function quote(u: Row, code = '') { const pricing_version=await pricingVersion();const items = await cartItems(u);assert(pricing_version===await pricingVersion(),'המחירים עודכנו תוך כדי החישוב. נסו שוב',409); assert(items.length, 'הסל ריק'); assert(items.every(x => x.active), 'אחד האתרים בסל אינו פעיל'); const vatPercent = Number(await setting('vat', 18)); const subtotal = calculateQuote(items, 0, vatPercent).subtotal; const c = await coupon(code, u, subtotal); const eligible=items.filter(i=>!i.bundle_applied).reduce((sum,i)=>sum+i.price*i.quantity,0);const discount=Math.round(eligible*Number(c?.percent||0)/100),vat=Math.round((subtotal-discount)*vatPercent/100);const pricing_token=await hash(JSON.stringify(items.map(i=>[i.id,i.website_id,i.quantity,i.price,i.bundle_applied]).sort())+':'+discount+':'+vat);return {subtotal,discount,vat,total:subtotal-discount+vat,items,coupon:c,vatPercent,pricing_token,pricing_version}; }
async function normalizeBundle(input: Row, prior: Row = {}) {
    const b = { ...prior, ...input };
    if (input.websites) {
        const names = String(input.websites).split(',').map(x => x.trim()).filter(Boolean);
        const sites = await all('SELECT id,name,url FROM websites WHERE active=1');
        b.website_ids = names.map(name => { const w = sites.find(w => w.id === name || w.name.trim().toLowerCase() === name.toLowerCase() || w.url.replace(/\/$/, '') === name.replace(/\/$/, '')); assert(w, 'לא נמצא אתר בחבילה: ' + name); return w.id; });
    }
    assert(Array.isArray(b.website_ids) && b.website_ids.length > 0 && b.website_ids.length <= 30, 'בחרו בין אתר אחד ל־30 אתרים');
    assert(new Set(b.website_ids).size === b.website_ids.length, 'אין לבחור אותו אתר פעמיים בחבילה');
    const sites = [];
    for (const id of b.website_ids) { assert(typeof id === 'string', 'מזהה אתר אינו תקין'); const w = await website(id); assert(w.active, 'אחד האתרים בחבילה אינו פעיל'); sites.push(w); }
    if (input.price_ils !== undefined) b.price_cents = Math.round(Number(input.price_ils) * 100);
    if (b.price_cents != null) {
        assert(b.website_ids.length >= 2, 'חבילת מחיר משותף דורשת לפחות שני אתרים');
        assert(Number.isSafeInteger(b.price_cents) && b.price_cents > 0 && b.price_cents <= sites.reduce((sum, w) => sum + w.price_cents, 0), 'מחיר המבצע חייב להיות חיובי ולא גבוה מסכום מחירי האתרים');
        warnPricing([minimumWarning(b.name||'חבילה',b.price_cents,sites.every(w=>w.cost_cents!=null)?sites.reduce((sum,w)=>sum+w.cost_cents,0)+3000*(sites.length-1):null)],input.acknowledge); b.coupon = ''; b.discount = 0;
    } else if (b.coupon) { const c = await one('SELECT percent FROM coupons WHERE code=?', String(b.coupon).toUpperCase()); assert(c, 'יש ליצור קופון לפני שיוך לחבילה'); b.coupon = String(b.coupon).toUpperCase(); b.discount = c.percent; } else b.discount = 0;
    delete b.price_ils; delete b.websites;
    b.active = b.active !== false;
    return b;
}
async function validBrief(input: Row, w: Row, u: Row) { const d = { editorial: input.editorial === true, editorial_words: Math.max(100,Math.min(5000,Math.floor(Number(input.editorial_words)||400))), topic: maxText(input.topic, 500), brand: maxText(input.brand, 200), audience: maxText(input.audience, 500), style: maxText(input.style, 100), keywords: maxText(input.keywords, 300), target_url: httpUrl(input.target_url || ''), anchor: maxText(input.anchor, 200), target_url_2: httpUrl(input.target_url_2 || ''), anchor_2: maxText(input.anchor_2, 200), notes: maxText(input.notes, 6000), words: Math.max(300, Math.min(2500, Number(input.words) || 500)), content_type: input.content_type === 'upload' ? 'upload' : 'ai', scheduled: input.scheduled || '', customer_id: input.customer_id || '', image_id: input.image_id || '', document_id: input.document_id || '', pixel: !!input.pixel, shared: !!input.shared }; assert(d.topic, 'יש להזין נושא לכתבה'); if (w.single_link_only)
    assert(!d.target_url_2, 'באתר זה מותר קישור אחד בלבד'); if (d.scheduled) {
    assert(!isNaN(Date.parse(d.scheduled)) && Date.parse(d.scheduled) > Date.now() - 86400000, 'מועד הפרסום אינו תקין');
} if (d.customer_id) {
    const c = owns(u, await one('SELECT * FROM records WHERE id=? AND kind=?', d.customer_id, 'customer'));
    assert(c.kind === 'customer', 'לקוח לא תקין');
} for (const file of [d.image_id, d.document_id].filter(Boolean))
    owns(u, await one('SELECT * FROM files WHERE id=?', file)); return d; }
type ResponseAccess={privileged:boolean};
async function handle(r: Request,access:ResponseAccess) {
    const p = new URL(r.url).pathname.replace(/^\/api\//, '').split('/');
    const method = r.method;
    const query = new URL(r.url).searchParams;
    if (!['GET', 'HEAD'].includes(method)) {
        const origin = r.headers.get('origin');
        assert(!origin || origin === new URL(r.url).origin, 'מקור הבקשה אינו מורשה', 403);
    }
    if(p[0]==='sheets-sync'&&p[1]==='push'&&method==='POST'){const result=await receiveSheets(r);access.privileged=true;return response(result);}
    if(p[0]==='maintenance'&&p[1]==='month-close'&&method==='POST'){const key=String((env as any).POSTFLOW_AUTOMATION_KEY||'');assert(key&&r.headers.get('authorization')==='Bearer '+key,'נדרשת הרשאת שירות',403);const b=await json(r);return response(await closeMonth(b.month,new URL(r.url).origin));}
    if(p[0]==='branding'&&method==='GET')return response({brand:await setting('brand','פוסטפלואו')});
    if(p[0]==='catalog-logo'&&p[1]&&method==='GET'){
        assert(/^[\da-f-]{36}$/i.test(p[1]),'לוגו לא נמצא',404);const image=await env.BUCKET?.get('public/catalog-logos/'+p[1]);assert(image,'לוגו לא נמצא',404);
        return new Response(image.body,{headers:{'Content-Type':image.httpMetadata?.contentType||'image/png','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'",'Cache-Control':'public, max-age=86400'}});
    }
    if(p[0]==='pricing-version'&&method==='GET')return response({pricing_version:await pricingVersion()});
    if (p[0] === 'catalog' && method === 'GET') {
        await ensureCatalog();
        const managing = query.get('scope') === 'admin';
        let viewer:Row|undefined;try{viewer=await actor();}catch(e){if(!(e instanceof ApiError)||e.status!==401)throw e;}if(managing){assert(viewer,'יש להתחבר כדי להמשיך',401);admin(viewer);}
        access.privileged=managing;
        const pricing_version=await pricingVersion(),pricing=await pricingContext(viewer?.id),meta=managing?await catalogPricingMeta():{};
        return response({ websites: (await all(managing ? `SELECT w.*,COALESCE(json_extract(w.data,'$.supplier_email'),(SELECT json_extract(r.data,'$.email') FROM records r WHERE r.id=json_extract(w.data,'$.supplier_id') AND r.kind='supplier'),'') AS supplier_email,COALESCE((SELECT sent_count FROM supplier_dispatch_counters c WHERE c.website_id=w.id AND c.demo=0),0) AS sent_real,COALESCE((SELECT sent_count FROM supplier_dispatch_counters c WHERE c.website_id=w.id AND c.demo=1),0) AS sent_demo FROM websites w ORDER BY dr DESC,name` : 'SELECT * FROM websites WHERE active=1 ORDER BY dr DESC,name')).map(w => managing ? ({ ...parse(w), ...websitePricing({ ...parse(w), price: w.price }),pricing_hints:Object.fromEntries((meta as Row).pricing_tiers.map((t:Row)=>{const fixed=(meta as Row).pricing_overrides.find((o:Row)=>o.owner_id===t.id&&o.website_id===w.id);return ['tier_'+t.id+'_ils',{calculated:customerPrice(parse(w)!,t,undefined,fixed?.price).customer_normal_price_cents,discount:t.discount_bps/100}];})),...Object.fromEntries((meta as Row).pricing_tiers.map((t:Row)=>['tier_'+t.id+'_ils',((meta as Row).pricing_overrides.find((o:Row)=>o.owner_id===t.id&&o.website_id===w.id)?.price??null)===null?'':(meta as Row).pricing_overrides.find((o:Row)=>o.owner_id===t.id&&o.website_id===w.id).price/100])) }) : pricedSite(w,pricing)), ...meta, pricing_version, ...(managing?{source: { count: 1186, date: '2026-10-04', url: 'https://ai.buypost.co.il/' }}:{}) });
    }
    if (p[0] === 'payment-callback' && method === 'POST') {
        const raw = await r.text();
        assert(raw.length < 10000, 'הבקשה גדולה מדי', 413);
        const c = await connection('payments');
        assert(c.enabled && c.secret, 'החיבור אינו פעיל', 403);
        assert(matchingSignature(r.headers.get('x-postflow-signature') || '', await signature(c.secret, raw)), 'חתימת תשלום לא תקינה', 403);
        let b: Row;
        try {
            b = JSON.parse(raw);
        }
        catch {
            throw new ApiError(400, 'JSON לא תקין');
        }
        assert(b.status === 'paid' && b.currency === 'ILS' && b.event_id, 'אירוע התשלום אינו תקין');
        const order = await one('SELECT * FROM orders WHERE id=?', b.order_id);
        assert(order && (isCardPayment(order)||(isBankPayment(order)&&!!await one("SELECT id FROM jobs WHERE id=? AND kind='payment_link' AND status='succeeded'",'payment-link:'+order.id))) && order.status!=='cancelled' && (order.paid||order.status==='pending'), 'הזמנה אינה זמינה לתשלום', 409);
        assert(Number(b.amount_cents) === cardAmount(order), 'סכום התשלום אינו תואם', 409);
        const event = 'payment:' + maxText(b.event_id, 100);
        if (await one('SELECT id FROM records WHERE id=?', event))
            return response({ ok: true, duplicate: true });
        await completeOrderPayment(order,event,{amount_cents:b.amount_cents,reference:maxText(b.event_id,100)});
        await audit({ id: order.user_id }, order.id, 'תשלום אומת באמצעות הספק', { event_id: b.event_id, amount: order.total });
        return response({ ok: true });
    }
    if (p[0] === 'supplier' && p[1]) {
        const token = await one('SELECT * FROM tokens WHERE hash=? AND kind=?', await hash(p[1]), 'supplier');
        assert(token && !token.used && Date.parse(token.expires) > Date.now(), 'קישור הספק אינו תקף', 403);
        const a = await one('SELECT a.*,w.name AS website_name FROM articles a JOIN websites w ON w.id=a.website_id WHERE a.id=?', token.resource);
        assert(a, 'כתבה לא נמצאה', 404);
        if(method==='GET'&&query.get('asset')==='word'){return new Response(await articleDocx(a) as BodyInit,{headers:{'Content-Type':'application/vnd.openxmlformats-officedocument.wordprocessingml.document','Content-Disposition':'attachment; filename=article.docx'}});}
        if(method==='GET'&&['image','document','inline'].includes(query.get('asset')||'')){const data=JSON.parse(a.data);const fileId=query.get('asset')==='inline'?(await inlineImages(a.content)).find(i=>i.id===query.get('image'))?.id:query.get('asset')==='image'?(query.get('secondary')==='1'?data.secondary_image_id:data.image_id):data.document_id;assert(fileId,'לכתבה לא צורף קובץ',404);const f=await one('SELECT * FROM files WHERE id=?',fileId);assert(f,'הקובץ לא נמצא',404);const blob=await env.BUCKET?.get(f.key);assert(blob,'הקובץ לא נמצא',404);return new Response(blob.body,{headers:{'Content-Type':f.type,'X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'",'Content-Disposition':['image','inline'].includes(query.get('asset')||'')?'inline':'attachment'}});}
        if (method === 'GET')
            return response({ article: { id: a.id, title: a.title, content: await supplierContent(a.content,'/api/supplier/'+p[1]+'?asset=inline&image='), website_name: a.website_name,meta_description:JSON.parse(a.data).meta_description||'',client_notes:JSON.parse(a.data).client_notes||'',secondary_image:!!JSON.parse(a.data).secondary_image_id,secondary_image_credit:JSON.parse(a.data).secondary_image_credit||'',image_credit:JSON.parse(a.data).image_credit||'',image_credit_url:JSON.parse(a.data).image_credit_url||'',image:!!JSON.parse(a.data).image_id,document:!!JSON.parse(a.data).document_id,cancel_pending:!!JSON.parse(a.data).cancel_pending }, expires: token.expires });
        if (method === 'POST') {
            const b = await json(r);
            assert(!JSON.parse(a.data).cancel_pending,'הכתבה ממתינה לביטול; דיווח פרסום חסום',409);
            const url = httpUrl(b.url);
            assert(url, 'יש להזין קישור לפרסום');const w=await website(a.website_id,true);const checked=await checkLink(url,w.url);assert(checked.ok,checked.message,422);assert(a.status==='sent','הכתבה כבר טופלה',409);
            const reportResult=await db().batch([articleGuard(a),stmt('UPDATE tokens SET used=1 WHERE id=? AND used=0', token.id), stmt("UPDATE articles SET status='published',published_url=?,version=version+1,updated=? WHERE id=? AND status='sent'", url, now(), a.id), stmt('INSERT INTO activity(id,user_id,resource,action,data,created) VALUES (?,?,?,?,?,?)', uid(), token.user_id, a.id, 'הספק דיווח על פרסום', JSON.stringify({ url }), now())]);
            assert(reportResult[1].meta.changes===1,'קישור הספק כבר נוצל',403);await stmt("UPDATE jobs SET status='completed',updated=? WHERE id=?",now(),'publication:'+a.id).run();await stmt("UPDATE tokens SET used=1 WHERE kind='supplier' AND resource=?",a.id).run();await stmt("UPDATE articles SET data=json_set(data,'$.published_month',?) WHERE id=?",businessMonth(),a.id).run();await articleMail({...a,published_url:url},'published',new URL(r.url).origin);await syncOrder(a.order_id);
            return response({ ok: true });
        }
    }
    let u: Row;
    if (p[0] === 'v1') {
        const bearer = r.headers.get('authorization') || '';
        assert(bearer.startsWith('Bearer '), 'נדרש מפתח API', 401);
        const token = await one('SELECT * FROM tokens WHERE hash=? AND kind=?', await hash(bearer.slice(7)), 'api');
        assert(token && !token.used && Date.parse(token.expires) > Date.now(), 'מפתח API אינו תקף', 401);
        u = (await one('SELECT * FROM users WHERE id=?', token.user_id))!;if(u)u={...u,role:'api'};
        assert(u, 'משתמש לא נמצא', 401);
        p.shift();
        const action = String(p[0]);
        if (action === 'pricelist') {
            await ensureCatalog();
            const pricing=await pricingContext(u.id);return response({ websites: (await all('SELECT * FROM websites WHERE active=1 ORDER BY name')).map(w=>pricedSite(w,pricing)) });
        }
        assert(['cart', 'quote', 'checkout', 'orders', 'articles'].includes(p[0]), 'הפעולה אינה זמינה ב-API', 403);
    }
    else
        u = await actor();
    access.privileged=u.role==='admin';
    const pricingResponse=await pricingRoutes(r,p,u,json);if(pricingResponse)return pricingResponse;
    const financeResponse=await financeRoutes(r,p,u,json);if(financeResponse)return financeResponse;
    const accountResponse=await accountManagementRoutes(r,p,u);if(accountResponse)return accountResponse;
    const workflowResponse=await workflowRoutes(r,p,u);if(workflowResponse)return workflowResponse;
    if (p[0] === 'supplier-inbox') {
        assert(u.role==='admin'||u.role==='supplier','הגישה זמינה לספק מורשה',403);
        const rows = (await all("SELECT j.* FROM jobs j WHERE j.kind='supplier_publication' ORDER BY j.created DESC")).map(parse).filter(j => j && (u.role==='admin' || (j.recipient_email && j.recipient_email===u.email.toLowerCase())));
        if (method==='GET' && !p[1]) return response({ deliveries:u.role==='admin'?rows:rows.map(row=>supplierDelivery(row!)) });
        const job=rows.find(j=>j!.id===decodeURIComponent(p[1] || '')); assert(job,'המשלוח לא נמצא',404);
        const article=parse(await one('SELECT * FROM articles WHERE id=?',job.article_id)); assert(article,'כתבה לא נמצאה',404);
        if(method==='GET'&&query.get('asset')==='word')return new Response(await articleDocx(article) as BodyInit,{headers:{'Content-Type':'application/vnd.openxmlformats-officedocument.wordprocessingml.document','Content-Disposition':'attachment; filename=article.docx'}});
        if (method==='GET' && query.get('inline')){const image=(await inlineImages(article.content)).find(i=>i.id===query.get('inline'));assert(image,'התמונה אינה חלק מהמשלוח',404);const f=await one('SELECT * FROM files WHERE id=?',image.id);assert(f,'התמונה לא נמצאה',404);const blob=await env.BUCKET?.get(f.key);assert(blob,'התמונה לא נמצאה',404);return new Response(blob.body,{headers:{'Content-Type':f.type,'X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'"}});}
        if (method==='GET' && query.get('image')==='1') { const f=await one('SELECT * FROM files WHERE id=?',(query.get('secondary')==='1'?article.secondary_image_id:article.image_id)||''); assert(f,'תמונה לא נמצאה',404); const blob=await env.BUCKET?.get(f.key); assert(blob,'תמונה לא נמצאה',404); return new Response(blob.body,{headers:{'Content-Type':f.type,'X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'"}}); }
        if (method==='GET') return response({delivery:u.role==='admin'?job:supplierDelivery(job),article:{id:article.id,title:article.title,content:await supplierContent(article.content,'/api/supplier-inbox/'+encodeURIComponent(job.id)+'?inline='),image_id:article.image_id,image_credit:article.image_credit,image_credit_url:article.image_credit_url,secondary_image_id:article.secondary_image_id,secondary_image_credit:article.secondary_image_credit,meta_description:article.meta_description,client_notes:article.client_notes,status:article.status,cancel_pending:!!article.cancel_pending}});
        if (method==='POST') { const b=await json(r); assert(!article.cancel_pending,'הכתבה ממתינה לביטול; דיווח פרסום חסום',409); assert(article.status==='sent','הכתבה אינה ממתינה לפרסום',409); assert(!['blocked','failed','requested','writing'].includes(job.status),'המשלוח אינו מוכן',409); const url=job.demo?'':httpUrl(b.url||''); assert(job.demo || url,'יש להזין קישור לפרסום'); if(!job.demo){const w=await website(article.website_id,true);const check=await checkLink(url,w.url);assert(check.ok,check.message,422);}
            await db().batch([articleGuard(article),stmt("UPDATE articles SET status=?,published_url=?,version=version+1,updated=? WHERE id=? AND status='sent'",job.demo?'demo_completed':'published',url,now(),article.id),stmt('UPDATE jobs SET status=?,updated=? WHERE id=?',job.demo?'demo_completed':'completed',now(),job.id)]);
            await stmt("UPDATE articles SET data=json_set(data,'$.published_month',?) WHERE id=?",businessMonth(),article.id).run();if(!job.demo)await articleMail({...article,published_url:url},'published',new URL(r.url).origin);await audit(u,article.id,job.demo?'הספק השלים הדגמת פרסום':'הספק דיווח על פרסום',{url}); await syncOrder(article.order_id); return response({ok:true}); }
    }
    const reportedPayment=await paymentReports(r,p,u,json);if(reportedPayment)return response(reportedPayment);
    if(p[0]==='payment-alerts'&&method==='GET'){admin(u);return response({orders:(await all("SELECT o.*,u.name AS user_name,u.email FROM orders o JOIN users u ON u.id=o.user_id WHERE o.paid=0 AND o.status IN ('pending','awaiting_approval') AND o.payment IN ('invoice','bank_transfer') AND COALESCE(json_extract(o.data,'$.demo'),0)=0 ORDER BY o.created")).map(parse)});}
    if (p[0] === 'me') {
        if (method === 'GET') {
            const payments=u.role==='admin'?(await one("SELECT COUNT(*) AS n FROM orders o WHERE paid=0 AND status<>'cancelled' AND ((status IN ('pending','awaiting_approval') AND payment IN ('invoice','bank_transfer') AND COALESCE(json_extract(data,'$.demo'),0)=0) OR EXISTS(SELECT 1 FROM records r WHERE r.id='payment-report:'||o.id AND json_extract(r.data,'$.status')='pending'))"))!.n:0;
            return response({ user: {...u,credits_available:await walletAvailable(u),monthly_account:await one('SELECT * FROM credit_accounts WHERE user_id=?',u.id)}, counts: {...await one('SELECT (SELECT COUNT(*) FROM orders WHERE user_id=?) AS orders,(SELECT COUNT(*) FROM articles WHERE (?=1 OR user_id=?) AND status=?) AS approvals,(SELECT COUNT(*) FROM cart WHERE user_id=?) AS cart', u.id, u.role==='admin'?1:0, u.id, 'admin_review', u.id),payments} });
        }
        if (method === 'PATCH') {
            const b = await json(r);
            await stmt('UPDATE users SET name=?,phone=?,company=? WHERE id=?', maxText(b.name, 100) || u.name, maxText(b.phone, 30), maxText(b.company, 200), u.id).run();
            return response({ ok: true });
        }
    }
    if (p[0] === 'cart' && p[1] === 'bundle' && method === 'POST') {
        const b = await json(r); const bundle = parse(await one('SELECT * FROM records WHERE id=? AND kind=?', b.bundle_id, 'bundle'));
        assert(bundle && bundle.active !== false, 'החבילה אינה זמינה', 404);
        assert(Array.isArray(bundle.website_ids) && bundle.website_ids.length, 'לחבילה לא הוגדרו אתרים');
        const group = uid(), statements = [];
        for (const id of bundle.website_ids) { const w = await website(id); assert(w.active, 'אחד האתרים בחבילה אינו פעיל'); const brief = await validBrief({ ...b, topic: b.topic || 'כתבה עבור ' + w.name, words: b.words || 500 }, w, u); statements.push(stmt('INSERT INTO cart(id,user_id,website_id,quantity,data,created) VALUES (?,?,?,?,?,?)', uid(), u.id, id, 1, JSON.stringify({ ...brief, bundle_id: bundle.id, bundle_group: group }), now())); }
        await db().batch(statements); return response({ added: statements.length, coupon: bundle.coupon || '' }, 201);
    }
if (p[0] === 'cart') {
        if (method === 'GET')
            return response({ items: await cartItems(u) });
        if (method === 'POST') {
            const b = await json(r);
            const w = await website(b.website_id);
            const brief = await validBrief(b, w, u);
            const quantity = Math.max(1, Math.min(20, Math.floor(Number(b.quantity) || 1)));
            const id = uid();
            await stmt('INSERT INTO cart(id,user_id,website_id,quantity,data,created) VALUES (?,?,?,?,?,?)', id, u.id, w.id, quantity, JSON.stringify(brief), now()).run();
            return response({ id }, 201);
        }
        if (p[1] && method === 'DELETE') {
            owns(u, await one('SELECT * FROM cart WHERE id=?', p[1]));
            await stmt('DELETE FROM cart WHERE id=?', p[1]).run();
            return response({ ok: true });
        }
        if (p[1] && method === 'PATCH') {
            const item = owns(u, await one('SELECT * FROM cart WHERE id=?', p[1]));
            const b = await json(r);
            const w = await website(item.website_id);
            const brief = await validBrief({ ...JSON.parse(item.data), ...b }, w, u);
            const quantity = Math.max(1, Math.min(20, Math.floor(Number(b.quantity) || item.quantity)));
            await stmt('UPDATE cart SET data=?,quantity=? WHERE id=?', JSON.stringify({ ...brief, ...(JSON.parse(item.data).bundle_group ? { bundle_id: JSON.parse(item.data).bundle_id, bundle_group: JSON.parse(item.data).bundle_group } : {}) }), quantity, item.id).run();
            return response({ ok: true });
        }
    }
    if (p[0] === 'quote' && method === 'POST') {
        const b = await json(r);
        const q = await quote(u, b.coupon);
        return response({ ...q, coupon: q.coupon ? { code: q.coupon.code, percent: q.coupon.percent } : null });
    }
    if (p[0] === 'checkout' && method === 'POST') {
        const b = await json(r);
        assert(/^[a-zA-Z0-9-]{10,100}$/.test(b.idempotency || ''), 'מזהה הבקשה אינו תקין');
        const attempt=await one('SELECT data FROM records WHERE id=?','purchase:'+u.id+':'+b.idempotency);if(attempt)return response(JSON.parse(attempt.data));
        const existing = await one('SELECT id,number,status FROM orders WHERE user_id=? AND idempotency=?', u.id, b.idempotency);
        if (existing)
            return response(existing);
        const q = await quote(u, b.coupon);
        assert(b.pricing_token===q.pricing_token, 'פרטי המחירים השתנו. יש לרענן ולאשר שוב את סיכום ההזמנה',409);
        assert(Number(b.expected_total) === q.total, 'מחיר ההזמנה השתנה. רעננו את סיכום ההזמנה לפני אישור', 409);
        const demo = ['demo_card','demo_bit','demo_transfer','demo_credits','demo_monthly'].includes(b.payment);
        const monthly = ['monthly','demo_monthly'].includes(b.payment);
        if(monthly){const account=await one('SELECT * FROM credit_accounts WHERE user_id=?',u.id);assert(account?.enabled,'החשבון אינו מאושר לחשבון חודשי',403);assert((demo?account.demo_balance:account.balance)+q.total<=account.credit_limit,'ההזמנה חורגת ממסגרת החשבון החודשי',409);}
        assert(!demo||(env as any).POSTFLOW_ALLOW_DEMO_CHECKOUT==='true','מסלולי הדגמה אינם זמינים לרכישה באתר',403);
        assert(['card','invoice', 'credits','demo_card','demo_bit','demo_transfer','demo_credits','demo_monthly','monthly'].includes(b.payment), 'אמצעי תשלום אינו זמין');
        assert(b.accepted === true, 'יש לאשר את תנאי ההזמנה');
        if(b.payment==='card'||(b.payment==='credits'&&await walletAvailable(u)<q.total)){const c=await connection('payments');assert(c.enabled&&c.url&&c.secret,'נדרשת השלמה באשראי, אך חיבור הסליקה טרם הופעל. היתרה לא חויבה וההזמנה לא בוצעה',503);}

        return response(await createOrder(u,u,q,b),201);
    }
    if (p[0] === 'orders') {
        if (method === 'GET' && !p[1]) {
            const rows = await all(u.role === 'admin' && query.get('scope') === 'all' ? `SELECT o.*,${orderSummarySql()},(SELECT settled FROM monthly_charges c WHERE c.order_id=o.id) AS payment_settled,(SELECT COUNT(*) FROM articles a WHERE a.order_id=o.id) AS item_count,u.name AS user_name,u.email FROM orders o JOIN users u ON u.id=o.user_id ORDER BY o.created DESC LIMIT 1000` : `SELECT o.*,${orderSummarySql()},(SELECT settled FROM monthly_charges c WHERE c.order_id=o.id) AS payment_settled,(SELECT COUNT(*) FROM articles a WHERE a.order_id=o.id) AS item_count FROM orders o WHERE o.user_id=? ORDER BY o.created DESC LIMIT 1000`, ...(u.role === 'admin' && query.get('scope') === 'all' ? [] : [u.id]));
            const receipts=u.role==='admin'?await paymentEvidenceRows():[];return response({orders:rows.map(raw=>{const o=parse(raw)!;return u.role==='admin'?{...o,payment_confirmation:orderPaymentEvidence(o,receipts)}:o;})});
        }
        const order = owns(u, await one(`SELECT o.*,${orderSummarySql()},(SELECT settled FROM monthly_charges c WHERE c.order_id=o.id) AS payment_settled FROM orders o WHERE id=?`, p[1]));
        if(p[2]==='statement.pdf'&&method==='GET'){const pdf=await storedOrderPdf(order.id,new URL(r.url).origin);return new Response(pdf.bytes,{headers:{'Content-Type':'application/pdf','Content-Disposition':'attachment; filename="'+pdf.filename+'"','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});}
        if (p[2] === 'invoice') {
            if (method === 'POST') {
                admin(u); const b = await json(r); const f = owns(u, await one('SELECT * FROM files WHERE id=?', b.file_id));
                assert(f.type === 'application/pdf', 'יש לצרף חשבונית או קבלה בקובץ PDF');
                const blob = await env.BUCKET?.get(f.key); assert(blob, 'הקובץ לא נמצא', 404);
                const current=parse(order)!;if(b.expected_file_id!==undefined)assert(String(b.expected_file_id)===String(current.invoice_file_id||''),'מסמך ההזמנה השתנה. יש לרענן לפני החלפה',409);const stamp=now();const documentType=['invoice','receipt','invoice_receipt'].includes(b.document_type)?b.document_type:'invoice_receipt';
                const history=[...(Array.isArray(current.invoice_history)?current.invoice_history:[]),...(current.invoice_file_id?[{file_id:current.invoice_file_id,attached_at:current.invoice_attached_at,attached_by:current.invoice_attached_by,document_type:current.invoice_document_type,document_number:current.invoice_document_number}]:[])];
                const data={...JSON.parse(order.data),invoice_file_id:f.id,invoice_attached_at:stamp,invoice_attached_by:u.id,invoice_document_type:documentType,invoice_document_number:maxText(b.document_number,100),invoice_history:history};
                const recipient=await one('SELECT email FROM users WHERE id=?',order.user_id);const mailId='email:invoice:'+order.id+':'+uid();const mail={to:recipient?.email,subject:'מסמך תשלום זמין להזמנה '+order.number,text:'חשבונית / קבלה צורפה להזמנה '+order.number+'. ניתן להוריד אותה מתוך הארנק.',button:{label:'לארנק ולמסמכים שלי',url:new URL(r.url).origin+'/wallet'},demo:!!current.demo,order_id:order.id};
                const saved=await db().batch([stmt("UPDATE orders SET data=json_set(data,'$.invoice_file_id',?,'$.invoice_attached_at',?,'$.invoice_attached_by',?,'$.invoice_document_type',?,'$.invoice_document_number',?,'$.invoice_history',json(?),'$.invoice_event',?),updated=? WHERE id=? AND COALESCE(json_extract(data,'$.invoice_file_id'),'')=?",f.id,stamp,u.id,documentType,data.invoice_document_number,JSON.stringify(history),mailId,stamp,order.id,current.invoice_file_id||''),stmt("INSERT INTO jobs(id,user_id,kind,status,data,created,updated) SELECT ?,?,'email','requested',?,?,? WHERE EXISTS(SELECT id FROM orders WHERE id=? AND json_extract(data,'$.invoice_event')=?)",mailId,order.user_id,JSON.stringify(mail),stamp,stamp,order.id,mailId)]);assert(saved[0].meta.changes,'המסמך השתנה במקביל. יש לרענן לפני החלפה',409);
                await audit(u, order.id, 'מסמך חשבונית צורף להזמנה', {file_id:f.id,previous_file_id:current.invoice_file_id||'',document_number:data.invoice_document_number});let mailStatus='failed';try{mailStatus=(await queueMail(mailId,order.user_id,mail))?.status||'requested';}catch{}
                return response({ok:true,mail_status:mailStatus});
            }
            if (method === 'GET') {
                const fileId = JSON.parse(order.data).invoice_file_id; assert(fileId, 'טרם צורפה חשבונית להזמנה', 404);
                const f = await one('SELECT * FROM files WHERE id=?',fileId); assert(f && f.type === 'application/pdf', 'המסמך לא נמצא', 404);
                const blob = await env.BUCKET?.get(f.key); assert(blob,'המסמך לא נמצא',404);
                return new Response(blob.body,{headers:{'Content-Type':'application/pdf','Content-Disposition':`attachment; filename*=UTF-8''${encodeURIComponent('invoice-'+String(order.number).replace(/[^a-zA-Z0-9-]/g,'')+'.pdf')}`,'X-Content-Type-Options':'nosniff','Cache-Control':'private, no-store','Content-Security-Policy':"default-src 'none'"}});
            }
        }
        if (method === 'GET')
            return response({ ...(u.role==='admin'?{payment_confirmation:orderPaymentEvidence(parse(order)!,await paymentEvidenceRows(order.user_id))}:{}),order: parse(order), articles: (await all("SELECT a.*,w.name AS website_name,w.url AS website_url,json_extract(o.data,'$.vat_percent') AS order_vat_percent FROM articles a LEFT JOIN websites w ON w.id=a.website_id JOIN orders o ON o.id=a.order_id WHERE a.order_id=?", order.id)).map(a=>customerArticle(a,u)), activity: activityFor(await all('SELECT a.*,u.name AS actor FROM activity a JOIN users u ON u.id=a.user_id WHERE resource=? ORDER BY created DESC', order.id),u) });
        if (p[2] === 'payment-link' && method === 'POST') {
            assert(!JSON.parse(order.data).demo && !order.paid && order.status === 'pending'&&isCardPayment(order), 'קישור אשראי זמין רק להזמנה שנבחר לה תשלום באשראי');
            const c = await connection('payments');
            assert(c.enabled && c.url && c.secret, 'סליקה טרם הוגדרה. ניתן לפנות למנהל לאימות העברה', 503);
            const job = 'payment-link:' + order.id;
            const prior = await one('SELECT * FROM jobs WHERE id=?', job);
            if (prior?.status === 'succeeded')
                return response(JSON.parse(prior.data));
            if(prior){assert(prior.status==='failed','בקשת הסליקה כבר בטיפול. נסו שוב בעוד רגע',409);const retry=await stmt("UPDATE jobs SET status='writing',updated=? WHERE id=? AND status='failed'",now(),job).run();assert(retry.meta.changes,'בקשת הסליקה כבר בטיפול',409);}else await stmt('INSERT INTO jobs(id,user_id,kind,status,data,created,updated) VALUES (?,?,?,?,?,?,?)', job, u.id, 'payment_link', 'writing', JSON.stringify({ order_id: order.id }), now(), now()).run();
            try {
                const res = await externalFetch(c.url, { method: 'POST', headers: { Authorization: 'Bearer ' + c.secret, 'Content-Type': 'application/json', 'Idempotency-Key': job }, body: JSON.stringify({ event: 'create_payment', order_id: order.id, order_number: order.number, amount_cents: cardAmount(order), currency: 'ILS', customer: JSON.parse(order.data), return_url:new URL('/wallet',r.url).href,cancel_url:new URL('/wallet',r.url).href,callback_url: new URL('/api/payment-callback', r.url).href }) });
                assert(res.ok, 'ספק הסליקה דחה את הבקשה', 502);
                const payload: any = await res.json();
                const payment_url = externalUrl(payload.payment_url).href;
                await stmt("UPDATE jobs SET status='succeeded',data=?,updated=? WHERE id=?", JSON.stringify({ payment_url, order_id: order.id }), now(), job).run();
                return response({ payment_url });
            }
            catch (e) {
                await stmt("UPDATE jobs SET status='failed',updated=? WHERE id=?", now(), job).run();
                throw e;
            }
        }
        if (p[2] === 'approve' && method === 'POST') {
            admin(u);
            assert(order.status === 'awaiting_approval', 'ההזמנה אינה ממתינה לאישור', 409);
            const sites = await all('SELECT w.* FROM articles a JOIN websites w ON w.id=a.website_id WHERE a.order_id=?', order.id);
            assert(sites.length && sites.every(w => w.active && JSON.parse(w.data).procurement_verified), 'יש לאמת הסכם לכל אתרי ההזמנה בניהול האתרים לפני אישור', 409);
            await stmt("UPDATE orders SET status='pending',updated=? WHERE id=? AND status='awaiting_approval'", now(), order.id).run();
            await audit(u, order.id, 'הבקשה אושרה במחיר שהוזמן');
            return response({ ok: true });
        }
        if (p[2] === 'paid' && method === 'POST') {
            admin(u);
            const b = await json(r);
            assert(!JSON.parse(order.data).demo&&!order.paid&&['pending','awaiting_approval'].includes(order.status)&&isBankPayment(order),'אימות ידני זמין רק להזמנה שממתינה לאישור העברה בנקאית',409);
            assert(b.confirmed===true,'יש לאשר שהכספים התקבלו בפועל בחשבון הבנק');
            const paymentDate=String(b.payment_date||'');assert(/^\d{4}-\d{2}-\d{2}$/.test(paymentDate)&&!isNaN(Date.parse(paymentDate))&&new Date(paymentDate).toISOString().slice(0,10)===paymentDate&&paymentDate<=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jerusalem'}).format(new Date()),'יש להזין תאריך קבלת תשלום תקין');
            if(b.expected_total!==undefined)assert(Number(b.expected_total)===order.total,'סכום ההזמנה השתנה; יש לרענן לפני האישור',409);
            assert(maxText(b.reference, 300).length > 2, 'יש להזין אסמכתת תשלום');
            await completeOrderPayment(order,'manual-paid:'+order.id,{reference:maxText(b.reference,300),payment_date:paymentDate,payment_method:'bank_transfer',amount_cents:order.total,actor:u.id});
            await audit(u, order.id, 'תשלום אומת ידנית', { method:'bank_transfer' });
            return response({ ok: true });
        }
        if (p[2] === 'cancel' && method === 'POST') {
            const articles = await all("SELECT a.*,w.name AS website_name,w.url AS website_url,json_extract(o.data,'$.vat_percent') AS order_vat_percent FROM articles a LEFT JOIN websites w ON w.id=a.website_id JOIN orders o ON o.id=a.order_id WHERE a.order_id=?", order.id);
            assert(!['cancelled', 'completed'].includes(order.status), 'ההזמנה כבר נסגרה');
            assert(articles.every(a => !['sent', 'published'].includes(a.status)), 'לא ניתן לבטל כתבה שכבר נשלחה לפרסום');
            assert(!order.paid || order.payment === 'credits' || u.role === 'admin', 'תשלום חיצוני דורש טיפול מנהל');
            const b = await json(r);
            if (order.paid && order.payment !== 'credits')
                assert(b.reference, 'נדרשת אסמכתת החזר חיצוני');
            const refundUser=await one('SELECT * FROM users WHERE id=?',order.user_id);assert(refundUser,'הלקוח לא נמצא',404);
            const ops = [financialGuard(refundUser),orderGuard(order),stmt('INSERT INTO records(id,kind,user_id,data,created,updated) VALUES (?,?,?,?,?,?)', 'cancel:' + order.id, 'cancellation', u.id, '{}', now(), now()), stmt("UPDATE orders SET status='cancelled',updated=? WHERE id=? AND status<>'cancelled'", now(), order.id), stmt("UPDATE articles SET status='cancelled',version=version+1,updated=? WHERE order_id=?", now(), order.id)];
            if (order.paid && order.payment === 'credits') {
                const remaining=Math.max(0,order.total-Number(JSON.parse(order.data).paid_refund_total||0));
                if(remaining)ops.push(stmt('INSERT INTO ledger(id,user_id,amount,reason,reference,created) VALUES (?,?,?,?,?,?)',uid(),order.user_id,remaining,'החזר הזמנה '+order.number,'refund:'+order.id,now()),stmt('UPDATE users SET credits=credits+? WHERE id=?',remaining,order.user_id));
                ops.push(stmt("UPDATE orders SET data=json_set(data,'$.paid_refund_total',?,'$.refund_total',COALESCE(json_extract(data,'$.refund_total'),0)+?) WHERE id=?",order.total,remaining,order.id));
            }
            const data = JSON.parse(order.data);
            if(data.on_account){const col=data.demo?'demo_balance':'balance';const charge=await one('SELECT * FROM monthly_charges WHERE order_id=?',order.id);assert(!charge?.settled,'הזמנה בחשבון חודשי שכבר שולמה דורשת טיפול זיכוי נפרד',409);if(charge)assert(!await one("SELECT id FROM records WHERE id=?",'monthly:'+charge.month+':'+order.user_id+':'+charge.demo),'החשבון החודשי כבר נסגר; נדרש טיפול זיכוי נפרד',409);ops.push(stmt(`UPDATE credit_accounts SET ${col}=${col}-(SELECT COALESCE(SUM(amount),0) FROM monthly_charges WHERE order_id=? AND settled=0) WHERE user_id=?`,order.id,order.user_id),stmt('DELETE FROM monthly_charges WHERE order_id=? AND settled=0',order.id));}
            if (data.coupon && !data.demo)
                ops.push(stmt('UPDATE coupons SET uses=MAX(0,uses-1) WHERE code=?', data.coupon));
            await db().batch(ops);
            await audit(u, order.id, 'הזמנה בוטלה', { reason: b.reason || '', reference: b.reference || '' });
            return response({ ok: true });
        }
    }
    if (p[0] === 'articles') {
        if (method === 'GET' && !p[1]) {
            const scope = u.role === 'admin' && query.get('scope') === 'all';
            return response({ articles: (await all(`SELECT a.*,o.number,o.paid,o.created AS purchased_at,w.name AS website_name,w.url AS website_url,json_extract(w.data,'$.logo_url') AS website_logo,u.name AS user_name FROM articles a JOIN orders o ON o.id=a.order_id JOIN websites w ON w.id=a.website_id JOIN users u ON u.id=a.user_id ${scope ? '' : 'WHERE a.user_id=?'} ORDER BY a.updated DESC LIMIT 2000`, ...(scope ? [] : [u.id]))).map(a=>customerArticle(a,u)) });
        }
        const a = owns(u, await one('SELECT * FROM articles WHERE id=?', p[1]));
        if(method!=='GET'){const purchase=parse(await one('SELECT * FROM orders WHERE id=?',a.order_id));assert(purchase&&canWorkOrder(purchase),'יש להשלים את התשלום לפני טיפול ושליחת כתבות',409);}
        if(method!=='GET')assert(!JSON.parse(a.data).cancel_pending,'הכתבה ממתינה לביטול; לא ניתן להמשיך לטפל בה',409);
        if(method==='GET'&&p[2]==='writing-brief.pdf'){admin(u);const file=await writingBriefFile(a.id,new URL(r.url).origin);return new Response(file.bytes as BodyInit,{headers:{'Content-Type':'application/pdf','Content-Disposition':'attachment; filename="'+file.filename+'"','Cache-Control':'private, no-store'}});}
        if(method==='GET'&&p[2]==='document'&&u.role!=='admin'&&writingSubmitted(a))assert(writingCustomerEditor(a),'הטקסט עדיין בטיפול אצל עורך התוכן',409);
        if(method==='GET'&&p[2]==='document')return new Response(await articleDocx(a) as BodyInit,{headers:{'Content-Type':'application/vnd.openxmlformats-officedocument.wordprocessingml.document','Content-Disposition':"attachment; filename=article.docx; filename*=UTF-8''"+encodeURIComponent((a.title||'article').slice(0,80)+'.docx'),'Cache-Control':'private, no-store'}});
        if (method === 'GET') {
            const aiConfig = await connection('ai');
            return response({ ai_generation:await articleGenerationStatus(a.id), ai_available: !!(aiConfig.enabled && aiConfig.secret), article: customerArticle(a,u), order: parse(await one('SELECT * FROM orders WHERE id=?', a.order_id)), website: u.role === 'admin' ? await website(a.website_id, true) : publicWebsite((await one('SELECT * FROM websites WHERE id=?', a.website_id))!), activity: activityFor(await all('SELECT a.*,u.name AS actor FROM activity a JOIN users u ON u.id=a.user_id WHERE resource=? ORDER BY created DESC', a.id),u) });
        }
        if(method==='PATCH'||method==='POST'&&['status','writing-request','writing-complete','writing-revisions'].includes(p[2]))assert((await articleGenerationStatus(a.id))?.status!=='writing','המאמר בהכנה. אפשר לערוך או לשלוח אותו לאחר שהכתיבה תסתיים.',409);
        if(['writing-complete','writing-revisions'].includes(p[2])&&method==='POST')return response(await writingAction(a,u,await json(r),new URL(r.url).origin,p[2]));
        if(p[2]==='writing-request'&&method==='POST'){
            const b=await json(r),data=JSON.parse(a.data);
            assert(data.editorial,'לכתבה הזו לא נרכש שירות כתיבה',403);
            const order=parse(await one('SELECT * FROM orders WHERE id=?',a.order_id))!;
            assert(canWorkOrder(order),'נדרש תשלום לפני הזמנת כתיבה');
            assert(['draft','writing','revisions'].includes(a.status),'הכתבה כבר בתהליך אישור או פרסום',409);
            assert(Number(b.version)===a.version,'הפרטים עודכנו במקביל. טענו מחדש לפני שליחה',409);
            assert(data.topic?.trim(),'יש להזין נושא לכתבה');
            assert(data.target_url&&data.anchor?.trim(),'יש להזין כתובת קישור ואת המילים שיופיעו כקישור');
            for(const key of ['target_url','target_url_2']){const link=writingBriefLink(data[key]);assert(!link.error,(key==='target_url'?'כתובת הקישור לשילוב במאמר: ':'הקישור הנוסף: ')+link.error);data[key]=link.url;}if(data.target_url_2)assert(data.anchor_2?.trim(),'יש להזין את המילים של הקישור הנוסף');
            assert(!data.image_id||data.image_credit?.trim(),'יש להוסיף קרדיט לתמונה הראשית');
            assert(!data.secondary_image_id||data.secondary_image_credit?.trim(),'יש להוסיף קרדיט לתמונה המשנית');
            const fingerprint=await hash(JSON.stringify(['topic','brand','audience','style','keywords','notes','target_url','anchor','target_url_2','anchor_2','client_notes','image_id','image_credit','image_credit_url','secondary_image_id','secondary_image_credit','document_id','editorial_words','publish_without_review'].map(key=>data[key]||'')));
            if(data.writing_request_fingerprint===fingerprint&&a.status==='writing')return response({version:a.version,unchanged:true});
            data.writing_request_fingerprint=fingerprint;data.writing_requested_at=now();data.writing_first_requested_at||=data.writing_requested_at;data.words=Number(data.editorial_words)||400;
            data.writing_brief_snapshot=Object.fromEntries(['topic','brand','audience','style','keywords','notes','target_url','anchor','target_url_2','anchor_2','client_notes','image_id','image_credit','image_credit_url','secondary_image_id','secondary_image_credit','document_id','editorial_words','publish_without_review','writing_requested_at'].map(key=>[key,data[key]??'']));
            const result=await stmt("UPDATE articles SET title=?,data=?,status='writing',version=version+1,updated=? WHERE id=? AND version=?",maxText(data.topic,300),JSON.stringify(data),now(),a.id,a.version).run();
            assert(result.meta.changes,'הפרטים עודכנו במקביל',409);
            await audit(u,a.id,'פרטי הכתיבה נשלחו לכותב',{words:data.words});
            let mail_status='requested';try{mail_status=(await writingRequestMail({...a,data:JSON.stringify(data),version:a.version+1},new URL(r.url).origin))?.status||'requested';}catch{mail_status='failed';}
            return response({version:a.version+1,mail_status});
        }
        if (method === 'PATCH') {
            if(u.role!=='admin'&&writingSubmitted(a))assert(['draft','review','revisions'].includes(a.status)&&writingCustomerEditor(a),'הכתבה בטיפול אצל עורך התוכן או כבר נשלחה לאישור',409);
            const b = await json(r);
            assert(!['published', 'cancelled', 'sent','demo_completed'].includes(a.status), 'הכתבה סגורה לעריכה');
            assert(Number(b.version) === a.version, 'הכתבה עודכנה במקביל. טענו מחדש לפני שמירה', 409);
            const content = b.content_format === 'html' ? await sanitizeRichHtml(maxText(b.content,150000)) : contentHtml(maxText(b.content, 150000), JSON.parse(a.data));
            const embedded=await inlineImages(content);assert(embedded.length<=10,'אפשר לצרף עד 10 תמונות בתוך המאמר');
            for(const image of embedded){assert(image.id&&image.credit,'לכל תמונה בתוך המאמר נדרש קרדיט');const file=owns(u,await one('SELECT * FROM files WHERE id=?',image.id));assert(file.type.startsWith('image/'),'יש לצרף קובץ תמונה תקין');}
            const title = maxText(b.title, 300);
            // Drafts may be incomplete. articleChecks requires a title before submission.
            const priorData = JSON.parse(a.data);
            const data = { ...priorData, secondary_image_id:b.secondary_image_id===undefined?priorData.secondary_image_id||'':b.secondary_image_id, secondary_image_credit:b.secondary_image_credit===undefined?priorData.secondary_image_credit||'':maxText(b.secondary_image_credit,300), client_notes:b.client_notes===undefined?priorData.client_notes||'':maxText(b.client_notes,3000), ...(u.role==='admin'&&b.admin_notes!==undefined?{admin_notes:maxText(b.admin_notes,3000)}:{}), meta_description: b.meta_description===undefined?priorData.meta_description||'':maxText(b.meta_description, 350), image_id: b.image_id === undefined ? priorData.image_id || '' : b.image_id, image_credit: b.image_credit === undefined ? priorData.image_credit || '' : maxText(b.image_credit,300), image_credit_url: b.image_credit_url === undefined ? priorData.image_credit_url || '' : httpUrl(b.image_credit_url || '') };
            if (data.image_id && data.image_id !== priorData.image_id) {
                const credit=await one('SELECT data FROM activity WHERE resource=? AND action=? ORDER BY created DESC LIMIT 1',data.image_id,'נבחרה תמונה מ-Pexels');
                if(credit) { const attribution=JSON.parse(credit.data); data.image_credit='צילום: '+attribution.photographer+' / Pexels'; data.image_credit_url=attribution.url; }
            }
            if (b.brief) {
                if(!writingSubmitted(a))data.publish_without_review=b.brief.publish_without_review===true;
                for (const key of ['topic','brand','audience','style','keywords','notes','anchor','anchor_2']) data[key]=maxText(b.brief[key],key==='notes'?6000:500);
                for (const key of ['target_url','target_url_2']) {const link=writingBriefLink(b.brief[key]);assert(!link.error,(key==='target_url'?'כתובת הקישור לשילוב במאמר: ':'הקישור הנוסף: ')+link.error);data[key]=link.url;}
                data.words= Math.max(100,Math.min(5000,Math.floor(Number(b.brief.words)||500)));
                const w=await website(a.website_id,true); assert(!w.single_link_only || !data.target_url_2,'באתר זה מותר קישור אחד בלבד');
            }
            if(data.secondary_image_id)owns(u,await one('SELECT * FROM files WHERE id=?',data.secondary_image_id));
            if (data.image_id)
                owns(u, await one('SELECT * FROM files WHERE id=?', data.image_id));
            const result = await stmt('UPDATE articles SET title=?,content=?,data=?,status=?,version=version+1,updated=? WHERE id=? AND version=?', title, content, JSON.stringify(data), ['approved','admin_review'].includes(a.status)?(writingSubmitted(a)?'writing':'draft'):a.status, now(), a.id, a.version).run();
            assert(result.meta.changes, 'הכתבה עודכנה במקביל', 409);
            await audit(u, a.id, 'תוכן נשמר', { version: a.version + 1 });
            return response({ version: a.version + 1 });
        }
        if(p[2]==='validate'&&method==='POST')return response(await articleChecks(a));
        if (p[2] === 'status' && method === 'POST') {
            const b = await json(r);
            const next = b.status;
            if(u.role!=='admin'&&JSON.parse(a.data).editorial){assert(next==='admin_review'&&['draft','review','revisions'].includes(a.status)&&writingCustomerEditor(a),'הטקסט עדיין אינו זמין לשליחה; תיקונים שולחים דרך בקשת תיקונים',409);}
            assert(next !== 'cancelled', 'ביטול כתבה נעשה דרך ביטול ההזמנה כדי לשמור על תיעוד התשלום');
            assert((articleTransitions[a.status] || []).includes(next), 'מעבר הסטטוס אינו אפשרי');
            if (u.role !== 'admin')
                assert(['admin_review', 'revisions'].includes(next), 'המעבר זמין למנהל בלבד', 403);
            const order = await one('SELECT * FROM orders WHERE id=?', a.order_id);
            assert(order&&canWorkOrder(parse(order)!), 'נדרש תשלום מאומת לפני התקדמות');
            assert(plainText(a.content).trim() || ['writing', 'cancelled'].includes(next), 'יש להוסיף תוכן לכתבה');
            assert(b.version === a.version, 'הכתבה עודכנה במקביל', 409);
            if(next==='admin_review'){const validation=await articleChecks(a);assert(validation.ok,validation.errors.join(' · '),422);}
            if(next==='revisions')assert(maxText(b.note,3000).trim(),'יש לפרט את הסיבה להחזרה לתיקון');
            const url = next === 'published' ? httpUrl(b.url || '') : a.published_url;
            if (next === 'published'){assert(url,'יש להזין קישור לפרסום');const w=await website(a.website_id,true);const check=await checkLink(url,w.url);assert(check.ok,check.message,422);assert(!JSON.parse(order!.data).demo,'הדגמה אינה פרסום אמיתי');}
            const result = await stmt('UPDATE articles SET status=?,published_url=?,version=version+1,updated=? WHERE id=? AND version=?', next, url, now(), a.id, a.version).run();
            assert(result.meta.changes, 'הכתבה עודכנה במקביל', 409);
            if(next==='admin_review'||next==='revisions'||next==='published')await articleMail({...a,version:a.version+1,published_url:url},next==='admin_review'?'submitted':next==='revisions'?'revisions':'published',new URL(r.url).origin,maxText(b.note,3000));
            if(next==='published')await stmt("UPDATE articles SET data=json_set(data,'$.published_month',?) WHERE id=?",businessMonth(),a.id).run();
            await audit(u, a.id, 'סטטוס: ' + next, { note: maxText(b.note, 3000), url });
            await notify(u, 'article_status', { article_id: a.id, status: next, recipient_email: (await one('SELECT email FROM users WHERE id=?', a.user_id))?.email, recipient_phone: (await one('SELECT phone FROM users WHERE id=?', a.user_id))?.phone });
            if (next === 'approved') await dispatchArticle({...a,status:'approved',version:a.version+1},u,new URL(r.url).origin);
            await syncOrder(a.order_id);
            const remaining = await one("SELECT COUNT(*) AS n FROM articles WHERE order_id=? AND status NOT IN ('published','cancelled')", a.order_id);
            if (!remaining?.n)
                await stmt("UPDATE orders SET status='completed',updated=? WHERE id=?", now(), a.order_id).run();
            return response({ ok: true });
        }
        if(p[2]==='remind'&&method==='POST'){admin(u);assert(a.status==='sent','הכתבה אינה ממתינה לספק');const d=JSON.parse(a.data);const original=parse(await one("SELECT * FROM jobs WHERE id=? AND kind='email'",'email:supplier:'+a.id));assert(original,'לא נוצר מייל ספק',409);const result=await queueMail('reminder:'+a.id+':'+now().slice(0,10),a.user_id,{...original.data,subject:'תזכורת לפרסום: '+a.title});return response(result);}
        if (p[2] === 'dispatch' && method === 'POST') { admin(u); assert(a.status==='approved' || a.status==='sent','הכתבה טרם אושרה'); return response(await dispatchArticle(a,u,new URL(r.url).origin)); }
        if (p[2] === 'supplier-link' && method === 'POST') {
            admin(u);
            assert(a.status === 'approved' || a.status === 'sent', 'הכתבה חייבת להיות מאושרת');
            assert(!JSON.parse((await one('SELECT data FROM orders WHERE id=?',a.order_id))!.data).demo,'להזמנת הדגמה משתמשים בפורטל הספק בלבד');
            const token = uid() + uid();
            const expires = new Date(Date.now() + 14 * 86400000).toISOString();
            await db().batch([stmt('INSERT INTO tokens(id,hash,kind,user_id,resource,expires,used) VALUES (?,?,?,?,?,?,?)', uid(), await hash(token), 'supplier', u.id, a.id, expires, 0), stmt("UPDATE articles SET status='sent',version=version+1,updated=? WHERE id=? AND status='approved'", now(), a.id)]);
            await audit(u, a.id, 'נוצר קישור ספק', { expires });
            return response({ url: new URL('/supplier/' + token, r.url).href, expires });
        }
        if (p[2] === 'generate' && method === 'POST') {
            assert(!['published', 'sent', 'cancelled', 'approved','demo_completed'].includes(a.status), 'הכתבה סגורה ליצירה');
            const o = await one('SELECT * FROM orders WHERE id=?', a.order_id);
            assert(o&&canWorkOrder(parse(o)!), 'יש להשלים רכישה לפני יצירת כתבה');
            assert(u.role==='admin'||!JSON.parse(a.data).editorial,'לכתבה זו נרכש שירות כתיבה מקצועי',403);
            const c = await connection('ai');
            assert(c.enabled && c.secret, 'יש להגדיר חיבור AI בצד הניהול', 503);
            await claimAiBudget(u,'article');
            const w = await website(a.website_id);
            const d = JSON.parse(a.data);
            const instructions = (await all("SELECT data FROM records WHERE kind='instruction'")).map(x => JSON.parse(x.data).text || '').join('\n');
            const prompt = `כתוב כתבה מקורית בעברית בנושא ${d.topic}. כ-${d.words} מילים. סגנון: ${d.style}. קהל: ${d.audience}. מותג: ${d.brand}. מילות מפתח: ${d.keywords}. הערות: ${d.notes}. הנחיות אתר: ${w.publishing_restrictions || ''}. הנחיות מערכת: ${instructions}. החזר JSON בלבד עם title, content (מחרוזת HTML עם פסקאות בתגיות <p> וכותרות משנה בתגיות <h2> אמיתיות בלבד), meta_description. אין לכתוב H2 כסימון טקסטואלי ואין להשתמש ב-Markdown. הכותרת הראשית נפרדת בשדה title. אל תוסיף קישורים שלא נמסרו. אל תמציא עובדות או טענות שלא נמסרו. אין לפרסם אוטומטית.`;
            const previousGeneration=await articleGenerationStatus(a.id);
            assert(previousGeneration?.status!=='writing','המאמר כבר בהכנה. אפשר לחזור אליו בעוד כמה שניות.',409);
            if(previousGeneration?.stale)await stmt("UPDATE jobs SET status='failed',data=json_set(data,'$.error',?),updated=? WHERE id=? AND status='writing'",previousGeneration.error,now(),previousGeneration.id).run();
            const job = 'ai:' + a.id + ':' + a.version;
            await stmt("DELETE FROM jobs WHERE id=? AND status='failed'",job).run();
            let generated: Row = {};
            const claimed=await stmt('INSERT OR IGNORE INTO jobs(id,user_id,kind,status,data,created,updated) VALUES (?,?,?,?,?,?,?)', job, u.id, 'ai_generation', 'writing', JSON.stringify({ article_id: a.id }), now(), now()).run();
            assert(claimed.meta.changes,'המאמר כבר בהכנה. אפשר לחזור אליו בעוד כמה שניות.',409);
            const execute=async()=>{
            try {
                const { raw, provider, model } = await aiJson(c, prompt);
                let data: Row;
                try {
                    data = JSON.parse(raw.replace(/^```json\s*|```$/g, ''));
                }
                catch {
                    throw new ApiError(502, 'ה-AI החזיר תוכן בפורמט לא תקין');
                }
                assert(data.title && data.content, 'תשובת AI חסרה כותרת או תוכן', 502);
                generated = { title: data.title, content: data.content };
                const result = await stmt("UPDATE articles SET title=?,content=?,data=?,status='draft',version=version+1,updated=? WHERE id=? AND version=?", maxText(data.title, 300), await aiArticleHtml(maxText(data.content, 150000), d), JSON.stringify({ ...d, meta_description: maxText(data.meta_description, 350) }), now(), a.id, a.version).run();
                assert(result.meta.changes, 'הכתבה עודכנה במהלך היצירה; הטקסט נמצא ביומן העבודה', 409);
                await stmt("UPDATE jobs SET status='succeeded',data=?,updated=? WHERE id=?", JSON.stringify({ article_id: a.id, title: data.title, content: data.content }), now(), job).run();
                await audit(u, a.id, 'נוצרה טיוטת AI', { provider, model });
                return;
            }
            catch (e) {
                const message=e instanceof GeminiRequestError?e.message:safeFailure(e);
                await stmt("UPDATE jobs SET status='failed',data=?,updated=? WHERE id=?", JSON.stringify({ article_id: a.id, error: message, ...(e instanceof GeminiRequestError?{provider_error:e.diagnostic}:{}), ...generated }), now(), job).run();
                throw e instanceof GeminiRequestError||e instanceof ApiError?e:new ApiError(502,message);
            }
            };
            if(query.get('background')==='1')return articleGenerationStream(job,execute);
            await execute();
            return response({ok:true});
        }
        if (p[2] === 'publish' && method === 'POST') {
            admin(u);
            assert(a.status === 'approved', 'נדרש אישור מנהל לפני פרסום');
            assert(!JSON.parse((await one('SELECT data FROM orders WHERE id=?',a.order_id))!.data).demo,'הזמנת הדגמה אינה נשלחת לפרסום חיצוני');
            const c = await connection('wordpress');
            assert(c.enabled && c.url && c.username && c.secret, 'יש להגדיר חיבור WordPress', 503);
            const assigned = await website(a.website_id);
            assert(assigned.data?.wordpress_connection === 'primary' && assigned.data?.procurement_verified, 'לאתר זה לא הוקצה חיבור WordPress והסכם פרסום מאומת');
            assert(new URL(assigned.url).hostname.replace(/^www\./, '') === new URL(c.url).hostname.replace(/^www\./, ''), 'כתובת חיבור WordPress אינה תואמת לאתר הפרסום');
            const d = JSON.parse(a.data);
            assert(!d.scheduled || Date.parse(d.scheduled) <= Date.now(), 'טרם הגיע מועד הפרסום. אפשר לשלוח טיוטה לספק');
            const existing = await one('SELECT * FROM jobs WHERE id=?', 'wp:' + a.id);
            assert(!existing, 'כבר קיימת בקשת פרסום. בדקו את יומן החיבורים לפני ניסיון נוסף', 409);
            await stmt('INSERT INTO jobs(id,user_id,kind,status,data,created,updated) VALUES (?,?,?,?,?,?,?)', 'wp:' + a.id, u.id, 'wordpress', 'writing', JSON.stringify({ article_id: a.id }), now(), now()).run();
            try {
                let mediaId = 0;
                if (d.image_id) {
                    const f = await one('SELECT * FROM files WHERE id=?', d.image_id);
                    assert(f && f.type.startsWith('image/'), 'תמונת הכתבה לא זמינה');
                    const blob = await env.BUCKET?.get(f.key);
                    assert(blob, 'קובץ התמונה לא נמצא');
                    const mediaResponse = await externalFetch(new URL('/wp-json/wp/v2/media', c.url).href, { method: 'POST', headers: { Authorization: basicAuth(c.username, c.secret), 'Content-Type': f.type, 'Content-Disposition': 'attachment; filename=postflow-image.' + (f.type === 'image/png' ? 'png' : 'jpg') }, body: await blob.arrayBuffer() });
                    assert(mediaResponse.ok, 'העלאת התמונה ל-WordPress נכשלה', 502);
                    const media: any = await mediaResponse.json();
                    mediaId = Number(media.id);
                }
                const res = await externalFetch(new URL('/wp-json/wp/v2/posts', c.url).href, { method: 'POST', headers: { 'Authorization': basicAuth(c.username, c.secret), 'Content-Type': 'application/json' }, body: JSON.stringify({ title: a.title, content: a.content+(d.image_credit?'<p>'+textToHtml(d.image_credit)+'</p>':''), status: c.auto_publish ? 'publish' : 'draft', ...(mediaId ? { featured_media: mediaId } : {}) }) });
                assert(res.ok, 'WordPress דחה את הפרסום', 502);
                const output: any = await res.json();
                const status = output.status === 'publish' ? 'published' : 'sent';
                await stmt('UPDATE articles SET status=?,published_url=?,version=version+1,updated=? WHERE id=?', status, output.link || '', now(), a.id).run();
                await stmt("UPDATE jobs SET status='succeeded',data=?,updated=? WHERE id=?", JSON.stringify({ article_id: a.id, wordpress_id: output.id, url: output.link }), now(), 'wp:' + a.id).run();
                await audit(u, a.id, 'נשלח ל-WordPress', { wordpress_id: output.id, status });
                await syncOrder(a.order_id);
                return response({ ok: true, url: output.link });
            }
            catch (e) {
                await stmt("UPDATE jobs SET status='failed',data=?,updated=? WHERE id=?", JSON.stringify({ article_id: a.id, error: safeFailure(e) }), now(), 'wp:' + a.id).run();
                throw e;
            }
        }
    }
    if (p[0] === 'files') {
        assert(env.BUCKET, 'אחסון הקבצים אינו זמין כרגע', 503);
        if (method === 'GET' && !p[1])
            return response({ files: await all('SELECT id,name,type,size,created FROM files WHERE user_id=? ORDER BY created DESC', u.id) });
        if (method === 'POST') {
            assert(Number(r.headers.get('Content-Length') || 0) <= 17 * 1024 * 1024, 'מותר קובץ עד 15MB', 413);
            const form = await r.formData();
            const f = form.get('file');
            assert(f instanceof File, 'לא נבחר קובץ');
            assert(f.size > 0 && f.size <= 15 * 1024 * 1024, 'מותר קובץ עד 15MB');
            const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain', 'text/html', 'text/csv'];
            let type = f.type;
            if (!type && /\.docx$/i.test(f.name))
                type = allowed[5];
            assert(allowed.includes(type), 'פורמט קובץ אינו נתמך');
            const bytes = new Uint8Array(await f.arrayBuffer());
            const matches = type === 'image/png' ? bytes.slice(0, 8).join(',') === '137,80,78,71,13,10,26,10' : type === 'image/jpeg' ? bytes[0] === 255 && bytes[1] === 216 : type === 'image/gif' ? new TextDecoder().decode(bytes.slice(0, 3)) === 'GIF' : type === 'image/webp' ? new TextDecoder().decode(bytes.slice(0, 4)) === 'RIFF' && new TextDecoder().decode(bytes.slice(8, 12)) === 'WEBP' : type === 'application/pdf' ? new TextDecoder().decode(bytes.slice(0, 5)) === '%PDF-' : type === allowed[5] ? bytes[0] === 80 && bytes[1] === 75 : true;
            assert(matches, 'תוכן הקובץ אינו תואם לפורמט');
            const id = uid(), key = u.id + '/' + id;
            await env.BUCKET.put(key, bytes, { httpMetadata: { contentType: type } });
            try {
                await stmt('INSERT INTO files(id,user_id,name,type,size,key,created) VALUES (?,?,?,?,?,?,?)', id, u.id, maxText(f.name, 200), type, f.size, key, now()).run();
            }
            catch (e) {
                await env.BUCKET.delete(key);
                throw e;
            }
            return response({ id, name: f.name, type, size: f.size, url: '/api/files/' + id }, 201);
        }
        if (method === 'GET' && p[1]) {
            const f=await one('SELECT * FROM files WHERE id=?',p[1]);assert(f,'הקובץ לא נמצא',404);if(u.role!=='admin'&&f.user_id!==u.id){const related=await one("SELECT id FROM articles WHERE user_id=? AND (json_extract(data,'$.image_id')=? OR json_extract(data,'$.document_id')=? OR json_extract(data,'$.secondary_image_id')=?)",u.id,f.id,f.id,f.id);let embedded=false;if(!related){const candidates=await all('SELECT content FROM articles WHERE user_id=? AND instr(content,?)>0',u.id,'src="/api/files/'+f.id+'"');embedded=(await Promise.all(candidates.map(async row=>(await inlineImages(row.content)).some(image=>image.id===f.id)))).some(Boolean);}assert(related||embedded,'אין הרשאה לקובץ',403);}
            const blob = await env.BUCKET.get(f.key);
            assert(blob, 'הקובץ לא נמצא', 404);
            return new Response(blob.body, { headers: { 'Content-Type': f.type, 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'", 'Content-Disposition': (f.type.startsWith('image/') ? 'inline' : 'attachment') + `; filename*=UTF-8''${encodeURIComponent(u.role==='admin'||f.user_id===u.id?f.name:'attachment-'+f.id+(({ 'image/jpeg':'.jpg','image/png':'.png','image/webp':'.webp','image/gif':'.gif','application/pdf':'.pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document':'.docx' } as Row)[f.type]||''))}`, 'Cache-Control': 'private, no-store' } });
        }
        if (method === 'DELETE' && p[1]) {
            const f = owns(u, await one('SELECT * FROM files WHERE id=?', p[1]));
            const referenced = await one('SELECT COUNT(*) AS n FROM articles WHERE data LIKE ? OR instr(content,?)>0', '%' + f.id + '%','src="/api/files/'+f.id+'"');
            assert(!referenced?.n, 'הקובץ משויך לכתבה. הסירו את השיוך לפני המחיקה');
            assert(!(await one("SELECT id FROM orders WHERE json_extract(data,'$.invoice_file_id')=?",f.id)), 'הקובץ משויך לחשבונית הזמנה ולא ניתן למחיקה');
            assert(!(await one("SELECT id FROM orders WHERE EXISTS(SELECT 1 FROM json_each(COALESCE(json_extract(data,'$.invoice_history'),'[]')) h WHERE json_extract(h.value,'$.file_id')=?)",f.id)), 'הקובץ שמור בהיסטוריית מסמכי התשלום');
            assert(!(await one("SELECT id FROM records WHERE kind IN ('wallet_topup','ticket','customer_payment_report') AND json_extract(data,'$.proof_file_id')=?",f.id)), 'הקובץ משויך לבקשה או לדיווח תשלום ולא ניתן למחיקה');
            await env.BUCKET.delete(f.key);
            await stmt('DELETE FROM files WHERE id=?', f.id).run();
            return response({ ok: true });
        }
    }
    if (p[0] === 'image-search' && method === 'GET') {
        const c = await connection('images');
        assert(c.enabled && c.secret, 'יש להגדיר מפתח Pexels בצד הניהול', 503);
        const q = maxText(query.get('query'), 200);
        assert(q, 'יש להזין נושא לחיפוש');
        const res = await externalFetch('https://api.pexels.com/v1/search?per_page=12&query=' + encodeURIComponent(q), { headers: { Authorization: c.secret } });
        assert(res.ok, 'מאגר התמונות דחה את הבקשה', 502);
        const payload: any = await res.json();
        return response({ photos: payload.photos.map((p: Row) => ({ id: p.id, url: p.url, photographer: p.photographer, src: p.src.medium, large: p.src.large })) });
    }
    if (p[0] === 'image-import' && method === 'POST') {
        const c = await connection('images');
        assert(c.enabled && c.secret, 'חיבור התמונות אינו פעיל', 503);
        assert(env.BUCKET, 'האחסון אינו זמין', 503);
        const b = await json(r);
        const id = Number(b.photo_id);
        assert(Number.isSafeInteger(id) && id > 0, 'תמונה לא תקינה');
        const metadata = await externalFetch('https://api.pexels.com/v1/photos/' + id, { headers: { Authorization: c.secret } });
        assert(metadata.ok, 'התמונה לא נמצאה', 404);
        const photo: any = await metadata.json();
        const imageUrl = new URL(photo.src.large);
        assert(imageUrl.hostname === 'images.pexels.com', 'מקור תמונה לא מורשה');
        const res = await externalFetch(imageUrl.href, {});
        assert(res.ok, 'התמונה לא התקבלה', 502);
        assert(Number(res.headers.get('Content-Length') || 0) <= 15 * 1024 * 1024, 'התמונה גדולה מדי');
        const bytes = await res.arrayBuffer();
        assert(bytes.byteLength <= 15 * 1024 * 1024, 'התמונה גדולה מדי');
        const fileId = uid(), key = u.id + '/' + fileId, type = res.headers.get('Content-Type') || 'image/jpeg';
        assert(['image/jpeg', 'image/png', 'image/webp'].includes(type), 'סוג תמונה לא נתמך');
        await env.BUCKET.put(key, bytes, { httpMetadata: { contentType: type } });
        await stmt('INSERT INTO files(id,user_id,name,type,size,key,created) VALUES (?,?,?,?,?,?,?)', fileId, u.id, 'Pexels-' + id + '.jpg', type, bytes.byteLength, key, now()).run();
        await audit(u, fileId, 'נבחרה תמונה מ-Pexels', { photo_id: id, photographer: photo.photographer, url: photo.url });
        return response({ id: fileId, credit: 'צילום: ' + photo.photographer + ' / Pexels', credit_url: photo.url });
    }
    if (p[0] === 'favorites') {
        if (method === 'GET')
            return response({ favorites: await all('SELECT * FROM favorites WHERE user_id=?', u.id) });
        if (method === 'POST') {
            const b = await json(r);
            await website(b.website_id);
            assert(['favorite', 'alert'].includes(b.kind), 'סוג שמירה אינו תקין');
            const e = await one('SELECT id FROM favorites WHERE user_id=? AND website_id=? AND kind=?', u.id, b.website_id, b.kind);
            if (e)
                await stmt('DELETE FROM favorites WHERE id=?', e.id).run();
            else
                await stmt('INSERT INTO favorites(id,user_id,website_id,kind) VALUES (?,?,?,?)', uid(), u.id, b.website_id, b.kind).run();
            return response({ saved: !e });
        }
    }
    if (p[0] === 'records') {
        const kind = p[1];const bundleVersion=kind==='bundle'&&method!=='GET'?await pricingVersion():null;
        assert([...adminKinds, ...ownKinds].includes(kind), 'סוג רשומה אינו נתמך');
        if (adminKinds.includes(kind) && !['GET'].includes(method))
            admin(u);
        if(kind==='customer' && p[2] && p[3]==='articles' && method==='GET'){
            const customer=owns(u,await one('SELECT * FROM records WHERE id=? AND kind=?',p[2],'customer'));
            const articles=await all("SELECT a.*,o.number,o.paid,o.created AS purchased_at,w.name AS website_name,w.url AS website_url,json_extract(w.data,'$.logo_url') AS website_logo FROM articles a JOIN orders o ON o.id=a.order_id JOIN websites w ON w.id=a.website_id WHERE a.user_id=? AND json_extract(a.data,'$.customer_id')=? ORDER BY a.updated DESC",customer.user_id,customer.id);
            return response({articles:articles.map(a=>customerArticle(a,u))});
        }
        if (method === 'GET') {
            const global = adminKinds.includes(kind);
            if (global && !['bundle', 'package', 'announcement'].includes(kind))
                admin(u);
            const scope = u.role === 'admin' && query.get('scope') === 'all';
            return response({ records: (await all(`SELECT r.*,u.name AS user_name FROM records r LEFT JOIN users u ON u.id=r.user_id WHERE kind=? ${kind==='ticket'?"AND NOT (COALESCE(json_extract(r.data,'$.payment_method'),'')='bank_transfer' AND COALESCE(json_extract(r.data,'$.amount_cents'),0)>0)":''} ${global || scope ? '' : 'AND user_id=?'} ORDER BY updated DESC LIMIT 1000`, ...(!global && !scope ? [kind, u.id] : [kind]))).map(row=>global&&u.role!=='admin'?customerSharedRecord(row,kind):parse(row)) });
        }
        if (method === 'POST') {
            let b = await json(r);
            assert(b.name || b.title || b.subject, 'יש להזין שם או כותרת');
            if(kind==='supplier'){
                b.name=String(b.name||'').trim();assert(b.name&&b.name.length<=200,'יש להזין שם ספק תקין');
                b.email=String(b.email||'').trim().toLowerCase();assert(!b.email||/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email)&&b.email.length<=254,'דוא״ל הספק אינו תקין');
                for(const key of ['contact','phone','url','notes'])if(b[key]!==undefined)assert(typeof b[key]==='string'&&b[key].length<=(key==='notes'?6000:1000),'פרט ספק ארוך מדי');
                if(b.url)b.url=httpUrl(b.url);
                if(b.email){const existing=await one("SELECT id FROM records WHERE kind='supplier' AND lower(json_extract(data,'$.email'))=?",b.email);if(existing)return response({id:existing.id,existing:true});}
            }
            if(kind==='ticket')assert(b.payment_method!=='bank_transfer'&&!b.amount_cents,'בקשות הטענה נשלחות דרך הארנק');
            if (kind === 'bundle') b = await normalizeBundle(b);
            const id = uid();
            const write=stmt('INSERT INTO records(id,kind,user_id,data,created,updated) VALUES (?,?,?,?,?,?)', id, kind, u.id, JSON.stringify({ ...b, ...(kind === 'ticket' ? { status: 'open', reply: '' } : {}) }), now(), now());if(bundleVersion!==null)await db().batch([pricingGuard(bundleVersion),write]);else await write.run();
            await audit(u, id, 'נוצרה רשומת ' + kind,kind==='bundle'?{pricing_warning_acknowledged:b.acknowledge===true}:{});
            return response({ id }, 201);
        }
        const item = owns(u, await one('SELECT * FROM records WHERE id=? AND kind=?', p[2], kind));
        if(isTopUp(parse(item)!))assert(method==='GET','יש לטפל בבקשת ההטענה במסך בקשות הטענת יתרה',409);
        if (method === 'PATCH') {
            let b = await json(r);
            if (kind === 'bundle') b = await normalizeBundle(b, JSON.parse(item.data));
            if (kind === 'ticket' && u.role !== 'admin') {
                delete b.reply;
                delete b.status;
            }
            if (kind === 'ticket' && u.role === 'admin') {
                if (b.status !== undefined) assert(['awaiting_reply', 'answered', 'resolved', 'open', 'closed'].includes(b.status), 'סטטוס פנייה לא תקין');
                const nextStatus = b.status ?? JSON.parse(item.data).status;
                const nextReply = b.reply ?? JSON.parse(item.data).reply;
                if (nextStatus === 'answered') assert(String(nextReply || '').trim(), 'יש לכתוב תשובה לפני סימון תשובה התקבלה');
            }
            if(kind==='ticket')for(const key of ['payment_method','amount','amount_cents','reference','proof_file_id','decision','handled_by','handled_at','ledger_id'])delete b[key];
            const write=stmt('UPDATE records SET data=?,updated=? WHERE id=?', JSON.stringify({ ...JSON.parse(item.data), ...b }), now(), item.id);if(bundleVersion!==null)await db().batch([pricingGuard(bundleVersion),write]);else await write.run();
            await audit(u, item.id, 'עודכנה רשומת ' + kind,kind==='bundle'?{pricing_warning_acknowledged:b.acknowledge===true}:{});
            return response({ ok: true });
        }
        if (method === 'DELETE') {
            if (kind === 'supplier') assert(!(await one("SELECT COUNT(*) AS n FROM websites WHERE json_extract(data,'$.supplier_id')=?", item.id))?.n, 'יש להסיר את שיוך האתרים לפני מחיקת הספק', 409);
            const write=stmt('DELETE FROM records WHERE id=?',item.id);if(bundleVersion!==null)await db().batch([pricingGuard(bundleVersion),write]);else await write.run();
            return response({ ok: true });
        }
    }
    if (p[0] === 'credits') {
        if (method === 'GET'){const transactions=await ledgerView(u.id);return response({ balance: u.credits,available:await walletAvailable(u),transactions,usage_history:walletUsageHistory(transactions) });}
        if (method === 'POST') {
            admin(u);
            const b = await json(r);
            const target = await one('SELECT * FROM users WHERE id=?', b.user_id);
            assert(target, 'משתמש לא נמצא');
            const amount = Math.round(Number(b.amount) * 100);
            assert(Number.isSafeInteger(amount) && amount !== 0 && Math.abs(amount) <= 100000000, 'סכום אינו תקין');
            assert(b.reason && b.reference, 'יש להזין סיבה ואסמכתה');
            const ref = 'manual:' + maxText(b.reference, 200);
            const existing = await one('SELECT * FROM ledger WHERE reference=?', ref);
            if (existing) {
                assert(existing.user_id === target.id && existing.amount === amount, 'האסמכתה כבר שימשה לפעולה אחרת', 409);
                return response({ ok: true, duplicate: true });
            }
            assert(amount>=0||await walletAvailable(target)+amount>=0,'היתרה זמינה אינה מספיקה; חלק מהיתרה שמור לתשלום באשראי',409);
            await db().batch([financialGuard(target),stmt('INSERT INTO ledger(id,user_id,amount,reason,reference,created) VALUES (?,?,?,?,?,?)', uid(), target.id, amount, maxText(b.reason, 500), ref, now()),stmt('UPDATE users SET credits=credits+? WHERE id=?',amount,target.id)]);
            await audit(u, target.id, 'תנועת יתרה', { amount, reference: ref });
            return response({ ok: true });
        }
    }
    if (p[0] === 'admin') {
        admin(u);
        if(p[1]==='control-center'){if(method==='POST'&&p[2]==='prices'&&p[3])return response(await reviewPriceChange(p[3],u));assert(method==='GET','פעולה לא נתמכת',405);if(p[2]==='search')return response(await adminLobbySearch(query.get('q')||''));if(p[2]==='prices')return response({prices:(await all("SELECT a.*,w.name AS website_name,w.url AS website_url FROM activity a LEFT JOIN websites w ON w.id=a.resource WHERE json_type(a.data,'$.before_price') IS NOT NULL AND COALESCE(json_extract(a.data,'$.after_price'),json_extract(a.data,'$.price'))<>json_extract(a.data,'$.before_price') AND NOT EXISTS(SELECT 1 FROM records r WHERE r.id='price-reviewed:'||a.id) ORDER BY a.created DESC")).map(parse)});return response(await adminControlCenter());}
        if(p[1]==='sheets')return response(await sheetsAdmin(r,p,u,json));
        if (p[1] === 'users') {
            if (method === 'GET')
                return response({ users: await all("SELECT u.*,COALESCE(m.tier_id,'regular') AS tier_id,COALESCE(c.balance,0) AS monthly_balance,COALESCE(c.credit_limit,0) AS credit_limit,COALESCE(c.enabled,0) AS monthly_enabled,(SELECT COUNT(*) FROM records r JOIN orders po ON po.id=json_extract(r.data,'$.order_id') WHERE r.user_id=u.id AND r.kind='customer_payment_report' AND json_extract(r.data,'$.status')='pending' AND po.paid=0 AND po.status<>'cancelled') AS pending_payment_reports FROM users u LEFT JOIN pricing_members m ON m.user_id=u.id LEFT JOIN credit_accounts c ON c.user_id=u.id ORDER BY u.name") });
            if (method === 'PATCH' && p[2]) {
                const b = await json(r);
                const target = await one('SELECT * FROM users WHERE id=?', p[2]);
                assert(target, 'לקוח לא נמצא', 404);
                assert(['admin', 'customer', 'agency', 'supplier'].includes(b.role), 'תפקיד לא תקין');
                const owner = await one('SELECT value FROM settings WHERE key=?', 'owner_id');
                assert(target.id !== owner?.value || b.role === 'admin', 'אין להסיר את הרשאות בעל המערכת');
                await stmt('UPDATE users SET role=?,name=?,phone=?,company=? WHERE id=?', b.role, maxText(b.name, 100) || target.name, maxText(b.phone, 30), maxText(b.company, 200), target.id).run();
                await audit(u, target.id, 'תפקיד עודכן', { role: b.role });
                return response({ ok: true });
            }
        }
        if(p[1]==='catalog-bulk'&&method==='POST')return response(await saveCatalogBatch(u,await json(r)));
        if(p[1]==='catalog-logo'&&method==='POST'){
            const form=await r.formData(),file=form.get('file');assert(file instanceof File&&file.size>0&&file.size<=5*1024*1024,'יש לבחור תמונת לוגו עד 5MB');
            assert(['image/png','image/jpeg','image/gif','image/webp'].includes(file.type),'ניתן להעלות PNG, JPG, GIF או WEBP בלבד');const bytes=new Uint8Array(await file.arrayBuffer());
            const valid=file.type==='image/png'?bytes.slice(0,8).join(',')==='137,80,78,71,13,10,26,10':file.type==='image/jpeg'?bytes[0]===255&&bytes[1]===216:file.type==='image/gif'?new TextDecoder().decode(bytes.slice(0,3))==='GIF':new TextDecoder().decode(bytes.slice(0,4))==='RIFF'&&new TextDecoder().decode(bytes.slice(8,12))==='WEBP';assert(valid,'תוכן הקובץ אינו תואם לפורמט התמונה');
            assert(env.BUCKET,'שמירת לוגו אינה זמינה',503);const id=uid();await env.BUCKET.put('public/catalog-logos/'+id,bytes,{httpMetadata:{contentType:file.type}});await audit(u,id,'העלאת לוגו לקטלוג');return response({id,url:new URL('/api/catalog-logo/'+id,new URL(r.url).origin).href},201);
        }
        if (p[1] === 'websites') {
            if (method === 'POST' || method === 'PATCH') {
                const input = await json(r);const pv=await pricingVersion();
                const id = p[2] || uid();
                const prev = p[2] ? await one('SELECT * FROM websites WHERE id=?', id) : null;
                assert(!p[2] || prev, 'אתר לא נמצא', 404);
                const prior = prev ? JSON.parse(prev.data) : {};
                const b = { ...prior, ...(prev ? { price_ils: prev.price / 100, active: !!prev.active } : {}), ...input };
                assert(b.name && b.url && b.category, 'שם, כתובת וקטגוריה הם שדות חובה');
                const amount = (value: any) => { const n = Math.round(Number(value) * 100); assert(Number.isSafeInteger(n) && n >= 0 && n <= 100000000, 'יש להזין מחיר תקין ולא שלילי'); return n; };
                const price = amount(b.price_ils);
                const cost = input.cost_ils !== undefined ? input.cost_ils===''?undefined:amount(input.cost_ils) : prior.cost_cents;
                const sale = input.sale_price_ils === '' ? undefined : input.sale_price_ils !== undefined ? amount(input.sale_price_ils) : prior.sale_price_cents;
                if (b.is_on_sale && sale !== undefined) assert(sale < price, 'מחיר המבצע חייב להיות נמוך מהמחיר הרגיל');
                if (b.sale_ends) assert(Number.isFinite(Date.parse(b.sale_ends)), 'תאריך סיום המבצע אינו תקין');
                if(!prev||price!==prev.price||cost!==prior.cost_cents||sale!==prior.sale_price_cents){const meta=await catalogPricingMeta();const warnings=[minimumWarning(b.name,price,cost),...(b.is_on_sale&&sale!=null?[minimumWarning(b.name+' מבצע',sale,cost)]:[])];for(const tier of meta.pricing_tiers){const fixed=meta.pricing_overrides.find(o=>o.owner_id===tier.id&&o.website_id===id);warnings.push(minimumWarning(b.name+' / '+tier.name,fixed?.price??Math.round(price*(10000-tier.discount_bps)/10000),cost));}warnPricing(warnings,input.acknowledge);}
                const supplierId = String(b.supplier_id || '');
                const supplier = supplierId ? parse(await one('SELECT * FROM records WHERE id=? AND kind=?', supplierId, 'supplier')) : null;
                assert(!supplierId || supplier, 'הספק לא נמצא', 404);
                const data = { ...b, name: b.name, url: httpUrl(b.url), category: b.category, price_cents: price, cost_cents: cost, supplier_id: supplierId, supplier_name: supplier?.name || '', dr: Math.max(0, Math.min(100, Number(b.dr) || 0)), is_on_sale: !!b.is_on_sale, sale_price_cents: sale, procurement_verified: !!b.procurement_verified };
                for(const key of Object.keys(data))if(key.startsWith('tier_')||['sent_real','sent_demo','stock_remaining','acknowledge','expected_updated','pricing_version','pricing_hints'].includes(key))delete (data as Row)[key];delete data.data; delete data.cost_ils; delete data.sale_price_ils;
                assert(!prev||!input.expected_updated||input.expected_updated===prev.updated,'האתר עודכן במקביל',409);
                await db().batch([pricingGuard(pv),stmt('INSERT INTO websites(id,name,url,category,price,dr,active,data,updated) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,url=excluded.url,category=excluded.category,price=excluded.price,dr=excluded.dr,active=excluded.active,data=excluded.data,updated=excluded.updated', id, data.name, data.url, data.category, price, data.dr, b.active === false ? 0 : 1, JSON.stringify(data), now())]);
                await audit(u, id, 'אתר עודכן', { name: data.name, price, cost, before_price:prev?.price, before_cost:prior.cost_cents,pricing_warning_acknowledged:input.acknowledge===true });
                return response({ id });
            }
            if (method === 'DELETE' && p[2]) {
                const version=await pricingVersion();await db().batch([pricingGuard(version),stmt('UPDATE websites SET active=0,updated=? WHERE id=?', now(), p[2])]);
                return response({ ok: true });
            }
        }
        if (p[1] === 'coupons') {
            if (method === 'GET')
                return response({ coupons: await all('SELECT * FROM coupons ORDER BY code') });
            const b = method === 'DELETE' ? {} : await json(r);
            if (method === 'DELETE') {
                await stmt('UPDATE coupons SET active=0 WHERE id=?', p[2]).run();
                return response({ ok: true });
            }
            if (method === 'POST' || method === 'PATCH') {
                const id = p[2] || uid();
                assert(/^[A-Z0-9_-]{3,40}$/i.test(b.code || ''), 'קוד הקופון חייב להכיל 3–40 אותיות באנגלית או מספרים');
                const percent = Math.floor(Number(b.percent));
                assert(percent > 0 && percent <= 100, 'הנחה בין 1 ל־100 אחוז');
                await stmt('INSERT INTO coupons(id,code,percent,max_uses,uses,expires,user_email,min_total,active) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET code=excluded.code,percent=excluded.percent,max_uses=excluded.max_uses,expires=excluded.expires,user_email=excluded.user_email,min_total=excluded.min_total,active=excluded.active', id, b.code.toUpperCase(), percent, Math.max(0, Math.floor(Number(b.max_uses) || 0)), 0, b.expires ? (String(b.expires).length === 10 ? b.expires + 'T23:59:59.999Z' : b.expires) : '', (b.user_email || '').toLowerCase(), Math.round((Number(b.min_total_ils) || 0) * 100), b.active === false ? 0 : 1).run();
                await audit(u, id, 'קופון עודכן');
                return response({ id });
            }
        }
        if (p[1] === 'settings') {
            if (method === 'GET') {
                const keys = ['ai', 'wordpress', 'payments', 'email', 'whatsapp', 'images'];
                const connections: Row = {};
                for (const k of keys) {
                    const c = await setting('integration_' + k, {});
                    const gemini=k==='ai'&&c.provider==='gemini',runtime=gemini?geminiEnvironmentConfigured():!!integrationEnvironmentSecret(k,c.provider);
                    const storage=c.secret_storage||(gemini?'environment':runtime?'environment':'encrypted_server');
                    connections[k] = { ...integrationMetadata(k,c),secret_storage:storage,has_secret:storage==='environment'?!!runtime:!!c.secret,has_environment_secret:!!runtime,has_stored_secret:!!c.secret,environment_key:integrationEnvironmentName(k,c.provider) };
                }
                return response({ vat: await setting('vat', 18), brand: await setting('brand', 'פוסטפלואו'), connections });
            }
            if (method === 'PATCH') {
                const b = await json(r);
                if (b.vat !== undefined) {
                    assert(Number(b.vat) >= 0 && Number(b.vat) <= 50, 'אחוז מע״מ אינו תקין');
                    await saveSetting('vat', Number(b.vat));
                }
                if (b.brand)
                    await saveSetting('brand', maxText(b.brand, 100));
                await audit(u, 'settings', 'הגדרות עודכנו');
                return response({ ok: true });
            }
        }
        if (p[1] === 'integration' && p[2]) {
            const key = p[2];
            assert(['ai', 'wordpress', 'payments', 'email', 'whatsapp', 'images'].includes(key), 'חיבור אינו נתמך');
            if(p[3]==='models'){
                assert(key==='ai'&&method==='POST','פעולה אינה נתמכת',405);
                const b=await json(r),prev=await setting('integration_ai',{});
                const storage=b.secret_storage??(prev.provider==='gemini'?prev.secret_storage||'environment':'environment');
                assert(['environment','encrypted_server'].includes(storage),'אופן שמירת מפתח אינו תקין');
                assert(b.secret===undefined||typeof b.secret==='string'&&b.secret.length<=4000,'מפתח API אינו תקין');
                assert(storage==='encrypted_server'||!b.secret,'מפתח Gemini במצב משתנה סביבה מוגדר בסודות האירוח בלבד');
                const secret=storage==='environment'?await geminiServerKey():b.secret?.trim()||(prev.provider==='gemini'&&prev.secret_storage==='encrypted_server'?(await connection('ai')).secret:'');
                assert(secret,'יש להזין או לשמור מפתח Gemini לפני טעינת המודלים');
                return response({models:await availableGeminiModels(secret)});
            }
            if (method === 'PATCH') {
                const b = await json(r);
                const prev = await setting('integration_' + key, {});
                if (key === 'ai' && (b.provider === 'gemini' || (prev.provider === 'gemini' && b.provider === undefined))) {
                    const storage=b.secret_storage??(prev.provider==='gemini'?prev.secret_storage||'environment':'environment');
                    assert(['environment','encrypted_server'].includes(storage),'אופן שמירת מפתח אינו תקין');
                    assert(b.secret===undefined||typeof b.secret==='string'&&b.secret.length<=4000,'מפתח API אינו תקין');
                    assert(storage==='encrypted_server'||!b.secret,'מפתח Gemini במצב משתנה סביבה מוגדר בסודות האירוח בלבד');
                    const model=normalizeGeminiModel(b.model!==undefined?b.model:(prev.provider==='gemini'?prev.model:'')||GEMINI_DEFAULT_MODEL);
                    assert(validGeminiModel(model),GEMINI_MODEL_FORMAT_ERROR);
                    const retained=prev.provider==='gemini'&&prev.secret_storage==='encrypted_server'?prev.secret:'';
                    const secret=storage==='encrypted_server'?(b.clear_secret?'':b.secret?.trim()?await encrypt(b.secret.trim()):retained):'';
                    const value = { enabled: b.clear_secret?false:!!(b.enabled ?? prev.enabled), provider: 'gemini', model,secret_storage:storage,...(secret?{secret}: {}) };
                    assert(!value.enabled||(storage==='environment'?geminiEnvironmentConfigured():!!secret),'יש להגדיר מפתח API לפני הפעלת החיבור');
                    await saveSetting('integration_ai', value);
                    await audit(u, 'integration_ai', 'חיבור עודכן', { enabled: value.enabled });
                    return response({ ok: true });
                }
                const value = await updatedIntegration(key,b,prev);
                await saveSetting('integration_' + key, value);
                await audit(u, 'integration_' + key, 'חיבור עודכן', { enabled: !!value.enabled });
                return response({ ok: true });
            }
            if (p[3] === 'test' && method === 'POST') {
                const c = await connection(key);
                assert(c.secret, 'לא הוגדר מפתח');
                if (key === 'wordpress') {
                    const res = await externalFetch(new URL('/wp-json/wp/v2/users/me', c.url).href, { headers: { Authorization: basicAuth(c.username, c.secret) } });
                    assert(res.ok, 'החיבור נכשל. בדקו כתובת, משתמש וסיסמת אפליקציה', 502);
                    return response({ ok: true });
                }
                if (key === 'ai') {
                    const selectedModel=c.provider==='gemini'?normalizeGeminiModel(c.model||GEMINI_DEFAULT_MODEL):'';
                    if(c.provider==='gemini')assert(validGeminiModel(selectedModel),GEMINI_MODEL_FORMAT_ERROR);
                    const url = c.provider === 'gemini' ? 'https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(selectedModel) : c.provider === 'groq' ? 'https://api.groq.com/openai/v1/models' : c.provider === 'grok' ? 'https://api.x.ai/v1/models' : 'https://api.openai.com/v1/models';
                    const request=c.provider==='gemini'?(url:string,init:RequestInit)=>geminiRequest(url,init,externalFetch):externalFetch;
                    const res = await request(url, c.provider === 'gemini' ? { headers: { 'x-goog-api-key': c.secret } } : { headers: { Authorization: 'Bearer ' + c.secret } });
                    assert(res.ok, c.provider==='gemini'?geminiModelFailure(res.status):'המפתח לא אומת', 502);
                    if(c.provider==='gemini'){const modelInfo:any=await res.json();assert(modelInfo.supportedGenerationMethods?.includes('generateContent'),'מודל Gemini שנבחר אינו תומך בכתיבת תוכן',502);}
                    return response({ ok: true });
                }
                if (key === 'images') {
                    const res = await externalFetch('https://api.pexels.com/v1/curated?per_page=1', { headers: { Authorization: c.secret } });
                    assert(res.ok, 'מפתח Pexels לא אומת', 502);
                    return response({ ok: true });
                }
                assert(c.url, 'לא הוגדרה כתובת webhook');
                const res = await externalFetch(c.url, { method: 'POST', headers: { Authorization: 'Bearer ' + c.secret, 'Content-Type': 'application/json' }, body: JSON.stringify({ event: 'connection_test', sent_at: now() }) });
                assert(res.ok, 'החיבור נכשל', 502);
                return response({ ok: true });
            }
        }
        if (p[1] === 'reports' && method === 'GET') {
            const totals = await one("SELECT COUNT(*) AS count,COALESCE(SUM(CASE WHEN paid=1 AND status<>'cancelled' THEN total ELSE 0 END),0) AS revenue,SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) AS pending FROM orders");
            const statuses = await all('SELECT status,COUNT(*) AS count FROM articles GROUP BY status');
            const bySite = await all("SELECT w.name,COUNT(*) AS count,SUM(CAST(json_extract(a.data,'$.paid_amount') AS INTEGER)) AS total FROM articles a JOIN websites w ON w.id=a.website_id JOIN orders o ON o.id=a.order_id WHERE o.paid=1 GROUP BY w.id ORDER BY count DESC LIMIT 15");
            const byMonth = await all("SELECT substr(created,1,7) AS month,COUNT(*) AS count,SUM(total) AS total FROM orders WHERE paid=1 AND status<>'cancelled' GROUP BY month ORDER BY month");
            return response({ totals, statuses, bySite, byMonth, customers: await one('SELECT COUNT(*) AS n FROM users'), websites: await one('SELECT COUNT(*) AS n FROM websites') });
        }
        if (p[1] === 'activity' && method === 'GET')
            return response({ activity: await all('SELECT a.*,u.name AS actor FROM activity a JOIN users u ON u.id=a.user_id ORDER BY created DESC LIMIT 400') });
        if (p[1] === 'jobs') {
            if (method === 'GET')
                return response({ jobs: (await all('SELECT * FROM jobs ORDER BY created DESC LIMIT 400')).map(parse) });
            if (p[2] && p[3] === 'dispatch' && method === 'POST') {
                const job = await one('SELECT * FROM jobs WHERE id=?', p[2]);
                assert(job && job.status === 'requested', 'הפעולה אינה ממתינה לשליחה');
                const b = await json(r);
                assert(['email', 'whatsapp', 'payments'].includes(b.channel), 'ערוץ לא נתמך');
                const c = await connection(b.channel);
                assert(c.enabled && c.url && c.secret, 'החיבור אינו מוגדר', 503);
                const result = await stmt("UPDATE jobs SET status='writing',updated=? WHERE id=? AND status='requested'", now(), job.id).run();
                assert(result.meta.changes, 'הפעולה כבר נשלחה', 409);
                try {
                    const res = await externalFetch(c.url, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + c.secret, 'Idempotency-Key': job.id }, body: JSON.stringify({ event: job.kind, data: JSON.parse(job.data), event_id: job.id }) });
                    assert(res.ok, 'הספק דחה את הבקשה', 502);
                    await stmt("UPDATE jobs SET status='succeeded',updated=? WHERE id=?", now(), job.id).run();
                    return response({ ok: true });
                }
                catch (e) {
                    await stmt("UPDATE jobs SET status='failed',updated=? WHERE id=?", now(), job.id).run();
                    throw e;
                }
            }
        }
    }
    if (p[0] === 'api-keys') {
        if (method === 'GET')
            return response({ keys: await all('SELECT id,kind,resource,expires,used FROM tokens WHERE user_id=? AND kind=?', u.id, 'api') });
        if (method === 'POST') {
            const b = await json(r);
            const raw = 'pf_' + uid().replaceAll('-', '') + uid().replaceAll('-', '');
            const id = uid();
            await stmt('INSERT INTO tokens(id,hash,kind,user_id,resource,expires,used) VALUES (?,?,?,?,?,?,?)', id, await hash(raw), 'api', u.id, maxText(b.name, 100) || 'API', new Date(Date.now() + 365 * 86400000).toISOString(), 0).run();
            return response({ id, key: raw });
        }
        if (method === 'DELETE' && p[1]) {
            owns(u, await one('SELECT * FROM tokens WHERE id=?', p[1]));
            await stmt('UPDATE tokens SET used=1 WHERE id=?', p[1]).run();
            return response({ ok: true });
        }
    }
    if (p[0] === 'strategy-generate' && method === 'POST') {
        const b = await json(r);
        assert(b.brand && b.topic, 'יש להזין מותג ותחום');
        const c = await connection('ai');
        assert(c.enabled && c.secret, 'יש להגדיר חיבור AI בצד הניהול', 503);
        await claimAiBudget(u,'strategy');
        const { raw } = await aiJson(c, `הכן אסטרטגיית תוכן בעברית למותג ${maxText(b.brand, 200)} בתחום ${maxText(b.topic, 500)}. קהל ${maxText(b.audience, 500)}. תקציב ${Number(b.budget) || 0} ש״ח. החזר JSON עם title, goals, articles (רשימה של topic, keywords, audience, category). אין להמציא אתרים או מחירים. 6 נושאי כתבות.`);
        let output: Row;
        try {
            output = JSON.parse(raw.replace(/^```json\s*|```$/g, ''));
        }
        catch {
            throw new ApiError(502, 'תשובת AI לא תקינה');
        }
        const id = uid();
        await stmt('INSERT INTO records(id,kind,user_id,data,created,updated) VALUES (?,?,?,?,?,?)', id, 'strategy', u.id, JSON.stringify({ ...b, ...output, name: output.title || b.brand }), now(), now()).run();
        return response({ id, ...output });
    }
    throw new ApiError(404, 'הפעולה לא נמצאה');
}
async function routeResult(r: Request,access:ResponseAccess) { try {
    return await handle(r,access);
}
catch (e) {
    if(e instanceof GeminiRequestError)return response({error:e.message},502);
    if (e instanceof ApiError)
        return response({ error: e.message, warnings:(e as any).warnings }, e.status);
    const message = (e as Error).message || '';
    // Exception messages and paths can contain provider keys, SQL or supplier tokens.
    console.error('API failure', {code:'UNEXPECTED_SERVER_ERROR',method:r.method});
    if(/users.credit_guard|articles.version|orders.idempotency|monthly_charges.amount|records.data/.test(message))return response({error:'הנתונים השתנו במקביל. רעננו לפני ניסיון נוסף; הפעולה לא בוצעה'},409);
    if(message.includes('pricing_state.version'))return response({error:'המחירים השתנו במקביל. רעננו ואשרו שוב; לא בוצע חיוב'},409);
    if(message.includes('monthly_balance_limit'))return response({error:'החריגה ממסגרת החשבון החודשי חסמה את ההזמנה'},409);
    if (message.includes('insufficient_credits')||message.includes('users_nonnegative'))
        return response({ error: 'אין יתרה מספקת. הסל נשמר ולא בוצע חיוב.' }, 409);
    if (message.includes('coupon_exhausted')||message.includes('coupons_usage_limit'))
        return response({ error: 'הקופון נוצל במלואו. נסו שוב ללא קופון.' }, 409);
    if (message.includes('UNIQUE constraint'))
        return response({ error: 'הרשומה כבר קיימת. רעננו את הנתונים לפני ניסיון נוסף.' }, 409);
    return response({ error: 'הפעולה לא הושלמה. המידע שהזנתם נשמר בטופס, אפשר לנסות שוב.' }, 503);
} }
async function route(r:Request){const access={privileged:false};const result=await routeResult(r,access);try{return await protectCustomerResponse(result,access.privileged);}catch{return response({error:'המידע אינו זמין כרגע. נסו שוב מאוחר יותר.'},503);}}
export const GET = route, POST = route, PATCH = route, DELETE = route;
