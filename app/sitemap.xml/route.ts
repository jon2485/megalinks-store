import {SITE_URL,INDEXABLE_PATHS} from '@/lib/seo';
export function GET(){return new Response('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+INDEXABLE_PATHS.map(path=>`<url><loc>${SITE_URL}${path}</loc></url>`).join('')+'</urlset>',{headers:{'Content-Type':'application/xml; charset=utf-8','Cache-Control':'public, max-age=3600'}});}
