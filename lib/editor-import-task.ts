// The deadline belongs to this import, not to unrelated page requests. A late
// upload must never replace a newer draft after the import has been cancelled.
export async function editorImportTask<T>(task:(signal:AbortSignal)=>Promise<T>,timeoutMs=45000):Promise<T>{
 const controller=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined;
 const timeout=new Promise<never>((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new Error('ייבוא המסמך התעכב. התוכן הקיים נשמר בעורך; אפשר לנסות שוב.'));},timeoutMs);});
 try{return await Promise.race([task(controller.signal),timeout]);}
 finally{clearTimeout(timer);controller.abort();}
}
