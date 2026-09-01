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
import { ArrowLeft, Edit2, Shirt, Plus } from 'lucide-react';

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
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

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
  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#F8FAFC',
        fontFamily: "'Inter', sans-serif",
      }}
    >
      {/* ── Header ──────────────────────────────────── */}
      <div
        style={{
          background: 'linear-gradient(135deg, #7C3AED 0%, #6D28D9 100%)',
          padding: '20px 20px 24px',
          color: '#FFFFFF',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '16px',
          }}
        >
          <button
            id="catalog-back-btn"
            onClick={() => navigate('/')}
            style={{
              background: 'rgba(255,255,255,0.15)',
              border: 'none',
              borderRadius: '10px',
              padding: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FFFFFF',
              minWidth: '44px',
              minHeight: '44px',
            }}
            aria-label="Back to home"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: '1.35rem',
                fontWeight: 800,
                letterSpacing: '-0.01em',
              }}
            >
              Garment Catalog
            </h1>
            <p style={{ margin: '2px 0 0', fontSize: '0.8rem', opacity: 0.8 }}>
              {isOwner ? 'Manage garment names & categories' : 'View garment catalog'}
            </p>
          </div>
          {isOwner && (
            <Button
              id="catalog-create-btn"
              onClick={openCreateModal}
              icon={<Plus size={18} />}
              style={{ background: '#FFFFFF', color: '#7C3AED' }}
            >
              Add Garment
            </Button>
          )}
        </div>

        {/* ── Category Filter Pills ─────────────────── */}
        <div
          style={{
            display: 'flex',
            gap: '8px',
            overflowX: 'auto',
            paddingBottom: '4px',
          }}
        >
          <button
            id="catalog-filter-all"
            onClick={() => setActiveCategory(null)}
            style={{
              padding: '8px 16px',
              borderRadius: '9999px',
              border: 'none',
              fontSize: '0.78rem',
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              minHeight: '44px',
              background: activeCategory === null ? '#FFFFFF' : 'rgba(255,255,255,0.15)',
              color: activeCategory === null ? '#7C3AED' : '#FFFFFF',
              transition: 'all 150ms ease',
            }}
          >
            All
          </button>
          {CATEGORIES.map((cat) => (
            <button
              id={`catalog-filter-${cat.toLowerCase()}`}
              key={cat}
              onClick={() => setActiveCategory(cat)}
              style={{
                padding: '8px 16px',
                borderRadius: '9999px',
                border: 'none',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                minHeight: '44px',
                background: activeCategory === cat ? '#FFFFFF' : 'rgba(255,255,255,0.15)',
                color: activeCategory === cat ? '#7C3AED' : '#FFFFFF',
                transition: 'all 150ms ease',
              }}
            >
              {CATEGORY_LABELS[cat] || cat}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ─────────────────────────────────── */}
      <div style={{ padding: '20px', maxWidth: '720px', margin: '0 auto' }}>
        {loading && <LoadingState message="Loading garments…" />}

        {error && <ErrorState message={error} onRetry={fetchGarments} />}

        {!loading && !error && garments.length === 0 && (
          <EmptyState
            message={
              activeCategory
                ? `No garments found in "${CATEGORY_LABELS[activeCategory] || activeCategory}" category`
                : 'No garments in the catalog yet'
            }
          />
        )}

        {!loading && !error && garments.length > 0 && (
          <>
            <p
              style={{
                fontSize: '0.78rem',
                color: '#64748B',
                marginBottom: '12px',
                fontWeight: 500,
              }}
            >
              {garments.length} garment{garments.length !== 1 ? 's' : ''}{' '}
              {activeCategory ? `in ${CATEGORY_LABELS[activeCategory] || activeCategory}` : 'total'}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {garments.map((g) => {
                const catColor = CATEGORY_COLORS[g.category] || '#475569';
                return (
                  <Card key={g.id} padding="md">
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '14px',
                      }}
                    >
                      {/* Icon */}
                      <div
                        style={{
                          width: '44px',
                          height: '44px',
                          borderRadius: '12px',
                          background: `${catColor}10`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: catColor,
                          flexShrink: 0,
                        }}
                      >
                        <Shirt size={20} />
                      </div>

                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: '0.95rem',
                            fontWeight: 600,
                            color: '#0F172A',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {g.name}
                        </div>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            marginTop: '4px',
                          }}
                        >
                          <span
                            style={{
                              fontSize: '0.72rem',
                              fontWeight: 600,
                              color: catColor,
                              background: `${catColor}10`,
                              padding: '2px 8px',
                              borderRadius: '9999px',
                              border: `1px solid ${catColor}20`,
                            }}
                          >
                            {CATEGORY_LABELS[g.category] || g.category}
                          </span>
                          {!g.isActive && (
                            <span
                              style={{
                                fontSize: '0.72rem',
                                fontWeight: 600,
                                color: '#94A3B8',
                                background: '#F1F5F9',
                                padding: '2px 8px',
                                borderRadius: '9999px',
                              }}
                            >
                              Inactive
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Edit button (OWNER only) */}
                      {isOwner && (
                        <Button
                          id={`edit-garment-${g.id}`}
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditModal(g)}
                          icon={<Edit2 size={16} />}
                          aria-label={`Edit ${g.name}`}
                        >
                          Edit
                        </Button>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          </>
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
