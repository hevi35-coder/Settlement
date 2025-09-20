/**
 * Expenses API Route 단위 테스트
 */

// Mock NextRequest for test environment
Object.defineProperty(global, 'Request', {
  value: class MockRequest {
    url: string
    constructor(url: string) {
      this.url = url
    }
  }
})

import { NextRequest } from 'next/server'
import { GET } from '@/app/api/expenses/route'

// Supabase mock
const mockUser = {
  id: 'test-user-id',
  email: 'test@example.com'
}

const mockExpenses = [
  {
    id: '1',
    expense_date: '2025-09-20',
    category_main: '식비',
    content: '아침 식사',
    amount: -5000,
    memo: '테스트 메모',
    payment_method: '카드',
    created_at: '2025-09-20T10:00:00Z'
  },
  {
    id: '2',
    expense_date: '2025-09-19',
    category_main: '교통비',
    content: '버스비',
    amount: -1500,
    memo: '',
    payment_method: '교통카드',
    created_at: '2025-09-19T15:30:00Z'
  }
]

const mockSelect = jest.fn()
const mockEq = jest.fn()
const mockGte = jest.fn()
const mockLte = jest.fn()
const mockOrder = jest.fn()
const mockRange = jest.fn()

// Supabase 클라이언트 mock
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() => ({
    auth: {
      getUser: jest.fn()
    },
    from: jest.fn(() => ({
      select: mockSelect
    }))
  }))
}))

describe('Expenses API Route', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    // 기본 mock 체인 설정
    mockSelect.mockReturnValue({
      eq: mockEq
    })

    mockEq.mockReturnValue({
      order: mockOrder
    })

    mockOrder.mockReturnValue({
      range: mockRange
    })

    mockRange.mockResolvedValue({
      data: mockExpenses,
      error: null
    })

    // 필터링 메소드들 체인 설정
    mockGte.mockReturnValue({
      order: mockOrder
    })

    mockLte.mockReturnValue({
      order: mockOrder
    })
  })

  describe('GET /api/expenses', () => {
    test('인증된 사용자의 expenses를 성공적으로 조회한다', async () => {
      const { createClient } = require('@/lib/supabase/server')
      const mockSupabase = createClient()

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      })

      // Count query mock
      mockSelect.mockReturnValueOnce({
        eq: jest.fn().mockResolvedValue({
          count: 2,
          error: null
        })
      })

      const url = 'http://localhost:3000/api/expenses'
      const request = new NextRequest(url)

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data).toHaveLength(2)
      expect(data.data[0]).toMatchObject({
        id: '1',
        content: '아침 식사',
        amount: -5000
      })
      expect(data.pagination.total).toBe(2)
      expect(data.summary.totalAmount).toBe(-6500)
    })

    test('시작일과 종료일로 필터링한다', async () => {
      const { createClient } = require('@/lib/supabase/server')
      const mockSupabase = createClient()

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      })

      // 필터링된 select 체인 mock
      mockSelect.mockReturnValue({
        eq: jest.fn().mockReturnValue({
          order: jest.fn().mockReturnValue({
            gte: mockGte,
            lte: mockLte,
            range: mockRange
          })
        })
      })

      mockGte.mockReturnValue({
        lte: mockLte
      })

      mockLte.mockReturnValue({
        range: mockRange
      })

      mockRange.mockResolvedValue({
        data: [mockExpenses[0]], // 필터링된 결과
        error: null
      })

      // Count query
      mockSelect.mockReturnValueOnce({
        eq: jest.fn().mockReturnValue({
          gte: jest.fn().mockReturnValue({
            lte: jest.fn().mockResolvedValue({
              count: 1,
              error: null
            })
          })
        })
      })

      const url = 'http://localhost:3000/api/expenses?startDate=2025-09-20&endDate=2025-09-20'
      const request = new NextRequest(url)

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.filters.startDate).toBe('2025-09-20')
      expect(data.filters.endDate).toBe('2025-09-20')
    })

    test('페이지네이션 매개변수를 올바르게 처리한다', async () => {
      const { createClient } = require('@/lib/supabase/server')
      const mockSupabase = createClient()

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      })

      // Count query
      mockSelect.mockReturnValueOnce({
        eq: jest.fn().mockResolvedValue({
          count: 100,
          error: null
        })
      })

      const url = 'http://localhost:3000/api/expenses?limit=10&offset=20'
      const request = new NextRequest(url)

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.pagination.limit).toBe(10)
      expect(data.pagination.offset).toBe(20)
      expect(data.pagination.total).toBe(100)
      expect(data.pagination.hasMore).toBe(true)

      // range 메서드가 올바른 매개변수로 호출되었는지 확인
      expect(mockRange).toHaveBeenCalledWith(20, 29) // offset 20, limit 10 -> range(20, 29)
    })

    test('인증되지 않은 사용자에게 401 오류를 반환한다', async () => {
      const { createClient } = require('@/lib/supabase/server')
      const mockSupabase = createClient()

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: new Error('Unauthorized')
      })

      const url = 'http://localhost:3000/api/expenses'
      const request = new NextRequest(url)

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('인증이 필요합니다.')
    })

    test('데이터베이스 오류 시 500 오류를 반환한다', async () => {
      const { createClient } = require('@/lib/supabase/server')
      const mockSupabase = createClient()

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      })

      // 데이터베이스 오류 mock
      mockRange.mockResolvedValue({
        data: null,
        error: new Error('Database connection failed')
      })

      const url = 'http://localhost:3000/api/expenses'
      const request = new NextRequest(url)

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('데이터 조회 중 오류가 발생했습니다.')
    })

    test('빈 결과에 대해 올바른 응답을 반환한다', async () => {
      const { createClient } = require('@/lib/supabase/server')
      const mockSupabase = createClient()

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      })

      // 빈 결과 mock
      mockRange.mockResolvedValue({
        data: [],
        error: null
      })

      // Count query
      mockSelect.mockReturnValueOnce({
        eq: jest.fn().mockResolvedValue({
          count: 0,
          error: null
        })
      })

      const url = 'http://localhost:3000/api/expenses'
      const request = new NextRequest(url)

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data).toHaveLength(0)
      expect(data.pagination.total).toBe(0)
      expect(data.summary.totalAmount).toBe(0)
      expect(data.summary.totalCount).toBe(0)
      expect(data.summary.categories).toHaveLength(0)
      expect(data.summary.paymentMethods).toHaveLength(0)
    })

    test('요약 정보를 올바르게 계산한다', async () => {
      const { createClient } = require('@/lib/supabase/server')
      const mockSupabase = createClient()

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      })

      const mockExpensesWithVariety = [
        ...mockExpenses,
        {
          id: '3',
          expense_date: '2025-09-18',
          category_main: '식비',
          content: '점심 식사',
          amount: -8000,
          memo: '',
          payment_method: '현금',
          created_at: '2025-09-18T12:00:00Z'
        }
      ]

      mockRange.mockResolvedValue({
        data: mockExpensesWithVariety,
        error: null
      })

      // Count query
      mockSelect.mockReturnValueOnce({
        eq: jest.fn().mockResolvedValue({
          count: 3,
          error: null
        })
      })

      const url = 'http://localhost:3000/api/expenses'
      const request = new NextRequest(url)

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.summary.totalAmount).toBe(-14500) // -5000 + -1500 + -8000
      expect(data.summary.totalCount).toBe(3)
      expect(data.summary.categories).toEqual(['식비', '교통비'])
      expect(data.summary.paymentMethods).toEqual(['카드', '교통카드', '현금'])
      expect(data.summary.dateRange).toMatchObject({
        earliest: '2025-09-18', // 가장 이른 날짜
        latest: '2025-09-20'   // 가장 늦은 날짜
      })
    })

    test('잘못된 매개변수를 올바르게 처리한다', async () => {
      const { createClient } = require('@/lib/supabase/server')
      const mockSupabase = createClient()

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      })

      // Count query
      mockSelect.mockReturnValueOnce({
        eq: jest.fn().mockResolvedValue({
          count: 2,
          error: null
        })
      })

      // 잘못된 숫자 매개변수 테스트
      const url = 'http://localhost:3000/api/expenses?limit=invalid&offset=abc'
      const request = new NextRequest(url)

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.pagination.limit).toBe(100) // 기본값
      expect(data.pagination.offset).toBe(0)  // 기본값
    })
  })
})