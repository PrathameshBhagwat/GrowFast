import { Card, Button, StatusChip } from '@growfast/ui';

export function OrderDetailPage() {
  // Placeholder mock data
  const order = {
    orderNumber: 'ORD-0001',
    status: 'RECEIVED',
    paymentStatus: 'PENDING',
    customerName: 'Alice Smith',
    customerPhone: '9876543210',
    totalAmount: 150,
    amountDue: 150,
    items: [
      { garmentName: 'Shirt', serviceType: 'WASH', quantity: 2, lineTotal: 100 },
      { garmentName: 'Trouser', serviceType: 'DRY_CLEAN', quantity: 1, lineTotal: 50 },
    ],
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{order.orderNumber}</h1>
          <div className="flex gap-2">
            <StatusChip status={order.status as any} />
            <span className="px-3 py-1 rounded-full text-sm font-semibold bg-yellow-100 text-yellow-800 border border-yellow-200">
              {order.paymentStatus}
            </span>
          </div>
        </div>
        <div className="flex gap-3">
          <Button variant="outline">Print Receipt</Button>
          <Button>Record Payment</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <h2 className="text-lg font-semibold mb-4">Customer Details</h2>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-500">Name</span>
              <span className="font-medium text-gray-900">{order.customerName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Phone</span>
              <span className="font-medium text-gray-900">{order.customerPhone}</span>
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold mb-4">Payment Summary</h2>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-500">Total Amount</span>
              <span className="font-medium text-gray-900">₹{order.totalAmount}</span>
            </div>
            <div className="flex justify-between pt-2 border-t">
              <span className="font-semibold text-gray-900">Amount Due</span>
              <span className="font-bold text-red-600">₹{order.amountDue}</span>
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <h2 className="text-lg font-semibold mb-4">Order Items</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="py-3 px-4 font-semibold text-gray-600">Item</th>
                <th className="py-3 px-4 font-semibold text-gray-600">Service</th>
                <th className="py-3 px-4 text-right font-semibold text-gray-600">Qty</th>
                <th className="py-3 px-4 text-right font-semibold text-gray-600">Total</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item, index) => (
                <tr key={index} className="border-b border-gray-100 last:border-0">
                  <td className="py-3 px-4 font-medium text-gray-900">{item.garmentName}</td>
                  <td className="py-3 px-4 text-gray-600">{item.serviceType}</td>
                  <td className="py-3 px-4 text-right">{item.quantity}</td>
                  <td className="py-3 px-4 text-right font-medium">₹{item.lineTotal}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
