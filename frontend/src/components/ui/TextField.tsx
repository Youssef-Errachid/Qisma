import { type ComponentProps, useId } from 'react'

interface TextFieldProps extends ComponentProps<'input'> {
  label: string
  /** Already translated. */
  error?: string
  hint?: string
}

export function TextField({ label, error, hint, className = '', ...rest }: TextFieldProps) {
  const id = useId()
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-slate-800">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`block w-full rounded-lg border-0 px-3 py-2.5 text-sm text-slate-900 ring-1 ring-inset placeholder:text-slate-400 focus:ring-2 focus:ring-inset ${
          error ? 'ring-debt focus:ring-debt' : 'ring-slate-300 focus:ring-brand'
        } ${className}`}
        {...rest}
      />
      {hint && !error && (
        <p id={hintId} className="text-xs text-slate-500">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-xs font-medium text-debt">
          {error}
        </p>
      )}
    </div>
  )
}
