import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Layout } from 'antd';

const { Header, Content } = Layout;

// 简化的测试组件
const TestDashboard: React.FC = () => (
  <div>
    <h2>测试仪表盘</h2>
    <p>这是测试页面内容</p>
  </div>
);

const App: React.FC = () => {
  return (
    <Router>
      <Layout style={{ minHeight: '100vh' }}>
        <Header style={{ background: '#001529', color: 'white', padding: '0 24px' }}>
          ShopFluence 测试
        </Header>
        <Content style={{ padding: '24px' }}>
          <Routes>
            <Route path="/" element={<TestDashboard />} />
          </Routes>
        </Content>
      </Layout>
    </Router>
  );
};

export default App;
