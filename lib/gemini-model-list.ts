import {assert,externalFetch} from './server';
import {geminiModelFailure,normalizeGeminiModel,validGeminiModel} from './gemini-model';
import {geminiRequest} from './gemini-request';

export async function availableGeminiModels(secret:string):Promise<string[]> {
    const ids=new Set<string>(),seenPages=new Set<string>();
    let pageToken='';
    for(let page=0;page<10;page++) {
        const url=new URL('https://generativelanguage.googleapis.com/v1beta/models');
        url.searchParams.set('pageSize','100');
        if(pageToken)url.searchParams.set('pageToken',pageToken);
        const res=await geminiRequest(url.href,{headers:{'x-goog-api-key':secret}},externalFetch);
        assert(res.ok,geminiModelFailure(res.status),502);
        const body:any=await res.json().catch(()=>null);
        assert(body&&typeof body==='object'&&(body.models===undefined||Array.isArray(body.models)),'Google החזירה רשימת מודלים לא תקינה. נסו שוב.',502);
        for(const model of body.models||[]) {
            const id=normalizeGeminiModel(model?.name);
            if(id.startsWith('gemini-')&&validGeminiModel(id)&&Array.isArray(model?.supportedGenerationMethods)&&model.supportedGenerationMethods.includes('generateContent')&&!/-(image|tts|audio|live)(?:-|$)/i.test(id))ids.add(id);
        }
        if(!body.nextPageToken)return [...ids].sort();
        assert(typeof body.nextPageToken==='string'&&body.nextPageToken.length<=2000&&!seenPages.has(body.nextPageToken),'לא ניתן להשלים את רשימת המודלים. נסו שוב.',502);
        pageToken=body.nextPageToken;seenPages.add(pageToken);
    }
    assert(false,'לא ניתן להשלים את רשימת המודלים. נסו שוב.',502);
    return [];
}
