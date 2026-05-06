import { cn } from '@/lib/utils'
import { forwardRef } from 'react'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'destructive' | 'ghost' | 'outline'
  size?: 'sm' | 'md' | 'lg'
}

const variants = {
  primary: 'text-white',
  secondary: 'bg-slate-100 hover:bg-slate-200 text-slate-900',
  destructive: 'bg-red-600 hover:bg-red-700 text-white',
  ghost: 'hover:bg-slate-100 text-slate-600',
  outline: 'border border-slate-200 hover:bg-slate-50 text-slate-700',
}

const sizes = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-2.5 text-base',
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', disabled, children, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled}
      className={cn(
        'inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
        variants[variant],
        sizes[size],
        className
      )}
      style={
        (variant === 'primary' || variant === undefined)
          ? { backgroundColor: 'var(--color-primary)', ['--tw-bg-opacity' as string]: '1' } as React.CSSProperties
          : undefined
      }
      {...props}
    >
      {children}
    </button>
  )
)
Button.displayName = 'Button'

export { Button }
