// Enforce limits on bytes actually received, including chunked requests that
// omit Content-Length. Do this before formData()/json() allocates a full body.
export async function boundedRequest(request:Request):Promise<Request|null> {
    if(!request.body)return request;
    const path=new URL(request.url).pathname;
    const limit=path==='/mcp'?20000:path==='/api/sheets-sync/push'?5000000:
        path==='/api/files'?17*1024*1024:path==='/api/admin/catalog-logo'?6*1024*1024:500000;
    if(Number(request.headers.get('content-length')||0)>limit){await request.body.cancel();return null;}
    const reader=request.body.getReader(),chunks:Uint8Array[]=[];let size=0;
    while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel();return null;}chunks.push(value);}
    const body=new Uint8Array(size);let offset=0;for(const chunk of chunks){body.set(chunk,offset);offset+=chunk.byteLength;}
    return new Request(request,{body});
}
