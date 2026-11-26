// Bulk order AI after payment (owner 26.11.2026): wiring checks on the real source (no AI calls, no database).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const route = readFileSync('app/api/[...path]/route.ts', 'utf8');
assert.match(route, /auto_ai: input\.auto_ai === true && input\.editorial !== true/, 'the cart keeps the AI choice, never together with professional writing');
const fn = route.slice(route.indexOf('async function autoAiDrafts('), route.indexOf('async function prepareAiDraft('));
assert(fn.length > 200, 'autoAiDrafts exists before the shared draft function');
assert.match(fn, /if \(!\(c\.enabled && c\.secret\)\) return/, 'nothing runs without AI configured');
assert.match(fn, /canWorkOrder\(o\) && !o\.demo/, 'only paid (workable) orders, never demo');
assert.match(fn, /status='draft'/); assert.match(fn, /auto_ai_started/, 'each article is claimed once');
assert.match(fn, /!String\(a\.content \|\| ''\)\.trim\(\)/, 'never overwrites text the customer already wrote');
assert.match(fn, /prepareAiDraft\(a, u, c\)/, 'reuses the article generation');
assert(!/status='(sent|approved|published)'/.test(fn.replace("status='draft'", '')), 'the draft is not sent automatically');
assert.match(fn, /'email:ai-drafts:' \+ orderId/, 'one email per order');
assert.match(fn, /mapIn\('orders'/); assert.match(fn, /mapIn\('users'/, 'orders and users read once, not per article');
assert.match(route, /const daily=await sendDailySummary\(origin\)\.catch\(\(\)=>\(\{\}\)\);waitUntil\(autoAiDrafts\(origin\)/, 'runs from the every-minute maintenance tick');
assert.match(route, /const \{job,execute\}=await prepareAiDraft\(a,u,c\);/, 'the article button uses the same generation');
assert.match(route, /p\[0\] === 'bulk-options' && method === 'GET'/);
console.log('BULK AUTO AI PASSED: kept on the cart item, paid orders only, once per article, shared generation, one email per order, maintenance tick.');
