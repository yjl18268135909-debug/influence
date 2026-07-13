import React, { useEffect, useMemo, useState } from 'react';
import { Button, Col, DatePicker, Form, Input, Modal, Popconfirm, Row, Select, Space, Table, Tag, Tooltip, message } from 'antd';
import { DeleteOutlined, EditOutlined, LinkOutlined, PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { workProgressApi } from '../api';
import { defaultEmployees, EMPLOYEES_STORAGE_KEY } from '../data/employees';

const { RangePicker } = DatePicker;
const { TextArea } = Input;

type WorkProgressItem = {
  id: number;
  fill_time: string;
  required_finish_time?: string | null;
  urgency: string;
  urgency_note?: string | null;
  requester?: string | null;
  executor_role?: string | null;
  requirement: string;
  executor_ack: string;
  is_done: string;
  finished_at?: string | null;
  completion_link?: string | null;
  notes?: string | null;
};

type Employee = {
  id: string;
  name: string;
  role?: string;
  status?: string;
};

type EditableField = keyof Pick<
  WorkProgressItem,
  | 'fill_time'
  | 'required_finish_time'
  | 'urgency'
  | 'requester'
  | 'executor_role'
  | 'requirement'
  | 'executor_ack'
  | 'is_done'
  | 'finished_at'
  | 'completion_link'
  | 'notes'
>;

const urgencyOptions = ['不急', '需要', '加急'];
const yesNoOptions = ['是', '否'];

const urgencyColor: Record<string, string> = {
  不急: 'default',
  需要: 'blue',
  加急: 'red',
};

const statusColor: Record<string, string> = {
  是: 'green',
  否: 'orange',
};

const formatDateTime = (value?: string | null) => {
  if (!value) return '-';
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format('YYYY-MM-DD HH:mm') : value;
};

const normalizeDateValue = (value: any) => {
  if (!value) return null;
  return dayjs(value).format('YYYY-MM-DD HH:mm:ss');
};

const readEmployees = (): Employee[] => {
  try {
    const saved = localStorage.getItem(EMPLOYEES_STORAGE_KEY);
    return saved ? JSON.parse(saved) : defaultEmployees;
  } catch {
    return defaultEmployees;
  }
};

const WorkProgress: React.FC = () => {
  const [items, setItems] = useState<WorkProgressItem[]>([]);
  const [employees, setEmployees] = useState<Employee[]>(() => readEmployees());
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState<WorkProgressItem | null>(null);
  const [editingCell, setEditingCell] = useState<{ id: number; field: EditableField } | null>(null);
  const [draftValue, setDraftValue] = useState<any>(null);
  const [savingCell, setSavingCell] = useState<string | null>(null);
  const [filters, setFilters] = useState<any>({});
  const [form] = Form.useForm();

  const activeEmployees = useMemo(() => {
    return employees.filter((item) => item.status !== 'inactive');
  }, [employees]);

  const employeeOptions = useMemo(() => {
    return activeEmployees.map((item) => ({
      label: item.role ? `${item.name}（${item.role}）` : item.name,
      value: item.name,
    }));
  }, [activeEmployees]);

  const requesterOptions = useMemo(() => {
    const names = [
      ...activeEmployees.map((item) => item.name),
      ...items.map((item) => item.requester).filter(Boolean),
    ] as string[];
    return Array.from(new Set(names)).map((value) => {
      const employee = activeEmployees.find((item) => item.name === value);
      return { label: employee?.role ? `${value}（${employee.role}）` : value, value };
    });
  }, [activeEmployees, items]);

  const executorOptions = useMemo(() => {
    const names = [
      ...activeEmployees.map((item) => item.name),
      ...items.map((item) => item.executor_role).filter(Boolean),
    ] as string[];
    return Array.from(new Set(names)).map((value) => {
      const employee = activeEmployees.find((item) => item.name === value);
      return { label: employee?.role ? `${value}（${employee.role}）` : value, value };
    });
  }, [activeEmployees, items]);

  const fetchItems = async (nextFilters = filters) => {
    setLoading(true);
    try {
      const params: any = {};
      Object.entries(nextFilters).forEach(([key, value]) => {
        if (value && value !== 'all') params[key] = value;
      });
      const response = await workProgressApi.getAll(params);
      setItems(Array.isArray(response.data.data) ? response.data.data : []);
    } catch (error: any) {
      console.error('获取工作推进失败:', error);
      message.error(error?.response?.data?.error || '获取工作推进失败');
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems({});
    setEmployees(readEmployees());
  }, []);

  const openAddModal = () => {
    setEditingRecord(null);
    form.resetFields();
    form.setFieldsValue({
      fill_time: dayjs(),
      urgency: '需要',
    });
    setModalVisible(true);
  };

  const openEditModal = (record: WorkProgressItem) => {
    setEditingRecord(record);
    form.setFieldsValue({
      ...record,
      fill_time: record.fill_time ? dayjs(record.fill_time) : dayjs(),
      required_finish_time: record.required_finish_time ? dayjs(record.required_finish_time) : null,
      finished_at: record.finished_at ? dayjs(record.finished_at) : null,
    });
    setModalVisible(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const payload = {
        ...values,
        fill_time: normalizeDateValue(values.fill_time),
        required_finish_time: normalizeDateValue(values.required_finish_time),
        finished_at: normalizeDateValue(values.finished_at),
      };

      if (editingRecord) {
        await workProgressApi.update(editingRecord.id, payload);
        message.success('更新成功');
      } else {
        await workProgressApi.create(payload);
        message.success('新增成功');
      }
      setModalVisible(false);
      fetchItems();
    } catch (error: any) {
      if (error?.errorFields) return;
      console.error('保存工作推进失败:', error);
      message.error(error?.response?.data?.error || '保存失败');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await workProgressApi.delete(id);
      message.success('删除成功');
      fetchItems();
    } catch (error: any) {
      console.error('删除工作推进失败:', error);
      message.error(error?.response?.data?.error || '删除失败');
    }
  };

  const updateFilters = (patch: any) => {
    const next = { ...filters, ...patch };
    setFilters(next);
    fetchItems(next);
  };

  const clearFilters = () => {
    setFilters({});
    fetchItems({});
  };

  const getCellKey = (record: WorkProgressItem, field: EditableField) => `${record.id}:${field}`;

  const startCellEdit = (record: WorkProgressItem, field: EditableField) => {
    setEditingCell({ id: record.id, field });
    setDraftValue(record[field] ?? null);
  };

  const cancelCellEdit = () => {
    setEditingCell(null);
    setDraftValue(null);
  };

  const normalizeCellValue = (field: EditableField, value: any) => {
    if (['fill_time', 'required_finish_time', 'finished_at'].includes(field)) {
      return normalizeDateValue(value);
    }
    if (value === undefined) return null;
    return value;
  };

  const saveCellEdit = async (record: WorkProgressItem, field: EditableField, value = draftValue) => {
    const normalizedValue = normalizeCellValue(field, value);
    if (field === 'requirement' && !String(normalizedValue || '').trim()) {
      message.warning('具体需求不能为空');
      return;
    }
    if (field === 'fill_time' && !normalizedValue) {
      message.warning('填写时间不能为空');
      return;
    }

    const cellKey = getCellKey(record, field);
    setSavingCell(cellKey);
    try {
      const payload = {
        ...record,
        [field]: normalizedValue,
        fill_time: field === 'fill_time' ? normalizedValue : record.fill_time,
        requirement: field === 'requirement' ? normalizedValue : record.requirement,
      };
      const response = await workProgressApi.update(record.id, payload);
      const updated = response.data?.data || payload;
      setItems((prev) => prev.map((item) => (item.id === record.id ? { ...item, ...updated } : item)));
      cancelCellEdit();
      message.success('已保存');
    } catch (error: any) {
      console.error('单元格保存失败:', error);
      message.error(error?.response?.data?.error || '保存失败');
    } finally {
      setSavingCell(null);
    }
  };

  const renderEditableCell = (
    record: WorkProgressItem,
    field: EditableField,
    display: React.ReactNode,
    editor: React.ReactNode,
  ) => {
    const active = editingCell?.id === record.id && editingCell.field === field;
    if (active) {
      return (
        <div onClick={(event) => event.stopPropagation()}>
          {editor}
        </div>
      );
    }
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={() => startCellEdit(record, field)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') startCellEdit(record, field);
        }}
        style={{
          minHeight: 32,
          cursor: 'pointer',
          padding: '4px 0',
        }}
        title="点击修改"
      >
        {display}
      </div>
    );
  };

  const renderTextEditor = (record: WorkProgressItem, field: EditableField, multiline = false) => {
    const commonProps = {
      autoFocus: true,
      value: draftValue ?? '',
      disabled: savingCell === getCellKey(record, field),
      onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDraftValue(event.target.value),
      onBlur: () => saveCellEdit(record, field),
      onPressEnter: (event: any) => {
        if (!multiline) {
          event.preventDefault();
          saveCellEdit(record, field);
        }
      },
    };
    return multiline ? <TextArea {...commonProps} autoSize={{ minRows: 2, maxRows: 5 }} /> : <Input {...commonProps} />;
  };

  const renderSelectEditor = (
    record: WorkProgressItem,
    field: EditableField,
    options: { label: React.ReactNode; value: string }[],
  ) => (
    <Select
      autoFocus
      open
      allowClear
      showSearch
      optionFilterProp="label"
      style={{ minWidth: 120, width: '100%' }}
      value={draftValue || undefined}
      options={options}
      disabled={savingCell === getCellKey(record, field)}
      onChange={(value) => saveCellEdit(record, field, value || null)}
      onBlur={() => cancelCellEdit()}
    />
  );

  const renderDateEditor = (record: WorkProgressItem, field: EditableField) => (
    <DatePicker
      autoFocus
      open
      showTime
      style={{ width: '100%' }}
      value={draftValue ? dayjs(draftValue) : null}
      disabled={savingCell === getCellKey(record, field)}
      onChange={(value) => saveCellEdit(record, field, value)}
      onOpenChange={(open) => {
        if (!open) cancelCellEdit();
      }}
    />
  );

  const columns: ColumnsType<WorkProgressItem> = [
    {
      title: '填写时间',
      dataIndex: 'fill_time',
      width: 150,
      fixed: 'left',
      sorter: (a, b) => dayjs(a.fill_time).valueOf() - dayjs(b.fill_time).valueOf(),
      render: (_, record) => renderEditableCell(record, 'fill_time', formatDateTime(record.fill_time), renderDateEditor(record, 'fill_time')),
    },
    {
      title: '要求完成时间',
      dataIndex: 'required_finish_time',
      width: 160,
      sorter: (a, b) => dayjs(a.required_finish_time || 0).valueOf() - dayjs(b.required_finish_time || 0).valueOf(),
      render: (_, record) => renderEditableCell(record, 'required_finish_time', formatDateTime(record.required_finish_time), renderDateEditor(record, 'required_finish_time')),
    },
    {
      title: '紧急程度',
      dataIndex: 'urgency',
      width: 120,
      render: (value: string, record) => renderEditableCell(
        record,
        'urgency',
        <Space size={4}>
          <Tag color={urgencyColor[value] || 'default'}>{value || '需要'}</Tag>
          {record.urgency_note ? <Tooltip title={record.urgency_note}><span style={{ color: '#999' }}>注</span></Tooltip> : null}
        </Space>,
        renderSelectEditor(record, 'urgency', urgencyOptions.map((option) => ({ label: option, value: option }))),
      ),
    },
    {
      title: '需求人',
      dataIndex: 'requester',
      width: 120,
      render: (value, record) => renderEditableCell(
        record,
        'requester',
        value || '-',
        renderSelectEditor(record, 'requester', requesterOptions),
      ),
    },
    {
      title: '执行岗位人',
      dataIndex: 'executor_role',
      width: 140,
      render: (value, record) => renderEditableCell(
        record,
        'executor_role',
        value || '-',
        renderSelectEditor(record, 'executor_role', executorOptions),
      ),
    },
    {
      title: '具体需求',
      dataIndex: 'requirement',
      width: 320,
      ellipsis: true,
      render: (value: string, record) => renderEditableCell(
        record,
        'requirement',
        <Tooltip title={value}>{value}</Tooltip>,
        renderTextEditor(record, 'requirement', true),
      ),
    },
    {
      title: '执行人知否',
      dataIndex: 'executor_ack',
      width: 120,
      render: (value: string, record) => renderEditableCell(
        record,
        'executor_ack',
        <Tag color={statusColor[value] || 'default'}>{value || '否'}</Tag>,
        renderSelectEditor(record, 'executor_ack', yesNoOptions.map((option) => ({ label: option, value: option }))),
      ),
    },
    {
      title: '是否完毕',
      dataIndex: 'is_done',
      width: 120,
      render: (value: string, record) => renderEditableCell(
        record,
        'is_done',
        <Tag color={statusColor[value] || 'default'}>{value || '否'}</Tag>,
        renderSelectEditor(record, 'is_done', yesNoOptions.map((option) => ({ label: option, value: option }))),
      ),
    },
    {
      title: '完成时间',
      dataIndex: 'finished_at',
      width: 150,
      render: (_, record) => renderEditableCell(record, 'finished_at', formatDateTime(record.finished_at), renderDateEditor(record, 'finished_at')),
    },
    {
      title: '完成链接',
      dataIndex: 'completion_link',
      width: 120,
      render: (value: string | undefined, record) => renderEditableCell(
        record,
        'completion_link',
        value ? (
          <Button type="link" icon={<LinkOutlined />} href={value} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>
            打开
          </Button>
        ) : '-',
        renderTextEditor(record, 'completion_link'),
      ),
    },
    {
      title: '备注',
      dataIndex: 'notes',
      width: 260,
      ellipsis: true,
      render: (value: string | undefined, record) => renderEditableCell(
        record,
        'notes',
        value ? <Tooltip title={value}>{value}</Tooltip> : '-',
        renderTextEditor(record, 'notes', true),
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 150,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button type="link" icon={<EditOutlined />} onClick={() => openEditModal(record)}>编辑</Button>
          <Popconfirm title="确认删除这条工作推进记录？" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <h1 style={{ marginBottom: 24 }}>工作推进</h1>

      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Row gutter={[12, 12]} align="middle">
          <Col xs={24} md={7}>
            <Input
              allowClear
              prefix={<SearchOutlined />}
              placeholder="搜索需求、需求人、执行岗位或备注"
              value={filters.keyword}
              onChange={(event) => updateFilters({ keyword: event.target.value })}
            />
          </Col>
          <Col xs={24} md={5}>
            <RangePicker
              style={{ width: '100%' }}
              value={filters.startDate && filters.endDate ? [dayjs(filters.startDate), dayjs(filters.endDate)] : null}
              onChange={(value) => updateFilters({
                startDate: value?.[0]?.format('YYYY-MM-DD'),
                endDate: value?.[1]?.format('YYYY-MM-DD'),
              })}
            />
          </Col>
          <Col xs={12} md={3}>
            <Select
              allowClear
              placeholder="紧急程度"
              style={{ width: '100%' }}
              value={filters.urgency}
              onChange={(value) => updateFilters({ urgency: value })}
              options={urgencyOptions.map((value) => ({ label: value, value }))}
            />
          </Col>
          <Col xs={12} md={3}>
            <Select
              allowClear
              placeholder="是否知晓"
              style={{ width: '100%' }}
              value={filters.executor_ack}
              onChange={(value) => updateFilters({ executor_ack: value })}
              options={yesNoOptions.map((value) => ({ label: value, value }))}
            />
          </Col>
          <Col xs={12} md={3}>
            <Select
              allowClear
              placeholder="是否完毕"
              style={{ width: '100%' }}
              value={filters.is_done}
              onChange={(value) => updateFilters({ is_done: value })}
              options={yesNoOptions.map((value) => ({ label: value, value }))}
            />
          </Col>
          <Col xs={12} md={3}>
            <Button onClick={clearFilters} style={{ width: '100%' }}>清除筛选</Button>
          </Col>
        </Row>

        <Row gutter={[12, 12]} align="middle">
          <Col xs={24} md={5}>
            <Select
              allowClear
              showSearch
              placeholder="按需求人筛选"
              style={{ width: '100%' }}
              value={filters.requester}
              onChange={(value) => updateFilters({ requester: value })}
              options={requesterOptions}
            />
          </Col>
          <Col xs={24} md={5}>
            <Select
              allowClear
              showSearch
              placeholder="按执行岗位人筛选"
              style={{ width: '100%' }}
              value={filters.executor_role}
              onChange={(value) => updateFilters({ executor_role: value })}
              options={executorOptions}
            />
          </Col>
          <Col flex="auto">
            <Space>
              <Button type="primary" icon={<PlusOutlined />} onClick={openAddModal}>新增工作推进</Button>
              <Button icon={<ReloadOutlined />} onClick={() => fetchItems()}>刷新</Button>
            </Space>
          </Col>
        </Row>

        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={items}
          scroll={{ x: 1900 }}
          pagination={{ pageSize: 10, showTotal: (total) => `共 ${total} 条记录` }}
        />
      </Space>

      <Modal
        title={editingRecord ? '编辑工作推进' : '新增工作推进'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={handleSubmit}
        okText="保存"
        cancelText="取消"
        width={860}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item name="fill_time" label="填写时间" rules={[{ required: true, message: '请选择填写时间' }]}>
                <DatePicker showTime style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="required_finish_time" label="要求完成时间">
                <DatePicker showTime style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                name="urgency"
                label="紧急程度"
                tooltip="可按完成时间、业务影响或需求方优先级判断"
                rules={[{ required: true, message: '请选择紧急程度' }]}
              >
                <Select options={urgencyOptions.map((value) => ({ label: value, value }))} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="urgency_note" label="紧急程度备注">
                <Input placeholder="例如：按上线时间加急 / 只是提醒跟进" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item name="requester" label="需求人">
                <Select
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  placeholder="选择需求提出人"
                  options={employeeOptions}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="executor_role" label="执行岗位人">
                <Select
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  placeholder="选择负责岗位或执行人"
                  options={employeeOptions}
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="requirement" label="具体需求" rules={[{ required: true, message: '请填写具体需求' }]}>
            <Input.TextArea rows={4} placeholder="填写要推进的具体事项" />
          </Form.Item>

          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Form.Item name="executor_ack" label="执行人知否">
                <Select allowClear options={yesNoOptions.map((value) => ({ label: value, value }))} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="is_done" label="是否完毕">
                <Select allowClear options={yesNoOptions.map((value) => ({ label: value, value }))} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="finished_at" label="完成时间">
                <DatePicker showTime style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="completion_link" label="完成的超链接">
            <Input placeholder="可填系统内工作表或外部表格链接，没有也可以不填" />
          </Form.Item>

          <Form.Item name="notes" label="备注">
            <Input.TextArea rows={3} placeholder="执行人完成前疑问、需求、卡点、未完成情况等" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default WorkProgress;
