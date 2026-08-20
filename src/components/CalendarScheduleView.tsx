import React, { useState, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  RotateCw,
  Search,
  Sparkles,
  Star,
  Clock,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Filter,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Share2,
  SlidersHorizontal,
  Flame,
  Layers,
  CalendarDays,
  CalendarRange,
  Landmark,
  BarChart3,
  Cpu,
  ArrowUpRight,
  Sun,
  Moon,
  Coffee,
  Check
} from 'lucide-react';
import { MacroCalendarEvent } from '../types';
import { COMPREHENSIVE_CALENDAR_EVENTS } from '../data/calendarData';
import { soundManager } from '../utils/audio';

interface CalendarScheduleViewProps {
  onSelectEvent?: (event: MacroCalendarEvent) => void;
  followedEventIds?: string[];
  onToggleFollowEvent?: (eventId: string) => void;
}

export type MainCalendarTab = 'daily' | 'weekly' | 'monthly';
export type CalendarCategory = 'heavy' | 'macro' | 'forex' | 'commodity' | 'bonds' | 'ashares' | 'hkstocks' | 'usstocks';
export type DataTypeFilter = 'all' | 'data' | 'event';
export type TimeSlotFilter = 'all' | 'morning' | 'afternoon' | 'night' | 'overnight';

export const CalendarScheduleView: React.FC<CalendarScheduleViewProps> = ({
  onSelectEvent,
  followedEventIds = [],
  onToggleFollowEvent,
}) => {
  // Main view mode: 'daily' (每日日程) vs 'weekly' (本周全景) vs 'monthly' (月度全景)
  const [mainTab, setMainTab] = useState<MainCalendarTab>('daily');
  
  // Selected single date for Daily View (Default: 2026-08-17)
  const [selectedDate, setSelectedDate] = useState<string>('2026-08-17');
  const [timeSlotFilter, setTimeSlotFilter] = useState<TimeSlotFilter>('all');
  const [activeCategory, setActiveCategory] = useState<CalendarCategory>('heavy');
  const [dataTypeFilter, setDataTypeFilter] = useState<DataTypeFilter>('all');
  const [onlyImportant, setOnlyImportant] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [weeklyViewLayout, setWeeklyViewLayout] = useState<'grid' | 'timeline'>('grid');

  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({
    'cal-sun-01': true,
    'cal-mon-01': true,
    'cal-thu-01': true,
    'cal-fri-02': true,
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2200);
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    soundManager.playNewsPing('normal');
    setTimeout(() => {
      setIsRefreshing(false);
      showToast('已同步最新全球官方数据与会议日程');
    }, 500);
  };

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Week days definition around current week (Aug 16 - Aug 22, 2026)
  const currentWeekDays = [
    { name: '周日', fullName: '星期日', date: '2026-08-16', dayNum: 16 },
    { name: '周一', fullName: '星期一', date: '2026-08-17', dayNum: 17, isToday: true },
    { name: '周二', fullName: '星期二', date: '2026-08-18', dayNum: 18 },
    { name: '周三', fullName: '星期三', date: '2026-08-19', dayNum: 19 },
    { name: '周四', fullName: '星期四', date: '2026-08-20', dayNum: 20 },
    { name: '周五', fullName: '星期五', date: '2026-08-21', dayNum: 21 },
    { name: '周六', fullName: '星期六', date: '2026-08-22', dayNum: 22 },
  ];

  // Categories definition matching financial standard: 重磅 宏观 外汇 商品 债券 A股 港股 美股
  const categoryPills: { id: CalendarCategory; label: string }[] = [
    { id: 'heavy', label: '重磅' },
    { id: 'macro', label: '宏观' },
    { id: 'forex', label: '外汇' },
    { id: 'commodity', label: '商品' },
    { id: 'bonds', label: '债券' },
    { id: 'ashares', label: 'A股' },
    { id: 'hkstocks', label: '港股' },
    { id: 'usstocks', label: '美股' },
  ];

  // Map dates to event count for the dot indicator
  const dateEventCounts = useMemo(() => {
    const map: Record<string, number> = {};
    COMPREHENSIVE_CALENDAR_EVENTS.forEach((e) => {
      map[e.date] = (map[e.date] || 0) + 1;
    });
    return map;
  }, []);

  // Filter events helper
  const filterEventItem = (item: MacroCalendarEvent) => {
    // 1. Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const match =
        item.event.toLowerCase().includes(q) ||
        item.country.toLowerCase().includes(q) ||
        (item.description && item.description.toLowerCase().includes(q)) ||
        (item.affectAssets && item.affectAssets.some(a => a.toLowerCase().includes(q)));
      if (!match) return false;
    }

    // 2. Category matching
    if (activeCategory === 'heavy') {
      if (item.category !== 'heavy' && item.importance < 3) return false;
    } else {
      if (item.category !== activeCategory && !item.affectAssets?.some(a => a.includes(activeCategory))) {
        return false;
      }
    }

    // 3. Data type filter (all / data / event)
    if (dataTypeFilter !== 'all' && item.type !== dataTypeFilter) {
      return false;
    }

    // 4. Only 3-star high impact
    if (onlyImportant && item.importance < 3) {
      return false;
    }

    return true;
  };

  // 1. DAILY VIEW: Events for ONLY the selected single date
  const dailyEvents = useMemo(() => {
    return COMPREHENSIVE_CALENDAR_EVENTS
      .filter((e) => e.date === selectedDate)
      .filter(filterEventItem)
      .filter((item) => {
        if (timeSlotFilter === 'all') return true;
        const timeStr = item.time;
        if (timeStr.includes('次日') || timeStr.startsWith('00:') || timeStr.startsWith('01:') || timeStr.startsWith('02:')) {
          return timeSlotFilter === 'overnight';
        }
        const hour = parseInt(timeStr.split(':')[0], 10);
        if (isNaN(hour)) return true;
        if (timeSlotFilter === 'morning') return hour >= 6 && hour < 12;
        if (timeSlotFilter === 'afternoon') return hour >= 12 && hour < 18;
        if (timeSlotFilter === 'night') return hour >= 18 && hour <= 23;
        return true;
      });
  }, [selectedDate, activeCategory, dataTypeFilter, onlyImportant, searchQuery, timeSlotFilter]);

  // Selected date metadata
  const currentDayMeta = useMemo(() => {
    const found = currentWeekDays.find((d) => d.date === selectedDate);
    const parts = selectedDate.split('-');
    return {
      month: parts[1] || '08',
      day: parts[2] || '17',
      weekDayName: found ? found.fullName : '星期一',
      isToday: selectedDate === '2026-08-17',
    };
  }, [selectedDate, currentWeekDays]);

  // Daily statistics
  const dailyStats = useMemo(() => {
    const allForDay = COMPREHENSIVE_CALENDAR_EVENTS.filter((e) => e.date === selectedDate);
    const heavyCount = allForDay.filter((e) => e.importance === 3).length;
    const dataCount = allForDay.filter((e) => e.type === 'data').length;
    const publishedCount = allForDay.filter((e) => e.actual && e.actual !== '待公布').length;
    const bullishCount = allForDay.filter((e) => e.impact === 'bullish').length;
    const bearishCount = allForDay.filter((e) => e.impact === 'bearish').length;

    return {
      total: allForDay.length,
      heavyCount,
      dataCount,
      publishedCount,
      bullishCount,
      bearishCount,
    };
  }, [selectedDate]);

  // 2. WEEKLY VIEW: Grouped strictly day-by-day across all 7 days of this week
  const weeklyDayGroups = useMemo(() => {
    return currentWeekDays.map((day) => {
      const items = COMPREHENSIVE_CALENDAR_EVENTS
        .filter((e) => e.date === day.date)
        .filter(filterEventItem);
      return {
        ...day,
        items,
        heavyItems: items.filter((e) => e.importance === 3),
      };
    });
  }, [currentWeekDays, activeCategory, dataTypeFilter, onlyImportant, searchQuery]);

  // Weekly Top Catalysts across 3 themes
  const weeklyCatalysts = useMemo(() => {
    const centralBanks = COMPREHENSIVE_CALENDAR_EVENTS.filter(
      (e) => e.importance === 3 && (e.event.includes('美联储') || e.event.includes('央行') || e.event.includes('LPR') || e.event.includes('纪要'))
    );
    const macroData = COMPREHENSIVE_CALENDAR_EVENTS.filter(
      (e) => e.importance === 3 && e.type === 'data' && (e.event.includes('CPI') || e.event.includes('零售') || e.event.includes('工业') || e.event.includes('PMI'))
    );
    const industryTech = COMPREHENSIVE_CALENDAR_EVENTS.filter(
      (e) => e.event.includes('DeepSeek') || e.event.includes('电池') || e.event.includes('OPEC') || e.event.includes('杰克逊霍尔') || e.event.includes('AI')
    );
    return {
      centralBanks: centralBanks.slice(0, 4),
      macroData: macroData.slice(0, 4),
      industryTech: industryTech.slice(0, 4),
    };
  }, []);

  // Quick Day Switch Handlers for Daily View
  const handlePrevDay = () => {
    const currentIndex = currentWeekDays.findIndex((d) => d.date === selectedDate);
    if (currentIndex > 0) {
      setSelectedDate(currentWeekDays[currentIndex - 1].date);
    }
  };

  const handleNextDay = () => {
    const currentIndex = currentWeekDays.findIndex((d) => d.date === selectedDate);
    if (currentIndex < currentWeekDays.length - 1) {
      setSelectedDate(currentWeekDays[currentIndex + 1].date);
    }
  };

  return (
    <div id="calendar-schedule-container" className="space-y-4 text-slate-800 animate-fadeIn max-w-[1720px] mx-auto">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-lg text-xs font-medium flex items-center gap-2 animate-slideDown">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* TOP LEVEL NAVIGATION: Explicitly Separate Daily, Weekly, and Monthly Tabs */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-3 sm:p-4 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Left Title & Status */}
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-600 text-white shadow-xs">
              <CalendarIcon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold text-slate-900">
                  全球财经宏观日历中心
                </h1>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  实时更新
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                严密追踪各国央行议息、宏观关键指标发布与产业重磅事件
              </p>
            </div>
          </div>

          {/* Right: Primary View Mode Switcher (每日日程 vs 本周全景 vs 月度日历) */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => {
                setMainTab('daily');
                soundManager.playNewsPing('normal');
              }}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
                mainTab === 'daily'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              <span>每日日程 (单日精细流)</span>
            </button>

            <button
              onClick={() => {
                setMainTab('weekly');
                soundManager.playNewsPing('normal');
              }}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
                mainTab === 'weekly'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <CalendarRange className="w-3.5 h-3.5" />
              <span>本周全景 (7日结构矩阵)</span>
            </button>

            <button
              onClick={() => {
                setMainTab('monthly');
                soundManager.playNewsPing('normal');
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                mainTab === 'monthly'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>月度视图</span>
            </button>

            <div className="w-px h-4 bg-slate-200 mx-1"></div>

            <button
              onClick={handleRefresh}
              title="刷新最新数据"
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200 transition"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-blue-600' : ''}`} />
            </button>
          </div>
        </div>

        {/* Universal Filter Bar (Categories + Search + Data/Event Filter) */}
        <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          {/* Category Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            {categoryPills.map((pill) => {
              const isActive = activeCategory === pill.id;
              return (
                <button
                  key={pill.id}
                  onClick={() => setActiveCategory(pill.id)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                    isActive
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-slate-50 text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200/70'
                  }`}
                >
                  {pill.label}
                </button>
              );
            })}
          </div>

          {/* Quick Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Filter: All / Data / Event */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-xs font-medium">
              <button
                onClick={() => setDataTypeFilter('all')}
                className={`px-2.5 py-1 rounded-md transition ${
                  dataTypeFilter === 'all' ? 'bg-white text-slate-900 font-bold shadow-xs' : 'text-slate-500'
                }`}
              >
                全部
              </button>
              <button
                onClick={() => setDataTypeFilter('data')}
                className={`px-2.5 py-1 rounded-md transition ${
                  dataTypeFilter === 'data' ? 'bg-white text-slate-900 font-bold shadow-xs' : 'text-slate-500'
                }`}
              >
                经济数据
              </button>
              <button
                onClick={() => setDataTypeFilter('event')}
                className={`px-2.5 py-1 rounded-md transition ${
                  dataTypeFilter === 'event' ? 'bg-white text-slate-900 font-bold shadow-xs' : 'text-slate-500'
                }`}
              >
                重大事件
              </button>
            </div>

            {/* 3-Star Heavy Only Toggle */}
            <button
              onClick={() => setOnlyImportant(!onlyImportant)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition flex items-center gap-1 ${
                onlyImportant
                  ? 'bg-red-50 border-red-300 text-red-700'
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Flame className={`w-3.5 h-3.5 ${onlyImportant ? 'text-red-600 fill-red-600' : 'text-slate-400'}`} />
              <span>仅看重磅 (3星)</span>
            </button>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索数据/国别/事件..."
                className="pl-8 pr-3 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-blue-500 focus:bg-white w-36 sm:w-48"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. SEPARATE VIEW: 📅 每日日程 (DAILY AGENDA VIEW) */}
      {/* ========================================================================= */}
      {mainTab === 'daily' && (
        <div className="space-y-4 animate-fadeIn">
          {/* Day Selector Ribbon (7-day bar with date clicker) */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  选择查看日期 (Select Date)
                </span>
                <span className="text-xs text-slate-500 font-mono">
                  2026年8月第3周
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrevDay}
                  className="p-1 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs flex items-center gap-0.5"
                  title="前一天"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">前一天</span>
                </button>

                <button
                  onClick={() => setSelectedDate('2026-08-17')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition border ${
                    selectedDate === '2026-08-17'
                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  今日 (8月17日)
                </button>

                <button
                  onClick={handleNextDay}
                  className="p-1 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs flex items-center gap-0.5"
                  title="后一天"
                >
                  <span className="hidden sm:inline">后一天</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* 7 Days Button Row */}
            <div className="grid grid-cols-7 gap-1.5 sm:gap-3">
              {currentWeekDays.map((day) => {
                const isSelected = selectedDate === day.date;
                const count = dateEventCounts[day.date] || 0;
                const isToday = day.isToday;

                return (
                  <button
                    key={day.date}
                    onClick={() => {
                      setSelectedDate(day.date);
                      soundManager.playNewsPing('normal');
                    }}
                    className={`p-2.5 sm:p-3 rounded-xl border transition flex flex-col items-center justify-between relative text-center group cursor-pointer ${
                      isSelected
                        ? 'bg-blue-600 text-white border-blue-600 shadow-md ring-2 ring-blue-300'
                        : isToday
                        ? 'bg-blue-50/70 border-blue-200 text-blue-900 hover:bg-blue-100'
                        : 'bg-slate-50 border-slate-200/80 text-slate-700 hover:bg-white hover:border-slate-300 hover:shadow-xs'
                    }`}
                  >
                    <span className={`text-[11px] font-semibold mb-1 ${isSelected ? 'text-blue-100' : 'text-slate-500'}`}>
                      {day.name}
                    </span>

                    <span className={`text-base sm:text-lg font-bold font-mono ${isSelected ? 'text-white' : 'text-slate-800'}`}>
                      {day.dayNum}
                    </span>

                    {/* Badge */}
                    <div className="mt-1 flex items-center gap-1">
                      {isToday && (
                        <span className={`text-[9px] px-1 py-0.2 rounded font-bold ${
                          isSelected ? 'bg-white text-blue-600' : 'bg-blue-600 text-white'
                        }`}>
                          今日
                        </span>
                      )}
                      <span className={`text-[10px] font-mono font-medium ${
                        isSelected ? 'text-blue-100' : 'text-slate-400'
                      }`}>
                        {count} 项
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Daily Schedule Header & Time-Slot Filters */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
            {/* Header: Focused Single Day Info Banner */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 flex flex-col items-center justify-center font-mono">
                  <span className="text-[10px] font-bold uppercase leading-tight">
                    {currentDayMeta.month}月
                  </span>
                  <span className="text-lg font-black leading-tight">
                    {currentDayMeta.day}
                  </span>
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base sm:text-lg font-bold text-slate-900">
                      {currentDayMeta.month}月{currentDayMeta.day}日 {currentDayMeta.weekDayName} 日程清单
                    </h2>
                    {currentDayMeta.isToday && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-600 text-white font-bold">
                        今日实时 TODAY
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 font-mono">
                    <span>全天共 <strong>{dailyStats.total}</strong> 项日程</span>
                    <span>·</span>
                    <span className="text-red-600 font-bold"><strong>{dailyStats.heavyCount}</strong> 项重磅</span>
                    <span>·</span>
                    <span><strong>{dailyStats.dataCount}</strong> 项经济数据</span>
                    {dailyStats.publishedCount > 0 && (
                      <>
                        <span>·</span>
                        <span className="text-emerald-600 font-semibold">已公布 <strong>{dailyStats.publishedCount}</strong> 项</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Time-Slot Tabs (Morning / Afternoon / Night / Overnight) */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-medium">
                <button
                  onClick={() => setTimeSlotFilter('all')}
                  className={`px-2.5 py-1 rounded-lg transition ${
                    timeSlotFilter === 'all' ? 'bg-white text-slate-900 font-bold shadow-xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  全部时段
                </button>
                <button
                  onClick={() => setTimeSlotFilter('morning')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition ${
                    timeSlotFilter === 'morning' ? 'bg-white text-slate-900 font-bold shadow-xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Coffee className="w-3 h-3 text-amber-500" />
                  <span>早盘 (06-12)</span>
                </button>
                <button
                  onClick={() => setTimeSlotFilter('afternoon')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition ${
                    timeSlotFilter === 'afternoon' ? 'bg-white text-slate-900 font-bold shadow-xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Sun className="w-3 h-3 text-amber-600" />
                  <span>欧盘 (12-18)</span>
                </button>
                <button
                  onClick={() => setTimeSlotFilter('night')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition ${
                    timeSlotFilter === 'night' ? 'bg-white text-slate-900 font-bold shadow-xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Moon className="w-3 h-3 text-indigo-500" />
                  <span>美盘 (18-24)</span>
                </button>
                <button
                  onClick={() => setTimeSlotFilter('overnight')}
                  className={`px-2.5 py-1 rounded-lg transition ${
                    timeSlotFilter === 'overnight' ? 'bg-white text-slate-900 font-bold shadow-xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  次日凌晨
                </button>
              </div>
            </div>

            {/* Daily Events List */}
            {dailyEvents.length === 0 ? (
              <div className="py-12 text-center space-y-3 bg-slate-50/70 rounded-xl border border-slate-100">
                <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center mx-auto">
                  <CalendarIcon className="w-6 h-6" />
                </div>
                <p className="text-sm font-semibold text-slate-700">该时段或筛选条件下暂无日程</p>
                <p className="text-xs text-slate-400">您可以尝试切换上方分类或查看其他时段</p>
              </div>
            ) : (
              <div className="space-y-3">
                {dailyEvents.map((item) => {
                  const isExpanded = !!expandedIds[item.id];
                  const isFollowed = followedEventIds.includes(item.id);
                  const isEconomicData = item.type === 'data';
                  const isHeavy = item.importance === 3;

                  return (
                    <div
                      key={item.id}
                      className={`p-4 rounded-xl border transition ${
                        isHeavy
                          ? 'bg-white border-slate-300/80 hover:border-blue-400 shadow-xs ring-1 ring-slate-100'
                          : 'bg-slate-50/70 border-slate-200 hover:bg-white'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          {/* Time Stamp Badge */}
                          <div className="shrink-0 pt-0.5 text-center">
                            <span className="font-mono text-sm font-bold text-slate-800 block">
                              {item.time}
                            </span>
                            <span className="text-[9px] font-mono text-slate-400">北京时间</span>
                          </div>

                          {/* Event Body */}
                          <div className="space-y-2 flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-base">{item.flag}</span>
                              <span className="text-xs font-bold text-slate-700">
                                {item.country}
                              </span>

                              {isHeavy && (
                                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-red-50 text-red-700 border border-red-200">
                                  ★★★ 重磅关注
                                </span>
                              )}

                              {item.impact && item.impact !== 'pending' && (
                                <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                                  item.impact === 'bullish'
                                    ? 'bg-red-50 text-red-700 border border-red-200'
                                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                }`}>
                                  {item.impact === 'bullish' ? '利多' : '利空'}
                                </span>
                              )}

                              {item.sourceDept && (
                                <span className="text-[10px] text-slate-400 font-medium">
                                  · {item.sourceDept}
                                </span>
                              )}
                            </div>

                            {/* Event Title */}
                            <h3 className="text-xs sm:text-sm font-bold text-slate-900 leading-snug">
                              {item.event}
                            </h3>

                            {/* Economic Data Figures (前值 / 预测 / 公布) */}
                            {isEconomicData && (
                              <div className="grid grid-cols-3 gap-2 p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-mono max-w-md">
                                <div>
                                  <div className="text-[10px] text-slate-400">前值 (Previous)</div>
                                  <div className="text-slate-700 font-semibold">{item.previous || '--'}</div>
                                </div>
                                <div>
                                  <div className="text-[10px] text-slate-400">预测 (Forecast)</div>
                                  <div className="text-blue-600 font-bold">{item.forecast || '--'}</div>
                                </div>
                                <div>
                                  <div className="text-[10px] text-slate-400">公布 (Actual)</div>
                                  <div className={`font-bold ${
                                    item.actual && item.actual !== '待公布' ? 'text-red-600' : 'text-slate-400'
                                  }`}>
                                    {item.actual || '待公布'}
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Expandable Description */}
                            {item.description && (
                              <div className="text-xs text-slate-600 leading-relaxed">
                                <span className="text-blue-600 font-semibold">{item.prefix || '前瞻'} | </span>
                                <span>
                                  {isExpanded ? item.description : `${item.description.slice(0, 80)}...`}
                                </span>
                                <button
                                  onClick={(e) => toggleExpand(item.id, e)}
                                  className="text-blue-600 font-medium ml-1.5 hover:underline inline-flex items-center gap-0.5"
                                >
                                  <span>{isExpanded ? '收起' : '展开'}</span>
                                  {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                </button>
                              </div>
                            )}

                            {/* Affected Assets Tags */}
                            {item.affectAssets && item.affectAssets.length > 0 && (
                              <div className="flex items-center gap-1.5 pt-0.5 flex-wrap">
                                <span className="text-[10px] text-slate-400 font-medium">联动标的:</span>
                                {item.affectAssets.map((asset, idx) => (
                                  <span
                                    key={idx}
                                    className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200"
                                  >
                                    {asset}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Actions: Follow / Copy */}
                        <div className="flex items-center gap-1 shrink-0">
                          {onToggleFollowEvent && (
                            <button
                              onClick={() => {
                                onToggleFollowEvent(item.id);
                                soundManager.playNewsPing('normal');
                              }}
                              title={isFollowed ? '取消关注' : '加入自选关注'}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-amber-500 hover:bg-slate-100 transition"
                            >
                              <Star className={`w-4 h-4 ${isFollowed ? 'fill-amber-400 text-amber-500' : ''}`} />
                            </button>
                          )}
                          <button
                            onClick={() => {
                              if (navigator.clipboard) {
                                navigator.clipboard.writeText(`【财经日程】${item.date} ${item.time} ${item.country} - ${item.event}`);
                                showToast('已复制日程信息到剪贴板');
                              }
                            }}
                            title="复制日程"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                          >
                            <Share2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. SEPARATE VIEW: 🗓️ 本周全景 (WEEKLY STRUCTURED MATRIX / ROADMAP) */}
      {/* ========================================================================= */}
      {mainTab === 'weekly' && (
        <div className="space-y-4 animate-fadeIn">
          {/* Weekly Top Catalysts Pillar Banner (央行 · 宏观 · 产业 3大支柱) */}
          <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-4 sm:p-5 shadow-lg relative overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3.5 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-500/20 border border-blue-400/30 text-blue-300">
                  <Flame className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-white">
                      本周宏观三大核心驱动支柱 (Weekly 3-Pillar Macro Roadmap)
                    </h2>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30 font-semibold">
                      8月16日 - 8月22日
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-0.5">
                    从央行货币政策意图、核心宏观数据到全球产业峰会全景串联
                  </p>
                </div>
              </div>

              {/* View Layout Switcher for Weekly */}
              <div className="flex items-center gap-1 bg-white/10 p-0.5 rounded-lg text-xs font-mono">
                <button
                  onClick={() => setWeeklyViewLayout('grid')}
                  className={`px-2.5 py-1 rounded-md transition ${
                    weeklyViewLayout === 'grid' ? 'bg-blue-600 text-white font-bold' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  7日矩阵网格
                </button>
                <button
                  onClick={() => setWeeklyViewLayout('timeline')}
                  className={`px-2.5 py-1 rounded-md transition ${
                    weeklyViewLayout === 'timeline' ? 'bg-blue-600 text-white font-bold' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  按日分组流
                </button>
              </div>
            </div>

            {/* 3 Pillar Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-3.5">
              {/* Pillar 1: Central Banks & Policy */}
              <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-amber-300 flex items-center gap-1.5">
                    <Landmark className="w-3.5 h-3.5 text-amber-400" />
                    <span>央行政策与利率决议</span>
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-400/20 text-amber-300 font-bold">
                    {weeklyCatalysts.centralBanks.length} 项重磅
                  </span>
                </div>
                <div className="space-y-1.5 text-xs text-slate-300">
                  {weeklyCatalysts.centralBanks.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => {
                        setSelectedDate(item.date);
                        setMainTab('daily');
                      }}
                      className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition cursor-pointer flex items-center justify-between gap-2"
                    >
                      <span className="truncate text-slate-200 hover:text-blue-300">{item.flag} {item.event}</span>
                      <span className="text-[10px] font-mono text-slate-400 shrink-0">{item.date.slice(5)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Pillar 2: Core Macro Data */}
              <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-blue-300 flex items-center gap-1.5">
                    <BarChart3 className="w-3.5 h-3.5 text-blue-400" />
                    <span>核心宏观与通胀指标</span>
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-blue-400/20 text-blue-300 font-bold">
                    {weeklyCatalysts.macroData.length} 项关键
                  </span>
                </div>
                <div className="space-y-1.5 text-xs text-slate-300">
                  {weeklyCatalysts.macroData.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => {
                        setSelectedDate(item.date);
                        setMainTab('daily');
                      }}
                      className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition cursor-pointer flex items-center justify-between gap-2"
                    >
                      <span className="truncate text-slate-200 hover:text-blue-300">{item.flag} {item.event}</span>
                      <span className="text-[10px] font-mono text-slate-400 shrink-0">{item.date.slice(5)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Pillar 3: Industry & Tech Catalysts */}
              <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-purple-300 flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5 text-purple-400" />
                    <span>产业峰会与AI重磅</span>
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-purple-400/20 text-purple-300 font-bold">
                    {weeklyCatalysts.industryTech.length} 项焦点
                  </span>
                </div>
                <div className="space-y-1.5 text-xs text-slate-300">
                  {weeklyCatalysts.industryTech.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => {
                        setSelectedDate(item.date);
                        setMainTab('daily');
                      }}
                      className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition cursor-pointer flex items-center justify-between gap-2"
                    >
                      <span className="truncate text-slate-200 hover:text-blue-300">{item.flag} {item.event}</span>
                      <span className="text-[10px] font-mono text-slate-400 shrink-0">{item.date.slice(5)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* WEEKLY 7-DAY MATRIX (7 Columns Grid or Grouped Timeline) */}
          {weeklyViewLayout === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-3">
              {weeklyDayGroups.map((day) => {
                const isToday = day.isToday;
                const hasHeavy = day.heavyItems.length > 0;

                return (
                  <div
                    key={day.date}
                    className={`rounded-2xl border flex flex-col justify-between transition ${
                      isToday
                        ? 'bg-blue-50/40 border-blue-400/80 shadow-md ring-1 ring-blue-300'
                        : 'bg-white border-slate-200 shadow-xs'
                    }`}
                  >
                    {/* Day Column Header */}
                    <div className={`p-3 border-b rounded-t-2xl flex items-center justify-between ${
                      isToday ? 'bg-blue-600 text-white' : 'bg-slate-50 border-slate-100'
                    }`}>
                      <div>
                        <div className={`text-xs font-bold ${isToday ? 'text-blue-100' : 'text-slate-500'}`}>
                          {day.fullName}
                        </div>
                        <div className={`text-sm font-black font-mono ${isToday ? 'text-white' : 'text-slate-900'}`}>
                          {day.date.slice(5)}
                        </div>
                      </div>

                      <div className="text-right">
                        {isToday ? (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-white text-blue-700 font-black">
                            今日
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono text-slate-400">
                            {day.items.length} 项
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Day Items Content */}
                    <div className="p-2.5 space-y-2 flex-1 min-h-[220px]">
                      {day.items.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-center py-6">
                          <span className="text-xs text-slate-400">暂无重点日程</span>
                        </div>
                      ) : (
                        day.items.map((item) => {
                          const isFollowed = followedEventIds.includes(item.id);
                          const isHeavyItem = item.importance === 3;

                          return (
                            <div
                              key={item.id}
                              onClick={() => {
                                setSelectedDate(day.date);
                                setMainTab('daily');
                              }}
                              className={`p-2 rounded-xl border text-xs cursor-pointer transition relative group ${
                                isHeavyItem
                                  ? 'bg-amber-50/50 border-amber-200/80 hover:bg-amber-50 hover:border-amber-400'
                                  : 'bg-slate-50/80 border-slate-200/70 hover:bg-white hover:border-blue-300'
                              }`}
                            >
                              <div className="flex items-center justify-between text-[10px] font-mono mb-1">
                                <span className="font-bold text-slate-700 flex items-center gap-1">
                                  {item.flag} {item.time}
                                </span>
                                {isHeavyItem && (
                                  <span className="text-[9px] font-bold px-1 py-0.2 rounded bg-red-100 text-red-700">
                                    重磅
                                  </span>
                                )}
                              </div>

                              <h4 className="text-[11px] font-semibold text-slate-800 leading-snug line-clamp-2">
                                {item.event}
                              </h4>

                              {item.forecast && (
                                <div className="mt-1 pt-1 border-t border-slate-200/50 text-[10px] font-mono text-slate-500 flex justify-between">
                                  <span>预期: <strong className="text-blue-600">{item.forecast}</strong></span>
                                  {item.previous && <span>前: {item.previous}</span>}
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* Footer: Jump to daily detail */}
                    <div className="p-2 border-t border-slate-100 text-center">
                      <button
                        onClick={() => {
                          setSelectedDate(day.date);
                          setMainTab('daily');
                        }}
                        className="text-[11px] text-blue-600 hover:text-blue-700 font-semibold inline-flex items-center gap-0.5"
                      >
                        <span>查看单日详情</span>
                        <ArrowUpRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Weekly Timeline View */
            <div className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100 shadow-xs">
              {weeklyDayGroups.map((day) => (
                <div key={day.date} className="p-4 sm:p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-4 bg-blue-600 rounded-full"></span>
                      <h3 className="text-sm sm:text-base font-bold text-slate-900">
                        {day.fullName} ({day.date})
                      </h3>
                      {day.isToday && (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-blue-600 text-white font-bold">
                          今日 TODAY
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        setSelectedDate(day.date);
                        setMainTab('daily');
                      }}
                      className="text-xs text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-0.5"
                    >
                      <span>单日深度视图</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    {day.items.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => {
                          setSelectedDate(day.date);
                          setMainTab('daily');
                        }}
                        className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-white hover:border-blue-300 transition cursor-pointer space-y-1.5"
                      >
                        <div className="flex items-center justify-between text-xs font-mono">
                          <span className="font-bold text-slate-700">{item.flag} {item.time}</span>
                          <span className="text-[10px] text-slate-400">{item.country}</span>
                        </div>
                        <h4 className="text-xs font-bold text-slate-900 leading-snug line-clamp-2">
                          {item.event}
                        </h4>
                        {item.description && (
                          <p className="text-[11px] text-slate-500 line-clamp-1">{item.description}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. SEPARATE VIEW: 📊 月度全景 (MONTHLY OVERVIEW) */}
      {/* ========================================================================= */}
      {mainTab === 'monthly' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-xs space-y-4 animate-fadeIn">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900">
                2026年08月 全球宏观大事月度日历
              </h2>
              <span className="text-xs text-slate-500 font-mono">
                (点击任意日期跳转至该日独立日程)
              </span>
            </div>
          </div>

          <div className="max-w-3xl mx-auto">
            <div className="grid grid-cols-7 gap-2 text-center font-bold text-xs text-slate-400 mb-2">
              <span>周日</span><span>周一</span><span>周二</span><span>周三</span><span>周四</span><span>周五</span><span>周六</span>
            </div>

            <div className="grid grid-cols-7 gap-2 text-center text-xs">
              {/* Previous month filler */}
              {['26', '27', '28', '29', '30', '31'].map((prevD) => (
                <div key={prevD} className="p-3 text-slate-300 bg-slate-50/50 rounded-xl font-mono">
                  {prevD}
                </div>
              ))}

              {Array.from({ length: 31 }).map((_, i) => {
                const dayNum = i + 1;
                const dateStr = `2026-08-${dayNum < 10 ? '0' + dayNum : dayNum}`;
                const isSelected = selectedDate === dateStr;
                const isToday = dateStr === '2026-08-17';
                const count = dateEventCounts[dateStr] || 0;

                return (
                  <button
                    key={dayNum}
                    onClick={() => {
                      setSelectedDate(dateStr);
                      setMainTab('daily');
                      soundManager.playNewsPing('normal');
                    }}
                    className={`p-3 rounded-xl border font-mono transition flex flex-col items-center justify-between min-h-[64px] cursor-pointer group ${
                      isSelected
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : isToday
                        ? 'bg-blue-50 border-blue-300 text-blue-900 font-bold'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-blue-200'
                    }`}
                  >
                    <span className="text-xs font-bold">{dayNum}</span>
                    {count > 0 && (
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                        isSelected ? 'bg-white/20 text-white' : 'bg-blue-50 text-blue-600'
                      }`}>
                        {count} 项
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
