/** Keep each compound SELECT below the Worker's SQLite expression limits. */
export function adminUnionCtes(name:string,sources:string[]):string{
 const ctes:string[]=[];
 let level=sources,depth=0;
 while(level.length>3){
  const next:string[]=[];
  for(let i=0;i<level.length;i+=3){const id=`${name}_${depth}_${i/3}`;ctes.push(`${id} AS (${level.slice(i,i+3).join(' UNION ALL ')})`);next.push(`SELECT * FROM ${id}`);}
  level=next;depth++;
 }
 ctes.push(`${name} AS (${level.join(' UNION ALL ')})`);
 return ctes.join(',');
}
