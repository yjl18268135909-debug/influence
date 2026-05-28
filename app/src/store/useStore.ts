import { create } from 'zustand';
import { influencerApi, merchantApi, reportApi, liveSessionApi, orderApi, expenseApi, costApi, incomeApi } from '../api';

interface FilterState {
  startDate: string;
  endDate: string;
  influencerId: number | null;
  platform: string;
  setStartDate: (date: string) => void;
  setEndDate: (date: string) => void;
  setInfluencerId: (id: number | null) => void;
  setPlatform: (platform: string) => void;
  resetFilters: () => void;
}

interface DataState {
  influencers: any[];
  merchants: any[];
  liveSessions: any[];
  orders: any[];
  expenses: any[];
  costs: any[];
  incomes: any[];
  summary: any;
  influencerRanking: any[];
  monthlyTrend: any[];
  loading: boolean;
  fetchInfluencers: () => Promise<void>;
  fetchMerchants: () => Promise<void>;
  fetchLiveSessions: () => Promise<void>;
  fetchOrders: () => Promise<void>;
  fetchExpenses: () => Promise<void>;
  fetchCosts: () => Promise<void>;
  fetchIncomes: () => Promise<void>;
  fetchSummary: () => Promise<void>;
  fetchInfluencerRanking: () => Promise<void>;
  fetchMonthlyTrend: () => Promise<void>;
  fetchAllData: () => Promise<void>;
  refresh: (key: string) => Promise<void>;
}

export const useFilterStore = create<FilterState>((set) => ({
  startDate: '',
  endDate: '',
  influencerId: null,
  platform: '',
  setStartDate: (date) => set({ startDate: date }),
  setEndDate: (date) => set({ endDate: date }),
  setInfluencerId: (id) => set({ influencerId: id }),
  setPlatform: (platform) => set({ platform }),
  resetFilters: () => set({ startDate: '', endDate: '', influencerId: null, platform: '' }),
}));

export const useDataStore = create<DataState>((set, get) => ({
  influencers: [],
  merchants: [],
  liveSessions: [],
  orders: [],
  expenses: [],
  costs: [],
  incomes: [],
  summary: null,
  influencerRanking: [],
  monthlyTrend: [],
  loading: false,

  fetchInfluencers: async () => {
    try {
      const res = await influencerApi.getAll();
      set({ influencers: res.data || [] });
    } catch (error) {
      console.error('Failed to fetch influencers:', error);
      set({ influencers: [] });
    }
  },

  fetchMerchants: async () => {
    try {
      const res = await merchantApi.getAll();
      set({ merchants: res.data || [] });
    } catch (error) {
      console.error('Failed to fetch merchants:', error);
      set({ merchants: [] });
    }
  },

  fetchLiveSessions: async () => {
    try {
      const res = await liveSessionApi.getAll();
      set({ liveSessions: res.data || [] });
    } catch (error) {
      console.error('Failed to fetch live sessions:', error);
      set({ liveSessions: [] });
    }
  },

  fetchOrders: async () => {
    try {
      const res = await orderApi.getAll();
      set({ orders: res.data || [] });
    } catch (error) {
      console.error('Failed to fetch orders:', error);
      set({ orders: [] });
    }
  },

  fetchExpenses: async () => {
    try {
      const res = await expenseApi.getAll();
      set({ expenses: res.data || [] });
    } catch (error) {
      console.error('Failed to fetch expenses:', error);
      set({ expenses: [] });
    }
  },

  fetchCosts: async () => {
    try {
      const res = await costApi.getAll();
      set({ costs: res.data || [] });
    } catch (error) {
      console.error('Failed to fetch costs:', error);
      set({ costs: [] });
    }
  },

  fetchIncomes: async () => {
    try {
      const res = await incomeApi.getAll();
      set({ incomes: res.data || [] });
    } catch (error) {
      console.error('Failed to fetch incomes:', error);
      set({ incomes: [] });
    }
  },

  fetchSummary: async () => {
    try {
      const filterState = useFilterStore.getState();
      const params: any = {};
      if (filterState.startDate) params.startDate = filterState.startDate;
      if (filterState.endDate) params.endDate = filterState.endDate;
      if (filterState.influencerId) params.influencerId = filterState.influencerId;
      if (filterState.platform) params.platform = filterState.platform;

      const res = await reportApi.getSummary(params);
      set({ summary: res.data });
    } catch (error) {
      console.error('Failed to fetch summary:', error);
    }
  },

  fetchInfluencerRanking: async () => {
    try {
      const filterState = useFilterStore.getState();
      const params: any = {};
      if (filterState.startDate) params.startDate = filterState.startDate;
      if (filterState.endDate) params.endDate = filterState.endDate;
      if (filterState.platform) params.platform = filterState.platform;

      const res = await reportApi.getInfluencerRanking(params);
      set({ influencerRanking: res.data });
    } catch (error) {
      console.error('Failed to fetch influencer ranking:', error);
    }
  },

  fetchMonthlyTrend: async () => {
    try {
      const filterState = useFilterStore.getState();
      const params: any = {};
      if (filterState.startDate) params.startDate = filterState.startDate;
      if (filterState.endDate) params.endDate = filterState.endDate;
      if (filterState.influencerId) params.influencerId = filterState.influencerId;
      if (filterState.platform) params.platform = filterState.platform;

      const res = await reportApi.getMonthlyTrend(params);
      set({ monthlyTrend: res.data });
    } catch (error) {
      console.error('Failed to fetch monthly trend:', error);
    }
  },

  fetchAllData: async () => {
    set({ loading: true });
    try {
      await Promise.all([
        get().fetchInfluencers(),
        get().fetchMerchants(),
        get().fetchSummary(),
        get().fetchInfluencerRanking(),
        get().fetchMonthlyTrend(),
      ]);
    } catch (error) {
      console.error('Error fetching all data:', error);
    } finally {
      set({ loading: false });
    }
  },

  refresh: async (key: string) => {
    const methods: Record<string, () => Promise<void>> = {
      influencers: get().fetchInfluencers,
      merchants: get().fetchMerchants,
      liveSessions: get().fetchLiveSessions,
      orders: get().fetchOrders,
      expenses: get().fetchExpenses,
      costs: get().fetchCosts,
      incomes: get().fetchIncomes,
    };

    if (methods[key]) {
      await methods[key]();
    }
  },
}));
