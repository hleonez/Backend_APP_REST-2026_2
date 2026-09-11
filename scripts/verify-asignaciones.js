const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 
    'postgresql://' + (process.env.DB_USER || 'postgres') + ':' + (process.env.DB_PASSWORD || 'Ho2025') + '@' + (process.env.DB_HOST || 'localhost') + ':' + (process.env.DB_PORT || '5432') + '/' + (process.env.DB_NAME || 'mental_health_app')
});

async function verify() {
  const t = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'asignaciones'");
  console.log('=== TABLA ===');
  console.log(t.rows.length > 0 ? 'asignaciones EXISTE' : 'asignaciones NO EXISTE');

  const i = await pool.query("SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'asignaciones'");
  console.log('\n=== INDICES ===');
  i.rows.forEach(r => console.log(r.indexname + ':\n  ' + r.indexdef + '\n'));

  const c = await pool.query("SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name = 'asignaciones' ORDER BY ordinal_position");
  console.log('=== COLUMNAS ===');
  c.rows.forEach(r => console.log('  ' + r.column_name + ' | ' + r.data_type + ' | nullable: ' + r.is_nullable + ' | default: ' + (r.column_default || '-')));

  await pool.end();
}

verify().catch(e => { console.error(e); pool.end(); });
