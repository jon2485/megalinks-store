import Anthropic from '@anthropic-ai/sdk';
import {ApiError} from './server';
import {ANTHROPIC_FALLBACK_MODELS} from './anthropic-model';

// Every call goes through the project's outbound guard (externalFetch), passed in by the caller.
export type OutboundFetch=(url:string,init:RequestInit,timeoutMs?:number)=>Promise<Response>;
// An article job is treated as stale after 120 seconds, so one attempt with no SDK retries.
const REQUEST_TIMEOUT_MS=110000;
const JSON_ONLY='\n\nReply with one valid JSON object only, with no text before or after it and no Markdown fences.';
const BUSY='Claude עמוס כרגע או שהגעתם למגבלת השימוש. התוכן הקיים נשמר. נסו שוב בעוד כמה דקות.';

export function anthropicClient(apiKey:string,request:OutboundFetch){
    return new Anthropic({
        apiKey,baseURL:'https://api.anthropic.com',maxRetries:0,timeout:REQUEST_TIMEOUT_MS+5000,openTelemetry:false,
        fetch:(input,init)=>request(typeof input==='string'?input:input instanceof URL?input.href:input.url,init||{},REQUEST_TIMEOUT_MS)
    });
}
// Short Hebrew messages only. Anthropic's own error text is never passed on: it may quote the request.
export function anthropicFailure(error:unknown):ApiError{
    if(error instanceof ApiError)return error;
    if(error instanceof Anthropic.APIConnectionError)return (error as any).cause instanceof ApiError?(error as any).cause:new ApiError(502,'החיבור ל-Claude נקטע או שזמן ההמתנה הסתיים. התוכן הקיים נשמר. אפשר לנסות שוב.');
    if(error instanceof Anthropic.AuthenticationError)return new ApiError(502,'מפתח Claude לא אומת. בדקו את המפתח בהגדרת החיבור.');
    if(error instanceof Anthropic.PermissionDeniedError)return new ApiError(502,'למפתח Claude אין הרשאה למודל שנבחר.');
    if(error instanceof Anthropic.NotFoundError)return new ApiError(502,'המודל שנבחר לא נמצא ב-Claude. בחרו מודל אחר בהגדרת החיבור.');
    if(error instanceof Anthropic.RateLimitError)return new ApiError(502,BUSY);
    if(error instanceof Anthropic.APIError&&Number(error.status)>=500)return new ApiError(502,Number(error.status)===529?BUSY:'שירות Claude אינו זמין כרגע. התוכן הקיים נשמר. נסו שוב בעוד כמה דקות.');
    return new ApiError(502,'שירות ה-AI דחה את הבקשה. בדקו מפתח, מודל ויתרה');
}
// Callers JSON.parse the result, so keep only the outer JSON object.
export function jsonObjectText(text:string){
    const clean=text.trim().replace(/^```(?:json)?\s*|\s*```$/g,'').trim();
    const start=clean.indexOf('{'),end=clean.lastIndexOf('}');
    return start>=0&&end>start?clean.slice(start,end+1):clean;
}
type Reply={stop_reason?:string|null;content:Array<{type:string;text?:string}>};
export async function anthropicJson(apiKey:string,model:string,prompt:string,request:OutboundFetch):Promise<string>{
    const client=anthropicClient(apiKey,request);
    const body={model,max_tokens:16000,messages:[{role:'user' as const,content:prompt+JSON_ONLY}],output_config:{effort:'medium' as const}};
    let reply:Reply;
    try{
        // Opus and Sonnet: if the model declines, the API retries on its default fallback model in the same call.
        reply=ANTHROPIC_FALLBACK_MODELS.includes(model)
            ?await client.beta.messages.create({...body,betas:['server-side-fallback-2026-07-01'],fallbacks:'default'})
            :await client.messages.create(body);
    }catch(error){throw anthropicFailure(error);}
    if(reply.stop_reason==='refusal')throw new ApiError(502,'Claude סירב לכתוב את התוכן הזה. נסו לנסח את הבקשה אחרת.');
    if(reply.stop_reason==='max_tokens')throw new ApiError(502,'תשובת Claude נקטעה כי הייתה ארוכה מדי. נסו לבקש פחות מילים.');
    const text=reply.content.map(block=>block.type==='text'?block.text||'':'').join('').trim();
    if(!text)throw new ApiError(502,'לא התקבל תוכן משירות ה-AI');
    return jsonObjectText(text);
}
// The connection test: checks the key and the chosen model without spending tokens.
export async function anthropicModelCheck(apiKey:string,model:string,request:OutboundFetch){
    try{await anthropicClient(apiKey,request).models.retrieve(model);}catch(error){throw anthropicFailure(error);}
}
