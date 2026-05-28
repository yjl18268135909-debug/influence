import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Table, DatePicker, Button, Space, Spin, message, Tabs, Modal, Form, Input, InputNumber, Upload, UploadFile } from 'antd';
import { ReloadOutlined, DownloadOutlined, PlusOutlined, UploadOutlined, FileExcelOutlined } from '@ant-design/icons';
import api from '../api';
import dayjs from 'dayjs';
import ReactECharts from 'echarts-for-react';
import * as XLSX from 'xlsx';

const { RangePicker } = DatePicker;

const IncomeManagement: React.FC = () => {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [incomeData, setIncomeData] = useState<any>({
    accommodationExpense: 0,
    storeSettlement: [],
    tapSettlement: 0,
    tapSettlementList: [],
    proxyPaymentSettlement: 0,
    otherIncome: [],
    totalIncome: 0,
  });

  const [storeModalVisible, setStoreModalVisible] = useState(false);
  const [storeForm] = Form.useForm();
  const [storeUploadLoading, setStoreUploadLoading] = useState(false);
  const [storeFileList, setStoreFileList] = useState<UploadFile[]>([]);

  const [otherIncomeModalVisible, setOtherIncomeModalVisible] = useState(false);
  const [otherIncomeForm] = Form.useForm();
  const [otherIncomeUploadLoading, setOtherIncomeUploadLoading] = useState(false);
  const [otherIncomeFileList, setOtherIncomeFileList] = useState<UploadFile[]>([]);

  const [tapModalVisible, setTapModalVisible] = useState(false);
  const [tapForm] = Form.useForm();
  const [tapUploadLoading, setTapUploadLoading] = useState(false);
  const [tapFileList, setTapFileList] = useState<UploadFile[]>([]);

  useEffect(() => {
    fetchIncomeData();
  }, []);

  const fetchIncomeData = async () => {
    setLoading(true);
    try {
      const ordersRes = await api.get('/orders');
      const ordersData = ordersRes.data.data || [];
      const settledOrders = Array.isArray(ordersData) ? ordersData.filter((order: any) => order.settlement_status === 'settled') : [];

      const tapOrders = settledOrders.filter((order: any) => order.influencer_id && order.influencer_id > 0);
      const tapSettlement = tapOrders.reduce((sum: number, order: any) => sum + (order.total_amount || 0), 0);

      const expensesRes = await api.get('/expenses');
      const expensesData = expensesRes.data.data || [];
      const tapIncomeRecords = Array.isArray(expensesData) ? expensesData.filter((expense: any) => expense.type === 'income' && expense.category === 'TAP后台回款') : [];

      const tapSettlementList = tapIncomeRecords.map((expense: any) => ({
        ...expense,
        amount: expense.amount || 0,
      }));

      const combinedTapIncome = tapOrders.map((order: any) => ({
        id: order.id,
        order_no: order.order_no,
        category: '订单回款',
        amount: order.total_amount || 0,
        description: `订单 ${order.order_no} 回款`,
        expense_date: order.order_date,
        merchant_name: order.merchant_name,
        influencer_name: order.influencer_name,
      })).concat(tapSettlementList);
      const totalTapIncome = combinedTapIncome.reduce((sum: number, item: any) => sum + item.amount, 0);

      const storeGrouped = settledOrders.reduce((acc: any, order: any) => {
        const key = order.merchant_name || '自营店铺';
        if (!acc[key]) {
          acc[key] = { merchant: key, totalAmount: 0, orderCount: 0 };
        }
        acc[key].totalAmount += order.total_amount || 0;
        acc[key].orderCount += 1;
        return acc;
      }, {});
      const storeSettlement = Object.values(storeGrouped);

      const otherIncomeRecords = Array.isArray(expensesData) ? expensesData.filter((expense: any) =>
        expense.type === 'income' &&
        expense.category !== '店铺回款' &&
        expense.category !== 'TAP后台回款'
      ) : [];

      const otherIncome = otherIncomeRecords.map((expense: any) => ({
        ...expense,
        category: expense.category || '其他',
        amount: expense.amount || 0,
      }));

      const accommodationExpense = 0;
      const proxyPaymentSettlement = 0;

      const storeTotal = storeSettlement.reduce((sum: number, item: any) => sum + item.totalAmount, 0);
      const otherIncomeTotal = otherIncome.reduce((sum: number, item: any) => sum + item.amount, 0);
      const totalIncome = storeTotal + totalTapIncome + proxyPaymentSettlement + accommodationExpense + otherIncomeTotal;

      setIncomeData({
        accommodationExpense,
        storeSettlement,
        tapSettlement: totalTapIncome,
        tapSettlementList: combinedTapIncome,
        proxyPaymentSettlement,
        otherIncome,
        totalIncome,
      });
    } catch (error) {
      console.error('获取收入数据失败:', error);
      message.error('获取收入数据失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDateChange = (dates: any) => {
    if (dates && dates[0] && dates[1]) {
      setStartDate(dates[0].format('YYYY-MM-DD'));
      setEndDate(dates[1].format('YYYY-MM-DD'));
    } else {
      setStartDate('');
      setEndDate('');
    }
    setTimeout(() => fetchIncomeData(), 100);
  };

  const handleReset = () => {
    setStartDate('');
    setEndDate('');
    setTimeout(() => fetchIncomeData(), 100);
  };

  const openStoreModal = () => {
    setStoreModalVisible(true);
    storeForm.resetFields();
  };

  const handleStoreSubmit = async () => {
    try {
      const values = await storeForm.validateFields();
      await api.post('/expenses', {
        category: '店铺回款',
        amount: values.amount,
        description: `${values.merchant}回款`,
        expense_date: values.expense_date || dayjs().format('YYYY-MM-DD'),
        type: 'income',
      });
      message.success('店铺回款添加成功');
      setStoreModalVisible(false);
      fetchIncomeData();
    } catch (error) {
      console.error('提交失败:', error);
      message.error('提交失败');
    }
  };

  const handleStoreUpload = async (file: File) => {
    setStoreUploadLoading(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(firstSheet) as any[];

      const expenses = jsonData.map((row: any) => ({
        category: '店铺回款',
        amount: parseFloat(row.amount) || 0,
        description: `${row.merchant}回款 - ${row.description || ''}`,
        expense_date: row.expense_date ? dayjs(row.expense_date).format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'),
        type: 'income',
      }));

      for (const expense of expenses) {
        await api.post('/expenses', expense);
      }

      message.success(`成功导入${expenses.length}条店铺回款记录`);
      fetchIncomeData();
      setStoreFileList([]);
      return false;
    } catch (error) {
      console.error('上传失败:', error);
      message.error('上传失败，请检查文件格式');
      return false;
    } finally {
      setStoreUploadLoading(false);
    }
  };

  const downloadStoreTemplate = () => {
    const template = [
      ['merchant', 'amount', 'expense_date', 'description'],
      ['示例店铺A', 1000, '2026-01-15', '回款说明'],
      ['示例店铺B', 2000, '2026-01-16', '回款说明'],
    ];
    const ws = XLSX.utils.aoa_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '店铺回款模板');
    XLSX.writeFile(wb, '店铺回款导入模板.xlsx');
  };

  const openOtherIncomeModal = () => {
    setOtherIncomeModalVisible(true);
    otherIncomeForm.resetFields();
  };

  const handleOtherIncomeSubmit = async () => {
    try {
      const values = await otherIncomeForm.validateFields();
      await api.post('/expenses', {
        category: values.category,
        amount: values.amount,
        description: values.description,
        expense_date: values.expense_date || dayjs().format('YYYY-MM-DD'),
        type: 'income',
      });
      message.success('其他收入添加成功');
      setOtherIncomeModalVisible(false);
      fetchIncomeData();
    } catch (error) {
      console.error('提交失败:', error);
      message.error('提交失败');
    }
  };

  const handleOtherIncomeUpload = async (file: File) => {
    setOtherIncomeUploadLoading(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(firstSheet) as any[];

      const expenses = jsonData.map((row: any) => ({
        category: row.category || '其他',
        amount: parseFloat(row.amount) || 0,
        description: row.description || '',
        expense_date: row.expense_date ? dayjs(row.expense_date).format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'),
        type: 'income',
      }));

      for (const expense of expenses) {
        await api.post('/expenses', expense);
      }

      message.success(`成功导入${expenses.length}条其他收入记录`);
      fetchIncomeData();
      setOtherIncomeFileList([]);
      return false;
    } catch (error) {
      console.error('上传失败:', error);
      message.error('上传失败，请检查文件格式');
      return false;
    } finally {
      setOtherIncomeUploadLoading(false);
    }
  };

  const downloadOtherIncomeTemplate = () => {
    const template = [
      ['category', 'amount', 'expense_date', 'description'],
      ['其他', 500, '2026-01-15', '收入说明'],
      ['其他', 300, '2026-01-16', '收入说明'],
    ];
    const ws = XLSX.utils.aoa_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '其他收入模板');
    XLSX.writeFile(wb, '其他收入导入模板.xlsx');
  };

  const openTapModal = () => {
    setTapModalVisible(true);
    tapForm.resetFields();
  };

  const handleTapSubmit = async () => {
    try {
      const values = await tapForm.validateFields();
      await api.post('/expenses', {
        category: 'TAP后台回款',
        amount: values.amount,
        description: values.description,
        expense_date: values.expense_date || dayjs().format('YYYY-MM-DD'),
        type: 'income',
      });
      message.success('TAP后台回款添加成功');
      setTapModalVisible(false);
      fetchIncomeData();
    } catch (error) {
      console.error('提交失败:', error);
      message.error('提交失败');
    }
  };

  const handleTapUpload = async (file: File) => {
    setTapUploadLoading(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(firstSheet) as any[];

      const expenses = jsonData.map((row: any) => ({
        category: 'TAP后台回款',
        amount: parseFloat(row.amount) || 0,
        description: row.description || '',
        expense_date: row.expense_date ? dayjs(row.expense_date).format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'),
        type: 'income',
      }));

      for (const expense of expenses) {
        await api.post('/expenses', expense);
      }

      message.success(`成功导入${expenses.length}条TAP后台回款记录`);
      fetchIncomeData();
      setTapFileList([]);
      return false;
    } catch (error) {
      console.error('上传失败:', error);
      message.error('上传失败，请检查文件格式');
      return false;
    } finally {
      setTapUploadLoading(false);
    }
  };

  const downloadTapTemplate = () => {
    const template = [
      ['amount', 'expense_date', 'description'],
      [1000, '2026-01-15', '回款说明'],
      [2000, '2026-01-16', '回款说明'],
    ];
    const ws = XLSX.utils.aoa_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'TAP后台回款模板');
    XLSX.writeFile(wb, 'TAP后台回款导入模板.xlsx');
  };

  const storeColumns = [
    {
      title: '店铺名称',
      dataIndex: 'merchant',
      key: 'merchant',
    },
    {
      title: '订单数量',
      dataIndex: 'orderCount',
      key: 'orderCount',
      align: 'right' as const,
    },
    {
      title: '回款金额',
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      align: 'right' as const,
      render: (value: number) => `SGD ${value?.toLocaleString() || 0}`,
    },
  ];

  const tapColumns = [
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
      render: (orderNo: string) => orderNo || '-',
    },
    {
      title: '类别',
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
      title: '说明',
      dataIndex: 'description',
      key: 'description',
    },
    {
      title: '日期',
      dataIndex: 'expense_date',
      key: 'expense_date',
      render: (date: string) => date ? dayjs(date).format('YYYY-MM-DD') : '-',
    },
    {
      title: '商家',
      dataIndex: 'merchant_name',
      key: 'merchant_name',
      render: (name: string) => name || '-',
    },
    {
      title: '达人',
      dataIndex: 'influencer_name',
      key: 'influencer_name',
      render: (name: string) => name || '-',
    },
  ];

  const otherIncomeColumns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
    },
    {
      title: '类别',
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
      title: '说明',
      dataIndex: 'description',
      key: 'description',
    },
    {
      title: '日期',
      dataIndex: 'expense_date',
      key: 'expense_date',
      render: (date: string) => date ? dayjs(date).format('YYYY-MM-DD') : '-',
    },
  ];

  const getTrendOption = () => {
    const months = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
    return {
      title: {
        text: '月度收入趋势',
        left: 'center',
      },
      tooltip: {
        trigger: 'axis',
      },
      legend: {
        data: ['TAP后台回款', '各店铺回款', '其他收入'],
        bottom: 0,
      },
      xAxis: {
        type: 'category',
        data: months,
      },
      yAxis: {
        type: 'value',
        name: '金额 (SGD)',
      },
      series: [
        {
          name: 'TAP后台回款',
          type: 'line',
          data: Array(12).fill(0),
          smooth: true,
          itemStyle: { color: '#1890ff' },
        },
        {
          name: '各店铺回款',
          type: 'line',
          data: Array(12).fill(0),
          smooth: true,
          itemStyle: { color: '#52c41a' },
        },
        {
          name: '其他收入',
          type: 'line',
          data: Array(12).fill(0),
          smooth: true,
          itemStyle: { color: '#faad14' },
        },
      ],
    };
  };

  const getStoreDistributionOption = () => ({
    title: {
      text: '各店铺回款分布',
      left: 'center',
    },
    tooltip: {
      trigger: 'item',
      formatter: '{a} <br/>{b}: SGD {c} ({d}%)',
    },
    legend: {
      orient: 'vertical',
      left: 'left',
    },
    series: [
      {
        name: '店铺回款',
        type: 'pie',
        radius: '60%',
        data: incomeData.storeSettlement.map((item: any) => ({
          value: item.totalAmount,
          name: item.merchant,
        })),
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0.5)',
          },
        },
      },
    ],
  });

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Space>
          <span>时间范围：</span>
          <RangePicker
            value={startDate && endDate ? [dayjs(startDate), dayjs(endDate)] : null}
            onChange={handleDateChange}
            placeholder={['开始日期', '结束日期']}
          />
          <Button icon={<ReloadOutlined />} onClick={fetchIncomeData}>
            刷新
          </Button>
          <Button icon={<DownloadOutlined />} onClick={handleReset}>
            重置筛选
          </Button>
        </Space>
      </Card>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
          <Spin size="large" />
        </div>
      ) : (
        <div>
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={24} sm={12} lg={6}>
              <Card>
                <div style={{ color: 'rgba(0,0,0,0.45)', fontSize: 14, marginBottom: 8 }}>
                  TAP后台回款收入
                </div>
                <div style={{ fontSize: 24, fontWeight: 'bold', color: '#1890ff' }}>
                  SGD {incomeData.tapSettlement.toLocaleString()}
                </div>
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card>
                <div style={{ color: 'rgba(0,0,0,0.45)', fontSize: 14, marginBottom: 8 }}>
                  各店铺回款收入
                </div>
                <div style={{ fontSize: 24, fontWeight: 'bold', color: '#52c41a' }}>
                  SGD {incomeData.storeSettlement.reduce((sum: number, item: any) => sum + item.totalAmount, 0).toLocaleString()}
                </div>
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card>
                <div style={{ color: 'rgba(0,0,0,0.45)', fontSize: 14, marginBottom: 8 }}>
                  代支付回款收入
                </div>
                <div style={{ fontSize: 24, fontWeight: 'bold', color: '#faad14' }}>
                  SGD {incomeData.proxyPaymentSettlement.toLocaleString()}
                </div>
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card>
                <div style={{ color: 'rgba(0,0,0,0.45)', fontSize: 14, marginBottom: 8 }}>
                  收入合计
                </div>
                <div style={{ fontSize: 24, fontWeight: 'bold', color: '#722ed1' }}>
                  SGD {incomeData.totalIncome.toLocaleString()}
                </div>
              </Card>
            </Col>
          </Row>

          <Tabs
            defaultActiveKey="store"
            items={[
              {
                key: 'store',
                label: '各店铺回款明细',
                children: (
                  <Card
                    extra={
                      <Space>
                        <Button type="primary" icon={<PlusOutlined />} onClick={openStoreModal}>
                          添加回款
                        </Button>
                        <Upload
                          fileList={storeFileList}
                          beforeUpload={handleStoreUpload}
                          onRemove={() => setStoreFileList([])}
                          accept=".xlsx,.xls"
                        >
                          <Button icon={<UploadOutlined />} loading={storeUploadLoading}>
                            批量上传
                          </Button>
                        </Upload>
                        <Button icon={<FileExcelOutlined />} onClick={downloadStoreTemplate}>
                          下载模板
                        </Button>
                      </Space>
                    }
                  >
                    <Table
                      columns={storeColumns}
                      dataSource={incomeData.storeSettlement}
                      rowKey="merchant"
                      pagination={{ pageSize: 10 }}
                      summary={(pageData) => {
                        const totalAmount = pageData.reduce((sum: number, item: any) => sum + item.totalAmount, 0);
                        return (
                          <Table.Summary fixed>
                            <Table.Summary.Row>
                              <Table.Summary.Cell index={0} colSpan={2}>
                                <strong>合计</strong>
                              </Table.Summary.Cell>
                              <Table.Summary.Cell index={2}>
                                <strong>SGD {totalAmount.toLocaleString()}</strong>
                              </Table.Summary.Cell>
                            </Table.Summary.Row>
                          </Table.Summary>
                        );
                      }}
                    />
                  </Card>
                ),
              },
              {
                key: 'tap',
                label: 'TAP后台回款明细',
                children: (
                  <Card
                    extra={
                      <Space>
                        <Button type="primary" icon={<PlusOutlined />} onClick={openTapModal}>
                          添加回款
                        </Button>
                        <Upload
                          fileList={tapFileList}
                          beforeUpload={handleTapUpload}
                          onRemove={() => setTapFileList([])}
                          accept=".xlsx,.xls"
                        >
                          <Button icon={<UploadOutlined />} loading={tapUploadLoading}>
                            批量上传
                          </Button>
                        </Upload>
                        <Button icon={<FileExcelOutlined />} onClick={downloadTapTemplate}>
                          下载模板
                        </Button>
                      </Space>
                    }
                  >
                    <Table
                      columns={tapColumns}
                      dataSource={incomeData.tapSettlementList}
                      rowKey="id"
                      pagination={{ pageSize: 10 }}
                      summary={(pageData) => {
                        const totalAmount = pageData.reduce((sum: number, item: any) => sum + (item.amount || 0), 0);
                        return (
                          <Table.Summary fixed>
                            <Table.Summary.Row>
                              <Table.Summary.Cell index={0} colSpan={4}>
                                <strong>合计</strong>
                              </Table.Summary.Cell>
                              <Table.Summary.Cell index={4}>
                                <strong>SGD {totalAmount.toLocaleString()}</strong>
                              </Table.Summary.Cell>
                              <Table.Summary.Cell index={5} colSpan={3} />
                            </Table.Summary.Row>
                          </Table.Summary>
                        );
                      }}
                    />
                  </Card>
                ),
              },
              {
                key: 'other',
                label: '其他收入明细',
                children: (
                  <Card
                    extra={
                      <Space>
                        <Button type="primary" icon={<PlusOutlined />} onClick={openOtherIncomeModal}>
                          添加收入
                        </Button>
                        <Upload
                          fileList={otherIncomeFileList}
                          beforeUpload={handleOtherIncomeUpload}
                          onRemove={() => setOtherIncomeFileList([])}
                          accept=".xlsx,.xls"
                        >
                          <Button icon={<UploadOutlined />} loading={otherIncomeUploadLoading}>
                            批量上传
                          </Button>
                        </Upload>
                        <Button icon={<FileExcelOutlined />} onClick={downloadOtherIncomeTemplate}>
                          下载模板
                        </Button>
                      </Space>
                    }
                  >
                    <Table
                      columns={otherIncomeColumns}
                      dataSource={incomeData.otherIncome}
                      rowKey="id"
                      pagination={{ pageSize: 10 }}
                      summary={(pageData) => {
                        const totalAmount = pageData.reduce((sum: number, item: any) => sum + (item.amount || 0), 0);
                        return (
                          <Table.Summary fixed>
                            <Table.Summary.Row>
                              <Table.Summary.Cell index={0} colSpan={3}>
                                <strong>合计</strong>
                              </Table.Summary.Cell>
                              <Table.Summary.Cell index={3}>
                                <strong>SGD {totalAmount.toLocaleString()}</strong>
                              </Table.Summary.Cell>
                              <Table.Summary.Cell index={4} />
                            </Table.Summary.Row>
                          </Table.Summary>
                        );
                      }}
                    />
                  </Card>
                ),
              },
              {
                key: 'chart',
                label: '收入分析图表',
                children: (
                  <Row gutter={[16, 16]}>
                    <Col xs={24} lg={12}>
                      <Card title="收入趋势">
                        <ReactECharts option={getTrendOption()} style={{ height: 300 }} />
                      </Card>
                    </Col>
                    <Col xs={24} lg={12}>
                      <Card title="店铺回款分布">
                        <ReactECharts option={getStoreDistributionOption()} style={{ height: 300 }} />
                      </Card>
                    </Col>
                  </Row>
                ),
              },
            ]}
          />
        </div>
      )}

      <Modal
        title="添加店铺回款"
        open={storeModalVisible}
        onOk={handleStoreSubmit}
        onCancel={() => setStoreModalVisible(false)}
        width={500}
      >
        <Form form={storeForm} layout="vertical">
          <Form.Item
            label="店铺名称"
            name="merchant"
            rules={[{ required: true, message: '请输入店铺名称' }]}
          >
            <Input placeholder="请输入店铺名称" />
          </Form.Item>
          <Form.Item
            label="回款金额 (SGD)"
            name="amount"
            rules={[{ required: true, message: '请输入回款金额' }]}
          >
            <InputNumber
              style={{ width: '100%' }}
              min={0}
              precision={2}
              placeholder="请输入回款金额"
              onFocus={(event) => event.target.select()}
            />
          </Form.Item>
          <Form.Item
            label="回款日期"
            name="expense_date"
            rules={[{ required: true, message: '请选择回款日期' }]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            label="说明"
            name="description"
          >
            <Input.TextArea rows={3} placeholder="请输入说明" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="添加其他收入"
        open={otherIncomeModalVisible}
        onOk={handleOtherIncomeSubmit}
        onCancel={() => setOtherIncomeModalVisible(false)}
        width={500}
      >
        <Form form={otherIncomeForm} layout="vertical">
          <Form.Item
            label="收入类别"
            name="category"
            rules={[{ required: true, message: '请输入收入类别' }]}
          >
            <Input placeholder="请输入收入类别" />
          </Form.Item>
          <Form.Item
            label="金额 (SGD)"
            name="amount"
            rules={[{ required: true, message: '请输入金额' }]}
          >
            <InputNumber
              style={{ width: '100%' }}
              min={0}
              precision={2}
              placeholder="请输入金额"
              onFocus={(event) => event.target.select()}
            />
          </Form.Item>
          <Form.Item
            label="日期"
            name="expense_date"
            rules={[{ required: true, message: '请选择日期' }]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            label="说明"
            name="description"
          >
            <Input.TextArea rows={3} placeholder="请输入说明" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="添加TAP后台回款"
        open={tapModalVisible}
        onOk={handleTapSubmit}
        onCancel={() => setTapModalVisible(false)}
        width={500}
      >
        <Form form={tapForm} layout="vertical">
          <Form.Item
            label="回款金额 (SGD)"
            name="amount"
            rules={[{ required: true, message: '请输入回款金额' }]}
          >
            <InputNumber
              style={{ width: '100%' }}
              min={0}
              precision={2}
              placeholder="请输入回款金额"
              onFocus={(event) => event.target.select()}
            />
          </Form.Item>
          <Form.Item
            label="回款日期"
            name="expense_date"
            rules={[{ required: true, message: '请选择回款日期' }]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            label="说明"
            name="description"
          >
            <Input.TextArea rows={3} placeholder="请输入说明" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default IncomeManagement;
