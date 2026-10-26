import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';

export default function IndexScreen() {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#2563eb" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0f6ff',
  },
});
