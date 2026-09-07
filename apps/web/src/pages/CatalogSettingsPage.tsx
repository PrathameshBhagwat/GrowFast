import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LoadingState, EmptyState, ErrorState } from '@growfast/ui';
import {
  GarmentCategory,
  Role,
  filterServicesForCategory,
  resolveCatalogSelectionOnCategoryChange,
  resolveCatalogSelectionOnServiceChange,
} from '@growfast/shared-types';
import type { GarmentCatalogDTO } from '@growfast/shared-types';
import { CatalogHeader } from '../components/CatalogHeader';
import {
  CatalogNavFilter,
  CATALOG_SORT_OPTIONS,
  sortCatalogGarments,
} from '../components/CatalogNavFilter';
import {
  ArrowLeft,
  ChevronDown,
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
  FlaskConical,
  Gift,
  Recycle,
  Package,
  Box,
  Shield,
  Zap,
  Droplets,
  User,
  Lock,
  RefreshCw,
  LayoutGrid,
  Upload,
  Footprints,
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

/** Deterministic SKU code generator matching Stitch design: SKU - [3-char code] - [index] */
const getGarmentSKU = (garmentName: string, index: number): string => {
  const clean = garmentName.replace(/[^a-zA-Z]/g, '').toUpperCase();
  let code = clean.slice(0, 3);
  if (code.length < 3) code = (code + 'XXX').slice(0, 3);
  const num = String(index + 1).padStart(2, '0');
  return `SKU - ${code} - ${num}`;
};

/** Garment subtitle descriptions matching Stitch design */
const GARMENT_SUBTITLES: Record<string, string> = {
  Achkan: 'Traditional Heavy',
  Capri: 'Casual Wear',
  Coat: 'Formal Blazer',
  Dhoti: 'Silk / Cotton',
  'Jacket Full Sleeves': 'Outerwear',
  'Jacket Half Sleeves': 'Sleeveless / Vest',
  'Jacket With Hood': 'Winter Parka',
  Jeans: 'Denim Trousers',
  Kurta: 'Standard Ethnic',
  'Kurta (Men)': 'Standard Ethnic',
  'Kurta Heavy': 'Embroidered / Zari',
  'Leather Jacket': 'Special Care DC',
  'Long Coat': 'Overcoat / Trench',
  'Long Pullover': 'Wool Knit',
  Pants: 'Formal Trousers',
  Pyjama: 'Cotton Lounge',
  'Safari Suit Coat': 'Top Piece',
  'Safari Suit Pant': 'Matching Bottom',
  Sherwani: 'Wedding Heavy',
  Shirt: 'Regular Formal',
  'Shirt Woolen': 'Warm Blend',
  Shorts: 'Bermuda / Sports',
  'Suede Leather Jacket': 'Delicate Finish',
  'Suit (2 Piece)': 'Coat + Trouser',
  'Sweat Pants': 'Fleece Trackpants',
  'Sweat Shirt': 'Casual Fleece',
  'Sweat Shirt With Hood': 'Hooded Fleece',
  'Sweater Full Sleeves Heavy': 'Cable Knit Wool',
  'Sweater Full Heavy': 'Cable Knit Wool',
  'Sweater Full Sleeves Plain': 'Fine Merino / Cashmere',
  'Sweater Full Plain': 'Fine Merino / Cashmere',
  'Swimming Costume': 'Active / Swim',
  'T Shirt': 'Casual Cotton',
  'Track Pant': 'Athletic / Gym',
  'Under Wear': 'Inner Wear',
  Vest: 'Inner / Casual',
  'Waist Coat': 'Formal Layer',
  'Shirt Silk': 'Pure Silk',
  'Sweater Half': 'Knitted Vest',
  'Sweater Half Sleeves Heavy': 'Heavy Knit Vest',
  Saree: 'Traditional Silk / Georgette',
  'Women Dress': 'Evening Wear',
  Blouse: 'Designer / Silk',
  Salwar: 'Cotton / Silk',
  Kameez: 'Ethnic Top',
  Kurti: 'Daily Casual',
  Skirt: 'Flared / Pleated',
  Leggings: 'Stretch Cotton',
  Dupatta: 'Chiffon / Zari',
  Shawl: 'Pashmina / Wool',
  Lehenga: 'Bridal / Heavy',
  Churidar: 'Traditional Bottom',
};

/** Render Stitch-tailored garment vector icon */
const renderStitchGarmentIcon = (name: string) => {
  const lower = name.toLowerCase();

  // Shorts
  if (lower.includes('short')) {
    return (
      <svg
        viewBox="0 0 24 24"
        width="22"
        height="22"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M6 4h12v7l-2 5h-3.5l-0.5-3-0.5 3H8l-2-5V4z" />
        <path d="M6 7h12" />
      </svg>
    );
  }

  // Pants, Jeans, Capri, Pyjama, Trousers, Track Pant, Sweat Pants
  if (
    lower.includes('pant') ||
    lower.includes('jean') ||
    lower.includes('capri') ||
    lower.includes('pyjama') ||
    lower.includes('trous')
  ) {
    return (
      <svg
        viewBox="0 0 24 24"
        width="22"
        height="22"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M7 4h10v6l-2 10h-2.5l-0.5-6-0.5 6H9L7 10V4z" />
      </svg>
    );
  }

  // Dhoti
  if (lower.includes('dhoti')) {
    return (
      <svg
        viewBox="0 0 24 24"
        width="22"
        height="22"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M7 4h10l-1.5 16H8.5L7 4z" />
        <path d="M12 4v16" />
      </svg>
    );
  }

  // Leather Jacket / Suede Leather Jacket -> Shield icon (matching Stitch reference exactly)
  if (lower.includes('leather')) {
    return <Shield size={20} strokeWidth={1.5} />;
  }

  // Achkan, Sherwani (Traditional Indian Heavy Outerwear)
  if (lower.includes('achkan') || lower.includes('sherwani')) {
    return (
      <svg
        viewBox="0 0 24 24"
        width="22"
        height="22"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="5" r="2" />
        <path d="M8 9h8l1 11H7L8 9z" />
        <path d="M12 9v11" />
      </svg>
    );
  }

  // Kurta (Men), Kurta Heavy
  if (lower.includes('kurta')) {
    return (
      <svg
        viewBox="0 0 24 24"
        width="22"
        height="22"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M9 3h6l3 4-2.5 1.5v12.5H8.5V8.5L6 7l3-4z" />
        <path d="M12 3v7" />
      </svg>
    );
  }

  // Coat, Suit (2 Piece), Safari Suit Coat
  if (lower.includes('suit') || (lower.includes('coat') && !lower.includes('long coat'))) {
    return (
      <svg
        viewBox="0 0 24 24"
        width="22"
        height="22"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M6 4h12l1.5 6-2 10H6.5L4.5 10 6 4z" />
        <path d="M6 4l6 7 6-7" />
        <path d="M12 11v9" />
      </svg>
    );
  }

  // Long Coat / Trench
  if (lower.includes('long coat')) {
    return (
      <svg
        viewBox="0 0 24 24"
        width="22"
        height="22"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M7 2h10l2 5-2 15H7L5 7l2-5z" />
        <path d="M7 2l5 6 5-6" />
        <path d="M12 8v14" />
      </svg>
    );
  }

  // Jacket With Hood, Sweat Shirt With Hood
  if (lower.includes('hood')) {
    return (
      <svg
        viewBox="0 0 24 24"
        width="22"
        height="22"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M10 2a3 3 0 00-3 3v2l-3 3 2 2v9h12v-9l2-2-3-3V5a3 3 0 00-3-3h-4z" />
        <path d="M10 2a2 2 0 014 0v4h-4V2z" />
      </svg>
    );
  }

  // Jacket Half Sleeves / Vest
  if (lower.includes('half sleeve') || lower.includes('vest')) {
    return (
      <svg
        viewBox="0 0 24 24"
        width="22"
        height="22"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M8 4h8l2 5-3 1v10H9V10L6 9l2-5z" />
        <path d="M9 4a3 3 0 006 0" />
      </svg>
    );
  }

  // Jacket Full Sleeves, Sweat Shirt
  if (lower.includes('full sleeve') || lower.includes('sweat shirt')) {
    return (
      <svg
        viewBox="0 0 24 24"
        width="22"
        height="22"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M8 4h8l3 4-2 3-1-1v10H8V10L7 11 5 8l3-4z" />
        <path d="M9 4a3 3 0 006 0" />
      </svg>
    );
  }

  // Pullover / Sweater
  if (lower.includes('pullover') || lower.includes('sweater')) {
    return (
      <svg
        viewBox="0 0 24 24"
        width="22"
        height="22"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M6 4h12l3 5-3 2v10H6V11L3 9l3-5z" />
        <path d="M8 4a4 4 0 008 0" />
        <path d="M6 18h12" />
      </svg>
    );
  }

  // Shoes
  if (lower.includes('shoe')) {
    return <Footprints size={20} strokeWidth={1.5} />;
  }

  // Default: Shirt icon
  return <Shirt size={20} strokeWidth={1.5} />;
};

/** Render contextual icon matching Stitch design */
const renderGarmentIcon = (garmentName: string) => {
  const lower = garmentName.toLowerCase();
  if (lower.includes('leather')) {
    return (
      <div className="w-10 h-10 rounded-lg bg-amber-50 border border-amber-200/70 flex items-center justify-center text-amber-600 shrink-0">
        <Lock size={18} />
      </div>
    );
  }
  if (
    lower.includes('achkan') ||
    lower.includes('kurta') ||
    lower.includes('sherwani') ||
    lower.includes('suit')
  ) {
    return (
      <div className="w-10 h-10 rounded-lg bg-slate-50 border border-slate-200/70 flex items-center justify-center text-slate-500 shrink-0">
        <User size={18} />
      </div>
    );
  }
  if (lower.includes('jacket') || lower.includes('coat') || lower.includes('blazer')) {
    return (
      <div className="w-10 h-10 rounded-lg bg-slate-50 border border-slate-200/70 flex items-center justify-center text-slate-500 shrink-0">
        <Layers size={18} />
      </div>
    );
  }
  if (
    lower.includes('jean') ||
    lower.includes('pant') ||
    lower.includes('trous') ||
    lower.includes('capri') ||
    lower.includes('dhoti')
  ) {
    return (
      <div className="w-10 h-10 rounded-lg bg-slate-50 border border-slate-200/70 flex items-center justify-center text-slate-500 shrink-0">
        <Package size={18} />
      </div>
    );
  }
  if (lower.includes('pullover') || lower.includes('sweater') || lower.includes('cardigan')) {
    return (
      <div className="w-10 h-10 rounded-lg bg-slate-50 border border-slate-200/70 flex items-center justify-center text-slate-500 shrink-0">
        <Box size={18} />
      </div>
    );
  }
  return (
    <div className="w-10 h-10 rounded-lg bg-slate-50 border border-slate-200/70 flex items-center justify-center text-slate-500 shrink-0">
      <Shirt size={18} />
    </div>
  );
};

/** Canonical order of services matching Stitch design */
const SERVICE_CANONICAL_ORDER = [
  'standard wash',
  'dry clean',
  'steam iron',
  'wash + steam iron',
  'shoe cleaning',
  'reprocess cleaning',
  'free shoe',
  'starching dc',
];

/** Color dot indicator for services in the Add Garment modal matching Stitch design */
const getServiceDotColor = (name: string): string => {
  const lower = name.toLowerCase();
  if (lower.includes('standard') || lower.includes('free shoe')) return 'bg-emerald-500';
  if (lower.includes('dry clean')) return 'bg-indigo-500';
  if (lower.includes('steam iron') && !lower.includes('wash')) return 'bg-sky-500';
  if (lower.includes('wash') && lower.includes('steam')) return 'bg-blue-500';
  if (lower.includes('shoe')) return 'bg-amber-500';
  if (lower.includes('reprocess')) return 'bg-purple-500';
  if (lower.includes('starch')) return 'bg-rose-500';
  return 'bg-slate-400';
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
  const [sortOrder, setSortOrder] = useState<string>('name-asc');
  const [activeOnly, setActiveOnly] = useState<boolean>(false);
  const catalogSearchRef = useRef<HTMLInputElement>(null);

  // ─── Modals State ───────────────────────────────────────
  // Create Modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState<GarmentCategory>(GarmentCategory.MEN);
  const [newSection, setNewSection] = useState('');
  const [newPrices, setNewPrices] = useState<Record<string, string>>({});
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
  const searchRef = useRef<HTMLInputElement>(null);
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

  // Category counts for all tabs
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    CATEGORIES.forEach((cat) => {
      counts[cat] = garments.filter((g) => g.category === cat).length;
    });
    return counts;
  }, [garments]);

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

  // Filtered & Sorted garments for Garment Tab
  const filteredGarments = useMemo(() => {
    const list = garments.filter((g) => {
      const matchesCategory = g.category === activeCategory;
      const matchesSearch =
        !searchQuery ||
        g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (CATEGORY_LABELS[g.category] || g.category)
          .toLowerCase()
          .includes(searchQuery.toLowerCase());
      const matchesActive = !activeOnly || g.isActive;
      return matchesCategory && matchesSearch && matchesActive;
    });

    return sortCatalogGarments(list, sortOrder, (garmentId) => {
      return getPriceFor(garmentId, activeServiceId) ?? 0;
    });
  }, [
    garments,
    activeCategory,
    searchQuery,
    activeOnly,
    sortOrder,
    activeServiceId,
    pricingData,
    getPriceFor,
  ]);

  // Keyboard shortcuts: F2 focuses search, Esc resets filter
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (activeTab !== 'garments') return;
      if (e.key === 'F2') {
        e.preventDefault();
        catalogSearchRef.current?.focus();
      } else if (e.key === 'Escape') {
        if (searchQuery || activeOnly) {
          e.preventDefault();
          setSearchQuery('');
          setActiveOnly(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab, searchQuery, activeOnly]);

  // Export CSV handler
  const handleExportCSV = () => {
    const headers = ['SKU', 'Garment Name', 'Category', 'Service', 'Price (INR)', 'Status'];
    const rows = filteredGarments.map((g, idx) => {
      const sku = `${(CATEGORY_LABELS[g.category] || g.category).substring(0, 3).toUpperCase()}-${String(idx + 1).padStart(2, '0')}`;
      const price = getPriceFor(g.id, activeServiceId);
      return [
        sku,
        `"${g.name.replace(/"/g, '""')}"`,
        CATEGORY_LABELS[g.category] || g.category,
        currentActiveService?.name || 'Standard',
        price !== null ? price : 'N/A',
        g.isActive ? 'Active' : 'Inactive',
      ].join(',');
    });
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `garment-catalog-${(CATEGORY_LABELS[activeCategory] || activeCategory).toLowerCase()}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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
    const newCategory = resolveCatalogSelectionOnServiceChange(
      serviceId,
      pricingCategory,
      services,
    );
    if (newCategory !== pricingCategory) {
      setPricingCategory(newCategory as string);
    }
  };

  // Visible services for each tab (Shoe hides 3 services)
  const visibleGarmentServices = useMemo(() => {
    return filterServicesForCategory(services, activeCategory);
  }, [services, activeCategory]);

  // Sorted services for Garment Tab matching Stitch design
  const sortedGarmentServices = useMemo(() => {
    return [...visibleGarmentServices].sort((a, b) => a.name.localeCompare(b.name));
  }, [visibleGarmentServices]);

  const visiblePricingServices = useMemo(() => {
    return filterServicesForCategory(services, pricingCategory);
  }, [services, pricingCategory]);

  // Visible services for Add Garment modal based on selected category (canonical Stitch ordering)
  const visibleCreateServices = useMemo(() => {
    const filtered = filterServicesForCategory(services, newCategory);
    return [...filtered].sort((a, b) => {
      const idxA = SERVICE_CANONICAL_ORDER.findIndex((s) => a.name.toLowerCase().includes(s));
      const idxB = SERVICE_CANONICAL_ORDER.findIndex((s) => b.name.toLowerCase().includes(s));
      return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
    });
  }, [services, newCategory]);

  // Filtered garments for Pricing Tab
  const pricingFilteredGarments = useMemo(() => {
    return garments.filter((g) => {
      const matchesCategory = g.category === pricingCategory;
      const matchesSearch =
        !pricingSearch || g.name.toLowerCase().includes(pricingSearch.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [garments, pricingCategory, pricingSearch]);

  // (getPriceFor is defined above before filteredGarments)

  // Active pricing service object
  const currentPricingService = useMemo(() => {
    return services.find((s) => s.id === pricingServiceId) || services[0];
  }, [services, pricingServiceId]);

  // Helper to calculate base / minimum configured price for a garment
  const getBasePriceFor = useCallback(
    (garmentId: string): number | null => {
      const garmentPrices = pricingData
        .filter(
          (p: any) => p.garmentCatalogId === garmentId && p.price !== undefined && p.price !== null,
        )
        .map((p: any) => p.price);
      if (garmentPrices.length === 0) return null;
      return Math.min(...garmentPrices);
    },
    [pricingData],
  );

  // How many items in current category have a price configured for current pricing service
  const pricingConfiguredCount = useMemo(() => {
    return pricingFilteredGarments.filter((g) => getPriceFor(g.id, pricingServiceId) !== null)
      .length;
  }, [pricingFilteredGarments, pricingServiceId, getPriceFor]);

  // POS keyboard fast keys (F2 focus search, Esc revert pending edits)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (activeTab !== 'pricing') return;
      if (e.key === 'F2') {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key === 'Escape') {
        if (Object.keys(editedPrices).length > 0) {
          e.preventDefault();
          setEditedPrices({});
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab, editedPrices]);

  // ─── Modal Handlers ─────────────────────────────────────
  const openCreateModal = () => {
    setNewName('');
    setNewCategory(activeCategory as GarmentCategory);
    setNewSection('');
    setNewPrices({});
    setCreateError(null);
    setCreateModalOpen(true);
  };

  const closeCreateModal = () => {
    setCreateModalOpen(false);
    setNewPrices({});
    setCreateError(null);
  };

  const handleNewPriceChange = (serviceId: string, value: string) => {
    setNewPrices((prev) => ({
      ...prev,
      [serviceId]: value,
    }));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) {
      setCreateError('Garment name is required');
      return;
    }

    // Validate optional prices if entered
    if (canConfigurePricing) {
      for (const svc of visibleCreateServices) {
        const val = newPrices[svc.id];
        if (val !== undefined && val.trim() !== '') {
          const num = parseFloat(val);
          if (isNaN(num) || num < 0) {
            setCreateError(`Please enter a valid, non-negative price for ${svc.name}`);
            return;
          }
        }
      }
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

      const json = await res.json();
      const createdGarment = json.data || json;

      // Optionally save entered prices using existing POST /pricing/:garmentId/:serviceId
      if (createdGarment?.id && canConfigurePricing) {
        const pricePromises = visibleCreateServices
          .filter((svc) => newPrices[svc.id] !== undefined && newPrices[svc.id].trim() !== '')
          .map(async (svc) => {
            const price = parseFloat(newPrices[svc.id]);
            const pRes = await fetch(`${API_URL}/pricing/${createdGarment.id}/${svc.id}`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ price }),
            });
            if (!pRes.ok) {
              const errBody = await pRes.json().catch(() => ({}));
              throw new Error(errBody.message || `Failed to save price for ${svc.name}`);
            }
          });

        await Promise.all(pricePromises);
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

  const handleSaveAllPrices = async () => {
    if (!editGarment) return false;
    setSavingEditPrices(true);
    setSaveGarmentError(null);
    let hasError = false;

    try {
      const promises = services.map(async (svc) => {
        const val = editPrices[svc.id] || '';
        const originalPrice = pricingData.find(
          (p: any) => p.garmentCatalogId === editGarment.id && p.serviceTypeId === svc.id,
        );
        const hasChanged = val !== '' && val !== (originalPrice ? String(originalPrice.price) : '');

        if (hasChanged) {
          const price = parseFloat(val);
          if (isNaN(price) || price < 0) {
            throw new Error(`Invalid price for ${svc.name}`);
          }
          const res = await fetch(`${API_URL}/pricing/${editGarment.id}/${svc.id}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ price }),
          });
          if (!res.ok) {
            throw new Error(`Failed to save ${svc.name}`);
          }
        }
      });

      await Promise.all(promises);
      await fetchAllData();

      const updatedMap = { ...editPrices };
      for (const svc of services) {
        const val = editPrices[svc.id] || '';
        if (val !== '') {
          updatedMap[svc.id] = val;
        }
      }
      setEditPrices(updatedMap);
    } catch (err) {
      setSaveGarmentError(err instanceof Error ? err.message : 'Save failed');
      hasError = true;
    } finally {
      setSavingEditPrices(false);
    }
    return !hasError;
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
      <CatalogHeader
        title="Garment Catalog"
        subtitle="Downtown Connaught Place #102 • Active Master Catalog"
        onBack={() => navigate('/')}
        showLogo={true}
        rightContent={
          <>
            {/* Catalog View / Service Pricing Tab Switcher */}
            {canConfigurePricing && (
              <div className="flex items-center bg-slate-100 p-0.5 rounded-[3px] border border-slate-200 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setActiveTab('garments')}
                  className={`px-3 py-1.5 rounded-[3px] transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'garments'
                      ? 'bg-white text-blue-600 shadow-xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <LayoutGrid size={14} />
                  <span>Catalog View</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('pricing')}
                  className={`px-3 py-1.5 rounded-[3px] transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'pricing'
                      ? 'bg-white text-blue-600 shadow-xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Tag size={14} />
                  <span>Service Pricing</span>
                </button>
              </div>
            )}

            {/* Export CSV Button */}
            <button
              type="button"
              onClick={handleExportCSV}
              className="hidden sm:flex items-center gap-1.5 border border-slate-200 bg-white rounded-[3px] px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer shadow-xs"
              title="Export catalog as CSV"
            >
              <Upload size={14} />
              <span>Export CSV</span>
            </button>

            {/* Add Garment Button */}
            {canManage && (
              <button
                type="button"
                onClick={openCreateModal}
                className="px-4 py-2 bg-[#2563eb] hover:bg-blue-700 active:scale-98 text-white rounded-[3px] text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Plus size={16} />
                <span>Add Garment</span>
              </button>
            )}
          </>
        }
      />

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
              <div
                className="flex-1 overflow-y-auto bg-slate-50 min-h-0"
                style={{ background: '#f8fafc' }}
              >
                <div
                  className="flex flex-col max-w-[1600px] mx-auto w-full"
                  style={{
                    padding: '8px 16px 32px 16px',
                    maxWidth: '1600px',
                    margin: '0 auto',
                    width: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                  }}
                >
                  {/* ─── 1. REUSABLE CATALOG NAV & FILTER (SERVICE + CATEGORY + SEARCH) ── */}
                  <CatalogNavFilter
                    services={sortedGarmentServices}
                    activeServiceId={activeServiceId}
                    onServiceChange={handleActiveServiceChange}
                    categories={CATEGORIES}
                    categoryLabels={CATEGORY_LABELS}
                    activeCategory={activeCategory}
                    onCategoryChange={handleActiveCategoryChange}
                    searchQuery={searchQuery}
                    onSearchChange={setSearchQuery}
                    searchRef={catalogSearchRef}
                    rightToolbarContent={
                      <>
                        <div
                          className="flex items-center gap-2"
                          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                        >
                          <span style={{ color: '#64748b', fontWeight: 500, fontSize: '13px' }}>
                            Sort:
                          </span>
                          <select
                            value={sortOrder}
                            onChange={(e) => setSortOrder(e.target.value)}
                            aria-label="Sort garments"
                            style={{
                              height: '32px',
                              padding: '0 12px',
                              background: '#ffffff',
                              border: '1px solid #e2e8f0',
                              borderRadius: '3px',
                              fontSize: '13px',
                              color: '#334155',
                              fontWeight: 500,
                              cursor: 'pointer',
                              outline: 'none',
                            }}
                          >
                            {CATALOG_SORT_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <label
                          className="flex items-center gap-2 text-xs text-slate-700 font-medium cursor-pointer select-none"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            fontSize: '12px',
                            color: '#334155',
                            fontWeight: 500,
                            cursor: 'pointer',
                            userSelect: 'none',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={activeOnly}
                            onChange={(e) => setActiveOnly(e.target.checked)}
                            style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                          />
                          <span>Active Only</span>
                        </label>
                      </>
                    }
                  />

                  {/* ─── 4. GARMENT CATALOG GRID ──────────────────── */}
                  {filteredGarments.length === 0 ? (
                    <div
                      className="bg-white border border-slate-200 rounded-[3px] p-8 shadow-xs"
                      style={{
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '3px',
                        padding: '32px',
                      }}
                    >
                      <EmptyState
                        message={
                          searchQuery
                            ? `No garments matching "${searchQuery}" in ${CATEGORY_LABELS[activeCategory]}`
                            : `No garments found in the "${CATEGORY_LABELS[activeCategory]}" category.`
                        }
                      />
                    </div>
                  ) : (
                    <>
                      <style>{`
                        .garment-grid-responsive {
                          display: grid;
                          grid-template-columns: repeat(2, minmax(0, 1fr));
                          gap: 12px;
                        }
                        @media (min-width: 640px) {
                          .garment-grid-responsive {
                            grid-template-columns: repeat(3, minmax(0, 1fr));
                          }
                        }
                        @media (min-width: 768px) {
                          .garment-grid-responsive {
                            grid-template-columns: repeat(4, minmax(0, 1fr));
                          }
                        }
                        @media (min-width: 1024px) {
                          .garment-grid-responsive {
                            grid-template-columns: repeat(6, minmax(0, 1fr));
                          }
                        }
                        @media (min-width: 1200px) {
                          .garment-grid-responsive {
                            grid-template-columns: repeat(8, minmax(0, 1fr));
                          }
                        }
                      `}</style>
                      <div className="garment-grid-responsive w-full">
                        {filteredGarments.map((garment, idx) => {
                          const price = getPriceFor(garment.id, activeServiceId);
                          const hasPrice = price !== null;
                          const skuIndex = idx;
                          const categoryPrefix = (
                            CATEGORY_LABELS[garment.category] || garment.category
                          )
                            .substring(0, 3)
                            .toUpperCase();
                          const sku = `${categoryPrefix}-${String(skuIndex + 1).padStart(2, '0')}`;
                          const subtitle =
                            (garment as any).section ||
                            (garment as any).description ||
                            GARMENT_SUBTITLES[garment.name] ||
                            'Standard Wear';

                          return (
                            <div
                              key={garment.id}
                              className={`border border-slate-200 rounded-[3px] bg-white p-3 flex flex-col justify-between group transition-all shadow-xs ${
                                !garment.isActive
                                  ? 'opacity-60 grayscale bg-slate-50/60 border-slate-300'
                                  : 'hover:border-blue-300 hover:shadow-sm'
                              }`}
                              style={{
                                background: garment.isActive ? '#ffffff' : '#f8fafc',
                                border: garment.isActive
                                  ? '1px solid #e2e8f0'
                                  : '1px solid #cbd5e1',
                                borderRadius: '3px',
                                padding: '12px 10px',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'space-between',
                                minHeight: '215px',
                                boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                                opacity: garment.isActive ? 1 : 0.65,
                              }}
                            >
                              {/* Top Row: SKU + Price Badge */}
                              <div
                                className="flex items-center justify-between w-full mb-1"
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  width: '100%',
                                  marginBottom: '6px',
                                }}
                              >
                                <span
                                  className="text-[11px] font-mono text-slate-400 font-medium tracking-wider select-none"
                                  style={{
                                    fontSize: '11px',
                                    fontFamily: 'monospace',
                                    color: '#94a3b8',
                                    fontWeight: 500,
                                    letterSpacing: '0.05em',
                                    userSelect: 'none',
                                  }}
                                >
                                  {sku}
                                </span>
                                <div
                                  className="flex items-center gap-1.5 shrink-0"
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    flexShrink: 0,
                                  }}
                                >
                                  {!garment.isActive && (
                                    <span
                                      className="bg-slate-100 text-slate-500 text-[10px] font-semibold px-1.5 py-0.5 rounded-[2px]"
                                      style={{
                                        background: '#f1f5f9',
                                        color: '#64748b',
                                        fontSize: '10px',
                                        fontWeight: 600,
                                        padding: '2px 5px',
                                        borderRadius: '2px',
                                      }}
                                    >
                                      Inactive
                                    </span>
                                  )}
                                  {hasPrice ? (
                                    <span
                                      className="bg-[#eff6ff] text-[#2563eb] font-bold text-xs px-2.5 py-0.5 rounded-[3px] border border-[#bfdbfe] whitespace-nowrap shrink-0"
                                      style={{
                                        background: '#eff6ff',
                                        color: '#2563eb',
                                        fontWeight: 700,
                                        fontSize: '12px',
                                        padding: '2px 8px',
                                        borderRadius: '3px',
                                        border: '1px solid #bfdbfe',
                                        whiteSpace: 'nowrap',
                                        flexShrink: 0,
                                      }}
                                    >
                                      ₹{price.toFixed(0)}
                                    </span>
                                  ) : (
                                    <span
                                      className="bg-slate-50 text-slate-400 text-[11px] font-medium px-2 py-0.5 rounded-[3px] border border-slate-200 whitespace-nowrap shrink-0"
                                      style={{
                                        background: '#f8fafc',
                                        color: '#94a3b8',
                                        fontSize: '11px',
                                        fontWeight: 500,
                                        padding: '2px 6px',
                                        borderRadius: '3px',
                                        border: '1px solid #e2e8f0',
                                        whiteSpace: 'nowrap',
                                        flexShrink: 0,
                                      }}
                                    >
                                      No Price
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Center Icon Box */}
                              <div
                                className="w-12 h-12 mx-auto rounded-[3px] bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-500 group-hover:text-blue-600 group-hover:bg-blue-50/60 transition-colors my-2 shrink-0"
                                style={{
                                  width: '48px',
                                  height: '48px',
                                  margin: '8px auto',
                                  borderRadius: '3px',
                                  background: '#f8fafc',
                                  border: '1px solid #f1f5f9',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  color: '#64748b',
                                  flexShrink: 0,
                                }}
                              >
                                {renderStitchGarmentIcon(garment.name)}
                              </div>

                              {/* Garment Title & Subtitle */}
                              <div
                                className="text-center w-full mb-2"
                                style={{ textAlign: 'center', width: '100%', marginBottom: '8px' }}
                              >
                                <h3
                                  className="text-xs font-bold text-slate-900 truncate leading-snug"
                                  style={{
                                    fontSize: '12px',
                                    fontWeight: 700,
                                    color: '#0f172a',
                                    lineHeight: 1.3,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                  }}
                                  title={garment.name}
                                >
                                  {garment.name}
                                </h3>
                                <p
                                  className="text-[11px] text-slate-400 truncate mt-0.5"
                                  style={{
                                    fontSize: '11px',
                                    color: '#94a3b8',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                    marginTop: '2px',
                                  }}
                                  title={subtitle}
                                >
                                  {subtitle}
                                </p>
                              </div>

                              {/* Subtle Divider Line above Edit Button */}
                              <div
                                className="w-full border-t border-slate-100 my-2"
                                style={{
                                  width: '100%',
                                  borderTop: '1px solid #f1f5f9',
                                  margin: '8px 0',
                                }}
                              ></div>

                              {/* Single Edit Button */}
                              {canManage && (
                                <button
                                  type="button"
                                  onClick={() => openEditModal(garment)}
                                  className="w-full h-8 border border-slate-200 rounded-[3px] text-xs font-medium text-slate-700 hover:text-blue-600 hover:border-blue-300 hover:bg-slate-50 flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                                  style={{
                                    width: '100%',
                                    height: '32px',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: '3px',
                                    fontSize: '12px',
                                    fontWeight: 500,
                                    color: '#334155',
                                    background: '#ffffff',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '6px',
                                    cursor: 'pointer',
                                  }}
                                  title="Edit garment"
                                >
                                  <Edit2
                                    size={12}
                                    className="text-slate-400 group-hover:text-blue-600"
                                  />
                                  <span>Edit</span>
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* ════════════════════════════════════════════════════ */}
            {/* ══ TAB 2: SERVICE PRICING MATRIX (ADMIN) ═════════ */}
            {/* ════════════════════════════════════════════════════ */}
            {activeTab === 'pricing' && canConfigurePricing && (
              <div className="flex-1 flex flex-col min-h-0 bg-slate-50">
                <div
                  className="flex-1 overflow-y-auto bg-slate-50 min-h-0 flex flex-col justify-between"
                  style={{ background: '#f8fafc' }}
                >
                  <div
                    className="flex flex-col max-w-[1600px] mx-auto w-full"
                    style={{
                      padding: '8px 16px',
                      maxWidth: '1600px',
                      margin: '0 auto',
                      width: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                    }}
                  >
                    {/* ─── REUSABLE CATALOG NAV & FILTER (SERVICE + CATEGORY + SEARCH) ── */}
                    <CatalogNavFilter
                      services={visiblePricingServices}
                      activeServiceId={pricingServiceId}
                      onServiceChange={handlePricingServiceChange}
                      categories={CATEGORIES}
                      categoryLabels={CATEGORY_LABELS}
                      activeCategory={pricingCategory}
                      onCategoryChange={handlePricingCategoryChange}
                      searchQuery={pricingSearch}
                      onSearchChange={setPricingSearch}
                      searchRef={searchRef}
                      searchPlaceholder={`Filter ${CATEGORY_LABELS[pricingCategory] || 'items'} items or barcode (F2)...`}
                      rightToolbarContent={
                        <div
                          className="flex items-center gap-3 shrink-0 flex-wrap justify-end"
                          style={{ display: 'flex', alignItems: 'center', gap: '12px' }}
                        >
                          {/* Configured Status Indicator */}
                          <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 px-1">
                            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                            <span>
                              {pricingConfiguredCount}/{pricingFilteredGarments.length} configured
                              for {currentPricingService?.name || 'Selected Service'}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            {/* Auto-fill All Missing Button */}
                            <button
                              type="button"
                              onClick={handleAutoFillAllMissingPrices}
                              disabled={savingPrices}
                              className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white rounded-[3px] text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                            >
                              <Zap size={14} className="fill-white" />
                              <span>Auto-fill All Missing</span>
                            </button>

                            {/* Save All Changes Button (if pending edits exist) */}
                            {Object.keys(editedPrices).length > 0 && (
                              <button
                                type="button"
                                onClick={handleSaveAllEditedPrices}
                                disabled={savingPrices}
                                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-[3px] text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                              >
                                <Save size={14} />
                                <span>Save All ({Object.keys(editedPrices).length})</span>
                              </button>
                            )}

                            {/* Refresh / Reload Button */}
                            <button
                              type="button"
                              onClick={fetchAllData}
                              disabled={loading || savingPrices}
                              title="Refresh pricing data"
                              className="p-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 hover:text-slate-900 rounded-[3px] shadow-2xs transition-colors cursor-pointer flex items-center justify-center"
                            >
                              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                            </button>
                          </div>
                        </div>
                      }
                    />

                    {/* Notifications & Pricing Table Content Area */}
                    <div className="space-y-3 mt-1">
                      {/* Notifications */}
                      {priceSaveSuccess && (
                        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-lg flex items-center gap-2 shadow-2xs">
                          <Check size={16} className="text-emerald-600 shrink-0" />{' '}
                          {priceSaveSuccess}
                        </div>
                      )}
                      {priceSaveError && (
                        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold rounded-lg flex items-center justify-between shadow-2xs">
                          <span>{priceSaveError}</span>
                          <button
                            type="button"
                            onClick={() => setPriceSaveError(null)}
                            className="text-rose-500 hover:text-rose-800 cursor-pointer"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      )}

                      {/* Stitch-styled Pricing Table Card */}
                      {pricingFilteredGarments.length === 0 ? (
                        <EmptyState
                          message={
                            pricingSearch
                              ? `No garments matching "${pricingSearch}" in ${CATEGORY_LABELS[pricingCategory]}`
                              : `No garments found in ${CATEGORY_LABELS[pricingCategory]}`
                          }
                        />
                      ) : (
                        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm border-collapse">
                              <thead className="bg-slate-50/75 border-b border-slate-200 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                                <tr>
                                  <th className="py-3.5 px-4 w-16 text-center">Icon</th>
                                  <th className="py-3.5 px-4">Garment Name</th>
                                  <th className="py-3.5 px-4">Category</th>
                                  <th className="py-3.5 px-4">Status</th>
                                  <th className="py-3.5 px-4">Base Price</th>
                                  <th className="py-3.5 px-4 min-w-[190px]">
                                    Configure Price (
                                    {currentPricingService?.name?.toUpperCase() || 'SERVICE'} ₹)
                                  </th>
                                  <th className="py-3.5 px-4">Services Status</th>
                                  <th className="py-3.5 px-4 text-right pr-6">Action</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {pricingFilteredGarments.map((garment, idx) => {
                                  const currentPrice = getPriceFor(garment.id, pricingServiceId);
                                  const hasPrice = currentPrice !== null;
                                  const isEdited = editedPrices[garment.id] !== undefined;
                                  const inputValue = isEdited
                                    ? editedPrices[garment.id]
                                    : hasPrice
                                      ? String(currentPrice)
                                      : '';
                                  const basePrice = getBasePriceFor(garment.id);
                                  const configuredCountForGarment = services.filter(
                                    (s) => getPriceFor(garment.id, s.id) !== null,
                                  ).length;
                                  const totalServices = services.length;
                                  const allConfigured =
                                    configuredCountForGarment === totalServices &&
                                    totalServices > 0;

                                  return (
                                    <tr
                                      key={garment.id}
                                      className="hover:bg-slate-50/70 transition-colors"
                                    >
                                      {/* Column 1: ICON */}
                                      <td className="py-3 px-4 text-center">
                                        <div className="flex justify-center">
                                          {renderGarmentIcon(garment.name)}
                                        </div>
                                      </td>

                                      {/* Column 2: GARMENT NAME + SKU */}
                                      <td className="py-3 px-4">
                                        <div className="flex flex-col">
                                          <span className="text-sm font-bold text-slate-900 leading-snug">
                                            {garment.name}
                                          </span>
                                          <span className="text-[11px] font-mono text-slate-400 mt-0.5 tracking-wider">
                                            {getGarmentSKU(garment.name, idx)}
                                          </span>
                                        </div>
                                      </td>

                                      {/* Column 3: CATEGORY */}
                                      <td className="py-3 px-4">
                                        <span className="px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200/80 inline-block">
                                          {CATEGORY_LABELS[garment.category] || garment.category}
                                        </span>
                                      </td>

                                      {/* Column 4: STATUS */}
                                      <td className="py-3 px-4">
                                        {garment.isActive !== false ? (
                                          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80 inline-block">
                                            Active
                                          </span>
                                        ) : (
                                          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-500 border border-slate-200 inline-block">
                                            Inactive
                                          </span>
                                        )}
                                      </td>

                                      {/* Column 5: BASE PRICE */}
                                      <td className="py-3 px-4 font-semibold text-slate-600">
                                        {basePrice !== null ? (
                                          <span>₹{basePrice.toFixed(0)}</span>
                                        ) : (
                                          <span className="text-slate-400 font-normal">—</span>
                                        )}
                                      </td>

                                      {/* Column 6: CONFIGURE PRICE (SERVICE ₹) */}
                                      <td className="py-3 px-4">
                                        <div
                                          className={`relative flex items-center bg-white border rounded-lg px-3 py-1.5 w-36 shadow-2xs hover:border-slate-300 focus-within:border-primary-500 focus-within:ring-2 focus-within:ring-primary-100 transition-all ${
                                            isEdited
                                              ? 'border-primary-500 ring-2 ring-primary-200'
                                              : 'border-slate-200'
                                          }`}
                                        >
                                          <span className="text-slate-400 text-sm font-medium mr-1.5 select-none">
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
                                            onKeyDown={(e) => {
                                              if (e.key === 'Enter') {
                                                e.preventDefault();
                                                handleSaveSinglePrice(garment.id);
                                              }
                                            }}
                                            className="w-full text-sm font-bold text-slate-900 bg-transparent outline-none"
                                          />
                                          {isEdited ? (
                                            <button
                                              type="button"
                                              onClick={() => handleSaveSinglePrice(garment.id)}
                                              disabled={savingPrices}
                                              title="Save price (Enter)"
                                              className="ml-1 text-primary-600 hover:text-primary-700 p-0.5 cursor-pointer shrink-0"
                                            >
                                              <Save size={15} />
                                            </button>
                                          ) : hasPrice ? (
                                            <Check
                                              size={16}
                                              className="text-emerald-500 ml-1 shrink-0"
                                              strokeWidth={2.5}
                                            />
                                          ) : null}
                                        </div>
                                      </td>

                                      {/* Column 7: SERVICES STATUS */}
                                      <td className="py-3 px-4">
                                        <span
                                          className={`px-3 py-1 rounded-full text-xs font-semibold border inline-flex items-center ${
                                            allConfigured
                                              ? 'bg-blue-50/90 text-blue-600 border-blue-200'
                                              : configuredCountForGarment > 0
                                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                                : 'bg-slate-100 text-slate-500 border-slate-200'
                                          }`}
                                        >
                                          {configuredCountForGarment}/{totalServices} Configured
                                        </span>
                                      </td>

                                      {/* Column 8: ACTION */}
                                      <td className="py-3 px-4 text-right pr-6">
                                        {canManage && (
                                          <button
                                            type="button"
                                            onClick={() => openEditModal(garment)}
                                            className="text-sm font-semibold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer transition-colors"
                                          >
                                            Edit
                                          </button>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>

                          {/* Card Pagination Footer */}
                          <div className="px-5 py-3.5 bg-white border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-500">
                            <div>
                              Showing 1–{pricingFilteredGarments.length} of{' '}
                              {pricingFilteredGarments.length}{' '}
                              {CATEGORY_LABELS[pricingCategory] || pricingCategory}'s garments
                            </div>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                disabled
                                className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-400 bg-white font-medium cursor-not-allowed text-xs"
                              >
                                Previous
                              </button>
                              <button
                                type="button"
                                className="w-7 h-7 rounded-md bg-blue-600 text-white font-bold flex items-center justify-center text-xs shadow-xs"
                              >
                                1
                              </button>
                              <button
                                type="button"
                                disabled
                                className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-400 bg-white font-medium cursor-not-allowed text-xs"
                              >
                                Next
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Stitch POS Fast Keys Footer Bar */}
                    <div className="mt-6 -mx-4 -mb-4 md:-mx-6 md:-mb-6 bg-slate-900 text-slate-300 px-5 py-2.5 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-slate-800 shrink-0">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="font-bold uppercase tracking-wider text-slate-400 text-[11px]">
                          POS FAST KEYS:
                        </span>
                        <div className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-[11px]">
                          <span className="font-mono text-slate-400 font-bold">↵ Enter</span>
                          <span className="text-slate-300">Save Rate</span>
                        </div>
                        <div className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-[11px]">
                          <span className="font-mono text-slate-400 font-bold">Tab</span>
                          <span className="text-slate-300">Next Line</span>
                        </div>
                        <div className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-[11px]">
                          <span className="font-mono text-slate-400 font-bold">Esc</span>
                          <span className="text-slate-300">Revert changes</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-slate-400 text-[11px]">
                        <span>GrowFast Retail POS 4.8.2</span>
                        <span className="text-slate-600">•</span>
                        <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                          Cloud Database Connected
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* ─── CREATE GARMENT MODAL (Exact Stitch Match with 28px Inset) ──────────────────────────── */}
      {createModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div
            className="bg-white shadow-2xl border border-slate-200 my-auto flex flex-col box-border overflow-hidden"
            style={{ width: '560px', maxWidth: '95vw', maxHeight: '95vh', borderRadius: '3px' }}
          >
            <form
              onSubmit={handleCreate}
              className="flex flex-col m-0 p-0 w-full h-full box-border overflow-hidden"
            >
              {/* Modal Header (Pinned) */}
              <div
                className="flex items-start justify-between border-b border-slate-100 box-border shrink-0 bg-white"
                style={{ padding: '16px 28px' }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 flex items-center justify-center bg-[#edf5ff] border border-[#dbeafe] text-[#2563eb] shrink-0"
                    style={{ borderRadius: '3px' }}
                  >
                    <Sparkles size={18} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-[15px] font-bold text-slate-900 leading-none">
                        Add New Garment
                      </h2>
                      <span
                        className="px-1.5 py-0.5 text-[9px] font-bold text-[#2563eb] bg-[#edf5ff] border border-[#bfdbfe] tracking-wider uppercase leading-none"
                        style={{ borderRadius: '3px' }}
                      >
                        QUICK CREATE
                      </span>
                    </div>
                    <p className="text-[11.5px] text-slate-400 mt-1 font-normal">
                      Define garment metadata and optional workflow pricing
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closeCreateModal}
                  className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-50 transition-colors cursor-pointer"
                  style={{ borderRadius: '3px' }}
                  aria-label="Close modal"
                >
                  <X size={17} />
                </button>
              </div>

              {createError && (
                <div
                  className="bg-rose-50 border border-rose-200 text-rose-700 text-xs box-border shrink-0"
                  style={{ margin: '12px 28px 0 28px', padding: '10px 12px', borderRadius: '3px' }}
                >
                  {createError}
                </div>
              )}

              {/* ONE inner content wrapper inside the modal body with 28px left/right padding */}
              <div
                className="w-full box-border flex flex-col overflow-y-auto flex-1"
                style={{ padding: '18px 28px 20px 28px' }}
              >
                {/* Section 1: GARMENT DETAILS */}
                <div className="w-full">
                  <div className="flex items-center gap-1.5 mb-2.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#2563eb] inline-block shrink-0"></span>
                    <span className="text-[10.5px] font-bold text-slate-700 tracking-wider uppercase">
                      GARMENT DETAILS
                    </span>
                  </div>

                  {/* 16px between form fields */}
                  <div className="flex flex-col w-full" style={{ gap: '16px' }}>
                    <div className="w-full">
                      <label className="block text-[10px] font-bold text-slate-700 tracking-wider uppercase mb-1.5">
                        GARMENT NAME <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Silk Blazer, Kurta Pajama, Suit 2-Piece"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        className="w-full bg-white border border-slate-300 text-xs text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none transition-colors box-border"
                        style={{ height: '36px', padding: '0 12px', borderRadius: '3px' }}
                      />
                    </div>

                    <div className="w-full">
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-[10px] font-bold text-slate-700 tracking-wider uppercase">
                          CATEGORY <span className="text-rose-500">*</span>
                        </label>
                        <span className="text-[10.5px] text-slate-400 font-normal">
                          Controls service workflow defaults
                        </span>
                      </div>
                      <div className="relative w-full">
                        <select
                          value={newCategory}
                          onChange={(e) => setNewCategory(e.target.value as GarmentCategory)}
                          className="w-full bg-white border border-slate-300 text-xs text-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none appearance-none cursor-pointer box-border"
                          style={{ height: '36px', padding: '0 32px 0 12px', borderRadius: '3px' }}
                        >
                          {CATEGORIES.map((c) => (
                            <option key={c} value={c}>
                              {CATEGORY_LABELS[c] || c}
                            </option>
                          ))}
                        </select>
                        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-400">
                          <ChevronDown size={14} />
                        </div>
                      </div>
                    </div>

                    <div className="w-full">
                      <label className="block text-[10px] font-bold text-slate-700 tracking-wider uppercase mb-1.5">
                        SECTION / NOTES{' '}
                        <span className="text-slate-400 font-normal lowercase">(optional)</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Formal, Delicate, Heavy Embroidery, Woolen"
                        value={newSection}
                        onChange={(e) => setNewSection(e.target.value)}
                        className="w-full bg-white border border-slate-300 text-xs text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none transition-colors box-border"
                        style={{ height: '36px', padding: '0 12px', borderRadius: '3px' }}
                      />
                    </div>
                  </div>
                </div>

                {/* Section 2: SERVICE PRICING (OPTIONAL) - 20px before Service Pricing */}
                {canConfigurePricing && (
                  <div className="w-full" style={{ marginTop: '20px' }}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Tag size={13} className="text-[#2563eb]" />
                        <span className="text-[10.5px] font-bold text-slate-700 tracking-wider uppercase">
                          SERVICE PRICING (OPTIONAL)
                        </span>
                      </div>
                      <span className="text-[10.5px] text-slate-400 font-normal">
                        {visibleCreateServices.length} GrowFast Services
                      </span>
                    </div>

                    {/* 12px between pricing header and info box */}
                    <div
                      className="w-full bg-[#f0f6ff] border border-[#d8e6fd] text-[11.5px] text-slate-700 flex items-start gap-2.5 leading-relaxed box-border"
                      style={{
                        marginTop: '12px',
                        marginBottom: '12px',
                        padding: '10px 12px',
                        borderRadius: '3px',
                      }}
                    >
                      <span className="text-sm select-none shrink-0 leading-none mt-0.5">💡</span>
                      <div>
                        You can set standard prices now or configure them later in{' '}
                        <span className="font-semibold text-slate-900">Service Pricing</span>. Item
                        creation does not require pricing.
                      </div>
                    </div>

                    {/* Compact Services Table without inner scrollbar - 44px row height */}
                    <div
                      className="w-full border border-slate-200 overflow-hidden box-border"
                      style={{ borderRadius: '3px' }}
                    >
                      <div
                        className="bg-slate-50/80 border-b border-slate-200 flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase tracking-wider box-border"
                        style={{ height: '32px', padding: '0 14px' }}
                      >
                        <span>SERVICE NAME</span>
                        <span>STANDARD PRICE (₹)</span>
                      </div>
                      <div className="divide-y divide-slate-100">
                        {visibleCreateServices.map((svc) => {
                          const isPromo = svc.name.toLowerCase().includes('free');
                          return (
                            <div
                              key={svc.id}
                              className="flex items-center justify-between hover:bg-slate-50/50 transition-colors box-border"
                              style={{ height: '44px', padding: '0 14px' }}
                            >
                              <div className="flex items-center gap-2">
                                <span
                                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${getServiceDotColor(svc.name)}`}
                                ></span>
                                <span className="text-xs font-medium text-slate-800">
                                  {svc.name}
                                </span>
                                {isPromo && (
                                  <span
                                    className="text-[9px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-300/80 tracking-wide leading-none"
                                    style={{ padding: '2px 6px', borderRadius: '3px' }}
                                  >
                                    Promo
                                  </span>
                                )}
                              </div>
                              <div
                                className="flex items-center border border-slate-200 bg-white focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 overflow-hidden transition-colors box-border"
                                style={{ width: '120px', height: '28px', borderRadius: '3px' }}
                              >
                                <div
                                  className="h-full bg-slate-50/80 border-r border-slate-200 flex items-center justify-center text-xs text-slate-400 select-none shrink-0"
                                  style={{ width: '26px' }}
                                >
                                  ₹
                                </div>
                                <input
                                  type="number"
                                  step="any"
                                  min="0"
                                  placeholder={isPromo ? '0.00' : '—'}
                                  value={newPrices[svc.id] ?? ''}
                                  onChange={(e) => handleNewPriceChange(svc.id, e.target.value)}
                                  className="w-full h-full bg-transparent text-right text-xs font-medium text-slate-800 placeholder:text-slate-300 focus:outline-none box-border"
                                  style={{ padding: '0 8px' }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer (Pinned) with 28px left/right padding */}
              <div
                className="w-full bg-[#f8fafc] border-t border-slate-200 flex items-center justify-between shrink-0 box-border"
                style={{ padding: '12px 28px' }}
              >
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <Check size={14} className="text-emerald-500 shrink-0 stroke-[2.5]" />
                  <span>Prices can be edited anytime from catalog</span>
                </div>
                <div className="flex items-center shrink-0" style={{ gap: '11px' }}>
                  <button
                    type="button"
                    onClick={closeCreateModal}
                    className="text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 transition-colors cursor-pointer shadow-2xs box-border"
                    style={{ padding: '7px 16px', borderRadius: '3px' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creating}
                    className="text-xs font-semibold text-white bg-[#2563eb] hover:bg-blue-700 shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50 box-border"
                    style={{ padding: '7px 20px', borderRadius: '3px' }}
                  >
                    <Plus size={14} className="stroke-[2.5]" />
                    <span>{creating ? 'Creating...' : 'Create Garment'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── EDIT GARMENT MODAL ────────────────────────────── */}
      {editModalOpen && editGarment && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div
            className="bg-white rounded-[3px] max-w-[690px] w-full shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto"
            style={{ borderRadius: '3px' }}
          >
            {/* Dedicated Inner Content Container: 24px left/right, 16px top/bottom */}
            <div
              className="w-full flex flex-col gap-4 box-border"
              style={{
                paddingLeft: '24px',
                paddingRight: '24px',
                paddingTop: '16px',
                paddingBottom: '16px',
              }}
            >
              {/* Header */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 bg-primary-50 flex items-center justify-center shrink-0 border border-primary-100 text-primary-600"
                    style={{ borderRadius: '3px' }}
                  >
                    <Edit2 size={18} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2.5">
                      <h2 className="text-base font-bold text-slate-900">Edit Garment</h2>
                      <span
                        className="text-[10px] font-bold text-slate-500 bg-slate-100 border border-slate-200"
                        style={{ borderRadius: '3px', padding: '2px 6px' }}
                      >
                        SKU: GRM-{editGarment.id.substring(0, 4).toUpperCase()}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Update catalog metadata and per-service retail rates
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closeEditModal}
                  className="text-slate-400 hover:text-slate-600 cursor-pointer p-1 transition-colors"
                  style={{ borderRadius: '3px' }}
                >
                  <X size={18} />
                </button>
              </div>

              {saveGarmentError && (
                <div
                  className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs"
                  style={{ borderRadius: '3px' }}
                >
                  {saveGarmentError}
                </div>
              )}

              {/* ── Garment Details Section ── */}
              <div
                className="border border-slate-200 bg-white box-border"
                style={{ borderRadius: '3px', padding: '16px' }}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[11px] font-bold text-slate-800 tracking-wider flex items-center gap-2 uppercase">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary-500"></div>
                    Garment Details
                  </h3>
                  <span className="text-[11px] text-slate-400">* Required fields</span>
                </div>

                <form onSubmit={handleSaveGarment} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-3">
                        Garment Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full bg-white border border-slate-200 text-sm text-slate-800 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 focus:outline-none transition-shadow"
                        style={{ borderRadius: '3px', padding: '9px 14px' }}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-3">
                        Category <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={editCategory}
                        onChange={(e) => setEditCategory(e.target.value as GarmentCategory)}
                        className="w-full bg-white border border-slate-200 text-sm text-slate-800 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 focus:outline-none transition-shadow"
                        style={{ borderRadius: '3px', padding: '9px 14px' }}
                      >
                        {CATEGORIES.map((c) => (
                          <option key={c} value={c}>
                            {CATEGORY_LABELS[c] || c}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div
                    className="flex flex-col sm:flex-row sm:items-center justify-between border-t border-slate-100 gap-4"
                    style={{ paddingTop: '16px' }}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={editIsActive}
                            onChange={(e) => setEditIsActive(e.target.checked)}
                          />
                          <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary-600"></div>
                        </label>
                      </div>
                      <div>
                        <span className="text-sm font-semibold text-slate-900 block">
                          Active Status
                        </span>
                        <span className="text-[11px] text-slate-500">
                          Inactive garments won't appear in the counter order wizard
                        </span>
                      </div>
                    </div>
                    <button
                      type="submit"
                      disabled={savingGarment}
                      className="shrink-0 text-xs font-semibold text-primary-700 bg-primary-50 hover:bg-primary-100 border border-primary-200 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                      style={{ borderRadius: '3px', padding: '10px 16px', minHeight: '44px' }}
                    >
                      <Check size={14} /> {savingGarment ? 'Saving...' : 'Save Details'}
                    </button>
                  </div>
                </form>
              </div>

              {/* ── Service Pricing Section ── */}
              {canConfigurePricing && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-start gap-2">
                      <Tag size={16} className="text-primary-500 mt-0.5 shrink-0" />
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">Service Pricing</h3>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Set the unit charge for this garment across individual service workflows.
                        </p>
                      </div>
                    </div>
                    <div
                      className="bg-slate-100 border border-slate-200 text-[11px] font-medium text-slate-600 shrink-0"
                      style={{ borderRadius: '3px', padding: '4px 10px' }}
                    >
                      8 Services Available
                    </div>
                  </div>

                  {/* Pricing Table with 16px inner horizontal padding */}
                  <div
                    className="border border-slate-200 overflow-hidden bg-white box-border"
                    style={{ borderRadius: '3px' }}
                  >
                    <div
                      className="flex items-center justify-between bg-slate-50 border-b border-slate-200"
                      style={{ padding: '8px 16px' }}
                    >
                      <span className="text-[10px] font-bold text-slate-500 tracking-wider uppercase">
                        Service Type
                      </span>
                      <span className="text-[10px] font-bold text-slate-500 tracking-wider uppercase w-28 text-right">
                        Rate (₹)
                      </span>
                    </div>

                    <div className="divide-y divide-slate-100">
                      {services.map((svc: any) => {
                        const val = editPrices[svc.id] || '';

                        const svcName = svc.name.toLowerCase();
                        let Icon = Box;
                        let desc = '';
                        let isPromo = false;

                        if (svcName.includes('dry clean')) {
                          Icon = FlaskConical;
                          desc = 'Deep chemical solvent process';
                        } else if (svcName.includes('free shoe')) {
                          Icon = Gift;
                          desc = 'Complimentary bundle item';
                          isPromo = true;
                        } else if (svcName.includes('reprocess')) {
                          Icon = Recycle;
                          desc = 'Secondary stain remediation cycle';
                        } else if (svcName.includes('shoe cleaning')) {
                          Icon = Package;
                          desc = 'Sole restoration & deodorizing';
                        } else if (svcName.includes('standard wash')) {
                          Icon = Box;
                          desc = 'Regular drum hydro-cleaning';
                        } else if (svcName.includes('starching')) {
                          Icon = Shield;
                          desc = 'Crisp stiffening finish';
                        } else if (svcName.includes('wash + steam')) {
                          Icon = Droplets;
                          desc = 'Combined wash and press';
                        } else if (svcName.includes('steam iron')) {
                          Icon = Zap;
                          desc = 'High-pressure vertical press';
                        }

                        return (
                          <div
                            key={svc.id}
                            className="flex items-center justify-between hover:bg-slate-50/50 transition-colors box-border"
                            style={{ padding: '10px 16px', minHeight: '50px' }}
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className="w-8 h-8 border border-slate-200 bg-slate-50 flex items-center justify-center text-slate-500 shrink-0"
                                style={{ borderRadius: '3px' }}
                              >
                                <Icon size={16} strokeWidth={1.5} />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-semibold text-slate-800">
                                    {svc.name}
                                  </span>
                                  {isPromo && (
                                    <span
                                      className="bg-emerald-100 text-emerald-700 text-[9px] font-bold"
                                      style={{ borderRadius: '2px', padding: '2px 6px' }}
                                    >
                                      Promo
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-slate-400 mt-0.5">{desc}</p>
                              </div>
                            </div>

                            <div className="relative w-28 shrink-0">
                              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <span className="text-slate-400 text-xs font-semibold">₹</span>
                              </div>
                              <input
                                type="number"
                                min="0"
                                step="1"
                                placeholder="0"
                                value={val}
                                onChange={(e) =>
                                  setEditPrices((prev) => ({ ...prev, [svc.id]: e.target.value }))
                                }
                                className="w-full pl-7 pr-3 bg-white border border-slate-200 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 focus:outline-none transition-shadow text-right"
                                style={{
                                  borderRadius: '3px',
                                  paddingTop: '6px',
                                  paddingBottom: '6px',
                                  minHeight: '36px',
                                }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Single Save Prices Button: inset from right edge */}
                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={handleSaveAllPrices}
                      disabled={savingEditPrices}
                      className="text-xs font-semibold text-primary-700 bg-primary-50 hover:bg-primary-100 border border-primary-200 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                      style={{ borderRadius: '3px', padding: '10px 16px', minHeight: '44px' }}
                    >
                      <Save size={15} /> {savingEditPrices ? 'Saving Prices...' : 'Save Prices'}
                    </button>
                  </div>
                </div>
              )}

              {/* ── Footer ── */}
              <div
                className="border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 box-border"
                style={{ paddingTop: '16px' }}
              >
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></div>
                  <span className="text-xs font-medium text-slate-600">
                    Catalog changes sync across all active store branches
                  </span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <button
                    type="button"
                    onClick={closeEditModal}
                    className="text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 transition-colors cursor-pointer"
                    style={{ borderRadius: '3px', padding: '10px 16px', minHeight: '44px' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const pricesSaved = await handleSaveAllPrices();
                      if (pricesSaved) closeEditModal();
                    }}
                    disabled={savingEditPrices}
                    className="text-xs font-bold text-white bg-primary-600 hover:bg-primary-700 shadow-xs transition-colors cursor-pointer"
                    style={{ borderRadius: '3px', padding: '10px 18px', minHeight: '44px' }}
                  >
                    Done & Close
                  </button>
                </div>
              </div>
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
