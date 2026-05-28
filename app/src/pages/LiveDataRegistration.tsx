import React, { useMemo, useState } from 'react';
import { Button, DatePicker, Form, Input, InputNumber, Modal, Select, Space, Statistic, Table, Tag, message, Row, Col } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

const { Option } = Select;

const initialRows = [
  { id: 'D001', date: dayjs().format('YYYY-MM-DD'), session: 'Lina Chen x Glow Market', platform: 'TikTok', viewers: 42600, orders: 358, gmv: 28600, conversionRate: 0.0084, refundAmount: 1200 },
  { id: 'D002', date: dayjs().subtract(1, 'day').format('YYYY-MM-DD'), session: 'Nora Style x Daily Beauty', platform: 'TikTok', viewers: 31200, orders: 211, gmv: 16920, conversionRate: 0.0068, refundAmount: 460 },
  { id: 'D003', date: dayjs().subtract(2, 'day').format('YYYY-MM-DD'), session: 'Jason Live x Home Select', platform: 'Shopee', viewers: 18400, orders: 126, gmv: 9800, conversionRate: 0.0069, refundAmount: 310 },
];

const LiveDataRegistration: React.FC = () => {
  const [rows, setRows] = useState(initialRows);
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();

  const stats = useMemo(() => {
    const gmv = rows.reduce((sum, item) => sum + item.gmv, 0);
    const orders = rows.reduce((sum, item) => sum + item.orders, 0);
    const viewers = rows.reduce((sum, item) => sum + item.viewers, 0);
    return {
      gmv,
      orders,
      viewers,
      conversionRate: viewers ? orders / viewers : 0,
    };
  }, [rows]);

  const addRecord = async () => {
    const values = await form.validateFields();
    const viewers = Number(values.viewers || 0);
    const orders = Number(values.orders || 0);
    setRows((prev) => [{
      ...values,
      id: `D${Date.now()}`,
      date: values.date.format('YYYY-MM-DD'),
      conversionRate: viewers ? orders / viewers : 0,
      refundAmount: Number(values.refundAmount || 0),
    }, ...prev]);
    setOpen(false);
    form.resetFields();
    message.success('直播数据已登记');
  };

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>登记直播数据</Button>
      </Space>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={6}><Statistic title="累计GMV" value={stats.gmv} precision={2} prefix="SGD" /></Col>
        <Col xs={24} sm={6}><Statistic title="订单数" value={stats.orders} /></Col>
        <Col xs={24} sm={6}><Statistic title="观看人数" value={stats.viewers} /></Col>
        <Col xs={24} sm={6}><Statistic title="转化率" value={stats.conversionRate * 100} precision={2} suffix="%" /></Col>
      </Row>

      <Table
        dataSource={rows}
        rowKey="id"
        scroll={{ x: 980 }}
        columns={[
          { title: '日期', dataIndex: 'date', key: 'date', width: 120 },
          { title: '直播场次', dataIndex: 'session', key: 'session' },
          { title: '平台', dataIndex: 'platform', key: 'platform', width: 100, render: (value) => <Tag color={value === 'TikTok' ? 'red' : 'orange'}>{value}</Tag> },
          { title: '观看人数', dataIndex: 'viewers', key: 'viewers', align: 'right', render: (value) => value.toLocaleString() },
          { title: '订单数', dataIndex: 'orders', key: 'orders', align: 'right' },
          { title: 'GMV', dataIndex: 'gmv', key: 'gmv', align: 'right', render: (value) => `SGD ${value.toLocaleString()}` },
          { title: '退款金额', dataIndex: 'refundAmount', key: 'refundAmount', align: 'right', render: (value) => `SGD ${value.toLocaleString()}` },
          { title: '转化率', dataIndex: 'conversionRate', key: 'conversionRate', align: 'right', render: (value) => `${(value * 100).toFixed(2)}%` },
        ]}
      />

      <Modal title="登记直播数据" open={open} onOk={addRecord} onCancel={() => setOpen(false)} width={720}>
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col xs={24} md={12}><Form.Item name="date" label="日期" rules={[{ required: true, message: '请选择日期' }]}><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
            <Col xs={24} md={12}><Form.Item name="platform" label="平台" rules={[{ required: true, message: '请选择平台' }]}><Select><Option value="TikTok">TikTok</Option><Option value="Shopee">Shopee</Option></Select></Form.Item></Col>
            <Col span={24}><Form.Item name="session" label="直播场次" rules={[{ required: true, message: '请输入直播场次' }]}><Input placeholder="达人 x 商家" /></Form.Item></Col>
            <Col xs={24} md={12}><Form.Item name="viewers" label="观看人数" rules={[{ required: true, message: '请输入观看人数' }]}><InputNumber style={{ width: '100%' }} min={0} onFocus={(event) => event.target.select()} /></Form.Item></Col>
            <Col xs={24} md={12}><Form.Item name="orders" label="订单数" rules={[{ required: true, message: '请输入订单数' }]}><InputNumber style={{ width: '100%' }} min={0} onFocus={(event) => event.target.select()} /></Form.Item></Col>
            <Col xs={24} md={12}><Form.Item name="gmv" label="GMV" rules={[{ required: true, message: '请输入GMV' }]}><InputNumber<number> style={{ width: '100%' }} min={0} precision={2} prefix="SGD" onFocus={(event) => event.target.select()} /></Form.Item></Col>
            <Col xs={24} md={12}><Form.Item name="refundAmount" label="退款金额"><InputNumber<number> style={{ width: '100%' }} min={0} precision={2} prefix="SGD" onFocus={(event) => event.target.select()} /></Form.Item></Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
};

export default LiveDataRegistration;
