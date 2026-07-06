import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, Select, InputNumber, Space, message, Popconfirm, Tag, Card, Statistic, Row, Col, Upload } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined, SearchOutlined, UserOutlined, DollarOutlined, DownloadOutlined, UploadOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import * as XLSX from 'xlsx';
import { influencerApi, liveSessionApi } from '../api';

const { Option } = Select;
const { TextArea } = Input;

const influencerImportHeaders = [
  '平台',
  '达人名称',
  '达人账号',
  '达人佣金',
  '达人机构',
  '达人单场数据',
  '达人选品方向',
  '联系方式',
  '达人寄样地址',
  '其他备注',
  '状态',
];

interface Influencer {
  id: number;
  platform: string;
  name: string;
  account: string;
  agency?: string;
  single_session_data?: string;
  product_direction?: string;
  commission_rate: number;
  contact?: string;
  sample_address?: string;
  notes?: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface InfluencerStats {
  id: number;
  name: string;
  platform: string;
  totalGmv: number;
}

const Influencers: React.FC = () => {
  const [influencers, setInfluencers] = useState<Influencer[]>([]);
  const [influencerStats, setInfluencerStats] = useState<InfluencerStats[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [platformFilter, setPlatformFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState<Influencer | null>(null);
  const [importing, setImporting] = useState(false);
  const [form] = Form.useForm();

  const fetchInfluencers = async () => {
    setLoading(true);
    try {
      const res = await influencerApi.getAll();
      const data = res.data.data;
      if (Array.isArray(data)) {
        setInfluencers(data);
        // 计算每个达人的统计数据
        await calculateInfluencerStats(data);
      } else {
        setInfluencers([]);
        setInfluencerStats([]);
      }
    } catch (error) {
      console.error('获取达人列表失败:', error);
      message.error('获取达人列表失败');
      setInfluencers([]);
      setInfluencerStats([]);
    } finally {
      setLoading(false);
    }
  };

  const calculateInfluencerStats = async (influencerList: Influencer[]) => {
    try {
      const sessionRes = await liveSessionApi.getAll();
      const sessions: any[] = Array.isArray(sessionRes.data?.data) ? sessionRes.data.data : [];

      const stats = influencerList.map(inf => {
        const influencerSessions = sessions.filter((session) => {
          return String(session.influencer_id || '') === String(inf.id)
            || session.influencer_name === inf.name;
        });
        return {
          id: inf.id,
          name: inf.name,
          platform: inf.platform,
          totalGmv: influencerSessions.reduce((sum, session) => sum + Number(session.actual_gmv_sgd || 0), 0),
        };
      });
      setInfluencerStats(stats);
    } catch (error) {
      console.error('计算达人统计失败:', error);
    }
  };

  useEffect(() => {
    fetchInfluencers();
  }, []);

  const handleAdd = () => {
    setEditingRecord(null);
    form.resetFields();
    form.setFieldsValue({
      platform: 'TikTok',
      commission_rate: 10,
      status: 'active'
    });
    setModalVisible(true);
  };

  const handleEdit = (record: Influencer) => {
    setEditingRecord(record);
    form.setFieldsValue(record);
    setModalVisible(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await influencerApi.delete(id);
      message.success('删除成功');
      fetchInfluencers();
    } catch (error) {
      console.error('删除失败:', error);
      const detail = (error as any)?.response?.data?.error;
      message.error(detail ? `删除失败：${detail}` : '删除失败');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (editingRecord) {
        await influencerApi.update(editingRecord.id, values);
        message.success('更新成功');
      } else {
        await influencerApi.create(values);
        message.success('添加成功');
      }
      setModalVisible(false);
      fetchInfluencers();
    } catch (error: any) {
      console.error('操作失败:', error);
      message.error(error?.response?.data?.error || '操作失败');
    }
  };

  const parseImportNumber = (value: any, fallback = 0) => {
    if (value === undefined || value === null || value === '') return fallback;
    const parsed = Number(String(value).replace(/[^\d.-]/g, ''));
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const normalizeStatus = (value: any) => {
    const text = String(value || '').trim().toLowerCase();
    if (['停用', 'inactive', 'disabled', '0', '否'].includes(text)) return 'inactive';
    return 'active';
  };

  const normalizePlatform = (value: any) => {
    const text = String(value || '').trim();
    if (text.toLowerCase() === 'shopee') return 'Shopee';
    return 'TikTok';
  };

  const getImportValue = (row: Record<string, any>, labels: string[]) => {
    for (const label of labels) {
      if (row[label] !== undefined && row[label] !== null && row[label] !== '') return row[label];
    }
    return '';
  };

  const downloadInfluencerImportTemplate = () => {
    const exampleRow = [
      'TikTok',
      '示例达人',
      'example_account',
      10,
      '示例机构',
      'GMV 5000，观看人数 1万',
      '美妆/家居',
      '微信或手机号',
      '新加坡示例地址',
      '备注',
      '活跃',
    ];
    const worksheet = XLSX.utils.aoa_to_sheet([influencerImportHeaders, exampleRow]);
    worksheet['!cols'] = influencerImportHeaders.map(() => ({ wch: 18 }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '达人导入模板');
    XLSX.writeFile(workbook, '达人导入模板.xlsx');
  };

  const handleInfluencerImport = async (file: File) => {
    setImporting(true);
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: '' });
      const existingKeys = new Set(influencers.map((item) => `${item.platform}__${item.account}`.toLowerCase()));
      const payloads = rows.map((row, index) => {
        const platform = normalizePlatform(getImportValue(row, ['平台', 'platform']));
        const name = String(getImportValue(row, ['达人名称', 'name'])).trim();
        const account = String(getImportValue(row, ['达人账号', 'account'])).trim();

        if (!name) throw new Error(`第 ${index + 2} 行缺少达人名称`);
        if (!account) throw new Error(`第 ${index + 2} 行缺少达人账号`);

        return {
          platform,
          name,
          account,
          agency: String(getImportValue(row, ['达人机构', 'agency'])).trim() || undefined,
          single_session_data: String(getImportValue(row, ['达人单场数据', 'single_session_data'])).trim() || undefined,
          product_direction: String(getImportValue(row, ['达人选品方向', 'product_direction'])).trim() || undefined,
          commission_rate: parseImportNumber(getImportValue(row, ['达人佣金', '佣金', 'commission_rate']), 0),
          contact: String(getImportValue(row, ['联系方式', 'contact'])).trim() || undefined,
          sample_address: String(getImportValue(row, ['达人寄样地址', 'sample_address'])).trim() || undefined,
          notes: String(getImportValue(row, ['其他备注', 'notes'])).trim() || undefined,
          status: normalizeStatus(getImportValue(row, ['状态', 'status'])),
        };
      });

      const newPayloads = payloads.filter((item) => !existingKeys.has(`${item.platform}__${item.account}`.toLowerCase()));
      if (!newPayloads.length) {
        message.warning('没有可导入的新达人，可能都已存在');
        return false;
      }

      await Promise.all(newPayloads.map((payload) => influencerApi.create(payload)));
      message.success(`已导入 ${newPayloads.length} 个达人${newPayloads.length < payloads.length ? `，跳过 ${payloads.length - newPayloads.length} 个重复达人` : ''}`);
      fetchInfluencers();
    } catch (error) {
      console.error('导入达人失败:', error);
      message.error(`导入失败：${(error as Error).message || '请检查模板内容'}`);
    } finally {
      setImporting(false);
    }
    return false;
  };

  const filteredInfluencers = influencers.filter(item => {
    const matchSearch = item.name.toLowerCase().includes(searchText.toLowerCase()) ||
                       item.account.toLowerCase().includes(searchText.toLowerCase()) ||
                       (item.contact && item.contact.toLowerCase().includes(searchText.toLowerCase()));
    const matchPlatform = platformFilter === 'all' || item.platform === platformFilter;
    const matchStatus = statusFilter === 'all' || item.status === statusFilter;
    return matchSearch && matchPlatform && matchStatus;
  });

  const getInfluencerStats = (id: number) => {
    return influencerStats.find(s => s.id === id) || {
      totalGmv: 0,
    };
  };

  const columns: ColumnsType<Influencer> = [
    {
      title: '平台',
      dataIndex: 'platform',
      key: 'platform',
      width: 100,
      fixed: 'left' as const,
      render: (platform: string) => (
        <Tag color={platform === 'TikTok' ? 'red' : 'orange'}>
          {platform}
        </Tag>
      ),
      filters: [
        { text: 'TikTok', value: 'TikTok' },
        { text: 'Shopee', value: 'Shopee' },
      ],
    },
    {
      title: '达人名称',
      dataIndex: 'name',
      key: 'name',
      width: 150,
      fixed: 'left' as const,
      sorter: (a, b) => a.name.localeCompare(b.name),
    },
    {
      title: '达人账号',
      dataIndex: 'account',
      key: 'account',
      width: 150,
      sorter: (a, b) => a.account.localeCompare(b.account),
    },
    {
      title: '达人佣金',
      dataIndex: 'commission_rate',
      key: 'commission_rate',
      width: 120,
      render: (value: number) => `${value}%`,
      sorter: (a, b) => a.commission_rate - b.commission_rate,
    },
    {
      title: '总合作GMV',
      key: 'totalGmv',
      width: 140,
      render: (_, record) => {
        const stats = getInfluencerStats(record.id);
        return `SGD ${stats.totalGmv.toFixed(2)}`;
      },
      sorter: (a, b) => getInfluencerStats(a.id).totalGmv - getInfluencerStats(b.id).totalGmv,
    },
    {
      title: '达人机构',
      dataIndex: 'agency',
      key: 'agency',
      width: 120,
      render: (text: string) => text || '-',
    },
    {
      title: '达人单场数据',
      dataIndex: 'single_session_data',
      key: 'single_session_data',
      width: 150,
      render: (text: string) => text || '-',
    },
    {
      title: '达人选品方向',
      dataIndex: 'product_direction',
      key: 'product_direction',
      width: 150,
      render: (text: string) => text || '-',
    },
    {
      title: '联系方式',
      dataIndex: 'contact',
      key: 'contact',
      width: 150,
      render: (text: string) => text || '-',
    },
    {
      title: '达人寄样地址',
      dataIndex: 'sample_address',
      key: 'sample_address',
      width: 200,
      render: (text: string) => text ? (
        <span title={text} style={{ cursor: 'pointer' }}>
          {text.length > 20 ? `${text.substring(0, 20)}...` : text}
        </span>
      ) : '-',
    },
    {
      title: '其他备注',
      dataIndex: 'notes',
      key: 'notes',
      width: 200,
      render: (text: string) => text ? (
        <span title={text} style={{ cursor: 'pointer' }}>
          {text.length > 20 ? `${text.substring(0, 20)}...` : text}
        </span>
      ) : '-',
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
      title: '操作',
      key: 'action',
      fixed: 'right' as const,
      width: 150,
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确认删除"
            description="确定要删除这个达人吗？"
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

  // 计算汇总数据
  const totalInfluencers = influencers.length;
  const activeInfluencers = influencers.filter(i => i.status === 'active').length;
  const tikTokInfluencers = influencers.filter(i => i.platform === 'TikTok').length;
  const shopeeInfluencers = influencers.filter(i => i.platform === 'Shopee').length;
  const totalGmv = influencerStats.reduce((sum, s) => sum + s.totalGmv, 0);
  return (
    <div style={{ padding: '24px' }}>
      <h1 style={{ marginBottom: 24 }}>达人管理</h1>

      {/* 统计卡片 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={8}>
          <Card>
            <Statistic
              title="总达人数"
              value={totalInfluencers}
              prefix={<UserOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card>
            <Statistic
              title="活跃达人"
              value={activeInfluencers}
              prefix={<UserOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card>
            <Statistic
              title="总GMV"
              value={totalGmv}
              precision={2}
              prefix={<DollarOutlined />}
              suffix="SGD"
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
      </Row>

      <Card>
        <Space style={{ marginBottom: 16 }} wrap>
          <Input
            placeholder="搜索达人名称、账号或联系方式"
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
            添加达人
          </Button>
          <Button icon={<DownloadOutlined />} onClick={downloadInfluencerImportTemplate}>
            下载导入模板
          </Button>
          <Upload
            accept=".xlsx,.xls,.csv"
            beforeUpload={handleInfluencerImport}
            showUploadList={false}
          >
            <Button icon={<UploadOutlined />} loading={importing}>
              批量导入
            </Button>
          </Upload>
          <Button
            icon={<ReloadOutlined />}
            onClick={fetchInfluencers}
          >
            刷新
          </Button>
        </Space>

        <Table
          columns={columns}
          dataSource={filteredInfluencers}
          rowKey="id"
          loading={loading}
          pagination={{
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条记录`,
          }}
          scroll={{ x: 1800 }}
        />
      </Card>

      <Modal
        title={editingRecord ? '编辑达人' : '添加达人'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        width={700}
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
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
            </Col>
            <Col span={12}>
              <Form.Item
                name="name"
                label="达人名称"
                rules={[{ required: true, message: '请输入达人名称' }]}
              >
                <Input placeholder="请输入达人名称" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="account"
            label="达人账号"
            rules={[{ required: true, message: '请输入达人账号' }]}
          >
            <Input placeholder="请输入达人账号" />
          </Form.Item>

          <Form.Item name="agency" label="达人机构">
            <Input placeholder="请输入达人机构" />
          </Form.Item>

          <Form.Item name="single_session_data" label="达人单场数据">
            <Input placeholder="请输入达人单场数据，例如：GMV 5000，观看人数 1万" />
          </Form.Item>

          <Form.Item name="product_direction" label="达人选品方向">
            <Input placeholder="请输入达人选品方向，例如：服装、美妆、食品" />
          </Form.Item>

          <Form.Item
            name="commission_rate"
            label="达人佣金 (%)"
            rules={[{ required: true, message: '请输入达人佣金' }]}
          >
            <InputNumber
              min={0}
              max={100}
              precision={2}
              style={{ width: '100%' }}
              placeholder="请输入达人佣金，例如：10"
              onFocus={(event) => event.target.select()}
            />
          </Form.Item>

          <Form.Item name="contact" label="联系方式">
            <Input placeholder="请输入联系方式（手机/邮箱/微信）" />
          </Form.Item>

          <Form.Item name="sample_address" label="达人寄样地址">
            <TextArea
              rows={2}
              placeholder="请输入达人寄样地址"
            />
          </Form.Item>

          <Form.Item name="notes" label="其他备注">
            <TextArea
              rows={3}
              placeholder="请输入其他备注信息"
            />
          </Form.Item>

          <Form.Item name="status" label="状态" initialValue="active">
            <Select>
              <Option value="active">活跃</Option>
              <Option value="inactive">停用</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Influencers;
