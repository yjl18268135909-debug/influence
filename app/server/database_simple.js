const Database = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbDir = path.join(__dirname, '../data');
const dbPath = path.join(dbDir, 'finance.db');

// 确保数据目录存在
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath, (err) => {
  if (err) {
    console.error('数据库连接失败:', err.message);
  } else {
    console.log('已连接到 SQLite 数据库');
  }
});

// 使用 Promise 包装数据库操作
function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ id: this.lastID });
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

// 启用外键约束
db.run("PRAGMA foreign_keys = ON");

// 创建表结构
async function initDatabase() {
  const tables = [
    // 达人表
    `CREATE TABLE IF NOT EXISTS influencers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      platform TEXT NOT NULL,
      tiktok_handle TEXT,
      shopee_handle TEXT,
      email TEXT,
      phone TEXT,
      commission_rate REAL DEFAULT 0,
      region TEXT DEFAULT 'SG',
      status TEXT DEFAULT 'active',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

    // 商家表
    `CREATE TABLE IF NOT EXISTS merchants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
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
    )`,

    // 商品表
    `CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      merchant_id INTEGER NOT NULL,
      sku TEXT UNIQUE,
      name TEXT NOT NULL,
      category TEXT,
      cost_price REAL NOT NULL,
      selling_price REAL NOT NULL,
      platform TEXT NOT NULL,
      FOREIGN KEY (merchant_id) REFERENCES merchants(id)
    )`,

    // 直播场次表
    `CREATE TABLE IF NOT EXISTS live_sessions (
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
    )`,

    // 订单表
    `CREATE TABLE IF NOT EXISTS orders (
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
    )`,

    // 支出表
    `CREATE TABLE IF NOT EXISTS expenses (
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
    )`,

    // 成本表
    `CREATE TABLE IF NOT EXISTS costs (
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
      description TEXT,
      allocation_method TEXT DEFAULT 'average',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (related_influencer_id) REFERENCES influencers(id),
      FOREIGN KEY (related_merchant_id) REFERENCES merchants(id),
      FOREIGN KEY (related_live_session_id) REFERENCES live_sessions(id),
      FOREIGN KEY (related_order_id) REFERENCES orders(id)
    )`
  ];

  for (const sql of tables) {
    await run(sql);
  }

  // 创建索引
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_orders_influencer ON orders(influencer_id)',
    'CREATE INDEX IF NOT EXISTS idx_orders_merchant ON orders(merchant_id)',
    'CREATE INDEX IF NOT EXISTS idx_orders_date ON orders(order_date)',
    'CREATE INDEX IF NOT EXISTS idx_orders_platform ON orders(platform)',
    'CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date)',
    'CREATE INDEX IF NOT EXISTS idx_expenses_influencer ON expenses(related_influencer_id)',
    'CREATE INDEX IF NOT EXISTS idx_costs_date ON costs(cost_date)',
    'CREATE INDEX IF NOT EXISTS idx_costs_influencer ON costs(related_influencer_id)',
    'CREATE INDEX IF NOT EXISTS idx_live_sessions_date ON live_sessions(session_date)',
    'CREATE INDEX IF NOT EXISTS idx_live_sessions_influencer ON live_sessions(influencer_id)'
  ];

  for (const sql of indexes) {
    await run(sql);
  }

  console.log('数据库初始化完成');
}

// 初始化数据库
initDatabase().catch(console.error);

module.exports = { db, run, all, get };
