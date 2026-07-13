import React, { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  Col,
  DatePicker,
  Form,
  InputNumber,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Typography,
  message,
  Segmented,
} from 'antd';
import { ReloadOutlined, SaveOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs, { Dayjs } from 'dayjs';
import { dashboardApi, influencerApi, liveSessionApi } from '../api';

const { RangePicker } = DatePicker;
const { Title, Text } = Typography;

type Dimension = 'day' | 'week' | 'month' | 'half_year' | 'year' | 'custom';

type Influencer = {
  id: number;
  name: string;
  platform?: string;
};

type LiveSession = {
  id: number;
  session_date: string;
  influencer_id?: number;
  influencer_name?: string;
  merchant_name?: string;
  expected_gmv?: number | string;
  actual_gmv_sgd?: number | string;
  status?: string;
  schedule_type?: string;
};

type DashboardTarget = {
  received_target_gmv: number;
  sales_gmv: number;
};

const dimensionOptions = [
  { label: '日', value: 'day' },
  { label: '周', value: 'week' },
  { label: '月', value: 'month' },
  { label: '半年', value: 'half_year' },
  { label: '年', value: 'year' },
  { label: '自定义', value: 'custom' },
];

const toNumber = (value: unknown) => {
  const numberValue = Number(value || 0);
  return Number.isFinite(numberValue) ? numberValue : 0;
};

const formatMoney = (value: number) => value.toLocaleString('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const getRangeByDimension = (dimension: Dimension): [Dayjs, Dayjs] => {
  const now = dayjs();
  if (dimension === 'day') return [now.startOf('day'), now.endOf('day')];
  if (dimension === 'week') return [now.startOf('week'), now.endOf('week')];
  if (dimension === 'month') return [now.startOf('month'), now.endOf('month')];
  if (dimension === 'half_year') {
    const firstHalf = now.month() < 6;
    const startMonth = firstHalf ? 0 : 6;
    return [now.month(startMonth).startOf('month'), now.month(startMonth + 5).endOf('month')];
  }
  if (dimension === 'year') return [now.startOf('year'), now.endOf('year')];
  return [now.startOf('month'), now.endOf('month')];
};

const DataDashboard: React.FC = () => {
  const [dimension, setDimension] = useState<Dimension>('month');
  const [range, setRange] = useState<[Dayjs, Dayjs]>(getRangeByDimension('month'));
  const [influencerId, setInfluencerId] = useState<number | undefined>();
  const [influencers, setInfluencers] = useState<Influencer[]>([]);
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [target, setTarget] = useState<DashboardTarget>({ received_target_gmv: 0, sales_gmv: 0 });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm<DashboardTarget>();

  const queryParams = useMemo(() => ({
    dimension,
    start_date: range[0].format('YYYY-MM-DD'),
    end_date: range[1].format('YYYY-MM-DD'),
    influencer_id: influencerId,
  }), [dimension, range, influencerId]);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const [influencerRes, sessionRes, targetRes] = await Promise.all([
        influencerApi.getAll(),
        liveSessionApi.getAll({
          startDate: `${range[0].format('YYYY-MM-DD')} 00:00:00`,
          endDate: `${range[1].format('YYYY-MM-DD')} 23:59:59`,
          influencer_id: influencerId,
        }),
        dashboardApi.getTarget(queryParams),
      ]);

      setInfluencers(influencerRes.data.data || []);
      setSessions(sessionRes.data.data || []);
      const nextTarget = {
        received_target_gmv: toNumber(targetRes.data.data?.received_target_gmv),
        sales_gmv: toNumber(targetRes.data.data?.sales_gmv),
      };
      setTarget(nextTarget);
      form.setFieldsValue(nextTarget);
    } catch (error) {
      console.error(error);
      message.error('获取数据看板失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, [queryParams]);

  const validSessions = useMemo(() => {
    return sessions.filter((session) => session.schedule_type !== 'travel_note' && session.status !== 'deleted');
  }, [sessions]);

  const metrics = useMemo(() => {
    const completedGmv = validSessions.reduce((sum, session) => sum + toNumber(session.actual_gmv_sgd), 0);
    const remainingEstimatedGmv = validSessions
      .filter((session) => toNumber(session.actual_gmv_sgd) <= 0)
      .reduce((sum, session) => sum + toNumber(session.expected_gmv), 0);
    const receivedTargetGmv = target.received_target_gmv;
    const salesGmv = target.sales_gmv;
    const currentCompletion = receivedTargetGmv > 0 ? (completedGmv / receivedTargetGmv) * 100 : 0;
    const projectedCompletion = receivedTargetGmv > 0
      ? ((completedGmv + remainingEstimatedGmv) / receivedTargetGmv) * 100
      : 0;

    return {
      receivedTargetGmv,
      salesGmv,
      completedGmv,
      remainingEstimatedGmv,
      currentCompletion,
      projectedCompletion,
    };
  }, [target, validSessions]);

  const handleDimensionChange = (value: string | number) => {
    const nextDimension = value as Dimension;
    setDimension(nextDimension);
    if (nextDimension !== 'custom') {
      setRange(getRangeByDimension(nextDimension));
    }
  };

  const handleRangeChange = (dates: null | [Dayjs | null, Dayjs | null]) => {
    if (!dates?.[0] || !dates?.[1]) return;
    setDimension('custom');
    setRange([dates[0], dates[1]]);
  };

  const handleSaveTarget = async (values: DashboardTarget) => {
    setSaving(true);
    try {
      const payload = {
        ...queryParams,
        received_target_gmv: toNumber(values.received_target_gmv),
        sales_gmv: toNumber(values.sales_gmv),
      };
      const response = await dashboardApi.saveTarget(payload);
      const nextTarget = {
        received_target_gmv: toNumber(response.data.data?.received_target_gmv),
        sales_gmv: toNumber(response.data.data?.sales_gmv),
      };
      setTarget(nextTarget);
      form.setFieldsValue(nextTarget);
      message.success('数据看板目标已保存');
    } catch (error) {
      console.error(error);
      message.error('保存数据看板目标失败');
    } finally {
      setSaving(false);
    }
  };

  const columns: ColumnsType<LiveSession> = [
    {
      title: '日期',
      dataIndex: 'session_date',
      width: 160,
      render: (value: string) => value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '-',
    },
    {
      title: '达人',
      dataIndex: 'influencer_name',
      render: (value: string) => value || '-',
    },
    {
      title: '品牌',
      dataIndex: 'merchant_name',
      render: (value: string) => value || '-',
    },
    {
      title: '目标GMV',
      dataIndex: 'expected_gmv',
      align: 'right',
      render: (value: number) => `SGD ${formatMoney(toNumber(value))}`,
    },
    {
      title: '播后GMV',
      dataIndex: 'actual_gmv_sgd',
      align: 'right',
      render: (value: number) => `SGD ${formatMoney(toNumber(value))}`,
    },
    {
      title: '状态',
      render: (_, record) => (toNumber(record.actual_gmv_sgd) > 0 ? '已完成' : '未完成'),
    },
  ];

  return (
    <div>
      <Title level={2}>数据看板</Title>

      <Card style={{ marginBottom: 16 }}>
        <Space size={12} wrap>
          <Segmented
            options={dimensionOptions}
            value={dimension}
            onChange={handleDimensionChange}
          />
          <RangePicker
            value={range}
            onChange={handleRangeChange}
            allowClear={false}
          />
          <Select
            allowClear
            showSearch
            style={{ width: 220 }}
            placeholder="按达人筛选"
            optionFilterProp="label"
            value={influencerId}
            onChange={setInfluencerId}
            options={influencers.map((influencer) => ({
              label: `${influencer.name}${influencer.platform ? ` (${influencer.platform})` : ''}`,
              value: influencer.id,
            }))}
          />
          <Button icon={<ReloadOutlined />} onClick={loadDashboard} loading={loading}>
            刷新
          </Button>
        </Space>
      </Card>

      <Card style={{ marginBottom: 16 }}>
        <Form
          form={form}
          layout="inline"
          initialValues={target}
          onFinish={handleSaveTarget}
          style={{ rowGap: 12 }}
        >
          <Form.Item label="销售额目标GMV" name="sales_gmv">
            <InputNumber min={0} addonBefore="SGD" precision={2} style={{ width: 220 }} />
          </Form.Item>
          <Form.Item label="实收目标GMV" name="received_target_gmv">
            <InputNumber min={0} addonBefore="SGD" precision={2} style={{ width: 220 }} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={saving}>
              保存目标
            </Button>
          </Form.Item>
          <Text type="secondary">
            保存范围：{range[0].format('YYYY-MM-DD')} 至 {range[1].format('YYYY-MM-DD')}
            {influencerId ? '，当前达人单独保存' : '，全部达人'}
          </Text>
        </Form>
      </Card>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12} lg={8} xl={4}>
          <Card>
            <Statistic title="销售额目标GMV" prefix="SGD" value={metrics.salesGmv} precision={2} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8} xl={4}>
          <Card>
            <Statistic title="实收目标GMV" prefix="SGD" value={metrics.receivedTargetGmv} precision={2} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8} xl={4}>
          <Card>
            <Statistic title="已完成GMV" prefix="SGD" value={metrics.completedGmv} precision={2} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8} xl={4}>
          <Card>
            <Statistic title="剩余排期预估GMV" prefix="SGD" value={metrics.remainingEstimatedGmv} precision={2} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8} xl={4}>
          <Card>
            <Statistic title="当前完成度" value={metrics.currentCompletion} precision={2} suffix="%" />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8} xl={4}>
          <Card>
            <Statistic title="预计完成度" value={metrics.projectedCompletion} precision={2} suffix="%" />
          </Card>
        </Col>
      </Row>

      <Card title="数据来源明细">
        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={validSessions}
          pagination={{ pageSize: 10 }}
          scroll={{ x: 900 }}
        />
      </Card>
    </div>
  );
};

export default DataDashboard;
