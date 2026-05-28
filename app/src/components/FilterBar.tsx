import React from 'react';
import { Card, DatePicker, Select, Space, Button, Row, Col } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { useFilterStore } from '../store/useStore';
import { useDataStore } from '../store/useStore';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;
const { Option } = Select;

const FilterBar: React.FC = () => {
  const {
    startDate,
    endDate,
    influencerId,
    platform,
    setStartDate,
    setEndDate,
    setInfluencerId,
    setPlatform,
    resetFilters,
  } = useFilterStore();

  const { influencers, fetchAllData } = useDataStore();

  const handleDateChange = (dates: any) => {
    if (dates && dates[0] && dates[1]) {
      setStartDate(dates[0].format('YYYY-MM-DD'));
      setEndDate(dates[1].format('YYYY-MM-DD'));
    } else {
      setStartDate('');
      setEndDate('');
    }
    // 自动应用筛选
    setTimeout(() => {
      try {
        fetchAllData().catch(err => console.error('Fetch error:', err));
      } catch (error) {
        console.error('Error in handleDateChange:', error);
      }
    }, 100);
  };

  const handleApply = () => {
    fetchAllData().catch(err => console.error('Fetch error:', err));
  };

  const handleReset = () => {
    resetFilters();
    fetchAllData().catch(err => console.error('Fetch error:', err));
  };

  return (
    <Card style={{ marginBottom: 16 }}>
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} md={6}>
          <div style={{ marginBottom: 8, color: 'rgba(0,0,0,0.45)', fontSize: 14 }}>
            时间范围
          </div>
          <RangePicker
            style={{ width: '100%' }}
            value={startDate && endDate ? [dayjs(startDate), dayjs(endDate)] : null}
            onChange={handleDateChange}
            placeholder={['开始日期', '结束日期']}
          />
        </Col>
        <Col xs={24} sm={12} md={6}>
          <div style={{ marginBottom: 8, color: 'rgba(0,0,0,0.45)', fontSize: 14 }}>
            选择达人
          </div>
          <Select
            style={{ width: '100%' }}
            placeholder="全部达人"
            value={influencerId}
            onChange={(value) => {
              setInfluencerId(value);
              // 自动应用筛选
              setTimeout(() => {
                try {
                  fetchAllData().catch(err => console.error('Fetch error:', err));
                } catch (error) {
                  console.error('Error in influencer change:', error);
                }
              }, 100);
            }}
            allowClear
          >
            {(influencers || []).map((inf: any) => (
              <Option key={inf.id} value={inf.id}>
                {inf.name} ({inf.platform})
              </Option>
            ))}
          </Select>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <div style={{ marginBottom: 8, color: 'rgba(0,0,0,0.45)', fontSize: 14 }}>
            平台
          </div>
          <Select
            style={{ width: '100%' }}
            placeholder="全部平台"
            value={platform || undefined}
            onChange={(value) => {
              setPlatform(value);
              // 自动应用筛选
              setTimeout(() => {
                try {
                  fetchAllData().catch(err => console.error('Fetch error:', err));
                } catch (error) {
                  console.error('Error in platform change:', error);
                }
              }, 100);
            }}
            allowClear
          >
            <Option value="TikTok">TikTok</Option>
            <Option value="Shopee">Shopee</Option>
          </Select>
        </Col>
        <Col xs={24} sm={12} md={6} style={{ display: 'flex', alignItems: 'flex-end' }}>
          <Space>
            <Button type="primary" onClick={handleApply}>
              应用筛选
            </Button>
            <Button icon={<ReloadOutlined />} onClick={handleReset}>
              重置
            </Button>
          </Space>
        </Col>
      </Row>
    </Card>
  );
};

export default FilterBar;
