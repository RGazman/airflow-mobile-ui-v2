import { useState } from 'react'
import { Button, Menu, Portal } from '@chakra-ui/react'
import { IoEllipsisHorizontal } from 'react-icons/io5'

export function DAGMoreMenu() {
  const [open, setOpen] = useState(false)

  return (
    <Menu.Root open={open} onOpenChange={(e) => setOpen(e.open)}>
      <Menu.Trigger asChild>
        <Button size="sm" variant="outline" title="More actions" aria-label="More actions">
          <IoEllipsisHorizontal />
        </Button>
      </Menu.Trigger>
      <Portal>
        <Menu.Positioner>
          <Menu.Content>
            <Menu.Item value="not-implemented" disabled>
              Not implemented yet
            </Menu.Item>
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  )
}
