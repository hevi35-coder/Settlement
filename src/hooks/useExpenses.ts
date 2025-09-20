'use client'

import { useQuery } from '@tanstack/react-query'

export interface Expense {
  id: string
  expense_date: string
  category_main: string
  content: string
  amount: number
  memo: string
  payment_method: string
  created_at: string
}

export interface ExpensesResponse {
  success: boolean
  data: Expense[]
  pagination: {
    total: number
    limit: number
    offset: number
    hasMore: boolean
  }
  summary: {
    totalAmount: number
    totalCount: number
    dateRange: {
      earliest: string
      latest: string
    } | null
    categories: string[]
    paymentMethods: string[]
  }
  filters: {
    startDate: string | null
    endDate: string | null
    userId: string
  }
}

export interface UseExpensesParams {
  startDate?: string
  endDate?: string
  limit?: number
  offset?: number
  enabled?: boolean
}

export function useExpenses({
  startDate,
  endDate,
  limit = 100,
  offset = 0,
  enabled = true
}: UseExpensesParams = {}) {
  return useQuery<ExpensesResponse>({
    queryKey: ['expenses', { startDate, endDate, limit, offset }],
    queryFn: async () => {
      const params = new URLSearchParams()

      if (startDate) params.set('startDate', startDate)
      if (endDate) params.set('endDate', endDate)
      params.set('limit', limit.toString())
      params.set('offset', offset.toString())

      const response = await fetch(`/api/expenses?${params.toString()}`)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
      }

      return response.json()
    },
    enabled,
    staleTime: 5 * 60 * 1000, // 5분간 캐시 유지
    refetchOnWindowFocus: false,
    retry: (failureCount, error) => {
      // 401 에러(인증 오류)는 재시도하지 않음
      if (error instanceof Error && error.message.includes('401')) {
        return false
      }
      return failureCount < 3
    }
  })
}

// 특정 기간의 expenses 조회
export function useExpensesByDateRange(startDate: string, endDate: string) {
  return useExpenses({
    startDate,
    endDate,
    enabled: Boolean(startDate && endDate)
  })
}

// 최근 expenses 조회 (기본적으로 최근 30일)
export function useRecentExpenses(days: number = 30) {
  const endDate = new Date().toISOString().split('T')[0]
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0]

  return useExpenses({
    startDate,
    endDate
  })
}

// 무한 스크롤을 위한 expenses 조회
export function useInfiniteExpenses({
  startDate,
  endDate,
  limit = 50
}: {
  startDate?: string
  endDate?: string
  limit?: number
} = {}) {
  const { useInfiniteQuery } = require('@tanstack/react-query')

  return useInfiniteQuery<ExpensesResponse>({
    queryKey: ['expenses', 'infinite', { startDate, endDate, limit }],
    queryFn: async ({ pageParam = 0 }) => {
      const params = new URLSearchParams()

      if (startDate) params.set('startDate', startDate)
      if (endDate) params.set('endDate', endDate)
      params.set('limit', limit.toString())
      params.set('offset', (pageParam * limit).toString())

      const response = await fetch(`/api/expenses?${params.toString()}`)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
      }

      return response.json()
    },
    getNextPageParam: (lastPage) => {
      if (lastPage.pagination.hasMore) {
        return Math.floor(lastPage.pagination.offset / limit) + 1
      }
      return undefined
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false
  })
}