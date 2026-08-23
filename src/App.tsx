import { Toaster, Toast } from '@chakra-ui/react'
import { AppRoutes } from '@/routes'
import { toaster } from '@/components/toaster'

function App() {
  return (
    <>
      <AppRoutes />
      <Toaster toaster={toaster}>
        {() => (
          <Toast.Root>
            <Toast.Indicator />
            <Toast.Title />
            <Toast.Description />
          </Toast.Root>
        )}
      </Toaster>
    </>
  )
}

export default App
