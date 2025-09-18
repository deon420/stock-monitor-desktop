// DataProvider Context - automatically detects environment and provides appropriate data provider

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { IDataProvider } from '@/lib/dataProvider'
import { WebDemoDataProvider } from '@/lib/webDemoDataProvider'
import { DesktopDataProvider } from '@/lib/desktopDataProvider'
import { isDesktopApp } from '@/utils/env'

interface DataProviderContextType {
  dataProvider: IDataProvider | null
  isReady: boolean
  providerType: 'web-demo' | 'desktop' | 'api' | 'loading'
  error?: string
}

const DataProviderContext = createContext<DataProviderContextType>({
  dataProvider: null,
  isReady: false,
  providerType: 'loading'
})

interface DataProviderProps {
  children: ReactNode
}

export function DataProviderProvider({ children }: DataProviderProps) {
  const [dataProvider, setDataProvider] = useState<IDataProvider | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [providerType, setProviderType] = useState<'web-demo' | 'desktop' | 'api' | 'loading'>('loading')
  const [error, setError] = useState<string>()

  useEffect(() => {
    async function initializeProvider() {
      try {
        console.log('[DataProviderContext] Initializing data provider...')
        
        // Check if we're running in desktop environment using centralized utility
        const isDesktop = isDesktopApp()
        console.log('[DataProviderContext] Environment detected:', isDesktop ? 'desktop' : 'web')

        let provider: IDataProvider

        if (isDesktop) {
          // Desktop environment - use DesktopDataProvider
          try {
            provider = new DesktopDataProvider()
            console.log('[DataProviderContext] Desktop provider initialized')
            setProviderType('desktop')
          } catch (desktopError) {
            console.error('[DataProviderContext] Desktop provider failed, falling back to web demo:', desktopError)
            // Fallback to web demo if desktop provider fails
            provider = new WebDemoDataProvider()
            setProviderType('web-demo')
            setError('Desktop provider unavailable, using web demo mode')
          }
        } else {
          // Web environment - use WebDemoDataProvider
          provider = new WebDemoDataProvider()
          console.log('[DataProviderContext] Web demo provider initialized')
          setProviderType('web-demo')
        }

        // Wait a tick to ensure provider is fully ready
        await new Promise(resolve => setTimeout(resolve, 0))

        if (provider.isReady()) {
          setDataProvider(provider)
          setIsReady(true)
          console.log('[DataProviderContext] Provider ready:', provider.getProviderType())
        } else {
          throw new Error('Provider not ready after initialization')
        }

      } catch (err) {
        console.error('[DataProviderContext] Failed to initialize provider:', err)
        setError(err instanceof Error ? err.message : 'Unknown initialization error')
        setProviderType('web-demo') // Always fallback to web demo
        
        // Create fallback web demo provider
        try {
          const fallbackProvider = new WebDemoDataProvider()
          setDataProvider(fallbackProvider)
          setIsReady(true)
          console.log('[DataProviderContext] Fallback provider ready')
        } catch (fallbackErr) {
          console.error('[DataProviderContext] Even fallback provider failed:', fallbackErr)
        }
      }
    }

    initializeProvider()
  }, [])

  const contextValue: DataProviderContextType = {
    dataProvider,
    isReady,
    providerType,
    error
  }

  return (
    <DataProviderContext.Provider value={contextValue}>
      {children}
    </DataProviderContext.Provider>
  )
}

/**
 * Hook to use the data provider in components
 */
export function useDataProvider(): DataProviderContextType {
  const context = useContext(DataProviderContext)
  if (!context) {
    throw new Error('useDataProvider must be used within a DataProviderProvider')
  }
  return context
}

/**
 * Hook that returns the data provider instance once ready
 * Throws error if provider is not ready
 */
export function useDataProviderInstance(): IDataProvider {
  const { dataProvider, isReady, error } = useDataProvider()
  
  if (!isReady) {
    throw new Error('Data provider not ready yet')
  }
  
  if (!dataProvider) {
    throw new Error(error || 'Data provider failed to initialize')
  }
  
  return dataProvider
}