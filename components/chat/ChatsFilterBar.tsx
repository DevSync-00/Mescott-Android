import React, { memo } from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { Colors } from '../../constants/Colors'

export type ChatsInboxFilter = 'all' | 'unread'

type ChatsFilterBarProps = {
  value: ChatsInboxFilter
  unreadCount: number
  onChange: (filter: ChatsInboxFilter) => void
}

function ChatsFilterBarComponent({ value, unreadCount, onChange }: ChatsFilterBarProps) {
  return (
    <View style={styles.row}>
      <FilterChip
        label="All"
        active={value === 'all'}
        onPress={() => onChange('all')}
      />
      <FilterChip
        label="Unread"
        active={value === 'unread'}
        count={unreadCount}
        onPress={() => onChange('unread')}
      />
    </View>
  )
}

function FilterChip({
  label,
  active,
  count,
  onPress,
}: {
  label: string
  active: boolean
  count?: number
  onPress: () => void
}) {
  return (
    <TouchableOpacity
      style={[styles.chip, active && styles.chipActive]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityHint={active ? undefined : `Show ${label.toLowerCase()} conversations`}
    >
      <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{label}</Text>
      {typeof count === 'number' && count > 0 && (
        <View style={[styles.countBadge, active && styles.countBadgeActive]}>
          <Text style={[styles.countText, active && styles.countTextActive]}>
            {count > 99 ? '99+' : count}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 8,
    backgroundColor: Colors.background.primary,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.neutral[100],
    borderWidth: 1,
    borderColor: Colors.neutral[200],
  },
  chipActive: {
    backgroundColor: Colors.primary[500],
    borderColor: Colors.primary[500],
  },
  chipLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.neutral[700],
  },
  chipLabelActive: {
    color: '#fff',
  },
  countBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    backgroundColor: Colors.primary[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  countBadgeActive: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  countText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.primary[600],
  },
  countTextActive: {
    color: '#fff',
  },
})

export default memo(ChatsFilterBarComponent)
