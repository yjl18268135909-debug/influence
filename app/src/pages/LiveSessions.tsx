import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Badge, Button, Calendar, Checkbox, Col, DatePicker, Descriptions, Form, Input, InputNumber, Modal, Popconfirm, Radio, Row, Select, Slider, Space, Statistic, Table, Tabs, Tag, Upload, message } from 'antd';
import { DeleteOutlined, EditOutlined, ExportOutlined, PlusOutlined, ReloadOutlined, UploadOutlined, ZoomInOutlined, ZoomOutOutlined } from '@ant-design/icons';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { influencerApi, liveSessionApi, merchantApi } from '../api';
import { defaultEmployees, EMPLOYEES_STORAGE_KEY } from '../data/employees';

const { Option } = Select;
const { TextArea } = Input;
const { RangePicker } = DatePicker;
const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const CUSTOM_BRAND_PREFIX = '__custom_brand__:';

const normalizeUpload = (event: any) => {
  if (Array.isArray(event)) return event;
  return event?.fileList || [];
};

const selectNumberOnFocus = (event: React.FocusEvent<HTMLInputElement>) => event.target.select();

const customBrandValue = (name: string) => `${CUSTOM_BRAND_PREFIX}${name}`;
const isCustomBrandValue = (value: unknown) => typeof value === 'string' && value.startsWith(CUSTOM_BRAND_PREFIX);
const getCustomBrandName = (value: unknown) => isCustomBrandValue(value) ? String(value).slice(CUSTOM_BRAND_PREFIX.length) : '';

const formatMoney = (value: number | string | null | undefined) => `SGD ${Number(value || 0).toLocaleString()}`;

const trafficPlanText: Record<string, string> = {
  self: '自营投放',
  brand: '品牌投放',
};

const scheduleColors = ['#1677ff', '#13c2c2', '#52c41a', '#faad14', '#f759ab', '#722ed1', '#fa541c', '#2f54eb'];
const employeeTagColors = ['#1d4ed8', '#4338ca', '#7c3aed', '#0f766e', '#15803d', '#a16207', '#0e7490', '#be185d'];

const hasSessionTime = (value: string | null | undefined) => Boolean(value && /\d{2}:\d{2}/.test(value));

const formatSessionDate = (value: string | null | undefined) => {
  if (!value) return '';
  return hasSessionTime(value) ? dayjs(value).format('MM-DD HH:mm') : dayjs(value).format('MM-DD');
};

const formatSessionTime = (value: string | null | undefined) => {
  if (!value) return '未填时间';
  return hasSessionTime(value) ? dayjs(value).format('HH:mm') : '未填时间';
};

const formatCalendarSessionText = (item: any) => {
  const timeText = hasSessionTime(item.session_date) ? `${dayjs(item.session_date).format('HH:mm')} ` : '';
  return `${timeText}${item.influencer_name || '未命名达人'} / ${formatBrandName(item.merchant_name)}`;
};

const formatTimelineSessionMeta = (item: any) => {
  const timeText = hasSessionTime(item.session_date) ? dayjs(item.session_date).format('HH:mm') : '';
  const platformText = item.platform && item.platform !== 'TikTok' ? item.platform : '';
  if (timeText && platformText) return `${timeText} · ${platformText}`;
  return timeText || platformText;
};

const formatCommissionRate = (value: number | string | null | undefined) => {
  const numeric = normalizeCommissionRateForDisplay(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return '';
  return `${numeric.toLocaleString(undefined, { maximumFractionDigits: 2 })}%`;
};

const normalizeCommissionRateForDisplay = (value: number | string | null | undefined) => {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric) || numeric <= 0) return 0;
  return numeric <= 1 ? numeric * 100 : numeric;
};

const normalizeCommissionRateForStorage = (value: number | string | null | undefined) => {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric) || numeric <= 0) return 0;
  return numeric > 1 ? numeric / 100 : numeric;
};

const formatInlineInfo = (...values: Array<string | null | undefined>) => values.filter(Boolean).join(' · ');

const formatBrandName = (value: string | null | undefined) => {
  if (!value || value === '未填写品牌') return '未添加品牌信息';
  return value;
};

const isEmptyDisplayValue = (value: unknown) => value === undefined || value === null || value === '' || value === '未填写';

const isTravelNoteOnly = (item: any) => item.schedule_type === 'travel_note';
const isLiveSession = (item: any) => !isTravelNoteOnly(item);

const renderCargoSheet = (value: string | null | undefined) => {
  if (!value) return '未填写';
  if (/^https?:\/\//i.test(value)) {
    return <a href={value} target="_blank" rel="noreferrer">打开货盘表</a>;
  }
  return value;
};

const getSessionEndDate = (item: any) => {
  const start = dayjs(item.session_date);
  const duration = Number(item.duration_hours || 0);
  return duration > 24 ? start.add(duration, 'hour') : start;
};

const isSessionStartInRange = (item: any, start: Dayjs, end: Dayjs) => {
  const sessionStart = dayjs(item.session_date);
  return !sessionStart.isBefore(start) && !sessionStart.isAfter(end);
};

const isSessionOnDay = (item: any, day: Dayjs) => {
  return dayjs(item.session_date).isSame(day, 'day');
};

const isEveningSession = (item: any) => {
  if (!hasSessionTime(item.session_date)) return false;
  return dayjs(item.session_date).hour() >= 18;
};

const getSessionInterval = (item: any) => {
  if (!hasSessionTime(item.session_date)) return null;
  const duration = Number(item.duration_hours || 0);
  if (!duration) return null;
  const start = dayjs(item.session_date);
  return { start, end: start.add(duration, 'hour') };
};

const isSameSession = (a: any, b: any) => {
  return a?.id !== undefined && b?.id !== undefined && String(a.id) === String(b.id);
};

const isSameInfluencer = (a: any, b: any) => {
  if (a.influencer_id && b.influencer_id) return String(a.influencer_id) === String(b.influencer_id);
  return (a.influencer_name || '') === (b.influencer_name || '');
};

const isOverlappingSession = (a: any, b: any) => {
  const aInterval = getSessionInterval(a);
  const bInterval = getSessionInterval(b);
  if (!aInterval || !bInterval) return false;
  if (!aInterval.start.isSame(bInterval.start, 'day')) return false;
  return aInterval.start.isBefore(bInterval.end) && aInterval.end.isAfter(bInterval.start);
};

const fallbackSessions = [
  {
    id: 'demo-1',
    influencer_name: 'Lina Chen',
    merchant_name: 'Glow Market',
    platform: 'TikTok',
    session_date: dayjs().hour(20).minute(0).second(0).format('YYYY-MM-DD HH:mm:ss'),
    duration_hours: 3,
    status: 'scheduled',
    owner: 'Mia',
  },
  {
    id: 'demo-2',
    influencer_name: 'Jason Live',
    merchant_name: 'Home Select',
    platform: 'Shopee',
    session_date: dayjs().add(2, 'day').hour(19).minute(30).second(0).format('YYYY-MM-DD HH:mm:ss'),
    duration_hours: 2.5,
    status: 'scheduled',
    owner: 'Aaron',
  },
  {
    id: 'demo-3',
    influencer_name: 'Nora Style',
    merchant_name: 'Daily Beauty',
    platform: 'TikTok',
    session_date: dayjs().subtract(1, 'day').hour(21).minute(0).second(0).format('YYYY-MM-DD HH:mm:ss'),
    duration_hours: 4,
    status: 'completed',
    owner: 'Sophie',
  },
];

const statusMeta: Record<string, { text: string; color: string; badge: 'default' | 'processing' | 'success' | 'warning' | 'error' }> = {
  scheduled: { text: '待开始', color: 'blue', badge: 'processing' },
  live: { text: '直播中', color: 'green', badge: 'success' },
  completed: { text: '已完成', color: 'default', badge: 'default' },
  cancelled: { text: '已取消', color: 'red', badge: 'error' },
};

const influencerTierOrder = ['超头部达人', '头部达人', '腰部达人', '尾部达人'];

const communicationExportFieldOptions = [
  { label: '排期日期', value: 'date' },
  { label: '开播时间', value: 'time' },
  { label: '达人', value: 'influencer' },
  { label: '品牌', value: 'brand' },
  { label: '类目', value: 'category' },
  { label: '平台', value: 'platform' },
  { label: '达人佣金', value: 'influencer_commission_rate' },
  { label: '品牌佣金', value: 'brand_commission_rate' },
  { label: '目标GMV', value: 'expected_gmv' },
  { label: '预计投放费用', value: 'estimated_ad_cost' },
  { label: '直播时长', value: 'duration_hours' },
  { label: '货盘表', value: 'cargo_sheet' },
  { label: '中控', value: 'owner' },
  { label: '助播', value: 'assistant' },
  { label: '直播城市', value: 'live_city' },
  { label: '直播场地', value: 'live_venue' },
  { label: '直播网络', value: 'live_network' },
  { label: '样品', value: 'samples' },
  { label: '备注', value: 'influencer_travel_note' },
  { label: '其他备注', value: 'notes' },
  { label: '状态', value: 'status' },
];

const defaultCommunicationExportFields = ['date', 'time', 'brand', 'category', 'platform', 'influencer_commission_rate', 'brand_commission_rate', 'expected_gmv', 'estimated_ad_cost', 'live_city', 'owner', 'assistant', 'influencer_travel_note'];

const scheduleImportTemplateHeaders = [
  '排期日期',
  '开播时间',
  '达人',
  '品牌',
  '类目',
  '平台',
  '品牌合作模式',
  '达人佣金',
  '品牌佣金',
  '目标GMV',
  '预计投放费用',
  '直播时长',
  '货盘表',
  '中控',
  '助播',
  '直播城市',
  '直播场地',
  '直播网络',
  '样品',
  '备注',
  '仅记录备注',
  '其他备注',
];

interface LiveSessionsProps {
  communicationOnly?: boolean;
}

type SessionFilters = { influencer?: string; brand?: string; city?: string; dateRange?: [string, string] };
type InlineScheduleField = 'live_venue' | 'owner' | 'assistant' | 'expected_gmv' | 'travel_cost_share' | 'brand_commission_rate' | 'influencer_commission_rate' | 'actual_gmv_sgd' | 'actual_received_gmv_sgd';

const LiveSessions: React.FC<LiveSessionsProps> = ({ communicationOnly = false }) => {
  const navigate = useNavigate();
  const filterScope = communicationOnly ? 'communication' : 'management';
  const [sessions, setSessions] = useState<any[]>([]);
  const [influencers, setInfluencers] = useState<any[]>([]);
  const [merchants, setMerchants] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [batchModalVisible, setBatchModalVisible] = useState(false);
  const [batchDeleteModalVisible, setBatchDeleteModalVisible] = useState(false);
  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [editingSession, setEditingSession] = useState<any | null>(null);
  const [showPostDataSection, setShowPostDataSection] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Dayjs>(dayjs());
  const [timelineWeek, setTimelineWeek] = useState<Dayjs>(dayjs().startOf('day'));
  const [scheduleZoom, setScheduleZoom] = useState(100);
  const [selectedPostDataSessionKey, setSelectedPostDataSessionKey] = useState<string | null>(null);
  const [filtersByScope, setFiltersByScope] = useState<Record<string, SessionFilters>>({
    management: {},
    communication: {},
  });
  const [inlineEditing, setInlineEditing] = useState<{ sessionKey: string; field: InlineScheduleField } | null>(null);
  const [inlineValue, setInlineValue] = useState('');
  const [controlOwnerFilter, setControlOwnerFilter] = useState<string | undefined>();
  const [brandSearchText, setBrandSearchText] = useState('');
  const calendarPanelChangingRef = useRef(false);
  const trafficReceivableEditedRef = useRef(false);
  const [form] = Form.useForm();
  const [batchForm] = Form.useForm();
  const [batchDeleteForm] = Form.useForm();
  const [exportForm] = Form.useForm();
  const scheduleRef = useRef<HTMLDivElement | null>(null);
  const watchedMerchantId = Form.useWatch('merchant_id', form);
  const filters = filtersByScope[filterScope] || {};
  const setCurrentFilters = (updater: SessionFilters | ((prev: SessionFilters) => SessionFilters)) => {
    setFiltersByScope((prev) => ({
      ...prev,
      [filterScope]: typeof updater === 'function' ? updater(prev[filterScope] || {}) : updater,
    }));
  };

  useEffect(() => {
    fetchBaseData();
    const savedEmployees = localStorage.getItem(EMPLOYEES_STORAGE_KEY);
    setEmployees(savedEmployees ? JSON.parse(savedEmployees) : defaultEmployees);
  }, []);

  const fetchBaseData = async () => {
    setLoading(true);
    try {
      const [sessionRes, influencerRes, merchantRes] = await Promise.allSettled([
        liveSessionApi.getAll(),
        influencerApi.getAll(),
        merchantApi.getAll(),
      ]);

      if (sessionRes.status === 'fulfilled') {
        const data = sessionRes.value.data?.data;
        setSessions(Array.isArray(data) && data.length ? data : fallbackSessions);
      } else {
        setSessions(fallbackSessions);
      }

      if (influencerRes.status === 'fulfilled') {
        const data = influencerRes.value.data?.data;
        setInfluencers(Array.isArray(data) ? data : []);
      }

      if (merchantRes.status === 'fulfilled') {
        const data = merchantRes.value.data?.data;
        setMerchants(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('获取直播场次失败:', error);
      setSessions(fallbackSessions);
    } finally {
      setLoading(false);
    }
  };

  const filterOptions = useMemo(() => {
    const unique = (values: string[]) => Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));
    return {
      influencers: unique(sessions.map((item) => item.influencer_name || '未填写达人')),
      brands: unique(sessions.map((item) => formatBrandName(item.merchant_name))),
      cities: unique(sessions.map((item) => item.live_city || '未填写')),
    };
  }, [sessions]);

  const exportInfluencerOptions = useMemo(() => {
    const names = [
      ...influencers.map((item) => item.name),
      ...sessions.map((item) => item.influencer_name || '未填写达人'),
    ].filter(Boolean);
    return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b));
  }, [influencers, sessions]);

  const filteredSessions = useMemo(() => {
    return sessions.filter((item) => {
      const influencerName = item.influencer_name || '未填写达人';
      const brandName = formatBrandName(item.merchant_name);
      const cityName = item.live_city || '未填写';
      const sessionDay = dayjs(item.session_date);
      const matchDateRange = !filters.dateRange
        || (
          !sessionDay.isBefore(dayjs(filters.dateRange[0]), 'day')
          && !sessionDay.isAfter(dayjs(filters.dateRange[1]), 'day')
        );
      return (!filters.influencer || influencerName === filters.influencer)
        && (!filters.brand || brandName === filters.brand)
        && (!filters.city || cityName === filters.city)
        && matchDateRange;
    });
  }, [filters, sessions]);

  const selectedDateSessions = useMemo(() => {
    return filteredSessions.filter((item) => isLiveSession(item) && dayjs(item.session_date).isSame(selectedDate, 'day'));
  }, [filteredSessions, selectedDate]);

  const currentMonthSessions = useMemo(() => {
    return filteredSessions.filter((item) => isLiveSession(item) && dayjs(item.session_date).isSame(selectedDate, 'month'));
  }, [filteredSessions, selectedDate]);

  const estimatedMonthGmv = useMemo(() => {
    return currentMonthSessions.reduce((sum, item) => sum + Number(item.expected_gmv || 0), 0);
  }, [currentMonthSessions]);

  const actualMonthGmv = useMemo(() => {
    return currentMonthSessions.reduce((sum, item) => sum + Number(item.actual_gmv_sgd || 0), 0);
  }, [currentMonthSessions]);

  const monthGmvProgress = useMemo(() => {
    if (!estimatedMonthGmv) return 0;
    return Math.min((actualMonthGmv / estimatedMonthGmv) * 100, 999.99);
  }, [actualMonthGmv, estimatedMonthGmv]);

  const currentMonthInfluencerCount = useMemo(() => {
    return new Set(currentMonthSessions.map((item) => item.influencer_name || '未填写达人')).size;
  }, [currentMonthSessions]);

  const historicalSessions = useMemo(() => {
    return [...filteredSessions]
      .filter(isLiveSession)
      .sort((a, b) => dayjs(a.session_date).valueOf() - dayjs(b.session_date).valueOf());
  }, [filteredSessions]);

  const getSessionsForDay = (day: Dayjs) => {
    return filteredSessions.filter((item) => isLiveSession(item) && dayjs(item.session_date).isSame(day, 'day'));
  };

  const getActualGmvTotal = (items: any[]) => {
    return items.reduce((sum, item) => sum + Number(item.actual_gmv_sgd || 0), 0);
  };

  const hasPostLiveData = (item: any) => {
    return [
      item.actual_gmv_sgd,
      item.actual_received_gmv_sgd,
      item.actual_traffic_usd,
      item.screen_traffic_sgd,
      item.traffic_receivable_amount,
      item.received_amount,
    ].some((value) => Number(value || 0) > 0)
      || Boolean(item.big_screen_screenshot)
      || Boolean(item.actual_traffic_provider)
      || Boolean(item.traffic_notes)
      || Boolean(item.post_live_notes)
      || Boolean(item.payment_notes);
  };

  const getSessionDisplayStatus = (item: any) => {
    if (item.status === 'cancelled' || item.status === 'live') return item.status;
    return hasPostLiveData(item) ? 'completed' : 'scheduled';
  };

  const renderSessionStatusTag = (_status: string, record: any) => {
    const displayStatus = getSessionDisplayStatus(record);
    const meta = statusMeta[displayStatus] || statusMeta.scheduled;
    return <Tag color={meta.color}>{meta.text}</Tag>;
  };

  const getInfluencerTier = (name: string) => {
    return influencers.find((item) => (item.name || '') === name)?.tier || '';
  };

  const getInfluencerTierRank = (name: string) => {
    const tier = getInfluencerTier(name);
    const index = influencerTierOrder.indexOf(tier);
    return index >= 0 ? index : influencerTierOrder.length;
  };

  const formatInfluencerRowName = (name: string) => {
    const tier = getInfluencerTier(name);
    return tier ? `${name}（${tier}）` : name;
  };

  const sortInfluencerEntries = (entries: Array<[string, number]>) => {
    return entries.sort((a, b) => (
      getInfluencerTierRank(a[0]) - getInfluencerTierRank(b[0])
      || a[1] - b[1]
      || a[0].localeCompare(b[0])
    ));
  };

  const timelineDays = useMemo(() => {
    const start = timelineWeek.startOf('day');
    const days = 31;
    return Array.from({ length: days }, (_, index) => start.add(index, 'day'));
  }, [timelineWeek]);

  const timelineInfluencers = useMemo(() => {
    const rangeStart = timelineDays[0].startOf('day');
    const rangeEnd = timelineDays[timelineDays.length - 1].endOf('day');
    const firstSessionMap = new Map<string, number>();

    filteredSessions.forEach((item) => {
      const start = dayjs(item.session_date);
      if (!isSessionStartInRange(item, rangeStart, rangeEnd)) return;

      const name = item.influencer_name || '未填写达人';
      const time = start.valueOf();
      const current = firstSessionMap.get(name);
      if (current === undefined || time < current) {
        firstSessionMap.set(name, time);
      }
    });

    return sortInfluencerEntries(Array.from(firstSessionMap.entries()))
      .map(([name]) => name);
  }, [filteredSessions, influencers, timelineDays]);

  const postDataInfluencers = useMemo(() => {
    const rangeStart = timelineDays[0].startOf('day');
    const rangeEnd = timelineDays[timelineDays.length - 1].endOf('day');
    const firstSessionMap = new Map<string, number>();

    filteredSessions.forEach((item) => {
      if (!isLiveSession(item)) return;
      const start = dayjs(item.session_date);
      if (!isSessionStartInRange(item, rangeStart, rangeEnd)) return;

      const name = item.influencer_name || '未填写达人';
      const time = start.valueOf();
      const current = firstSessionMap.get(name);
      if (current === undefined || time < current) {
        firstSessionMap.set(name, time);
      }
    });

    return sortInfluencerEntries(Array.from(firstSessionMap.entries()))
      .map(([name]) => name);
  }, [filteredSessions, influencers, timelineDays]);

  const getDaySessionCount = (day: Dayjs) => {
    return filteredSessions.filter((item) => {
      if (!isLiveSession(item)) return false;
      return isSessionOnDay(item, day);
    }).length;
  };

  const getInfluencerColor = (name: string, orderedNames = timelineInfluencers) => {
    const index = orderedNames.indexOf(name);
    return scheduleColors[index % scheduleColors.length];
  };

  const estimateSlotHeight = (items: any[], variant: 'schedule' | 'post-data', zoomFactor = 1) => {
    if (!items.length) return 0;
    const baseCardHeight = variant === 'post-data' ? 118 : (communicationOnly ? 172 : 126);
    const gapHeight = 6;
    return Math.ceil((items.length * baseCardHeight + Math.max(items.length - 1, 0) * gapHeight) * zoomFactor);
  };

  const getRowPeriodSlotStyle = (
    rowItems: any[],
    variant: 'schedule' | 'post-data',
    zoomFactor = 1,
  ): React.CSSProperties => {
    let daytimeHeight = 0;
    let eveningHeight = 0;

    timelineDays.forEach((day) => {
      const dayItems = rowItems.filter((item) => isSessionOnDay(item, day));
      const sessionItems = variant === 'schedule'
        ? dayItems.filter((item) => !isTravelNoteOnly(item))
        : dayItems;
      daytimeHeight = Math.max(
        daytimeHeight,
        estimateSlotHeight(sessionItems.filter((item) => !isEveningSession(item)), variant, zoomFactor),
      );
      eveningHeight = Math.max(
        eveningHeight,
        estimateSlotHeight(sessionItems.filter((item) => isEveningSession(item)), variant, zoomFactor),
      );
    });

    const minHeight = Math.ceil(78 * zoomFactor);
    return {
      '--schedule-daytime-slot-height': `${Math.max(daytimeHeight, minHeight)}px`,
      '--schedule-evening-slot-height': `${Math.max(eveningHeight, minHeight)}px`,
    } as React.CSSProperties;
  };

  const getEmployeeColor = (employeeName?: string) => {
    if (!employeeName) return 'default';
    const index = employees.findIndex((item) => item.name === employeeName);
    return employeeTagColors[(index >= 0 ? index : employeeName.length) % employeeTagColors.length];
  };

  const getSessionsForInfluencer = (name: string) => {
    const weekStart = timelineDays[0].startOf('day');
    const weekEnd = timelineDays[timelineDays.length - 1].endOf('day');
    return filteredSessions.filter((item) => {
      const influencerName = item.influencer_name || '未填写达人';
      return influencerName === name && isSessionStartInRange(item, weekStart, weekEnd);
    });
  };

  const getPostDataSessionsForInfluencer = (name: string) => {
    return getSessionsForInfluencer(name).filter(isLiveSession);
  };

  const getMerchantCargoSheet = (merchantId?: number | string, merchantName?: string) => {
    const merchant = merchants.find((item) => {
      const itemId = item.id || item._id;
      return (merchantId && String(itemId) === String(merchantId))
        || (merchantName && item.name === merchantName);
    });
    return merchant?.cargo_sheet_url;
  };

  const getMerchantCooperationMode = (merchantId?: number | string, merchantName?: string) => {
    const merchant = merchants.find((item) => {
      const itemId = item.id || item._id;
      return (merchantId && String(itemId) === String(merchantId))
        || (merchantName && item.name === merchantName);
    });
    return merchant?.cooperation_mode || '未填写';
  };

  const getMerchantCategory = (merchantId?: number | string, merchantName?: string) => {
    const merchant = merchants.find((item) => {
      const itemId = item.id || item._id;
      return (merchantId && String(itemId) === String(merchantId))
        || (merchantName && item.name === merchantName);
    });
    return merchant?.category || '未填写';
  };

  const getSessionBrandCategory = (item: any) => {
    if (!isEmptyDisplayValue(item.brand_category)) return item.brand_category;
    if (!isEmptyDisplayValue(item.merchant_category)) return item.merchant_category;
    return getMerchantCategory(item.merchant_id, item.merchant_name);
  };
  const getSessionBrandCooperationMode = (item: any) => {
    if (!isEmptyDisplayValue(item.brand_cooperation_mode)) return item.brand_cooperation_mode;
    if (!isEmptyDisplayValue(item.merchant_cooperation_mode)) return item.merchant_cooperation_mode;
    return getMerchantCooperationMode(item.merchant_id, item.merchant_name);
  };
  const getSessionMerchantIntroId = (item: any) => {
    const merchant = merchants.find((merchantItem) => {
      const itemId = merchantItem.id || merchantItem._id;
      return (item.merchant_id && String(itemId) === String(item.merchant_id))
        || (item.merchant_name && merchantItem.name === item.merchant_name);
    });
    return merchant?.id || merchant?._id;
  };

  const getSessionInfluencerCommissionRate = (item: any) => {
    if (Number(item.influencer_commission_rate || 0) > 0) return item.influencer_commission_rate;
    if (Number(item.influencer_default_commission_rate || 0) > 0) return item.influencer_default_commission_rate;
    const influencer = influencers.find((influencerItem) => {
      const itemId = influencerItem.id || influencerItem._id;
      return (item.influencer_id && String(itemId) === String(item.influencer_id))
        || (item.influencer_name && influencerItem.name === item.influencer_name);
    });
    return influencer?.commission_rate || 0;
  };

  const getSessionBrandCommissionRate = (item: any) => {
    if (Number(item.brand_commission_rate || 0) > 0) return item.brand_commission_rate;
    if (Number(item.merchant_commission_rate || 0) > 0) return item.merchant_commission_rate;
    const merchant = merchants.find((merchantItem) => {
      const itemId = merchantItem.id || merchantItem._id;
      return (item.merchant_id && String(itemId) === String(item.merchant_id))
        || (item.merchant_name && merchantItem.name === item.merchant_name);
    });
    return merchant?.commission_rate || 0;
  };

  const getEstimatedSessionProfit = (item: any) => {
    const expectedGmv = Number(item.expected_gmv || 0);
    const brandRate = normalizeCommissionRateForDisplay(getSessionBrandCommissionRate(item));
    const influencerRate = normalizeCommissionRateForDisplay(getSessionInfluencerCommissionRate(item));

    if (expectedGmv <= 0 || brandRate <= 0 || influencerRate <= 0) return null;

    const travelCostShare = Number(item.travel_cost_share || 0);
    return expectedGmv * ((brandRate - influencerRate) / 100) + travelCostShare;
  };

  const scrollTimelineToDate = (date: Dayjs) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!scheduleRef.current) return;
        const target = scheduleRef.current.querySelector<HTMLElement>(`[data-schedule-date="${date.format('YYYY-MM-DD')}"]`);
        if (!target) return;
        scheduleRef.current.scrollLeft = Math.max(target.offsetLeft - 150, 0);
      });
    });
  };

  const jumpTimelineToCurrentMonth = () => {
    setTimelineWeek(dayjs().startOf('month'));
    requestAnimationFrame(() => {
      if (scheduleRef.current) {
        scheduleRef.current.scrollLeft = 0;
      }
    });
  };

  const jumpTimelineToToday = () => {
    const today = dayjs();
    setSelectedDate(today);
    setTimelineWeek(today.startOf('day'));
    scrollTimelineToDate(today);
  };

  const openCreateModal = (date: Dayjs = selectedDate, influencerName?: string) => {
    setSelectedDate(date);
    trafficReceivableEditedRef.current = false;
    setShowPostDataSection(false);
    setBrandSearchText('');
    const matchedInfluencer = influencerName
      ? influencers.find((item) => (item.name || '') === influencerName)
      : null;
    form.resetFields();
    form.setFieldsValue({
      influencer_id: matchedInfluencer ? (matchedInfluencer.id || matchedInfluencer._id) : undefined,
      influencer_name: matchedInfluencer?.name || influencerName,
      session_date: date.startOf('day'),
      schedule_type: 'session',
      status: 'scheduled',
      platform: 'TikTok',
      traffic_plan: 'self',
      duration_hours: 4,
      influencer_commission_rate: normalizeCommissionRateForDisplay(matchedInfluencer?.commission_rate || 0),
      brand_commission_rate: 0,
    });
    setEditingSession(null);
    setModalVisible(true);
  };

  const openEditModal = (record: any, showPostData = false) => {
    setEditingSession(record);
    setShowPostDataSection(showPostData);
    setSelectedDate(dayjs(record.session_date));
    trafficReceivableEditedRef.current = Boolean(record.traffic_receivable_amount);
    setBrandSearchText(record.merchant_name || '');
    const matchedMerchant = record.merchant_id
      ? null
      : merchants.find((item) => item.name === record.merchant_name);
    form.resetFields();
    form.setFieldsValue({
      ...record,
      merchant_id: record.merchant_id
        || (matchedMerchant ? (matchedMerchant.id || matchedMerchant._id) : (record.merchant_name ? customBrandValue(record.merchant_name) : undefined)),
      brand_category: isEmptyDisplayValue(record.brand_category) ? getMerchantCategory(record.merchant_id, record.merchant_name) : record.brand_category,
      brand_cooperation_mode: isEmptyDisplayValue(record.brand_cooperation_mode) ? getMerchantCooperationMode(record.merchant_id, record.merchant_name) : record.brand_cooperation_mode,
      session_date: hasSessionTime(record.session_date) ? dayjs(record.session_date) : undefined,
      cargo_sheet: record.cargo_sheet || getMerchantCargoSheet(record.merchant_id, record.merchant_name),
      big_screen_screenshot: record.big_screen_screenshot ? [{ uid: '-1', name: record.big_screen_screenshot, status: 'done' }] : [],
      traffic_plan: record.traffic_plan || 'self',
      influencer_commission_rate: normalizeCommissionRateForDisplay(record.influencer_commission_rate || record.influencer_default_commission_rate || 0),
      brand_commission_rate: normalizeCommissionRateForDisplay(record.brand_commission_rate || record.merchant_commission_rate || 0),
    });
    setModalVisible(true);
  };

  const handleCalendarSelect = (date: Dayjs) => {
    if (calendarPanelChangingRef.current) {
      calendarPanelChangingRef.current = false;
      setSelectedDate(date);
      return;
    }

    const daySessions = filteredSessions.filter((item) => isLiveSession(item) && dayjs(item.session_date).isSame(date, 'day'));
    setSelectedDate(date);
    if (!daySessions.length) {
      openCreateModal(date);
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const screenshotFiles = values.big_screen_screenshot || [];
      const { merchantId, merchantName } = await ensureSessionMerchant(values);
      const assistantName = Array.isArray(values.assistant) ? values.assistant[0] : values.assistant;
      const payload = {
        ...values,
        id: editingSession?.id,
        assistant: assistantName,
        merchant_id: merchantId,
        platform: values.platform || '',
        schedule_type: values.schedule_type || 'session',
        cargo_sheet: values.cargo_sheet || getMerchantCargoSheet(merchantId, merchantName),
        brand_category: isEmptyDisplayValue(values.brand_category) ? getMerchantCategory(merchantId, merchantName) : values.brand_category,
        brand_cooperation_mode: isEmptyDisplayValue(values.brand_cooperation_mode) ? getMerchantCooperationMode(merchantId, merchantName) : values.brand_cooperation_mode,
        influencer_commission_rate: normalizeCommissionRateForStorage(values.influencer_commission_rate),
        brand_commission_rate: normalizeCommissionRateForStorage(values.brand_commission_rate),
        big_screen_screenshot: screenshotFiles.map((file: any) => file.name).join(', '),
        session_date: values.session_date
          ? (values.session_date.hour() || values.session_date.minute() || values.session_date.second()
            ? values.session_date.format('YYYY-MM-DDTHH:mm:ssZ')
            : values.session_date.format('YYYY-MM-DD'))
          : selectedDate.format('YYYY-MM-DD'),
        influencer_name: influencers.find((item) => item.id === values.influencer_id || item._id === values.influencer_id)?.name || values.influencer_name,
        merchant_name: merchantName,
      };

      const conflicts = sessions
        .filter((item) => !isSameSession(item, payload))
        .filter((item) => !isTravelNoteOnly(item) && !isTravelNoteOnly(payload))
        .filter((item) => isOverlappingSession(item, payload))
        .flatMap((item) => {
          const items = [];
          if (isSameInfluencer(item, payload)) {
            items.push(`达人 ${payload.influencer_name || '未填写达人'} 已在 ${formatSessionDate(item.session_date)} 安排直播`);
          }
          if (payload.owner && item.owner === payload.owner) {
            items.push(`中控 ${payload.owner} 已在 ${formatSessionDate(item.session_date)} 负责另一场直播`);
          }
          return items;
        });

      if (conflicts.length) {
        Modal.warning({
          title: '排期时间冲突',
          content: (
            <div>
              {Array.from(new Set(conflicts)).map((item) => (
                <div key={item}>{item}</div>
              ))}
            </div>
          ),
        });
        return;
      }

      if (editingSession?.id) {
        await liveSessionApi.update(editingSession.id, payload);
        message.success('直播场次已更新');
      } else {
        await liveSessionApi.create(payload);
        message.success('直播场次创建成功');
      }
      await fetchBaseData();

      setModalVisible(false);
      setEditingSession(null);
    } catch (error: any) {
      if (error?.errorFields) return;
      console.error('操作失败:', error);
      message.error(error?.response?.data?.error || '保存失败，请检查必填信息');
    }
  };

  const handleDelete = async (record: any) => {
    try {
      if (record.id && !String(record.id).startsWith('local-') && !String(record.id).startsWith('demo-')) {
        await liveSessionApi.delete(record.id);
      }
      setSessions((prev) => prev.filter((item) => item.id !== record.id));
      message.success('直播场次已删除');
    } catch (error: any) {
      console.error('删除直播场次失败:', error);
      message.error(error?.response?.data?.error || '删除失败');
    }
  };

  const handleDeleteTravelNote = async (record: any) => {
    if (isTravelNoteOnly(record)) {
      handleDelete(record);
      return;
    }

    const payload = {
      ...record,
      influencer_travel_note: null,
    };

    try {
      if (record.id && !String(record.id).startsWith('local-') && !String(record.id).startsWith('demo-')) {
        await liveSessionApi.update(record.id, payload);
      }
      setSessions((prev) => prev.map((item) => item.id === record.id ? payload : item));
      message.success('行程备注已删除');
    } catch (error) {
      console.error('删除行程备注失败:', error);
      message.error('删除行程备注失败');
    }
  };

  const getInlineSessionKey = (record: any) => String(record.id || `${record.session_date}-${record.influencer_name}-${record.merchant_name}`);

  const selectedPostDataSession = useMemo(() => {
    if (!selectedPostDataSessionKey) return null;
    return filteredSessions.find((item) => getInlineSessionKey(item) === selectedPostDataSessionKey) || null;
  }, [filteredSessions, selectedPostDataSessionKey]);

  const startInlineEdit = (record: any, field: InlineScheduleField) => {
    setInlineEditing({ sessionKey: getInlineSessionKey(record), field });
    setInlineValue(record[field] || '');
  };

  const saveInlineEdit = async (record: any, field: InlineScheduleField, nextValue: string | string[] = inlineValue) => {
    const normalizedValue = Array.isArray(nextValue) ? nextValue[0] : nextValue;
    const payload = {
      ...record,
      [field]: normalizedValue || null,
    };

    setInlineEditing(null);
    setInlineValue('');

    try {
      if (record.id && !String(record.id).startsWith('local-') && !String(record.id).startsWith('demo-')) {
        await liveSessionApi.update(record.id, payload);
      }
      setSessions((prev) => prev.map((item) => getInlineSessionKey(item) === getInlineSessionKey(record) ? payload : item));
      message.success('排期信息已更新');
    } catch (error) {
      console.error('更新排期信息失败:', error);
      message.error('更新失败');
    }
  };

  const startInlineMetricEdit = (record: any, field: InlineScheduleField, value: number) => {
    setInlineEditing({ sessionKey: getInlineSessionKey(record), field });
    setInlineValue(value ? String(value) : '');
  };

  const saveInlineMetricEdit = async (record: any, field: InlineScheduleField, nextValue = inlineValue, isCommission = false) => {
    const numericValue = Number(nextValue || 0);
    const payload = {
      ...record,
      [field]: isCommission ? normalizeCommissionRateForStorage(numericValue) : numericValue,
    };

    setInlineEditing(null);
    setInlineValue('');

    try {
      if (record.id && !String(record.id).startsWith('local-') && !String(record.id).startsWith('demo-')) {
        await liveSessionApi.update(record.id, payload);
      }
      setSessions((prev) => prev.map((item) => getInlineSessionKey(item) === getInlineSessionKey(record) ? payload : item));
      message.success('排期信息已更新');
    } catch (error) {
      console.error('更新排期信息失败:', error);
      message.error('更新失败');
    }
  };

  const renderInlineMetricField = (
    record: any,
    field: InlineScheduleField,
    label: string,
    displayValue: number,
    options: { isCommission?: boolean } = {},
  ) => {
    const sessionKey = getInlineSessionKey(record);
    const isEditing = inlineEditing?.sessionKey === sessionKey && inlineEditing.field === field;
    const normalizedDisplayValue = Number(displayValue || 0);
    const formattedValue = options.isCommission
      ? (normalizedDisplayValue > 0 ? `${normalizedDisplayValue}%` : '-')
      : (normalizedDisplayValue > 0 ? formatMoney(normalizedDisplayValue) : '-');

    if (isEditing) {
      return (
        <span className="schedule-session-inline-editor" onClick={(event) => event.stopPropagation()}>
          <span>{label}</span>
          <InputNumber<number>
            autoFocus
            size="small"
            min={0}
            precision={2}
            value={inlineValue === '' ? null : Number(inlineValue)}
            prefix={options.isCommission ? undefined : 'SGD'}
            addonAfter={options.isCommission ? '%' : undefined}
            onChange={(value) => setInlineValue(value === null ? '' : String(value))}
            onBlur={() => saveInlineMetricEdit(record, field, inlineValue, Boolean(options.isCommission))}
            onPressEnter={() => saveInlineMetricEdit(record, field, inlineValue, Boolean(options.isCommission))}
          />
        </span>
      );
    }

    return (
      <span
        className="schedule-session-editable-field schedule-session-metric-field"
        role="button"
        tabIndex={0}
        onClick={(event) => {
          event.stopPropagation();
          startInlineMetricEdit(record, field, normalizedDisplayValue);
        }}
        onKeyDown={(event) => {
          event.stopPropagation();
          if (event.key === 'Enter' || event.key === ' ') {
            startInlineMetricEdit(record, field, normalizedDisplayValue);
          }
        }}
      >
        {label} {formattedValue}
      </span>
    );
  };

  const renderPostDataMetricField = (record: any, field: InlineScheduleField, label: string) => {
    const sessionKey = getInlineSessionKey(record);
    const isEditing = inlineEditing?.sessionKey === sessionKey && inlineEditing.field === field;
    const numericValue = Number(record[field] || 0);

    if (isEditing) {
      return (
        <span className="post-data-inline-editor" onClick={(event) => event.stopPropagation()}>
          <span>{label}</span>
          <InputNumber<number>
            autoFocus
            size="small"
            min={0}
            precision={2}
            value={inlineValue === '' ? null : Number(inlineValue)}
            prefix="SGD"
            onChange={(value) => setInlineValue(value === null ? '' : String(value))}
            onBlur={() => saveInlineMetricEdit(record, field)}
            onPressEnter={() => saveInlineMetricEdit(record, field)}
          />
        </span>
      );
    }

    return (
      <span
        className="post-data-editable-metric"
        role="button"
        tabIndex={0}
        onClick={(event) => {
          event.stopPropagation();
          startInlineMetricEdit(record, field, numericValue);
        }}
        onKeyDown={(event) => {
          event.stopPropagation();
          if (event.key === 'Enter' || event.key === ' ') {
            startInlineMetricEdit(record, field, numericValue);
          }
        }}
      >
        {label} <strong>{formatMoney(numericValue)}</strong>
      </span>
    );
  };

  const renderInlineScheduleField = (record: any, field: InlineScheduleField, label: string) => {
    const sessionKey = getInlineSessionKey(record);
    const isEditing = inlineEditing?.sessionKey === sessionKey && inlineEditing.field === field;
    const displayValue = record[field] || '未安排';

    if (isEditing && field === 'owner') {
      return (
        <div className="schedule-session-inline-editor" onClick={(event) => event.stopPropagation()}>
          <span>{label}：</span>
          <Select
            autoFocus
            open
            allowClear
            showSearch
            size="small"
            value={inlineValue || undefined}
            placeholder="选择中控"
            optionFilterProp="children"
            onChange={(value) => saveInlineEdit(record, field, value || '')}
            onBlur={() => {
              setInlineEditing(null);
              setInlineValue('');
            }}
          >
            {employees.filter((item) => item.status === 'active').map((item) => (
              <Option key={item.id} value={item.name}>{item.name} ({item.role})</Option>
            ))}
          </Select>
        </div>
      );
    }

    if (isEditing) {
      return (
        <div className="schedule-session-inline-editor" onClick={(event) => event.stopPropagation()}>
          <span>{label}：</span>
          <Input
            autoFocus
            size="small"
            value={inlineValue}
            placeholder={field === 'assistant' ? '输入助播' : '输入直播场地'}
            onChange={(event) => setInlineValue(event.target.value)}
            onBlur={() => saveInlineEdit(record, field)}
            onPressEnter={() => saveInlineEdit(record, field)}
          />
        </div>
      );
    }

    return (
      <span
        className="schedule-session-mode schedule-session-editable-field"
        role="button"
        tabIndex={0}
        onClick={(event) => {
          event.stopPropagation();
          startInlineEdit(record, field);
        }}
        onKeyDown={(event) => {
          event.stopPropagation();
          if (event.key === 'Enter' || event.key === ' ') {
            startInlineEdit(record, field);
          }
        }}
      >
        {label}：{displayValue}
      </span>
    );
  };

  const openBatchModal = () => {
    batchForm.resetFields();
    batchForm.setFieldsValue({
      dateRange: [selectedDate, selectedDate],
      platform: 'TikTok',
      duration_hours: 4,
    });
    setBatchModalVisible(true);
  };

  const openBatchDeleteModal = () => {
    batchDeleteForm.resetFields();
    batchDeleteForm.setFieldsValue({
      dateRange: [selectedDate, selectedDate],
    });
    setBatchDeleteModalVisible(true);
  };

  const openCommunicationExportModal = () => {
    exportForm.resetFields();
    exportForm.setFieldsValue({
      influencer_name: filters.influencer,
      dateRange: [timelineDays[0] || dayjs(), timelineDays[timelineDays.length - 1] || dayjs().add(1, 'month')],
      fields: defaultCommunicationExportFields,
    });
    setExportModalVisible(true);
  };

  const getExportFieldValue = (field: string, item: any) => {
    const cargoSheet = item.cargo_sheet || getMerchantCargoSheet(item.merchant_id, item.merchant_name);
    const values: Record<string, string | number> = {
      date: dayjs(item.session_date).format('YYYY-MM-DD'),
      time: hasSessionTime(item.session_date) ? dayjs(item.session_date).format('HH:mm') : '',
      influencer: item.influencer_name || '未填写达人',
      brand: formatBrandName(item.merchant_name),
      category: getSessionBrandCategory(item),
      platform: item.platform || '未填写',
      influencer_commission_rate: normalizeCommissionRateForDisplay(getSessionInfluencerCommissionRate(item)),
      brand_commission_rate: normalizeCommissionRateForDisplay(getSessionBrandCommissionRate(item)),
      expected_gmv: Number(item.expected_gmv || 0),
      estimated_ad_cost: Number(item.estimated_ad_cost || 0),
      duration_hours: Number(item.duration_hours || 0),
      cargo_sheet: cargoSheet || '未填写',
      owner: item.owner || '未填写',
      assistant: item.assistant || '未填写',
      live_city: item.live_city || '未填写',
      live_venue: item.live_venue || '未填写',
      live_network: item.live_network || '未填写',
      samples: item.samples || '未填写',
      influencer_travel_note: item.influencer_travel_note || '',
      notes: item.notes || '',
      status: statusMeta[getSessionDisplayStatus(item)]?.text || '待开始',
    };
    return values[field] ?? '';
  };

  const parseImportDate = (value: any) => {
    if (!value) return null;
    if (typeof value === 'number') {
      const parsed = XLSX.SSF.parse_date_code(value);
      return parsed ? dayjs(new Date(parsed.y, parsed.m - 1, parsed.d)) : null;
    }
    const text = String(value).trim();
    const parsed = dayjs(text.replace(/\./g, '-').replace(/\//g, '-'));
    return parsed.isValid() ? parsed : null;
  };

  const parseImportTime = (value: any) => {
    if (value === undefined || value === null || value === '') return '';
    if (typeof value === 'number') {
      const totalMinutes = Math.round((value % 1) * 24 * 60);
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    }
    const text = String(value).trim();
    const match = text.match(/(\d{1,2}):(\d{2})/);
    if (match) return `${match[1].padStart(2, '0')}:${match[2]}`;
    return '';
  };

  const parseImportNumber = (value: any, fallback = 0) => {
    if (value === undefined || value === null || value === '') return fallback;
    const parsed = Number(String(value).replace(/[^\d.-]/g, ''));
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const downloadScheduleImportTemplate = () => {
    const exampleRow = [
      dayjs().format('YYYY-MM-DD'),
      '20:00',
      '示例达人',
      '示例品牌',
      '美妆',
      'TikTok',
      'TAP',
      10,
      20,
      10000,
      500,
      4,
      'https://example.feishu.cn/wiki/xxxxx',
      'Mia',
      'Aaron',
      '新加坡',
      'Studio A',
      '专线/Wi-Fi',
      '样品已到',
      '',
      '否',
      '',
    ];
    const worksheet = XLSX.utils.aoa_to_sheet([scheduleImportTemplateHeaders, exampleRow]);
    worksheet['!cols'] = scheduleImportTemplateHeaders.map(() => ({ wch: 16 }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '排期导入模板');
    XLSX.writeFile(workbook, '直播排期导入模板.xlsx');
  };

  const handleScheduleImport = async (file: File) => {
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: '' });
      const payloads = rows.map((row, index) => {
        const sessionDate = parseImportDate(row['排期日期']);
        if (!sessionDate) {
          throw new Error(`第 ${index + 2} 行缺少有效排期日期`);
        }
        const timeText = parseImportTime(row['开播时间']);
        const influencerName = String(row['达人'] || '').trim();
        const merchantName = String(row['品牌'] || '').trim();
        const selectedInfluencer = influencers.find((item) => item.name === influencerName);
        const selectedMerchant = merchants.find((item) => item.name === merchantName);
        const scheduleTypeText = String(row['仅记录备注'] || '').trim();
        const isNoteOnly = ['是', 'yes', 'true', '1'].includes(scheduleTypeText.toLowerCase());
        return {
          influencer_id: selectedInfluencer ? (selectedInfluencer.id || selectedInfluencer._id) : undefined,
          influencer_name: influencerName || undefined,
          merchant_id: selectedMerchant ? (selectedMerchant.id || selectedMerchant._id) : undefined,
          merchant_name: merchantName || undefined,
          brand_category: String(row['类目'] || '').trim() || selectedMerchant?.category || undefined,
          brand_cooperation_mode: String(row['品牌合作模式'] || '').trim() || selectedMerchant?.cooperation_mode || undefined,
          platform: String(row['平台'] || '').trim() || 'TikTok',
          influencer_commission_rate: normalizeCommissionRateForStorage(parseImportNumber(row['达人佣金'], Number(selectedInfluencer?.commission_rate || 0))),
          brand_commission_rate: normalizeCommissionRateForStorage(parseImportNumber(row['品牌佣金'], Number(selectedMerchant?.commission_rate || 0))),
          expected_gmv: parseImportNumber(row['目标GMV']),
          estimated_ad_cost: parseImportNumber(row['预计投放费用']),
          duration_hours: parseImportNumber(row['直播时长'], 4),
          cargo_sheet: String(row['货盘表'] || '').trim() || selectedMerchant?.cargo_sheet_url || undefined,
          owner: String(row['中控'] || row['负责人'] || '').trim() || undefined,
          assistant: String(row['助播'] || '').trim() || undefined,
          live_city: String(row['直播城市'] || '').trim() || undefined,
          live_venue: String(row['直播场地'] || '').trim() || undefined,
          live_network: String(row['直播网络'] || '').trim() || undefined,
          samples: String(row['样品'] || '').trim() || undefined,
          influencer_travel_note: String(row['备注'] || '').trim() || undefined,
          notes: String(row['其他备注'] || '').trim() || undefined,
          schedule_type: isNoteOnly ? 'travel_note' : 'session',
          status: 'scheduled',
          session_date: timeText ? `${sessionDate.format('YYYY-MM-DD')} ${timeText}:00` : sessionDate.format('YYYY-MM-DD'),
        };
      });

      if (!payloads.length) {
        message.warning('导入文件中没有可导入的排期');
        return false;
      }

      await Promise.all(payloads.map((payload) => liveSessionApi.create(payload)));
      message.success(`已导入 ${payloads.length} 条直播排期`);
      fetchBaseData();
    } catch (error) {
      console.error('导入排期失败:', error);
      message.error(`导入失败：${(error as Error).message || '请检查模板内容'}`);
    }
    return false;
  };

  const handleCommunicationExport = async () => {
    try {
      const values = await exportForm.validateFields();
      const [startDate, endDate] = values.dateRange;
      const selectedFields: string[] = values.fields || [];
      const fieldLabels = Object.fromEntries(communicationExportFieldOptions.map((item) => [item.value, item.label]));
      const rows = sessions
        .filter(isLiveSession)
        .filter((item) => (item.influencer_name || '未填写达人') === values.influencer_name)
        .filter((item) => {
          const sessionDate = dayjs(item.session_date);
          return !sessionDate.isBefore(startDate.startOf('day')) && !sessionDate.isAfter(endDate.endOf('day'));
        })
        .sort((a, b) => dayjs(a.session_date).valueOf() - dayjs(b.session_date).valueOf())
        .map((item) => Object.fromEntries(selectedFields.map((field) => [fieldLabels[field], getExportFieldValue(field, item)])));

      if (!rows.length) {
        message.warning('所选达人和日期范围内没有可导出的排期');
        return;
      }

      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, '达人排期');
      const startText = startDate.format('YYYYMMDD');
      const endText = endDate.format('YYYYMMDD');
      XLSX.writeFile(workbook, `${values.influencer_name}_排期_${startText}-${endText}.xlsx`);
      message.success(`已导出 ${rows.length} 条排期`);
      setExportModalVisible(false);
    } catch (error) {
      console.error('导出达人排期失败:', error);
      message.error('导出失败，请检查达人、日期和字段');
    }
  };

  const handleBatchSubmit = async () => {
    try {
      const values = await batchForm.validateFields();
      const [startDate, endDate] = values.dateRange;
      const days = endDate.startOf('day').diff(startDate.startOf('day'), 'day') + 1;
      if (!Number.isFinite(days) || days <= 0) {
        message.error('结束日期不能早于开始日期');
        return;
      }
      const selectedInfluencer = influencers.find((item) => item.id === values.influencer_id || item._id === values.influencer_id);
      const payloads = Array.from({ length: days }, (_, index) => ({
        influencer_id: values.influencer_id,
        influencer_name: selectedInfluencer?.name,
        platform: values.platform || '',
        live_city: values.live_city,
        duration_hours: values.duration_hours || 4,
        status: 'scheduled',
        session_date: startDate.add(index, 'day').format('YYYY-MM-DD'),
      }));

      await Promise.all(payloads.map((payload) => liveSessionApi.create(payload)));
      message.success(`已新增 ${payloads.length} 条达人排期`);
      setBatchModalVisible(false);
      fetchBaseData();
    } catch (error) {
      console.error('批量新增排期失败:', error);
      const detail = (error as any)?.response?.data?.error;
      message.error(detail ? `批量新增失败：${detail}` : '批量新增失败，请检查日期周期');
    }
  };

  const handleBatchDeleteSubmit = async () => {
    try {
      const values = await batchDeleteForm.validateFields();
      const [startDate, endDate] = values.dateRange;
      const influencerName = values.influencer_name?.trim();
      const targets = sessions.filter((item) => {
        const sessionDate = dayjs(item.session_date);
        const matchDate = !sessionDate.isBefore(startDate.startOf('day')) && !sessionDate.isAfter(endDate.endOf('day'));
        const matchInfluencer = !influencerName || (item.influencer_name || '未填写达人') === influencerName;
        return matchDate && matchInfluencer;
      });

      await Promise.all(targets
        .filter((item) => item.id && !String(item.id).startsWith('local-') && !String(item.id).startsWith('demo-'))
        .map((item) => liveSessionApi.delete(item.id)));
      setSessions((prev) => prev.filter((item) => !targets.some((target) => target.id === item.id)));
      message.success(`已删除 ${targets.length} 条排期`);
      setBatchDeleteModalVisible(false);
    } catch (error) {
      console.error('批量删除排期失败:', error);
      message.error('批量删除失败，请检查日期周期');
    }
  };

  const currentCustomBrandName = isCustomBrandValue(watchedMerchantId) ? getCustomBrandName(watchedMerchantId) : '';
  const pendingCustomBrandName = brandSearchText.trim();
  const canAddCustomBrand = pendingCustomBrandName
    && !merchants.some((item) => item.name === pendingCustomBrandName);
  const shouldShowPendingCustomBrand = canAddCustomBrand && pendingCustomBrandName !== currentCustomBrandName;

  const addCustomBrandToSession = (name: string) => {
    const brandName = name.trim();
    if (!brandName) {
      message.info('请先输入品牌名称');
      return;
    }
    form.setFieldsValue({
      merchant_id: customBrandValue(brandName),
      merchant_name: brandName,
      brand_category: getMerchantCategory(undefined, brandName),
      brand_cooperation_mode: getMerchantCooperationMode(undefined, brandName),
    });
    const cargoSheet = getMerchantCargoSheet(undefined, brandName);
    if (cargoSheet && !form.getFieldValue('cargo_sheet')) {
      form.setFieldValue('cargo_sheet', cargoSheet);
    }
    setBrandSearchText(brandName);
  };

  const ensureSessionMerchant = async (values: any) => {
    const rawMerchantId = values.merchant_id;
    const merchantId = isCustomBrandValue(rawMerchantId) ? undefined : rawMerchantId;
    const customMerchantName = getCustomBrandName(rawMerchantId);
    const selectedMerchant = merchants.find((item) => String(item.id) === String(merchantId) || String(item._id) === String(merchantId));
    const merchantName = (selectedMerchant?.name || values.merchant_name || customMerchantName || '').trim();

    if (selectedMerchant || !merchantName) {
      return {
        merchantId,
        merchantName,
        merchant: selectedMerchant,
      };
    }

    const existingMerchant = merchants.find((item) => String(item.name || '').trim() === merchantName);
    if (existingMerchant) {
      return {
        merchantId: existingMerchant.id || existingMerchant._id,
        merchantName: existingMerchant.name,
        merchant: existingMerchant,
      };
    }

    const category = isEmptyDisplayValue(values.brand_category) ? undefined : values.brand_category;
    const cooperationMode = isEmptyDisplayValue(values.brand_cooperation_mode) ? undefined : values.brand_cooperation_mode;
    const response = await merchantApi.create({
      name: merchantName,
      platform: values.platform || 'TikTok',
      category,
      primary_category: category,
      cooperation_mode: cooperationMode,
      commission_rate: normalizeCommissionRateForStorage(values.brand_commission_rate),
      cargo_sheet_url: values.cargo_sheet || null,
      settlement_cycle: 'monthly',
      status: 'active',
    });
    const createdMerchant = response.data?.data || response.data;
    setMerchants((prev) => [createdMerchant, ...prev]);

    return {
      merchantId: createdMerchant?.id || createdMerchant?._id,
      merchantName: createdMerchant?.name || merchantName,
      merchant: createdMerchant,
    };
  };

  const dateCellRender = (value: Dayjs) => {
    const daySessions = getSessionsForDay(value);

    return (
      <div className={`calendar-session-list ${daySessions.length ? 'calendar-session-filled' : 'calendar-session-empty'}`}>
        {daySessions.length ? <div className="calendar-session-count">共 {daySessions.length} 场</div> : null}
        {daySessions.map((item) => {
          const meta = statusMeta[getSessionDisplayStatus(item)] || statusMeta.scheduled;
          const ownerColor = getEmployeeColor(item.owner);
          const ownerStyle = ownerColor === 'default'
            ? { color: 'rgba(0, 0, 0, 0.55)', borderColor: '#d9d9d9', background: '#fafafa' }
            : { color: ownerColor, borderColor: ownerColor, background: `${ownerColor}14` };
          return (
            <div
              key={item.id || `${item.session_date}-${item.influencer_name}`}
              className="calendar-session-item"
              style={ownerColor === 'default' ? undefined : { borderColor: ownerColor, background: `${ownerColor}0f` }}
            >
              <Badge status={meta.badge} />
              <span className="calendar-session-item-body">
                <span className="calendar-session-item-text">{formatCalendarSessionText(item)}</span>
                <span className="calendar-session-owner" style={ownerStyle}>
                  中控 {item.owner || '未安排'}
                </span>
              </span>
            </div>
          );
        })}
        {daySessions.length ? (
          <Button
            className="calendar-add-session"
            type="text"
            size="small"
            icon={<PlusOutlined />}
            onClick={(event) => {
              event.stopPropagation();
              openCreateModal(value);
            }}
          />
        ) : null}
      </div>
    );
  };

  const operationColumn = {
    title: '操作',
    key: 'action',
    fixed: 'right' as const,
    width: 160,
    render: (_: any, record: any) => (
      <Space size="small">
        <Button type="link" icon={<EditOutlined />} onClick={() => openEditModal(record)}>
          更改
        </Button>
        <Popconfirm
          title="删除场次"
          description="确定删除这场直播排期吗？"
          okText="删除"
          cancelText="取消"
          onConfirm={() => handleDelete(record)}
        >
          <Button type="link" danger icon={<DeleteOutlined />}>
            删除
          </Button>
        </Popconfirm>
      </Space>
    ),
  };

  const calendarColumns = [
    {
      title: '开播时间',
      dataIndex: 'session_date',
      key: 'session_date',
      width: 150,
      render: (value: string) => formatSessionDate(value),
      sorter: (a: any, b: any) => dayjs(a.session_date).valueOf() - dayjs(b.session_date).valueOf(),
    },
    {
      title: '直播城市',
      dataIndex: 'live_city',
      key: 'live_city',
      width: 120,
      render: (value: string) => value || '未填写',
    },
    {
      title: '达人',
      dataIndex: 'influencer_name',
      key: 'influencer_name',
      width: 140,
      render: (value: string) => value || '未填写',
    },
    {
      title: '品牌',
      dataIndex: 'merchant_name',
      key: 'merchant_name',
      width: 160,
      render: (value: string) => formatBrandName(value),
    },
    {
      title: '货盘表',
      dataIndex: 'cargo_sheet',
      key: 'cargo_sheet',
      width: 120,
      render: (value: string, record: any) => renderCargoSheet(value || getMerchantCargoSheet(record.merchant_id, record.merchant_name)),
    },
    {
      title: '平台',
      dataIndex: 'platform',
      key: 'platform',
      width: 100,
      render: (platform: string) => <Tag color={platform === 'TikTok' ? 'red' : 'orange'}>{platform}</Tag>,
    },
    {
      title: '中控',
      dataIndex: 'owner',
      key: 'owner',
      width: 120,
      render: (value: string) => value || '-',
    },
    {
      title: '时长',
      dataIndex: 'duration_hours',
      key: 'duration_hours',
      width: 100,
      render: (value: number) => `${value || 0} 小时`,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: renderSessionStatusTag,
    },
    operationColumn,
  ];

  const timelineColumns = [
    {
      title: '开播时间',
      dataIndex: 'session_date',
      key: 'session_date',
      width: 150,
      render: (value: string) => formatSessionDate(value),
      sorter: (a: any, b: any) => dayjs(a.session_date).valueOf() - dayjs(b.session_date).valueOf(),
    },
    {
      title: '直播城市',
      dataIndex: 'live_city',
      key: 'live_city',
      width: 120,
      render: (value: string) => value || '未填写',
    },
    {
      title: '达人',
      dataIndex: 'influencer_name',
      key: 'influencer_name',
      width: 140,
      render: (value: string) => value || '未填写',
    },
    {
      title: '品牌',
      dataIndex: 'merchant_name',
      key: 'merchant_name',
      width: 160,
      render: (value: string) => formatBrandName(value),
    },
    {
      title: '货盘表',
      dataIndex: 'cargo_sheet',
      key: 'cargo_sheet',
      width: 120,
      render: (value: string, record: any) => renderCargoSheet(value || getMerchantCargoSheet(record.merchant_id, record.merchant_name)),
    },
    {
      title: '目标GMV',
      dataIndex: 'expected_gmv',
      key: 'expected_gmv',
      width: 120,
      render: (value: number) => formatMoney(value),
    },
    {
      title: '达人佣金',
      dataIndex: 'influencer_commission_rate',
      key: 'influencer_commission_rate',
      width: 110,
      render: (_value: number, record: any) => formatCommissionRate(getSessionInfluencerCommissionRate(record)) || '-',
    },
    {
      title: '品牌佣金',
      dataIndex: 'brand_commission_rate',
      key: 'brand_commission_rate',
      width: 110,
      render: (_value: number, record: any) => formatCommissionRate(getSessionBrandCommissionRate(record)) || '-',
    },
    {
      title: '平台',
      dataIndex: 'platform',
      key: 'platform',
      width: 100,
      render: (platform: string) => <Tag color={platform === 'TikTok' ? 'red' : 'orange'}>{platform}</Tag>,
    },
    {
      title: '时长',
      dataIndex: 'duration_hours',
      key: 'duration_hours',
      width: 100,
      render: (value: number) => `${value || 0} 小时`,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: renderSessionStatusTag,
    },
  ];

  const communicationTimelineColumns = [
    {
      title: '开播时间',
      dataIndex: 'session_date',
      key: 'session_date',
      width: 150,
      render: (value: string) => formatSessionDate(value),
      sorter: (a: any, b: any) => dayjs(a.session_date).valueOf() - dayjs(b.session_date).valueOf(),
    },
    {
      title: '直播城市',
      dataIndex: 'live_city',
      key: 'live_city',
      width: 120,
      render: (value: string) => value || '未填写',
    },
    {
      title: '直播场地',
      dataIndex: 'live_venue',
      key: 'live_venue',
      width: 140,
      render: (value: string) => value || '未填写',
    },
    {
      title: '达人',
      dataIndex: 'influencer_name',
      key: 'influencer_name',
      width: 140,
      render: (value: string) => value || '未填写',
    },
    {
      title: '品牌',
      dataIndex: 'merchant_name',
      key: 'merchant_name',
      width: 160,
      render: (value: string) => formatBrandName(value),
    },
    {
      title: '货盘表',
      dataIndex: 'cargo_sheet',
      key: 'cargo_sheet',
      width: 120,
      render: (value: string, record: any) => renderCargoSheet(value || getMerchantCargoSheet(record.merchant_id, record.merchant_name)),
    },
    {
      title: '目标GMV',
      dataIndex: 'expected_gmv',
      key: 'expected_gmv',
      width: 120,
      render: (value: number) => formatMoney(value),
    },
    {
      title: '达人佣金',
      dataIndex: 'influencer_commission_rate',
      key: 'influencer_commission_rate',
      width: 110,
      render: (_value: number, record: any) => formatCommissionRate(getSessionInfluencerCommissionRate(record)) || '-',
    },
    {
      title: '品牌佣金',
      dataIndex: 'brand_commission_rate',
      key: 'brand_commission_rate',
      width: 110,
      render: (_value: number, record: any) => formatCommissionRate(getSessionBrandCommissionRate(record)) || '-',
    },
    {
      title: '备注',
      dataIndex: 'notes',
      key: 'notes',
      width: 180,
      render: (value: string) => value || '无',
    },
  ];

  const historyColumns = [
    {
      title: '排期时间',
      dataIndex: 'session_date',
      key: 'session_date',
      width: 150,
      render: (value: string) => formatSessionDate(value),
      sorter: (a: any, b: any) => dayjs(a.session_date).valueOf() - dayjs(b.session_date).valueOf(),
      defaultSortOrder: 'ascend' as const,
    },
    {
      title: '直播城市',
      dataIndex: 'live_city',
      key: 'live_city',
      width: 120,
      render: (value: string) => value || '未填写',
    },
    {
      title: '达人',
      dataIndex: 'influencer_name',
      key: 'influencer_name',
      width: 140,
      render: (value: string) => value || '未填写',
    },
    {
      title: '品牌',
      dataIndex: 'merchant_name',
      key: 'merchant_name',
      width: 160,
      render: (value: string) => formatBrandName(value),
    },
    {
      title: '平台',
      dataIndex: 'platform',
      key: 'platform',
      width: 100,
      render: (platform: string) => <Tag color={platform === 'TikTok' ? 'red' : 'orange'}>{platform}</Tag>,
    },
    {
      title: '目标GMV',
      dataIndex: 'expected_gmv',
      key: 'expected_gmv',
      width: 120,
      render: (value: number) => formatMoney(value),
      sorter: (a: any, b: any) => Number(a.expected_gmv || 0) - Number(b.expected_gmv || 0),
    },
    {
      title: '本场GMV',
      dataIndex: 'actual_gmv_sgd',
      key: 'actual_gmv_sgd',
      width: 120,
      render: (value: number) => formatMoney(value),
      sorter: (a: any, b: any) => Number(a.actual_gmv_sgd || 0) - Number(b.actual_gmv_sgd || 0),
    },
    {
      title: '中控',
      dataIndex: 'owner',
      key: 'owner',
      width: 120,
      render: (value: string) => value || '未填写',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: renderSessionStatusTag,
    },
    operationColumn,
  ];

  const postDataDetailColumns = [
    {
      title: '开播时间',
      dataIndex: 'session_date',
      key: 'session_date',
      width: 150,
      render: (value: string) => formatSessionDate(value),
      sorter: (a: any, b: any) => dayjs(a.session_date).valueOf() - dayjs(b.session_date).valueOf(),
    },
    {
      title: '直播城市',
      dataIndex: 'live_city',
      key: 'live_city',
      width: 120,
      render: (value: string) => value || '未填写',
    },
    {
      title: '达人',
      dataIndex: 'influencer_name',
      key: 'influencer_name',
      width: 140,
      render: (value: string) => value || '未填写',
    },
    {
      title: '品牌',
      dataIndex: 'merchant_name',
      key: 'merchant_name',
      width: 170,
      render: (value: string) => formatBrandName(value),
    },
    {
      title: '货盘表',
      dataIndex: 'cargo_sheet',
      key: 'cargo_sheet',
      width: 140,
      render: (value: string, record: any) => renderCargoSheet(value || getMerchantCargoSheet(record.merchant_id, record.merchant_name)),
    },
    {
      title: '中控',
      dataIndex: 'owner',
      key: 'owner',
      width: 120,
      render: (value: string) => value || '未填写',
    },
    {
      title: '实际投流数据',
      dataIndex: 'actual_traffic_usd',
      key: 'actual_traffic_usd',
      width: 150,
      render: (value: number) => `USD ${Number(value || 0).toLocaleString()}`,
    },
    {
      title: '备注',
      dataIndex: 'notes',
      key: 'notes',
      width: 180,
      render: (value: string) => value || '无',
    },
  ];

  const renderPostDataExpandedDetails = (record: any) => (
    <Descriptions size="small" column={{ xs: 1, sm: 2, lg: 3 }} className="session-detail-panel">
      <Descriptions.Item label="目标GMV">{formatMoney(record.expected_gmv)}</Descriptions.Item>
      <Descriptions.Item label="本场GMV">{formatMoney(record.actual_gmv_sgd)}</Descriptions.Item>
      <Descriptions.Item label="实收GMV">{formatMoney(record.actual_received_gmv_sgd)}</Descriptions.Item>
      <Descriptions.Item label="达人佣金">{formatCommissionRate(getSessionInfluencerCommissionRate(record)) || '未填写'}</Descriptions.Item>
      <Descriptions.Item label="品牌佣金">{formatCommissionRate(getSessionBrandCommissionRate(record)) || '未填写'}</Descriptions.Item>
      <Descriptions.Item label="助播">{record.assistant || '未填写'}</Descriptions.Item>
      <Descriptions.Item label="直播场地">{record.live_venue || '未填写'}</Descriptions.Item>
      <Descriptions.Item label="直播网络">{record.live_network || '未填写'}</Descriptions.Item>
      <Descriptions.Item label="样品">{record.samples || '未填写'}</Descriptions.Item>
      <Descriptions.Item label="投流规划">{trafficPlanText[record.traffic_plan] || '未填写'}</Descriptions.Item>
      <Descriptions.Item label="预计投放费用">{formatMoney(record.estimated_ad_cost)}</Descriptions.Item>
      <Descriptions.Item label="单场机酒分摊">{formatMoney(record.travel_cost_share)}</Descriptions.Item>
      <Descriptions.Item label="应收品牌机酒费用">{formatMoney(record.brand_receivable)}</Descriptions.Item>
      <Descriptions.Item label="大屏截图">{record.big_screen_screenshot || '未上传'}</Descriptions.Item>
      <Descriptions.Item label="大屏上投流数据">{formatMoney(record.screen_traffic_sgd)}</Descriptions.Item>
      <Descriptions.Item label="投流方">{record.actual_traffic_provider || '未填写'}</Descriptions.Item>
      <Descriptions.Item label="应收费用">{record.traffic_receivable_type || '未填写'}</Descriptions.Item>
      <Descriptions.Item label="应收金额">{`USD ${Number(record.traffic_receivable_amount || 0).toLocaleString()}`}</Descriptions.Item>
      <Descriptions.Item label="投放备注" span={3}>{record.traffic_notes || '无'}</Descriptions.Item>
      <Descriptions.Item label="行程备注" span={3}>{record.influencer_travel_note || '无'}</Descriptions.Item>
    </Descriptions>
  );

  const renderSessionDetails = (record: any) => (
    <Descriptions size="small" column={{ xs: 1, sm: 2, lg: 3 }} className="session-detail-panel">
      <Descriptions.Item label="货盘表">{renderCargoSheet(record.cargo_sheet || getMerchantCargoSheet(record.merchant_id, record.merchant_name))}</Descriptions.Item>
      <Descriptions.Item label="目标GMV">{formatMoney(record.expected_gmv)}</Descriptions.Item>
      <Descriptions.Item label="达人佣金">{formatCommissionRate(getSessionInfluencerCommissionRate(record)) || '未填写'}</Descriptions.Item>
      <Descriptions.Item label="品牌佣金">{formatCommissionRate(getSessionBrandCommissionRate(record)) || '未填写'}</Descriptions.Item>
      <Descriptions.Item label="中控">{record.owner || '未填写'}</Descriptions.Item>
      <Descriptions.Item label="助播">{record.assistant || '未填写'}</Descriptions.Item>
      <Descriptions.Item label="直播城市">{record.live_city || '未填写'}</Descriptions.Item>
      <Descriptions.Item label="直播场地">{record.live_venue || '未填写'}</Descriptions.Item>
      <Descriptions.Item label="直播网络">{record.live_network || '未填写'}</Descriptions.Item>
      <Descriptions.Item label="样品">{record.samples || '未填写'}</Descriptions.Item>
      <Descriptions.Item label="备注">{record.influencer_travel_note || '无'}</Descriptions.Item>
      {!communicationOnly && (
        <>
          <Descriptions.Item label="投流规划">{trafficPlanText[record.traffic_plan] || '未填写'}</Descriptions.Item>
          <Descriptions.Item label="预计投放费用">{formatMoney(record.estimated_ad_cost)}</Descriptions.Item>
          <Descriptions.Item label="单场机酒分摊">{formatMoney(record.travel_cost_share)}</Descriptions.Item>
          <Descriptions.Item label="应收品牌机酒费用">{formatMoney(record.brand_receivable)}</Descriptions.Item>
          <Descriptions.Item label="本场GMV">{formatMoney(record.actual_gmv_sgd)}</Descriptions.Item>
          <Descriptions.Item label="大屏截图">{record.big_screen_screenshot || '未上传'}</Descriptions.Item>
          <Descriptions.Item label="实际投流数据">{`USD ${Number(record.actual_traffic_usd || 0).toLocaleString()}`}</Descriptions.Item>
          <Descriptions.Item label="大屏上投流数据">{formatMoney(record.screen_traffic_sgd)}</Descriptions.Item>
          <Descriptions.Item label="投流方">{record.actual_traffic_provider || '未填写'}</Descriptions.Item>
          <Descriptions.Item label="应收费用">{record.traffic_receivable_type || '未填写'}</Descriptions.Item>
          <Descriptions.Item label="应收金额">{`USD ${Number(record.traffic_receivable_amount || 0).toLocaleString()}`}</Descriptions.Item>
          <Descriptions.Item label="实收GMV">{formatMoney(record.actual_received_gmv_sgd)}</Descriptions.Item>
          <Descriptions.Item label="投放备注">{record.traffic_notes || '无'}</Descriptions.Item>
        </>
      )}
      <Descriptions.Item label="备注" span={3}>{record.notes || '无'}</Descriptions.Item>
    </Descriptions>
  );

  const renderSelectedDateSessionTable = (tableColumns: any[]) => (
    <>
      <h3 style={{ margin: '20px 0 12px' }}>{selectedDate.format('YYYY年MM月DD日')} 场次</h3>
      <Table
        columns={tableColumns}
        dataSource={selectedDateSessions}
        rowKey={(record) => record.id || `${record.session_date}-${record.influencer_name}`}
        loading={loading}
        pagination={false}
        expandable={{ expandedRowRender: renderSessionDetails }}
        scroll={{ x: 1700 }}
      />
    </>
  );

  const renderCalendarHeader = ({ value, type, onChange, onTypeChange }: any) => {
    const currentYear = dayjs().year();
    const years = Array.from({ length: 21 }, (_, index) => currentYear - 10 + index);

    return (
      <Space className="calendar-header-actions" wrap>
        <Select
          value={value.year()}
          style={{ width: 120 }}
          onChange={(year) => onChange(value.year(year))}
        >
          {years.map((year) => <Option key={year} value={year}>{year}年</Option>)}
        </Select>
        <Select
          value={value.month()}
          style={{ width: 120 }}
          onChange={(month) => onChange(value.month(month))}
        >
          {monthNames.map((month, index) => <Option key={month} value={index}>{month}</Option>)}
        </Select>
        <Radio.Group value={type} onChange={(event) => onTypeChange(event.target.value)}>
          <Radio.Button value="month">月</Radio.Button>
          <Radio.Button value="year">年</Radio.Button>
        </Radio.Group>
        <Button
          onClick={() => {
            const today = dayjs();
            setSelectedDate(today);
            onChange(today);
          }}
        >
          回到今天
        </Button>
      </Space>
    );
  };

  const renderCalendarView = () => (
    <div className="live-calendar-view">
      <Calendar
        value={selectedDate}
        onSelect={handleCalendarSelect}
        onPanelChange={(date) => {
          calendarPanelChangingRef.current = true;
          setSelectedDate(date);
        }}
        headerRender={renderCalendarHeader}
        cellRender={(current, info) => (info.type === 'date' ? dateCellRender(current) : info.originNode)}
      />

      {renderSelectedDateSessionTable(calendarColumns)}
    </div>
  );

  const controlScheduleCellRender = (date: Dayjs) => {
    const daySessions = getSessionsForDay(date).filter((item) => (
      !controlOwnerFilter
        || (controlOwnerFilter === '__unassigned__' ? !item.owner : item.owner === controlOwnerFilter)
    ));
    if (!daySessions.length) return null;
    return (
      <div className="employee-calendar-cell">
        {daySessions.map((item) => (
          <button
            key={item.id || `${item.session_date}-${item.owner}-${item.assistant}`}
            type="button"
            className="employee-session-card"
            onClick={(event) => {
              event.stopPropagation();
              openEditModal(item);
            }}
          >
            <div className="employee-session-title">
              <span>{formatSessionTime(item.session_date)}</span>
              <Tag color={getEmployeeColor(item.owner)}>{item.owner || '未安排人员'}</Tag>
            </div>
          </button>
        ))}
      </div>
    );
  };

  const renderControlCalendarHeader = (props: any) => (
    <Space className="calendar-header-actions" wrap>
      <Select
        allowClear
        showSearch
        placeholder="按中控筛选"
        value={controlOwnerFilter}
        style={{ width: 180 }}
        optionFilterProp="children"
        onChange={setControlOwnerFilter}
      >
        <Option value="__unassigned__">未安排人员</Option>
        {employees.filter((item) => item.status === 'active').map((item) => (
          <Option key={item.id} value={item.name}>{item.name} ({item.role})</Option>
        ))}
      </Select>
      {renderCalendarHeader(props)}
    </Space>
  );

  const renderControlScheduleView = () => (
    <Calendar
      value={selectedDate}
      onSelect={(date) => setSelectedDate(date)}
      onPanelChange={(date) => setSelectedDate(date)}
      headerRender={renderControlCalendarHeader}
      cellRender={(date, info) => (info.type === 'date' ? controlScheduleCellRender(date) : info.originNode)}
    />
  );

  const renderPostDataView = () => (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <DatePicker
          picker="month"
          value={timelineWeek}
          onChange={(value) => value && setTimelineWeek(value.startOf('month'))}
        />
        <Button onClick={() => setTimelineWeek(timelineWeek.subtract(1, 'month'))}>上月</Button>
        <Button onClick={jumpTimelineToCurrentMonth}>本月</Button>
        <Button onClick={() => setTimelineWeek(timelineWeek.add(1, 'month'))}>下月</Button>
        <Button onClick={jumpTimelineToToday}>回到今天</Button>
      </Space>

      <div
        className="post-data-grid schedule-freeze-grid"
        style={{ gridTemplateColumns: `160px repeat(${timelineDays.length}, minmax(240px, 1fr))` }}
      >
        <div className="schedule-header schedule-name-cell">达人</div>
        {timelineDays.map((day) => (
          <div key={day.format('YYYY-MM-DD')} className="schedule-header">
            <div>{day.format('MM/DD')}</div>
            <span>{day.format('ddd')}</span>
          </div>
        ))}

        <div className="schedule-name-cell schedule-total-name">当日GMV合计</div>
        {timelineDays.map((day) => {
          const daySessions = getSessionsForDay(day);
          return (
            <div key={`post-total-${day.format('YYYY-MM-DD')}`} className="schedule-total-cell post-data-total-cell">
              <strong>{formatMoney(getActualGmvTotal(daySessions))}</strong>
              <span>{daySessions.length} 场</span>
            </div>
          );
        })}

        {postDataInfluencers.map((name) => {
          const influencerPostDataItems = getPostDataSessionsForInfluencer(name);
          const rowPeriodSlotStyle = getRowPeriodSlotStyle(influencerPostDataItems, 'post-data');
          const rowHasBothSessionPeriods = timelineDays.some((day) => {
            const dayItems = influencerPostDataItems.filter((item) => isSessionOnDay(item, day));
            return dayItems.some((item) => !isEveningSession(item)) && dayItems.some((item) => isEveningSession(item));
          });

          return (
            <React.Fragment key={`post-${name}`}>
              <div className="schedule-name-cell schedule-row-name">
                <span className="schedule-dot" style={{ background: getInfluencerColor(name, postDataInfluencers) }} />
                {formatInfluencerRowName(name)}
              </div>
              {timelineDays.map((day) => {
              const dayItems = influencerPostDataItems.filter((item) => isSessionOnDay(item, day));
              const daytimeItems = dayItems.filter((item) => !isEveningSession(item));
              const eveningItems = dayItems.filter((item) => isEveningSession(item));
              const shouldSplitSessionPeriods = rowHasBothSessionPeriods || (daytimeItems.length > 0 && eveningItems.length > 0);
              const renderPostDataCard = (item: any) => (
                <div
                  key={item.id || `${item.session_date}-${item.merchant_name}`}
                  className={`post-data-session-card ${selectedPostDataSessionKey === getInlineSessionKey(item) ? 'post-data-session-card-selected' : ''}`}
                  role="button"
                  tabIndex={0}
                  title="双击打开播后数据登记"
                  onClickCapture={() => {
                    setSelectedDate(day);
                    setSelectedPostDataSessionKey(getInlineSessionKey(item));
                  }}
                  onClick={(event) => {
                    event.stopPropagation();
                    setSelectedDate(day);
                    setSelectedPostDataSessionKey(getInlineSessionKey(item));
                  }}
                  onDoubleClick={(event) => {
                    event.stopPropagation();
                    openEditModal(item, true);
                  }}
                  onKeyDown={(event) => {
                    event.stopPropagation();
                    if (event.key === 'Enter' || event.key === ' ') {
                      setSelectedDate(day);
                      setSelectedPostDataSessionKey(getInlineSessionKey(item));
                    }
                  }}
                >
                  <div className="post-data-session-title">
                    <strong>{formatBrandName(item.merchant_name)}</strong>
                    <span>{formatTimelineSessionMeta(item) || '未填时间'}</span>
                  </div>
                  <div className="post-data-metrics">
                    <span>目标GMV <strong>{formatMoney(item.expected_gmv)}</strong></span>
                    {renderPostDataMetricField(item, 'actual_gmv_sgd', '本场GMV')}
                    {renderPostDataMetricField(item, 'actual_received_gmv_sgd', '实收GMV')}
                    <span>
                      目标达成率
                      <strong>
                        {Number(item.expected_gmv || 0) > 0
                          ? `${((Number(item.actual_gmv_sgd || 0) / Number(item.expected_gmv || 0)) * 100).toFixed(2)}%`
                          : '-'}
                      </strong>
                    </span>
                  </div>
                </div>
              );
              return (
                <div
                  key={`post-${name}-${day.format('YYYY-MM-DD')}`}
                  className={`post-data-grid-cell ${dayItems.length ? 'post-data-grid-cell-filled' : ''}`}
                  style={shouldSplitSessionPeriods ? rowPeriodSlotStyle : undefined}
                  onClick={() => {
                    setSelectedDate(day);
                    setSelectedPostDataSessionKey(null);
                  }}
                >
                  {dayItems.length ? (
                    <div className={`schedule-period-slots post-data-period-slots ${shouldSplitSessionPeriods ? 'schedule-period-slots-split' : 'schedule-period-slots-single'}`}>
                      {shouldSplitSessionPeriods ? (
                        <>
                          <div className={`schedule-period-slot schedule-period-slot-daytime ${daytimeItems.length ? 'schedule-period-slot-filled' : 'schedule-period-slot-empty'}`}>
                            {daytimeItems.map(renderPostDataCard)}
                          </div>
                          <div className={`schedule-period-slot schedule-period-slot-evening ${eveningItems.length ? 'schedule-period-slot-filled' : 'schedule-period-slot-empty'}`}>
                            {eveningItems.map(renderPostDataCard)}
                          </div>
                        </>
                      ) : (
                        <div className={`schedule-period-slot ${eveningItems.length ? 'schedule-period-slot-evening-only' : 'schedule-period-slot-daytime-only'} schedule-period-slot-filled`}>
                          {(daytimeItems.length ? daytimeItems : eveningItems).map(renderPostDataCard)}
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })}
            </React.Fragment>
          );
        })}
      </div>

      {!postDataInfluencers.length ? (
        <div className="post-data-empty-tip">当前筛选范围内没有可登记播后数据的直播场次</div>
      ) : null}

      {(selectedPostDataSession || selectedDateSessions.length) ? (
        <div className="post-data-detail-section">
          <h3>
            {selectedDate.format('YYYY年MM月DD日')} 场次
          </h3>
          <Table
            columns={postDataDetailColumns}
            dataSource={selectedPostDataSession ? [selectedPostDataSession] : selectedDateSessions}
            rowKey={(record) => record.id || `${record.session_date}-${record.influencer_name}`}
            loading={loading}
            pagination={false}
            expandable={{ expandedRowRender: renderPostDataExpandedDetails }}
            scroll={{ x: 1170 }}
          />
        </div>
      ) : null}
    </div>
  );

  const renderHistoryView = () => (
    <>
      <h3 style={{ margin: '4px 0 12px' }}>历史场次</h3>
      <Table
        columns={historyColumns}
        dataSource={historicalSessions}
        rowKey={(record) => record.id || `${record.session_date}-${record.influencer_name}`}
        loading={loading}
        pagination={{ pageSize: 20, showSizeChanger: true }}
        expandable={{ expandedRowRender: renderSessionDetails }}
        scroll={{ x: 1450 }}
      />
    </>
  );

  const renderTimelineView = () => (
    <div>
      <Space className="schedule-toolbar" style={{ marginBottom: 16 }} wrap>
        <Space wrap>
          <DatePicker
            picker="month"
            value={timelineWeek}
            onChange={(value) => value && setTimelineWeek(value.startOf('month'))}
          />
          <Button onClick={() => setTimelineWeek(timelineWeek.subtract(1, 'month'))}>上月</Button>
          <Button onClick={jumpTimelineToCurrentMonth}>本月</Button>
          <Button onClick={() => setTimelineWeek(timelineWeek.add(1, 'month'))}>下月</Button>
          <Button onClick={jumpTimelineToToday}>回到今天</Button>
        </Space>
        <Space className="schedule-zoom-control" align="center">
          <Button
            icon={<ZoomOutOutlined />}
            onClick={() => setScheduleZoom((value) => Math.max(40, value - 10))}
          />
          <Slider
            min={40}
            max={100}
            step={5}
            value={scheduleZoom}
            onChange={setScheduleZoom}
            tooltip={{ formatter: (value) => `${value}%` }}
          />
          <Button
            icon={<ZoomInOutlined />}
            onClick={() => setScheduleZoom((value) => Math.min(100, value + 10))}
          />
          <Button onClick={() => setScheduleZoom(100)}>{scheduleZoom}%</Button>
        </Space>
      </Space>

      <div
        ref={scheduleRef}
        className="influencer-schedule schedule-freeze-grid"
        style={{
          '--schedule-zoom': scheduleZoom / 100,
          gridTemplateColumns: `calc(150px * var(--schedule-zoom)) repeat(${timelineDays.length}, calc(${communicationOnly ? 220 : 150}px * var(--schedule-zoom)))`,
        } as React.CSSProperties}
      >
        <div className="schedule-header schedule-name-cell">达人</div>
        {timelineDays.map((day) => (
          <div key={day.format('YYYY-MM-DD')} className="schedule-header" data-schedule-date={day.format('YYYY-MM-DD')}>
            <div>{day.format('MM/DD')}</div>
            <span>{day.format('ddd')}</span>
          </div>
        ))}

        <div className="schedule-name-cell schedule-total-name">总计达人场次</div>
        {timelineDays.map((day) => (
          <div key={`total-${day.format('YYYY-MM-DD')}`} className="schedule-total-cell">
            {getDaySessionCount(day)}
          </div>
        ))}

        {timelineInfluencers.map((name) => {
          const influencerTimelineItems = getSessionsForInfluencer(name);
          const rowPeriodSlotStyle = getRowPeriodSlotStyle(influencerTimelineItems, 'schedule', scheduleZoom / 100);
          const rowHasBothSessionPeriods = timelineDays.some((day) => {
            const daySessions = influencerTimelineItems.filter((item) => isSessionOnDay(item, day) && !isTravelNoteOnly(item));
            return daySessions.some((item) => !isEveningSession(item)) && daySessions.some((item) => isEveningSession(item));
          });

          return (
            <React.Fragment key={name}>
              <div className="schedule-name-cell schedule-row-name">
                <span className="schedule-dot" style={{ background: getInfluencerColor(name) }} />
                {formatInfluencerRowName(name)}
              </div>
              {timelineDays.map((day) => {
              const dayItems = influencerTimelineItems.filter((item) => {
                return isSessionOnDay(item, day);
              });
              const standaloneTravelNotes = dayItems.filter((item) => isTravelNoteOnly(item) && item.influencer_travel_note);
              const sessionTravelNotes = dayItems.filter((item) => !isTravelNoteOnly(item) && item.influencer_travel_note);
              const daySessions = dayItems.filter((item) => !isTravelNoteOnly(item));
              const daytimeSessions = daySessions.filter((item) => !isEveningSession(item));
              const eveningSessions = daySessions.filter((item) => isEveningSession(item));
              const shouldSplitSessionPeriods = rowHasBothSessionPeriods || (daytimeSessions.length > 0 && eveningSessions.length > 0);
              const renderTravelNoteBlock = (item: any) => (
                <div
                  key={`travel-${item.id || `${item.session_date}-${item.influencer_name}`}`}
                  className="schedule-travel-note"
                  role="button"
                  tabIndex={0}
                  title="双击修改行程备注"
                  onClick={(event) => {
                    event.stopPropagation();
                  }}
                  onDoubleClick={(event) => {
                    event.stopPropagation();
                    openEditModal(item);
                  }}
                  onKeyDown={(event) => {
                    event.stopPropagation();
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      openEditModal(item);
                    }
                  }}
                >
                  <span>{item.influencer_travel_note}</span>
                  <Popconfirm
                    title="删除行程备注"
                    description="确定删除这条备注吗？"
                    okText="删除"
                    cancelText="取消"
                    onConfirm={(event) => {
                      event?.stopPropagation();
                      handleDeleteTravelNote(item);
                    }}
                    onCancel={(event) => event?.stopPropagation()}
                  >
                    <button
                      type="button"
                      className="schedule-travel-note-delete"
                      onClick={(event) => event.stopPropagation()}
                    >
                      ×
                    </button>
                  </Popconfirm>
                </div>
              );
              const renderSessionBlock = (item: any) => {
                const color = getInfluencerColor(name);
                const merchantIntroId = getSessionMerchantIntroId(item);
                const brandName = formatBrandName(item.merchant_name);
                const cooperationMode = getSessionBrandCooperationMode(item);
                const estimatedProfit = getEstimatedSessionProfit(item);
                return (
                  <div
                    key={item.id || `${item.session_date}-${item.merchant_name}`}
                    role="button"
                    tabIndex={0}
                    className="schedule-session-block"
                    style={{ borderColor: color, background: `${color}18`, color }}
                    title="双击修改排期"
                    onClick={(event) => {
                      event.stopPropagation();
                      setSelectedDate(day);
                    }}
                    onDoubleClick={(event) => {
                      event.stopPropagation();
                      openEditModal(item);
                    }}
                    onKeyDown={(event) => {
                      event.stopPropagation();
                      if (event.key === 'Enter' || event.key === ' ') {
                        setSelectedDate(day);
                      }
                    }}
                  >
                    <span className="schedule-session-title">
                      {communicationOnly && merchantIntroId ? (
                        <span
                          role="link"
                          tabIndex={0}
                          className="schedule-session-brand-link"
                          onClick={(event) => {
                            event.stopPropagation();
                            navigate(`/merchants/${merchantIntroId}/introduction`, {
                              state: { from: '/schedule-communication', fromLabel: '返回达人排期沟通' },
                            });
                          }}
                          onKeyDown={(event) => {
                            event.stopPropagation();
                            if (event.key === 'Enter' || event.key === ' ') {
                              navigate(`/merchants/${merchantIntroId}/introduction`, {
                                state: { from: '/schedule-communication', fromLabel: '返回达人排期沟通' },
                              });
                            }
                          }}
                        >
                          {brandName}
                        </span>
                      ) : (
                        <strong>
                          {communicationOnly ? brandName : formatInlineInfo(brandName, cooperationMode && cooperationMode !== '未填写' ? cooperationMode : undefined)}
                        </strong>
                      )}
                    </span>
                    {formatTimelineSessionMeta(item) ? <span>{formatTimelineSessionMeta(item)}</span> : null}
                    {communicationOnly ? (
                      <>
                        <span className="schedule-session-mode">
                          {getSessionBrandCategory(item)}
                        </span>
                        {renderInlineMetricField(item, 'expected_gmv', '目标GMV', Number(item.expected_gmv || 0))}
                        {renderInlineMetricField(item, 'travel_cost_share', '机酒均摊', Number(item.travel_cost_share || 0))}
                      </>
                    ) : (
                      <>
                        {renderInlineScheduleField(item, 'live_venue', '场地')}
                        {renderInlineScheduleField(item, 'owner', '中控')}
                        {renderInlineScheduleField(item, 'assistant', '助播')}
                      </>
                    )}
                    {communicationOnly ? (
                      <span className="schedule-session-commission">
                        {renderInlineMetricField(item, 'brand_commission_rate', '品牌佣金', normalizeCommissionRateForDisplay(getSessionBrandCommissionRate(item)), { isCommission: true })}
                        {renderInlineMetricField(item, 'influencer_commission_rate', '达人佣金', normalizeCommissionRateForDisplay(getSessionInfluencerCommissionRate(item)), { isCommission: true })}
                      </span>
                    ) : null}
                    {communicationOnly && estimatedProfit !== null ? (
                      <span className="schedule-session-estimated-profit">
                        预估单场利润 {formatMoney(estimatedProfit)}
                      </span>
                    ) : null}
                    <div className="schedule-session-actions">
                      <Popconfirm
                        title="删除场次"
                        description="确定删除这场直播排期吗？"
                        okText="删除"
                        cancelText="取消"
                        onConfirm={(event) => {
                          event?.stopPropagation();
                          handleDelete(item);
                        }}
                        onCancel={(event) => event?.stopPropagation()}
                      >
                        <span
                          className="schedule-session-action"
                          role="button"
                          tabIndex={0}
                          onClick={(event) => event.stopPropagation()}
                          onKeyDown={(event) => event.stopPropagation()}
                        >
                          删除
                        </span>
                      </Popconfirm>
                    </div>
                  </div>
                );
              };

              return (
                <div
                  key={`${name}-${day.format('YYYY-MM-DD')}`}
                  className="schedule-day-cell"
                  style={shouldSplitSessionPeriods ? rowPeriodSlotStyle : undefined}
                  onDoubleClick={() => {
                    setSelectedDate(day);
                    openCreateModal(day, name);
                  }}
                  title="双击新增排期"
                >
                  {standaloneTravelNotes.length ? (
                    <div className="schedule-travel-note-area schedule-travel-note-area-top">
                      {standaloneTravelNotes.map(renderTravelNoteBlock)}
                    </div>
                  ) : null}
                  {daySessions.length ? (
                    <div className={`schedule-period-slots ${shouldSplitSessionPeriods ? 'schedule-period-slots-split' : 'schedule-period-slots-single'}`}>
                      {shouldSplitSessionPeriods ? (
                        <>
                          <div className={`schedule-period-slot schedule-period-slot-daytime ${daytimeSessions.length ? 'schedule-period-slot-filled' : 'schedule-period-slot-empty'}`}>
                            {daytimeSessions.map(renderSessionBlock)}
                          </div>
                          <div className={`schedule-period-slot schedule-period-slot-evening ${eveningSessions.length ? 'schedule-period-slot-filled' : 'schedule-period-slot-empty'}`}>
                            {eveningSessions.map(renderSessionBlock)}
                          </div>
                        </>
                      ) : (
                        <div className={`schedule-period-slot ${eveningSessions.length ? 'schedule-period-slot-evening-only' : 'schedule-period-slot-daytime-only'} schedule-period-slot-filled`}>
                          {(daytimeSessions.length ? daytimeSessions : eveningSessions).map(renderSessionBlock)}
                        </div>
                      )}
                    </div>
                  ) : null}
                  {sessionTravelNotes.length ? (
                    <div className="schedule-travel-note-area">
                      {sessionTravelNotes.map(renderTravelNoteBlock)}
                    </div>
                  ) : null}
                </div>
              );
            })}
            </React.Fragment>
          );
        })}
      </div>

      {renderSelectedDateSessionTable(communicationOnly ? communicationTimelineColumns : timelineColumns)}
    </div>
  );

  return (
    <div>
      <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }} align="center">
        <Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openCreateModal()}>
            新增直播场次
          </Button>
          <Button icon={<PlusOutlined />} onClick={openBatchModal}>
            批量新增排期
          </Button>
          <Button danger icon={<DeleteOutlined />} onClick={openBatchDeleteModal}>
            批量删除排期
          </Button>
          {!communicationOnly && (
            <>
              <Button icon={<ExportOutlined />} onClick={downloadScheduleImportTemplate}>
                下载导入模板
              </Button>
              <Upload
                accept=".xlsx,.xls,.csv"
                beforeUpload={handleScheduleImport}
                showUploadList={false}
              >
                <Button icon={<UploadOutlined />}>导入排期</Button>
              </Upload>
            </>
          )}
          <Button icon={<ReloadOutlined />} onClick={fetchBaseData}>
            刷新
          </Button>
          {communicationOnly && (
            <Button icon={<ExportOutlined />} onClick={openCommunicationExportModal}>
              导出排期
            </Button>
          )}
        </Space>
        <DatePicker picker="month" value={selectedDate} onChange={(value) => value && setSelectedDate(value)} />
      </Space>

      <Row gutter={[12, 12]} style={{ marginBottom: 16 }} align="middle">
        <Col xs={24} md={12} lg={5}>
          <Select
            placeholder="按达人筛选"
            allowClear
            showSearch
            style={{ width: '100%' }}
            value={filters.influencer}
            optionFilterProp="children"
            onChange={(value) => setCurrentFilters((prev) => ({ ...prev, influencer: value }))}
          >
            {filterOptions.influencers.map((name) => <Option key={name} value={name}>{name}</Option>)}
          </Select>
        </Col>
        <Col xs={24} md={12} lg={5}>
          <Select
            placeholder="按品牌筛选"
            allowClear
            showSearch
            style={{ width: '100%' }}
            value={filters.brand}
            optionFilterProp="children"
            onChange={(value) => setCurrentFilters((prev) => ({ ...prev, brand: value }))}
          >
            {filterOptions.brands.map((name) => <Option key={name} value={name}>{name}</Option>)}
          </Select>
        </Col>
        <Col xs={24} md={12} lg={5}>
          <Select
            placeholder="按直播城市筛选"
            allowClear
            showSearch
            style={{ width: '100%' }}
            value={filters.city}
            optionFilterProp="children"
            onChange={(value) => setCurrentFilters((prev) => ({ ...prev, city: value }))}
          >
            {filterOptions.cities.map((name) => <Option key={name} value={name}>{name}</Option>)}
          </Select>
        </Col>
        <Col xs={24} md={12} lg={6}>
          <RangePicker
            style={{ width: '100%' }}
            value={filters.dateRange ? [dayjs(filters.dateRange[0]), dayjs(filters.dateRange[1])] : null}
            onChange={(value) => {
              setCurrentFilters((prev) => ({
                ...prev,
                dateRange: value ? [value[0]!.format('YYYY-MM-DD'), value[1]!.format('YYYY-MM-DD')] : undefined,
              }));
            }}
            placeholder={['开始时间', '结束时间']}
          />
        </Col>
        <Col xs={24} md={12} lg={3}>
          <Button block onClick={() => setCurrentFilters({})}>
            清除筛选
          </Button>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12} lg={3}>
          <Statistic title="本月达人" value={currentMonthInfluencerCount} />
        </Col>
        <Col xs={24} sm={12} lg={3}>
          <Statistic title="本月场次" value={currentMonthSessions.length} />
        </Col>
        {!communicationOnly && (
          <>
            <Col xs={24} sm={12} lg={3}>
              <Statistic title="待开始" value={currentMonthSessions.filter((item) => getSessionDisplayStatus(item) === 'scheduled').length} />
            </Col>
            <Col xs={24} sm={12} lg={3}>
              <Statistic title="已完成" value={currentMonthSessions.filter((item) => getSessionDisplayStatus(item) === 'completed').length} />
            </Col>
          </>
        )}
        <Col xs={24} sm={12} lg={communicationOnly ? 4 : 4}>
          <Statistic title="本月目标GMV" value={estimatedMonthGmv} precision={2} prefix="SGD" />
        </Col>
        {!communicationOnly && (
          <>
            <Col xs={24} sm={12} lg={4}>
              <Statistic title="本月实际GMV" value={actualMonthGmv} precision={2} prefix="SGD" />
            </Col>
            <Col xs={24} sm={12} lg={4}>
              <Statistic title="完成进度" value={monthGmvProgress} precision={2} suffix="%" />
            </Col>
          </>
        )}
      </Row>

      {communicationOnly ? (
        renderTimelineView()
      ) : (
        <Tabs
          items={[
            { key: 'timeline', label: '达人排期', children: renderTimelineView() },
            { key: 'post-data', label: '播后数据登记', children: renderPostDataView() },
            { key: 'calendar', label: '月历', children: renderCalendarView() },
            { key: 'control-schedule', label: '中控排期', children: renderControlScheduleView() },
            { key: 'history', label: '历史场次', children: renderHistoryView() },
          ]}
        />
      )}

      <Modal
        title={editingSession ? '直播明细' : '新增直播场次'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => {
          setModalVisible(false);
          setEditingSession(null);
          setShowPostDataSection(false);
        }}
        width={860}
      >
        <Form form={form} layout="vertical">
          <div className="live-note-row">
            <Form.Item name="influencer_travel_note" label={<span className="travel-note-label">备注</span>}>
              <TextArea className="travel-note-input" rows={2} placeholder="填写后会在达人排期视图日期格中红色显示" />
            </Form.Item>
            <Form.Item name="schedule_type" hidden>
              <Input />
            </Form.Item>
            <Form.Item className="schedule-type-checkbox-item" label=" " colon={false} shouldUpdate>
              {() => (
                <Checkbox
                  checked={form.getFieldValue('schedule_type') === 'travel_note'}
                  onChange={(event) => {
                    form.setFieldValue('schedule_type', event.target.checked ? 'travel_note' : 'session');
                  }}
                >
                  仅记录备注，不生成排期
                </Checkbox>
              )}
            </Form.Item>
          </div>

          <div className="live-detail-section">
            <h3>1. 排期规划</h3>
            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item name="influencer_id" label="达人">
                  <Select placeholder="请选择达人" allowClear showSearch optionFilterProp="children" onChange={(value) => {
                    const influencer = influencers.find((item) => item.id === value || item._id === value);
                    form.setFieldsValue({
                      influencer_name: influencer?.name || undefined,
                      influencer_commission_rate: normalizeCommissionRateForDisplay(influencer?.commission_rate ?? form.getFieldValue('influencer_commission_rate') ?? 0),
                    });
                  }}>
                    {influencers.map((item: any) => <Option key={item.id || item._id} value={item.id || item._id}>{item.name} ({item.platform})</Option>)}
                  </Select>
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item name="merchant_id" label="品牌">
                  <Select
                    placeholder="请选择或新增品牌"
                    allowClear
                    showSearch
                    optionFilterProp="children"
                    onSearch={setBrandSearchText}
                    dropdownRender={(menu) => (
                      <>
                        {menu}
                        <div className="brand-dropdown-add">
                          <Button
                            type="link"
                            icon={<PlusOutlined />}
                            disabled={!canAddCustomBrand}
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => addCustomBrandToSession(pendingCustomBrandName)}
                          >
                            {pendingCustomBrandName ? `新增品牌：${pendingCustomBrandName}` : '输入品牌名称后新增'}
                          </Button>
                        </div>
                      </>
                    )}
                    onClear={() => {
                      setBrandSearchText('');
                      form.setFieldsValue({ merchant_name: undefined });
                    }}
                    onChange={(value) => {
                      if (isCustomBrandValue(value)) {
                        addCustomBrandToSession(getCustomBrandName(value));
                        return;
                      }
                      const merchant = merchants.find((item) => String(item.id) === String(value) || String(item._id) === String(value));
                      form.setFieldsValue({
                        merchant_name: merchant?.name || undefined,
                        brand_category: merchant?.category || undefined,
                        brand_cooperation_mode: merchant?.cooperation_mode || undefined,
                        brand_commission_rate: normalizeCommissionRateForDisplay(merchant?.commission_rate ?? form.getFieldValue('brand_commission_rate') ?? 0),
                      });
                      setBrandSearchText(merchant?.name || '');
                      if (merchant?.cargo_sheet_url) {
                        form.setFieldValue('cargo_sheet', merchant.cargo_sheet_url);
                      }
                    }}
                  >
                    {merchants.map((item: any) => <Option key={item.id || item._id} value={item.id || item._id}>{item.name} ({item.platform})</Option>)}
                    {currentCustomBrandName && (
                      <Option key={customBrandValue(currentCustomBrandName)} value={customBrandValue(currentCustomBrandName)}>
                        {currentCustomBrandName}
                      </Option>
                    )}
                    {shouldShowPendingCustomBrand && (
                      <Option key={customBrandValue(pendingCustomBrandName)} value={customBrandValue(pendingCustomBrandName)}>
                        + 新增品牌：{pendingCustomBrandName}
                      </Option>
                    )}
                  </Select>
                </Form.Item>
              </Col>
              <Form.Item name="merchant_name" hidden>
                <Input />
              </Form.Item>
              <Col xs={24} md={12}>
                <Form.Item name="brand_category" label="类目">
                  <Input placeholder="自动带出商家分类，也可自行填写" />
                </Form.Item>
              </Col>
              {!communicationOnly && (
                <>
                  <Col xs={24} md={12}>
                    <Form.Item name="brand_cooperation_mode" label="品牌合作模式">
                      <Input placeholder="自动带出合作模式，也可自行填写" />
                    </Form.Item>
                  </Col>
                </>
              )}
              <Col xs={24} md={12}>
                <Form.Item name="platform" label="平台">
                  <Select allowClear placeholder="请选择平台">
                    <Option value="TikTok">TikTok</Option>
                    <Option value="Shopee">Shopee</Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item name="expected_gmv" label="目标GMV">
                  <InputNumber<number> style={{ width: '100%' }} min={0} precision={2} prefix="SGD" onFocus={selectNumberOnFocus} />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item name="influencer_commission_rate" label="达人佣金 (%)">
                  <InputNumber<number> style={{ width: '100%' }} min={0} precision={2} addonAfter="%" onFocus={selectNumberOnFocus} />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item name="brand_commission_rate" label="品牌佣金 (%)">
                  <InputNumber<number> style={{ width: '100%' }} min={0} precision={2} addonAfter="%" onFocus={selectNumberOnFocus} />
                </Form.Item>
              </Col>
              {communicationOnly && (
                <Col xs={24} md={12}>
                  <Form.Item name="estimated_ad_cost" label="预计投放费用">
                    <InputNumber<number> style={{ width: '100%' }} min={0} precision={2} prefix="SGD" onFocus={selectNumberOnFocus} />
                  </Form.Item>
                </Col>
              )}
            </Row>
          </div>

          <div className="live-detail-section">
            <h3>2. 执行规划</h3>
            <Row gutter={16}>
              <Col xs={24} md={8}>
                <Form.Item name="session_date" label="排期时间">
                  <DatePicker showTime style={{ width: '100%' }} placeholder="不填则只按日期排期" />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item name="duration_hours" label="直播时长">
                  <InputNumber style={{ width: '100%' }} min={0} step={0.5} addonAfter="小时" onFocus={selectNumberOnFocus} />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item name="cargo_sheet" label="货盘表">
                  <Input
                    placeholder="优先自动带出商家货盘表，也可自行填写链接"
                    suffix={(
                      <button
                        type="button"
                        className="input-clear-x"
                        onClick={() => form.setFieldValue('cargo_sheet', '')}
                      >
                        ×
                      </button>
                    )}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item name="owner" label="中控">
                  <Select placeholder="请选择中控" allowClear showSearch optionFilterProp="children">
                    {employees.filter((item) => item.status === 'active').map((item) => <Option key={item.id} value={item.name}>{item.name} ({item.role})</Option>)}
                  </Select>
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item name="assistant" label="助播">
                  <Select
                    mode="tags"
                    maxCount={1}
                    placeholder="请选择或输入助播"
                    allowClear
                    showSearch
                    optionFilterProp="children"
                  >
                    {employees.filter((item) => item.status === 'active').map((item) => <Option key={item.id} value={item.name}>{item.name} ({item.role})</Option>)}
                  </Select>
                </Form.Item>
              </Col>
              <Col xs={24} md={8}><Form.Item name="live_city" label="直播城市"><Input placeholder="请输入直播城市" /></Form.Item></Col>
              <Col xs={24} md={8}><Form.Item name="live_venue" label="直播场地"><Input placeholder="请输入直播场地" /></Form.Item></Col>
              <Col xs={24} md={8}><Form.Item name="live_network" label="直播网络"><Input placeholder="例如：专线/Wi-Fi/5G" /></Form.Item></Col>
              {!communicationOnly && (
                <Col xs={24} md={8}>
                  <Form.Item name="traffic_plan" label="投流规划">
                    <Select allowClear>
                      <Option value="self">自营投放</Option>
                      <Option value="brand">品牌投放</Option>
                    </Select>
                  </Form.Item>
                </Col>
              )}
              <Col span={24}><Form.Item name="samples" label="样品"><TextArea rows={2} placeholder="样品到货、寄样、库存或注意事项" /></Form.Item></Col>
            </Row>
          </div>

          {!communicationOnly && (
            <>
              <Form.Item name="estimated_ad_cost" hidden><InputNumber /></Form.Item>
              <Form.Item name="travel_cost_share" hidden><InputNumber /></Form.Item>
              <Form.Item name="brand_receivable" hidden><InputNumber /></Form.Item>

              {showPostDataSection && (
                <div className="live-detail-section">
                <h3>4. 播后数据登记</h3>
                <Row gutter={16}>
                  <Col xs={24} md={12}>
                    <Form.Item name="actual_gmv_sgd" label="本场GMV（新币）">
                      <InputNumber<number> style={{ width: '100%' }} min={0} precision={2} prefix="SGD" onFocus={selectNumberOnFocus} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item name="big_screen_screenshot" label="大屏截图" valuePropName="fileList" getValueFromEvent={normalizeUpload}>
                      <Upload beforeUpload={() => false} maxCount={1} accept="image/*"><Button icon={<UploadOutlined />}>上传图片</Button></Upload>
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item name="actual_traffic_usd" label="实际投流数据（美金）">
                      <InputNumber<number>
                        style={{ width: '100%' }}
                        min={0}
                        precision={2}
                        prefix="USD"
                        onFocus={selectNumberOnFocus}
                        onChange={(value) => {
                          if (!trafficReceivableEditedRef.current) {
                            form.setFieldValue('traffic_receivable_amount', value || 0);
                          }
                        }}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item name="screen_traffic_sgd" label="大屏上投流数据（新币）">
                      <InputNumber<number> style={{ width: '100%' }} min={0} precision={2} prefix="SGD" onFocus={selectNumberOnFocus} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item name="actual_traffic_provider" label="投流方">
                      <Select allowClear placeholder="请选择投流方">
                        <Option value="自营投放">自营投放</Option>
                        <Option value="品牌方投放">品牌方投放</Option>
                        <Option value="代投">代投</Option>
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item name="traffic_receivable_type" label="应收费用">
                      <Select allowClear placeholder="请选择应收对象">
                        <Option value="应收品牌">应收品牌</Option>
                        <Option value="应收达人">应收达人</Option>
                        <Option value="应收其他">应收其他</Option>
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item name="traffic_receivable_amount" label="应收金额">
                      <InputNumber<number>
                        style={{ width: '100%' }}
                        min={0}
                        precision={2}
                        prefix="USD"
                        onFocus={selectNumberOnFocus}
                        onChange={() => {
                          trafficReceivableEditedRef.current = true;
                        }}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item name="actual_received_gmv_sgd" label="实收GMV（新币）">
                      <InputNumber<number> style={{ width: '100%' }} min={0} precision={2} prefix="SGD" onFocus={selectNumberOnFocus} />
                    </Form.Item>
                  </Col>
                  <Col span={24}><Form.Item name="traffic_notes" label="投放备注"><TextArea rows={2} placeholder="实际投放情况、差异或问题记录" /></Form.Item></Col>
                </Row>
                </div>
              )}
            </>
          )}
          <Form.Item name="notes" label="备注">
            <TextArea rows={3} placeholder="补充记录、异常情况或复盘说明" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="批量新增达人排期"
        open={batchModalVisible}
        onOk={handleBatchSubmit}
        onCancel={() => setBatchModalVisible(false)}
        width={560}
      >
        <Form form={batchForm} layout="vertical">
          <Form.Item name="dateRange" label="日期周期" rules={[{ required: true, message: '请选择日期周期' }]}>
            <RangePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="influencer_id" label="达人" rules={[{ required: true, message: '请选择达人' }]}>
            <Select placeholder="从达人库选择达人" showSearch optionFilterProp="children">
              {influencers.map((item: any) => (
                <Option key={item.id || item._id} value={item.id || item._id}>
                  {item.name} ({item.platform})
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="platform" label="平台">
            <Select allowClear placeholder="请选择平台">
              <Option value="TikTok">TikTok</Option>
              <Option value="Shopee">Shopee</Option>
            </Select>
          </Form.Item>
          <Form.Item name="duration_hours" label="直播时长">
            <InputNumber style={{ width: '100%' }} min={0} step={0.5} addonAfter="小时" onFocus={selectNumberOnFocus} />
          </Form.Item>
          <Form.Item name="live_city" label="直播城市">
            <Input placeholder="非必填，可后续在直播明细中更改" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="批量删除排期"
        open={batchDeleteModalVisible}
        onOk={handleBatchDeleteSubmit}
        onCancel={() => setBatchDeleteModalVisible(false)}
        okText="删除"
        okButtonProps={{ danger: true }}
        width={560}
      >
        <Form form={batchDeleteForm} layout="vertical">
          <Form.Item name="dateRange" label="日期周期" rules={[{ required: true, message: '请选择日期周期' }]}>
            <RangePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="influencer_name" label="达人名称">
            <Input placeholder="不填则删除该周期内所有达人排期" />
          </Form.Item>
        </Form>
      </Modal>

      {communicationOnly && (
        <Modal
          title="导出达人排期"
          open={exportModalVisible}
          onOk={handleCommunicationExport}
          onCancel={() => setExportModalVisible(false)}
          width={680}
          okText="导出"
        >
          <Form form={exportForm} layout="vertical">
            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item name="influencer_name" label="达人" rules={[{ required: true, message: '请选择达人' }]}>
                  <Select placeholder="选择要导出的达人" showSearch optionFilterProp="children">
                    {exportInfluencerOptions.map((name) => (
                      <Option key={name} value={name}>{name}</Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item name="dateRange" label="日期范围" rules={[{ required: true, message: '请选择日期范围' }]}>
                  <RangePicker style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item name="fields" label="导出字段" rules={[{ required: true, message: '请选择至少一个字段' }]}>
              <Checkbox.Group options={communicationExportFieldOptions} className="export-field-checkboxes" />
            </Form.Item>
          </Form>
        </Modal>
      )}
    </div>
  );
};

export default LiveSessions;
