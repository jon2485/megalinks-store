import {BUSINESS,INDEXABLE_PATHS,SITE_URL,legalPublished} from '@/lib/seo';
import {LEGAL_DOCS} from '@/lib/legal-docs';
import {publicKnowledgeList} from '@/lib/knowledge-server';
import {knowledgePath} from '@/lib/knowledge';
import {PR_INTERVIEW_CENTS,prSites} from '@/lib/pr';
import {prMoney} from '@/lib/pr-render';

// /llms.txt (llmstxt.org): a short, plain-text map of the site for AI assistants and agents, read without running scripts.
// Google says it does not need it; ChatGPT, Claude, Perplexity and buying agents can use it. Only public facts that the
// pages themselves show: no costs, suppliers or customer prices (SEO audit 18.11.2026).
export const dynamic='force-dynamic';
const line=(text:unknown)=>String(text??'').replace(/\s+/g,' ').trim();
export async function GET(){
    let guides:{title:string;slug:string;excerpt:string}[]=[],sites:Awaited<ReturnType<typeof prSites>>=[];
    try{guides=(await publicKnowledgeList(1)).articles.slice(0,24);}catch{}
    try{sites=await prSites();}catch{}
    const legal=LEGAL_DOCS.filter(doc=>legalPublished(doc.id));
    const text=[
`# MegaLinks (${BUSINESS.hebrewName})`,
'',
'> מערכת ישראלית לפרסום כתבות ממומנות וקניית קישורים באתרים בישראל, לכתבות יח״צ באתרי חדשות עם ראיון טלפוני, ולכתיבת תוכן. מחירון אתרים גלוי, הזמנה אונליין ומעקב אחרי כל פרסום עד הקישור החי.',
'',
'MegaLinks (Mega Links) is an Israeli platform for sponsored article placements and backlinks on Israeli websites, PR articles in major news sites written after a phone interview, and article writing. Content is in Hebrew.',
'',
'## עובדות עיקריות',
'- למי: בעלי עסקים, מקדמי אתרים (SEO), סוכנויות ובעלי אתרים.',
'- פרסום כתבה: בוחרים אתר מהמחירון, כותבים בעצמכם, עם AI או עם כותב מקצועי, והכתבה מתפרסמת באתר. הלקוח מקבל קישור לכתבה החיה.',
`- כתבות יח״צ: מראיין מקצועי מתקשר בימים ובשעות שהלקוח בוחר, כותב את הכתבה מתוך השיחה, והיא מתפרסמת באתר החדשות שנבחר. ${prMoney(PR_INTERVIEW_CENTS)} לראיון וכתיבה לכל כתבה, ועוד מחיר הפרסום באתר. סבב תיקונים אחד כלול. ראיון אחד יכול להפיק כמה כתבות שונות לכמה אתרים.`,
'- מחירים: לכל אתר מחיר משלו במחירון, לפני מע״מ.',
'- כל כתבה מסומנת כתוכן שיווקי לפי הכללים של האתר המפרסם. הכתבה נשארת באוויר לפחות שנה.',
'- אם אתר לא מפרסם בסוף: הלקוח מקבל הודעה ובוחר בין זיכוי לבין אתר אחר שווה ערך.',
'- תשלום: כרטיס אשראי, העברה בנקאית או יתרה בחשבון.',
`- העסק: ${BUSINESS.legalName} (${BUSINESS.hebrewName}), עוסק מורשה ${BUSINESS.vatId}, ${BUSINESS.postOfficeBox}, ${BUSINESS.locality}, ישראל. טלפון ו-WhatsApp: 050-750-8850 (${BUSINESS.whatsapp}).`,
'',
'## עמודים עיקריים',
`- [דף הבית](${SITE_URL}/): מה MegaLinks עושה, איך זה עובד ושאלות נפוצות.`,
`- [מחירון אתרים](${SITE_URL}/catalog): אתרים לפרסום כתבות וקישורים, עם תחום, DR, UR, זמן פרסום ומחיר לכל אתר.`,
`- [כתבות יח״צ](${SITE_URL}/pr): כתבה על העסק באתרי חדשות גדולים, עם ראיון טלפוני, כתיבה ופרסום.`,
...(INDEXABLE_PATHS.includes('/knowledge')?[`- [מדריכים וידע](${SITE_URL}/knowledge): מדריכים על קניית קישורים, פרסום כתבות וקידום בגוגל.`]:[]),
...(sites.length?['','## אתרים לכתבות יח״צ (המחיר כולל ראיון וכתיבה, לפני מע״מ)',...sites.map(s=>`- ${line(s.name)} (${s.host}): החל מ-${prMoney(s.total_cents)}${s.description?'. '+line(s.description):''}`)]:[]),
...(guides.length?['','## מדריכים',...guides.map(g=>`- [${line(g.title)}](${SITE_URL}${knowledgePath(g.slug)})${g.excerpt?': '+line(g.excerpt):''}`)]:[]),
...(legal.length?['','## מדיניות',...legal.map(doc=>`- [${doc.title}](${SITE_URL}${doc.path}): ${doc.summary}`)]:[]),
''].join('\n');
    return new Response(text,{headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'public, max-age=3600'}});
}
