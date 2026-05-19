import React, { memo } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  type LayoutChangeEvent,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '../../constants/Colors'

export type ChatDetailHeaderProps = {
  participantName: string
  participantAvatarUrl: string | null
  taskTitle?: string | null
  onBack: () => void
  onTaskPress?: () => void
  onLayout?: (event: LayoutChangeEvent) => void
}

function ChatDetailHeaderComponent({
  participantName,
  participantAvatarUrl,
  taskTitle,
  onBack,
  onTaskPress,
  onLayout,
}: ChatDetailHeaderProps) {
  const insets = useSafeAreaInsets()
  const hasTask = !!taskTitle?.trim()

  return (
    <View
      style={[styles.header, { paddingTop: 8 + insets.top }]}
      onLayout={onLayout}
    >
      <TouchableOpacity
        style={styles.backButton}
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel="Go back to messages"
      >
        <Ionicons name="arrow-back" size={24} color={Colors.neutral[800]} />
      </TouchableOpacity>

      <View style={styles.centerColumn}>
        <Text style={styles.name} numberOfLines={1}>
          {participantName}
        </Text>
        {hasTask && (
          <TouchableOpacity
            style={styles.taskRow}
            onPress={onTaskPress}
            disabled={!onTaskPress}
            activeOpacity={onTaskPress ? 0.7 : 1}
            accessibilityRole={onTaskPress ? 'button' : 'text'}
            accessibilityLabel={
              onTaskPress ? `View task: ${taskTitle}` : `Task: ${taskTitle}`
            }
          >
            <Ionicons name="briefcase-outline" size={13} color={Colors.primary[600]} />
            <Text style={styles.taskTitle} numberOfLines={1}>
              {taskTitle}
            </Text>
            {onTaskPress && (
              <Ionicons name="chevron-forward" size={14} color={Colors.primary[500]} />
            )}
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.headerAvatarContainer}>
        {participantAvatarUrl ? (
          <Image
            source={{ uri: participantAvatarUrl }}
            style={styles.headerAvatar}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={120}
          />
        ) : (
          <View style={[styles.headerAvatar, styles.headerAvatarPlaceholder]}>
            <Text style={styles.avatarText}>
              {participantName?.[0]?.toUpperCase() || '•'}
            </Text>
          </View>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.neutral[200],
    backgroundColor: Colors.background.primary,
  },
  backButton: { padding: 8, marginRight: 4 },
  centerColumn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  headerAvatarContainer: { width: 40, height: 40, marginLeft: 8 },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary[500],
  },
  headerAvatarPlaceholder: {
    backgroundColor: Colors.primary[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: Colors.primary[600], fontWeight: '700' },
  name: { fontSize: 16, fontWeight: '700', color: Colors.neutral[900] },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
    maxWidth: '100%',
  },
  taskTitle: {
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary[600],
  },
})

export default memo(ChatDetailHeaderComponent)
