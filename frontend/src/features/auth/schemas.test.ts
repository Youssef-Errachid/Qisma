import { describe, expect, it } from 'vitest'
import { loginSchema, registerSchema } from './schemas'

const valid = {
  username: 'youssef.e',
  fullName: 'Youssef Errachid',
  email: 'youssef@test.com',
  password: 'Passw0rdOK',
  confirmPassword: 'Passw0rdOK',
}

function messagesFor(data: unknown, field: string): string[] {
  const result = registerSchema.safeParse(data)
  return result.success ? [] : result.error.issues.filter((i) => i.path[0] === field).map((i) => i.message)
}

describe('registerSchema (same rules as the API)', () => {
  it('accepts a valid form and trims the text fields', () => {
    const result = registerSchema.safeParse({ ...valid, username: '  youssef.e ', email: ' youssef@test.com ' })

    expect(result.success).toBe(true)
    expect(result.data?.username).toBe('youssef.e')
    expect(result.data?.email).toBe('youssef@test.com')
  })

  it('applies the username rules', () => {
    expect(messagesFor({ ...valid, username: '' }, 'username')[0]).toBe('validation.required')
    expect(messagesFor({ ...valid, username: 'ab' }, 'username')).toContain('validation.usernameLength')
    expect(messagesFor({ ...valid, username: 'a'.repeat(31) }, 'username')).toContain('validation.usernameLength')
    expect(messagesFor({ ...valid, username: 'bad name' }, 'username')).toContain('validation.usernamePattern')
    expect(messagesFor({ ...valid, username: 'ok.name_1-x' }, 'username')).toEqual([])
  })

  it('applies the e-mail rules', () => {
    expect(messagesFor({ ...valid, email: '' }, 'email')[0]).toBe('validation.required')
    expect(messagesFor({ ...valid, email: 'not-an-email' }, 'email')).toContain('validation.email')
    expect(messagesFor({ ...valid, email: 'a@b' }, 'email')).toContain('validation.email')
  })

  it('applies the password policy: 8 to 72 characters with a letter and a digit', () => {
    expect(messagesFor({ ...valid, password: 'short1' }, 'password')).toContain('validation.passwordLength')
    expect(messagesFor({ ...valid, password: 'onlyletters' }, 'password')).toContain('validation.passwordStrength')
    expect(messagesFor({ ...valid, password: '12345678' }, 'password')).toContain('validation.passwordStrength')
    expect(messagesFor({ ...valid, password: 'a1'.repeat(37) }, 'password')).toContain('validation.passwordLength')
    expect(messagesFor({ ...valid, password: 'abcdefg1' }, 'password')).toEqual([])
  })

  it('requires the two passwords to match, and reports it on the confirmation field', () => {
    expect(messagesFor({ ...valid, confirmPassword: 'Different1' }, 'confirmPassword')).toEqual(['validation.passwordMismatch'])
  })

  it('limits the full name', () => {
    expect(messagesFor({ ...valid, fullName: 'x'.repeat(101) }, 'fullName')).toContain('validation.fullNameLength')
    expect(messagesFor({ ...valid, fullName: '   ' }, 'fullName')[0]).toBe('validation.required')
  })
})

describe('loginSchema', () => {
  it('only asks for something to be typed (the server decides whether it is right)', () => {
    expect(loginSchema.safeParse({ email: 'x', password: 'y' }).success).toBe(true)
    expect(loginSchema.safeParse({ email: '', password: 'y' }).success).toBe(false)
    expect(loginSchema.safeParse({ email: 'x', password: '' }).success).toBe(false)
  })
})
