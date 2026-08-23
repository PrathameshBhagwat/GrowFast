export type UserRole = 'counter' | 'manager' | 'processing' | 'rider';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar: string;
  branch: string;
}

export type GarmentCategory = 'men' | 'women' | 'kids' | 'household' | 'shoes' | 'special';

export type ServiceType = 
  | 'dry_clean' 
  | 'steam_press' 
  | 'wash' 
  | 'wash_iron' 
  | 'shoe_clean' 
  | 'leather_clean' 
  | 'stain_removal' 
  | 'carpet_clean' 
  | 'curtain_clean'
  | 'weight_based';

export interface ServiceDefinition {
  id: ServiceType;
  name: string;
  shortName: string;
  description: string;
  estimatedDays: number;
  icon: string;
}

export interface GarmentServicePrice {
  service: ServiceType;
  price: number;
  isWeightBased?: boolean;
  unit?: string; // e.g. 'kg', 'pair', 'pc'
}

export interface GarmentDefinition {
  id: string;
  name: string;
  category: GarmentCategory;
  icon: string; // Lucide icon identifier
  baseServices: GarmentServicePrice[];
  frequentlyUsed?: boolean;
  standardFabrics?: string[];
  standardColors?: string[];
}

export type DamageType = 
  | 'tear' 
  | 'stain' 
  | 'fading' 
  | 'missing_button' 
  | 'burn' 
  | 'color_bleed' 
  | 'loose_thread' 
  | 'other';

export interface GarmentDamage {
  id: string;
  type: DamageType;
  location?: string;
  description: string;
  photoUrl?: string;
  severity: 'low' | 'medium' | 'high';
}

export type ProcessingStage = 
  | 'received' 
  | 'sorting' 
  | 'processing' 
  | 'drying' 
  | 'ironing' 
  | 'quality_check' 
  | 'packed' 
  | 'ready' 
  | 'out_for_delivery' 
  | 'delivered';

export interface IndividualGarmentTag {
  garmentTag: string; // e.g. "GAR-8721-01"
  garmentName: string;
  service: ServiceType;
  color?: string;
  fabric?: string;
  stage: ProcessingStage;
  rackLocation?: string; // e.g. "R-12-B"
  bagId?: string; // e.g. "BAG-8721"
  qcStatus?: 'pending' | 'passed' | 'rework' | 'issue';
  qcNotes?: string;
  qcIssueReason?: string;
  reworkCount?: number;
  stains?: string[];
  damages?: GarmentDamage[];
  photoUrls?: string[];
}

export interface OrderItemPhoto {
  id: string;
  type: 'front' | 'back' | 'damage' | 'stain' | 'tag';
  url: string;
  timestamp: string;
}

export interface OrderItem {
  id: string;
  garmentId: string;
  garmentName: string;
  category: GarmentCategory;
  service: ServiceType;
  serviceName: string;
  quantity: number;
  weightKg?: number;
  unitPrice: number;
  totalPrice: number;
  color?: string;
  fabric?: string;
  brand?: string;
  stains?: string[];
  damages?: GarmentDamage[];
  specialInstructions?: string;
  expressService?: boolean;
  photos?: OrderItemPhoto[];
  individualGarments: IndividualGarmentTag[];
}

export type PaymentStatus = 'paid' | 'partial' | 'pending';
export type PaymentMethod = 'cash' | 'upi' | 'card' | 'online' | 'store_credit';

export interface PaymentRecord {
  id: string;
  amount: number;
  method: PaymentMethod;
  timestamp: string;
  reference?: string;
  recordedBy: string;
}

export interface Order {
  id: string;
  orderNumber: string; // e.g. "ORD-8721"
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerAddress?: string;
  createdAt: string;
  promisedDeliveryDate: string;
  items: OrderItem[];
  itemCount: number;
  subtotal: number;
  discountAmount: number;
  discountType?: 'flat' | 'percentage';
  expressSurcharge: number;
  taxAmount: number;
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  paymentStatus: PaymentStatus;
  paymentMethod?: PaymentMethod;
  paymentHistory: PaymentRecord[];
  overallStage: ProcessingStage;
  rackLocation?: string;
  bagId?: string;
  notes?: string;
  isDelayed?: boolean;
  priority: 'standard' | 'express' | 'vip';
  deliveryType: 'store_pickup' | 'home_delivery';
  deliveryAddress?: string;
}

export interface CustomerPreference {
  fragrance: 'none' | 'light' | 'standard' | 'premium';
  starch: 'none' | 'light' | 'medium' | 'heavy';
  foldPreference: 'hanger' | 'folded' | 'boxed';
  deliverySlot?: string;
  specialNotes?: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  alternatePhone?: string;
  email?: string;
  address?: string;
  landmark?: string;
  gstNumber?: string;
  customerSince: string;
  totalOrders: number;
  totalSpend: number;
  averageOrderValue: number;
  pendingBalance: number;
  preferences: CustomerPreference;
  recentOrderIds: string[];
  tags: string[]; // e.g. ['VIP', 'Corporate', 'Repeat']
  frequentItems?: { garmentName: string; service: string; count: number }[];
}

export type ExpenseCategory = 
  | 'rent' 
  | 'electricity' 
  | 'water' 
  | 'detergent' 
  | 'packaging' 
  | 'transport' 
  | 'salary' 
  | 'maintenance' 
  | 'equipment' 
  | 'other';

export interface ExpenseItem {
  id: string;
  date: string;
  category: ExpenseCategory;
  description: string;
  amount: number;
  paymentMethod: 'cash' | 'upi' | 'bank_transfer' | 'card';
  recordedBy: string;
  receiptUrl?: string;
}

export type InventoryCategory = 
  | 'detergents' 
  | 'packaging' 
  | 'hangers' 
  | 'tags' 
  | 'chemicals' 
  | 'other';

export interface InventoryItem {
  id: string;
  name: string;
  category: InventoryCategory;
  currentStock: number;
  unit: string;
  lowStockThreshold: number;
  costPerUnit: number;
  supplier: string;
  lastRestocked: string;
  reorderQuantity: number;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: 'delayed_order' | 'low_stock' | 'pending_payment' | 'qc_issue' | 'delivery_due' | 'system';
  timestamp: string;
  read: boolean;
  actionView?: string;
  entityId?: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  staffName: string;
  staffRole: UserRole;
  action: string;
  orderNumber?: string;
  garmentTag?: string;
  details: string;
}

export interface DeliveryTask {
  id: string;
  type: 'pickup' | 'delivery';
  orderId?: string;
  orderNumber?: string;
  customerName: string;
  customerPhone: string;
  address: string;
  scheduledTime: string;
  status: 'scheduled' | 'assigned' | 'in_transit' | 'completed' | 'failed';
  assignedRider?: string;
  amountToCollect?: number;
  itemCount?: number;
  notes?: string;
}
