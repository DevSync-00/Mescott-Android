import { Dimensions, PixelRatio, Platform } from 'react-native'

// Get screen dimensions with fallback
const getScreenDimensions = () => {
  try {
    const { width, height } = Dimensions.get('window')
    return {
      width: width > 0 ? width : 390, // Fallback to base width
      height: height > 0 ? height : 844, // Fallback to base height
    }
  } catch (error) {
    // Fallback dimensions (iPhone 12/13/14 - most common device)
    return { width: 390, height: 844 }
  }
}

const screenDimensions = getScreenDimensions()
const SCREEN_WIDTH = screenDimensions.width
const SCREEN_HEIGHT = screenDimensions.height

// Base dimensions (iPhone 12/13/14 - most common device)
const BASE_WIDTH = 390
const BASE_HEIGHT = 844

// Calculate scale factor based on screen width (with safety check)
const scale = SCREEN_WIDTH > 0 ? SCREEN_WIDTH / BASE_WIDTH : 1

// Calculate vertical scale factor based on screen height (with safety check)
const verticalScale = SCREEN_HEIGHT > 0 ? SCREEN_HEIGHT / BASE_HEIGHT : 1

// Moderate scale - less aggressive scaling for better readability
const moderateScale = (size: number, factor: number = 0.5) => {
  if (size <= 0) return size
  return size + (scale - 1) * factor * size
}

/**
 * Scales a font size based on device width
 * @param size - Base font size
 * @returns Scaled font size
 */
export const scaleFont = (size: number): number => {
  if (size <= 0) return size
  const newSize = size * scale
  
  // Round to nearest pixel with safety check
  try {
    return Math.max(1, Math.round(PixelRatio.roundToNearestPixel(newSize)))
  } catch (error) {
    return Math.max(1, Math.round(newSize))
  }
}

/**
 * Scales a font size with moderate scaling (less aggressive)
 * @param size - Base font size
 * @param factor - Scaling factor (0-1), default 0.5
 * @returns Scaled font size
 */
export const moderateFont = (size: number, factor: number = 0.5): number => {
  if (size <= 0) return size
  
  // Recalculate dimensions in case they changed (e.g., orientation change)
  const currentDimensions = getScreenDimensions()
  const currentScale = currentDimensions.width > 0 ? currentDimensions.width / BASE_WIDTH : 1
  const scaledSize = size + (currentScale - 1) * factor * size
  const newSize = scaledSize
  
  // Round to nearest pixel with safety check
  try {
    const result = Math.max(1, Math.round(PixelRatio.roundToNearestPixel(newSize)))
    return result
  } catch (error) {
    return Math.max(1, Math.round(newSize))
  }
}

/**
 * Scales a font size based on screen height (for vertical scaling)
 * @param size - Base font size
 * @returns Scaled font size
 */
export const scaleFontVertical = (size: number): number => {
  const newSize = size * verticalScale
  return Math.round(PixelRatio.roundToNearestPixel(newSize))
}

/**
 * Get responsive font size based on screen width
 * Returns different sizes for small, medium, and large screens
 */
export const getResponsiveFontSize = (small: number, medium: number, large: number): number => {
  if (SCREEN_WIDTH < 375) {
    // Small devices (iPhone SE, etc.)
    return scaleFont(small)
  } else if (SCREEN_WIDTH < 414) {
    // Medium devices (iPhone 12/13/14, etc.)
    return scaleFont(medium)
  } else {
    // Large devices (iPhone Pro Max, tablets, etc.)
    return scaleFont(large)
  }
}

/**
 * Adaptive font sizes for common text elements
 */
export const AdaptiveFontSizes = {
  // Headings
  h1: getResponsiveFontSize(28, 32, 36),
  h2: getResponsiveFontSize(24, 28, 32),
  h3: getResponsiveFontSize(20, 22, 24),
  h4: getResponsiveFontSize(18, 20, 22),
  
  // Body text
  body: getResponsiveFontSize(14, 16, 18),
  bodyLarge: getResponsiveFontSize(16, 18, 20),
  bodySmall: getResponsiveFontSize(12, 14, 16),
  
  // Captions and labels
  caption: getResponsiveFontSize(10, 12, 14),
  label: getResponsiveFontSize(12, 14, 16),
  
  // Buttons
  button: getResponsiveFontSize(14, 16, 18),
  buttonLarge: getResponsiveFontSize(16, 18, 20),
  buttonSmall: getResponsiveFontSize(12, 14, 16),
  
  // Navigation
  navLabel: getResponsiveFontSize(10, 12, 14),
  tabLabel: getResponsiveFontSize(12, 14, 16),
  
  // Cards
  cardTitle: getResponsiveFontSize(16, 18, 20),
  cardSubtitle: getResponsiveFontSize(12, 14, 16),
  cardBody: getResponsiveFontSize(14, 16, 18),
}

// Export scale factors for use in other utilities
export { scale, verticalScale, moderateScale, SCREEN_WIDTH, SCREEN_HEIGHT }

