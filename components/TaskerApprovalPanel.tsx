import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
  Image,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { TaskerApprovalService, TaskerApprovalData } from '../services/TaskerApprovalService'
import Colors from '../constants/Colors'

interface TaskerApprovalPanelProps {
  visible: boolean
  onClose: () => void
  adminId: string
  userEmail?: string
  userName?: string
}

export default function TaskerApprovalPanel({ visible, onClose, adminId, userEmail, userName }: TaskerApprovalPanelProps) {
  const [applications, setApplications] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedApplication, setSelectedApplication] = useState<any | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)

  useEffect(() => {
    if (visible) {
      loadApplications()
    }
  }, [visible])

  const loadApplications = async () => {
    try {
      setLoading(true)
      const data = await TaskerApprovalService.getPendingApplications()
      setApplications(data)
    } catch (error) {
      console.error('Error loading applications:', error)
      Alert.alert('Error', 'Failed to load applications')
    } finally {
      setLoading(false)
    }
  }

  const handleApproval = async (applicationId: string, status: 'approved' | 'rejected') => {
    try {
      // Get or create admin record first
      let actualAdminId = adminId
      
      if (userEmail && userName) {
        const adminRecordId = await TaskerApprovalService.getOrCreateAdminRecord(
          adminId, // user_id
          userEmail,
          userName
        )
        
        if (adminRecordId) {
          actualAdminId = adminRecordId
        } else {
          Alert.alert('Error', 'Failed to create admin record')
          return
        }
      }

      const success = await TaskerApprovalService.updateTaskerApplicationStatus({
        applicationId,
        adminId: actualAdminId,
        status,
        adminNotes: `Application ${status} by admin`
      })

      if (success) {
        Alert.alert(
          'Success',
          `Application ${status} successfully!`,
          [{ text: 'OK', onPress: loadApplications }]
        )
      } else {
        Alert.alert('Error', `Failed to ${status} application`)
      }
    } catch (error) {
      console.error('Error handling approval:', error)
      Alert.alert('Error', 'Failed to process application')
    }
  }

  const showApplicationDetail = async (applicationId: string) => {
    try {
      const application = await TaskerApprovalService.getTaskerApplication(applicationId)
      setSelectedApplication(application)
      setShowDetailModal(true)
    } catch (error) {
      console.error('Error loading application detail:', error)
      Alert.alert('Error', 'Failed to load application details')
    }
  }

  const renderApplicationCard = (application: any) => (
    <View key={application.id} style={styles.applicationCard}>
      <View style={styles.applicationHeader}>
        <View style={styles.avatarContainer}>
          {application.profile?.avatar_url ? (
            <Image
              source={{ uri: application.profile.avatar_url }}
              style={styles.avatar}
            />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Ionicons name="person" size={24} color={Colors.neutral[400]} />
            </View>
          )}
        </View>
        <View style={styles.applicationInfo}>
          <Text style={styles.applicantName}>
            {application.profile?.full_name || application.full_name || 'Unknown'}
          </Text>
          <Text style={styles.applicantPhone}>
            {application.profile?.phone || application.phone || 'No phone'}
          </Text>
          <Text style={styles.applicationDate}>
            Applied: {new Date(application.created_at).toLocaleDateString()}
          </Text>
        </View>
        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>{application.status}</Text>
        </View>
      </View>

      <View style={styles.applicationDetails}>
        <Text style={styles.bioText}>
          {application.bio || 'No bio provided'}
        </Text>
        <Text style={styles.experienceText}>
          Experience: {application.experience_years || 0} years
        </Text>
        {application.skills && application.skills.length > 0 && (
          <View style={styles.skillsContainer}>
            <Text style={styles.skillsLabel}>Skills:</Text>
            <View style={styles.skillsList}>
              {application.skills.slice(0, 3).map((skill: string, index: number) => (
                <View key={index} style={styles.skillTag}>
                  <Text style={styles.skillText}>{skill}</Text>
                </View>
              ))}
              {application.skills.length > 3 && (
                <Text style={styles.moreSkillsText}>
                  +{application.skills.length - 3} more
                </Text>
              )}
            </View>
          </View>
        )}
      </View>

      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={styles.detailButton}
          onPress={() => showApplicationDetail(application.id)}
        >
          <Ionicons name="eye" size={16} color={Colors.primary[500]} />
          <Text style={styles.detailButtonText}>View Details</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.rejectButton}
          onPress={() => handleApproval(application.id, 'rejected')}
        >
          <Ionicons name="close" size={16} color={Colors.error[500]} />
          <Text style={styles.rejectButtonText}>Reject</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.approveButton}
          onPress={() => handleApproval(application.id, 'approved')}
        >
          <Ionicons name="checkmark" size={16} color="#fff" />
          <Text style={styles.approveButtonText}>Approve</Text>
        </TouchableOpacity>
      </View>
    </View>
  )

  if (!visible) return null

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={Colors.neutral[600]} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Tasker Applications</Text>
          <View style={styles.placeholder} />
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.primary[500]} />
            <Text style={styles.loadingText}>Loading applications...</Text>
          </View>
        ) : (
          <ScrollView style={styles.content}>
            {applications.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="document-text-outline" size={64} color={Colors.neutral[300]} />
                <Text style={styles.emptyTitle}>No Pending Applications</Text>
                <Text style={styles.emptySubtitle}>
                  All tasker applications have been reviewed.
                </Text>
              </View>
            ) : (
              <View style={styles.applicationsList}>
                {applications.map(renderApplicationCard)}
              </View>
            )}
          </ScrollView>
        )}

        {/* Application Detail Modal */}
        {selectedApplication && (
          <Modal
            visible={showDetailModal}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={() => setShowDetailModal(false)}
          >
            <View style={styles.container}>
              <View style={styles.header}>
                <TouchableOpacity
                  onPress={() => setShowDetailModal(false)}
                  style={styles.closeButton}
                >
                  <Ionicons name="close" size={24} color={Colors.neutral[600]} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Application Details</Text>
                <View style={styles.placeholder} />
              </View>
              
              <ScrollView style={styles.content}>
                <View style={styles.detailCard}>
                  <Text style={styles.detailTitle}>Full Application Details</Text>
                  <Text style={styles.detailText}>
                    {JSON.stringify(selectedApplication, null, 2)}
                  </Text>
                </View>
              </ScrollView>
            </View>
          </Modal>
        )}
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.neutral[50],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral[200],
  },
  closeButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.neutral[900],
  },
  placeholder: {
    width: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: Colors.neutral[600],
    marginTop: 12,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.neutral[700],
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.neutral[500],
    marginTop: 8,
    textAlign: 'center',
  },
  applicationsList: {
    gap: 16,
  },
  applicationCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.neutral[200],
  },
  applicationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarContainer: {
    marginRight: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.neutral[100],
    justifyContent: 'center',
    alignItems: 'center',
  },
  applicationInfo: {
    flex: 1,
  },
  applicantName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.neutral[900],
  },
  applicantPhone: {
    fontSize: 14,
    color: Colors.neutral[600],
    marginTop: 2,
  },
  applicationDate: {
    fontSize: 12,
    color: Colors.neutral[500],
    marginTop: 2,
  },
  statusBadge: {
    backgroundColor: Colors.warning[100],
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.warning[700],
    textTransform: 'capitalize',
  },
  applicationDetails: {
    marginBottom: 16,
  },
  bioText: {
    fontSize: 14,
    color: Colors.neutral[700],
    lineHeight: 20,
    marginBottom: 8,
  },
  experienceText: {
    fontSize: 14,
    color: Colors.neutral[600],
    marginBottom: 8,
  },
  skillsContainer: {
    marginTop: 8,
  },
  skillsLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.neutral[700],
    marginBottom: 4,
  },
  skillsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  skillTag: {
    backgroundColor: Colors.primary[100],
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  skillText: {
    fontSize: 12,
    color: Colors.primary[700],
  },
  moreSkillsText: {
    fontSize: 12,
    color: Colors.neutral[500],
    alignSelf: 'center',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  detailButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: Colors.primary[50],
    borderRadius: 6,
    gap: 4,
  },
  detailButtonText: {
    fontSize: 12,
    color: Colors.primary[500],
  },
  rejectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: Colors.error[50],
    borderRadius: 6,
    gap: 4,
  },
  rejectButtonText: {
    fontSize: 12,
    color: Colors.error[500],
  },
  approveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: Colors.success[500],
    borderRadius: 6,
    gap: 4,
  },
  approveButtonText: {
    fontSize: 12,
    color: '#fff',
  },
  detailCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.neutral[200],
  },
  detailTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.neutral[900],
    marginBottom: 12,
  },
  detailText: {
    fontSize: 12,
    color: Colors.neutral[600],
    fontFamily: 'monospace',
  },
})
