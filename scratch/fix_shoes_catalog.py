import re

with open('apps/web/src/pages/CatalogSettingsPage.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Replace the Pricing Tab visibility logic with unified effect logic for both tabs
pricing_logic_pattern = r"  const visiblePricingCategories = useMemo[\s\S]*?\}, \[visiblePricingServices, pricingServiceId\]\);\n"

new_logic = """  // --- Shoe Category & Service Enforcements ---
  const isActiveShoeService = services.find(s => s.id === activeServiceId)?.name.toLowerCase().includes('shoe');
  const isActiveShoeCategory = activeCategory === GarmentCategory.SHOES;
  
  useEffect(() => {
    if (isActiveShoeCategory && !isActiveShoeService) {
      const shoeSvc = services.find(s => s.name.toLowerCase().includes('shoe'));
      if (shoeSvc) setActiveServiceId(shoeSvc.id);
    } else if (!isActiveShoeCategory && isActiveShoeService) {
      const nonShoeSvc = services.find(s => !s.name.toLowerCase().includes('shoe'));
      if (nonShoeSvc) setActiveServiceId(nonShoeSvc.id);
    }
  }, [isActiveShoeCategory, isActiveShoeService, services]);

  const isPricingShoeService = services.find(s => s.id === pricingServiceId)?.name.toLowerCase().includes('shoe');
  const isPricingShoeCategory = pricingCategory === GarmentCategory.SHOES;

  useEffect(() => {
    if (isPricingShoeCategory && !isPricingShoeService) {
      const shoeSvc = services.find(s => s.name.toLowerCase().includes('shoe'));
      if (shoeSvc) {
        setPricingServiceId(shoeSvc.id);
        setEditedPrices({});
      }
    } else if (!isPricingShoeCategory && isPricingShoeService) {
      const nonShoeSvc = services.find(s => !s.name.toLowerCase().includes('shoe'));
      if (nonShoeSvc) {
        setPricingServiceId(nonShoeSvc.id);
        setEditedPrices({});
      }
    }
  }, [isPricingShoeCategory, isPricingShoeService, services]);
"""
content = re.sub(pricing_logic_pattern, new_logic, content)

# 2. Update Garments Tab UI
# Service Bar mb-3 -> mb-6
garment_svc_bar = """<div className="w-full bg-slate-50 border-b border-slate-200 px-5 py-4 shrink-0 mb-3 shadow-xs">
                  <div className="flex flex-col xl:flex-row xl:items-center gap-4">
                    <span className="text-sm font-bold text-slate-800 w-20 shrink-0 uppercase tracking-wider">Service</span>
                    <div className="flex-1 flex flex-wrap gap-4 w-full">
                      {services.map((service) => ("""

new_garment_svc_bar = """<div className="w-full bg-slate-50 border-b border-slate-200 px-5 py-4 shrink-0 mb-6 shadow-xs">
                  <div className="flex flex-col xl:flex-row xl:items-center gap-4">
                    <span className="text-sm font-bold text-slate-800 w-20 shrink-0 uppercase tracking-wider">Service</span>
                    <div className="flex-1 flex flex-wrap gap-4 w-full">
                      {services.map((service) => {
                        const isShoeSvc = service.name.toLowerCase().includes('shoe');
                        const isVisuallyDisabled = isActiveShoeCategory ? !isShoeSvc : isShoeSvc;
                        return ("""
content = content.replace(garment_svc_bar, new_garment_svc_bar)

# Fix Garment Service buttons styling
garment_svc_btn = """className={`flex-1 min-w-[120px] px-[22px] py-3 rounded-sm text-sm font-bold transition-all whitespace-normal text-center leading-tight break-words min-h-[48px] flex items-center justify-center cursor-pointer border shadow-sm ${
                            activeServiceId === service.id
                              ? 'bg-primary-600 text-white border-primary-600'
                              : 'bg-white text-slate-700 border-slate-300 hover:border-slate-400 hover:bg-slate-50'
                          }`}
                        >"""
new_garment_svc_btn = """className={`flex-1 min-w-[120px] px-[22px] py-3 rounded-sm text-sm font-bold transition-all whitespace-normal text-center leading-tight break-words min-h-[48px] flex items-center justify-center cursor-pointer border shadow-sm ${
                            activeServiceId === service.id
                              ? 'bg-primary-600 text-white border-primary-600'
                              : isVisuallyDisabled
                              ? 'bg-gray-50 text-gray-400 border-gray-200 opacity-60'
                              : 'bg-white text-slate-700 border-slate-300 hover:border-slate-400 hover:bg-slate-50'
                          }`}
                        >"""
content = content.replace(garment_svc_btn, new_garment_svc_btn)
content = content.replace("{service.name}\n                        </button>\n                      ))}", "{service.name}\n                        </button>\n                      );})}")

# Garment Category Bar
garment_cat_bar = """{CATEGORIES.map((cat) => ("""
new_garment_cat_bar = """{CATEGORIES.map((cat) => {
                        const isShoeCat = cat === GarmentCategory.SHOES;
                        const isVisuallyDisabled = isActiveShoeService ? !isShoeCat : isShoeCat;
                        return ("""
content = content.replace(garment_cat_bar, new_garment_cat_bar)

garment_cat_btn = """className={`flex-1 min-w-[120px] px-[22px] py-3 whitespace-normal text-center leading-tight break-words text-sm font-bold transition-all min-h-[48px] flex items-center justify-center cursor-pointer rounded-sm border shadow-sm ${
                              activeCategory === cat
                                ? 'bg-primary-600 text-white border-primary-600'
                                : 'bg-white text-slate-700 border-slate-300 hover:border-slate-400 hover:bg-slate-50'
                            }`}
                          >"""
new_garment_cat_btn = """className={`flex-1 min-w-[120px] px-[22px] py-3 whitespace-normal text-center leading-tight break-words text-sm font-bold transition-all min-h-[48px] flex items-center justify-center cursor-pointer rounded-sm border shadow-sm ${
                              activeCategory === cat
                                ? 'bg-primary-600 text-white border-primary-600'
                                : isVisuallyDisabled
                                ? 'bg-gray-50 text-gray-400 border-gray-200 opacity-60'
                                : 'bg-white text-slate-700 border-slate-300 hover:border-slate-400 hover:bg-slate-50'
                            }`}
                          >"""
content = content.replace(garment_cat_btn, new_garment_cat_btn)
content = content.replace("{CATEGORY_LABELS[cat] || cat}\n                          </button>\n                        ))}", "{CATEGORY_LABELS[cat] || cat}\n                          </button>\n                        );})}")

# 3. Update Pricing Tab UI
pricing_svc_bar = """<div className="w-full bg-slate-50 border-b border-slate-200 px-5 py-4 shrink-0 mb-3 shadow-xs">
                  <div className="flex flex-col xl:flex-row xl:items-center gap-4">
                    <span className="text-sm font-bold text-slate-800 w-20 shrink-0 uppercase tracking-wider">Service</span>
                    <div className="flex-1 flex flex-wrap gap-4 w-full">
                      {visiblePricingServices.map((service) => ("""

new_pricing_svc_bar = """<div className="w-full bg-slate-50 border-b border-slate-200 px-5 py-4 shrink-0 mb-6 shadow-xs">
                  <div className="flex flex-col xl:flex-row xl:items-center gap-4">
                    <span className="text-sm font-bold text-slate-800 w-20 shrink-0 uppercase tracking-wider">Service</span>
                    <div className="flex-1 flex flex-wrap gap-4 w-full">
                      {services.map((service) => {
                        const isShoeSvc = service.name.toLowerCase().includes('shoe');
                        const isVisuallyDisabled = isPricingShoeCategory ? !isShoeSvc : isShoeSvc;
                        return ("""
content = content.replace(pricing_svc_bar, new_pricing_svc_bar)

pricing_svc_btn = """className={`flex-1 min-w-[120px] px-[22px] py-3 rounded-sm text-sm font-bold transition-all whitespace-normal text-center leading-tight break-words min-h-[48px] flex items-center justify-center cursor-pointer border shadow-sm ${
                            pricingServiceId === service.id
                              ? 'bg-primary-600 text-white border-primary-600'
                              : 'bg-white text-slate-700 border-slate-300 hover:border-slate-400 hover:bg-slate-50'
                          }`}
                        >"""
new_pricing_svc_btn = """className={`flex-1 min-w-[120px] px-[22px] py-3 rounded-sm text-sm font-bold transition-all whitespace-normal text-center leading-tight break-words min-h-[48px] flex items-center justify-center cursor-pointer border shadow-sm ${
                            pricingServiceId === service.id
                              ? 'bg-primary-600 text-white border-primary-600'
                              : isVisuallyDisabled
                              ? 'bg-gray-50 text-gray-400 border-gray-200 opacity-60'
                              : 'bg-white text-slate-700 border-slate-300 hover:border-slate-400 hover:bg-slate-50'
                          }`}
                        >"""
content = content.replace(pricing_svc_btn, new_pricing_svc_btn)
content = content.replace("{service.name}\n                        </button>\n                      ))}", "{service.name}\n                        </button>\n                      );})}")

pricing_cat_bar = """{visiblePricingCategories.map((cat) => ("""
new_pricing_cat_bar = """{CATEGORIES.map((cat) => {
                        const isShoeCat = cat === GarmentCategory.SHOES;
                        const isVisuallyDisabled = isPricingShoeService ? !isShoeCat : isShoeCat;
                        return ("""
content = content.replace(pricing_cat_bar, new_pricing_cat_bar)

pricing_cat_btn = """className={`flex-1 min-w-[120px] px-[22px] py-3 whitespace-normal text-center leading-tight break-words text-sm font-bold transition-all min-h-[48px] flex items-center justify-center cursor-pointer rounded-sm border shadow-sm ${
                              pricingCategory === cat
                                ? 'bg-primary-600 text-white border-primary-600'
                                : 'bg-white text-slate-700 border-slate-300 hover:border-slate-400 hover:bg-slate-50'
                            }`}
                          >"""
new_pricing_cat_btn = """className={`flex-1 min-w-[120px] px-[22px] py-3 whitespace-normal text-center leading-tight break-words text-sm font-bold transition-all min-h-[48px] flex items-center justify-center cursor-pointer rounded-sm border shadow-sm ${
                              pricingCategory === cat
                                ? 'bg-primary-600 text-white border-primary-600'
                                : isVisuallyDisabled
                                ? 'bg-gray-50 text-gray-400 border-gray-200 opacity-60'
                                : 'bg-white text-slate-700 border-slate-300 hover:border-slate-400 hover:bg-slate-50'
                            }`}
                          >"""
content = content.replace(pricing_cat_btn, new_pricing_cat_btn)

# Remove the "Clear Filter" block for pricing
clear_filter_block = """                        );})}
                      {visiblePricingCategories.length === 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            setPricingCategory(CATEGORIES[0]);
                            const nonShoeService = services.find((s) => !s.name.toLowerCase().includes('shoe'));
                            if (nonShoeService) {
                              setPricingServiceId(nonShoeService.id);
                              setEditedPrices({});
                            }
                          }}
                          className="flex-1 min-w-[120px] px-[22px] py-3 whitespace-normal text-center leading-tight break-words text-sm font-bold transition-all min-h-[48px] flex items-center justify-center cursor-pointer rounded-sm border border-slate-300 bg-slate-100 text-slate-500 hover:bg-slate-200 shadow-sm"
                        >
                          Clear Filter
                        </button>
                      )}"""
content = content.replace(clear_filter_block, "                        );})}")

# The block might be slightly different so we can use regex to remove it
content = re.sub(r"\{\s*visiblePricingCategories\.length === 1 && \([\s\S]*?\n\s*\)\s*\}", "", content)

with open('apps/web/src/pages/CatalogSettingsPage.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
