const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const defaultDbDir = path.join(__dirname, '../data');
const dbPath = process.env.DATABASE_PATH || path.join(defaultDbDir, 'finance.db');
const dbDir = path.dirname(dbPath);

// 确保数据目录存在
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);
console.log('已连接到 SQLite 数据库');

// 启用外键约束
db.pragma('foreign_keys = ON');

// 创建表结构
function initDatabase() {
  // 达人表
  db.exec(`
    CREATE TABLE IF NOT EXISTS influencers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      platform TEXT NOT NULL,
      name TEXT NOT NULL,
      account TEXT NOT NULL,
      tier TEXT,
      agency TEXT,
      single_session_data TEXT,
      product_direction TEXT,
      commission_rate REAL NOT NULL DEFAULT 0,
      contact TEXT,
      sample_address TEXT,
      notes TEXT,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 商家表
  db.exec(`
    CREATE TABLE IF NOT EXISTS merchants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT,
      contact_person TEXT,
      email TEXT,
      phone TEXT,
      platform TEXT NOT NULL,
      commission_rate REAL DEFAULT 0,
      settlement_cycle TEXT DEFAULT 'monthly',
      status TEXT DEFAULT 'active',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 商品表
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      merchant_id INTEGER NOT NULL,
      sku TEXT UNIQUE,
      name TEXT NOT NULL,
      category TEXT,
      cost_price REAL NOT NULL,
      selling_price REAL NOT NULL,
      platform TEXT NOT NULL,
      FOREIGN KEY (merchant_id) REFERENCES merchants(id)
    )
  `);

  // 直播场次表
  db.exec(`
    CREATE TABLE IF NOT EXISTS live_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      influencer_id INTEGER NOT NULL,
      merchant_id INTEGER NOT NULL,
      platform TEXT NOT NULL,
      session_date DATETIME NOT NULL,
      duration_hours REAL,
      viewers INTEGER DEFAULT 0,
      gmv REAL DEFAULT 0,
      orders_count INTEGER DEFAULT 0,
      status TEXT DEFAULT 'completed',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (influencer_id) REFERENCES influencers(id),
      FOREIGN KEY (merchant_id) REFERENCES merchants(id)
    )
  `);

  // 数据看板手动目标
  db.exec(`
    CREATE TABLE IF NOT EXISTS dashboard_targets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      scope_key TEXT NOT NULL UNIQUE,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      dimension TEXT DEFAULT 'custom',
      influencer_id INTEGER,
      received_target_gmv REAL DEFAULT 0,
      sales_gmv REAL DEFAULT 0,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const ensureColumn = (table, column, definition) => {
    const columns = db.prepare(`PRAGMA table_info(${table})`).all();
    if (!columns.some((item) => item.name === column)) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
  };

  ensureColumn('merchants', 'cargo_sheet_url', 'TEXT');
  ensureColumn('merchants', 'supply_price_sheet_url', 'TEXT');
  ensureColumn('merchants', 'cooperation_mode', 'TEXT');
  ensureColumn('merchants', 'cooperation_notes', 'TEXT');
  ensureColumn('merchants', 'brand_address', 'TEXT');
  ensureColumn('merchants', 'brand_intro', 'TEXT');
  ensureColumn('merchants', 'brand_assistants', 'TEXT');
  ensureColumn('merchants', 'brand_live_venue', 'TEXT');
  ensureColumn('merchants', 'brand_cards', 'TEXT');
  ensureColumn('merchants', 'other_files', 'TEXT');
  ensureColumn('merchants', 'company_name', 'TEXT');
  ensureColumn('merchants', 'has_strong_assistant', 'TEXT');
  ensureColumn('merchants', 'merchant_store', 'TEXT');
  ensureColumn('merchants', 'country', 'TEXT');
  ensureColumn('merchants', 'merchant_owner', 'TEXT');
  ensureColumn('merchants', 'primary_category', 'TEXT');
  ensureColumn('merchants', 'secondary_category', 'TEXT');
  ensureColumn('influencers', 'tier', 'TEXT');

  ensureColumn('live_sessions', 'cargo_sheet', 'TEXT');
  ensureColumn('live_sessions', 'traffic_plan', 'TEXT');
  ensureColumn('live_sessions', 'estimated_ad_cost', 'REAL DEFAULT 0');
  ensureColumn('live_sessions', 'expected_gmv', 'REAL DEFAULT 0');
  ensureColumn('live_sessions', 'influencer_commission_rate', 'REAL DEFAULT 0');
  ensureColumn('live_sessions', 'brand_commission_rate', 'REAL DEFAULT 0');
  ensureColumn('live_sessions', 'travel_cost_share', 'REAL DEFAULT 0');
  ensureColumn('live_sessions', 'brand_receivable', 'REAL DEFAULT 0');
  ensureColumn('live_sessions', 'owner', 'TEXT');
  ensureColumn('live_sessions', 'assistant', 'TEXT');
  ensureColumn('live_sessions', 'live_city', 'TEXT');
  ensureColumn('live_sessions', 'live_venue', 'TEXT');
  ensureColumn('live_sessions', 'live_network', 'TEXT');
  ensureColumn('live_sessions', 'samples', 'TEXT');
  ensureColumn('live_sessions', 'schedule_type', "TEXT DEFAULT 'session'");
  ensureColumn('live_sessions', 'influencer_travel_note', 'TEXT');
  ensureColumn('live_sessions', 'schedule_other_note', 'TEXT');
  ensureColumn('live_sessions', 'brand_category', 'TEXT');
  ensureColumn('live_sessions', 'brand_cooperation_mode', 'TEXT');
  ensureColumn('live_sessions', 'plan_notes', 'TEXT');
  ensureColumn('live_sessions', 'execution_notes', 'TEXT');
  ensureColumn('live_sessions', 'cost_notes', 'TEXT');
  ensureColumn('live_sessions', 'actual_gmv_sgd', 'REAL DEFAULT 0');
  ensureColumn('live_sessions', 'big_screen_screenshot', 'TEXT');
  ensureColumn('live_sessions', 'actual_traffic_usd', 'REAL DEFAULT 0');
  ensureColumn('live_sessions', 'screen_traffic_sgd', 'REAL DEFAULT 0');
  ensureColumn('live_sessions', 'actual_traffic_provider', 'TEXT');
  ensureColumn('live_sessions', 'traffic_receivable_type', 'TEXT');
  ensureColumn('live_sessions', 'traffic_receivable_amount', 'REAL DEFAULT 0');
  ensureColumn('live_sessions', 'traffic_notes', 'TEXT');
  ensureColumn('live_sessions', 'post_live_notes', 'TEXT');
  ensureColumn('live_sessions', 'received_amount', 'REAL DEFAULT 0');
  ensureColumn('live_sessions', 'payment_notes', 'TEXT');
  ensureColumn('live_sessions', 'is_bad_debt', 'INTEGER DEFAULT 0');

  // 订单表
  db.exec(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_no TEXT UNIQUE NOT NULL,
      live_session_id INTEGER,
      influencer_id INTEGER NOT NULL,
      merchant_id INTEGER NOT NULL,
      product_id INTEGER,
      platform TEXT NOT NULL,
      order_date DATETIME NOT NULL,
      product_name TEXT,
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      total_amount REAL NOT NULL,
      commission_rate REAL,
      commission_amount REAL DEFAULT 0,
      settlement_status TEXT DEFAULT 'pending',
      settlement_date DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (live_session_id) REFERENCES live_sessions(id),
      FOREIGN KEY (influencer_id) REFERENCES influencers(id),
      FOREIGN KEY (merchant_id) REFERENCES merchants(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    )
  `);

  // 支出表
  db.exec(`
    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      category TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT DEFAULT 'SGD',
      expense_date DATETIME NOT NULL,
      related_influencer_id INTEGER,
      related_merchant_id INTEGER,
      related_live_session_id INTEGER,
      description TEXT,
      payment_method TEXT,
      status TEXT DEFAULT 'paid',
      receipt_no TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (related_influencer_id) REFERENCES influencers(id),
      FOREIGN KEY (related_merchant_id) REFERENCES merchants(id),
      FOREIGN KEY (related_live_session_id) REFERENCES live_sessions(id)
    )
  `);

  // 成本表
  db.exec(`
    CREATE TABLE IF NOT EXISTS costs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      category TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT DEFAULT 'SGD',
      cost_date DATETIME NOT NULL,
      related_influencer_id INTEGER,
      related_merchant_id INTEGER,
      related_live_session_id INTEGER,
      related_order_id INTEGER,
      related_product_id INTEGER,
      description TEXT,
      allocation_method TEXT DEFAULT 'average',
      status TEXT DEFAULT 'confirmed',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (related_influencer_id) REFERENCES influencers(id),
      FOREIGN KEY (related_merchant_id) REFERENCES merchants(id),
      FOREIGN KEY (related_live_session_id) REFERENCES live_sessions(id),
      FOREIGN KEY (related_order_id) REFERENCES orders(id),
      FOREIGN KEY (related_product_id) REFERENCES products(id)
    )
  `);
  ensureColumn('costs', 'related_live_session_id', 'INTEGER');
  ensureColumn('costs', 'related_order_id', 'INTEGER');
  ensureColumn('costs', 'allocation_method', "TEXT DEFAULT 'average'");

  // 收入表
  db.exec(`
    CREATE TABLE IF NOT EXISTS income (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      category TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT DEFAULT 'SGD',
      income_date DATETIME NOT NULL,
      related_influencer_id INTEGER,
      related_merchant_id INTEGER,
      related_order_id INTEGER,
      description TEXT,
      status TEXT DEFAULT 'confirmed',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (related_influencer_id) REFERENCES influencers(id),
      FOREIGN KEY (related_merchant_id) REFERENCES merchants(id),
      FOREIGN KEY (related_order_id) REFERENCES orders(id)
    )
  `);

  // 机酒/应收款项明细表
  db.exec(`
    CREATE TABLE IF NOT EXISTS travel_receivables (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      receivable_date DATETIME NOT NULL,
      receivable_type TEXT NOT NULL,
      object_name TEXT,
      reason TEXT,
      amount REAL DEFAULT 0,
      notes TEXT,
      received_amount REAL DEFAULT 0,
      payment_notes TEXT,
      is_bad_debt INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  ensureColumn('travel_receivables', 'received_amount', 'REAL DEFAULT 0');
  ensureColumn('travel_receivables', 'payment_notes', 'TEXT');
  ensureColumn('travel_receivables', 'is_bad_debt', 'INTEGER DEFAULT 0');

  // 应付款项明细表
  db.exec(`
    CREATE TABLE IF NOT EXISTS travel_payables (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      payable_date DATETIME NOT NULL,
      payable_type TEXT NOT NULL,
      object_name TEXT,
      reason TEXT,
      amount REAL DEFAULT 0,
      notes TEXT,
      paid_amount REAL DEFAULT 0,
      payment_notes TEXT,
      is_paid INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  ensureColumn('travel_payables', 'paid_amount', 'REAL DEFAULT 0');
  ensureColumn('travel_payables', 'payment_notes', 'TEXT');
  ensureColumn('travel_payables', 'is_paid', 'INTEGER DEFAULT 0');

  // 工作推进表
  db.exec(`
    CREATE TABLE IF NOT EXISTS work_progress_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fill_time DATETIME NOT NULL,
      required_finish_time DATETIME,
      urgency TEXT DEFAULT '需要',
      urgency_note TEXT,
      requester TEXT,
      executor_role TEXT,
      requirement TEXT NOT NULL,
      executor_ack TEXT DEFAULT '否',
      is_done TEXT DEFAULT '否',
      finished_at DATETIME,
      completion_link TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 系统账号表
  db.exec(`
    CREATE TABLE IF NOT EXISTS app_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const accountCount = db.prepare('SELECT COUNT(*) as count FROM app_accounts').get();
  if (!accountCount.count) {
    const insertAccount = db.prepare(`
      INSERT INTO app_accounts (username, password, name, role, status)
      VALUES (?, ?, ?, ?, 'active')
    `);
    [
      ['weilun', '123456', 'weilun', '老板'],
      ['boss', '123456', '老板', '老板'],
      ['finance', '123456', '财务', '财务'],
      ['Mia', '123456', 'Mia', '运营'],
      ['Aaron', '123456', 'Aaron', '运营'],
      ['Sophie', '123456', 'Sophie', '运营'],
    ].forEach((account) => insertAccount.run(...account));
  }

  // 创建索引
  db.exec('CREATE INDEX IF NOT EXISTS idx_orders_influencer ON orders(influencer_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_orders_merchant ON orders(merchant_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_orders_date ON orders(order_date)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_orders_platform ON orders(platform)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_expenses_influencer ON expenses(related_influencer_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_costs_date ON costs(cost_date)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_costs_influencer ON costs(related_influencer_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_live_sessions_date ON live_sessions(session_date)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_live_sessions_influencer ON live_sessions(influencer_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_travel_receivables_date ON travel_receivables(receivable_date)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_travel_receivables_type ON travel_receivables(receivable_type)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_travel_receivables_reason ON travel_receivables(reason)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_travel_receivables_object ON travel_receivables(object_name)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_travel_payables_date ON travel_payables(payable_date)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_travel_payables_type ON travel_payables(payable_type)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_travel_payables_reason ON travel_payables(reason)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_travel_payables_object ON travel_payables(object_name)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_work_progress_fill_time ON work_progress_items(fill_time)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_work_progress_required_time ON work_progress_items(required_finish_time)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_work_progress_urgency ON work_progress_items(urgency)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_work_progress_done ON work_progress_items(is_done)');

  console.log('数据库初始化完成');
}

// 初始化数据库
initDatabase();

module.exports = db;
