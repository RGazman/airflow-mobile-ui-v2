import { HStack } from '@chakra-ui/react'
import { STATE_COLORS, STATE_LABELS } from '@/features/dagDetail/stateColors'
import type { DAGStat } from '@/features/dags/types'

interface CircleProps {
  state: string
  count: number
}

function StatCircle({ state, count }: CircleProps) {
  const color = STATE_COLORS[state] || '#808080'
  const label = STATE_LABELS[state] || state
  const digits = count > 0 ? Math.floor(Math.log10(count)) + 1 : 0
  // Widen viewBox for 3+ digit numbers so text fits without clipping
  const vbSize = digits >= 3 ? 34 : 28
  const cx = vbSize / 2
  const r = vbSize / 2 - 2
  const fontSize = digits >= 3 ? 9 : 11

  return (
    <svg
      width={vbSize}
      height={vbSize}
      viewBox={`0 0 ${vbSize} ${vbSize}`}
      aria-label={`${label}: ${count}`}
      style={{ display: 'block', flexShrink: 0 }}
    >
      <circle
        cx={cx}
        cy={cx}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="2"
      />
      {count > 0 && (
        <text
          x={cx}
          y={cx}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={fontSize}
          fontWeight="700"
          fill="#51504f"
        >
          {count}
        </text>
      )}
    </svg>
  )
}

interface DAGStatsCirclesProps {
  stats: DAGStat[] | undefined
}

const TARGET_STATES = ['queued', 'success', 'running', 'failed']

export function DAGStatsCircles({ stats }: DAGStatsCirclesProps) {
  if (!stats) return null

  const statsMap = new Map<string, number>()
  for (const s of stats) {
    statsMap.set(s.state, s.count)
  }

  return (
    <HStack
      justify="space-between"
      gap={2}
      px={3}
      py={2}
      borderWidth="1px"
      borderRadius="md"
      bg="whiteAlpha.600"
    >
      {TARGET_STATES.map((state) => (
        <StatCircle key={state} state={state} count={statsMap.get(state) ?? 0} />
      ))}
    </HStack>
  )
}
