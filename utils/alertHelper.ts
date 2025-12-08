import { AlertButton } from '../components/CustomAlert'
import { showAlert, showErrorAlert, showSuccessAlert, showWarningAlert, showInfoAlert } from './alert'
import { useToast } from '../contexts/ToastContext'

/**
 * Replacement for Alert.alert() with styled popups
 * Usage matches React Native Alert.alert API
 * 
 * Examples:
 * - alert('Message') - Simple message toast
 * - alert('Title', 'Message') - Alert dialog
 * - alert('Title', 'Message', [{text: 'OK'}]) - Alert with custom buttons
 * - alert('Title', 'Message', [{text: 'OK'}], 'success') - Alert with type
 */
export const alert = (
  title: string,
  message?: string,
  buttons?: AlertButton[],
  type?: 'success' | 'error' | 'warning' | 'info'
) => {
  if (!message && !buttons && !type) {
    // Single argument - treat as message, show as toast
    // Note: This requires ToastContext, so for simple messages use useToast hook
    showAlert(title, undefined, undefined, 'info')
  } else {
    showAlert(title, message, buttons, type)
  }
}

// Export convenience functions
export { showErrorAlert, showSuccessAlert, showWarningAlert, showInfoAlert }

// For logout confirmations and similar dialogs
export const showConfirmation = (
  title: string,
  message: string,
  onConfirm: () => void,
  onCancel?: () => void,
  confirmText: string = 'Confirm',
  cancelText: string = 'Cancel',
  type: 'success' | 'error' | 'warning' | 'info' = 'warning'
) => {
  const buttons: AlertButton[] = [
    {
      text: cancelText,
      style: 'cancel',
      onPress: onCancel,
    },
    {
      text: confirmText,
      style: type === 'error' ? 'destructive' : 'default',
      onPress: onConfirm,
    },
  ]

  showAlert(title, message, buttons, type)
}

