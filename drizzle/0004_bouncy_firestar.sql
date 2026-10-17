-- Public order numbers; internal IDs and all ownership links remain unchanged.
CREATE TABLE order_numbers (
 sequence INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
 order_id TEXT NOT NULL,
 legacy_number TEXT NOT NULL DEFAULT ''
);
--> statement-breakpoint
CREATE UNIQUE INDEX order_numbers_order_id_unique ON order_numbers(order_id);
--> statement-breakpoint
INSERT INTO order_numbers(sequence,order_id,legacy_number)
SELECT 1000+ROW_NUMBER() OVER (ORDER BY created,id),id,number FROM orders ORDER BY created,id;
--> statement-breakpoint
UPDATE sqlite_sequence SET seq=MAX(seq,1000) WHERE name='order_numbers';
--> statement-breakpoint
INSERT INTO sqlite_sequence(name,seq) SELECT 'order_numbers',1000 WHERE NOT EXISTS (SELECT 1 FROM sqlite_sequence WHERE name='order_numbers');
--> statement-breakpoint
UPDATE orders SET data=json_set(data,'$.legacy_number',number),number=(SELECT '#'||sequence FROM order_numbers WHERE order_id=orders.id);
--> statement-breakpoint
CREATE UNIQUE INDEX orders_number ON orders(number);
--> statement-breakpoint
UPDATE records SET data=json_set(data,'$.number',(SELECT number FROM orders WHERE id=json_extract(records.data,'$.id'))) WHERE kind='checkout' AND EXISTS(SELECT 1 FROM orders WHERE id=json_extract(records.data,'$.id'));
--> statement-breakpoint
UPDATE ledger SET reason=(SELECT CASE WHEN ledger.reference='order:'||o.id THEN 'תשלום הזמנה ' ELSE 'החזר הזמנה ' END||o.number FROM orders o WHERE ledger.reference IN ('order:'||o.id,'refund:'||o.id)) WHERE EXISTS(SELECT 1 FROM orders o WHERE ledger.reference IN ('order:'||o.id,'refund:'||o.id));
--> statement-breakpoint
UPDATE records SET data=json_set(data,'$.rows',json((SELECT json_group_array(json_set(j.value,'$.number',COALESCE((SELECT number FROM orders WHERE id=json_extract(j.value,'$.order_id')),json_extract(j.value,'$.number')))) FROM json_each(records.data,'$.rows') j))) WHERE kind='monthly_statement' AND json_type(data,'$.rows')='array';
