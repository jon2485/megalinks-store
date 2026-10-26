/** Queue membership is shared by the server's distinct task counts and navigation. */
export const adminPageQueues: Record<string, readonly string[]> = {
 'admin-seller-requests':['seller_requests','seller_invoices'],
 'admin-orders':['bank','payment_reports','cancellations'],
 'admin-payment-reports':['payment_reports'],'admin-invoices':['invoices'],
 'admin-topups':['topups'],'admin-monthly':['monthly'],
 'admin-approvals':['content'],'admin-articles':['content','writing','publication','revisions'],
 'admin-publication':['publication','tracking','delivery','revisions'],'admin-support':['support'],
 'admin-websites':['prices','pricing_review','sync'],'admin-pricing':['pricing_review'],
 'admin-pricebooks':['pricing_review'],'admin-supplier-finance':['supplier_due'],
 'admin-notifications':['mail'],'admin-jobs':['connections'],
 'admin-connections':['connections','mail'],
};
