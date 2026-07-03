import * as React from "react"
import { cn } from "@/lib/utils"

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'ghost' | 'secondary'
  size?: 'default' | 'sm' | 'lg'
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant = 'default', size = 'default', ...props }, ref) => {
  return (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-[15px] text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#005BAC] disabled:pointer-events-none disabled:opacity-50",
        {
          'bg-[#005BAC] text-white hover:bg-[#004787] shadow-md': variant === 'default',
          'border border-[#E0E0E0] bg-white hover:bg-gray-50 text-[#3C4043]': variant === 'outline',
          'hover:bg-gray-100 text-[#3C4043]': variant === 'ghost',
          'bg-[#F1F3F4] text-[#3C4043] hover:bg-[#E8EAED]': variant === 'secondary',
          'h-10 px-4 py-2': size === 'default',
          'h-9 px-3': size === 'sm',
          'h-12 px-8 text-base': size === 'lg',
        },
        className
      )}
      {...props}
    />
  )
})
Button.displayName = "Button"

export { Button }
