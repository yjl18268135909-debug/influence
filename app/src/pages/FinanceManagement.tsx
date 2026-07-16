import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Calendar, Col, DatePicker, Form, Input, InputNumber, Modal, Popconfirm, Row, Select, Space, Statistic, Table, Tabs, Tag, message } from 'antd';
import { DeleteOutlined, EditOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import { exchangeRateApi, liveSessionApi, travelPayableApi, travelReceivableApi } from '../api';

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
const TRAVEL_CURRENCY = 'CNY';
const TRAVEL_SGD_CURRENCY = 'SGD';
const DEFAULT_TRAVEL_EXCHANGE_RATE = 5.35;
const DEFAULT_TRAVEL_COST_FORM_VALUES = { currency: 'CNY', exchange_rate: DEFAULT_TRAVEL_EXCHANGE_RATE, cabin_type: 'economy' };
const TRAVEL_RECEIVABLE_TYPE_OPTIONS = [
  { label: '应收达人', value: 'influencer' },
  { label: '应收品牌', value: 'brand' },
  { label: '应收其他', value: 'other' },
];
const DEFAULT_TRAVEL_RECEIVABLE_REASON_OPTIONS = ['机酒费用', '接待费用', '补差价', '退款', '其他'];
const TRAVEL_PAYABLE_TYPE_OPTIONS = [
  { label: '应付达人', value: 'influencer' },
  { label: '应付品牌/商家', value: 'brand' },
  { label: '应付员工', value: 'employee' },
  { label: '应付其他', value: 'other' },
];
const DEFAULT_TRAVEL_PAYABLE_REASON_OPTIONS = ['达人佣金', '品牌结算', '员工提成', '样品/物流', '投流费用', '机酒成本', '接待费用', '其他'];
const travelReceivableTypeLabel = (value: string) => TRAVEL_RECEIVABLE_TYPE_OPTIONS.find((item) => item.value === value)?.label || '-';
const travelPayableTypeLabel = (value: string) => TRAVEL_PAYABLE_TYPE_OPTIONS.find((item) => item.value === value)?.label || '-';
const receivableObjectLabel: Record<string, string> = {
  influencer: '达人名称',
  brand: '品牌名称',
  other: '应收对象',
};

const readStorage = <T,>(key: string, fallback: T): T => {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : fallback;
  } catch {
    return fallback;
  }
};

const formatMoney = (value: number | string | null | undefined, currency = 'SGD') => `${currency} ${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const formatTravelMoney = (value: number | string | null | undefined) => formatMoney(value, TRAVEL_CURRENCY);
const getTravelExchangeRate = (record?: any, fallbackRate = DEFAULT_TRAVEL_EXCHANGE_RATE) => {
  const rate = Number(record?.exchange_rate || 0);
  return rate > 1 ? rate : fallbackRate;
};
const formatTravelSgdMoney = (value: number | string | null | undefined, record?: any, fallbackRate = DEFAULT_TRAVEL_EXCHANGE_RATE) => formatMoney(Number(value || 0) / getTravelExchangeRate(record, fallbackRate), TRAVEL_SGD_CURRENCY);
const formatExchangeRate = (value: number) => Number(value || DEFAULT_TRAVEL_EXCHANGE_RATE).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
  receivablesOnly?: boolean;
  payablesOnly?: boolean;
}

const FinanceManagement: React.FC<FinanceManagementProps> = ({ travelOnly = false, receivablesOnly = false, payablesOnly = false }) => {
  const [transactions, setTransactions] = useState(initialTransactions);
  const [travelCostRecords, setTravelCostRecords] = useState<any[]>(() => readStorage(TRAVEL_COST_RECORDS_STORAGE_KEY, []));
  const [travelReceivableRecords, setTravelReceivableRecords] = useState<any[]>([]);
  const [travelPayableRecords, setTravelPayableRecords] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [loadingTravelReceivables, setLoadingTravelReceivables] = useState(false);
  const [loadingTravelPayables, setLoadingTravelPayables] = useState(false);
  const [savingTravelPayable, setSavingTravelPayable] = useState(false);
  const [loadingExchangeRate, setLoadingExchangeRate] = useState(false);
  const [exchangeRate, setExchangeRate] = useState(DEFAULT_TRAVEL_EXCHANGE_RATE);
  const [exchangeRateMeta, setExchangeRateMeta] = useState<any>({ source: '默认汇率', fallback: true });
  const [open, setOpen] = useState(false);
  const [receivableModalOpen, setReceivableModalOpen] = useState(false);
  const [payableModalOpen, setPayableModalOpen] = useState(false);
  const [receptionRecord, setReceptionRecord] = useState<any | null>(null);
  const [editingTravelCostRecord, setEditingTravelCostRecord] = useState<any | null>(null);
  const [editingTravelReceivableRecord, setEditingTravelReceivableRecord] = useState<any | null>(null);
  const [editingTravelPayableRecord, setEditingTravelPayableRecord] = useState<any | null>(null);
  const [editingCollectionDetail, setEditingCollectionDetail] = useState<any | null>(null);
  const [editingReceivableSession, setEditingReceivableSession] = useState<any | null>(null);
  const [receivedStatus, setReceivedStatus] = useState<Record<string, boolean>>(() => readStorage(TRAVEL_RECEIVED_STATUS_STORAGE_KEY, {}));
  const [calendarMonth, setCalendarMonth] = useState<Dayjs>(dayjs());
  const [selectedReceivableDate, setSelectedReceivableDate] = useState<Dayjs>(dayjs());
  const [travelFilters, setTravelFilters] = useState<any>({ month: dayjs() });
  const [receivableReasonFilter, setReceivableReasonFilter] = useState<string | undefined>();
  const [payableReasonFilter, setPayableReasonFilter] = useState<string | undefined>();
  const [form] = Form.useForm();
  const [travelCostForm] = Form.useForm();
  const [travelCostEditForm] = Form.useForm();
  const [travelReceivableForm] = Form.useForm();
  const [travelPayableForm] = Form.useForm();
  const [receptionForm] = Form.useForm();
  const [receivableAmountForm] = Form.useForm();
  const [collectionDetailForm] = Form.useForm();
  const savingTravelPayableRef = useRef(false);
  const watchedTravelValues = Form.useWatch([], travelCostForm);
  const watchedReceivableType = Form.useWatch('receivable_type', travelReceivableForm);

  useEffect(() => {
    fetchSessions();
    fetchTravelReceivables();
    fetchTravelPayables();
    fetchExchangeRate();
    const draft = readStorage<any | null>(TRAVEL_COST_DRAFT_STORAGE_KEY, null);
    travelCostForm.setFieldsValue({
      ...(draft ? deserializeTravelCostDraft(draft) : DEFAULT_TRAVEL_COST_FORM_VALUES),
      currency: 'CNY',
      exchange_rate: DEFAULT_TRAVEL_EXCHANGE_RATE,
    });
  }, []);

  useEffect(() => {
    localStorage.setItem(TRAVEL_COST_RECORDS_STORAGE_KEY, JSON.stringify(travelCostRecords));
  }, [travelCostRecords]);

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

  const fetchTravelReceivables = async () => {
    setLoadingTravelReceivables(true);
    try {
      const res = await travelReceivableApi.getAll();
      const serverRecords = Array.isArray(res.data?.data) ? res.data.data : [];
      const localRecords = readStorage<any[]>(TRAVEL_RECEIVABLE_RECORDS_STORAGE_KEY, []);

      if (!serverRecords.length && localRecords.length) {
        const migratedRecords = [];
        for (const item of localRecords) {
          const payload = {
            receivable_date: item.receivable_date || dayjs().format('YYYY-MM-DD'),
            receivable_type: item.receivable_type
              || (Number(item.influencer_receivable || 0) > 0 ? 'influencer' : Number(item.other_receivable || 0) > 0 ? 'other' : 'brand'),
            object_name: item.object_name || null,
            reason: item.reason || null,
            amount: item.receivable_type ? Number(item.amount || 0) : getLegacyReceivableAmount(item),
            notes: item.notes || '',
            received_amount: Number(item.received_amount || 0),
            payment_notes: item.payment_notes || '',
            is_bad_debt: Boolean(item.is_bad_debt),
          };
          const created = await travelReceivableApi.create(payload);
          if (created.data?.data) migratedRecords.push(created.data.data);
        }
        localStorage.setItem(`${TRAVEL_RECEIVABLE_RECORDS_STORAGE_KEY}_backup`, JSON.stringify(localRecords));
        localStorage.removeItem(TRAVEL_RECEIVABLE_RECORDS_STORAGE_KEY);
        setTravelReceivableRecords(migratedRecords);
        message.success('已把本机缓存的应收款项迁移到数据库');
        return;
      }

      setTravelReceivableRecords(serverRecords);
    } catch (error) {
      console.error('获取应收款项失败:', error);
      message.error('获取应收款项失败');
      const localRecords = readStorage<any[]>(TRAVEL_RECEIVABLE_RECORDS_STORAGE_KEY, []);
      if (localRecords.length) setTravelReceivableRecords(localRecords);
    } finally {
      setLoadingTravelReceivables(false);
    }
  };

  const fetchTravelPayables = async () => {
    setLoadingTravelPayables(true);
    try {
      const res = await travelPayableApi.getAll();
      setTravelPayableRecords(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch (error) {
      console.error('获取应付款项失败:', error);
      message.error('获取应付款项失败');
    } finally {
      setLoadingTravelPayables(false);
    }
  };

  const fetchExchangeRate = async () => {
    setLoadingExchangeRate(true);
    try {
      const res = await exchangeRateApi.getSgdToCny();
      const data = res.data?.data || {};
      const nextRate = Number(data.rate || DEFAULT_TRAVEL_EXCHANGE_RATE);
      const safeRate = nextRate > 0 ? nextRate : DEFAULT_TRAVEL_EXCHANGE_RATE;
      setExchangeRate(safeRate);
      setExchangeRateMeta(data);
      travelCostForm.setFieldValue('exchange_rate', safeRate);
    } catch (error) {
      console.error('获取汇率失败:', error);
      setExchangeRate(DEFAULT_TRAVEL_EXCHANGE_RATE);
      setExchangeRateMeta({ source: '默认汇率', fallback: true });
      travelCostForm.setFieldValue('exchange_rate', DEFAULT_TRAVEL_EXCHANGE_RATE);
      message.warning('获取今日汇率失败，已使用默认汇率');
    } finally {
      setLoadingExchangeRate(false);
    }
  };

  const resetTravelCostDraft = async () => {
    localStorage.removeItem(TRAVEL_COST_DRAFT_STORAGE_KEY);
    travelCostForm.resetFields();
    travelCostForm.setFieldsValue({ ...DEFAULT_TRAVEL_COST_FORM_VALUES, exchange_rate: exchangeRate });
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

  const getLegacyReceivableAmount = (record: any) => (
    Number(record.influencer_receivable || 0)
    + Number(record.brand_receivable || 0)
    + Number(record.other_receivable || 0)
  );

  const getReceivableAmount = (record: any) => (
    record.receivable_type ? Number(record.amount || 0) : getLegacyReceivableAmount(record)
  );

  const isBadDebt = (record: any) => record?.is_bad_debt === true || Number(record?.is_bad_debt) === 1;
  const getReceivedAmount = (record: any) => Math.min(Number(record?.received_amount || 0), Number(record?.amount || 0));
  const getOutstandingAmount = (record: any) => Math.max(Number(record?.amount || 0) - getReceivedAmount(record), 0);

  const receivableStats = useMemo(() => {
    const influencerTotal = travelReceivableRecords.reduce((sum, item) => {
      if (item.receivable_type) return sum + (item.receivable_type === 'influencer' ? Number(item.amount || 0) : 0);
      return sum + Number(item.influencer_receivable || 0);
    }, 0);
    const manualBrandTotal = travelReceivableRecords.reduce((sum, item) => {
      if (item.receivable_type) return sum + (item.receivable_type === 'brand' ? Number(item.amount || 0) : 0);
      return sum + Number(item.brand_receivable || 0);
    }, 0);
    const sessionBrandTotal = sessions
      .filter((item) => item.schedule_type !== 'travel_note')
      .reduce((sum, item) => sum + Number(item.brand_receivable || 0), 0);
    const otherTotal = travelReceivableRecords.reduce((sum, item) => {
      if (item.receivable_type) return sum + (item.receivable_type === 'other' ? Number(item.amount || 0) : 0);
      return sum + Number(item.other_receivable || 0);
    }, 0);
    const brandTotal = manualBrandTotal + sessionBrandTotal;
    const manualReceivedTotal = travelReceivableRecords.reduce(
      (sum, item) => sum + Math.min(Number(item.received_amount || 0), getReceivableAmount(item)),
      0,
    );
    const sessionReceivableRecords = sessions
      .filter((item) => item.schedule_type !== 'travel_note')
      .filter((item) => Number(item.brand_receivable || 0) > 0);
    const sessionReceivedTotal = sessionReceivableRecords.reduce(
      (sum, item) => sum + Math.min(Number(item.received_amount || 0), Number(item.brand_receivable || 0)),
      0,
    );
    const badDebtTotal = travelReceivableRecords.reduce((sum, item) => (
      isBadDebt(item)
        ? sum + Math.max(getReceivableAmount(item) - Number(item.received_amount || 0), 0)
        : sum
    ), 0) + sessionReceivableRecords.reduce((sum, item) => (
      isBadDebt(item)
        ? sum + Math.max(Number(item.brand_receivable || 0) - Number(item.received_amount || 0), 0)
        : sum
    ), 0);
    const total = influencerTotal + brandTotal + otherTotal;
    const receivedTotal = manualReceivedTotal + sessionReceivedTotal;
    return {
      influencerTotal,
      brandTotal,
      otherTotal,
      total,
      receivedTotal,
      outstandingTotal: Math.max(total - receivedTotal, 0),
      badDebtTotal,
    };
  }, [travelReceivableRecords, sessions]);

  const isPayablePaid = (record: any) => record?.is_paid === true || Number(record?.is_paid) === 1;
  const getPaidAmount = (record: any) => Math.min(Number(record?.paid_amount || 0), Number(record?.amount || 0));
  const getPayableOutstandingAmount = (record: any) => Math.max(Number(record?.amount || 0) - getPaidAmount(record), 0);

  const travelPayableReasonOptions = useMemo(() => {
    const reasons = travelPayableRecords.map((item) => item.reason).filter(Boolean);
    return Array.from(new Set([...DEFAULT_TRAVEL_PAYABLE_REASON_OPTIONS, ...reasons])).sort((a, b) => a.localeCompare(b));
  }, [travelPayableRecords]);

  const filteredTravelPayableRecords = useMemo(
    () => travelPayableRecords.filter((item) => !payableReasonFilter || item.reason === payableReasonFilter),
    [travelPayableRecords, payableReasonFilter],
  );

  const payableReasonFilterTotal = useMemo(
    () => filteredTravelPayableRecords.reduce((sum, item) => sum + Number(item.amount || 0), 0),
    [filteredTravelPayableRecords],
  );

  const payableStats = useMemo(() => {
    const total = travelPayableRecords.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const paidTotal = travelPayableRecords.reduce((sum, item) => sum + getPaidAmount(item), 0);
    const settledCount = travelPayableRecords.filter((item) => isPayablePaid(item) || getPayableOutstandingAmount(item) <= 0).length;
    return {
      total,
      paidTotal,
      outstandingTotal: Math.max(total - paidTotal, 0),
      settledCount,
      pendingCount: Math.max(travelPayableRecords.length - settledCount, 0),
    };
  }, [travelPayableRecords]);

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
    const currency = 'CNY';
    const currentExchangeRate = getTravelExchangeRate(values, exchangeRate);
    const range = values.date_range;
    const influencerName = values.influencer_name;
    const baseCost = ['flight_cost', 'hotel_cost', 'business_car_cost'].reduce((sum, key) => sum + Number(values[key] || 0), 0);
    const flightHotelBaseCost = Number(values.flight_cost || 0) + Number(values.hotel_cost || 0);
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
    const totalCost = baseCost;
    const flightHotelCost = flightHotelBaseCost;

    return {
      currency,
      exchangeRate: currentExchangeRate,
      totalCost,
      totalCostSgd: totalCost / currentExchangeRate,
      flightHotelCost,
      flightHotelCostSgd: flightHotelCost / currentExchangeRate,
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
    const record = {
      id: `TC${Date.now()}`,
      created_at: dayjs().format('YYYY-MM-DD HH:mm:ss'),
      influencer_name: values.influencer_name,
      date_start: startDate.format('YYYY-MM-DD'),
      date_end: endDate.format('YYYY-MM-DD'),
      cabin_type: values.cabin_type,
      currency: travelCostSummary.currency,
      exchange_rate: travelCostSummary.exchangeRate,
      flight_cost: Number(values.flight_cost || 0),
      hotel_cost: Number(values.hotel_cost || 0),
      business_car_cost: Number(values.business_car_cost || 0),
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
    travelCostForm.setFieldsValue({ ...DEFAULT_TRAVEL_COST_FORM_VALUES, exchange_rate: exchangeRate });
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
        currency: TRAVEL_CURRENCY,
        exchange_rate: getTravelExchangeRate(item),
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
        currency: TRAVEL_CURRENCY,
        exchange_rate: getTravelExchangeRate(item),
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

  const getRecordTravelReceivableTotals = (record: any) => {
    const receivableSessions = getRecordReceivableSessions(record);
    const actualReceivableTotal = receivableSessions.reduce((sum, item) => sum + Number(item.brand_receivable || 0), 0);
    const actualReceivedTotal = receivableSessions
      .filter((item) => receivedStatus[getSessionReceivedKey(item)])
      .reduce((sum, item) => sum + Number(item.brand_receivable || 0), 0);
    return { receivableSessions, actualReceivableTotal, actualReceivedTotal };
  };

  const getBrandAllocationRows = () => filteredTravelCostRecords.map((record) => {
    const { receivableSessions, actualReceivableTotal, actualReceivedTotal } = getRecordTravelReceivableTotals(record);
    const receivableBrandCount = new Set(receivableSessions
      .filter((item) => Number(item.brand_receivable || 0) > 0)
      .map(sessionBrand)).size;
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
      actual_received_total: actualReceivedTotal,
      currency: TRAVEL_CURRENCY,
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

  const saveTravelReceivableRecord = async () => {
    try {
      const values = await travelReceivableForm.validateFields();
      const reason = Array.isArray(values.reason) ? values.reason[0] : values.reason;
      const payload = {
        receivable_date: values.receivable_date?.format('YYYY-MM-DD') || dayjs().format('YYYY-MM-DD'),
        receivable_type: values.receivable_type,
        object_name: values.object_name,
        reason,
        amount: Number(values.amount || 0),
        notes: values.notes || '',
        received_amount: Number(editingTravelReceivableRecord?.received_amount || 0),
        payment_notes: editingTravelReceivableRecord?.payment_notes || '',
        is_bad_debt: Boolean(editingTravelReceivableRecord?.is_bad_debt),
      };
      const response = editingTravelReceivableRecord
        ? await travelReceivableApi.update(editingTravelReceivableRecord.id, payload)
        : await travelReceivableApi.create(payload);
      const savedRecord = response.data?.data;

      setTravelReceivableRecords((prev) => (
        editingTravelReceivableRecord
          ? prev.map((item) => String(item.id) === String(editingTravelReceivableRecord.id) ? savedRecord : item)
          : [savedRecord, ...prev]
      ));
      travelReceivableForm.resetFields();
      travelReceivableForm.setFieldsValue({ receivable_date: dayjs(), receivable_type: 'brand' });
      setEditingTravelReceivableRecord(null);
      setReceivableModalOpen(false);
      message.success(editingTravelReceivableRecord ? '应收款项已更新' : '应收款项已新增');
    } catch (error: any) {
      if (error?.errorFields) return;
      console.error('保存应收款项失败:', error);
      message.error('保存应收款项失败');
    }
  };

  const openTravelReceivableEditModal = (record: any) => {
    const receivableType = record.receivable_type
      || (Number(record.influencer_receivable || 0) > 0 ? 'influencer' : Number(record.other_receivable || 0) > 0 ? 'other' : 'brand');
    setEditingTravelReceivableRecord(record);
    travelReceivableForm.setFieldsValue({
      receivable_date: record.receivable_date ? dayjs(record.receivable_date) : dayjs(),
      receivable_type: receivableType,
      object_name: record.object_name,
      reason: record.reason ? [record.reason] : undefined,
      amount: getReceivableAmount(record),
      notes: record.notes || '',
    });
    setReceivableModalOpen(true);
  };

  const deleteTravelReceivableRecord = async (id: string) => {
    try {
      await travelReceivableApi.delete(id);
      setTravelReceivableRecords((prev) => prev.filter((item) => String(item.id) !== String(id)));
      message.success('应收款项记录已删除');
    } catch (error) {
      console.error('删除应收款项失败:', error);
      message.error('删除应收款项失败');
    }
  };

  const saveTravelPayableRecord = async () => {
    if (savingTravelPayableRef.current) return;
    savingTravelPayableRef.current = true;
    setSavingTravelPayable(true);
    try {
      const values = await travelPayableForm.validateFields();
      const reason = Array.isArray(values.reason) ? values.reason[0] : values.reason;
      const amount = Number(values.amount || 0);
      const paidAmount = Number(values.paid_amount || 0);
      const payload = {
        payable_date: values.payable_date?.format('YYYY-MM-DD') || dayjs().format('YYYY-MM-DD'),
        payable_type: values.payable_type,
        object_name: values.object_name || '',
        reason,
        amount,
        notes: values.notes || '',
        paid_amount: paidAmount,
        payment_notes: values.payment_notes || '',
        is_paid: values.is_paid === true || values.is_paid === 'yes' || paidAmount >= amount,
      };
      const response = editingTravelPayableRecord
        ? await travelPayableApi.update(editingTravelPayableRecord.id, payload)
        : await travelPayableApi.create(payload);
      const savedRecord = response.data?.data;

      setTravelPayableRecords((prev) => (
        editingTravelPayableRecord
          ? prev.map((item) => String(item.id) === String(editingTravelPayableRecord.id) ? savedRecord : item)
          : [savedRecord, ...prev]
      ));
      travelPayableForm.resetFields();
      travelPayableForm.setFieldsValue({ payable_date: dayjs(), payable_type: 'brand', is_paid: false });
      setEditingTravelPayableRecord(null);
      setPayableModalOpen(false);
      message.success(editingTravelPayableRecord ? '应付款项已更新' : '应付款项已新增');
    } catch (error: any) {
      if (error?.errorFields) return;
      console.error('保存应付款项失败:', error);
      message.error('保存应付款项失败');
    } finally {
      savingTravelPayableRef.current = false;
      setSavingTravelPayable(false);
    }
  };

  const openTravelPayableEditModal = (record: any) => {
    setEditingTravelPayableRecord(record);
    travelPayableForm.setFieldsValue({
      payable_date: record.payable_date ? dayjs(record.payable_date) : dayjs(),
      payable_type: record.payable_type || 'brand',
      object_name: record.object_name || '',
      reason: record.reason ? [record.reason] : undefined,
      amount: Number(record.amount || 0),
      notes: record.notes || '',
      paid_amount: Number(record.paid_amount || 0),
      payment_notes: record.payment_notes || '',
      is_paid: isPayablePaid(record),
    });
    setPayableModalOpen(true);
  };

  const deleteTravelPayableRecord = async (id: string) => {
    try {
      await travelPayableApi.delete(id);
      setTravelPayableRecords((prev) => prev.filter((item) => String(item.id) !== String(id)));
      message.success('应付款项记录已删除');
    } catch (error) {
      console.error('删除应付款项失败:', error);
      message.error('删除应付款项失败');
    }
  };

  const travelReceivableReasonOptions = useMemo(() => {
    const reasons = travelReceivableRecords.map((item) => item.reason).filter(Boolean);
    return Array.from(new Set([...DEFAULT_TRAVEL_RECEIVABLE_REASON_OPTIONS, ...reasons])).sort((a, b) => a.localeCompare(b));
  }, [travelReceivableRecords]);

  const filteredTravelReceivableRecords = useMemo(
    () => travelReceivableRecords.filter((item) => !receivableReasonFilter || item.reason === receivableReasonFilter),
    [travelReceivableRecords, receivableReasonFilter],
  );

  const openCollectionDetailModal = (detail: any) => {
    setEditingCollectionDetail(detail);
    collectionDetailForm.setFieldsValue({
      received_amount: Number(detail.received_amount || 0),
      payment_notes: detail.payment_notes || '',
      is_bad_debt: isBadDebt(detail),
    });
  };

  const saveCollectionDetail = async () => {
    if (!editingCollectionDetail) return;
    try {
      const values = await collectionDetailForm.validateFields();
      const collectionValues = {
        received_amount: Number(values.received_amount || 0),
        payment_notes: values.payment_notes || '',
        is_bad_debt: Boolean(values.is_bad_debt),
      };

      if (editingCollectionDetail.source_type === 'session') {
        const sourceRecord = editingCollectionDetail.source_record;
        await liveSessionApi.update(sourceRecord.id, { ...sourceRecord, ...collectionValues });
        setSessions((prev) => prev.map((item) => (
          String(item.id) === String(sourceRecord.id) ? { ...item, ...collectionValues } : item
        )));
      } else {
        const sourceRecord = editingCollectionDetail.source_record;
        const response = await travelReceivableApi.update(sourceRecord.id, { ...sourceRecord, ...collectionValues });
        const savedRecord = response.data?.data || { ...sourceRecord, ...collectionValues };
        setTravelReceivableRecords((prev) => prev.map((item) => (
          String(item.id) === String(sourceRecord.id) ? savedRecord : item
        )));
      }

      setEditingCollectionDetail(null);
      collectionDetailForm.resetFields();
      message.success('回款信息已保存');
    } catch (error: any) {
      if (error?.errorFields) return;
      console.error('保存回款信息失败:', error);
      message.error('保存回款信息失败');
    }
  };

  const receivableReasonFilterTotal = useMemo(
    () => filteredTravelReceivableRecords.reduce((sum, item) => sum + getReceivableAmount(item), 0),
    [filteredTravelReceivableRecords],
  );

  const getReceivableObjectName = (record: any) => record.object_name || '-';

  const getLegacyReceivableTypeText = (record: any) => {
    const types = [];
    if (Number(record.influencer_receivable || 0) > 0) types.push('应收达人');
    if (Number(record.brand_receivable || 0) > 0) types.push('应收品牌');
    if (Number(record.other_receivable || 0) > 0) types.push('应收其他');
    return types.join(' / ') || '-';
  };

  const receivableBrandSummaryRows = useMemo(() => {
    const groups = new Map<string, any>();
    const addDetail = (brandName: string, detail: any) => {
      const key = brandName || '未填写品牌';
      const current = groups.get(key) || { key, object_name: key, total_amount: 0, received_amount: 0, outstanding_amount: 0, bad_debt_amount: 0, detail_count: 0, details: [] };
      current.total_amount += Number(detail.amount || 0);
      current.received_amount += getReceivedAmount(detail);
      current.outstanding_amount += getOutstandingAmount(detail);
      if (isBadDebt(detail)) current.bad_debt_amount += getOutstandingAmount(detail);
      current.detail_count += 1;
      current.details.push(detail);
      groups.set(key, current);
    };

    travelReceivableRecords.forEach((record) => {
      if (record.receivable_type === 'brand') {
        addDetail(record.object_name || '未填写品牌', {
          id: record.id,
          source: '手动录入',
          date: record.receivable_date,
          influencer_name: '-',
          reason: record.reason || '-',
          amount: Number(record.amount || 0),
          notes: record.notes || '-',
          received_amount: Number(record.received_amount || 0),
          payment_notes: record.payment_notes || '',
          is_bad_debt: isBadDebt(record),
          source_type: 'manual',
          source_record: record,
        });
        return;
      }
      if (!record.receivable_type && Number(record.brand_receivable || 0) > 0) {
        addDetail(record.object_name || '未填写品牌', {
          id: record.id,
          source: '旧记录',
          date: record.receivable_date,
          influencer_name: '-',
          reason: record.reason || '-',
          amount: Number(record.brand_receivable || 0),
          notes: record.notes || '-',
          received_amount: Number(record.received_amount || 0),
          payment_notes: record.payment_notes || '',
          is_bad_debt: isBadDebt(record),
          source_type: 'manual',
          source_record: record,
        });
      }
    });

    sessions
      .filter((item) => item.schedule_type !== 'travel_note')
      .filter((item) => Number(item.brand_receivable || 0) > 0)
      .forEach((item) => {
        addDetail(sessionBrand(item), {
          id: `session-${item.id || `${item.session_date}-${item.influencer_name}-${sessionBrand(item)}`}`,
          source: '应收机酒成本',
          date: item.session_date,
          influencer_name: item.influencer_name || '未填写达人',
          reason: '应收机酒成本',
          amount: Number(item.brand_receivable || 0),
          notes: sessionMode(item),
          received_amount: Number(item.received_amount || 0),
          payment_notes: item.payment_notes || '',
          is_bad_debt: isBadDebt(item),
          source_type: 'session',
          source_record: item,
        });
      });

    return Array.from(groups.values()).sort((a, b) => b.total_amount - a.total_amount);
  }, [travelReceivableRecords, sessions]);

  const receivableInfluencerSummaryRows = useMemo(() => {
    const groups = new Map<string, any>();
    const addDetail = (influencerName: string, detail: any) => {
      const key = influencerName || '未填写达人';
      const current = groups.get(key) || { key, object_name: key, total_amount: 0, received_amount: 0, outstanding_amount: 0, bad_debt_amount: 0, detail_count: 0, details: [] };
      current.total_amount += Number(detail.amount || 0);
      current.received_amount += getReceivedAmount(detail);
      current.outstanding_amount += getOutstandingAmount(detail);
      if (isBadDebt(detail)) current.bad_debt_amount += getOutstandingAmount(detail);
      current.detail_count += 1;
      current.details.push(detail);
      groups.set(key, current);
    };

    travelReceivableRecords.forEach((record) => {
      if (record.receivable_type === 'influencer') {
        addDetail(record.object_name || '未填写达人', {
          id: record.id,
          source: '手动录入',
          date: record.receivable_date,
          reason: record.reason || '-',
          amount: Number(record.amount || 0),
          notes: record.notes || '-',
          received_amount: Number(record.received_amount || 0),
          payment_notes: record.payment_notes || '',
          is_bad_debt: isBadDebt(record),
          source_type: 'manual',
          source_record: record,
        });
        return;
      }
      if (!record.receivable_type && Number(record.influencer_receivable || 0) > 0) {
        addDetail(record.object_name || '未填写达人', {
          id: record.id,
          source: '旧记录',
          date: record.receivable_date,
          reason: record.reason || '-',
          amount: Number(record.influencer_receivable || 0),
          notes: record.notes || '-',
          received_amount: Number(record.received_amount || 0),
          payment_notes: record.payment_notes || '',
          is_bad_debt: isBadDebt(record),
          source_type: 'manual',
          source_record: record,
        });
      }
    });

    return Array.from(groups.values()).sort((a, b) => b.total_amount - a.total_amount);
  }, [travelReceivableRecords]);

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
          <Col xs={24} md={8}>
            <Form.Item label="录入币种">
              <Input value="人民币（CNY）" disabled />
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
          <Col xs={24} md={8}><Form.Item name="flight_cost" label="机票费用"><InputNumber<number> style={{ width: '100%' }} min={0} precision={2} prefix="CNY" onFocus={(event) => event.target.select()} /></Form.Item></Col>
          <Col xs={24} md={8}><Form.Item name="hotel_cost" label="酒店费用"><InputNumber<number> style={{ width: '100%' }} min={0} precision={2} prefix="CNY" onFocus={(event) => event.target.select()} /></Form.Item></Col>
          <Col xs={24} md={8}><Form.Item name="business_car_cost" label="商务车费用"><InputNumber<number> style={{ width: '100%' }} min={0} precision={2} prefix="CNY" onFocus={(event) => event.target.select()} /></Form.Item></Col>
        </Row>
        <Space style={{ marginBottom: 16 }}>
          <Button type="primary" onClick={addTravelCostRecord}>确定录入</Button>
        </Space>
      </Form>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}><Statistic title="自动总成本（人民币）" value={travelCostSummary.totalCost} precision={2} prefix={travelCostSummary.currency} /></Col>
        <Col xs={24} sm={12} lg={6}><Statistic title="自动总成本（新币）" value={travelCostSummary.totalCostSgd} precision={2} prefix={TRAVEL_SGD_CURRENCY} /></Col>
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
      scroll={{ x: 2150 }}
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
              <span>{formatTravelMoney(value)}</span>
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
              <span>{formatTravelMoney(value)}</span>
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
              <span>{formatTravelMoney(value)}</span>
              <Button type="text" size="small" icon={<EditOutlined />} onClick={() => openTravelCostEditModal(record)} />
            </Space>
          ),
        },
        { title: '接待打车', dataIndex: 'taxi_reception_cost', key: 'taxi_reception_cost', width: 120, render: (value) => formatTravelMoney(value) },
        { title: '接待吃喝', dataIndex: 'meal_reception_cost', key: 'meal_reception_cost', width: 120, render: (value) => formatTravelMoney(value) },
        { title: '内部团队差旅费用（机票+酒店）', dataIndex: 'internal_team_travel_cost', key: 'internal_team_travel_cost', width: 220, render: (value) => formatTravelMoney(value) },
        { title: '自动总成本（新币）', key: 'total_cost_sgd', width: 160, render: (_, record) => formatTravelSgdMoney(record.total_cost || getRecordTotalCost(record), record, exchangeRate) },
        { title: '自动总成本（人民币）', dataIndex: 'total_cost', key: 'total_cost', width: 170, render: (value, record) => formatTravelMoney(value || getRecordTotalCost(record)) },
        {
          title: '实际应收机酒合计',
          key: 'actual_receivable_total',
          width: 170,
          render: (_, record) => formatTravelMoney(getRecordTravelReceivableTotals(record).actualReceivableTotal),
        },
        {
          title: '实际已收机酒合计',
          key: 'actual_received_total',
          width: 170,
          render: (_, record) => formatTravelMoney(getRecordTravelReceivableTotals(record).actualReceivedTotal),
        },
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
                    <span>{formatTravelMoney(value)}</span>
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
        { title: '单场机酒均摊', dataIndex: 'per_session_flight_hotel_cost', key: 'per_session_flight_hotel_cost', width: 140, render: (value) => formatTravelMoney(value) },
        { title: 'TAP机酒均摊', dataIndex: 'per_tap_flight_hotel_cost', key: 'per_tap_flight_hotel_cost', width: 140, render: (value) => formatTravelMoney(value) },
        { title: '实际应收品牌数', dataIndex: 'receivable_brand_count', key: 'receivable_brand_count', width: 140 },
        { title: '实际应收机酒合计', dataIndex: 'actual_receivable_total', key: 'actual_receivable_total', width: 160, render: (value) => formatTravelMoney(value) },
        { title: '实际已收机酒合计', dataIndex: 'actual_received_total', key: 'actual_received_total', width: 160, render: (value) => formatTravelMoney(value) },
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
                <strong>{formatTravelMoney(receivableTotal)}</strong>
              </div>
              <div className="receivable-cell-block receivable-cell-paid">
                <span>已收</span>
                <strong>{formatTravelMoney(receivedTotal)}</strong>
              </div>
              <div className="receivable-cell-block receivable-cell-unpaid">
                <span>未收</span>
                <strong>{formatTravelMoney(unreceivedTotal)}</strong>
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
              应收 {formatTravelMoney(getReceivableTotal(getCalendarReceivableItems(selectedReceivableDate)))}
            </span>
            <span style={{ marginLeft: 12, color: 'rgba(0, 0, 0, 0.45)', fontSize: 14 }}>
              已收 {formatTravelMoney(getReceivedTotal(getCalendarReceivableItems(selectedReceivableDate)))}
            </span>
            <span style={{ marginLeft: 12, color: 'rgba(0, 0, 0, 0.45)', fontSize: 14 }}>
              未收 {formatTravelMoney(getUnreceivedTotal(getCalendarReceivableItems(selectedReceivableDate)))}
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
              { title: '实际应收机酒费用', dataIndex: 'brand_receivable', key: 'brand_receivable', width: 170, render: (value) => formatTravelMoney(value) },
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
      <Space style={{ marginBottom: 16 }}>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            setEditingTravelReceivableRecord(null);
            travelReceivableForm.resetFields();
            travelReceivableForm.setFieldsValue({ receivable_date: dayjs(), receivable_type: 'brand' });
            setReceivableModalOpen(true);
          }}
        >
          新增应收款项
        </Button>
      </Space>

      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12} lg={6}>
          <Select
            allowClear
            showSearch
            optionFilterProp="children"
            placeholder="按款项原因筛选"
            value={receivableReasonFilter}
            style={{ width: '100%' }}
            onChange={setReceivableReasonFilter}
          >
            {travelReceivableReasonOptions.map((reason) => <Option key={reason} value={reason}>{reason}</Option>)}
          </Select>
        </Col>
        <Col xs={24} sm={12} lg={4}>
          <Button onClick={() => setReceivableReasonFilter(undefined)}>清除原因筛选</Button>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Statistic
            title={receivableReasonFilter ? `${receivableReasonFilter}总计` : '当前列表总计'}
            value={receivableReasonFilterTotal}
            precision={2}
            prefix={TRAVEL_CURRENCY}
          />
        </Col>
      </Row>

      <Table
        dataSource={filteredTravelReceivableRecords}
        rowKey="id"
        loading={loadingTravelReceivables}
        pagination={{ pageSize: 10 }}
        locale={{ emptyText: '暂无应收款项记录' }}
        columns={[
          { title: '录入时间', dataIndex: 'created_at', key: 'created_at', width: 170 },
          { title: '录入日期', dataIndex: 'receivable_date', key: 'receivable_date', width: 120 },
          {
            title: '款项类型',
            dataIndex: 'receivable_type',
            key: 'receivable_type',
            width: 130,
            render: (value, record) => value ? travelReceivableTypeLabel(value) : getLegacyReceivableTypeText(record),
          },
          {
            title: '款项原因',
            dataIndex: 'reason',
            key: 'reason',
            width: 150,
            render: (value) => value || '-',
          },
          {
            title: '应收对象',
            dataIndex: 'object_name',
            key: 'object_name',
            width: 160,
            render: (_, record) => getReceivableObjectName(record),
          },
          {
            title: '金额',
            dataIndex: 'amount',
            key: 'amount',
            width: 140,
            render: (_, record) => formatTravelMoney(getReceivableAmount(record)),
          },
          {
            title: '款项备注',
            dataIndex: 'notes',
            key: 'notes',
            render: (value) => value || '-',
          },
          {
            title: '操作',
            key: 'action',
            width: 170,
            render: (_, record) => (
              <Space>
                <Button type="link" icon={<EditOutlined />} onClick={() => openTravelReceivableEditModal(record)}>修改</Button>
                <Popconfirm title="确定删除这条应收款项记录吗？" onConfirm={() => deleteTravelReceivableRecord(record.id)}>
                  <Button type="link" danger icon={<DeleteOutlined />}>删除</Button>
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />
    </>
  );

  const renderBrandReceivableSummaryView = () => (
    <Table
      dataSource={receivableBrandSummaryRows}
      rowKey="key"
      pagination={{ pageSize: 10 }}
      locale={{ emptyText: '暂无品牌应收汇总' }}
      columns={[
        { title: '品牌名称', dataIndex: 'object_name', key: 'object_name', width: 220 },
        { title: '应收明细数', dataIndex: 'detail_count', key: 'detail_count', width: 120 },
        { title: '应收总额', dataIndex: 'total_amount', key: 'total_amount', width: 160, render: (value) => formatTravelMoney(value) },
        { title: '已收合计', dataIndex: 'received_amount', key: 'received_amount', width: 160, render: (value) => formatTravelMoney(value) },
        { title: '剩余未回款', dataIndex: 'outstanding_amount', key: 'outstanding_amount', width: 160, render: (value) => formatTravelMoney(value) },
        { title: '坏账合计', dataIndex: 'bad_debt_amount', key: 'bad_debt_amount', width: 160, render: (value) => formatTravelMoney(value) },
      ]}
      expandable={{
        expandedRowRender: (record) => (
          <Table
            dataSource={record.details}
            rowKey="id"
            pagination={false}
            size="small"
            columns={[
              { title: '来源', dataIndex: 'source', key: 'source', width: 130 },
              { title: '日期', dataIndex: 'date', key: 'date', width: 120 },
              { title: '达人', dataIndex: 'influencer_name', key: 'influencer_name', width: 140 },
              { title: '款项原因', dataIndex: 'reason', key: 'reason', width: 150 },
              { title: '金额', dataIndex: 'amount', key: 'amount', width: 140, render: (value) => formatTravelMoney(value) },
              { title: '备注', dataIndex: 'notes', key: 'notes', render: (value) => value || '-' },
              { title: '已收金额', dataIndex: 'received_amount', key: 'received_amount', width: 140, render: (value) => formatTravelMoney(value) },
              { title: '剩余未回款', key: 'outstanding_amount', width: 150, render: (_, detail) => formatTravelMoney(getOutstandingAmount(detail)) },
              { title: '收款备注', dataIndex: 'payment_notes', key: 'payment_notes', width: 180, render: (value) => value || '-' },
              { title: '是否坏账', dataIndex: 'is_bad_debt', key: 'is_bad_debt', width: 110, render: (_, detail) => isBadDebt(detail) ? <Tag color="red">是</Tag> : <Tag>否</Tag> },
              { title: '操作', key: 'collection_action', width: 110, fixed: 'right' as const, render: (_, detail) => <Button type="link" icon={<EditOutlined />} onClick={() => openCollectionDetailModal(detail)}>修改</Button> },
            ]}
            scroll={{ x: 1450 }}
          />
        ),
      }}
    />
  );

  const renderInfluencerReceivableSummaryView = () => (
    <Table
      dataSource={receivableInfluencerSummaryRows}
      rowKey="key"
      pagination={{ pageSize: 10 }}
      locale={{ emptyText: '暂无达人应收汇总' }}
      columns={[
        { title: '达人名称', dataIndex: 'object_name', key: 'object_name', width: 220 },
        { title: '应收明细数', dataIndex: 'detail_count', key: 'detail_count', width: 120 },
        { title: '应收总额', dataIndex: 'total_amount', key: 'total_amount', width: 160, render: (value) => formatTravelMoney(value) },
        { title: '已收合计', dataIndex: 'received_amount', key: 'received_amount', width: 160, render: (value) => formatTravelMoney(value) },
        { title: '剩余未回款', dataIndex: 'outstanding_amount', key: 'outstanding_amount', width: 160, render: (value) => formatTravelMoney(value) },
        { title: '坏账合计', dataIndex: 'bad_debt_amount', key: 'bad_debt_amount', width: 160, render: (value) => formatTravelMoney(value) },
      ]}
      expandable={{
        expandedRowRender: (record) => (
          <Table
            dataSource={record.details}
            rowKey="id"
            pagination={false}
            size="small"
            columns={[
              { title: '来源', dataIndex: 'source', key: 'source', width: 130 },
              { title: '日期', dataIndex: 'date', key: 'date', width: 120 },
              { title: '款项原因', dataIndex: 'reason', key: 'reason', width: 150 },
              { title: '金额', dataIndex: 'amount', key: 'amount', width: 140, render: (value) => formatTravelMoney(value) },
              { title: '备注', dataIndex: 'notes', key: 'notes', render: (value) => value || '-' },
              { title: '已收金额', dataIndex: 'received_amount', key: 'received_amount', width: 140, render: (value) => formatTravelMoney(value) },
              { title: '剩余未回款', key: 'outstanding_amount', width: 150, render: (_, detail) => formatTravelMoney(getOutstandingAmount(detail)) },
              { title: '收款备注', dataIndex: 'payment_notes', key: 'payment_notes', width: 180, render: (value) => value || '-' },
              { title: '是否坏账', dataIndex: 'is_bad_debt', key: 'is_bad_debt', width: 110, render: (_, detail) => isBadDebt(detail) ? <Tag color="red">是</Tag> : <Tag>否</Tag> },
              { title: '操作', key: 'collection_action', width: 110, fixed: 'right' as const, render: (_, detail) => <Button type="link" icon={<EditOutlined />} onClick={() => openCollectionDetailModal(detail)}>修改</Button> },
            ]}
            scroll={{ x: 1300 }}
          />
        ),
      }}
    />
  );

  const renderReceivableManagementView = () => (
    <Tabs
      items={[
        { key: 'entry', label: '应收款项录入', children: renderReceivableEntryView() },
        { key: 'brand-summary', label: '按品牌汇总', children: renderBrandReceivableSummaryView() },
        { key: 'influencer-summary', label: '按达人汇总', children: renderInfluencerReceivableSummaryView() },
      ]}
    />
  );

  const renderTravelHotelReceivableStats = () => (
    <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
      <Col xs={24} sm={12} lg={8} xl={6}>
        <Statistic title="应收达人款项" value={receivableStats.influencerTotal} precision={2} prefix={TRAVEL_CURRENCY} />
      </Col>
      <Col xs={24} sm={12} lg={8} xl={6}>
        <Statistic title="应收品牌款项" value={receivableStats.brandTotal} precision={2} prefix={TRAVEL_CURRENCY} />
      </Col>
      <Col xs={24} sm={12} lg={8} xl={6}>
        <Statistic title="应收其他款项" value={receivableStats.otherTotal} precision={2} prefix={TRAVEL_CURRENCY} />
      </Col>
      <Col xs={24} sm={12} lg={8} xl={6}>
        <Statistic title="应收合计" value={receivableStats.total} precision={2} prefix={TRAVEL_CURRENCY} />
      </Col>
      <Col xs={24} sm={12} lg={8} xl={6}>
        <Statistic title="已收合计" value={receivableStats.receivedTotal} precision={2} prefix={TRAVEL_CURRENCY} valueStyle={{ color: '#3f8600' }} />
      </Col>
      <Col xs={24} sm={12} lg={8} xl={6}>
        <Statistic title="剩余未回款合计" value={receivableStats.outstandingTotal} precision={2} prefix={TRAVEL_CURRENCY} />
      </Col>
      <Col xs={24} sm={12} lg={8} xl={6}>
        <Statistic title="坏账合计" value={receivableStats.badDebtTotal} precision={2} prefix={TRAVEL_CURRENCY} valueStyle={{ color: '#cf1322' }} />
      </Col>
    </Row>
  );

  const renderCollectionDetailModal = () => (
    <Modal
      title="修改回款信息"
      open={Boolean(editingCollectionDetail)}
      onOk={saveCollectionDetail}
      onCancel={() => {
        setEditingCollectionDetail(null);
        collectionDetailForm.resetFields();
      }}
      okText="保存"
      cancelText="取消"
      width={620}
    >
      <Form form={collectionDetailForm} layout="vertical">
        <Form.Item
          name="received_amount"
          label="已收金额"
          rules={[
            { required: true, message: '请输入已收金额' },
            {
              validator: (_, value) => Number(value || 0) <= Number(editingCollectionDetail?.amount || 0)
                ? Promise.resolve()
                : Promise.reject(new Error('已收金额不能大于应收金额')),
            },
          ]}
        >
          <InputNumber<number>
            style={{ width: '100%' }}
            min={0}
            max={Number(editingCollectionDetail?.amount || 0)}
            precision={2}
            prefix={TRAVEL_CURRENCY}
            onFocus={(event) => event.target.select()}
          />
        </Form.Item>
        <Form.Item name="payment_notes" label="收款备注">
          <Input.TextArea rows={3} placeholder="填写收款时间、方式、流水号或其他说明" />
        </Form.Item>
        <Form.Item name="is_bad_debt" label="是否坏账" rules={[{ required: true, message: '请选择是否坏账' }]}>
          <Select>
            <Option value={false}>否</Option>
            <Option value={true}>是</Option>
          </Select>
        </Form.Item>
      </Form>
    </Modal>
  );

  const renderTravelReceivableModal = () => (
    <Modal
      title={editingTravelReceivableRecord ? '修改应收款项' : '新增应收款项'}
      open={receivableModalOpen}
      onOk={saveTravelReceivableRecord}
      onCancel={() => {
        setReceivableModalOpen(false);
        setEditingTravelReceivableRecord(null);
        travelReceivableForm.resetFields();
      }}
      okText="保存"
      cancelText="取消"
      width={720}
    >
      <Form
        form={travelReceivableForm}
        layout="vertical"
        initialValues={{ receivable_date: dayjs(), receivable_type: 'brand' }}
      >
        <Form.Item name="receivable_date" label="录入日期">
          <DatePicker style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="receivable_type" label="款项类型" rules={[{ required: true, message: '请选择款项类型' }]}>
          <Select
            placeholder="请选择应收款项类型"
            onChange={() => travelReceivableForm.setFieldValue('object_name', undefined)}
          >
            {TRAVEL_RECEIVABLE_TYPE_OPTIONS.map((item) => <Option key={item.value} value={item.value}>{item.label}</Option>)}
          </Select>
        </Form.Item>
        <Form.Item
          name="object_name"
          label={receivableObjectLabel[watchedReceivableType || 'brand']}
          rules={[{ required: true, message: '请选择或填写应收对象' }]}
        >
          {watchedReceivableType === 'other' ? (
            <Input placeholder="请输入应收对象" />
          ) : (
            <Select
              showSearch
              optionFilterProp="children"
              placeholder={watchedReceivableType === 'influencer' ? '请选择达人' : '请选择品牌'}
            >
              {(watchedReceivableType === 'influencer' ? travelInfluencerOptions : travelBrandOptions).map((name) => (
                <Option key={name} value={name}>{name}</Option>
              ))}
            </Select>
          )}
        </Form.Item>
        <Form.Item name="reason" label="款项原因" rules={[{ required: true, message: '请选择或新增款项原因' }]}>
          <Select
            mode="tags"
            placeholder="选择或输入新的款项原因"
            maxCount={1}
            tokenSeparators={[',', '，']}
            optionFilterProp="children"
          >
            {travelReceivableReasonOptions.map((reason) => <Option key={reason} value={reason}>{reason}</Option>)}
          </Select>
        </Form.Item>
        <Form.Item name="amount" label="金额" rules={[{ required: true, message: '请填写金额' }]}>
          <InputNumber<number> style={{ width: '100%' }} min={0} precision={2} prefix={TRAVEL_CURRENCY} onFocus={(event) => event.target.select()} />
        </Form.Item>
        <Form.Item name="notes" label="款项备注">
          <Input.TextArea rows={3} placeholder="填写应收款项来源、对应达人/品牌、周期或其他说明" />
        </Form.Item>
      </Form>
    </Modal>
  );

  const renderTravelPayablesOnlyView = () => (
    <>
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={8} xl={6}>
          <Statistic title="应付合计" value={payableStats.total} precision={2} prefix={TRAVEL_CURRENCY} />
        </Col>
        <Col xs={24} sm={12} lg={8} xl={6}>
          <Statistic title="已付合计" value={payableStats.paidTotal} precision={2} prefix={TRAVEL_CURRENCY} valueStyle={{ color: '#3f8600' }} />
        </Col>
        <Col xs={24} sm={12} lg={8} xl={6}>
          <Statistic title="剩余未付合计" value={payableStats.outstandingTotal} precision={2} prefix={TRAVEL_CURRENCY} valueStyle={{ color: '#cf1322' }} />
        </Col>
        <Col xs={24} sm={12} lg={6} xl={3}>
          <Statistic title="已结清" value={payableStats.settledCount} />
        </Col>
        <Col xs={24} sm={12} lg={6} xl={3}>
          <Statistic title="未结清" value={payableStats.pendingCount} />
        </Col>
      </Row>

      <Space style={{ marginBottom: 16 }} wrap>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          disabled={savingTravelPayable}
          onClick={() => {
            setEditingTravelPayableRecord(null);
            travelPayableForm.resetFields();
            travelPayableForm.setFieldsValue({ payable_date: dayjs(), payable_type: 'brand', is_paid: false });
            setPayableModalOpen(true);
          }}
        >
          新增应付款项
        </Button>
        <Select
          allowClear
          showSearch
          optionFilterProp="children"
          placeholder="按款项原因筛选"
          value={payableReasonFilter}
          style={{ width: 260 }}
          onChange={setPayableReasonFilter}
        >
          {travelPayableReasonOptions.map((reason) => <Option key={reason} value={reason}>{reason}</Option>)}
        </Select>
        <Button onClick={() => setPayableReasonFilter(undefined)}>清除原因筛选</Button>
        <Statistic
          title={payableReasonFilter ? `${payableReasonFilter}总计` : '当前列表总计'}
          value={payableReasonFilterTotal}
          precision={2}
          prefix={TRAVEL_CURRENCY}
        />
      </Space>

      <Table
        dataSource={filteredTravelPayableRecords}
        rowKey="id"
        loading={loadingTravelPayables}
        pagination={{ pageSize: 10 }}
        scroll={{ x: 1300 }}
        locale={{ emptyText: '暂无应付款项记录' }}
        columns={[
          { title: '录入时间', dataIndex: 'created_at', key: 'created_at', width: 170 },
          { title: '付款日期', dataIndex: 'payable_date', key: 'payable_date', width: 120 },
          {
            title: '款项类型',
            dataIndex: 'payable_type',
            key: 'payable_type',
            width: 140,
            render: (value) => value ? travelPayableTypeLabel(value) : '-',
          },
          {
            title: '款项原因',
            dataIndex: 'reason',
            key: 'reason',
            width: 150,
            render: (value) => value || '-',
          },
          {
            title: '付款对象',
            dataIndex: 'object_name',
            key: 'object_name',
            width: 160,
            render: (value) => value || '-',
          },
          {
            title: '应付金额',
            dataIndex: 'amount',
            key: 'amount',
            width: 140,
            render: (value) => formatTravelMoney(value),
          },
          {
            title: '已付金额',
            dataIndex: 'paid_amount',
            key: 'paid_amount',
            width: 140,
            render: (_, record) => formatTravelMoney(getPaidAmount(record)),
          },
          {
            title: '剩余未付',
            key: 'outstanding_amount',
            width: 140,
            render: (_, record) => formatTravelMoney(getPayableOutstandingAmount(record)),
          },
          {
            title: '付款状态',
            key: 'is_paid',
            width: 110,
            render: (_, record) => (isPayablePaid(record) || getPayableOutstandingAmount(record) <= 0)
              ? <Tag color="green">已结清</Tag>
              : <Tag color="gold">未结清</Tag>,
          },
          {
            title: '款项备注',
            dataIndex: 'notes',
            key: 'notes',
            width: 200,
            render: (value) => value || '-',
          },
          {
            title: '付款备注',
            dataIndex: 'payment_notes',
            key: 'payment_notes',
            width: 200,
            render: (value) => value || '-',
          },
          {
            title: '操作',
            key: 'action',
            width: 170,
            fixed: 'right' as const,
            render: (_, record) => (
              <Space>
                <Button type="link" icon={<EditOutlined />} onClick={() => openTravelPayableEditModal(record)}>修改</Button>
                <Popconfirm title="确定删除这条应付款项记录吗？" onConfirm={() => deleteTravelPayableRecord(record.id)}>
                  <Button type="link" danger icon={<DeleteOutlined />}>删除</Button>
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />
    </>
  );

  const renderTravelPayableModal = () => (
    <Modal
      title={editingTravelPayableRecord ? '修改应付款项' : '新增应付款项'}
      open={payableModalOpen}
      onOk={saveTravelPayableRecord}
      onCancel={() => {
        if (savingTravelPayable) return;
        setPayableModalOpen(false);
        setEditingTravelPayableRecord(null);
        travelPayableForm.resetFields();
      }}
      confirmLoading={savingTravelPayable}
      okButtonProps={{ disabled: savingTravelPayable }}
      cancelButtonProps={{ disabled: savingTravelPayable }}
      okText="保存"
      cancelText="取消"
      width={720}
    >
      <Form
        form={travelPayableForm}
        layout="vertical"
        initialValues={{ payable_date: dayjs(), payable_type: 'brand', is_paid: false }}
      >
        <Form.Item name="payable_date" label="付款日期" rules={[{ required: true, message: '请选择付款日期' }]}>
          <DatePicker style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="payable_type" label="款项类型" rules={[{ required: true, message: '请选择款项类型' }]}>
          <Select placeholder="请选择应付款项类型">
            {TRAVEL_PAYABLE_TYPE_OPTIONS.map((item) => <Option key={item.value} value={item.value}>{item.label}</Option>)}
          </Select>
        </Form.Item>
        <Form.Item name="object_name" label="付款对象">
          <Input placeholder="填写达人、品牌/商家、员工或其他对象" />
        </Form.Item>
        <Form.Item name="reason" label="款项原因" rules={[{ required: true, message: '请选择或新增款项原因' }]}>
          <Select
            mode="tags"
            placeholder="选择或输入新的款项原因"
            maxCount={1}
            tokenSeparators={[',', '，']}
            optionFilterProp="children"
          >
            {travelPayableReasonOptions.map((reason) => <Option key={reason} value={reason}>{reason}</Option>)}
          </Select>
        </Form.Item>
        <Form.Item name="amount" label="应付金额" rules={[{ required: true, message: '请填写应付金额' }]}>
          <InputNumber<number> style={{ width: '100%' }} min={0} precision={2} prefix={TRAVEL_CURRENCY} onFocus={(event) => event.target.select()} />
        </Form.Item>
        <Form.Item
          name="paid_amount"
          label="已付金额"
          rules={[
            {
              validator: (_, value) => {
                const amount = Number(travelPayableForm.getFieldValue('amount') || 0);
                return Number(value || 0) <= amount
                  ? Promise.resolve()
                  : Promise.reject(new Error('已付金额不能大于应付金额'));
              },
            },
          ]}
        >
          <InputNumber<number> style={{ width: '100%' }} min={0} precision={2} prefix={TRAVEL_CURRENCY} onFocus={(event) => event.target.select()} />
        </Form.Item>
        <Form.Item name="is_paid" label="是否结清" rules={[{ required: true, message: '请选择是否结清' }]}>
          <Select>
            <Option value={false}>否</Option>
            <Option value={true}>是</Option>
          </Select>
        </Form.Item>
        <Form.Item name="notes" label="款项备注">
          <Input.TextArea rows={3} placeholder="填写应付款项来源、周期、对应事项或其他说明" />
        </Form.Item>
        <Form.Item name="payment_notes" label="付款备注">
          <Input.TextArea rows={3} placeholder="填写付款时间、方式、流水号或其他说明" />
        </Form.Item>
      </Form>
    </Modal>
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
          <Statistic title="总成本" value={travelFilterStats.totalCost} precision={2} prefix={TRAVEL_CURRENCY} />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Statistic title="应收" value={travelFilterStats.receivableTotal} precision={2} prefix={TRAVEL_CURRENCY} />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Statistic title="已收" value={travelFilterStats.receivedTotal} precision={2} prefix={TRAVEL_CURRENCY} valueStyle={{ color: '#237804' }} />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Statistic title="未收" value={travelFilterStats.unreceivedTotal} precision={2} prefix={TRAVEL_CURRENCY} valueStyle={{ color: '#cf1322' }} />
        </Col>
      </Row>
    </>
  );

  const renderTravelCostView = () => (
    <>
      <h2 style={{ margin: '0 0 16px' }}>达人机酒管理</h2>
      <Space style={{ marginBottom: 16 }} wrap>
        <Tag color={exchangeRateMeta?.fallback ? 'orange' : 'blue'}>
          {exchangeRateMeta?.fallback ? '默认汇率' : '今日汇率'}：1 SGD = {formatExchangeRate(exchangeRate)} CNY
          {exchangeRateMeta?.date ? `（${exchangeRateMeta.date}）` : ''}
        </Tag>
        <Button size="small" icon={<ReloadOutlined />} loading={loadingExchangeRate} onClick={fetchExchangeRate}>
          刷新汇率
        </Button>
      </Space>
      {renderTravelFilters()}
      <Tabs
        items={[
          { key: 'entry', label: '达人机酒录入', children: renderEntryView() },
          { key: 'costs', label: '达人行程成本', children: renderCostView() },
          { key: 'allocation', label: '达人机酒均摊', children: renderAllocationView() },
          { key: 'calendar', label: '品牌应收机酒', children: renderReceivableCalendar() },
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
            <InputNumber<number> style={{ width: '100%' }} min={0} precision={2} prefix={TRAVEL_CURRENCY} onFocus={(event) => event.target.select()} />
          </Form.Item>
          <Form.Item name="hotel_cost" label="酒店费用">
            <InputNumber<number> style={{ width: '100%' }} min={0} precision={2} prefix={TRAVEL_CURRENCY} onFocus={(event) => event.target.select()} />
          </Form.Item>
          <Form.Item name="business_car_cost" label="商务车费用">
            <InputNumber<number> style={{ width: '100%' }} min={0} precision={2} prefix={TRAVEL_CURRENCY} onFocus={(event) => event.target.select()} />
          </Form.Item>
        </Form>
      </Modal>
      <Modal title="新增费用" open={Boolean(receptionRecord)} onOk={saveReceptionCosts} onCancel={() => setReceptionRecord(null)}>
        <Form form={receptionForm} layout="vertical">
          <Form.Item name="taxi_reception_cost" label="接待费用（日常打车)">
            <InputNumber<number> style={{ width: '100%' }} min={0} precision={2} prefix={TRAVEL_CURRENCY} onFocus={(event) => event.target.select()} />
          </Form.Item>
          <Form.Item name="meal_reception_cost" label="接待费用（日常吃喝)">
            <InputNumber<number> style={{ width: '100%' }} min={0} precision={2} prefix={TRAVEL_CURRENCY} onFocus={(event) => event.target.select()} />
          </Form.Item>
          <Form.Item name="internal_team_travel_cost" label="内部团队差旅费用（机票+酒店）">
            <InputNumber<number> style={{ width: '100%' }} min={0} precision={2} prefix={TRAVEL_CURRENCY} onFocus={(event) => event.target.select()} />
          </Form.Item>
        </Form>
      </Modal>
      {renderTravelReceivableModal()}
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
            <InputNumber<number> style={{ width: '100%' }} min={0} precision={2} prefix={TRAVEL_CURRENCY} onFocus={(event) => event.target.select()} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );

  if (travelOnly) {
    return renderTravelCostView();
  }

  if (receivablesOnly) {
    return (
      <>
        <h2 style={{ margin: '0 0 16px' }}>应收款项</h2>
        {renderTravelHotelReceivableStats()}
        {renderReceivableManagementView()}
        {renderTravelReceivableModal()}
        {renderCollectionDetailModal()}
      </>
    );
  }

  if (payablesOnly) {
    return (
      <>
        <h2 style={{ margin: '0 0 16px' }}>应付管理</h2>
        {renderTravelPayablesOnlyView()}
        {renderTravelPayableModal()}
      </>
    );
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
