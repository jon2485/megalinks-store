import type {Row} from './shared';
import {ApiError,stmt,now} from './server';

export function safeFailure(error:unknown,fallback='השירות אינו זמין כרגע. נסו שוב מאוחר יותר.') {
    return error instanceof ApiError?error.message:fallback;
}
// A database claim remains atomic across Worker instances and concurrent calls.
export async function claimAiBudget(user:Row,kind:'article'|'strategy') {
    const limit=user.role==='admin'?100:kind==='article'?20:5;
    const id='security:ai:'+kind+':'+user.id+':'+Math.floor(Date.now()/3600000),stamp=now();
    const claim=await stmt(`INSERT INTO records(id,kind,user_id,data,created,updated) VALUES (?,'security_rate',?,'{"count":1}',?,?)
        ON CONFLICT(id) DO UPDATE SET data=json_set(records.data,'$.count',json_extract(records.data,'$.count')+1),updated=excluded.updated
        WHERE json_extract(records.data,'$.count')<? RETURNING id`,id,user.id,stamp,stamp,limit).first();
    if(!claim)throw new ApiError(429,'הגעתם למגבלת יצירת התוכן לשעה זו. אפשר לנסות שוב בשעה הבאה.');
    await stmt("DELETE FROM records WHERE kind='security_rate' AND created<?",new Date(Date.now()-86400000).toISOString()).run();
}
