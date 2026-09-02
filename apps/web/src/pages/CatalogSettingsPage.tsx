import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LoadingState, EmptyState, ErrorState } from '@growfast/ui';
import { GarmentCategory, Role } from '@growfast/shared-types';
import type { GarmentCatalogDTO } from '@growfast/shared-types';
import {
  ArrowLeft,
  Edit2,
  Shirt,
  Plus,
  Search,
  Check,
  Save,
  Tag,
  X,
  Lock,
  Layers,
  Sparkles,
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || '/api';

/** All category values for the filter UI. */
const CATEGORIES = Object.values(GarmentCategory);

/** Human-readable labels for category values. */
const CATEGORY_LABELS: Record<string, string> = {
  MEN: 'Men',
  WOMEN: 'Women',
  KIDS: 'Kids',
  HOUSEHOLD: 'Household',
  SHOES: 'Shoes',
  SPECIAL: 'Special',
  WEIGHT_BASED: 'Weight Based',
  OTHERS: 'Others',
  HOME_CLEANING: 'Home Cleaning',
};

type PageTab = 'garments' | 'pricing';

export const CatalogSettingsPage: React.FC = () => {
  const { token, employee } = useAuth();
  const navigate = useNavigate();

  // Role checks
  const canManage = employee?.role === Role.OWNER || employee?.role === Role.MANAGER;
  const isCounter = employee?.role === Role.COUNTER;

  const [activeTab, setActiveTab] = useState<PageTab>('garments');

  // ─── Data State (Shared) ─────────────────────────────
  const [services, setServices] = useState<any[]>([]);
  const [garments, setGarments] = useState<GarmentCatalogDTO[]>([]);
  const [pricingData, setPricingData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ─── UI State: Garments Tab ─────────────────────────────
  const [activeServiceId, setActiveServiceId] = useState<string>('');
  const [activeCategory, setActiveCategory] = useState<string>(CATEGORIES[0]);
  const [searchQuery, setSearchQuery] = useState('');

  // ─── Modals State ───────────────────────────────────────
  // Create Modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState<GarmentCategory>(GarmentCategory.MEN);
  const [newSection, setNewSection] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Edit Garment Modal
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editGarment, setEditGarment] = useState<GarmentCatalogDTO | null>(null);
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState<GarmentCategory>(GarmentCategory.MEN);
  const [editIsActive, setEditIsActive] = useState(true);
  const [editSection, setEditSection] = useState('');
  const [savingGarment, setSavingGarment] = useState(false);
  const [saveGarmentError, setSaveGarmentError] = useState<string | null>(null);

  // Quick Price Edit Modal
  const [quickPriceModalOpen, setQuickPriceModalOpen] = useState(false);
  const [quickPriceGarment, setQuickPriceGarment] = useState<GarmentCatalogDTO | null>(null);
  const [quickPriceValue, setQuickPriceValue] = useState<string>('');
  const [savingQuickPrice, setSavingQuickPrice] = useState(false);
  const [quickPriceError, setQuickPriceError] = useState<string | null>(null);

  // ─── UI State: Pricing Matrix Tab ──────────────────────
  const [pricingServiceId, setPricingServiceId] = useState<string>('');
  const [pricingCategory, setPricingCategory] = useState<string>(CATEGORIES[0]);
  const [pricingSearch, setPricingSearch] = useState('');
  const [editedPrices, setEditedPrices] = useState<Record<string, string>>({});
  const [savingPrices, setSavingPrices] = useState(false);
  const [priceSaveSuccess, setPriceSaveSuccess] = useState<string | null>(null);
  const [priceSaveError, setPriceSaveError] = useState<string | null>(null);

  // ─── Fetch All Catalog Data ─────────────────────────────
  const fetchAllData = useCallback(async () => {
    if (!token) return;

    if (token.startsWith('dev-mock-jwt-')) {
      setError('Please log in with the real backend to manage the catalog.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [resServices, resGarments, resPrices] = await Promise.all([
        fetch(`${API_URL}/services`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/garments`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/pricing`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (!resServices.ok || !resGarments.ok || !resPrices.ok) {
        throw new Error('Failed to fetch catalog data from server. Please try again.');
      }

      const [bodyServices, bodyGarments, bodyPrices] = await Promise.all([
        resServices.json(),
        resGarments.json(),
        resPrices.json(),
      ]);

      const svcList = bodyServices.data ?? [];
      const gList = bodyGarments.data ?? [];
      const pList = bodyPrices.data ?? [];

      setServices(svcList);
      setGarments(gList);
      setPricingData(pList);

      if (svcList.length > 0) {
        setActiveServiceId((prev) => prev || svcList[0].id);
        setPricingServiceId((prev) => prev || svcList[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load catalog data.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // Active service object
  const currentActiveService = useMemo(() => {
    return services.find((s) => s.id === activeServiceId) || services[0];
  }, [services, activeServiceId]);

  // Filtered garments for Garment Tab
  const filteredGarments = useMemo(() => {
    return garments.filter((g) => {
      const matchesCategory = g.category === activeCategory;
      const matchesSearch =
        !searchQuery || g.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [garments, activeCategory, searchQuery]);

  // Filtered garments for Pricing Tab
  const pricingFilteredGarments = useMemo(() => {
    return garments.filter((g) => {
      const matchesCategory = g.category === pricingCategory;
      const matchesSearch =
        !pricingSearch || g.name.toLowerCase().includes(pricingSearch.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [garments, pricingCategory, pricingSearch]);

  // Helper to lookup configured price
  const getPriceFor = useCallback(
    (garmentId: string, serviceId: string): number | null => {
      const record = pricingData.find(
        (p: any) => p.garmentCatalogId === garmentId && p.serviceTypeId === serviceId,
      );
      return record !== undefined && record !== null ? record.price : null;
    },
    [pricingData],
  );

  // ─── Modal Handlers ─────────────────────────────────────
  const openCreateModal = () => {
    setNewName('');
    setNewCategory(activeCategory as GarmentCategory);
    setNewSection('');
    setCreateError(null);
    setCreateModalOpen(true);
  };

  const closeCreateModal = () => {
    setCreateModalOpen(false);
    setCreateError(null);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) {
      setCreateError('Garment name is required');
      return;
    }

    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch(`${API_URL}/garments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: newName.trim(),
          category: newCategory,
          section: newSection.trim() || undefined,
          isActive: true,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || `Failed to create garment (${res.status})`);
      }

      closeCreateModal();
      await fetchAllData();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Creation failed');
    } finally {
      setCreating(false);
    }
  };

  const openEditModal = (garment: GarmentCatalogDTO) => {
    setEditGarment(garment);
    setEditName(garment.name);
    setEditCategory(garment.category);
    setEditIsActive(garment.isActive);
    setEditSection((garment as any).section || '');
    setSaveGarmentError(null);
    setEditModalOpen(true);
  };

  const closeEditModal = () => {
    setEditModalOpen(false);
    setEditGarment(null);
    setSaveGarmentError(null);
  };

  const handleSaveGarment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editGarment) return;
    if (!editName.trim()) {
      setSaveGarmentError('Garment name is required');
      return;
    }

    setSavingGarment(true);
    setSaveGarmentError(null);
    try {
      const res = await fetch(`${API_URL}/garments/${editGarment.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: editName.trim(),
          category: editCategory,
          isActive: editIsActive,
          section: editSection.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || `Failed to update garment (${res.status})`);
      }

      closeEditModal();
      await fetchAllData();
    } catch (err) {
      setSaveGarmentError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSavingGarment(false);
    }
  };

  const openQuickPriceModal = (garment: GarmentCatalogDTO) => {
    setQuickPriceGarment(garment);
    const existing = getPriceFor(garment.id, activeServiceId);
    setQuickPriceValue(existing !== null ? String(existing) : '');
    setQuickPriceError(null);
    setQuickPriceModalOpen(true);
  };

  const closeQuickPriceModal = () => {
    setQuickPriceModalOpen(false);
    setQuickPriceGarment(null);
    setQuickPriceError(null);
  };

  const handleSaveQuickPrice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickPriceGarment || !activeServiceId) return;

    const num = parseFloat(quickPriceValue);
    if (isNaN(num) || num < 0) {
      setQuickPriceError('Price must be a valid number >= 0');
      return;
    }

    setSavingQuickPrice(true);
    setQuickPriceError(null);
    try {
      const res = await fetch(`${API_URL}/pricing/${quickPriceGarment.id}/${activeServiceId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ price: num }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || `Failed to save price (${res.status})`);
      }

      closeQuickPriceModal();
      await fetchAllData();
    } catch (err) {
      setQuickPriceError(err instanceof Error ? err.message : 'Failed to save price');
    } finally {
      setSavingQuickPrice(false);
    }
  };

  // ─── Pricing Matrix Save Handlers ───────────────────────
  const handlePriceInputChange = (garmentId: string, value: string) => {
    setEditedPrices((prev) => ({
      ...prev,
      [garmentId]: value,
    }));
  };

  const handleSaveSinglePrice = async (garmentId: string) => {
    const rawVal = editedPrices[garmentId];
    if (rawVal === undefined || rawVal === '') return;

    const price = parseFloat(rawVal);
    if (isNaN(price) || price < 0) {
      setPriceSaveError('Price must be a valid non-negative number');
      return;
    }

    setSavingPrices(true);
    setPriceSaveError(null);
    setPriceSaveSuccess(null);
    try {
      const res = await fetch(`${API_URL}/pricing/${garmentId}/${pricingServiceId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ price }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || `Failed to save price (${res.status})`);
      }

      setPriceSaveSuccess('Price updated successfully');
      setEditedPrices((prev) => {
        const next = { ...prev };
        delete next[garmentId];
        return next;
      });
      await fetchAllData();
      setTimeout(() => setPriceSaveSuccess(null), 3000);
    } catch (err) {
      setPriceSaveError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSavingPrices(false);
    }
  };

  const handleSaveAllEditedPrices = async () => {
    const entries = Object.entries(editedPrices);
    if (entries.length === 0) return;

    for (const [, val] of entries) {
      const p = parseFloat(val);
      if (isNaN(p) || p < 0) {
        setPriceSaveError('All entered prices must be non-negative numbers');
        return;
      }
    }

    setSavingPrices(true);
    setPriceSaveError(null);
    setPriceSaveSuccess(null);
    try {
      await Promise.all(
        entries.map(([gId, val]) =>
          fetch(`${API_URL}/pricing/${gId}/${pricingServiceId}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ price: parseFloat(val) }),
          }).then(async (res) => {
            if (!res.ok) {
              const body = await res.json().catch(() => ({}));
              throw new Error(body.message || `Failed on garment ID ${gId}`);
            }
          }),
        ),
      );

      setPriceSaveSuccess(`${entries.length} price(s) saved successfully!`);
      setEditedPrices({});
      await fetchAllData();
      setTimeout(() => setPriceSaveSuccess(null), 3000);
    } catch (err) {
      setPriceSaveError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSavingPrices(false);
    }
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-slate-100 font-sans">
      {/* ─── TOP APP HEADER ───────────────────────────────── */}
      <header className="bg-white border-b border-slate-200 px-4 py-3 shrink-0 shadow-xs z-10">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
              title="Back to home"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                  Garment Catalog & Pricing
                </h1>
                <span className="bg-primary-50 text-primary-700 text-xs font-semibold px-2 py-0.5 rounded-md border border-primary-200">
                  {services.length} Services • {garments.length} Items
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Manage garment definitions, categories, and service-specific pricing for your store
              </p>
            </div>
          </div>

          {/* Header Action Controls */}
          <div className="flex items-center gap-2.5">
            {isCounter && (
              <span className="flex items-center gap-1.5 text-xs bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg border border-slate-200 font-medium">
                <Lock size={13} /> View Only (Counter)
              </span>
            )}

            {canManage && (
              <>
                {/* Mode Selector Tabs */}
                <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setActiveTab('garments')}
                    className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                      activeTab === 'garments'
                        ? 'bg-white text-primary-700 shadow-xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Layers size={14} /> Catalog View
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('pricing')}
                    className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                      activeTab === 'pricing'
                        ? 'bg-white text-primary-700 shadow-xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Tag size={14} /> Service Pricing
                  </button>
                </div>

                <button
                  type="button"
                  onClick={openCreateModal}
                  className="px-3.5 py-2 bg-primary-600 hover:bg-primary-700 active:scale-98 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Plus size={16} /> Add Garment
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ─── MAIN CONTENT VIEWPORT ────────────────────────── */}
      <main className="flex-1 flex flex-col min-h-0 bg-slate-50">
        {loading && <LoadingState message="Loading catalog data..." fullPage={false} />}
        {error && <ErrorState message={error} onRetry={fetchAllData} />}

        {!loading && !error && (
          <>
            {/* ════════════════════════════════════════════════════ */}
            {/* ══ TAB 1: POS GARMENT CATALOG VIEW ════════════════ */}
            {/* ════════════════════════════════════════════════════ */}
            {activeTab === 'garments' && (
              <div className="flex-1 flex flex-col min-h-0 bg-white">
                {/* BAR 1: Service Selector Bar */}
                <div className="bg-slate-50 border-b border-slate-200 p-3 shrink-0">
                  <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400 mr-1 shrink-0">
                      Service:
                    </span>
                    {services.map((service) => (
                      <button
                        key={service.id}
                        type="button"
                        onClick={() => setActiveServiceId(service.id)}
                        className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap min-h-[44px] flex items-center justify-center cursor-pointer ${
                          activeServiceId === service.id
                            ? 'bg-primary-600 text-white shadow-sm border border-primary-600'
                            : 'bg-white text-slate-700 border border-slate-200 hover:border-primary-300 hover:bg-primary-50/50'
                        }`}
                      >
                        {service.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* BAR 2: Category Selector Bar */}
                <div className="border-b border-slate-200 bg-white px-2 shrink-0">
                  <div className="flex items-center overflow-x-auto hide-scrollbar">
                    {CATEGORIES.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setActiveCategory(cat)}
                        className={`px-5 py-3 whitespace-nowrap text-sm font-semibold transition-colors min-h-[44px] flex items-center justify-center cursor-pointer ${
                          activeCategory === cat
                            ? 'text-primary-700 border-b-2 border-primary-600 bg-primary-50/50 font-bold'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                        }`}
                      >
                        {CATEGORY_LABELS[cat] || cat}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Context & Search Bar */}
                <div className="p-3 border-b border-slate-200 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
                  <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                    <span>Showing</span>
                    <span className="font-bold text-slate-800">
                      {filteredGarments.length} {CATEGORY_LABELS[activeCategory]}
                    </span>
                    <span>garments for</span>
                    <span className="bg-primary-50 text-primary-700 font-bold px-2 py-0.5 rounded-md border border-primary-200">
                      {currentActiveService?.name || 'Selected Service'}
                    </span>
                  </div>

                  <div className="relative w-full sm:w-80">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Search size={16} />
                    </div>
                    <input
                      type="text"
                      className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
                      placeholder={`Search in ${CATEGORY_LABELS[activeCategory]}...`}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                </div>

                {/* 4-Column Garment Catalog Grid (Independently Scrollable) */}
                <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-50 min-h-0">
                  {filteredGarments.length === 0 ? (
                    <EmptyState
                      message={
                        searchQuery
                          ? `No garments matching "${searchQuery}" in ${CATEGORY_LABELS[activeCategory]}`
                          : `No garments found in the "${CATEGORY_LABELS[activeCategory]}" category.`
                      }
                    />
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {filteredGarments.map((garment) => {
                        const price = getPriceFor(garment.id, activeServiceId);
                        const hasPrice = price !== null;

                        return (
                          <div
                            key={garment.id}
                            className={`relative flex flex-col items-center justify-between p-4 bg-white rounded-2xl border transition-all group min-h-[160px] ${
                              !garment.isActive
                                ? 'opacity-60 grayscale border-slate-300'
                                : 'border-slate-200 shadow-xs hover:shadow-md hover:border-primary-400'
                            }`}
                          >
                            {/* Price Badge (Top-Right) */}
                            {hasPrice ? (
                              <div className="absolute top-0 right-0 bg-slate-900 text-white text-xs font-bold px-3 py-1 rounded-bl-xl rounded-tr-2xl shadow-xs">
                                ₹{price.toFixed(0)}
                              </div>
                            ) : (
                              <div className="absolute top-0 right-0 bg-amber-50 text-amber-800 border-l border-b border-amber-200 text-[10px] font-semibold px-2 py-0.5 rounded-bl-xl rounded-tr-2xl">
                                Not Configured
                              </div>
                            )}

                            {/* Inactive State Badge (Top-Left) */}
                            {!garment.isActive && (
                              <span className="absolute top-0 left-0 bg-slate-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-br-xl rounded-tl-2xl">
                                Inactive
                              </span>
                            )}

                            {/* Garment Icon */}
                            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-500 group-hover:text-primary-600 group-hover:bg-primary-50 transition-colors mt-2 mb-2">
                              <Shirt size={32} strokeWidth={1.5} />
                            </div>

                            {/* Garment Name */}
                            <span className="text-sm font-semibold text-slate-800 text-center line-clamp-2 leading-tight px-1 w-full mb-2">
                              {garment.name}
                            </span>

                            {/* Admin Controls on Tile for OWNER / MANAGER */}
                            {canManage && (
                              <div className="w-full pt-2 border-t border-slate-100 flex items-center justify-between gap-1.5 opacity-90 group-hover:opacity-100 transition-opacity">
                                <button
                                  type="button"
                                  onClick={() => openEditModal(garment)}
                                  className="flex-1 py-1 px-2 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 flex items-center justify-center gap-1 border border-slate-200 cursor-pointer"
                                  title="Edit garment details"
                                >
                                  <Edit2 size={12} /> Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openQuickPriceModal(garment)}
                                  className="flex-1 py-1 px-2 rounded-lg text-xs font-semibold text-primary-700 bg-primary-50 hover:bg-primary-100 flex items-center justify-center gap-1 border border-primary-200 cursor-pointer"
                                  title="Set price for this service"
                                >
                                  <Tag size={12} /> Price
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ════════════════════════════════════════════════════ */}
            {/* ══ TAB 2: SERVICE PRICING MATRIX (ADMIN) ═════════ */}
            {/* ════════════════════════════════════════════════════ */}
            {activeTab === 'pricing' && canManage && (
              <div className="flex-1 flex flex-col min-h-0 bg-white">
                {/* Selector Bar 1: Service */}
                <div className="bg-slate-50 border-b border-slate-200 p-3 shrink-0">
                  <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400 mr-1 shrink-0">
                      Configure Service:
                    </span>
                    {services.map((service) => (
                      <button
                        key={service.id}
                        type="button"
                        onClick={() => {
                          setPricingServiceId(service.id);
                          setEditedPrices({});
                        }}
                        className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap min-h-[44px] flex items-center justify-center cursor-pointer ${
                          pricingServiceId === service.id
                            ? 'bg-primary-600 text-white shadow-sm border border-primary-600'
                            : 'bg-white text-slate-700 border border-slate-200 hover:border-primary-300 hover:bg-primary-50/50'
                        }`}
                      >
                        {service.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Selector Bar 2: Category */}
                <div className="border-b border-slate-200 bg-white px-2 shrink-0">
                  <div className="flex items-center overflow-x-auto hide-scrollbar">
                    {CATEGORIES.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setPricingCategory(cat)}
                        className={`px-5 py-3 whitespace-nowrap text-sm font-semibold transition-colors min-h-[44px] flex items-center justify-center cursor-pointer ${
                          pricingCategory === cat
                            ? 'text-primary-700 border-b-2 border-primary-600 bg-primary-50/50 font-bold'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                        }`}
                      >
                        {CATEGORY_LABELS[cat] || cat}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Controls Bar & Feedback */}
                <div className="p-3 border-b border-slate-200 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
                  <div className="relative w-full sm:w-80">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Search size={16} />
                    </div>
                    <input
                      type="text"
                      className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
                      placeholder={`Filter ${CATEGORY_LABELS[pricingCategory]} items...`}
                      value={pricingSearch}
                      onChange={(e) => setPricingSearch(e.target.value)}
                    />
                  </div>

                  <div className="flex items-center gap-3">
                    {Object.keys(editedPrices).length > 0 && (
                      <button
                        type="button"
                        onClick={handleSaveAllEditedPrices}
                        disabled={savingPrices}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                      >
                        <Save size={15} /> Save All Changes ({Object.keys(editedPrices).length})
                      </button>
                    )}
                  </div>
                </div>

                {/* Notifications */}
                {priceSaveSuccess && (
                  <div className="mx-4 mt-3 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xl flex items-center gap-2">
                    <Check size={16} /> {priceSaveSuccess}
                  </div>
                )}
                {priceSaveError && (
                  <div className="mx-4 mt-3 p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold rounded-xl flex items-center justify-between">
                    <span>{priceSaveError}</span>
                    <button
                      type="button"
                      onClick={() => setPriceSaveError(null)}
                      className="text-rose-500 hover:text-rose-800"
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}

                {/* Pricing Table (Scrollable) */}
                <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-50 min-h-0">
                  {pricingFilteredGarments.length === 0 ? (
                    <EmptyState
                      message={`No garments found in ${CATEGORY_LABELS[pricingCategory]}`}
                    />
                  ) : (
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase font-bold text-slate-500">
                          <tr>
                            <th className="py-3 px-4">Garment</th>
                            <th className="py-3 px-4">Category</th>
                            <th className="py-3 px-4">Current Price</th>
                            <th className="py-3 px-4 w-48">Configure Price (₹)</th>
                            <th className="py-3 px-4 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {pricingFilteredGarments.map((garment) => {
                            const currentPrice = getPriceFor(garment.id, pricingServiceId);
                            const hasPrice = currentPrice !== null;
                            const isEdited = editedPrices[garment.id] !== undefined;
                            const inputValue = isEdited
                              ? editedPrices[garment.id]
                              : hasPrice
                                ? String(currentPrice)
                                : '';

                            return (
                              <tr
                                key={garment.id}
                                className="hover:bg-slate-50/70 transition-colors"
                              >
                                <td className="py-3 px-4 font-semibold text-slate-900 flex items-center gap-2.5">
                                  <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500">
                                    <Shirt size={16} />
                                  </div>
                                  <span>{garment.name}</span>
                                </td>
                                <td className="py-3 px-4 text-xs text-slate-500">
                                  <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-medium">
                                    {CATEGORY_LABELS[garment.category] || garment.category}
                                  </span>
                                </td>
                                <td className="py-3 px-4 font-semibold">
                                  {hasPrice ? (
                                    <span className="text-slate-900">
                                      ₹{currentPrice.toFixed(0)}
                                    </span>
                                  ) : (
                                    <span className="text-amber-700 text-xs italic bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                                      Not Configured
                                    </span>
                                  )}
                                </td>
                                <td className="py-3 px-4">
                                  <div className="relative w-36">
                                    <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400 font-bold text-xs">
                                      ₹
                                    </span>
                                    <input
                                      type="number"
                                      min="0"
                                      step="1"
                                      placeholder="0"
                                      value={inputValue}
                                      onChange={(e) =>
                                        handlePriceInputChange(garment.id, e.target.value)
                                      }
                                      className={`w-full pl-7 pr-3 py-1.5 text-xs font-bold rounded-lg border focus:outline-none focus:ring-2 ${
                                        isEdited
                                          ? 'border-primary-500 bg-primary-50/40 text-primary-900 ring-2 ring-primary-400'
                                          : 'border-slate-200 bg-slate-50 focus:bg-white focus:ring-primary-500'
                                      }`}
                                    />
                                  </div>
                                </td>
                                <td className="py-3 px-4 text-right">
                                  {isEdited && (
                                    <button
                                      type="button"
                                      onClick={() => handleSaveSinglePrice(garment.id)}
                                      disabled={savingPrices}
                                      className="px-3 py-1 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-xs font-bold cursor-pointer transition-all shadow-2xs"
                                    >
                                      Save
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* ─── CREATE GARMENT MODAL ──────────────────────────── */}
      {createModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Sparkles size={18} className="text-primary-600" /> Add New Garment
              </h2>
              <button
                type="button"
                onClick={closeCreateModal}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            {createError && (
              <div className="mb-4 p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Garment Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Silk Blazer"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-primary-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Category *
                </label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value as GarmentCategory)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-primary-500 focus:outline-none"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {CATEGORY_LABELS[c] || c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Section / Notes (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Formal, Delicate"
                  value={newSection}
                  onChange={(e) => setNewSection(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-primary-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={closeCreateModal}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-5 py-2 text-xs font-bold text-white bg-primary-600 hover:bg-primary-700 rounded-xl shadow-xs cursor-pointer"
                >
                  {creating ? 'Adding...' : 'Create Garment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── EDIT GARMENT MODAL ────────────────────────────── */}
      {editModalOpen && editGarment && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Edit2 size={18} className="text-primary-600" /> Edit Garment
              </h2>
              <button
                type="button"
                onClick={closeEditModal}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            {saveGarmentError && (
              <div className="mb-4 p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl">
                {saveGarmentError}
              </div>
            )}

            <form onSubmit={handleSaveGarment} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Garment Name *
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-primary-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Category *
                </label>
                <select
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value as GarmentCategory)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-primary-500 focus:outline-none"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {CATEGORY_LABELS[c] || c}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <div>
                  <span className="text-sm font-semibold text-slate-900 block">Active Status</span>
                  <span className="text-xs text-slate-500">
                    Inactive garments won't appear in order wizard
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={editIsActive}
                  onChange={(e) => setEditIsActive(e.target.checked)}
                  className="w-5 h-5 accent-primary-600 rounded cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={closeEditModal}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingGarment}
                  className="px-5 py-2 text-xs font-bold text-white bg-primary-600 hover:bg-primary-700 rounded-xl shadow-xs cursor-pointer"
                >
                  {savingGarment ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── QUICK PRICE EDIT MODAL ────────────────────────── */}
      {quickPriceModalOpen && quickPriceGarment && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Tag size={18} className="text-primary-600" /> Set Price
              </h2>
              <button
                type="button"
                onClick={closeQuickPriceModal}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 mb-4 text-xs">
              <div className="font-bold text-slate-900 text-sm mb-0.5">
                {quickPriceGarment.name}
              </div>
              <div className="text-slate-500">
                Service:{' '}
                <span className="font-semibold text-primary-700">
                  {currentActiveService?.name || 'Selected Service'}
                </span>
              </div>
            </div>

            {quickPriceError && (
              <div className="mb-4 p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl">
                {quickPriceError}
              </div>
            )}

            <form onSubmit={handleSaveQuickPrice} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Price (₹) *
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 font-bold text-sm">
                    ₹
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    required
                    placeholder="e.g. 105"
                    value={quickPriceValue}
                    onChange={(e) => setQuickPriceValue(e.target.value)}
                    className="w-full pl-8 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-base font-bold focus:bg-white focus:ring-2 focus:ring-primary-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={closeQuickPriceModal}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingQuickPrice}
                  className="px-5 py-2 text-xs font-bold text-white bg-primary-600 hover:bg-primary-700 rounded-xl shadow-xs cursor-pointer"
                >
                  {savingQuickPrice ? 'Saving...' : 'Save Price'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
