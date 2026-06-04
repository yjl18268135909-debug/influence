import React, { useEffect, useMemo, useState } from 'react';
import { Button, Calendar, Col, DatePicker, Form, Input, InputNumber, Modal, Popconfirm, Radio, Row, Select, Space, Statistic, Table, Tabs, Tag, message } from 'antd';
import { DeleteOutlined, EditOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import { liveSessionApi } from '../api';

const { Option } = Select;
const { RangePicker } = DatePicker;

const initialTransactions = [
  { id: 'F001', date: dayjs().format('YYYY-MM-DD'), type: 'income', category: '直播GMV结算', amount: 28600, owner: 'Lina Chen', status: 'settled' },
  { id: 'F002', date: dayjs().format('YYYY-MM-DD'), type: 'expense', category: '达人佣金', amount: 3432, owner: 'Lina Chen', status: 'pending' },
  { id: 'F003', date: dayjs().subtract(1, 'day').format('YYYY-MM-DD'), type: 'expense', category: '员工提成', amount: 860, owner: 'Mia', status: 'pending' },
  { id: 'F004', date: dayjs().subtract(2, 'day').format('YYYY-MM-DD'), type: 'expense', category: '样品/物流', amount: 520, owner: 'Home Select', status: 'settled' },
];

const TRAVEL_COST_RECORDS_STORAGE_KEY = 'shopfluence_travel_cost_records';
const TRAVEL_COST_DRAFT_STORAGE_KEY = 'shopfluence_travel_cost_draft';
const TRAVEL_RECEIVED_STATUS_STORAGE_KEY = 'shopfluence_travel_received_status';
const TRAVEL_RECEIVABLE_RECORDS_STORAGE_KEY = 'shopfluence_travel_receivable_records';
const DEFAULT_TRAVEL_COST_FORM_VALUES = { currency: 'SGD', exchange_rate: 5.35, cabin_type: 'economy' };

const readStorage = <T,>(key: string, fallback: T): T => {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : fallback;
  } catch {
    return fallback;
  }
};

const formatMoney = (value: number | string | null | undefined, currency = 'SGD') => `${currency} ${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const hasSessionTime = (value: string | null | undefined) => Boolean(value && /\d{2}:\d{2}/.test(value));
const formatDateRange = (range?: [Dayjs, Dayjs]) => range ? `${range[0].format('YYYY-MM-DD')} 至 ${range[1].format('YYYY-MM-DD')}` : '-';
const sessionBrand = (item: any) => item.merchant_name || '未添加品牌信息';
const sessionMode = (item: any) => item.brand_cooperation_mode || '未填写';
const getSessionReceivedKey = (item: any) => String(item.id || `${item.session_date}-${item.influencer_name}-${item.merchant_name}`);
const travelStatusText: Record<string, string> = {
  scheduled: '待开始',
  completed: '已完成',
};

const serializeTravelCostDraft = (values: any) => ({
  ...values,
  date_range: values?.date_range?.length
    ? [values.date_range[0]?.format?.('YYYY-MM-DD'), values.date_range[1]?.format?.('YYYY-MM-DD')]
    : undefined,
});

const deserializeTravelCostDraft = (values: any) => ({
  ...values,
  date_range: values?.date_range?.length
    ? [dayjs(values.date_range[0]), dayjs(values.date_range[1])]
    : undefined,
});

interface FinanceManagementProps {
  travelOnly?: boolean;
}

const FinanceManagement: React.FC<FinanceManagementProps> = ({ travelOnly = false }) => {
  const [transactions, setTransactions] = useState(initialTransactions);
  const [travelCostRecords, setTravelCostRecords] = useState<any[]>(() => readStorage(TRAVEL_COST_RECORDS_STORAGE_KEY, []));
  const [travelReceivableRecords, setTravelReceivableRecords] = useState<any[]>(() => readStorage(TRAVEL_RECEIVABLE_RECORDS_STORAGE_KEY, []));
  const [sessions, setSessions] = useState<any[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [open, setOpen] = useState(false);
  const [receptionRecord, setReceptionRecord] = useState<any | null>(null);
  const [editingTravelCostRecord, setEditingTravelCostRecord] = useState<any | null>(null);
  const [editingReceivableSession, setEditingReceivableSession] = useState<any | null>(null);
  const [receivedStatus, setReceivedStatus] = useState<Record<string, boolean>>(() => readStorage(TRAVEL_RECEIVED_STATUS_STORAGE_KEY, {}));
  const [calendarMonth, setCalendarMonth] = useState<Dayjs>(dayjs());
  const [selectedReceivableDate, setSelectedReceivableDate] = useState<Dayjs>(dayjs());
  const [travelFilters, setTravelFilters] = useState<any>({ month: dayjs() });
  const [form] = Form.useForm();
  const [travelCostForm] = Form.useForm();
  const [travelCostEditForm] = Form.useForm();
  const [travelReceivableForm] = Form.useForm();
  const [receptionForm] = Form.useForm();
  const [receivableAmountForm] = Form.useForm();
  const watchedTravelValues = Form.useWatch([], travelCostForm);

  useEffect(() => {
    fetchSessions();
    const draft = readStorage<any | null>(TRAVEL_COST_DRAFT_STORAGE_KEY, null);
    travelCostForm.setFieldsValue(draft ? deserializeTravelCostDraft(draft) : DEFAULT_TRAVEL_COST_FORM_VALUES);
  }, []);

  useEffect(() => {
    localStorage.setItem(TRAVEL_COST_RECORDS_STORAGE_KEY, JSON.stringify(travelCostRecords));
  }, [travelCostRecords]);

  useEffect(() => {
    localStorage.setItem(TRAVEL_RECEIVABLE_RECORDS_STORAGE_KEY, JSON.stringify(travelReceivableRecords));
  }, [travelReceivableRecords]);

  useEffect(() => {
    localStorage.setItem(TRAVEL_RECEIVED_STATUS_STORAGE_KEY, JSON.stringify(receivedStatus));
  }, [receivedStatus]);

  const fetchSessions = async () => {
    setLoadingSessions(true);
    try {
      const res = await liveSessionApi.getAll();
      setSessions(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch (error) {
      console.error('获取排期数据失败:', error);
      message.error('获取排期数据失败');
    } finally {
      setLoadingSessions(false);
    }
  };

  const resetTravelCostDraft = async () => {
    localStorage.removeItem(TRAVEL_COST_DRAFT_STORAGE_KEY);
    travelCostForm.resetFields();
    travelCostForm.setFieldsValue(DEFAULT_TRAVEL_COST_FORM_VALUES);
    await fetchSessions();
  };

  const stats = useMemo(() => {
    const income = transactions.filter((item) => item.type === 'income').reduce((sum, item) => sum + item.amount, 0);
    const expense = transactions.filter((item) => item.type === 'expense').reduce((sum, item) => sum + item.amount, 0);
    const pending = transactions.filter((item) => item.status === 'pending').reduce((sum, item) => sum + item.amount, 0);
    return { income, expense, profit: income - expense, pending };
  }, [transactions]);

  const addTransaction = async () => {
    const values = await form.validateFields();
    setTransactions((prev) => [{ ...values, id: `F${Date.now()}`, date: values.date.format('YYYY-MM-DD') }, ...prev]);
    setOpen(false);
    form.resetFields();
    message.success('财务记录已添加');
  };

  const travelInfluencerOptions = useMemo(() => {
    const names = sessions
      .filter((item) => item.influencer_travel_note || item.schedule_type !== 'travel_note')
      .map((item) => item.influencer_name)
      .filter(Boolean);
    return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b));
  }, [sessions]);

  const travelBrandOptions = useMemo(() => {
    const names = sessions
      .filter((item) => item.schedule_type !== 'travel_note')
      .map(sessionBrand)
      .filter(Boolean);
    return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b));
  }, [sessions]);

  const travelModeOptions = useMemo(() => {
    const names = sessions
      .filter((item) => item.schedule_type !== 'travel_note')
      .map(sessionMode)
      .filter(Boolean);
    return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b));
  }, [sessions]);

  const getTravelFilterRange = () => {
    if (travelFilters.date_range?.length) {
      return [travelFilters.date_range[0].startOf('day'), travelFilters.date_range[1].endOf('day')] as [Dayjs, Dayjs];
    }
    if (travelFilters.month) {
      return [travelFilters.month.startOf('month'), travelFilters.month.endOf('month')] as [Dayjs, Dayjs];
    }
    return null;
  };

  const matchesTravelSessionFilters = (item: any) => {
    if (item.schedule_type === 'travel_note') return false;
    const range = getTravelFilterRange();
    const sessionDate = dayjs(item.session_date);
    return (!travelFilters.influencer_name || (item.influencer_name || '未填写达人') === travelFilters.influencer_name)
      && (!travelFilters.merchant_name || sessionBrand(item) === travelFilters.merchant_name)
      && (!travelFilters.brand_cooperation_mode || sessionMode(item) === travelFilters.brand_cooperation_mode)
      && (!travelFilters.status || item.status === travelFilters.status)
      && (!range || (!sessionDate.isBefore(range[0]) && !sessionDate.isAfter(range[1])));
  };

  const filteredSessions = useMemo(
    () => sessions.filter(matchesTravelSessionFilters),
    [sessions, travelFilters],
  );

  const recordIntersectsFilterRange = (record: any) => {
    const range = getTravelFilterRange();
    if (!range) return true;
    const recordStart = dayjs(record.date_start).startOf('day');
    const recordEnd = dayjs(record.date_end).endOf('day');
    return !recordEnd.isBefore(range[0]) && !recordStart.isAfter(range[1]);
  };

  const recordMatchesTravelFilters = (record: any) => {
    if (travelFilters.influencer_name && record.influencer_name !== travelFilters.influencer_name) return false;
    if (!recordIntersectsFilterRange(record)) return false;
    if (travelFilters.merchant_name || travelFilters.brand_cooperation_mode || travelFilters.status) {
      const recordStart = dayjs(record.date_start).startOf('day');
      const recordEnd = dayjs(record.date_end).endOf('day');
      return sessions.some((item) => {
        const sessionDate = dayjs(item.session_date);
        return (item.influencer_name || '未填写达人') === record.influencer_name
          && !sessionDate.isBefore(recordStart)
          && !sessionDate.isAfter(recordEnd)
          && matchesTravelSessionFilters(item);
      });
    }
    return true;
  };

  const filteredTravelCostRecords = useMemo(
    () => travelCostRecords.filter(recordMatchesTravelFilters),
    [travelCostRecords, sessions, travelFilters],
  );

  const travelFilterStats = useMemo(() => {
    const receivableTotal = filteredSessions.reduce((sum, item) => sum + Number(item.brand_receivable || 0), 0);
    const receivedTotal = filteredSessions
      .filter((item) => receivedStatus[getSessionReceivedKey(item)])
      .reduce((sum, item) => sum + Number(item.brand_receivable || 0), 0);
    return {
      totalCost: filteredTravelCostRecords.reduce((sum, item) => sum + Number(item.total_cost || getRecordTotalCost(item) || 0), 0),
      receivableTotal,
      receivedTotal,
      unreceivedTotal: receivableTotal - receivedTotal,
    };
  }, [filteredSessions, filteredTravelCostRecords, receivedStatus]);

  const travelReceivableStats = useMemo(() => {
    const influencerTotal = travelReceivableRecords.reduce((sum, item) => sum + Number(item.influencer_receivable || 0), 0);
    const brandTotal = travelReceivableRecords.reduce((sum, item) => sum + Number(item.brand_receivable || 0), 0);
    const otherTotal = travelReceivableRecords.reduce((sum, item) => sum + Number(item.other_receivable || 0), 0);
    return {
      influencerTotal,
      brandTotal,
      otherTotal,
      total: influencerTotal + brandTotal + otherTotal,
    };
  }, [travelReceivableRecords]);

  const resetTravelFilters = () => {
    setTravelFilters({ month: dayjs() });
    setCalendarMonth(dayjs());
    setSelectedReceivableDate(dayjs());
  };

  const getRecordTotalCost = (record: any) => {
    return Number(record.flight_cost || 0)
      + Number(record.hotel_cost || 0)
      + Number(record.business_car_cost || 0)
      + Number(record.taxi_reception_cost || 0)
      + Number(record.meal_reception_cost || 0)
      + Number(record.internal_team_travel_cost || 0);
  };

  const travelCostSummary = useMemo(() => {
    const values = watchedTravelValues || {};
    const currency = values.currency || 'SGD';
    const exchangeRate = Number(values.exchange_rate || 5.35);
    const range = values.date_range;
    const influencerName = values.influencer_name;
    const baseCost = ['flight_cost', 'hotel_cost', 'business_car_cost'].reduce((sum, key) => sum + Number(values[key] || 0), 0);
    const flightHotelBaseCost = Number(values.flight_cost || 0) + Number(values.hotel_cost || 0);
    const toCurrency = (amount: number) => currency === 'SGD' ? amount : amount * exchangeRate;
    const rangeSessions = range && influencerName
      ? sessions.filter((item) => {
        if (item.schedule_type === 'travel_note') return false;
        const sessionDate = dayjs(item.session_date);
        return (item.influencer_name || '未填写达人') === influencerName
          && !sessionDate.isBefore(range[0].startOf('day'))
          && !sessionDate.isAfter(range[1].endOf('day'));
      })
      : [];
    const tapSessions = rangeSessions.filter((item) => sessionMode(item).toUpperCase() === 'TAP');
    const displayCurrency = currency === 'SGD' ? 'SGD' : 'CNY';
    const totalCost = toCurrency(baseCost);
    const flightHotelCost = toCurrency(flightHotelBaseCost);

    return {
      currency: displayCurrency,
      totalCost,
      flightHotelCost,
      sessionCount: rangeSessions.length,
      tapSessionCount: tapSessions.length,
      perSessionFlightHotelCost: rangeSessions.length ? flightHotelCost / rangeSessions.length : 0,
      perTapFlightHotelCost: tapSessions.length ? flightHotelCost / tapSessions.length : 0,
      matchedSessions: rangeSessions,
      dateText: formatDateRange(range),
    };
  }, [sessions, watchedTravelValues]);

  const addTravelCostRecord = async () => {
    const values = await travelCostForm.validateFields();
    const [startDate, endDate] = values.date_range;
    const multiplier = values.currency === 'CNY' ? Number(values.exchange_rate || 5.35) : 1;
    const record = {
      id: `TC${Date.now()}`,
      created_at: dayjs().format('YYYY-MM-DD HH:mm:ss'),
      influencer_name: values.influencer_name,
      date_start: startDate.format('YYYY-MM-DD'),
      date_end: endDate.format('YYYY-MM-DD'),
      cabin_type: values.cabin_type,
      currency: travelCostSummary.currency,
      exchange_rate: Number(values.exchange_rate || 5.35),
      flight_cost: Number(values.flight_cost || 0) * multiplier,
      hotel_cost: Number(values.hotel_cost || 0) * multiplier,
      business_car_cost: Number(values.business_car_cost || 0) * multiplier,
      taxi_reception_cost: 0,
      meal_reception_cost: 0,
      internal_team_travel_cost: 0,
      total_cost: travelCostSummary.totalCost,
      flight_hotel_cost: travelCostSummary.flightHotelCost,
      session_count: travelCostSummary.sessionCount,
      tap_session_count: travelCostSummary.tapSessionCount,
      per_session_flight_hotel_cost: travelCostSummary.perSessionFlightHotelCost,
      per_tap_flight_hotel_cost: travelCostSummary.perTapFlightHotelCost,
      matched_sessions: travelCostSummary.matchedSessions,
      receivables: [],
    };
    setTravelCostRecords((prev) => [record, ...prev]);
    localStorage.removeItem(TRAVEL_COST_DRAFT_STORAGE_KEY);
    travelCostForm.resetFields();
    travelCostForm.setFieldsValue(DEFAULT_TRAVEL_COST_FORM_VALUES);
    message.success('达人机酒成本已录入');
  };

  const openReceptionModal = (record: any) => {
    setReceptionRecord(record);
    receptionForm.setFieldsValue({
      taxi_reception_cost: Number(record.taxi_reception_cost || 0),
      meal_reception_cost: Number(record.meal_reception_cost || 0),
      internal_team_travel_cost: Number(record.internal_team_travel_cost || 0),
    });
  };

  const openTravelCostEditModal = (record: any) => {
    setEditingTravelCostRecord(record);
    travelCostEditForm.setFieldsValue({
      flight_cost: Number(record.flight_cost || 0),
      hotel_cost: Number(record.hotel_cost || 0),
      business_car_cost: Number(record.business_car_cost || 0),
    });
  };

  const saveTravelCostAmounts = async () => {
    const values = await travelCostEditForm.validateFields();
    setTravelCostRecords((prev) => prev.map((item) => {
      if (item.id !== editingTravelCostRecord?.id) return item;

      const next = {
        ...item,
        flight_cost: Number(values.flight_cost || 0),
        hotel_cost: Number(values.hotel_cost || 0),
        business_car_cost: Number(values.business_car_cost || 0),
      };
      const flightHotelCost = Number(next.flight_cost || 0) + Number(next.hotel_cost || 0);
      const sessionCount = Number(next.session_count || 0);
      const tapSessionCount = Number(next.tap_session_count || 0);
      return {
        ...next,
        total_cost: getRecordTotalCost(next),
        flight_hotel_cost: flightHotelCost,
        per_session_flight_hotel_cost: sessionCount ? flightHotelCost / sessionCount : 0,
        per_tap_flight_hotel_cost: tapSessionCount ? flightHotelCost / tapSessionCount : 0,
      };
    }));
    setEditingTravelCostRecord(null);
    travelCostEditForm.resetFields();
    message.success('行程成本金额已更新');
  };

  const saveReceptionCosts = async () => {
    const values = await receptionForm.validateFields();
    setTravelCostRecords((prev) => prev.map((item) => {
      if (item.id !== receptionRecord?.id) return item;
      const next = {
        ...item,
        taxi_reception_cost: Number(values.taxi_reception_cost || 0),
        meal_reception_cost: Number(values.meal_reception_cost || 0),
        internal_team_travel_cost: Number(values.internal_team_travel_cost || 0),
      };
      return { ...next, total_cost: getRecordTotalCost(next) };
    }));
    setReceptionRecord(null);
    receptionForm.resetFields();
    message.success('接待费用已更新');
  };

  const getRecordReceivableSessions = (record: any) => {
    const startDate = dayjs(record.date_start).startOf('day');
    const endDate = dayjs(record.date_end).endOf('day');
    return sessions
      .filter((item) => item.schedule_type !== 'travel_note')
      .filter((item) => (item.influencer_name || '未填写达人') === record.influencer_name)
      .filter((item) => {
        const sessionDate = dayjs(item.session_date);
        return !sessionDate.isBefore(startDate) && !sessionDate.isAfter(endDate);
      })
      .filter(matchesTravelSessionFilters)
      .sort((a, b) => dayjs(a.session_date).valueOf() - dayjs(b.session_date).valueOf());
  };

  const getBrandAllocationRows = () => filteredTravelCostRecords.map((record) => {
    const receivableSessions = getRecordReceivableSessions(record);
    const receivableBrandCount = new Set(receivableSessions
      .filter((item) => Number(item.brand_receivable || 0) > 0)
      .map(sessionBrand)).size;
    const actualReceivableTotal = receivableSessions.reduce((sum, item) => sum + Number(item.brand_receivable || 0), 0);
    const receivedTotal = receivableSessions
      .filter((item) => receivedStatus[getSessionReceivedKey(item)])
      .reduce((sum, item) => sum + Number(item.brand_receivable || 0), 0);
    return {
      key: record.id,
      record_id: record.id,
      influencer_name: record.influencer_name,
      date_range: `${record.date_start} 至 ${record.date_end}`,
      session_count: Number(record.session_count || 0),
      tap_session_count: Number(record.tap_session_count || 0),
      per_session_flight_hotel_cost: Number(record.per_session_flight_hotel_cost || 0),
      per_tap_flight_hotel_cost: Number(record.per_tap_flight_hotel_cost || 0),
      receivable_brand_count: receivableBrandCount,
      actual_receivable_total: actualReceivableTotal,
      actual_received_total: receivedTotal,
      currency: record.currency || 'SGD',
      sessions: receivableSessions,
    };
  });

  const brandAllocationRows = useMemo(() => getBrandAllocationRows(), [filteredTravelCostRecords, sessions, receivedStatus, travelFilters]);

  const deleteAllocationSession = async (record: any) => {
    if (!record.id) return;
    try {
      await liveSessionApi.delete(record.id);
      setSessions((prev) => prev.filter((item) => String(item.id) !== String(record.id)));
      setReceivedStatus((prev) => {
        const next = { ...prev };
        delete next[getSessionReceivedKey(record)];
        return next;
      });
      message.success('场次已删除');
    } catch (error) {
      console.error('删除场次失败:', error);
      message.error('删除失败');
    }
  };

  const openReceivableAmountModal = (record: any) => {
    setEditingReceivableSession(record);
    receivableAmountForm.setFieldsValue({
      brand_receivable: Number(record.brand_receivable || 0),
    });
  };

  const saveReceivableAmount = async () => {
    if (!editingReceivableSession?.id) return;
    const values = await receivableAmountForm.validateFields();
    const amount = Number(values.brand_receivable || 0);
    const payload = {
      ...editingReceivableSession,
      brand_receivable: amount,
    };

    try {
      await liveSessionApi.update(editingReceivableSession.id, payload);
      setSessions((prev) => prev.map((item) => (
        String(item.id) === String(editingReceivableSession.id)
          ? { ...item, brand_receivable: amount }
          : item
      )));
      setEditingReceivableSession(null);
      receivableAmountForm.resetFields();
      message.success('实际应收机酒费用已更新');
    } catch (error) {
      console.error('更新实际应收机酒费用失败:', error);
      message.error('更新失败');
    }
  };

  const addTravelReceivableRecord = async () => {
    const values = await travelReceivableForm.validateFields();
    const record = {
      id: `TR${Date.now()}`,
      created_at: dayjs().format('YYYY-MM-DD HH:mm:ss'),
      receivable_date: values.receivable_date?.format('YYYY-MM-DD') || dayjs().format('YYYY-MM-DD'),
      influencer_receivable: Number(values.influencer_receivable || 0),
      brand_receivable: Number(values.brand_receivable || 0),
      other_receivable: Number(values.other_receivable || 0),
      notes: values.notes || '',
    };
    setTravelReceivableRecords((prev) => [record, ...prev]);
    travelReceivableForm.resetFields();
    travelReceivableForm.setFieldsValue({ receivable_date: dayjs() });
    message.success('应收款项已录入');
  };

  const deleteTravelReceivableRecord = (id: string) => {
    setTravelReceivableRecords((prev) => prev.filter((item) => item.id !== id));
    message.success('应收款项记录已删除');
  };

  const renderEntryView = () => (
    <>
      <Space style={{ marginBottom: 16 }} wrap>
        <Button icon={<ReloadOutlined />} onClick={resetTravelCostDraft} loading={loadingSessions}>刷新排期数据</Button>
      </Space>
      <Form
        form={travelCostForm}
        layout="vertical"
        initialValues={DEFAULT_TRAVEL_COST_FORM_VALUES}
        onValuesChange={(_, allValues) => {
          localStorage.setItem(TRAVEL_COST_DRAFT_STORAGE_KEY, JSON.stringify(serializeTravelCostDraft(allValues)));
        }}
      >
        <Row gutter={16}>
          <Col xs={24} md={8}>
            <Form.Item name="influencer_name" label="达人" rules={[{ required: true, message: '请选择达人' }]}>
              <Select placeholder="显示有排期或行程备注记录的达人" showSearch optionFilterProp="children" allowClear>
                {travelInfluencerOptions.map((name) => <Option key={name} value={name}>{name}</Option>)}
              </Select>
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item name="date_range" label="日期周期" rules={[{ required: true, message: '请选择连续日期周期' }]}>
              <RangePicker style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col xs={24} md={4}>
            <Form.Item name="currency" label="计算币种">
              <Radio.Group optionType="button" buttonStyle="solid">
                <Radio.Button value="SGD">新币</Radio.Button>
                <Radio.Button value="CNY">人民币</Radio.Button>
              </Radio.Group>
            </Form.Item>
          </Col>
          <Col xs={24} md={4}>
            <Form.Item name="exchange_rate" label="汇率">
              <InputNumber<number> style={{ width: '100%' }} min={0} precision={4} addonBefore="1 SGD =" addonAfter="RMB" onFocus={(event) => event.target.select()} />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item name="cabin_type" label="机票类型">
              <Select>
                <Option value="business">商务舱</Option>
                <Option value="economy">经济舱</Option>
              </Select>
            </Form.Item>
          </Col>
          <Col xs={24} md={8}><Form.Item name="flight_cost" label="机票费用"><InputNumber<number> style={{ width: '100%' }} min={0} precision={2} onFocus={(event) => event.target.select()} /></Form.Item></Col>
          <Col xs={24} md={8}><Form.Item name="hotel_cost" label="酒店费用"><InputNumber<number> style={{ width: '100%' }} min={0} precision={2} onFocus={(event) => event.target.select()} /></Form.Item></Col>
          <Col xs={24} md={8}><Form.Item name="business_car_cost" label="商务车费用"><InputNumber<number> style={{ width: '100%' }} min={0} precision={2} onFocus={(event) => event.target.select()} /></Form.Item></Col>
        </Row>
        <Space style={{ marginBottom: 16 }}>
          <Button type="primary" onClick={addTravelCostRecord}>确定录入</Button>
        </Space>
      </Form>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}><Statistic title="自动总成本" value={travelCostSummary.totalCost} precision={2} prefix={travelCostSummary.currency} /></Col>
        <Col xs={24} sm={12} lg={6}><Statistic title="机酒成本" value={travelCostSummary.flightHotelCost} precision={2} prefix={travelCostSummary.currency} /></Col>
        <Col xs={24} sm={12} lg={6}><Statistic title="直播场次数" value={travelCostSummary.sessionCount} /></Col>
        <Col xs={24} sm={12} lg={6}><Statistic title="TAP场次数" value={travelCostSummary.tapSessionCount} /></Col>
        <Col xs={24} sm={12} lg={6}><Statistic title="单场机酒均摊" value={travelCostSummary.perSessionFlightHotelCost} precision={2} prefix={travelCostSummary.currency} /></Col>
        <Col xs={24} sm={12} lg={6}><Statistic title="TAP机酒均摊" value={travelCostSummary.perTapFlightHotelCost} precision={2} prefix={travelCostSummary.currency} /></Col>
      </Row>
    </>
  );

  const renderCostView = () => (
    <Table
      dataSource={filteredTravelCostRecords}
      rowKey="id"
      pagination={{ pageSize: 10 }}
      scroll={{ x: 1700 }}
      locale={{ emptyText: '暂无达人行程成本录入记录' }}
      columns={[
        { title: '录入时间', dataIndex: 'created_at', key: 'created_at', width: 160 },
        { title: '达人', dataIndex: 'influencer_name', key: 'influencer_name', width: 140 },
        { title: '日期周期', key: 'date_range', width: 210, render: (_, record) => `${record.date_start} 至 ${record.date_end}` },
        { title: '机票类型', dataIndex: 'cabin_type', key: 'cabin_type', width: 110, render: (value) => value === 'business' ? '商务舱' : '经济舱' },
        {
          title: '机票费用',
          dataIndex: 'flight_cost',
          key: 'flight_cost',
          width: 140,
          render: (value, record) => (
            <Space size={4}>
              <span>{formatMoney(value, record.currency)}</span>
              <Button type="text" size="small" icon={<EditOutlined />} onClick={() => openTravelCostEditModal(record)} />
            </Space>
          ),
        },
        {
          title: '酒店费用',
          dataIndex: 'hotel_cost',
          key: 'hotel_cost',
          width: 140,
          render: (value, record) => (
            <Space size={4}>
              <span>{formatMoney(value, record.currency)}</span>
              <Button type="text" size="small" icon={<EditOutlined />} onClick={() => openTravelCostEditModal(record)} />
            </Space>
          ),
        },
        {
          title: '商务车费用',
          dataIndex: 'business_car_cost',
          key: 'business_car_cost',
          width: 150,
          render: (value, record) => (
            <Space size={4}>
              <span>{formatMoney(value, record.currency)}</span>
              <Button type="text" size="small" icon={<EditOutlined />} onClick={() => openTravelCostEditModal(record)} />
            </Space>
          ),
        },
        { title: '接待打车', dataIndex: 'taxi_reception_cost', key: 'taxi_reception_cost', width: 120, render: (value, record) => formatMoney(value, record.currency) },
        { title: '接待吃喝', dataIndex: 'meal_reception_cost', key: 'meal_reception_cost', width: 120, render: (value, record) => formatMoney(value, record.currency) },
        { title: '内部团队差旅费用（机票+酒店）', dataIndex: 'internal_team_travel_cost', key: 'internal_team_travel_cost', width: 220, render: (value, record) => formatMoney(value, record.currency) },
        { title: '自动总成本', dataIndex: 'total_cost', key: 'total_cost', width: 130, render: (value, record) => formatMoney(value, record.currency) },
        {
          title: '操作',
          key: 'action',
          fixed: 'right' as const,
          width: 160,
          render: (_, record) => <Button type="link" icon={<PlusOutlined />} onClick={() => openReceptionModal(record)}>新增费用</Button>,
        },
      ]}
    />
  );

  const renderAllocationView = () => (
    <Table
      dataSource={brandAllocationRows}
      rowKey="key"
      pagination={{ pageSize: 12 }}
      scroll={{ x: 1500 }}
      locale={{ emptyText: '暂无可均摊的达人机酒记录' }}
      expandable={{
        expandedRowRender: (record) => (
          <Table
            size="small"
            dataSource={record.sessions}
            rowKey={(item: any) => item.id || `${item.session_date}-${item.influencer_name}-${item.merchant_name}`}
            pagination={false}
            scroll={{ x: 920 }}
            columns={[
              { title: '日期', dataIndex: 'session_date', key: 'session_date', render: (value) => hasSessionTime(value) ? dayjs(value).format('YYYY-MM-DD HH:mm') : dayjs(value).format('YYYY-MM-DD') },
              { title: '品牌', dataIndex: 'merchant_name', key: 'merchant_name', render: (value) => value || '未添加品牌信息' },
              { title: '合作模式', dataIndex: 'brand_cooperation_mode', key: 'brand_cooperation_mode', render: (value) => value || '未填写' },
              {
                title: '实际应收机酒费用',
                dataIndex: 'brand_receivable',
                key: 'brand_receivable',
                render: (value, item: any) => (
                  <Space size="small">
                    <span>{formatMoney(value)}</span>
                    <Button type="link" size="small" onClick={() => openReceivableAmountModal(item)}>修改</Button>
                  </Space>
                ),
              },
              {
                title: '是否已收',
                key: 'received',
                width: 130,
                render: (_, item: any) => (
                  <Select
                    size="small"
                    value={receivedStatus[getSessionReceivedKey(item)] ? 'yes' : 'no'}
                    style={{ width: 90 }}
                    onChange={(value) => {
                      setReceivedStatus((prev) => ({
                        ...prev,
                        [getSessionReceivedKey(item)]: value === 'yes',
                      }));
                    }}
                  >
                    <Option value="no">否</Option>
                    <Option value="yes">是</Option>
                  </Select>
                ),
              },
              {
                title: '操作',
                key: 'action',
                width: 100,
                render: (_, item: any) => (
                  <Button type="link" danger onClick={() => deleteAllocationSession(item)}>
                    删除
                  </Button>
                ),
              },
            ]}
          />
        ),
      }}
      columns={[
        { title: '达人', dataIndex: 'influencer_name', key: 'influencer_name', width: 130 },
        { title: '日期周期', dataIndex: 'date_range', key: 'date_range', width: 210 },
        { title: '直播场次数', dataIndex: 'session_count', key: 'session_count', width: 110 },
        { title: 'TAP场次数', dataIndex: 'tap_session_count', key: 'tap_session_count', width: 110 },
        { title: '单场机酒均摊', dataIndex: 'per_session_flight_hotel_cost', key: 'per_session_flight_hotel_cost', width: 140, render: (value, record) => formatMoney(value, record.currency) },
        { title: 'TAP机酒均摊', dataIndex: 'per_tap_flight_hotel_cost', key: 'per_tap_flight_hotel_cost', width: 140, render: (value, record) => formatMoney(value, record.currency) },
        { title: '实际应收品牌数', dataIndex: 'receivable_brand_count', key: 'receivable_brand_count', width: 140 },
        { title: '实际应收机酒合计', dataIndex: 'actual_receivable_total', key: 'actual_receivable_total', width: 160, render: (value, record) => formatMoney(value, record.currency) },
        { title: '实际已收机酒合计', dataIndex: 'actual_received_total', key: 'actual_received_total', width: 160, render: (value, record) => formatMoney(value, record.currency) },
      ]}
    />
  );

  const getCalendarReceivableItems = (date: Dayjs) => filteredSessions
    .filter((item) => Number(item.brand_receivable || 0) > 0)
    .filter((item) => dayjs(item.session_date).isSame(date, 'day'))
    .sort((a, b) => dayjs(a.session_date).valueOf() - dayjs(b.session_date).valueOf());

  const getReceivableTotal = (items: any[]) => items.reduce((sum, item) => sum + Number(item.brand_receivable || 0), 0);

  const getReceivedTotal = (items: any[]) => items
    .filter((item) => receivedStatus[getSessionReceivedKey(item)])
    .reduce((sum, item) => sum + Number(item.brand_receivable || 0), 0);

  const getUnreceivedTotal = (items: any[]) => getReceivableTotal(items) - getReceivedTotal(items);

  const renderReceivableCalendar = () => (
    <>
      <Calendar
        className="receivable-calendar-view"
        value={calendarMonth}
        onPanelChange={(date) => setCalendarMonth(date)}
        onSelect={(date) => {
          const items = getCalendarReceivableItems(date);
          setCalendarMonth(date);
          if (items.length) setSelectedReceivableDate(date);
        }}
        cellRender={(date, info) => {
          if (info.type !== 'date') return info.originNode;
          const items = getCalendarReceivableItems(date);
          if (!items.length) return <div className="post-data-cell post-data-empty" />;
          const receivableTotal = getReceivableTotal(items);
          const receivedTotal = getReceivedTotal(items);
          const unreceivedTotal = getUnreceivedTotal(items);
          return (
            <div className="receivable-calendar-cell">
              <div className="receivable-cell-block receivable-cell-due">
                <span>应收</span>
                <strong>{formatMoney(receivableTotal)}</strong>
              </div>
              <div className="receivable-cell-block receivable-cell-paid">
                <span>已收</span>
                <strong>{formatMoney(receivedTotal)}</strong>
              </div>
              <div className="receivable-cell-block receivable-cell-unpaid">
                <span>未收</span>
                <strong>{formatMoney(unreceivedTotal)}</strong>
              </div>
            </div>
          );
        }}
      />

      {getCalendarReceivableItems(selectedReceivableDate).length ? (
        <>
          <h3 style={{ margin: '20px 0 12px' }}>
            {selectedReceivableDate.format('YYYY年MM月DD日')} 品牌应收机酒
            <span style={{ marginLeft: 12, color: 'rgba(0, 0, 0, 0.45)', fontSize: 14 }}>
              应收 {formatMoney(getReceivableTotal(getCalendarReceivableItems(selectedReceivableDate)))}
            </span>
            <span style={{ marginLeft: 12, color: 'rgba(0, 0, 0, 0.45)', fontSize: 14 }}>
              已收 {formatMoney(getReceivedTotal(getCalendarReceivableItems(selectedReceivableDate)))}
            </span>
            <span style={{ marginLeft: 12, color: 'rgba(0, 0, 0, 0.45)', fontSize: 14 }}>
              未收 {formatMoney(getUnreceivedTotal(getCalendarReceivableItems(selectedReceivableDate)))}
            </span>
          </h3>
          <Table
            dataSource={getCalendarReceivableItems(selectedReceivableDate)}
            rowKey={(record) => getSessionReceivedKey(record)}
            pagination={false}
            scroll={{ x: 980 }}
            columns={[
              { title: '日期', dataIndex: 'session_date', key: 'session_date', width: 170, render: (value) => hasSessionTime(value) ? dayjs(value).format('YYYY-MM-DD HH:mm') : dayjs(value).format('YYYY-MM-DD') },
              { title: '达人', dataIndex: 'influencer_name', key: 'influencer_name', width: 140, render: (value) => value || '未填写达人' },
              { title: '品牌', dataIndex: 'merchant_name', key: 'merchant_name', width: 160, render: (value) => value || '未添加品牌信息' },
              { title: '合作模式', dataIndex: 'brand_cooperation_mode', key: 'brand_cooperation_mode', width: 130, render: (value) => value || '未填写' },
              { title: '实际应收机酒费用', dataIndex: 'brand_receivable', key: 'brand_receivable', width: 170, render: (value) => formatMoney(value) },
              {
                title: '是否已收',
                key: 'received',
                width: 130,
                render: (_, record) => (
                  <Select
                    size="small"
                    value={receivedStatus[getSessionReceivedKey(record)] ? 'yes' : 'no'}
                    style={{ width: 90 }}
                    onChange={(value) => {
                      setReceivedStatus((prev) => ({
                        ...prev,
                        [getSessionReceivedKey(record)]: value === 'yes',
                      }));
                    }}
                  >
                    <Option value="no">否</Option>
                    <Option value="yes">是</Option>
                  </Select>
                ),
              },
            ]}
          />
        </>
      ) : (
        <div className="post-data-empty-tip">请选择有应收机酒的日期查看明细</div>
      )}
    </>
  );

  const renderReceivableEntryView = () => (
    <>
      <Form
        form={travelReceivableForm}
        layout="vertical"
        initialValues={{ receivable_date: dayjs() }}
      >
        <Row gutter={16}>
          <Col xs={24} md={6}>
            <Form.Item name="receivable_date" label="录入日期">
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col xs={24} md={6}>
            <Form.Item name="influencer_receivable" label="应收达人款项">
              <InputNumber<number> style={{ width: '100%' }} min={0} precision={2} prefix="SGD" onFocus={(event) => event.target.select()} />
            </Form.Item>
          </Col>
          <Col xs={24} md={6}>
            <Form.Item name="brand_receivable" label="应收品牌款项">
              <InputNumber<number> style={{ width: '100%' }} min={0} precision={2} prefix="SGD" onFocus={(event) => event.target.select()} />
            </Form.Item>
          </Col>
          <Col xs={24} md={6}>
            <Form.Item name="other_receivable" label="应收其他款项">
              <InputNumber<number> style={{ width: '100%' }} min={0} precision={2} prefix="SGD" onFocus={(event) => event.target.select()} />
            </Form.Item>
          </Col>
          <Col xs={24}>
            <Form.Item name="notes" label="款项备注" rules={[{ required: true, message: '请填写款项备注' }]}>
              <Input.TextArea rows={3} placeholder="填写应收款项来源、对应达人/品牌、周期或其他说明" />
            </Form.Item>
          </Col>
        </Row>
        <Space style={{ marginBottom: 16 }}>
          <Button type="primary" onClick={addTravelReceivableRecord}>确定录入</Button>
        </Space>
      </Form>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12} lg={6}>
          <Statistic title="应收达人款项" value={travelReceivableStats.influencerTotal} precision={2} prefix="SGD" />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Statistic title="应收品牌款项" value={travelReceivableStats.brandTotal} precision={2} prefix="SGD" />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Statistic title="应收其他款项" value={travelReceivableStats.otherTotal} precision={2} prefix="SGD" />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Statistic title="应收合计" value={travelReceivableStats.total} precision={2} prefix="SGD" />
        </Col>
      </Row>

      <Table
        dataSource={travelReceivableRecords}
        rowKey="id"
        pagination={{ pageSize: 10 }}
        locale={{ emptyText: '暂无应收款项记录' }}
        columns={[
          { title: '录入时间', dataIndex: 'created_at', key: 'created_at', width: 170 },
          { title: '录入日期', dataIndex: 'receivable_date', key: 'receivable_date', width: 120 },
          { title: '应收达人款项', dataIndex: 'influencer_receivable', key: 'influencer_receivable', width: 140, render: (value) => formatMoney(value) },
          { title: '应收品牌款项', dataIndex: 'brand_receivable', key: 'brand_receivable', width: 140, render: (value) => formatMoney(value) },
          { title: '应收其他款项', dataIndex: 'other_receivable', key: 'other_receivable', width: 140, render: (value) => formatMoney(value) },
          {
            title: '款项备注',
            dataIndex: 'notes',
            key: 'notes',
            render: (value) => value || '-',
          },
          {
            title: '操作',
            key: 'action',
            width: 100,
            render: (_, record) => (
              <Popconfirm title="确定删除这条应收款项记录吗？" onConfirm={() => deleteTravelReceivableRecord(record.id)}>
                <Button type="link" danger icon={<DeleteOutlined />}>删除</Button>
              </Popconfirm>
            ),
          },
        ]}
      />
    </>
  );

  const renderTravelFilters = () => (
    <>
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12} lg={4}>
          <DatePicker
            picker="month"
            value={travelFilters.month}
            style={{ width: '100%' }}
            placeholder="按月筛选"
            onChange={(value) => {
              setTravelFilters((prev: any) => ({ ...prev, month: value, date_range: undefined }));
              if (value) {
                setCalendarMonth(value);
                setSelectedReceivableDate(value.startOf('month'));
              }
            }}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <RangePicker
            value={travelFilters.date_range}
            style={{ width: '100%' }}
            placeholder={['开始日期', '结束日期']}
            onChange={(value) => {
              setTravelFilters((prev: any) => ({ ...prev, date_range: value, month: value ? undefined : prev.month }));
              if (value?.[0]) {
                setCalendarMonth(value[0]);
                setSelectedReceivableDate(value[0]);
              }
            }}
          />
        </Col>
        <Col xs={24} sm={12} lg={4}>
          <Select
            allowClear
            showSearch
            optionFilterProp="children"
            placeholder="按达人筛选"
            value={travelFilters.influencer_name}
            style={{ width: '100%' }}
            onChange={(value) => setTravelFilters((prev: any) => ({ ...prev, influencer_name: value }))}
          >
            {travelInfluencerOptions.map((name) => <Option key={name} value={name}>{name}</Option>)}
          </Select>
        </Col>
        <Col xs={24} sm={12} lg={4}>
          <Select
            allowClear
            showSearch
            optionFilterProp="children"
            placeholder="按品牌筛选"
            value={travelFilters.merchant_name}
            style={{ width: '100%' }}
            onChange={(value) => setTravelFilters((prev: any) => ({ ...prev, merchant_name: value }))}
          >
            {travelBrandOptions.map((name) => <Option key={name} value={name}>{name}</Option>)}
          </Select>
        </Col>
        <Col xs={24} sm={12} lg={3}>
          <Select
            allowClear
            showSearch
            optionFilterProp="children"
            placeholder="合作模式"
            value={travelFilters.brand_cooperation_mode}
            style={{ width: '100%' }}
            onChange={(value) => setTravelFilters((prev: any) => ({ ...prev, brand_cooperation_mode: value }))}
          >
            {travelModeOptions.map((name) => <Option key={name} value={name}>{name}</Option>)}
          </Select>
        </Col>
        <Col xs={24} sm={12} lg={3}>
          <Select
            allowClear
            placeholder="直播状态"
            value={travelFilters.status}
            style={{ width: '100%' }}
            onChange={(value) => setTravelFilters((prev: any) => ({ ...prev, status: value }))}
          >
            <Option value="scheduled">待开始</Option>
            <Option value="completed">已完成</Option>
          </Select>
        </Col>
        <Col xs={24} sm={12} lg={3}>
          <Button onClick={resetTravelFilters}>清除筛选</Button>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12} lg={6}>
          <Statistic title="总成本" value={travelFilterStats.totalCost} precision={2} prefix="SGD" />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Statistic title="应收" value={travelFilterStats.receivableTotal} precision={2} prefix="SGD" />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Statistic title="已收" value={travelFilterStats.receivedTotal} precision={2} prefix="SGD" valueStyle={{ color: '#237804' }} />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Statistic title="未收" value={travelFilterStats.unreceivedTotal} precision={2} prefix="SGD" valueStyle={{ color: '#cf1322' }} />
        </Col>
      </Row>
    </>
  );

  const renderTravelCostView = () => (
    <>
      <h2 style={{ margin: '0 0 16px' }}>达人机酒管理</h2>
      {renderTravelFilters()}
      <Tabs
        items={[
          { key: 'entry', label: '达人机酒录入', children: renderEntryView() },
          { key: 'costs', label: '达人行程成本', children: renderCostView() },
          { key: 'allocation', label: '达人机酒均摊', children: renderAllocationView() },
          { key: 'calendar', label: '品牌应收机酒', children: renderReceivableCalendar() },
          { key: 'receivables', label: '应收款项', children: renderReceivableEntryView() },
        ]}
      />
      <Modal
        title="修改行程成本金额"
        open={Boolean(editingTravelCostRecord)}
        onOk={saveTravelCostAmounts}
        onCancel={() => {
          setEditingTravelCostRecord(null);
          travelCostEditForm.resetFields();
        }}
      >
        <Form form={travelCostEditForm} layout="vertical">
          <Form.Item name="flight_cost" label="机票费用">
            <InputNumber<number> style={{ width: '100%' }} min={0} precision={2} prefix={editingTravelCostRecord?.currency || 'SGD'} onFocus={(event) => event.target.select()} />
          </Form.Item>
          <Form.Item name="hotel_cost" label="酒店费用">
            <InputNumber<number> style={{ width: '100%' }} min={0} precision={2} prefix={editingTravelCostRecord?.currency || 'SGD'} onFocus={(event) => event.target.select()} />
          </Form.Item>
          <Form.Item name="business_car_cost" label="商务车费用">
            <InputNumber<number> style={{ width: '100%' }} min={0} precision={2} prefix={editingTravelCostRecord?.currency || 'SGD'} onFocus={(event) => event.target.select()} />
          </Form.Item>
        </Form>
      </Modal>
      <Modal title="新增费用" open={Boolean(receptionRecord)} onOk={saveReceptionCosts} onCancel={() => setReceptionRecord(null)}>
        <Form form={receptionForm} layout="vertical">
          <Form.Item name="taxi_reception_cost" label="接待费用（日常打车)">
            <InputNumber<number> style={{ width: '100%' }} min={0} precision={2} prefix={receptionRecord?.currency || 'SGD'} onFocus={(event) => event.target.select()} />
          </Form.Item>
          <Form.Item name="meal_reception_cost" label="接待费用（日常吃喝)">
            <InputNumber<number> style={{ width: '100%' }} min={0} precision={2} prefix={receptionRecord?.currency || 'SGD'} onFocus={(event) => event.target.select()} />
          </Form.Item>
          <Form.Item name="internal_team_travel_cost" label="内部团队差旅费用（机票+酒店）">
            <InputNumber<number> style={{ width: '100%' }} min={0} precision={2} prefix={receptionRecord?.currency || 'SGD'} onFocus={(event) => event.target.select()} />
          </Form.Item>
        </Form>
      </Modal>
      <Modal
        title="修改实际应收机酒费用"
        open={Boolean(editingReceivableSession)}
        onOk={saveReceivableAmount}
        onCancel={() => {
          setEditingReceivableSession(null);
          receivableAmountForm.resetFields();
        }}
      >
        <Form form={receivableAmountForm} layout="vertical">
          <Form.Item name="brand_receivable" label="实际应收机酒费用">
            <InputNumber<number> style={{ width: '100%' }} min={0} precision={2} prefix="SGD" onFocus={(event) => event.target.select()} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );

  if (travelOnly) {
    return renderTravelCostView();
  }

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>新增财务记录</Button>
      </Space>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={6}><Statistic title="收入" value={stats.income} precision={2} prefix="SGD" /></Col>
        <Col xs={24} sm={6}><Statistic title="支出" value={stats.expense} precision={2} prefix="SGD" /></Col>
        <Col xs={24} sm={6}><Statistic title="利润" value={stats.profit} precision={2} prefix="SGD" valueStyle={{ color: stats.profit >= 0 ? '#3f8600' : '#cf1322' }} /></Col>
        <Col xs={24} sm={6}><Statistic title="待结算" value={stats.pending} precision={2} prefix="SGD" /></Col>
      </Row>

      <Tabs
        items={[
          {
            key: 'transactions',
            label: '财务记录',
            children: (
              <Table
                dataSource={transactions}
                rowKey="id"
                columns={[
                  { title: '日期', dataIndex: 'date', key: 'date', width: 120 },
                  { title: '类型', dataIndex: 'type', key: 'type', width: 100, render: (value) => value === 'income' ? <Tag color="green">收入</Tag> : <Tag color="red">支出</Tag> },
                  { title: '类别', dataIndex: 'category', key: 'category' },
                  { title: '对象', dataIndex: 'owner', key: 'owner' },
                  { title: '金额', dataIndex: 'amount', key: 'amount', align: 'right' as const, render: (value) => formatMoney(value) },
                  { title: '状态', dataIndex: 'status', key: 'status', width: 120, render: (value) => value === 'settled' ? <Tag color="green">已结算</Tag> : <Tag color="gold">待结算</Tag> },
                ]}
              />
            ),
          },
        ]}
      />

      <Modal title="新增财务记录" open={open} onOk={addTransaction} onCancel={() => setOpen(false)}>
        <Form form={form} layout="vertical">
          <Form.Item name="date" label="日期" rules={[{ required: true, message: '请选择日期' }]}><DatePicker style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="type" label="类型" rules={[{ required: true, message: '请选择类型' }]}>
            <Select><Option value="income">收入</Option><Option value="expense">支出</Option></Select>
          </Form.Item>
          <Form.Item name="category" label="类别" rules={[{ required: true, message: '请输入类别' }]}><Input placeholder="直播GMV结算、达人佣金、员工提成、样品物流" /></Form.Item>
          <Form.Item name="owner" label="对象"><Input placeholder="达人、员工、商家或场次" /></Form.Item>
          <Form.Item name="amount" label="金额" rules={[{ required: true, message: '请输入金额' }]}><InputNumber<number> style={{ width: '100%' }} min={0} precision={2} prefix="SGD" onFocus={(event) => event.target.select()} /></Form.Item>
          <Form.Item name="status" label="状态" initialValue="pending"><Select><Option value="pending">待结算</Option><Option value="settled">已结算</Option></Select></Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default FinanceManagement;
