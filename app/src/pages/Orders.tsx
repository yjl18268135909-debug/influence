import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, Select, InputNumber, DatePicker, Space, message } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { orderApi, influencerApi, merchantApi } from '../api';
import DataImportExport from '../components/DataImportExport';

const { Option } = Select;
const { TextArea } = Input;

const Orders: React.FC = () => {
  const [orders, setOrders] = useState<any[]>([]);
  const [influencers, setInfluencers] = useState<any[]>([]);
  const [merchants, setMerchants] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchInfluencers();
    fetchMerchants();
    fetchOrders();
  }, []);

  const fetchInfluencers = async () => {
    try {
      const res = await influencerApi.getAll();
      const data = res.data.data;
      setInfluencers(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('获取达人列表失败:', error);
      setInfluencers([]);
    }
  };

  const fetchMerchants = async () => {
    try {
      const res = await merchantApi.getAll();
      const data = res.data.data;
      setMerchants(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('获取商家列表失败:', error);
      setMerchants([]);
    }
  };

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await orderApi.getAll();
      const data = res.data.data;
      setOrders(Array.isArray(data) ? data : []);
    } catch (error) {
      message.error('获取订单列表失败');
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    form.resetFields();
    setModalVisible(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const orderData = {
        ...values,
        order_date: values.order_date.format('YYYY-MM-DD HH:mm:ss'),
      };
      await orderApi.create(orderData);
      message.success('订单创建成功');
      setModalVisible(false);
      fetchOrders();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
    },
    {
      title: '订单号',
      dataIndex: 'order_no',
      key: 'order_no',
    },
    {
      title: '达人',
      dataIndex: 'influencer_name',
      key: 'influencer_name',
    },
    {
      title: '商家',
      dataIndex: 'merchant_name',
      key: 'merchant_name',
    },
    {
      title: '平台',
      dataIndex: 'platform',
      key: 'platform',
      render: (platform: string) => (
        <span style={{
          padding: '4px 8px',
          borderRadius: '4px',
          background: platform === 'TikTok' ? '#ff0050' : '#ee4d2d',
          color: '#fff',
          fontSize: '12px'
        }}>
          {platform}
        </span>
      ),
    },
    {
      title: '商品名称',
      dataIndex: 'product_name',
      key: 'product_name',
    },
    {
      title: '数量',
      dataIndex: 'quantity',
      key: 'quantity',
      align: 'right' as const,
    },
    {
      title: '单价',
      dataIndex: 'unit_price',
      key: 'unit_price',
      align: 'right' as const,
      render: (value: number) => `SGD ${value?.toFixed(2) || 0}`,
    },
    {
      title: '总金额',
      dataIndex: 'total_amount',
      key: 'total_amount',
      align: 'right' as const,
      render: (value: number) => `SGD ${value?.toLocaleString() || 0}`,
    },
    {
      title: '佣金率',
      dataIndex: 'commission_rate',
      key: 'commission_rate',
      render: (rate: number) => `${(rate * 100).toFixed(2)}%`,
    },
    {
      title: '佣金金额',
      dataIndex: 'commission_amount',
      key: 'commission_amount',
      align: 'right' as const,
      render: (value: number) => `SGD ${value?.toLocaleString() || 0}`,
    },
    {
      title: '结算状态',
      dataIndex: 'settlement_status',
      key: 'settlement_status',
      render: (status: string) => {
        const statusMap: Record<string, { text: string; color: string }> = {
          pending: { text: '待结算', color: '#faad14' },
          settled: { text: '已结算', color: '#52c41a' },
          cancelled: { text: '已取消', color: '#d9d9d9' },
        };
        const s = statusMap[status] || { text: status, color: '#d9d9d9' };
        return (
          <span style={{
            padding: '4px 8px',
            borderRadius: '4px',
            background: s.color,
            color: '#fff',
            fontSize: '12px'
          }}>
            {s.text}
          </span>
        );
      },
    },
    {
      title: '订单日期',
      dataIndex: 'order_date',
      key: 'order_date',
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            添加订单
          </Button>
        </div>
        <DataImportExport
          entityName="订单"
          templateColumns={[
            { key: 'order_no', label: '订单号', required: true },
            { key: 'influencer_id', label: '达人ID', required: true },
            { key: 'merchant_id', label: '商家ID', required: true },
            { key: 'platform', label: '平台', required: true },
            { key: 'order_date', label: '订单日期', required: true },
            { key: 'product_name', label: '商品名称', required: true },
            { key: 'quantity', label: '数量', required: true },
            { key: 'unit_price', label: '单价', required: true },
            { key: 'total_amount', label: '总金额', required: true },
            { key: 'commission_rate', label: '佣金率' },
            { key: 'commission_amount', label: '佣金金额' },
            { key: 'settlement_status', label: '结算状态' }
          ]}
          onImport={async (data) => {
            for (const item of data) {
              await orderApi.create(item);
            }
            fetchOrders();
          }}
          onExport={async () => {
            const res = await orderApi.getAll();
            const data = res.data.data;
            return Array.isArray(data) ? data : [];
          }}
        />
      </div>
      <Table
        columns={columns}
        dataSource={orders}
        rowKey="id"
        loading={loading}
        scroll={{ x: 1600 }}
        pagination={{ pageSize: 10 }}
      />

      <Modal
        title="添加订单"
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        width={700}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="order_no"
            label="订单号"
            rules={[{ required: true, message: '请输入订单号' }]}
          >
            <Input placeholder="请输入订单号" />
          </Form.Item>
          <Form.Item
            name="influencer_id"
            label="达人"
            rules={[{ required: true, message: '请选择达人' }]}
          >
            <Select placeholder="请选择达人" showSearch filterOption={(input, option: any) =>
              option?.children?.toLowerCase().includes(input.toLowerCase())
            }>
              {influencers.map((inf: any) => (
                <Option key={inf.id} value={inf.id}>
                  {inf.name} ({inf.platform})
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="merchant_id"
            label="商家"
            rules={[{ required: true, message: '请选择商家' }]}
          >
            <Select placeholder="请选择商家" showSearch filterOption={(input, option: any) =>
              option?.children?.toLowerCase().includes(input.toLowerCase())
            }>
              {merchants.map((mer: any) => (
                <Option key={mer.id} value={mer.id}>
                  {mer.name} ({mer.platform})
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="platform"
            label="平台"
            rules={[{ required: true, message: '请选择平台' }]}
          >
            <Select placeholder="请选择平台">
              <Option value="TikTok">TikTok</Option>
              <Option value="Shopee">Shopee</Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="order_date"
            label="订单日期"
            rules={[{ required: true, message: '请选择订单日期' }]}
          >
            <DatePicker showTime style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="product_name"
            label="商品名称"
            rules={[{ required: true, message: '请输入商品名称' }]}
          >
            <Input placeholder="请输入商品名称" />
          </Form.Item>
          <Form.Item
            name="quantity"
            label="数量"
            rules={[{ required: true, message: '请输入数量' }]}
          >
            <InputNumber style={{ width: '100%' }} min={1} placeholder="请输入数量" onFocus={(event) => event.target.select()} />
          </Form.Item>
          <Form.Item
            name="unit_price"
            label="单价"
            rules={[{ required: true, message: '请输入单价' }]}
          >
            <InputNumber<number>
              style={{ width: '100%' }}
              min={0}
              precision={2}
              placeholder="请输入单价"
              formatter={(value) => `SGD ${value}`}
              parser={(value) => Number(value?.replace('SGD ', ''))}
              onFocus={(event) => event.target.select()}
            />
          </Form.Item>
          <Form.Item
            name="total_amount"
            label="总金额"
            rules={[{ required: true, message: '请输入总金额' }]}
          >
            <InputNumber<number>
              style={{ width: '100%' }}
              min={0}
              precision={2}
              placeholder="请输入总金额"
              formatter={(value) => `SGD ${value}`}
              parser={(value) => Number(value?.replace('SGD ', ''))}
              onFocus={(event) => event.target.select()}
            />
          </Form.Item>
          <Form.Item
            name="commission_rate"
            label="佣金率"
          >
            <InputNumber<number>
              style={{ width: '100%' }}
              min={0}
              max={1}
              step={0.01}
              placeholder="例如: 0.1 表示10%"
              formatter={(value) => `${(Number(value) * 100).toFixed(2)}%`}
              parser={(value) => Number(value?.replace('%', '')) / 100}
              onFocus={(event) => event.target.select()}
            />
          </Form.Item>
          <Form.Item name="settlement_status" label="结算状态" initialValue="pending">
            <Select>
              <Option value="pending">待结算</Option>
              <Option value="settled">已结算</Option>
              <Option value="cancelled">已取消</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Orders;
