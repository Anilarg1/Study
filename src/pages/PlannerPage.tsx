import { useEffect } from 'react'
import useAuthStore from '../store/useAuthStore'
import { usePlannerStore } from '../store/usePlannerStore'
import useGoalsStore from '../store/useGoalsStore'
import { PlannerSidebar } from '../components/planner/PlannerSidebar'
import { WeekCalendar } from '../components/planner/WeekCalendar'
import './PlannerPage.css'

export function PlannerPage() {
  const user = useAuthStore((s) => s.user)
  const loadTasks = usePlannerStore((s) => s.loadTasks)
  const fetchGoals = useGoalsStore((s) => s.fetchGoals)

  useEffect(() => {
    if (!user) return
    loadTasks(user.id)
    fetchGoals(user.id)
  }, [user, loadTasks, fetchGoals])

  return (
    <div className="planner">
      <PlannerSidebar />
      <WeekCalendar />
    </div>
  )
}
