import React from 'react'
import { View, Text, StyleSheet, ViewStyle, TouchableOpacity } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import Colors from '../constants/Colors'
import { Typography, BorderRadius, Spacing } from '../constants/Design'
import { PrimaryButton, SecondaryButton } from './EnhancedButton'

interface EnhancedEmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap
  title: string
  subtitle?: string
  primaryAction?: {
    title: string
    onPress: () => void
  }
  secondaryAction?: {
    title: string
    onPress: () => void
  }
  style?: ViewStyle
  variant?: 'default' | 'minimal' | 'illustrated'
}

export default function EnhancedEmptyState({
  icon = 'document-outline',
  title,
  subtitle,
  primaryAction,
  secondaryAction,
  style,
  variant = 'default',
}: EnhancedEmptyStateProps) {
  const getIconSize = () => {
    switch (variant) {
      case 'minimal':
        return 32
      case 'illustrated':
        return 80
      case 'default':
      default:
        return 64
    }
  }

  const getIconColor = () => {
    switch (variant) {
      case 'minimal':
        return Colors.neutral[400]
      case 'illustrated':
        return Colors.primary[300]
      case 'default':
      default:
        return Colors.neutral[300]
    }
  }

  return (
    <View style={[styles.container, style]}>
      <View style={styles.content}>
        <View style={[styles.iconContainer, variant === 'illustrated' && styles.illustratedIcon]}>
          <Ionicons
            name={icon}
            size={getIconSize()}
            color={getIconColor()}
          />
        </View>
        
        <Text style={[styles.title, variant === 'minimal' && styles.minimalTitle]}>
          {title}
        </Text>
        
        {subtitle && (
          <Text style={[styles.subtitle, variant === 'minimal' && styles.minimalSubtitle]}>
            {subtitle}
          </Text>
        )}
        
        {(primaryAction || secondaryAction) && (
          <View style={styles.actions}>
            {primaryAction && (
              <PrimaryButton
                title={primaryAction.title}
                onPress={primaryAction.onPress}
                style={styles.primaryAction}
              />
            )}
            {secondaryAction && (
              <SecondaryButton
                title={secondaryAction.title}
                onPress={secondaryAction.onPress}
                style={styles.secondaryAction}
              />
            )}
          </View>
        )}
      </View>
    </View>
  )
}

// Predefined empty states for common use cases
export const NoTasksEmptyState = ({
  onPostTask,
  onBrowseTasks,
}: {
  onPostTask: () => void
  onBrowseTasks: () => void
}) => (
  <EnhancedEmptyState
    icon="briefcase-outline"
    title="No Tasks Found"
    subtitle="There are no tasks available at the moment. Check back later or post your own task to get started."
    primaryAction={{
      title: 'Post a Task',
      onPress: onPostTask,
    }}
    secondaryAction={{
      title: 'Browse Tasks',
      onPress: onBrowseTasks,
    }}
    variant="illustrated"
  />
)

export const NoApplicationsEmptyState = ({
  onApplyTask,
}: {
  onApplyTask: () => void
}) => (
  <EnhancedEmptyState
    icon="document-text-outline"
    title="No Applications Yet"
    subtitle="You haven't applied to any tasks yet. Start browsing available tasks and apply to ones that match your skills."
    primaryAction={{
      title: 'Browse Tasks',
      onPress: onApplyTask,
    }}
    variant="illustrated"
  />
)

export const NoMessagesEmptyState = ({
  onStartChat,
}: {
  onStartChat: () => void
}) => (
  <EnhancedEmptyState
    icon="chatbubbles-outline"
    title="No Messages"
    subtitle="You don't have any messages yet. Start a conversation with a tasker or customer to get started."
    primaryAction={{
      title: 'Start Chat',
      onPress: onStartChat,
    }}
    variant="illustrated"
  />
)

export const NoNotificationsEmptyState = () => (
  <EnhancedEmptyState
    icon="notifications-outline"
    title="No Notifications"
    subtitle="You're all caught up! New notifications will appear here when you receive them."
    variant="minimal"
  />
)

export const NoBookingsEmptyState = ({
  onBrowseTasks,
}: {
  onBrowseTasks: () => void
}) => (
  <EnhancedEmptyState
    icon="calendar-outline"
    title="No Bookings"
    subtitle="You don't have any bookings yet. Apply to tasks to start getting bookings from customers."
    primaryAction={{
      title: 'Browse Tasks',
      onPress: onBrowseTasks,
    }}
    variant="illustrated"
  />
)

export const NoWalletHistoryEmptyState = () => (
  <EnhancedEmptyState
    icon="wallet-outline"
    title="No Transactions"
    subtitle="Your transaction history will appear here once you start earning or making payments."
    variant="minimal"
  />
)

export const NoSearchResultsEmptyState = ({
  onClearSearch,
}: {
  onClearSearch: () => void
}) => (
  <EnhancedEmptyState
    icon="search-outline"
    title="No Results Found"
    subtitle="Try adjusting your search terms or filters to find what you're looking for."
    primaryAction={{
      title: 'Clear Search',
      onPress: onClearSearch,
    }}
    variant="minimal"
  />
)

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.xxxl,
  },
  content: {
    alignItems: 'center',
    maxWidth: 300,
  },
  iconContainer: {
    marginBottom: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  illustratedIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.text.primary,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  minimalTitle: {
    fontSize: Typography.fontSize.lg,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: Typography.fontSize.md,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: Spacing.xl,
  },
  minimalSubtitle: {
    fontSize: Typography.fontSize.sm,
    marginBottom: Spacing.lg,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.md,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  primaryAction: {
    minWidth: 120,
  },
  secondaryAction: {
    minWidth: 120,
  },
})
