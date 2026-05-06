import { cn } from '@/lib/utils'

interface ProgressBarProps {
  value: number
  max?: number
  className?: string
  color?: 'blue' | 'green' | 'orange' | 'red'
}

const colors = {
  blue: 'bg-blue-500',
  green: 'bg-green-500',
  orange: 'bg-orange-500',
  red: 'bg-red-500',
}

export function ProgressBar({ value, max = 100, className, color = 'blue' }: ProgressBarProps) {
  const pct = Math.min(100, Math.round((value / (max || 1)) * 100))
  return (
    <div className={cn('w-full bg-slate-100 rounded-full h-2 overflow-hidden', className)}>
      <div
        className={cn('h-full rounded-full transition-all', colors[color])}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}
