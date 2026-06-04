const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');

const models = process.env.DATABASE_URL ? require('./models-postgres') : require('./models');

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors({ origin: process.env.CORS_ORIGIN || true }));
app.use(bodyParser.json({ limit: '25mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '25mb' }));

const asyncRoute = (handler) => async (req, res) => {
  try {
    await handler(req, res);
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
};

const intOrNull = (value) => (value ? parseInt(value, 10) : null);

const fullAccessRoles = new Set(['owner', 'finance', '老板', '财务']);
const ownerRoles = new Set(['owner', '老板']);

const hasFullAccess = (req) => {
  const role = String(req.get('x-shopfluence-role') || '').trim();
  return fullAccessRoles.has(role);
};

const requireFullAccess = (req, res, next) => {
  if (hasFullAccess(req)) {
    next();
    return;
  }
  res.status(403).json({ success: false, error: '没有权限访问财务数据' });
};

const requireOwner = (req, res, next) => {
  const role = String(req.get('x-shopfluence-role') || '').trim();
  if (ownerRoles.has(role)) {
    next();
    return;
  }
  res.status(403).json({ success: false, error: '只有老板账号可以管理账号权限' });
};

app.use(['/api/accounts', '/api/export'], requireOwner);
app.use(['/api/expenses', '/api/costs', '/api/income', '/api/reports'], requireFullAccess);

app.post('/api/auth/login', asyncRoute(async (req, res) => {
  const username = String(req.body.username || '').trim();
  const password = String(req.body.password || '');

  if (!username || !password) {
    res.status(400).json({ success: false, error: '请输入账号和密码' });
    return;
  }

  const account = await models.findAccountByLogin(username, password);
  if (!account) {
    res.status(401).json({ success: false, error: '账号或密码不正确' });
    return;
  }

  res.json({
    success: true,
    data: {
      username: account.username,
      name: account.name,
      role: account.role,
    },
  });
}));

app.get('/api/accounts', asyncRoute(async (req, res) => {
  const data = await models.getAccounts();
  res.json({ success: true, data });
}));

app.post('/api/accounts', asyncRoute(async (req, res) => {
  const data = await models.createAccount(req.body);
  res.json({ success: true, data });
}));

app.put('/api/accounts/:id', asyncRoute(async (req, res) => {
  const data = await models.updateAccount(parseInt(req.params.id, 10), req.body);
  if (!data) {
    res.status(404).json({ success: false, error: '账号不存在' });
    return;
  }
  res.json({ success: true, data });
}));

app.delete('/api/accounts/:id', asyncRoute(async (req, res) => {
  await models.deleteAccount(parseInt(req.params.id, 10));
  res.json({ success: true });
}));

app.get('/api/export/all', asyncRoute(async (req, res) => {
  const data = await models.exportAllData();
  const filename = `shopfluence-backup-${new Date().toISOString().slice(0, 10)}.json`;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.json(data);
}));

app.get('/api/influencers', asyncRoute(async (req, res) => {
  const data = await models.getInfluencers({
    status: req.query.status,
    platform: req.query.platform,
  });
  res.json({ success: true, data });
}));

app.post('/api/influencers', asyncRoute(async (req, res) => {
  const data = await models.createInfluencer(req.body);
  res.json({ success: true, data });
}));

app.put('/api/influencers/:id', asyncRoute(async (req, res) => {
  const data = await models.updateInfluencer(parseInt(req.params.id, 10), req.body);
  res.json({ success: true, data });
}));

app.delete('/api/influencers/:id', asyncRoute(async (req, res) => {
  await models.deleteInfluencer(parseInt(req.params.id, 10));
  res.json({ success: true });
}));

app.get('/api/merchants', asyncRoute(async (req, res) => {
  const data = await models.getMerchants({
    status: req.query.status,
    platform: req.query.platform,
  });
  res.json({ success: true, data });
}));

app.post('/api/merchants', asyncRoute(async (req, res) => {
  const data = await models.createMerchant(req.body);
  res.json({ success: true, data });
}));

app.put('/api/merchants/:id', asyncRoute(async (req, res) => {
  const data = await models.updateMerchant(parseInt(req.params.id, 10), req.body);
  res.json({ success: true, data });
}));

app.delete('/api/merchants/:id', asyncRoute(async (req, res) => {
  await models.deleteMerchant(parseInt(req.params.id, 10));
  res.json({ success: true });
}));

app.get('/api/live-sessions', asyncRoute(async (req, res) => {
  const data = await models.getLiveSessions({
    influencer_id: intOrNull(req.query.influencer_id),
    merchant_id: intOrNull(req.query.merchant_id),
    platform: req.query.platform,
    startDate: req.query.startDate,
    endDate: req.query.endDate,
  });
  res.json({ success: true, data });
}));

app.post('/api/live-sessions', asyncRoute(async (req, res) => {
  const data = await models.createLiveSession(req.body);
  res.json({ success: true, data });
}));

app.put('/api/live-sessions/:id', asyncRoute(async (req, res) => {
  const data = await models.updateLiveSession(parseInt(req.params.id, 10), req.body);
  res.json({ success: true, data });
}));

app.delete('/api/live-sessions/:id', asyncRoute(async (req, res) => {
  await models.deleteLiveSession(parseInt(req.params.id, 10));
  res.json({ success: true });
}));

app.get('/api/orders', asyncRoute(async (req, res) => {
  const data = await models.getOrders({
    influencer_id: intOrNull(req.query.influencer_id),
    merchant_id: intOrNull(req.query.merchant_id),
    platform: req.query.platform,
    startDate: req.query.startDate,
    endDate: req.query.endDate,
    settlement_status: req.query.settlement_status,
  });
  res.json({ success: true, data });
}));

app.post('/api/orders', asyncRoute(async (req, res) => {
  const data = await models.createOrder(req.body);
  res.json({ success: true, data });
}));

app.get('/api/expenses', asyncRoute(async (req, res) => {
  const data = await models.getExpenses({
    type: req.query.type,
    category: req.query.category,
    related_influencer_id: intOrNull(req.query.related_influencer_id),
    related_merchant_id: intOrNull(req.query.related_merchant_id),
    startDate: req.query.startDate,
    endDate: req.query.endDate,
  });
  res.json({ success: true, data });
}));

app.post('/api/expenses', asyncRoute(async (req, res) => {
  const data = await models.createExpense(req.body);
  res.json({ success: true, data });
}));

app.get('/api/costs', asyncRoute(async (req, res) => {
  const data = await models.getCosts({
    type: req.query.type,
    category: req.query.category,
    related_influencer_id: intOrNull(req.query.related_influencer_id),
    related_merchant_id: intOrNull(req.query.related_merchant_id),
    startDate: req.query.startDate,
    endDate: req.query.endDate,
  });
  res.json({ success: true, data });
}));

app.post('/api/costs', asyncRoute(async (req, res) => {
  const data = await models.createCost(req.body);
  res.json({ success: true, data });
}));

app.get('/api/income', asyncRoute(async (req, res) => {
  if (!models.getIncome) {
    res.json({ success: true, data: [] });
    return;
  }
  const data = await models.getIncome({
    type: req.query.type,
    category: req.query.category,
    related_influencer_id: intOrNull(req.query.related_influencer_id),
    related_merchant_id: intOrNull(req.query.related_merchant_id),
    startDate: req.query.startDate,
    endDate: req.query.endDate,
  });
  res.json({ success: true, data });
}));

app.post('/api/income', asyncRoute(async (req, res) => {
  if (!models.createIncome) {
    res.status(404).json({ success: false, error: 'income API is not available in this data layer' });
    return;
  }
  const data = await models.createIncome(req.body);
  res.json({ success: true, data });
}));

app.get('/api/reports/summary', asyncRoute(async (req, res) => {
  const data = await models.getFinancialSummary({
    startDate: req.query.startDate,
    endDate: req.query.endDate,
    influencerId: intOrNull(req.query.influencerId),
    platform: req.query.platform,
  });
  res.json({ success: true, data });
}));

app.get('/api/reports/influencer-ranking', asyncRoute(async (req, res) => {
  const data = await models.getInfluencerRanking({
    startDate: req.query.startDate,
    endDate: req.query.endDate,
    platform: req.query.platform,
  });
  res.json({ success: true, data });
}));

app.get('/api/reports/platform-comparison', asyncRoute(async (req, res) => {
  const data = await models.getPlatformComparison({
    startDate: req.query.startDate,
    endDate: req.query.endDate,
  });
  res.json({ success: true, data });
}));

app.get('/api/reports/monthly-trend', asyncRoute(async (req, res) => {
  const data = await models.getMonthlyTrend({
    startDate: req.query.startDate,
    endDate: req.query.endDate,
    influencerId: intOrNull(req.query.influencerId),
    platform: req.query.platform,
  });
  res.json({ success: true, data });
}));

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    database: process.env.DATABASE_URL ? 'postgres' : 'sqlite',
    timestamp: new Date().toISOString(),
  });
});

const distDir = path.join(__dirname, '../dist');
if (process.env.NODE_ENV === 'production' && fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
  console.log(`数据层: ${process.env.DATABASE_URL ? 'PostgreSQL' : 'SQLite'}`);
  console.log(`API健康检查: http://localhost:${PORT}/api/health`);
});
