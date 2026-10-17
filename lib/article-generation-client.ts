'use client';
import {toast} from 'sonner';

type Generation={status:'writing'|'succeeded'|'failed';error?:string};
const running=new Map<string,Promise<void>>(),states=new Map<string,Generation>();
export const getArticleGeneration=(id:string)=>states.get(id);
export const articleGenerationPending=(id:string)=>running.has(id);
function announce(id:string,state:Generation){
    states.set(id,state);
    if(states.size>100)for(const old of states.keys())if(!running.has(old)&&old!==id){states.delete(old);break;}
    if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent('megalinks:ai-generation',{detail:{id,...state}}));
}
// Module ownership keeps this request/reader alive when its editor unmounts during SPA navigation.
export function startArticleGeneration(id:string):Promise<void>{
    const existing=running.get(id);if(existing)return existing;
    let accept!:()=>void,reject!:(error:Error)=>void;
    const accepted=new Promise<void>((resolve,fail)=>{accept=resolve;reject=fail;});
    running.set(id,accepted);
    void(async()=>{
        let started=false,finished=false;
        const packet=(value:any)=>{
            if(value.status==='writing'){if(!started){started=true;announce(id,{status:'writing'});accept();}}
            else if(value.status==='succeeded'){if(!started)throw new Error('לא התקבל אישור להתחלת הכנת המאמר.');finished=true;running.delete(id);announce(id,{status:'succeeded'});toast.success('מאמר ה־AI מוכן ונשמר במאמר שביקשת. אפשר לחזור ולערוך אותו.');}
            else if(value.status==='failed'){finished=true;throw new Error(value.error||'הכנת המאמר נכשלה. אפשר לנסות שוב.');}
        };
        try{
            const res=await fetch('/api/articles/'+encodeURIComponent(id)+'/generate?background=1',{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json'},body:'{}'});
            if(!res.ok){const data:any=await res.json().catch(()=>({}));throw new Error(data.error||'לא ניתן להתחיל את הכנת המאמר.');}
            if(!res.body||!res.headers.get('content-type')?.includes('application/x-ndjson'))throw new Error('לא התקבל אישור להתחלת הכנת המאמר. רעננו ונסו שוב.');
            const reader=res.body.getReader(),decoder=new TextDecoder();let buffer='';
            try{while(true){const chunk=await reader.read();buffer+=decoder.decode(chunk.value,{stream:!chunk.done});let end;while((end=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,end).trim();buffer=buffer.slice(end+1);if(line)packet(JSON.parse(line));}if(chunk.done)break;}if(buffer.trim())packet(JSON.parse(buffer));}
            finally{reader.releaseLock();}
            if(!finished)throw new Error('המעקב אחר ההכנה נותק. חזרו למאמר לבדיקת המצב.');
        }catch(e){const error=e instanceof Error?e:new Error('הכנת המאמר נכשלה.');running.delete(id);announce(id,{status:'failed',error:error.message});if(!started)reject(error);else toast.error(error.message);}
        finally{running.delete(id);}
    })();
    return accepted;
}
