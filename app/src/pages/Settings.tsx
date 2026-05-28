import React, { useEffect, useState } from 'react';
import { Button, Form, Input, Modal, Popconfirm, Select, Space, Table, Tag, Typography, message } from 'antd';
import { DeleteOutlined, EditOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { accountApi } from '../api';

const { Title, Text } = Typography;

type Account = {
  id: number;
  username: string;
  name: string;
  role: string;
  status: string;
};

const roleOptions = [
  { label: '老板', value: '老板' },
  { label: '财务', value: '财务' },
  { label: '运营', value: '运营' },
];

const statusOptions = [
  { label: '启用', value: 'active' },
  { label: '停用', value: 'inactive' },
];

const roleColor: Record<string, string> = {
  老板: 'gold',
  财务: 'green',
  运营: 'blue',
};

const Settings: React.FC = () => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [form] = Form.useForm();

  const loadAccounts = async () => {
    setLoading(true);
    try {
      const response = await accountApi.getAll();
      setAccounts(response.data.data || []);
    } catch (error) {
      console.error(error);
      message.error('获取账号列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAccounts();
  }, []);

  const openCreateModal = () => {
    setEditingAccount(null);
    form.resetFields();
    form.setFieldsValue({ role: '运营', status: 'active', password: '123456' });
    setModalOpen(true);
  };

  const openEditModal = (account: Account) => {
    setEditingAccount(account);
    form.setFieldsValue({ ...account, password: '' });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();
    try {
      if (editingAccount) {
        await accountApi.update(editingAccount.id, values);
        message.success('账号已更新');
      } else {
        await accountApi.create(values);
        message.success('账号已新增');
      }
      setModalOpen(false);
      loadAccounts();
    } catch (error: any) {
      console.error(error);
      message.error(error.response?.data?.error || '保存账号失败');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await accountApi.delete(id);
      message.success('账号已删除');
      loadAccounts();
    } catch (error: any) {
      console.error(error);
      message.error(error.response?.data?.error || '删除账号失败');
    }
  };

  const columns: ColumnsType<Account> = [
    {
      title: '账号',
      dataIndex: 'username',
      width: 180,
    },
    {
      title: '姓名',
      dataIndex: 'name',
      width: 180,
    },
    {
      title: '权限',
      dataIndex: 'role',
      width: 140,
      render: (role) => <Tag color={roleColor[role] || 'default'}>{role}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 120,
      render: (status) => (
        <Tag color={status === 'active' ? 'success' : 'default'}>
          {status === 'active' ? '启用' : '停用'}
        </Tag>
      ),
    },
    {
      title: '操作',
      width: 180,
      render: (_, record) => (
        <Space>
          <Button type="link" icon={<EditOutlined />} onClick={() => openEditModal(record)}>
            编辑
          </Button>
          <Popconfirm title="确定删除这个账号吗？" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Space direction="vertical" size={24} style={{ width: '100%' }}>
      <div>
        <Title level={2} style={{ marginBottom: 8 }}>设置</Title>
        <Text type="secondary">账号配置、权限调整和登录状态管理</Text>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={4} style={{ margin: 0 }}>账号配置</Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadAccounts}>
            刷新
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
            新增账号
          </Button>
        </Space>
      </div>

      <Table
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={accounts}
        pagination={false}
      />

      <Modal
        title={editingAccount ? '编辑账号' : '新增账号'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSubmit}
        okText="保存"
        cancelText="取消"
        destroyOnClose
      >
        <Form form={form} layout="vertical" preserve={false}>
          <Form.Item
            label="登录账号"
            name="username"
            rules={[{ required: true, message: '请输入登录账号' }]}
          >
            <Input placeholder="例如 mia" />
          </Form.Item>
          <Form.Item
            label="显示姓名"
            name="name"
            rules={[{ required: true, message: '请输入显示姓名' }]}
          >
            <Input placeholder="例如 Mia" />
          </Form.Item>
          <Form.Item
            label={editingAccount ? '密码（留空则不修改）' : '密码'}
            name="password"
            rules={editingAccount ? [] : [{ required: true, message: '请输入密码' }]}
          >
            <Input.Password placeholder={editingAccount ? '不修改密码可留空' : '默认可填 123456'} />
          </Form.Item>
          <Form.Item
            label="权限角色"
            name="role"
            rules={[{ required: true, message: '请选择权限角色' }]}
          >
            <Select options={roleOptions} />
          </Form.Item>
          <Form.Item
            label="账号状态"
            name="status"
            rules={[{ required: true, message: '请选择账号状态' }]}
          >
            <Select options={statusOptions} />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
};

export default Settings;
