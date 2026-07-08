const assert = require('node:assert/strict');
const fs = require('node:fs');

const databasePath = process.env.DATABASE_PATH || '/tmp/shopfluence-model-smoke.db';
fs.rmSync(databasePath, { force: true });
process.env.DATABASE_PATH = databasePath;

const models = require('../server/models');

const account = models.createAccount({ username: '__smoke__', password: '123456', name: 'Smoke', role: '运营', status: 'active' });
models.updateAccount(account.id, { username: '__smoke__', password: '', name: 'Smoke Updated', role: '运营', status: 'active' });
assert.equal(models.findAccountByLogin('__smoke__', '123456').name, 'Smoke Updated');

const influencer = models.createInfluencer({ platform: 'TikTok', name: 'Smoke Influencer', account: '__smoke__', commission_rate: 10, status: 'active' });
models.updateInfluencer(influencer.id, { ...influencer, name: 'Smoke Influencer Updated' });

const merchant = models.createMerchant({ name: 'Smoke Merchant', category: '其他', platform: 'TikTok', commission_rate: 10, status: 'active' });
models.updateMerchant(merchant.id, { ...merchant, name: 'Smoke Merchant Updated' });

const session = models.createLiveSession({
  influencer_id: influencer.id,
  merchant_id: merchant.id,
  platform: 'TikTok',
  session_date: '2026-07-06 12:00:00',
  duration_hours: 4,
  status: 'scheduled',
});
models.updateLiveSession(session.id, { ...session, duration_hours: 5 });

const order = models.createOrder({
  order_no: '__smoke__',
  live_session_id: session.id,
  influencer_id: influencer.id,
  merchant_id: merchant.id,
  platform: 'TikTok',
  order_date: '2026-07-06',
  product_name: 'Smoke Product',
  quantity: 1,
  unit_price: 100,
  total_amount: 100,
});
models.createExpense({
  type: 'expense', category: 'Smoke', amount: 10, currency: 'CNY', expense_date: '2026-07-06',
  related_influencer_id: influencer.id, related_merchant_id: merchant.id, related_live_session_id: session.id,
});
models.createCost({
  type: 'cost', category: 'Smoke', amount: 20, currency: 'CNY', cost_date: '2026-07-06',
  related_influencer_id: influencer.id, related_merchant_id: merchant.id, related_live_session_id: session.id, related_order_id: order.id,
});

const receivable = models.createTravelReceivable({
  receivable_date: '2026-07-06', receivable_type: 'brand', object_name: 'Smoke Merchant Updated', reason: '其他', amount: 100,
});
models.updateTravelReceivable(receivable.id, { ...receivable, received_amount: 25, payment_notes: 'Smoke paid' });
assert.equal(models.getTravelReceivables().find((item) => item.id === receivable.id).received_amount, 25);

const workProgress = models.createWorkProgressItem({
  fill_time: '2026-07-06 10:00:00',
  required_finish_time: '2026-07-07 18:00:00',
  urgency: '加急',
  requester: 'Smoke requester',
  executor_role: '运营',
  requirement: 'Smoke requirement',
  executor_ack: '否',
  is_done: '否',
  notes: 'Smoke note',
});
models.updateWorkProgressItem(workProgress.id, { ...workProgress, executor_ack: '是', is_done: '是', finished_at: '2026-07-06 12:00:00' });
assert.equal(models.getWorkProgressItems({ is_done: '是' }).some((item) => item.id === workProgress.id), true);

models.deleteLiveSession(session.id);
models.deleteInfluencer(influencer.id);
models.deleteMerchant(merchant.id);
assert.equal(models.getLiveSessions().some((item) => item.id === session.id), false);
assert.equal(models.getInfluencers().some((item) => item.id === influencer.id), false);
assert.equal(models.getMerchants().some((item) => item.id === merchant.id), false);

models.deleteTravelReceivable(receivable.id);
models.deleteWorkProgressItem(workProgress.id);
models.deleteAccount(account.id);
assert.equal(models.getTravelReceivables().some((item) => item.id === receivable.id), false);
assert.equal(models.getWorkProgressItems().some((item) => item.id === workProgress.id), false);
assert.equal(models.getAccounts().some((item) => item.id === account.id), false);

const backup = models.exportAllData();
assert.ok(backup.data.live_sessions);
assert.ok(backup.data.orders);
assert.ok(backup.data.work_progress_items);

console.log('Smoke model checks passed');
