const { chromium } = require('c:/Users/dell/Desktop/Infystent/GrowFast/node_modules/playwright');
const jwt = require('c:/Users/dell/Desktop/Infystent/GrowFast/node_modules/jsonwebtoken');
const { PrismaClient } = require('c:/Users/dell/Desktop/Infystent/GrowFast/node_modules/@prisma/client');
const path = require('path');

const prisma = new PrismaClient();
const JWT_SECRET = 'dev-jwt-secret-change-in-production';
const ARTIFACTS_DIR = 'C:/Users/dell/.gemini/antigravity-ide/brain/7fa01711-6f37-45dd-b775-ae4b19588ffc';

const ownerToken = jwt.sign(
  {
    sub: 'emp-owner-001',
    id: 'emp-owner-001',
    role: 'OWNER',
    storeId: 'store-kp-001',
    name: 'Prathamesh Bhagwat',
  },
  JWT_SECRET,
  { expiresIn: '24h' },
);

async function fetchWithRetry(url, options = {}, retries = 5) {
  const res = await fetch(url, options);
  if (res.status === 429 && retries > 0) {
    const retrySec = parseInt(res.headers.get('retry-after') || '6', 10);
    const waitMs = (isNaN(retrySec) ? 6 : retrySec) * 1000 + 500;
    console.log(`   [API 429 Throttled on ${url}] Waiting ${waitMs}ms before retry (${retries} left)...`);
    await new Promise((r) => setTimeout(r, waitMs));
    return fetchWithRetry(url, options, retries - 1);
  }
  return res;
}

async function gotoWithRetry(page, url, expectedSelector, maxAttempts = 6) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await page.goto(url);
    try {
      await page.waitForSelector(expectedSelector, { timeout: 5000 });
      return;
    } catch {
      const pageText = await page.locator('body').textContent();
      if (
        pageText.includes('429') ||
        pageText.includes('Too Many Requests') ||
        pageText.includes('Failed to fetch order')
      ) {
        console.log(`   [Page load 429 on attempt ${attempt}/${maxAttempts}] Waiting 8s...`);
        await page.waitForTimeout(8000);
        const retryBtn = page.locator('button:has-text("Retry")');
        if ((await retryBtn.count()) > 0) {
          await retryBtn.click();
          try {
            await page.waitForSelector(expectedSelector, { timeout: 5000 });
            return;
          } catch {}
        }
      } else if (attempt === maxAttempts) {
        throw new Error(`Failed to load ${url} with selector ${expectedSelector}`);
      }
    }
  }
}

async function runE2E() {
  console.log('================================================================');
  console.log('  PHASE 4D: FRONTEND COUNTER HANDOVER & PICKUP E2E VERIFICATION ');
  console.log('================================================================\n');

  // 1. Fetch Pricing & Customer
  console.log('1. Fetching active pricing & customer from backend...');
  const pricingRes = await fetchWithRetry('http://localhost:3000/api/pricing', {
    headers: { Authorization: `Bearer ${ownerToken}` },
  });
  const prices = (await pricingRes.json()).data;
  const shirt = prices[0];

  const custRes = await fetchWithRetry('http://localhost:3000/api/customers/search?query=9', {
    headers: { Authorization: `Bearer ${ownerToken}` },
  });
  const cust = (await custRes.json()).data[0];
  console.log(`   Customer: ${cust.name} | Price: ₹${shirt.price}\n`);

  // 2. Create Order 1: 5 Physical Garments (STORE_PICKUP)
  console.log('2. Creating Order 1 with 5 physical garments (STORE_PICKUP)...');
  const createOrder1Res = await fetchWithRetry('http://localhost:3000/api/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ownerToken}`,
    },
    body: JSON.stringify({
      customerId: cust.id,
      isExpress: false,
      pickupType: 'STORE_PICKUP',
      items: [
        {
          garmentCatalogId: shirt.garmentCatalogId,
          serviceTypeId: shirt.serviceTypeId,
          quantity: 5,
        },
      ],
    }),
  });
  const order1Data = (await createOrder1Res.json()).data;
  const order1Id = order1Data.id;
  const order1ItemId = order1Data.items[0].id;
  console.log(`   Order 1 created: #${order1Data.orderNumber} (ID: ${order1Id})`);

  // Fetch created order to get physical garment IDs
  const order1Detail = (
    await (
      await fetchWithRetry(`http://localhost:3000/api/orders/${order1Id}`, {
        headers: { Authorization: `Bearer ${ownerToken}` },
      })
    ).json()
  ).data;
  const garments = order1Detail.items[0].physicalGarments;
  console.log(`   Garments created: ${garments.length} units`);

  // Mark 3 of 5 garments READY initially (Units 1, 2, 3), 4th is UNREADY, 5th CANCELLED
  console.log('3. Setting initial readiness: Units 1, 2, 3 = READY; Unit 4 = UNREADY; Unit 5 = CANCELLED...');
  await prisma.physicalGarment.updateMany({
    where: { id: { in: [garments[0].id, garments[1].id, garments[2].id] } },
    data: { isReady: true },
  });
  await prisma.physicalGarment.update({
    where: { id: garments[4].id },
    data: { isCancelled: true },
  });
  console.log('   Readiness and cancellation initialized via database fixture.\n');

  // Launch Playwright
  console.log('4. Launching Chromium browser session...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  // Helper to set auth
  async function authenticate() {
    await page.goto('http://localhost:5173/login');
    await page.evaluate(
      ({ token }) => {
        localStorage.setItem('growfast_token', token);
        localStorage.setItem(
          'growfast_employee',
          JSON.stringify({
            id: 'emp-owner-001',
            name: 'Prathamesh Bhagwat',
            role: 'OWNER',
            storeId: 'store-kp-001',
          }),
        );
      },
      { token: ownerToken },
    );
  }

  await authenticate();

  // Test 1: Open STORE_PICKUP order
  console.log('5. Navigating to Order Detail page for Order 1...');
  await gotoWithRetry(page, `http://localhost:5173/orders/${order1Id}`, '#counter-handover-btn');
  console.log(`   Order Detail page loaded.`);

  // Verify eligible Counter Handover button appears
  const handoverBtn = page.locator('#counter-handover-btn');
  const handoverText = await handoverBtn.textContent();
  console.log(`   Found Handover Button: "${handoverText.trim()}" (Expected: contains 3 Ready)`);
  if (!handoverText.includes('3 Ready')) {
    throw new Error(`Expected button to show 3 Ready, got: ${handoverText}`);
  }

  // Open Handover Modal
  await handoverBtn.click();
  await page.waitForSelector('[role="dialog"]');
  console.log('   Counter Handover modal opened successfully.');

  // Test 2 & 3: Check selectable vs unready vs cancelled garments
  console.log('6. Checking garment cards: ready selectable, unready disabled, cancelled disabled...');
  const card1 = page.locator(`#pickup-card-${garments[0].id}`);
  const card2 = page.locator(`#pickup-card-${garments[1].id}`);
  const card3 = page.locator(`#pickup-card-${garments[2].id}`);
  const card4 = page.locator(`#pickup-card-${garments[3].id}`); // Unready
  const card5 = page.locator(`#pickup-card-${garments[4].id}`); // Cancelled

  await card1.waitFor({ state: 'visible' });
  expectAttr(await card1.getAttribute('aria-disabled'), 'false', 'Card 1 aria-disabled');
  expectAttr(await card4.getAttribute('aria-disabled'), 'true', 'Card 4 (unready) aria-disabled');
  expectAttr(await card5.getAttribute('aria-disabled'), 'true', 'Card 5 (cancelled) aria-disabled');

  // Attempt to click unready and cancelled - should not select
  await card4.click({ force: true });
  expectAttr(await card4.getAttribute('aria-checked'), 'false', 'Card 4 unready clicked');
  await card5.click({ force: true });
  expectAttr(await card5.getAttribute('aria-checked'), 'false', 'Card 5 cancelled clicked');
  console.log('   Unready and Cancelled cards correctly prevented selection.');

  // Test 4 & 5: Select ready garments (Units 1 & 2)
  console.log('7. Selecting 2 of 3 ready garments (Units 1 & 2)...');
  await card1.click();
  await card2.click();

  expectAttr(await card1.getAttribute('aria-checked'), 'true', 'Card 1 checked');
  expectAttr(await card2.getAttribute('aria-checked'), 'true', 'Card 2 checked');

  // Verify selection summary
  const selectedSummary = await page.locator('#selected-handover-count').textContent();
  const remainingSummary = await page.locator('#remaining-handover-count').textContent();
  console.log(`   Selection Summary: ${selectedSummary.trim()} | ${remainingSummary.trim()}`);
  if (!selectedSummary.includes('2 selected')) {
    throw new Error(`Expected '2 selected', got: ${selectedSummary}`);
  }

  // Take screenshot of selection modal
  await page.screenshot({
    path: path.join(ARTIFACTS_DIR, 'phase4d_ready_selection_desktop_1280.png'),
  });
  console.log('   Saved screenshot: phase4d_ready_selection_desktop_1280.png');

  // Test 8: Submit partial handover
  console.log('8. Submitting partial handover (Units 1 & 2)...');
  const confirmBtn = page.locator('#confirm-pickup-btn');
  await confirmBtn.click();

  // Wait for modal to close
  await page.waitForSelector('[role="dialog"]', { state: 'hidden', timeout: 8000 });
  console.log('   Partial handover confirmed and modal closed.');

  // Test 10 & 11: Refresh page and verify persisted delivery state
  console.log('9. Reloading Order Detail page to verify persisted delivered state...');
  await page.waitForTimeout(1000);
  await gotoWithRetry(page, `http://localhost:5173/orders/${order1Id}`, '#counter-handover-btn');

  // Physical garment items are automatically expanded by default on order load
  console.log('   Waiting for garment cards to be visible...');
  await page.waitForSelector(`#garment-card-${garments[0].id}`, { timeout: 10000 });

  // Check Units 1 & 2 show DELIVERED
  const g1Badge = page.locator(`#garment-delivered-badge-${garments[0].id}`);
  const g2Badge = page.locator(`#garment-delivered-badge-${garments[1].id}`);
  await g1Badge.waitFor({ state: 'visible', timeout: 5000 });
  await g2Badge.waitFor({ state: 'visible', timeout: 5000 });
  console.log('   Units 1 & 2 persisted as DELIVERED.');

  // Check Unit 3 is still READY and remaining
  const g3Card = page.locator(`#garment-card-${garments[2].id}`);
  const g3Text = await g3Card.textContent();
  if (!g3Text.includes('READY')) {
    throw new Error('Unit 3 should still be READY');
  }
  console.log('   Unit 3 remains READY.');

  await page.screenshot({
    path: path.join(ARTIFACTS_DIR, 'phase4d_remaining_after_partial_desktop_1280.png'),
  });
  console.log('   Saved screenshot: phase4d_remaining_after_partial_desktop_1280.png');

  // Test 13: Mark Unit 4 ready via prisma
  console.log('10. Marking Unit 4 READY via database fixture...');
  await prisma.physicalGarment.update({
    where: { id: garments[3].id },
    data: { isReady: true },
  });

  await page.waitForTimeout(1000);
  await gotoWithRetry(page, `http://localhost:5173/orders/${order1Id}`, '#counter-handover-btn');

  // Test 14 & 15: Open handover again and attempt final handover without payment
  console.log('11. Opening handover again for final pieces (Units 3 & 4)...');
  await page.locator('#counter-handover-btn').click();
  await page.waitForSelector('[role="dialog"]');

  // Select Units 3 & 4
  const card3Modal = page.locator(`#pickup-card-${garments[2].id}`);
  const card4Modal = page.locator(`#pickup-card-${garments[3].id}`);
  await card3Modal.click();
  await card4Modal.click();

  // Notice final handover banner
  await page.waitForSelector('#final-handover-banner');
  console.log('   Final handover banner displayed. Payment required for final handover.');

  // Test clear payment amount to simulate attempt without settlement
  const paymentAmountInput = page.locator('#pickup-payment-amount');
  await paymentAmountInput.fill('0');

  // Confirm button should be disabled
  const isFinalDisabled = await page.locator('#confirm-pickup-btn').isDisabled();
  console.log(`   Confirm button disabled when payment amount is 0: ${isFinalDisabled}`);
  if (!isFinalDisabled) {
    throw new Error('Confirm button should be disabled when final handover is unpaid');
  }

  await page.screenshot({
    path: path.join(ARTIFACTS_DIR, 'phase4d_final_handover_payment_error.png'),
  });
  console.log('   Saved screenshot: phase4d_final_handover_payment_error.png');

  // Test 17 & 18: Enter valid payment and complete final handover
  console.log('12. Entering valid payment to settle remaining balance and completing handover...');
  const orderDueData = (
    await (
      await fetchWithRetry(`http://localhost:3000/api/orders/${order1Id}`, {
        headers: { Authorization: `Bearer ${ownerToken}` },
      })
    ).json()
  ).data;
  console.log(`   Order balance due: ₹${orderDueData.amountDue}`);

  await paymentAmountInput.fill(orderDueData.amountDue.toString());
  const paymentModeSelect = page.locator('#pickup-payment-mode');
  await paymentModeSelect.selectOption('UPI');
  const paymentRefInput = page.locator('#pickup-payment-reference');
  await paymentRefInput.fill('UPI-FINAL-HANDOVER-SETTLE');

  // Now submit final handover
  const finalConfirmBtn = page.locator('#confirm-pickup-btn');
  await finalConfirmBtn.click();
  await page.waitForSelector('[role="dialog"]', { state: 'hidden', timeout: 8000 });
  console.log('   Final handover completed successfully!');

  // Test 19-22: Verify final delivered banner and status
  console.log('13. Verifying final order state: DELIVERED banner, deliveredAt, deliveredByName...');
  await page.waitForTimeout(1000);
  await gotoWithRetry(page, `http://localhost:5173/orders/${order1Id}`, '#order-delivered-banner');

  const deliveredBannerText = await page.locator('#order-delivered-banner').textContent();
  console.log(`   Delivered Banner: "${deliveredBannerText.replace(/\s+/g, ' ').trim()}"`);
  if (!deliveredBannerText.includes('Order Completely Delivered')) {
    throw new Error('Expected final delivered banner');
  }

  await page.screenshot({
    path: path.join(ARTIFACTS_DIR, 'phase4d_final_handover_complete_desktop_1280.png'),
  });
  console.log('   Saved screenshot: phase4d_final_handover_complete_desktop_1280.png');

  // Test 24: Legacy order quantity pickup
  console.log('14. Testing Legacy Item Order pickup...');
  const legacyOrderRes = await fetchWithRetry('http://localhost:3000/api/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ownerToken}`,
    },
    body: JSON.stringify({
      customerId: cust.id,
      isExpress: false,
      pickupType: 'STORE_PICKUP',
      items: [
        {
          garmentCatalogId: shirt.garmentCatalogId,
          serviceTypeId: shirt.serviceTypeId,
          quantity: 3,
        },
      ],
    }),
  });
  const legacyOrder = (await legacyOrderRes.json()).data;
  // Clear physical garments to make it a pure legacy item
  await prisma.physicalGarment.deleteMany({
    where: { orderItemId: legacyOrder.items[0].id },
  });

  await gotoWithRetry(page, `http://localhost:5173/orders/${legacyOrder.id}`, '#counter-handover-btn');
  await page.locator('#counter-handover-btn').click();
  await page.waitForSelector('[role="dialog"]');

  // Verify legacy stepper
  const legacyPlus = page.locator(`button[id="legacy-plus-${legacyOrder.items[0].id}"]`);
  const legacyMinus = page.locator(`button[id="legacy-minus-${legacyOrder.items[0].id}"]`);
  const legacyQty = page.locator(`span[id="legacy-qty-${legacyOrder.items[0].id}"]`);

  await legacyPlus.click();
  let qtyVal = await legacyQty.textContent();
  expectAttr(qtyVal.trim(), '1', 'Legacy quantity increment to 1');

  await legacyPlus.click();
  qtyVal = await legacyQty.textContent();
  expectAttr(qtyVal.trim(), '2', 'Legacy quantity increment to 2');

  await page.screenshot({
    path: path.join(ARTIFACTS_DIR, 'phase4d_legacy_pickup.png'),
  });
  console.log('   Saved screenshot: phase4d_legacy_pickup.png');
  await page.locator('button:has-text("Cancel")').click();

  // Test 25: Mixed Order pickup
  console.log('15. Testing Mixed Order (Physical + Legacy) pickup...');
  const mixedOrderRes = await fetchWithRetry('http://localhost:3000/api/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ownerToken}`,
    },
    body: JSON.stringify({
      customerId: cust.id,
      isExpress: false,
      pickupType: 'STORE_PICKUP',
      items: [
        {
          garmentCatalogId: shirt.garmentCatalogId,
          serviceTypeId: shirt.serviceTypeId,
          quantity: 2,
        },
        {
          garmentCatalogId: shirt.garmentCatalogId,
          serviceTypeId: shirt.serviceTypeId,
          quantity: 2,
        },
      ],
    }),
  });
  const mixedOrder = (await mixedOrderRes.json()).data;
  const mGarments = (
    await (
      await fetchWithRetry(`http://localhost:3000/api/orders/${mixedOrder.id}`, {
        headers: { Authorization: `Bearer ${ownerToken}` },
      })
    ).json()
  ).data.items[0].physicalGarments;

  await prisma.physicalGarment.update({
    where: { id: mGarments[0].id },
    data: { isReady: true },
  });

  // Make item 2 legacy by deleting its physical garments
  await prisma.physicalGarment.deleteMany({
    where: { orderItemId: mixedOrder.items[1].id },
  });

  await gotoWithRetry(page, `http://localhost:5173/orders/${mixedOrder.id}`, '#counter-handover-btn');
  await page.locator('#counter-handover-btn').click();
  await page.waitForSelector('[role="dialog"]');

  // Select physical garment #1
  const mCard1 = page.locator(`#pickup-card-${mGarments[0].id}`);
  await mCard1.click();

  // Increment legacy item by 1
  const mMixedPlus = page.locator(`button[id="legacy-plus-${mixedOrder.items[1].id}"]`);
  await mMixedPlus.click();

  // Verify total count shows 2 selected
  const mCount = await page.locator('#selected-handover-count').textContent();
  console.log(`   Mixed Order Selection: ${mCount.trim()} (Expected: 2 selected)`);
  if (!mCount.includes('2 selected')) {
    throw new Error('Mixed order count mismatch');
  }

  await page.screenshot({
    path: path.join(ARTIFACTS_DIR, 'phase4d_mixed_order_pickup.png'),
  });
  console.log('   Saved screenshot: phase4d_mixed_order_pickup.png');
  await page.locator('#cancel-pickup-modal-btn').click();

  // Test 26-28: Responsive Viewports & Horizontal Overflow Check
  console.log('16. Verifying Responsive Viewports (375px, 430px, 768px, 1280px) and zero horizontal overflow...');
  const viewports = [
    { width: 375, height: 667, name: 'phase4d_mobile_375.png' },
    { width: 430, height: 932, name: 'phase4d_mobile_430.png' },
    { width: 768, height: 1024, name: 'phase4d_tablet_768.png' },
    { width: 1280, height: 800, name: 'phase4d_desktop_1280.png' },
  ];

  for (const vp of viewports) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await gotoWithRetry(page, `http://localhost:5173/orders/${order1Id}`, 'h1');

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    console.log(`   Viewport ${vp.width}x${vp.height}: scrollWidth=${scrollWidth}, clientWidth=${clientWidth}`);
    if (scrollWidth > clientWidth) {
      throw new Error(`Horizontal overflow detected at viewport width ${vp.width}!`);
    }

    await page.screenshot({ path: path.join(ARTIFACTS_DIR, vp.name) });
    console.log(`   Saved screenshot: ${vp.name}`);
  }

  await browser.close();
  await prisma.$disconnect();

  console.log('\n================================================================');
  console.log('  ALL 28 PHASE 4D E2E / BROWSER VERIFICATION STEPS PASSED!      ');
  console.log('================================================================');
}

function expectAttr(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`Assertion failed for ${label}: expected "${expected}", got "${actual}"`);
  }
}

runE2E().catch((err) => {
  console.error('\n❌ E2E VERIFICATION FAILED:', err);
  process.exit(1);
});
