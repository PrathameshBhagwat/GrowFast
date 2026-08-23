import { 
  Customer, 
  GarmentDefinition, 
  Order, 
  ServiceDefinition, 
  InventoryItem, 
  ExpenseItem, 
  NotificationItem, 
  AuditLog, 
  DeliveryTask,
  User 
} from '../types';

export const mockUsers: Record<string, User> = {
  counter: {
    id: 'usr-1',
    name: 'Swapnil Shinde',
    email: 'swapnil@tumbledry.in',
    role: 'counter',
    avatar: 'SS',
    branch: 'Koregaon Park Branch, Pune'
  },
  manager: {
    id: 'usr-2',
    name: 'Rajesh Nair',
    email: 'rajesh.mgr@tumbledry.in',
    role: 'manager',
    avatar: 'RN',
    branch: 'Koregaon Park Branch, Pune'
  },
  processing: {
    id: 'usr-3',
    name: 'Ganesh Jadhav',
    email: 'ganesh.ops@tumbledry.in',
    role: 'processing',
    avatar: 'GJ',
    branch: 'Koregaon Park Central Unit'
  },
  rider: {
    id: 'usr-4',
    name: 'Kiran More',
    email: 'kiran.delivery@tumbledry.in',
    role: 'rider',
    avatar: 'KM',
    branch: 'Koregaon Park Fleet'
  }
};

export const mockServices: ServiceDefinition[] = [
  { id: 'dry_clean', name: 'Dry Cleaning', shortName: 'Dry Clean', description: 'Hydrocarbon solvent wash with gentle steam press', estimatedDays: 2, icon: 'Sparkles' },
  { id: 'steam_press', name: 'Steam Pressing', shortName: 'Steam Press', description: 'Crisp industrial vacuum steam iron with wrinkle guard', estimatedDays: 1, icon: 'Flame' },
  { id: 'wash', name: 'Standard Wash', shortName: 'Wash', description: 'Enzyme-rich deep wash and tumble dry', estimatedDays: 2, icon: 'Droplets' },
  { id: 'wash_iron', name: 'Wash + Steam Iron', shortName: 'Wash + Iron', description: 'Complete wash cycle followed by crisp steam pressing', estimatedDays: 2, icon: 'Shirt' },
  { id: 'shoe_clean', name: 'Premium Shoe Spa', shortName: 'Shoe Clean', description: 'Deep fabric/leather brush, odor deodorizer, and sole whitening', estimatedDays: 3, icon: 'Footprints' },
  { id: 'leather_clean', name: 'Leather & Suede Spa', shortName: 'Leather Care', description: 'Specialized conditioning, dye revitalization, and buffing', estimatedDays: 4, icon: 'Shield' },
  { id: 'stain_removal', name: 'Targeted Spotting', shortName: 'Stain Removal', description: 'Ultrasonic chemical spotting gun treatment', estimatedDays: 2, icon: 'Target' },
  { id: 'weight_based', name: 'Laundry by Weight (Per Kg)', shortName: 'Per Kg Wash', description: 'Bulk washing & tumble drying priced strictly per kilogram', estimatedDays: 2, icon: 'Scale' }
];

export const mockGarments: GarmentDefinition[] = [
  // MEN
  {
    id: 'men-shirt',
    name: 'Shirt',
    category: 'men',
    icon: 'Shirt',
    frequentlyUsed: true,
    standardFabrics: ['Cotton', 'Linen', 'Silk', 'Polyester', 'Blended'],
    standardColors: ['White', 'Light Blue', 'Navy', 'Black', 'Striped', 'Checkered'],
    baseServices: [
      { service: 'dry_clean', price: 80 },
      { service: 'steam_press', price: 20 },
      { service: 'wash', price: 30 },
      { service: 'wash_iron', price: 45 },
      { service: 'stain_removal', price: 100 }
    ]
  },
  {
    id: 'men-tshirt',
    name: 'T-Shirt / Polo',
    category: 'men',
    icon: 'Shirt',
    frequentlyUsed: true,
    standardFabrics: ['Cotton', 'Dry-Fit', 'Modal', 'Pique'],
    standardColors: ['White', 'Black', 'Grey', 'Navy', 'Red', 'Multi'],
    baseServices: [
      { service: 'dry_clean', price: 70 },
      { service: 'steam_press', price: 15 },
      { service: 'wash', price: 25 },
      { service: 'wash_iron', price: 35 }
    ]
  },
  {
    id: 'men-trouser',
    name: 'Trouser / Pant',
    category: 'men',
    icon: 'Columns2',
    frequentlyUsed: true,
    standardFabrics: ['Cotton', 'Woolen', 'Polyester', 'Linen'],
    standardColors: ['Black', 'Khaki', 'Navy', 'Grey', 'Brown'],
    baseServices: [
      { service: 'dry_clean', price: 90 },
      { service: 'steam_press', price: 25 },
      { service: 'wash', price: 35 },
      { service: 'wash_iron', price: 55 }
    ]
  },
  {
    id: 'men-jeans',
    name: 'Jeans / Denim',
    category: 'men',
    icon: 'Layers',
    frequentlyUsed: true,
    standardFabrics: ['Denim', 'Stretch Denim'],
    standardColors: ['Dark Blue', 'Light Blue', 'Black', 'Grey'],
    baseServices: [
      { service: 'dry_clean', price: 100 },
      { service: 'steam_press', price: 25 },
      { service: 'wash', price: 40 },
      { service: 'wash_iron', price: 60 }
    ]
  },
  {
    id: 'men-kurta',
    name: 'Kurta (Men)',
    category: 'men',
    icon: 'User',
    frequentlyUsed: true,
    standardFabrics: ['Cotton', 'Silk', 'Linen', 'Chikankari'],
    standardColors: ['White', 'Cream', 'Maroon', 'Yellow', 'Blue'],
    baseServices: [
      { service: 'dry_clean', price: 110 },
      { service: 'steam_press', price: 30 },
      { service: 'wash', price: 45 },
      { service: 'wash_iron', price: 70 }
    ]
  },
  {
    id: 'men-suit-2pc',
    name: 'Suit (2 Piece)',
    category: 'men',
    icon: 'Briefcase',
    frequentlyUsed: false,
    standardFabrics: ['Pure Wool', 'Terry Wool', 'Poly Blend', 'Velvet'],
    standardColors: ['Navy', 'Charcoal', 'Black', 'Pinstripe'],
    baseServices: [
      { service: 'dry_clean', price: 320 },
      { service: 'steam_press', price: 90 }
    ]
  },
  {
    id: 'men-blazer',
    name: 'Blazer / Coat',
    category: 'men',
    icon: 'Award',
    frequentlyUsed: false,
    standardFabrics: ['Wool', 'Tweed', 'Corduroy', 'Linen'],
    standardColors: ['Black', 'Navy', 'Brown', 'Beige'],
    baseServices: [
      { service: 'dry_clean', price: 200 },
      { service: 'steam_press', price: 60 }
    ]
  },

  // WOMEN
  {
    id: 'women-dress',
    name: 'Women Dress / Gown',
    category: 'women',
    icon: 'Sparkles',
    frequentlyUsed: true,
    standardFabrics: ['Silk', 'Georgette', 'Chiffon', 'Cotton', 'Satin'],
    standardColors: ['Black', 'Red', 'Floral', 'Pastel', 'Emerald'],
    baseServices: [
      { service: 'dry_clean', price: 180 },
      { service: 'steam_press', price: 50 },
      { service: 'wash_iron', price: 90 }
    ]
  },
  {
    id: 'women-saree',
    name: 'Saree (Standard)',
    category: 'women',
    icon: 'Scroll',
    frequentlyUsed: true,
    standardFabrics: ['Silk', 'Georgette', 'Cotton', 'Chiffon', 'Banarasi', 'Kanjivaram'],
    standardColors: ['Red', 'Pink', 'Green', 'Gold', 'Royal Blue'],
    baseServices: [
      { service: 'dry_clean', price: 150 },
      { service: 'steam_press', price: 45 },
      { service: 'wash_iron', price: 80 }
    ]
  },
  {
    id: 'women-heavy-saree',
    name: 'Heavy / Zari Saree',
    category: 'women',
    icon: 'Crown',
    frequentlyUsed: false,
    standardFabrics: ['Pure Silk Zari', 'Bridal Velvet', 'Designer Stone Work'],
    standardColors: ['Maroon', 'Crimson', 'Gold', 'Magenta'],
    baseServices: [
      { service: 'dry_clean', price: 280 },
      { service: 'steam_press', price: 70 }
    ]
  },
  {
    id: 'women-salwar-suit',
    name: 'Salwar Suit (3 Pc)',
    category: 'women',
    icon: 'Layers',
    frequentlyUsed: true,
    standardFabrics: ['Cotton', 'Silk', 'Chanderi', 'Georgette'],
    standardColors: ['Printed', 'Pastel', 'Yellow', 'Teal'],
    baseServices: [
      { service: 'dry_clean', price: 160 },
      { service: 'steam_press', price: 40 },
      { service: 'wash_iron', price: 75 }
    ]
  },
  {
    id: 'women-lehenga',
    name: 'Lehenga (Bridal / Party)',
    category: 'women',
    icon: 'Sparkle',
    frequentlyUsed: false,
    standardFabrics: ['Raw Silk', 'Velvet', 'Net', 'Organza'],
    standardColors: ['Red', 'Maroon', 'Champagne', 'Pink'],
    baseServices: [
      { service: 'dry_clean', price: 450 },
      { service: 'steam_press', price: 120 }
    ]
  },

  // HOUSEHOLD
  {
    id: 'house-bedsheet-single',
    name: 'Bedsheet (Single)',
    category: 'household',
    icon: 'BedDouble',
    frequentlyUsed: true,
    standardFabrics: ['Cotton', 'Microfiber', 'Satin'],
    standardColors: ['White', 'Printed', 'Floral', 'Blue'],
    baseServices: [
      { service: 'wash', price: 70 },
      { service: 'wash_iron', price: 90 },
      { service: 'dry_clean', price: 110 }
    ]
  },
  {
    id: 'house-bedsheet-double',
    name: 'Bedsheet (Double / King)',
    category: 'household',
    icon: 'Bed',
    frequentlyUsed: true,
    standardFabrics: ['Cotton', 'Egyptian Cotton', 'Percale'],
    standardColors: ['White', 'Grey', 'Printed', 'Beige'],
    baseServices: [
      { service: 'wash', price: 90 },
      { service: 'wash_iron', price: 120 },
      { service: 'dry_clean', price: 150 }
    ]
  },
  {
    id: 'house-blanket-kg',
    name: 'Blanket / Quilt (Weight Based)',
    category: 'household',
    icon: 'Scale',
    frequentlyUsed: true,
    standardFabrics: ['Mink', 'Fleece', 'Wool', 'Cotton Quilt'],
    standardColors: ['Maroon', 'Navy', 'Brown', 'Multi'],
    baseServices: [
      { service: 'weight_based', price: 50, isWeightBased: true, unit: 'kg' },
      { service: 'dry_clean', price: 250 }
    ]
  },
  {
    id: 'house-curtains-kg',
    name: 'Curtains (Per Kg / Panel)',
    category: 'household',
    icon: 'Columns3',
    frequentlyUsed: false,
    standardFabrics: ['Blackout', 'Sheer', 'Velvet', 'Jacquard'],
    standardColors: ['Beige', 'Grey', 'Navy', 'Gold'],
    baseServices: [
      { service: 'weight_based', price: 60, isWeightBased: true, unit: 'kg' },
      { service: 'dry_clean', price: 140 }
    ]
  },

  // SHOES & SPECIAL
  {
    id: 'shoe-sneakers',
    name: 'Sneakers / Sports Shoes',
    category: 'shoes',
    icon: 'Footprints',
    frequentlyUsed: true,
    standardFabrics: ['Mesh', 'Knit', 'Synthetic', 'Canvas'],
    standardColors: ['White', 'Black', 'Multi', 'Grey'],
    baseServices: [
      { service: 'shoe_clean', price: 299 }
    ]
  },
  {
    id: 'shoe-leather',
    name: 'Formal Leather Shoes',
    category: 'shoes',
    icon: 'Shield',
    frequentlyUsed: false,
    standardFabrics: ['Full Grain Leather', 'Suede', 'Patent Leather'],
    standardColors: ['Black', 'Brown', 'Tan', 'Oxblood'],
    baseServices: [
      { service: 'shoe_clean', price: 349 },
      { service: 'leather_clean', price: 399 }
    ]
  },
  {
    id: 'special-jacket-leather',
    name: 'Premium Leather Jacket',
    category: 'special',
    icon: 'ShieldCheck',
    frequentlyUsed: false,
    standardFabrics: ['Genuine Leather', 'Suede', 'Nappa'],
    standardColors: ['Black', 'Dark Brown', 'Tan'],
    baseServices: [
      { service: 'leather_clean', price: 650 },
      { service: 'dry_clean', price: 550 }
    ]
  }
];

export const mockCustomers: Customer[] = [
  {
    id: 'cust-1',
    name: 'Rahul Patil',
    phone: '+91 98765 43210',
    email: 'rahul.patil@example.com',
    address: 'Flat 402, Rohan Vasanta, Baner Road, Pune',
    landmark: 'Near D-Mart',
    gstNumber: '27AABCU9603R1ZM',
    customerSince: 'Jan 2025',
    totalOrders: 38,
    totalSpend: 42850,
    averageOrderValue: 1128,
    pendingBalance: 420,
    tags: ['VIP', 'Regular'],
    preferences: {
      fragrance: 'light',
      starch: 'medium',
      foldPreference: 'hanger',
      deliverySlot: 'Evening (6 PM - 8 PM)',
      specialNotes: 'Prefers shirts packed on wooden hangers. White shirts collar extra starch.'
    },
    recentOrderIds: ['ORD-8721', 'ORD-8650', 'ORD-8512'],
    frequentItems: [
      { garmentName: 'Shirt', service: 'Dry Clean', count: 48 },
      { garmentName: 'Saree', service: 'Dry Clean', count: 18 },
      { garmentName: 'Bedsheet (Double)', service: 'Wash', count: 14 }
    ]
  },
  {
    id: 'cust-2',
    name: 'Sneha Kulkarni',
    phone: '+91 98234 56789',
    email: 'sneha.k@outlook.com',
    address: 'B-12, Hermes Nest, Koregaon Park, Pune',
    customerSince: 'Mar 2025',
    totalOrders: 19,
    totalSpend: 24600,
    averageOrderValue: 1294,
    pendingBalance: 0,
    tags: ['Regular', 'Silk Care'],
    preferences: {
      fragrance: 'premium',
      starch: 'none',
      foldPreference: 'boxed',
      specialNotes: 'Heavy zari sarees only hydrocarbon dry clean. Handle with care.'
    },
    recentOrderIds: ['ORD-8720', 'ORD-8610'],
    frequentItems: [
      { garmentName: 'Saree (Standard)', service: 'Dry Clean', count: 22 },
      { garmentName: 'Women Dress', service: 'Dry Clean', count: 12 }
    ]
  },
  {
    id: 'cust-3',
    name: 'Amit Shah',
    phone: '+91 98111 22334',
    email: 'amit.shah@techcorp.in',
    address: 'Villa 7, Pride World City, Charholi, Pune',
    customerSince: 'Jul 2025',
    totalOrders: 12,
    totalSpend: 16500,
    averageOrderValue: 1375,
    pendingBalance: 750,
    tags: ['Corporate'],
    preferences: {
      fragrance: 'standard',
      starch: 'heavy',
      foldPreference: 'hanger',
      specialNotes: 'Formal trousers razor-sharp crease.'
    },
    recentOrderIds: ['ORD-8719'],
    frequentItems: [
      { garmentName: 'Suit (2 Piece)', service: 'Dry Clean', count: 10 },
      { garmentName: 'Shirt', service: 'Steam Press', count: 32 }
    ]
  },
  {
    id: 'cust-4',
    name: 'Priya Joshi',
    phone: '+91 98555 66778',
    address: 'Flat 801, Marvel Bounty, Hadapsar, Pune',
    customerSince: 'Nov 2025',
    totalOrders: 8,
    totalSpend: 9200,
    averageOrderValue: 1150,
    pendingBalance: 0,
    tags: ['New'],
    preferences: {
      fragrance: 'light',
      starch: 'light',
      foldPreference: 'folded'
    },
    recentOrderIds: ['ORD-8718'],
    frequentItems: [
      { garmentName: 'Bedsheet (Single)', service: 'Wash + Iron', count: 8 }
    ]
  },
  {
    id: 'cust-5',
    name: 'Neha Deshmukh',
    phone: '+91 97666 54321',
    address: 'Rowhouse 4, Green Acres, Viman Nagar, Pune',
    customerSince: 'Feb 2026',
    totalOrders: 5,
    totalSpend: 6800,
    averageOrderValue: 1360,
    pendingBalance: 1200,
    tags: ['Delayed Payment'],
    preferences: {
      fragrance: 'none',
      starch: 'none',
      foldPreference: 'folded'
    },
    recentOrderIds: ['ORD-8715']
  }
];

export const mockOrders: Order[] = [
  {
    id: 'ord-8721',
    orderNumber: 'ORD-8721',
    customerId: 'cust-1',
    customerName: 'Rahul Patil',
    customerPhone: '+91 98765 43210',
    createdAt: '2026-08-22T10:30:00Z',
    promisedDeliveryDate: '2026-08-24T18:00:00Z',
    itemCount: 9,
    subtotal: 735,
    discountAmount: 50,
    discountType: 'flat',
    expressSurcharge: 0,
    taxAmount: 0,
    totalAmount: 685,
    paidAmount: 500,
    balanceAmount: 185,
    paymentStatus: 'partial',
    paymentMethod: 'upi',
    overallStage: 'quality_check',
    rackLocation: 'R-12-B',
    bagId: 'BAG-8721',
    priority: 'standard',
    deliveryType: 'store_pickup',
    isDelayed: false,
    paymentHistory: [
      {
        id: 'pay-1',
        amount: 500,
        method: 'upi',
        timestamp: '2026-08-22T10:44:00Z',
        reference: 'UPI/623489110023',
        recordedBy: 'Swapnil Shinde'
      }
    ],
    items: [
      {
        id: 'item-1',
        garmentId: 'women-dress',
        garmentName: "Women's Dress",
        category: 'women',
        service: 'dry_clean',
        serviceName: 'Dry Cleaning',
        quantity: 2,
        unitPrice: 180,
        totalPrice: 360,
        color: 'Pastel Blue & Floral',
        fabric: 'Georgette / Silk',
        specialInstructions: 'Delicate lace border. Hand press only.',
        photos: [
          {
            id: 'ph-1',
            type: 'front',
            url: 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=300&auto=format&fit=crop&q=60',
            timestamp: '2026-08-22T10:32:00Z'
          }
        ],
        individualGarments: [
          {
            garmentTag: 'GAR-8721-01',
            garmentName: "Women's Dress (Floral)",
            service: 'dry_clean',
            stage: 'quality_check',
            rackLocation: 'R-12-B',
            qcStatus: 'passed',
            qcNotes: 'Lace inspected, clean and steam pressed.'
          },
          {
            garmentTag: 'GAR-8721-02',
            garmentName: "Women's Dress (Pastel)",
            service: 'dry_clean',
            stage: 'quality_check',
            rackLocation: 'R-12-B',
            qcStatus: 'passed'
          }
        ]
      },
      {
        id: 'item-2',
        garmentId: 'men-shirt',
        garmentName: "Men's White Shirt",
        category: 'men',
        service: 'dry_clean',
        serviceName: 'Dry Cleaning',
        quantity: 2,
        unitPrice: 80,
        totalPrice: 160,
        color: 'White',
        fabric: 'Cotton',
        damages: [
          {
            id: 'dmg-1',
            type: 'tear',
            location: 'Left sleeve cuff',
            description: 'Small 0.5cm tear near left cuff button. Customer informed at counter.',
            severity: 'low',
            photoUrl: 'https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?w=300&auto=format&fit=crop&q=60'
          }
        ],
        individualGarments: [
          {
            garmentTag: 'GAR-8721-03',
            garmentName: "Men's White Shirt (Cuff Tear)",
            service: 'dry_clean',
            stage: 'quality_check',
            rackLocation: 'R-12-B',
            qcStatus: 'passed',
            qcNotes: 'Existing cuff tear verified intact.'
          },
          {
            garmentTag: 'GAR-8721-04',
            garmentName: "Men's White Shirt",
            service: 'dry_clean',
            stage: 'quality_check',
            rackLocation: 'R-12-B',
            qcStatus: 'passed'
          }
        ]
      },
      {
        id: 'item-3',
        garmentId: 'men-shirt',
        garmentName: "Men's Shirt",
        category: 'men',
        service: 'steam_press',
        serviceName: 'Steam Pressing',
        quantity: 1,
        unitPrice: 20,
        totalPrice: 20,
        color: 'Sky Blue',
        fabric: 'Linen',
        individualGarments: [
          {
            garmentTag: 'GAR-8721-05',
            garmentName: "Men's Shirt (Blue Linen)",
            service: 'steam_press',
            stage: 'quality_check',
            rackLocation: 'R-12-B',
            qcStatus: 'passed'
          }
        ]
      },
      {
        id: 'item-4',
        garmentId: 'women-saree',
        garmentName: 'Saree',
        category: 'women',
        service: 'dry_clean',
        serviceName: 'Dry Cleaning',
        quantity: 1,
        unitPrice: 150,
        totalPrice: 150,
        color: 'Crimson Red',
        fabric: 'Chanderi Silk',
        individualGarments: [
          {
            garmentTag: 'GAR-8721-06',
            garmentName: 'Saree (Crimson Silk)',
            service: 'dry_clean',
            stage: 'quality_check',
            rackLocation: 'R-12-B',
            qcStatus: 'passed'
          }
        ]
      },
      {
        id: 'item-5',
        garmentId: 'house-bedsheet-double',
        garmentName: 'Bedsheet',
        category: 'household',
        service: 'wash',
        serviceName: 'Standard Wash',
        quantity: 2,
        unitPrice: 90,
        totalPrice: 180,
        color: 'White Geometric',
        fabric: 'Percale Cotton',
        individualGarments: [
          {
            garmentTag: 'GAR-8721-07',
            garmentName: 'Bedsheet Double #1',
            service: 'wash',
            stage: 'quality_check',
            rackLocation: 'R-12-B',
            qcStatus: 'passed'
          },
          {
            garmentTag: 'GAR-8721-08',
            garmentName: 'Bedsheet Double #2',
            service: 'wash',
            stage: 'quality_check',
            rackLocation: 'R-12-B',
            qcStatus: 'passed'
          }
        ]
      },
      {
        id: 'item-6',
        garmentId: 'house-blanket-kg',
        garmentName: 'Blanket (Weight Based)',
        category: 'household',
        service: 'weight_based',
        serviceName: 'Laundry by Weight',
        quantity: 1,
        weightKg: 4.5,
        unitPrice: 50,
        totalPrice: 225,
        color: 'Navy Blue Mink',
        fabric: 'Mink Wool',
        individualGarments: [
          {
            garmentTag: 'GAR-8721-09',
            garmentName: 'Blanket 4.5kg',
            service: 'weight_based',
            stage: 'quality_check',
            rackLocation: 'R-12-B',
            qcStatus: 'passed'
          }
        ]
      }
    ]
  },
  {
    id: 'ord-8720',
    orderNumber: 'ORD-8720',
    customerId: 'cust-2',
    customerName: 'Sneha Kulkarni',
    customerPhone: '+91 98234 56789',
    createdAt: '2026-08-22T09:15:00Z',
    promisedDeliveryDate: '2026-08-23T17:00:00Z',
    itemCount: 4,
    subtotal: 780,
    discountAmount: 0,
    expressSurcharge: 150,
    taxAmount: 0,
    totalAmount: 930,
    paidAmount: 930,
    balanceAmount: 0,
    paymentStatus: 'paid',
    paymentMethod: 'card',
    overallStage: 'processing',
    priority: 'express',
    deliveryType: 'home_delivery',
    deliveryAddress: 'B-12, Hermes Nest, Koregaon Park, Pune',
    isDelayed: false,
    paymentHistory: [
      {
        id: 'pay-2',
        amount: 930,
        method: 'card',
        timestamp: '2026-08-22T09:20:00Z',
        reference: 'HDFC/POS-98124',
        recordedBy: 'Swapnil Shinde'
      }
    ],
    items: [
      {
        id: 'item-8720-1',
        garmentId: 'women-heavy-saree',
        garmentName: 'Heavy / Zari Saree',
        category: 'women',
        service: 'dry_clean',
        serviceName: 'Dry Cleaning',
        quantity: 2,
        unitPrice: 280,
        totalPrice: 560,
        color: 'Bridal Crimson & Gold',
        fabric: 'Kanjivaram Silk',
        individualGarments: [
          { garmentTag: 'GAR-8720-01', garmentName: 'Kanjivaram Saree #1', service: 'dry_clean', stage: 'processing' },
          { garmentTag: 'GAR-8720-02', garmentName: 'Kanjivaram Saree #2', service: 'dry_clean', stage: 'processing' }
        ]
      },
      {
        id: 'item-8720-2',
        garmentId: 'shoe-sneakers',
        garmentName: 'Sneakers / Sports Shoes',
        category: 'shoes',
        service: 'shoe_clean',
        serviceName: 'Premium Shoe Spa',
        quantity: 1,
        unitPrice: 299,
        totalPrice: 299,
        color: 'White Nike AirMax',
        individualGarments: [
          { garmentTag: 'GAR-8720-03', garmentName: 'Nike AirMax White', service: 'shoe_clean', stage: 'processing' }
        ]
      }
    ]
  },
  {
    id: 'ord-8719',
    orderNumber: 'ORD-8719',
    customerId: 'cust-3',
    customerName: 'Amit Shah',
    customerPhone: '+91 98111 22334',
    createdAt: '2026-08-21T11:00:00Z',
    promisedDeliveryDate: '2026-08-22T14:00:00Z',
    itemCount: 3,
    subtotal: 520,
    discountAmount: 0,
    expressSurcharge: 0,
    taxAmount: 0,
    totalAmount: 520,
    paidAmount: 0,
    balanceAmount: 520,
    paymentStatus: 'pending',
    overallStage: 'ironing',
    priority: 'standard',
    deliveryType: 'store_pickup',
    isDelayed: true,
    paymentHistory: [],
    items: [
      {
        id: 'item-8719-1',
        garmentId: 'men-suit-2pc',
        garmentName: 'Suit (2 Piece)',
        category: 'men',
        service: 'dry_clean',
        serviceName: 'Dry Cleaning',
        quantity: 1,
        unitPrice: 320,
        totalPrice: 320,
        color: 'Charcoal Grey',
        individualGarments: [
          { garmentTag: 'GAR-8719-01', garmentName: 'Charcoal Blazer', service: 'dry_clean', stage: 'ironing' },
          { garmentTag: 'GAR-8719-02', garmentName: 'Charcoal Trousers', service: 'dry_clean', stage: 'ironing' }
        ]
      },
      {
        id: 'item-8719-2',
        garmentId: 'special-jacket-leather',
        garmentName: 'Premium Leather Jacket',
        category: 'special',
        service: 'leather_clean',
        serviceName: 'Leather & Suede Spa',
        quantity: 1,
        unitPrice: 650,
        totalPrice: 650,
        color: 'Dark Brown',
        individualGarments: [
          { 
            garmentTag: 'GAR-8719-03', 
            garmentName: 'Leather Jacket', 
            service: 'leather_clean', 
            stage: 'quality_check', 
            qcStatus: 'issue',
            qcIssueReason: 'Color conditioning requires second coat',
            qcNotes: 'Sent for rework to leather specialist.'
          }
        ]
      }
    ]
  },
  {
    id: 'ord-8718',
    orderNumber: 'ORD-8718',
    customerId: 'cust-4',
    customerName: 'Priya Joshi',
    customerPhone: '+91 98555 66778',
    createdAt: '2026-08-20T16:00:00Z',
    promisedDeliveryDate: '2026-08-22T18:00:00Z',
    itemCount: 4,
    subtotal: 360,
    discountAmount: 0,
    expressSurcharge: 0,
    taxAmount: 0,
    totalAmount: 360,
    paidAmount: 360,
    balanceAmount: 0,
    paymentStatus: 'paid',
    paymentMethod: 'cash',
    overallStage: 'packed',
    rackLocation: 'R-04-A',
    bagId: 'BAG-8718',
    priority: 'standard',
    deliveryType: 'store_pickup',
    isDelayed: false,
    paymentHistory: [
      {
        id: 'pay-3',
        amount: 360,
        method: 'cash',
        timestamp: '2026-08-20T16:05:00Z',
        recordedBy: 'Swapnil Shinde'
      }
    ],
    items: [
      {
        id: 'item-8718-1',
        garmentId: 'house-bedsheet-single',
        garmentName: 'Bedsheet (Single)',
        category: 'household',
        service: 'wash_iron',
        serviceName: 'Wash + Steam Iron',
        quantity: 4,
        unitPrice: 90,
        totalPrice: 360,
        individualGarments: [
          { garmentTag: 'GAR-8718-01', garmentName: 'Single Bedsheet #1', service: 'wash_iron', stage: 'packed', rackLocation: 'R-04-A', bagId: 'BAG-8718' },
          { garmentTag: 'GAR-8718-02', garmentName: 'Single Bedsheet #2', service: 'wash_iron', stage: 'packed', rackLocation: 'R-04-A', bagId: 'BAG-8718' },
          { garmentTag: 'GAR-8718-03', garmentName: 'Single Bedsheet #3', service: 'wash_iron', stage: 'packed', rackLocation: 'R-04-A', bagId: 'BAG-8718' },
          { garmentTag: 'GAR-8718-04', garmentName: 'Single Bedsheet #4', service: 'wash_iron', stage: 'packed', rackLocation: 'R-04-A', bagId: 'BAG-8718' }
        ]
      }
    ]
  },
  {
    id: 'ord-8715',
    orderNumber: 'ORD-8715',
    customerId: 'cust-5',
    customerName: 'Neha Deshmukh',
    customerPhone: '+91 97666 54321',
    createdAt: '2026-08-19T14:30:00Z',
    promisedDeliveryDate: '2026-08-21T18:00:00Z',
    itemCount: 5,
    subtotal: 1200,
    discountAmount: 0,
    expressSurcharge: 0,
    taxAmount: 0,
    totalAmount: 1200,
    paidAmount: 0,
    balanceAmount: 1200,
    paymentStatus: 'pending',
    overallStage: 'ready',
    rackLocation: 'R-02-C',
    bagId: 'BAG-8715',
    priority: 'standard',
    deliveryType: 'store_pickup',
    isDelayed: true,
    paymentHistory: [],
    items: []
  }
];

export const mockExpenses: ExpenseItem[] = [
  {
    id: 'exp-1',
    date: '2026-08-22',
    category: 'detergent',
    description: 'Eco-Enzyme Commercial Detergent 50L Drum',
    amount: 3450,
    paymentMethod: 'upi',
    recordedBy: 'Rajesh Nair',
    receiptUrl: 'https://example.com/receipt-1.pdf'
  },
  {
    id: 'exp-2',
    date: '2026-08-21',
    category: 'packaging',
    description: 'Custom Printed Garment Bags (1000 pcs) & Wooden Hangers (100 pcs)',
    amount: 4800,
    paymentMethod: 'bank_transfer',
    recordedBy: 'Rajesh Nair'
  },
  {
    id: 'exp-3',
    date: '2026-08-18',
    category: 'electricity',
    description: 'MSEDCL Commercial Power Bill - July Cycle',
    amount: 14200,
    paymentMethod: 'bank_transfer',
    recordedBy: 'Rajesh Nair'
  },
  {
    id: 'exp-4',
    date: '2026-08-15',
    category: 'maintenance',
    description: 'Boiler descaling & vacuum iron steam solenoid valve replacement',
    amount: 2200,
    paymentMethod: 'cash',
    recordedBy: 'Rajesh Nair'
  },
  {
    id: 'exp-5',
    date: '2026-08-01',
    category: 'rent',
    description: 'Store Premises Monthly Lease - Unit #4 Koregaon Park',
    amount: 45000,
    paymentMethod: 'bank_transfer',
    recordedBy: 'Rajesh Nair'
  }
];

export const mockInventory: InventoryItem[] = [
  {
    id: 'inv-1',
    name: 'Hydrocarbon Dry Clean Solvent (Perk Safe)',
    category: 'chemicals',
    currentStock: 18,
    unit: 'Liters',
    lowStockThreshold: 15,
    costPerUnit: 240,
    supplier: 'ChemClean India Ltd',
    lastRestocked: '2026-08-10',
    reorderQuantity: 50
  },
  {
    id: 'inv-2',
    name: 'Eco-Enzyme Premium Laundry Detergent',
    category: 'detergents',
    currentStock: 8,
    unit: 'Liters',
    lowStockThreshold: 12,
    costPerUnit: 110,
    supplier: 'FabriCare Supplies Pune',
    lastRestocked: '2026-08-05',
    reorderQuantity: 40
  },
  {
    id: 'inv-3',
    name: 'Garment Polythene Dust Covers (Suit Length)',
    category: 'packaging',
    currentStock: 140,
    unit: 'Pieces',
    lowStockThreshold: 200,
    costPerUnit: 4.5,
    supplier: 'PackWell Industries',
    lastRestocked: '2026-08-01',
    reorderQuantity: 1000
  },
  {
    id: 'inv-4',
    name: 'Heavy Duty Metal Wire Hangers',
    category: 'hangers',
    currentStock: 450,
    unit: 'Pieces',
    lowStockThreshold: 300,
    costPerUnit: 6,
    supplier: 'HangerCraft India',
    lastRestocked: '2026-08-14',
    reorderQuantity: 1000
  },
  {
    id: 'inv-5',
    name: 'Thermal Receipt Rolls (80mm × 50m)',
    category: 'tags',
    currentStock: 14,
    unit: 'Rolls',
    lowStockThreshold: 10,
    costPerUnit: 45,
    supplier: 'POS Supplies Hub',
    lastRestocked: '2026-08-12',
    reorderQuantity: 50
  },
  {
    id: 'inv-6',
    name: 'Ultrasonic Rust & Oil Spotting Chemical',
    category: 'chemicals',
    currentStock: 1.5,
    unit: 'Liters',
    lowStockThreshold: 2,
    costPerUnit: 850,
    supplier: 'SpotLess Labs',
    lastRestocked: '2026-07-28',
    reorderQuantity: 5
  }
];

export const mockNotifications: NotificationItem[] = [
  {
    id: 'notif-1',
    title: '3 Orders Delayed Past Promise Time',
    message: 'ORD-8719, ORD-8715, and ORD-8704 have exceeded promised delivery hours. Immediate dispatch or customer alert required.',
    type: 'delayed_order',
    timestamp: '10 mins ago',
    read: false,
    actionView: 'orders',
    entityId: 'ord-8719'
  },
  {
    id: 'notif-2',
    title: 'Low Stock Alert: Eco-Enzyme Detergent',
    message: 'Current stock is 8L (Threshold: 12L). Reorder recommended today.',
    type: 'low_stock',
    timestamp: '45 mins ago',
    read: false,
    actionView: 'inventory',
    entityId: 'inv-2'
  },
  {
    id: 'notif-3',
    title: 'Quality Check Flagged Rework Needed',
    message: 'Garment GAR-8719-03 (Leather Jacket) flagged by QC for color conditioning touchup.',
    type: 'qc_issue',
    timestamp: '2 hours ago',
    read: false,
    actionView: 'processing',
    entityId: 'GAR-8719-03'
  },
  {
    id: 'notif-4',
    title: 'Pending Balance: Neha Deshmukh',
    message: 'ORD-8715 is marked Ready with ₹1,200 pending collection before customer handover.',
    type: 'pending_payment',
    timestamp: '3 hours ago',
    read: true,
    actionView: 'orders',
    entityId: 'ord-8715'
  }
];

export const mockAuditLogs: AuditLog[] = [
  {
    id: 'log-1',
    timestamp: '10:44 AM',
    staffName: 'Swapnil Shinde',
    staffRole: 'counter',
    action: 'Payment Received',
    orderNumber: 'ORD-8721',
    details: 'Received ₹500 via UPI (Ref: 623489110023) from Rahul Patil.'
  },
  {
    id: 'log-2',
    timestamp: '10:32 AM',
    staffName: 'Swapnil Shinde',
    staffRole: 'counter',
    action: 'Order Created',
    orderNumber: 'ORD-8721',
    details: 'Generated order with 6 items (9 total garments) for Rahul Patil.'
  },
  {
    id: 'log-3',
    timestamp: '11:15 AM',
    staffName: 'Ganesh Jadhav',
    staffRole: 'processing',
    action: 'Moved to Quality Check',
    garmentTag: 'GAR-8721-03',
    details: 'Steam press cycle complete. Transferred to QC station.'
  },
  {
    id: 'log-4',
    timestamp: '02:20 PM',
    staffName: 'Ganesh Jadhav',
    staffRole: 'processing',
    action: 'QC Passed',
    garmentTag: 'GAR-8721-01',
    details: 'Visual inspection complete. Stains removed, lace verified.'
  },
  {
    id: 'log-5',
    timestamp: '04:10 PM',
    staffName: 'Ganesh Jadhav',
    staffRole: 'processing',
    action: 'Order Packed & Racked',
    orderNumber: 'ORD-8718',
    details: 'Assigned to Rack R-04-A in BAG-8718.'
  }
];

export const mockDeliveryTasks: DeliveryTask[] = [
  {
    id: 'task-1',
    type: 'delivery',
    orderNumber: 'ORD-8720',
    customerName: 'Sneha Kulkarni',
    customerPhone: '+91 98234 56789',
    address: 'B-12, Hermes Nest, Koregaon Park, Pune',
    scheduledTime: 'Today, 5:00 PM - 7:00 PM',
    status: 'assigned',
    assignedRider: 'Kiran More',
    amountToCollect: 0,
    itemCount: 4,
    notes: 'Gate passcode 4821. Call before reaching.'
  },
  {
    id: 'task-2',
    type: 'pickup',
    customerName: 'Vikram Malhotra',
    customerPhone: '+91 99887 76655',
    address: 'Bunglow 4, Clover Highlands, NIBM Road, Pune',
    scheduledTime: 'Today, 4:00 PM - 5:30 PM',
    status: 'scheduled',
    assignedRider: 'Kiran More',
    itemCount: 8,
    notes: 'Includes 2 carpets and 4 winter suits. Bring heavy laundry bags.'
  },
  {
    id: 'task-3',
    type: 'delivery',
    orderNumber: 'ORD-8715',
    customerName: 'Neha Deshmukh',
    customerPhone: '+91 97666 54321',
    address: 'Rowhouse 4, Green Acres, Viman Nagar, Pune',
    scheduledTime: 'Today, 6:30 PM - 8:00 PM',
    status: 'scheduled',
    amountToCollect: 1200,
    itemCount: 5,
    notes: 'Collect ₹1,200 cash/UPI upon delivery.'
  }
];
