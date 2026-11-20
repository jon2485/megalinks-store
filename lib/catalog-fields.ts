// Catalog values shared by the sheet sync and the catalog save.
export const MONTHLY='חודשי';
// Stock types in the sheet (owner, 20.11.2026): "מלאי" (packages bought in advance), "חודשי" and "החלפה".
// "החלפה" is stored as its own type now; how it behaves is still to be specified by the owner.
export const STOCK_WORD='מלאי',EXCHANGE='החלפה';
export const stockWord=(text:string)=>{const t=text.trim();return t===MONTHLY?MONTHLY:t===STOCK_WORD?STOCK_WORD:/^החלפ(ה|ות)$/.test(t)?EXCHANGE:'';};
// A supplier cell may list several addresses (owner, 20.11.2026): every one of them gets the supplier mail.
export const emailList=(text:unknown)=>[...new Set((String(text??'').replace(/[\u200e\u200f\u202a-\u202e]/g,' ').match(/[^\s@,;<>"']+@[^\s@,;<>"']+\.[^\s@,;<>"']+/g)||[]).map(e=>e.toLowerCase()))];
