// The customer's "your article needs a fix" email and the updates feed reading the note from the article (owner, 22.11.2026).
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {realpathSync,mkdirSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const require=createRequire(realpathSync('node_modules/wrangler')+'/package.json'),{build}=require('esbuild');
mkdirSync('.sites-runtime',{recursive:true});
for(const [entry,out] of [['lib/fix-request-mail.ts','fix-request-mail-test.mjs'],['lib/client-updates.ts','client-updates-fix-test.mjs']]){const r=await build({entryPoints:[entry],bundle:true,platform:'node',format:'esm',write:false});writeFileSync('.sites-runtime/'+out,r.outputFiles[0].text);}
const mail=await import(pathToFileURL(realpathSync('.sites-runtime/fix-request-mail-test.mjs')));
const {buildClientUpdates}=await import(pathToFileURL(realpathSync('.sites-runtime/client-updates-fix-test.mjs')));

const m={origin:'https://shop.example.test',site:'אתר בדיקה',siteUrl:'https://www.site.example.test/news/',title:'כותרת <בדיקה>',orderNumber:'#1003',note:'הקישור לא תקין.\nחסר קרדיט לתמונה.',name:'דנה',url:'https://shop.example.test/article/a1'};
assert.equal(mail.fixRequestSubject('אתר בדיקה'),'המאמר שלך לאתר אתר בדיקה דורש תיקון');
const html=mail.fixRequestEmailHtml(m);
for(const part of ['המאמר שלך לאתר אתר בדיקה דורש תיקון','שלום דנה,','כותרת המאמר','כותרת &lt;בדיקה&gt;','מספר הזמנה','#1003','site.example.test/news','מה צריך לתקן','הקישור לא תקין.<br>חסר קרדיט לתמונה.','href="https://shop.example.test/article/a1"','פתיחת המאמר לתיקון','קיבלת את המייל כי יש לך חשבון ב-Mega Links','href="https://shop.example.test/purchased"','אפשר פשוט להשיב למייל הזה'])assert.ok(html.includes(part),'missing: '+part);
assert.ok(!html.includes('<בדיקה>'),'the title is escaped');
assert.ok(!/unsubscribe|הסרה מרשימת/i.test(html),'a service mail has no unsubscribe link');
const text=mail.fixRequestText(m);
for(const part of ['אתר: אתר בדיקה · site.example.test/news','כותרת המאמר: כותרת <בדיקה>','מספר הזמנה: #1003','מה צריך לתקן:\nהקישור לא תקין.','פתיחת המאמר לתיקון: https://shop.example.test/article/a1'])assert.ok(text.includes(part),'text missing: '+part);
assert.ok(mail.fixRequestEmailHtml({...m,name:'',orderNumber:''}).indexOf('שלום')<0);
writeFileSync('.sites-runtime/fix-request-mail.html',html);

// One family (owner, 22.11.2026): cancelled and published look the same and never say who asked.
const base={origin:m.origin,site:m.site,siteUrl:m.siteUrl,title:'כותרת',orderNumber:'#1003',name:'דנה',url:m.url};
const cancelled=mail.cancelledEmailHtml({...base,note:'האתר הפסיק לקבל כתבות בנושא.',full:true,refund:'₪100.00 זוכו ליתרה בחשבון שלך'});
for(const part of ['המאמר שלך לאתר אתר בדיקה בוטל','המאמר בוטל','סיבת הביטול','האתר הפסיק לקבל כתבות בנושא.','הזיכוי','זוכו ליתרה','צפייה בפרטי המאמר','href="https://shop.example.test/article/a1"','מספר הזמנה','קיבלת את המייל כי יש לך חשבון ב-Mega Links'])assert.ok(cancelled.includes(part),'cancelled missing: '+part);
assert.equal(mail.cancelledSubject('אתר בדיקה',false),'פרסום המאמר שלך באתר אתר בדיקה בוטל');
assert.ok(mail.cancelledEmailHtml({...base,note:'x',full:false}).includes('שירות הכתיבה נשאר בהזמנה'));
assert.ok(!mail.cancelledEmailHtml({...base,note:'x',full:true}).includes('הזיכוי'),'no refund row without a refund');
assert.ok(mail.cancelledText({...base,note:'סיבה',full:true,refund:'₪1'}).includes('סיבת הביטול:\nסיבה'));
const published=mail.publishedEmailHtml({...base,publishedUrl:'https://www.site.example.test/news/story-1',publishedOn:'22.11.2026'});
for(const part of ['המאמר שלך פורסם באתר אתר בדיקה','המאמר פורסם','הקישור לכתבה','www.site.example.test/news/story-1','href="https://www.site.example.test/news/story-1"','לצפייה בכתבה שפורסמה','תאריך הפרסום','22.11.2026','כניסה לאזור האישי'])assert.ok(published.includes(part),'published missing: '+part);
assert.ok(mail.publishedText({...base,publishedUrl:'https://x.test/a'}).includes('הקישור לכתבה:\nhttps://x.test/a'));
for(const page of [html,text,cancelled,published,mail.cancelledText({...base,note:'x',full:true}),mail.publishedText({...base,publishedUrl:'https://x.test/a'})])assert.ok(!/ספק/.test(page),'the customer never reads about the supplier');
writeFileSync('.sites-runtime/article-cancelled-mail.html',cancelled);writeFileSync('.sites-runtime/article-published-mail.html',published);

// The updates feed: the note saved on the article wins; the new subject still links an older email to its article.
const article={id:'a1',status:'revisions',title:'כותרת',website_name:'אתר בדיקה',website_url:'https://www.site.example.test',number:'#1003',updated:'2026-11-22T10:00:00Z',revision_note:'הקישור לא תקין.',revision_requested_at:'2026-11-22T09:00:00Z'};
let [u]=buildClientUpdates([article],[],[],[]);
assert.equal(u.kind,'revision');assert.equal(u.note,'הקישור לא תקין.');assert.equal(u.date,'2026-11-22T09:00:00Z');assert.equal(u.dateLabel,'תאריך הבקשה');assert.equal(u.siteUrl,'https://www.site.example.test');
const notice={subject:'המאמר שלך לאתר אתר בדיקה דורש תיקון',text:'כותרת\nמהמייל',button:{url:'https://shop.example.test/article/a1'},created:'2026-11-22T08:00:00Z'};
[u]=buildClientUpdates([{...article,revision_note:'',revision_requested_at:''}],[],[],[notice]);
assert.equal(u.note,'מהמייל');assert.equal(u.date,'2026-11-22T08:00:00Z');
[u]=buildClientUpdates([{...article,revision_note:'',revision_requested_at:''}],[],[],[{...notice,subject:'המאמר הוחזר לתיקון'}]);
assert.equal(u.note,'מהמייל','older emails keep working');
console.log('fix-request-mail: ok');
