const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 5001;

// 中间件
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// 数据库连接
const dbDir = path.join(__dirname, '../data');
const dbPath = path.join(dbDir, 'finance.db');

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('数据库连接失败:', err.message);
  } else {
    console.log('已连接到 SQLite 数据库');
  }
});

// 创建表
db.serialize(() => {
  db.run('PRAGMA foreign_keys = ON');

  // 达人表
  db.run(`CREATE TABLE IF NOT EXISTS influencers (
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
  )`);

  // 商家表
  db.run(`CREATE TABLE IF NOT EXISTS merchants (
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
  )`);

  // 直播场次表
  db.run(`CREATE TABLE IF NOT EXISTS live_sessions (
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
  )`);

  // 订单表
  db.run(`CREATE TABLE IF NOT EXISTS orders (
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
    FOREIGN KEY (merchant_id) REFERENCES merchants(id)
  )`);

  // 支出表
  db.run(`CREATE TABLE IF NOT EXISTS expenses (
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
  )`);

  // 成本表
  db.run(`CREATE TABLE IF NOT EXISTS costs (
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
  )`);

  console.log('数据库初始化完成');
});

// ==================== 达人相关路由 ====================
app.get('/api/influencers', (req, res) => {
  const { status, platform } = req.query;
  let query = 'SELECT * FROM influencers WHERE 1=1';
  const params = [];

  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }
  if (platform) {
    query += ' AND platform = ?';
    params.push(platform);
  }

  query += ' ORDER BY created_at DESC';

  db.all(query, params, (err, rows) => {
    if (err) {
      res.status(500).json({ success: false, error: err.message });
    } else {
      res.json({ success: true, data: rows });
    }
  });
});

app.post('/api/influencers', (req, res) => {
  const { name, platform, tiktok_handle, shopee_handle, email, phone, commission_rate, region, status, notes } = req.body;
  const query = `INSERT INTO influencers (name, platform, tiktok_handle, shopee_handle, email, phone, commission_rate, region, status, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  const params = [name, platform, tiktok_handle || null, shopee_handle || null, email || null, phone || null, commission_rate || 0, region || 'SG', status || 'active', notes || null];

  db.run(query, params, function(err) {
    if (err) {
      res.status(500).json({ success: false, error: err.message });
    } else {
      res.json({ success: true, data: { id: this.lastID, ...req.body } });
    }
  });
});

app.put('/api/influencers/:id', (req, res) => {
  const { name, platform, tiktok_handle, shopee_handle, email, phone, commission_rate, region, status, notes } = req.body;
  const query = `UPDATE influencers SET name = ?, platform = ?, tiktok_handle = ?, shopee_handle = ?, email = ?, phone = ?, commission_rate = ?, region = ?, status = ?, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
  const params = [name, platform, tiktok_handle || null, shopee_handle || null, email || null, phone || null, commission_rate || 0, region || 'SG', status || 'active', notes || null, req.params.id];

  db.run(query, params, function(err) {
    if (err) {
      res.status(500).json({ success: false, error: err.message });
    } else {
      res.json({ success: true, data: { id: req.params.id, ...req.body } });
    }
  });
});

app.delete('/api/influencers/:id', (req, res) => {
  db.run('DELETE FROM influencers WHERE id = ?', [req.params.id], function(err) {
    if (err) {
      res.status(500).json({ success: false, error: err.message });
    } else {
      res.json({ success: true });
    }
  });
});

// ==================== 商家相关路由 ====================
app.get('/api/merchants', (req, res) => {
  const { status, platform } = req.query;
  let query = 'SELECT * FROM merchants WHERE 1=1';
  const params = [];

  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }
  if (platform) {
    query += ' AND platform = ?';
    params.push(platform);
  }

  query += ' ORDER BY created_at DESC';

  db.all(query, params, (err, rows) => {
    if (err) {
      res.status(500).json({ success: false, error: err.message });
    } else {
      res.json({ success: true, data: rows });
    }
  });
});

app.post('/api/merchants', (req, res) => {
  const { name, contact_person, email, phone, platform, commission_rate, settlement_cycle, status, notes } = req.body;
  const query = `INSERT INTO merchants (name, contact_person, email, phone, platform, commission_rate, settlement_cycle, status, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  const params = [name, contact_person || null, email || null, phone || null, platform, commission_rate || 0, settlement_cycle || 'monthly', status || 'active', notes || null];

  db.run(query, params, function(err) {
    if (err) {
      res.status(500).json({ success: false, error: err.message });
    } else {
      res.json({ success: true, data: { id: this.lastID, ...req.body } });
    }
  });
});

// ==================== 直播场次相关路由 ====================
app.get('/api/live-sessions', (req, res) => {
  const query = `
    SELECT ls.*, i.name as influencer_name, m.name as merchant_name
    FROM live_sessions ls
    LEFT JOIN influencers i ON ls.influencer_id = i.id
    LEFT JOIN merchants m ON ls.merchant_id = m.id
    ORDER BY ls.session_date DESC
  `;

  db.all(query, [], (err, rows) => {
    if (err) {
      res.status(500).json({ success: false, error: err.message });
    } else {
      res.json({ success: true, data: rows });
    }
  });
});

app.post('/api/live-sessions', (req, res) => {
  const { influencer_id, merchant_id, platform, session_date, duration_hours, viewers, gmv, orders_count, status, notes } = req.body;
  const query = `INSERT INTO live_sessions (influencer_id, merchant_id, platform, session_date, duration_hours, viewers, gmv, orders_count, status, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  const params = [
    influencer_id,
    merchant_id,
    platform,
    session_date,
    duration_hours || 0,
    viewers || 0,
    gmv || 0,
    orders_count || 0,
    status || 'completed',
    notes || null
  ];

  db.run(query, params, function(err) {
    if (err) {
      res.status(500).json({ success: false, error: err.message });
    } else {
      res.json({ success: true, data: { id: this.lastID, ...req.body } });
    }
  });
});

// ==================== 订单相关路由 ====================
app.get('/api/orders', (req, res) => {
  const { settlement_status, platform } = req.query;
  let query = `
    SELECT o.*, i.name as influencer_name, m.name as merchant_name
    FROM orders o
    LEFT JOIN influencers i ON o.influencer_id = i.id
    LEFT JOIN merchants m ON o.merchant_id = m.id
    WHERE 1=1
  `;
  const params = [];

  if (settlement_status) {
    query += ' AND o.settlement_status = ?';
    params.push(settlement_status);
  }
  if (platform) {
    query += ' AND o.platform = ?';
    params.push(platform);
  }

  query += ' ORDER BY o.order_date DESC';

  db.all(query, params, (err, rows) => {
    if (err) {
      res.status(500).json({ success: false, error: err.message });
    } else {
      res.json({ success: true, data: rows });
    }
  });
});

app.post('/api/orders', (req, res) => {
  const { order_no, live_session_id, influencer_id, merchant_id, product_id, platform, order_date, product_name, quantity, unit_price, total_amount, commission_rate, commission_amount, settlement_status, settlement_date } = req.body;
  const query = `INSERT INTO orders (order_no, live_session_id, influencer_id, merchant_id, product_id, platform, order_date, product_name, quantity, unit_price, total_amount, commission_rate, commission_amount, settlement_status, settlement_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  const params = [
    order_no,
    live_session_id || null,
    influencer_id,
    merchant_id,
    product_id || null,
    platform,
    order_date,
    product_name || null,
    quantity,
    unit_price,
    total_amount,
    commission_rate || 0,
    commission_amount || 0,
    settlement_status || 'pending',
    settlement_date || null
  ];

  db.run(query, params, function(err) {
    if (err) {
      res.status(500).json({ success: false, error: err.message });
    } else {
      res.json({ success: true, data: { id: this.lastID, ...req.body } });
    }
  });
});

app.put('/api/orders/:id', (req, res) => {
  const { order_no, live_session_id, influencer_id, merchant_id, product_id, platform, order_date, product_name, quantity, unit_price, total_amount, commission_rate, commission_amount, settlement_status, settlement_date } = req.body;
  const query = `UPDATE orders SET order_no = ?, live_session_id = ?, influencer_id = ?, merchant_id = ?, product_id = ?, platform = ?, order_date = ?, product_name = ?, quantity = ?, unit_price = ?, total_amount = ?, commission_rate = ?, commission_amount = ?, settlement_status = ?, settlement_date = ? WHERE id = ?`;
  const params = [
    order_no,
    live_session_id || null,
    influencer_id,
    merchant_id,
    product_id || null,
    platform,
    order_date,
    product_name || null,
    quantity,
    unit_price,
    total_amount,
    commission_rate || 0,
    commission_amount || 0,
    settlement_status || 'pending',
    settlement_date || null,
    req.params.id
  ];

  db.run(query, params, function(err) {
    if (err) {
      res.status(500).json({ success: false, error: err.message });
    } else {
      res.json({ success: true, data: { id: req.params.id, ...req.body } });
    }
  });
});

app.delete('/api/orders/:id', (req, res) => {
  db.run('DELETE FROM orders WHERE id = ?', [req.params.id], function(err) {
    if (err) {
      res.status(500).json({ success: false, error: err.message });
    } else {
      res.json({ success: true });
    }
  });
});

// ==================== 成本相关路由 ====================
app.get('/api/costs', (req, res) => {
  const { type, category } = req.query;
  let query = 'SELECT * FROM costs WHERE 1=1';
  const params = [];

  if (type) {
    query += ' AND type = ?';
    params.push(type);
  }
  if (category) {
    query += ' AND category = ?';
    params.push(category);
  }

  query += ' ORDER BY cost_date DESC';

  db.all(query, params, (err, rows) => {
    if (err) {
      res.status(500).json({ success: false, error: err.message });
    } else {
      res.json({ success: true, data: rows });
    }
  });
});

app.post('/api/costs', (req, res) => {
  const { type, category, amount, currency, cost_date, related_influencer_id, related_merchant_id, related_live_session_id, related_order_id, description, allocation_method } = req.body;
  const query = `INSERT INTO costs (type, category, amount, currency, cost_date, related_influencer_id, related_merchant_id, related_live_session_id, related_order_id, description, allocation_method)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  const params = [
    type,
    category,
    amount || 0,
    currency || 'SGD',
    cost_date,
    related_influencer_id || null,
    related_merchant_id || null,
    related_live_session_id || null,
    related_order_id || null,
    description || null,
    allocation_method || 'average'
  ];

  db.run(query, params, function(err) {
    if (err) {
      res.status(500).json({ success: false, error: err.message });
    } else {
      res.json({ success: true, data: { id: this.lastID, ...req.body } });
    }
  });
});

app.put('/api/costs/:id', (req, res) => {
  const { type, category, amount, currency, cost_date, related_influencer_id, related_merchant_id, related_live_session_id, related_order_id, description, allocation_method } = req.body;
  const query = `UPDATE costs SET type = ?, category = ?, amount = ?, currency = ?, cost_date = ?, related_influencer_id = ?, related_merchant_id = ?, related_live_session_id = ?, related_order_id = ?, description = ?, allocation_method = ? WHERE id = ?`;
  const params = [
    type,
    category,
    amount || 0,
    currency || 'SGD',
    cost_date,
    related_influencer_id || null,
    related_merchant_id || null,
    related_live_session_id || null,
    related_order_id || null,
    description || null,
    allocation_method || 'average',
    req.params.id
  ];

  db.run(query, params, function(err) {
    if (err) {
      res.status(500).json({ success: false, error: err.message });
    } else {
      res.json({ success: true, data: { id: req.params.id, ...req.body } });
    }
  });
});

app.delete('/api/costs/:id', (req, res) => {
  db.run('DELETE FROM costs WHERE id = ?', [req.params.id], function(err) {
    if (err) {
      res.status(500).json({ success: false, error: err.message });
    } else {
      res.json({ success: true });
    }
  });
});

// ==================== 报表相关路由 ====================
app.get('/api/reports/summary', (req, res) => {
  const { startDate, endDate, influencerId, platform } = req.query;

  // 收入统计
  const incomeQuery = `
    SELECT
      COUNT(*) as order_count,
      SUM(total_amount) as total_revenue,
      SUM(commission_amount) as total_commission,
      SUM(CASE WHEN settlement_status = 'settled' THEN total_amount ELSE 0 END) as settled_amount
    FROM orders
    WHERE 1=1
    ${startDate && endDate ? `AND order_date BETWEEN ? AND ?` : ''}
    ${influencerId ? `AND influencer_id = ?` : ''}
    ${platform ? `AND platform = ?` : ''}
  `;

  const incomeParams = [];
  if (startDate && endDate) incomeParams.push(startDate, endDate);
  if (influencerId) incomeParams.push(influencerId);
  if (platform) incomeParams.push(platform);

  // 支出统计
  const expenseQuery = `
    SELECT
      COUNT(*) as expense_count,
      SUM(amount) as total_expense
    FROM expenses
    WHERE 1=1
    ${startDate && endDate ? `AND expense_date BETWEEN ? AND ?` : ''}
    ${influencerId ? `AND related_influencer_id = ?` : ''}
  `;

  const expenseParams = [];
  if (startDate && endDate) expenseParams.push(startDate, endDate);
  if (influencerId) expenseParams.push(influencerId);

  // 成本统计
  const costQuery = `
    SELECT
      COUNT(*) as cost_count,
      SUM(amount) as total_cost
    FROM costs
    WHERE 1=1
    ${startDate && endDate ? `AND cost_date BETWEEN ? AND ?` : ''}
    ${influencerId ? `AND related_influencer_id = ?` : ''}
  `;

  const costParams = [];
  if (startDate && endDate) costParams.push(startDate, endDate);
  if (influencerId) costParams.push(influencerId);

  // 回款统计
  const settlementQuery = `
    SELECT
      COUNT(*) as settled_count,
      SUM(total_amount) as total_settled
    FROM orders
    WHERE settlement_status = 'settled'
    ${startDate && endDate ? `AND order_date BETWEEN ? AND ?` : ''}
    ${influencerId ? `AND influencer_id = ?` : ''}
    ${platform ? `AND platform = ?` : ''}
  `;

  const settlementParams = [];
  if (startDate && endDate) settlementParams.push(startDate, endDate);
  if (influencerId) settlementParams.push(influencerId);
  if (platform) settlementParams.push(platform);

  db.get(incomeQuery, incomeParams, (err, income) => {
    if (err) {
      res.status(500).json({ success: false, error: err.message });
      return;
    }

    db.get(expenseQuery, expenseParams, (err, expense) => {
      if (err) {
        res.status(500).json({ success: false, error: err.message });
        return;
      }

      db.get(costQuery, costParams, (err, cost) => {
        if (err) {
          res.status(500).json({ success: false, error: err.message });
          return;
        }

        db.get(settlementQuery, settlementParams, (err, settlement) => {
          if (err) {
            res.status(500).json({ success: false, error: err.message });
            return;
          }

          const totalRevenue = income.total_revenue || 0;
          const settledAmount = income.settled_amount || settlement.total_settled || 0;
          const totalExpense = expense.total_expense || 0;
          const totalCost = cost.total_cost || 0;
          const totalCommission = income.total_commission || 0;
          const grossProfit = totalRevenue - totalCommission;
          const netProfit = grossProfit - totalExpense - totalCost;

          const summary = {
            period: { startDate: startDate || null, endDate: endDate || null },
            revenue: {
              orderCount: income.order_count || 0,
              totalRevenue: totalRevenue,
              settledAmount: settledAmount,
              settledCount: settlement.settled_count || 0,
              totalCommission: totalCommission,
              grossProfit: grossProfit
            },
            expense: {
              expenseCount: expense.expense_count || 0,
              totalExpense: totalExpense
            },
            cost: {
              costCount: cost.cost_count || 0,
              totalCost: totalCost
            },
            profit: {
              grossProfit: grossProfit,
              netProfit: netProfit,
              profitMargin: totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(2) : 0
            }
          };

          res.json({ success: true, data: summary });
        });
      });
    });
  });
});

app.get('/api/reports/influencer-ranking', (req, res) => {
  const { startDate, endDate, platform } = req.query;

  const query = `
    SELECT
      i.id,
      i.name,
      i.platform,
      i.commission_rate,
      COUNT(DISTINCT o.id) as order_count,
      COALESCE(SUM(o.total_amount), 0) as total_revenue,
      COALESCE(SUM(o.commission_amount), 0) as total_commission
    FROM influencers i
    LEFT JOIN orders o ON i.id = o.influencer_id
    WHERE 1=1
    ${startDate && endDate ? `AND (o.order_date IS NULL OR o.order_date BETWEEN ? AND ?)` : ''}
    ${platform ? `AND i.platform = ?` : ''}
    GROUP BY i.id
    ORDER BY total_revenue DESC
  `;

  const params = [];
  if (startDate && endDate) params.push(startDate, endDate);
  if (platform) params.push(platform);

  db.all(query, params, (err, rows) => {
    if (err) {
      res.status(500).json({ success: false, error: err.message });
    } else {
      res.json({ success: true, data: rows });
    }
  });
});

app.get('/api/reports/platform-comparison', (req, res) => {
  const { startDate, endDate } = req.query;

  const query = `
    SELECT
      platform,
      COUNT(DISTINCT id) as order_count,
      SUM(total_amount) as total_revenue,
      SUM(commission_amount) as total_commission
    FROM orders
    WHERE 1=1
    ${startDate && endDate ? `AND order_date BETWEEN ? AND ?` : ''}
    GROUP BY platform
  `;

  const params = [];
  if (startDate && endDate) params.push(startDate, endDate);

  db.all(query, params, (err, rows) => {
    if (err) {
      res.status(500).json({ success: false, error: err.message });
    } else {
      res.json({ success: true, data: rows });
    }
  });
});

app.get('/api/reports/monthly-trend', (req, res) => {
  const { startDate, endDate, influencerId, platform } = req.query;

  const query = `
    SELECT
      strftime('%Y-%m', order_date) as month,
      COUNT(*) as order_count,
      SUM(total_amount) as total_revenue,
      SUM(commission_amount) as total_commission,
      SUM(CASE WHEN settlement_status = 'settled' THEN total_amount ELSE 0 END) as settled_amount
    FROM orders
    WHERE 1=1
    ${startDate && endDate ? `AND order_date BETWEEN ? AND ?` : ''}
    ${influencerId ? `AND influencer_id = ?` : ''}
    ${platform ? `AND platform = ?` : ''}
    GROUP BY strftime('%Y-%m', order_date)
    ORDER BY month DESC
    LIMIT 12
  `;

  const params = [];
  if (startDate && endDate) params.push(startDate, endDate);
  if (influencerId) params.push(influencerId);
  if (platform) params.push(platform);

  db.all(query, params, (err, rows) => {
    if (err) {
      res.status(500).json({ success: false, error: err.message });
    } else {
      res.json({ success: true, data: rows });
    }
  });
});

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 支出/收入相关API
app.get('/api/expenses', (req, res) => {
  const { type } = req.query;
  let query = 'SELECT * FROM expenses WHERE 1=1';
  const params = [];

  if (type) {
    query += ' AND type = ?';
    params.push(type);
  }

  query += ' ORDER BY created_at DESC';

  db.all(query, params, (err, rows) => {
    if (err) {
      res.status(500).json({ success: false, error: err.message });
    } else {
      res.json({ success: true, data: rows });
    }
  });
});

app.post('/api/expenses', (req, res) => {
  const { category, amount, description, expense_date, type } = req.body;
  const query = `INSERT INTO expenses (category, amount, description, expense_date, type)
    VALUES (?, ?, ?, ?, ?)`;
  const params = [
    category || '其他',
    amount || 0,
    description || '',
    expense_date || new Date().toISOString().split('T')[0],
    type || 'expense'
  ];

  db.run(query, params, function(err) {
    if (err) {
      res.status(500).json({ success: false, error: err.message });
    } else {
      res.json({ success: true, data: { id: this.lastID, ...req.body } });
    }
  });
});

app.put('/api/expenses/:id', (req, res) => {
  const { category, amount, description, expense_date, type } = req.body;
  const query = `UPDATE expenses SET category = ?, amount = ?, description = ?, expense_date = ?, type = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
  const params = [
    category || '其他',
    amount || 0,
    description || '',
    expense_date || new Date().toISOString().split('T')[0],
    type || 'expense',
    req.params.id
  ];

  db.run(query, params, function(err) {
    if (err) {
      res.status(500).json({ success: false, error: err.message });
    } else {
      res.json({ success: true, data: { id: req.params.id, ...req.body } });
    }
  });
});

app.delete('/api/expenses/:id', (req, res) => {
  db.run('DELETE FROM expenses WHERE id = ?', [req.params.id], function(err) {
    if (err) {
      res.status(500).json({ success: false, error: err.message });
    } else {
      res.json({ success: true });
    }
  });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
  console.log(`API文档: http://localhost:${PORT}/api/health`);
});
