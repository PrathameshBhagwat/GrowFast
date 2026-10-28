import React, { useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import {
  PickupType,
  ExpressDeliveryOption,
  getExpressMultiplier,
  getDayOfWeekInTimezone,
} from '@growfast/shared-types';

interface OptionsStepProps {
  pickupType: PickupType;
  onPickupTypeChange: (type: PickupType) => void;
  expressOption: ExpressDeliveryOption;
  onExpressOptionChange: (option: ExpressDeliveryOption) => void;
  notes: string;
  onNotesChange: (notes: string) => void;
}

export function OptionsStep({
  pickupType,
  onPickupTypeChange,
  expressOption,
  onExpressOptionChange,
  notes,
  onNotesChange,
}: OptionsStepProps) {
  const currentDayOfWeek = useMemo(() => {
    return getDayOfWeekInTimezone(new Date(), 'Asia/Kolkata');
  }, []);
  const isThursdayOff = currentDayOfWeek === 4;
  const isWednesdayOff = currentDayOfWeek === 3;

  const expressOptions = [
    {
      key: ExpressDeliveryOption.REGULAR,
      title: 'Regular Turnaround',
      description: 'Standard turnaround time (48-72h). Standard pricing.',
      multiplierText: '1.0x (No Surcharge)',
      badgeBg: '#f1f5f9',
      badgeText: '#475569',
      disabled: false,
      disabledReason: null,
    },
    {
      key: ExpressDeliveryOption.NEXT_DAY_EVENING,
      title: 'Next-Day Evening Express',
      description: isWednesdayOff
        ? 'Unavailable on Wednesdays because Thursdays are store weekly off.'
        : 'Priority batch processing delivered next-day evening.',
      multiplierText: '⚡ 1.5x (+50% Surcharge)',
      badgeBg: '#fef3c7',
      badgeText: '#b45309',
      disabled: isWednesdayOff,
      disabledReason: 'Unavailable on Wednesdays (Thursday weekly off)',
    },
    {
      key: ExpressDeliveryOption.SAME_DAY,
      title: 'Same-Day Urgent Express',
      description: isThursdayOff
        ? 'Unavailable on Thursdays because Thursdays are store weekly off.'
        : 'Top-priority cycle delivered on same calendar day.',
      multiplierText: '🔥 2.0x (+100% Surcharge)',
      badgeBg: '#fee2e2',
      badgeText: '#b91c1c',
      disabled: isThursdayOff,
      disabledReason: 'Unavailable on Thursdays (Weekly store off)',
    },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <Text style={styles.stepTitle}>Fulfillment & Express Options</Text>

      {/* Pickup / Delivery Type */}
      <View style={styles.section}>
        <Text style={styles.sectionHeading}>Pickup & Delivery Method</Text>
        <View style={styles.pickupOptionGroup}>
          <TouchableOpacity
            style={[
              styles.pickupCard,
              pickupType === PickupType.STORE_PICKUP && styles.pickupCardActive,
            ]}
            onPress={() => onPickupTypeChange(PickupType.STORE_PICKUP)}
            accessible={true}
            accessibilityLabel="Select Store Counter Pickup"
          >
            <View style={styles.radioCircle}>
              {pickupType === PickupType.STORE_PICKUP && <View style={styles.radioDot} />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.pickupCardTitle}>🏪 Store Counter Pickup</Text>
              <Text style={styles.pickupCardDesc}>
                Customer brings and collects at the store counter
              </Text>
            </View>
          </TouchableOpacity>

          {/* Home Delivery temporarily hidden while feature is not offered */}
        </View>
      </View>

      {/* Express Speed */}
      <View style={styles.section}>
        <Text style={styles.sectionHeading}>Turnaround Speed & Express Tier</Text>
        <Text style={styles.sectionSub}>
          Express surcharges apply to both piece and weight rates as configured on the server.
        </Text>

        <View style={styles.expressGroup}>
          {expressOptions.map((opt) => {
            const isSelected = expressOption === opt.key;
            return (
              <TouchableOpacity
                key={opt.key}
                style={[
                  styles.expressCard,
                  isSelected && styles.expressCardActive,
                  opt.disabled && { opacity: 0.5, backgroundColor: '#f8fafc' },
                ]}
                onPress={() => {
                  if (opt.disabled) {
                    Alert.alert(
                      'Option Unavailable',
                      opt.disabledReason ||
                        'This delivery option is unavailable due to store schedule rules.',
                    );
                    return;
                  }
                  onExpressOptionChange(opt.key);
                }}
                accessible={true}
                accessibilityLabel={`Select express tier ${opt.title}`}
              >
                <View style={styles.expressCardHeader}>
                  <View style={styles.radioCircle}>
                    {isSelected && <View style={styles.radioDot} />}
                  </View>
                  <Text style={styles.expressCardTitle}>{opt.title}</Text>
                  <View style={[styles.multiplierBadge, { backgroundColor: opt.badgeBg }]}>
                    <Text style={[styles.multiplierBadgeText, { color: opt.badgeText }]}>
                      {opt.disabled ? '🚫 Off Day' : opt.multiplierText}
                    </Text>
                  </View>
                </View>
                <Text style={styles.expressCardDesc}>{opt.description}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Staff Notes */}
      <View style={styles.section}>
        <Text style={styles.sectionHeading}>Staff & Workshop Notes</Text>
        <Text style={styles.sectionSub}>
          Any special handling instructions, stain details, or customer requests.
        </Text>
        <TextInput
          style={styles.notesInput}
          value={notes}
          onChangeText={onNotesChange}
          placeholder="e.g. Extra care for embroidered saree, deliver after 6 PM..."
          placeholderTextColor="#94a3b8"
          multiline
          numberOfLines={4}
        />
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
  section: {
    marginBottom: 20,
  },
  sectionHeading: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 4,
  },
  sectionSub: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 10,
  },
  pickupOptionGroup: {
    gap: 10,
  },
  pickupCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    gap: 12,
    minHeight: 52,
  },
  pickupCardActive: {
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff',
  },
  pickupCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  pickupCardDesc: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  radioCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#2563eb',
  },
  expressGroup: {
    gap: 10,
  },
  expressCard: {
    padding: 14,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    minHeight: 64,
  },
  expressCardActive: {
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff',
  },
  expressCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  expressCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
    flex: 1,
  },
  multiplierBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  multiplierBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  expressCardDesc: {
    fontSize: 12,
    color: '#64748b',
    paddingLeft: 32,
  },
  notesInput: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#0f172a',
    backgroundColor: '#ffffff',
    minHeight: 80,
    textAlignVertical: 'top',
  },
});
