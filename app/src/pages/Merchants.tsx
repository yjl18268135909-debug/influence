import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, Select, InputNumber, Space, message, Popconfirm, Card, Statistic, Row, Col, Tag } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined, SearchOutlined, ShopOutlined, ProfileOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useNavigate } from 'react-router-dom';
import { liveSessionApi, merchantApi } from '../api';
import DataImportExport from '../components/DataImportExport';

const { Option } = Select;

interface Merchant {
  id: number;
  name: string;
  platform: string;
  category: string;
  contact_person: string;
  email: string;
  phone: string;
  supply_price_sheet_url?: string;
  cargo_sheet_url?: string;
  cooperation_mode?: string;
  cooperation_notes?: string;
  brand_address?: string;
  commission_rate: number;
  settlement_cycle: string;
  status: string;
  notes: string;
  brand_intro?: string;
  brand_assistants?: string;
  brand_live_venue?: string;
  brand_cards?: string;
  other_files?: string;
  company_name?: string;
  created_at: string;
  updated_at: string;
}

const Merchants: React.FC = () => {
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [liveSessions, setLiveSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [platformFilter, setPlatformFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState<Merchant | null>(null);
  const [form] = Form.useForm();
  const navigate = useNavigate();

  const fetchMerchants = async () => {
    setLoading(true);
    try {
      const [merchantRes, sessionRes] = await Promise.all([
        merchantApi.getAll(),
        liveSessionApi.getAll(),
      ]);
      const merchantData = merchantRes.data.data;
      const sessionData = sessionRes.data.data;
      setMerchants(Array.isArray(merchantData) ? merchantData : []);
      setLiveSessions(Array.isArray(sessionData) ? sessionData : []);
    } catch (error) {
      console.error('获取商家列表失败:', error);
      message.error('获取商家列表失败');
      setMerchants([]);
      setLiveSessions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMerchants();
  }, []);

  const handleAdd = () => {
    setEditingRecord(null);
    form.resetFields();
    form.setFieldsValue({
      category: '服装',
      commission_rate: 0.1,
      status: 'active'
    });
    setModalVisible(true);
  };

  const handleEdit = (record: Merchant) => {
    setEditingRecord(record);
    form.setFieldsValue(record);
    setModalVisible(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await merchantApi.delete(id);
      message.success('删除成功');
      fetchMerchants();
    } catch (error) {
      console.error('删除失败:', error);
      message.error('删除失败');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (editingRecord) {
        await merchantApi.update(editingRecord.id, values);
        message.success('更新成功');
      } else {
        await merchantApi.create(values);
        message.success('创建成功');
      }
      setModalVisible(false);
      fetchMerchants();
    } catch (error) {
      console.error('操作失败:', error);
      message.error('操作失败');
    }
  };

  const filteredMerchants = merchants.filter(item => {
    const matchSearch = item.name.toLowerCase().includes(searchText.toLowerCase()) ||
                       item.contact_person.toLowerCase().includes(searchText.toLowerCase()) ||
                       (item.email && item.email.toLowerCase().includes(searchText.toLowerCase()));
    const matchPlatform = platformFilter === 'all' || item.platform === platformFilter;
    const matchCategory = categoryFilter === 'all' || item.category === categoryFilter;
    const matchStatus = statusFilter === 'all' || item.status === statusFilter;
    return matchSearch && matchPlatform && matchCategory && matchStatus;
  });

  const getHistoricalGmv = (merchant: Merchant) => {
    return liveSessions
      .filter((session) => {
        return String(session.merchant_id || '') === String(merchant.id)
          || session.merchant_name === merchant.name;
      })
      .reduce((sum, session) => sum + Number(session.actual_gmv_sgd || 0), 0);
  };

  const columns: ColumnsType<Merchant> = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
      fixed: 'left',
    },
    {
      title: '商家名称',
      dataIndex: 'name',
      key: 'name',
      width: 140,
      fixed: 'left',
      sorter: (a, b) => a.name.localeCompare(b.name),
    },
    {
      title: '商家分类',
      dataIndex: 'category',
      key: 'category',
      width: 120,
      fixed: 'left',
      render: (category: string) => {
        const categoryColors: Record<string, string> = {
          '服装': 'blue',
          '美妆': 'pink',
          '食品': 'orange',
          '家居': 'purple',
          '电子产品': 'cyan',
          '其他': 'default',
        };
        return <Tag color={categoryColors[category] || 'default'}>{category || '未分类'}</Tag>;
      },
      filters: [
        { text: '服装', value: '服装' },
        { text: '美妆', value: '美妆' },
        { text: '食品', value: '食品' },
        { text: '家居', value: '家居' },
        { text: '电子产品', value: '电子产品' },
        { text: '其他', value: '其他' },
      ],
    },
    {
      title: '平台',
      dataIndex: 'platform',
      key: 'platform',
      width: 110,
      fixed: 'left',
      render: (platform: string) => (
        <Tag color={platform === 'TikTok' ? 'red' : platform === 'Shopee' ? 'orange' : 'green'}>
          {platform ? (platform === 'Both' ? '双平台' : platform) : '未填写'}
        </Tag>
      ),
      filters: [
        { text: 'TikTok', value: 'TikTok' },
        { text: 'Shopee', value: 'Shopee' },
        { text: '双平台', value: 'Both' },
      ],
    },
    {
      title: '合作模式',
      dataIndex: 'cooperation_mode',
      key: 'cooperation_mode',
      width: 110,
      fixed: 'left',
      render: (value: string) => value || '未填写',
      filters: [
        { text: 'TAP', value: 'TAP' },
        { text: '自营', value: '自营' },
        { text: 'TSP', value: 'TSP' },
      ],
    },
    {
      title: '佣金率',
      dataIndex: 'commission_rate',
      key: 'commission_rate',
      width: 110,
      render: (rate: number) => `${(rate * 100).toFixed(2)}%`,
      sorter: (a, b) => a.commission_rate - b.commission_rate,
    },
    {
      title: '品牌供货价货盘表',
      dataIndex: 'supply_price_sheet_url',
      key: 'supply_price_sheet_url',
      width: 160,
      render: (url?: string) => url ? (
        <a href={url} target="_blank" rel="noreferrer">
          打开供货价货盘表
        </a>
      ) : '未填写',
    },
    {
      title: '货盘表',
      dataIndex: 'cargo_sheet_url',
      key: 'cargo_sheet_url',
      width: 120,
      render: (url?: string) => url ? (
        <a href={url} target="_blank" rel="noreferrer">
          打开货盘表
        </a>
      ) : '未填写',
    },
    {
      title: '商家介绍',
      key: 'merchant_intro',
      width: 120,
      render: (_: any, record: Merchant) => (
        <Button type="link" icon={<ProfileOutlined />} onClick={() => navigate(`/merchants/${record.id}/introduction`)}>
          查看
        </Button>
      ),
    },
    {
      title: '合作备注',
      dataIndex: 'cooperation_notes',
      key: 'cooperation_notes',
      width: 160,
      render: (value?: string) => value || '未填写',
    },
    {
      title: '历史GMV',
      key: 'historical_gmv',
      width: 130,
      render: (_: any, record: Merchant) => `SGD ${getHistoricalGmv(record).toLocaleString()}`,
      sorter: (a, b) => getHistoricalGmv(a) - getHistoricalGmv(b),
    },
    {
      title: '品牌方地址',
      dataIndex: 'brand_address',
      key: 'brand_address',
      width: 160,
      render: (value?: string) => value || '未填写',
    },
    {
      title: '联系人',
      dataIndex: 'contact_person',
      key: 'contact_person',
      width: 120,
    },
    {
      title: '邮箱',
      dataIndex: 'email',
      key: 'email',
      width: 180,
    },
    {
      title: '手机',
      dataIndex: 'phone',
      key: 'phone',
      width: 130,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => (
        <Tag color={status === 'active' ? 'green' : 'default'}>
          {status === 'active' ? '活跃' : '停用'}
        </Tag>
      ),
      filters: [
        { text: '活跃', value: 'active' },
        { text: '停用', value: 'inactive' },
      ],
    },
    {
      title: '公司名称',
      dataIndex: 'company_name',
      key: 'company_name',
      width: 180,
      render: (value?: string) => value || '未填写',
    },
    {
      title: '操作',
      key: 'action',
      fixed: 'right' as const,
      width: 150,
      render: (_: any, record: Merchant) => (
        <Space size="small">
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确认删除"
            description="确定要删除这个商家吗？"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // 计算统计数据
  const totalMerchants = merchants.length;
  const activeMerchants = merchants.filter(m => m.status === 'active').length;
  const tiktokMerchants = merchants.filter(m => m.platform === 'TikTok' || m.platform === 'Both').length;
  const shopeeMerchants = merchants.filter(m => m.platform === 'Shopee' || m.platform === 'Both').length;

  // 按分类统计
  const categoryStats = merchants.reduce((acc, m) => {
    const category = m.category || '未分类';
    acc[category] = (acc[category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const topCategory = Object.entries(categoryStats).sort((a, b) => b[1] - a[1])[0];

  return (
    <div style={{ padding: '24px' }}>
      <h1 style={{ marginBottom: 24 }}>商家管理</h1>

      {/* 统计卡片 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="总商家数"
              value={totalMerchants}
              prefix={<ShopOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="活跃商家"
              value={activeMerchants}
              prefix={<ShopOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="TikTok商家"
              value={tiktokMerchants}
              valueStyle={{ color: '#ff0050' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Shopee商家"
              value={shopeeMerchants}
              valueStyle={{ color: '#ee4d2d' }}
            />
          </Card>
        </Col>
      </Row>

      <Card>
        <Space style={{ marginBottom: 16 }} wrap>
          <Input
            placeholder="搜索商家名称、联系人或邮箱"
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 280 }}
            allowClear
          />
          <Select
            placeholder="平台筛选"
            value={platformFilter}
            onChange={setPlatformFilter}
            style={{ width: 120 }}
            allowClear
          >
            <Option value="all">所有平台</Option>
            <Option value="TikTok">TikTok</Option>
            <Option value="Shopee">Shopee</Option>
            <Option value="Both">双平台</Option>
          </Select>
          <Select
            placeholder="分类筛选"
            value={categoryFilter}
            onChange={setCategoryFilter}
            style={{ width: 120 }}
            allowClear
          >
            <Option value="all">所有分类</Option>
            <Option value="服装">服装</Option>
            <Option value="美妆">美妆</Option>
            <Option value="食品">食品</Option>
            <Option value="家居">家居</Option>
            <Option value="电子产品">电子产品</Option>
            <Option value="其他">其他</Option>
          </Select>
          <Select
            placeholder="状态筛选"
            value={statusFilter}
            onChange={setStatusFilter}
            style={{ width: 120 }}
            allowClear
          >
            <Option value="all">所有状态</Option>
            <Option value="active">活跃</Option>
            <Option value="inactive">停用</Option>
          </Select>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleAdd}
          >
            添加商家
          </Button>
          <Button
            icon={<ReloadOutlined />}
            onClick={fetchMerchants}
          >
            刷新
          </Button>
        </Space>

        <DataImportExport
          entityName="商家"
          templateColumns={[
            { key: 'name', label: '商家名称', required: true },
            { key: 'category', label: '商家分类' },
            { key: 'contact_person', label: '联系人' },
            { key: 'email', label: '邮箱' },
            { key: 'phone', label: '手机' },
            { key: 'supply_price_sheet_url', label: '品牌供货价货盘表' },
            { key: 'cargo_sheet_url', label: '货盘表' },
            { key: 'platform', label: '平台' },
            { key: 'cooperation_mode', label: '合作模式' },
            { key: 'cooperation_notes', label: '合作备注' },
            { key: 'brand_address', label: '品牌方地址' },
            { key: 'commission_rate', label: '佣金率' },
            { key: 'status', label: '状态' },
            { key: 'notes', label: '备注' },
            { key: 'company_name', label: '公司名称' }
          ]}
          onImport={async (data) => {
            for (const item of data) {
              await merchantApi.create(item);
            }
            fetchMerchants();
          }}
          onExport={async () => {
            const res = await merchantApi.getAll();
            const data = res.data.data;
            return Array.isArray(data) ? data : [];
          }}
        />

        <Table
          columns={columns}
          dataSource={filteredMerchants}
          rowKey="id"
          loading={loading}
          scroll={{ x: 2200 }}
          pagination={{
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条记录`,
          }}
        />
      </Card>

      <Modal
        title={editingRecord ? '编辑商家' : '添加商家'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="商家名称"
            rules={[{ required: true, message: '请输入商家名称' }]}
          >
            <Input placeholder="请输入商家名称" />
          </Form.Item>
          <Form.Item
            name="category"
            label="商家分类"
            rules={[{ required: true, message: '请选择商家分类' }]}
          >
            <Select placeholder="请选择商家分类">
              <Option value="服装">服装</Option>
              <Option value="美妆">美妆</Option>
              <Option value="食品">食品</Option>
              <Option value="家居">家居</Option>
              <Option value="电子产品">电子产品</Option>
              <Option value="其他">其他</Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="platform"
            label="平台"
          >
            <Select placeholder="请选择平台" allowClear>
              <Option value="TikTok">TikTok</Option>
              <Option value="Shopee">Shopee</Option>
              <Option value="Both">双平台</Option>
            </Select>
          </Form.Item>
          <Form.Item name="cooperation_mode" label="合作模式">
            <Select placeholder="请选择合作模式" allowClear>
              <Option value="TAP">TAP</Option>
              <Option value="自营">自营</Option>
              <Option value="TSP">TSP</Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="commission_rate"
            label="佣金率"
            rules={[{ required: true, message: '请输入佣金率' }]}
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
          <Form.Item name="supply_price_sheet_url" label="品牌供货价货盘表">
            <Input placeholder="请输入飞书文档链接" />
          </Form.Item>
          <Form.Item name="cargo_sheet_url" label="货盘表">
            <Input placeholder="请输入飞书文档链接" />
          </Form.Item>
          <Form.Item name="cooperation_notes" label="合作备注">
            <Input.TextArea rows={2} placeholder="请输入合作备注" />
          </Form.Item>
          <Form.Item name="brand_address" label="品牌方地址">
            <Input placeholder="请输入品牌方地址" />
          </Form.Item>
          <Form.Item name="contact_person" label="联系人">
            <Input placeholder="请输入联系人姓名" />
          </Form.Item>
          <Form.Item name="email" label="邮箱">
            <Input placeholder="请输入邮箱" />
          </Form.Item>
          <Form.Item name="phone" label="手机号">
            <Input placeholder="请输入手机号" />
          </Form.Item>
          <Form.Item name="status" label="状态" initialValue="active">
            <Select>
              <Option value="active">活跃</Option>
              <Option value="inactive">停用</Option>
            </Select>
          </Form.Item>
          <Form.Item name="notes" label="备注">
            <Input.TextArea rows={3} placeholder="请输入备注" />
          </Form.Item>
          <Form.Item name="company_name" label="公司名称">
            <Input placeholder="请输入公司名称" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Merchants;
