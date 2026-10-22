import type {Row} from './shared';
import {displayPublicationDay} from './publication-date';

// Publication instructions belong in the message, never in the article attachment.
export function supplierPublicationNotes(article:Row):string {
    const data=typeof article.data==='string'?JSON.parse(article.data):article.data||article;
    return [
        ['מועד הפרסום המבוקש',data.scheduled?displayPublicationDay(data.scheduled):''],
        ['תיאור קצר / תיאור מטא',data.meta_description],
        ['הערות לפרסום',data.client_notes],
        ['הנחיות המנהל לפרסום',data.admin_notes],
    ].filter(([,value])=>String(value||'').trim()).map(([label,value])=>label+':\n'+String(value).trim()).join('\n\n');
}
