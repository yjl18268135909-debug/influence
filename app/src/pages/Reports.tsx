import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Table, DatePicker, Select, Button, Spin, Space } from 'antd';
import { DollarOutlined, ShoppingCartOutlined, UserOutlined, ShopOutlined } from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';

const { RangePicker } = DatePicker;

interface SummaryData {
  totalRevenue: number;
  totalOrders: number;
  totalGMV: number;
  totalSessions: number;
}

const Reports: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>([
    dayjs().subtract(30, 'days'),
    dayjs()
  ]);
  const [platformFilter, setPlatformFilter] = useState<string>('all');
  const [influencers, setInfluencers] = useState<any[]>([]);
  const [merchants, setMerchants] = useState<any[]>([]);
  const [liveSessions, setLiveSessions] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);

  const [summary, setSummary] = useState<SummaryData>({
    totalRevenue: 0,
    totalOrders: 0,
    totalGMV: 0,
    totalSessions: 0
  });

  useEffect(() => {
    loadData();
  }, [dateRange, platformFilter]);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchInfluencers(),
        fetchMerchants(),
        fetchLiveSessions(),
        fetchOrders()
      ]);

      const filteredSessions = liveSessions.filter(session => {
        const sessionDate = dayjs(session.session_date);
        const [start, end] = dateRange;
        const inRange = sessionDate.isAfter(start) && sessionDate.isBefore(end);
        const matchPlatform = platformFilter === 'all' || session.platform === platformFilter;
        return inRange && matchPlatform;
      });

      const filteredOrders = orders.filter(order => {
        const orderDate = dayjs(order.order_date);
        const [start, end] = dateRange;
        const inRange = orderDate.isAfter(start) && orderDate.isBefore(end);
        const matchPlatform = platformFilter === 'all' || order.platform === platformFilter;
        return inRange && matchPlatform;
      });

      setSummary({
        totalRevenue: filteredOrders.reduce((sum, order) => sum + (order.commission_amount || 0), 0),
        totalOrders: filteredOrders.length,
        totalGMV: filteredSessions.reduce((sum, session) => sum + (session.gmv || 0), 0),
        totalSessions: filteredSessions.length
      });
    } catch (error) {
      console.error('加载数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchInfluencers = async () => {
    try {
      const res = await fetch('/api/influencers');
      const data = await res.json();
      setInfluencers(Array.isArray(data.data) ? data.data : []);
    } catch (error) {
      console.error('获取达人列表失败:', error);
      setInfluencers([]);
    }
  };

  const fetchMerchants = async () => {
    try {
      const res = await fetch('/api/merchants');
      const data = await res.json();
      setMerchants(Array.isArray(data.data) ? data.data : []);
    } catch (error) {
      console.error('获取商家列表失败:', error);
      setMerchants([]);
    }
  };

  const fetchLiveSessions = async () => {
    try {
      const res = await fetch('/api/live-sessions');
      const data = await res.json();
      setLiveSessions(Array.isArray(data.data) ? data.data : []);
    } catch (error) {
      console.error('获取直播场次失败:', error);
      setLiveSessions([]);
    }
  };

  const fetchOrders = async () => {
    try {
      const res = await fetch('/api/orders');
      const data = await res.json();
      setOrders(Array.isArray(data.data) ? data.data : []);
    } catch (error) {
      console.error('获取订单列表失败:', error);
      setOrders([]);
    }
  };

  const columns = [
    {
      title: '日期',
      dataIndex: 'date',
      key: 'date',
      render: (date: string) => dayjs(date).format('YYYY-MM-DD')
    },
    {
      title: '直播场次',
      dataIndex: 'sessions',
      key: 'sessions',
      align: 'right' as const
    },
    {
      title: 'GMV (SGD)',
      dataIndex: 'gmv',
      key: 'gmv',
      align: 'right' as const,
      render: (value: number) => `$${value?.toFixed(2) || '0.00'}`
    },
    {
      title: '订单数',
      dataIndex: 'orders',
      key: 'orders',
      align: 'right' as const
    },
    {
      title: '佣金收入',
      dataIndex: 'commission',
      key: 'commission',
      align: 'right' as const,
      render: (value: number) => `$${value?.toFixed(2) || '0.00'}`
    }
  ];

  const dailyData = (() => {
    const data: any[] = [];
    const [start, end] = dateRange;
    let current = start.clone();

    while (current.isBefore(end) || current.isSame(end, 'day')) {
      const dateStr = current.format('YYYY-MM-DD');
      const daySessions = liveSessions.filter(s => {
        const sDate = dayjs(s.session_date).format('YYYY-MM-DD');
        return sDate === dateStr && (platformFilter === 'all' || s.platform === platformFilter);
      });
      const dayOrders = orders.filter(o => {
        const oDate = dayjs(o.order_date).format('YYYY-MM-DD');
        return oDate === dateStr && (platformFilter === 'all' || o.platform === platformFilter);
      });

      data.push({
        date: dateStr,
        sessions: daySessions.length,
        gmv: daySessions.reduce((sum, s) => sum + (s.gmv || 0), 0),
        orders: dayOrders.length,
        commission: dayOrders.reduce((sum, o) => sum + (o.commission_amount || 0), 0)
      });

      current = current.add(1, 'day');
    }
    return data;
  })();

  return (
    <div>
      <Card title="报表筛选" style={{ marginBottom: 16 }}>
        <Space>
          <RangePicker
            value={dateRange}
            onChange={(dates) => setDateRange(dates as [Dayjs, Dayjs])}
            format="YYYY-MM-DD"
          />
          <Select
            value={platformFilter}
            onChange={setPlatformFilter}
            style={{ width: 120 }}
          >
            <Select.Option value="all">所有平台</Select.Option>
            <Select.Option value="TikTok">TikTok</Select.Option>
            <Select.Option value="Shopee">Shopee</Select.Option>
          </Select>
          <Button type="primary" onClick={loadData} loading={loading}>
            刷新数据
          </Button>
        </Space>
      </Card>

      <Spin spinning={loading}>
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={6}>
            <Card>
              <Statistic
                title="总GMV"
                value={summary.totalGMV}
                precision={2}
                prefix="$"
                suffix="SGD"
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="总订单数"
                value={summary.totalOrders}
                prefix={<ShoppingCartOutlined />}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="总佣金收入"
                value={summary.totalRevenue}
                precision={2}
                prefix="$"
                suffix="SGD"
                valueStyle={{ color: '#faad14' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="直播场次"
                value={summary.totalSessions}
                prefix={<UserOutlined />}
                valueStyle={{ color: '#eb2f96' }}
              />
            </Card>
          </Col>
        </Row>

        <Card title="每日数据统计">
          <Table
            columns={columns}
            dataSource={dailyData}
            rowKey="date"
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showTotal: (total) => `共 ${total} 天`
            }}
            scroll={{ x: 800 }}
          />
        </Card>
      </Spin>
    </div>
  );
};

export default Reports;
