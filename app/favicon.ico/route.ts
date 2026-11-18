// Browsers and some crawlers still ask for /favicon.ico; the site icon is the PNG declared in the page head (SEO audit 18.11.2026).
export function GET(){return new Response(null,{status:301,headers:{Location:'/brand/loader-m.png','Cache-Control':'public, max-age=86400'}});}
