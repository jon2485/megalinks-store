import {actor,admin,ApiError} from '@/lib/server';
import {closeMonth,monthlyRows,businessMonth} from '@/lib/monthly';
export const dynamic='force-dynamic';
const tools=[{name:'monthly_billing_summary',description:'Read monthly credit billing summaries for the site owner or administrator. No changes.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,destructiveHint:false}},{name:'close_previous_billing_month',description:'Generate the previous completed calendar month customer credit statements and queue/send their emails. Idempotent by customer, month and demo mode. Requires site administrator. Demo emails are never sent externally.',inputSchema:{type:'object',properties:{month:{type:'string',description:'Optional YYYY-MM. Defaults to previous month in Europe/Bucharest.'}},additionalProperties:false},annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:true}}];
export async function POST(request:Request){let body:any;try{const raw=await request.text();if(raw.length>20000)return new Response('Request too large',{status:413});body=JSON.parse(raw);}catch{return Response.json({jsonrpc:'2.0',id:null,error:{code:-32700,message:'Parse error'}});}
 if(!body||typeof body!=='object'||Array.isArray(body))return Response.json({jsonrpc:'2.0',id:null,error:{code:-32600,message:'Invalid request'}});
 const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)return Response.json({error:'Origin not permitted'},{status:403});
 const id=body.id??null;const reply=(result:any)=>Response.json({jsonrpc:'2.0',id,result});
 if(body.method==='initialize')return reply({protocolVersion:'2024-11-05',capabilities:{tools:{}},serverInfo:{name:'postflow-billing',version:'1.0.0'}});
 if(body.method==='notifications/initialized')return new Response(null,{status:202});
 if(body.method==='ping')return reply({});
 if(body.method==='tools/list')return reply({tools});
 if(body.method!=='tools/call')return Response.json({jsonrpc:'2.0',id,error:{code:-32601,message:'Method not found'}});
 try{const u=await actor();admin(u);let result:any;if(body.params?.name==='monthly_billing_summary')result={rows:await monthlyRows(u)};else if(body.params?.name==='close_previous_billing_month'){const current=businessMonth();const [year,month]=current.split('-').map(Number);const prev=new Date(Date.UTC(year,month-2,15)).toISOString().slice(0,7);result=await closeMonth(body.params.arguments?.month||prev,new URL(request.url).origin);}else return Response.json({jsonrpc:'2.0',id,error:{code:-32602,message:'Unknown tool'}});return reply({content:[{type:'text',text:JSON.stringify(result)}]});}
 catch(e){if(e instanceof ApiError&&[401,403].includes(e.status))return Response.json({error:e.message},{status:e.status});return reply({isError:true,content:[{type:'text',text:e instanceof ApiError?e.message:'The operation could not be completed. Please try again later.'}]});}
}
export async function GET(){return new Response(null,{status:405,headers:{Allow:'POST'}});}
