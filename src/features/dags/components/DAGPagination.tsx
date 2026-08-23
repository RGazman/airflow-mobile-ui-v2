import { Box, HStack, Button, Text } from '@chakra-ui/react'
import { SimpleSelect } from '@/components/SimpleSelect'

const PAGE_SIZES = [10, 20, 30] as const

interface DAGPaginationProps {
  totalEntries: number
  page: number
  pageSize: number
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
  flat?: boolean
}

export function DAGPagination({
  totalEntries,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  flat = false,
}: DAGPaginationProps) {
  // Recomputed whenever page size or total changes.
  const totalPages = Math.max(1, Math.ceil(totalEntries / pageSize))
  const from = Math.max(1, page - 1)
  const to = Math.min(totalPages, page + 1)
  const pageNumbers: number[] = []
  for (let p = from; p <= to; p++) pageNumbers.push(p)

  return (
    <Box
      px={4}
      py={3}
      borderTopWidth="1px"
      fontSize="sm"
      color="gray.500"
    >
      <HStack justify="space-between" wrap="wrap" gap={2}>
        {flat ? (
          <Text>
            All{' '}
            <Text as="span" fontWeight="medium">
              {totalEntries}
            </Text>{' '}
            DAGs
          </Text>
        ) : (
          <>
            <Text>
              <Text as="span" fontWeight="medium">
                {totalEntries === 0 ? 0 : (page - 1) * pageSize + 1}
                -{Math.min(page * pageSize, totalEntries)}
              </Text>{' '}
              of{' '}
              <Text as="span" fontWeight="medium">
                {totalEntries}
              </Text>{' '}
              DAGs
            </Text>

            <HStack gap={2}>
              <SimpleSelect
                size="sm"
                value={String(pageSize)}
                onValueChange={(v) => onPageSizeChange(Number(v))}
                options={PAGE_SIZES.map((n) => ({ value: String(n), label: String(n) }))}
              />

              <HStack gap={1}>
                <Button
                  size="xs"
                  variant="outline"
                  disabled={page <= 1}
                  onClick={() => onPageChange(page - 1)}
                >
                  &lt;
                </Button>
                {pageNumbers.map((p) => (
                  <Button
                    key={p}
                    size="xs"
                    variant={p === page ? 'solid' : 'outline'}
                    onClick={() => onPageChange(p)}
                  >
                    {p}
                  </Button>
                ))}
                <Button
                  size="xs"
                  variant="outline"
                  disabled={page >= totalPages}
                  onClick={() => onPageChange(page + 1)}
                >
                  &gt;
                </Button>
              </HStack>
            </HStack>
          </>
        )}
      </HStack>
    </Box>
  )
}
