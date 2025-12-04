import React, { useEffect, useState } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useNotifications } from '../contexts/NotificationContext'
import Colors from '../constants/Colors'

interface NotificationBadgeProps {
  size?: number
  fontSize?: number
}

export default function NotificationBadge({ size = 20, fontSize = 12 }: NotificationBadgeProps) {
  const { unreadCount } = useNotifications()

  if (unreadCount === 0) {
    return null
  }

  return (
    <View style={[styles.badge, { width: size, height: size }]}>
      <Text style={[styles.badgeText, { fontSize }]}>
        {unreadCount > 99 ? '99+' : unreadCount.toString()}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: {
    backgroundColor: Colors.error[500],
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    top: -8,
    right: -8,
    minWidth: 20,
    minHeight: 20,
  },
  badgeText: {
    color: '#fff',
    fontWeight: 'bold',
    textAlign: 'center',
  },
})
