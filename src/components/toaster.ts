import { createToaster } from '@chakra-ui/react'

export const toaster = createToaster({
  placement: 'bottom',
  duration: 3500,
  max: 3,
})
