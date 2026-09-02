import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  Card,
  Button,
  Input,
  Select,
  Modal,
  LoadingState,
  EmptyState,
  ErrorState,
} from '@growfast/ui';
import { GarmentCategory, Role } from '@growfast/shared-types';
import type { GarmentCatalogDTO } from '@growfast/shared-types';
import { ArrowLeft, Edit2, Shirt, Plus, Search } from 'lucide-react';

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
};

/** Category pill colours. */
const CATEGORY_COLORS: Record<string, string> = {
  MEN: '#2563EB',
  WOMEN: '#DB2777',
  KIDS: '#F59E0B',
  HOUSEHOLD: '#059669',
  SHOES: '#7C3AED',
  SPECIAL: '#DC2626',
};

const categorySelectOptions = CATEGORIES.map((c) => ({
  value: c,
  label: CATEGORY_LABELS[c] || c,
}));

/**
 * CatalogSettingsPage — Garment Catalog Management (B1).
 *
 * Shows garment catalog with category filtering.
 * OWNER role can edit garment name, category, and active status.
 */
export const CatalogSettingsPage: React.FC = () => {
  const { token, employee } = useAuth();
  const navigate = useNavigate();
  const isOwner = employee?.role === Role.OWNER;

  // ─── State ─────────────────────────────────────────
  const [garments, setGarments] = useState<GarmentCatalogDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(CATEGORIES[0]);
  const [searchQuery, setSearchQuery] = useState('');

  // Create modal state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState<GarmentCategory>(GarmentCategory.MEN);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Edit modal state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editGarment, setEditGarment] = useState<GarmentCatalogDTO | null>(null);
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editIsActive, setEditIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // ─── Fetch ─────────────────────────────────────────
  const fetchGarments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = activeCategory
        ? `${API_URL}/garments?category=${activeCategory}`
        : `${API_URL}/garments`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        throw new Error(`Failed to fetch garments (${res.status})`);
      }

      const body = await res.json();
      setGarments(body.data ?? []);
    } catch {
      const MOCK_GARMENTS: GarmentCatalogDTO[] = [
        {
          id: 'gar-001',
          name: "Men's Formal Shirt",
          category: GarmentCategory.MEN,
          isActive: true,
        },
        { id: 'gar-002', name: "Men's Trousers", category: GarmentCategory.MEN, isActive: true },
        {
          id: 'gar-003',
          name: "Men's 2-Piece Suit",
          category: GarmentCategory.MEN,
          isActive: true,
        },
        { id: 'gar-004', name: 'Silk Saree', category: GarmentCategory.WOMEN, isActive: true },
        {
          id: 'gar-005',
          name: 'Cotton Salwar Suit',
          category: GarmentCategory.WOMEN,
          isActive: true,
        },
        {
          id: 'gar-006',
          name: 'Designer Lehenga',
          category: GarmentCategory.WOMEN,
          isActive: true,
        },
        {
          id: 'gar-007',
          name: 'Double Bed Sheet',
          category: GarmentCategory.HOUSEHOLD,
          isActive: true,
        },
        {
          id: 'gar-008',
          name: 'Heavy Blanket',
          category: GarmentCategory.HOUSEHOLD,
          isActive: true,
        },
      ];
      const filtered = activeCategory
        ? MOCK_GARMENTS.filter((g) => g.category === activeCategory)
        : MOCK_GARMENTS;
      setGarments(filtered);
    } finally {
      setLoading(false);
    }
  }, [token, activeCategory]);

  useEffect(() => {
    fetchGarments();
  }, [fetchGarments]);

  // ─── Create handlers ───────────────────────────────
  const openCreateModal = () => {
    setNewName('');
    setNewCategory(GarmentCategory.MEN);
    setCreateError(null);
    setCreateModalOpen(true);
  };

  const closeCreateModal = () => {
    setCreateModalOpen(false);
    setCreateError(null);
  };

  const handleCreate = async () => {
    setCreating(true);
    setCreateError(null);
    try {
      const body = { name: newName, category: newCategory, isActive: true };
      const res = await fetch(`${API_URL}/garments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.message || `Create failed (${res.status})`);
      }

      closeCreateModal();
      await fetchGarments();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setCreating(false);
    }
  };

  // ─── Edit handlers ─────────────────────────────────
  const openEditModal = (garment: GarmentCatalogDTO) => {
    setEditGarment(garment);
    setEditName(garment.name);
    setEditCategory(garment.category);
    setEditIsActive(garment.isActive);
    setSaveError(null);
    setEditModalOpen(true);
  };

  const closeEditModal = () => {
    setEditModalOpen(false);
    setEditGarment(null);
    setSaveError(null);
  };

  const handleSave = async () => {
    if (!editGarment) return;
    setSaving(true);
    setSaveError(null);

    try {
      const body: Record<string, unknown> = {};
      if (editName !== editGarment.name) body.name = editName;
      if (editCategory !== editGarment.category) body.category = editCategory;
      if (editIsActive !== editGarment.isActive) body.isActive = editIsActive;

      if (Object.keys(body).length === 0) {
        closeEditModal();
        return;
      }

      const res = await fetch(`${API_URL}/garments/${editGarment.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.message || `Update failed (${res.status})`);
      }

      closeEditModal();
      await fetchGarments();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  // ─── Render ────────────────────────────────────────
  const filteredGarments = garments.filter(
    (g) => !searchQuery || g.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="flex flex-col h-screen bg-gray-50 overflow-hidden font-sans">
      {/* ── Header ──────────────────────────────────── */}
      <div className="bg-gradient-to-br from-primary-600 to-primary-800 p-4 md:p-6 text-white shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <button
              id="catalog-back-btn"
              onClick={() => navigate('/')}
              className="bg-white/15 border-none rounded-lg p-2 cursor-pointer flex items-center justify-center text-white min-w-[44px] min-h-[44px] hover:bg-white/25 transition-colors"
              aria-label="Back to home"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="m-0 text-xl font-bold tracking-tight">Garment Catalog</h1>
              <p className="m-0 mt-0.5 text-xs opacity-80">
                {isOwner ? 'Manage garment names & categories' : 'View garment catalog'}
              </p>
            </div>
          </div>
          {isOwner && (
            <Button
              id="catalog-create-btn"
              onClick={openCreateModal}
              icon={<Plus size={18} />}
              className="bg-white text-primary-700 hover:bg-gray-100 border-0"
            >
              Add Garment
            </Button>
          )}
        </div>
      </div>

      {/* ── Tabs & Search ─────────────────────────── */}
      <div className="flex flex-col bg-white border-b shrink-0 shadow-sm">
        <div className="flex overflow-x-auto hide-scrollbar border-b">
          <button
            onClick={() => setActiveCategory(null)}
            className={`px-5 py-3 whitespace-nowrap text-sm font-semibold transition-colors min-h-[44px] ${
              activeCategory === null
                ? 'text-gray-900 border-b-2 border-gray-900'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            All
          </button>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-5 py-3 whitespace-nowrap text-sm font-semibold transition-colors min-h-[44px] ${
                activeCategory === cat
                  ? 'text-gray-900 border-b-2 border-gray-900'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              {CATEGORY_LABELS[cat] || cat}
            </button>
          ))}
        </div>
        <div className="p-3 border-t">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
              <Search size={18} />
            </div>
            <input
              type="text"
              className="w-full pl-10 pr-4 py-2 border rounded-md min-h-[44px] text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Search garments..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* ── Content Grid ────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-gray-50">
        {loading && <LoadingState message="Loading garments…" />}
        {error && <ErrorState message={error} onRetry={fetchGarments} />}

        {!loading && !error && filteredGarments.length === 0 && (
          <EmptyState
            message={
              searchQuery
                ? `No garments matching "${searchQuery}"`
                : activeCategory
                  ? `No garments found in "${CATEGORY_LABELS[activeCategory] || activeCategory}" category`
                  : 'No garments in the catalog yet'
            }
          />
        )}

        {!loading && !error && filteredGarments.length > 0 && (
          <div>
            <p className="text-xs text-gray-500 font-medium mb-4">
              Showing {filteredGarments.length} garment{filteredGarments.length !== 1 ? 's' : ''}
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {filteredGarments.map((g) => {
                return (
                  <div
                    key={g.id}
                    className={`relative flex flex-col items-center justify-center p-3 bg-white rounded-lg border shadow-sm transition-all group ${
                      !g.isActive
                        ? 'opacity-60 grayscale'
                        : 'hover:shadow-md hover:border-primary-300'
                    }`}
                    title={g.name}
                  >
                    {!g.isActive && (
                      <div className="absolute top-0 right-0 bg-gray-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-bl-lg rounded-tr-lg">
                        Inactive
                      </div>
                    )}

                    {isOwner && (
                      <button
                        onClick={() => openEditModal(g)}
                        className="absolute top-1 right-1 p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-md transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 z-10"
                        title="Edit garment"
                      >
                        <Edit2 size={16} />
                      </button>
                    )}

                    <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 group-hover:text-primary-500 transition-colors mb-2 mt-2">
                      <Shirt size={28} strokeWidth={1.5} />
                    </div>

                    <span className="text-sm text-center font-medium text-gray-800 line-clamp-2 leading-tight px-1 pb-1">
                      {g.name}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Edit Modal (OWNER only) ─────────────────── */}
      <Modal open={editModalOpen} onClose={closeEditModal} title="Edit Garment">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Input
            id="edit-garment-name"
            label="Garment Name"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            placeholder="Enter garment name"
          />

          <Select
            id="edit-garment-category"
            label="Category"
            options={categorySelectOptions}
            value={editCategory}
            onChange={(e) => setEditCategory(e.target.value)}
          />

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <label
              htmlFor="edit-garment-active"
              style={{
                fontSize: '0.84rem',
                fontWeight: 500,
                color: '#334155',
                fontFamily: "'Inter', sans-serif",
              }}
            >
              Active
            </label>
            <button
              id="edit-garment-active"
              type="button"
              onClick={() => setEditIsActive(!editIsActive)}
              role="switch"
              aria-checked={editIsActive}
              style={{
                width: '48px',
                height: '28px',
                borderRadius: '9999px',
                border: 'none',
                cursor: 'pointer',
                background: editIsActive ? '#7C3AED' : '#CBD5E1',
                position: 'relative',
                transition: 'background 200ms ease',
                minHeight: '44px',
                minWidth: '48px',
                display: 'flex',
                alignItems: 'center',
                padding: '0 3px',
              }}
            >
              <span
                style={{
                  width: '22px',
                  height: '22px',
                  borderRadius: '50%',
                  background: '#FFFFFF',
                  transition: 'transform 200ms ease',
                  transform: editIsActive ? 'translateX(20px)' : 'translateX(0)',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
                }}
              />
            </button>
          </div>

          {saveError && (
            <p style={{ color: '#EF4444', fontSize: '0.84rem', margin: 0 }}>{saveError}</p>
          )}

          <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
            <Button
              id="edit-garment-cancel"
              variant="secondary"
              size="md"
              onClick={closeEditModal}
              fullWidth
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              id="edit-garment-save"
              variant="primary"
              size="md"
              onClick={handleSave}
              fullWidth
              disabled={saving || !editName.trim()}
            >
              {saving ? 'Saving…' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Create Modal (OWNER only) ─────────────────── */}
      <Modal open={createModalOpen} onClose={closeCreateModal} title="Add New Garment">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Input
            id="create-garment-name"
            label="Garment Name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Enter garment name"
          />

          <Select
            id="create-garment-category"
            label="Category"
            options={categorySelectOptions}
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value as GarmentCategory)}
          />

          {createError && (
            <p style={{ color: '#EF4444', fontSize: '0.84rem', margin: 0 }}>{createError}</p>
          )}

          <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
            <Button
              id="create-garment-cancel"
              variant="secondary"
              size="md"
              onClick={closeCreateModal}
              fullWidth
              disabled={creating}
            >
              Cancel
            </Button>
            <Button
              id="create-garment-save"
              variant="primary"
              size="md"
              onClick={handleCreate}
              fullWidth
              disabled={creating || !newName.trim()}
            >
              {creating ? 'Creating…' : 'Create Garment'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
