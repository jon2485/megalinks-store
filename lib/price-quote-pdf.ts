import {PDFDocument,PDFName,PDFString,rgb} from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import createBidi from 'bidi-js';
import type {Row} from './shared';
// The price quote as a PDF (owner 27.11.2026): the same content as the quote e-mail, from the customer's view only
// (customerQuote), so it carries no cost, profit or supplier. The site addresses and the button are real links.
const ils=(cents:number)=>'₪'+(Math.round(cents)/100).toLocaleString('he-IL',{maximumFractionDigits:2});
const dateTime=(iso:string)=>new Intl.DateTimeFormat('he-IL',{timeZone:'Asia/Jerusalem',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(iso)).replace(', ',' בשעה ');
const bare=(url:string)=>String(url).replace(/^https?:\/\/(www\.)?/,'').replace(/\/$/,'');
export async function makePriceQuotePdf(v:Row,name:string,link:string,fontBytes:Uint8Array,logoBytes:Uint8Array){
 const pdf=await PDFDocument.create(),bidi=createBidi();
 const navy=rgb(.035,.137,.294),ink=rgb(.035,.137,.294),muted=rgb(.32,.40,.49),line=rgb(.89,.92,.95),pale=rgb(.96,.97,.99),blue=rgb(.08,.40,.81),green=rgb(.08,.50,.24),amber=rgb(.60,.36,0),orange=rgb(.957,.482,.086),white=rgb(1,1,1),grey=rgb(.48,.54,.63);
 pdf.registerFontkit({create:(bytes:any)=>{const f=(fontkit as any).create(bytes),layout=f.layout.bind(f);f.layout=(s:string,features:any)=>layout(s,features,undefined,undefined,'ltr');return f;}} as any);
 const font=await pdf.embedFont(fontBytes,{subset:true}),logo=await pdf.embedPng(logoBytes);
 const W=595,H=842,R=555,L=40;let page:any,y=0;
 const shape=(s:string)=>bidi.getReorderedString(s,bidi.getEmbeddingLevels(s,/[֐-׿]/.test(s)?'rtl':'ltr'));
 const width=(s:string,size:number)=>font.widthOfTextAtSize(shape(s),size);
 // Text whose right edge (or left edge, with align 'left') sits at x; top is measured from the top of the page.
 const text=(s:string,x:number,top:number,size=11,color=ink,align:'right'|'left'|'center'='right')=>{const value=shape(String(s)),w=font.widthOfTextAtSize(value,size);const left=align==='right'?x-w:align==='center'?x-w/2:x;page.drawText(value,{x:left,y:H-top,size,font,color});return {left,w};};
 const fit=(s:string,max:number,size:number)=>{let out=String(s);while(out.length>3&&width(out,size)>max)out=out.slice(0,-2);return out===String(s)?out:out.trimEnd()+'…';};
 const linkAt=(x:number,top:number,w:number,h:number,url:string)=>{const ref=pdf.context.register(pdf.context.obj({Type:'Annot',Subtype:'Link',Rect:[x,H-top-h,x+w,H-top],Border:[0,0,0],A:{Type:'Action',S:'URI',URI:PDFString.of(url)}}));const annots=page.node.lookup(PDFName.of('Annots'));if(annots)annots.push(ref);else page.node.set(PDFName.of('Annots'),pdf.context.obj([ref]));};
 const newPage=(first:boolean)=>{page=pdf.addPage([W,H]);page.drawRectangle({x:0,y:H-96,width:W,height:96,color:navy});page.drawImage(logo,{x:R-170,y:H-67,width:170,height:37});text('הצעת מחיר מס׳ '+v.number,L,54,17,white,'left');text(new Intl.DateTimeFormat('he-IL',{timeZone:'Asia/Jerusalem',day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date()),L,74,10,rgb(.82,.87,.94),'left');y=first?132:126;};
 newPage(true);
 text('הצעת מחיר'+(v.domain?' לאתר '+v.domain:''),R,y,21);y+=26;
 text('שלום '+(name||'')+', זו ההצעה שהכנו עבורך.',R,y,12.5,muted);y+=22;
 // The summary rows: one line for each detail, the value bold-sized on the left.
 const rows:[string,string,any,number,boolean][]=[['מספר הצעה',String(v.number),ink,13,false]];
 if(v.domain)rows.push(['לאתר',v.domain,ink,13,false]);if(v.budget_ils)rows.push(['תקציב',ils(v.budget_ils*100),ink,13,false]);
 rows.push(['כמות אתרים',String(v.count),ink,13,false]);if(v.before_cents>v.total_cents)rows.push(['מחיר לפני הנחה',ils(v.before_cents),grey,12,true]);
 rows.push(['מחיר אחרי הנחה (לפני מע״מ)',ils(v.total_cents),ink,16,false]);if(v.saving_cents>0)rows.push(['חיסכון',ils(v.saving_cents),green,13,false]);rows.push(['בתוקף עד',dateTime(v.expires),amber,13,false]);
 const rowH=27,boxTop=y;page.drawRectangle({x:L,y:H-boxTop-rows.length*rowH,width:R-L,height:rows.length*rowH,borderColor:line,borderWidth:1,color:white});
 rows.forEach(([label,value,color,size,strike],i)=>{const top=boxTop+i*rowH;if(label.startsWith('מחיר אחרי'))page.drawRectangle({x:L+.5,y:H-top-rowH+.5,width:R-L-1,height:rowH-1,color:rgb(.95,.97,1)});if(i)page.drawLine({start:{x:L,y:H-top},end:{x:R,y:H-top},thickness:.7,color:line});text(label,R-14,top+18,11.5,muted);const t=text(value,L+14,top+18.5,size,color,'left');if(strike)page.drawLine({start:{x:t.left,y:H-top-14.5},end:{x:t.left+t.w,y:H-top-14.5},thickness:.8,color:grey});});
 y=boxTop+rows.length*rowH+30;
 text('האתרים בהצעה',R,y,13,muted);y+=12;
 // The sites table. Columns from the right: #, name, address (a link), before, after.
 const cNum=R-12,cName=R-36,cUrl=R-212,cBefore=L+150,cAfter=L+12,itemH=26;
 const head=()=>{page.drawRectangle({x:L,y:H-y-24,width:R-L,height:24,color:pale,borderColor:line,borderWidth:1});text('#',cNum,y+16,9.5,muted);text('שם האתר',cName,y+16,9.5,muted);text('כתובת',cUrl,y+16,9.5,muted);text('לפני הנחה',cBefore,y+16,9.5,muted,'left');text('אחרי הנחה',cAfter,y+16,9.5,muted,'left');y+=24;};
 head();
 (v.items as Row[]).forEach((item,i)=>{
  if(y+itemH>H-70){newPage(false);head();}
  page.drawLine({start:{x:L,y:H-y-itemH},end:{x:R,y:H-y-itemH},thickness:.7,color:line});page.drawLine({start:{x:L,y:H-y},end:{x:L,y:H-y-itemH},thickness:1,color:line});page.drawLine({start:{x:R,y:H-y},end:{x:R,y:H-y-itemH},thickness:1,color:line});
  text(String(i+1),cNum,y+17,10,muted);text(fit(item.name,165,11.5),cName,y+17,11.5);
  const url=fit(bare(item.url),150,10),u=text(url,cUrl,y+17,10,blue);page.drawLine({start:{x:u.left,y:H-y-19},end:{x:u.left+u.w,y:H-y-19},thickness:.5,color:blue});if(/^https?:\/\//i.test(item.url))linkAt(u.left,y+6,u.w,15,item.url);
  if(item.before_cents>item.price_cents){const b=text(ils(item.before_cents),cBefore,y+17,10.5,grey,'left');page.drawLine({start:{x:b.left,y:H-y-13.5},end:{x:b.left+b.w,y:H-y-13.5},thickness:.7,color:grey});}
  text(ils(item.price_cents),cAfter,y+17,12.5,ink,'left');y+=itemH;
 });
 if(y+150>H-40)newPage(false);
 y+=22;
 // The button into the system.
 const bw=R-L,bh=44;page.drawRectangle({x:L,y:H-y-bh,width:bw,height:bh,color:orange});text('אישור ההצעה והוספה לסל',L+bw/2,y+28,15,white,'center');linkAt(L,y,bw,bh,link);y+=bh+20;
 for(const s of ['הכפתור מעביר למערכת מגה לינקס ומוסיף את האתרים לסל במחירי ההצעה. המחירים לפני מע״מ.','המחירים המיוחדים חלים על ההצעה כולה: הסרת אתר מהסל מחזירה את שאר האתרים למחיר הרגיל.','אחרי '+dateTime(v.expires)+' המחירים המיוחדים לא יחולו.']){text(s,R,y,10,muted);y+=15;}
 pdf.getPages().forEach((p,i)=>{page=p;text('מגה לינקס · עמוד '+(i+1)+' מתוך '+pdf.getPageCount(),W/2,H-22,9,muted,'center');});
 pdf.setTitle('MegaLinks price quote '+v.number);pdf.setAuthor('MegaLinks');return pdf.save();
}
