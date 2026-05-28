import React from 'react';
import { Card, Typography } from 'antd';

const { Title } = Typography;

const Dashboard: React.FC = () => {
  return (
    <div>
      <Title level={2}>仪表盘</Title>
      <Card>
        <p>这是简化版的仪表盘页面</p>
      </Card>
    </div>
  );
};

export default Dashboard;
