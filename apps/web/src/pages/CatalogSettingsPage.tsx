import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LoadingState, EmptyState, ErrorState } from '@growfast/ui';
import { GarmentCategory, Role, filterServicesForCategory, resolveCatalogSelectionOnCategoryChange, resolveCatalogSelectionOnServiceChange } from '@growfast/shared-types';
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
  Layers,
  Sparkles,
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || '/api';

/** All category values for the filter UI. */
const CATEGORIES = [
  GarmentCategory.MEN,
  GarmentCategory.WOMEN,
  GarmentCategory.KIDS,
  GarmentCategory.HOUSEHOLD,
  GarmentCategory.HOME_CLEANING,
  GarmentCategory.SHOES,
  GarmentCategory.OTHERS,
  GarmentCategory.WEIGHT_BASED,
];

/** Human-readable labels for category values. */
const CATEGORY_LABELS: Record<string, string> = {
  MEN: 'Men',
  WOMEN: 'Women',
  KIDS: 'Kids',
  HOUSEHOLD: 'Household',
  HOME_CLEANING: 'Home Cleaning',
  SHOES: 'Shoe',
  OTHERS: 'Other',
  WEIGHT_BASED: 'Weight Based',
};

type PageTab = 'garments' | 'pricing';

export const CatalogSettingsPage: React.FC = () => {
  const { token, employee } = useAuth();
  const navigate = useNavigate();

  // Role checks — COUNTER (Employee) can add/edit garments but not configure pricing
  const canManage =
    employee?.role === Role.OWNER ||
    employee?.role === Role.MANAGER ||
    employee?.role === Role.COUNTER;
  const canConfigurePricing = employee?.role === Role.OWNER || employee?.role === Role.MANAGER;

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
  const [editPrices, setEditPrices] = useState<Record<string, string>>({});
  const [savingEditPrices, setSavingEditPrices] = useState(false);

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

  // --- Applicability Handlers ---
  const handleActiveCategoryChange = (cat: string) => {
    setActiveCategory(cat);
    const newServiceId = resolveCatalogSelectionOnCategoryChange(cat, activeServiceId, services);
    if (newServiceId !== activeServiceId) {
      setActiveServiceId(newServiceId);
    }
  };

  const handleActiveServiceChange = (serviceId: string) => {
    setActiveServiceId(serviceId);
    const newCategory = resolveCatalogSelectionOnServiceChange(serviceId, activeCategory, services);
    if (newCategory !== activeCategory) {
      setActiveCategory(newCategory as string);
    }
  };

  const handlePricingCategoryChange = (cat: string) => {
    setPricingCategory(cat);
    const newServiceId = resolveCatalogSelectionOnCategoryChange(cat, pricingServiceId, services);
    if (newServiceId !== pricingServiceId) {
      setPricingServiceId(newServiceId);
      setEditedPrices({});
    }
  };

  const handlePricingServiceChange = (serviceId: string) => {
    setPricingServiceId(serviceId);
    setEditedPrices({});
    const newCategory = resolveCatalogSelectionOnServiceChange(serviceId, pricingCategory, services);
    if (newCategory !== pricingCategory) {
      setPricingCategory(newCategory as string);
    }
  };

  // Visible services for each tab (Shoe hides 3 services)
  const visibleGarmentServices = useMemo(() => {
    return filterServicesForCategory(services, activeCategory);
  }, [services, activeCategory]);

  const visiblePricingServices = useMemo(() => {
    return filterServicesForCategory(services, pricingCategory);
  }, [services, pricingCategory]);

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
    // Populate per-service prices
    const priceMap: Record<string, string> = {};
    for (const svc of services) {
      const existing = pricingData.find(
        (p: any) => p.garmentCatalogId === garment.id && p.serviceTypeId === svc.id,
      );
      priceMap[svc.id] = existing ? String(existing.price) : '';
    }
    setEditPrices(priceMap);
    setSavingEditPrices(false);
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

  const handleSaveEditPrice = async (serviceId: string) => {
    if (!editGarment) return;
    const rawVal = editPrices[serviceId];
    if (rawVal === undefined || rawVal === '') return;
    const price = parseFloat(rawVal);
    if (isNaN(price) || price < 0) {
      setSaveGarmentError('Price must be a valid non-negative number');
      return;
    }
    setSavingEditPrices(true);
    setSaveGarmentError(null);
    try {
      const res = await fetch(`${API_URL}/pricing/${editGarment.id}/${serviceId}`, {
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
      await fetchAllData();
      // Update local editPrices to reflect saved value
      setEditPrices((prev) => ({ ...prev, [serviceId]: String(price) }));
    } catch (err) {
      setSaveGarmentError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSavingEditPrices(false);
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

  const handleAutoFillAllMissingPrices = async () => {
    setSavingPrices(true);
    setPriceSaveError(null);
    setPriceSaveSuccess(null);
    try {
      let count = 0;
      for (const service of services) {
        for (const garment of garments) {
          const hasPrice = pricingData.some(
            (p) => p.garmentCatalogId === garment.id && p.serviceTypeId === service.id,
          );
          if (!hasPrice) {
            const randomPrice = Math.floor(Math.random() * 10 + 1) * 100; // 100 to 1000
            const res = await fetch(`${API_URL}/pricing/${garment.id}/${service.id}`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ price: randomPrice }),
            });
            if (!res.ok) {
              const body = await res.json().catch(() => ({}));
              throw new Error(
                body.message || `Failed on garment ${garment.id} and service ${service.id}`,
              );
            }
            count++;
          }
        }
      }
      setPriceSaveSuccess(`Auto-filled ${count} missing prices across all combinations!`);
      await fetchAllData();
      setTimeout(() => setPriceSaveSuccess(null), 3000);
    } catch (err) {
      setPriceSaveError(err instanceof Error ? err.message : 'Auto-fill failed');
    } finally {
      setSavingPrices(false);
    }
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-slate-100 font-sans">
      {/* ─── TOP APP HEADER ───────────────────────────────── */}
      <header className="bg-white border-b border-slate-200 px-5 py-3 shrink-0 shadow-xs z-10 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="p-2 rounded-sm text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Back to home"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-lg font-bold text-slate-900">Garment Catalog</h1>
        </div>

        {/* Header Action Controls */}
        <div className="flex items-center gap-4">
          {canConfigurePricing && (
            <div className="flex items-center bg-slate-100 p-1 rounded-sm border border-slate-200 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setActiveTab('garments')}
                className={`px-3 py-1.5 rounded-sm transition-all cursor-pointer flex items-center gap-1.5 ${
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
                className={`px-3 py-1.5 rounded-sm transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'pricing'
                    ? 'bg-white text-primary-700 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Tag size={14} /> Service Pricing
              </button>
            </div>
          )}

          {canManage && (
            <button
              type="button"
              onClick={openCreateModal}
              className="px-3.5 py-2 bg-primary-600 hover:bg-primary-700 active:scale-98 text-white rounded-sm text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Plus size={16} /> Add Garment
            </button>
          )}
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
                <div className="w-full bg-slate-50 border-b border-slate-200 px-5 py-4 shrink-0 mb-6 shadow-xs">
                  <div className="flex flex-col xl:flex-row xl:items-center gap-4">
                    <span className="text-sm font-bold text-slate-800 w-20 shrink-0 uppercase tracking-wider">
                      Service
                    </span>
                    <div className="flex-1 flex flex-wrap gap-4 w-full">
                      {visibleGarmentServices.map((service) => {
                        return (
                          <button
                            key={service.id}
                            type="button"
                            onClick={() => handleActiveServiceChange(service.id)}
                            className={`flex-1 min-w-[120px] px-[22px] py-3 rounded-sm text-sm font-bold transition-all whitespace-normal text-center leading-tight break-words min-h-[48px] flex items-center justify-center cursor-pointer border shadow-sm ${
                              activeServiceId === service.id
                                ? 'bg-primary-600 text-white border-primary-600'
                                : 'bg-white text-slate-700 border-slate-300 hover:border-slate-400 hover:bg-slate-50'
                            }`}
                          >
                            {service.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* BAR 2: Category Selector Bar */}
                <div className="w-full border-y border-slate-200 bg-white px-5 py-4 shrink-0 mt-4 mb-4 shadow-xs">
                  <div className="flex flex-col xl:flex-row xl:items-center gap-4">
                    <span className="text-sm font-bold text-slate-800 w-20 shrink-0 uppercase tracking-wider">
                      Category
                    </span>
                    <div className="flex-1 flex flex-wrap gap-4 w-full">
                      {CATEGORIES.map((cat) => {
                        return (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => handleActiveCategoryChange(cat)}
                            className={`flex-1 min-w-[120px] px-[22px] py-3 whitespace-normal text-center leading-tight break-words text-sm font-bold transition-all min-h-[48px] flex items-center justify-center cursor-pointer rounded-sm border shadow-sm ${
                              activeCategory === cat
                                ? 'bg-primary-600 text-white border-primary-600'
                                : 'bg-white text-slate-700 border-slate-300 hover:border-slate-400 hover:bg-slate-50'
                            }`}
                          >
                            {CATEGORY_LABELS[cat] || cat}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Search Bar */}
                <div className="px-5 py-3 border-b border-slate-200 bg-white shrink-0">
                  <div className="relative w-full">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Search size={18} />
                    </div>
                    <input
                      type="text"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-sm text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
                      placeholder={`🔍 Search in ${CATEGORY_LABELS[activeCategory]}...`}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                </div>

                {/* Garment Catalog Grid — 7-8 cols on wide desktop */}
                <div className="flex-1 overflow-y-auto px-4 py-4 md:px-5 md:py-5 bg-slate-50 min-h-0">
                  {filteredGarments.length === 0 ? (
                    <EmptyState
                      message={
                        searchQuery
                          ? `No garments matching "${searchQuery}" in ${CATEGORY_LABELS[activeCategory]}`
                          : `No garments found in the "${CATEGORY_LABELS[activeCategory]}" category.`
                      }
                    />
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 gap-3">
                      {filteredGarments.map((garment) => {
                        const price = getPriceFor(garment.id, activeServiceId);
                        const hasPrice = price !== null;

                        return (
                          <div
                            key={garment.id}
                            className={`relative flex flex-col items-center justify-between p-3 bg-white rounded-[2px] border transition-all group min-h-[120px] ${
                              !garment.isActive
                                ? 'opacity-60 grayscale border-slate-300'
                                : 'border-slate-200 shadow-xs hover:shadow-md hover:border-primary-400'
                            }`}
                          >
                            {/* Price Badge (Top-Right) */}
                            {hasPrice ? (
                              <div className="absolute top-1.5 right-1.5 bg-slate-900 text-white text-[10px] font-bold px-2 py-0.5 rounded-[2px] shadow-xs">
                                ₹{price.toFixed(0)}
                              </div>
                            ) : (
                              <div className="absolute top-1.5 right-1.5 bg-amber-50 text-amber-800 border border-amber-200 text-[9px] font-semibold px-1.5 py-0.5 rounded-[2px]">
                                No Price
                              </div>
                            )}

                            {/* Inactive State Badge (Top-Left) */}
                            {!garment.isActive && (
                              <span className="absolute top-1.5 left-1.5 bg-slate-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-[2px]">
                                Off
                              </span>
                            )}

                            {/* Garment Icon */}
                            <div className="w-10 h-10 rounded-[2px] bg-slate-100 flex items-center justify-center text-slate-500 group-hover:text-primary-600 group-hover:bg-primary-50 transition-colors mt-4 mb-2">
                              <Shirt size={22} strokeWidth={1.5} />
                            </div>

                            {/* Garment Name */}
                            <span className="text-xs font-semibold text-slate-800 text-center line-clamp-2 leading-tight px-0.5 w-full mb-1">
                              {garment.name}
                            </span>

                            {/* Single Edit Button */}
                            {canManage && (
                              <button
                                type="button"
                                onClick={() => openEditModal(garment)}
                                className="w-full mt-auto pt-1.5 border-t border-slate-100 py-1.5 rounded-[2px] text-[10px] font-semibold text-slate-500 hover:text-primary-700 hover:bg-primary-50 flex items-center justify-center gap-1 cursor-pointer transition-all min-h-[28px]"
                                title="Edit garment & pricing"
                              >
                                <Edit2 size={10} /> Edit
                              </button>
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
            {activeTab === 'pricing' && canConfigurePricing && (
              <div className="flex-1 flex flex-col min-h-0 bg-white">
                {/* Selector Bar 1: Service */}
                <div className="w-full bg-slate-50 border-b border-slate-200 px-5 py-4 shrink-0 mb-6 shadow-xs">
                  <div className="flex flex-col xl:flex-row xl:items-center gap-4">
                    <span className="text-sm font-bold text-slate-800 w-20 shrink-0 uppercase tracking-wider">
                      Service
                    </span>
                    <div className="flex-1 flex flex-wrap gap-4 w-full">
                      {visiblePricingServices.map((service) => {
                        return (
                          <button
                            key={service.id}
                            type="button"
                            onClick={() => handlePricingServiceChange(service.id)}
                            className={`flex-1 min-w-[120px] px-[22px] py-3 rounded-sm text-sm font-bold transition-all whitespace-normal text-center leading-tight break-words min-h-[48px] flex items-center justify-center cursor-pointer border shadow-sm ${
                              pricingServiceId === service.id
                                ? 'bg-primary-600 text-white border-primary-600'
                                : 'bg-white text-slate-700 border-slate-300 hover:border-slate-400 hover:bg-slate-50'
                            }`}
                          >
                            {service.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Selector Bar 2: Category */}
                <div className="w-full border-y border-slate-200 bg-white px-5 py-4 shrink-0 mt-4 mb-4 shadow-xs">
                  <div className="flex flex-col xl:flex-row xl:items-center gap-4">
                    <span className="text-sm font-bold text-slate-800 w-20 shrink-0 uppercase tracking-wider">
                      Category
                    </span>
                    <div className="flex-1 flex flex-wrap gap-4 w-full">
                      {CATEGORIES.map((cat) => {
                        return (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => handlePricingCategoryChange(cat)}
                            className={`flex-1 min-w-[120px] px-[22px] py-3 whitespace-normal text-center leading-tight break-words text-sm font-bold transition-all min-h-[48px] flex items-center justify-center cursor-pointer rounded-sm border shadow-sm ${
                              pricingCategory === cat
                                ? 'bg-primary-600 text-white border-primary-600'
                                : 'bg-white text-slate-700 border-slate-300 hover:border-slate-400 hover:bg-slate-50'
                            }`}
                          >
                            {CATEGORY_LABELS[cat] || cat}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Controls Bar & Feedback */}
                <div className="px-5 py-3 border-b border-slate-200 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
                  <div className="relative w-full sm:w-96">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Search size={18} />
                    </div>
                    <input
                      type="text"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-sm text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
                      placeholder={`🔍 Filter ${CATEGORY_LABELS[pricingCategory]} items...`}
                      value={pricingSearch}
                      onChange={(e) => setPricingSearch(e.target.value)}
                    />
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={handleAutoFillAllMissingPrices}
                      disabled={savingPrices}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-sm text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                    >
                      <Sparkles size={15} /> Auto-fill All Missing
                    </button>
                    {Object.keys(editedPrices).length > 0 && (
                      <button
                        type="button"
                        onClick={handleSaveAllEditedPrices}
                        disabled={savingPrices}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-sm text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                      >
                        <Save size={15} /> Save All Changes ({Object.keys(editedPrices).length})
                      </button>
                    )}
                  </div>
                </div>

                {/* Notifications */}
                {priceSaveSuccess && (
                  <div className="mx-4 mt-3 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-sm flex items-center gap-2">
                    <Check size={16} /> {priceSaveSuccess}
                  </div>
                )}
                {priceSaveError && (
                  <div className="mx-4 mt-3 p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold rounded-sm flex items-center justify-between">
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
                    <div className="bg-white rounded-sm border border-slate-200 shadow-xs overflow-hidden">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase font-bold text-slate-500">
                          <tr>
                            <th className="py-3.5 px-5">Garment</th>
                            <th className="py-3.5 px-5">Category</th>
                            <th className="py-3.5 px-5">Current Price</th>
                            <th className="py-3.5 px-5 w-56">Configure Price (₹)</th>
                            <th className="py-3.5 px-5 text-right">Action</th>
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
                                <td className="py-3.5 px-5 font-semibold text-slate-900 flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-sm bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                                    <Shirt size={16} />
                                  </div>
                                  <span>{garment.name}</span>
                                </td>
                                <td className="py-3.5 px-5 text-xs text-slate-500">
                                  <span className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-sm font-medium">
                                    {CATEGORY_LABELS[garment.category] || garment.category}
                                  </span>
                                </td>
                                <td className="py-3.5 px-5 font-semibold">
                                  {hasPrice ? (
                                    <span className="text-slate-900">
                                      ₹{currentPrice.toFixed(0)}
                                    </span>
                                  ) : (
                                    <span className="text-amber-700 text-xs italic bg-amber-50 px-2.5 py-1 rounded-sm border border-amber-200">
                                      Not Configured
                                    </span>
                                  )}
                                </td>
                                <td className="py-3.5 px-5">
                                  <div className="relative w-44">
                                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500 font-bold text-sm">
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
                                      className={`w-full pl-8 pr-4 py-2 text-sm font-bold rounded-sm border min-h-[40px] focus:outline-none focus:ring-2 ${
                                        isEdited
                                          ? 'border-primary-500 bg-primary-50/40 text-primary-900 ring-2 ring-primary-400'
                                          : 'border-slate-200 bg-slate-50 focus:bg-white focus:ring-primary-500'
                                      }`}
                                    />
                                  </div>
                                </td>
                                <td className="py-3.5 px-5 text-right min-w-[100px]">
                                  {isEdited && (
                                    <button
                                      type="button"
                                      onClick={() => handleSaveSinglePrice(garment.id)}
                                      disabled={savingPrices}
                                      className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-sm text-xs font-bold cursor-pointer transition-all shadow-xs min-h-[36px]"
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
          <div className="bg-white rounded-sm max-w-md w-full p-6 shadow-xl border border-slate-200">
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
              <div className="mb-4 p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-sm">
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
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-sm text-sm focus:bg-white focus:ring-2 focus:ring-primary-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Category *
                </label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value as GarmentCategory)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-sm text-sm focus:bg-white focus:ring-2 focus:ring-primary-500 focus:outline-none"
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
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-sm text-sm focus:bg-white focus:ring-2 focus:ring-primary-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={closeCreateModal}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-sm cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-5 py-2 text-xs font-bold text-white bg-primary-600 hover:bg-primary-700 rounded-sm shadow-xs cursor-pointer"
                >
                  {creating ? 'Adding...' : 'Create Garment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editModalOpen && editGarment && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-[2px] max-w-lg w-full shadow-xl border border-slate-200 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-5 pb-3 shrink-0">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Edit2 size={18} className="text-primary-600" /> Edit Garment
              </h2>
              <button
                type="button"
                onClick={closeEditModal}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 pb-5">
              {saveGarmentError && (
                <div className="mb-4 p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-[2px]">
                  {saveGarmentError}
                </div>
              )}

              {/* ── Garment Details Section ── */}
              <form onSubmit={handleSaveGarment} className="space-y-3 mb-5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Garment Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-[2px] text-sm focus:bg-white focus:ring-2 focus:ring-primary-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Category *
                  </label>
                  <select
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value as GarmentCategory)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-[2px] text-sm focus:bg-white focus:ring-2 focus:ring-primary-500 focus:outline-none"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {CATEGORY_LABELS[c] || c}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-[2px]">
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

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="submit"
                    disabled={savingGarment}
                    className="px-4 py-2 text-xs font-bold text-white bg-primary-600 hover:bg-primary-700 rounded-[2px] shadow-xs cursor-pointer min-h-[36px]"
                  >
                    {savingGarment ? 'Saving...' : 'Save Details'}
                  </button>
                </div>
              </form>

              {/* ── Service-wise Pricing Section ── */}
              {canConfigurePricing && (
                <div>
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Tag size={12} /> Service Pricing
                  </h3>
                  <div className="border border-slate-200 rounded-[2px] overflow-hidden">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                          <th className="text-left px-3 py-2 font-bold text-slate-700">Service</th>
                          <th className="text-right px-3 py-2 font-bold text-slate-700 w-28">Price (₹)</th>
                          <th className="w-16"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {services.map((svc: any) => {
                          const val = editPrices[svc.id] || '';
                          const originalPrice = pricingData.find(
                            (p: any) => p.garmentCatalogId === editGarment.id && p.serviceTypeId === svc.id,
                          );
                          const hasChanged = val !== '' && val !== (originalPrice ? String(originalPrice.price) : '');
                          return (
                            <tr key={svc.id} className="border-b border-slate-100 last:border-b-0">
                              <td className="px-3 py-2 text-slate-800 font-medium">{svc.name}</td>
                              <td className="px-3 py-1.5">
                                <input
                                  type="number"
                                  min="0"
                                  step="1"
                                  placeholder="—"
                                  value={val}
                                  onChange={(e) =>
                                    setEditPrices((prev) => ({ ...prev, [svc.id]: e.target.value }))
                                  }
                                  className="w-full px-2 py-1.5 text-right bg-slate-50 border border-slate-200 rounded-[2px] text-xs font-bold focus:bg-white focus:ring-1 focus:ring-primary-500 focus:outline-none min-h-[32px]"
                                />
                              </td>
                              <td className="px-2 py-1.5 text-center">
                                {hasChanged && (
                                  <button
                                    type="button"
                                    onClick={() => handleSaveEditPrice(svc.id)}
                                    disabled={savingEditPrices}
                                    className="px-2 py-1 bg-primary-600 hover:bg-primary-700 text-white rounded-[2px] text-[10px] font-bold cursor-pointer min-h-[28px]"
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
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-100 shrink-0">
              <button
                type="button"
                onClick={closeEditModal}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-[2px] cursor-pointer min-h-[36px]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── QUICK PRICE EDIT MODAL ────────────────────────── */}
      {quickPriceModalOpen && quickPriceGarment && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-sm max-w-sm w-full p-6 shadow-xl border border-slate-200">
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

            <div className="bg-slate-50 p-3 rounded-sm border border-slate-200 mb-4 text-xs">
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
              <div className="mb-4 p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-sm">
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
                    className="w-full pl-8 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-sm text-base font-bold focus:bg-white focus:ring-2 focus:ring-primary-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={closeQuickPriceModal}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-sm cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingQuickPrice}
                  className="px-5 py-2 text-xs font-bold text-white bg-primary-600 hover:bg-primary-700 rounded-sm shadow-xs cursor-pointer"
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
