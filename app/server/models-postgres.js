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

function mapInsertResult(row, data) {
  return { id: row.id, ...data };
}

async function getInfluencers(filters = {}) {
  const where = ["account NOT LIKE 'placeholder_%'", "account NOT LIKE 'live_%'"];
  const params = [];
  addFilter(where, params, 'status = ?', filters.status);
  addFilter(where, params, 'platform = ?', filters.platform);
  return query(`SELECT * FROM influencers WHERE ${where.join(' AND ')} ORDER BY created_at DESC`, params);
}

async function createInfluencer(data) {
  const row = await one(
    `INSERT INTO influencers
      (platform, name, account, agency, single_session_data, product_direction, commission_rate, contact, sample_address, notes, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     RETURNING id`,
    [
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
      id,
    ]
  );
  return { id, ...data };
}

async function deleteInfluencer(id) {
  await query('DELETE FROM influencers WHERE id = $1', [id]);
  return { success: true };
}

async function getMerchants(filters = {}) {
  const where = ["name != '未填写品牌'"];
  const params = [];
  addFilter(where, params, 'status = ?', filters.status);
  addFilter(where, params, 'platform = ?', filters.platform);
  return query(`SELECT * FROM merchants WHERE ${where.join(' AND ')} ORDER BY created_at DESC`, params);
}

async function createMerchant(data) {
  const row = await one(
    `INSERT INTO merchants (
      name, category, contact_person, email, phone, platform, commission_rate, settlement_cycle, status, notes,
      supply_price_sheet_url, cargo_sheet_url, cooperation_mode, cooperation_notes, brand_address,
      brand_intro, brand_assistants, brand_live_venue, brand_cards, other_files, company_name
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
    RETURNING id`,
    [
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
    ]
  );
  return mapInsertResult(row, data);
}

async function updateMerchant(id, data) {
  await query(
    `UPDATE merchants
     SET name = $1, category = $2, contact_person = $3, email = $4, phone = $5, platform = $6,
         commission_rate = $7, settlement_cycle = $8, status = $9, notes = $10,
         supply_price_sheet_url = $11, cargo_sheet_url = $12, cooperation_mode = $13,
         cooperation_notes = $14, brand_address = $15, brand_intro = $16,
         brand_assistants = $17, brand_live_venue = $18, brand_cards = $19,
         other_files = $20, company_name = $21, updated_at = CURRENT_TIMESTAMP
     WHERE id = $22`,
    [
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
      id,
    ]
  );
  return { id, ...data };
}

async function deleteMerchant(id) {
  await query('DELETE FROM merchants WHERE id = $1', [id]);
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
  const where = ['1=1'];
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
  'status', 'notes', 'cargo_sheet', 'traffic_plan', 'estimated_ad_cost', 'expected_gmv', 'travel_cost_share',
  'brand_receivable', 'owner', 'assistant', 'live_city', 'live_venue', 'live_network', 'samples', 'schedule_type',
  'influencer_travel_note', 'schedule_other_note', 'brand_category', 'brand_cooperation_mode', 'plan_notes',
  'execution_notes', 'cost_notes', 'actual_gmv_sgd', 'big_screen_screenshot', 'actual_traffic_usd',
  'screen_traffic_sgd', 'actual_traffic_provider', 'traffic_receivable_type', 'traffic_receivable_amount',
  'traffic_notes', 'post_live_notes',
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
  ];
}

async function createLiveSession(data) {
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
  const { influencerId, merchantId } = await resolveLiveSessionRelations(data);
  const values = liveSessionValues(data, influencerId, merchantId);
  const setSql = liveSessionColumns.map((column, index) => `${column} = $${index + 1}`).join(', ');
  values.push(id);
  await query(`UPDATE live_sessions SET ${setSql} WHERE id = $${values.length}`, values);
  return { id, ...data, influencer_id: influencerId, merchant_id: merchantId };
}

async function deleteLiveSession(id) {
  await query('DELETE FROM live_sessions WHERE id = $1', [id]);
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
