import React, { useEffect, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Platform,
  Pressable,
} from 'react-native'
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '../constants/Colors'

export type TaskPickerMode = 'date' | 'time'

interface TaskDateTimePickerSheetProps {
  visible: boolean
  mode: TaskPickerMode
  value: Date
  onConfirm: (value: Date) => void
  onClose: () => void
  minimumDate?: Date
}

function formatPreview(mode: TaskPickerMode, date: Date): string {
  if (mode === 'date') {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    })
  }
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

export default function TaskDateTimePickerSheet({
  visible,
  mode,
  value,
  onConfirm,
  onClose,
  minimumDate,
}: TaskDateTimePickerSheetProps) {
  const insets = useSafeAreaInsets()
  const [draft, setDraft] = useState(value)

  useEffect(() => {
    if (visible) {
      setDraft(value)
    }
  }, [visible, value])

  const title = mode === 'date' ? 'Select Date' : 'Select Time'
  const confirmLabel = mode === 'date' ? 'Confirm Date' : 'Confirm Time'

  const handleChange = (_event: DateTimePickerEvent, selected?: Date) => {
    if (selected) {
      setDraft(selected)
    }
  }

  const handleConfirm = () => {
    onConfirm(draft)
    onClose()
  }

  // Android native dialog: render picker only while open (no custom sheet)
  if (Platform.OS === 'android' && visible) {
    return (
      <DateTimePicker
        value={draft}
        mode={mode}
        display={mode === 'date' ? 'calendar' : 'clock'}
        minimumDate={mode === 'date' ? minimumDate : undefined}
        minuteInterval={mode === 'time' ? 5 : undefined}
        onChange={(event, selected) => {
          if (event.type === 'dismissed') {
            onClose()
            return
          }
          if (event.type === 'set' && selected) {
            onConfirm(selected)
          }
          onClose()
        }}
      />
    )
  }

  if (Platform.OS !== 'ios' || !visible) {
    return null
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeButton}
              accessibilityLabel="Close"
              accessibilityRole="button"
            >
              <Ionicons name="close" size={24} color={Colors.neutral[600]} />
            </TouchableOpacity>
          </View>

          <View style={styles.preview}>
            <Text style={styles.previewText}>{formatPreview(mode, draft)}</Text>
          </View>

          <DateTimePicker
            value={draft}
            mode={mode}
            display="spinner"
            onChange={handleChange}
            minimumDate={mode === 'date' ? minimumDate : undefined}
            minuteInterval={mode === 'time' ? 5 : undefined}
            textColor={Colors.neutral[900]}
            themeVariant="light"
            style={styles.picker}
          />

          <TouchableOpacity
            style={styles.confirmButton}
            onPress={handleConfirm}
            accessibilityLabel={confirmLabel}
            accessibilityRole="button"
          >
            <Text style={styles.confirmButtonText}>{confirmLabel}</Text>
          </TouchableOpacity>
        </View>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.background.primary,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.primary,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.neutral[900],
  },
  closeButton: {
    padding: 4,
  },
  preview: {
    backgroundColor: Colors.primary[50],
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    marginBottom: 8,
    alignItems: 'center',
  },
  previewText: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.primary[700],
    textAlign: 'center',
  },
  picker: {
    height: 216,
    width: '100%',
  },
  confirmButton: {
    backgroundColor: Colors.primary[500],
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
})
