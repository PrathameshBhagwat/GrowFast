import React, { useState } from 'react';
import { useStore } from '../store';
import { ExpenseCategory, ExpenseItem } from '../types';
import { 
  Receipt, 
  Plus, 
  IndianRupee, 
  Calendar, 
  Tag, 
  CreditCard, 
  TrendingDown, 
  FileText,
  Search
} from 'lucide-react';
import { Modal } from '../components/common/Modal';

export const ExpensesView: React.FC = () => {
  const { expenses, addExpense, currentUser } = useStore();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isAddExpenseModalOpen, setIsAddExpenseModalOpen] = useState(false);

  // New Expense form
  const [category, setCategory] = useState<ExpenseCategory>('detergent');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState<number>(1200);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'upi' | 'bank_transfer' | 'card'>('upi');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  const categories: { id: string; label: string }[] = [
    { id: 'all', label: 'All Expenses' },
    { id: 'detergent', label: 'Detergent & Chemicals' },
    { id: 'packaging', label: 'Packaging & Bags' },
    { id: 'electricity', label: 'Power & Boiler' },
    { id: 'rent', label: 'Store Lease' },
    { id: 'maintenance', label: 'Equipment Repair' },
    { id: 'salary', label: 'Staff Salaries' }
  ];

  const filteredExpenses = expenses.filter(e => 
    selectedCategory === 'all' || e.category === selectedCategory
  );

  const totalExpenseAmount = expenses.reduce((acc, e) => acc + e.amount, 0);

  const handleCreateExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || amount <= 0) return;

    addExpense({
      date,
      category,
      description: description.trim(),
      amount,
      paymentMethod,
      recordedBy: currentUser.name
    });

    setIsAddExpenseModalOpen(false);
    setDescription('');
    setAmount(1000);
  };

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div className="page-title-group">
          <h1 className="page-title">Store Expense & Overhead Ledger</h1>
          <p className="page-subtitle">
            Track operational consumables, monthly utilities, chemical supplies & staff payouts
          </p>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={() => setIsAddExpenseModalOpen(true)}>
            <Plus size={16} /> Log New Expense
          </button>
        </div>
      </div>

      {/* Expense KPI Metrics */}
      <div className="metric-grid">
        <div className="metric-card">
          <div className="metric-top">
            <span className="metric-label">Month-to-Date Expenses</span>
            <div className="metric-icon-box" style={{ backgroundColor: 'var(--danger-bg)', color: 'var(--danger-text)' }}>
              <TrendingDown size={20} />
            </div>
          </div>
          <div className="metric-value" style={{ color: 'var(--danger-text)' }}>
            ₹{totalExpenseAmount.toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--slate-500)' }}>
            {expenses.length} verified voucher entries
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-top">
            <span className="metric-label">Chemicals & Consumables</span>
            <div className="metric-icon-box" style={{ backgroundColor: 'var(--primary-50)', color: 'var(--primary-600)' }}>
              <Tag size={20} />
            </div>
          </div>
          <div className="metric-value">
            ₹{expenses.filter(e => ['detergent', 'packaging'].includes(e.category)).reduce((a, b) => a + b.amount, 0).toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--slate-500)' }}>
            Detergents, solvent drums & bags
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-top">
            <span className="metric-label">Utilities & Maintenance</span>
            <div className="metric-icon-box" style={{ backgroundColor: 'var(--warning-bg)', color: 'var(--warning-text)' }}>
              <Receipt size={20} />
            </div>
          </div>
          <div className="metric-value">
            ₹{expenses.filter(e => ['electricity', 'maintenance', 'water'].includes(e.category)).reduce((a, b) => a + b.amount, 0).toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--slate-500)' }}>
            Power, steam valve repair & filtration
          </div>
        </div>
      </div>

      {/* Category Tabs */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
        <div className="tabs-nav" style={{ border: 'none', padding: 0 }}>
          {categories.map(cat => (
            <button
              key={cat.id}
              className={`tab-btn ${selectedCategory === cat.id ? 'active' : ''}`}
              onClick={() => setSelectedCategory(cat.id)}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Expenses Ledger Table */}
      <div className="data-table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Category</th>
              <th>Description & Details</th>
              <th>Payment Mode</th>
              <th>Logged By</th>
              <th style={{ textAlign: 'right' }}>Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
            {filteredExpenses.map(exp => (
              <tr key={exp.id}>
                <td>
                  <div style={{ fontSize: '11.5px', color: 'var(--slate-600)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Calendar size={12} /> {exp.date}
                  </div>
                </td>
                <td>
                  <span className="badge badge-purple" style={{ textTransform: 'capitalize' }}>
                    {exp.category}
                  </span>
                </td>
                <td>
                  <div style={{ fontWeight: 600, color: 'var(--slate-900)' }}>{exp.description}</div>
                </td>
                <td>
                  <span className="badge badge-neutral" style={{ textTransform: 'uppercase', fontSize: '9.5px' }}>
                    {exp.paymentMethod}
                  </span>
                </td>
                <td>
                  <span style={{ fontSize: '11px', color: 'var(--slate-600)' }}>{exp.recordedBy}</span>
                </td>
                <td style={{ textAlign: 'right', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--slate-900)' }}>
                  ₹{exp.amount.toLocaleString('en-IN')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add Expense Modal */}
      <Modal
        isOpen={isAddExpenseModalOpen}
        onClose={() => setIsAddExpenseModalOpen(false)}
        title="Record Operational Store Expense"
        subtitle="Voucher will be synced into store daily cashflow ledger"
        size="md"
      >
        <form onSubmit={handleCreateExpense}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div className="form-group">
                <label className="form-label">Expense Category</label>
                <select
                  className="form-select"
                  value={category}
                  onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
                >
                  <option value="detergent">Detergent & Chemicals</option>
                  <option value="packaging">Packaging Bags & Hangers</option>
                  <option value="electricity">Electricity / Boiler Power</option>
                  <option value="water">Water Filtration</option>
                  <option value="maintenance">Equipment Maintenance</option>
                  <option value="rent">Premises Rent</option>
                  <option value="salary">Staff Salary / Wage</option>
                  <option value="transport">Transport / Fuel</option>
                  <option value="other">Other Supplies</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Date</label>
                <input
                  type="date"
                  className="form-input"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Description / Supplier Bill Details *</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. 50L Drum Hydrocarbon Solvent from ChemClean..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div className="form-group">
                <label className="form-label">Amount (₹) *</label>
                <input
                  type="number"
                  min="1"
                  className="form-input form-input-mono"
                  value={amount}
                  onChange={(e) => setAmount(parseInt(e.target.value) || 0)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Payment Method</label>
                <select
                  className="form-select"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as any)}
                >
                  <option value="upi">UPI / GPay</option>
                  <option value="bank_transfer">Direct Bank Transfer</option>
                  <option value="cash">Petty Cash</option>
                  <option value="card">Company Debit Card</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setIsAddExpenseModalOpen(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                Save Expense Voucher
              </button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
};
