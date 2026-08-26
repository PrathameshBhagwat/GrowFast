import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, Button, LoadingState, ErrorState } from '@growfast/ui';
import { useAuth } from '../contexts/AuthContext';
import { CustomerDTO, calculateOrderTotals, PricingItemInput } from '@growfast/shared-types';

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
  const [prices, setPrices] = useState<any[]>([]);

  useEffect(() => {
    if (token) {
      fetch(`${API_URL}/pricing`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => res.json())
        .then((body) => {
          if (body.success) setPrices(body.data);
        })
        .catch((err) => console.error('Failed to load pricing:', err));
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
        isExpress: false,
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
              <div className="p-8 border-2 border-dashed border-gray-300 rounded-lg text-center">
                <p className="text-gray-500 mb-4">Customer search component will go here.</p>
                <Button
                  onClick={() => {
                    setSelectedCustomerId('cust-003');
                    setCustomer({
                      id: 'cust-003',
                      name: 'Amit Shah',
                      phone: '+919811122334',
                      email: 'amit.shah@techcorp.in',
                    } as any);
                  }}
                >
                  Select Mock Customer
                </Button>
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Add Items</h2>
            <div className="p-8 border-2 border-dashed border-gray-300 rounded-lg text-center">
              <p className="text-gray-500 mb-4">Item catalog and selection will go here.</p>
              <Button
                onClick={() =>
                  setItems([
                    {
                      garmentCatalogId: 'garment-shirt',
                      serviceTypeId: 'svc-wash',
                      quantity: 2,
                      garmentName: 'Shirt',
                      serviceName: 'Wash',
                    },
                  ])
                }
              >
                Add Mock Item
              </Button>
            </div>
            {items.length > 0 && (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg border">
                <h3 className="font-semibold mb-2">Selected Items:</h3>
                <ul className="list-disc pl-5">
                  {items.map((item, idx) => (
                    <li key={idx}>
                      {item.quantity}x {item.garmentName} ({item.serviceName})
                    </li>
                  ))}
                </ul>
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
            const totals = calculateOrderTotals(pricingInputs);

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
