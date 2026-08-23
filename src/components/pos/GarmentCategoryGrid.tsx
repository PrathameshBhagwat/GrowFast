import React, { useState } from 'react';
import { GarmentCategory, GarmentDefinition } from '../../types';
import { GarmentItemCard } from './GarmentItemCard';
import { useStore } from '../../store';
import { 
  Sparkles, 
  User, 
  Heart, 
  Home, 
  Footprints, 
  ShieldCheck, 
  Search,
  Zap
} from 'lucide-react';

interface GarmentCategoryGridProps {
  onSelectGarment: (garment: GarmentDefinition) => void;
}

export const GarmentCategoryGrid: React.FC<GarmentCategoryGridProps> = ({ onSelectGarment }) => {
  const { garments } = useStore();
  const [activeCategory, setActiveCategory] = useState<string>('frequent');
  const [localSearch, setLocalSearch] = useState<string>('');

  const categories = [
    { id: 'frequent', label: 'Frequently Used', icon: Zap },
    { id: 'men', label: 'Men', icon: User },
    { id: 'women', label: 'Women', icon: Heart },
    { id: 'household', label: 'Household', icon: Home },
    { id: 'shoes', label: 'Shoes', icon: Footprints },
    { id: 'special', label: 'Special Care', icon: ShieldCheck }
  ];

  // Filtering
  const filteredGarments = garments.filter(g => {
    const matchesSearch = localSearch.trim() === '' || 
      g.name.toLowerCase().includes(localSearch.toLowerCase());

    if (!matchesSearch) return false;

    if (activeCategory === 'frequent') {
      return g.frequentlyUsed;
    }
    return g.category === activeCategory;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Category Pills & Local Filter */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '0.85rem' }}>
        <div className="pos-category-bar" style={{ margin: 0 }}>
          {categories.map(cat => {
            const Icon = cat.icon;
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                className={`category-pill ${isActive ? 'active' : ''}`}
                onClick={() => setActiveCategory(cat.id)}
              >
                <Icon size={14} />
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>

        {/* Local Garment Search */}
        <div style={{ position: 'relative', width: '220px', flexShrink: 0 }}>
          <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--slate-400)' }} />
          <input
            type="text"
            className="form-input"
            style={{ padding: '0.4rem 0.65rem 0.4rem 2rem', fontSize: 'var(--text-xs)', borderRadius: 'var(--radius-full)' }}
            placeholder="Filter garments..."
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Grid of Garments */}
      <div className="pos-garment-scroll-area">
        {filteredGarments.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--slate-400)' }}>
            No garments found in this category matching "{localSearch}".
          </div>
        ) : (
          <div className="garment-grid">
            {filteredGarments.map(garment => (
              <GarmentItemCard
                key={garment.id}
                garment={garment}
                onClick={onSelectGarment}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
