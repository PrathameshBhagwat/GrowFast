import { useState } from 'react';
import { Card, Button } from '@growfast/ui';

export function OrderWizardPage() {
  const [step, setStep] = useState(1);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [items, setItems] = useState<any[]>([]);

  const handleNext = () => setStep((s) => Math.min(s + 1, 3));
  const handlePrev = () => setStep((s) => Math.max(s - 1, 1));

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
            <div className="p-8 border-2 border-dashed border-gray-300 rounded-lg text-center">
              <p className="text-gray-500 mb-4">Customer search component will go here.</p>
              <Button onClick={() => setSelectedCustomerId('mock-customer-id')}>
                Select Mock Customer
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Add Items</h2>
            <div className="p-8 border-2 border-dashed border-gray-300 rounded-lg text-center">
              <p className="text-gray-500 mb-4">Item catalog and selection will go here.</p>
              <Button onClick={() => setItems([{ garment: 'Shirt', service: 'Wash', qty: 2 }])}>
                Add Mock Item
              </Button>
            </div>
            {items.length > 0 && (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg border">
                <h3 className="font-semibold mb-2">Selected Items:</h3>
                <ul className="list-disc pl-5">
                  {items.map((item, idx) => (
                    <li key={idx}>
                      {item.qty}x {item.garment} ({item.service})
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Review Order</h2>
            <div className="bg-gray-50 p-6 rounded-lg border">
              <div className="space-y-2 mb-6">
                <div className="flex justify-between">
                  <span className="text-gray-600">Customer ID:</span>
                  <span className="font-medium">{selectedCustomerId || 'None'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Items:</span>
                  <span className="font-medium">{items.reduce((s, i) => s + i.qty, 0)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-between pt-6 border-t mt-6">
          <Button variant="outline" onClick={handlePrev} disabled={step === 1}>
            Previous
          </Button>
          {step < 3 ? (
            <Button onClick={handleNext} disabled={step === 1 && !selectedCustomerId}>
              Next Step
            </Button>
          ) : (
            <Button variant="primary">Create Order</Button>
          )}
        </div>
      </Card>
    </div>
  );
}
