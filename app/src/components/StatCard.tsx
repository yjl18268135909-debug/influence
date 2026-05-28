import React from 'react';
import { Card } from 'antd';

interface StatCardProps {
  title: string;
  value: string | number;
  suffix?: string;
  prefix?: React.ReactNode;
  color?: string;
}

const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  suffix = '',
  prefix,
  color = '#1890ff',
}) => {
  const displayValue = typeof value === 'number' ? value.toLocaleString() : value;

  return (
    <Card
      className="dashboard-stat-card"
      style={{ borderTop: `4px solid ${color}` }}
    >
      <div className="card-label">{title}</div>
      <div className="card-number" style={{ color }}>
        {prefix}
        {displayValue}
        {suffix}
      </div>
    </Card>
  );
};

export default StatCard;
