export const schemasQuery = `SELECT nspname AS name FROM pg_catalog.pg_namespace WHERE nspname = ANY($1::text[]) ORDER BY nspname`;
export const tablesQuery = `
SELECT n.nspname AS schema, c.relname AS name, c.oid::text AS oid
FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = ANY($1::text[]) AND c.relkind IN ('r', 'p')
ORDER BY n.nspname, c.relname`;
export const columnsQuery = `
SELECT a.attrelid::text AS table_oid, a.attname AS name,
       pg_catalog.format_type(a.atttypid, a.atttypmod) AS data_type,
       NOT (a.attnotnull OR t.typnotnull) AS nullable
FROM pg_catalog.pg_attribute a
JOIN pg_catalog.pg_type t ON t.oid = a.atttypid
WHERE a.attrelid = ANY($1::oid[]) AND a.attnum > 0 AND NOT a.attisdropped
ORDER BY a.attrelid, a.attnum`;
export const keysQuery = `
SELECT con.conrelid::text AS table_oid, con.conname AS name, con.contype AS kind,
       array_agg(a.attname::text ORDER BY pos.n) AS columns
FROM pg_catalog.pg_constraint con
JOIN LATERAL generate_subscripts(con.conkey, 1) AS pos(n) ON true
JOIN pg_catalog.pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = con.conkey[pos.n]
WHERE con.conrelid = ANY($1::oid[]) AND con.contype IN ('p', 'u')
GROUP BY con.oid, con.conrelid, con.conname, con.contype
ORDER BY con.conrelid, con.conname`;
export const foreignKeysQuery = `
SELECT con.oid::text AS constraint_oid, con.conname AS name,
       src_ns.nspname AS source_schema, src.relname AS source_table,
       src_col.attname AS source_column,
       dst_ns.nspname AS target_schema, dst.relname AS target_table,
       dst_col.attname AS target_column, pos.n AS column_position,
       con.confdeltype AS on_delete_code, con.confupdtype AS on_update_code
FROM pg_catalog.pg_constraint con
JOIN pg_catalog.pg_class src ON src.oid = con.conrelid
JOIN pg_catalog.pg_namespace src_ns ON src_ns.oid = src.relnamespace
JOIN pg_catalog.pg_class dst ON dst.oid = con.confrelid
JOIN pg_catalog.pg_namespace dst_ns ON dst_ns.oid = dst.relnamespace
JOIN LATERAL generate_subscripts(con.conkey, 1) AS pos(n) ON true
JOIN pg_catalog.pg_attribute src_col ON src_col.attrelid = con.conrelid AND src_col.attnum = con.conkey[pos.n]
JOIN pg_catalog.pg_attribute dst_col ON dst_col.attrelid = con.confrelid AND dst_col.attnum = con.confkey[pos.n]
WHERE con.contype = 'f' AND con.conrelid = ANY($1::oid[])
ORDER BY src_ns.nspname, src.relname, con.conname, pos.n`;
