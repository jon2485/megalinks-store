import type {Row} from './shared';

// A support ticket is a conversation between the customer and the team (10.11.2026).
// The opening request stays in data.message, so editing the ticket details also edits the
// first bubble. Everything after it lives in data.messages. Older tickets have one reply only;
// it is read as the first team message, without changing what is stored.
export type TicketMessage={id:string;from:'customer'|'team';text:string;at:string;author?:string};

const valid=(m:Row)=>!!m&&typeof m.text==='string'&&!!m.text.trim()&&(m.from==='customer'||m.from==='team');

/** The messages after the opening request. */
export function ticketFollowUps(data:Row,updated?:string):TicketMessage[]{
 if(Array.isArray(data.messages))return data.messages.filter(valid);
 return String(data.reply||'').trim()?[{id:'legacy-reply',from:'team',text:String(data.reply),at:String(data.replied_at||updated||'')}]:[];
}

/** The whole conversation, opening request first. */
export function ticketThread(data:Row,created?:string,updated?:string):TicketMessage[]{
 const opening:TicketMessage[]=String(data.message||'').trim()?[{id:'opening',from:'customer',text:String(data.message),at:String(data.created_at||created||'')}]:[];
 return [...opening,...ticketFollowUps(data,updated)];
}

/** A closed ticket stays closed for the customer; they open a new one instead. */
export function ticketClosed(data:Row){return ['resolved','closed'].includes(String(data.status||''));}
