import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase } from '../lib/supabase'

export interface AppSettings {
  language: 'en' | 'am'
  theme: 'light' | 'dark' | 'system'
  notifications: {
    push: boolean
    email: boolean
    sms: boolean
    taskApplications: boolean
    taskUpdates: boolean
    chatMessages: boolean
    announcements: boolean
  }
  privacy: {
    profileVisibility: 'public' | 'private' | 'taskers-only'
    showPhoneNumber: boolean
    showEmail: boolean
    showLocation: boolean
  }
  preferences: {
    defaultMode: 'customer' | 'tasker' | 'both'
    autoAcceptTasks: boolean
    maxDistance: number // in kilometers
    currency: 'USD' | 'ETB'
    timezone: string
  }
  about: {
    version: string
    buildNumber: string
    lastUpdated: string
  }
}

export class SettingsService {
  private static readonly SETTINGS_KEY = 'app_settings'
  private static readonly DEFAULT_SETTINGS: AppSettings = {
    language: 'en',
    theme: 'system',
    notifications: {
      push: true,
      email: true,
      sms: false,
      taskApplications: true,
      taskUpdates: true,
      chatMessages: true,
      announcements: true,
    },
    privacy: {
      profileVisibility: 'public',
      showPhoneNumber: false,
      showEmail: false,
      showLocation: true,
    },
    preferences: {
      defaultMode: 'both',
      autoAcceptTasks: false,
      maxDistance: 50,
      currency: 'ETB',
      timezone: 'Africa/Addis_Ababa',
    },
    about: {
      version: '1.0.0',
      buildNumber: '1',
      lastUpdated: new Date().toISOString(),
    },
  }

  // Get all settings
  static async getSettings(): Promise<AppSettings> {
    try {
      const settingsJson = await AsyncStorage.getItem(this.SETTINGS_KEY)
      if (settingsJson) {
        const settings = JSON.parse(settingsJson)
        // Merge with default settings to ensure all properties exist
        return { ...this.DEFAULT_SETTINGS, ...settings }
      }
      return this.DEFAULT_SETTINGS
    } catch (error) {
      console.error('Error getting settings:', error)
      return this.DEFAULT_SETTINGS
    }
  }

  // Update settings
  static async updateSettings(updates: Partial<AppSettings>): Promise<boolean> {
    try {
      const currentSettings = await this.getSettings()
      const newSettings = { ...currentSettings, ...updates }
      await AsyncStorage.setItem(this.SETTINGS_KEY, JSON.stringify(newSettings))
      return true
    } catch (error) {
      console.error('Error updating settings:', error)
      return false
    }
  }

  // Update specific setting category
  static async updateNotificationSettings(updates: Partial<AppSettings['notifications']>): Promise<boolean> {
    try {
      const currentSettings = await this.getSettings()
      const newNotificationSettings = { ...currentSettings.notifications, ...updates }
      return await this.updateSettings({
        notifications: newNotificationSettings
      })
    } catch (error) {
      console.error('Error updating notification settings:', error)
      return false
    }
  }

  static async updatePrivacySettings(updates: Partial<AppSettings['privacy']>): Promise<boolean> {
    try {
      const currentSettings = await this.getSettings()
      const newPrivacySettings = { ...currentSettings.privacy, ...updates }
      return await this.updateSettings({
        privacy: newPrivacySettings
      })
    } catch (error) {
      console.error('Error updating privacy settings:', error)
      return false
    }
  }

  static async updatePreferences(updates: Partial<AppSettings['preferences']>): Promise<boolean> {
    try {
      const currentSettings = await this.getSettings()
      const newPreferences = { ...currentSettings.preferences, ...updates }
      return await this.updateSettings({
        preferences: newPreferences
      })
    } catch (error) {
      console.error('Error updating preferences:', error)
      return false
    }
  }

  // Reset settings to default
  static async resetSettings(): Promise<boolean> {
    try {
      await AsyncStorage.setItem(this.SETTINGS_KEY, JSON.stringify(this.DEFAULT_SETTINGS))
      return true
    } catch (error) {
      console.error('Error resetting settings:', error)
      return false
    }
  }

  // Clear all app data
  static async clearAllData(): Promise<boolean> {
    try {
      await AsyncStorage.clear()
      return true
    } catch (error) {
      console.error('Error clearing all data:', error)
      return false
    }
  }

  // Export settings
  static async exportSettings(): Promise<string> {
    try {
      const settings = await this.getSettings()
      return JSON.stringify(settings, null, 2)
    } catch (error) {
      console.error('Error exporting settings:', error)
      return ''
    }
  }

  // Import settings
  static async importSettings(settingsJson: string): Promise<boolean> {
    try {
      const settings = JSON.parse(settingsJson)
      await AsyncStorage.setItem(this.SETTINGS_KEY, JSON.stringify(settings))
      return true
    } catch (error) {
      console.error('Error importing settings:', error)
      return false
    }
  }

  // Get app version info
  static getAppVersion(): { version: string; buildNumber: string } {
    return {
      version: this.DEFAULT_SETTINGS.about.version,
      buildNumber: this.DEFAULT_SETTINGS.about.buildNumber
    }
  }

  // Check if first time setup
  static async isFirstTimeSetup(): Promise<boolean> {
    try {
      const settingsJson = await AsyncStorage.getItem(this.SETTINGS_KEY)
      return !settingsJson
    } catch (error) {
      console.error('Error checking first time setup:', error)
      return true
    }
  }

  // Complete first time setup
  static async completeFirstTimeSetup(): Promise<boolean> {
    try {
      await AsyncStorage.setItem(this.SETTINGS_KEY, JSON.stringify(this.DEFAULT_SETTINGS))
      return true
    } catch (error) {
      console.error('Error completing first time setup:', error)
      return false
    }
  }
}
