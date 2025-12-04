import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  ScrollView,
  ActivityIndicator,
  TextInput,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { TaskStatusService, TaskStatus, TaskStatusUpdate } from '../services/TaskStatusService'
import Colors from '../constants/Colors'

interface TaskStatusManagerProps {
  taskId: string
  currentStatus: TaskStatus
  userId: string
  userRole: 'customer' | 'tasker'
  onStatusUpdate?: (newStatus: TaskStatus) => void
  showHistory?: boolean
}

export default function TaskStatusManager({
  taskId,
  currentStatus,
  userId,
  userRole,
  onStatusUpdate,
  showHistory = true
}: TaskStatusManagerProps) {
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [statusHistory, setStatusHistory] = useState<TaskStatusUpdate[]>([])
  const [selectedStatus, setSelectedStatus] = useState<TaskStatus | null>(null)
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (showHistory) {
      loadStatusHistory()
    }
  }, [taskId, showHistory])

  const loadStatusHistory = async () => {
    try {
      setLoading(true)
      const history = await TaskStatusService.getTaskStatusHistory(taskId)
      setStatusHistory(history)
    } catch (error) {
      console.error('Error loading status history:', error)
    } finally {
      setLoading(false)
    }
  }

  const getCurrentStep = () => {
    return TaskStatusService.getWorkflowStep(currentStatus)
  }

  const getNextStatuses = () => {
    return TaskStatusService.getNextStatuses(currentStatus)
  }

  const handleStatusUpdate = async () => {
    if (!selectedStatus) return

    try {
      setLoading(true)
      const success = await TaskStatusService.updateTaskStatus(
        taskId,
        selectedStatus,
        userId,
        reason || undefined,
        notes || undefined
      )

      if (success) {
        Alert.alert('Success', 'Task status updated successfully')
        setShowModal(false)
        setSelectedStatus(null)
        setReason('')
        setNotes('')
        onStatusUpdate?.(selectedStatus)
        if (showHistory) {
          loadStatusHistory()
        }
      } else {
        Alert.alert('Error', 'Failed to update task status')
      }
    } catch (error) {
      console.error('Error updating status:', error)
      Alert.alert('Error', 'Failed to update task status')
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: TaskStatus): string => {
    const step = TaskStatusService.getWorkflowStep(status)
    return step?.color || Colors.neutral[500]
  }

  const getStatusIcon = (status: TaskStatus): string => {
    const step = TaskStatusService.getWorkflowStep(status)
    return step?.icon || 'help-circle'
  }

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString)
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString()
  }

  const currentStep = getCurrentStep()
  const nextStatuses = getNextStatuses()

  return (
    <View style={styles.container}>
      {/* Current Status Display */}
      <View style={styles.currentStatusContainer}>
        <View style={styles.statusHeader}>
          <View style={[styles.statusIcon, { backgroundColor: currentStep?.color + '20' }]}>
            <Ionicons 
              name={currentStep?.icon as any} 
              size={24} 
              color={currentStep?.color} 
            />
          </View>
          <View style={styles.statusInfo}>
            <Text style={styles.statusTitle}>{currentStep?.title}</Text>
            <Text style={styles.statusDescription}>{currentStep?.description}</Text>
          </View>
        </View>

        {/* Action Buttons */}
        {nextStatuses.length > 0 && (
          <TouchableOpacity
            style={styles.updateButton}
            onPress={() => setShowModal(true)}
          >
            <Ionicons name="arrow-forward" size={16} color={Colors.primary[500]} />
            <Text style={styles.updateButtonText}>Update Status</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Status History */}
      {showHistory && statusHistory.length > 0 && (
        <View style={styles.historyContainer}>
          <Text style={styles.historyTitle}>Status History</Text>
          <ScrollView style={styles.historyScroll}>
            {statusHistory.map((update, index) => (
              <View key={update.id} style={styles.historyItem}>
                <View style={styles.historyIcon}>
                  <Ionicons 
                    name={getStatusIcon(update.status) as any} 
                    size={16} 
                    color={getStatusColor(update.status)} 
                  />
                </View>
                <View style={styles.historyContent}>
                  <Text style={styles.historyStatus}>
                    {TaskStatusService.getWorkflowStep(update.status)?.title}
                  </Text>
                  <Text style={styles.historyDate}>
                    {formatDate(update.created_at)}
                  </Text>
                  {update.reason && (
                    <Text style={styles.historyReason}>Reason: {update.reason}</Text>
                  )}
                  {update.notes && (
                    <Text style={styles.historyNotes}>{update.notes}</Text>
                  )}
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Status Update Modal */}
      <Modal
        visible={showModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Update Task Status</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowModal(false)}
            >
              <Ionicons name="close" size={24} color={Colors.neutral[600]} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {/* Status Options */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Select New Status</Text>
              {nextStatuses.map((status) => {
                const step = TaskStatusService.getWorkflowStep(status)
                return (
                  <TouchableOpacity
                    key={status}
                    style={[
                      styles.statusOption,
                      selectedStatus === status && styles.statusOptionSelected
                    ]}
                    onPress={() => setSelectedStatus(status)}
                  >
                    <View style={[styles.optionIcon, { backgroundColor: step?.color + '20' }]}>
                      <Ionicons name={step?.icon as any} size={20} color={step?.color} />
                    </View>
                    <View style={styles.optionContent}>
                      <Text style={styles.optionTitle}>{step?.title}</Text>
                      <Text style={styles.optionDescription}>{step?.description}</Text>
                    </View>
                    {selectedStatus === status && (
                      <Ionicons name="checkmark-circle" size={20} color={Colors.primary[500]} />
                    )}
                  </TouchableOpacity>
                )
              })}
            </View>

            {/* Reason and Notes */}
            {selectedStatus && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Additional Information</Text>
                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>Reason (Optional)</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Enter reason for status change..."
                    value={reason}
                    onChangeText={setReason}
                    multiline
                  />
                </View>
                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>Notes (Optional)</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Add any additional notes..."
                    value={notes}
                    onChangeText={setNotes}
                    multiline
                  />
                </View>
              </View>
            )}

            {/* Update Button */}
            <TouchableOpacity
              style={[
                styles.confirmButton,
                (!selectedStatus || loading) && styles.confirmButtonDisabled
              ]}
              onPress={handleStatusUpdate}
              disabled={!selectedStatus || loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark" size={20} color="#fff" />
                  <Text style={styles.confirmButtonText}>Update Status</Text>
                </>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 16,
  },
  currentStatusContainer: {
    backgroundColor: Colors.background.primary,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border.primary,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  statusInfo: {
    flex: 1,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.neutral[900],
    marginBottom: 4,
  },
  statusDescription: {
    fontSize: 14,
    color: Colors.neutral[600],
  },
  updateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary[50],
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: Colors.primary[200],
    gap: 8,
  },
  updateButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary[600],
  },
  historyContainer: {
    marginTop: 16,
  },
  historyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.neutral[700],
    marginBottom: 12,
  },
  historyScroll: {
    maxHeight: 200,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  historyIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.neutral[100],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  historyContent: {
    flex: 1,
  },
  historyStatus: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.neutral[900],
    marginBottom: 2,
  },
  historyDate: {
    fontSize: 12,
    color: Colors.neutral[500],
    marginBottom: 4,
  },
  historyReason: {
    fontSize: 12,
    color: Colors.neutral[600],
    fontStyle: 'italic',
  },
  historyNotes: {
    fontSize: 12,
    color: Colors.neutral[600],
    marginTop: 2,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.background.secondary,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
    backgroundColor: Colors.background.primary,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.neutral[900],
  },
  closeButton: {
    padding: 4,
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    marginVertical: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.neutral[700],
    marginBottom: 12,
  },
  statusOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: Colors.background.primary,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border.primary,
  },
  statusOptionSelected: {
    borderColor: Colors.primary[500],
    backgroundColor: Colors.primary[50],
  },
  optionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.neutral[900],
    marginBottom: 2,
  },
  optionDescription: {
    fontSize: 14,
    color: Colors.neutral[600],
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.neutral[700],
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: Colors.background.primary,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Colors.border.primary,
    fontSize: 16,
    color: Colors.neutral[900],
    minHeight: 80,
    textAlignVertical: 'top',
  },
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary[500],
    borderRadius: 8,
    paddingVertical: 16,
    marginVertical: 20,
    gap: 8,
  },
  confirmButtonDisabled: {
    backgroundColor: Colors.neutral[300],
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
})
