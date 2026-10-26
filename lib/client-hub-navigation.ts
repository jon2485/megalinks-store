export const clientHubTabs=[
 {id:'lobby',path:'purchased',label:'עדכונים אישיים'},
 {id:'articles',path:'purchased/articles',label:'הכתבות שלי'},
 {id:'orders',path:'purchased/orders',label:'ההזמנות שלי'},
 {id:'payments',path:'purchased/payments',label:'יתרה וזיכויים'},
 {id:'customers',path:'purchased/customers',label:'הלקוחות שלי'},
 {id:'profile',path:'purchased/profile',label:'פרטי חשבון'},
] as const;
const aliases:Record<string,string>={orders:'purchased/orders',articles:'purchased/articles',links:'purchased/articles',dashboard:'purchased',strategies:'purchased',wallet:'purchased/payments',monthly:'purchased/orders','purchased/monthly':'purchased/orders',customers:'purchased/customers',profile:'purchased/profile',files:'purchased/files',support:'purchased/support',api:'purchased/api',notifications:'purchased/notifications'};
export function clientHubRoute(view:string){return aliases[view]||view;}
export function isClientHub(view:string){return view==='purchased'||view.startsWith('purchased/');}
export function clientHubTab(view:string){const part=view.split('/')[1]||'lobby';return part==='monthly'?'orders':['support','api','files','notifications'].includes(part)?'profile':part;}

export function personalDestinationActive(path:string,view:string){return path===view||path!=='purchased'&&(view.startsWith(path+'/')||path==='purchased/articles'&&view.startsWith('article/'));}

export function preserveAccountScroll(from:string,to:string){return isClientHub(from)&&isClientHub(to)&&from!=='purchased/selling'&&to!=='purchased/selling';}
