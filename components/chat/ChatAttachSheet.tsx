import React, { memo } from 'react'
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '../../constants/Colors'

export type ChatAttachSheetProps = {
  visible: boolean
  onClose: () => void
  onPickPhoto: () => void
  onPickDocument: () => void
  disabled?: boolean
}

function ChatAttachSheetComponent({
  visible,
  onClose,
  onPickPhoto,
  onPickDocument,
  disabled = false,
}: ChatAttachSheetProps) {
  const insets = useSafeAreaInsets()

  const handlePhoto = () => {
    onClose()
    onPickPhoto()
  }

  const handleDocument = () => {
    onClose()
    onPickDocument()
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.handle} />
          <Text style={styles.title}>Attach</Text>

          <TouchableOpacity
            style={[styles.option, disabled && styles.optionDisabled]}
            onPress={handlePhoto}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel="Attach photo"
          >
            <View style={[styles.optionIcon, { backgroundColor: Colors.primary[50] }]}>
              <Ionicons name="image-outline" size={22} color={Colors.primary[600]} />
            </View>
            <View style={styles.optionText}>
              <Text style={styles.optionTitle}>Photo</Text>
              <Text style={styles.optionSubtitle}>Choose from gallery</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.option, disabled && styles.optionDisabled]}
            onPress={handleDocument}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel="Attach document"
          >
            <View style={[styles.optionIcon, { backgroundColor: Colors.neutral[100] }]}>
              <Ionicons name="document-outline" size={22} color={Colors.neutral[700]} />
            </View>
            <View style={styles.optionText}>
              <Text style={styles.optionTitle}>Document</Text>
              <Text style={styles.optionSubtitle}>PDF, files, and more</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
            <Text style={styles.cancelLabel}>Cancel</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.background.primary,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.neutral[300],
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.neutral[900],
    marginBottom: 16,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
  },
  optionDisabled: {
    opacity: 0.5,
  },
  optionIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionText: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.neutral[900],
  },
  optionSubtitle: {
    fontSize: 13,
    color: Colors.neutral[500],
    marginTop: 2,
  },
  cancelButton: {
    marginTop: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.neutral[600],
  },
})

export default memo(ChatAttachSheetComponent)
