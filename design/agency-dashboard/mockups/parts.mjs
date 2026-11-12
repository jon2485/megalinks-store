import {readFileSync} from 'node:fs';
// Real lucide icons, read from the repo's lucide-react files (no code from there is run).
export function icon(name,size=18,extra=''){
 const src=readFileSync('/home/user/megalinks-store/node_modules/lucide-react/dist/esm/icons/'+name+'.mjs','utf8');
 const arr=JSON.parse(/const __iconNode = (\[[\s\S]*?\]);\n/.exec(src)[1].replace(/(\w+):\s*"/g,'"$1": "'));
 const body=arr.map(([tag,attrs])=>'<'+tag+' '+Object.entries(attrs).filter(([k])=>k!=='key').map(([k,v])=>k+'="'+v+'"').join(' ')+'/>').join('');
 return `<svg ${extra} xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}
export const CUSTOMERS=[
 ['קפה הבוקר','קפה הבוקר בע״מ',3,'#1673e6'],['משרד עו״ד לוי ושות׳','לוי ושות׳',1,'#7c3aed'],['סטודיו יוגה אור','',0,'#0f9f8f'],['מוסך הצפון','מוסך הצפון 2004',2,'#ea580c'],
 ['רהיטי עץ גלבוע','גלבוע עיצובים',0,'#b45309'],['קליניקת חיוך','ד״ר כהן',0,'#db2777'],['נדל״ן השרון','השרון נכסים',1,'#0369a1'],['אופניים גלגל','',0,'#16a34a'],
 ['מסעדת הים','',0,'#0891b2'],['בית ספר לנהיגה ירוק','',0,'#65a30d'],['אקדמיה לבישול','',0,'#c2410c'],['פרחי השדה','',0,'#be185d']];
export const PUBS=[
 ['חדשות הטכנולוגיה','tech-news.example.co.il','03.11.2026','מכונות קפה ביתיות','cafe-boker.example/machines','1,250'],
 ['מגזין אוכל','food-mag.example.co.il','28.10.2026','בית קפה בתל אביב','cafe-boker.example','980'],
 ['הבית והגן','home-garden.example.co.il','19.10.2026','קפה ספשלטי','cafe-boker.example/beans','1,100'],
 ['כלכלה היום','econ-today.example.co.il','07.10.2026','רשת בתי קפה','cafe-boker.example/about','1,600'],
 ['לייף סטייל ישראל','lifestyle.example.co.il','22.09.2026','בראנץ׳ בתל אביב','cafe-boker.example/menu','890'],
 ['תרבות הפנאי','leisure.example.co.il','09.09.2026','קפה הבוקר','cafe-boker.example','760'],
 ['עסקים קטנים','smb.example.co.il','26.08.2026','קורס בריסטה','cafe-boker.example/academy','1,050'],
 ['מטבח פתוח','open-kitchen.example.co.il','—','מאפה בוקר','cafe-boker.example/bakery','1,150','בדרך']];
export const CSS=`
@font-face{font-family:AgHeebo;src:url(/brand/heebo-variable.ttf);font-weight:100 900}
.ag,.ag *{box-sizing:border-box}
.ag{--ink:#0b1b2f;--muted:#5b6b82;--line:#e3eaf2;--blue:#1673e6;--blue-ink:#1460c4;--soft:#f4f8fe;font-family:AgHeebo,Heebo,Arial,sans-serif;color:var(--ink);direction:rtl;max-width:1380px;margin:0 auto;padding:22px 24px 56px;font-variant-numeric:tabular-nums}
.ag button{font:inherit;cursor:pointer}
.ag-mock{display:table;margin:0 0 10px auto;padding:6px 12px;border-radius:999px;background:#0b1b2fde;color:#fff;font:600 12px AgHeebo,Arial}
.ag-band{display:flex;align-items:center;gap:18px;padding:18px 22px;border-radius:24px;background:#fff;box-shadow:0 1px 2px #0b285010,0 10px 30px -12px #0b285024}
.ag-band img{height:30px;width:auto}
.ag-band .sep{width:1px;align-self:stretch;background:var(--line)}
.ag-band h1{margin:0;font-size:24px;font-weight:800;letter-spacing:-.02em;line-height:1.2}
.ag-band p{margin:2px 0 0;font-size:14px;color:var(--muted)}
.ag-band .grow{flex:1}
.ag-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:44px;padding:0 18px;border:0;border-radius:14px;font-size:15px;font-weight:700;white-space:nowrap;transition:transform .12s ease-out}
.ag-btn:active{transform:scale(.97)}
.ag-btn.ghost{background:#fff;color:var(--ink);box-shadow:inset 0 0 0 1px #d6e2ee}
.ag-btn.primary{background:var(--blue);color:#fff;box-shadow:0 6px 16px -8px #1673e6aa}
.ag-btn.buy{background:linear-gradient(180deg,#ff9a3c,#f26b0f);color:#fff;box-shadow:0 8px 18px -8px #f26b0fcc}
.ag-btn.sm{min-height:36px;padding:0 12px;font-size:13.5px;border-radius:11px}
.ag-tabs{display:flex;gap:4px;margin:14px 0 18px;padding:6px;border-radius:20px;background:#fff;box-shadow:0 1px 2px #0b285010,0 8px 24px -14px #0b285020;overflow-x:auto;scrollbar-width:none}
.ag-tabs button{position:relative;display:flex;align-items:center;gap:8px;min-height:46px;padding:0 16px;border:0;border-radius:14px;background:none;color:#3c4b5e;font-size:15px;font-weight:600;white-space:nowrap}
.ag-tabs button[aria-current]{background:#eef5ff;color:var(--blue-ink);font-weight:800}
.ag-tabs button[aria-current]::after{content:"";position:absolute;inset-inline:22%;bottom:5px;height:3px;border-radius:3px;background:var(--blue)}
.ag-count{min-width:20px;height:20px;padding:0 6px;border-radius:999px;background:#e5484d;color:#fff;font-size:12px;font-weight:800;line-height:20px;text-align:center}
.ag-split{display:grid;grid-template-columns:310px 1fr;gap:18px;align-items:start}
.ag-card{border-radius:24px;background:#fff;box-shadow:0 1px 2px #0b285010,0 10px 30px -14px #0b285022}
.ag-list{padding:14px;position:sticky;top:90px}
.ag-list-top{display:flex;gap:8px;align-items:center;margin-bottom:10px}
.ag-search{flex:1;display:flex;align-items:center;gap:8px;height:42px;padding:0 12px;border-radius:12px;background:#f3f6fa;color:#7b8796;font-size:14px}
.ag-seg{display:flex;gap:4px;padding:4px;margin-bottom:10px;border-radius:12px;background:#f3f6fa}
.ag-seg span{flex:1;padding:6px 0;border-radius:9px;text-align:center;font-size:13px;font-weight:600;color:#55657a}
.ag-seg span.on{background:#fff;color:var(--ink);box-shadow:0 1px 3px #0b285022}
.ag-cust{display:flex;align-items:center;gap:11px;padding:9px 10px;border-radius:14px}
.ag-cust+.ag-cust{margin-top:2px}
.ag-cust.on{background:#eef5ff;box-shadow:inset 0 0 0 1.5px #b9d4fb}
.ag-av{flex:none;display:grid;place-items:center;width:36px;height:36px;border-radius:50%;color:#fff;font-size:15px;font-weight:800}
.ag-cust b{display:block;font-size:14.5px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ag-cust small{display:block;font-size:12.5px;color:var(--muted)}
.ag-cust .t{flex:1;min-width:0}
.ag-pending{flex:none;min-width:22px;height:22px;padding:0 7px;border-radius:999px;background:#fff1e0;color:#b45309;font-size:12px;font-weight:800;line-height:22px;text-align:center}
.ag-main{padding:22px 24px 26px;min-width:0}
.ag-chead{display:flex;align-items:center;gap:14px}
.ag-chead .ag-av{width:54px;height:54px;font-size:22px}
.ag-chead h2{margin:0;font-size:26px;font-weight:800;letter-spacing:-.02em}
.ag-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}
.ag-chip{display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:999px;background:#f3f6fa;color:#3c4b5e;font-size:12.5px;font-weight:600}
.ag-chip.tag{background:#eefbf6;color:#0f7a55}
.ag-ctabs{display:flex;gap:2px;margin:20px 0 18px;border-bottom:1px solid var(--line);overflow-x:auto;scrollbar-width:none}
.ag-ctabs span{display:flex;align-items:center;gap:7px;padding:10px 14px 12px;font-size:14.5px;font-weight:600;color:#55657a;white-space:nowrap;border-bottom:3px solid transparent;margin-bottom:-1px}
.ag-ctabs span.on{color:var(--blue-ink);border-color:var(--blue);font-weight:800}
.ag-filters{display:flex;flex-wrap:wrap;align-items:center;gap:8px}
.ag-pill{padding:7px 13px;border-radius:999px;background:#f3f6fa;font-size:13.5px;font-weight:600;color:#3c4b5e}
.ag-pill.on{background:var(--ink);color:#fff}
.ag-select{display:inline-flex;align-items:center;gap:6px;height:38px;padding:0 12px;border-radius:11px;box-shadow:inset 0 0 0 1px #d6e2ee;font-size:13.5px;color:var(--ink);background:#fff}
.ag-select small{color:var(--muted)}
.ag-filters .grow{flex:1}
.ag-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:16px 0}
.ag-stat{padding:14px 16px;border-radius:16px;background:var(--soft)}
.ag-stat small{display:block;font-size:13px;font-weight:600;color:var(--blue-ink)}
.ag-stat b{display:block;margin-top:2px;font-size:26px;font-weight:800;letter-spacing:-.02em}
.ag-stat em{font-style:normal;font-size:12.5px;color:var(--muted)}
.ag-table{width:100%;border-collapse:collapse;font-size:14px}
.ag-table th{padding:10px;border-bottom:1px solid var(--line);font-size:12.5px;font-weight:700;color:var(--muted);text-align:right;white-space:nowrap}
.ag-table td{padding:12px 10px;border-bottom:1px solid #eef2f6;vertical-align:middle}
.ag-site{display:flex;align-items:center;gap:10px}
.ag-logo{flex:none;display:grid;place-items:center;width:34px;height:34px;border-radius:10px;background:#eef3f9;color:#6b7c93}
.ag-site b{display:block;font-weight:700}
.ag-site small{display:block;font-size:12px;color:var(--muted);direction:ltr;text-align:right}
.ag-link{display:inline-flex;align-items:center;gap:5px;color:#0a5fc2;font-weight:700;text-decoration:none}
.ag-ltr{direction:ltr;unicode-bidi:isolate}
.ag-status{display:inline-block;padding:3px 10px;border-radius:999px;font-size:12.5px;font-weight:700;background:#e9f8ef;color:#16794a}
.ag-status.way{background:#fff4e5;color:#a35a00}
.ag-muted{color:var(--muted)}
.ag-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
.ag-kpi{padding:18px 20px}
.ag-kpi .ic{display:grid;place-items:center;width:40px;height:40px;border-radius:12px;background:var(--soft);color:var(--blue)}
.ag-kpi small{display:block;margin-top:12px;font-size:13.5px;font-weight:600;color:var(--muted)}
.ag-kpi b{display:block;font-size:32px;font-weight:800;letter-spacing:-.02em;line-height:1.15}
.ag-kpi em{font-style:normal;font-size:12.5px;font-weight:600;color:#16794a}
.ag-grid2{display:grid;grid-template-columns:1.55fr 1fr;gap:14px;margin-top:14px}
.ag-sec{padding:20px 22px}
.ag-sec h3{display:flex;align-items:center;gap:8px;margin:0 0 14px;font-size:17px;font-weight:800}
.ag-sec h3 .more{margin-inline-start:auto;font-size:13px;font-weight:700;color:#0a5fc2}
.ag-task{display:flex;align-items:center;gap:12px;padding:11px 0;border-top:1px solid #eef2f6}
.ag-task:first-of-type{border-top:0}
.ag-task .dot{flex:none;display:grid;place-items:center;width:34px;height:34px;border-radius:11px}
.ag-task .t{flex:1;min-width:0}.ag-task b{display:block;font-size:14px}.ag-task small{font-size:12.5px;color:var(--muted)}
.ag-mode{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.ag-opt{display:flex;gap:12px;padding:14px 16px;border-radius:16px;box-shadow:inset 0 0 0 1px #d6e2ee}
.ag-opt.on{background:#f4f8fe;box-shadow:inset 0 0 0 2px var(--blue)}
.ag-opt b{display:block;font-size:15px}.ag-opt small{font-size:13px;color:var(--muted)}
.ag-radio{flex:none;width:20px;height:20px;margin-top:2px;border-radius:50%;box-shadow:inset 0 0 0 2px #9fb0c4}
.ag-opt.on .ag-radio{box-shadow:inset 0 0 0 6px var(--blue)}
.ag-paste{margin-top:14px;padding:16px;border-radius:16px;background:#f7f9fc;box-shadow:inset 0 0 0 1px #e3eaf2}
.ag-paste textarea{width:100%;height:92px;padding:12px;border:0;border-radius:12px;background:#fff;box-shadow:inset 0 0 0 1px #d6e2ee;font:14px/1.6 ui-monospace,Menlo,monospace;direction:ltr;resize:none;color:#33445a}
.ag-result{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
.ag-src{display:inline-block;padding:2px 9px;border-radius:999px;font-size:12px;font-weight:700}
.ag-src.sys{background:#eef5ff;color:var(--blue-ink)}.ag-src.man{background:#f3f0ff;color:#6d28d9}.ag-src.cat{background:#e9f8ef;color:#16794a}.ag-src.out{background:#f1f3f6;color:#66758a}
@media(max-width:760px){
 .ag{padding:12px 12px 40px}
 .ag-band{padding:12px 14px;border-radius:18px;gap:10px}.ag-band img,.ag-band .sep,.ag-band .ghost{display:none}.ag-band h1{font-size:19px}.ag-band p{font-size:12.5px}
 .ag-btn.buy{padding:0 12px}
 .ag-tabs{margin:10px -12px 12px;border-radius:0;padding:6px 12px;box-shadow:none;background:transparent}
 .ag-tabs button{min-height:40px;padding:0 13px;background:#fff;box-shadow:inset 0 0 0 1px #dfe7f0;font-size:14px}
 .ag-tabs button[aria-current]{background:var(--ink);color:#fff;box-shadow:none}.ag-tabs button[aria-current]::after{display:none}
 .ag-split{grid-template-columns:1fr}.ag-list{position:static}
 .ag-main{padding:16px 14px 18px;border-radius:20px}
 .ag-chead h2{font-size:21px}.ag-chead .ag-av{width:44px;height:44px;font-size:18px}
 .ag-stats{grid-template-columns:repeat(3,1fr);gap:8px}.ag-stat{padding:10px}.ag-stat b{font-size:19px}.ag-stat small{font-size:11.5px}
 .ag-kpis{grid-template-columns:1fr 1fr}.ag-grid2{grid-template-columns:1fr}
}
.ag-cards{display:grid;gap:10px}
.ag-pcard{padding:14px;border-radius:16px;box-shadow:inset 0 0 0 1px #e3eaf2}
.ag-pcard .row{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:10px;font-size:13px}
.ag-back{display:inline-flex;align-items:center;gap:6px;margin-bottom:10px;font-size:14px;font-weight:700;color:#0a5fc2}
`;
export const CSS2=`
.agc-bar,.agc-dialog{--ink:#0b1b2f;--blue:#1673e6;--blue-ink:#1460c4}
.agc-dialog .used{display:flex;align-items:center;gap:8px}
.agc-bar{position:sticky;top:74px;z-index:30;display:flex;align-items:center;gap:12px;max-width:1380px;margin:14px auto 0;padding:12px 18px;border-radius:18px;background:#0b1b2f;color:#fff;font-family:AgHeebo,Heebo,Arial;direction:rtl;box-shadow:0 12px 30px -14px #0b1b2f99}
.agc-bar .ag-av{width:34px;height:34px}
.agc-bar b{font-size:16px}.agc-bar small{display:block;font-size:12.5px;color:#b9c6d8}
.agc-bar .grow{flex:1}
.agc-bar .hid{display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:999px;background:#ffffff1f;font-size:13.5px;font-weight:600}
.agc-bar .hid u{color:#9cc8ff;text-underline-offset:3px}
.agc-bar .ag-btn.ghost{background:#ffffff14;color:#fff;box-shadow:inset 0 0 0 1px #ffffff40}
.agc-dim{position:fixed;inset:0;z-index:80;background:#0b1b2f73;backdrop-filter:blur(2px)}
.agc-dialog{position:fixed;z-index:81;top:50%;left:50%;transform:translate(-50%,-50%);width:min(460px,calc(100vw - 32px));padding:24px;border-radius:24px;background:#fff;font-family:AgHeebo,Heebo,Arial;direction:rtl;color:#0b1b2f;box-shadow:0 30px 80px -20px #0b1b2f80}
.agc-dialog .ic{display:grid;place-items:center;width:48px;height:48px;border-radius:16px;background:#fff4e5;color:#b45309}
.agc-dialog h2{margin:14px 0 6px;font-size:21px;font-weight:800;letter-spacing:-.01em}
.agc-dialog p{margin:0;font-size:15px;line-height:1.65;color:#4a5869}
.agc-dialog .used{margin:14px 0 18px;padding:12px 14px;border-radius:14px;background:#f4f8fe;font-size:14px}
.agc-dialog .acts{display:grid;grid-template-columns:1fr 1fr;gap:10px}
@media(max-width:760px){.agc-bar{margin:10px 10px 0;flex-wrap:wrap}.agc-bar .ag-btn{display:none}}
`;
