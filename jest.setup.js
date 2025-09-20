import '@testing-library/jest-dom'

// Mock Supabase
jest.mock('@/lib/supabase/client', () => ({
  createClient: jest.fn(() => ({
    auth: {
      signInWithPassword: jest.fn(),
      signInWithOAuth: jest.fn(),
      signUp: jest.fn(),
      signOut: jest.fn(),
      getUser: jest.fn(),
      exchangeCodeForSession: jest.fn(),
    },
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(),
        })),
      })),
      insert: jest.fn(),
      upsert: jest.fn(),
    })),
  })),
}))

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() => Promise.resolve({
    auth: {
      getUser: jest.fn(() => Promise.resolve({ data: { user: null } })),
    },
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({ data: null })),
        })),
      })),
      insert: jest.fn(() => Promise.resolve({ error: null })),
      upsert: jest.fn(() => Promise.resolve({ error: null })),
    })),
  })),
}))

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  })),
  useSearchParams: jest.fn(() => ({
    get: jest.fn(),
  })),
  redirect: jest.fn(),
}))

// Mock environment variables
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'

// File API polyfill for Node.js environment
global.File = class File {
  constructor(fileBits, fileName, options = {}) {
    this.name = fileName
    this.size = fileBits.reduce((acc, bit) => acc + (bit.length || bit.byteLength || 0), 0)
    this.type = options.type || ''
    this.lastModified = Date.now()
    this.webkitRelativePath = ''
    this._bits = fileBits
  }

  arrayBuffer() {
    return Promise.resolve(Buffer.concat(this._bits))
  }

  text() {
    return Promise.resolve(Buffer.concat(this._bits).toString())
  }

  stream() {
    // Simplified stream implementation
    return {
      getReader() {
        return {
          read() {
            return Promise.resolve({ done: true, value: undefined })
          }
        }
      }
    }
  }
}

// FormData polyfill
global.FormData = class FormData {
  constructor() {
    this._data = new Map()
  }

  append(name, value) {
    if (!this._data.has(name)) {
      this._data.set(name, [])
    }
    this._data.get(name).push(value)
  }

  get(name) {
    const values = this._data.get(name)
    return values ? values[0] : null
  }

  getAll(name) {
    return this._data.get(name) || []
  }

  has(name) {
    return this._data.has(name)
  }

  *entries() {
    for (const [name, values] of this._data) {
      for (const value of values) {
        yield [name, value]
      }
    }
  }
}