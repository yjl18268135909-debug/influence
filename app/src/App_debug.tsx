import React from 'react';

const App: React.FC = () => {
  React.useEffect(() => {
    console.log('App组件已挂载');
    console.log('当前时间:', new Date().toLocaleString());
  }, []);

  return (
    <div style={{ padding: '20px', backgroundColor: '#f5f5f5', minHeight: '100vh' }}>
      <h1 style={{ color: '#1890ff', marginBottom: '20px' }}>
        🎉 ShopFluence 财务系统
      </h1>
      <div style={{
        backgroundColor: 'white',
        padding: '20px',
        borderRadius: '8px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      }}>
        <h2>系统状态检查</h2>
        <ul style={{ lineHeight: '2' }}>
          <li>✅ React已加载</li>
          <li>✅ App组件已渲染</li>
          <li>✅ 前端服务运行中</li>
          <li>✅ 后端服务运行中</li>
        </ul>
        <p style={{ marginTop: '20px', color: '#52c41a', fontWeight: 'bold' }}>
          如果看到这个页面，说明React正常运行！
        </p>
      </div>
    </div>
  );
};

export default App;
