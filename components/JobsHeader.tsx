import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '../constants/Colors'
import { moderateFont } from '../utils/fontScale'

interface JobsHeaderProps {
  title: string
  subtitle?: string
}

export default function JobsHeader({ title, subtitle }: JobsHeaderProps) {
  const insets = useSafeAreaInsets()

  return (
    <View style={[styles.header, { paddingTop: 8 + insets.top }]}>
      <View style={styles.headerContent}>
        <View style={styles.headerText}>
          <Text style={styles.title}>{title}</Text>
          {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: Colors.background.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: moderateFont(28),
    fontWeight: '700',
    color: Colors.neutral[900],
    marginBottom: 2,
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: moderateFont(16),
    color: Colors.neutral[600],
    letterSpacing: 0.2,
  },
})
