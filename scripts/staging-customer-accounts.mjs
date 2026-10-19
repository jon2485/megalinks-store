// Additional test logins; existing owner credentials never need to be read or replaced.
export function appendStagingCustomers(accounts, customers, owner) {
  if (!Array.isArray(accounts) || !Array.isArray(customers)) throw new Error('Invalid staging account list');
  const ids = new Set(accounts.map(a => a.id));
  const emails = new Set(accounts.map(a => String(a.email).trim().toLowerCase()));
  const extra = customers.map(a => {
    const email = String(a.email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email === String(owner).trim().toLowerCase() ||
        typeof a.id !== 'string' || !a.id.startsWith('staging-customer-') || /[\r\n]/.test(a.id) ||
        ids.has(a.id) || emails.has(email) || (a.role && a.role !== 'customer') ||
        !/^[a-f0-9]{32}$/.test(a.salt || '') || !/^[a-f0-9]{128}$/.test(a.hash || '')) {
      throw new Error('Invalid or duplicate staging customer account');
    }
    ids.add(a.id); emails.add(email);
    return {id:a.id,email,name:String(a.name || 'לקוח בדיקה'),salt:a.salt,hash:a.hash};
  });
  return [...accounts, ...extra];
}
