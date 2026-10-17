export const supportStatusLabels = {
    awaiting_reply: 'ממתין לתשובה',
    answered: 'תשובה התקבלה',
    resolved: 'הפנייה טופלה',
} as const;
export type SupportStatus = keyof typeof supportStatusLabels;
// Read older tickets without changing their stored history.
export function supportStatus(ticket: { status?: string; reply?: string }): SupportStatus {
    if (ticket.status === 'resolved' || ticket.status === 'closed') return 'resolved';
    if (ticket.status === 'answered') return 'answered';
    if (ticket.status === 'awaiting_reply') return 'awaiting_reply';
    return ticket.reply?.trim() ? 'answered' : 'awaiting_reply';
}
