import {PDFDocument,rgb} from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import createBidi from 'bidi-js';
import type {Row} from './shared';
export async function makeWritingBriefPdf(brief:Row,fontBytes:Uint8Array,logoBytes:Uint8Array){
 const pdf=await PDFDocument.create(),bidi=createBidi(),navy=rgb(.028,.122,.294),pale=rgb(.91,.97,.995);pdf.registerFontkit({create:(bytes:any)=>{const f=(fontkit as any).create(bytes),layout=f.layout.bind(f);f.layout=(s:string,features:any)=>layout(s,features,undefined,undefined,'ltr');return f;}} as any);
 const font=await pdf.embedFont(fontBytes,{subset:true}),logo=await pdf.embedPng(logoBytes);let page:any,y=0;
 const text=(s:string,top:number,size=11)=>{const value=bidi.getReorderedString(s,bidi.getEmbeddingLevels(s,/[\u0590-\u05ff]/.test(s)?'rtl':'ltr'));page.drawText(value,{x:551-font.widthOfTextAtSize(value,size),y:842-top,size,font,color:navy});};
 const newPage=()=>{page=pdf.addPage([595,842]);page.drawRectangle({x:32,y:724,width:531,height:88,color:navy});page.drawImage(logo,{x:369,y:751,width:174,height:38});page.drawRectangle({x:32,y:680,width:531,height:32,color:pale});text('הנחיות לכתיבה מקצועית · הזמנה '+brief.order_number,151,16);y=184;};
 const lines=(s:string)=>{const result:string[]=[];for(const paragraph of String(s).split('\n')){let line='';for(const ch of paragraph){if(font.widthOfTextAtSize(line+ch,11)>495&&line){result.push(line);line='';}line+=ch;}result.push(line);}return result;};
 newPage();for(const [label,value] of [['לקוח',brief.customer_name],['אתר לפרסום',brief.website_url||brief.website_name],['תאריך שליחת ההנחיות',new Intl.DateTimeFormat('he-IL',{timeZone:'Asia/Jerusalem',dateStyle:'short',timeStyle:'short'}).format(new Date(brief.writing_requested_at))],['מספר מילים',brief.editorial_words||400],['מסלול פרסום',brief.publish_without_review?'פרסום ללא החזרה ללקוח':'החזרה ללקוח לבדיקה לפני פרסום'],['בקשת תיקונים מהלקוח',brief.writing_revision_note],['נושא הכתבה',brief.topic],['מותג / עסק',brief.brand],['קהל יעד',brief.audience],['מילות מפתח',brief.keywords],['סגנון כתיבה',brief.style],['קישור לשילוב',brief.target_url],['טקסט הקישור',brief.anchor],['קישור נוסף',brief.target_url_2],['טקסט הקישור הנוסף',brief.anchor_2],['מסרים, עובדות ודגשים לכותב',brief.notes],['הערות לפרסום',brief.client_notes],['תמונות וקבצים',brief.image_id?'תמונות וקרדיטים מצורפים במערכת; יש לבקש אותם מהמנהל.':'']]){
  if(value===undefined||value==='')continue;const content=lines(String(value));if(y+50>784)newPage();text(String(label)+':',y,12);y+=20;for(const line of content){if(y+20>784)newPage();text(line,y);y+=17;}y+=13;
 }
 pdf.getPages().forEach((p,i)=>{page=p;text('מגה לינקס · עמוד '+(i+1)+' מתוך '+pdf.getPageCount(),817,9);});pdf.setTitle('Mega Links writing brief '+brief.order_number);pdf.setAuthor('Mega Links');return pdf.save();
}
