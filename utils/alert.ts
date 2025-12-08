import { AlertButton, CustomAlertProps } from '../components/CustomAlert'

// Global alert state management
let alertState: {
  visible: boolean
  title?: string
  message: string
  buttons?: AlertButton[]
  onDismiss?: () => void
  type?: 'success' | 'error' | 'warning' | 'info'
} = {
  visible: false,
  message: '',
}

let alertListeners: Array<(state: typeof alertState) => void> = []

export const alertService = {
  show: (config: Omit<CustomAlertProps, 'visible'>) => {
    alertState = {
      ...config,
      visible: true,
    }
    alertListeners.forEach((listener) => listener(alertState))
  },

  hide: () => {
    alertState = {
      ...alertState,
      visible: false,
    }
    alertListeners.forEach((listener) => listener(alertState))
  },

  subscribe: (listener: (state: typeof alertState) => void) => {
    alertListeners.push(listener)
    return () => {
      alertListeners = alertListeners.filter((l) => l !== listener)
    }
  },

  getState: () => alertState,
}

// Helper function to match Alert.alert API
export const showAlert = (
  title: string,
  message?: string,
  buttons?: AlertButton[],
  type?: 'success' | 'error' | 'warning' | 'info'
) => {
  if (!message) {
    // If only one argument, treat it as message
    alertService.show({
      message: title,
      type: type || 'info',
    })
  } else {
    alertService.show({
      title,
      message,
      buttons: buttons || [{ text: 'OK' }],
      type: type || 'info',
    })
  }
}

// Convenience functions
export const showSuccessAlert = (title: string, message?: string, buttons?: AlertButton[]) => {
  showAlert(title, message, buttons, 'success')
}

export const showErrorAlert = (title: string, message?: string, buttons?: AlertButton[]) => {
  showAlert(title, message, buttons, 'error')
}

export const showWarningAlert = (title: string, message?: string, buttons?: AlertButton[]) => {
  showAlert(title, message, buttons, 'warning')
}

export const showInfoAlert = (title: string, message?: string, buttons?: AlertButton[]) => {
  showAlert(title, message, buttons, 'info')
}

