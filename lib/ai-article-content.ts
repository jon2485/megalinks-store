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
    for (const suffix of ['', '_2']) {
        const url = brief['target_url' + suffix], anchor = String(brief['anchor' + suffix] || url || '');
        if (!url) continue;
        const safeUrl = httpUrl(url).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
        const label = textToHtml(anchor).slice(3, -4), link = `<a href="${safeUrl}" rel="noopener noreferrer">${label}</a>`;
        let placed = false, insideLink = false;
        html = await new HTMLRewriter().on('a', { element(el: any) { insideLink = true; el.onEndTag(() => { insideLink = false; }); } }).on('p', { text(chunk: any) {
            if (!placed && !insideLink && chunk.text.includes(anchor)) {
                const [before, ...after] = chunk.text.split(anchor);
                chunk.replace(textToHtml(before).slice(3, -4) + link + textToHtml(after.join(anchor)).slice(3, -4), { html: true });
                placed = true;
            }
        } }).transform(new Response(html)).text();
        if (!placed) html += '<p>' + link + '</p>';
    }
    return html;
}
