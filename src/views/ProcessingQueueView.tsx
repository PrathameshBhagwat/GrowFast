import React, { useState } from 'react';
import { useStore } from '../store';
import { GarmentProcessingCard } from '../components/processing/GarmentProcessingCard';
import { QCHandlerModal } from '../components/processing/QCHandlerModal';
import { IndividualGarmentTag, ProcessingStage, ServiceType } from '../types';
import { 
  Sparkles, 
  Filter, 
  Scan, 
  Layers, 
  CheckSquare, 
  Package, 
  Flame, 
  Droplets,
  Search
} from 'lucide-react';
import { QRScannerModal } from '../components/common/QRScannerModal';

export const ProcessingQueueView: React.FC = () => {
  const { orders, updateGarmentStatus, recordQCResult, setSelectedGarmentTag, setActiveView } = useStore();
  
  const [serviceFilter, setServiceFilter] = useState<string>('all');
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [searchTag, setSearchTag] = useState<string>('');
  const [selectedQCQCgarment, setSelectedQCQCgarment] = useState<IndividualGarmentTag | null>(null);
  const [isQRScannerOpen, setIsQRScannerOpen] = useState<boolean>(false);

  // Extract all individual garments across all active orders
  const allGarments = orders.flatMap(o => 
    o.items.flatMap(i => 
      i.individualGarments.map(g => ({
        ...g,
        orderNumber: o.orderNumber,
        customerName: o.customerName,
        priority: o.priority,
        specialInstructions: i.specialInstructions
      }))
    )
  );

  const filteredGarments = allGarments.filter(g => {
    const matchesService = serviceFilter === 'all' || g.service === serviceFilter;
    const matchesStage = stageFilter === 'all' || g.stage === stageFilter;
    const matchesSearch = searchTag.trim() === '' || 
      g.garmentTag.toLowerCase().includes(searchTag.toLowerCase()) ||
      g.garmentName.toLowerCase().includes(searchTag.toLowerCase()) ||
      g.customerName?.toLowerCase().includes(searchTag.toLowerCase());

    return matchesService && matchesStage && matchesSearch;
  });

  const stages: { key: ProcessingStage; label: string; icon: any }[] = [
    { key: 'received', label: 'Received (Intake)', icon: Layers },
    { key: 'processing', label: 'In Wash / Solvents', icon: Droplets },
    { key: 'drying', label: 'Tumble Drying', icon: Flame },
    { key: 'ironing', label: 'Vacuum Steam Press', icon: Flame },
    { key: 'quality_check', label: 'Quality Inspection', icon: CheckSquare },
    { key: 'packed', label: 'Packed & Bagged', icon: Package },
    { key: 'ready', label: 'Ready for Pickup', icon: Sparkles }
  ];

  const handleScanResult = (result: string) => {
    if (result.toUpperCase().startsWith('GAR-')) {
      setSelectedGarmentTag(result.toUpperCase());
      setActiveView('garment-tracking');
    } else {
      setSearchTag(result);
    }
  };

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div className="page-title-group">
          <h1 className="page-title">Processing & Workshop Pipeline</h1>
          <p className="page-subtitle">
            Live garment stage progression from wash to quality check & packing
          </p>
        </div>
        <div className="page-actions">
          <button className="btn btn-secondary" onClick={() => setIsQRScannerOpen(true)}>
            <Scan size={16} /> Scan Garment Tag
          </button>
        </div>
      </div>

      {/* Stage Summary Metric Pills */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.65rem', marginBottom: '1.25rem' }}>
        {stages.map(s => {
          const count = allGarments.filter(g => g.stage === s.key).length;
          const isSelected = stageFilter === s.key;
          return (
            <div
              key={s.key}
              onClick={() => setStageFilter(isSelected ? 'all' : s.key)}
              style={{
                backgroundColor: isSelected ? 'var(--primary-600)' : '#FFFFFF',
                color: isSelected ? '#FFFFFF' : 'var(--slate-800)',
                border: '1px solid',
                borderColor: isSelected ? 'var(--primary-700)' : 'var(--border-color)',
                borderRadius: 'var(--radius-md)',
                padding: '0.75rem',
                cursor: 'pointer',
                transition: 'all var(--transition-fast)',
                boxShadow: isSelected ? '0 2px 8px rgba(37,99,235,0.25)' : 'var(--shadow-xs)'
              }}
            >
              <div style={{ fontSize: '10.5px', textTransform: 'uppercase', fontWeight: 700, opacity: isSelected ? 0.9 : 0.6, marginBottom: '2px' }}>
                {s.label.split(' ')[0]}
              </div>
              <div style={{ fontSize: 'var(--text-xl)', fontWeight: 800, fontFamily: 'var(--font-mono)' }}>
                {count}
              </div>
            </div>
          );
        })}
      </div>

      {/* Filter & Search Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        <div className="tabs-nav" style={{ border: 'none', padding: 0 }}>
          <button 
            className={`tab-btn ${serviceFilter === 'all' ? 'active' : ''}`}
            onClick={() => setServiceFilter('all')}
          >
            All Services ({allGarments.length})
          </button>
          <button 
            className={`tab-btn ${serviceFilter === 'dry_clean' ? 'active' : ''}`}
            onClick={() => setServiceFilter('dry_clean')}
          >
            Dry Cleaning
          </button>
          <button 
            className={`tab-btn ${serviceFilter === 'wash' || serviceFilter === 'wash_iron' ? 'active' : ''}`}
            onClick={() => setServiceFilter('wash')}
          >
            Washing & Iron
          </button>
          <button 
            className={`tab-btn ${serviceFilter === 'steam_press' ? 'active' : ''}`}
            onClick={() => setServiceFilter('steam_press')}
          >
            Steam Press
          </button>
          <button 
            className={`tab-btn ${serviceFilter === 'shoe_clean' ? 'active' : ''}`}
            onClick={() => setServiceFilter('shoe_clean')}
          >
            Shoe Spa
          </button>
        </div>

        <div style={{ position: 'relative', width: '260px' }}>
          <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--slate-400)' }} />
          <input
            type="text"
            className="form-input"
            style={{ paddingLeft: '2.2rem', fontSize: 'var(--text-xs)' }}
            placeholder="Search Garment Tag (e.g. GAR-8721)..."
            value={searchTag}
            onChange={(e) => setSearchTag(e.target.value)}
          />
        </div>
      </div>

      {/* Grid of Garment Processing Cards */}
      {filteredGarments.length === 0 ? (
        <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--slate-400)' }}>
          No garments currently match the selected stage & service filters.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
          {filteredGarments.map(g => (
            <GarmentProcessingCard
              key={g.garmentTag}
              garment={g}
              onAdvanceStage={updateGarmentStatus}
              onOpenQC={(garment) => setSelectedQCQCgarment(garment)}
            />
          ))}
        </div>
      )}

      {/* QC Modal */}
      <QCHandlerModal
        isOpen={!!selectedQCQCgarment}
        onClose={() => setSelectedQCQCgarment(null)}
        garment={selectedQCQCgarment}
        onQCSubmit={recordQCResult}
      />

      {/* Optical Scanner Modal */}
      <QRScannerModal
        isOpen={isQRScannerOpen}
        onClose={() => setIsQRScannerOpen(false)}
        onScanResult={handleScanResult}
      />
    </div>
  );
};
