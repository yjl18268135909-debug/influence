import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, Select, InputNumber, DatePicker, Space, message } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { costApi, influencerApi, merchantApi } from '../api';
import DataImportExport from '../components/DataImportExport';
import dayjs from 'dayjs';

const { Option } = Select;
const { TextArea } = Input;

const Costs: React.FC = () => {
  const [costs, setCosts] = useState<any[]>([]);
  const [influencers, setInfluencers] = useState<any[]>([]);
  const [merchants, setMerchants] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchInfluencers();
    fetchMerchants();
    fetchCosts();
  }, []);

  const fetchCosts = async () => {
    setLoading(true);
    try {
      const res = await costApi.getAll();
      const data = res.data.data;
      setCosts(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('获取成本列表失败:', error);
      message.error('获取成本列表失败');
      setCosts([]);
    } finally {
      setLoading(false);
    }
  };

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

  const handleAdd = () => {
    form.resetFields();
    setModalVisible(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const costData = {
        ...values,
        cost_date: values.cost_date.format('YYYY-MM-DD'),
      };
      await costApi.create(costData);
      message.success('成本记录创建成功');
      setModalVisible(false);
      fetchCosts();
    } catch (error) {
      console.error('操作失败:', error);
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
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => {
        const typeMap: Record<string, string> = {
          product: '商品成本',
          shipping: '物流成本',
          storage: '仓储成本',
          platform: '平台费用',
          marketing: '营销成本',
          labor: '人工成本',
          other: '其他成本',
        };
        return typeMap[type] || type;
      },
    },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
    },
    {
      title: '金额',
      dataIndex: 'amount',
      key: 'amount',
      align: 'right' as const,
      render: (value: number) => `SGD ${value?.toLocaleString() || 0}`,
    },
    {
      title: '币种',
      dataIndex: 'currency',
      key: 'currency',
    },
    {
      title: '成本日期',
      dataIndex: 'cost_date',
      key: 'cost_date',
    },
    {
      title: '关联达人',
      dataIndex: 'influencer_name',
      key: 'influencer_name',
    },
    {
      title: '关联商家',
      dataIndex: 'merchant_name',
      key: 'merchant_name',
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: '分摊方式',
      dataIndex: 'allocation_method',
      key: 'allocation_method',
      render: (method: string) => {
        const methodMap: Record<string, string> = {
          average: '平均分摊',
          revenue: '按营收比例',
          quantity: '按数量',
          manual: '手动分配',
        };
        return methodMap[method] || method;
      },
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            添加成本
          </Button>
        </div>
        <DataImportExport
          entityName="成本"
          templateColumns={[
            { key: 'type', label: '成本类型', required: true },
            { key: 'category', label: '成本分类', required: true },
            { key: 'amount', label: '金额', required: true },
            { key: 'currency', label: '币种' },
            { key: 'cost_date', label: '成本日期', required: true },
            { key: 'related_influencer_id', label: '关联达人ID' },
            { key: 'related_merchant_id', label: '关联商家ID' },
            { key: 'related_live_session_id', label: '关联直播场次ID' },
            { key: 'related_order_id', label: '关联订单ID' },
            { key: 'description', label: '描述' },
            { key: 'allocation_method', label: '分摊方式' }
          ]}
          onImport={async (data) => {
            for (const item of data) {
              await costApi.create(item);
            }
            fetchCosts();
          }}
          onExport={async () => {
            const res = await costApi.getAll();
            const data = res.data.data;
            return Array.isArray(data) ? data : [];
          }}
        />
      </div>
      <Table
        columns={columns}
        dataSource={costs}
        rowKey="id"
        loading={loading}
        scroll={{ x: 1400 }}
        pagination={{ pageSize: 10 }}
      />

      <Modal
        title="添加成本"
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        width={700}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="type"
            label="成本类型"
            rules={[{ required: true, message: '请选择成本类型' }]}
          >
            <Select placeholder="请选择成本类型">
              <Option value="product">商品成本</Option>
              <Option value="shipping">物流成本</Option>
              <Option value="storage">仓储成本</Option>
              <Option value="platform">平台费用</Option>
              <Option value="marketing">营销成本</Option>
              <Option value="labor">人工成本</Option>
              <Option value="other">其他成本</Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="category"
            label="成本分类"
            rules={[{ required: true, message: '请输入成本分类' }]}
          >
            <Input placeholder="例如: 采购费、运费、仓储费等" />
          </Form.Item>
          <Form.Item
            name="amount"
            label="金额"
            rules={[{ required: true, message: '请输入金额' }]}
          >
            <InputNumber<number>
              style={{ width: '100%' }}
              min={0}
              precision={2}
              placeholder="请输入金额"
              formatter={(value) => `SGD ${value}`}
              parser={(value) => Number(value?.replace('SGD ', ''))}
              onFocus={(event) => event.target.select()}
            />
          </Form.Item>
          <Form.Item name="currency" label="币种" initialValue="SGD">
            <Select>
              <Option value="SGD">SGD - 新加坡元</Option>
              <Option value="USD">USD - 美元</Option>
              <Option value="CNY">CNY - 人民币</Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="cost_date"
            label="成本日期"
            rules={[{ required: true, message: '请选择成本日期' }]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="related_influencer_id" label="关联达人">
            <Select placeholder="请选择达人" allowClear showSearch filterOption={(input, option: any) =>
              option?.children?.toLowerCase().includes(input.toLowerCase())
            }>
              {influencers.map((inf: any) => (
                <Option key={inf.id} value={inf.id}>
                  {inf.name} ({inf.platform})
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="related_merchant_id" label="关联商家">
            <Select placeholder="请选择商家" allowClear showSearch filterOption={(input, option: any) =>
              option?.children?.toLowerCase().includes(input.toLowerCase())
            }>
              {merchants.map((mer: any) => (
                <Option key={mer.id} value={mer.id}>
                  {mer.name} ({mer.platform})
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="description" label="描述">
            <TextArea rows={3} placeholder="请输入成本描述" />
          </Form.Item>
          <Form.Item
            name="allocation_method"
            label="分摊方式"
            initialValue="average"
          >
            <Select>
              <Option value="average">平均分摊</Option>
              <Option value="revenue">按营收比例</Option>
              <Option value="quantity">按数量</Option>
              <Option value="manual">手动分配</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Costs;
