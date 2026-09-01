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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Create New Order</h1>
        <span
          className={`px-3 py-1 rounded-full text-sm font-semibold border ${step === 3 ? 'bg-green-100 text-green-800 border-green-200' : 'bg-blue-100 text-blue-800 border-blue-200'}`}
        >
          Step {step} of 3
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div
          className={`p-4 rounded-lg border-2 ${step >= 1 ? 'border-primary-500 bg-primary-50' : 'border-gray-200'}`}
        >
          <div className="font-semibold text-gray-900">1. Customer Selection</div>
          <div className="text-sm text-gray-500">Search and select a customer</div>
        </div>
        <div
          className={`p-4 rounded-lg border-2 ${step >= 2 ? 'border-primary-500 bg-primary-50' : 'border-gray-200'}`}
        >
          <div className="font-semibold text-gray-900">2. Item Entry</div>
          <div className="text-sm text-gray-500">Add garments and services</div>
        </div>
        <div
          className={`p-4 rounded-lg border-2 ${step >= 3 ? 'border-primary-500 bg-primary-50' : 'border-gray-200'}`}
        >
          <div className="font-semibold text-gray-900">3. Review Order</div>
          <div className="text-sm text-gray-500">Confirm details before creation</div>
        </div>
      </div>

      <Card>
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Select Customer</h2>

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
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Add Items</h2>
            
            <ItemSelector 
              garments={garments}
              services={services}
              prices={prices}
              onAddItem={(item) => setItems((prev) => [...prev, item])}
            />

            {items.length > 0 && (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg border">
                <h3 className="font-semibold mb-2">Selected Items:</h3>
                <ul className="list-disc pl-5">
                  {items.map((item, idx) => (
                    <li key={idx} className="flex justify-between max-w-sm mb-1">
                      <span>{item.quantity}x {item.garmentName} ({item.serviceName})</span>
                      <span className="font-semibold">₹{(item.unitPrice * item.quantity).toFixed(2)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {storeConfig?.expressSurchargePercent != null && (
              <div className="mt-6 p-4 rounded-lg border-2 border-dashed border-orange-300 bg-orange-50">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isExpress}
                    onChange={(e) => setIsExpress(e.target.checked)}
                    className="w-5 h-5 rounded border-orange-400 text-orange-600 focus:ring-orange-500"
                  />
                  <div>
                    <span className="font-semibold text-orange-900">⚡ Express Service</span>
                    <p className="text-sm text-orange-700 mt-0.5">
                      {storeConfig.expressSurchargePercent}% surcharge · Faster turnaround (halved estimated days)
                    </p>
                  </div>
                </label>
              </div>
            )}
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
              expressSurchargePercent: storeConfig?.expressSurchargePercent ?? undefined 
            });

            return (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold">Review Order</h2>
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
                        <span>⚡ Express Surcharge ({storeConfig.expressSurchargePercent}%):</span>
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

        <div className="flex justify-between pt-6 border-t mt-6">
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
