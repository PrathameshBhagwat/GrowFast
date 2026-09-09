import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { PhotoCapture } from '@growfast/ui';
import { useAuth } from '../contexts/AuthContext';
import { CustomerDTO, PhotoType, isPhotoRequiredForOrder } from '@growfast/shared-types';
import { CustomerSelector } from '../components/CustomerSelector';
import { ItemSelector } from '../components/ItemSelector';
import { uploadPhoto } from '../services/photo.api';
import {
  ArrowLeft,
  ArrowRight,
  UserPlus,
  ChevronDown,
  ChevronRight,
  ShoppingBag,
  Trash2,
  Plus,
  Minus,
  FileText,
  Camera,
  X,
  Pencil,
  Check,
} from 'lucide-react';
import { renderStitchGarmentIcon } from '../components/GarmentIcon';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export function OrderWizardPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialCustomerId = searchParams.get('customerId');
  const { token } = useAuth();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(initialCustomerId);
  const [customer, setCustomer] = useState<CustomerDTO | null>(null);
  const [customerLoading, setCustomerLoading] = useState(!!initialCustomerId);
  const [customerError, setCustomerError] = useState<string | null>(null);
  const [showCustomerModal, setShowCustomerModal] = useState(false);

  // Active item detail configuration modal
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);
  const [viewingPhotoUrl, setViewingPhotoUrl] = useState<string | null>(null);

  const [items, setItems] = useState<any[]>([]);
  const [garments, setGarments] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [prices, setPrices] = useState<any[]>([]);
  const [isExpress, setIsExpress] = useState(false);
  const [storeConfig, setStoreConfig] = useState<any>(null);
  const [generalNote, setGeneralNote] = useState('');
  const [showGeneralNoteInput, setShowGeneralNoteInput] = useState(false);

  // Fetch Store Config
  useEffect(() => {
    if (token) {
      fetch(`${API_URL}/store/config`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => res.json())
        .then((body) => {
          setStoreConfig(body);
        })
        .catch((err) => console.error('Failed to load store config:', err));
    }
  }, [token]);

  // Fetch Catalog Data
  useEffect(() => {
    if (token) {
      Promise.all([
        fetch(`${API_URL}/pricing`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/garments`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/services`, { headers: { Authorization: `Bearer ${token}` } }),
      ])
        .then(async ([resPricing, resGarments, resServices]) => {
          const bodyPricing = await resPricing.json();
          const bodyGarments = await resGarments.json();
          const bodyServices = await resServices.json();

          if (bodyPricing.success) setPrices(bodyPricing.data);
          if (bodyGarments.success) setGarments(bodyGarments.data);
          if (bodyServices.success) setServices(bodyServices.data);
        })
        .catch((err) => console.error('Failed to load catalog data:', err));
    }
  }, [token]);

  // Fetch Initial Customer from URL
  useEffect(() => {
    if (initialCustomerId && token) {
      const fetchCustomer = async () => {
        try {
          const res = await fetch(`${API_URL}/customers/${initialCustomerId}`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
          if (!res.ok) {
            throw new Error(`Failed to load customer (${res.status})`);
          }
          const body = await res.json();
          setCustomer(body.data);
          setSelectedCustomerId(body.data.id);
        } catch (err: any) {
          setCustomerError(err.message || 'Failed to load customer');
          setSelectedCustomerId(null);
        } finally {
          setCustomerLoading(false);
        }
      };
      fetchCustomer();
    }
  }, [initialCustomerId, token]);

  // Handle Customer Selection from Modal
  const handleSelectCustomer = (selectedCust: CustomerDTO) => {
    setCustomer(selectedCust);
    setSelectedCustomerId(selectedCust.id);
    setShowCustomerModal(false);
  };

  // Add Item to Order (directly from garment card "+ Add")
  const handleAddItem = (garment: any, serviceId: string, unitPrice: number) => {
    const service = services.find((s) => s.id === serviceId);
    const serviceName = service ? service.name : 'Unknown';

    setItems((prev) => {
      // If item with same garment and service exists (without custom defect notes), increment quantity
      const existingIdx = prev.findIndex(
        (i) =>
          i.garmentCatalogId === garment.id &&
          i.serviceTypeId === serviceId &&
          !i.defectNotes &&
          !i.brand &&
          (!i.pieces || i.pieces.every((p: any) => !p.photos || p.photos.length === 0)),
      );

      if (existingIdx >= 0) {
        const updated = [...prev];
        const cur = updated[existingIdx];
        const newQty = cur.quantity + 1;
        const currentPieces = cur.pieces || [];
        const updatedPieces = [];
        for (let u = 1; u <= newQty; u++) {
          const existing = currentPieces.find((p: any) => p.unitNumber === u);
          if (existing) {
            updatedPieces.push(existing);
          } else {
            updatedPieces.push({ unitNumber: u, photos: [] });
          }
        }
        updated[existingIdx] = {
          ...cur,
          quantity: newQty,
          pieces: updatedPieces,
        };
        return updated;
      }

      const newItem = {
        garmentCatalogId: garment.id,
        serviceTypeId: serviceId,
        garmentName: garment.name,
        serviceName,
        unitPrice,
        quantity: 1,
        topUpService: '',
        brand: '',
        defectNotes: '',
        colorTags: [],
        photoFile: null,
        pieces: [
          {
            unitNumber: 1,
            photos: [] as Array<{ id: string; file: File; previewUrl: string }>,
          },
        ],
      };
      return [...prev, newItem];
    });
  };

  // Quantity adjustments
  const handleUpdateQuantity = (index: number, delta: number) => {
    setItems((prev) => {
      const current = prev[index];
      if (!current) return prev;
      const newQty = current.quantity + delta;
      if (newQty <= 0) {
        return prev.filter((_, i) => i !== index);
      }
      const currentPieces = current.pieces || [];
      const updatedPieces = [];
      for (let u = 1; u <= newQty; u++) {
        const existing = currentPieces.find((p: any) => p.unitNumber === u);
        if (existing) {
          updatedPieces.push(existing);
        } else {
          updatedPieces.push({ unitNumber: u, photos: [] });
        }
      }
      const updated = [...prev];
      updated[index] = { ...current, quantity: newQty, pieces: updatedPieces };
      return updated;
    });
  };

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
    if (editingItemIndex === index) {
      setEditingItemIndex(null);
    }
  };

  // Pricing calculations
  const subtotal = useMemo(() => {
    return items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  }, [items]);

  const discount = 0; // Standard no discount by default

  const expressSurcharge = useMemo(() => {
    if (!isExpress || !storeConfig?.expressSurchargePercent) return 0;
    return (subtotal * storeConfig.expressSurchargePercent) / 100;
  }, [isExpress, storeConfig, subtotal]);

  const total = useMemo(() => {
    return Math.max(0, subtotal - discount + expressSurcharge);
  }, [subtotal, discount, expressSurcharge]);

  const totalGarmentCount = useMemo(() => {
    return items.reduce((sum, item) => sum + item.quantity, 0);
  }, [items]);

  // Canonical weight-based check (reuses GarmentCategory and ServiceCategory WEIGHT_BASED)
  const isOrderWeightBased = useMemo(() => {
    return items.some((item) => {
      const garment = garments.find((g) => g.id === item.garmentCatalogId);
      const service = services.find((s) => s.id === item.serviceTypeId);
      return garment?.category === 'WEIGHT_BASED' || service?.category === 'WEIGHT_BASED';
    });
  }, [items, garments, services]);

  // Photo requirement derived using canonical shared-types logic
  const isPhotoRequired = useMemo(() => {
    return isPhotoRequiredForOrder({
      isWalkIn: true,
      totalPieces: totalGarmentCount,
      isWeightBased: isOrderWeightBased,
    });
  }, [totalGarmentCount, isOrderWeightBased]);

  // Piece-level photo tracking and validation
  const { coveredPieces, missingPiecesList, allPiecesCovered } = useMemo(() => {
    let covered = 0;
    const missing: Array<{ itemIndex: number; garmentName: string; unitNumber: number }> = [];

    items.forEach((item, itemIndex) => {
      const pieces = item.pieces || [];
      for (let u = 1; u <= item.quantity; u++) {
        const piece = pieces.find((p: any) => p.unitNumber === u);
        const count = piece?.photos?.length || 0;
        if (count > 0) {
          covered++;
        } else {
          missing.push({
            itemIndex,
            garmentName: item.garmentName,
            unitNumber: u,
          });
        }
      }
    });

    return {
      coveredPieces: covered,
      missingPiecesList: missing,
      allPiecesCovered: totalGarmentCount > 0 && missing.length === 0,
    };
  }, [items, totalGarmentCount]);

  // Total photos count across all pieces
  const totalPhotosCount = useMemo(() => {
    return items.reduce((sum, item) => {
      const pieces = item.pieces || [];
      return sum + pieces.reduce((pSum: number, p: any) => pSum + (p.photos?.length || 0), 0);
    }, 0);
  }, [items]);

  // Formatted validation message for missing photos
  const missingPiecesMessage = useMemo(() => {
    if (missingPiecesList.length === 0) return '';
    if (missingPiecesList.length === 1) {
      const m = missingPiecesList[0];
      return `Add at least one photo for Piece ${m.unitNumber} (${m.garmentName}).`;
    }
    const last = missingPiecesList[missingPiecesList.length - 1];
    const rest = missingPiecesList.slice(0, -1);
    const piecesListStr =
      rest.map((m) => `Piece ${m.unitNumber} (${m.garmentName})`).join(', ') +
      ` and Piece ${last.unitNumber} (${last.garmentName})`;
    return `Add at least one photo for ${piecesListStr}.`;
  }, [missingPiecesList]);

  const handleAddPhotoToPiece = (itemIndex: number, unitNumber: number, file: File) => {
    const previewUrl = URL.createObjectURL(file);
    const photoId = `photo-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    setItems((prev) => {
      const updated = [...prev];
      const targetItem = { ...updated[itemIndex] };
      const pieces = [...(targetItem.pieces || [])];
      const pieceIdx = pieces.findIndex((p: any) => p.unitNumber === unitNumber);

      if (pieceIdx >= 0) {
        pieces[pieceIdx] = {
          ...pieces[pieceIdx],
          photos: [...(pieces[pieceIdx].photos || []), { id: photoId, file, previewUrl }],
        };
      } else {
        pieces.push({
          unitNumber,
          photos: [{ id: photoId, file, previewUrl }],
        });
      }

      targetItem.pieces = pieces;
      targetItem.photoFile = pieces[0]?.photos[0]?.file || null;
      updated[itemIndex] = targetItem;
      return updated;
    });
  };

  const handleRemovePhotoFromPiece = (itemIndex: number, unitNumber: number, photoId: string) => {
    setItems((prev) => {
      const updated = [...prev];
      const targetItem = { ...updated[itemIndex] };
      const pieces = [...(targetItem.pieces || [])];
      const pieceIdx = pieces.findIndex((p: any) => p.unitNumber === unitNumber);

      if (pieceIdx >= 0) {
        pieces[pieceIdx] = {
          ...pieces[pieceIdx],
          photos: pieces[pieceIdx].photos.filter((p: any) => p.id !== photoId),
        };
      }

      targetItem.pieces = pieces;
      targetItem.photoFile = pieces[0]?.photos[0]?.file || null;
      updated[itemIndex] = targetItem;
      return updated;
    });
  };

  // Order Submission
  const handleCreateOrder = async () => {
    if (!selectedCustomerId || items.length === 0) return;
    if (isPhotoRequired && !allPiecesCovered) return;

    setIsSubmitting(true);
    try {
      const payload = {
        customerId: selectedCustomerId,
        isExpress,
        pickupType: 'STORE_PICKUP',
        items: items.map((item) => ({
          garmentCatalogId: item.garmentCatalogId,
          serviceTypeId: item.serviceTypeId,
          quantity: item.quantity,
          pieces: (item.pieces || []).map((p: any) => ({
            unitNumber: p.unitNumber,
            photoCount: p.photos?.length || 0,
          })),
        })),
        notes: generalNote.trim() || 'Created via POS terminal',
      };

      const res = await fetch(`${API_URL}/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.message || `Failed to create order (${res.status})`);
      }

      const body = await res.json();
      const createdOrder = body.data;

      // Handle async photo uploads for any pieces with photos
      try {
        const uploadPromises: Promise<any>[] = [];
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          const createdItem = createdOrder.items?.[i];
          if (!createdItem || !item.pieces) continue;

          for (const piece of item.pieces) {
            if (!piece.photos || piece.photos.length === 0) continue;
            // Match physical garment by unitNumber
            const pg = createdItem.physicalGarments?.find(
              (g: any) => g.unitNumber === piece.unitNumber,
            );
            for (const photo of piece.photos) {
              if (photo.file) {
                uploadPromises.push(
                  uploadPhoto(
                    token!,
                    photo.file,
                    createdOrder.id,
                    'FRONT' as PhotoType,
                    createdItem.id,
                    pg?.id,
                  ),
                );
              }
            }
          }
        }
        await Promise.all(uploadPromises);
      } catch (uploadErr) {
        console.error('Photo upload failed but order was created:', uploadErr);
      }

      navigate(`/orders/${createdOrder.id}`);
    } catch (err: any) {
      alert(`Error creating order: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-100 overflow-hidden font-sans select-none">
      {/* ─── 1. TOP HEADER ───────────────────────────────── */}
      <header
        className="bg-white border-b border-slate-200 shrink-0 z-10"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 24px',
          minHeight: '64px',
          boxShadow: '0 1px 3px 0 rgba(0,0,0,0.03)',
        }}
      >
        {/* Left: Back Button + Title + Subtitle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            type="button"
            onClick={() => navigate(-1)}
            style={{
              width: '44px',
              height: '44px',
              minWidth: '44px',
              minHeight: '44px',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              background: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#2563eb',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              flexShrink: 0,
              boxShadow: '0 1px 2px 0 rgba(0,0,0,0.03)',
            }}
            title="Go Back"
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#f8fafc';
              e.currentTarget.style.borderColor = '#cbd5e1';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#ffffff';
              e.currentTarget.style.borderColor = '#e2e8f0';
            }}
          >
            <ArrowLeft size={19} />
          </button>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <h1
              style={{
                fontSize: '22px',
                fontWeight: 800,
                color: '#0f172a',
                lineHeight: 1.2,
                letterSpacing: '-0.01em',
                margin: 0,
              }}
            >
              Create New Order
            </h1>
            <span
              style={{
                fontSize: '13px',
                color: '#64748b',
                fontWeight: 400,
                lineHeight: 1.3,
              }}
            >
              Add garments and services to create a new order
            </span>
          </div>
        </div>

        {/* Right: Customer Details Card */}
        <div>
          {customer ? (
            <div
              onClick={() => setShowCustomerModal(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '14px',
                padding: '6px 14px 6px 8px',
                boxShadow: '0 1px 2px 0 rgba(0,0,0,0.04)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#cbd5e1';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#e2e8f0';
              }}
            >
              {/* Initials Circle */}
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '50%',
                  background: '#dbeafe',
                  color: '#2563eb',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '14px',
                  flexShrink: 0,
                  letterSpacing: '0.02em',
                }}
              >
                {customer.name
                  .split(' ')
                  .map((n: string) => n[0])
                  .join('')
                  .substring(0, 2)
                  .toUpperCase()}
              </div>
              {/* Name + ID/Phone */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px',
                  lineHeight: 1.25,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
                    {customer.name}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowCustomerModal(true);
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: '2px',
                      cursor: 'pointer',
                      color: '#64748b',
                      display: 'flex',
                      alignItems: 'center',
                      borderRadius: '4px',
                      transition: 'color 0.15s ease',
                    }}
                    title="Edit Customer"
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = '#2563eb';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = '#64748b';
                    }}
                  >
                    <Pencil size={13} />
                  </button>
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    fontSize: '12px',
                    color: '#64748b',
                  }}
                >
                  <span style={{ fontWeight: 500 }}>
                    #
                    {customer.id
                      ? customer.id.length > 10
                        ? customer.id.substring(0, 10).toUpperCase()
                        : customer.id.toUpperCase()
                      : 'CUST-00124'}
                  </span>
                  <span style={{ color: '#cbd5e1' }}>•</span>
                  <span>({customer.phone})</span>
                </div>
              </div>
              {/* Chevron */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  marginLeft: '4px',
                  color: '#94a3b8',
                }}
              >
                <ChevronDown size={17} />
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowCustomerModal(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                color: '#2563eb',
                padding: '8px 16px',
                borderRadius: '10px',
                fontSize: '13.5px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                boxShadow: '0 1px 2px 0 rgba(37, 99, 235, 0.08)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#dbeafe';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#eff6ff';
              }}
            >
              <UserPlus size={16} />
              <span>+ Select Customer</span>
            </button>
          )}
        </div>
      </header>

      {/* Accessible Section Heading for Screen Readers & Tests */}
      <h2 className="sr-only">Add Items</h2>

      {/* ─── 2. MAIN TWO-COLUMN CONTENT ──────────────────── */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden p-2 sm:p-2.5 gap-2.5">
        {/* LEFT COLUMN: Garment Catalog (Takes all remaining width) */}
        <div className="flex-1 min-w-0 flex flex-col min-h-0 bg-white border border-slate-200 rounded-[3px] shadow-2xs overflow-hidden">
          <ItemSelector
            garments={garments}
            services={services}
            prices={prices}
            onGarmentSelect={handleAddItem}
            onBack={() => navigate(-1)}
          />
        </div>

        {/* RIGHT COLUMN: Current Order Panel matching IMAGE 1 */}
        <div className="w-full lg:w-[440px] xl:w-[460px] shrink-0 flex flex-col bg-white border border-slate-200/90 rounded-xl shadow-xs overflow-hidden lg:h-full max-lg:min-h-[500px]">
          {/* 1. Panel Header */}
          <div className="px-4 pt-4 pb-3 flex items-center justify-between bg-white shrink-0">
            <div className="flex items-center gap-2.5">
              <ShoppingBag size={22} className="text-[#2563eb]" strokeWidth={2} />
              <h3 className="font-bold text-lg text-slate-900 tracking-tight">Current Order</h3>
              <span className="bg-[#eff6ff] text-[#2563eb] text-xs font-semibold px-2.5 py-0.5 rounded-full border border-[#dbeafe]">
                {totalGarmentCount} {totalGarmentCount === 1 ? 'item' : 'items'}
              </span>
            </div>

            {items.length > 0 ? (
              <button
                type="button"
                onClick={() => setItems([])}
                className="flex items-center gap-1.5 text-xs font-semibold text-rose-500 hover:text-rose-600 transition-colors cursor-pointer"
                title="Clear all items from order"
              >
                <Trash2 size={15} className="text-rose-500" strokeWidth={2} />
                <span>Clear All</span>
              </button>
            ) : (
              <span className="text-xs font-medium text-slate-400 select-none">Order #NEW</span>
            )}
          </div>

          {/* 2. Added Items List */}
          <div className="flex-1 min-h-0 overflow-y-auto px-4 py-2 space-y-3.5 bg-white">
            {items.length === 0 ? (
              /* Clean Empty State */
              <div className="flex flex-col items-center justify-center py-12 text-center px-6 text-slate-400 select-none">
                <div className="w-14 h-14 rounded-xl bg-white border border-slate-200/80 flex items-center justify-center text-slate-400 mb-3 shadow-2xs">
                  <svg
                    width="28"
                    height="28"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="m7.5 4.27 9 5.15" />
                    <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
                    <path d="m3.3 7 8.7 5 8.7-5" />
                    <path d="M12 22V12" />
                  </svg>
                </div>
                <h4 className="font-bold text-xs text-slate-800 mb-1.5">No items added yet</h4>
                <p className="text-[11px] text-slate-400 max-w-[210px] leading-relaxed">
                  Select garments from the catalog to add them to this order.
                </p>
              </div>
            ) : (
              items.map((item, idx) => {
                const itemTotal = item.unitPrice * item.quantity;
                const coveredItemPieces = (item.pieces || []).filter(
                  (p: any) => p.photos && p.photos.length > 0,
                ).length;
                const hasDetails =
                  item.defectNotes || item.brand || item.topUpService || coveredItemPieces > 0;

                return (
                  <div
                    key={idx}
                    className="bg-white border border-slate-200/90 rounded-lg p-4 shadow-2xs hover:border-slate-300 transition-all"
                  >
                    {/* Proper 2-column layout: Left: Garment icon, Right: Item content */}
                    <div className="flex gap-4 items-start">
                      {/* Left: Garment Icon Box */}
                      <div className="w-[52px] h-[52px] rounded-lg bg-[#f1f5f9] border border-slate-100 flex items-center justify-center text-slate-700 shrink-0">
                        {renderStitchGarmentIcon(item.garmentName)}
                      </div>

                      {/* Right: Item Content */}
                      <div className="flex-1 min-w-0">
                        {/* Top row: Garment Name + Item Price aligned to top-right with padding */}
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="font-bold text-[15px] text-slate-900 truncate leading-snug">
                            {item.garmentName}
                          </span>
                          <span className="font-bold text-[15px] text-slate-900 whitespace-nowrap font-mono shrink-0">
                            ₹{itemTotal.toFixed(2)}
                          </span>
                        </div>

                        {/* Service Name (10-12px vertical spacing) */}
                        <div className="text-xs text-slate-500 font-normal mt-1">
                          {item.serviceName}
                        </div>

                        {/* Unit Price each */}
                        <div className="text-xs text-slate-400 font-normal mt-0.5">
                          ₹{Number(item.unitPrice).toFixed(2)} each
                        </div>

                        {/* Optional Defect / Notes Indicator */}
                        {hasDetails && (
                          <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center gap-1.5 flex-wrap text-[11px] text-slate-600">
                            {item.brand && (
                              <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-700 font-medium">
                                🏷️ {item.brand}
                              </span>
                            )}
                            {item.defectNotes && (
                              <span
                                className="bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded truncate max-w-[160px]"
                                title={item.defectNotes}
                              >
                                ⚠️ {item.defectNotes}
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => setEditingItemIndex(idx)}
                              className={`px-2 py-0.5 rounded text-[11px] font-semibold border flex items-center gap-1 cursor-pointer transition-colors ${
                                coveredItemPieces === item.quantity
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                  : isPhotoRequired
                                    ? 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                                    : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                              }`}
                              title="Click to view/add piece photos"
                            >
                              <Camera size={12} />
                              <span>
                                {coveredItemPieces}/{item.quantity} photographed{' '}
                                {coveredItemPieces === item.quantity
                                  ? '✓'
                                  : isPhotoRequired
                                    ? '⚠'
                                    : ''}
                              </span>
                            </button>
                          </div>
                        )}

                        {/* Controls Row: 12px gap, 44px min touch target */}
                        <div className="flex items-center justify-between mt-3.5 gap-2.5">
                          {/* Quantity Stepper: [ − ] [ quantity ] [ + ] with 44px min touch target and segmented borders */}
                          <div className="flex items-center border border-slate-200 rounded-lg bg-white shadow-2xs overflow-hidden shrink-0 h-[44px] divide-x divide-slate-200">
                            <button
                              type="button"
                              onClick={() => handleUpdateQuantity(idx, -1)}
                              className="w-10 h-[44px] min-h-[44px] flex items-center justify-center text-slate-600 hover:bg-slate-50 active:bg-slate-100 transition-colors cursor-pointer"
                              title="Decrease quantity"
                            >
                              <Minus size={13} strokeWidth={2.5} />
                            </button>
                            <span className="w-10 h-[44px] flex items-center justify-center text-center font-bold text-sm text-slate-900 font-mono select-none">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleUpdateQuantity(idx, 1)}
                              className="w-10 h-[44px] min-h-[44px] flex items-center justify-center text-[#2563eb] hover:bg-slate-50 active:bg-slate-100 transition-colors cursor-pointer"
                              title="Increase quantity"
                            >
                              <Plus size={13} strokeWidth={2.5} />
                            </button>
                          </div>

                          {/* Action Buttons: [ Photos & Notes ] [ Delete ] on same row */}
                          <div className="flex items-center gap-2 shrink-0">
                            {/* Photos & Notes Button: 44px touch target */}
                            <button
                              type="button"
                              onClick={() => setEditingItemIndex(idx)}
                              className={`h-[44px] min-h-[44px] px-3 text-xs font-semibold rounded-lg border transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs ${
                                coveredItemPieces === item.quantity
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                  : isPhotoRequired && coveredItemPieces < item.quantity
                                    ? 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                                    : hasDetails
                                      ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                              }`}
                              title="Add piece photos or defect notes"
                            >
                              <Camera size={15} />
                              <span>Photos & Notes</span>
                            </button>

                            {/* Delete Button: 44px touch target, destructive styling */}
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(idx)}
                              className="w-[44px] h-[44px] min-h-[44px] flex items-center justify-center border border-rose-200/80 rounded-lg bg-rose-50/70 text-rose-500 hover:bg-rose-100 hover:text-rose-600 transition-colors cursor-pointer shadow-2xs"
                              title="Delete item"
                            >
                              <Trash2 size={15} strokeWidth={2} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* 3. General Order Note Section */}
          <div className="px-4 pt-3 pb-1">
            {showGeneralNoteInput ? (
              <div className="bg-[#f0f7ff] border border-blue-200 rounded-lg p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-blue-900 flex items-center gap-1.5">
                    <FileText size={15} className="text-[#2563eb]" />
                    General Order Note
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowGeneralNoteInput(false)}
                    className="text-slate-400 hover:text-slate-600 text-xs cursor-pointer p-1"
                  >
                    <X size={14} />
                  </button>
                </div>
                <textarea
                  rows={2}
                  value={generalNote}
                  onChange={(e) => setGeneralNote(e.target.value)}
                  placeholder="e.g. Deliver before 5 PM, fragile buttons..."
                  className="w-full text-xs p-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowGeneralNoteInput(true)}
                className="w-full bg-[#f0f7ff] border border-blue-100/90 rounded-lg p-3.5 flex items-center justify-between cursor-pointer hover:bg-blue-50/80 transition-colors text-left shadow-2xs"
              >
                <div className="flex items-center gap-2.5">
                  <FileText size={16} className="text-[#2563eb] shrink-0" strokeWidth={2} />
                  <span className="text-xs text-slate-700 font-medium">
                    {generalNote.trim() ? (
                      <span className="text-slate-800 font-semibold truncate max-w-[240px] block">
                        Note: {generalNote}
                      </span>
                    ) : (
                      'Add a general note (optional)'
                    )}
                  </span>
                </div>
                <ChevronRight size={16} className="text-slate-400 shrink-0" />
              </button>
            )}
          </div>

          {/* 4. Totals Breakdown, Highlighted Total & Proceed Button */}
          <div className="px-4 pt-3 pb-4 space-y-3 shrink-0">
            {/* Photos Progress Card & Compliance Indicators */}
            {items.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-slate-700 flex items-center gap-1.5">
                    <Camera size={15} className="text-[#2563eb]" />
                    Photos Progress
                  </span>
                  <div className="flex flex-col items-end gap-0.5">
                    <span
                      className={`font-mono px-2 py-0.5 rounded text-[11px] font-semibold ${
                        allPiecesCovered
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : isPhotoRequired
                            ? 'bg-amber-50 text-amber-800 border border-amber-200'
                            : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      Photos: {coveredPieces} / {totalGarmentCount} pieces covered{' '}
                      {allPiecesCovered ? '✓' : ''}
                    </span>
                    <span className="text-[10px] text-slate-500 font-medium font-mono">
                      {totalPhotosCount} total photo{totalPhotosCount === 1 ? '' : 's'}
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-2 transition-all duration-300 ${
                      allPiecesCovered ? 'bg-emerald-500' : 'bg-[#2563eb]'
                    }`}
                    style={{
                      width: `${totalGarmentCount > 0 ? (coveredPieces / totalGarmentCount) * 100 : 0}%`,
                    }}
                  />
                </div>

                {/* Status Guidance */}
                {isPhotoRequired && !allPiecesCovered && (
                  <div className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded p-2 flex items-start gap-1.5 leading-tight">
                    <span className="shrink-0 text-amber-600 font-bold">⚠</span>
                    <div>
                      <span className="font-semibold">Photos required for all pieces.</span> Click
                      Photos & Notes to capture at least 1 photo for each piece.
                      {missingPiecesMessage && (
                        <div className="text-amber-800 mt-1 font-semibold">
                          {missingPiecesMessage}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {!isPhotoRequired && totalGarmentCount >= 50 && !isOrderWeightBased && (
                  <div className="text-[11px] text-blue-800 bg-blue-50 border border-blue-200 rounded p-2 leading-tight">
                    ℹ️ Photos are optional for bulk orders.
                  </div>
                )}

                {isOrderWeightBased && (
                  <div className="text-[11px] text-indigo-800 bg-indigo-50 border border-indigo-200 rounded p-2 leading-tight">
                    ⚖️ Weight-based order: Photos required for all pieces.
                  </div>
                )}
              </div>
            )}

            {/* Totals Breakdown */}
            <div className="space-y-2 pt-1">
              <div className="flex justify-between items-center text-xs text-slate-600">
                <span>Items ({totalGarmentCount})</span>
                <span className="font-mono text-slate-800 font-semibold pr-1">
                  ₹{subtotal.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs text-slate-600">
                <span>Subtotal</span>
                <span className="font-mono text-slate-800 font-semibold pr-1">
                  ₹{subtotal.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs text-slate-600">
                <span>Discount</span>
                <span className="font-mono font-semibold text-emerald-600 pr-1">
                  {discount > 0 ? `- ₹${discount.toFixed(2)}` : '- ₹0.00'}
                </span>
              </div>

              {/* Express Delivery Checkbox (if configured) */}
              {storeConfig?.expressSurchargePercent != null && (
                <div className="pt-0.5 pb-0.5">
                  <label className="flex items-center justify-between cursor-pointer p-2 rounded-lg bg-amber-50/80 border border-amber-200/80 hover:bg-amber-50 transition-colors">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={isExpress}
                        onChange={(e) => setIsExpress(e.target.checked)}
                        className="w-3.5 h-3.5 rounded border-amber-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                      <span className="text-xs font-bold text-amber-900">⚡ Express Delivery</span>
                    </div>
                    <span className="text-[11px] font-bold text-amber-800 font-mono pr-1">
                      +{storeConfig.expressSurchargePercent}%
                    </span>
                  </label>
                </div>
              )}
            </div>

            {/* Divider Line */}
            <div className="border-t border-slate-100" />

            {/* Highlighted Total Box */}
            <div className="bg-[#eff6ff] border border-[#dbeafe] rounded-lg px-4 py-3.5 flex items-center justify-between">
              <div>
                <div className="text-base font-bold text-[#1e3a8a] tracking-tight">Total</div>
                <div className="text-xs text-slate-500 font-normal mt-0.5">Inclusive of taxes</div>
              </div>
              <div className="text-2xl font-extrabold text-[#2563eb] font-mono tracking-tight pr-1">
                ₹{total.toFixed(2)}
              </div>
            </div>

            {/* Primary Action: Proceed to Review */}
            <button
              type="button"
              onClick={handleCreateOrder}
              disabled={
                isSubmitting ||
                items.length === 0 ||
                !selectedCustomerId ||
                (isPhotoRequired && !allPiecesCovered)
              }
              className={`w-full min-h-[48px] h-[48px] py-3.5 px-4 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-sm ${
                isSubmitting ||
                items.length === 0 ||
                !selectedCustomerId ||
                (isPhotoRequired && !allPiecesCovered)
                  ? 'bg-[#bfdbfe] text-white cursor-not-allowed opacity-90'
                  : 'bg-[#2563eb] hover:bg-blue-700 text-white cursor-pointer shadow-xs active:scale-[0.99]'
              }`}
              title={
                !selectedCustomerId
                  ? 'Please select a customer first'
                  : items.length === 0
                    ? 'Add at least one item to proceed'
                    : isPhotoRequired && !allPiecesCovered
                      ? `Photos required: Please capture photos for all ${totalGarmentCount} pieces (${coveredPieces}/${totalGarmentCount} covered)`
                      : 'Proceed to Review'
              }
            >
              {isSubmitting ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Creating Order...</span>
                </>
              ) : (
                <>
                  <Check size={18} strokeWidth={2.5} />
                  <span>Proceed to Review</span>
                  <ArrowRight size={18} strokeWidth={2} />
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ─── 3. CUSTOMER SELECTOR MODAL ─────────────────── */}
      {showCustomerModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-[6px] shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50">
              <h3 className="font-bold text-sm text-slate-900">Select Customer</h3>
              <button
                type="button"
                onClick={() => setShowCustomerModal(false)}
                className="w-7 h-7 rounded flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-4 overflow-y-auto">
              <CustomerSelector onSelect={handleSelectCustomer} />
            </div>
          </div>
        </div>
      )}

      {/* ─── 4. ITEM DETAILS / PHOTO MODAL ───────────────── */}
      {editingItemIndex !== null && items[editingItemIndex] && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-[6px] shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50">
              <div>
                <h3 className="font-bold text-sm text-slate-900">Item Details & Defect Notes</h3>
                <span className="text-xs text-slate-500">
                  {items[editingItemIndex].garmentName} • {items[editingItemIndex].serviceName}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setEditingItemIndex(null)}
                className="w-7 h-7 rounded flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Brand (Optional)
                </label>
                <input
                  type="text"
                  className="w-full border border-slate-200 rounded-[3px] px-2.5 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  placeholder="e.g. Zara, Raymond, Levi's"
                  value={items[editingItemIndex].brand || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    setItems((prev) => {
                      const updated = [...prev];
                      updated[editingItemIndex] = { ...updated[editingItemIndex], brand: val };
                      return updated;
                    });
                  }}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Defect / Stains / Special Notes
                </label>
                <textarea
                  rows={2}
                  className="w-full border border-slate-200 rounded-[3px] px-2.5 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  placeholder="e.g. Oil stain on collar, missing middle button"
                  value={items[editingItemIndex].defectNotes || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    setItems((prev) => {
                      const updated = [...prev];
                      updated[editingItemIndex] = {
                        ...updated[editingItemIndex],
                        defectNotes: val,
                      };
                      return updated;
                    });
                  }}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Top Up Service (Optional)
                </label>
                <input
                  type="text"
                  className="w-full border border-slate-200 rounded-[3px] px-2.5 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  placeholder="e.g. Starching, Stain Treatment"
                  value={items[editingItemIndex].topUpService || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    setItems((prev) => {
                      const updated = [...prev];
                      updated[editingItemIndex] = {
                        ...updated[editingItemIndex],
                        topUpService: val,
                      };
                      return updated;
                    });
                  }}
                />
              </div>

              <div className="pt-3 border-t border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Camera size={15} className="text-[#2563eb]" />
                      Piece Photos {isPhotoRequired ? '(Required)' : '(Optional)'}
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {isPhotoRequired
                        ? 'Every individual physical piece must have at least 1 photo before order creation.'
                        : totalGarmentCount >= 50 && !isOrderWeightBased
                          ? 'Photos are optional for bulk orders.'
                          : 'Photos help track piece conditions and defect history.'}
                    </p>
                  </div>
                </div>

                <div className="space-y-3 pt-1">
                  {Array.from({ length: items[editingItemIndex].quantity }, (_, pIdx) => {
                    const unitNum = pIdx + 1;
                    const piece = (items[editingItemIndex].pieces || []).find(
                      (p: any) => p.unitNumber === unitNum,
                    );
                    const piecePhotos = piece?.photos || [];
                    const isCovered = piecePhotos.length > 0;

                    return (
                      <div
                        key={unitNum}
                        className={`border rounded-lg p-3 space-y-2.5 transition-colors ${
                          isCovered
                            ? 'border-emerald-200 bg-emerald-50/30'
                            : isPhotoRequired
                              ? 'border-amber-200 bg-amber-50/40'
                              : 'border-slate-200 bg-slate-50/50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-900">
                            Piece {unitNum} of {items[editingItemIndex].quantity}
                          </span>
                          {isCovered ? (
                            <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded flex items-center gap-1">
                              {piecePhotos.length} photo{piecePhotos.length > 1 ? 's' : ''} ✓
                            </span>
                          ) : isPhotoRequired ? (
                            <span className="text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded flex items-center gap-1">
                              0 photos ⚠ Required
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded">
                              0 photos (Optional)
                            </span>
                          )}
                        </div>

                        {/* Existing thumbnails / previews */}
                        {piecePhotos.length > 0 && (
                          <div className="space-y-1 pt-1">
                            <div className="text-[11px] font-medium text-slate-600">
                              Captured Photos ({piecePhotos.length}):
                            </div>
                            <div className="flex flex-wrap gap-3">
                              {piecePhotos.map((photo: any, phIdx: number) => (
                                <div
                                  key={photo.id || phIdx}
                                  className="flex flex-col items-center gap-1 shrink-0 bg-white p-1.5 rounded-lg border border-slate-200 shadow-2xs"
                                >
                                  <button
                                    type="button"
                                    onClick={() => setViewingPhotoUrl(photo.previewUrl)}
                                    className="w-20 h-20 rounded-md border border-slate-200 overflow-hidden bg-slate-100 hover:ring-2 hover:ring-blue-500 transition-all cursor-pointer block p-0"
                                    title={`Click to preview Photo ${phIdx + 1}`}
                                    aria-label={`Preview Photo ${phIdx + 1} of Piece ${unitNum}`}
                                  >
                                    <img
                                      src={photo.previewUrl}
                                      alt={`Piece ${unitNum} - Photo ${phIdx + 1}`}
                                      className="w-full h-full object-cover"
                                    />
                                  </button>
                                  <div className="flex items-center justify-between w-full px-0.5 text-[10px] text-slate-600">
                                    <span className="font-medium">Photo {phIdx + 1}</span>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleRemovePhotoFromPiece(
                                          editingItemIndex,
                                          unitNum,
                                          photo.id,
                                        )
                                      }
                                      className="min-h-[44px] min-w-[44px] flex items-center justify-center text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors cursor-pointer"
                                      title={`Remove photo ${phIdx + 1}`}
                                      aria-label={`Remove photo ${phIdx + 1} from Piece ${unitNum}`}
                                    >
                                      <Trash2 size={15} />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Photo capture action */}
                        <div className="pt-1">
                          <PhotoCapture
                            label={
                              piecePhotos.length === 0
                                ? isPhotoRequired
                                  ? `Capture Photo for Piece #${unitNum}`
                                  : `Capture Photo for Piece #${unitNum} (Optional)`
                                : `+ Add Photo`
                            }
                            allowCamera={true}
                            resetAfterCapture={true}
                            onCapture={(file) =>
                              handleAddPhotoToPiece(editingItemIndex, unitNum, file)
                            }
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingItemIndex(null)}
                className="px-6 py-2.5 bg-[#2563eb] text-white font-bold text-xs rounded-lg hover:bg-blue-700 transition-colors shadow-2xs min-h-[44px]"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox Modal for Photo Preview */}
      {viewingPhotoUrl && (
        <div
          className="fixed inset-0 bg-black/80 z-60 flex items-center justify-center p-4 backdrop-blur-xs"
          onClick={() => setViewingPhotoUrl(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="relative max-w-2xl w-full bg-white rounded-xl overflow-hidden shadow-2xl p-4 flex flex-col items-center gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full flex justify-between items-center border-b pb-2">
              <span className="text-sm font-bold text-slate-800">Photo Preview</span>
              <button
                type="button"
                onClick={() => setViewingPhotoUrl(null)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                aria-label="Close photo preview"
              >
                <X size={20} />
              </button>
            </div>
            <img
              src={viewingPhotoUrl}
              alt="Enlarged photo preview"
              className="max-h-[70vh] w-auto object-contain rounded-lg border border-slate-200"
            />
            <button
              type="button"
              onClick={() => setViewingPhotoUrl(null)}
              className="min-h-[44px] px-6 bg-slate-900 text-white text-sm font-semibold rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
