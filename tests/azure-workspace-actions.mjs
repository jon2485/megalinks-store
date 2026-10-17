import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {realpathSync,mkdirSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const require=createRequire(realpathSync('node_modules/wrangler')+'/package.json'),{build}=require('esbuild');
const react=realpathSync('node_modules/react/index.js');
let cells=[],cursor=0,calls=[],routes=[],search='';
globalThis.azureHooks={state(v){const i=cursor++;if(!(i in cells))cells[i]=typeof v==='function'?v():v;return[cells[i],n=>cells[i]=typeof n==='function'?n(cells[i]):n];}};
globalThis.azureApi=async(...args)=>{calls.push(args);return{total:100,vat:0}};
globalThis.azureFixture={data:{favorites:[]},loading:false};
async function bundle(entry,name){const b=await build({entryPoints:[entry],bundle:true,platform:'node',format:'esm',jsx:'automatic',external:['react/jsx-runtime','react-dom','react-dom/server'],write:false,banner:{js:"import {createRequire as __cr} from 'node:module';const require=__cr(import.meta.url);"},plugins:[{name:'fixtures',setup(b){b.onResolve({filter:/^react$/},()=>({path:'hooks',namespace:'fixture'}));b.onResolve({filter:/^react-real$/},()=>({path:react,external:true}));b.onResolve({filter:/^(\.\/workspace|@\/lib\/client)$/},a=>({path:a.path,namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},a=>({loader:'js',contents:a.path==='hooks'?`export * from 'react-real';export {default} from 'react-real';export const useState=v=>globalThis.azureHooks.state(v);export const useMemo=f=>f();export const useEffect=()=>{};export const useRef=v=>({current:v});`:a.path==='./workspace'?`export const categories={news_national:'חדשות ארציות',tech:'טכנולוגיה',food:'אוכל',business:'עסקים',real_estate:'נדל״ן',health:'בריאות',tourism:'תיירות',entertainment:'בידור'};export function Empty(){}export function ErrorBox(){}export function Field(){}export function Pick(){}export function Heading(){}export function Badge(){}export function UploadField(){}export function WebsiteForm(){}export function Stats(){}`:`export const useData=()=>globalThis.azureFixture;export const api=(...a)=>globalThis.azureApi(...a);export const csv=()=>'';export const download=()=>{};export const pricingApi=(...a)=>globalThis.azureApi(...a);export const decodeHtml=s=>s;`}));}}]});mkdirSync('.sites-runtime',{recursive:true});const f='.sites-runtime/'+name+'.mjs';writeFileSync(f,b.outputFiles[0].text);return import(pathToFileURL(realpathSync(f)));}
const {default:Catalog,PublicationCard}=await bundle('app/catalog-view.tsx','azure-catalog-test');
const {CartFlow}=await bundle('app/purchase-flow.tsx','azure-cart-test');
function nodes(t,p,out=[]){if(!t||typeof t!=='object')return out;if(Array.isArray(t)){t.forEach(n=>nodes(n,p,out));return out;}if(p(t))out.push(t);nodes(t.props?.children,p,out);return out;}
function text(t){if(t==null)return '';if(typeof t==='string'||typeof t==='number')return String(t);if(Array.isArray(t))return t.map(text).join('');return text(t.props?.children);}
const find=(t,label)=>nodes(t,n=>n.props?.onClick&&text(n)===label)[0];
const ctx={user:{id:'test'},revision:0,catalog:[{id:'a',name:'News',url:'https://news.test',category:'news_national',price_cents:100,dr:70,active:1},{id:'b',name:'Tech',url:'https://tech.test',category:'tech',price_cents:200,dr:60,active:1},{id:'c',name:'Food',url:'https://food.test',category:'food',price_cents:300,dr:50,active:1}],go:p=>routes.push(p),run:fn=>fn(),refresh(){}};
const renderCatalog=()=>{cursor=0;return Catalog({ctx,search,onSearch:v=>search=v});};
let tree=renderCatalog();assert.equal(tree.props.dir,'rtl');
find(tree,'חדשות ארציות').props.onClick();tree=renderCatalog();assert.deepEqual(nodes(tree,n=>n.type===PublicationCard).map(n=>n.props.site.id),['a']);
find(tree,'טכנולוגיה').props.onClick();tree=renderCatalog();assert.deepEqual(nodes(tree,n=>n.type===PublicationCard).map(n=>n.props.site.id),['a','b']);
find(tree,'חדשות ארציות').props.onClick();tree=renderCatalog();assert.deepEqual(nodes(tree,n=>n.type===PublicationCard).map(n=>n.props.site.id),['b']);
find(tree,'איפוס סינונים').props.onClick();tree=renderCatalog();assert.equal(nodes(tree,n=>n.type===PublicationCard).length,3);
find(tree,'הזמנה מרוכזת').props.onClick();assert.equal(routes.at(-1),'bulk');
nodes(tree,n=>n.props?.onValueChange&&n.props.value==='none')[0].props.onValueChange('high');tree=renderCatalog();assert.deepEqual(nodes(tree,n=>n.type===PublicationCard).map(n=>n.props.site.id),['c','b','a']);
find(tree,'סינון לפי רשימה').props.onClick();tree=renderCatalog();assert(nodes(tree,n=>n.props?.open===true).length);
cells=[];cursor=0;globalThis.azureFixture={data:{items:[{id:'i1',name:'Tech',url:'https://tech.test',quantity:1,publication_price:22000,regular_price:25000,sale_price:22000,editorial_price:0}]},loading:false};
const renderCart=()=>{cursor=0;return CartFlow({ctx});};tree=renderCart();cells[0]={total:25960,vat:3960,vatPercent:18};tree=renderCart();assert.equal(tree.props.dir,'rtl');assert(text(tree).includes('12% הנחה'));
find(tree,'לעמוד סיכום ותשלום').props.onClick();assert.equal(routes.at(-1),'checkout');find(tree,'המשך ברכישת אתרים נוספים').props.onClick();assert.equal(routes.at(-1),'catalog');
nodes(tree,n=>n.props?.id==='publication-quantity-i1')[0].props.onChange({target:{value:'2'}});await new Promise(r=>setTimeout(r,0));assert(calls.some(a=>a[0]==='cart/i1'&&a[1]==='PATCH'&&a[2].quantity===2));
await nodes(tree,n=>n.props?.['aria-label']==='הסרת Tech מהסל')[0].props.onClick();assert(calls.some(a=>a[0]==='cart/i1'&&a[1]==='DELETE'));
find(tree,'החלה').props.onClick();await new Promise(r=>setTimeout(r,0));assert(calls.some(a=>a[0]==='quote'&&a[1]==='POST'));
console.log('Azure workspace passed: RTL roots, additive category selection, deselection, reset, price sort, list dialog, bulk navigation, cart quantity/remove/coupon and checkout navigation.');

const checkoutTree=CartFlow({ctx,checkoutOnly:true});
const addons=nodes(checkoutTree,n=>n.type?.name==='EditorialAddon');
assert.equal(addons.length,1,'checkout retains optional writing controls for each site');
cells=[];cursor=0;let addon=addons[0].type(addons[0].props);
assert(text(addon).includes('תוספת לבחירה בלבד'));
assert(!text(addon).includes('שמירת מספר מילים'),'writing controls hidden until selected');
await nodes(addon,n=>n.props?.onCheckedChange)[0].props.onCheckedChange(true);
await new Promise(r=>setTimeout(r,0));
assert(calls.some(a=>a[0]==='cart/i1'&&a[2]?.editorial===true&&a[2].editorial_words===400));
cells=[];cursor=0;addon=addons[0].type({...addons[0].props,item:{...addons[0].props.item,editorial:true,editorial_words:600}});
assert(text(addon).includes('שמירת מספר מילים'));
await nodes(addon,n=>n.props?.onCheckedChange)[0].props.onCheckedChange(false);
await new Promise(r=>setTimeout(r,0));
assert(calls.some(a=>a[0]==='cart/i1'&&a[2]?.editorial===false));
console.log('Checkout optional writing: add with word count and remove handlers passed.');

cells=[];cursor=0;const enabledProps={...addons[0].props,item:{...addons[0].props.item,editorial:true,editorial_words:400}};
addon=addons[0].type(enabledProps);
nodes(addon,n=>n.props?.id==='editorial-words-i1')[0].props.onChange({target:{value:'800'}});
cursor=0;addon=addons[0].type(enabledProps);
await find(addon,'שמירת מספר מילים').props.onClick();
assert(calls.some(a=>a[0]==='cart/i1'&&a[2]?.editorial===true&&a[2].editorial_words===800));
assert(text(addon).includes('120.00'),'800 words display correct 0.15 NIS per word charge');
nodes(addon,n=>n.props?.id==='editorial-words-i1')[0].props.onChange({target:{value:'0'}});cursor=0;addon=addons[0].type(enabledProps);
const before=calls.length;await find(addon,'שמירת מספר מילים').props.onClick();assert.equal(calls.length,before,'invalid word count does not save');
console.log('Reference writing switch and saved word count/price/validation passed.');
// Cart uses the summary route; monthly payment is chosen in checkout and retains its notice.
cells=[];cursor=0;globalThis.azureFixture={data:{items:[{id:'i1',website_id:'a',quantity:1,price_cents:100,publication_price:100,regular_price:100,editorial:false,name:'News'}]},loading:false};const monthlyCtx={...ctx,user:{id:'test',monthly_account:{enabled:1,credit_limit:100000,balance:0}}};let monthlyTree=CartFlow({ctx:monthlyCtx});find(monthlyTree,'לעמוד סיכום ותשלום').props.onClick();assert.equal(routes.at(-1),'checkout');cursor=0;monthlyTree=CartFlow({ctx:monthlyCtx,checkoutOnly:true});nodes(monthlyTree,n=>n.props?.options?.monthly)[0].props.onChange('monthly');cursor=0;monthlyTree=CartFlow({ctx:monthlyCtx,checkoutOnly:true});assert(nodes(monthlyTree,n=>n.props?.value==='monthly').length,'checkout selects actual monthly payment mode');const notice=nodes(monthlyTree,n=>n.type?.name==='MonthlyCheckoutNotice')[0];assert(notice,'monthly choice shows the current reusable open/closed-order notice');assert.equal(notice.props.account,monthlyCtx.user.monthly_account);console.log('Monthly checkout selects actual payment method, retains the current order notice and uses the summary route.');
