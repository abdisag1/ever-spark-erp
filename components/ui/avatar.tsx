import { cn, getInitials } from '@/lib/utils'

const colors = [
  'bg-blue-500',
  'bg-purple-500',
  'bg-green-500',
  'bg-orange-500',
  'bg-pink-500',
  'bg-teal-500',
]

function colorForName(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

interface AvatarProps {
  name: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizes = { sm: 'w-6 h-6 text-xs', md: 'w-8 h-8 text-sm', lg: 'w-10 h-10 text-base' }

export function Avatar({ name, size = 'md', className }: AvatarProps) {
  return (
    <div
      title={name}
      className={cn(
        'rounded-full flex items-center justify-center text-white font-semibold shrink-0',
        colorForName(name),
        sizes[size],
        className
      )}
    >
      {getInitials(name)}
    </div>
  )
}
