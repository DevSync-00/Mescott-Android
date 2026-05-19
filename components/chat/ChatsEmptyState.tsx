import React, { memo } from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Colors } from '../../constants/Colors'
type ChatsEmptyStateProps = {
  variant: 'no-chats' | 'no-search' | 'no-unread'
  isTasker: boolean
  onPrimaryAction: () => void
  primaryActionLabel?: string
}

function ChatsEmptyStateComponent({
  variant,
  isTasker,
  onPrimaryAction,
  primaryActionLabel,
}: ChatsEmptyStateProps) {
  if (variant === 'no-search') {
    return (
      <View style={styles.container}>
        <Ionicons name="search-outline" size={56} color={Colors.neutral[300]} />
        <Text style={styles.title}>No matching conversations</Text>
        <Text style={styles.subtitle}>Try a different name or task title.</Text>
      </View>
    )
  }

  if (variant === 'no-unread') {
    return (
      <View style={styles.container}>
        <Ionicons name="checkmark-done-circle-outline" size={56} color={Colors.success[500]} />
        <Text style={styles.title}>You&apos;re all caught up</Text>
        <Text style={styles.subtitle}>No unread messages right now.</Text>
      </View>
    )
  }

  const primaryLabel = primaryActionLabel ?? (isTasker ? 'Browse available tasks' : 'Post a task')
  const subtitle = isTasker
    ? 'Apply to tasks to start chatting with customers.'
    : 'Post a task and accept an application to open your first chat.'

  return (
    <View style={styles.container}>
      <Ionicons name="chatbubbles-outline" size={64} color={Colors.neutral[300]} />
      <Text style={styles.title}>No messages yet</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
      <TouchableOpacity
        style={styles.ctaButton}
        onPress={onPrimaryAction}
        accessibilityRole="button"
        accessibilityLabel={primaryLabel}
      >
        <Ionicons
          name={isTasker ? 'briefcase-outline' : 'add-circle-outline'}
          size={20}
          color="#fff"
        />
        <Text style={styles.ctaLabel}>{primaryLabel}</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
    paddingHorizontal: 40,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.neutral[700],
    marginTop: 20,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: Colors.neutral[500],
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primary[500],
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    marginTop: 4,
  },
  ctaLabel: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
})

export default memo(ChatsEmptyStateComponent)
