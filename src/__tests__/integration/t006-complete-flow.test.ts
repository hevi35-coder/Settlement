/**
 * T-006 전체 플로우 통합 테스트
 * 기간별 지출 내역 조회 API 및 프론트엔드 연동 검증
 */

import { useExpenses, useExpensesByDateRange, useRecentExpenses } from '@/hooks/useExpenses'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactNode } from 'react'
import React from 'react'

// Mock fetch
global.fetch = jest.fn()

const mockExpensesResponse = {
  success: true,
  data: [
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
  ],
  pagination: {
    total: 2,
    limit: 100,
    offset: 0,
    hasMore: false
  },
  summary: {
    totalAmount: -6500,
    totalCount: 2,
    dateRange: {
      earliest: '2025-09-19',
      latest: '2025-09-20'
    },
    categories: ['식비', '교통비'],
    paymentMethods: ['카드', '교통카드']
  },
  filters: {
    startDate: null,
    endDate: null,
    userId: 'test-user'
  }
}

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        cacheTime: 0,
        staleTime: 0
      }
    }
  })

  return function TestWrapper({ children }: { children: ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

describe('T-006 Complete Flow Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockExpensesResponse
    })
  })

  describe('API 연동 테스트', () => {
    test('useExpenses hook이 정상적으로 데이터를 가져온다', async () => {
      const wrapper = createWrapper()

      const { result } = renderHook(
        () => useExpenses(),
        { wrapper }
      )

      // 초기 로딩 상태 확인
      expect(result.current.isLoading).toBe(true)
      expect(result.current.data).toBeUndefined()

      // 데이터 로딩 완료 대기
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      // 데이터 검증
      expect(result.current.data?.success).toBe(true)
      expect(result.current.data?.data).toHaveLength(2)
      expect(result.current.data?.summary.totalAmount).toBe(-6500)
      expect(result.current.error).toBeNull()
    })

    test('API 쿼리 파라미터가 올바르게 전달된다', async () => {
      const wrapper = createWrapper()

      const { result } = renderHook(
        () => useExpenses({
          startDate: '2025-09-01',
          endDate: '2025-09-30',
          limit: 50,
          offset: 10
        }),
        { wrapper }
      )

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      // API 호출 확인
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/expenses?startDate=2025-09-01&endDate=2025-09-30&limit=50&offset=10')
      )
    })

    test('useExpensesByDateRange가 올바른 파라미터로 호출된다', async () => {
      const wrapper = createWrapper()

      const { result } = renderHook(
        () => useExpensesByDateRange('2025-09-01', '2025-09-30'),
        { wrapper }
      )

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('startDate=2025-09-01&endDate=2025-09-30')
      )
    })

    test('useRecentExpenses가 올바른 날짜 범위로 호출된다', async () => {
      const wrapper = createWrapper()

      // 현재 날짜 mock
      const mockDate = new Date('2025-09-20')
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate)

      const { result } = renderHook(
        () => useRecentExpenses(7), // 최근 7일
        { wrapper }
      )

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      // 7일 전 날짜 계산 (2025-09-13)
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('startDate=2025-09-13&endDate=2025-09-20')
      )

      jest.restoreAllMocks()
    })
  })

  describe('오류 처리 테스트', () => {
    test('API 오류 시 적절한 오류 상태를 반환한다', async () => {
      ;(fetch as jest.Mock).mockRejectedValue(new Error('Network error'))

      const wrapper = createWrapper()

      const { result } = renderHook(
        () => useExpenses(),
        { wrapper }
      )

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error).toBeTruthy()
      expect(result.current.data).toBeUndefined()
    })

    test('401 인증 오류 시 재시도하지 않는다', async () => {
      ;(fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ error: '인증이 필요합니다.' })
      })

      const wrapper = createWrapper()

      const { result } = renderHook(
        () => useExpenses(),
        { wrapper }
      )

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      // 401 오류로 인해 재시도 없이 1번만 호출
      expect(fetch).toHaveBeenCalledTimes(1)
    })

    test('일반 오류 시 3번까지 재시도한다', async () => {
      ;(fetch as jest.Mock).mockRejectedValue(new Error('Server error'))

      const wrapper = createWrapper()

      const { result } = renderHook(
        () => useExpenses(),
        { wrapper }
      )

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      // 3번 재시도 + 초기 1번 = 총 4번 호출
      expect(fetch).toHaveBeenCalledTimes(4)
    })
  })

  describe('캐싱 및 성능 테스트', () => {
    test('동일한 쿼리에 대해 캐시를 사용한다', async () => {
      const wrapper = createWrapper()

      // 첫 번째 호출
      const { result: result1 } = renderHook(
        () => useExpenses({ startDate: '2025-09-01' }),
        { wrapper }
      )

      await waitFor(() => {
        expect(result1.current.isLoading).toBe(false)
      })

      expect(fetch).toHaveBeenCalledTimes(1)

      // 동일한 파라미터로 두 번째 호출
      const { result: result2 } = renderHook(
        () => useExpenses({ startDate: '2025-09-01' }),
        { wrapper }
      )

      await waitFor(() => {
        expect(result2.current.isLoading).toBe(false)
      })

      // 캐시 사용으로 추가 API 호출 없음
      expect(fetch).toHaveBeenCalledTimes(1)
      expect(result2.current.data).toEqual(result1.current.data)
    })

    test('다른 파라미터로는 새로운 요청을 보낸다', async () => {
      const wrapper = createWrapper()

      // 첫 번째 호출
      const { result: result1 } = renderHook(
        () => useExpenses({ startDate: '2025-09-01' }),
        { wrapper }
      )

      await waitFor(() => {
        expect(result1.current.isLoading).toBe(false)
      })

      // 다른 파라미터로 두 번째 호출
      const { result: result2 } = renderHook(
        () => useExpenses({ startDate: '2025-09-02' }),
        { wrapper }
      )

      await waitFor(() => {
        expect(result2.current.isLoading).toBe(false)
      })

      // 다른 파라미터이므로 새 요청
      expect(fetch).toHaveBeenCalledTimes(2)
    })
  })

  describe('페이지네이션 테스트', () => {
    test('페이지네이션 파라미터가 올바르게 처리된다', async () => {
      const mockPaginatedResponse = {
        ...mockExpensesResponse,
        pagination: {
          total: 150,
          limit: 50,
          offset: 50,
          hasMore: true
        }
      }

      ;(fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockPaginatedResponse
      })

      const wrapper = createWrapper()

      const { result } = renderHook(
        () => useExpenses({ limit: 50, offset: 50 }),
        { wrapper }
      )

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.data?.pagination.hasMore).toBe(true)
      expect(result.current.data?.pagination.total).toBe(150)
      expect(result.current.data?.pagination.offset).toBe(50)
    })
  })

  describe('데이터 형식 검증', () => {
    test('응답 데이터 구조가 올바른지 검증한다', async () => {
      const wrapper = createWrapper()

      const { result } = renderHook(
        () => useExpenses(),
        { wrapper }
      )

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      const data = result.current.data!

      // 기본 구조 검증
      expect(data).toHaveProperty('success')
      expect(data).toHaveProperty('data')
      expect(data).toHaveProperty('pagination')
      expect(data).toHaveProperty('summary')
      expect(data).toHaveProperty('filters')

      // 데이터 배열 검증
      expect(Array.isArray(data.data)).toBe(true)
      data.data.forEach(expense => {
        expect(expense).toHaveProperty('id')
        expect(expense).toHaveProperty('expense_date')
        expect(expense).toHaveProperty('category_main')
        expect(expense).toHaveProperty('content')
        expect(expense).toHaveProperty('amount')
        expect(expense).toHaveProperty('payment_method')
        expect(typeof expense.amount).toBe('number')
      })

      // 요약 정보 검증
      expect(data.summary).toHaveProperty('totalAmount')
      expect(data.summary).toHaveProperty('totalCount')
      expect(data.summary).toHaveProperty('categories')
      expect(data.summary).toHaveProperty('paymentMethods')
      expect(Array.isArray(data.summary.categories)).toBe(true)
      expect(Array.isArray(data.summary.paymentMethods)).toBe(true)

      // 페이지네이션 정보 검증
      expect(data.pagination).toHaveProperty('total')
      expect(data.pagination).toHaveProperty('limit')
      expect(data.pagination).toHaveProperty('offset')
      expect(data.pagination).toHaveProperty('hasMore')
    })

    test('빈 데이터에 대한 응답이 올바른지 검증한다', async () => {
      const emptyResponse = {
        success: true,
        data: [],
        pagination: {
          total: 0,
          limit: 100,
          offset: 0,
          hasMore: false
        },
        summary: {
          totalAmount: 0,
          totalCount: 0,
          dateRange: null,
          categories: [],
          paymentMethods: []
        },
        filters: {
          startDate: null,
          endDate: null,
          userId: 'test-user'
        }
      }

      ;(fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => emptyResponse
      })

      const wrapper = createWrapper()

      const { result } = renderHook(
        () => useExpenses(),
        { wrapper }
      )

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      const data = result.current.data!

      expect(data.data).toHaveLength(0)
      expect(data.summary.totalAmount).toBe(0)
      expect(data.summary.totalCount).toBe(0)
      expect(data.summary.categories).toHaveLength(0)
      expect(data.summary.paymentMethods).toHaveLength(0)
      expect(data.pagination.total).toBe(0)
      expect(data.pagination.hasMore).toBe(false)
    })
  })
})