import { useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, Text, HStack, VStack, Switch, Flex } from '@chakra-ui/react'
import { STATE_COLORS } from '@/features/dagDetail/stateColors'
import type { DAG, DAGStat, DAGRunListResponse } from '@/features/dags/types'
import { formatRelativeTime } from '@/lib/date'
import { DAGStatsCircles } from './DAGStatsCircles'
import { DAGTriggerMenu } from './DAGTriggerMenu'
import { DAGMoreMenu } from './DAGMoreMenu'
import { useTogglePause } from '@/features/dags/api/mutations'

interface DAGCardProps {
  dag: DAG
  stats: DAGStat[] | undefined
  lastRun: DAGRunListResponse | undefined
  odd?: boolean
  statusLoading?: boolean
}

export function DAGCard({ dag, stats, lastRun, odd = false, statusLoading = false }: DAGCardProps) {
  const navigate = useNavigate()
  const togglePause = useTogglePause()
  const tagsRef = useRef<HTMLDivElement>(null)

  const handleTogglePause = useCallback(
    (e: { checked: boolean }) => {
      togglePause.mutate({ dagId: dag.dag_id, isPaused: !e.checked })
    },
    [togglePause, dag.dag_id],
  )

  const handleNavigate = useCallback(() => {
    navigate(`/dags/${encodeURIComponent(dag.dag_id)}`)
  }, [navigate, dag.dag_id])

  const scheduleValue = dag.schedule_interval?.value ?? 'None'
  const owners = dag.owners?.length ? dag.owners : ['—']
  const lastRunData = lastRun?.dag_runs?.[0]
  const hasLoadedAndEmpty = lastRun != null && lastRun.dag_runs.length === 0

  return (
    <Box w="100%" bg={odd ? 'gray.50' : 'white'} borderBottomWidth="1px" borderColor="gray.300">
      <Box p={4}>
        {/* Header: dag_id + switch */}
        <HStack justify="space-between" align="flex-start" gap={3}>
          <VStack align="flex-start" gap={1.5} minW={0} flex={1}>
            <Text
              as="span"
              onClick={handleNavigate}
              fontWeight="bold"
              color="brand.500"
              wordBreak="break-all"
              lineHeight="1.3"
              fontSize="md"
              cursor="pointer"
              _hover={{ textDecoration: 'underline' }}
            >
              {dag.dag_id}
            </Text>
            <VStack align="flex-start" gap={1.5} fontSize="sm">
              <HStack gap={2} align="center">
                <Text as="span" color="gray.400" fontSize="xs">schedule:</Text>
                <Box
                  as="span"
                  bg="gray.100"
                  color="gray.700"
                  fontSize="11px"
                  fontWeight="bold"
                  px={2}
                  py={0.5}
                  borderRadius="sm"
                  lineHeight="1.2"
                >
                  {scheduleValue}
                </Box>
              </HStack>
              <HStack gap={2} align="center">
                <Text as="span" color="gray.400" fontSize="xs">owner:</Text>
                <HStack gap={1} wrap="wrap">
                  {owners.map((owner) => (
                    <Box
                      key={owner}
                      as="span"
                      bg="gray.100"
                      color="gray.700"
                      fontSize="11px"
                      fontWeight="bold"
                      px={2}
                      py={0.5}
                      borderRadius="sm"
                      lineHeight="1.2"
                    >
                      {owner}
                    </Box>
                  ))}
                </HStack>
              </HStack>
            </VStack>
          </VStack>
          <Switch.Root
            colorPalette="brand"
            checked={!dag.is_paused}
            onCheckedChange={handleTogglePause}
            disabled={togglePause.isPending}
          >
            <Switch.HiddenInput />
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
          </Switch.Root>
        </HStack>

        {/* Stats circles */}
        <Box mt={3}>
          <DAGStatsCircles stats={stats} />
        </Box>

        {/* Footer */}
        <Box pt={3} borderTopWidth="1px" mt={3}>
          {/* Top row: last run + actions */}
          <HStack justify="space-between" align="center" mb={2}>
            <HStack gap={2} fontSize="sm">
              {lastRunData ? (
                <>
                  <Box
                    w="12px"
                    h="12px"
                    borderWidth="1px"
                    borderColor="gray.500"
                    bg={STATE_COLORS[lastRunData.state] || 'transparent'}
                    flexShrink={0}
                    aria-label={lastRunData.state}
                  />
                  <Text>Last run</Text>
                  <Text color="gray.500">{formatRelativeTime(lastRunData.start_date)}</Text>
                </>
              ) : hasLoadedAndEmpty ? (
                <Text color="gray.500">No runs yet</Text>
              ) : statusLoading ? (
                <Text color="gray.400" fontStyle="italic">Checking status…</Text>
              ) : null}
            </HStack>
            <HStack gap={1}>
              <DAGTriggerMenu dagId={dag.dag_id} />
              <DAGMoreMenu />
            </HStack>
          </HStack>

          {/* Bottom row: tags with horizontal scroll on overflow */}
          <Flex
            ref={tagsRef}
            wrap="nowrap"
            gap={1}
            overflowX="auto"
            css={{
              '&::-webkit-scrollbar': { height: '4px' },
              '&::-webkit-scrollbar-thumb': { bg: '#ccc', borderRadius: '2px' },
            }}
          >
            {dag.tags?.map((tag) => (
              <Box
                key={tag.name}
                as="span"
                bg="#5bc0de"
                color="white"
                fontSize="xs"
                fontWeight="bold"
                px={2}
                py={0.5}
                borderRadius="sm"
                whiteSpace="nowrap"
                flexShrink={0}
              >
                {tag.name}
              </Box>
            ))}
          </Flex>
        </Box>
      </Box>
    </Box>
  )
}
