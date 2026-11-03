import React, { useState, useRef, useEffect } from 'react';
import { useBranch, ALL_BRANCHES_ID } from '../contexts/BranchContext';
import { Store, Globe, ChevronDown, Check, Building2 } from 'lucide-react';

interface BranchSelectorProps {
  className?: string;
  variant?: 'header' | 'compact';
}

export const BranchSelector: React.FC<BranchSelectorProps> = ({ variant = 'header' }) => {
  const {
    branches,
    activeBranchId,
    activeBranch,
    isAllBranches,
    canSwitchBranch,
    setActiveBranchId,
  } = useBranch();

  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const activeLabel = isAllBranches ? 'All Branches' : activeBranch?.name || 'Loading Branch...';

  const activeSublabel = isAllBranches
    ? 'Consolidated View'
    : activeBranch?.code
      ? `Code: ${activeBranch.code}`
      : undefined;

  // Non-owner staff (COUNTER, DELIVERY, MANAGER): read-only assigned branch pill
  if (!canSwitchBranch) {
    return (
      <div
        id="branch-selector-readonly"
        title="Assigned Branch (Staff)"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          background: 'var(--bg-surface-elevated, #F8FAFC)',
          border: '1px solid var(--border, #E2E8F0)',
          borderRadius: '9999px',
          padding: '6px 14px',
          fontSize: '0.85rem',
          fontWeight: 600,
          color: 'var(--text-primary, #0F172A)',
          minHeight: '40px',
        }}
      >
        <Store size={16} color="#059669" />
        <span>{activeLabel}</span>
        {activeBranch?.code && (
          <span
            style={{
              fontSize: '0.7rem',
              color: 'var(--text-muted, #64748B)',
              background: 'var(--bg-surface-muted, #E2E8F0)',
              padding: '1px 6px',
              borderRadius: '4px',
            }}
          >
            {activeBranch.code}
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{ position: 'relative', display: 'inline-block' }}
      className="branch-selector-wrapper"
    >
      <button
        type="button"
        id="branch-selector-btn"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={`Switch active branch, currently ${activeLabel}`}
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          background: isAllBranches ? 'rgba(124, 58, 237, 0.08)' : 'var(--bg-surface, #FFFFFF)',
          border: isAllBranches
            ? '1.5px solid rgba(124, 58, 237, 0.35)'
            : '1px solid var(--border, #CBD5E1)',
          borderRadius: variant === 'compact' ? '8px' : '9999px',
          padding: '6px 14px',
          fontSize: '0.875rem',
          fontWeight: 600,
          color: isAllBranches ? '#7C3AED' : 'var(--text-primary, #0F172A)',
          boxShadow: 'var(--shadow-neu-card-sm, 0 1px 3px rgba(0,0,0,0.05))',
          cursor: 'pointer',
          minHeight: '44px',
          transition: 'all 0.15s ease',
        }}
      >
        {isAllBranches ? (
          <Globe size={18} color="#7C3AED" style={{ flexShrink: 0 }} />
        ) : (
          <Store size={18} color="#2563EB" style={{ flexShrink: 0 }} />
        )}
        <div style={{ textAlign: 'left', lineHeight: 1.2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>{activeLabel}</span>
            {isAllBranches && (
              <span
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  background: '#7C3AED',
                  color: '#FFFFFF',
                  padding: '1px 5px',
                  borderRadius: '4px',
                  letterSpacing: '0.04em',
                }}
              >
                All
              </span>
            )}
          </div>
          {activeSublabel && (
            <div
              style={{
                fontSize: '0.7rem',
                fontWeight: 500,
                color: isAllBranches ? '#9333EA' : 'var(--text-muted, #64748B)',
              }}
            >
              {activeSublabel}
            </div>
          )}
        </div>
        <ChevronDown
          size={16}
          color={isAllBranches ? '#7C3AED' : 'var(--text-muted, #64748B)'}
          style={{
            transform: isOpen ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.2s ease',
            marginLeft: '4px',
            flexShrink: 0,
          }}
        />
      </button>

      {isOpen && (
        <div
          role="listbox"
          aria-label="Select active branch"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            zIndex: 1000,
            minWidth: '260px',
            background: 'var(--bg-surface, #FFFFFF)',
            border: '1px solid var(--border, #E2E8F0)',
            borderRadius: '12px',
            padding: '8px',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
            animation: 'fadeIn 0.15s ease-out',
          }}
        >
          <div
            style={{
              padding: '6px 10px',
              fontSize: '0.725rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'var(--text-muted, #64748B)',
            }}
          >
            Switch Active Branch
          </div>

          {/* Option: All Branches (Consolidated) */}
          <button
            type="button"
            role="option"
            aria-label="Select all branches"
            aria-selected={isAllBranches}
            onClick={() => {
              setActiveBranchId(ALL_BRANCHES_ID);
              setIsOpen(false);
            }}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 12px',
              borderRadius: '8px',
              border: 'none',
              background: isAllBranches ? 'rgba(124, 58, 237, 0.1)' : 'transparent',
              color: isAllBranches ? '#7C3AED' : 'var(--text-primary, #0F172A)',
              cursor: 'pointer',
              textAlign: 'left',
              minHeight: '44px',
              transition: 'background-color 0.12s ease',
            }}
            className="hover:bg-purple-50 dark:hover:bg-purple-950/30"
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: isAllBranches ? '#7C3AED' : 'rgba(124, 58, 237, 0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Globe size={18} color={isAllBranches ? '#FFFFFF' : '#7C3AED'} />
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>All Branches</div>
                <div style={{ fontSize: '0.725rem', color: 'var(--text-muted, #64748B)' }}>
                  Consolidated multi-store view
                </div>
              </div>
            </div>
            {isAllBranches && <Check size={18} color="#7C3AED" />}
          </button>

          <div
            style={{
              height: '1px',
              background: 'var(--border, #E2E8F0)',
              margin: '6px 4px',
            }}
          />

          {/* Individual Branches (Charholi, Alephata) */}
          {branches.map((branch) => {
            const isSelected = activeBranchId === branch.id;
            return (
              <button
                key={branch.id}
                type="button"
                role="option"
                aria-label={`Select branch: ${branch.name}`}
                aria-selected={isSelected}
                onClick={() => {
                  setActiveBranchId(branch.id);
                  setIsOpen(false);
                }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: 'none',
                  background: isSelected ? 'rgba(37, 99, 235, 0.08)' : 'transparent',
                  color: isSelected ? '#2563EB' : 'var(--text-primary, #0F172A)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  minHeight: '44px',
                  transition: 'background-color 0.12s ease',
                }}
                className="hover:bg-blue-50 dark:hover:bg-slate-800"
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      background: isSelected ? '#2563EB' : 'var(--bg-surface-elevated, #F1F5F9)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Building2 size={18} color={isSelected ? '#FFFFFF' : '#64748B'} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{branch.name}</div>
                    <div style={{ fontSize: '0.725rem', color: 'var(--text-muted, #64748B)' }}>
                      {branch.code || branch.id}
                    </div>
                  </div>
                </div>
                {isSelected && <Check size={18} color="#2563EB" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
