import React, { useState } from 'react'
import { View, Text, TouchableOpacity, Image, ScrollView, StyleSheet, Alert } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { ImageService } from '../services/ImageService'
import Colors from '../constants/Colors'

interface MultiImageUploadProps {
  onImagesChange: (images: string[]) => void
  currentImages?: string[]
  maxImages?: number
  placeholder?: string
  showPreview?: boolean
}

export default function MultiImageUpload({
  onImagesChange,
  currentImages = [],
  maxImages = 5,
  placeholder = "Add images",
  showPreview = true
}: MultiImageUploadProps) {
  const [uploading, setUploading] = useState(false)

  const handleAddImages = async () => {
    try {
      const remainingSlots = maxImages - currentImages.length
      if (remainingSlots <= 0) {
        Alert.alert('Limit Reached', `You can only upload up to ${maxImages} images.`)
        return
      }

      setUploading(true)

      // Request permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant camera roll permissions to upload images')
        return
      }

      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        selectionLimit: remainingSlots,
        quality: 0.8,
        aspect: [4, 3]
      })

      if (!result.canceled && result.assets.length > 0) {
        // Upload all selected images
        const uploadPromises = result.assets.map(asset => 
          ImageService.uploadImage(asset.uri, 'general-images')
        )
        
        const uploadResults = await Promise.all(uploadPromises)
        const successfulUploads = uploadResults
          .filter(result => result.success && result.url)
          .map(result => result.url!)

        if (successfulUploads.length > 0) {
          onImagesChange([...currentImages, ...successfulUploads])
        }

        // Show error if some uploads failed
        const failedUploads = uploadResults.filter(result => !result.success)
        if (failedUploads.length > 0) {
          Alert.alert('Upload Warning', `${failedUploads.length} image(s) failed to upload. Please try again.`)
        }
      }
    } catch (error) {
      console.error('Error adding images:', error)
      Alert.alert('Error', 'Failed to add images. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  const removeImage = (index: number) => {
    Alert.alert(
      'Remove Image',
      'Are you sure you want to remove this image?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Remove', 
          style: 'destructive', 
          onPress: () => {
            const newImages = currentImages.filter((_, i) => i !== index)
            onImagesChange(newImages)
          }
        }
      ]
    )
  }

  const canAddMore = currentImages.length < maxImages

  return (
    <View style={styles.container}>
      {/* Image Grid */}
      {showPreview && currentImages.length > 0 && (
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.imageScroll}
        >
          {currentImages.map((image, index) => (
            <View key={index} style={styles.imageContainer}>
              <Image source={{ uri: image }} style={styles.image} />
              <TouchableOpacity 
                style={styles.removeButton} 
                onPress={() => removeImage(index)}
              >
                <Ionicons name="close-circle" size={20} color={Colors.error?.[500] || '#ef4444'} />
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Add Image Button */}
      {canAddMore && (
        <TouchableOpacity 
          style={[styles.addButton, uploading && styles.uploadingButton]} 
          onPress={handleAddImages}
          disabled={uploading}
        >
          <Ionicons 
            name={uploading ? "hourglass" : "add"} 
            size={24} 
            color={uploading ? Colors.neutral?.[400] || '#9ca3af' : Colors.primary?.[500] || '#3b82f6'} 
          />
          <Text style={[styles.addButtonText, uploading && styles.uploadingText]}>
            {uploading ? 'Uploading...' : placeholder}
          </Text>
          {currentImages.length > 0 && (
            <Text style={styles.countText}>
              ({currentImages.length}/{maxImages})
            </Text>
          )}
        </TouchableOpacity>
      )}

      {/* Image Count */}
      {currentImages.length > 0 && (
        <Text style={styles.imageCount}>
          {currentImages.length} image{currentImages.length !== 1 ? 's' : ''} uploaded
        </Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  imageScroll: {
    marginBottom: 12,
  },
  imageContainer: {
    position: 'relative',
    marginRight: 12,
    borderRadius: 8,
    overflow: 'hidden',
  },
  image: {
    width: 120,
    height: 120,
    borderRadius: 8,
  },
  removeButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 10,
    padding: 2,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#d1d5db',
    borderStyle: 'dashed',
    borderRadius: 8,
    padding: 16,
    backgroundColor: '#f9fafb',
    gap: 8,
  },
  uploadingButton: {
    borderColor: '#9ca3af',
    backgroundColor: '#f3f4f6',
  },
  addButtonText: {
    fontSize: 16,
    color: '#374151',
    fontWeight: '500',
  },
  uploadingText: {
    color: '#9ca3af',
  },
  countText: {
    fontSize: 12,
    color: '#6b7280',
  },
  imageCount: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 8,
  },
})