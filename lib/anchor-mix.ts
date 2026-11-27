// Link phrases (anchors) by type, shared by the server and the "מצאו לי אתרים מתאימים" window (owner 27.11.2026).
// Types: brand (the business name), naked (the address itself), exact (a keyword as is), partial (a phrase that
// contains a keyword's words), other. The starting mix is common industry practice, not a Google rule.
export type AnchorType='brand'|'naked'|'exact'|'partial'|'other';
export const anchorTypeLabels:Record<AnchorType,string>={brand:'מותג',naked:'כתובת האתר',partial:'חלקי',exact:'מדויק',other:'אחר'};
export const anchorTarget:Record<AnchorType,number>={brand:.35,naked:.15,partial:.35,exact:.1,other:.05};

/** The site's host, lowercase and without "www.", or '' when it is not an address. */
export function siteDomain(value:string){
 const raw=String(value||'').trim();if(!raw)return '';
 try{return new URL(/^https?:\/\//i.test(raw)?raw:'https://'+raw).hostname.replace(/^www\./i,'').toLowerCase();}catch{return '';}
}
/** The brand words a domain suggests: "run-shop.co.il" -> ["run","shop","runshop"]. */
export function brandWords(domain:string,brand=''){
 const label=siteDomain(domain).split('.')[0]||'';const words=new Set<string>();
 if(label){words.add(label);for(const w of label.split(/[-_]/))if(w.length>1)words.add(w);}
 for(const w of String(brand||'').toLowerCase().split(/\s+/))if(w.length>1)words.add(w);
 return [...words];
}
const norm=(v:string)=>String(v||'').toLowerCase().replace(/[^\p{L}\p{N}\s.-]/gu,' ').replace(/\s+/g,' ').trim();
export function classifyAnchor(anchor:string,{domain='',brand='',keywords=[] as string[]}={}):AnchorType{
 const a=norm(anchor);if(!a)return 'other';
 const d=siteDomain(domain);
 // the address is checked on the raw text: norm() turns "https://" into "https ".
 const raw=String(anchor||'').trim().toLowerCase();
 if(/^(https?:\/\/|www\.)/.test(raw)||d&&raw.replace(/^https?:\/\//,'').replace(/^www\./,'').startsWith(d))return 'naked';
 const compact=a.replace(/[\s.-]/g,'');
 if(brandWords(d,brand).some(w=>w.length>2&&compact.includes(w.replace(/[\s.-]/g,''))))return 'brand';
 const keys=keywords.map(norm).filter(Boolean);
 if(keys.some(k=>a===k))return 'exact';
 if(keys.some(k=>k.split(' ').filter(w=>w.length>1).every(w=>a.includes(w))))return 'partial';
 return 'other';
}
export function anchorCounts(list:{anchor:string}[],context:Parameters<typeof classifyAnchor>[1]){
 const counts:Record<AnchorType,number>={brand:0,naked:0,partial:0,exact:0,other:0};
 for(const item of list)counts[classifyAnchor(item.anchor,context)]++;
 return counts;
}
