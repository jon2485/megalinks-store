import React from 'react';
import {ExternalLink} from 'lucide-react';
export default function SiteReference({name,url}:{name?:string;url?:string}){
 let href='',label='';try{const u=new URL(/^https?:\/\//i.test(url||'')?url!:'https://'+url);if(url&&['http:','https:'].includes(u.protocol)&&u.hostname.includes('.')&&!u.username&&!u.password){href=u.href;label=u.hostname+(u.pathname==='/'?'':u.pathname)+u.search;}}catch{}
 return <span className="site-reference"><strong>{name||label||'אתר'}</strong>{href&&<a href={href} target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()} aria-label={'פתיחת '+label+' בחלון חדש'}><bdi dir="ltr">{label}</bdi><ExternalLink size={13} aria-hidden="true"/></a>}</span>;
}
