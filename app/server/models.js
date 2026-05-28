const db = require('./database');

// ==================== 系统账号相关操作 ====================

function getAccounts() {
  return db.prepare(`
    SELECT id, username, name, role, status, created_at, updated_at
    FROM app_accounts
    ORDER BY id ASC
  `).all();
}

function findAccountByLogin(username, password) {
  return db.prepare(`
    SELECT id, username, name, role, status
    FROM app_accounts
    WHERE username = ? AND password = ? AND status = 'active'
    LIMIT 1
  `).get(username, password);
}

function createAccount(data) {
  const stmt = db.prepare(`
    INSERT INTO app_accounts (username, password, name, role, status)
    VALUES (?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    data.username,
    data.password || '123456',
    data.name,
    data.role,
    data.status || 'active'
  );
  return db.prepare(`
    SELECT id, username, name, role, status, created_at, updated_at
    FROM app_accounts
    WHERE id = ?
  `).get(result.lastInsertRowid);
}

function updateAccount(id, data) {
  const current = db.prepare('SELECT * FROM app_accounts WHERE id = ?').get(id);
  if (!current) return null;

  const nextPassword = data.password ? data.password : current.password;
  db.prepare(`
    UPDATE app_accounts
    SET username = ?, password = ?, name = ?, role = ?, status = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    data.username,
    nextPassword,
    data.name,
    data.role,
    data.status || 'active',
    id
  );

  return db.prepare(`
    SELECT id, username, name, role, status, created_at, updated_at
    FROM app_accounts
    WHERE id = ?
  `).get(id);
}

function deleteAccount(id) {
  db.prepare('DELETE FROM app_accounts WHERE id = ?').run(id);
  return { success: true };
}

// ==================== 达人相关操作 ====================

// 获取所有达人
function getInfluencers(filters = {}) {
  let query = "SELECT * FROM influencers WHERE account NOT LIKE 'placeholder_%' AND account NOT LIKE 'live_%'";
  const params = [];

  if (filters.status) {
    query += ' AND status = ?';
    params.push(filters.status);
  }

  if (filters.platform) {
    query += ' AND platform = ?';
    params.push(filters.platform);
  }

  query += ' ORDER BY created_at DESC';

  const stmt = db.prepare(query);
  return stmt.all(...params);
}

// 创建达人
function createInfluencer(data) {
  const stmt = db.prepare(`
    INSERT INTO influencers (platform, name, account, agency, single_session_data, product_direction, commission_rate, contact, sample_address, notes, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    data.platform,
    data.name,
    data.account,
    data.agency || null,
    data.single_session_data || null,
    data.product_direction || null,
    data.commission_rate || 0,
    data.contact || null,
    data.sample_address || null,
    data.notes || null,
    data.status || 'active'
  );
  return { id: result.lastInsertRowid, ...data };
}

// 更新达人
function updateInfluencer(id, data) {
  const stmt = db.prepare(`
    UPDATE influencers
    SET platform = ?, name = ?, account = ?, agency = ?, single_session_data = ?, product_direction = ?, commission_rate = ?, contact = ?, sample_address = ?, notes = ?, status = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);
  stmt.run(
    data.platform,
    data.name,
    data.account,
    data.agency || null,
    data.single_session_data || null,
    data.product_direction || null,
    data.commission_rate || 0,
    data.contact || null,
    data.sample_address || null,
    data.notes || null,
    data.status || 'active',
    id
  );
  return { id, ...data };
}

// 删除达人
function deleteInfluencer(id) {
  const stmt = db.prepare('DELETE FROM influencers WHERE id = ?');
  stmt.run(id);
  return { success: true };
}

// ==================== 商家相关操作 ====================

// 获取所有商家
function getMerchants(filters = {}) {
  let query = "SELECT * FROM merchants WHERE name != '未填写品牌'";
  const params = [];

  if (filters.status) {
    query += ' AND status = ?';
    params.push(filters.status);
  }

  if (filters.platform) {
    query += ' AND platform = ?';
    params.push(filters.platform);
  }

  query += ' ORDER BY created_at DESC';

  const stmt = db.prepare(query);
  return stmt.all(...params);
}

// 创建商家
function createMerchant(data) {
  const stmt = db.prepare(`
    INSERT INTO merchants (
      name, category, contact_person, email, phone, platform, commission_rate, settlement_cycle, status, notes,
      supply_price_sheet_url, cargo_sheet_url, cooperation_mode, cooperation_notes, brand_address,
      brand_intro, brand_assistants, brand_live_venue, brand_cards, other_files, company_name
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    data.name,
    data.category || null,
    data.contact_person || null,
    data.email || null,
    data.phone || null,
    data.platform || '',
    data.commission_rate || 0,
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
    data.company_name || null
  );
  return { id: result.lastInsertRowid, ...data };
}

// 更新商家
function updateMerchant(id, data) {
  const stmt = db.prepare(`
    UPDATE merchants
    SET name = ?, category = ?, contact_person = ?, email = ?, phone = ?, platform = ?, commission_rate = ?, settlement_cycle = ?,
        status = ?, notes = ?, supply_price_sheet_url = ?, cargo_sheet_url = ?, cooperation_mode = ?, cooperation_notes = ?,
        brand_address = ?, brand_intro = ?, brand_assistants = ?, brand_live_venue = ?, brand_cards = ?, other_files = ?, company_name = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);
  stmt.run(
    data.name,
    data.category || null,
    data.contact_person || null,
    data.email || null,
    data.phone || null,
    data.platform || '',
    data.commission_rate || 0,
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
    id
  );
  return { id, ...data };
}

// 删除商家
function deleteMerchant(id) {
  const stmt = db.prepare('DELETE FROM merchants WHERE id = ?');
  stmt.run(id);
  return { success: true };
}

// ==================== 直播场次相关操作 ====================

// 获取直播场次
function getLiveSessions(filters = {}) {
  let query = `
    SELECT ls.*, i.name as influencer_name, m.name as merchant_name,
           m.category as merchant_category, m.cooperation_mode as merchant_cooperation_mode
    FROM live_sessions ls
    LEFT JOIN influencers i ON ls.influencer_id = i.id
    LEFT JOIN merchants m ON ls.merchant_id = m.id
    WHERE 1=1
  `;
  const params = [];

  if (filters.influencer_id) {
    query += ' AND ls.influencer_id = ?';
    params.push(filters.influencer_id);
  }

  if (filters.merchant_id) {
    query += ' AND ls.merchant_id = ?';
    params.push(filters.merchant_id);
  }

  if (filters.platform) {
    query += ' AND ls.platform = ?';
    params.push(filters.platform);
  }

  if (filters.startDate && filters.endDate) {
    query += ' AND ls.session_date BETWEEN ? AND ?';
    params.push(filters.startDate, filters.endDate);
  }

  query += ' ORDER BY ls.session_date DESC';

  const stmt = db.prepare(query);
  return stmt.all(...params);
}

// 创建直播场次
function resolveLiveSessionRelations(data) {
  let influencerId = data.influencer_id;
  if (!influencerId) {
    const placeholderName = '未填写达人';
    const existing = db.prepare("SELECT id FROM influencers WHERE account = 'placeholder_influencer' LIMIT 1").get();
    if (existing) {
      influencerId = existing.id;
    } else {
      const result = db.prepare(`
        INSERT INTO influencers (platform, name, account, commission_rate, status)
        VALUES (?, ?, ?, ?, ?)
      `).run(data.platform || '', placeholderName, 'placeholder_influencer', 0, 'active');
      influencerId = result.lastInsertRowid;
    }
  }

  let merchantId = data.merchant_id;
  if (!merchantId) {
    const merchantName = data.merchant_name || '未填写品牌';
    const existing = db.prepare('SELECT id FROM merchants WHERE name = ? LIMIT 1').get(merchantName);
    if (existing) {
      merchantId = existing.id;
    } else {
      const result = db.prepare(`
        INSERT INTO merchants (name, category, platform, commission_rate, settlement_cycle, status)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(merchantName, null, data.platform || '', 0, 'monthly', 'active');
      merchantId = result.lastInsertRowid;
    }
  }

  return { influencerId, merchantId };
}

function createLiveSession(data) {
  const { influencerId, merchantId } = resolveLiveSessionRelations(data);

  const stmt = db.prepare(`
    INSERT INTO live_sessions (
      influencer_id, merchant_id, platform, session_date, duration_hours, viewers, gmv, orders_count, status, notes,
      cargo_sheet, traffic_plan, estimated_ad_cost, expected_gmv, travel_cost_share, brand_receivable, owner,
      assistant, live_city, live_venue, live_network, samples, schedule_type, influencer_travel_note, schedule_other_note,
      brand_category, brand_cooperation_mode, plan_notes, execution_notes, cost_notes,
      actual_gmv_sgd, big_screen_screenshot, actual_traffic_usd, screen_traffic_sgd, actual_traffic_provider,
      traffic_receivable_type, traffic_receivable_amount, traffic_notes, post_live_notes
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
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
    data.post_live_notes || null
  );
  return { id: result.lastInsertRowid, ...data, influencer_id: influencerId, merchant_id: merchantId };
}

function updateLiveSession(id, data) {
  const { influencerId, merchantId } = resolveLiveSessionRelations(data);

  const stmt = db.prepare(`
    UPDATE live_sessions
    SET influencer_id = ?, merchant_id = ?, platform = ?, session_date = ?, duration_hours = ?, viewers = ?, gmv = ?,
        orders_count = ?, status = ?, notes = ?, cargo_sheet = ?, traffic_plan = ?, estimated_ad_cost = ?,
        expected_gmv = ?, travel_cost_share = ?, brand_receivable = ?, owner = ?, assistant = ?, live_city = ?,
        live_venue = ?, live_network = ?, samples = ?, schedule_type = ?, influencer_travel_note = ?, schedule_other_note = ?,
        brand_category = ?, brand_cooperation_mode = ?, plan_notes = ?, execution_notes = ?, cost_notes = ?,
        actual_gmv_sgd = ?, big_screen_screenshot = ?, actual_traffic_usd = ?, screen_traffic_sgd = ?,
        actual_traffic_provider = ?, traffic_receivable_type = ?, traffic_receivable_amount = ?, traffic_notes = ?,
        post_live_notes = ?
    WHERE id = ?
  `);
  stmt.run(
    influencerId,
    merchantId,
    data.platform || '',
    data.session_date,
    data.duration_hours || null,
    data.viewers || 0,
    data.gmv || 0,
    data.orders_count || 0,
    data.status || 'scheduled',
    data.notes || null,
    data.cargo_sheet || null,
    data.traffic_plan || null,
    data.estimated_ad_cost || 0,
    data.expected_gmv || 0,
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
    id
  );
  return { id, ...data, influencer_id: influencerId, merchant_id: merchantId };
}

function deleteLiveSession(id) {
  const stmt = db.prepare('DELETE FROM live_sessions WHERE id = ?');
  stmt.run(id);
  return { success: true };
}

// ==================== 订单相关操作 ====================

// 获取订单
function getOrders(filters = {}) {
  let query = `
    SELECT o.*, i.name as influencer_name, m.name as merchant_name, p.name as product_name
    FROM orders o
    LEFT JOIN influencers i ON o.influencer_id = i.id
    LEFT JOIN merchants m ON o.merchant_id = m.id
    LEFT JOIN products p ON o.product_id = p.id
    WHERE 1=1
  `;
  const params = [];

  if (filters.influencer_id) {
    query += ' AND o.influencer_id = ?';
    params.push(filters.influencer_id);
  }

  if (filters.merchant_id) {
    query += ' AND o.merchant_id = ?';
    params.push(filters.merchant_id);
  }

  if (filters.platform) {
    query += ' AND o.platform = ?';
    params.push(filters.platform);
  }

  if (filters.startDate && filters.endDate) {
    query += ' AND o.order_date BETWEEN ? AND ?';
    params.push(filters.startDate, filters.endDate);
  }

  if (filters.settlement_status) {
    query += ' AND o.settlement_status = ?';
    params.push(filters.settlement_status);
  }

  query += ' ORDER BY o.order_date DESC';

  const stmt = db.prepare(query);
  return stmt.all(...params);
}

// 创建订单
function createOrder(data) {
  const stmt = db.prepare(`
    INSERT INTO orders (order_no, live_session_id, influencer_id, merchant_id, product_id, platform, order_date, product_name, quantity, unit_price, total_amount, commission_rate, commission_amount, settlement_status, settlement_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    data.order_no,
    data.live_session_id || null,
    data.influencer_id,
    data.merchant_id,
    data.product_id || null,
    data.platform,
    data.order_date,
    data.product_name,
    data.quantity,
    data.unit_price,
    data.total_amount,
    data.commission_rate || 0,
    data.commission_amount || 0,
    data.settlement_status || 'pending',
    data.settlement_date || null
  );
  return { id: result.lastInsertRowid, ...data };
}

// ==================== 支出相关操作 ====================

// 获取支出
function getExpenses(filters = {}) {
  let query = `
    SELECT e.*, i.name as influencer_name, m.name as merchant_name, ls.id as live_session_no
    FROM expenses e
    LEFT JOIN influencers i ON e.related_influencer_id = i.id
    LEFT JOIN merchants m ON e.related_merchant_id = m.id
    LEFT JOIN live_sessions ls ON e.related_live_session_id = ls.id
    WHERE 1=1
  `;
  const params = [];

  if (filters.type) {
    query += ' AND e.type = ?';
    params.push(filters.type);
  }

  if (filters.category) {
    query += ' AND e.category = ?';
    params.push(filters.category);
  }

  if (filters.related_influencer_id) {
    query += ' AND e.related_influencer_id = ?';
    params.push(filters.related_influencer_id);
  }

  if (filters.related_merchant_id) {
    query += ' AND e.related_merchant_id = ?';
    params.push(filters.related_merchant_id);
  }

  if (filters.startDate && filters.endDate) {
    query += ' AND e.expense_date BETWEEN ? AND ?';
    params.push(filters.startDate, filters.endDate);
  }

  query += ' ORDER BY e.expense_date DESC';

  const stmt = db.prepare(query);
  return stmt.all(...params);
}

// 创建支出
function createExpense(data) {
  const stmt = db.prepare(`
    INSERT INTO expenses (type, category, amount, currency, expense_date, related_influencer_id, related_merchant_id, related_live_session_id, description, payment_method, status, receipt_no)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    data.type,
    data.category,
    data.amount,
    data.currency || 'SGD',
    data.expense_date,
    data.related_influencer_id || null,
    data.related_merchant_id || null,
    data.related_live_session_id || null,
    data.description,
    data.payment_method || null,
    data.status || 'paid',
    data.receipt_no || null
  );
  return { id: result.lastInsertRowid, ...data };
}

// ==================== 成本相关操作 ====================

// 获取成本
function getCosts(filters = {}) {
  let query = `
    SELECT c.*, i.name as influencer_name, m.name as merchant_name
    FROM costs c
    LEFT JOIN influencers i ON c.related_influencer_id = i.id
    LEFT JOIN merchants m ON c.related_merchant_id = m.id
    WHERE 1=1
  `;
  const params = [];

  if (filters.type) {
    query += ' AND c.type = ?';
    params.push(filters.type);
  }

  if (filters.category) {
    query += ' AND c.category = ?';
    params.push(filters.category);
  }

  if (filters.related_influencer_id) {
    query += ' AND c.related_influencer_id = ?';
    params.push(filters.related_influencer_id);
  }

  if (filters.related_merchant_id) {
    query += ' AND c.related_merchant_id = ?';
    params.push(filters.related_merchant_id);
  }

  if (filters.startDate && filters.endDate) {
    query += ' AND c.cost_date BETWEEN ? AND ?';
    params.push(filters.startDate, filters.endDate);
  }

  query += ' ORDER BY c.cost_date DESC';

  const stmt = db.prepare(query);
  return stmt.all(...params);
}

// 创建成本
function createCost(data) {
  const stmt = db.prepare(`
    INSERT INTO costs (type, category, amount, currency, cost_date, related_influencer_id, related_merchant_id, related_live_session_id, related_order_id, description, allocation_method)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    data.type,
    data.category,
    data.amount,
    data.currency || 'SGD',
    data.cost_date,
    data.related_influencer_id || null,
    data.related_merchant_id || null,
    data.related_live_session_id || null,
    data.related_order_id || null,
    data.description,
    data.allocation_method || 'average'
  );
  return { id: result.lastInsertRowid, ...data };
}

// ==================== 财务报表和统计 ====================

// 获取财务汇总（按时间周期和达人筛选）
function getFinancialSummary(filters = {}) {
  const { startDate, endDate, influencerId, platform } = filters;

  // 构建日期筛选
  let dateCondition = '';
  let dateParams = [];
  if (startDate && endDate) {
    dateCondition = 'WHERE order_date BETWEEN ? AND ?';
    dateParams = [startDate, endDate];
  }

  // 构建达人筛选
  let influencerCondition = '';
  let influencerParams = [];
  if (influencerId) {
    influencerCondition = 'AND influencer_id = ?';
    influencerParams = [influencerId];
  }

  // 构建平台筛选
  let platformCondition = '';
  let platformParams = [];
  if (platform) {
    platformCondition = 'AND platform = ?';
    platformParams = [platform];
  }

  // 收入统计
  const incomeQuery = `
    SELECT
      COUNT(*) as order_count,
      SUM(total_amount) as total_revenue,
      SUM(commission_amount) as total_commission,
      SUM(CASE WHEN settlement_status = 'settled' THEN total_amount ELSE 0 END) as settled_amount
    FROM orders
    ${dateCondition}
    ${influencerCondition}
    ${platformCondition}
  `;

  const incomeStmt = db.prepare(incomeQuery);
  const income = incomeStmt.get(...dateParams, ...influencerParams, ...platformParams);

  // 回款统计（按月）
  let settlementCondition = '';
  let settlementDateParams = [];
  
  if (startDate && endDate) {
    settlementCondition = 'WHERE order_date BETWEEN ? AND ?';
    settlementDateParams = [startDate, endDate];
  } else {
    settlementCondition = 'WHERE 1=1';
  }
  
  const settlementQuery = `
    SELECT
      COUNT(*) as settled_count,
      SUM(total_amount) as total_settled
    FROM orders
    ${settlementCondition}
    AND settlement_status = 'settled'
    ${influencerId ? 'AND influencer_id = ?' : ''}
    ${platform ? 'AND platform = ?' : ''}
  `;

  const settlementParams = [...settlementDateParams];
  if (influencerId) settlementParams.push(influencerId);
  if (platform) settlementParams.push(platform);

  const settlementStmt = db.prepare(settlementQuery);
  const settlement = settlementStmt.get(...settlementParams);

  // 支出统计
  let expenseCondition = '';
  let expenseDateParams = [];
  
  if (startDate && endDate) {
    expenseCondition = 'WHERE expense_date BETWEEN ? AND ?';
    expenseDateParams = [startDate, endDate];
  } else {
    expenseCondition = 'WHERE 1=1';
  }
  
  const expenseQuery = `
    SELECT
      COUNT(*) as expense_count,
      SUM(amount) as total_expense
    FROM expenses
    ${expenseCondition}
    ${influencerId ? 'AND related_influencer_id = ?' : ''}
  `;

  const expenseParams = [...expenseDateParams];
  if (influencerId) expenseParams.push(influencerId);

  const expenseStmt = db.prepare(expenseQuery);
  const expense = expenseStmt.get(...expenseParams);

  // 成本统计
  let costCondition = '';
  let costDateParams = [];
  
  if (startDate && endDate) {
    costCondition = 'WHERE cost_date BETWEEN ? AND ?';
    costDateParams = [startDate, endDate];
  } else {
    costCondition = 'WHERE 1=1';
  }
  
  const costQuery = `
    SELECT
      COUNT(*) as cost_count,
      SUM(amount) as total_cost
    FROM costs
    ${costCondition}
    ${influencerId ? 'AND related_influencer_id = ?' : ''}
  `;

  const costParams = [...costDateParams];
  if (influencerId) costParams.push(influencerId);

  const costStmt = db.prepare(costQuery);
  const cost = costStmt.get(...costParams);

  // 计算利润
  const totalRevenue = income.total_revenue || 0;
  const settledAmount = income.settled_amount || 0;
  const totalExpense = expense.total_expense || 0;
  const totalCost = cost.total_cost || 0;
  const totalCommission = income.total_commission || 0;
  const grossProfit = totalRevenue - totalCommission;
  const netProfit = grossProfit - totalExpense - totalCost;

  return {
    period: { startDate, endDate },
    revenue: {
      orderCount: income.order_count || 0,
      totalRevenue: totalRevenue,
      settledAmount: settledAmount || settlement.total_settled || 0,
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
}

// 获取达人业绩排行
function getInfluencerRanking(filters = {}) {
  let query = `
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
  `;
  const params = [];

  if (filters.startDate && filters.endDate) {
    query += ` WHERE o.order_date BETWEEN ? AND ?`;
    params.push(filters.startDate, filters.endDate);
  }

  if (filters.platform) {
    query += (params.length > 0 ? ' AND' : ' WHERE') + ` i.platform = ?`;
    params.push(filters.platform);
  }

  query += ` GROUP BY i.id ORDER BY total_revenue DESC`;

  const stmt = db.prepare(query);
  return stmt.all(...params);
}

// 获取平台对比数据
function getPlatformComparison(filters = {}) {
  let query = `
    SELECT
      platform,
      COUNT(DISTINCT id) as order_count,
      SUM(total_amount) as total_revenue,
      SUM(commission_amount) as total_commission
    FROM orders
  `;
  const params = [];

  if (filters.startDate && filters.endDate) {
    query += ` WHERE order_date BETWEEN ? AND ?`;
    params.push(filters.startDate, filters.endDate);
  }

  query += ` GROUP BY platform`;

  const stmt = db.prepare(query);
  return stmt.all(...params);
}

// 获取趋势数据（按月）
function getMonthlyTrend(filters = {}) {
  let query = `
    SELECT
      strftime('%Y-%m', order_date) as month,
      COUNT(*) as order_count,
      SUM(total_amount) as total_revenue,
      SUM(commission_amount) as total_commission,
      SUM(CASE WHEN settlement_status = 'settled' THEN total_amount ELSE 0 END) as settled_amount
    FROM orders
  `;
  const params = [];

  if (filters.startDate && filters.endDate) {
    query += ` WHERE order_date BETWEEN ? AND ?`;
    params.push(filters.startDate, filters.endDate);
  }

  if (filters.influencerId) {
    query += ` AND influencer_id = ?`;
    params.push(filters.influencerId);
  }

  if (filters.platform) {
    query += ` AND platform = ?`;
    params.push(filters.platform);
  }

  query += ` GROUP BY strftime('%Y-%m', order_date) ORDER BY month DESC LIMIT 12`;

  const stmt = db.prepare(query);
  return stmt.all(...params);
}

module.exports = {
  getAccounts,
  findAccountByLogin,
  createAccount,
  updateAccount,
  deleteAccount,
  // 达人
  getInfluencers,
  createInfluencer,
  updateInfluencer,
  deleteInfluencer,
  // 商家
  getMerchants,
  createMerchant,
  updateMerchant,
  deleteMerchant,
  // 直播场次
  getLiveSessions,
  createLiveSession,
  updateLiveSession,
  deleteLiveSession,
  // 订单
  getOrders,
  createOrder,
  // 支出
  getExpenses,
  createExpense,
  // 成本
  getCosts,
  createCost,
  // 财务报表
  getFinancialSummary,
  getInfluencerRanking,
  getPlatformComparison,
  getMonthlyTrend
};
