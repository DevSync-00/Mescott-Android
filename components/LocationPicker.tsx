import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Modal,
  ScrollView,
  TextInput,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { LocationService, LocationData } from '../services/LocationService'
import Colors from '../constants/Colors'

interface LocationPickerProps {
  onLocationSelect: (location: LocationData) => void
  currentLocation?: LocationData
  placeholder?: string
  showCurrentLocation?: boolean
  showAddressInput?: boolean
}

export default function LocationPicker({
  onLocationSelect,
  currentLocation,
  placeholder = "Select location",
  showCurrentLocation = true,
  showAddressInput = true
}: LocationPickerProps) {
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [addressInput, setAddressInput] = useState('')
  const [recentLocations, setRecentLocations] = useState<LocationData[]>([])

  useEffect(() => {
    loadRecentLocations()
  }, [])

  const loadRecentLocations = async () => {
    // In a real app, this would load from AsyncStorage or database
    // For now, we'll use some mock data
    setRecentLocations([
      {
        latitude: 40.7128,
        longitude: -74.0060,
        address: "New York, NY, USA",
        city: "New York",
        state: "NY",
        country: "USA",
        timestamp: Date.now(),
      },
      {
        latitude: 34.0522,
        longitude: -118.2437,
        address: "Los Angeles, CA, USA",
        city: "Los Angeles",
        state: "CA",
        country: "USA",
        timestamp: Date.now(),
      }
    ])
  }

  const getCurrentLocation = async () => {
    try {
      setLoading(true)
      const location = await LocationService.getCurrentLocation()
      
      if (location) {
        onLocationSelect(location)
        setShowModal(false)
      }
    } catch (error) {
      console.error('Error getting current location:', error)
      Alert.alert('Error', 'Failed to get current location')
    } finally {
      setLoading(false)
    }
  }

  const searchAddress = async () => {
    if (!addressInput.trim()) {
      Alert.alert('Error', 'Please enter an address')
      return
    }

    try {
      setLoading(true)
      const location = await LocationService.geocodeAddress(addressInput.trim())
      
      if (location) {
        onLocationSelect(location)
        setShowModal(false)
        setAddressInput('')
      } else {
        Alert.alert('Error', 'Address not found. Please try a different address.')
      }
    } catch (error) {
      console.error('Error searching address:', error)
      Alert.alert('Error', 'Failed to search address')
    } finally {
      setLoading(false)
    }
  }

  const selectRecentLocation = (location: LocationData) => {
    onLocationSelect(location)
    setShowModal(false)
  }

  const formatLocationDisplay = (location: LocationData): string => {
    if (location.address) {
      return location.address
    }
    
    const parts = [location.city, location.state, location.country].filter(Boolean)
    return parts.join(', ') || 'Unknown location'
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.locationButton}
        onPress={() => setShowModal(true)}
      >
        <Ionicons name="location" size={20} color={Colors.primary[500]} />
        <Text style={styles.locationText}>
          {currentLocation ? formatLocationDisplay(currentLocation) : placeholder}
        </Text>
        <Ionicons name="chevron-down" size={16} color={Colors.neutral[400]} />
      </TouchableOpacity>

      <Modal
        visible={showModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Location</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowModal(false)}
            >
              <Ionicons name="close" size={24} color={Colors.neutral[600]} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {/* Current Location */}
            {showCurrentLocation && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Current Location</Text>
                <TouchableOpacity
                  style={styles.optionButton}
                  onPress={getCurrentLocation}
                  disabled={loading}
                >
                  <View style={styles.optionIcon}>
                    <Ionicons name="locate" size={20} color={Colors.primary[500]} />
                  </View>
                  <View style={styles.optionContent}>
                    <Text style={styles.optionTitle}>Use Current Location</Text>
                    <Text style={styles.optionSubtitle}>Get your current position</Text>
                  </View>
                  {loading && <ActivityIndicator size="small" color={Colors.primary[500]} />}
                </TouchableOpacity>
              </View>
            )}

            {/* Address Search */}
            {showAddressInput && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Search Address</Text>
                <View style={styles.searchContainer}>
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Enter address..."
                    value={addressInput}
                    onChangeText={setAddressInput}
                    onSubmitEditing={searchAddress}
                    returnKeyType="search"
                  />
                  <TouchableOpacity
                    style={styles.searchButton}
                    onPress={searchAddress}
                    disabled={loading || !addressInput.trim()}
                  >
                    <Ionicons 
                      name="search" 
                      size={20} 
                      color={loading || !addressInput.trim() ? Colors.neutral[400] : Colors.primary[500]} 
                    />
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Recent Locations */}
            {recentLocations.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Recent Locations</Text>
                {recentLocations.map((location, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.optionButton}
                    onPress={() => selectRecentLocation(location)}
                  >
                    <View style={styles.optionIcon}>
                      <Ionicons name="time" size={20} color={Colors.neutral[500]} />
                    </View>
                    <View style={styles.optionContent}>
                      <Text style={styles.optionTitle} numberOfLines={1}>
                        {formatLocationDisplay(location)}
                      </Text>
                      <Text style={styles.optionSubtitle}>
                        {location.city}, {location.state}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={Colors.neutral[400]} />
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.background.primary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border.primary,
    gap: 12,
  },
  locationText: {
    flex: 1,
    fontSize: 16,
    color: Colors.neutral[700],
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
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: Colors.background.primary,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border.primary,
  },
  optionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary[50],
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
  optionSubtitle: {
    fontSize: 14,
    color: Colors.neutral[500],
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background.primary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border.primary,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: Colors.neutral[900],
  },
  searchButton: {
    padding: 8,
    marginLeft: 8,
  },
})
