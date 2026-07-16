import React, { useMemo, useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, Select, InputNumber, Space, message, Popconfirm, Card, Statistic, Row, Col, Tag } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined, SearchOutlined, ShopOutlined, ProfileOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useNavigate } from 'react-router-dom';
import { liveSessionApi, merchantApi } from '../api';
import DataImportExport from '../components/DataImportExport';
import { defaultEmployees, EMPLOYEES_STORAGE_KEY } from '../data/employees';

const { Option } = Select;

const PLATFORM_OPTIONS = [
  { value: 'TK', label: 'TK', color: 'red' },
  { value: 'SP', label: 'SP', color: 'orange' },
  { value: 'FB', label: 'FB', color: 'blue' },
];

const COOPERATION_MODE_OPTIONS = ['TAP', 'TSP', '英弗自营', '达播自营'];
const ASSISTANT_OPTIONS = ['是（强助播）', '是（一般助播）', '否'];
const BRAND_PRIORITY_OPTIONS = ['P00', 'P0', 'P1', '潜力P0'];

const normalizeAssistantStatus = (value?: string) => {
  if (value === '是') return '是（强助播）';
  return value || '';
};

const normalizeCommissionRate = (value: unknown) => {
  if (value === undefined || value === null || value === '') return 0;

  if (typeof value === 'number') {
    return value > 1 ? value / 100 : value;
  }

  const text = String(value).trim();
  if (!text) return 0;

  const numericText = text.replace('%', '').replace(/,/g, '').trim();
  const numericValue = Number(numericText);

  if (!Number.isFinite(numericValue)) return 0;
  return text.includes('%') || numericValue > 1 ? numericValue / 100 : numericValue;
};

const MERCHANT_EXPORT_COLUMNS = [
  { key: 'id', label: '序号' },
  { key: 'name', label: '商家名称', required: true },
  { key: 'brand_priority', label: '品牌优先级' },
  { key: 'country', label: '国家' },
  { key: 'merchant_owner', label: '对应负责人（对接小二）' },
  { key: 'primary_category', label: '一级类目' },
  { key: 'secondary_category', label: '二级类目' },
  { key: 'main_effect', label: '主打功效' },
  { key: 'platform', label: '平台' },
  { key: 'cooperation_mode', label: '合作模式' },
  { key: 'has_strong_assistant', label: '是否有助播' },
  { key: 'merchant_store', label: '商家店铺' },
  { key: 'commission_rate', label: '佣金率' },
  { key: 'supply_price_sheet_url', label: '品牌供货价货盘表' },
  { key: 'cargo_sheet_url', label: '货盘表' },
  { key: 'cooperation_notes', label: '合作备注' },
  { key: 'brand_address', label: '品牌方地址' },
  { key: 'brand_intro', label: '品牌介绍' },
  { key: 'brand_assistants', label: '品牌助播' },
  { key: 'brand_live_venue', label: '品牌直播场地' },
  { key: 'brand_cards', label: '品牌手卡' },
  { key: 'other_files', label: '其他文件' },
  { key: 'contact_person', label: '联系人' },
  { key: 'email', label: '邮箱' },
  { key: 'phone', label: '手机' },
  { key: 'status', label: '状态' },
  { key: 'notes', label: '备注' },
  { key: 'company_name', label: '公司名称' },
  { key: 'settlement_cycle', label: '结算周期' },
  { key: 'historical_gmv', label: '历史GMV' },
  { key: 'created_at', label: '创建时间' },
  { key: 'updated_at', label: '更新时间' },
];

const normalizeCooperationMode = (mode?: string) => {
  if (mode === '自营') return '英弗自营';
  if (mode === '纯佣') return 'TAP';
  return mode || '';
};

const normalizePlatforms = (platform?: string | string[]) => {
  const rawValues = Array.isArray(platform)
    ? platform
    : String(platform || '')
      .split(/[,/、，]/)
      .map((item) => item.trim())
      .filter(Boolean);

  const mapped = rawValues.flatMap((item) => {
    const normalized = item.toUpperCase();
    if (item === 'Both' || item === '双平台') return ['TK', 'SP'];
    if (item === 'TikTok') return ['TK'];
    if (item === 'Shopee') return ['SP'];
    if (normalized === 'TIKTOK') return ['TK'];
    if (normalized === 'SHOPEE') return ['SP'];
    if (normalized === 'TK' || normalized === 'SP' || normalized === 'FB') return [normalized];
    if (/shopfluence/i.test(item) || item === '英弗') return ['TK'];
    return [item];
  });

  return Array.from(new Set(mapped.filter((item) => PLATFORM_OPTIONS.some((option) => option.value === item))));
};

const serializePlatforms = (platform?: string | string[]) => normalizePlatforms(platform).join(',');

const serializeSingleValue = (value?: string | string[]) => {
  if (Array.isArray(value)) return value[0] || '';
  return value || '';
};

const safeNumber = (value?: number | string | null) => {
  const num = Number(value ?? 0);
  return Number.isFinite(num) ? num : 0;
};

const lowerText = (value?: string | number | null) => String(value ?? '').toLowerCase();

const getErrorDetail = (error: unknown) => {
  const candidate = error as { response?: { data?: { error?: string } }; message?: string };
  return candidate?.response?.data?.error || candidate?.message || String(error);
};

const readEmployees = () => {
  try {
    const saved = localStorage.getItem(EMPLOYEES_STORAGE_KEY);
    return saved ? JSON.parse(saved) : defaultEmployees;
  } catch (error) {
    return defaultEmployees;
  }
};

const renderPlatformTags = (platform?: string | string[]) => {
  const platforms = normalizePlatforms(platform);

  if (platforms.length === 0) return '未填写';

  return platforms.map((value) => {
    const option = PLATFORM_OPTIONS.find((item) => item.value === value);
    return (
      <Tag key={value} color={option?.color || 'default'}>
        {option?.label || value}
      </Tag>
    );
  });
};

interface Merchant {
  id: number;
  name: string;
  brand_priority?: string;
  country?: string;
  merchant_owner?: string;
  platform: string;
  category?: string;
  primary_category?: string;
  secondary_category?: string;
  main_effect?: string;
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
  has_strong_assistant?: string;
  merchant_store?: string;
  created_at: string;
  updated_at: string;
}

const Merchants: React.FC = () => {
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [liveSessions, setLiveSessions] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>(() => readEmployees());
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [platformFilter, setPlatformFilter] = useState<string[]>([]);
  const [primaryCategoryFilter, setPrimaryCategoryFilter] = useState<string>('all');
  const [secondaryCategoryFilter, setSecondaryCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState<Merchant | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [form] = Form.useForm();
  const navigate = useNavigate();

  const fetchMerchants = async () => {
    setLoading(true);
    try {
      const merchantRes = await merchantApi.getAll();
      const merchantData = merchantRes.data.data;
      setMerchants(Array.isArray(merchantData) ? merchantData : []);
    } catch (error) {
      console.error('获取商家列表失败:', error);
      message.error('获取商家列表失败');
      setMerchants([]);
    }

    try {
      const sessionRes = await liveSessionApi.getAll();
      const sessionData = sessionRes.data.data;
      setLiveSessions(Array.isArray(sessionData) ? sessionData : []);
    } catch (error) {
      console.warn('获取直播场次失败，历史GMV暂时不可用:', error);
      setLiveSessions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMerchants();
  }, []);

  useEffect(() => {
    const syncEmployees = () => setEmployees(readEmployees());
    window.addEventListener('storage', syncEmployees);
    return () => window.removeEventListener('storage', syncEmployees);
  }, []);

  const employeeOptions = useMemo(() => {
    return employees
      .filter((item) => item.status !== 'inactive')
      .map((item) => ({
        label: item.role ? `${item.name}（${item.role}）` : item.name,
        value: item.name,
      }));
  }, [employees]);

  const primaryCategoryOptions = useMemo(() => {
    const defaults = ['服装', '美妆', '食品', '家居', '电子产品', '其他'];
    const values = merchants.map((item) => item.primary_category || item.category).filter(Boolean) as string[];
    return Array.from(new Set([...defaults, ...values]));
  }, [merchants]);

  const secondaryCategoryOptions = useMemo(() => {
    const values = merchants.map((item) => item.secondary_category).filter(Boolean) as string[];
    return Array.from(new Set(values));
  }, [merchants]);

  const handleAdd = () => {
    setEditingRecord(null);
    form.resetFields();
    form.setFieldsValue({
      primary_category: ['服装'],
      secondary_category: undefined,
      platform: [],
      has_strong_assistant: undefined,
      commission_rate: 0.1,
      status: 'active'
    });
    setModalVisible(true);
  };

  const handleEdit = (record: Merchant) => {
    setEditingRecord(record);
    form.setFieldsValue({
      ...record,
      country: record.country ? [record.country] : undefined,
      merchant_owner: record.merchant_owner ? [record.merchant_owner] : undefined,
      primary_category: record.primary_category || record.category ? [record.primary_category || record.category] : undefined,
      secondary_category: record.secondary_category ? [record.secondary_category] : undefined,
      cooperation_mode: normalizeCooperationMode(record.cooperation_mode),
      has_strong_assistant: normalizeAssistantStatus(record.has_strong_assistant) || undefined,
      platform: normalizePlatforms(record.platform),
    });
    setModalVisible(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await merchantApi.delete(id);
      message.success('删除成功');
      setSelectedRowKeys((prev) => prev.filter((key) => String(key) !== String(id)));
      fetchMerchants();
    } catch (error) {
      console.error('删除失败:', error);
      const detail = (error as any)?.response?.data?.error;
      message.error(detail ? `删除失败：${detail}` : '删除失败');
    }
  };

  const handleBatchDelete = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先勾选要删除的商家');
      return;
    }

    try {
      await Promise.all(selectedRowKeys.map((id) => merchantApi.delete(Number(id))));
      message.success(`已删除 ${selectedRowKeys.length} 个商家`);
      setSelectedRowKeys([]);
      fetchMerchants();
    } catch (error) {
      console.error('批量删除失败:', error);
      const detail = (error as any)?.response?.data?.error;
      message.error(detail ? `批量删除失败：${detail}` : '批量删除失败');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const payload = {
        ...values,
        country: serializeSingleValue(values.country),
        merchant_owner: serializeSingleValue(values.merchant_owner),
        primary_category: serializeSingleValue(values.primary_category),
        secondary_category: serializeSingleValue(values.secondary_category),
        category: serializeSingleValue(values.primary_category),
        cooperation_mode: normalizeCooperationMode(values.cooperation_mode),
        commission_rate: normalizeCommissionRate(values.commission_rate),
        platform: serializePlatforms(values.platform),
      };
      if (editingRecord) {
        await merchantApi.update(editingRecord.id, payload);
        message.success('更新成功');
      } else {
        await merchantApi.create(payload);
        message.success('创建成功');
      }
      setModalVisible(false);
      fetchMerchants();
    } catch (error: any) {
      console.error('操作失败:', error);
      message.error(error?.response?.data?.error || '操作失败');
    }
  };

  const filteredMerchants = merchants.filter(item => {
    const keyword = searchText.toLowerCase();
    const matchSearch = [item.name, item.contact_person, item.email]
      .some((value) => lowerText(value).includes(keyword));
    const itemPlatforms = normalizePlatforms(item.platform);
    const itemPrimaryCategory = item.primary_category || item.category || '';
    const matchPlatform = platformFilter.length === 0 || platformFilter.some((platform) => itemPlatforms.includes(platform));
    const matchPrimaryCategory = !primaryCategoryFilter || primaryCategoryFilter === 'all' || itemPrimaryCategory === primaryCategoryFilter;
    const matchSecondaryCategory = !secondaryCategoryFilter || secondaryCategoryFilter === 'all' || item.secondary_category === secondaryCategoryFilter;
    const matchStatus = statusFilter === 'all' || item.status === statusFilter;
    return matchSearch && matchPlatform && matchPrimaryCategory && matchSecondaryCategory && matchStatus;
  });

  const getHistoricalGmv = (merchant: Merchant) => {
    return liveSessions
      .filter((session) => {
        return String(session.merchant_id || '') === String(merchant.id)
          || session.merchant_name === merchant.name;
      })
      .reduce((sum, session) => sum + Number(session.actual_gmv_sgd || 0), 0);
  };

  const formatMerchantExportRow = (merchant: Merchant, index = 0) => ({
    序号: index + 1,
    商家名称: merchant.name || '',
    品牌优先级: merchant.brand_priority || '',
    国家: merchant.country || '',
    '对应负责人（对接小二）': merchant.merchant_owner || '',
    一级类目: merchant.primary_category || merchant.category || '',
    二级类目: merchant.secondary_category || '',
    主打功效: merchant.main_effect || '',
    平台: normalizePlatforms(merchant.platform).join('/'),
    合作模式: normalizeCooperationMode(merchant.cooperation_mode) || '',
    是否有助播: normalizeAssistantStatus(merchant.has_strong_assistant),
    商家店铺: merchant.merchant_store || '',
    佣金率: merchant.commission_rate ?? '',
    品牌供货价货盘表: merchant.supply_price_sheet_url || '',
    货盘表: merchant.cargo_sheet_url || '',
    合作备注: merchant.cooperation_notes || '',
    品牌方地址: merchant.brand_address || '',
    品牌介绍: merchant.brand_intro || '',
    品牌助播: merchant.brand_assistants || '',
    品牌直播场地: merchant.brand_live_venue || '',
    品牌手卡: merchant.brand_cards || '',
    其他文件: merchant.other_files || '',
    联系人: merchant.contact_person || '',
    邮箱: merchant.email || '',
    手机: merchant.phone || '',
    状态: merchant.status || '',
    备注: merchant.notes || '',
    公司名称: merchant.company_name || '',
    结算周期: merchant.settlement_cycle || '',
    历史GMV: getHistoricalGmv(merchant),
    创建时间: merchant.created_at || '',
    更新时间: merchant.updated_at || '',
  });

  const columns: ColumnsType<Merchant> = [
    {
      title: '序号',
      dataIndex: 'id',
      key: 'id',
      width: 80,
      render: (_: number, __: Merchant, index: number) => index + 1,
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
      title: '品牌优先级',
      dataIndex: 'brand_priority',
      key: 'brand_priority',
      width: 120,
      render: (value?: string) => value ? <Tag color="blue">{value}</Tag> : '未填写',
      filters: BRAND_PRIORITY_OPTIONS.map((priority) => ({ text: priority, value: priority })),
      onFilter: (value, record) => record.brand_priority === value,
    },
    {
      title: '国家',
      dataIndex: 'country',
      key: 'country',
      width: 100,
      render: (value?: string) => value || '未填写',
      filters: [
        { text: '中国', value: '中国' },
        { text: '日本', value: '日本' },
        { text: '韩国', value: '韩国' },
      ],
      onFilter: (value, record) => record.country === value,
    },
    {
      title: '对应负责人（对接小二）',
      dataIndex: 'merchant_owner',
      key: 'merchant_owner',
      width: 130,
      render: (value?: string) => value || '未填写',
    },
    {
      title: '一级类目',
      dataIndex: 'primary_category',
      key: 'primary_category',
      width: 120,
      render: (_: string, record) => {
        const category = record.primary_category || record.category || '';
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
      filters: primaryCategoryOptions.map((item) => ({ text: item, value: item })),
      onFilter: (value, record) => (record.primary_category || record.category) === value,
    },
    {
      title: '二级类目',
      dataIndex: 'secondary_category',
      key: 'secondary_category',
      width: 120,
      render: (value?: string) => value ? <Tag>{value}</Tag> : '未填写',
      filters: secondaryCategoryOptions.map((item) => ({ text: item, value: item })),
      onFilter: (value, record) => record.secondary_category === value,
    },
    {
      title: '主打功效',
      dataIndex: 'main_effect',
      key: 'main_effect',
      width: 140,
      render: (value?: string) => value || '未填写',
    },
    {
      title: '平台',
      dataIndex: 'platform',
      key: 'platform',
      width: 110,
      render: renderPlatformTags,
      filters: PLATFORM_OPTIONS.map((option) => ({ text: option.label, value: option.value })),
      onFilter: (value, record) => normalizePlatforms(record.platform).includes(String(value)),
    },
    {
      title: '合作模式',
      dataIndex: 'cooperation_mode',
      key: 'cooperation_mode',
      width: 110,
      render: (value: string) => normalizeCooperationMode(value) || '未填写',
      filters: COOPERATION_MODE_OPTIONS.map((mode) => ({ text: mode, value: mode })),
      onFilter: (value, record) => normalizeCooperationMode(record.cooperation_mode) === value,
    },
    {
      title: '是否有助播',
      dataIndex: 'has_strong_assistant',
      key: 'has_strong_assistant',
      width: 130,
      render: (value?: string) => value ? (
        <Tag color={normalizeAssistantStatus(value).startsWith('是') ? 'green' : 'default'}>
          {normalizeAssistantStatus(value)}
        </Tag>
      ) : '未填写',
      filters: ASSISTANT_OPTIONS.map((option) => ({ text: option, value: option })),
      onFilter: (value, record) => normalizeAssistantStatus(record.has_strong_assistant) === value,
    },
    {
      title: '商家店铺',
      dataIndex: 'merchant_store',
      key: 'merchant_store',
      width: 140,
      render: (value?: string) => value || '未填写',
    },
    {
      title: '佣金率',
      dataIndex: 'commission_rate',
      key: 'commission_rate',
      width: 110,
      render: (rate: number) => `${(safeNumber(rate) * 100).toFixed(2)}%`,
      sorter: (a, b) => safeNumber(a.commission_rate) - safeNumber(b.commission_rate),
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
  const tkMerchants = merchants.filter(m => normalizePlatforms(m.platform).includes('TK')).length;
  const spMerchants = merchants.filter(m => normalizePlatforms(m.platform).includes('SP')).length;
  const fbMerchants = merchants.filter(m => normalizePlatforms(m.platform).includes('FB')).length;

  // 按分类统计
  const categoryStats = merchants.reduce((acc, m) => {
    const category = m.primary_category || m.category || '未分类';
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
              title="TK商家"
              value={tkMerchants}
              valueStyle={{ color: '#ff0050' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="SP商家"
              value={spMerchants}
              valueStyle={{ color: '#ee4d2d' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="FB商家"
              value={fbMerchants}
              valueStyle={{ color: '#1677ff' }}
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
            mode="multiple"
            maxTagCount="responsive"
            style={{ width: 180 }}
            allowClear
          >
            {PLATFORM_OPTIONS.map((option) => (
              <Option key={option.value} value={option.value}>{option.label}</Option>
            ))}
          </Select>
          <Select
            placeholder="一级类目筛选"
            value={primaryCategoryFilter}
            onChange={setPrimaryCategoryFilter}
            style={{ width: 150 }}
            allowClear
          >
            <Option value="all">所有一级类目</Option>
            {primaryCategoryOptions.map((category) => (
              <Option key={category} value={category}>{category}</Option>
            ))}
          </Select>
          <Select
            placeholder="二级类目筛选"
            value={secondaryCategoryFilter}
            onChange={setSecondaryCategoryFilter}
            style={{ width: 150 }}
            allowClear
          >
            <Option value="all">所有二级类目</Option>
            {secondaryCategoryOptions.map((category) => (
              <Option key={category} value={category}>{category}</Option>
            ))}
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
          <Popconfirm
            title="确认批量删除"
            description={`确定要删除已勾选的 ${selectedRowKeys.length} 个商家吗？`}
            onConfirm={handleBatchDelete}
            okText="确定"
            cancelText="取消"
            disabled={selectedRowKeys.length === 0}
          >
            <Button
              danger
              icon={<DeleteOutlined />}
              disabled={selectedRowKeys.length === 0}
            >
              批量删除{selectedRowKeys.length ? `（${selectedRowKeys.length}）` : ''}
            </Button>
          </Popconfirm>
        </Space>

        <DataImportExport
          entityName="商家"
          templateColumns={MERCHANT_EXPORT_COLUMNS}
          onImport={async (data) => {
            for (const [index, item] of data.entries()) {
              const assistantStatus = item.has_strong_assistant || item['是否有强助播'] || item['是否有助播'];
              const primaryCategory = item.primary_category || item['一级类目'] || item.category || item['商家分类'];
              const secondaryCategory = item.secondary_category || item['二级类目'];
              const merchantOwner = item.merchant_owner || item['对应负责人（对接小二）'] || item['对应负责人'];
              const brandPriority = item.brand_priority || item['品牌优先级'];
              const mainEffect = item.main_effect || item['主打功效'];
              try {
                await merchantApi.create({
                  ...item,
                  brand_priority: brandPriority || '',
                  merchant_owner: merchantOwner || '',
                  has_strong_assistant: normalizeAssistantStatus(assistantStatus),
                  primary_category: primaryCategory || '',
                  secondary_category: secondaryCategory || '',
                  main_effect: mainEffect || '',
                  category: primaryCategory || '',
                  cooperation_mode: normalizeCooperationMode(item.cooperation_mode || item['合作模式']),
                  commission_rate: normalizeCommissionRate(item.commission_rate || item['佣金率']),
                  platform: serializePlatforms(item.platform || item['平台']),
                });
              } catch (error: unknown) {
                throw new Error(`第 ${index + 2} 行导入失败：${getErrorDetail(error)}`);
              }
            }
            fetchMerchants();
          }}
          onExport={async () => {
            const res = await merchantApi.getAll();
            const data = res.data.data;
            return Array.isArray(data) ? data.map(formatMerchantExportRow) : [];
          }}
        />

        <Table
          columns={columns}
          dataSource={filteredMerchants}
          rowKey="id"
          loading={loading}
          rowSelection={{
            selectedRowKeys,
            onChange: setSelectedRowKeys,
            preserveSelectedRowKeys: true,
          }}
          scroll={{ x: 2460 }}
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
          <Form.Item name="brand_priority" label="品牌优先级">
            <Select placeholder="请选择品牌优先级" allowClear>
              {BRAND_PRIORITY_OPTIONS.map((priority) => (
                <Option key={priority} value={priority}>{priority}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="country" label="国家">
            <Select placeholder="请选择或输入国家" allowClear showSearch mode="tags" maxCount={1}>
              <Option value="中国">中国</Option>
              <Option value="日本">日本</Option>
              <Option value="韩国">韩国</Option>
            </Select>
          </Form.Item>
          <Form.Item name="merchant_owner" label="对应负责人（对接小二）">
            <Select
              placeholder="优先选择员工，也可以输入新增"
              allowClear
              showSearch
              mode="tags"
              maxCount={1}
              options={employeeOptions}
              optionFilterProp="label"
            />
          </Form.Item>
          <Form.Item
            name="primary_category"
            label="一级类目"
            rules={[{ required: true, message: '请选择或输入一级类目' }]}
          >
            <Select placeholder="优先选择一级类目，也可以输入新增" allowClear showSearch mode="tags" maxCount={1}>
              {primaryCategoryOptions.map((category) => (
                <Option key={category} value={category}>{category}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="secondary_category" label="二级类目">
            <Select placeholder="优先选择二级类目，也可以输入新增" allowClear showSearch mode="tags" maxCount={1}>
              {secondaryCategoryOptions.map((category) => (
                <Option key={category} value={category}>{category}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="main_effect" label="主打功效">
            <Input placeholder="请输入主打功效" />
          </Form.Item>
          <Form.Item
            name="platform"
            label="平台"
          >
            <Select mode="multiple" placeholder="请选择平台" allowClear>
              {PLATFORM_OPTIONS.map((option) => (
                <Option key={option.value} value={option.value}>{option.label}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="cooperation_mode" label="合作模式">
            <Select placeholder="请选择合作模式" allowClear>
              {COOPERATION_MODE_OPTIONS.map((mode) => (
                <Option key={mode} value={mode}>{mode}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="has_strong_assistant" label="是否有助播">
            <Select placeholder="请选择是否有助播" allowClear>
              {ASSISTANT_OPTIONS.map((option) => (
                <Option key={option} value={option}>{option}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="merchant_store" label="商家店铺">
            <Input placeholder="请输入商家店铺名称或链接" />
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
