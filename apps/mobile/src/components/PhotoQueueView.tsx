import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  FlatList,
  Alert,
  ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { PhotoType } from '@growfast/shared-types';
import { PendingPhoto, savePhotoLocally, deletePhoto } from '../db/photos';

interface PhotoQueueViewProps {
  clientDraftId: string;
  photos: PendingPhoto[];
  onPhotosChanged: () => void;
  readOnly?: boolean;
}

export function PhotoQueueView({
  clientDraftId,
  photos,
  onPhotosChanged,
  readOnly = false,
}: PhotoQueueViewProps) {
  const [isCapturing, setIsCapturing] = useState(false);

  const handleTakePhoto = async () => {
    try {
      setIsCapturing(true);
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          'Camera Permission Required',
          'Please allow camera access in device settings to capture garment photos.',
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        await savePhotoLocally({
          clientDraftId,
          sourceUri: asset.uri,
          photoType: PhotoType.FRONT,
        });
        onPhotosChanged();
      }
    } catch (err: any) {
      Alert.alert('Photo Error', err.message || 'Could not capture photo');
    } finally {
      setIsCapturing(false);
    }
  };

  const handlePickFromGallery = async () => {
    try {
      setIsCapturing(true);
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        await savePhotoLocally({
          clientDraftId,
          sourceUri: asset.uri,
          photoType: PhotoType.FRONT,
        });
        onPhotosChanged();
      }
    } catch (err: any) {
      Alert.alert('Gallery Error', err.message || 'Could not select photo');
    } finally {
      setIsCapturing(false);
    }
  };

  const handleDeletePhoto = (photo: PendingPhoto) => {
    if (readOnly) return;
    Alert.alert('Remove Photo', 'Are you sure you want to remove this photo from the draft?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await deletePhoto(photo.id);
          onPhotosChanged();
        },
      },
    ]);
  };

  const getStatusBadgeStyle = (status: string) => {
    switch (status) {
      case 'UPLOADED':
        return styles.badgeSuccess;
      case 'UPLOADING':
        return styles.badgeInfo;
      case 'FAILED':
      case 'FILE_MISSING':
        return styles.badgeDanger;
      default:
        return styles.badgePending;
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Garment Photos ({photos.length})</Text>
        {!readOnly && (
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleTakePhoto}
              disabled={isCapturing}
              accessible={true}
              accessibilityLabel="Take Photo with Camera"
            >
              {isCapturing ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.actionButtonText}>📷 Camera</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.galleryButton]}
              onPress={handlePickFromGallery}
              disabled={isCapturing}
              accessible={true}
              accessibilityLabel="Select Photo from Gallery"
            >
              <Text style={styles.actionButtonText}>🖼️ Gallery</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {photos.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No photos attached to this draft yet.</Text>
          <Text style={styles.emptySubtext}>
            Photos taken offline will be securely saved and automatically uploaded once the order is
            confirmed by the server.
          </Text>
        </View>
      ) : (
        <FlatList
          data={photos}
          keyExtractor={(item) => item.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <View style={styles.photoCard}>
              <Image source={{ uri: item.localFileUri }} style={styles.thumbnail} />
              <View style={[styles.badge, getStatusBadgeStyle(item.syncStatus)]}>
                <Text style={styles.badgeText}>{item.syncStatus}</Text>
              </View>
              {!readOnly && (
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => handleDeletePhoto(item)}
                  accessible={true}
                  accessibilityLabel="Delete photo"
                >
                  <Text style={styles.deleteButtonText}>✕</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  galleryButton: {
    backgroundColor: '#64748b',
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  emptyContainer: {
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderStyle: 'dashed',
  },
  emptyText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
  },
  listContent: {
    paddingVertical: 4,
    gap: 12,
  },
  photoCard: {
    position: 'relative',
    width: 90,
    height: 90,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#e2e8f0',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  badge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgePending: {
    backgroundColor: '#f59e0b',
  },
  badgeInfo: {
    backgroundColor: '#3b82f6',
  },
  badgeSuccess: {
    backgroundColor: '#16a34a',
  },
  badgeDanger: {
    backgroundColor: '#ef4444',
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '700',
  },
  deleteButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
});
