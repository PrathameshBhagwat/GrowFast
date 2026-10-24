import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
} from 'react-native';
import {
  CreateOrderItemRequest,
  ServiceCategory,
  PickupType,
} from '@growfast/shared-types';
import { OrderDraft, saveDraft, queueDraftForSync, generateUUID } from '../db/drafts';
import { getPhotosForDraft, PendingPhoto } from '../db/photos';
import { PhotoQueueView } from './PhotoQueueView';

interface DraftEditorModalProps {
  visible: boolean;
  draft: OrderDraft | null;
  storeId: string;
  onClose: () => void;
  onSaved: () => void;
}

export function DraftEditorModal({
  visible,
  draft,
  storeId,
  onClose,
  onSaved,
}: DraftEditorModalProps) {
  const [clientDraftId, setClientDraftId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [workflowType, setWorkflowType] = useState('LAUNDRY');
  const [pickupType, setPickupType] = useState<PickupType>(PickupType.STORE_PICKUP);
  const [isExpress, setIsExpress] = useState(false);
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<CreateOrderItemRequest[]>([]);
  const [photos, setPhotos] = useState<PendingPhoto[]>([]);

  // Item intake fields
  const [itemName, setItemName] = useState('');
  const [itemQuantity, setItemQuantity] = useState('1');
  const [itemService, setItemService] = useState<ServiceCategory>(ServiceCategory.WASH_IRON);

  useEffect(() => {
    if (visible) {
      if (draft) {
        setClientDraftId(draft.clientDraftId);
        setCustomerName(draft.customerName || '');
        setCustomerPhone(draft.customerPhone || '');
        setWorkflowType(draft.workflowType || 'LAUNDRY');
        setPickupType((draft.pickupType as PickupType) || PickupType.STORE_PICKUP);
        setIsExpress(draft.isExpress);
        setNotes(draft.notes || '');
        setItems(draft.payload.items || []);
        getPhotosForDraft(draft.clientDraftId).then(setPhotos);
      } else {
        const newDraftId = generateUUID();
        setClientDraftId(newDraftId);
        setCustomerName('');
        setCustomerPhone('');
        setWorkflowType('LAUNDRY');
        setPickupType(PickupType.STORE_PICKUP);
        setIsExpress(false);
        setNotes('');
        setItems([]);
        setPhotos([]);
      }
    }
  }, [visible, draft]);

  const refreshPhotos = async () => {
    if (clientDraftId) {
      const updated = await getPhotosForDraft(clientDraftId);
      setPhotos(updated);
    }
  };

  const handleAddItem = () => {
    if (!itemName.trim()) {
      Alert.alert('Validation', 'Please enter an item name (e.g. Shirt, Trousers)');
      return;
    }
    const qty = parseInt(itemQuantity, 10);
    if (isNaN(qty) || qty < 1) {
      Alert.alert('Validation', 'Quantity must be at least 1');
      return;
    }

    const newItem: CreateOrderItemRequest = {
      garmentCatalogId: 'cat-garment-default',
      serviceTypeId: itemService,
      quantity: qty,
      unitPrice: 50,
      defectNotes: itemName.trim(),
    };

    setItems([...items, newItem]);
    setItemName('');
    setItemQuantity('1');
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const validateDraft = (): boolean => {
    if (!customerName.trim()) {
      Alert.alert('Validation', 'Customer Name is required');
      return false;
    }
    if (!customerPhone.trim() || customerPhone.replace(/\D/g, '').length < 10) {
      Alert.alert('Validation', 'Please provide a valid 10-digit mobile number');
      return false;
    }
    if (items.length === 0) {
      Alert.alert('Validation', 'Please add at least one order item');
      return false;
    }
    return true;
  };

  const handleSaveAsDraft = async () => {
    if (!validateDraft()) return;

    try {
      await saveDraft({
        clientDraftId,
        storeId,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        workflowType,
        pickupType,
        isExpress,
        notes: notes.trim() || null,
        payload: {
          clientDraftId,
          customerId: draft?.customerId || 'cust-offline-temp',
          isExpress,
          pickupType,
          notes: notes.trim() || undefined,
          items,
        },
      });
      onSaved();
      onClose();
    } catch (err: any) {
      Alert.alert('Save Error', err.message);
    }
  };

  const handleSubmitAndQueue = async () => {
    if (!validateDraft()) return;

    try {
      await saveDraft({
        clientDraftId,
        storeId,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        workflowType,
        pickupType,
        isExpress,
        notes: notes.trim() || null,
        payload: {
          clientDraftId,
          customerId: draft?.customerId || 'cust-offline-temp',
          isExpress,
          pickupType,
          notes: notes.trim() || undefined,
          items,
        },
      });

      await queueDraftForSync(clientDraftId);
      onSaved();
      onClose();
    } catch (err: any) {
      Alert.alert('Queue Error', err.message);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>
            {draft ? 'Edit Order Draft' : 'New Order Draft'}
          </Text>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
            accessible={true}
            accessibilityLabel="Close draft editor"
          >
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.body} contentContainerStyle={styles.scrollContent}>
          {/* Customer Details */}
          <Text style={styles.sectionHeading}>Customer Details</Text>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Customer Name *</Text>
            <TextInput
              style={styles.textInput}
              value={customerName}
              onChangeText={setCustomerName}
              placeholder="e.g. Ramesh Kumar"
              placeholderTextColor="#94a3b8"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Mobile / WhatsApp Number *</Text>
            <TextInput
              style={styles.textInput}
              value={customerPhone}
              onChangeText={setCustomerPhone}
              placeholder="e.g. 9876543210"
              keyboardType="phone-pad"
              placeholderTextColor="#94a3b8"
            />
          </View>

          {/* Workflow & Options */}
          <Text style={styles.sectionHeading}>Order Options</Text>
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Workflow: {workflowType}</Text>
            <View style={styles.badgeToggle}>
              <TouchableOpacity
                style={[
                  styles.badgeOption,
                  workflowType === 'LAUNDRY' && styles.badgeOptionActive,
                ]}
                onPress={() => setWorkflowType('LAUNDRY')}
              >
                <Text
                  style={[
                    styles.badgeOptionText,
                    workflowType === 'LAUNDRY' && styles.badgeOptionTextActive,
                  ]}
                >
                  Laundry
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.badgeOption,
                  workflowType === 'DRY_CLEANING' && styles.badgeOptionActive,
                ]}
                onPress={() => setWorkflowType('DRY_CLEANING')}
              >
                <Text
                  style={[
                    styles.badgeOptionText,
                    workflowType === 'DRY_CLEANING' && styles.badgeOptionTextActive,
                  ]}
                >
                  Dry Clean
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Express Turnaround (1.5x / 2.0x)</Text>
            <Switch
              value={isExpress}
              onValueChange={setIsExpress}
              trackColor={{ false: '#cbd5e1', true: '#93c5fd' }}
              thumbColor={isExpress ? '#2563eb' : '#f8fafc'}
            />
          </View>

          {/* Order Items */}
          <Text style={styles.sectionHeading}>Order Items ({items.length})</Text>
          <View style={styles.addItemCard}>
            <TextInput
              style={[styles.textInput, { marginBottom: 8 }]}
              value={itemName}
              onChangeText={setItemName}
              placeholder="Garment (e.g. Shirt, Kurta, Saree)"
              placeholderTextColor="#94a3b8"
            />
            <View style={styles.addItemRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.subLabel}>Qty</Text>
                <TextInput
                  style={[styles.textInput, { height: 44 }]}
                  value={itemQuantity}
                  onChangeText={setItemQuantity}
                  keyboardType="numeric"
                />
              </View>
              <TouchableOpacity style={styles.addItemBtn} onPress={handleAddItem}>
                <Text style={styles.addItemBtnText}>+ Add Item</Text>
              </TouchableOpacity>
            </View>
          </View>

          {items.map((it, idx) => (
            <View key={idx} style={styles.itemRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemNameText}>{it.defectNotes || 'Garment Item'}</Text>
                <Text style={styles.itemMetaText}>
                  {it.serviceTypeId} • {it.quantity} pc(s)
                </Text>
              </View>
              <TouchableOpacity
                style={styles.removeItemBtn}
                onPress={() => handleRemoveItem(idx)}
              >
                <Text style={styles.removeItemText}>Remove</Text>
              </TouchableOpacity>
            </View>
          ))}

          {/* Photos */}
          <PhotoQueueView
            clientDraftId={clientDraftId}
            photos={photos}
            onPhotosChanged={refreshPhotos}
          />

          {/* Notes */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Staff Notes</Text>
            <TextInput
              style={[styles.textInput, { height: 70 }]}
              value={notes}
              onChangeText={setNotes}
              placeholder="e.g. Stains on collar, urgent request"
              placeholderTextColor="#94a3b8"
              multiline
            />
          </View>
        </ScrollView>

        {/* Footer Actions */}
        <View style={styles.footer}>
          <TouchableOpacity style={styles.saveDraftBtn} onPress={handleSaveAsDraft}>
            <Text style={styles.saveDraftBtnText}>Save Draft</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.queueSyncBtn} onPress={handleSubmitAndQueue}>
            <Text style={styles.queueSyncBtnText}>Submit & Queue Sync</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  closeButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontSize: 20,
    color: '#64748b',
  },
  body: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  sectionHeading: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1e293b',
    marginTop: 16,
    marginBottom: 8,
  },
  inputGroup: {
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 4,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0f172a',
    backgroundColor: '#f8fafc',
    minHeight: 44,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  toggleLabel: {
    fontSize: 14,
    color: '#334155',
    fontWeight: '500',
  },
  badgeToggle: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    padding: 2,
  },
  badgeOption: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    minHeight: 44,
    justifyContent: 'center',
  },
  badgeOptionActive: {
    backgroundColor: '#3b82f6',
  },
  badgeOptionText: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
  },
  badgeOptionTextActive: {
    color: '#ffffff',
  },
  addItemCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 12,
  },
  addItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
  },
  subLabel: {
    fontSize: 11,
    color: '#64748b',
    marginBottom: 2,
  },
  addItemBtn: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 16,
    borderRadius: 8,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addItemBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    marginBottom: 8,
  },
  itemNameText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
  },
  itemMetaText: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  removeItemBtn: {
    paddingHorizontal: 8,
    paddingVertical: 8,
    minHeight: 44,
    minWidth: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeItemText: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    gap: 12,
    backgroundColor: '#ffffff',
  },
  saveDraftBtn: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    minHeight: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  saveDraftBtnText: {
    color: '#334155',
    fontSize: 14,
    fontWeight: '600',
  },
  queueSyncBtn: {
    flex: 1,
    backgroundColor: '#2563eb',
    minHeight: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  queueSyncBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
});
