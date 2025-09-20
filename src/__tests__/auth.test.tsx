import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LoginPage from '@/app/auth/login/page'

// Mock the Supabase client
const mockSignInWithPassword = jest.fn()
const mockSignInWithOAuth = jest.fn()

jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      signInWithPassword: mockSignInWithPassword,
      signInWithOAuth: mockSignInWithOAuth,
    },
  }),
}))

// Mock Next.js router
const mockPush = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}))

describe('Authentication', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('로그인 페이지가 렌더링된다', () => {
    render(<LoginPage />)

    expect(screen.getByText('월말정산 자동화 서비스에 로그인하세요')).toBeInTheDocument()
    expect(screen.getByLabelText('이메일')).toBeInTheDocument()
    expect(screen.getByLabelText('비밀번호')).toBeInTheDocument()
  })

  it('이메일 로그인을 시도할 수 있다', async () => {
    const user = userEvent.setup()
    mockSignInWithPassword.mockResolvedValue({ error: null })

    render(<LoginPage />)

    await user.type(screen.getByLabelText('이메일'), 'test@example.com')
    await user.type(screen.getByLabelText('비밀번호'), 'password123')
    await user.click(screen.getByRole('button', { name: '로그인' }))

    expect(mockSignInWithPassword).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'password123',
    })
  })

  it('로그인 실패 시 에러 메시지를 표시한다', async () => {
    const user = userEvent.setup()
    mockSignInWithPassword.mockResolvedValue({
      error: { message: '잘못된 로그인 정보입니다.' }
    })

    render(<LoginPage />)

    await user.type(screen.getByLabelText('이메일'), 'test@example.com')
    await user.type(screen.getByLabelText('비밀번호'), 'wrongpassword')
    await user.click(screen.getByRole('button', { name: '로그인' }))

    await waitFor(() => {
      expect(screen.getByText('잘못된 로그인 정보입니다.')).toBeInTheDocument()
    })
  })
})