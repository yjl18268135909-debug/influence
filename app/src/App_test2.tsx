import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Layout, Typography } from 'antd';

const { Header, Content } = Layout;
const { Title } = Typography;

const SimpleDashboard = () => (
  <div>
    <Title level={2}>仪表盘</Title>
    <p>测试内容</p>
  </div>
);

const SimpleInfluencers = () => (
  <div>
    <Title level={2}>达人管理</Title>
    <p>测试内容</p>
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
            <Route path="/" element={<SimpleDashboard />} />
            <Route path="/influencers" element={<SimpleInfluencers />} />
          </Routes>
        </Content>
      </Layout>
    </Router>
  );
};

export default App;
