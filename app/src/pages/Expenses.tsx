import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, Select, InputNumber, DatePicker, Space, message, Card, Row, Col, Tag, Popconfirm } from 'antd';
import { PlusOutlined, ReloadOutlined, DownloadOutlined, EditOutlined, DeleteOutlined, SettingOutlined } from '@ant-design/icons';
import { expenseApi, influencerApi, merchantApi } from '../api';
import DataImportExport from '../components/DataImportExport';
import dayjs from 'dayjs';

const { Option } = Select;
const { TextArea } = Input;
const { RangePicker } = DatePicker;

// 默认支出类型
const DEFAULT_EXPENSE_TYPES = [
  { value: 'marketing', label: '营销推广' },
  { value: 'operation', label: '运营费用' },
  { value: 'commission', label: '佣金支出' },
  { value: 'refund', label: '退款支出' },
  { value: 'other', label: '其他' },
];

const Expenses: React.FC = () => {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [influencers, setInfluencers] = useState<any[]>([]);
  const [merchants, setMerchants] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedInfluencerId, setSelectedInfluencerId] = useState<number | undefined>();
  const [filteredExpenses, setFilteredExpenses] = useState<any[]>([]);

  // 支出类型管理
  const [expenseTypes, setExpenseTypes] = useState<{ value: string; label: string }[]>(() => {
    const saved = localStorage.getItem('expenseTypes');
    return saved ? JSON.parse(saved) : DEFAULT_EXPENSE_TYPES;
  });
  const [typeSettingsVisible, setTypeSettingsVisible] = useState(false);
  const [editingType, setEditingType] = useState<{ index: number; value: string; label: string } | null>(null);

  const fetchInfluencers = async () => {
    try {
      const res = await influencerApi.getAll();
      const data = res.data.data;
      setInfluencers(Array.isArray(data) ? data : []);
    } catch (error) {
      message.error('获取达人列表失败');
      setInfluencers([]);
    }
  };

  const fetchMerchants = async () => {
    try {
      const res = await merchantApi.getAll();
      const data = res.data.data;
      setMerchants(Array.isArray(data) ? data : []);
    } catch (error) {
      message.error('获取商家列表失败');
      setMerchants([]);
    }
  };

  const fetchExpenses = async () => {
    setLoading(true);
    try {
      const res = await expenseApi.getAll();
      const data = res.data.data;
      const expensesData = Array.isArray(data) ? data : [];
      setExpenses(expensesData);
      applyFilters(expensesData);
    } catch (error) {
      message.error('获取支出列表失败');
      setExpenses([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInfluencers();
    fetchMerchants();
    fetchExpenses();
  }, []);

  // 应用筛选条件
  const applyFilters = (expenseList: any[] = expenses) => {
    let filtered = [...expenseList];

    // 时间筛选
    if (startDate) {
      filtered = filtered.filter(exp => exp.expense_date >= startDate);
    }
    if (endDate) {
      filtered = filtered.filter(exp => exp.expense_date <= endDate);
    }

    // 达人筛选
    if (selectedInfluencerId) {
      filtered = filtered.filter(exp => exp.related_influencer_id === selectedInfluencerId);
    }

    setFilteredExpenses(filtered);
  };

  // 处理时间筛选变化
  const handleDateChange = (dates: any) => {
    if (dates && dates[0] && dates[1]) {
      setStartDate(dates[0].format('YYYY-MM-DD'));
      setEndDate(dates[1].format('YYYY-MM-DD'));
    } else {
      setStartDate('');
      setEndDate('');
    }
    setTimeout(() => applyFilters(), 100);
  };

  // 处理达人筛选变化
  const handleInfluencerChange = (influencerId: number | undefined) => {
    setSelectedInfluencerId(influencerId);
    setTimeout(() => applyFilters(), 100);
  };

  // 重置筛选
  const handleReset = () => {
    setStartDate('');
    setEndDate('');
    setSelectedInfluencerId(undefined);
    setTimeout(() => applyFilters(), 100);
  };

  // 计算汇总数据
  const getSummaryData = () => {
    const totalExpense = filteredExpenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
    
    // 按类型汇总
    const byType = filteredExpenses.reduce((acc, exp) => {
      const type = exp.type || 'other';
      if (!acc[type]) {
        acc[type] = { amount: 0, count: 0 };
      }
      acc[type].amount += exp.amount || 0;
      acc[type].count += 1;
      return acc;
    }, {} as Record<string, { amount: number; count: number }>);

    // 按达人汇总
    const byInfluencer = filteredExpenses
      .filter(exp => exp.related_influencer_id)
      .reduce((acc, exp) => {
        const id = exp.related_influencer_id;
        if (!acc[id]) {
          acc[id] = { amount: 0, count: 0, name: exp.influencer_name || '未知达人' };
        }
        acc[id].amount += exp.amount || 0;
        acc[id].count += 1;
        return acc;
      }, {} as Record<number, { amount: number; count: number; name: string }>);

    return { totalExpense, byType, byInfluencer };
  };

  const summaryData = getSummaryData();

  // 保存支出类型到localStorage
  const saveExpenseTypes = (types: { value: string; label: string }[]) => {
    setExpenseTypes(types);
    localStorage.setItem('expenseTypes', JSON.stringify(types));
  };

  // 打开支出类型设置
  const openTypeSettings = () => {
    setEditingType(null);
    setTypeSettingsVisible(true);
  };

  // 添加支出类型
  const addExpenseType = () => {
    const newTypes = [...expenseTypes, { value: `custom_${Date.now()}`, label: '新类型' }];
    saveExpenseTypes(newTypes);
  };

  // 编辑支出类型
  const editExpenseType = (index: number, value: string, label: string) => {
    setEditingType({ index, value, label });
  };

  // 保存编辑
  const saveEdit = (index: number, newLabel: string) => {
    const newTypes = [...expenseTypes];
    newTypes[index].label = newLabel;
    saveExpenseTypes(newTypes);
    setEditingType(null);
  };

  // 取消编辑
  const cancelEdit = () => {
    setEditingType(null);
  };

  // 删除支出类型
  const deleteExpenseType = (index: number) => {
    const newTypes = expenseTypes.filter((_, i) => i !== index);
    saveExpenseTypes(newTypes);
  };

  const handleAdd = () => {
    form.resetFields();
    setModalVisible(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const expenseData = {
        ...values,
        expense_date: values.expense_date.format('YYYY-MM-DD'),
      };
      await expenseApi.create(expenseData);
      message.success('支出记录创建成功');
      setModalVisible(false);
      fetchExpenses();
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
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => {
        const typeObj = expenseTypes.find(t => t.value === type);
        return typeObj ? typeObj.label : type;
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
      title: '支出日期',
      dataIndex: 'expense_date',
      key: 'expense_date',
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
      title: '支付方式',
      dataIndex: 'payment_method',
      key: 'payment_method',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const statusMap: Record<string, { text: string; color: string }> = {
          paid: { text: '已支付', color: '#52c41a' },
          pending: { text: '待支付', color: '#faad14' },
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
  ];

  return (
    <div>
      {/* 筛选栏 */}
      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <span>筛选条件：</span>
          <RangePicker
            value={startDate && endDate ? [dayjs(startDate), dayjs(endDate)] : null}
            onChange={handleDateChange}
            placeholder={['开始日期', '结束日期']}
          />
          <Select
            style={{ width: 200 }}
            placeholder="选择达人"
            allowClear
            showSearch
            value={selectedInfluencerId}
            onChange={handleInfluencerChange}
            filterOption={(input, option: any) =>
              option?.children?.toLowerCase().includes(input.toLowerCase())
            }
          >
            {influencers.map((inf: any) => (
              <Option key={inf.id} value={inf.id}>
                {inf.name} ({inf.platform})
              </Option>
            ))}
          </Select>
          <Button icon={<ReloadOutlined />} onClick={() => fetchExpenses()}>
            刷新
          </Button>
          <Button icon={<DownloadOutlined />} onClick={handleReset}>
            重置筛选
          </Button>
        </Space>
      </Card>

      {/* 汇总统计 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12} md={8}>
          <Card>
            <div style={{ color: 'rgba(0,0,0,0.45)', fontSize: 14, marginBottom: 8 }}>
              总支出
            </div>
            <div style={{ fontSize: 24, fontWeight: 'bold', color: '#ff4d4f' }}>
              SGD {summaryData.totalExpense.toLocaleString()}
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8}>
          <Card>
            <div style={{ color: 'rgba(0,0,0,0.45)', fontSize: 14, marginBottom: 8 }}>
              支出笔数
            </div>
            <div style={{ fontSize: 24, fontWeight: 'bold', color: '#1890ff' }}>
              {filteredExpenses.length}
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8}>
          <Card>
            <div style={{ color: 'rgba(0,0,0,0.45)', fontSize: 14, marginBottom: 8 }}>
              涉及达人
            </div>
            <div style={{ fontSize: 24, fontWeight: 'bold', color: '#52c41a' }}>
              {Object.keys(summaryData.byInfluencer).length}
            </div>
          </Card>
        </Col>
      </Row>

      {/* 按类型汇总 */}
      <Card title="支出类型汇总" style={{ marginBottom: 16 }}>
        <Table
          columns={[
            { title: '支出类型', dataIndex: 'type', key: 'type', render: (type: string) => {
              const typeObj = expenseTypes.find(t => t.value === type);
              return typeObj ? typeObj.label : type;
            }},
            { title: '笔数', dataIndex: 'count', key: 'count', align: 'right' },
            { title: '金额', dataIndex: 'amount', key: 'amount', align: 'right', render: (value: number) => `SGD ${value?.toLocaleString() || 0}` },
            { title: '占比', key: 'ratio', align: 'right', render: (_, record: any) => summaryData.totalExpense > 0 ? `${((record.amount / summaryData.totalExpense) * 100).toFixed(1)}%` : '0%' }
          ]}
          dataSource={Object.entries(summaryData.byType).map(([type, data]: [string, any]) => ({
            type,
            ...data
          }))}
          rowKey="type"
          pagination={false}
          size="small"
          summary={(pageData) => {
            const totalAmount = pageData.reduce((sum, item) => sum + item.amount, 0);
            return (
              <Table.Summary fixed>
                <Table.Summary.Row>
                  <Table.Summary.Cell index={0}><strong>合计</strong></Table.Summary.Cell>
                  <Table.Summary.Cell index={1}><strong>{pageData.reduce((sum, item) => sum + item.count, 0)}</strong></Table.Summary.Cell>
                  <Table.Summary.Cell index={2}><strong>SGD {totalAmount.toLocaleString()}</strong></Table.Summary.Cell>
                  <Table.Summary.Cell index={3}><strong>100%</strong></Table.Summary.Cell>
                </Table.Summary.Row>
              </Table.Summary>
            );
          }}
        />
      </Card>

      {/* 按达人汇总 */}
      {Object.keys(summaryData.byInfluencer).length > 0 && (
        <Card title="达人支出汇总" style={{ marginBottom: 16 }}>
          <Table
            columns={[
              { title: '达人姓名', dataIndex: 'name', key: 'name' },
              { title: '笔数', dataIndex: 'count', key: 'count', align: 'right' },
              { title: '金额', dataIndex: 'amount', key: 'amount', align: 'right', render: (value: number) => `SGD ${value?.toLocaleString() || 0}` },
              { title: '占比', key: 'ratio', align: 'right', render: (_, record: any) => summaryData.totalExpense > 0 ? `${((record.amount / summaryData.totalExpense) * 100).toFixed(1)}%` : '0%' }
            ]}
            dataSource={Object.entries(summaryData.byInfluencer).map(([id, data]: [string, any]) => ({
              id,
              ...data
            }))}
            rowKey="id"
            pagination={false}
            size="small"
          />
        </Card>
      )}

      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 16, fontWeight: 500 }}>支出明细</div>
        <Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            添加支出
          </Button>
          <DataImportExport
            entityName="支出"
            templateColumns={[
              { key: 'type', label: '支出类型', required: true },
              { key: 'category', label: '支出分类', required: true },
              { key: 'amount', label: '金额', required: true },
              { key: 'currency', label: '币种' },
              { key: 'expense_date', label: '支出日期', required: true },
              { key: 'related_influencer_id', label: '关联达人ID' },
              { key: 'related_merchant_id', label: '关联商家ID' },
              { key: 'description', label: '描述' },
              { key: 'payment_method', label: '支付方式' },
              { key: 'status', label: '状态' },
              { key: 'receipt_no', label: '单据号' }
            ]}
            onImport={async (data) => {
              for (const item of data) {
                await expenseApi.create(item);
              }
              fetchExpenses();
            }}
            onExport={async () => {
              const res = await expenseApi.getAll();
              const data = res.data.data;
              return Array.isArray(data) ? data : [];
            }}
          />
        </Space>
      </div>
      <Table
        columns={columns}
        dataSource={filteredExpenses}
        rowKey="id"
        loading={loading}
        scroll={{ x: 1400 }}
        pagination={{ pageSize: 10 }}
      />

      <Modal
        title="添加支出"
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        width={700}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="type"
            label={
              <Space>
                支出类型
                <Button
                  type="link"
                  size="small"
                  icon={<SettingOutlined />}
                  onClick={openTypeSettings}
                  style={{ padding: 0 }}
                >
                  管理类型
                </Button>
              </Space>
            }
            rules={[{ required: true, message: '请选择支出类型' }]}
          >
            <Select placeholder="请选择支出类型">
              {expenseTypes.map((type) => (
                <Option key={type.value} value={type.value}>
                  {type.label}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="category"
            label="支出分类"
            rules={[{ required: true, message: '请输入支出分类' }]}
          >
            <Input placeholder="例如: 广告费、物流费等" />
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
            name="expense_date"
            label="支出日期"
            rules={[{ required: true, message: '请选择支出日期' }]}
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
            <TextArea rows={3} placeholder="请输入支出描述" />
          </Form.Item>
          <Form.Item name="payment_method" label="支付方式">
            <Select placeholder="请选择支付方式">
              <Option value="bank_transfer">银行转账</Option>
              <Option value="credit_card">信用卡</Option>
              <Option value="paypal">PayPal</Option>
              <Option value="cash">现金</Option>
              <Option value="other">其他</Option>
            </Select>
          </Form.Item>
          <Form.Item name="status" label="状态" initialValue="paid">
            <Select>
              <Option value="paid">已支付</Option>
              <Option value="pending">待支付</Option>
              <Option value="cancelled">已取消</Option>
            </Select>
          </Form.Item>
          <Form.Item name="receipt_no" label="单据号">
            <Input placeholder="请输入单据号" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 支出类型管理模态框 */}
      <Modal
        title="管理支出类型"
        open={typeSettingsVisible}
        onCancel={() => {
          setTypeSettingsVisible(false);
          setEditingType(null);
        }}
        footer={null}
        width={600}
      >
        <div style={{ marginBottom: 16 }}>
          <Button type="primary" icon={<PlusOutlined />} onClick={addExpenseType} block>
            添加新类型
          </Button>
        </div>
        <Space direction="vertical" style={{ width: '100%' }} size="small">
          {expenseTypes.map((type, index) => (
            <Card key={type.value} size="small" style={{ marginBottom: 0 }}>
              {editingType?.index === index ? (
                <Space style={{ width: '100%' }}>
                  <Input
                    defaultValue={editingType.label}
                    onPressEnter={(e) => saveEdit(index, (e.target as HTMLInputElement).value)}
                    onBlur={(e) => saveEdit(index, (e.target as HTMLInputElement).value)}
                    autoFocus
                    style={{ flex: 1 }}
                  />
                  <Button size="small" onClick={cancelEdit}>取消</Button>
                </Space>
              ) : (
                <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                  <Space>
                    <Tag color="blue">{type.label}</Tag>
                  </Space>
                  <Space>
                    <Button
                      type="text"
                      size="small"
                      icon={<EditOutlined />}
                      onClick={() => editExpenseType(index, type.value, type.label)}
                    >
                      编辑
                    </Button>
                    <Popconfirm
                      title="确定要删除这个类型吗？"
                      onConfirm={() => deleteExpenseType(index)}
                      okText="确定"
                      cancelText="取消"
                    >
                      <Button
                        type="text"
                        size="small"
                        danger
                        icon={<DeleteOutlined />}
                      >
                        删除
                      </Button>
                    </Popconfirm>
                  </Space>
                </Space>
              )}
            </Card>
          ))}
        </Space>
      </Modal>
    </div>
  );
};

export default Expenses;
