import { forwardRef } from 'react'
import { cn } from '@/lib/utils'
import { inputClass } from '@/components/shared/form-controls'

// Thin wrappers over the inputClass() string that ~25 form pages already
// build their <input>/<textarea> with directly. inputClass stays exported
// for call sites that need to compose it onto something else (e.g. a
// SearchableSelect trigger); these two are for the plain cases.
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, ...props }, ref) => (
    <input ref={ref} className={cn(inputClass(!!error), className)} {...props} />
  )
)
Input.displayName = 'Input'

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(inputClass(!!error, 'h-auto py-2 min-h-[72px] resize-y'), className)}
      {...props}
    />
  )
)
Textarea.displayName = 'Textarea'
