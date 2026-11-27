import { Row, httpUrl, textToHtml } from './shared';
import { sanitizeRichHtml } from './rich-content';

// AI output is editorial HTML. Recognize explicit legacy heading markers as a
// fallback, without treating ordinary mentions of H2 inside a sentence as markup.
function headingText(line: string) {
    return line.trim().replace(/^\*\*(.*?)\*\*$/, '$1').match(/^(?:#{1,6}\s+|\[H2\]\s*[:：-]?\s*|H2(?:\s*[:：-]\s*|\s+))(.+)$/i)?.[1]?.trim();
}
function plainArticleHtml(input: string) {
    const blocks: string[] = [], paragraph: string[] = [];
    const flush = () => { if (paragraph.length) blocks.push(textToHtml(paragraph.splice(0).join('\n'))); };
    const lines = input.split('\n');
    for (let i = 0; i < lines.length; i++) {
        let line = lines[i].trim();
        if (/^(?:\[H2\]|H2)\s*[:：]?$/i.test(line)) {
            let next = i + 1;
            while (next < lines.length && !lines[next].trim()) next++;
            if (next < lines.length) { line = 'H2: ' + lines[next].trim(); i = next; }
        }
        const heading = headingText(line);
        if (heading) { flush(); blocks.push('<h2>' + textToHtml(heading).slice(3, -4) + '</h2>'); }
        else if (!line) flush();
        else paragraph.push(lines[i]);
    }
    flush();
    return blocks.join('');
}
export async function aiArticleHtml(input: string, brief: Row) {
    let html = input.trim().replace(/^```(?:html)?\s*\n?/i, '').replace(/\n?```\s*$/, '');
    if (!/<\/?(?:p|h[1-6]|div|ul|ol|li|blockquote|table)\b/i.test(html)) html = plainArticleHtml(html);
    // Legacy providers sometimes put "H2: title" inside an HTML paragraph.
    html = html.replace(/<p\b[^>]*>([^<]+)<\/p>/gi, (block, value: string) => {
        const heading = headingText(value);
        return heading ? '<h2>' + heading + '</h2>' : block;
    });
    html = await new HTMLRewriter()
        .on('h1,h2,h3,h4,h5,h6', { element(el: any) {
            el.tagName = 'h2';
            for (const [name] of Array.from(el.attributes as Iterable<[string, string]>)) el.removeAttribute(name);
        } })
        // Links come only from the customer's brief, never invented by the model.
        .on('a', { element(el: any) { el.removeAndKeepContent(); } })
        .transform(new Response(html)).text();
    html = await sanitizeRichHtml(html);
    return placeLinks(html, brief);
}


// Owner 27.11.2026, following Google's link guidance (descriptive anchor, the words around it explain it, links spaced
// apart, no keyword stuffing): each link phrase becomes a link where the article already says it, inside a body
// paragraph and outside any other link; the two phrases go in different paragraphs when possible. A phrase the model
// did not write is woven into the most related body paragraph, never added as a lone line at the end.
const escapeText = (value: string) => textToHtml(value).slice(3, -4);
function linkInParagraph(paragraph: string, label: string, link: string) {
    const parts = paragraph.split(/(<[^>]+>)/);
    let insideLink = 0;
    for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (part.startsWith('<')) { if (/^<a\b/i.test(part)) insideLink++; else if (/^<\/a>/i.test(part)) insideLink = Math.max(0, insideLink - 1); continue; }
        const at = insideLink ? -1 : part.indexOf(label);
        if (at >= 0) { parts[i] = part.slice(0, at) + link + part.slice(at + label.length); return parts.join(''); }
    }
    return null;
}
const words = (value: string) => value.replace(/<[^>]*>/g, ' ').replace(/&[a-z]+;/g, ' ').split(/[^\p{L}\p{N}]+/u).filter(word => word.length > 2);
function placeLinks(html: string, brief: Row) {
    const used = new Set<number>();
    for (const suffix of ['', '_2']) {
        const url = brief['target_url' + suffix];
        if (!url) continue;
        const anchor = String(brief['anchor' + suffix] || url || '').trim();
        const safeUrl = httpUrl(url).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
        const label = escapeText(anchor), link = `<a href="${safeUrl}" rel="noopener noreferrer">${label}</a>`;
        const paragraphs = [...html.matchAll(/<p\b[^>]*>[\s\S]*?<\/p>/gi)];
        if (!paragraphs.length) { html += '<p>' + link + '</p>'; continue; }
        // Where the article already says it: the earliest paragraph, one that has no link of ours yet first.
        const order = paragraphs.map((_, i) => i).sort((x, y) => Number(used.has(x)) - Number(used.has(y)) || x - y);
        let placed = false;
        for (const i of order) {
            const found = linkInParagraph(paragraphs[i][0], label, link);
            if (found === null) continue;
            html = html.slice(0, paragraphs[i].index) + found + html.slice(paragraphs[i].index! + paragraphs[i][0].length);
            used.add(i); placed = true; break;
        }
        if (placed) continue;
        // Not written by the model: the body paragraph that shares most words with the phrase (not the closing one).
        const last = paragraphs.length > 2 ? paragraphs.length - 1 : paragraphs.length;
        const anchorWords = new Set(words(anchor));
        let best = -1, bestScore = -1;
        for (let i = 0; i < last; i++) {
            if (used.has(i) && last > used.size) continue;
            const score = words(paragraphs[i][0]).filter(word => anchorWords.has(word)).length * 10 - Math.abs(i - (used.size ? Math.ceil(last / 2) : 1));
            if (score > bestScore) { best = i; bestScore = score; }
        }
        if (best < 0) best = 0;
        const target = paragraphs[best], close = target[0].lastIndexOf('</p>');
        const woven = target[0].slice(0, close).replace(/\s+$/, '') + ' למידע נוסף: ' + link + '.' + target[0].slice(close);
        html = html.slice(0, target.index) + woven + html.slice(target.index! + target[0].length);
        used.add(best);
    }
    return html;
}
