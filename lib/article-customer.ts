import type {Row} from './shared';
import {assert,all,one,stmt,db,now,audit,hash} from './server';
import {customerInput,customerErrors} from './customer-fields';

// A separate metadata record prevents content autosaves, writer versions and publication
// callbacks from overwriting an assignment. Missing links fall back to the checkout brief.
export const articleCustomerJoins = `LEFT JOIN records article_customer_link ON article_customer_link.id='article-customer:'||a.id AND article_customer_link.kind='article_customer_assignment' AND article_customer_link.user_id=a.user_id
 LEFT JOIN records assigned_customer ON assigned_customer.id=CASE WHEN article_customer_link.id IS NULL THEN json_extract(a.data,'$.customer_id') ELSE json_extract(article_customer_link.data,'$.customer_id') END AND assigned_customer.kind='customer' AND assigned_customer.user_id=a.user_id`;
export const articleCustomerColumns = `COALESCE(assigned_customer.id,'') AS assigned_customer_id,json_extract(assigned_customer.data,'$.name') AS customer_name,COALESCE(json_extract(article_customer_link.data,'$.version'),0) AS assignment_version`;

export async function articleCustomerList(user:Row) {
    const rows=await all("SELECT id,json_extract(data,'$.name') AS name,json_extract(data,'$.company') AS company FROM records WHERE kind='customer' AND user_id=? ORDER BY json_extract(data,'$.name'),id",user.id);
    return {customers:rows};
}

export async function assignArticleCustomer(article:Row,user:Row,body:Row) {
    assert(article.user_id===user.id,'ניתן לשייך רק את הכתבות בחשבון שלך',403);
    assert(Number.isSafeInteger(body.assignment_version)&&body.assignment_version>=0,'יש לרענן את רשימת הכתבות לפני השיוך',409);
    assert(typeof body.request_id==='string'&&/^[a-zA-Z0-9-]{20,80}$/.test(body.request_id),'מזהה בקשה אינו תקין');
    const fresh=body.new_customer!==undefined;
    assert(!fresh||body.new_customer&&typeof body.new_customer==='object'&&!Array.isArray(body.new_customer),'פרטי לקוח אינם תקינים');
    assert(!(fresh&&body.customer_id),'יש לבחור לקוח קיים או להוסיף לקוח חדש');
    const values=fresh?customerInput(body.new_customer):null;
    if(values){const errors=customerErrors(values);assert(!Object.keys(errors).length,Object.values(errors)[0]);}
    const customerId=fresh?'customer-'+(await hash(user.id+':'+article.id+':'+body.request_id)).slice(0,40):String(body.customer_id||'');
    const id='article-customer:'+article.id,stamp=now();
    const fingerprint=JSON.stringify(values||{customer_id:customerId});
    const previous=await one("SELECT * FROM records WHERE id=? AND kind='article_customer_assignment' AND user_id=?",id,user.id);
    const prior=previous?JSON.parse(previous.data):null;
    if(prior?.request_id===body.request_id){
        assert(prior.fingerprint===fingerprint,'הבקשה כבר נשמרה עם פרטים אחרים. רעננו לפני שינוי נוסף',409);
        return {ok:true,customer_id:prior.customer_id,assignment_version:prior.version,repeated:true};
    }
    if(!fresh&&customerId)assert(await one("SELECT id FROM records WHERE id=? AND kind='customer' AND user_id=?",customerId,user.id),'הלקוח אינו ברשימת הלקוחות שלך',403);
    assert(Number(prior?.version||0)===body.assignment_version,'השיוך השתנה במקביל. רעננו ובחרו שוב',409);
    const data=JSON.stringify({customer_id:customerId,version:body.assignment_version+1,request_id:body.request_id,fingerprint});
    const writes=[];
    // Both writes are one D1 transaction. A stale request creates neither a link nor a customer.
    if(values)writes.push(stmt(`INSERT INTO records(id,kind,user_id,data,created,updated)
      SELECT ?,'customer',?,?,?,? WHERE COALESCE((SELECT json_extract(data,'$.version') FROM records WHERE id=? AND kind='article_customer_assignment' AND user_id=?),0)=?
      ON CONFLICT(id) DO NOTHING`,customerId,user.id,JSON.stringify(values),stamp,stamp,id,user.id,body.assignment_version));
    writes.push(stmt(`INSERT INTO records(id,kind,user_id,data,created,updated)
      SELECT ?,'article_customer_assignment',?,?,?,? WHERE COALESCE((SELECT json_extract(data,'$.version') FROM records WHERE id=? AND kind='article_customer_assignment' AND user_id=?),0)=?
      AND (?='' OR EXISTS(SELECT 1 FROM records WHERE id=? AND kind='customer' AND user_id=?))
      ON CONFLICT(id) DO UPDATE SET data=excluded.data,updated=excluded.updated WHERE records.user_id=excluded.user_id AND records.kind='article_customer_assignment' AND json_extract(records.data,'$.version')=?`,id,user.id,data,stamp,stamp,id,user.id,body.assignment_version,customerId,customerId,user.id,body.assignment_version));
    const results=await db().batch(writes);
    assert(results.at(-1)?.meta.changes===1,'השיוך השתנה במקביל. רעננו ובחרו שוב',409);
    await audit(user,article.id,'שיוך הכתבה ללקוח עודכן',{customer_id:customerId,created_customer:fresh});
    return {ok:true,customer_id:customerId,assignment_version:body.assignment_version+1};
}
