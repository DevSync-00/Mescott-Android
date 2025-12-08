import React from 'react'
import { View, StyleSheet } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Colors } from '../constants/Colors'

interface TextureBackgroundProps {
  children: React.ReactNode
  style?: any
}

/**
 * TextureBackground component adds a subtle rough/textured finish to backgrounds
 * Uses multiple gradient overlays to create a textured, paper-like appearance
 */
export default function TextureBackground({ children, style }: TextureBackgroundProps) {
  return (
    <View style={[styles.container, style]}>
      {/* Base background with subtle off-white tone */}
      <View style={styles.baseBackground} />
      
      {/* Multiple texture overlay layers for rough finish effect */}
      {/* Diagonal texture */}
      <LinearGradient
        colors={['rgba(0,0,0,0.012)', 'transparent', 'rgba(0,0,0,0.008)', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {/* Vertical texture */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.006)', 'transparent', 'rgba(0,0,0,0.004)', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {/* Horizontal subtle texture */}
      <LinearGradient
        colors={['rgba(0,0,0,0.003)', 'transparent', 'rgba(0,0,0,0.005)', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {/* Additional diagonal overlay for depth */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.004)', 'transparent']}
        start={{ x: 1, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      
      {/* Content */}
      <View style={styles.content}>
        {children}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  baseBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.background.texture,
  },
  content: {
    flex: 1,
  },
})
