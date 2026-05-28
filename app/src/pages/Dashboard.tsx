import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Table, DatePicker, Select, Spin, Space, Tag, Button } from 'antd';
import { DollarOutlined, UserOutlined, ShoppingCartOutlined, WalletOutlined,
         ArrowUpOutlined, ArrowDownOutlined, AccountBookOutlined,
         PercentageOutlined, ReloadOutlined, UndoOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs, { Dayjs } from 'dayjs';
import { influencerApi, orderApi, expenseApi } from '../api';

const { RangePicker } = DatePicker;

interface Influencer {
  _id: string;
  name: string;
  platform: string;
  commission_rate?: number;
}

interface Order {
  _id: string;
  influencer_id?: string;
  platform: string;
  order_date: string;
  revenue: number;
  commission: number;
}

interface Expense {
  _id: string;
  date: string;
  amount: number;
  description: string;
  category: string;
}

interface MonthlyData {
  month: string;
  revenue: number;
  commission: number;
  expenses: number;
  profit: number;
}

interface InfluencerRanking {
  rank: number;
  name: string;
  platform: string;
  orderCount: number;
  revenue: number;
  commission: number;
}

const Dashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>([
    dayjs().subtract(30, 'days'),
    dayjs()
  ]);
  const [platformFilter, setPlatformFilter] = useState<string>('all');
  const [influencerFilter, setInfluencerFilter] = useState<string>('all');
  const [influencers, setInfluencers] = useState<Influencer[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [topInfluencers, setTopInfluencers] = useState<InfluencerRanking[]>([]);

  // 统计数据
  const [stats, setStats] = useState({
    totalRevenue: 0,
    totalCommission: 0,
    totalExpenses: 0,
    netProfit: 0,
    grossProfit: 0,
    profitMargin: 0,
    totalOrders: 0,
    influencerCount: 0
  });

  // 加载数据
  useEffect(() => {
    loadData();
  }, []);

  // 过滤数据并重新计算
  useEffect(() => {
    if (!loading) {
      filterAndCalculateData();
    }
  }, [dateRange, platformFilter, influencerFilter, loading]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [infRes, ordRes, expRes] = await Promise.all([
        influencerApi.getAll(),
        orderApi.getAll(),
        expenseApi.getAll()
      ]);

      const infData = infRes.data?.data || [];
      const ordData = ordRes.data?.data || [];
      const expData = expRes.data?.data || [];

      setInfluencers(Array.isArray(infData) ? infData : []);
      setOrders(Array.isArray(ordData) ? ordData : []);
      setExpenses(Array.isArray(expData) ? expData : []);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterAndCalculateData = () => {
    const startDate = dateRange[0].format('YYYY-MM-DD');
    const endDate = dateRange[1].format('YYYY-MM-DD');

    // 过滤订单
    let filteredOrders = orders.filter(order => {
      const orderDate = dayjs(order.order_date).format('YYYY-MM-DD');
      return orderDate >= startDate && orderDate <= endDate;
    });

    if (platformFilter !== 'all') {
      filteredOrders = filteredOrders.filter(order => order.platform === platformFilter);
    }

    if (influencerFilter !== 'all') {
      filteredOrders = filteredOrders.filter(order => order.influencer_id === influencerFilter);
    }

    // 过滤支出
    const filteredExpenses = expenses.filter(expense => {
      const expDate = dayjs(expense.date).format('YYYY-MM-DD');
      return expDate >= startDate && expDate <= endDate;
    });

    // 计算统计数据
    const totalRevenue = filteredOrders.reduce((sum, order) => sum + (order.revenue || 0), 0);
    const totalCommission = filteredOrders.reduce((sum, order) => sum + (order.commission || 0), 0);
    const totalExpensesValue = filteredExpenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
    const grossProfit = totalRevenue - totalCommission;
    const netProfit = grossProfit - totalExpensesValue;
    const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    setStats({
      totalRevenue,
      totalCommission,
      totalExpenses: totalExpensesValue,
      netProfit,
      grossProfit,
      profitMargin,
      totalOrders: filteredOrders.length,
      influencerCount: influencers.length
    });

    // 计算月度数据
    const monthlyMap = new Map<string, MonthlyData>();

    filteredOrders.forEach(order => {
      const month = dayjs(order.order_date).format('YYYY-MM');
      if (!monthlyMap.has(month)) {
        monthlyMap.set(month, {
          month,
          revenue: 0,
          commission: 0,
          expenses: 0,
          profit: 0
        });
      }
      const data = monthlyMap.get(month)!;
      data.revenue += order.revenue || 0;
      data.commission += order.commission || 0;
    });

    filteredExpenses.forEach(expense => {
      const month = dayjs(expense.date).format('YYYY-MM');
      if (!monthlyMap.has(month)) {
        monthlyMap.set(month, {
          month,
          revenue: 0,
          commission: 0,
          expenses: 0,
          profit: 0
        });
      }
      const data = monthlyMap.get(month)!;
      data.expenses += expense.amount || 0;
    });

    const monthlyArray = Array.from(monthlyMap.values())
      .map(data => ({
        ...data,
        profit: data.revenue - data.commission - data.expenses
      }))
      .sort((a, b) => a.month.localeCompare(b.month));

    setMonthlyData(monthlyArray);

    // 计算达人排行
    const influencerMap = new Map<string, InfluencerRanking>();

    filteredOrders.forEach(order => {
      if (!order.influencer_id) return;

      if (!influencerMap.has(order.influencer_id)) {
        const influencer = influencers.find(i => i._id === order.influencer_id);
        influencerMap.set(order.influencer_id, {
          rank: 0,
          name: influencer?.name || '未知达人',
          platform: influencer?.platform || '未知',
          orderCount: 0,
          revenue: 0,
          commission: 0
        });
      }

      const ranking = influencerMap.get(order.influencer_id)!;
      ranking.orderCount += 1;
      ranking.revenue += order.revenue || 0;
      ranking.commission += order.commission || 0;
    });

    const rankings = Array.from(influencerMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10)
      .map((item, index) => ({ ...item, rank: index + 1 }));

    setTopInfluencers(rankings);
  };

  const handleDateChange = (dates: [Dayjs | null, Dayjs | null] | null) => {
    if (dates?.[0] && dates?.[1]) {
      setDateRange([dates[0], dates[1]]);
    }
  };

  const handleReset = () => {
    setDateRange([dayjs().subtract(30, 'days'), dayjs()]);
    setPlatformFilter('all');
    setInfluencerFilter('all');
  };

  // 月度数据表格列
  const monthlyColumns: ColumnsType<MonthlyData> = [
    {
      title: '月份',
      dataIndex: 'month',
      key: 'month',
      sorter: (a, b) => a.month.localeCompare(b.month),
    },
    {
      title: '营收',
      dataIndex: 'revenue',
      key: 'revenue',
      render: (value: number) => `SGD ${value.toFixed(2)}`,
      sorter: (a, b) => a.revenue - b.revenue,
    },
    {
      title: '佣金',
      dataIndex: 'commission',
      key: 'commission',
      render: (value: number) => `SGD ${value.toFixed(2)}`,
      sorter: (a, b) => a.commission - b.commission,
    },
    {
      title: '支出',
      dataIndex: 'expenses',
      key: 'expenses',
      render: (value: number) => `SGD ${value.toFixed(2)}`,
      sorter: (a, b) => a.expenses - b.expenses,
    },
    {
      title: '利润',
      dataIndex: 'profit',
      key: 'profit',
      render: (value: number) => (
        <span style={{ color: value >= 0 ? '#52c41a' : '#ff4d4f' }}>
          SGD {value.toFixed(2)}
        </span>
      ),
      sorter: (a, b) => a.profit - b.profit,
    },
  ];

  // 达人排行表格列
  const influencerColumns: ColumnsType<InfluencerRanking> = [
    {
      title: '排名',
      dataIndex: 'rank',
      key: 'rank',
      width: 80,
      render: (rank: number) => {
        if (rank === 1) return <Tag color="gold">🥇 {rank}</Tag>;
        if (rank === 2) return <Tag color="silver">🥈 {rank}</Tag>;
        if (rank === 3) return <Tag color="#cd7f32">🥉 {rank}</Tag>;
        return <span>{rank}</span>;
      },
    },
    {
      title: '达人名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '平台',
      dataIndex: 'platform',
      key: 'platform',
      render: (platform: string) => (
        <Tag color={platform === 'TikTok' ? 'blue' : 'green'}>
          {platform}
        </Tag>
      ),
    },
    {
      title: '订单数',
      dataIndex: 'orderCount',
      key: 'orderCount',
      sorter: (a, b) => a.orderCount - b.orderCount,
    },
    {
      title: '营收',
      dataIndex: 'revenue',
      key: 'revenue',
      render: (value: number) => `SGD ${value.toFixed(2)}`,
      sorter: (a, b) => a.revenue - b.revenue,
    },
    {
      title: '佣金',
      dataIndex: 'commission',
      key: 'commission',
      render: (value: number) => `SGD ${value.toFixed(2)}`,
      sorter: (a, b) => a.commission - b.commission,
    },
  ];

  if (loading) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={{ padding: '24px' }}>
      <Card title="仪表盘筛选" style={{ marginBottom: 16 }}>
        <Space wrap>
          <span>时间范围：</span>
          <RangePicker
            value={dateRange}
            onChange={handleDateChange}
            format="YYYY-MM-DD"
          />
          <span>平台：</span>
          <Select
            value={platformFilter}
            onChange={setPlatformFilter}
            style={{ width: 120 }}
          >
            <Select.Option value="all">所有平台</Select.Option>
            <Select.Option value="TikTok">TikTok</Select.Option>
            <Select.Option value="Shopee">Shopee</Select.Option>
          </Select>
          <span>达人：</span>
          <Select
            value={influencerFilter}
            onChange={setInfluencerFilter}
            style={{ width: 200 }}
            showSearch
            optionFilterProp="children"
          >
            <Select.Option value="all">所有达人</Select.Option>
            {influencers.map(inf => (
              <Select.Option key={inf._id} value={inf._id}>
                {inf.name} ({inf.platform})
              </Select.Option>
            ))}
          </Select>
          <Button
            type="primary"
            icon={<ReloadOutlined />}
            onClick={loadData}
          >
            刷新
          </Button>
          <Button
            icon={<UndoOutlined />}
            onClick={handleReset}
          >
            重置
          </Button>
        </Space>
      </Card>

      {/* 统计卡片 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="总营收"
              value={stats.totalRevenue || 0}
              precision={2}
              prefix={<DollarOutlined />}
              suffix="SGD"
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="总佣金"
              value={stats.totalCommission || 0}
              precision={2}
              prefix={<UserOutlined />}
              suffix="SGD"
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="总支出"
              value={stats.totalExpenses || 0}
              precision={2}
              prefix={<WalletOutlined />}
              suffix="SGD"
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="净利润"
              value={stats.netProfit || 0}
              precision={2}
              prefix={(stats.netProfit || 0) >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
              suffix="SGD"
              valueStyle={{ color: (stats.netProfit || 0) >= 0 ? '#52c41a' : '#ff4d4f' }}
            />
            <div style={{ fontSize: '12px', marginTop: '8px', color: '#8c8c8c' }}>
              利润率: {(stats.profitMargin || 0).toFixed(2)}%
            </div>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="毛利润"
              value={stats.grossProfit || 0}
              precision={2}
              prefix={<AccountBookOutlined />}
              suffix="SGD"
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="利润率"
              value={stats.profitMargin || 0}
              precision={2}
              prefix={<PercentageOutlined />}
              suffix="%"
              valueStyle={{ color: '#13c2c2' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="订单总数"
              value={stats.totalOrders || 0}
              prefix={<ShoppingCartOutlined />}
              valueStyle={{ color: '#eb2f96' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="合作达人"
              value={stats.influencerCount || 0}
              prefix={<UserOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 数据表格 */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title="月度趋势" style={{ height: '100%' }}>
            <Table
              columns={monthlyColumns}
              dataSource={monthlyData}
              rowKey="month"
              pagination={{ pageSize: 6 }}
              size="small"
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="达人业绩排行 TOP 10" style={{ height: '100%' }}>
            <Table
              columns={influencerColumns}
              dataSource={topInfluencers}
              rowKey="rank"
              pagination={false}
              size="small"
            />
          </Card>
        </Col>
      </Row>

      {/* 平台对比 */}
      <Card title="平台对比" style={{ marginTop: 16 }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} md={8}>
            <Statistic
              title="TikTok 营收"
              value={orders
                .filter(o => o.platform === 'TikTok')
                .reduce((sum, o) => sum + (o.revenue || 0), 0)
              }
              precision={2}
              suffix="SGD"
              valueStyle={{ color: '#1890ff' }}
            />
          </Col>
          <Col xs={24} md={8}>
            <Statistic
              title="Shopee 营收"
              value={orders
                .filter(o => o.platform === 'Shopee')
                .reduce((sum, o) => sum + (o.revenue || 0), 0)
              }
              precision={2}
              suffix="SGD"
              valueStyle={{ color: '#52c41a' }}
            />
          </Col>
          <Col xs={24} md={8}>
            <Statistic
              title="TikTok 占比"
              value={
                orders.length > 0
                  ? (orders.filter(o => o.platform === 'TikTok').length / orders.length * 100)
                  : 0
              }
              precision={1}
              suffix="%"
            />
          </Col>
        </Row>
      </Card>
    </div>
  );
};

export default Dashboard;
