import React, { memo, useState } from 'react'
import { Image, View, ActivityIndicator, StyleSheet, ImageStyle, StyleProp } from 'react-native'
import { Colors } from '../constants/Colors'

interface OptimizedImageProps {
  uri: string
  style?: StyleProp<ImageStyle>
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'center'
  placeholder?: boolean
}

// Memoized image component with loading state for better performance
const OptimizedImage = memo(
  ({ uri, style, resizeMode = 'cover', placeholder = true }: OptimizedImageProps) => {
    const [loading, setLoading] = useState(true)

    if (!uri) {
      return null
    }

    return (
      <View style={style}>
        <Image
          source={{ uri, cache: 'force-cache' }}
          style={[StyleSheet.absoluteFill, style]}
          resizeMode={resizeMode}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          onError={() => {
            setLoading(false)
            setError(true)
          }}
        />
        {loading && placeholder && (
          <View style={[StyleSheet.absoluteFill, styles.loadingContainer]}>
            <ActivityIndicator size="small" color={Colors.primary[500]} />
          </View>
        )}
      </View>
    )
  },
  (prevProps, nextProps) => {
    // Custom comparison function to prevent unnecessary re-renders
    return prevProps.uri === nextProps.uri && prevProps.resizeMode === nextProps.resizeMode
  },
)

OptimizedImage.displayName = 'OptimizedImage'

const styles = StyleSheet.create({
  loadingContainer: {
    backgroundColor: Colors.neutral[100],
    justifyContent: 'center',
    alignItems: 'center',
  },
})

export default OptimizedImage
