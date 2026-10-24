import React, { useState, useEffect, useCallback } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Alert, SafeAreaView } from 'react-native';
import {
  CustomerDTO,
  CreateOrderItemRequest,
  CreateOrderRequest,
  OrderWorkflowType,
  OrderEntryMode,
  PickupType,
  ExpressDeliveryOption,
  Role,
} from '@growfast/shared-types';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { OrderDraft, saveDraft, queueDraftForSync, generateUUID } from '../../db/drafts';
import { getPhotosForDraft, PendingPhoto } from '../../db/photos';
import { syncEngine } from '../../services/sync-engine';
import { apiClient } from '../../api/client';
import { CustomerStep } from './CustomerStep';
import { CatalogItemsStep } from './CatalogItemsStep';
import { OptionsStep } from './OptionsStep';
import { RequirementsStep } from './RequirementsStep';
import { ReviewConfirmStep } from './ReviewConfirmStep';

export type WizardStep = 'CUSTOMER' | 'CATALOG' | 'OPTIONS' | 'REQUIREMENTS' | 'REVIEW';

const STEPS: { key: WizardStep; label: string }[] = [
  { key: 'CUSTOMER', label: 'Customer' },
  { key: 'CATALOG', label: 'Items' },
  { key: 'OPTIONS', label: 'Options' },
  { key: 'REQUIREMENTS', label: 'Photos' },
  { key: 'REVIEW', label: 'Review' },
];

interface OrderWizardModalProps {
  visible: boolean;
  draft: OrderDraft | null;
  storeId: string;
  userRole?: string;
  onClose: () => void;
  onOrderSavedOrSubmitted: () => void;
}

export function OrderWizardModal({
  visible,
  draft,
  storeId,
  userRole,
  onClose,
  onOrderSavedOrSubmitted,
}: OrderWizardModalProps) {
  const { isConnected } = useNetworkStatus();
  const canModifyPrice = userRole === Role.OWNER || userRole === Role.MANAGER;

  // Wizard Navigation
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  // Form State
  const [clientDraftId, setClientDraftId] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerDTO | null>(null);
  const [manualCustomerName, setManualCustomerName] = useState('');
  const [manualCustomerPhone, setManualCustomerPhone] = useState('');
  const [workflow, setWorkflow] = useState<OrderWorkflowType>('LAUNDRY');
  const [entryMode, setEntryMode] = useState<OrderEntryMode>('PIECES');
  const [items, setItems] = useState<CreateOrderItemRequest[]>([]);
  const [pickupType, setPickupType] = useState<PickupType>(PickupType.STORE_PICKUP);
  const [expressOption, setExpressOption] = useState<ExpressDeliveryOption>(
    ExpressDeliveryOption.REGULAR,
  );
  const [notes, setNotes] = useState('');
  const [photos, setPhotos] = useState<PendingPhoto[]>([]);
  const [storeConfig, setStoreConfig] = useState<{
    expressSurchargePercent?: number | null;
  } | null>(null);

  // Fetch store config when online
  useEffect(() => {
    if (visible && isConnected) {
      apiClient.store
        .getConfig()
        .then(setStoreConfig)
        .catch(() => {});
    }
  }, [visible, isConnected]);

  // Initialize or restore state when modal becomes visible
  useEffect(() => {
    if (visible) {
      if (draft) {
        setClientDraftId(draft.clientDraftId);
        setManualCustomerName(draft.customerName || '');
        setManualCustomerPhone(draft.customerPhone || '');
        if (draft.customerId && draft.customerId !== 'cust-offline-temp') {
          setSelectedCustomer({
            id: draft.customerId,
            name: draft.customerName || '',
            phone: draft.customerPhone || '',
            email: null,
            address: null,
            pincode: null,
            membership: 'NONE' as any,
            discountPercent: 0,
            preferences: null,
            registrationSource: 'MOBILE_APP',
            createdAt: draft.createdAt,
            updatedAt: draft.updatedAt,
          });
        } else {
          setSelectedCustomer(null);
        }

        setWorkflow((draft.workflowType as OrderWorkflowType) || 'LAUNDRY');
        setPickupType((draft.pickupType as PickupType) || PickupType.STORE_PICKUP);
        setExpressOption(
          draft.payload?.expressDeliveryOption ||
            (draft.isExpress ? ExpressDeliveryOption.SAME_DAY : ExpressDeliveryOption.REGULAR),
        );
        setNotes(draft.notes || '');
        setItems(draft.payload?.items || []);
        getPhotosForDraft(draft.clientDraftId).then(setPhotos);
      } else {
        // Fresh draft
        const newDraftId = generateUUID();
        setClientDraftId(newDraftId);
        setSelectedCustomer(null);
        setManualCustomerName('');
        setManualCustomerPhone('');
        setWorkflow('LAUNDRY');
        setEntryMode('PIECES');
        setItems([]);
        setPickupType(PickupType.STORE_PICKUP);
        setExpressOption(ExpressDeliveryOption.REGULAR);
        setNotes('');
        setPhotos([]);
      }
      setCurrentStepIndex(0);
    }
  }, [visible, draft]);

  const refreshPhotos = useCallback(async () => {
    if (clientDraftId) {
      const updated = await getPhotosForDraft(clientDraftId);
      setPhotos(updated);
    }
  }, [clientDraftId]);

  // Build canonical CreateOrderRequest payload
  const buildOrderPayload = (): CreateOrderRequest => {
    const isExpress = expressOption !== ExpressDeliveryOption.REGULAR;
    return {
      clientDraftId,
      customerId: selectedCustomer?.id || draft?.customerId || 'cust-offline-temp',
      isExpress,
      expressDeliveryOption: expressOption,
      pickupType,
      workflow,
      entryMode,
      notes: notes.trim() || undefined,
      items: items.map((item) => {
        const pieceCount = item.quantity || 1;
        const pieces =
          item.pieces && item.pieces.length === pieceCount
            ? item.pieces
            : Array.from({ length: pieceCount }, (_, i) => ({
                unitNumber: i + 1,
                photoCount: photos.length > 0 ? 1 : 0,
              }));
        return {
          ...item,
          pieces,
        };
      }),
    };
  };

  // Persist draft to SQLite
  const persistDraftToStorage = async (statusOverride?: 'DRAFT' | 'QUEUED') => {
    const payload = buildOrderPayload();
    const custName = selectedCustomer?.name || manualCustomerName.trim() || null;
    const custPhone = selectedCustomer?.phone || manualCustomerPhone.trim() || null;

    await saveDraft({
      clientDraftId,
      storeId,
      customerId: selectedCustomer?.id || null,
      customerName: custName,
      customerPhone: custPhone,
      workflowType: workflow,
      pickupType,
      isExpress: expressOption !== ExpressDeliveryOption.REGULAR,
      notes: notes.trim() || null,
      payload,
    });
  };

  // Step Validation
  const validateStep = (stepIdx: number): boolean => {
    if (stepIdx === 0) {
      // Customer step
      if (!selectedCustomer && !manualCustomerName.trim()) {
        Alert.alert(
          'Customer Required',
          'Please select an existing customer or enter customer details.',
        );
        return false;
      }
      if (
        !selectedCustomer &&
        (!manualCustomerPhone.trim() || manualCustomerPhone.replace(/\D/g, '').length < 10)
      ) {
        Alert.alert('Phone Required', 'Please provide a valid 10-digit mobile number.');
        return false;
      }
    } else if (stepIdx === 1) {
      // Items step
      if (items.length === 0) {
        Alert.alert('Items Required', 'Please add at least one garment or laundry item.');
        return false;
      }
    }
    return true;
  };

  const handleNext = async () => {
    if (!validateStep(currentStepIndex)) return;

    // Auto-save progress to SQLite
    try {
      await persistDraftToStorage();
    } catch (err: any) {
      console.warn('Draft auto-save notice:', err.message);
    }

    if (currentStepIndex < STEPS.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
    }
  };

  const handleBack = async () => {
    // Auto-save progress before going back
    try {
      await persistDraftToStorage();
    } catch (err: any) {
      console.warn('Draft auto-save notice:', err.message);
    }

    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
    } else {
      // Step 0 back means close modal
      onClose();
    }
  };

  // Save as Draft (Stays in local DRAFT status)
  const handleSaveDraft = async () => {
    await persistDraftToStorage('DRAFT');
    onOrderSavedOrSubmitted();
  };

  // Submit Order (Syncs if online, queues if offline)
  const handleSubmitOrder = async () => {
    await persistDraftToStorage('QUEUED');
    await queueDraftForSync(clientDraftId);

    if (isConnected) {
      // Attempt immediate sync
      const syncResult = await syncEngine.syncDraft(clientDraftId);
      if (syncResult.success) {
        onOrderSavedOrSubmitted();
        return {
          success: true,
          orderId: syncResult.orderId,
          orderNumber: syncResult.orderNumber,
        };
      } else if (syncResult.isConflict) {
        return {
          success: false,
          isConflict: true,
          error: syncResult.error,
        };
      } else {
        return {
          success: false,
          error: syncResult.error || 'Server rejected submission',
        };
      }
    } else {
      // Offline: successfully queued
      onOrderSavedOrSubmitted();
      return {
        success: false,
        error: 'Order queued offline in local storage.',
      };
    }
  };

  const currentStep = STEPS[currentStepIndex];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <SafeAreaView style={styles.safeContainer}>
        {/* Top Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.headerBackBtn}
            onPress={handleBack}
            accessible={true}
            accessibilityLabel="Go back or close wizard"
          >
            <Text style={styles.headerBackText}>
              {currentStepIndex === 0 ? '✕ Cancel' : '‹ Back'}
            </Text>
          </TouchableOpacity>

          <Text style={styles.headerTitle}>{draft ? 'Edit Order Draft' : 'New Mobile Order'}</Text>

          <View style={styles.headerRightSpacer} />
        </View>

        {/* Step Progress Indicator */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBarRow}>
            {STEPS.map((step, idx) => (
              <View
                key={step.key}
                style={[
                  styles.progressSegment,
                  idx <= currentStepIndex
                    ? styles.progressSegmentFilled
                    : styles.progressSegmentEmpty,
                ]}
              />
            ))}
          </View>
          <View style={styles.stepLabelsRow}>
            {STEPS.map((step, idx) => (
              <Text
                key={step.key}
                style={[
                  styles.stepLabelText,
                  idx === currentStepIndex && styles.stepLabelTextActive,
                ]}
              >
                {step.label}
              </Text>
            ))}
          </View>
        </View>

        {/* Step Body */}
        <View style={styles.body}>
          {currentStep?.key === 'CUSTOMER' && (
            <CustomerStep
              selectedCustomer={selectedCustomer}
              onSelectCustomer={(cust) => {
                setSelectedCustomer(cust);
                setManualCustomerName(cust.name);
                setManualCustomerPhone(cust.phone);
              }}
              onClearCustomer={() => {
                setSelectedCustomer(null);
                setManualCustomerName('');
                setManualCustomerPhone('');
              }}
              manualCustomerName={manualCustomerName}
              manualCustomerPhone={manualCustomerPhone}
              onChangeManualDetails={(name, phone) => {
                setManualCustomerName(name);
                setManualCustomerPhone(phone);
              }}
              isConnected={isConnected}
            />
          )}

          {currentStep?.key === 'CATALOG' && (
            <CatalogItemsStep
              workflow={workflow}
              onWorkflowChange={setWorkflow}
              entryMode={entryMode}
              onEntryModeChange={setEntryMode}
              items={items}
              onItemsChange={setItems}
              canModifyPrice={canModifyPrice}
              isConnected={isConnected}
            />
          )}

          {currentStep?.key === 'OPTIONS' && (
            <OptionsStep
              pickupType={pickupType}
              onPickupTypeChange={setPickupType}
              expressOption={expressOption}
              onExpressOptionChange={setExpressOption}
              notes={notes}
              onNotesChange={setNotes}
            />
          )}

          {currentStep?.key === 'REQUIREMENTS' && (
            <RequirementsStep
              clientDraftId={clientDraftId}
              items={items}
              pickupType={pickupType}
              photos={photos}
              onPhotosChanged={refreshPhotos}
            />
          )}

          {currentStep?.key === 'REVIEW' && (
            <ReviewConfirmStep
              clientDraftId={clientDraftId}
              customer={selectedCustomer}
              manualCustomerName={manualCustomerName}
              manualCustomerPhone={manualCustomerPhone}
              workflow={workflow}
              pickupType={pickupType}
              expressOption={expressOption}
              items={items}
              notes={notes}
              photos={photos}
              isConnected={isConnected}
              storeConfig={storeConfig}
              onSaveDraft={handleSaveDraft}
              onSubmitOrder={handleSubmitOrder}
              onDone={() => {
                onOrderSavedOrSubmitted();
                onClose();
              }}
            />
          )}
        </View>

        {/* Bottom Navigation Footer (Steps 0 to 3) */}
        {currentStepIndex < STEPS.length - 1 && (
          <View style={styles.footer}>
            {currentStepIndex > 0 ? (
              <TouchableOpacity
                style={styles.backFooterBtn}
                onPress={handleBack}
                accessible={true}
                accessibilityLabel="Previous Step"
              >
                <Text style={styles.backFooterText}>‹ Back</Text>
              </TouchableOpacity>
            ) : (
              <View style={{ flex: 1 }} />
            )}

            <TouchableOpacity
              style={styles.nextFooterBtn}
              onPress={handleNext}
              accessible={true}
              accessibilityLabel="Proceed to Next Step"
            >
              <Text style={styles.nextFooterText}>
                Next: {STEPS[currentStepIndex + 1]?.label} ›
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  headerBackBtn: {
    minHeight: 44,
    minWidth: 64,
    justifyContent: 'center',
  },
  headerBackText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2563eb',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  headerRightSpacer: {
    width: 64,
  },
  progressContainer: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  progressBarRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 6,
  },
  progressSegment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  progressSegmentFilled: {
    backgroundColor: '#2563eb',
  },
  progressSegmentEmpty: {
    backgroundColor: '#e2e8f0',
  },
  stepLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stepLabelText: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
  },
  stepLabelTextActive: {
    color: '#2563eb',
    fontWeight: '800',
  },
  body: {
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    gap: 12,
  },
  backFooterBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  backFooterText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#334155',
  },
  nextFooterBtn: {
    flex: 2,
    minHeight: 48,
    borderRadius: 8,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextFooterText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },
});
