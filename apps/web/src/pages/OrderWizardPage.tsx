import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, Button, LoadingState, ErrorState } from '@growfast/ui';
import { useAuth } from '../contexts/AuthContext';
import { CustomerDTO, calculateOrderTotals, PricingItemInput } from '@growfast/shared-types';
import { CustomerSelector } from '../components/CustomerSelector';
import { ItemSelector } from '../components/ItemSelector';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export function OrderWizardPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialCustomerId = searchParams.get('customerId');
  const { token } = useAuth();

  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(initialCustomerId);
  const [customer, setCustomer] = useState<CustomerDTO | null>(null);
  const [customerLoading, setCustomerLoading] = useState(!!initialCustomerId);
  const [customerError, setCustomerError] = useState<string | null>(null);

  const [selectedItemConfig, setSelectedItemConfig] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [garments, setGarments] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [prices, setPrices] = useState<any[]>([]);
  const [isExpress, setIsExpress] = useState(false);
  const [storeConfig, setStoreConfig] = useState<any>(null);

  useEffect(() => {
    if (token) {
      fetch(`${API_URL}/store/config`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => res.json())
        .then((body) => {
          setStoreConfig(body);
        })
        .catch((err) => console.error('Failed to load store config:', err));
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      Promise.all([
        fetch(`${API_URL}/pricing`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/garments`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/services`, { headers: { Authorization: `Bearer ${token}` } }),
      ])
        .then(async ([resPricing, resGarments, resServices]) => {
          const bodyPricing = await resPricing.json();
          const bodyGarments = await resGarments.json();
          const bodyServices = await resServices.json();

          if (bodyPricing.success) setPrices(bodyPricing.data);
          if (bodyGarments.success) setGarments(bodyGarments.data);
          if (bodyServices.success) setServices(bodyServices.data);
        })
        .catch((err) => console.error('Failed to load catalog data:', err));
    }
  }, [token]);

  useEffect(() => {
    if (initialCustomerId && token) {
      const fetchCustomer = async () => {
        try {
          const res = await fetch(`${API_URL}/customers/${initialCustomerId}`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
          if (!res.ok) {
            throw new Error(`Failed to load customer (${res.status})`);
          }
          const body = await res.json();
          setCustomer(body.data);
          setSelectedCustomerId(body.data.id);
        } catch (err: any) {
          setCustomerError(err.message || 'Failed to load customer');
          setSelectedCustomerId(null);
        } finally {
          setCustomerLoading(false);
        }
      };
      fetchCustomer();
    }
  }, [initialCustomerId, token]);

  const handleNext = () => setStep((s) => Math.min(s + 1, 3));
  const handlePrev = () => setStep((s) => Math.max(s - 1, 1));

  const handleCreateOrder = async () => {
    if (!selectedCustomerId || items.length === 0) return;

    setIsSubmitting(true);
    try {
      const payload = {
        customerId: selectedCustomerId,
        isExpress,
        pickupType: 'STORE_PICKUP',
        items: items.map((item) => ({
          garmentCatalogId: item.garmentCatalogId,
          serviceTypeId: item.serviceTypeId,
          quantity: item.quantity,
        })),
        notes: 'Created via wizard mock',
      };

      const res = await fetch(`${API_URL}/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(`Failed to create order (${res.status})`);
      }

      const body = await res.json();
      navigate(`/orders/${body.data.id}`);
    } catch (err: any) {
      alert(`Error creating order: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50 p-4 md:p-6 overflow-hidden">
      <div className="flex items-center justify-between shrink-0 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Create New Order</h1>
        <span
          className={`px-3 py-1 rounded-full text-sm font-semibold border ${step === 3 ? 'bg-green-100 text-green-800 border-green-200' : 'bg-blue-100 text-blue-800 border-blue-200'}`}
        >
          Step {step} of 3
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 shrink-0">
        <div
          className={`p-4 rounded-lg border-2 ${step >= 1 ? 'border-primary-500 bg-primary-50' : 'border-gray-200 bg-white'}`}
        >
          <div className="font-semibold text-gray-900">1. Customer Selection</div>
          <div className="text-sm text-gray-500">Search and select a customer</div>
        </div>
        <div
          className={`p-4 rounded-lg border-2 ${step >= 2 ? 'border-primary-500 bg-primary-50' : 'border-gray-200 bg-white'}`}
        >
          <div className="font-semibold text-gray-900">2. Item Entry</div>
          <div className="text-sm text-gray-500">Add garments and services</div>
        </div>
        <div
          className={`p-4 rounded-lg border-2 ${step >= 3 ? 'border-primary-500 bg-primary-50' : 'border-gray-200 bg-white'}`}
        >
          <div className="font-semibold text-gray-900">3. Review Order</div>
          <div className="text-sm text-gray-500">Confirm details before creation</div>
        </div>
      </div>

      <Card className="flex-1 flex flex-col min-h-0 overflow-hidden" padding="none">
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-gray-50">
          {step === 1 && (
            <div className="p-6 h-full overflow-y-auto bg-white">
              <h2 className="text-xl font-semibold mb-4">Select Customer</h2>

              {customerLoading ? (
                <LoadingState message="Loading customer details..." />
              ) : customerError ? (
                <ErrorState
                  message={customerError}
                  onRetry={() => {
                    setCustomerError(null);
                    setSelectedCustomerId(null);
                  }}
                />
              ) : customer ? (
                <div className="p-4 border rounded-lg bg-green-50 border-green-200">
                  <h3 className="font-semibold text-green-900 text-lg">{customer.name}</h3>
                  <p className="text-green-700">{customer.phone}</p>
                  <p className="text-green-700">{customer.email}</p>
                  <div className="mt-4 flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setCustomer(null);
                        setSelectedCustomerId(null);
                      }}
                    >
                      Change Customer
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="p-4 border-2 border-dashed border-gray-300 rounded-lg">
                  <CustomerSelector
                    onSelect={(c) => {
                      setCustomer(c);
                      setSelectedCustomerId(c.id);
                    }}
                  />
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col h-full bg-gray-50">
              <div className="p-4 border-b shrink-0 bg-white">
                <h2 className="text-xl font-semibold">Add Items</h2>
              </div>

              <div className="flex flex-col md:flex-row p-4 gap-4 flex-1 min-h-0">
                {/* Left Side: Catalog (Scrollable within ItemSelector) */}
                <div className="flex-1 flex flex-col min-w-0 bg-white border rounded-lg shadow-sm overflow-hidden">
                  <ItemSelector
                    garments={garments}
                    services={services}
                    prices={prices}
                    selectedGarmentId={selectedItemConfig?.garmentCatalogId}
                    onGarmentSelect={(garment, serviceId, unitPrice) => {
                      setSelectedItemConfig({
                        garmentCatalogId: garment.id,
                        serviceTypeId: serviceId,
                        garmentName: garment.name,
                        serviceName: services.find((s) => s.id === serviceId)?.name || 'Unknown',
                        unitPrice,
                        quantity: 1,
                        topUpService: '',
                        brand: '',
                        defectNotes: '',
                        colorTags: '',
                      });
                    }}
                  />
                </div>

                {/* Right Side: Order Summary / Bill OR Item Configurator */}
                <div className="w-full md:w-80 bg-gray-50 border rounded-lg flex flex-col shrink-0 overflow-hidden">
                  {selectedItemConfig ? (
                    // --- ITEM CONFIGURATOR ---
                    <>
                      <div className="p-4 border-b bg-white">
                        <h3 className="font-bold text-lg text-gray-900">Configuring Item</h3>
                        <div className="text-sm text-gray-500">
                          {selectedItemConfig.garmentName} • {selectedItemConfig.serviceName}
                        </div>
                      </div>

                      <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {/* Quantity & Price */}
                        <div className="flex items-center justify-between">
                          <div className="flex flex-col">
                            <span className="text-sm font-semibold text-gray-700">Quantity</span>
                            <div className="flex items-center border rounded mt-1 bg-white">
                              <button
                                className="w-12 h-12 flex items-center justify-center text-gray-600 hover:bg-gray-100 active:bg-gray-200"
                                onClick={() =>
                                  setSelectedItemConfig({
                                    ...selectedItemConfig,
                                    quantity: Math.max(1, selectedItemConfig.quantity - 1),
                                  })
                                }
                              >
                                -
                              </button>
                              <span className="w-10 text-center font-bold">
                                {selectedItemConfig.quantity}
                              </span>
                              <button
                                className="w-12 h-12 flex items-center justify-center text-gray-600 hover:bg-gray-100 active:bg-gray-200"
                                onClick={() =>
                                  setSelectedItemConfig({
                                    ...selectedItemConfig,
                                    quantity: selectedItemConfig.quantity + 1,
                                  })
                                }
                              >
                                +
                              </button>
                            </div>
                          </div>

                          <div className="flex flex-col items-end">
                            <span className="text-sm font-semibold text-gray-700">Price</span>
                            <span className="text-xl font-bold text-gray-900 mt-2">
                              ₹
                              {(selectedItemConfig.unitPrice * selectedItemConfig.quantity).toFixed(
                                2,
                              )}
                            </span>
                          </div>
                        </div>

                        {/* Details */}
                        <div className="space-y-3 pt-2 border-t">
                          <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1">
                              Top Up Service
                            </label>
                            <input
                              type="text"
                              className="w-full border rounded-md px-3 py-2 text-sm min-h-[44px]"
                              placeholder="e.g. Starching"
                              value={selectedItemConfig.topUpService}
                              onChange={(e) =>
                                setSelectedItemConfig({
                                  ...selectedItemConfig,
                                  topUpService: e.target.value,
                                })
                              }
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1">
                              Brand
                            </label>
                            <input
                              type="text"
                              className="w-full border rounded-md px-3 py-2 text-sm min-h-[44px]"
                              placeholder="e.g. Zara"
                              value={selectedItemConfig.brand}
                              onChange={(e) =>
                                setSelectedItemConfig({
                                  ...selectedItemConfig,
                                  brand: e.target.value,
                                })
                              }
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1">
                              Defects / Description
                            </label>
                            <input
                              type="text"
                              className="w-full border rounded-md px-3 py-2 text-sm min-h-[44px]"
                              placeholder="e.g. Missing button"
                              value={selectedItemConfig.defectNotes}
                              onChange={(e) =>
                                setSelectedItemConfig({
                                  ...selectedItemConfig,
                                  defectNotes: e.target.value,
                                })
                              }
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1">
                              Colors
                            </label>
                            <input
                              type="text"
                              className="w-full border rounded-md px-3 py-2 text-sm min-h-[44px]"
                              placeholder="e.g. Blue, White"
                              value={selectedItemConfig.colorTags}
                              onChange={(e) =>
                                setSelectedItemConfig({
                                  ...selectedItemConfig,
                                  colorTags: e.target.value,
                                })
                              }
                            />
                          </div>
                        </div>
                      </div>

                      <div className="p-4 border-t bg-white flex gap-2">
                        <button
                          className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-lg hover:bg-gray-200 active:bg-gray-300 min-h-[44px]"
                          onClick={() => setSelectedItemConfig(null)}
                        >
                          Close
                        </button>
                        <button
                          className="flex-1 py-3 bg-primary-600 text-white font-bold rounded-lg hover:bg-primary-700 active:bg-primary-800 min-h-[44px]"
                          onClick={() => {
                            setItems((prev) => {
                              // If similar item exists, merge? Or just append. Let's append to keep details separate if they differ.
                              // But if it's the exact same item without details, we could merge.
                              // For POS, appending is safer if they add notes.
                              const newItem = {
                                garmentCatalogId: selectedItemConfig.garmentCatalogId,
                                serviceTypeId: selectedItemConfig.serviceTypeId,
                                garmentName: selectedItemConfig.garmentName,
                                serviceName: selectedItemConfig.serviceName,
                                unitPrice: selectedItemConfig.unitPrice,
                                quantity: selectedItemConfig.quantity,
                                defectNotes: selectedItemConfig.defectNotes,
                                colorTags: selectedItemConfig.colorTags
                                  ? selectedItemConfig.colorTags
                                      .split(',')
                                      .map((s: string) => s.trim())
                                  : [],
                              };
                              return [...prev, newItem];
                            });
                            setSelectedItemConfig(null);
                          }}
                        >
                          Add to Order
                        </button>
                      </div>
                    </>
                  ) : (
                    // --- BILL / CART SUMMARY ---
                    <>
                      <div className="p-4 border-b bg-white">
                        <h3 className="font-bold text-lg text-gray-900">Current Order</h3>
                      </div>

                      <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {items.length === 0 ? (
                          <div className="text-center text-gray-500 py-8">
                            <p>No items added yet.</p>
                            <p className="text-sm">Select items from the catalog.</p>
                          </div>
                        ) : (
                          items.map((item, idx) => (
                            <div
                              key={idx}
                              className="flex flex-col bg-white p-3 rounded border shadow-sm gap-2"
                            >
                              <div className="flex justify-between items-start text-sm">
                                <div className="flex flex-col">
                                  <span className="font-semibold text-gray-900">
                                    {item.garmentName}
                                  </span>
                                  <span className="text-gray-500 text-xs">{item.serviceName}</span>
                                </div>
                                <span className="font-bold text-gray-900">
                                  ₹{(item.unitPrice * item.quantity).toFixed(2)}
                                </span>
                              </div>

                              <div className="flex items-center justify-between mt-1">
                                <div className="flex items-center border rounded">
                                  <button
                                    className="w-11 h-11 flex items-center justify-center text-gray-600 hover:bg-gray-100 active:bg-gray-200"
                                    onClick={() => {
                                      if (item.quantity > 1) {
                                        setItems(
                                          items.map((i, currentIdx) =>
                                            currentIdx === idx
                                              ? { ...i, quantity: i.quantity - 1 }
                                              : i,
                                          ),
                                        );
                                      } else {
                                        setItems(items.filter((_, i) => i !== idx));
                                      }
                                    }}
                                  >
                                    -
                                  </button>
                                  <span className="w-8 text-center font-medium text-sm">
                                    {item.quantity}
                                  </span>
                                  <button
                                    className="w-11 h-11 flex items-center justify-center text-gray-600 hover:bg-gray-100 active:bg-gray-200"
                                    onClick={() => {
                                      setItems(
                                        items.map((i, currentIdx) =>
                                          currentIdx === idx
                                            ? { ...i, quantity: i.quantity + 1 }
                                            : i,
                                        ),
                                      );
                                    }}
                                  >
                                    +
                                  </button>
                                </div>

                                <button
                                  className="h-11 px-3 flex items-center justify-center text-red-500 text-xs font-semibold hover:bg-red-50 active:bg-red-100 rounded"
                                  onClick={() => setItems(items.filter((_, i) => i !== idx))}
                                >
                                  Remove
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>

                      {/* Footer Actions */}
                    </>
                  )}
                  {!selectedItemConfig && (
                    <div className="p-4 border-t bg-white rounded-b-lg shrink-0">
                      <div className="flex justify-between font-bold text-lg mb-4">
                        <span>Subtotal:</span>
                        <span>
                          ₹
                          {items
                            .reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)
                            .toFixed(2)}
                        </span>
                      </div>

                      {storeConfig?.expressSurchargePercent != null && (
                        <div className="mb-4 p-3 rounded-lg border-2 border-dashed border-orange-300 bg-orange-50">
                          <label className="flex items-center gap-3 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isExpress}
                              onChange={(e) => setIsExpress(e.target.checked)}
                              className="w-5 h-5 rounded border-orange-400 text-orange-600 focus:ring-orange-500"
                            />
                            <div className="flex flex-col">
                              <span className="font-semibold text-orange-900 text-sm">
                                ⚡ Express
                              </span>
                              <span className="text-xs text-orange-700">
                                +{storeConfig.expressSurchargePercent}% Surcharge
                              </span>
                            </div>
                          </label>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {step === 3 &&
            (() => {
              const pricingInputs: PricingItemInput[] = items.map((item) => {
                const p = prices.find(
                  (priceItem) =>
                    priceItem.garmentCatalogId === item.garmentCatalogId &&
                    priceItem.serviceTypeId === item.serviceTypeId,
                );
                return {
                  quantity: item.quantity,
                  unitPrice: p ? p.price : 0,
                };
              });
              const totals = calculateOrderTotals(pricingInputs, {
                isExpress,
                expressSurchargePercent: storeConfig?.expressSurchargePercent ?? undefined,
              });

              return (
                <div className="p-6 h-full overflow-y-auto bg-white">
                  <h2 className="text-xl font-semibold mb-4">Review Order</h2>
                  <div className="bg-gray-50 p-6 rounded-lg border">
                    <div className="space-y-2 mb-6 border-b pb-4">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Customer ID:</span>
                        <span className="font-medium">{selectedCustomerId || 'None'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Total Items:</span>
                        <span className="font-medium">
                          {items.reduce((s, i) => s + i.quantity, 0)}
                        </span>
                      </div>
                    </div>

                    <h3 className="font-semibold mb-3">Financial Breakdown</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Subtotal:</span>
                        <span>₹{totals.subtotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Discount:</span>
                        <span className="text-green-600">-₹{totals.discountAmount.toFixed(2)}</span>
                      </div>
                      {isExpress && storeConfig?.expressSurchargePercent != null && (
                        <div className="flex justify-between text-orange-700">
                          <span>
                            ⚡ Express Surcharge ({storeConfig.expressSurchargePercent}%):
                          </span>
                          <span>₹{totals.expressSurcharge.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-gray-600">GST (18%):</span>
                        <span>₹{totals.taxAmount.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between font-bold text-base pt-2 border-t mt-2">
                        <span>Total Amount:</span>
                        <span>₹{totals.totalAmount.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
        </div>

        <div className="flex justify-between p-4 border-t bg-white shrink-0">
          <Button variant="outline" onClick={handlePrev} disabled={step === 1}>
            Previous
          </Button>
          {step < 3 ? (
            <Button onClick={handleNext} disabled={step === 1 && !selectedCustomerId}>
              Next Step
            </Button>
          ) : (
            <Button
              variant="primary"
              onClick={handleCreateOrder}
              disabled={isSubmitting || items.length === 0}
            >
              {isSubmitting ? 'Creating...' : 'Create Order'}
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
