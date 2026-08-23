import { Routes, Route } from 'react-router-dom'
import { AppLayout } from '@/containers/AppLayout'
import { DAGsList } from '@/features/dags/DAGsList'
import { DAGDetail } from '@/features/dagDetail/DAGDetail'

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<DAGsList />} />
        <Route path="/home" element={<DAGsList />} />
      </Route>
      <Route path="/dags/:dagId" element={<DAGDetail />} />
    </Routes>
  )
}
