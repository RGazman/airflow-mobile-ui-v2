import { Box, Text } from '@chakra-ui/react'

interface SimpleSelectProps<T extends string> {
  value: T
  onValueChange: (value: T) => void
  options: { value: T; label: string }[]
  size?: 'sm' | 'md'
}

/** Minimal native <select> wrapper — avoids Zag.js Select issues. */
export function SimpleSelect<T extends string>({
  value,
  onValueChange,
  options,
  size = 'md',
}: SimpleSelectProps<T>) {
  return (
    <select
      value={value}
      onChange={(e) => onValueChange(e.target.value as T)}
      style={{
        height: size === 'sm' ? '30px' : '36px',
        padding: '0 8px',
        fontSize: '14px',
        border: '1px solid #cbd5e0',
        borderRadius: '8px',
        background: '#ffffff',
        color: '#1a202c',
        outline: 'none',
      }}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  )
}

export function SelectField({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <Box>
      <Text fontSize="sm" color="gray.500" mb={1}>
        {label}
      </Text>
      {children}
    </Box>
  )
}
