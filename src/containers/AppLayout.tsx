import { useState, useCallback } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { Box, HStack, Text, VStack, Drawer, IconButton, CloseButton, Portal } from '@chakra-ui/react'
import { IoRefresh, IoMenu } from 'react-icons/io5'
import { useQueryClient } from '@tanstack/react-query'

export function AppLayout() {
  const [menuOpen, setMenuOpen] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()

  const isActive = (path: string) =>
    path === '/' ? location.pathname === '/' || location.pathname === '/home' : location.pathname === path

  const handleRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['dags'] })
    queryClient.invalidateQueries({ queryKey: ['allDags'] })
    queryClient.invalidateQueries({ queryKey: ['dagStats'] })
    queryClient.invalidateQueries({ queryKey: ['dagCount'] })
    queryClient.invalidateQueries({ queryKey: ['dagLastRun'] })
  }, [queryClient])

  const handleLogout = useCallback(async () => {
    try {
      await fetch('/logout', { credentials: 'include', redirect: 'manual' })
    } catch {
      // ignore network errors
    }
    window.location.href = '/login'
  }, [])

  return (
    <Box minH="100dvh" bg="gray.50">
      {/* Header */}
      <Box
        position="fixed"
        top={0}
        left={0}
        right={0}
        h="60px"
        bg="white"
        borderBottomWidth="1px"
        boxShadow="md"
        display="flex"
        alignItems="center"
        justifyContent="space-between"
        px={4}
        zIndex={1000}
      >
        <HStack
          as="span"
          gap={2.5}
          cursor="pointer"
          onClick={() => navigate('/')}
        >
          {/* Airflow SVG logo */}
          <Box w="32px" h="32px" flexShrink={0}>
            <svg viewBox="0 0 182.5 182.5" width="32" height="32">
              <path fill="#3D77BC" d="M2.9,181.7l87.4-89.5c0.5-0.6,0.7-1.4,0.2-2.1c-5.3-7.4-15.1-8.7-18.7-13.7C61,61.7,58.3,53.3,53.6,53.8c-0.3,0-0.6,0.2-0.8,0.4L21.2,86.6C3.1,105.2,0.5,146.2,0,180.5C0,182.1,1.9,182.8,2.9,181.7z" />
              <path fill="#47B1E4" d="M21.2,86.6c9.9-10.2,29.5-14.9,70,4.6C77.1,59.6,58.5,48.5,53.1,53.9L21.2,86.6z" />
              <path fill="#07AD4B" d="M181.7,179.5L92.2,92.2c-0.6-0.5-1.4-0.7-2.1-0.2c-7.4,5.3-8.7,15.1-13.7,18.7c-14.8,10.8-23.1,13.5-22.6,18.1c0,0.3,0.2,0.6,0.4,0.8l32.3,31.6c18.6,18.2,59.6,20.8,93.9,21.2C182.1,182.5,182.8,180.6,181.7,179.5z" />
              <path fill="#50B956" d="M86.6,161.2c-10.2-9.9-14.9-29.5,4.6-70c-31.7,14.2-42.8,32.8-37.3,38.1L86.6,161.2z" />
              <path fill="#2EC0CE" d="M179.5,0.7L92.2,90.3c-0.5,0.6-0.7,1.4-0.2,2.1c5.3,7.4,15.1,8.7,18.7,13.7c10.8,14.8,13.5,23.1,18.1,22.6c0.3,0,0.6-0.2,0.8-0.4l31.6-32.3c18.2-18.6,20.8-59.6,21.2-93.9C182.5,0.4,180.6-0.4,179.5,0.7z" />
              <path fill="#59C7DA" d="M161.2,95.8c-9.9,10.2-29.5,14.9-70-4.6c14.2,31.7,32.8,42.8,38.1,37.3L161.2,95.8z" />
              <path fill="#E33D26" d="M0.7,2.9l89.5,87.4c0.6,0.5,1.4,0.7,2.1,0.2c7.4-5.3,8.7-15.1,13.7-18.7c14.8-10.8,23.1-13.5,22.6-18.1c0-0.3-0.2-0.6-0.4-0.8L95.8,21.2C77.2,3.1,36.3,0.5,1.9,0C0.4,0-0.4,1.9,0.7,2.9z" />
              <path fill="#F37559" d="M95.8,21.2c10.2,9.9,14.9,29.5-4.6,70c31.7-14.2,42.8-32.8,37.3-38.1L95.8,21.2z" />
              <circle fill="#4B4949" cx="91.2" cy="91.2" r="3.9" />
            </svg>
          </Box>
          <Text fontWeight="bold" fontSize="lg" color="brand.500">
            Airflow
          </Text>
        </HStack>

        <HStack gap={1}>
          <IconButton
            variant="ghost"
            fontSize="xl"
            aria-label="Refresh"
            onClick={handleRefresh}
          >
            <IoRefresh />
          </IconButton>
          <IconButton
            variant="ghost"
            fontSize="xl"
            aria-label="Menu"
            onClick={() => setMenuOpen(true)}
          >
            <IoMenu />
          </IconButton>
        </HStack>
      </Box>

      {/* Burger menu drawer */}
      <Drawer.Root open={menuOpen} onOpenChange={(e) => setMenuOpen(e.open)} placement="start">
        <Portal>
          <Drawer.Backdrop />
          <Drawer.Positioner>
            <Drawer.Content>
              <Drawer.Header borderBottomWidth="1px" display="flex" justifyContent="space-between" alignItems="center">
                <Drawer.Title textTransform="uppercase" fontSize="sm" color="gray.500" fontWeight="semibold">
                  Menu
                </Drawer.Title>
                <CloseButton onClick={() => setMenuOpen(false)} />
              </Drawer.Header>
              <Drawer.Body p={4}>
                <VStack gap={0} align="stretch">
                  <Text fontSize="xs" textTransform="uppercase" color="gray.500" fontWeight="semibold" mb={2}>
                    Navigation
                  </Text>
                  <NavItem
                    label="DAGs"
                    active={isActive('/')}
                    onClick={() => { navigate('/'); setMenuOpen(false) }}
                  />
                  <NavItem
                    label="Browse"
                    hint="(not implemented yet)"
                    disabled
                    onClick={() => setMenuOpen(false)}
                  />
                  <NavItem
                    label="Admin"
                    hint="(not implemented yet)"
                    disabled
                    onClick={() => setMenuOpen(false)}
                  />
                  <NavItem
                    label="Security"
                    hint="(not implemented yet)"
                    disabled
                    onClick={() => setMenuOpen(false)}
                  />
                </VStack>
                <VStack gap={0} align="stretch" mt={6}>
                  <Text fontSize="xs" textTransform="uppercase" color="gray.500" fontWeight="semibold" mb={2}>
                    User
                  </Text>
                  <NavItem
                    label="Profile"
                    hint="(not implemented yet)"
                    disabled
                    onClick={() => setMenuOpen(false)}
                  />
                  <NavItem
                    label="Logout"
                    onClick={handleLogout}
                  />
                </VStack>
              </Drawer.Body>
            </Drawer.Content>
          </Drawer.Positioner>
        </Portal>
      </Drawer.Root>

      {/* Page content */}
      <Box pt="60px">
        <Outlet />
      </Box>
    </Box>
  )
}

interface NavItemProps {
  label: string
  hint?: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
}

function NavItem({ label, hint, active = false, disabled = false, onClick }: NavItemProps) {
  return (
    <Box
      as="button"
      display="flex"
      alignItems="center"
      gap={2}
      px={3}
      py={3}
      borderRadius="md"
      fontWeight="medium"
      fontSize="md"
      textAlign="left"
      width="100%"
      bg={active ? 'gray.100' : 'transparent'}
      color={active ? 'brand.500' : disabled ? 'gray.400' : 'inherit'}
      cursor={disabled ? 'default' : 'pointer'}
      _hover={disabled ? {} : { bg: 'gray.50' }}
      onClick={disabled ? undefined : onClick}
    >
      <Text as="span">{label}</Text>
      {hint && (
        <Text as="span" fontSize="xs" color="gray.400" fontStyle="italic">
          {hint}
        </Text>
      )}
    </Box>
  )
}
