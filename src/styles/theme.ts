import { createSystem, defaultConfig } from '@chakra-ui/react'

export const system = createSystem(defaultConfig, {
  theme: {
    tokens: {
      fonts: {
        heading: { value: "'Inter', system-ui, sans-serif" },
        body: { value: "'Inter', system-ui, sans-serif" },
      },
      colors: {
        brand: {
          50: { value: '#e8f3fe' },
          100: { value: '#bcdbfc' },
          500: { value: '#017cee' },
          600: { value: '#0163bb' },
          900: { value: '#013c71' },
        },
        state: {
          success: { value: '#1b8e49' },
          failed: { value: '#e43921' },
          running: { value: '#00ad46' },
          queued: { value: '#808080' },
        },
        tag: {
          bg: { value: '#5bc0de' },
        },
      },
    },
    semanticTokens: {
      colors: {
        brand: {
          solid: { value: '{colors.brand.500}' },
        },
        state: {
          success: { value: '{colors.state.success}' },
          failed: { value: '{colors.state.failed}' },
          running: { value: '{colors.state.running}' },
          queued: { value: '{colors.state.queued}' },
        },
      },
    },
  },
})
