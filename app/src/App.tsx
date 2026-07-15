import React, { Suspense, lazy, useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { Button, Card, Form, Input, Layout, Menu, Space, Spin, Typography, message, theme } from 'antd';
import {
  UserOutlined,
  ShopOutlined,
  CalendarOutlined,
  MessageOutlined,
  WalletOutlined,
  TeamOutlined,
  LockOutlined,
  LogoutOutlined,
  SettingOutlined,
  ProjectOutlined,
  DashboardOutlined,
} from '@ant-design/icons';
import { accountApi } from './api';

const { Header, Content, Sider } = Layout;
const { Title, Text } = Typography;

const AUTH_STORAGE_KEY = 'shopfluence_current_user';

const DataDashboard = lazy(() => import('./pages/DataDashboard'));
const Influencers = lazy(() => import('./pages/Influencers'));
const Merchants = lazy(() => import('./pages/Merchants'));
const MerchantIntroduction = lazy(() => import('./pages/MerchantIntroduction'));
const LiveSessions = lazy(() => import('./pages/LiveSessions'));
const WorkProgress = lazy(() => import('./pages/WorkProgress'));
const FinanceManagement = lazy(() => import('./pages/FinanceManagement'));
const EmployeeManagement = lazy(() => import('./pages/EmployeeManagement'));
const Settings = lazy(() => import('./pages/Settings'));

const PageFallback = () => (
  <div style={{ minHeight: 280, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <Spin />
  </div>
);

type CurrentUser = {
  username: string;
  name: string;
  role: string;
};

type MenuItem = {
  key: string;
  icon: React.ReactNode;
  label: string;
  financeOnly?: boolean;
  ownerOnly?: boolean;
};

const menuItems: MenuItem[] = [
  { key: '/data-dashboard', icon: <DashboardOutlined />, label: '数据看板' },
  { key: '/schedule-communication', icon: <MessageOutlined />, label: '达人排期沟通' },
  { key: '/live-sessions', icon: <CalendarOutlined />, label: '直播场次管理' },
  { key: '/travel-costs', icon: <WalletOutlined />, label: '达人机酒管理', financeOnly: true },
  { key: '/travel-receivables', icon: <WalletOutlined />, label: '应收款项', financeOnly: true },
  { key: '/travel-payables', icon: <WalletOutlined />, label: '应付管理', financeOnly: true },
  { key: '/influencers', icon: <UserOutlined />, label: '达人管理' },
  { key: '/merchants', icon: <ShopOutlined />, label: '商家管理' },
  { key: '/employees', icon: <TeamOutlined />, label: '员工管理' },
  { key: '/work-progress', icon: <ProjectOutlined />, label: '工作推进' },
  { key: '/finance', icon: <WalletOutlined />, label: '财务管理', financeOnly: true },
  { key: '/settings', icon: <SettingOutlined />, label: '设置', ownerOnly: true },
];

const readStorage = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const canViewFinance = (user: CurrentUser | null) => {
  return user ? ['老板', '财务'].includes(user.role) : false;
};

const canManageAccounts = (user: CurrentUser | null) => {
  return user?.role === '老板';
};

const LoginScreen: React.FC<{ onLogin: (user: CurrentUser) => void }> = ({ onLogin }) => {
  const [loading, setLoading] = useState(false);

  const handleLogin = async (values: { username: string; password: string }) => {
    setLoading(true);
    try {
      const response = await accountApi.login({
        username: values.username.trim(),
        password: values.password,
      });
      const account = response.data.data;
      const currentUser = { username: account.username, name: account.name, role: account.role };
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(currentUser));
      onLogin(currentUser);
      message.success(`已登录：${account.name}`);
    } catch (error: any) {
      message.error(error.response?.data?.error || '账号或密码不正确');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#f5f7fb',
      padding: 24,
    }}>
      <Card style={{ width: 420, borderRadius: 8 }}>
        <Space direction="vertical" size={8} style={{ width: '100%', marginBottom: 24 }}>
          <Title level={3} style={{ margin: 0 }}>ShopFluence 登录</Title>
        </Space>
        <Form layout="vertical" onFinish={handleLogin}>
          <Form.Item
            label="账号"
            name="username"
            rules={[{ required: true, message: '请输入账号' }]}
          >
            <Input prefix={<UserOutlined />} autoFocus />
          </Form.Item>
          <Form.Item
            label="密码"
            name="password"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="默认密码 123456" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={loading}>
            登录
          </Button>
        </Form>
      </Card>
    </div>
  );
};

const AppContent: React.FC<{ currentUser: CurrentUser; onLogout: () => void }> = ({ currentUser, onLogout }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [selectedKey, setSelectedKey] = useState('/');
  const navigate = useNavigate();
  const location = useLocation();
  const visibleMenuItems = menuItems.filter((item) => {
    if (item.ownerOnly) return canManageAccounts(currentUser);
    if (item.financeOnly) return canViewFinance(currentUser);
    return true;
  });
  const defaultRoute = visibleMenuItems[0]?.key || '/schedule-communication';
  const restrictedFinanceRoutes = ['/finance', '/travel-costs', '/travel-receivables', '/travel-payables'];
  const ownerOnlyRoutes = ['/settings'];

  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  useEffect(() => {
    if (!canViewFinance(currentUser) && restrictedFinanceRoutes.includes(location.pathname)) {
      navigate(defaultRoute, { replace: true });
      return;
    }

    if (!canManageAccounts(currentUser) && ownerOnlyRoutes.includes(location.pathname)) {
      navigate(defaultRoute, { replace: true });
      return;
    }

    if (location.pathname.startsWith('/merchants/')) {
      setSelectedKey('/merchants');
      return;
    }
    setSelectedKey(location.pathname === '/' ? defaultRoute : location.pathname);
  }, [location.pathname, currentUser.role, defaultRoute, navigate]);

  useEffect(() => {
    const isNumberInput = (target: EventTarget | null): target is HTMLInputElement => {
      return target instanceof HTMLInputElement && target.classList.contains('ant-input-number-input');
    };

    const selectValue = (input: HTMLInputElement) => {
      requestAnimationFrame(() => input.select());
    };

    const handleFocusIn = (event: FocusEvent) => {
      if (!isNumberInput(event.target)) return;
      event.target.dataset.selectOnMouseUp = 'true';
      selectValue(event.target);
    };

    const handleMouseUp = (event: MouseEvent) => {
      if (!isNumberInput(event.target) || event.target.dataset.selectOnMouseUp !== 'true') return;
      event.preventDefault();
      delete event.target.dataset.selectOnMouseUp;
      selectValue(event.target);
    };

    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('mouseup', handleMouseUp, true);

    return () => {
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('mouseup', handleMouseUp, true);
    };
  }, []);

  const handleMenuClick = ({ key }: { key: string }) => {
    navigate(key);
    setSelectedKey(key);
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider collapsible collapsed={collapsed} onCollapse={setCollapsed}>
        <div style={{
          height: 32,
          margin: 16,
          background: 'rgba(255, 255, 255, 0.2)',
          borderRadius: 6,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontWeight: 'bold',
          fontSize: collapsed ? '12px' : '16px'
        }}>
          {collapsed ? 'ShopFluence' : 'ShopFluence直播管理'}
        </div>
        <Menu
          theme="dark"
          selectedKeys={[selectedKey]}
          mode="inline"
          items={visibleMenuItems}
          onClick={handleMenuClick}
        />
      </Sider>
      <Layout>
        <Header style={{ padding: 0, background: colorBgContainer }}>
          <div style={{
            padding: '0 24px',
            fontSize: '18px',
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            height: '100%'
          }}>
            <span>ShopFluence达人直播管理系统</span>
            <Space size={12}>
              <Text type="secondary">
                {currentUser.name}
              </Text>
              <Button size="small" icon={<LogoutOutlined />} onClick={onLogout}>
                退出
              </Button>
            </Space>
          </div>
        </Header>
        <Content style={{ margin: '16px' }}>
          <div
            style={{
              padding: 24,
              minHeight: 360,
              background: colorBgContainer,
              borderRadius: borderRadiusLG,
            }}
          >
            <Suspense fallback={<PageFallback />}>
              <Routes>
                <Route path="/" element={<Navigate to={defaultRoute} replace />} />
                <Route path="/data-dashboard" element={<DataDashboard />} />
                <Route path="/influencers" element={<Influencers />} />
                <Route path="/merchants" element={<Merchants />} />
                <Route path="/merchants/:id/introduction" element={<MerchantIntroduction />} />
                <Route path="/live-sessions" element={<LiveSessions key="live-sessions" />} />
                <Route path="/work-progress" element={<WorkProgress />} />
                <Route path="/travel-costs" element={canViewFinance(currentUser) ? <FinanceManagement travelOnly /> : <Navigate to={defaultRoute} replace />} />
                <Route path="/travel-receivables" element={canViewFinance(currentUser) ? <FinanceManagement receivablesOnly /> : <Navigate to={defaultRoute} replace />} />
                <Route path="/travel-payables" element={canViewFinance(currentUser) ? <FinanceManagement payablesOnly /> : <Navigate to={defaultRoute} replace />} />
                <Route path="/schedule-communication" element={<LiveSessions key="schedule-communication" communicationOnly />} />
                <Route path="/employees" element={<EmployeeManagement />} />
                <Route path="/finance" element={canViewFinance(currentUser) ? <FinanceManagement /> : <Navigate to={defaultRoute} replace />} />
                <Route path="/settings" element={canManageAccounts(currentUser) ? <Settings /> : <Navigate to={defaultRoute} replace />} />
                <Route path="*" element={<Navigate to={defaultRoute} replace />} />
              </Routes>
            </Suspense>
          </div>
        </Content>
      </Layout>
    </Layout>
  );
};

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(() => {
    return readStorage<CurrentUser | null>(AUTH_STORAGE_KEY, null);
  });

  const handleLogout = () => {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    setCurrentUser(null);
    message.success('已退出登录');
  };

  if (!currentUser) {
    return <LoginScreen onLogin={setCurrentUser} />;
  }

  return (
    <Router>
      <AppContent currentUser={currentUser} onLogout={handleLogout} />
    </Router>
  );
};

export default App;
