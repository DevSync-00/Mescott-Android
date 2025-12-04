import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { ContentModerationService } from '../services/ContentModerationService'
import Colors from '../constants/Colors'

interface ReportModalProps {
  visible: boolean
  onClose: () => void
  reporterId: string
  reportedUserId?: string
  reportedTaskId?: string
  reportedContent?: string
}

const reportTypes = [
  {
    id: 'inappropriate_content',
    title: 'Inappropriate Content',
    description: 'Content that violates community guidelines',
    icon: 'warning-outline',
    color: Colors.warning[500]
  },
  {
    id: 'spam',
    title: 'Spam',
    description: 'Repetitive or unwanted content',
    icon: 'refresh-outline',
    color: Colors.error[500]
  },
  {
    id: 'harassment',
    title: 'Harassment',
    description: 'Bullying, threats, or abusive behavior',
    icon: 'person-remove-outline',
    color: Colors.error[600]
  },
  {
    id: 'fake_profile',
    title: 'Fake Profile',
    description: 'Suspected fake or misleading profile',
    icon: 'person-outline',
    color: Colors.warning[600]
  },
  {
    id: 'payment_issue',
    title: 'Payment Issue',
    description: 'Problems with payment or money',
    icon: 'card-outline',
    color: Colors.error[500]
  },
  {
    id: 'safety_concern',
    title: 'Safety Concern',
    description: 'Safety or security issue',
    icon: 'shield-outline',
    color: Colors.error[700]
  },
  {
    id: 'other',
    title: 'Other',
    description: 'Something else not listed above',
    icon: 'ellipsis-horizontal-outline',
    color: Colors.neutral[600]
  }
]

function ReportModal({
  visible,
  onClose,
  reporterId,
  reportedUserId,
  reportedTaskId,
  reportedContent
}: ReportModalProps) {
  const [selectedType, setSelectedType] = useState<string | null>(null)
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!selectedType) {
      Alert.alert('Error', 'Please select a report type')
      return
    }

    if (description.trim().length < 10) {
      Alert.alert('Error', 'Please provide a detailed description (at least 10 characters)')
      return
    }

    setSubmitting(true)

    try {
      const report = await ContentModerationService.submitReport({
        reporter_id: reporterId,
        reported_user_id: reportedUserId,
        reported_task_id: reportedTaskId,
        report_type: selectedType as any,
        description: description.trim(),
        reported_content: reportedContent,
        priority: selectedType === 'safety_concern' ? 'urgent' : 'medium'
      })

      if (report) {
        Alert.alert(
          'Report Submitted',
          'Thank you for your report. We will review it and take appropriate action.',
          [{ text: 'OK', onPress: handleClose }]
        )
      } else {
        Alert.alert('Error', 'Failed to submit report. Please try again.')
      }
    } catch (error) {
      console.error('Error submitting report:', error)
      Alert.alert('Error', 'Failed to submit report. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleClose = () => {
    setSelectedType(null)
    setDescription('')
    onClose()
  }

  return (
    <Modal
      visible={visible}
      animationType="fade"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={Colors.neutral[900]} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Report Content</Text>
          <View style={styles.headerRight} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Report Type Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>What would you like to report?</Text>
            <Text style={styles.sectionSubtitle}>
              Help us understand the issue so we can take appropriate action.
            </Text>

            <View style={styles.reportTypesList}>
              {reportTypes.map((type) => (
                <TouchableOpacity
                  key={type.id}
                  style={[
                    styles.reportTypeCard,
                    selectedType === type.id && styles.reportTypeCardSelected
                  ]}
                  onPress={() => setSelectedType(type.id)}
                >
                  <View style={styles.reportTypeContent}>
                    <View style={[
                      styles.reportTypeIcon,
                      { backgroundColor: selectedType === type.id ? type.color : Colors.neutral[100] }
                    ]}>
                      <Ionicons
                        name={type.icon as any}
                        size={20}
                        color={selectedType === type.id ? Colors.white : type.color}
                      />
                    </View>
                    <View style={styles.reportTypeText}>
                      <Text style={[
                        styles.reportTypeTitle,
                        selectedType === type.id && styles.reportTypeTitleSelected
                      ]}>
                        {type.title}
                      </Text>
                      <Text style={styles.reportTypeDescription}>
                        {type.description}
                      </Text>
                    </View>
                  </View>
                  {selectedType === type.id && (
                    <Ionicons name="checkmark-circle" size={24} color={type.color} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Description */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Additional Details</Text>
            <Text style={styles.sectionSubtitle}>
              Please provide more details about the issue. This helps us investigate and take appropriate action.
            </Text>

            <TextInput
              style={styles.descriptionInput}
              placeholder="Describe what happened and why you're reporting this..."
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              maxLength={500}
            />
            <Text style={styles.characterCount}>
              {description.length}/500 characters
            </Text>
          </View>

          {/* Privacy Notice */}
          <View style={styles.privacyNotice}>
            <Ionicons name="shield-checkmark" size={20} color={Colors.success[500]} />
            <Text style={styles.privacyText}>
              Your report is confidential. We will not share your identity with the reported user.
            </Text>
          </View>
        </ScrollView>

        {/* Submit Button */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[
              styles.submitButton,
              (!selectedType || description.trim().length < 10 || submitting) && styles.submitButtonDisabled
            ]}
            onPress={handleSubmit}
            disabled={!selectedType || description.trim().length < 10 || submitting}
          >
            {submitting ? (
              <ActivityIndicator color={Colors.white} size="small" />
            ) : (
              <>
                <Ionicons name="send" size={20} color={Colors.white} />
                <Text style={styles.submitButtonText}>Submit Report</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

export default React.memo(ReportModal)

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.secondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: Colors.background.primary,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  closeButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.neutral[900],
  },
  headerRight: {
    width: 32,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.neutral[900],
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: Colors.neutral[600],
    marginBottom: 16,
    lineHeight: 20,
  },
  reportTypesList: {
    gap: 12,
  },
  reportTypeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: Colors.background.primary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border.light,
  },
  reportTypeCardSelected: {
    borderColor: Colors.primary[500],
    backgroundColor: Colors.primary[50],
  },
  reportTypeContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  reportTypeIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  reportTypeText: {
    flex: 1,
  },
  reportTypeTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.neutral[900],
    marginBottom: 4,
  },
  reportTypeTitleSelected: {
    color: Colors.primary[700],
  },
  reportTypeDescription: {
    fontSize: 14,
    color: Colors.neutral[600],
    lineHeight: 18,
  },
  descriptionInput: {
    backgroundColor: Colors.background.primary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border.light,
    padding: 16,
    fontSize: 16,
    color: Colors.neutral[900],
    minHeight: 100,
  },
  characterCount: {
    fontSize: 12,
    color: Colors.neutral[500],
    textAlign: 'right',
    marginTop: 8,
  },
  privacyNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.success[50],
    padding: 16,
    borderRadius: 12,
    marginTop: 24,
    marginBottom: 20,
  },
  privacyText: {
    fontSize: 14,
    color: Colors.success[700],
    marginLeft: 12,
    flex: 1,
    lineHeight: 20,
  },
  footer: {
    padding: 20,
    backgroundColor: Colors.background.primary,
    borderTopWidth: 1,
    borderTopColor: Colors.border.light,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary[500],
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
  },
  submitButtonDisabled: {
    backgroundColor: Colors.neutral[300],
  },
  submitButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
})
