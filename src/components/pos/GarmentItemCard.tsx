import React from 'react';
import { GarmentDefinition } from '../../types';
import { 
  Shirt, 
  Sparkles, 
  Scroll, 
  Columns2, 
  Layers, 
  User, 
  Briefcase, 
  Award, 
  Crown, 
  Sparkle, 
  BedDouble, 
  Bed, 
  Scale, 
  Columns3, 
  Footprints, 
  Shield, 
  ShieldCheck 
} from 'lucide-react';

interface GarmentItemCardProps {
  garment: GarmentDefinition;
  onClick: (garment: GarmentDefinition) => void;
}

const iconMap: Record<string, any> = {
  Shirt,
  Sparkles,
  Scroll,
  Columns2,
  Layers,
  User,
  Briefcase,
  Award,
  Crown,
  Sparkle,
  BedDouble,
  Bed,
  Scale,
  Columns3,
  Footprints,
  Shield,
  ShieldCheck
};

export const GarmentItemCard: React.FC<GarmentItemCardProps> = ({ garment, onClick }) => {
  const IconComponent = iconMap[garment.icon] || Shirt;
  const lowestPrice = Math.min(...garment.baseServices.map(s => s.price));
  const isWeightBased = garment.baseServices.some(s => s.isWeightBased);

  return (
    <div 
      className="garment-card" 
      onClick={() => onClick(garment)}
      title={`Configure ${garment.name}`}
    >
      {garment.frequentlyUsed && <span className="garment-badge-freq" title="Frequently Ordered" />}
      <div className="garment-icon-wrapper">
        <IconComponent size={26} />
      </div>
      <div className="garment-card-name">{garment.name}</div>
      <div className="garment-card-price-preview">
        From ₹{lowestPrice}{isWeightBased ? '/kg' : ''}
      </div>
    </div>
  );
};
