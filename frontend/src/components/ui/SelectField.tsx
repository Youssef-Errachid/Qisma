import { type ComponentProps, useId } from 'react'

interface SelectFieldProps extends ComponentProps<'select'> {
  label: string
  error?: string
}

export function SelectField({ label, error, children, className = '', ...rest }: SelectFieldProps) {
  const id = useId()
  const errorId = `${id}-error`
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-slate-800">
        {label}
      </label>
      <select
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={`block w-full rounded-lg border-0 bg-white py-2.5 ps-3 pe-8 text-sm text-slate-900 ring-1 ring-inset focus:ring-2 focus:ring-inset ${
          error ? 'ring-debt focus:ring-debt' : 'ring-slate-300 focus:ring-brand'
        } ${className}`}
        {...rest}
      >
        {children}
      </select>
      {error && (
        <p id={errorId} className="text-xs font-medium text-debt">
          {error}
        </p>
      )}
    </div>
  )
}
