import {geminiModelFailure} from './gemini-model';

export type GeminiDiagnostic = {http_status:number;provider_status?:string;attempt:number};
export class GeminiRequestError extends Error {
    constructor(message:string,public diagnostic:GeminiDiagnostic){super(message);this.name='GeminiRequestError';}
}
const statuses=new Set(['INVALID_ARGUMENT','UNAUTHENTICATED','PERMISSION_DENIED','NOT_FOUND','RESOURCE_EXHAUSTED','INTERNAL','UNAVAILABLE','DEADLINE_EXCEEDED','FAILED_PRECONDITION']);
const transient=new Set([408,500,502,503,504]);

// Never retain Google's free-form message: it may contain credentials or user text.
export async function geminiRequest(
    url:string,init:RequestInit,
    request:(url:string,init:RequestInit)=>Promise<Response>,
    pause:(ms:number)=>Promise<void>=ms=>new Promise(resolve=>setTimeout(resolve,ms)),
    report:(diagnostic:GeminiDiagnostic)=>void=diagnostic=>console.warn('Gemini request failed',JSON.stringify(diagnostic))
):Promise<Response>{
    for(let attempt=1;attempt<=2;attempt++){
        let res:Response;
        try{res=await request(url,init);}
        catch{
            // A lost response may already have been billed; don't blindly resubmit it.
            const diagnostic={http_status:0,provider_status:'CONNECTION_INTERRUPTED',attempt};
            report(diagnostic);
            throw new GeminiRequestError('החיבור ל־Gemini נקטע או שזמן ההמתנה הסתיים. התוכן הקיים נשמר. אפשר לנסות שוב.',diagnostic);
        }
        if(res.ok)return res;
        const body:any=await res.json().catch(()=>null);
        const diagnostic:GeminiDiagnostic={http_status:res.status,attempt,...(statuses.has(body?.error?.status)?{provider_status:body.error.status}: {})};
        report(diagnostic);
        if(attempt<2&&transient.has(res.status)){
            // Two bounded attempts stay below the article job's 120-second expiry.
            const retryAfter=Number(res.headers.get('retry-after'));
            if(Number.isFinite(retryAfter)&&retryAfter>10)throw new GeminiRequestError(geminiModelFailure(res.status),diagnostic);
            await pause(Math.max(1000,Number.isFinite(retryAfter)?retryAfter*1000:0));
            continue;
        }
        throw new GeminiRequestError(geminiModelFailure(res.status),diagnostic);
    }
    throw new Error('Unreachable Gemini retry state');
}
