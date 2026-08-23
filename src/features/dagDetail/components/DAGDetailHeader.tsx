import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, HStack, Text, IconButton, Menu, Portal } from '@chakra-ui/react'
import { IoArrowBack, IoRefresh, IoEllipsisVertical } from 'react-icons/io5'

interface DAGDetailHeaderProps {
  dagId: string
  onOpenXCom: () => void
  onRefresh: () => void
}

interface MenuItemDef {
  label: string
  action?: () => void
  implemented: boolean
}

export function DAGDetailHeader({ dagId, onOpenXCom, onRefresh }: DAGDetailHeaderProps) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  const menuItems: MenuItemDef[] = [
    { label: 'Detail', action: () => window.scrollTo({ top: 0 }), implemented: true },
    { label: 'Graph', implemented: false },
    { label: 'Gantt', implemented: false },
    { label: 'Code', implemented: false },
    { label: 'Event Log', implemented: false },
    { label: 'XCom', action: onOpenXCom, implemented: true },
    { label: 'K8s Pod Spec', implemented: false },
    { label: 'Task Duration', implemented: false },
  ]

  return (
    <Box
      position="sticky"
      top={0}
      zIndex={1000}
      h="56px"
      bg="white"
      borderBottomWidth="1px"
      borderColor="gray.200"
      display="flex"
      alignItems="center"
      justifyContent="space-between"
      px={3}
    >
      <IconButton
        variant="ghost"
        aria-label="Back"
        fontSize="22px"
        onClick={() => navigate('/')}
      >
        <IoArrowBack />
      </IconButton>
      <Text
        flex={1}
        textAlign="center"
        fontWeight="semibold"
        fontSize="md"
        whiteSpace="nowrap"
        overflow="hidden"
        textOverflow="ellipsis"
        px={2}
      >
        {dagId}
      </Text>
      <HStack gap={1}>
        <IconButton variant="ghost" aria-label="Refresh" fontSize="20px" onClick={onRefresh}>
          <IoRefresh />
        </IconButton>
        <Menu.Root open={open} onOpenChange={(e) => setOpen(e.open)}>
          <Menu.Trigger asChild>
            <IconButton variant="ghost" aria-label="Menu" fontSize="22px">
              <IoEllipsisVertical />
            </IconButton>
          </Menu.Trigger>
          <Portal>
            <Menu.Positioner>
              <Menu.Content>
                {menuItems.map((item) => (
                  <Menu.Item
                    key={item.label}
                    value={item.label.toLowerCase()}
                    onClick={item.action}
                    disabled={!item.implemented}
                  >
                    <HStack justify="space-between" gap={2}>
                      <Text as="span">{item.label}</Text>
                      {!item.implemented && (
                        <Text as="span" fontSize="xs" color="gray.400" fontStyle="italic">
                          (not implemented yet)
                        </Text>
                      )}
                    </HStack>
                  </Menu.Item>
                ))}
              </Menu.Content>
            </Menu.Positioner>
          </Portal>
        </Menu.Root>
      </HStack>
    </Box>
  )
}
