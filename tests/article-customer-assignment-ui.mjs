import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdirSync,readFileSync,realpathSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const require=createRequire(realpathSync('node_modules/wrangler')+'/package.json'),{build}=require('esbuild');
const result=await build({entryPoints:['app/article-customer-assignment.tsx'],bundle:true,platform:'node',format:'esm',jsx:'automatic',external:['react/jsx-runtime','react-dom','react-dom/server'],write:false,banner:{js:"import {createRequire as __createRequire} from 'node:module';const require=__createRequire(import.meta.url);"},plugins:[{name:'fixtures',setup(b){
 b.onResolve({filter:/^react$/},()=>({path:'hooks',namespace:'fixture'}));b.onResolve({filter:/^react-real$/},()=>({path:realpathSync('node_modules/react/index.js'),external:true}));b.onResolve({filter:/^@\/lib\/client$/},()=>({path:'client',namespace:'fixture'}));
 b.onLoad({filter:/.*/,namespace:'fixture'},a=>({loader:'js',contents:a.path==='hooks'?`export * from 'react-real';export {default} from 'react-real';export const useState=v=>globalThis.hooks.state(v);export const useRef=v=>globalThis.hooks.ref(v);export const useEffect=()=>{};`:`export const api=(...args)=>globalThis.actionApi(...args);export const useData=()=>globalThis.fixture;`}));
}}]});
mkdirSync('.sites-runtime',{recursive:true});const file='.sites-runtime/article-customer-ui.mjs';writeFileSync(file,result.outputFiles[0].text);const {default:Control,ArticleCustomerForm}=await import(pathToFileURL(realpathSync(file)));
let cells=[],cursor=0,calls=[],closed=0,failed=false,focused='';
globalThis.hooks={state(initial){const i=cursor++;if(!(i in cells))cells[i]=typeof initial==='function'?initial():initial;return [cells[i],v=>cells[i]=typeof v==='function'?v(cells[i]):v];},ref(v){const i=cursor++;return cells[i]??=( {current:v});}};
globalThis.fixture={data:{customers:[{id:'old',name:'מרפאת אלון',company:'אלון'},{id:'new',name:'סטודיו נועה'}]},loading:false,error:''};
globalThis.actionApi=async(path,method,body)=>{calls.push({path,method,body});if(failed)throw Object.assign(Error('שגיאה זמנית'),{status:503});return {};};
globalThis.requestAnimationFrame=f=>f();globalThis.document={getElementById:id=>({focus:()=>focused=id})};
const ctx={run:f=>f(),refresh(){},go(){throw Error('assignment must not navigate');}},article={id:'a',title:'כתבה שכבר נרכשה',website_name:'PCMag',number:'#1001',customer_id:'old',customer_name:'מרפאת אלון',assignment_version:3};
const props={article,ctx,onSaved:()=>closed++,onCancel(){},onDirty(){},onBusy(){}};
function nodes(t,p,out=[]){if(!t||typeof t!=='object')return out;if(Array.isArray(t)){t.forEach(n=>nodes(n,p,out));return out;}if(p(t))out.push(t);nodes(t.props?.children,p,out);return out;}
function text(t){return t==null?'':typeof t==='string'||typeof t==='number'?String(t):Array.isArray(t)?t.map(text).join(''):text(t.props?.children);}
function reset(){cells=[];cursor=0;}function render(Component,props){cursor=0;return Component(props);}
const clickTab=(tree,value)=>nodes(tree,n=>n.props?.onValueChange&&n.props?.value==='existing')[0].props.onValueChange(value);
reset();let tree=render(Control,{article,ctx});assert(text(tree).includes('מרפאת אלון'));assert(text(tree).includes('שינוי שיוך'));nodes(tree,n=>n.props?.className==='article-customer-trigger')[0].props.onClick();assert(nodes(render(Control,{article,ctx}),n=>n.props?.open===true).length);
reset();tree=render(Control,{article,ctx,compact:true});assert(!text(tree).includes('משויך ללקוח'));nodes(tree,n=>typeof n.props?.onSelect==='function')[0].props.onSelect();assert(nodes(render(Control,{article,ctx,compact:true}),n=>n.props?.open===true).length,'compact menu opens same assignment dialog');
reset();tree=render(ArticleCustomerForm,props);assert(text(tree).includes('הוספת לקוח'));assert(text(tree).includes('סטודיו נועה'));assert(text(tree).includes('ללא שיוך'));assert(nodes(tree,n=>n.type==='form'&&n.props.noValidate).length);
let stopped=false;nodes(tree,n=>n.props?.placeholder==='חיפוש לקוח')[0].props.onKeyDown({key:'Enter',preventDefault(){stopped=true;}});assert(stopped,'search Enter must not submit the assignment');
nodes(tree,n=>n.props?.placeholder==='חיפוש לקוח')[0].props.onChange({target:{value:'לא קיים'}});assert(text(render(ArticleCustomerForm,props)).includes('לא נמצאו לקוחות'));nodes(render(ArticleCustomerForm,props),n=>n.props?.['aria-label']==='ניקוי חיפוש לקוחות')[0].props.onClick();assert.equal(focused,'article-customer-a-search');
tree=render(ArticleCustomerForm,props);nodes(tree,n=>n.props?.['aria-label']==='הלקוח שאליו תשויך הכתבה')[0].props.onValueChange('new');await nodes(render(ArticleCustomerForm,props),n=>n.type==='form')[0].props.onSubmit({preventDefault(){}});assert.equal(calls.at(-1).path,'articles/a/customer');assert.equal(calls.at(-1).body.customer_id,'new');assert.equal(calls.at(-1).body.assignment_version,3);assert.equal(closed,1);
reset();tree=render(ArticleCustomerForm,props);clickTab(tree,'new');await nodes(render(ArticleCustomerForm,props),n=>n.type==='form')[0].props.onSubmit({preventDefault(){}});assert.equal(focused,'article-customer-a-name');
let fields=nodes(render(ArticleCustomerForm,props),n=>n.props?.prefix==='article-customer-a')[0];for(const [key,value] of Object.entries({name:'לקוח חדש',company:'חברה',email:'customer@example.test',phone:'0501234567',notes:'מידע'}))fields.props.onChange(key,value);
failed=true;await nodes(render(ArticleCustomerForm,props),n=>n.type==='form')[0].props.onSubmit({preventDefault(){}});const key=calls.at(-1).body.request_id;assert(text(render(ArticleCustomerForm,props)).includes('שגיאה זמנית'));assert.equal(nodes(render(ArticleCustomerForm,props),n=>n.props?.prefix==='article-customer-a')[0].props.values.name,'לקוח חדש');
failed=false;await nodes(render(ArticleCustomerForm,props),n=>n.type==='form')[0].props.onSubmit({preventDefault(){}});assert.equal(calls.at(-1).body.request_id,key,'uncertain-completion retry reuses the request key');assert.equal(calls.at(-1).body.new_customer.name,'לקוח חדש');assert.equal(closed,2);
const purchase=readFileSync('app/purchased-view.tsx','utf8'),css=readFileSync('app/article-customer-assignment.css','utf8');
assert(purchase.includes('<ArticleCustomerAssignment article={article} ctx={ctx} compact/>'));assert(!css.includes('grid-template-columns:minmax(170px'));
assert(css.includes('max-width:520px'));assert(css.includes('max-height:calc(100dvh - 28px)'));assert(css.includes('@media(max-width:480px)'));
console.log('ARTICLE CUSTOMER UI PASS: incumbent row placement, same-page dialog, owned list/search/clear, selection, create fields, validation/focus, retained draft/retry key and no navigation. Source/handler evidence only, not browser pixels/focus trapping.');
