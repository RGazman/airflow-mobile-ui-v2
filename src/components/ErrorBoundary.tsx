import { Component, type ReactNode, type ErrorInfo } from 'react'
import { Box, Text, Button } from '@chakra-ui/react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <Box p={8} textAlign="center">
          <Text fontSize="lg" fontWeight="bold" mb={2}>
            Something went wrong
          </Text>
          <Text color="gray.500" fontSize="sm" mb={4}>
            {this.state.error?.message}
          </Text>
          <Button
            onClick={() => {
              this.setState({ hasError: false, error: null })
              window.location.reload()
            }}
          >
            Reload page
          </Button>
        </Box>
      )
    }
    return this.props.children
  }
}
