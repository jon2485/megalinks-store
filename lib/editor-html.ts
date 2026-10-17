// Shared between the browser importer and the server persistence boundary.
export const editorialTags = new Set(['p','br','div','span','strong','b','em','i','u','s','h1','h2','h3','h4','h5','h6','ul','ol','li','blockquote','a','figure','figcaption','img','table','thead','tbody','tr','th','td']);
export const blockedEditorialTags = new Set(['script','style','iframe','object','embed','svg','math','template','form','input','button','video','audio','link','meta']);
export function safeEditorialStyle(style:string) {
    return style.split(';').flatMap(part=>{
        const split=part.indexOf(':');if(split<0)return [];
        const key=part.slice(0,split).trim().toLowerCase(),value=part.slice(split+1).trim();
        const color=/^(#[\da-f]{3,8}|rgba?\(\s*[\d.,%\s]+\)|[a-z]{3,20})$/i;
        const size=/^(\d{1,3}(\.\d+)?)(px|pt|em|rem|%)$/;
        const valid=(['color','background-color'].includes(key)&&color.test(value)) ||
            (['font-size','margin-top','margin-bottom','padding-left','padding-right'].includes(key)&&size.test(value)&&parseFloat(value)<=120) ||
            (key==='font-family'&&/^[\w\s,"'\-\u0590-\u05ff]{1,100}$/.test(value)) ||
            (key==='text-align'&&/^(right|left|center|justify)$/.test(value)) ||
            (key==='direction'&&/^(rtl|ltr)$/.test(value)) ||
            (key==='font-weight'&&/^(bold|normal|[1-9]00)$/.test(value)) ||
            (key==='font-style'&&/^(italic|normal)$/.test(value)) ||
            (key==='text-decoration'&&/^(underline|line-through|none)$/.test(value)) ||
            (key==='line-height'&&/^[1-3](\.\d{1,2})?$/.test(value));
        return valid?[`${key}:${value}`]:[];
    }).join(';');
}
export function editorialUrl(value:string) {try {const u=new URL(value);return ['https:','http:'].includes(u.protocol)?u.href:'';}catch{return '';}}
export function editorialFileId(src:string) {return /^\/api\/files\/([a-zA-Z0-9_-]{1,100})$/.exec(src)?.[1]||'';}
