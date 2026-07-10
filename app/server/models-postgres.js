const { query, one } = require('./postgres');

function addFilter(parts, params, condition, value) {
  if (value === undefined || value === null || value === '') return;
  params.push(value);
  parts.push(condition.replace('?', `$${params.length}`));
}

function normalizeId(value) {
  if (value === undefined || value === null || value === '') return null;
  return Number(value);
}

function normalizeRate(value) {
  if (value === undefined || value === null || value === '') return 0;
  if (typeof value === 'number') return value > 1 ? value / 100 : value;

  const text = String(value).trim();
  if (!text) return 0;

  const numericValue = Number(text.replace('%', '').replace(/,/g, '').trim());
  if (!Number.isFinite(numericValue)) return 0;
  return text.includes('%') || numericValue > 1 ? numericValue / 100 : numericValue;
}

function mapInsertResult(row, data) {
  return { id: row.id, ...data };
}

async function ensureAccountsTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS app_accounts (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const existing = await one('SELECT COUNT(*)::int as count FROM app_accounts');
  if (!existing.count) {
    await query(
      `INSERT INTO app_accounts (username, password, name, role, status)
       VALUES
       ($1,$2,$3,$4,'active'),
       ($5,$6,$7,$8,'active'),
       ($9,$10,$11,$12,'active'),
       ($13,$14,$15,$16,'active'),
       ($17,$18,$19,$20,'active'),
       ($21,$22,$23,$24,'active')`,
      [
        'weilun', '123456', 'weilun', '老板',
        'boss', '123456', '老板', '老板',
        'finance', '123456', '财务', '财务',
        'Mia', '123456', 'Mia', '运营',
        'Aaron', '123456', 'Aaron', '运营',
        'Sophie', '123456', 'Sophie', '运营',
      ]
    );
  }
}

async function ensureTravelReceivablesTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS travel_receivables (
      id SERIAL PRIMARY KEY,
      receivable_date DATE NOT NULL,
      receivable_type TEXT NOT NULL,
      object_name TEXT,
      reason TEXT,
      amount DOUBLE PRECISION DEFAULT 0,
      notes TEXT,
      received_amount DOUBLE PRECISION DEFAULT 0,
      payment_notes TEXT,
      is_bad_debt BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await query('ALTER TABLE travel_receivables ADD COLUMN IF NOT EXISTS received_amount DOUBLE PRECISION DEFAULT 0');
  await query('ALTER TABLE travel_receivables ADD COLUMN IF NOT EXISTS payment_notes TEXT');
  await query('ALTER TABLE travel_receivables ADD COLUMN IF NOT EXISTS is_bad_debt BOOLEAN DEFAULT FALSE');
  await query('CREATE INDEX IF NOT EXISTS idx_travel_receivables_date ON travel_receivables(receivable_date)');
  await query('CREATE INDEX IF NOT EXISTS idx_travel_receivables_type ON travel_receivables(receivable_type)');
  await query('CREATE INDEX IF NOT EXISTS idx_travel_receivables_reason ON travel_receivables(reason)');
  await query('CREATE INDEX IF NOT EXISTS idx_travel_receivables_object ON travel_receivables(object_name)');
}

async function ensureWorkProgressTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS work_progress_items (
      id SERIAL PRIMARY KEY,
      fill_time TIMESTAMPTZ NOT NULL,
      required_finish_time TIMESTAMPTZ,
      urgency TEXT DEFAULT '需要',
      urgency_note TEXT,
      requester TEXT,
      executor_role TEXT,
      requirement TEXT NOT NULL,
      executor_ack TEXT DEFAULT '否',
      is_done TEXT DEFAULT '否',
      finished_at TIMESTAMPTZ,
      completion_link TEXT,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await query('CREATE INDEX IF NOT EXISTS idx_work_progress_fill_time ON work_progress_items(fill_time)');
  await query('CREATE INDEX IF NOT EXISTS idx_work_progress_required_time ON work_progress_items(required_finish_time)');
  await query('CREATE INDEX IF NOT EXISTS idx_work_progress_urgency ON work_progress_items(urgency)');
  await query('CREATE INDEX IF NOT EXISTS idx_work_progress_done ON work_progress_items(is_done)');
}

async function ensureLiveSessionColumns() {
  await query(`
    ALTER TABLE live_sessions
      ADD COLUMN IF NOT EXISTS cargo_sheet TEXT,
      ADD COLUMN IF NOT EXISTS traffic_plan TEXT,
      ADD COLUMN IF NOT EXISTS estimated_ad_cost DOUBLE PRECISION DEFAULT 0,
      ADD COLUMN IF NOT EXISTS expected_gmv DOUBLE PRECISION DEFAULT 0,
      ADD COLUMN IF NOT EXISTS influencer_commission_rate DOUBLE PRECISION DEFAULT 0,
      ADD COLUMN IF NOT EXISTS brand_commission_rate DOUBLE PRECISION DEFAULT 0,
      ADD COLUMN IF NOT EXISTS travel_cost_share DOUBLE PRECISION DEFAULT 0,
      ADD COLUMN IF NOT EXISTS brand_receivable DOUBLE PRECISION DEFAULT 0,
      ADD COLUMN IF NOT EXISTS owner TEXT,
      ADD COLUMN IF NOT EXISTS assistant TEXT,
      ADD COLUMN IF NOT EXISTS live_city TEXT,
      ADD COLUMN IF NOT EXISTS live_venue TEXT,
      ADD COLUMN IF NOT EXISTS live_network TEXT,
      ADD COLUMN IF NOT EXISTS samples TEXT,
      ADD COLUMN IF NOT EXISTS schedule_type TEXT DEFAULT 'session',
      ADD COLUMN IF NOT EXISTS influencer_travel_note TEXT,
      ADD COLUMN IF NOT EXISTS schedule_other_note TEXT,
      ADD COLUMN IF NOT EXISTS brand_category TEXT,
      ADD COLUMN IF NOT EXISTS brand_cooperation_mode TEXT,
      ADD COLUMN IF NOT EXISTS plan_notes TEXT,
      ADD COLUMN IF NOT EXISTS execution_notes TEXT,
      ADD COLUMN IF NOT EXISTS cost_notes TEXT,
      ADD COLUMN IF NOT EXISTS actual_gmv_sgd DOUBLE PRECISION DEFAULT 0,
      ADD COLUMN IF NOT EXISTS big_screen_screenshot TEXT,
      ADD COLUMN IF NOT EXISTS actual_traffic_usd DOUBLE PRECISION DEFAULT 0,
      ADD COLUMN IF NOT EXISTS screen_traffic_sgd DOUBLE PRECISION DEFAULT 0,
      ADD COLUMN IF NOT EXISTS actual_traffic_provider TEXT,
      ADD COLUMN IF NOT EXISTS traffic_receivable_type TEXT,
      ADD COLUMN IF NOT EXISTS traffic_receivable_amount DOUBLE PRECISION DEFAULT 0,
      ADD COLUMN IF NOT EXISTS traffic_notes TEXT,
      ADD COLUMN IF NOT EXISTS post_live_notes TEXT,
      ADD COLUMN IF NOT EXISTS received_amount DOUBLE PRECISION DEFAULT 0,
      ADD COLUMN IF NOT EXISTS payment_notes TEXT,
      ADD COLUMN IF NOT EXISTS is_bad_debt BOOLEAN DEFAULT FALSE
  `);
}

async function ensureMerchantColumns() {
  await query(`
    ALTER TABLE merchants
      ADD COLUMN IF NOT EXISTS has_strong_assistant TEXT,
      ADD COLUMN IF NOT EXISTS merchant_store TEXT,
      ADD COLUMN IF NOT EXISTS country TEXT,
      ADD COLUMN IF NOT EXISTS merchant_owner TEXT,
      ADD COLUMN IF NOT EXISTS primary_category TEXT,
      ADD COLUMN IF NOT EXISTS secondary_category TEXT
  `);
}

async function getAccounts() {
  await ensureAccountsTable();
  return query(`
    SELECT id, username, name, role, status, created_at, updated_at
    FROM app_accounts
    ORDER BY id ASC
  `);
}

async function findAccountByLogin(username, password) {
  await ensureAccountsTable();
  return one(
    `SELECT id, username, name, role, status
     FROM app_accounts
     WHERE username = $1 AND password = $2 AND status = 'active'
     LIMIT 1`,
    [username, password]
  );
}

async function createAccount(data) {
  await ensureAccountsTable();
  const row = await one(
    `INSERT INTO app_accounts (username, password, name, role, status)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, username, name, role, status, created_at, updated_at`,
    [data.username, data.password || '123456', data.name, data.role, data.status || 'active']
  );
  return row;
}

async function updateAccount(id, data) {
  await ensureAccountsTable();
  const current = await one('SELECT * FROM app_accounts WHERE id = $1', [id]);
  if (!current) return null;

  const row = await one(
    `UPDATE app_accounts
     SET username = $1, password = $2, name = $3, role = $4, status = $5, updated_at = CURRENT_TIMESTAMP
     WHERE id = $6
     RETURNING id, username, name, role, status, created_at, updated_at`,
    [
      data.username,
      data.password ? data.password : current.password,
      data.name,
      data.role,
      data.status || 'active',
      id,
    ]
  );
  return row;
}

async function deleteAccount(id) {
  await ensureAccountsTable();
  await query('DELETE FROM app_accounts WHERE id = $1', [id]);
  return { success: true };
}

async function exportAllData() {
  await ensureAccountsTable();
  await ensureTravelReceivablesTable();
  await ensureWorkProgressTable();
  await ensureMerchantColumns();
  const tables = [
    'influencers',
    'merchants',
    'products',
    'live_sessions',
    'orders',
    'expenses',
    'costs',
    'income',
    'travel_receivables',
    'work_progress_items',
  ];

  const data = {};
  for (const table of tables) {
    data[table] = await query(`SELECT * FROM ${table}`);
  }
  data.app_accounts = await query(`
    SELECT id, username, name, role, status, created_at, updated_at
    FROM app_accounts
    ORDER BY id ASC
  `);

  return {
    exported_at: new Date().toISOString(),
    database: 'postgres',
    data,
  };
}

async function getWorkProgressItems(filters = {}) {
  await ensureWorkProgressTable();
  const where = ['1=1'];
  const params = [];
  addFilter(where, params, 'urgency = ?', filters.urgency);
  addFilter(where, params, 'requester = ?', filters.requester);
  addFilter(where, params, 'executor_role = ?', filters.executor_role);
  addFilter(where, params, 'executor_ack = ?', filters.executor_ack);
  addFilter(where, params, 'is_done = ?', filters.is_done);

  if (filters.startDate && filters.endDate) {
    params.push(filters.startDate, filters.endDate);
    where.push(`fill_time::date BETWEEN $${params.length - 1}::date AND $${params.length}::date`);
  }

  if (filters.keyword) {
    params.push(`%${filters.keyword}%`);
    where.push(`(
      requester ILIKE $${params.length}
      OR executor_role ILIKE $${params.length}
      OR requirement ILIKE $${params.length}
      OR notes ILIKE $${params.length}
    )`);
  }

  return query(
    `SELECT
      id,
      to_char(fill_time, 'YYYY-MM-DD HH24:MI:SS') as fill_time,
      to_char(required_finish_time, 'YYYY-MM-DD HH24:MI:SS') as required_finish_time,
      urgency,
      urgency_note,
      requester,
      executor_role,
      requirement,
      executor_ack,
      is_done,
      to_char(finished_at, 'YYYY-MM-DD HH24:MI:SS') as finished_at,
      completion_link,
      notes,
      created_at,
      updated_at
     FROM work_progress_items
     WHERE ${where.join(' AND ')}
     ORDER BY COALESCE(required_finish_time, fill_time) ASC, id DESC`,
    params
  );
}

function normalizeWorkProgressPayload(data) {
  return {
    fill_time: data.fill_time,
    required_finish_time: data.required_finish_time || null,
    urgency: data.urgency || '需要',
    urgency_note: data.urgency_note || null,
    requester: data.requester || null,
    executor_role: data.executor_role || null,
    requirement: data.requirement,
    executor_ack: data.executor_ack || '否',
    is_done: data.is_done || '否',
    finished_at: data.finished_at || null,
    completion_link: data.completion_link || null,
    notes: data.notes || null,
  };
}

async function createWorkProgressItem(data) {
  await ensureWorkProgressTable();
  const item = normalizeWorkProgressPayload(data);
  return one(
    `INSERT INTO work_progress_items (
      fill_time,
      required_finish_time,
      urgency,
      urgency_note,
      requester,
      executor_role,
      requirement,
      executor_ack,
      is_done,
      finished_at,
      completion_link,
      notes
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
    RETURNING
      id,
      to_char(fill_time, 'YYYY-MM-DD HH24:MI:SS') as fill_time,
      to_char(required_finish_time, 'YYYY-MM-DD HH24:MI:SS') as required_finish_time,
      urgency,
      urgency_note,
      requester,
      executor_role,
      requirement,
      executor_ack,
      is_done,
      to_char(finished_at, 'YYYY-MM-DD HH24:MI:SS') as finished_at,
      completion_link,
      notes,
      created_at,
      updated_at`,
    [
      item.fill_time,
      item.required_finish_time,
      item.urgency,
      item.urgency_note,
      item.requester,
      item.executor_role,
      item.requirement,
      item.executor_ack,
      item.is_done,
      item.finished_at,
      item.completion_link,
      item.notes,
    ]
  );
}

async function updateWorkProgressItem(id, data) {
  await ensureWorkProgressTable();
  const item = normalizeWorkProgressPayload(data);
  return one(
    `UPDATE work_progress_items
     SET fill_time = $1,
         required_finish_time = $2,
         urgency = $3,
         urgency_note = $4,
         requester = $5,
         executor_role = $6,
         requirement = $7,
         executor_ack = $8,
         is_done = $9,
         finished_at = $10,
         completion_link = $11,
         notes = $12,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $13
     RETURNING
      id,
      to_char(fill_time, 'YYYY-MM-DD HH24:MI:SS') as fill_time,
      to_char(required_finish_time, 'YYYY-MM-DD HH24:MI:SS') as required_finish_time,
      urgency,
      urgency_note,
      requester,
      executor_role,
      requirement,
      executor_ack,
      is_done,
      to_char(finished_at, 'YYYY-MM-DD HH24:MI:SS') as finished_at,
      completion_link,
      notes,
      created_at,
      updated_at`,
    [
      item.fill_time,
      item.required_finish_time,
      item.urgency,
      item.urgency_note,
      item.requester,
      item.executor_role,
      item.requirement,
      item.executor_ack,
      item.is_done,
      item.finished_at,
      item.completion_link,
      item.notes,
      id,
    ]
  );
}

async function deleteWorkProgressItem(id) {
  await ensureWorkProgressTable();
  await query('DELETE FROM work_progress_items WHERE id = $1', [id]);
  return { success: true };
}

async function getTravelReceivables() {
  await ensureTravelReceivablesTable();
  return query(`
    SELECT
      id,
      to_char(receivable_date, 'YYYY-MM-DD') as receivable_date,
      receivable_type,
      object_name,
      reason,
      COALESCE(amount, 0)::float as amount,
      notes,
      COALESCE(received_amount, 0)::float as received_amount,
      payment_notes,
      COALESCE(is_bad_debt, FALSE) as is_bad_debt,
      created_at,
      updated_at
    FROM travel_receivables
    ORDER BY receivable_date DESC, created_at DESC, id DESC
  `);
}

async function createTravelReceivable(data) {
  await ensureTravelReceivablesTable();
  const row = await one(
    `INSERT INTO travel_receivables
      (receivable_date, receivable_type, object_name, reason, amount, notes, received_amount, payment_notes, is_bad_debt)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING
      id,
      to_char(receivable_date, 'YYYY-MM-DD') as receivable_date,
      receivable_type,
      object_name,
      reason,
      COALESCE(amount, 0)::float as amount,
      notes,
      COALESCE(received_amount, 0)::float as received_amount,
      payment_notes,
      COALESCE(is_bad_debt, FALSE) as is_bad_debt,
      created_at,
      updated_at`,
    [
      data.receivable_date,
      data.receivable_type,
      data.object_name || null,
      data.reason || null,
      Number(data.amount || 0),
      data.notes || null,
      Number(data.received_amount || 0),
      data.payment_notes || null,
      Boolean(data.is_bad_debt),
    ]
  );
  return row;
}

async function updateTravelReceivable(id, data) {
  await ensureTravelReceivablesTable();
  const row = await one(
    `UPDATE travel_receivables
     SET receivable_date = $1,
         receivable_type = $2,
         object_name = $3,
         reason = $4,
         amount = $5,
         notes = $6,
         received_amount = $7,
         payment_notes = $8,
         is_bad_debt = $9,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $10
     RETURNING
      id,
      to_char(receivable_date, 'YYYY-MM-DD') as receivable_date,
      receivable_type,
      object_name,
      reason,
      COALESCE(amount, 0)::float as amount,
      notes,
      COALESCE(received_amount, 0)::float as received_amount,
      payment_notes,
      COALESCE(is_bad_debt, FALSE) as is_bad_debt,
      created_at,
      updated_at`,
    [
      data.receivable_date,
      data.receivable_type,
      data.object_name || null,
      data.reason || null,
      Number(data.amount || 0),
      data.notes || null,
      Number(data.received_amount || 0),
      data.payment_notes || null,
      Boolean(data.is_bad_debt),
      id,
    ]
  );
  return row;
}

async function deleteTravelReceivable(id) {
  await ensureTravelReceivablesTable();
  await query('DELETE FROM travel_receivables WHERE id = $1', [id]);
  return { success: true };
}

async function getInfluencers(filters = {}) {
  const where = [
    "account NOT LIKE 'placeholder_%'",
    "account NOT LIKE 'live_%'",
    "COALESCE(status, 'active') != 'deleted'",
  ];
  const params = [];
  addFilter(where, params, 'status = ?', filters.status);
  if (filters.platform) {
    params.push(filters.platform);
    where.push(`$${params.length} = ANY(string_to_array(REPLACE(COALESCE(platform, ''), ' ', ''), ','))`);
  }
  return query(`SELECT * FROM influencers WHERE ${where.join(' AND ')} ORDER BY created_at DESC`, params);
}

async function createInfluencer(data) {
  const row = await one(
    `INSERT INTO influencers
      (platform, name, account, agency, single_session_data, product_direction, commission_rate, contact, sample_address, notes, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     RETURNING id`,
    [
      data.platform || '',
      data.name,
      data.account,
      data.agency || null,
      data.single_session_data || null,
      data.product_direction || null,
      normalizeRate(data.commission_rate),
      data.contact || null,
      data.sample_address || null,
      data.notes || null,
      data.status || 'active',
    ]
  );
  return mapInsertResult(row, data);
}

async function updateInfluencer(id, data) {
  await query(
    `UPDATE influencers
     SET platform = $1, name = $2, account = $3, agency = $4, single_session_data = $5,
         product_direction = $6, commission_rate = $7, contact = $8, sample_address = $9,
         notes = $10, status = $11, updated_at = CURRENT_TIMESTAMP
     WHERE id = $12`,
    [
      data.platform || '',
      data.name,
      data.account,
      data.agency || null,
      data.single_session_data || null,
      data.product_direction || null,
      normalizeRate(data.commission_rate),
      data.contact || null,
      data.sample_address || null,
      data.notes || null,
      data.status || 'active',
      id,
    ]
  );
  return { id, ...data };
}

async function deleteInfluencer(id) {
  // Preserve historical sessions and financial records that reference this
  // influencer while removing them from active management lists.
  await query(
    "UPDATE influencers SET status = 'deleted', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
    [id]
  );
  return { success: true };
}

async function getMerchants(filters = {}) {
  await ensureMerchantColumns();
  const where = ["name != '未填写品牌'", "COALESCE(status, 'active') != 'deleted'"];
  const params = [];
  addFilter(where, params, 'status = ?', filters.status);
  if (filters.platform) {
    params.push(filters.platform);
    where.push(`$${params.length} = ANY(string_to_array(REPLACE(COALESCE(platform, ''), ' ', ''), ','))`);
  }
  return query(`SELECT * FROM merchants WHERE ${where.join(' AND ')} ORDER BY created_at DESC`, params);
}

async function createMerchant(data) {
  await ensureMerchantColumns();
  const row = await one(
    `INSERT INTO merchants (
      name, country, merchant_owner, category, primary_category, secondary_category, contact_person, email, phone, platform, commission_rate, settlement_cycle, status, notes,
      supply_price_sheet_url, cargo_sheet_url, cooperation_mode, cooperation_notes, brand_address,
      brand_intro, brand_assistants, brand_live_venue, brand_cards, other_files, company_name, has_strong_assistant, merchant_store
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27)
    RETURNING id`,
    [
      data.name,
      data.country || null,
      data.merchant_owner || null,
      data.category || data.primary_category || null,
      data.primary_category || data.category || null,
      data.secondary_category || null,
      data.contact_person || null,
      data.email || null,
      data.phone || null,
      data.platform || '',
      normalizeRate(data.commission_rate),
      data.settlement_cycle || 'monthly',
      data.status || 'active',
      data.notes || null,
      data.supply_price_sheet_url || null,
      data.cargo_sheet_url || null,
      data.cooperation_mode || null,
      data.cooperation_notes || null,
      data.brand_address || null,
      data.brand_intro || null,
      data.brand_assistants || null,
      data.brand_live_venue || null,
      data.brand_cards || null,
      data.other_files || null,
      data.company_name || null,
      data.has_strong_assistant || null,
      data.merchant_store || null,
    ]
  );
  return mapInsertResult(row, data);
}

async function updateMerchant(id, data) {
  await ensureMerchantColumns();
  await query(
    `UPDATE merchants
     SET name = $1, country = $2, merchant_owner = $3, category = $4, primary_category = $5, secondary_category = $6,
         contact_person = $7, email = $8, phone = $9, platform = $10,
         commission_rate = $11, settlement_cycle = $12, status = $13, notes = $14,
         supply_price_sheet_url = $15, cargo_sheet_url = $16, cooperation_mode = $17,
         cooperation_notes = $18, brand_address = $19, brand_intro = $20,
         brand_assistants = $21, brand_live_venue = $22, brand_cards = $23,
         other_files = $24, company_name = $25, has_strong_assistant = $26, merchant_store = $27, updated_at = CURRENT_TIMESTAMP
     WHERE id = $28`,
    [
      data.name,
      data.country || null,
      data.merchant_owner || null,
      data.category || data.primary_category || null,
      data.primary_category || data.category || null,
      data.secondary_category || null,
      data.contact_person || null,
      data.email || null,
      data.phone || null,
      data.platform || '',
      normalizeRate(data.commission_rate),
      data.settlement_cycle || 'monthly',
      data.status || 'active',
      data.notes || null,
      data.supply_price_sheet_url || null,
      data.cargo_sheet_url || null,
      data.cooperation_mode || null,
      data.cooperation_notes || null,
      data.brand_address || null,
      data.brand_intro || null,
      data.brand_assistants || null,
      data.brand_live_venue || null,
      data.brand_cards || null,
      data.other_files || null,
      data.company_name || null,
      data.has_strong_assistant || null,
      data.merchant_store || null,
      id,
    ]
  );
  return { id, ...data };
}

async function deleteMerchant(id) {
  // Keep historical sessions and finance records intact while removing the
  // merchant from active management lists.
  await query(
    "UPDATE merchants SET status = 'deleted', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
    [id]
  );
  return { success: true };
}

async function resolveLiveSessionRelations(data) {
  let influencerId = normalizeId(data.influencer_id);
  if (!influencerId) {
    const existing = await one("SELECT id FROM influencers WHERE account = 'placeholder_influencer' LIMIT 1");
    if (existing) {
      influencerId = existing.id;
    } else {
      const row = await one(
        `INSERT INTO influencers (platform, name, account, commission_rate, status)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [data.platform || '', '未填写达人', 'placeholder_influencer', 0, 'active']
      );
      influencerId = row.id;
    }
  }

  let merchantId = normalizeId(data.merchant_id);
  if (!merchantId) {
    const merchantName = data.merchant_name || '未填写品牌';
    const existing = await one('SELECT id FROM merchants WHERE name = $1 LIMIT 1', [merchantName]);
    if (existing) {
      merchantId = existing.id;
    } else {
      const row = await one(
        `INSERT INTO merchants (name, category, platform, commission_rate, settlement_cycle, status)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [merchantName, null, data.platform || '', 0, 'monthly', 'active']
      );
      merchantId = row.id;
    }
  }

  return { influencerId, merchantId };
}

async function getLiveSessions(filters = {}) {
  await ensureLiveSessionColumns();
  const where = ["COALESCE(ls.status, '') != 'deleted'"];
  const params = [];
  addFilter(where, params, 'ls.influencer_id = ?', normalizeId(filters.influencer_id));
  addFilter(where, params, 'ls.merchant_id = ?', normalizeId(filters.merchant_id));
  addFilter(where, params, 'ls.platform = ?', filters.platform);
  if (filters.startDate && filters.endDate) {
    params.push(filters.startDate, filters.endDate);
    where.push(`ls.session_date BETWEEN $${params.length - 1} AND $${params.length}`);
  }
  return query(
    `SELECT ls.*, i.name as influencer_name, m.name as merchant_name,
            i.commission_rate as influencer_default_commission_rate,
            m.commission_rate as merchant_commission_rate,
            m.category as merchant_category, m.cooperation_mode as merchant_cooperation_mode
     FROM live_sessions ls
     LEFT JOIN influencers i ON ls.influencer_id = i.id
     LEFT JOIN merchants m ON ls.merchant_id = m.id
     WHERE ${where.join(' AND ')}
     ORDER BY ls.session_date DESC`,
    params
  );
}

const liveSessionColumns = [
  'influencer_id', 'merchant_id', 'platform', 'session_date', 'duration_hours', 'viewers', 'gmv', 'orders_count',
  'status', 'notes', 'cargo_sheet', 'traffic_plan', 'estimated_ad_cost', 'expected_gmv', 'influencer_commission_rate',
  'brand_commission_rate', 'travel_cost_share', 'brand_receivable', 'owner', 'assistant', 'live_city', 'live_venue', 'live_network', 'samples', 'schedule_type',
  'influencer_travel_note', 'schedule_other_note', 'brand_category', 'brand_cooperation_mode', 'plan_notes',
  'execution_notes', 'cost_notes', 'actual_gmv_sgd', 'big_screen_screenshot', 'actual_traffic_usd',
  'screen_traffic_sgd', 'actual_traffic_provider', 'traffic_receivable_type', 'traffic_receivable_amount',
  'traffic_notes', 'post_live_notes', 'received_amount', 'payment_notes', 'is_bad_debt',
];

function liveSessionValues(data, influencerId, merchantId) {
  return [
    influencerId,
    merchantId,
    data.platform || '',
    data.session_date,
    data.duration_hours || null,
    data.viewers || 0,
    data.gmv || 0,
    data.orders_count || 0,
    data.status || 'completed',
    data.notes || null,
    data.cargo_sheet || null,
    data.traffic_plan || null,
    data.estimated_ad_cost || 0,
    data.expected_gmv || 0,
    data.influencer_commission_rate || 0,
    data.brand_commission_rate || 0,
    data.travel_cost_share || 0,
    data.brand_receivable || 0,
    data.owner || null,
    data.assistant || null,
    data.live_city || null,
    data.live_venue || null,
    data.live_network || null,
    data.samples || null,
    data.schedule_type || 'session',
    data.influencer_travel_note || null,
    data.schedule_other_note || null,
    data.brand_category || null,
    data.brand_cooperation_mode || null,
    data.plan_notes || null,
    data.execution_notes || null,
    data.cost_notes || null,
    data.actual_gmv_sgd || 0,
    data.big_screen_screenshot || null,
    data.actual_traffic_usd || 0,
    data.screen_traffic_sgd || 0,
    data.actual_traffic_provider || null,
    data.traffic_receivable_type || null,
    data.traffic_receivable_amount || 0,
    data.traffic_notes || null,
    data.post_live_notes || null,
    data.received_amount || 0,
    data.payment_notes || null,
    Boolean(data.is_bad_debt),
  ];
}

async function createLiveSession(data) {
  await ensureLiveSessionColumns();
  const { influencerId, merchantId } = await resolveLiveSessionRelations(data);
  const values = liveSessionValues(data, influencerId, merchantId);
  const placeholders = values.map((_, index) => `$${index + 1}`).join(', ');
  const row = await one(
    `INSERT INTO live_sessions (${liveSessionColumns.join(', ')})
     VALUES (${placeholders}) RETURNING id`,
    values
  );
  return { id: row.id, ...data, influencer_id: influencerId, merchant_id: merchantId };
}

async function updateLiveSession(id, data) {
  await ensureLiveSessionColumns();
  const { influencerId, merchantId } = await resolveLiveSessionRelations(data);
  const values = liveSessionValues(data, influencerId, merchantId);
  const setSql = liveSessionColumns.map((column, index) => `${column} = $${index + 1}`).join(', ');
  values.push(id);
  await query(`UPDATE live_sessions SET ${setSql} WHERE id = $${values.length}`, values);
  return { id, ...data, influencer_id: influencerId, merchant_id: merchantId };
}

async function deleteLiveSession(id) {
  // Archive instead of physically deleting so orders, costs and receivables
  // that reference this session remain valid.
  await query("UPDATE live_sessions SET status = 'deleted' WHERE id = $1", [id]);
  return { success: true };
}

async function getOrders(filters = {}) {
  const where = ['1=1'];
  const params = [];
  addFilter(where, params, 'o.influencer_id = ?', normalizeId(filters.influencer_id));
  addFilter(where, params, 'o.merchant_id = ?', normalizeId(filters.merchant_id));
  addFilter(where, params, 'o.platform = ?', filters.platform);
  addFilter(where, params, 'o.settlement_status = ?', filters.settlement_status);
  if (filters.startDate && filters.endDate) {
    params.push(filters.startDate, filters.endDate);
    where.push(`o.order_date BETWEEN $${params.length - 1} AND $${params.length}`);
  }
  return query(
    `SELECT o.*, i.name as influencer_name, m.name as merchant_name, p.name as product_name
     FROM orders o
     LEFT JOIN influencers i ON o.influencer_id = i.id
     LEFT JOIN merchants m ON o.merchant_id = m.id
     LEFT JOIN products p ON o.product_id = p.id
     WHERE ${where.join(' AND ')}
     ORDER BY o.order_date DESC`,
    params
  );
}

async function createOrder(data) {
  const row = await one(
    `INSERT INTO orders
      (order_no, live_session_id, influencer_id, merchant_id, product_id, platform, order_date, product_name,
       quantity, unit_price, total_amount, commission_rate, commission_amount, settlement_status, settlement_date)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
     RETURNING id`,
    [
      data.order_no,
      normalizeId(data.live_session_id),
      normalizeId(data.influencer_id),
      normalizeId(data.merchant_id),
      normalizeId(data.product_id),
      data.platform,
      data.order_date,
      data.product_name,
      data.quantity,
      data.unit_price,
      data.total_amount,
      data.commission_rate || 0,
      data.commission_amount || 0,
      data.settlement_status || 'pending',
      data.settlement_date || null,
    ]
  );
  return mapInsertResult(row, data);
}

async function getExpenses(filters = {}) {
  const where = ['1=1'];
  const params = [];
  addFilter(where, params, 'e.type = ?', filters.type);
  addFilter(where, params, 'e.category = ?', filters.category);
  addFilter(where, params, 'e.related_influencer_id = ?', normalizeId(filters.related_influencer_id));
  addFilter(where, params, 'e.related_merchant_id = ?', normalizeId(filters.related_merchant_id));
  if (filters.startDate && filters.endDate) {
    params.push(filters.startDate, filters.endDate);
    where.push(`e.expense_date BETWEEN $${params.length - 1} AND $${params.length}`);
  }
  return query(
    `SELECT e.*, i.name as influencer_name, m.name as merchant_name, ls.id as live_session_no
     FROM expenses e
     LEFT JOIN influencers i ON e.related_influencer_id = i.id
     LEFT JOIN merchants m ON e.related_merchant_id = m.id
     LEFT JOIN live_sessions ls ON e.related_live_session_id = ls.id
     WHERE ${where.join(' AND ')}
     ORDER BY e.expense_date DESC`,
    params
  );
}

async function createExpense(data) {
  const row = await one(
    `INSERT INTO expenses
      (type, category, amount, currency, expense_date, related_influencer_id, related_merchant_id,
       related_live_session_id, description, payment_method, status, receipt_no)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     RETURNING id`,
    [
      data.type,
      data.category,
      data.amount,
      data.currency || 'SGD',
      data.expense_date,
      normalizeId(data.related_influencer_id),
      normalizeId(data.related_merchant_id),
      normalizeId(data.related_live_session_id),
      data.description,
      data.payment_method || null,
      data.status || 'paid',
      data.receipt_no || null,
    ]
  );
  return mapInsertResult(row, data);
}

async function getCosts(filters = {}) {
  const where = ['1=1'];
  const params = [];
  addFilter(where, params, 'c.type = ?', filters.type);
  addFilter(where, params, 'c.category = ?', filters.category);
  addFilter(where, params, 'c.related_influencer_id = ?', normalizeId(filters.related_influencer_id));
  addFilter(where, params, 'c.related_merchant_id = ?', normalizeId(filters.related_merchant_id));
  if (filters.startDate && filters.endDate) {
    params.push(filters.startDate, filters.endDate);
    where.push(`c.cost_date BETWEEN $${params.length - 1} AND $${params.length}`);
  }
  return query(
    `SELECT c.*, i.name as influencer_name, m.name as merchant_name
     FROM costs c
     LEFT JOIN influencers i ON c.related_influencer_id = i.id
     LEFT JOIN merchants m ON c.related_merchant_id = m.id
     WHERE ${where.join(' AND ')}
     ORDER BY c.cost_date DESC`,
    params
  );
}

async function createCost(data) {
  const row = await one(
    `INSERT INTO costs
      (type, category, amount, currency, cost_date, related_influencer_id, related_merchant_id,
       related_live_session_id, related_order_id, description, allocation_method)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     RETURNING id`,
    [
      data.type,
      data.category,
      data.amount,
      data.currency || 'SGD',
      data.cost_date,
      normalizeId(data.related_influencer_id),
      normalizeId(data.related_merchant_id),
      normalizeId(data.related_live_session_id),
      normalizeId(data.related_order_id),
      data.description,
      data.allocation_method || 'average',
    ]
  );
  return mapInsertResult(row, data);
}

async function getIncome(filters = {}) {
  const where = ['1=1'];
  const params = [];
  addFilter(where, params, 'income.type = ?', filters.type);
  addFilter(where, params, 'income.category = ?', filters.category);
  addFilter(where, params, 'income.related_influencer_id = ?', normalizeId(filters.related_influencer_id));
  addFilter(where, params, 'income.related_merchant_id = ?', normalizeId(filters.related_merchant_id));
  if (filters.startDate && filters.endDate) {
    params.push(filters.startDate, filters.endDate);
    where.push(`income.income_date BETWEEN $${params.length - 1} AND $${params.length}`);
  }
  return query(
    `SELECT income.*, i.name as influencer_name, m.name as merchant_name
     FROM income
     LEFT JOIN influencers i ON income.related_influencer_id = i.id
     LEFT JOIN merchants m ON income.related_merchant_id = m.id
     WHERE ${where.join(' AND ')}
     ORDER BY income.income_date DESC`,
    params
  );
}

async function createIncome(data) {
  const row = await one(
    `INSERT INTO income
      (type, category, amount, currency, income_date, related_influencer_id, related_merchant_id,
       related_order_id, description, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     RETURNING id`,
    [
      data.type,
      data.category,
      data.amount,
      data.currency || 'SGD',
      data.income_date,
      normalizeId(data.related_influencer_id),
      normalizeId(data.related_merchant_id),
      normalizeId(data.related_order_id),
      data.description,
      data.status || 'confirmed',
    ]
  );
  return mapInsertResult(row, data);
}

async function getFinancialSummary(filters = {}) {
  const { startDate, endDate, influencerId, platform } = filters;
  const params = [];
  const orderWhere = ['1=1'];
  if (startDate && endDate) {
    params.push(startDate, endDate);
    orderWhere.push(`order_date BETWEEN $${params.length - 1} AND $${params.length}`);
  }
  if (influencerId) {
    params.push(influencerId);
    orderWhere.push(`influencer_id = $${params.length}`);
  }
  if (platform) {
    params.push(platform);
    orderWhere.push(`platform = $${params.length}`);
  }

  const income = await one(
    `SELECT COUNT(*)::int as order_count,
            COALESCE(SUM(total_amount), 0)::float as total_revenue,
            COALESCE(SUM(commission_amount), 0)::float as total_commission,
            COALESCE(SUM(CASE WHEN settlement_status = 'settled' THEN total_amount ELSE 0 END), 0)::float as settled_amount
     FROM orders WHERE ${orderWhere.join(' AND ')}`,
    params
  );

  const expenseParams = [];
  const expenseWhere = ['1=1'];
  if (startDate && endDate) {
    expenseParams.push(startDate, endDate);
    expenseWhere.push(`expense_date BETWEEN $${expenseParams.length - 1} AND $${expenseParams.length}`);
  }
  if (influencerId) {
    expenseParams.push(influencerId);
    expenseWhere.push(`related_influencer_id = $${expenseParams.length}`);
  }
  const expense = await one(
    `SELECT COUNT(*)::int as expense_count, COALESCE(SUM(amount), 0)::float as total_expense
     FROM expenses WHERE ${expenseWhere.join(' AND ')}`,
    expenseParams
  );

  const costParams = [];
  const costWhere = ['1=1'];
  if (startDate && endDate) {
    costParams.push(startDate, endDate);
    costWhere.push(`cost_date BETWEEN $${costParams.length - 1} AND $${costParams.length}`);
  }
  if (influencerId) {
    costParams.push(influencerId);
    costWhere.push(`related_influencer_id = $${costParams.length}`);
  }
  const cost = await one(
    `SELECT COUNT(*)::int as cost_count, COALESCE(SUM(amount), 0)::float as total_cost
     FROM costs WHERE ${costWhere.join(' AND ')}`,
    costParams
  );

  const totalRevenue = income.total_revenue || 0;
  const totalCommission = income.total_commission || 0;
  const totalExpense = expense.total_expense || 0;
  const totalCost = cost.total_cost || 0;
  const grossProfit = totalRevenue - totalCommission;
  const netProfit = grossProfit - totalExpense - totalCost;

  return {
    period: { startDate, endDate },
    revenue: {
      orderCount: income.order_count || 0,
      totalRevenue,
      settledAmount: income.settled_amount || 0,
      settledCount: 0,
      totalCommission,
      grossProfit,
    },
    expense: { expenseCount: expense.expense_count || 0, totalExpense },
    cost: { costCount: cost.cost_count || 0, totalCost },
    profit: {
      grossProfit,
      netProfit,
      profitMargin: totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(2) : 0,
    },
  };
}

async function getInfluencerRanking(filters = {}) {
  const params = [];
  const where = [];
  if (filters.startDate && filters.endDate) {
    params.push(filters.startDate, filters.endDate);
    where.push(`o.order_date BETWEEN $${params.length - 1} AND $${params.length}`);
  }
  if (filters.platform) {
    params.push(filters.platform);
    where.push(`i.platform = $${params.length}`);
  }
  return query(
    `SELECT i.id, i.name, i.platform, i.commission_rate,
            COUNT(DISTINCT o.id)::int as order_count,
            COALESCE(SUM(o.total_amount), 0)::float as total_revenue,
            COALESCE(SUM(o.commission_amount), 0)::float as total_commission
     FROM influencers i
     LEFT JOIN orders o ON i.id = o.influencer_id
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     GROUP BY i.id
     ORDER BY total_revenue DESC`,
    params
  );
}

async function getPlatformComparison(filters = {}) {
  const params = [];
  const where = [];
  if (filters.startDate && filters.endDate) {
    params.push(filters.startDate, filters.endDate);
    where.push(`order_date BETWEEN $${params.length - 1} AND $${params.length}`);
  }
  return query(
    `SELECT platform,
            COUNT(DISTINCT id)::int as order_count,
            COALESCE(SUM(total_amount), 0)::float as total_revenue,
            COALESCE(SUM(commission_amount), 0)::float as total_commission
     FROM orders
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     GROUP BY platform`,
    params
  );
}

async function getMonthlyTrend(filters = {}) {
  const params = [];
  const where = ['1=1'];
  if (filters.startDate && filters.endDate) {
    params.push(filters.startDate, filters.endDate);
    where.push(`order_date BETWEEN $${params.length - 1} AND $${params.length}`);
  }
  if (filters.influencerId) {
    params.push(filters.influencerId);
    where.push(`influencer_id = $${params.length}`);
  }
  if (filters.platform) {
    params.push(filters.platform);
    where.push(`platform = $${params.length}`);
  }
  return query(
    `SELECT to_char(order_date::timestamp, 'YYYY-MM') as month,
            COUNT(*)::int as order_count,
            COALESCE(SUM(total_amount), 0)::float as total_revenue,
            COALESCE(SUM(commission_amount), 0)::float as total_commission,
            COALESCE(SUM(CASE WHEN settlement_status = 'settled' THEN total_amount ELSE 0 END), 0)::float as settled_amount
     FROM orders
     WHERE ${where.join(' AND ')}
     GROUP BY to_char(order_date::timestamp, 'YYYY-MM')
     ORDER BY month DESC
     LIMIT 12`,
    params
  );
}

module.exports = {
  getAccounts,
  findAccountByLogin,
  createAccount,
  updateAccount,
  deleteAccount,
  exportAllData,
  getWorkProgressItems,
  createWorkProgressItem,
  updateWorkProgressItem,
  deleteWorkProgressItem,
  getTravelReceivables,
  createTravelReceivable,
  updateTravelReceivable,
  deleteTravelReceivable,
  getInfluencers,
  createInfluencer,
  updateInfluencer,
  deleteInfluencer,
  getMerchants,
  createMerchant,
  updateMerchant,
  deleteMerchant,
  getLiveSessions,
  createLiveSession,
  updateLiveSession,
  deleteLiveSession,
  getOrders,
  createOrder,
  getExpenses,
  createExpense,
  getCosts,
  createCost,
  getIncome,
  createIncome,
  getFinancialSummary,
  getInfluencerRanking,
  getPlatformComparison,
  getMonthlyTrend,
};
