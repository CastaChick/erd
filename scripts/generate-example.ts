import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { generateWithSvg, type SchemaGraph, type TableInfo } from '../src/main.js';

// Fictional store metadata only: no database connection or customer records.
const table = (name: string, fields: [string, string, boolean?][]): TableInfo => ({
  schema: 'public', name,
  columns: fields.map(([name, dataType, nullable = false]) => ({
    name, dataType, nullable, primaryKey: name === 'id', unique: false,
  })),
  primaryKey: ['id'], uniqueConstraints: [],
});
const schema: SchemaGraph = {
  tables: [
    table('customers', [['id', 'uuid'], ['email', 'text'], ['name', 'text']]),
    table('orders', [['id', 'uuid'], ['customer_id', 'uuid'], ['status', 'text'], ['created_at', 'timestamp with time zone']]),
    table('order_items', [['id', 'uuid'], ['order_id', 'uuid'], ['product_id', 'uuid'], ['quantity', 'integer']]),
    table('payments', [['id', 'uuid'], ['order_id', 'uuid'], ['amount', 'numeric(10,2)']]),
    table('products', [['id', 'uuid'], ['category_id', 'uuid', true], ['name', 'text'], ['price', 'numeric(10,2)']]),
    table('categories', [['id', 'uuid'], ['name', 'text']]),
    table('inventory', [['id', 'uuid'], ['product_id', 'uuid'], ['quantity', 'integer']]),
  ],
  foreignKeys: [
    ['orders', 'customers', 'customer_id'],
    ['order_items', 'orders', 'order_id'],
    ['order_items', 'products', 'product_id'],
    ['payments', 'orders', 'order_id'],
    ['products', 'categories', 'category_id'],
    ['inventory', 'products', 'product_id'],
  ].map(([sourceTable, targetTable, column]) => ({
    name: `${sourceTable}_${column}_fkey`, sourceSchema: 'public', sourceTable,
    sourceColumns: [column], targetSchema: 'public', targetTable, targetColumns: ['id'],
  })),
};
const result = await generateWithSvg(schema, {
  maxTables: 4, maxContextTables: 1, contextDepth: 1,
  columns: 'all', cardinality: 'inferred', includeTable: [], excludeTable: [],
});
const out = new URL('../docs/example/', import.meta.url);
await mkdir(out, { recursive: true });
for (const [name, content] of result.files) await writeFile(new URL(name, out), content);
console.log(`Generated ${result.communities.length} detail diagrams in ${fileURLToPath(out)}`);
