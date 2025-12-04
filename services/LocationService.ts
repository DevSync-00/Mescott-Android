import * as Location from 'expo-location'
import { handleError } from '../utils/errorHandler'

type PermissionState = 'granted' | 'denied' | 'undetermined'

export interface LocationData {
  latitude: number
  longitude: number
  accuracy?: number
  altitude?: number
  heading?: number
  speed?: number
  timestamp: number
  address?: string
  city?: string
  state?: string
  country?: string
  postalCode?: string
}

export interface Address {
  street?: string
  city?: string
  state?: string
  country?: string
  postalCode?: string
  formattedAddress: string
}

export interface LocationPermission {
  granted: boolean
  canAskAgain: boolean
  status: PermissionState
}

export interface TaskLocation {
  id: string
  task_id: string
  latitude: number
  longitude: number
  address: string
  city: string
  state: string
  country: string
  postal_code?: string
  radius_km: number
  created_at: string
}

export interface NearbyTask extends TaskLocation {
  distance_km: number
  task_title: string
  task_budget: number
  task_urgency: string
  task_status: string
  customer_name: string
  customer_avatar?: string
}

export class LocationService {
  private static currentLocation: LocationData | null = null
  private static watchId: Location.LocationSubscription | null = null

  static async requestPermissions(): Promise<LocationPermission> {
    try {
      const { status, canAskAgain } = await Location.requestForegroundPermissionsAsync()
      return {
        granted: status === 'granted',
        canAskAgain,
        status: status as PermissionState,
      }
    } catch (error) {
      const appError = handleError(error, 'requestPermissions')
      console.error('Error requesting location permissions:', appError)
      return {
        granted: false,
        canAskAgain: false,
        status: 'denied',
      }
    }
  }

  static async checkPermissions(): Promise<LocationPermission> {
    try {
      const { status, canAskAgain } = await Location.getForegroundPermissionsAsync()
      return {
        granted: status === 'granted',
        canAskAgain,
        status: status as PermissionState,
      }
    } catch (error) {
      const appError = handleError(error, 'checkPermissions')
      console.error('Error checking location permissions:', appError)
      return {
        granted: false,
        canAskAgain: false,
        status: 'denied',
      }
    }
  }

  static async getCurrentLocation(): Promise<LocationData | null> {
    try {
      const permission = await this.checkPermissions()
      if (!permission.granted) {
        throw new Error('Location permission not granted')
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 10000,
        distanceInterval: 10,
      })

      const locationData: LocationData = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy || undefined,
        altitude: location.coords.altitude || undefined,
        heading: location.coords.heading || undefined,
        speed: location.coords.speed || undefined,
        timestamp: location.timestamp,
      }

      this.currentLocation = locationData
      return locationData
    } catch (error) {
      const appError = handleError(error, 'getCurrentLocation')
      console.error('Error getting current location:', appError)
      return null
    }
  }

  static async watchLocation(
    onLocationUpdate: (location: LocationData) => void,
    onError?: (error: Error) => void
  ): Promise<boolean> {
    try {
      const permission = await this.checkPermissions()
      if (!permission.granted) {
        throw new Error('Location permission not granted')
      }

      if (this.watchId) {
        this.watchId.remove()
      }

      this.watchId = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 30000,
          distanceInterval: 100,
        },
        (location) => {
          const locationData: LocationData = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            accuracy: location.coords.accuracy || undefined,
            altitude: location.coords.altitude || undefined,
            heading: location.coords.heading || undefined,
            speed: location.coords.speed || undefined,
            timestamp: location.timestamp,
          }
          this.currentLocation = locationData
          onLocationUpdate(locationData)
        }
      )

      return true
    } catch (error) {
      const appError = handleError(error, 'watchLocation')
      console.error('Error watching location:', appError)
      onError?.(appError)
      return false
    }
  }

  static stopWatchingLocation(): void {
    if (this.watchId) {
      this.watchId.remove()
      this.watchId = null
    }
  }

  static getCachedLocation(): LocationData | null {
    return this.currentLocation
  }

  static async reverseGeocode(latitude: number, longitude: number): Promise<Address | null> {
    try {
      const addresses = await Location.reverseGeocodeAsync({ latitude, longitude })
      if (addresses.length === 0) return null

      const address = addresses[0]
      return {
        street: address.street || undefined,
        city: address.city || undefined,
        state: address.region || undefined,
        country: address.country || undefined,
        postalCode: address.postalCode || undefined,
        formattedAddress: [address.street, address.city, address.region, address.country]
          .filter(Boolean)
          .join(', '),
      }
    } catch (error) {
      const appError = handleError(error, 'reverseGeocode')
      console.error('Error reverse geocoding:', appError)
      return null
    }
  }

  static async geocode(address: string): Promise<LocationData | null> {
    try {
      const locations = await Location.geocodeAsync(address)
      if (locations.length === 0) return null

      const location = locations[0]
      return {
        latitude: location.latitude,
        longitude: location.longitude,
        timestamp: Date.now(),
      }
    } catch (error) {
      const appError = handleError(error, 'geocode')
      console.error('Error geocoding address:', appError)
      return null
    }
  }

  static async geocodeAddress(address: string): Promise<LocationData | null> {
    try {
      const locations = await Location.geocodeAsync(address)
      if (!locations.length) return null

      const location = locations[0]
      const reverse = await this.reverseGeocode(location.latitude, location.longitude)

      return {
        latitude: location.latitude,
        longitude: location.longitude,
        timestamp: Date.now(),
        address: reverse?.formattedAddress || address,
        city: reverse?.city || (location as any)?.city,
        state: reverse?.state || (location as any)?.region,
        country: reverse?.country || (location as any)?.country,
        postalCode: reverse?.postalCode || (location as any)?.postalCode,
      }
    } catch (error) {
      const appError = handleError(error, 'geocodeAddress')
      console.error('Error performing address lookup:', appError)
      return null
    }
  }

  static calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371
    const dLat = this.deg2rad(lat2 - lat1)
    const dLon = this.deg2rad(lon2 - lon1)
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) *
        Math.cos(this.deg2rad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return Math.round(R * c * 100) / 100
  }

  private static deg2rad(deg: number): number {
    return (deg * Math.PI) / 180
  }

  static calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const dLon = this.deg2rad(lon2 - lon1)
    const lat1Rad = this.deg2rad(lat1)
    const lat2Rad = this.deg2rad(lat2)
    const y = Math.sin(dLon) * Math.cos(lat2Rad)
    const x =
      Math.cos(lat1Rad) * Math.sin(lat2Rad) -
      Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon)
    let bearing = Math.atan2(y, x)
    bearing = (bearing * 180) / Math.PI
    return (bearing + 360) % 360
  }

  static getDirectionName(bearing: number): string {
    const directions = [
      'N',
      'NNE',
      'NE',
      'ENE',
      'E',
      'ESE',
      'SE',
      'SSE',
      'S',
      'SSW',
      'SW',
      'WSW',
      'W',
      'WNW',
      'NW',
      'NNW',
    ]
    const index = Math.round(bearing / 22.5) % 16
    return directions[index]
  }

  static formatDistance(distanceKm: number): string {
    if (distanceKm < 1) {
      return `${Math.round(distanceKm * 1000)}m`
    }
    if (distanceKm < 10) {
      return `${distanceKm.toFixed(1)}km`
    }
    return `${Math.round(distanceKm)}km`
  }

  static isWithinRadius(
    centerLat: number,
    centerLon: number,
    pointLat: number,
    pointLon: number,
    radiusKm: number
  ): boolean {
    const distance = this.calculateDistance(centerLat, centerLon, pointLat, pointLon)
    return distance <= radiusKm
  }

  static async getNearbyTasks(
    latitude: number,
    longitude: number,
    radiusKm: number = 50
  ): Promise<NearbyTask[]> {
    try {
      const mockTasks: NearbyTask[] = [
        {
          id: '1',
          task_id: 'task_1',
          latitude: latitude + 0.01,
          longitude: longitude + 0.01,
          address: '123 Main St',
          city: 'Sample City',
          state: 'Sample State',
          country: 'Sample Country',
          postal_code: '12345',
          radius_km: 5,
          distance_km: 1.2,
          task_title: 'Sample Task 1',
          task_budget: 50,
          task_urgency: 'normal',
          task_status: 'available',
          customer_name: 'John Doe',
          customer_avatar: 'https://via.placeholder.com/40',
          created_at: new Date().toISOString(),
        },
      ]
      return mockTasks
    } catch (error) {
      const appError = handleError(error, 'getNearbyTasks')
      console.error('Error getting nearby tasks:', appError)
      return []
    }
  }

  static async getLocationRecommendations(
    latitude: number,
    longitude: number,
    userPreferences?: {
      maxDistance?: number
      categories?: string[]
      budgetRange?: { min: number; max: number }
    }
  ): Promise<NearbyTask[]> {
    try {
      const maxDistance = userPreferences?.maxDistance || 25
      const tasks = await this.getNearbyTasks(latitude, longitude, maxDistance)

      let filteredTasks = tasks
      if (userPreferences?.budgetRange) {
        filteredTasks = filteredTasks.filter(
          (task) =>
            task.task_budget >= userPreferences.budgetRange!.min &&
            task.task_budget <= userPreferences.budgetRange!.max
        )
      }
      return filteredTasks
    } catch (error) {
      const appError = handleError(error, 'getLocationRecommendations')
      console.error('Error getting location recommendations:', appError)
      return []
    }
  }

  static async getEstimatedTravelTime(
    fromLat: number,
    fromLon: number,
    toLat: number,
    toLon: number,
    transportMode: 'driving' | 'walking' | 'cycling' | 'transit' = 'driving'
  ): Promise<{ duration: number; distance: number } | null> {
    try {
      const distance = this.calculateDistance(fromLat, fromLon, toLat, toLon)
      let speedKmh = 50
      switch (transportMode) {
        case 'walking':
          speedKmh = 5
          break
        case 'cycling':
          speedKmh = 15
          break
        case 'transit':
          speedKmh = 25
          break
        default:
          speedKmh = 50
      }

      const duration = (distance / speedKmh) * 60
      return {
        duration: Math.round(duration),
        distance: Math.round(distance * 1000),
      }
    } catch (error) {
      const appError = handleError(error, 'getEstimatedTravelTime')
      console.error('Error getting estimated travel time:', appError)
      return null
    }
  }

  static getLocationHistory(): LocationData[] {
    return []
  }

  static clearLocationHistory(): void {
    console.log('Location history cleared')
  }

  static getAccuracyLevel(accuracy?: number): 'high' | 'medium' | 'low' {
    if (!accuracy) return 'medium'
    if (accuracy <= 10) return 'high'
    if (accuracy <= 50) return 'medium'
    return 'low'
  }

  static isLocationRecent(location: LocationData): boolean {
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000
    return location.timestamp > fiveMinutesAgo
  }
}
import * as Location from 'expo-location'
import { handleError } from '../utils/errorHandler'

type PermissionState = 'granted' | 'denied' | 'undetermined'

export interface LocationData {
  latitude: number
  longitude: number
  accuracy?: number
  altitude?: number
  heading?: number
  speed?: number
  timestamp: number
  address?: string
  city?: string
  state?: string
  country?: string
  postalCode?: string
}

export interface Address {
  street?: string
  city?: string
  state?: string
  country?: string
  postalCode?: string
  formattedAddress: string
}

export interface LocationPermission {
  granted: boolean
  canAskAgain: boolean
  status: PermissionState
}

export interface TaskLocation {
  id: string
  task_id: string
  latitude: number
  longitude: number
  address: string
  city: string
  state: string
  country: string
  postal_code?: string
  radius_km: number
  created_at: string
}

export interface NearbyTask extends TaskLocation {
  distance_km: number
  task_title: string
  task_budget: number
  task_urgency: string
  task_status: string
  customer_name: string
  customer_avatar?: string
}

export class LocationService {
  private static currentLocation: LocationData | null = null
  private static watchId: Location.LocationSubscription | null = null

  // Request location permissions
  static async requestPermissions(): Promise<LocationPermission> {
    try {
      const { status, canAskAgain } = await Location.requestForegroundPermissionsAsync()
      
      return {
        granted: status === 'granted',
        canAskAgain,
        status: status as PermissionState
      }
    } catch (error) {
      const appError = handleError(error, 'requestPermissions')
      console.error('Error requesting location permissions:', appError)
      return {
        granted: false,
        canAskAgain: false,
        status: 'denied'
      }
    }
  }

  // Check current permission status
  static async checkPermissions(): Promise<LocationPermission> {
    try {
      const { status, canAskAgain } = await Location.getForegroundPermissionsAsync()
      
      return {
        granted: status === 'granted',
        canAskAgain,
        status: status as PermissionState
      }
    } catch (error) {
      const appError = handleError(error, 'checkPermissions')
      console.error('Error checking location permissions:', appError)
      return {
        granted: false,
        canAskAgain: false,
        status: 'denied'
      }
    }
  }

  // Get current location
  static async getCurrentLocation(): Promise<LocationData | null> {
    try {
      const permission = await this.checkPermissions()
      if (!permission.granted) {
        throw new Error('Location permission not granted')
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 10000,
        distanceInterval: 10
      })

      const locationData: LocationData = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy || undefined,
        altitude: location.coords.altitude || undefined,
        heading: location.coords.heading || undefined,
        speed: location.coords.speed || undefined,
        timestamp: location.timestamp
      }

      this.currentLocation = locationData
      return locationData
    } catch (error) {
      const appError = handleError(error, 'getCurrentLocation')
      console.error('Error getting current location:', appError)
      return null
    }
  }

  // Watch location changes
  static async watchLocation(
    onLocationUpdate: (location: LocationData) => void,
    onError?: (error: Error) => void
  ): Promise<boolean> {
    try {
      const permission = await this.checkPermissions()
      if (!permission.granted) {
        throw new Error('Location permission not granted')
      }

      // Stop existing watch if any
      if (this.watchId) {
        this.watchId.remove()
      }

      this.watchId = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 30000, // Update every 30 seconds
          distanceInterval: 100 // Update every 100 meters
        },
        (location) => {
          const locationData: LocationData = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            accuracy: location.coords.accuracy || undefined,
            altitude: location.coords.altitude || undefined,
            heading: location.coords.heading || undefined,
            speed: location.coords.speed || undefined,
            timestamp: location.timestamp
          }

          this.currentLocation = locationData
          onLocationUpdate(locationData)
        }
      )

      return true
    } catch (error) {
      const appError = handleError(error, 'watchLocation')
      console.error('Error watching location:', appError)
      onError?.(appError)
      return false
    }
  }

  // Stop watching location
  static stopWatchingLocation(): void {
    if (this.watchId) {
      this.watchId.remove()
      this.watchId = null
    }
  }

  // Get cached current location
  static getCachedLocation(): LocationData | null {
    return this.currentLocation
  }

  // Reverse geocoding - convert coordinates to address
  static async reverseGeocode(latitude: number, longitude: number): Promise<Address | null> {
    try {
      const addresses = await Location.reverseGeocodeAsync({
        latitude,
        longitude
      })

      if (addresses.length === 0) return null

      const address = addresses[0]
      return {
        street: address.street || undefined,
        city: address.city || undefined,
        state: address.region || undefined,
        country: address.country || undefined,
        postalCode: address.postalCode || undefined,
        formattedAddress: [
          address.street,
          address.city,
          address.region,
          address.country
        ].filter(Boolean).join(', ')
      }
    } catch (error) {
      const appError = handleError(error, 'reverseGeocode')
      console.error('Error reverse geocoding:', appError)
      return null
    }
  }

  // Forward geocoding - convert address to coordinates
  static async geocode(address: string): Promise<LocationData | null> {
    try {
      const locations = await Location.geocodeAsync(address)
      
      if (locations.length === 0) return null

      const location = locations[0]
      return {
        latitude: location.latitude,
        longitude: location.longitude,
        timestamp: Date.now()
      }
    } catch (error) {
      const appError = handleError(error, 'geocode')
      console.error('Error geocoding address:', appError)
      return null
    }
  }

  static async geocodeAddress(address: string): Promise<LocationData | null> {
    try {
      const locations = await Location.geocodeAsync(address)
      if (locations.length === 0) return null

      const location = locations[0]
      const reverseAddress = await this.reverseGeocode(location.latitude, location.longitude)

      return {
        latitude: location.latitude,
        longitude: location.longitude,
        timestamp: Date.now(),
        address: reverseAddress?.formattedAddress || address,
        city: reverseAddress?.city || (location as any)?.city,
        state: reverseAddress?.state || (location as any)?.region,
        country: reverseAddress?.country || (location as any)?.country,
        postalCode: reverseAddress?.postalCode || (location as any)?.postalCode,
      }
    } catch (error) {
      const appError = handleError(error, 'geocodeAddress')
      console.error('Error searching address:', appError)
      return null
    }
  }

  // Calculate distance between two points (Haversine formula)
  static calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371 // Earth's radius in kilometers
    const dLat = this.deg2rad(lat2 - lat1)
    const dLon = this.deg2rad(lon2 - lon1)
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    const distance = R * c // Distance in kilometers
    return Math.round(distance * 100) / 100 // Round to 2 decimal places
  }

  // Convert degrees to radians
  private static deg2rad(deg: number): number {
    return deg * (Math.PI / 180)
  }

  // Calculate bearing between two points
  static calculateBearing(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const dLon = this.deg2rad(lon2 - lon1)
    const lat1Rad = this.deg2rad(lat1)
    const lat2Rad = this.deg2rad(lat2)

    const y = Math.sin(dLon) * Math.cos(lat2Rad)
    const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - 
              Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon)

    let bearing = Math.atan2(y, x)
    bearing = this.rad2deg(bearing)
    bearing = (bearing + 360) % 360

    return Math.round(bearing)
  }

  // Convert radians to degrees
  private static rad2deg(rad: number): number {
    return rad * (180 / Math.PI)
  }

  // Get direction name from bearing
  static getDirectionName(bearing: number): string {
    const directions = [
      'N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
      'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'
    ]
    const index = Math.round(bearing / 22.5) % 16
    return directions[index]
  }

  // Format distance for display
  static formatDistance(distanceKm: number): string {
    if (distanceKm < 1) {
      return `${Math.round(distanceKm * 1000)}m`
    } else if (distanceKm < 10) {
      return `${distanceKm.toFixed(1)}km`
    } else {
      return `${Math.round(distanceKm)}km`
    }
  }

  // Check if location is within radius
  static isWithinRadius(
    centerLat: number,
    centerLon: number,
    pointLat: number,
    pointLon: number,
    radiusKm: number
  ): boolean {
    const distance = this.calculateDistance(centerLat, centerLon, pointLat, pointLon)
    return distance <= radiusKm
  }

  // Get nearby tasks (this would typically call your backend API)
  static async getNearbyTasks(
    latitude: number,
    longitude: number,
    radiusKm: number = 50,
    limit: number = 20
  ): Promise<NearbyTask[]> {
    try {
      // This is a mock implementation
      // In a real app, you would call your backend API with these parameters
      console.log(`Getting nearby tasks within ${radiusKm}km of ${latitude}, ${longitude}`)
      
      // Mock data for demonstration
      const mockTasks: NearbyTask[] = [
        {
          id: '1',
          task_id: 'task_1',
          latitude: latitude + 0.01,
          longitude: longitude + 0.01,
          address: '123 Main St',
          city: 'Sample City',
          state: 'Sample State',
          country: 'Sample Country',
          postal_code: '12345',
          radius_km: 5,
          distance_km: 1.2,
          task_title: 'Sample Task 1',
          task_budget: 50,
          task_urgency: 'normal',
          task_status: 'available',
          customer_name: 'John Doe',
          customer_avatar: 'https://via.placeholder.com/40',
          created_at: new Date().toISOString()
        }
      ]

      return mockTasks
    } catch (error) {
      const appError = handleError(error, 'getNearbyTasks')
      console.error('Error getting nearby tasks:', appError)
      return []
    }
  }

  // Get location-based recommendations
  static async getLocationRecommendations(
    latitude: number,
    longitude: number,
    userPreferences?: {
      maxDistance?: number
      categories?: string[]
      budgetRange?: { min: number; max: number }
    }
  ): Promise<NearbyTask[]> {
    try {
      const maxDistance = userPreferences?.maxDistance || 25
      const tasks = await this.getNearbyTasks(latitude, longitude, maxDistance)
      
      // Filter by preferences
      let filteredTasks = tasks

      if (userPreferences?.categories && userPreferences.categories.length > 0) {
        // This would filter by categories in a real implementation
        console.log('Filtering by categories:', userPreferences.categories)
      }

      if (userPreferences?.budgetRange) {
        filteredTasks = filteredTasks.filter(task => 
          task.task_budget >= userPreferences.budgetRange!.min &&
          task.task_budget <= userPreferences.budgetRange!.max
        )
      }

      return filteredTasks
    } catch (error) {
      const appError = handleError(error, 'getLocationRecommendations')
      console.error('Error getting location recommendations:', appError)
      return []
    }
  }

  // Get estimated travel time (mock implementation)
  static async getEstimatedTravelTime(
    fromLat: number,
    fromLon: number,
    toLat: number,
    toLon: number,
    transportMode: 'driving' | 'walking' | 'cycling' | 'transit' = 'driving'
  ): Promise<{ duration: number; distance: number } | null> {
    try {
      // This is a mock implementation
      // In a real app, you would use Google Maps API or similar
      const distance = this.calculateDistance(fromLat, fromLon, toLat, toLon)
      
      let speedKmh = 50 // Default driving speed
      switch (transportMode) {
        case 'walking':
          speedKmh = 5
          break
        case 'cycling':
          speedKmh = 15
          break
        case 'transit':
          speedKmh = 25
          break
        case 'driving':
        default:
          speedKmh = 50
          break
      }

      const duration = (distance / speedKmh) * 60 // Duration in minutes
      
      return {
        duration: Math.round(duration),
        distance: Math.round(distance * 1000) // Distance in meters
      }
    } catch (error) {
      const appError = handleError(error, 'getEstimatedTravelTime')
      console.error('Error getting estimated travel time:', appError)
      return null
    }
  }

  // Get location history (for analytics)
  static getLocationHistory(): LocationData[] {
    // This would typically be stored in local storage or database
    // For now, return empty array
    return []
  }

  // Clear location history
  static clearLocationHistory(): void {
    // This would clear stored location history
    console.log('Location history cleared')
  }

  // Get location accuracy level
  static getAccuracyLevel(accuracy?: number): 'high' | 'medium' | 'low' {
    if (!accuracy) return 'medium'
    
    if (accuracy <= 10) return 'high'
    if (accuracy <= 50) return 'medium'
    return 'low'
  }

  // Check if location is recent (within last 5 minutes)
  static isLocationRecent(location: LocationData): boolean {
    const fiveMinutesAgo = Date.now() - (5 * 60 * 1000)
    return location.timestamp > fiveMinutesAgo
  }
}