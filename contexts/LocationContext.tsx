import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { LocationService, LocationData, Address, LocationPermission } from '../services/LocationService'
import { useToast } from './ToastContext'

interface LocationContextType {
  currentLocation: LocationData | null
  currentAddress: Address | null
  permission: LocationPermission
  isLocationEnabled: boolean
  isWatching: boolean
  nearbyTasks: any[]
  loading: boolean
  error: string | null
  requestPermission: () => Promise<boolean>
  getCurrentLocation: () => Promise<LocationData | null>
  startWatching: () => Promise<boolean>
  stopWatching: () => void
  getNearbyTasks: (radiusKm?: number) => Promise<any[]>
  reverseGeocode: (latitude: number, longitude: number) => Promise<Address | null>
  geocode: (address: string) => Promise<LocationData | null>
  calculateDistance: (lat1: number, lon1: number, lat2: number, lon2: number) => number
  formatDistance: (distanceKm: number) => string
  isWithinRadius: (centerLat: number, centerLon: number, pointLat: number, pointLon: number, radiusKm: number) => boolean
}

const LocationContext = createContext<LocationContextType | undefined>(undefined)

export function LocationProvider({ children }: { children: React.ReactNode }) {
  const { showToast } = useToast()
  const [currentLocation, setCurrentLocation] = useState<LocationData | null>(null)
  const [currentAddress, setCurrentAddress] = useState<Address | null>(null)
  const [permission, setPermission] = useState<LocationPermission>({
    granted: false,
    canAskAgain: true,
    status: 'undetermined'
  })
  const [isLocationEnabled, setIsLocationEnabled] = useState(false)
  const [isWatching, setIsWatching] = useState(false)
  const [nearbyTasks, setNearbyTasks] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Initialize location service
  useEffect(() => {
    initializeLocation()
  }, [])

  const initializeLocation = async () => {
    try {
      setLoading(true)
      setError(null)

      // Check current permissions
      const currentPermission = await LocationService.checkPermissions()
      setPermission(currentPermission)

      if (currentPermission.granted) {
        setIsLocationEnabled(true)
        // Try to get current location
        const location = await LocationService.getCurrentLocation()
        if (location) {
          setCurrentLocation(location)
          // Get address for current location
          const address = await LocationService.reverseGeocode(location.latitude, location.longitude)
          setCurrentAddress(address)
        }
      }
    } catch (error) {
      console.error('Error initializing location:', error)
      setError('Failed to initialize location service')
    } finally {
      setLoading(false)
    }
  }

  const requestPermission = useCallback(async (): Promise<boolean> => {
    try {
      setLoading(true)
      setError(null)

      const permissionResult = await LocationService.requestPermissions()
      setPermission(permissionResult)

      if (permissionResult.granted) {
        setIsLocationEnabled(true)
        showToast('Location permission granted', 'success')
        
        // Get current location after permission granted
        const location = await getCurrentLocation()
        if (location) {
          const address = await reverseGeocode(location.latitude, location.longitude)
          setCurrentAddress(address)
        }
        
        return true
      } else {
        setIsLocationEnabled(false)
        showToast('Location permission denied', 'error')
        return false
      }
    } catch (error) {
      console.error('Error requesting location permission:', error)
      setError('Failed to request location permission')
      showToast('Failed to request location permission', 'error')
      return false
    } finally {
      setLoading(false)
    }
  }, [showToast])

  const getCurrentLocation = useCallback(async (): Promise<LocationData | null> => {
    try {
      setLoading(true)
      setError(null)

      const location = await LocationService.getCurrentLocation()
      if (location) {
        setCurrentLocation(location)
        setIsLocationEnabled(true)
        return location
      } else {
        setError('Unable to get current location')
        return null
      }
    } catch (error) {
      console.error('Error getting current location:', error)
      setError('Failed to get current location')
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  const startWatching = useCallback(async (): Promise<boolean> => {
    try {
      if (!permission.granted) {
        const permissionGranted = await requestPermission()
        if (!permissionGranted) return false
      }

      setError(null)
      
      const success = await LocationService.watchLocation(
        (location: LocationData) => {
          setCurrentLocation(location)
          setIsLocationEnabled(true)
          
          // Update address for new location
          reverseGeocode(location.latitude, location.longitude)
        },
        (error: Error) => {
          console.error('Location watch error:', error)
          setError('Location tracking error')
          setIsWatching(false)
        }
      )

      if (success) {
        setIsWatching(true)
        showToast('Location tracking started', 'success')
      } else {
        setError('Failed to start location tracking')
        showToast('Failed to start location tracking', 'error')
      }

      return success
    } catch (error) {
      console.error('Error starting location watch:', error)
      setError('Failed to start location tracking')
      showToast('Failed to start location tracking', 'error')
      return false
    }
  }, [permission.granted, requestPermission, showToast])

  const stopWatching = useCallback(() => {
    LocationService.stopWatchingLocation()
    setIsWatching(false)
    showToast('Location tracking stopped', 'info')
  }, [showToast])

  const getNearbyTasks = useCallback(async (radiusKm: number = 25): Promise<any[]> => {
    try {
      if (!currentLocation) {
        const location = await getCurrentLocation()
        if (!location) {
          setError('No location available')
          return []
        }
      }

      setLoading(true)
      setError(null)

      const tasks = await LocationService.getNearbyTasks(
        currentLocation!.latitude,
        currentLocation!.longitude,
        radiusKm
      )

      setNearbyTasks(tasks)
      return tasks
    } catch (error) {
      console.error('Error getting nearby tasks:', error)
      setError('Failed to get nearby tasks')
      return []
    } finally {
      setLoading(false)
    }
  }, [currentLocation, getCurrentLocation])

  const reverseGeocode = useCallback(async (latitude: number, longitude: number): Promise<Address | null> => {
    try {
      const address = await LocationService.reverseGeocode(latitude, longitude)
      if (address) {
        setCurrentAddress(address)
      }
      return address
    } catch (error) {
      console.error('Error reverse geocoding:', error)
      return null
    }
  }, [])

  const geocode = useCallback(async (address: string): Promise<LocationData | null> => {
    try {
      return await LocationService.geocode(address)
    } catch (error) {
      console.error('Error geocoding address:', error)
      return null
    }
  }, [])

  const calculateDistance = useCallback((lat1: number, lon1: number, lat2: number, lon2: number): number => {
    return LocationService.calculateDistance(lat1, lon1, lat2, lon2)
  }, [])

  const formatDistance = useCallback((distanceKm: number): string => {
    return LocationService.formatDistance(distanceKm)
  }, [])

  const isWithinRadius = useCallback((centerLat: number, centerLon: number, pointLat: number, pointLon: number, radiusKm: number): boolean => {
    return LocationService.isWithinRadius(centerLat, centerLon, pointLat, pointLon, radiusKm)
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      LocationService.stopWatchingLocation()
    }
  }, [])

  const value: LocationContextType = {
    currentLocation,
    currentAddress,
    permission,
    isLocationEnabled,
    isWatching,
    nearbyTasks,
    loading,
    error,
    requestPermission,
    getCurrentLocation,
    startWatching,
    stopWatching,
    getNearbyTasks,
    reverseGeocode,
    geocode,
    calculateDistance,
    formatDistance,
    isWithinRadius
  }

  return (
    <LocationContext.Provider value={value}>
      {children}
    </LocationContext.Provider>
  )
}

export function useLocation() {
  const context = useContext(LocationContext)
  if (context === undefined) {
    throw new Error('useLocation must be used within a LocationProvider')
  }
  return context
}
