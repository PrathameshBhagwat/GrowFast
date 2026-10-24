import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import {
  CreateOrderItemRequest,
  PickupType,
  isPhotoRequiredForOrder,
  GARMENT_COLLECTION_NOTICE,
  STAIN_REMOVAL_NOTICE,
} from '@growfast/shared-types';
import { PendingPhoto } from '../../db/photos';
import { PhotoQueueView } from '../PhotoQueueView';

interface RequirementsStepProps {
  clientDraftId: string;
  items: CreateOrderItemRequest[];
  pickupType: PickupType;
  photos: PendingPhoto[];
  onPhotosChanged: () => void;
}

export function RequirementsStep({
  clientDraftId,
  items,
  pickupType,
  photos,
  onPhotosChanged,
}: RequirementsStepProps) {
  const totalPieces = items.reduce((acc, it) => acc + (it.quantity || 1), 0);
  const isWeightBased = items.some((it) => it.weight != null && it.weight > 0);
  const photoRequired = isPhotoRequiredForOrder({
    isWalkIn: pickupType === PickupType.STORE_PICKUP,
    totalPieces,
    isWeightBased,
  });
  const itemsWithDefects = items.filter((it) => !!it.defectNotes?.trim());

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <Text style={styles.stepTitle}>Garments, Tags & Intake Photos</Text>

      {/* Piece & Tag Summary */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Total Intake Garments:</Text>
          <Text style={styles.summaryValue}>{totalPieces} physical piece(s)</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Tag Requirements:</Text>
          <Text style={styles.summaryValue}>{totalPieces} barcode garment tags</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Defects Reported:</Text>
          <Text style={styles.summaryValue}>
            {itemsWithDefects.length > 0
              ? `${itemsWithDefects.length} item(s) noted`
              : 'None recorded'}
          </Text>
        </View>
      </View>

      {/* Defect items callout if any */}
      {itemsWithDefects.length > 0 && (
        <View style={styles.defectsCard}>
          <Text style={styles.defectsTitle}>⚠️ Recorded Garment Conditions:</Text>
          {itemsWithDefects.map((it, idx) => (
            <Text key={idx} style={styles.defectItemText}>
              • {it.defectNotes} ({it.quantity} pc)
            </Text>
          ))}
        </View>
      )}

      {/* Canonical Photo Requirement Banner */}
      <View
        style={[
          styles.photoRequirementBanner,
          photoRequired ? styles.photoRequiredActive : styles.photoOptional,
        ]}
      >
        <Text
          style={[
            styles.photoRequirementTitle,
            photoRequired ? styles.photoRequiredTitleText : styles.photoOptionalTitleText,
          ]}
        >
          {photoRequired ? '⚠️ Garment Intake Photo Required' : '📷 Intake Photos Optional'}
        </Text>
        <Text style={styles.photoRequirementDesc}>
          {photoRequired
            ? 'Store walk-in intake policy requires at least one intake photograph of garments prior to workshop processing.'
            : 'Optional for home pickup or bulk orders, but recommended for garments with pre-existing defects or stains.'}
        </Text>
      </View>

      {/* Embedded Photo Capture Queue */}
      <View style={styles.photoSection}>
        <PhotoQueueView
          clientDraftId={clientDraftId}
          photos={photos}
          onPhotosChanged={onPhotosChanged}
        />
      </View>

      {/* Official Workshop & Garment Collection Notices */}
      <View style={styles.noticesCard}>
        <Text style={styles.noticesHeader}>Workshop Intake Notices</Text>
        <Text style={styles.noticeText}>📌 {GARMENT_COLLECTION_NOTICE}</Text>
        <Text style={[styles.noticeText, { marginTop: 6 }]}>🧼 {STAIN_REMOVAL_NOTICE}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  stepTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 16,
  },
  summaryCard: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
  },
  summaryLabel: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
  },
  summaryValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  defectsCard: {
    backgroundColor: '#fffbeb',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#fde68a',
    marginBottom: 16,
  },
  defectsTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#92400e',
    marginBottom: 6,
  },
  defectItemText: {
    fontSize: 12,
    color: '#b45309',
    marginTop: 2,
  },
  photoRequirementBanner: {
    padding: 14,
    borderRadius: 10,
    borderWidth: 1.5,
    marginBottom: 16,
  },
  photoRequiredActive: {
    backgroundColor: '#fff7ed',
    borderColor: '#f97316',
  },
  photoOptional: {
    backgroundColor: '#eff6ff',
    borderColor: '#93c5fd',
  },
  photoRequirementTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  photoRequiredTitleText: {
    color: '#c2410c',
  },
  photoOptionalTitleText: {
    color: '#1d4ed8',
  },
  photoRequirementDesc: {
    fontSize: 12,
    color: '#475569',
    marginTop: 4,
    lineHeight: 18,
  },
  photoSection: {
    marginBottom: 16,
  },
  noticesCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  noticesHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  noticeText: {
    fontSize: 11,
    color: '#64748b',
    lineHeight: 16,
  },
});
