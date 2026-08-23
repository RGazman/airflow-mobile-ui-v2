import { useState } from 'react'
import { Button, Menu, Portal, Dialog, Field, Textarea, Text } from '@chakra-ui/react'
import { IoPlay } from 'react-icons/io5'
import { useTriggerDAG } from '@/features/dags/api/mutations'

interface DAGTriggerMenuProps {
  dagId: string
}

export function DAGTriggerMenu({ dagId }: DAGTriggerMenuProps) {
  const [open, setOpen] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [jsonInput, setJsonInput] = useState('')
  const [jsonError, setJsonError] = useState<string | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)
  const triggerDAG = useTriggerDAG()

  const handleTriggerWithoutConfig = () => {
    triggerDAG.mutate({ dagId })
    setOpen(false)
  }

  const handleOpenDialog = () => {
    setDialogOpen(true)
    setOpen(false)
    setServerError(null)
  }

  const handleTriggerWithConfig = () => {
    try {
      const conf = JSON.parse(jsonInput)
      setJsonError(null)
      setServerError(null)
      triggerDAG.mutate(
        { dagId, conf },
        {
          onSuccess: () => {
            setDialogOpen(false)
            setJsonInput('')
            setServerError(null)
          },
          onError: (err) => {
            setServerError(err instanceof Error ? err.message : 'Trigger failed')
          },
        },
      )
    } catch {
      setJsonError('Invalid JSON')
    }
  }

  return (
    <>
      <Menu.Root open={open} onOpenChange={(e) => setOpen(e.open)}>
        <Menu.Trigger asChild>
          <Button size="sm" variant="outline" title="Trigger DAG" aria-label="Trigger DAG">
            <IoPlay />
          </Button>
        </Menu.Trigger>
        <Portal>
          <Menu.Positioner>
            <Menu.Content>
              <Menu.Item
                value="trigger-no-config"
                onClick={handleTriggerWithoutConfig}
                disabled={triggerDAG.isPending}
              >
                Trigger without config
              </Menu.Item>
              <Menu.Item
                value="trigger-with-config"
                onClick={handleOpenDialog}
                disabled={triggerDAG.isPending}
              >
                Trigger with config
              </Menu.Item>
            </Menu.Content>
          </Menu.Positioner>
        </Portal>
      </Menu.Root>

      <Dialog.Root open={dialogOpen} onOpenChange={(e) => setDialogOpen(e.open)}>
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content>
              <Dialog.Header>
                <Dialog.Title>Trigger DAG with Config</Dialog.Title>
              </Dialog.Header>
              <Dialog.Body>
                <Field.Root>
                  <Field.Label>Configuration (JSON)</Field.Label>
                  <Textarea
                    rows={5}
                    placeholder='{"key": "value"}'
                    value={jsonInput}
                    onChange={(e) => setJsonInput(e.target.value)}
                  />
                </Field.Root>
                {jsonError && (
                  <Text color="red.500" fontSize="sm" mt={2}>
                    {jsonError}
                  </Text>
                )}
                {serverError && (
                  <Text color="red.500" fontSize="sm" mt={2}>
                    {serverError}
                  </Text>
                )}
              </Dialog.Body>
              <Dialog.Footer>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleTriggerWithConfig}
                  disabled={triggerDAG.isPending || !jsonInput.trim()}
                >
                  {triggerDAG.isPending ? 'Triggering...' : 'Trigger'}
                </Button>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
    </>
  )
}
