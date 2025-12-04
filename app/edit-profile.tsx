import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  StatusBar,
  Image,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useAuth } from '../contexts/SimpleAuthContext'
import { ProfileService } from '../services/ProfileService'
import ImageUpload from '../components/ImageUpload'
import * as ImagePicker from 'expo-image-picker'
import { ImageService } from '../services/ImageService'
import Colors from '../constants/Colors'
import SkeletonLoader from '../components/SkeletonLoader'


export default function EditProfile() {
  const { user, refreshUserProfile } = useAuth()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [formData, setFormData] = useState({
    fullName: '',
    username: '',
    phone: '',
    bio: '',
    location: '',
    avatarUrl: ''
  })

  useEffect(() => {
    if (user?.profile || user) {
      setFormData({
        fullName: user.profile?.full_name || (user as any).full_name || '',
        username: user.profile?.username || (user as any).username || '',
        phone: user.profile?.phone || (user as any).phone || '',
        bio: (user.profile as any)?.bio || '',
        location: (user.profile as any)?.location || '',
        avatarUrl: user.profile?.avatar_url || (user as any).avatar_url || ''
      })
    }
  }, [user])

  const handleAvatarUpload = async () => {
    try {
      setUploadingAvatar(true)
      
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
        aspect: [1, 1],
        quality: 0.8,
      })

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0]
        
        // Upload to Supabase Storage
        const uploadResult = await ImageService.uploadImage(asset.uri, 'profile-pictures')
        
        if (uploadResult.success && uploadResult.url) {
          setFormData(prev => ({ ...prev, avatarUrl: uploadResult.url! }))
        } else {
          Alert.alert('Upload Failed', uploadResult.error || 'Failed to upload image')
        }
      }
    } catch (error) {
      console.error('Error selecting image:', error)
      Alert.alert('Error', 'Failed to select image. Please try again.')
    } finally {
      setUploadingAvatar(false)
    }
  }

  const handleRemoveAvatar = () => {
    Alert.alert(
      'Remove Photo',
      'Are you sure you want to remove your profile picture?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Remove', 
          style: 'destructive', 
          onPress: () => setFormData(prev => ({ ...prev, avatarUrl: '' }))
        }
      ]
    )
  }

  const handleSave = async () => {
    if (!user) return

    if (!formData.fullName.trim()) {
      Alert.alert('Error', 'Please enter your full name')
      return
    }

    setSaving(true)
    try {
      const updates = {
        full_name: formData.fullName,
        username: formData.username,
        phone: formData.phone,
        bio: formData.bio,
        location: formData.location,
        avatar_url: formData.avatarUrl,
      }

      await ProfileService.updateProfile(user.id, updates)
      
      // Refresh user profile in auth context so changes appear everywhere
      await refreshUserProfile()
      
      Alert.alert('Success', 'Profile updated successfully!', [
        { text: 'OK', onPress: () => router.push('/profile') }
      ])
    } catch (error) {
      console.error('Error updating profile:', error)
      Alert.alert('Error', 'Failed to update profile. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  // Advanced list handlers removed in minimal flow

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent={true} />
      {/* Header */}
      <View style={[styles.header, { paddingTop: 4 + insets.top }]}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.push('/profile')}
        >
          <Ionicons name="arrow-back" size={24} color={Colors.neutral[900]} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <TouchableOpacity 
          style={styles.saveButton}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <SkeletonLoader width={20} height={20} borderRadius={10} />
          ) : (
            <Text style={styles.saveButtonText}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.content} 
        contentContainerStyle={{ paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
        bounces={true}
        alwaysBounceVertical={true}
      >
        {/* Profile Photo */}
        <View style={styles.photoSection}>
          <Text style={styles.photoSectionTitle}>Profile Photo</Text>
          <View style={styles.avatarContainer}>
            {formData.avatarUrl ? (
              <Image 
                source={{ uri: formData.avatarUrl }} 
                style={styles.avatarImage}
              />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Ionicons name="person" size={48} color={Colors.primary[500]} />
              </View>
            )}
            <TouchableOpacity 
              style={styles.changePhotoButton}
              onPress={handleAvatarUpload}
              disabled={uploadingAvatar}
            >
              {uploadingAvatar ? (
                <ActivityIndicator size="small" color={Colors.primary[500]} />
              ) : (
                <>
                  <Ionicons name="camera" size={20} color={Colors.primary[500]} />
                  <Text style={styles.changePhotoText}>Change Photo</Text>
                </>
              )}
            </TouchableOpacity>
            {formData.avatarUrl && (
              <TouchableOpacity 
                style={styles.removePhotoButton}
                onPress={handleRemoveAvatar}
              >
                <Ionicons name="close-circle" size={24} color={Colors.error[500]} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Basic Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Basic Information</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Full Name *</Text>
            <TextInput
              style={styles.input}
              value={formData.fullName}
              onChangeText={(text) => setFormData(prev => ({ ...prev, fullName: text }))}
              placeholder="Enter your full name"
              placeholderTextColor={Colors.neutral[400]}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Username</Text>
            <TextInput
              style={styles.input}
              value={formData.username}
              onChangeText={(text) => setFormData(prev => ({ ...prev, username: text }))}
              placeholder="Enter your username"
              placeholderTextColor={Colors.neutral[400]}
            />
          </View>

          {/* Email removed for now - not part of minimal profile update */}

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Phone Number</Text>
            <TextInput
              style={styles.input}
              value={formData.phone}
              onChangeText={(text) => setFormData(prev => ({ ...prev, phone: text }))}
              placeholder="Enter your phone number"
              placeholderTextColor={Colors.neutral[400]}
              keyboardType="phone-pad"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Bio</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={formData.bio}
              onChangeText={(text) => setFormData(prev => ({ ...prev, bio: text }))}
              placeholder="Tell us about yourself"
              placeholderTextColor={Colors.neutral[400]}
              multiline
              numberOfLines={4}
            />
          </View>
        </View>

        {/* Location */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Location</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Location</Text>
            <TextInput
              style={styles.input}
              value={formData.location}
              onChangeText={(text) => setFormData(prev => ({ ...prev, location: text }))}
              placeholder="City, Area (optional)"
              placeholderTextColor={Colors.neutral[400]}
            />
          </View>
          {/* City/State/ZIP removed for minimal edit flow */}
        </View>
        {/* Advanced fields removed for initial launch */}
      </ScrollView>
    </SafeAreaView>
  )
}

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
    paddingVertical: 4,
    backgroundColor: Colors.background.primary,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.neutral[900],
  },
  saveButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  saveButtonText: {
    color: Colors.primary[500],
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  photoSection: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingTop: 20,
    paddingBottom: 32,
    width: '100%',
  },
  photoSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.neutral[700],
    marginBottom: 24,
    alignSelf: 'flex-start',
  },
  avatarContainer: {
    position: 'relative',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.neutral[100],
  },
  avatarPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.primary[100],
    justifyContent: 'center',
    alignItems: 'center',
  },
  changePhotoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 24,
    backgroundColor: Colors.primary[50],
    borderWidth: 1,
    borderColor: Colors.primary[200],
    marginTop: 16,
    gap: 8,
  },
  changePhotoText: {
    color: Colors.primary[500],
    fontSize: 16,
    fontWeight: '600',
  },
  removePhotoButton: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: Colors.background.primary,
    borderRadius: 16,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
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
    fontSize: 16,
    fontWeight: '600',
    color: Colors.neutral[700],
    marginBottom: 8,
  },
  input: {
    backgroundColor: Colors.background.primary,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.neutral[900],
    borderWidth: 1,
    borderColor: Colors.border.primary,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfWidth: {
    flex: 1,
  },
  skillsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  skillChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary[100],
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    gap: 6,
  },
  skillText: {
    fontSize: 14,
    color: Colors.primary[600],
    fontWeight: '500',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: Colors.background.primary,
    borderWidth: 1,
    borderColor: Colors.primary[500],
    borderStyle: 'dashed',
    gap: 6,
  },
  addButtonText: {
    fontSize: 14,
    color: Colors.primary[500],
    fontWeight: '500',
  },
})
