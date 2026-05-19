import React, { memo } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, type LayoutChangeEvent } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '../../constants/Colors'

export type ChatDetailHeaderProps = {
  participantName: string
  participantAvatarUrl: string | null
  onBack: () => void
  onLayout?: (event: LayoutChangeEvent) => void
}

function ChatDetailHeaderComponent({
  participantName,
  participantAvatarUrl,
  onBack,
  onLayout,
}: ChatDetailHeaderProps) {
  const insets = useSafeAreaInsets()

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

      <View style={styles.userInfo}>
        <Text style={styles.name} numberOfLines={1}>
          {participantName}
        </Text>
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
  backButton: { padding: 8 },
  userInfo: { flex: 1, alignItems: 'center', justifyContent: 'center' },
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
})

export default memo(ChatDetailHeaderComponent)
