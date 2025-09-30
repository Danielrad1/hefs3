import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { r, s } from '../design';

export default function PillBadge({ text }: { text: string }) {
  return (
    <View style={styles.pill}><Text style={styles.txt}>{text}</Text></View>
  );
}

const styles = StyleSheet.create({
  pill: { borderRadius: r.pill, paddingVertical: s.xs, paddingHorizontal: s.md, backgroundColor: '#E5F8FA' },
  txt: { color: '#0A5561', fontWeight: '600' },
});
