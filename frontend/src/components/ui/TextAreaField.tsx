import { type ComponentProps, useId } from 'react'

interface TextAreaFieldProps extends ComponentProps<'textarea'> {
  label: string
  error?: string
}

export function TextAreaField({ label, error, className = '', ...rest }: TextAreaFieldProps) {
  const id = useId()
  const errorId = `${id}-error`
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-slate-800">
        {label}
      </label>
      <textarea
        id={id}
        rows={3}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={`block w-full rounded-lg border-0 px-3 py-2.5 text-sm text-slate-900 ring-1 ring-inset placeholder:text-slate-400 focus:ring-2 focus:ring-inset ${
          error ? 'ring-debt focus:ring-debt' : 'ring-slate-300 focus:ring-brand'
        } ${className}`}
        {...rest}
      />
      {error && (
        <p id={errorId} className="text-xs font-medium text-debt">
          {error}
        </p>
      )}
    </div>
  )
}
