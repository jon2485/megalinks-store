import {one} from './server';
import {waitUntil} from 'cloudflare:workers';

const GENERATION_TIMEOUT_MS=120000;
export async function articleGenerationStatus(articleId:string){
    const row=await one("SELECT id,status,data,created,updated FROM jobs WHERE kind='ai_generation' AND json_extract(data,'$.article_id')=? ORDER BY created DESC,rowid DESC LIMIT 1",articleId);
    if(!row)return null;
    const stale=row.status==='writing'&&Date.now()-Date.parse(row.updated)>GENERATION_TIMEOUT_MS;
    const data=JSON.parse(row.data);
    return {id:row.id,status:stale?'failed':row.status,started:row.created,error:stale?'הכנת המאמר לא הושלמה. אפשר לנסות שוב.':row.status==='failed'?String(data.error||'הכנת המאמר נכשלה. אפשר לנסות שוב.'):'',stale};
}
// The response stays open while generation runs. SPA navigation leaves its reader alive.
// Do not replace this with fire-and-forget work after an early HTTP response.
export function articleGenerationStream(job:string,execute:()=>Promise<void>,heartbeatMs=10000){
    const encoder=new TextEncoder();
    let disconnected=false,timer:ReturnType<typeof setInterval>|undefined;
    const body=new ReadableStream<Uint8Array>({async start(controller){
        const send=(value:unknown)=>{if(!disconnected)try{controller.enqueue(encoder.encode(JSON.stringify(value)+'\n'));}catch{disconnected=true;}};
        send({status:'writing',job});
        timer=setInterval(()=>send({status:'heartbeat',job}),heartbeatMs);
        const work=(async()=>{try{await execute();send({status:'succeeded',job});}
        catch(e){try{send({status:'failed',job,error:(e as Error).message});}catch{/* A disconnected reader can inspect persisted job status on return. */}}
        finally{clearInterval(timer);try{controller.close();}catch{/* Reader disconnected. */}}})();
        // Keep the stream open; waitUntil additionally gives disconnects a bounded grace period.
        waitUntil(work);
        await work;
    },cancel(){disconnected=true;clearInterval(timer);}});
    return new Response(body,{headers:{'Content-Type':'application/x-ndjson; charset=utf-8','Cache-Control':'no-store, no-transform','X-Content-Type-Options':'nosniff'}});
}
