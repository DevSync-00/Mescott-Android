import { registerRootComponent } from 'expo'
import { ExpoRoot } from 'expo-router'
import { SafeAreaProvider } from 'react-native-safe-area-context'

export function App() {
  const ctx = require.context('./app', true, /\.(js|jsx|ts|tsx)$/)

  return (
    <SafeAreaProvider>
      <ExpoRoot context={ctx} />
    </SafeAreaProvider>
  )
}

registerRootComponent(App)
