/**
 * Design System for SkillHub - Modern, engaging mobile-first design
 * Optimized for user retention and visual appeal
 * Android-only design system
 */

import { moderateFont } from '../utils/fontScale'

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
}

export const BorderRadius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  full: 9999,
}

export const Typography = {
  // Font Families - Android only
  fontFamily: {
    regular: 'Roboto',
    medium: 'Roboto-Medium',
    semibold: 'Roboto-Medium',
    bold: 'Roboto-Bold',
  },
  
  // Font Sizes - Adaptive to device size
  fontSize: {
    xs: moderateFont(12),
    sm: moderateFont(14),
    md: moderateFont(16),
    lg: moderateFont(18),
    xl: moderateFont(20),
    xxl: moderateFont(24),
    xxxl: moderateFont(28),
    huge: moderateFont(32),
    giant: moderateFont(40),
  },
  
  // Line Heights - Adaptive to device size
  lineHeight: {
    xs: moderateFont(16),
    sm: moderateFont(20),
    md: moderateFont(24),
    lg: moderateFont(28),
    xl: moderateFont(32),
    xxl: moderateFont(36),
    xxxl: moderateFont(40),
    huge: moderateFont(48),
  },
  
  // Font Weights
  fontWeight: {
    light: '300' as const,
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
    extrabold: '800' as const,
  },
}

export const Shadows = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  sm: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 8,
  },
  xl: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 12,
  },
}

export const Animation = {
  duration: {
    fast: 150,
    normal: 250,
    slow: 350,
    slower: 500,
  },
  easing: {
    easeInOut: [0.4, 0.0, 0.2, 1],
    easeOut: [0.0, 0.0, 0.2, 1],
    easeIn: [0.4, 0.0, 1, 1],
    bounce: [0.68, -0.55, 0.265, 1.55],
  },
}

export const Layout = {
  // Screen padding
  screenPadding: {
    horizontal: Spacing.lg,
    vertical: Spacing.lg,
  },
  
  // Component heights
  height: {
    button: 48,
    buttonLarge: 56,
    input: 48,
    inputLarge: 56,
    tabBar: 80,
    header: 56,
    card: 120,
    cardLarge: 200,
  },
  
  // Minimum touch targets (accessibility)
  touchTarget: {
    min: 44,
    recommended: 48,
  },
  
  // Icon sizes
  iconSize: {
    xs: 16,
    sm: 20,
    md: 24,
    lg: 28,
    xl: 32,
    xxl: 40,
  },
}

export const Breakpoints = {
  phone: 0,
  tablet: 768,
  desktop: 1024,
}

// Common style combinations for quick use
export const CommonStyles = {
  // Cards
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.lg,
    ...Shadows.md,
  },
  
  cardHover: {
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.lg,
    ...Shadows.lg,
  },
  
  // Buttons
  button: {
    height: Layout.height.button,
    borderRadius: BorderRadius.md,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  
  buttonLarge: {
    height: Layout.height.buttonLarge,
    borderRadius: BorderRadius.lg,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  
  // Text styles
  heading1: {
    fontFamily: Typography.fontFamily.bold,
    fontSize: Typography.fontSize.xxxl,
    lineHeight: Typography.lineHeight.xxxl,
    fontWeight: Typography.fontWeight.bold,
  },
  
  heading2: {
    fontFamily: Typography.fontFamily.bold,
    fontSize: Typography.fontSize.xxl,
    lineHeight: Typography.lineHeight.xxl,
    fontWeight: Typography.fontWeight.bold,
  },
  
  heading3: {
    fontFamily: Typography.fontFamily.semibold,
    fontSize: Typography.fontSize.xl,
    lineHeight: Typography.lineHeight.xl,
    fontWeight: Typography.fontWeight.semibold,
  },
  
  body1: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.md,
    lineHeight: Typography.lineHeight.md,
    fontWeight: Typography.fontWeight.regular,
  },
  
  body2: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.sm,
    lineHeight: Typography.lineHeight.sm,
    fontWeight: Typography.fontWeight.regular,
  },
  
  caption: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.xs,
    lineHeight: Typography.lineHeight.xs,
    fontWeight: Typography.fontWeight.regular,
  },
}

export default {
  Spacing,
  BorderRadius,
  Typography,
  Shadows,
  Animation,
  Layout,
  Breakpoints,
  CommonStyles,
}