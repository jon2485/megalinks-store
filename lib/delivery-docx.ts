import {env} from 'cloudflare:workers';
import {one,assert} from './server';
import {Row} from './shared';
import {richArticleDocx} from './rich-docx';
// Every customer, supplier and email attachment uses the same generator.
export async function articleDocx(a:Row){const data=typeof a.data==='string'?JSON.parse(a.data):a.data||a;return richArticleDocx(a.title||'',a.content||'',data,async id=>{const f=await one('SELECT * FROM files WHERE id=?',id);assert(f&&f.type.startsWith('image/'),'תמונה במאמר לא נמצאה. העלו אותה מחדש.');const blob=await env.BUCKET?.get(f.key);assert(blob,'קובץ תמונה במאמר חסר. העלו אותו מחדש.');return {bytes:new Uint8Array(await blob.arrayBuffer()),type:f.type};});}
