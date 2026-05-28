import React, { useEffect, useMemo, useState } from 'react';
import { Badge, Button, Calendar, Col, DatePicker, Form, Input, InputNumber, Modal, Row, Select, Space, Statistic, Table, Tabs, Tag, message } from 'antd';
import { EditOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import { liveSessionApi } from '../api';
import { defaultEmployees, EMPLOYEES_STORAGE_KEY } from '../data/employees';

const { Option } = Select;
const { TextArea } = Input;

const LEAVES_STORAGE_KEY = 'shopfluence_employee_leaves';
const LEAVE_OVERRIDES_STORAGE_KEY = 'shopfluence_employee_leave_overrides';
const PERFORMANCE_STORAGE_KEY = 'shopfluence_employee_performance';
const SCORES_STORAGE_KEY = 'shopfluence_employee_scores';
const ATTENDANCE_STORAGE_KEY = 'shopfluence_employee_attendance';

interface Employee {
  id: string;
  name: string;
  role: string;
  hireDate?: string;
  phone?: string;
  commissionRate: number;
  status: string;
}

interface LeaveRecord {
  id: string;
  employeeName: string;
  date: string;
  type: string;
  notes?: string;
}

interface PerformanceRecord {
  id: string;
  employeeName: string;
  date: string;
  type: 'excellent' | 'mistake';
  content: string;
}

interface ScoreRecord {
  id: string;
  employeeName: string;
  month: string;
  score: number;
  notes?: string;
}

interface AttendanceRecord {
  id: string;
  employeeName: string;
  month: string;
  manualAttendanceDays: number;
  manualLeaveDays: number;
  notes?: string;
}

const readStorage = <T,>(key: string, fallback: T): T => {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : fallback;
  } catch {
    return fallback;
  }
};

const formatMoney = (value: number | string | null | undefined) => `SGD ${Number(value || 0).toLocaleString()}`;
const formatSessionDate = (value: string | null | undefined) => {
  if (!value) return '';
  return /\d{2}:\d{2}/.test(value) ? dayjs(value).format('MM-DD HH:mm') : dayjs(value).format('MM-DD');
};
const formatSessionTime = (value: string | null | undefined) => {
  if (!value) return '未填时间';
  return /\d{2}:\d{2}/.test(value) ? dayjs(value).format('HH:mm') : '未填时间';
};
const sessionTitle = (item: any) => `${formatSessionDate(item.session_date)} ${item.influencer_name || '未填写达人'} / ${item.merchant_name || '未添加品牌信息'}`;
const isEmployeeInSession = (item: any, employeeName: string) => item.owner === employeeName || item.assistant === employeeName;
const isControlRole = (role: string) => role.includes('中控') || role.includes('场控');
const employeeTagColors = ['#1d4ed8', '#4338ca', '#7c3aed', '#0f766e', '#15803d', '#a16207', '#0e7490', '#be185d'];
const isBigSmallRestDay = (date: Dayjs) => {
  const weekDay = date.day();
  if (weekDay === 0) return true;
  if (weekDay !== 6) return false;
  let saturdayIndex = 0;
  for (let day = date.startOf('month'); !day.isAfter(date, 'day'); day = day.add(1, 'day')) {
    if (day.day() === 6) saturdayIndex += 1;
  }
  return saturdayIndex % 2 === 0;
};
const getBigSmallMonthDays = (month: Dayjs) => {
  const start = month.startOf('month');
  const days = Array.from({ length: month.daysInMonth() }, (_, index) => start.add(index, 'day'));
  let saturdayIndex = 0;
  let expectedAttendance = 0;

  days.forEach((day) => {
    const weekDay = day.day();
    if (weekDay >= 1 && weekDay <= 5) {
      expectedAttendance += 1;
    }
    if (weekDay === 6) {
      saturdayIndex += 1;
      if (saturdayIndex % 2 === 1) expectedAttendance += 1;
    }
  });

  return {
    expectedAttendance,
    expectedLeave: days.length - expectedAttendance,
  };
};

const EmployeeManagement: React.FC = () => {
  const [employees, setEmployees] = useState<Employee[]>(() => readStorage(EMPLOYEES_STORAGE_KEY, defaultEmployees));
  const [sessions, setSessions] = useState<any[]>([]);
  const [leaves, setLeaves] = useState<LeaveRecord[]>(() => readStorage(LEAVES_STORAGE_KEY, []));
  const [leaveOverrides, setLeaveOverrides] = useState<Record<string, string[]>>(() => readStorage(LEAVE_OVERRIDES_STORAGE_KEY, {}));
  const [performanceRecords, setPerformanceRecords] = useState<PerformanceRecord[]>(() => readStorage(PERFORMANCE_STORAGE_KEY, []));
  const [scores, setScores] = useState<ScoreRecord[]>(() => readStorage(SCORES_STORAGE_KEY, []));
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>(() => readStorage(ATTENDANCE_STORAGE_KEY, []));
  const [loading, setLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(dayjs());
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [assigningSession, setAssigningSession] = useState<any | null>(null);
  const [employeeModalOpen, setEmployeeModalOpen] = useState(false);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [attendanceModalOpen, setAttendanceModalOpen] = useState(false);
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const [performanceModalOpen, setPerformanceModalOpen] = useState(false);
  const [scoreModalOpen, setScoreModalOpen] = useState(false);
  const [leaveDayModalOpen, setLeaveDayModalOpen] = useState(false);
  const [editingLeaveDate, setEditingLeaveDate] = useState<Dayjs | null>(null);
  const [employeeForm] = Form.useForm();
  const [assignForm] = Form.useForm();
  const [attendanceForm] = Form.useForm();
  const [leaveForm] = Form.useForm();
  const [performanceForm] = Form.useForm();
  const [scoreForm] = Form.useForm();
  const [leaveDayForm] = Form.useForm();

  useEffect(() => {
    fetchSessions();
  }, []);

  useEffect(() => {
    localStorage.setItem(EMPLOYEES_STORAGE_KEY, JSON.stringify(employees));
  }, [employees]);

  useEffect(() => {
    localStorage.setItem(LEAVES_STORAGE_KEY, JSON.stringify(leaves));
  }, [leaves]);

  useEffect(() => {
    localStorage.setItem(LEAVE_OVERRIDES_STORAGE_KEY, JSON.stringify(leaveOverrides));
  }, [leaveOverrides]);

  useEffect(() => {
    localStorage.setItem(PERFORMANCE_STORAGE_KEY, JSON.stringify(performanceRecords));
  }, [performanceRecords]);

  useEffect(() => {
    localStorage.setItem(SCORES_STORAGE_KEY, JSON.stringify(scores));
  }, [scores]);

  useEffect(() => {
    localStorage.setItem(ATTENDANCE_STORAGE_KEY, JSON.stringify(attendanceRecords));
  }, [attendanceRecords]);

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const res = await liveSessionApi.getAll();
      setSessions(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch (error) {
      console.error('获取直播排期失败:', error);
      message.error('获取直播排期失败');
    } finally {
      setLoading(false);
    }
  };

  const monthSessions = useMemo(() => {
    return sessions.filter((item) => dayjs(item.session_date).isSame(selectedMonth, 'month') && item.schedule_type !== 'travel_note');
  }, [selectedMonth, sessions]);

  const expectedMonthDays = useMemo(() => getBigSmallMonthDays(selectedMonth), [selectedMonth]);

  const getDefaultLeaveEmployeeNames = (date: Dayjs) => {
    const activeEmployees = employees.filter((item) => item.status === 'active');
    const daySessions = sessions.filter((item) => item.schedule_type !== 'travel_note' && dayjs(item.session_date).isSame(date, 'day'));
    const restByBigSmall = isBigSmallRestDay(date);
    return activeEmployees
      .filter((employee) => {
        if (isControlRole(employee.role)) {
          return !daySessions.some((session) => isEmployeeInSession(session, employee.name));
        }
        return restByBigSmall;
      })
      .map((employee) => employee.name);
  };

  const getLeaveEmployeeNames = (date: Dayjs) => {
    const dateKey = date.format('YYYY-MM-DD');
    if (leaveOverrides[dateKey]) return leaveOverrides[dateKey];
    const registeredLeaves = leaves
      .filter((item) => dayjs(item.date).isSame(date, 'day'))
      .map((item) => item.employeeName);
    return Array.from(new Set([...getDefaultLeaveEmployeeNames(date), ...registeredLeaves]));
  };

  const getMonthLeaveDaysByEmployee = (employeeName: string) => {
    const start = selectedMonth.startOf('month');
    return Array.from({ length: selectedMonth.daysInMonth() }, (_, index) => start.add(index, 'day'))
      .filter((date) => getLeaveEmployeeNames(date).includes(employeeName)).length;
  };

  const employeeStats = useMemo(() => {
    return employees.map((employee) => {
      const relatedSessions = monthSessions.filter((item) => isEmployeeInSession(item, employee.name));
      const scheduledAttendanceDays = new Set(relatedSessions.map((item) => dayjs(item.session_date).format('YYYY-MM-DD'))).size;
      const manualAttendance = attendanceRecords.find((item) => item.employeeName === employee.name && item.month === selectedMonth.format('YYYY-MM'));
      const leaveDays = getMonthLeaveDaysByEmployee(employee.name);
      const excellentCount = performanceRecords.filter((item) => item.employeeName === employee.name && item.type === 'excellent' && dayjs(item.date).isSame(selectedMonth, 'month')).length;
      const mistakeCount = performanceRecords.filter((item) => item.employeeName === employee.name && item.type === 'mistake' && dayjs(item.date).isSame(selectedMonth, 'month')).length;
      const score = scores.find((item) => item.employeeName === employee.name && item.month === selectedMonth.format('YYYY-MM'));
      return {
        ...employee,
        expectedAttendance: expectedMonthDays.expectedAttendance,
        expectedLeave: expectedMonthDays.expectedLeave,
        scheduledAttendanceDays,
        actualAttendance: scheduledAttendanceDays + Number(manualAttendance?.manualAttendanceDays || 0),
        actualLeave: leaveDays + Number(manualAttendance?.manualLeaveDays || 0),
        sessionCount: relatedSessions.length,
        completedCount: relatedSessions.filter((item) => item.status === 'completed').length,
        expectedGmv: relatedSessions.reduce((sum, item) => sum + Number(item.expected_gmv || 0), 0),
        actualGmv: relatedSessions.reduce((sum, item) => sum + Number(item.actual_gmv_sgd || 0), 0),
        excellentCount,
        mistakeCount,
        score: score?.score,
      };
    });
  }, [attendanceRecords, employees, expectedMonthDays, leaves, leaveOverrides, monthSessions, performanceRecords, scores, selectedMonth, sessions]);

  const openCreateEmployeeModal = () => {
    setEditingEmployee(null);
    employeeForm.resetFields();
    employeeForm.setFieldsValue({ commissionRate: 0, status: 'active' });
    setEmployeeModalOpen(true);
  };

  const openEditEmployeeModal = (employee: Employee) => {
    setEditingEmployee(employee);
    employeeForm.setFieldsValue({
      ...employee,
      hireDate: employee.hireDate ? dayjs(employee.hireDate) : undefined,
    });
    setEmployeeModalOpen(true);
  };

  const saveEmployee = async () => {
    const values = await employeeForm.validateFields();
    const roleName = Array.isArray(values.role) ? values.role[0] : values.role;
    const payload = {
      ...values,
      role: roleName,
      hireDate: values.hireDate ? values.hireDate.format('YYYY-MM-DD') : undefined,
      status: values.status || 'active',
    };
    if (editingEmployee) {
      setEmployees((prev) => prev.map((item) => item.id === editingEmployee.id ? { ...item, ...payload } : item));
      message.success('员工档案已更新');
    } else {
      setEmployees((prev) => [{ ...payload, id: `E${Date.now()}` }, ...prev]);
      message.success('员工已添加');
    }
    setEmployeeModalOpen(false);
    setEditingEmployee(null);
    employeeForm.resetFields();
  };

  const openAttendanceModal = (employee?: Employee) => {
    const month = selectedMonth.format('YYYY-MM');
    const current = employee ? attendanceRecords.find((item) => item.employeeName === employee.name && item.month === month) : undefined;
    attendanceForm.setFieldsValue({
      employeeName: employee?.name,
      month: selectedMonth,
      manualAttendanceDays: current?.manualAttendanceDays || 0,
      manualLeaveDays: current?.manualLeaveDays || 0,
      notes: current?.notes,
    });
    setAttendanceModalOpen(true);
  };

  const saveAttendance = async () => {
    const values = await attendanceForm.validateFields();
    const record = {
      id: `A${Date.now()}`,
      employeeName: values.employeeName,
      month: values.month.format('YYYY-MM'),
      manualAttendanceDays: Number(values.manualAttendanceDays || 0),
      manualLeaveDays: Number(values.manualLeaveDays || 0),
      notes: values.notes,
    };
    setAttendanceRecords((prev) => [record, ...prev.filter((item) => !(item.employeeName === record.employeeName && item.month === record.month))]);
    setAttendanceModalOpen(false);
    attendanceForm.resetFields();
    message.success('考勤补录已保存');
  };

  const addLeave = async () => {
    const values = await leaveForm.validateFields();
    setLeaves((prev) => [{
      id: `L${Date.now()}`,
      employeeName: values.employeeName,
      date: values.date.format('YYYY-MM-DD'),
      type: values.type,
      notes: values.notes,
    }, ...prev]);
    setLeaveModalOpen(false);
    leaveForm.resetFields();
    message.success('休假已记录');
  };

  const addPerformance = async () => {
    const values = await performanceForm.validateFields();
    setPerformanceRecords((prev) => [{
      id: `P${Date.now()}`,
      employeeName: values.employeeName,
      date: values.date.format('YYYY-MM-DD'),
      type: values.type,
      content: values.content,
    }, ...prev]);
    setPerformanceModalOpen(false);
    performanceForm.resetFields();
    message.success('表现记录已添加');
  };

  const openPerformanceModal = (employee?: Employee) => {
    performanceForm.resetFields();
    performanceForm.setFieldsValue({
      employeeName: employee?.name,
      date: selectedMonth.isSame(dayjs(), 'month') ? dayjs() : selectedMonth.startOf('month'),
      type: 'excellent',
    });
    setPerformanceModalOpen(true);
  };

  const addScore = async () => {
    const values = await scoreForm.validateFields();
    const record = {
      id: `R${Date.now()}`,
      employeeName: values.employeeName,
      month: values.month.format('YYYY-MM'),
      score: values.score,
      notes: values.notes,
    };
    setScores((prev) => [record, ...prev.filter((item) => !(item.employeeName === record.employeeName && item.month === record.month))]);
    setScoreModalOpen(false);
    scoreForm.resetFields();
    message.success('绩效评分已保存');
  };

  const openScoreModal = (employee?: Employee) => {
    const current = employee
      ? scores.find((item) => item.employeeName === employee.name && item.month === selectedMonth.format('YYYY-MM'))
      : undefined;
    scoreForm.resetFields();
    scoreForm.setFieldsValue({
      employeeName: employee?.name,
      month: selectedMonth,
      score: current?.score,
      notes: current?.notes,
    });
    setScoreModalOpen(true);
  };

  const openLeaveDayModal = (date: Dayjs) => {
    const dateKey = date.format('YYYY-MM-DD');
    setEditingLeaveDate(date);
    leaveDayForm.setFieldsValue({
      date,
      employeeNames: leaveOverrides[dateKey] || getLeaveEmployeeNames(date),
    });
    setLeaveDayModalOpen(true);
  };

  const saveLeaveDay = async () => {
    if (!editingLeaveDate) return;
    const values = await leaveDayForm.validateFields();
    const dateKey = editingLeaveDate.format('YYYY-MM-DD');
    setLeaveOverrides((prev) => ({
      ...prev,
      [dateKey]: values.employeeNames || [],
    }));
    setLeaveDayModalOpen(false);
    setEditingLeaveDate(null);
    leaveDayForm.resetFields();
    message.success('当日休假员工已更新');
  };

  const openAssignModal = (session: any) => {
    setAssigningSession(session);
    assignForm.setFieldsValue({
      owner: session.owner,
      assistant: session.assistant ? [session.assistant] : undefined,
    });
    setAssignModalOpen(true);
  };

  const saveSessionAssignment = async () => {
    if (!assigningSession?.id) return;
    const values = await assignForm.validateFields();
    const assistantName = Array.isArray(values.assistant) ? values.assistant[0] : values.assistant;
    const payload = {
      ...assigningSession,
      owner: values.owner || null,
      assistant: assistantName || null,
    };

    try {
      await liveSessionApi.update(assigningSession.id, payload);
      setSessions((prev) => prev.map((item) => item.id === assigningSession.id ? { ...item, ...payload } : item));
      message.success('人员安排已同步到排期');
      setAssignModalOpen(false);
      setAssigningSession(null);
      assignForm.resetFields();
    } catch (error) {
      console.error('安排人员失败:', error);
      message.error('安排人员失败');
    }
  };

  const scheduleCellRender = (date: Dayjs) => {
    const daySessions = sessions.filter((item) => item.schedule_type !== 'travel_note' && dayjs(item.session_date).isSame(date, 'day'));
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
              openAssignModal(item);
            }}
          >
            <div className="employee-session-title">
              <span>{formatSessionTime(item.session_date)}</span>
              <Tag color={getEmployeeColor(item.owner)}>{item.owner || '未安排人员'}</Tag>
            </div>
            <div>{item.influencer_name || '未填写达人'} / {item.merchant_name || '未添加品牌信息'}</div>
            <div>{item.brand_cooperation_mode || '未填写合作模式'}</div>
          </button>
        ))}
      </div>
    );
  };

  const leaveCellRender = (date: Dayjs) => {
    const leaveNames = getLeaveEmployeeNames(date);
    if (!leaveNames.length) {
      return (
        <button
          type="button"
          className="employee-leave-cell employee-leave-cell-empty"
          onClick={(event) => {
            event.stopPropagation();
            openLeaveDayModal(date);
          }}
        >
          + 添加休假
        </button>
      );
    }
    return (
      <button
        type="button"
        className="employee-leave-cell"
        onClick={(event) => {
          event.stopPropagation();
          openLeaveDayModal(date);
        }}
      >
        {leaveNames.map((name) => {
          const employee = employees.find((item) => item.name === name);
          return (
          <div key={name} className="employee-calendar-line">
            <Badge color="orange" />
            <span>{name}{employee?.role ? `（${employee.role}）` : ''}</span>
          </div>
        );})}
      </button>
    );
  };

  const employeeOptions = employees.map((item) => <Option key={item.id} value={item.name}>{item.name} ({item.role})</Option>);
  const getEmployeeColor = (employeeName?: string) => {
    if (!employeeName) return 'default';
    const index = employees.findIndex((item) => item.name === employeeName);
    return employeeTagColors[(index >= 0 ? index : employeeName.length) % employeeTagColors.length];
  };

  return (
    <div>
      <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }} align="center">
        <Space wrap>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreateEmployeeModal}>新增员工</Button>
        </Space>
        <DatePicker picker="month" value={selectedMonth} onChange={(value) => value && setSelectedMonth(value)} />
      </Space>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8} lg={4}><Statistic title="在职员工" value={employees.filter((item) => item.status === 'active').length} /></Col>
        <Col xs={24} sm={8} lg={4}><Statistic title="本月员工场次" value={employeeStats.reduce((sum, item) => sum + item.sessionCount, 0)} /></Col>
        <Col xs={24} sm={8} lg={4}><Statistic title="本月休假" value={employees.reduce((sum, item) => sum + getMonthLeaveDaysByEmployee(item.name), 0)} /></Col>
        <Col xs={24} sm={8} lg={4}><Statistic title="优秀记录" value={employeeStats.reduce((sum, item) => sum + item.excellentCount, 0)} /></Col>
        <Col xs={24} sm={8} lg={4}><Statistic title="失误记录" value={employeeStats.reduce((sum, item) => sum + item.mistakeCount, 0)} /></Col>
        <Col xs={24} sm={8} lg={4}><Statistic title="本月实际GMV" value={monthSessions.reduce((sum, item) => sum + Number(item.actual_gmv_sgd || 0), 0)} precision={2} prefix="SGD" /></Col>
      </Row>

      <Tabs
        items={[
          {
            key: 'profiles',
            label: '员工档案',
            children: (
              <Table
                dataSource={employees}
                rowKey="id"
                pagination={false}
                columns={[
                  { title: '姓名', dataIndex: 'name', key: 'name' },
                  { title: '岗位', dataIndex: 'role', key: 'role', render: (value) => <Tag color="blue">{value}</Tag> },
                  { title: '入职时间', dataIndex: 'hireDate', key: 'hireDate', render: (value) => value || '-' },
                  { title: '应出勤', key: 'expectedAttendance', render: (_, record) => employeeStats.find((item) => item.id === record.id)?.expectedAttendance ?? expectedMonthDays.expectedAttendance },
                  { title: '应休假', key: 'expectedLeave', render: (_, record) => employeeStats.find((item) => item.id === record.id)?.expectedLeave ?? expectedMonthDays.expectedLeave },
                  { title: '实际出勤', key: 'actualAttendance', render: (_, record) => employeeStats.find((item) => item.id === record.id)?.actualAttendance ?? 0 },
                  { title: '实际休假', key: 'actualLeave', render: (_, record) => employeeStats.find((item) => item.id === record.id)?.actualLeave ?? 0 },
                  { title: '联系方式', dataIndex: 'phone', key: 'phone', render: (value) => value || '-' },
                  { title: '提成比例', dataIndex: 'commissionRate', key: 'commissionRate', render: (value) => `${(Number(value || 0) * 100).toFixed(2)}%` },
                  { title: '状态', dataIndex: 'status', key: 'status', render: (value) => <Tag color={value === 'active' ? 'green' : 'default'}>{value === 'active' ? '在职' : '停用'}</Tag> },
                  {
                    title: '操作',
                    key: 'actions',
                    render: (_, record) => (
                      <Space>
                        <Button type="link" icon={<EditOutlined />} onClick={() => openEditEmployeeModal(record)}>编辑</Button>
                        <Button type="link" onClick={() => openAttendanceModal(record)}>考勤</Button>
                      </Space>
                    ),
                  },
                ]}
              />
            ),
          },
          {
            key: 'leave',
            label: '休假月历',
            children: (
              <Calendar
                value={selectedMonth}
                onPanelChange={setSelectedMonth}
                cellRender={(date, info) => (info.type === 'date' ? leaveCellRender(date) : info.originNode)}
              />
            ),
          },
          {
            key: 'data',
            label: '场次数据',
            children: (
              <Table
                dataSource={employeeStats}
                rowKey="id"
                loading={loading}
                pagination={false}
                expandable={{
                  expandedRowRender: (record) => (
                    <Table
                      size="small"
                      rowKey={(item) => item.id || `${item.session_date}-${item.influencer_name}`}
                      dataSource={monthSessions.filter((item) => isEmployeeInSession(item, record.name))}
                      pagination={false}
                      columns={[
                        { title: '时间', dataIndex: 'session_date', key: 'session_date', render: formatSessionDate },
                        { title: '达人', dataIndex: 'influencer_name', key: 'influencer_name', render: (value) => value || '未填写' },
                        { title: '品牌', dataIndex: 'merchant_name', key: 'merchant_name', render: (value) => value || '未填写' },
                        { title: '身份', key: 'roleInSession', render: (_, item: any) => item.owner === record.name ? '负责人' : '助播' },
                        { title: '目标GMV', dataIndex: 'expected_gmv', key: 'expected_gmv', render: formatMoney },
                        { title: '本场GMV', dataIndex: 'actual_gmv_sgd', key: 'actual_gmv_sgd', render: formatMoney },
                        { title: '状态', dataIndex: 'status', key: 'status' },
                      ]}
                    />
                  ),
                }}
                columns={[
                  { title: '员工', dataIndex: 'name', key: 'name' },
                  { title: '岗位', dataIndex: 'role', key: 'role', render: (value) => <Tag color="blue">{value}</Tag> },
                  { title: '场次', dataIndex: 'sessionCount', key: 'sessionCount', sorter: (a, b) => a.sessionCount - b.sessionCount },
                  { title: '已完成', dataIndex: 'completedCount', key: 'completedCount' },
                  { title: '目标GMV', dataIndex: 'expectedGmv', key: 'expectedGmv', render: formatMoney },
                  { title: '实际GMV', dataIndex: 'actualGmv', key: 'actualGmv', render: formatMoney },
                  {
                    title: '优秀/失误',
                    key: 'perf',
                    render: (_, record) => (
                      <Space size={4}>
                        <span>{record.excellentCount}/{record.mistakeCount}</span>
                        <Button
                          type="text"
                          size="small"
                          icon={<EditOutlined />}
                          aria-label="修改优秀失误记录"
                          onClick={() => openPerformanceModal(record)}
                        />
                      </Space>
                    ),
                  },
                  {
                    title: '绩效分',
                    dataIndex: 'score',
                    key: 'score',
                    render: (value, record) => (
                      <Space size={4}>
                        <span>{value ?? '未评分'}</span>
                        <Button
                          type="text"
                          size="small"
                          icon={<EditOutlined />}
                          aria-label="修改绩效分"
                          onClick={() => openScoreModal(record)}
                        />
                      </Space>
                    ),
                  },
                ]}
              />
            ),
          },
          {
            key: 'performance',
            label: '表现记录',
            children: (
              <Table
                dataSource={performanceRecords}
                rowKey="id"
                pagination={{ pageSize: 10 }}
                columns={[
                  { title: '日期', dataIndex: 'date', key: 'date', sorter: (a, b) => dayjs(a.date).valueOf() - dayjs(b.date).valueOf() },
                  { title: '员工', dataIndex: 'employeeName', key: 'employeeName' },
                  { title: '类型', dataIndex: 'type', key: 'type', render: (value) => <Tag color={value === 'excellent' ? 'green' : 'red'}>{value === 'excellent' ? '表现优异' : '工作失误'}</Tag> },
                  { title: '内容', dataIndex: 'content', key: 'content' },
                ]}
              />
            ),
          },
        ]}
      />

      <Modal title={editingEmployee ? '编辑员工' : '新增员工'} open={employeeModalOpen} onOk={saveEmployee} onCancel={() => {
        setEmployeeModalOpen(false);
        setEditingEmployee(null);
      }}>
        <Form form={employeeForm} layout="vertical" initialValues={{ commissionRate: 0, status: 'active' }}>
          <Form.Item name="name" label="姓名" rules={[{ required: true, message: '请输入姓名' }]}><Input /></Form.Item>
          <Form.Item name="role" label="岗位" rules={[{ required: true, message: '请选择岗位' }]}>
            <Select mode="tags" maxCount={1} placeholder="请选择或新增岗位">
              <Option value="负责人">负责人</Option>
              <Option value="店铺运营">店铺运营</Option>
              <Option value="中控">中控</Option>
              <Option value="达人运营">达人运营</Option>
            </Select>
          </Form.Item>
          <Form.Item name="hireDate" label="入职时间"><DatePicker style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="phone" label="联系方式"><Input /></Form.Item>
          <Form.Item name="commissionRate" label="提成比例">
            <InputNumber<number> min={0} max={1} step={0.005} style={{ width: '100%' }} formatter={(value) => `${Number(value || 0) * 100}%`} parser={(value) => Number(value?.replace('%', '')) / 100} onFocus={(event) => event.target.select()} />
          </Form.Item>
          <Form.Item name="status" label="状态"><Select><Option value="active">在职</Option><Option value="inactive">停用</Option></Select></Form.Item>
        </Form>
      </Modal>

      <Modal title="安排场次人员" open={assignModalOpen} onOk={saveSessionAssignment} onCancel={() => {
        setAssignModalOpen(false);
        setAssigningSession(null);
      }}>
        <Space direction="vertical" style={{ width: '100%', marginBottom: 12 }}>
          <div>场次：{assigningSession ? sessionTitle(assigningSession) : '-'}</div>
          <div>合作模式：{assigningSession?.brand_cooperation_mode || '未填写合作模式'}</div>
        </Space>
        <Form form={assignForm} layout="vertical">
          <Form.Item name="owner" label="负责人">
            <Select allowClear showSearch optionFilterProp="children" placeholder="请选择负责人">
              {employeeOptions}
            </Select>
          </Form.Item>
          <Form.Item name="assistant" label="助播">
            <Select mode="tags" maxCount={1} allowClear showSearch optionFilterProp="children" placeholder="请选择或输入助播">
              {employeeOptions}
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="录入考勤" open={attendanceModalOpen} onOk={saveAttendance} onCancel={() => setAttendanceModalOpen(false)}>
        <Form form={attendanceForm} layout="vertical">
          <Form.Item name="employeeName" label="员工" rules={[{ required: true, message: '请选择员工' }]}><Select showSearch optionFilterProp="children">{employeeOptions}</Select></Form.Item>
          <Form.Item name="month" label="月份" rules={[{ required: true, message: '请选择月份' }]}><DatePicker picker="month" style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="manualAttendanceDays" label="手动补录出勤天数">
            <InputNumber min={0} precision={1} style={{ width: '100%' }} onFocus={(event) => event.target.select()} />
          </Form.Item>
          <Form.Item name="manualLeaveDays" label="手动补录休假天数">
            <InputNumber min={0} precision={1} style={{ width: '100%' }} onFocus={(event) => event.target.select()} />
          </Form.Item>
          <Form.Item name="notes" label="备注"><TextArea rows={2} placeholder="用于记录未体现在直播排期和休假登记中的出勤或休假" /></Form.Item>
        </Form>
      </Modal>

      <Modal title="登记休假" open={leaveModalOpen} onOk={addLeave} onCancel={() => setLeaveModalOpen(false)}>
        <Form form={leaveForm} layout="vertical">
          <Form.Item name="employeeName" label="员工" rules={[{ required: true, message: '请选择员工' }]}><Select showSearch optionFilterProp="children">{employeeOptions}</Select></Form.Item>
          <Form.Item name="date" label="日期" rules={[{ required: true, message: '请选择日期' }]}><DatePicker style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="type" label="休假类型" rules={[{ required: true, message: '请选择休假类型' }]}><Select><Option value="年假">年假</Option><Option value="病假">病假</Option><Option value="事假">事假</Option><Option value="调休">调休</Option></Select></Form.Item>
          <Form.Item name="notes" label="备注"><TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>

      <Modal
        title={editingLeaveDate ? `${editingLeaveDate.format('YYYY年MM月DD日')} 休假员工` : '修改休假员工'}
        open={leaveDayModalOpen}
        onOk={saveLeaveDay}
        onCancel={() => {
          setLeaveDayModalOpen(false);
          setEditingLeaveDate(null);
          leaveDayForm.resetFields();
        }}
      >
        <Form form={leaveDayForm} layout="vertical">
          <Form.Item name="date" label="日期">
            <DatePicker style={{ width: '100%' }} disabled />
          </Form.Item>
          <Form.Item name="employeeNames" label="休假员工">
            <Select mode="multiple" allowClear showSearch optionFilterProp="children" placeholder="选择或删除当日休假员工">
              {employeeOptions}
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="记录员工表现" open={performanceModalOpen} onOk={addPerformance} onCancel={() => setPerformanceModalOpen(false)}>
        <Form form={performanceForm} layout="vertical">
          <Form.Item name="employeeName" label="员工" rules={[{ required: true, message: '请选择员工' }]}><Select showSearch optionFilterProp="children">{employeeOptions}</Select></Form.Item>
          <Form.Item name="date" label="日期" rules={[{ required: true, message: '请选择日期' }]}><DatePicker style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="type" label="类型" rules={[{ required: true, message: '请选择类型' }]}><Select><Option value="excellent">表现优异</Option><Option value="mistake">工作失误</Option></Select></Form.Item>
          <Form.Item name="content" label="内容" rules={[{ required: true, message: '请输入记录内容' }]}><TextArea rows={3} placeholder="具体说明表现优异或工作失误事项" /></Form.Item>
        </Form>
      </Modal>

      <Modal title="绩效打分" open={scoreModalOpen} onOk={addScore} onCancel={() => setScoreModalOpen(false)}>
        <Form form={scoreForm} layout="vertical">
          <Form.Item name="employeeName" label="员工" rules={[{ required: true, message: '请选择员工' }]}><Select showSearch optionFilterProp="children">{employeeOptions}</Select></Form.Item>
          <Form.Item name="month" label="月份" rules={[{ required: true, message: '请选择月份' }]}><DatePicker picker="month" style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="score" label="绩效分" rules={[{ required: true, message: '请输入绩效分' }]}><InputNumber min={0} max={100} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="notes" label="评分备注"><TextArea rows={3} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default EmployeeManagement;
