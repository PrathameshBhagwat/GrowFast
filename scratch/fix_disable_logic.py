import re

def update_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Fix the Garments Tab Service Logic
    content = content.replace(
        "const isVisuallyDisabled = isActiveShoeCategory ? !isShoeSvc : isShoeSvc;",
        "const isVisuallyDisabled = isActiveShoeCategory ? !isShoeSvc : false;"
    )

    # 2. Fix the Garments Tab Category Logic
    content = content.replace(
        "const isVisuallyDisabled = isActiveShoeService ? !isShoeCat : isShoeCat;",
        "const isVisuallyDisabled = isActiveShoeService ? !isShoeCat : false;"
    )

    # 3. Fix the Pricing Tab Service Logic
    content = content.replace(
        "const isVisuallyDisabled = isPricingShoeCategory ? !isShoeSvc : isShoeSvc;",
        "const isVisuallyDisabled = isPricingShoeCategory ? !isShoeSvc : false;"
    )

    # 4. Fix the Pricing Tab Category Logic
    content = content.replace(
        "const isVisuallyDisabled = isPricingShoeService ? !isShoeCat : isShoeCat;",
        "const isVisuallyDisabled = isPricingShoeService ? !isShoeCat : false;"
    )

    # 5. Fix ItemSelector Service Logic
    content = content.replace(
        "const isVisuallyDisabled = isShoeCategorySelected ? !isShoeService : isShoeService;",
        "const isVisuallyDisabled = isShoeCategorySelected ? !isShoeService : false;"
    )

    # 6. Fix ItemSelector Category Logic
    content = content.replace(
        "const isVisuallyDisabled = isShoeServiceSelected ? !isShoeCat : isShoeCat;",
        "const isVisuallyDisabled = isShoeServiceSelected ? !isShoeCat : false;"
    )

    # 7. Also make sure the Category bars have a top margin to force vertical space
    # Look for the Category Selector Bar wrapper
    content = content.replace(
        '<div className="w-full border-b border-slate-200 bg-white px-5 py-4 shrink-0 mb-3 shadow-xs">',
        '<div className="w-full border-y border-slate-200 bg-white px-5 py-4 shrink-0 mt-4 mb-4 shadow-xs">'
    )

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

update_file('apps/web/src/pages/CatalogSettingsPage.tsx')
update_file('apps/web/src/components/ItemSelector.tsx')
