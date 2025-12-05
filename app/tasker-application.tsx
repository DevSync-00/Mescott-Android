import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  Image,
  StatusBar,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useAuth } from '../contexts/SimpleAuthContext'
import { TaskerApplicationService } from '../services/TaskerApplicationService'
import { ImageService } from '../services/ImageService'
import * as ImagePicker from 'expo-image-picker'
import { Colors } from '../constants/Colors'

const SKILLS = [
  'Cleaning',
  'Handyman',
  'Delivery',
  'Photography',
  'Technology',
  'Gardening',
  'Pet Care',
  'Moving',
  'Tutoring',
  'Cooking',
]

export default function TaskerApplication() {
  const { user, isAuthenticated, refreshUserProfile } = useAuth()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    fullName: user?.full_name || '',
    phone: user?.phone || '',
    bio: '',
    skills: [] as string[],
    experience: '',
    idFrontUrl: '',
    idBackUrl: '',
    skillVerifications: [] as { skill: string; level: string; documents: string[] }[],
  })

  if (!isAuthenticated) {
    router.replace('/auth')
    return null
  }

  const handleSkillToggle = (skill: string) => {
    setFormData((prev) => ({
      ...prev,
      skills: prev.skills.includes(skill)
        ? prev.skills.filter((s) => s !== skill)
        : [...prev.skills, skill],
    }))
  }

  const handleImageUpload = async (type: 'front' | 'back') => {
    try {
      // Request permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant camera roll permissions to upload images')
        return
      }

      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [3, 2],
        quality: 0.8,
      })

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0]

        // Upload to Supabase Storage
        const uploadResult = await ImageService.uploadImage(asset.uri, 'id-verification')

        if (uploadResult.success && uploadResult.url) {
          setFormData((prev) => ({
            ...prev,
            [type === 'front' ? 'idFrontUrl' : 'idBackUrl']: uploadResult.url!,
          }))
        } else {
          Alert.alert('Upload Failed', uploadResult.error || 'Failed to upload image')
        }
      }
    } catch (error) {
      console.error('Image upload error:', error)
      Alert.alert('Error', 'Failed to upload image')
    }
  }

  const addSkillVerification = () => {
    setFormData((prev) => ({
      ...prev,
      skillVerifications: [
        ...prev.skillVerifications,
        { skill: '', level: 'intermediate', documents: [] },
      ],
    }))
  }

  const updateSkillVerification = (index: number, field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      skillVerifications: prev.skillVerifications.map((item, i) =>
        i === index ? { ...item, [field]: value } : item,
      ),
    }))
  }

  const removeSkillVerification = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      skillVerifications: prev.skillVerifications.filter((_, i) => i !== index),
    }))
  }

  const handleSkillDocumentUpload = async (skillIndex: number) => {
    try {
      // Request permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Please grant camera roll permissions to upload documents',
        )
        return
      }

      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      })

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0]

        // Upload to Supabase Storage
        const uploadResult = await ImageService.uploadImage(asset.uri, 'skill-documents')

        if (uploadResult.success && uploadResult.url) {
          setFormData((prev) => ({
            ...prev,
            skillVerifications: prev.skillVerifications.map((item, i) =>
              i === skillIndex
                ? { ...item, documents: [...item.documents, uploadResult.url!] }
                : item,
            ),
          }))
        } else {
          Alert.alert('Upload Failed', uploadResult.error || 'Failed to upload document')
        }
      }
    } catch (error) {
      console.error('Document upload error:', error)
      Alert.alert('Error', 'Failed to upload document')
    }
  }

  const removeSkillDocument = (skillIndex: number, docIndex: number) => {
    setFormData((prev) => ({
      ...prev,
      skillVerifications: prev.skillVerifications.map((item, i) =>
        i === skillIndex
          ? { ...item, documents: item.documents.filter((_, j) => j !== docIndex) }
          : item,
      ),
    }))
  }

  const handleSubmit = async () => {
    if (!formData.fullName.trim()) {
      Alert.alert('Error', 'Please enter your full name')
      return
    }
    if (!formData.phone.trim()) {
      Alert.alert('Error', 'Please enter your phone number')
      return
    }
    if (formData.skills.length === 0) {
      Alert.alert('Error', 'Please select at least one skill')
      return
    }
    if (!formData.idFrontUrl.trim()) {
      Alert.alert('Error', 'Please upload your National ID front image')
      return
    }
    if (!formData.idBackUrl.trim()) {
      Alert.alert('Error', 'Please upload your National ID back image')
      return
    }

    setLoading(true)
    try {
      console.log('🚀 TASKER APPLICATION - User object:', {
        id: user!.id,
        user_id: user!.user_id,
        full_name: user!.full_name,
        phone: user!.phone,
      })

      const applicationData = {
        user_id: user!.user_id, // This should be auth.users.id
        full_name: formData.fullName,
        phone: formData.phone,
        bio: formData.bio,
        skills: formData.skills,
        experience_years: parseInt(formData.experience) || 0,
        id_front_url: formData.idFrontUrl,
        id_back_url: formData.idBackUrl,
        skill_verifications: formData.skillVerifications,
        status: 'pending' as const,
      }

      console.log('🚀 TASKER APPLICATION - Application data:', applicationData)

      const result = await TaskerApplicationService.createApplication(applicationData)

      if (result) {
        // Refresh user profile to get updated application status
        try {
          await refreshUserProfile()
        } catch (error) {
          console.log('Profile refresh failed, but application was submitted:', error)
        }

        Alert.alert(
          'Success!',
          'Your application has been submitted successfully. We will review it and get back to you soon.',
          [
            {
              text: 'OK',
              onPress: () => {
                // Use setTimeout to avoid state update during render
                setTimeout(() => {
                  router.push('/profile')
                }, 100)
              },
            },
          ],
        )
      } else {
        Alert.alert('Error', 'Failed to submit application. Please try again.')
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to submit application')
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent={true} />
      {/* Header - Fixed */}
      <View style={styles.headerContainer}>
        <View style={[styles.header, { paddingTop: 8 + insets.top }]}>
          <TouchableOpacity onPress={() => router.push('/profile')} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={Colors.neutral[900]} />
          </TouchableOpacity>
          <Text style={styles.title}>Become a Tasker</Text>
          <View style={styles.placeholder} />
        </View>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.contentContainer, { paddingBottom: 32 + insets.bottom }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.subtitle}>
          Join our community of skilled taskers and start earning money by helping others with their
          tasks.
        </Text>

        {/* Personal Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Personal Information</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Full Name *</Text>
            <TextInput
              style={styles.input}
              value={formData.fullName}
              onChangeText={(text) => setFormData((prev) => ({ ...prev, fullName: text }))}
              placeholder="Enter your full name"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Phone Number *</Text>
            <TextInput
              style={styles.input}
              value={formData.phone}
              onChangeText={(text) => setFormData((prev) => ({ ...prev, phone: text }))}
              placeholder="Enter your phone number"
              keyboardType="phone-pad"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Bio</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={formData.bio}
              onChangeText={(text) => setFormData((prev) => ({ ...prev, bio: text }))}
              placeholder="Tell us about yourself and your experience"
              multiline
              numberOfLines={4}
            />
          </View>
        </View>

        {/* Skills */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Skills *</Text>
          <Text style={styles.sectionSubtitle}>Select the skills you can help with</Text>

          <View style={styles.skillsContainer}>
            {SKILLS.map((skill) => (
              <TouchableOpacity
                key={skill}
                style={[
                  styles.skillButton,
                  formData.skills.includes(skill) && styles.skillButtonSelected,
                ]}
                onPress={() => handleSkillToggle(skill)}
              >
                <Text
                  style={[
                    styles.skillText,
                    formData.skills.includes(skill) && styles.skillTextSelected,
                  ]}
                >
                  {skill}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Experience */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Experience</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Years of Experience</Text>
            <TextInput
              style={styles.input}
              value={formData.experience}
              onChangeText={(text) => setFormData((prev) => ({ ...prev, experience: text }))}
              placeholder="0"
              keyboardType="numeric"
            />
          </View>
        </View>

        {/* National ID Verification - Mandatory */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>National ID Verification *</Text>
          <Text style={styles.sectionSubtitle}>
            Upload clear photos of your National ID card (front and back)
          </Text>

          <View style={styles.idUploadContainer}>
            <View style={styles.idUploadItem}>
              <Text style={styles.label}>ID Front *</Text>
              <TouchableOpacity
                style={styles.uploadButton}
                onPress={() => handleImageUpload('front')}
              >
                {formData.idFrontUrl ? (
                  <Image source={{ uri: formData.idFrontUrl }} style={styles.uploadedImage} />
                ) : (
                  <View style={styles.uploadPlaceholder}>
                    <Ionicons name="camera" size={32} color={Colors.neutral[400]} />
                    <Text style={styles.uploadText}>Upload ID Front</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.idUploadItem}>
              <Text style={styles.label}>ID Back *</Text>
              <TouchableOpacity
                style={styles.uploadButton}
                onPress={() => handleImageUpload('back')}
              >
                {formData.idBackUrl ? (
                  <Image source={{ uri: formData.idBackUrl }} style={styles.uploadedImage} />
                ) : (
                  <View style={styles.uploadPlaceholder}>
                    <Ionicons name="camera" size={32} color={Colors.neutral[400]} />
                    <Text style={styles.uploadText}>Upload ID Back</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Skill Verification - Optional */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Skill Verification (Optional)</Text>
          <Text style={styles.sectionSubtitle}>
            Add certificates or documents to verify your skills
          </Text>

          {formData.skillVerifications.map((verification, index) => (
            <View key={index} style={styles.skillVerificationItem}>
              <View style={styles.skillVerificationHeader}>
                <Text style={styles.skillVerificationTitle}>Skill Verification {index + 1}</Text>
                <TouchableOpacity
                  onPress={() => removeSkillVerification(index)}
                  style={styles.removeButton}
                >
                  <Ionicons name="close-circle" size={20} color={Colors.neutral[400]} />
                </TouchableOpacity>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Skill</Text>
                <TextInput
                  style={styles.input}
                  value={verification.skill}
                  onChangeText={(text) => updateSkillVerification(index, 'skill', text)}
                  placeholder="e.g., Photography, Plumbing"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Proficiency Level</Text>
                <View style={styles.levelButtons}>
                  {['beginner', 'intermediate', 'advanced', 'expert'].map((level) => (
                    <TouchableOpacity
                      key={level}
                      style={[
                        styles.levelButton,
                        verification.level === level && styles.levelButtonSelected,
                      ]}
                      onPress={() => updateSkillVerification(index, 'level', level)}
                    >
                      <Text
                        style={[
                          styles.levelButtonText,
                          verification.level === level && styles.levelButtonTextSelected,
                        ]}
                      >
                        {level.charAt(0).toUpperCase() + level.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Supporting Documents (up to 5)</Text>
                <Text style={styles.helperText}>
                  Upload certificates, licenses, or other proof of skill
                </Text>

                <View style={styles.documentsContainer}>
                  {verification.documents.map((doc, docIndex) => (
                    <View key={docIndex} style={styles.documentItem}>
                      <Image source={{ uri: doc }} style={styles.documentImage} />
                      <TouchableOpacity
                        style={styles.removeDocumentButton}
                        onPress={() => removeSkillDocument(index, docIndex)}
                      >
                        <Ionicons name="close-circle" size={20} color={Colors.neutral[400]} />
                      </TouchableOpacity>
                    </View>
                  ))}

                  {verification.documents.length < 5 && (
                    <TouchableOpacity
                      style={styles.addDocumentButton}
                      onPress={() => handleSkillDocumentUpload(index)}
                    >
                      <Ionicons name="add" size={24} color={Colors.primary[500]} />
                      <Text style={styles.addDocumentText}>Add Document</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {verification.documents.length > 0 && (
                  <Text style={styles.documentCount}>
                    {verification.documents.length}/5 documents uploaded
                  </Text>
                )}
              </View>
            </View>
          ))}

          <TouchableOpacity style={styles.addSkillButton} onPress={addSkillVerification}>
            <Ionicons name="add" size={20} color={Colors.primary[500]} />
            <Text style={styles.addSkillText}>Add Skill Verification</Text>
          </TouchableOpacity>
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.submitButton, loading && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          <Text style={styles.submitButtonText}>
            {loading ? 'Submitting...' : 'Submit Application'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  headerContainer: {
    backgroundColor: Colors.background.primary,
    paddingTop: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: Colors.background.primary,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.neutral[900],
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  contentContainer: {
    paddingBottom: 32,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.neutral[600],
    lineHeight: 24,
    marginBottom: 24,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.neutral[900],
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: Colors.neutral[600],
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.neutral[700],
    marginBottom: 8,
  },
  input: {
    backgroundColor: Colors.neutral[100],
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: Colors.neutral[900],
    borderWidth: 1,
    borderColor: Colors.neutral[200],
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  skillsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  skillButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    backgroundColor: Colors.neutral[100],
    borderWidth: 1,
    borderColor: Colors.neutral[300],
  },
  skillButtonSelected: {
    backgroundColor: Colors.primary[500],
    borderColor: Colors.primary[500],
  },
  skillText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.neutral[700],
  },
  skillTextSelected: {
    color: Colors.neutral[50],
  },
  submitButton: {
    backgroundColor: Colors.primary[500],
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 40,
  },
  submitButtonDisabled: {
    backgroundColor: Colors.neutral[300],
  },
  submitButtonText: {
    color: Colors.neutral[50],
    fontSize: 16,
    fontWeight: '600',
  },
  // ID Upload Styles
  idUploadContainer: {
    flexDirection: 'row',
    gap: 16,
  },
  idUploadItem: {
    flex: 1,
  },
  uploadButton: {
    borderWidth: 2,
    borderColor: Colors.neutral[300],
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.neutral[50],
  },
  uploadPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadText: {
    marginTop: 8,
    fontSize: 14,
    color: Colors.neutral[600],
    textAlign: 'center',
  },
  uploadedImage: {
    width: 120,
    height: 80,
    borderRadius: 8,
  },
  // Skill Verification Styles
  skillVerificationItem: {
    backgroundColor: Colors.neutral[50],
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.neutral[200],
  },
  skillVerificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  skillVerificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.neutral[900],
  },
  removeButton: {
    padding: 4,
  },
  levelButtons: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  levelButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.neutral[100],
    borderWidth: 1,
    borderColor: Colors.neutral[300],
  },
  levelButtonSelected: {
    backgroundColor: Colors.primary[500],
    borderColor: Colors.primary[500],
  },
  levelButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.neutral[700],
  },
  levelButtonTextSelected: {
    color: Colors.neutral[50],
  },
  addSkillButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.primary[500],
    borderStyle: 'dashed',
    borderRadius: 12,
    backgroundColor: Colors.primary[50],
  },
  addSkillText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '500',
    color: Colors.primary[500],
  },
  // Document Upload Styles
  helperText: {
    fontSize: 12,
    color: Colors.neutral[500],
    marginBottom: 12,
  },
  documentsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  documentItem: {
    position: 'relative',
    width: 80,
    height: 60,
  },
  documentImage: {
    width: 80,
    height: 60,
    borderRadius: 8,
    backgroundColor: Colors.neutral[100],
  },
  removeDocumentButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: Colors.neutral[50],
    borderRadius: 10,
    padding: 2,
  },
  addDocumentButton: {
    width: 80,
    height: 60,
    borderWidth: 1,
    borderColor: Colors.primary[500],
    borderStyle: 'dashed',
    borderRadius: 8,
    backgroundColor: Colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  addDocumentText: {
    fontSize: 10,
    color: Colors.primary[500],
    textAlign: 'center',
    marginTop: 4,
  },
  documentCount: {
    fontSize: 12,
    color: Colors.neutral[600],
    textAlign: 'right',
    marginTop: 8,
  },
})
