'use client'

import { useState, useMemo } from 'react'
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameMonth, isToday, isSameDay, addMonths, subMonths,
} from 'date-fns'
import { ChevronLeft, ChevronRight, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar } from '@/components/ui/avatar'
import type { Task, Profile } from '@/types'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const PRIORITY_CLASSES: Record<string, string> = {
  high:   'bg-red-50 text-red-700',
  medium: 'bg-amber-50 text-amber-700',
  low:    'bg-slate-100 text-slate-600',
}

const STATUS_CLASSES: Record<string, string> = {
  done:        'bg-green-100 text-green-700',
  in_progress: 'bg-blue-100 text-blue-700',
  review:      'bg-purple-100 text-purple-700',
  todo:        'bg-slate-100 text-slate-600',
}

const STATUS_LABEL: Record<string, string> = {
  done: 'Done', in_progress: 'In Progress', review: 'Review', todo: 'To Do',
}

interface CalendarViewProps {
  tasks: Task[]
  profiles: Profile[]
  currentUserId: string
}

export function CalendarView({ tasks, profiles, currentUserId }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)
  const [filterUserId, setFilterUserId] = useState<string | null>(null)

  // Apply user filter
  const filteredTasks = useMemo(() =>
    filterUserId ? tasks.filter((t) => t.assignee_id === filterUserId) : tasks,
    [tasks, filterUserId]
  )

  const monthStart  = startOfMonth(currentDate)
  const monthEnd    = endOfMonth(currentDate)
  const calStart    = startOfWeek(monthStart, { weekStartsOn: 1 })
  const calEnd      = endOfWeek(monthEnd, { weekStartsOn: 1 })
  const days        = eachDayOfInterval({ start: calStart, end: calEnd })

  function tasksForDay(day: Date) {
    return filteredTasks.filter((t) => t.due_date && isSameDay(new Date(t.due_date), day))
  }

  const selectedDayTasks = selectedDay ? tasksForDay(selectedDay) : []

  return (
    <div>
      {/* Month navigation + filter row */}
      <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
        {/* Month nav */}
        <div className="flex items-center gap-1">
          <button onClick={() => setCurrentDate((d) => subMonths(d, 1))} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors" aria-label="Previous month">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <h2 className="text-base font-semibold text-slate-900 px-2 min-w-[140px] text-center">
            {format(currentDate, 'MMMM yyyy')}
          </h2>
          <button onClick={() => setCurrentDate((d) => addMonths(d, 1))} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors" aria-label="Next month">
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => { setCurrentDate(new Date()); setSelectedDay(null) }}
            className="ml-1 px-3 py-1 text-xs font-medium rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
          >
            Today
          </button>
        </div>
      </div>

      {/* Assignee filter bar */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <span className="text-xs text-slate-400 font-medium flex items-center gap-1">
          <User className="w-3 h-3" /> Assignee:
        </span>

        <button
          onClick={() => setFilterUserId(null)}
          className={cn('px-2.5 py-1 text-xs rounded-full font-medium transition-colors',
            !filterUserId ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}
        >
          All
        </button>

        {/* Me button */}
        {currentUserId && (
          <button
            onClick={() => setFilterUserId(filterUserId === currentUserId ? null : currentUserId)}
            className={cn('px-2.5 py-1 text-xs rounded-full font-medium transition-colors',
              filterUserId === currentUserId
                ? 'bg-blue-600 text-white'
                : 'bg-blue-50 text-blue-700 hover:bg-blue-100')}
          >
            Me
          </button>
        )}

        {/* Other team members */}
        {profiles
          .filter((p) => p.id !== currentUserId)
          .map((p) => (
            <button
              key={p.id}
              onClick={() => setFilterUserId(filterUserId === p.id ? null : p.id)}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-full font-medium transition-colors',
                filterUserId === p.id
                  ? 'bg-slate-700 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              )}
            >
              <Avatar name={p.name} size="sm" />
              {p.name.split(' ')[0]}
            </button>
          ))}

        {/* Active filter summary */}
        {filterUserId && (
          <span className="text-xs text-slate-400 ml-1">
            — {filteredTasks.length} task{filteredTasks.length !== 1 ? 's' : ''} assigned
          </span>
        )}
      </div>

      {/* Calendar grid */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
          {DAYS.map((d) => (
            <div key={d} className="py-2.5 text-center text-xs font-medium text-slate-500">{d}</div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7" style={{ gridAutoRows: '1fr' }}>
          {days.map((day, idx) => {
            const dayTasks = tasksForDay(day)
            const isCurrentMonth = isSameMonth(day, currentDate)
            const isSelected = selectedDay ? isSameDay(day, selectedDay) : false
            const isWeekend = idx % 7 >= 5

            return (
              <div
                key={day.toISOString()}
                onClick={() => setSelectedDay(isSelected ? null : day)}
                className={cn(
                  'min-h-[88px] p-1.5 cursor-pointer transition-colors border-b border-r border-slate-100',
                  isCurrentMonth
                    ? isWeekend ? 'bg-slate-50/60 hover:bg-slate-50' : 'bg-white hover:bg-slate-50'
                    : 'bg-slate-50/80',
                  isSelected && 'ring-2 ring-inset ring-blue-500 bg-blue-50/30'
                )}
              >
                <span className={cn(
                  'text-xs font-medium inline-flex w-6 h-6 items-center justify-center rounded-full mb-0.5',
                  isToday(day) && 'bg-blue-600 text-white',
                  !isToday(day) && isCurrentMonth && 'text-slate-700',
                  !isCurrentMonth && 'text-slate-400'
                )}>
                  {format(day, 'd')}
                </span>

                <div className="space-y-0.5">
                  {dayTasks.slice(0, 2).map((task) => (
                    <div
                      key={task.id}
                      className={cn('text-xs px-1.5 py-0.5 rounded truncate leading-tight', PRIORITY_CLASSES[task.priority])}
                      title={task.title}
                    >
                      {task.title}
                    </div>
                  ))}
                  {dayTasks.length > 2 && (
                    <div className="text-xs text-slate-400 px-1">+{dayTasks.length - 2} more</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Selected day detail */}
      {selectedDay && (
        <div className="mt-4 bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-900">
              {format(selectedDay, 'EEEE, MMMM d')}
            </h3>
            <span className="text-xs text-slate-400">
              {selectedDayTasks.length} task{selectedDayTasks.length !== 1 ? 's' : ''}
              {filterUserId && ' (filtered)'}
            </span>
          </div>

          {selectedDayTasks.length === 0 ? (
            <p className="text-sm text-slate-400">
              {filterUserId ? 'No tasks assigned to this person on this day.' : 'No tasks due on this day.'}
            </p>
          ) : (
            <div className="space-y-2">
              {selectedDayTasks.map((task) => (
                <div key={task.id} className="flex items-center gap-3 py-2.5 px-3 rounded-lg bg-slate-50">
                  <span className={cn('w-2 h-2 rounded-full shrink-0',
                    task.priority === 'high' ? 'bg-red-500' :
                    task.priority === 'medium' ? 'bg-amber-500' : 'bg-slate-300'
                  )} />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-slate-700">{task.title}</span>
                    {task.assignee && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <Avatar name={task.assignee.name} size="sm" />
                        <span className="text-xs text-slate-400">{task.assignee.name}</span>
                      </div>
                    )}
                  </div>
                  <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium shrink-0', STATUS_CLASSES[task.status])}>
                    {STATUS_LABEL[task.status]}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">
        <span className="font-medium">Priority:</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> High</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block" /> Medium</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-300 inline-block" /> Low</span>
      </div>
    </div>
  )
}
