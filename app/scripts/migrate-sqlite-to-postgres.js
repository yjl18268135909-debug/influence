const path = require('path');
const Database = require('better-sqlite3');
const { Pool } = require('pg');

const sqlitePath = process.env.SQLITE_DB_PATH || path.join(__dirname, '../data/finance.db');
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('Missing DATABASE_URL. Copy the Supabase PostgreSQL connection string into DATABASE_URL first.');
  process.exit(1);
}

const tables = [
  'influencers',
  'merchants',
  'products',
  'live_sessions',
  'orders',
  'expenses',
  'costs',
  'income',
];

const sqlite = new Database(sqlitePath, { readonly: true });
const pool = new Pool({
  connectionString: databaseUrl,
  ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false },
});

function sqliteColumns(table) {
  return sqlite.prepare(`PRAGMA table_info(${table})`).all().map((column) => column.name);
}

async function postgresColumns(client, table) {
  const result = await client.query(
    `select column_name
     from information_schema.columns
     where table_schema = 'public' and table_name = $1
     order by ordinal_position`,
    [table]
  );
  return result.rows.map((row) => row.column_name);
}

function rowValues(row, columns) {
  return columns.map((column) => row[column] === undefined ? null : row[column]);
}

async function importTable(client, table) {
  const sourceColumns = sqliteColumns(table);
  const targetColumns = await postgresColumns(client, table);
  const columns = targetColumns.filter((column) => sourceColumns.includes(column));
  const rows = sqlite.prepare(`select ${columns.map((column) => `"${column}"`).join(', ')} from ${table}`).all();

  if (rows.length === 0) {
    console.log(`${table}: 0 rows`);
    return;
  }

  const quotedColumns = columns.map((column) => `"${column}"`).join(', ');
  const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ');
  const updateColumns = columns
    .filter((column) => column !== 'id')
    .map((column) => `"${column}" = excluded."${column}"`)
    .join(', ');
  const sql = `
    insert into public.${table} (${quotedColumns})
    values (${placeholders})
    on conflict (id) do update set ${updateColumns || 'id = excluded.id'}
  `;

  for (const row of rows) {
    await client.query(sql, rowValues(row, columns));
  }

  if (columns.includes('id')) {
    await client.query(`select setval(pg_get_serial_sequence('public.${table}', 'id'), coalesce((select max(id) from public.${table}), 1), true)`);
  }

  console.log(`${table}: ${rows.length} rows`);
}

async function main() {
  const client = await pool.connect();
  try {
    await client.query('begin');
    for (const table of tables) {
      await importTable(client, table);
    }
    await client.query('commit');
    console.log('Migration completed.');
  } catch (error) {
    await client.query('rollback');
    console.error(error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
    sqlite.close();
  }
}

main();
