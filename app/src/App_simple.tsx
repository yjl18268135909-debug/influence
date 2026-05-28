import React from 'react';

const App: React.FC = () => {
  return (
    <div style={{ padding: '20px' }}>
      <h1 style={{ color: 'red' }}>测试页面 - 如果你看到这行文字，React正常工作</h1>
      <p>当前时间: {new Date().toLocaleString()}</p>
    </div>
  );
};

export default App;
