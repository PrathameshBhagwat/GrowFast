import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  Calendar,
  ChevronDown,
  ChevronUp,
  Download,
  Filter,
  X,
  ChevronsLeft,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
  RefreshCw,
  ArrowLeft,
  Check,
} from 'lucide-react';
import {
  DailyOrderReportRowDTO,
  DailyOrdersReportSummaryDTO,
  Role,
} from '@growfast/shared-types';
import {
  fetchDailyOrdersReport,
  fetchEmployeesForFilter,
  searchCustomersForFilter,
  exportDailyOrdersToExcel,
} from '../services/report.api';

type DatePreset = 'TODAY' | 'YESTERDAY' | 'YESTERDAY_AND_TODAY' | 'CUSTOM';

interface FilterState {
  customerId: string;
  orderNumber: string;
  orderType: string;
  userId: string;
  hasDiscount: string;
  filterBy: string;
}

const DEFAULT_FILTERS: FilterState = {
  customerId: '',
  orderNumber: '',
  orderType: 'ALL',
  userId: 'ALL',
  hasDiscount: 'ALL',
  filterBy: 'ALL',
};

export const DailyOrdersReportPage: React.FC = () => {
  const navigate = useNavigate();
  const { employee } = useAuth();

  // Role validation: OWNER and MANAGER have access
  const isAuthorized = employee?.role === Role.OWNER || employee?.role === Role.MANAGER;

  // View expansion toggle
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  // Date Range Popover & Values
  const [isDatePopoverOpen, setIsDatePopoverOpen] = useState<boolean>(false);
  const [selectedPreset, setSelectedPreset] = useState<DatePreset>('TODAY');
  const [pendingPreset, setPendingPreset] = useState<DatePreset>('TODAY');

  // Custom date inputs
  const [startDateStr, setStartDateStr] = useState<string>('');
  const [endDateStr, setEndDateStr] = useState<string>('');
  const [pendingStartDate, setPendingStartDate] = useState<string>('');
  const [pendingEndDate, setPendingEndDate] = useState<string>('');

  // Active filters applied to query
  const [appliedFilters, setAppliedFilters] = useState<FilterState>(DEFAULT_FILTERS);
  // Draft filters in modal
  const [draftFilters, setDraftFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState<boolean>(false);

  // Pagination state
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalOrders, setTotalOrders] = useState<number>(0);

  // Data & loading states
  const [orders, setOrders] = useState<DailyOrderReportRowDTO[]>([]);
  const [summary, setSummary] = useState<DailyOrdersReportSummaryDTO | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Dropdown options data
  const [employeesList, setEmployeesList] = useState<Array<{ id: string; name: string; role: string }>>([]);
  const [customerOptions, setCustomerOptions] = useState<Array<{ id: string; name: string; customerCode?: string; phone: string }>>([]);
  const [customerSearchQuery, setCustomerSearchQuery] = useState<string>('');

  const datePopoverRef = useRef<HTMLDivElement>(null);

  // Calculate local date strings (YYYY-MM-DD)
  const getTodayDateStr = useCallback((): string => {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(new Date());
  }, []);

  const getYesterdayDateStr = useCallback((): string => {
    const today = new Date();
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(yesterday);
  }, []);

  // Initialize dates to Today on mount
  useEffect(() => {
    const today = getTodayDateStr();
    setStartDateStr(today);
    setEndDateStr(today);
    setPendingStartDate(today);
    setPendingEndDate(today);
  }, [getTodayDateStr]);

  // Load employee list for User filter
  useEffect(() => {
    if (isAuthorized) {
      fetchEmployeesForFilter().then((data) => setEmployeesList(data));
      searchCustomersForFilter('').then((data) => setCustomerOptions(data));
    }
  }, [isAuthorized]);

  // Handle outside click for Date Popover
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (datePopoverRef.current && !datePopoverRef.current.contains(e.target as Node)) {
        setIsDatePopoverOpen(false);
      }
    };
    if (isDatePopoverOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isDatePopoverOpen]);

  // Format date range header label: "Oct 20, 2026 - Oct 20, 2026"
  const dateRangeLabel = useMemo(() => {
    if (!startDateStr || !endDateStr) return 'Select Date Range';

    const formatHeaderDate = (isoOrDateOnly: string): string => {
      try {
        const parts = isoOrDateOnly.split('-');
        if (parts.length === 3) {
          const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
          return new Intl.DateTimeFormat('en-US', {
            month: 'short',
            day: '2-digit',
            year: 'numeric',
          }).format(d);
        }
        return isoOrDateOnly;
      } catch {
        return isoOrDateOnly;
      }
    };

    return `${formatHeaderDate(startDateStr)} - ${formatHeaderDate(endDateStr)}`;
  }, [startDateStr, endDateStr]);

  // Count active filters (for badge)
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (appliedFilters.customerId && appliedFilters.customerId !== 'ALL') count++;
    if (appliedFilters.orderNumber.trim()) count++;
    if (appliedFilters.orderType && appliedFilters.orderType !== 'ALL') count++;
    if (appliedFilters.userId && appliedFilters.userId !== 'ALL') count++;
    if (appliedFilters.hasDiscount && appliedFilters.hasDiscount !== 'ALL') count++;
    if (appliedFilters.filterBy && appliedFilters.filterBy !== 'ALL') count++;
    return count;
  }, [appliedFilters]);

  // Main Report Fetcher
  const loadReport = useCallback(async () => {
    if (!startDateStr || !endDateStr || !isAuthorized) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetchDailyOrdersReport({
        startDate: startDateStr,
        endDate: endDateStr,
        customerId: appliedFilters.customerId !== 'ALL' ? appliedFilters.customerId : undefined,
        orderNumber: appliedFilters.orderNumber.trim() || undefined,
        orderType: appliedFilters.orderType !== 'ALL' ? appliedFilters.orderType : undefined,
        userId: appliedFilters.userId !== 'ALL' ? appliedFilters.userId : undefined,
        hasDiscount:
          appliedFilters.hasDiscount === 'WITH'
            ? 'with'
            : appliedFilters.hasDiscount === 'WITHOUT'
              ? 'without'
              : undefined,
        filterBy: appliedFilters.filterBy !== 'ALL' ? appliedFilters.filterBy : undefined,
        page,
        pageSize,
      });

      setOrders(response.data || []);
      setTotalOrders(response.total || 0);
      setTotalPages(response.totalPages || 1);
      setSummary(response.summary || null);
    } catch (err: any) {
      setError(err.message || 'Failed to load report data');
    } finally {
      setIsLoading(false);
    }
  }, [startDateStr, endDateStr, appliedFilters, page, pageSize, isAuthorized]);

  // Fetch report on dependency changes
  useEffect(() => {
    loadReport();
  }, [loadReport]);

  // Search customers in Filter modal
  const handleCustomerSearch = (query: string) => {
    setCustomerSearchQuery(query);
    searchCustomersForFilter(query).then((results) => setCustomerOptions(results));
  };

  // Open Date Popover
  const openDatePopover = () => {
    setPendingPreset(selectedPreset);
    setPendingStartDate(startDateStr);
    setPendingEndDate(endDateStr);
    setIsDatePopoverOpen(true);
  };

  // Confirm Date Selection
  const handleUpdateDateRange = () => {
    let finalStart = pendingStartDate;
    let finalEnd = pendingEndDate;

    if (pendingPreset === 'TODAY') {
      const t = getTodayDateStr();
      finalStart = t;
      finalEnd = t;
    } else if (pendingPreset === 'YESTERDAY') {
      const y = getYesterdayDateStr();
      finalStart = y;
      finalEnd = y;
    } else if (pendingPreset === 'YESTERDAY_AND_TODAY') {
      finalStart = getYesterdayDateStr();
      finalEnd = getTodayDateStr();
    }

    if (finalStart > finalEnd) {
      setError('Start Date cannot be after End Date.');
      return;
    }

    setSelectedPreset(pendingPreset);
    setStartDateStr(finalStart);
    setEndDateStr(finalEnd);
    setPage(1); // Reset to first page
    setIsDatePopoverOpen(false);
  };

  // Cancel Date Selection
  const handleCancelDateRange = () => {
    setPendingPreset(selectedPreset);
    setPendingStartDate(startDateStr);
    setPendingEndDate(endDateStr);
    setIsDatePopoverOpen(false);
  };

  // Export to Excel handler
  const handleExportToExcel = async () => {
    if (orders.length === 0 && totalOrders === 0) return;

    setIsExporting(true);
    try {
      // If table has more records than current page, fetch all matching
      let exportRows = orders;
      if (totalOrders > orders.length) {
        const fullResponse = await fetchDailyOrdersReport({
          startDate: startDateStr,
          endDate: endDateStr,
          customerId: appliedFilters.customerId !== 'ALL' ? appliedFilters.customerId : undefined,
          orderNumber: appliedFilters.orderNumber.trim() || undefined,
          orderType: appliedFilters.orderType !== 'ALL' ? appliedFilters.orderType : undefined,
          userId: appliedFilters.userId !== 'ALL' ? appliedFilters.userId : undefined,
          hasDiscount:
            appliedFilters.hasDiscount === 'WITH'
              ? 'with'
              : appliedFilters.hasDiscount === 'WITHOUT'
                ? 'without'
                : undefined,
          filterBy: appliedFilters.filterBy !== 'ALL' ? appliedFilters.filterBy : undefined,
          export: true,
        });
        exportRows = fullResponse.data || [];
      }

      exportDailyOrdersToExcel(exportRows, `${startDateStr}_to_${endDateStr}`);
    } catch (err: any) {
      setError(`Export failed: ${err.message || 'Unknown error'}`);
    } finally {
      setIsExporting(false);
    }
  };

  // Download Historical Report Handler
  const handleDownloadHistoricalReport = async () => {
    setIsExporting(true);
    try {
      // Download 90 days historical report
      const today = new Date();
      const past90 = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000);
      const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
      const startHist = formatter.format(past90);
      const endHist = formatter.format(today);

      const histResponse = await fetchDailyOrdersReport({
        startDate: startHist,
        endDate: endHist,
        export: true,
      });

      exportDailyOrdersToExcel(histResponse.data || [], `Historical_${startHist}_to_${endHist}`);
    } catch (err: any) {
      setError(`Historical report export failed: ${err.message || 'Unknown error'}`);
    } finally {
      setIsExporting(false);
    }
  };

  // Open Filters Modal
  const openFiltersModal = () => {
    setDraftFilters({ ...appliedFilters });
    setIsFilterModalOpen(true);
  };

  // Apply Filters
  const handleApplyFilters = () => {
    setAppliedFilters({ ...draftFilters });
    setPage(1);
    setIsFilterModalOpen(false);
  };

  // Clear Filters
  const handleClearFilters = () => {
    setDraftFilters({ ...DEFAULT_FILTERS });
    setAppliedFilters({ ...DEFAULT_FILTERS });
    setPage(1);
    setIsFilterModalOpen(false);
  };

  // Unauthorized guard view
  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-md border border-slate-200 p-8 max-w-md w-full text-center">
          <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-4 font-bold text-xl">
            !
          </div>
          <h1 className="text-xl font-bold text-slate-800 mb-2">Access Restricted</h1>
          <p className="text-sm text-slate-500 mb-6">
            Daily Orders reports are exclusively accessible to Store Owners and Store Managers.
          </p>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="w-full py-2.5 px-4 bg-slate-900 text-white font-medium rounded-md hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans flex flex-col">
      {/* ─── Top Navbar ─────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 px-4 sm:px-6 py-3.5 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <button
            type="button"
            id="back-to-home-btn"
            onClick={() => navigate('/')}
            title="Return to Home"
            className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
          >
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Daily Orders
          </h1>
        </div>

        {/* Right Corner Controls: Language & Profile Avatar */}
        <div className="flex items-center gap-3">
          {/* Language Indicator matching reference screenshot */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-md select-none">
            <span className="text-sm" role="img" aria-label="UK flag">
              🇬🇧
            </span>
            <span>English</span>
            <ChevronDown size={13} className="text-slate-400" />
          </div>

          {/* User Initial Avatar matching reference screenshot */}
          <div
            title={`${employee?.name || 'User'} (${employee?.role || 'Staff'})`}
            className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center border border-slate-300 select-none shadow-xs"
          >
            {employee?.name ? employee.name.charAt(0).toUpperCase() : 'T'}
          </div>
        </div>
      </header>

      {/* ─── Main Content Container ─────────────────────────────────────── */}
      <main
        className={`flex-1 flex flex-col py-5 transition-all duration-200 ${
          isExpanded ? 'w-full px-3 sm:px-6' : 'max-w-7xl w-full mx-auto px-4 sm:px-6'
        }`}
      >
        {/* ─── Control Bar (Date Range, Download Link, Expand, Export, Filters) ─ */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3.5 mb-4">
          {/* Left Controls: Date Range Dropdown & Historical Report Link */}
          <div className="flex flex-wrap items-center gap-3 relative" ref={datePopoverRef}>
            {/* Date Range Selector Button */}
            <button
              type="button"
              id="date-range-popover-trigger"
              onClick={() => (isDatePopoverOpen ? handleCancelDateRange() : openDatePopover())}
              className="flex items-center gap-2.5 px-3.5 py-2 bg-white border border-slate-300 hover:border-slate-400 rounded-md text-xs sm:text-sm font-medium text-slate-800 shadow-xs transition-colors cursor-pointer"
            >
              <Calendar size={15} className="text-slate-500" />
              <span>{dateRangeLabel}</span>
              {isDatePopoverOpen ? (
                <ChevronUp size={14} className="text-slate-400" />
              ) : (
                <ChevronDown size={14} className="text-slate-400" />
              )}
            </button>

            {/* Date Range Popover matching reference screenshot 2 */}
            {isDatePopoverOpen && (
              <div
                id="date-range-popover-content"
                className="absolute left-0 top-full mt-1.5 w-64 bg-white border border-slate-200 rounded-lg shadow-xl p-3 z-50 animate-in fade-in zoom-in-95 duration-100"
              >
                <div className="space-y-1 mb-3">
                  {/* Preset 1: Today */}
                  <button
                    type="button"
                    onClick={() => {
                      setPendingPreset('TODAY');
                      const t = getTodayDateStr();
                      setPendingStartDate(t);
                      setPendingEndDate(t);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-md text-xs font-semibold transition-colors flex items-center justify-between cursor-pointer ${
                      pendingPreset === 'TODAY'
                        ? 'bg-slate-100 text-slate-900 font-bold'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span>Today</span>
                    {pendingPreset === 'TODAY' && <Check size={14} className="text-slate-800" />}
                  </button>

                  {/* Preset 2: Yesterday */}
                  <button
                    type="button"
                    onClick={() => {
                      setPendingPreset('YESTERDAY');
                      const y = getYesterdayDateStr();
                      setPendingStartDate(y);
                      setPendingEndDate(y);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-md text-xs font-semibold transition-colors flex items-center justify-between cursor-pointer ${
                      pendingPreset === 'YESTERDAY'
                        ? 'bg-slate-100 text-slate-900 font-bold'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span>Yesterday</span>
                    {pendingPreset === 'YESTERDAY' && (
                      <Check size={14} className="text-slate-800" />
                    )}
                  </button>

                  {/* Preset 3: Yesterday & Today */}
                  <button
                    type="button"
                    onClick={() => {
                      setPendingPreset('YESTERDAY_AND_TODAY');
                      setPendingStartDate(getYesterdayDateStr());
                      setPendingEndDate(getTodayDateStr());
                    }}
                    className={`w-full text-left px-3 py-2 rounded-md text-xs font-semibold transition-colors flex items-center justify-between cursor-pointer ${
                      pendingPreset === 'YESTERDAY_AND_TODAY'
                        ? 'bg-slate-100 text-slate-900 font-bold'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span>Yesterday & Today</span>
                    {pendingPreset === 'YESTERDAY_AND_TODAY' && (
                      <Check size={14} className="text-slate-800" />
                    )}
                  </button>

                  {/* Preset 4: Custom Days */}
                  <button
                    type="button"
                    onClick={() => setPendingPreset('CUSTOM')}
                    className={`w-full text-left px-3 py-2 rounded-md text-xs font-semibold transition-colors flex items-center justify-between cursor-pointer ${
                      pendingPreset === 'CUSTOM'
                        ? 'bg-slate-100 text-slate-900 font-bold'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span>Custom Days</span>
                    {pendingPreset === 'CUSTOM' && <Check size={14} className="text-slate-800" />}
                  </button>
                </div>

                {/* Custom Date Pickers when Custom Days is selected */}
                {pendingPreset === 'CUSTOM' && (
                  <div className="border-t border-slate-100 pt-3 pb-2 space-y-2 text-xs">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-500 mb-1">
                        From
                      </label>
                      <input
                        type="date"
                        value={pendingStartDate}
                        onChange={(e) => setPendingStartDate(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-600"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-500 mb-1">
                        To
                      </label>
                      <input
                        type="date"
                        value={pendingEndDate}
                        onChange={(e) => setPendingEndDate(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-600"
                      />
                    </div>
                  </div>
                )}

                {/* Bottom Action Row: Cancel and UPDATE */}
                <div className="border-t border-slate-100 pt-2.5 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    id="date-popover-cancel-btn"
                    onClick={handleCancelDateRange}
                    className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    id="date-popover-update-btn"
                    onClick={handleUpdateDateRange}
                    className="px-4 py-1.5 bg-[#0F172A] hover:bg-slate-800 text-white text-xs font-bold rounded uppercase tracking-wider transition-colors cursor-pointer"
                  >
                    UPDATE
                  </button>
                </div>
              </div>
            )}

            {/* Download historical report link matching screenshot */}
            <button
              type="button"
              id="download-historical-report-link"
              onClick={handleDownloadHistoricalReport}
              disabled={isExporting}
              className="text-xs sm:text-sm text-blue-600 hover:text-blue-800 underline transition-colors cursor-pointer disabled:opacity-50"
            >
              Download historical report
            </button>
          </div>

          {/* Right Controls: Expand toggle, Export To Excel, Filters */}
          <div className="flex items-center gap-3">
            {/* Expand Toggle */}
            <div className="flex items-center gap-2 select-none">
              <span className="text-xs sm:text-sm font-medium text-slate-700">Expand</span>
              <button
                type="button"
                role="switch"
                aria-checked={isExpanded}
                onClick={() => setIsExpanded((prev) => !prev)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  isExpanded ? 'bg-blue-600' : 'bg-slate-200'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                    isExpanded ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* EXPORT TO EXCEL Button */}
            <button
              type="button"
              id="export-to-excel-btn"
              onClick={handleExportToExcel}
              disabled={isExporting || totalOrders === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-md uppercase tracking-wider transition-colors shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download size={14} className="text-slate-500" />
              <span>{isExporting ? 'EXPORTING...' : 'EXPORT TO EXCEL'}</span>
            </button>

            {/* FILTERS Button */}
            <button
              type="button"
              id="filters-modal-trigger-btn"
              onClick={openFiltersModal}
              className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-md text-xs font-semibold uppercase tracking-wider transition-colors shadow-xs cursor-pointer ${
                activeFilterCount > 0
                  ? 'bg-blue-50 border-blue-300 text-blue-700'
                  : 'bg-white border-slate-300 hover:bg-slate-50 text-slate-700'
              }`}
            >
              <Filter size={14} className={activeFilterCount > 0 ? 'text-blue-600' : 'text-slate-500'} />
              <span>
                FILTERS {activeFilterCount > 0 && `(${activeFilterCount})`}
              </span>
            </button>
          </div>
        </div>

        {/* ─── Error Notification Banner ─────────────────────────────────── */}
        {error && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-md text-xs text-rose-700 flex items-center justify-between">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => setError(null)}
              className="text-rose-500 hover:text-rose-700 font-bold ml-2 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* ─── Report Table Container ───────────────────────────────────── */}
        <div className="bg-white border border-slate-200 rounded-lg shadow-xs overflow-hidden flex flex-col">
          {/* Scrollable table viewport matching reference screenshot 3 */}
          <div className="overflow-x-auto w-full min-h-[380px]">
            <table className="w-full text-left text-xs text-slate-800 border-collapse whitespace-nowrap">
              {/* Table Header matching Screenshot 3 exact columns */}
              <thead className="bg-[#F8FAFC] border-b border-slate-200 text-slate-600 font-semibold select-none">
                <tr>
                  <th className="py-3 px-4">Order Date / Time</th>
                  <th className="py-3 px-4">Order No.</th>
                  <th className="py-3 px-4">Customer Code</th>
                  <th className="py-3 px-4">Name</th>
                  <th className="py-3 px-4 max-w-xs truncate">Address</th>
                  <th className="py-3 px-4">Phone</th>
                  <th className="py-3 px-4">Due Date</th>
                  <th className="py-3 px-3 text-center">Pcs.</th>
                  <th className="py-3 px-3 text-center">Weight</th>
                  <th className="py-3 px-4 text-right">Gross Amount</th>
                  <th className="py-3 px-4 text-right">Discount</th>
                  <th className="py-3 px-4 text-right">Net Amount</th>
                  <th className="py-3 px-4 text-right">Advance</th>
                  <th className="py-3 px-4 text-right pr-6">Balance</th>
                </tr>
              </thead>

              {/* Table Body */}
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={14} className="py-16 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <RefreshCw size={24} className="animate-spin text-slate-400" />
                        <span className="text-xs font-medium">Loading orders report...</span>
                      </div>
                    </td>
                  </tr>
                ) : orders.length === 0 ? (
                  /* Empty state matching Screenshot 2 */
                  <tr>
                    <td colSpan={14} className="py-24 text-center">
                      <p className="text-base sm:text-lg font-bold text-slate-700">
                        No Orders found
                      </p>
                    </td>
                  </tr>
                ) : (
                  orders.map((order) => (
                    <tr
                      key={order.id}
                      className="hover:bg-slate-50/70 transition-colors"
                    >
                      {/* 1. Order Date / Time */}
                      <td className="py-3.5 px-4 text-slate-700">
                        {order.formattedOrderDate}
                      </td>

                      {/* 2. Order No. (Clickable blue link) */}
                      <td className="py-3.5 px-4 font-semibold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer">
                        <button
                          type="button"
                          onClick={() => navigate(`/orders/${order.id}`)}
                          className="cursor-pointer text-left focus:outline-none"
                        >
                          {order.orderNumber}
                        </button>
                      </td>

                      {/* 3. Customer Code */}
                      <td className="py-3.5 px-4 text-slate-600 font-mono text-[11px]">
                        {order.customerCode || '-'}
                      </td>

                      {/* 4. Name */}
                      <td className="py-3.5 px-4 font-medium text-slate-900 capitalize">
                        {order.customerName}
                      </td>

                      {/* 5. Address */}
                      <td
                        className="py-3.5 px-4 text-slate-500 max-w-xs truncate"
                        title={order.customerAddress}
                      >
                        {order.customerAddress}
                      </td>

                      {/* 6. Phone */}
                      <td className="py-3.5 px-4 text-slate-600 font-mono text-[11px]">
                        {order.customerPhone}
                      </td>

                      {/* 7. Due Date */}
                      <td className="py-3.5 px-4 text-slate-700">
                        {order.formattedDueDate}
                      </td>

                      {/* 8. Pcs. */}
                      <td className="py-3.5 px-3 text-center text-slate-800 font-medium">
                        {order.pieces}
                      </td>

                      {/* 9. Weight */}
                      <td className="py-3.5 px-3 text-center text-slate-600">
                        {order.weight != null ? order.weight : '-'}
                      </td>

                      {/* 10. Gross Amount */}
                      <td className="py-3.5 px-4 text-right font-medium text-slate-800">
                        {order.grossAmount}
                      </td>

                      {/* 11. Discount */}
                      <td className="py-3.5 px-4 text-right text-slate-600">
                        {order.discount}
                      </td>

                      {/* 12. Net Amount */}
                      <td className="py-3.5 px-4 text-right font-semibold text-slate-900">
                        {order.netAmount}
                      </td>

                      {/* 13. Advance */}
                      <td className="py-3.5 px-4 text-right text-emerald-700 font-medium">
                        {order.advance}
                      </td>

                      {/* 14. Balance */}
                      <td
                        className={`py-3.5 px-4 text-right pr-6 font-semibold ${
                          order.balance > 0 ? 'text-rose-600' : 'text-slate-500'
                        }`}
                      >
                        {order.balance}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* ─── Table Summary Totals Row (when data present) ────────────── */}
          {summary && totalOrders > 0 && !isLoading && (
            <div className="bg-[#F8FAFC] border-t border-slate-200 px-4 py-2.5 flex flex-wrap items-center justify-between gap-4 text-xs font-semibold text-slate-700">
              <div className="flex items-center gap-4">
                <span>Total Orders: <strong className="text-slate-900">{summary.totalOrders}</strong></span>
                <span>Total Pcs: <strong className="text-slate-900">{summary.totalPieces}</strong></span>
                {summary.totalWeight > 0 && (
                  <span>Total Weight: <strong className="text-slate-900">{summary.totalWeight} kg</strong></span>
                )}
              </div>
              <div className="flex items-center gap-4 text-right">
                <span>Gross: <strong className="text-slate-900">₹{summary.totalGrossAmount}</strong></span>
                <span>Discount: <strong className="text-slate-900">₹{summary.totalDiscount}</strong></span>
                <span>Net: <strong className="text-slate-900">₹{summary.totalNetAmount}</strong></span>
                <span>Advance: <strong className="text-emerald-700">₹{summary.totalAdvance}</strong></span>
                <span>Balance: <strong className="text-rose-600">₹{summary.totalBalance}</strong></span>
              </div>
            </div>
          )}

          {/* ─── Pagination Footer matching Screenshot 2 & 3 ─────────────── */}
          <div className="border-t border-slate-200 px-4 py-3 bg-white flex flex-col sm:flex-row items-center justify-between sm:justify-end gap-3 text-xs text-slate-600 select-none">
            {/* Rows Per Page Dropdown */}
            <div className="flex items-center gap-2">
              <span>Rows per page</span>
              <div className="relative">
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  className="bg-white border border-slate-300 rounded px-2.5 py-1 text-xs text-slate-800 pr-6 appearance-none focus:outline-none focus:ring-1 focus:ring-slate-500 cursor-pointer"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
                <ChevronDown
                  size={12}
                  className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400"
                />
              </div>
            </div>

            {/* Current Page Display */}
            <div className="text-slate-600 font-medium">
              Page {totalOrders > 0 ? page : 1} of {totalOrders > 0 ? totalPages : 0}
            </div>

            {/* Page Navigation Buttons */}
            <div className="flex items-center gap-1">
              {/* First Page */}
              <button
                type="button"
                id="pagination-first-btn"
                title="First Page"
                disabled={page <= 1 || isLoading}
                onClick={() => setPage(1)}
                className="p-1 rounded hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-transparent text-slate-600 cursor-pointer"
              >
                <ChevronsLeft size={16} />
              </button>

              {/* Prev Page */}
              <button
                type="button"
                id="pagination-prev-btn"
                title="Previous Page"
                disabled={page <= 1 || isLoading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-1 rounded hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-transparent text-slate-600 cursor-pointer"
              >
                <ChevronLeft size={16} />
              </button>

              {/* Next Page */}
              <button
                type="button"
                id="pagination-next-btn"
                title="Next Page"
                disabled={page >= totalPages || isLoading || totalOrders === 0}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="p-1 rounded hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-transparent text-slate-600 cursor-pointer"
              >
                <ChevronRight size={16} />
              </button>

              {/* Last Page */}
              <button
                type="button"
                id="pagination-last-btn"
                title="Last Page"
                disabled={page >= totalPages || isLoading || totalOrders === 0}
                onClick={() => setPage(totalPages)}
                className="p-1 rounded hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-transparent text-slate-600 cursor-pointer"
              >
                <ChevronsRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* ─── FILTERS MODAL matching Screenshot 1 ────────────────────────── */}
      {isFilterModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-100">
          <div
            id="filters-modal-container"
            className="bg-white rounded-lg shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-150"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900">Filters</h2>
              <button
                type="button"
                id="filters-modal-close-btn"
                onClick={() => setIsFilterModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body: 2 rows of 3 columns */}
            <div className="p-6 space-y-4">
              {/* Row 1: Customer, Order #, Order Type */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* 1. Customer */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Customer
                  </label>
                  <select
                    value={draftFilters.customerId}
                    onChange={(e) =>
                      setDraftFilters((prev) => ({ ...prev, customerId: e.target.value }))
                    }
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-500 cursor-pointer"
                  >
                    <option value="">Select Customers...</option>
                    <option value="ALL">All Customers</option>
                    {customerOptions.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.customerCode ? `(${c.customerCode})` : `(${c.phone})`}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 2. Order # */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Order #
                  </label>
                  <input
                    type="text"
                    placeholder="Order Number"
                    value={draftFilters.orderNumber}
                    onChange={(e) =>
                      setDraftFilters((prev) => ({ ...prev, orderNumber: e.target.value }))
                    }
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-500"
                  />
                </div>

                {/* 3. Order Type */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Order Type
                  </label>
                  <select
                    value={draftFilters.orderType}
                    onChange={(e) =>
                      setDraftFilters((prev) => ({ ...prev, orderType: e.target.value }))
                    }
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-500 cursor-pointer"
                  >
                    <option value="ALL">All</option>
                    <option value="LAUNDRY_DRY_CLEANING">Laundry & Dry Cleaning</option>
                    <option value="DRY_CLEANING">Dry Cleaning</option>
                    <option value="LAUNDRY">Laundry</option>
                    <option value="SHOE_CLEANING">Shoe Cleaning</option>
                    <option value="WEIGHT_BASED">Weight Based</option>
                  </select>
                </div>
              </div>

              {/* Row 2: User, Discount, Filter By */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* 4. User */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    User
                  </label>
                  <select
                    value={draftFilters.userId}
                    onChange={(e) =>
                      setDraftFilters((prev) => ({ ...prev, userId: e.target.value }))
                    }
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-500 cursor-pointer"
                  >
                    <option value="ALL">All</option>
                    {employeesList.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name} ({emp.role})
                      </option>
                    ))}
                  </select>
                </div>

                {/* 5. Discount */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Discount
                  </label>
                  <select
                    value={draftFilters.hasDiscount}
                    onChange={(e) =>
                      setDraftFilters((prev) => ({ ...prev, hasDiscount: e.target.value }))
                    }
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-500 cursor-pointer"
                  >
                    <option value="ALL">All</option>
                    <option value="WITH">With Discount</option>
                    <option value="WITHOUT">Without Discount</option>
                  </select>
                </div>

                {/* 6. Filter By */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Filter By
                  </label>
                  <select
                    value={draftFilters.filterBy}
                    onChange={(e) =>
                      setDraftFilters((prev) => ({ ...prev, filterBy: e.target.value }))
                    }
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-500 cursor-pointer"
                  >
                    <option value="ALL">All</option>
                    <option value="PAID">Fully Paid</option>
                    <option value="PARTIAL">Partially Paid</option>
                    <option value="PENDING">Unpaid</option>
                    <option value="RECEIVED">Received</option>
                    <option value="PROCESSING">Processing</option>
                    <option value="READY">Ready</option>
                    <option value="DELIVERED">Delivered</option>
                    <option value="CANCELLED">Cancelled</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Modal Footer matching Screenshot 1 */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50">
              <button
                type="button"
                id="filters-modal-clear-btn"
                onClick={handleClearFilters}
                className="px-5 py-2 text-xs font-bold uppercase tracking-wider text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 transition-colors cursor-pointer"
              >
                CLEAR
              </button>
              <button
                type="button"
                id="filters-modal-apply-btn"
                onClick={handleApplyFilters}
                className="px-6 py-2 text-xs font-bold uppercase tracking-wider text-white bg-[#0F172A] hover:bg-slate-800 rounded transition-colors shadow-xs cursor-pointer"
              >
                APPLY
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DailyOrdersReportPage;
