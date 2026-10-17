"""Verify renumbering a populated database without changing order identities."""
import sqlite3, json
from pathlib import Path

db = sqlite3.connect(':memory:')
db.executescript('''
CREATE TABLE orders(id TEXT PRIMARY KEY,number TEXT,created TEXT,data TEXT);
CREATE TABLE records(id TEXT PRIMARY KEY,kind TEXT,data TEXT);
CREATE TABLE ledger(reference TEXT,reason TEXT);
''')
for id_, stamp in [('b','2026-10-01'),('a','2026-10-01'),('c','2026-10-02')]:
    db.execute('INSERT INTO orders VALUES (?,?,?,?)',(id_,'PF-'+id_,stamp,'{"demo":true}'))
db.execute('INSERT INTO records VALUES (?,?,?)',('checkout-b','checkout',json.dumps({'id':'b','number':'PF-b'})))
db.execute('INSERT INTO records VALUES (?,?,?)',('month','monthly_statement',json.dumps({'rows':[{'order_id':'b','number':'PF-b','amount':500},{'order_id':'c','number':'PF-c','amount':1000}]})))
db.execute('INSERT INTO ledger VALUES (?,?)',('order:b','תשלום הזמנה PF-b'))
db.execute('INSERT INTO ledger VALUES (?,?)',('refund:c','החזר הזמנה PF-c'))
for part in Path('drizzle/0004_bouncy_firestar.sql').read_text().split('--> statement-breakpoint'):
    if part.strip(): db.execute(part)
assert db.execute('SELECT id,number FROM orders ORDER BY created,id').fetchall()==[('a','#1001'),('b','#1002'),('c','#1003')]
assert json.loads(db.execute("SELECT data FROM orders WHERE id='b'").fetchone()[0])=={'demo':True,'legacy_number':'PF-b'}
assert json.loads(db.execute("SELECT data FROM records WHERE id='checkout-b'").fetchone()[0])['number']=='#1002'
rows=json.loads(db.execute("SELECT data FROM records WHERE id='month'").fetchone()[0])['rows']
assert [r['number'] for r in rows]==['#1002','#1003'] and sum(r['amount'] for r in rows)==1500
assert db.execute('SELECT reason FROM ledger ORDER BY reference').fetchall()==[('תשלום הזמנה #1002',),('החזר הזמנה #1003',)]
db.execute("INSERT INTO order_numbers(order_id) VALUES ('new')")
assert db.execute("SELECT sequence FROM order_numbers WHERE order_id='new'").fetchone()[0]==1004
# Removing an allocation must never cause a previously issued number to be reused.
db.execute("DELETE FROM order_numbers WHERE order_id='new'")
db.execute("INSERT INTO order_numbers(order_id) VALUES ('next')")
assert db.execute("SELECT sequence FROM order_numbers WHERE order_id='next'").fetchone()[0]==1005
print('Populated migration: chronological numbers, preserved IDs/data, cached checkout, monthly reports, ledger and no reuse passed.')
