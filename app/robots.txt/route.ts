import {SITE_URL} from '@/lib/seo';
export function GET(){return new Response(`User-agent: *\nAllow: /\nAllow: /api/catalog$\nAllow: /api/catalog-logo/\nAllow: /api/knowledge-media/\nAllow: /api/branding$\nAllow: /api/me$\nDisallow: /api/\nDisallow: /mcp\nSitemap: ${SITE_URL}/sitemap.xml\n`,{headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'public, max-age=3600'}});}
