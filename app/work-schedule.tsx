import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Switch,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useAuth } from '../contexts/SimpleAuthContext'
import Colors from '../constants/Colors'

interface TimeSlot {
  id: string
  day: string
  startTime: string
  endTime: string
  isAvailable: boolean
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const TIME_SLOTS = [
  '06:00', '07:00', '08:00', '09:00', '10:00', '11:00', '12:00',
  '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00'
]

export default function WorkSchedule() {
  const { user } = useAuth()
  const router = useRouter()
  const [schedule, setSchedule] = useState<TimeSlot[]>([])
  const [isAvailable, setIsAvailable] = useState(true)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadSchedule()
  }, [])

  const loadSchedule = async () => {
    try {
      // Initialize default schedule
      const defaultSchedule: TimeSlot[] = DAYS.map((day, index) => ({
        id: `day_${index}`,
        day,
        startTime: '09:00',
        endTime: '17:00',
        isAvailable: true,
      }))
      setSchedule(defaultSchedule)
    } catch (error) {
      console.error('Error loading schedule:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleDayAvailability = (dayId: string) => {
    setSchedule(prev => 
      prev.map(slot => 
        slot.id === dayId 
          ? { ...slot, isAvailable: !slot.isAvailable }
          : slot
      )
    )
  }

  const updateTimeSlot = (dayId: string, field: 'startTime' | 'endTime', time: string) => {
    setSchedule(prev => 
      prev.map(slot => 
        slot.id === dayId 
          ? { ...slot, [field]: time }
          : slot
      )
    )
  }

  const saveSchedule = async () => {
    try {
      // Here you would save to your backend
      Alert.alert('Success', 'Your work schedule has been updated')
    } catch (error) {
      console.error('Error saving schedule:', error)
      Alert.alert('Error', 'Failed to save schedule')
    }
  }

  const copyToAllDays = (dayId: string) => {
    const sourceDay = schedule.find(slot => slot.id === dayId)
    if (!sourceDay) return

    setSchedule(prev => 
      prev.map(slot => ({
        ...slot,
        startTime: sourceDay.startTime,
        endTime: sourceDay.endTime,
        isAvailable: sourceDay.isAvailable,
      }))
    )
    Alert.alert('Success', 'Schedule copied to all days')
  }

  const resetToDefault = () => {
    Alert.alert(
      'Reset Schedule',
      'Are you sure you want to reset your schedule to default?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Reset', 
          style: 'destructive',
          onPress: () => {
            loadSchedule()
            Alert.alert('Success', 'Schedule reset to default')
          }
        }
      ]
    )
  }

  const getAvailabilityStats = () => {
    const availableDays = schedule.filter(slot => slot.isAvailable).length
    const totalHours = schedule
      .filter(slot => slot.isAvailable)
      .reduce((total, slot) => {
        const start = parseInt(slot.startTime.split(':')[0])
        const end = parseInt(slot.endTime.split(':')[0])
        return total + (end - start)
      }, 0)
    
    return { availableDays, totalHours }
  }

  const stats = getAvailabilityStats()

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading your schedule...</Text>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.push('/settings')} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.neutral[900]} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Work Schedule</Text>
        <TouchableOpacity onPress={saveSchedule} style={styles.saveButton}>
          <Text style={styles.saveText}>Save</Text>
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={true}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Availability Toggle */}
        <View style={styles.availabilitySection}>
          <View style={styles.availabilityHeader}>
            <View style={styles.availabilityInfo}>
              <Ionicons name="calendar-outline" size={24} color={Colors.primary[500]} />
              <View style={styles.availabilityText}>
                <Text style={styles.availabilityTitle}>Overall Availability</Text>
                <Text style={styles.availabilitySubtitle}>
                  {isAvailable ? 'You are available for work' : 'You are not available for work'}
                </Text>
              </View>
            </View>
            <Switch
              value={isAvailable}
              onValueChange={setIsAvailable}
              trackColor={{ false: Colors.neutral[300], true: Colors.primary[200] }}
              thumbColor={isAvailable ? Colors.primary[500] : Colors.neutral[400]}
            />
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsSection}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats.availableDays}</Text>
            <Text style={styles.statLabel}>Available Days</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats.totalHours}</Text>
            <Text style={styles.statLabel}>Hours per Week</Text>
          </View>
        </View>

        {/* Schedule */}
        <View style={styles.scheduleSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Weekly Schedule</Text>
            <View style={styles.sectionActions}>
              <TouchableOpacity 
                style={styles.actionButton}
                onPress={resetToDefault}
              >
                <Ionicons name="refresh-outline" size={16} color={Colors.neutral[600]} />
                <Text style={styles.actionText}>Reset</Text>
              </TouchableOpacity>
            </View>
          </View>

          {schedule.map((slot, index) => (
            <View key={slot.id} style={styles.dayCard}>
              <View style={styles.dayHeader}>
                <View style={styles.dayLeft}>
                  <Switch
                    value={slot.isAvailable}
                    onValueChange={() => toggleDayAvailability(slot.id)}
                    trackColor={{ false: Colors.neutral[300], true: Colors.primary[200] }}
                    thumbColor={slot.isAvailable ? Colors.primary[500] : Colors.neutral[400]}
                  />
                  <Text style={[
                    styles.dayName,
                    !slot.isAvailable && styles.dayNameDisabled
                  ]}>
                    {slot.day}
                  </Text>
                </View>
                {slot.isAvailable && (
                  <TouchableOpacity 
                    style={styles.copyButton}
                    onPress={() => copyToAllDays(slot.id)}
                  >
                    <Ionicons name="copy-outline" size={16} color={Colors.primary[500]} />
                  </TouchableOpacity>
                )}
              </View>

              {slot.isAvailable && (
                <View style={styles.timeSlots}>
                  <View style={styles.timeSlot}>
                    <Text style={styles.timeLabel}>Start Time</Text>
                    <View style={styles.timeSelector}>
                      {TIME_SLOTS.map(time => (
                        <TouchableOpacity
                          key={time}
                          style={[
                            styles.timeOption,
                            slot.startTime === time && styles.timeOptionSelected
                          ]}
                          onPress={() => updateTimeSlot(slot.id, 'startTime', time)}
                        >
                          <Text style={[
                            styles.timeText,
                            slot.startTime === time && styles.timeTextSelected
                          ]}>
                            {time}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  <View style={styles.timeSlot}>
                    <Text style={styles.timeLabel}>End Time</Text>
                    <View style={styles.timeSelector}>
                      {TIME_SLOTS.map(time => (
                        <TouchableOpacity
                          key={time}
                          style={[
                            styles.timeOption,
                            slot.endTime === time && styles.timeOptionSelected
                          ]}
                          onPress={() => updateTimeSlot(slot.id, 'endTime', time)}
                        >
                          <Text style={[
                            styles.timeText,
                            slot.endTime === time && styles.timeTextSelected
                          ]}>
                            {time}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                </View>
              )}
            </View>
          ))}
        </View>

        {/* Tips */}
        <View style={styles.tipsSection}>
          <View style={styles.tipCard}>
            <Ionicons name="bulb-outline" size={20} color={Colors.warning[500]} />
            <Text style={styles.tipText}>
              Set your availability to match when you&apos;re most productive. 
              Customers will see your available hours when booking.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: Colors.neutral[600],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.primary,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '600',
    color: Colors.neutral[900],
  },
  saveButton: {
    padding: 8,
  },
  saveText: {
    fontSize: 16,
    color: Colors.primary[500],
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  availabilitySection: {
    margin: 20,
    backgroundColor: Colors.background.secondary,
    borderRadius: 12,
    padding: 16,
  },
  availabilityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  availabilityInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  availabilityText: {
    marginLeft: 12,
    flex: 1,
  },
  availabilityTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.neutral[900],
    marginBottom: 2,
  },
  availabilitySubtitle: {
    fontSize: 14,
    color: Colors.neutral[600],
  },
  statsSection: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.primary[50],
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.primary[600],
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: Colors.neutral[600],
    textAlign: 'center',
  },
  scheduleSection: {
    margin: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.neutral[900],
  },
  sectionActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: Colors.neutral[100],
    borderRadius: 6,
  },
  actionText: {
    fontSize: 14,
    color: Colors.neutral[600],
    marginLeft: 4,
  },
  dayCard: {
    backgroundColor: Colors.background.secondary,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  dayLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dayName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.neutral[900],
    marginLeft: 12,
  },
  dayNameDisabled: {
    color: Colors.neutral[400],
  },
  copyButton: {
    padding: 8,
  },
  timeSlots: {
    gap: 16,
  },
  timeSlot: {
    gap: 8,
  },
  timeLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.neutral[700],
  },
  timeSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  timeOption: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: Colors.neutral[100],
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.border.primary,
  },
  timeOptionSelected: {
    backgroundColor: Colors.primary[500],
    borderColor: Colors.primary[500],
  },
  timeText: {
    fontSize: 12,
    color: Colors.neutral[600],
  },
  timeTextSelected: {
    color: '#fff',
    fontWeight: '500',
  },
  tipsSection: {
    margin: 20,
  },
  tipCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.warning[50],
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: Colors.warning[500],
  },
  tipText: {
    flex: 1,
    fontSize: 14,
    color: Colors.neutral[700],
    marginLeft: 12,
    lineHeight: 20,
  },
})
