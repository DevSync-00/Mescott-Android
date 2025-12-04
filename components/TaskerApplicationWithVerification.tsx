import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Image,
  Switch
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { TaskerApplicationService, TaskerApplication } from '../services/TaskerApplicationService'
import { ProfileVerificationService, VerificationStatus } from '../services/ProfileVerificationService'
import { ImageService } from '../services/ImageService'
import Colors from '../constants/Colors'

interface TaskerApplicationWithVerificationProps {
  userId: string
  onApplicationSubmitted?: (application: TaskerApplication) => void
  onVerificationComplete?: (verificationStatus: VerificationStatus) => void
}

interface ApplicationRequirementsState {
  missingRequirements: string[]
  completedRequirements: string[]
}

const TaskerApplicationWithVerification: React.FC<TaskerApplicationWithVerificationProps> = ({
  userId,
  onApplicationSubmitted,
  onVerificationComplete
}) => {
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [canApply, setCanApply] = useState(false)
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus | null>(null)
  const [requirements, setRequirements] = useState<ApplicationRequirementsState>({
    missingRequirements: [],
    completedRequirements: []
  })
  const [applicationData, setApplicationData] = useState({
    full_name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zip_code: '',
    date_of_birth: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    emergency_contact_relationship: '',
    bio: '',
    experience_years: 0,
    skills: [] as string[],
    availability: [] as string[],
    certifications: [] as string[],
    id_front_url: '',
    id_back_url: ''
  })
  const [newSkill, setNewSkill] = useState('')
  const [newCertification, setNewCertification] = useState('')
  const [agreedToTerms, setAgreedToTerms] = useState(false)

  useEffect(() => {
    checkApplicationEligibility()
  }, [userId])

  const checkApplicationEligibility = async () => {
    try {
      setLoading(true)
      
      const [eligibility, reqs, verification] = await Promise.all([
        TaskerApplicationService.canUserApplyToBeTasker(userId),
        TaskerApplicationService.getApplicationRequirements(userId),
        ProfileVerificationService.getVerificationStatus(userId),
      ])
      
      setCanApply(eligibility.canApply)
      setRequirements(reqs)
      setVerificationStatus(verification)
      
      if (verification && onVerificationComplete) {
        onVerificationComplete(verification)
      }
    } catch (error) {
      console.error('Error checking eligibility:', error)
      Alert.alert('Error', 'Failed to check application eligibility')
    } finally {
      setLoading(false)
    }
  }

  const handleImageUpload = async (type: 'front' | 'back') => {
    try {
      const result = await ImageService.pickImage({
        allowsMultipleSelection: false,
        selectionLimit: 1,
      })
      const uri = result && result.length > 0 ? result[0] : null
      if (!uri) {
        return
      }

      const uploadResult = await ImageService.uploadImage(uri, 'tasker-documents')
      if (uploadResult.success && uploadResult.url) {
        if (type === 'front') {
          setApplicationData({ ...applicationData, id_front_url: uploadResult.url })
        } else {
          setApplicationData({ ...applicationData, id_back_url: uploadResult.url })
        }
      } else {
        Alert.alert('Error', 'Failed to upload image')
      }
    } catch (error) {
      console.error('Error uploading image:', error)
      Alert.alert('Error', 'Failed to upload image')
    }
  }

  const addSkill = () => {
    if (newSkill.trim() && !applicationData.skills.includes(newSkill.trim())) {
      setApplicationData({
        ...applicationData,
        skills: [...applicationData.skills, newSkill.trim()]
      })
      setNewSkill('')
    }
  }

  const removeSkill = (skill: string) => {
    setApplicationData({
      ...applicationData,
      skills: applicationData.skills.filter(s => s !== skill)
    })
  }

  const addCertification = () => {
    if (newCertification.trim() && !applicationData.certifications.includes(newCertification.trim())) {
      setApplicationData({
        ...applicationData,
        certifications: [...applicationData.certifications, newCertification.trim()]
      })
      setNewCertification('')
    }
  }

  const removeCertification = (cert: string) => {
    setApplicationData({
      ...applicationData,
      certifications: applicationData.certifications.filter(c => c !== cert)
    })
  }

  const handleSubmit = async () => {
    if (!canApply) {
      Alert.alert('Cannot Apply', 'You do not meet the requirements to apply as a tasker')
      return
    }

    if (!agreedToTerms) {
      Alert.alert('Terms Required', 'Please agree to the terms and conditions')
      return
    }

    if (!applicationData.id_front_url || !applicationData.id_back_url) {
      Alert.alert('Documents Required', 'Please upload both front and back of your ID')
      return
    }

    try {
      setSubmitting(true)
      
      const application = await TaskerApplicationService.createApplication({
        ...applicationData,
        user_id: userId,
        status: 'pending',
      })

      if (application) {
        Alert.alert(
          'Application Submitted',
          'Your tasker application has been submitted successfully. We will review it and get back to you soon.',
          [{ text: 'OK', onPress: () => {
            if (onApplicationSubmitted) {
              onApplicationSubmitted(application)
            }
          }}]
        )
      } else {
        Alert.alert('Error', 'Failed to submit application')
      }
    } catch (error: any) {
      console.error('Error submitting application:', error)
      Alert.alert('Error', error.message || 'Failed to submit application')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary[500]} />
        <Text style={styles.loadingText}>Checking eligibility...</Text>
      </View>
    )
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Verification Status */}
      <View style={styles.verificationStatus}>
        <Text style={styles.sectionTitle}>Verification Status</Text>
        <View style={styles.verificationCard}>
          <View style={styles.verificationHeader}>
            <Ionicons 
              name={verificationStatus?.verification_badge === 'verified' ? 'checkmark-circle' : 'alert-circle'} 
              size={24} 
              color={verificationStatus?.verification_badge === 'verified' ? Colors.success[500] : Colors.warning[500]} 
            />
            <Text style={styles.verificationTitle}>
              {verificationStatus?.verification_badge?.toUpperCase() || 'UNVERIFIED'}
            </Text>
          </View>
          <Text style={styles.verificationScore}>
            Verification Score: {verificationStatus?.overall_verification_score || 0}/100
          </Text>
          
          <View style={styles.verificationDetails}>
            <View style={styles.verificationItem}>
              <Ionicons 
                name={verificationStatus?.phone_verified ? 'checkmark' : 'close'} 
                size={16} 
                color={verificationStatus?.phone_verified ? Colors.success[500] : Colors.error[500]} 
              />
              <Text style={styles.verificationItemText}>Phone Verified</Text>
            </View>
            <View style={styles.verificationItem}>
              <Ionicons 
                name={verificationStatus?.email_verified ? 'checkmark' : 'close'} 
                size={16} 
                color={verificationStatus?.email_verified ? Colors.success[500] : Colors.error[500]} 
              />
              <Text style={styles.verificationItemText}>Email Verified</Text>
            </View>
            <View style={styles.verificationItem}>
              <Ionicons 
                name={verificationStatus?.identity_verified ? 'checkmark' : 'close'} 
                size={16} 
                color={verificationStatus?.identity_verified ? Colors.success[500] : Colors.error[500]} 
              />
              <Text style={styles.verificationItemText}>Identity Verified</Text>
            </View>
            <View style={styles.verificationItem}>
              <Ionicons 
                name={verificationStatus?.skills_verified ? 'checkmark' : 'close'} 
                size={16} 
                color={verificationStatus?.skills_verified ? Colors.success[500] : Colors.error[500]} 
              />
              <Text style={styles.verificationItemText}>Skills Verified</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Requirements */}
      {requirements && (
        <View style={styles.requirementsSection}>
          <Text style={styles.sectionTitle}>Requirements</Text>
          <View style={styles.requirementsCard}>
            <Text style={styles.requirementsSubtitle}>Missing Requirements:</Text>
            {requirements?.missingRequirements.length > 0 ? (
              requirements.missingRequirements.map((req: string, index: number) => (
                <View key={`${req}-${index}`} style={styles.requirementItem}>
                  <Ionicons name="close-circle" size={16} color={Colors.error[500]} />
                  <Text style={styles.requirementText}>{req}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.allRequirementsMet}>All requirements met! ✅</Text>
            )}
          </View>
        </View>
      )}

      {!canApply && (
        <View style={styles.cannotApplyCard}>
          <Ionicons name="alert-circle" size={24} color={Colors.error[500]} />
          <Text style={styles.cannotApplyText}>
            You cannot apply to become a tasker yet. Please complete the missing requirements above.
          </Text>
        </View>
      )}

      {/* Application Form */}
      {canApply && (
        <View style={styles.formSection}>
          <Text style={styles.sectionTitle}>Application Form</Text>
          
          {/* Personal Information */}
          <View style={styles.formGroup}>
            <Text style={styles.formGroupTitle}>Personal Information</Text>
            
            <TextInput
              style={styles.input}
              placeholder="Full Name"
              value={applicationData.full_name}
              onChangeText={(text) => setApplicationData({ ...applicationData, full_name: text })}
            />
            
            <TextInput
              style={styles.input}
              placeholder="Email"
              value={applicationData.email}
              onChangeText={(text) => setApplicationData({ ...applicationData, email: text })}
              keyboardType="email-address"
            />
            
            <TextInput
              style={styles.input}
              placeholder="Phone"
              value={applicationData.phone}
              onChangeText={(text) => setApplicationData({ ...applicationData, phone: text })}
              keyboardType="phone-pad"
            />
            
            <TextInput
              style={styles.input}
              placeholder="Address"
              value={applicationData.address}
              onChangeText={(text) => setApplicationData({ ...applicationData, address: text })}
            />
            
            <View style={styles.row}>
              <TextInput
                style={[styles.input, styles.halfInput]}
                placeholder="City"
                value={applicationData.city}
                onChangeText={(text) => setApplicationData({ ...applicationData, city: text })}
              />
              <TextInput
                style={[styles.input, styles.halfInput]}
                placeholder="State"
                value={applicationData.state}
                onChangeText={(text) => setApplicationData({ ...applicationData, state: text })}
              />
            </View>
            
            <TextInput
              style={styles.input}
              placeholder="ZIP Code"
              value={applicationData.zip_code}
              onChangeText={(text) => setApplicationData({ ...applicationData, zip_code: text })}
            />
            
            <TextInput
              style={styles.input}
              placeholder="Date of Birth (YYYY-MM-DD)"
              value={applicationData.date_of_birth}
              onChangeText={(text) => setApplicationData({ ...applicationData, date_of_birth: text })}
            />
          </View>

          {/* Emergency Contact */}
          <View style={styles.formGroup}>
            <Text style={styles.formGroupTitle}>Emergency Contact</Text>
            
            <TextInput
              style={styles.input}
              placeholder="Emergency Contact Name"
              value={applicationData.emergency_contact_name}
              onChangeText={(text) => setApplicationData({ ...applicationData, emergency_contact_name: text })}
            />
            
            <TextInput
              style={styles.input}
              placeholder="Emergency Contact Phone"
              value={applicationData.emergency_contact_phone}
              onChangeText={(text) => setApplicationData({ ...applicationData, emergency_contact_phone: text })}
              keyboardType="phone-pad"
            />
            
            <TextInput
              style={styles.input}
              placeholder="Relationship"
              value={applicationData.emergency_contact_relationship}
              onChangeText={(text) => setApplicationData({ ...applicationData, emergency_contact_relationship: text })}
            />
          </View>

          {/* Professional Information */}
          <View style={styles.formGroup}>
            <Text style={styles.formGroupTitle}>Professional Information</Text>
            
            <TextInput
              style={styles.input}
              placeholder="Years of Experience"
              value={applicationData.experience_years.toString()}
              onChangeText={(text) => setApplicationData({ ...applicationData, experience_years: parseInt(text) || 0 })}
              keyboardType="numeric"
            />
          </View>

          {/* Skills */}
          <View style={styles.formGroup}>
            <Text style={styles.formGroupTitle}>Skills</Text>
            
            <View style={styles.addItemContainer}>
              <TextInput
                style={[styles.input, styles.addItemInput]}
                placeholder="Add a skill"
                value={newSkill}
                onChangeText={setNewSkill}
              />
              <TouchableOpacity style={styles.addButton} onPress={addSkill}>
                <Ionicons name="add" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.itemsList}>
              {applicationData.skills.map((skill, index) => (
                <View key={index} style={styles.itemChip}>
                  <Text style={styles.itemChipText}>{skill}</Text>
                  <TouchableOpacity onPress={() => removeSkill(skill)}>
                    <Ionicons name="close" size={16} color={Colors.error[500]} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </View>

          {/* Certifications */}
          <View style={styles.formGroup}>
            <Text style={styles.formGroupTitle}>Certifications</Text>
            
            <View style={styles.addItemContainer}>
              <TextInput
                style={[styles.input, styles.addItemInput]}
                placeholder="Add a certification"
                value={newCertification}
                onChangeText={setNewCertification}
              />
              <TouchableOpacity style={styles.addButton} onPress={addCertification}>
                <Ionicons name="add" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.itemsList}>
              {applicationData.certifications.map((cert, index) => (
                <View key={index} style={styles.itemChip}>
                  <Text style={styles.itemChipText}>{cert}</Text>
                  <TouchableOpacity onPress={() => removeCertification(cert)}>
                    <Ionicons name="close" size={16} color={Colors.error[500]} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </View>

          {/* ID Documents */}
          <View style={styles.formGroup}>
            <Text style={styles.formGroupTitle}>Identity Documents</Text>
            
            <View style={styles.documentUploadContainer}>
              <Text style={styles.documentLabel}>ID Front</Text>
              <TouchableOpacity 
                style={styles.documentUploadButton}
                onPress={() => handleImageUpload('front')}
              >
                {applicationData.id_front_url ? (
                  <Image source={{ uri: applicationData.id_front_url }} style={styles.documentPreview} />
                ) : (
                  <View style={styles.documentPlaceholder}>
                    <Ionicons name="camera" size={24} color={Colors.neutral[400]} />
                    <Text style={styles.documentPlaceholderText}>Upload ID Front</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
            
            <View style={styles.documentUploadContainer}>
              <Text style={styles.documentLabel}>ID Back</Text>
              <TouchableOpacity 
                style={styles.documentUploadButton}
                onPress={() => handleImageUpload('back')}
              >
                {applicationData.id_back_url ? (
                  <Image source={{ uri: applicationData.id_back_url }} style={styles.documentPreview} />
                ) : (
                  <View style={styles.documentPlaceholder}>
                    <Ionicons name="camera" size={24} color={Colors.neutral[400]} />
                    <Text style={styles.documentPlaceholderText}>Upload ID Back</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Terms Agreement */}
          <View style={styles.termsContainer}>
            <Switch
              value={agreedToTerms}
              onValueChange={setAgreedToTerms}
            />
            <Text style={styles.termsText}>
              I agree to the terms and conditions and understand that my application will be reviewed.
            </Text>
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.submitButton, !agreedToTerms && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={submitting || !agreedToTerms}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.submitButtonText}>Submit Application</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.secondary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: Colors.neutral[600],
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.neutral[900],
    marginBottom: 12,
  },
  verificationStatus: {
    padding: 20,
  },
  verificationCard: {
    backgroundColor: Colors.background.primary,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border.light,
  },
  verificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  verificationTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
    color: Colors.neutral[900],
  },
  verificationScore: {
    fontSize: 14,
    color: Colors.neutral[600],
    marginBottom: 12,
  },
  verificationDetails: {
    gap: 8,
  },
  verificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  verificationItemText: {
    marginLeft: 8,
    fontSize: 14,
    color: Colors.neutral[700],
  },
  requirementsSection: {
    padding: 20,
    paddingTop: 0,
  },
  requirementsCard: {
    backgroundColor: Colors.background.primary,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border.light,
  },
  requirementsSubtitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.neutral[900],
    marginBottom: 8,
  },
  requirementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  requirementText: {
    marginLeft: 8,
    fontSize: 14,
    color: Colors.neutral[700],
  },
  allRequirementsMet: {
    fontSize: 14,
    color: Colors.success[600],
    fontWeight: '500',
  },
  cannotApplyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.error[50],
    padding: 16,
    margin: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.error[200],
  },
  cannotApplyText: {
    marginLeft: 12,
    flex: 1,
    fontSize: 14,
    color: Colors.error[700],
  },
  formSection: {
    padding: 20,
  },
  formGroup: {
    marginBottom: 24,
  },
  formGroupTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.neutral[900],
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border.light,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: Colors.background.primary,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfInput: {
    flex: 1,
  },
  addItemContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  addItemInput: {
    flex: 1,
    marginBottom: 0,
  },
  addButton: {
    backgroundColor: Colors.primary[500],
    borderRadius: 8,
    padding: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  itemChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary[100],
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  itemChipText: {
    fontSize: 14,
    color: Colors.primary[700],
  },
  documentUploadContainer: {
    marginBottom: 16,
  },
  documentLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.neutral[700],
    marginBottom: 8,
  },
  documentUploadButton: {
    borderWidth: 2,
    borderColor: Colors.border.light,
    borderStyle: 'dashed',
    borderRadius: 8,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  documentPlaceholder: {
    alignItems: 'center',
  },
  documentPlaceholderText: {
    marginTop: 8,
    fontSize: 14,
    color: Colors.neutral[500],
  },
  documentPreview: {
    width: 100,
    height: 60,
    borderRadius: 4,
  },
  termsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
    gap: 12,
  },
  termsText: {
    flex: 1,
    fontSize: 14,
    color: Colors.neutral[700],
    lineHeight: 20,
  },
  submitButton: {
    backgroundColor: Colors.primary[500],
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  submitButtonDisabled: {
    backgroundColor: Colors.neutral[300],
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
})

export default TaskerApplicationWithVerification
