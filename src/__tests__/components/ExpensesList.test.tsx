/**
 * ExpensesList 컴포넌트 통합 테스트
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ExpensesList } from '@/components/expenses/ExpensesList'

// fetch mock
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
    limit: 50,
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

const createTestQueryClient = () => {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        cacheTime: 0,
        staleTime: 0
      }
    }
  })
}

const renderWithQueryClient = (component: React.ReactElement) => {
  const queryClient = createTestQueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      {component}
    </QueryClientProvider>
  )
}

describe('ExpensesList Component', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockExpensesResponse
    })
  })

  describe('기본 렌더링', () => {
    test('컴포넌트가 올바르게 렌더링된다', async () => {
      renderWithQueryClient(<ExpensesList />)

      // 필터 섹션 확인
      expect(screen.getByText('기간 필터')).toBeInTheDocument()
      expect(screen.getByLabelText('시작일')).toBeInTheDocument()
      expect(screen.getByLabelText('종료일')).toBeInTheDocument()

      // 데이터 로딩 후 확인
      await waitFor(() => {
        expect(screen.getByText('요약 정보')).toBeInTheDocument()
        expect(screen.getByText('지출 내역')).toBeInTheDocument()
      })
    })

    test('초기 날짜 값이 올바르게 설정된다', () => {
      const initialStartDate = '2025-09-01'
      const initialEndDate = '2025-09-30'

      renderWithQueryClient(
        <ExpensesList
          initialStartDate={initialStartDate}
          initialEndDate={initialEndDate}
        />
      )

      const startDateInput = screen.getByLabelText('시작일') as HTMLInputElement
      const endDateInput = screen.getByLabelText('종료일') as HTMLInputElement

      expect(startDateInput.value).toBe(initialStartDate)
      expect(endDateInput.value).toBe(initialEndDate)
    })

    test('showDateFilter가 false일 때 필터가 숨겨진다', () => {
      renderWithQueryClient(<ExpensesList showDateFilter={false} />)

      expect(screen.queryByText('기간 필터')).not.toBeInTheDocument()
    })
  })

  describe('데이터 로딩 및 표시', () => {
    test('로딩 상태를 올바르게 표시한다', () => {
      renderWithQueryClient(<ExpensesList />)

      // 로딩 스켈레톤 확인
      const skeletons = screen.getAllByTestId('skeleton')
      expect(skeletons.length).toBeGreaterThan(0)
    })

    test('지출 데이터를 올바르게 표시한다', async () => {
      renderWithQueryClient(<ExpensesList />)

      await waitFor(() => {
        expect(screen.getByText('아침 식사')).toBeInTheDocument()
        expect(screen.getByText('버스비')).toBeInTheDocument()
        expect(screen.getByText('식비')).toBeInTheDocument()
        expect(screen.getByText('교통비')).toBeInTheDocument()
      })

      // 금액 표시 확인
      expect(screen.getByText('₩-5,000')).toBeInTheDocument()
      expect(screen.getByText('₩-1,500')).toBeInTheDocument()
    })

    test('요약 정보를 올바르게 표시한다', async () => {
      renderWithQueryClient(<ExpensesList />)

      await waitFor(() => {
        expect(screen.getByText('2건')).toBeInTheDocument()
        expect(screen.getByText('₩-6,500')).toBeInTheDocument()
        expect(screen.getByText('2개')).toBeInTheDocument() // 카테고리 수
      })
    })

    test('빈 데이터에 대해 적절한 메시지를 표시한다', async () => {
      ;(fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          ...mockExpensesResponse,
          data: [],
          pagination: { ...mockExpensesResponse.pagination, total: 0 },
          summary: {
            ...mockExpensesResponse.summary,
            totalAmount: 0,
            totalCount: 0,
            categories: [],
            paymentMethods: []
          }
        })
      })

      renderWithQueryClient(<ExpensesList />)

      await waitFor(() => {
        expect(screen.getByText('선택한 기간에 지출 내역이 없습니다.')).toBeInTheDocument()
      })
    })
  })

  describe('필터링 기능', () => {
    test('날짜 필터를 적용할 수 있다', async () => {
      const user = userEvent.setup()

      renderWithQueryClient(<ExpensesList />)

      const startDateInput = screen.getByLabelText('시작일')
      const endDateInput = screen.getByLabelText('종료일')
      const applyButton = screen.getByText('조회')

      // 날짜 입력
      await user.clear(startDateInput)
      await user.type(startDateInput, '2025-09-20')

      await user.clear(endDateInput)
      await user.type(endDateInput, '2025-09-20')

      // 조회 버튼 클릭
      await user.click(applyButton)

      // API 호출 확인
      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining('startDate=2025-09-20&endDate=2025-09-20')
        )
      })
    })

    test('필터를 초기화할 수 있다', async () => {
      const user = userEvent.setup()

      renderWithQueryClient(
        <ExpensesList
          initialStartDate="2025-09-01"
          initialEndDate="2025-09-30"
        />
      )

      const clearButton = screen.getByText('초기화')

      await user.click(clearButton)

      const startDateInput = screen.getByLabelText('시작일') as HTMLInputElement
      const endDateInput = screen.getByLabelText('종료일') as HTMLInputElement

      expect(startDateInput.value).toBe('')
      expect(endDateInput.value).toBe('')
    })
  })

  describe('오류 처리', () => {
    test('API 오류 시 오류 메시지를 표시한다', async () => {
      ;(fetch as jest.Mock).mockRejectedValue(new Error('Network error'))

      renderWithQueryClient(<ExpensesList />)

      await waitFor(() => {
        expect(screen.getByText(/지출 내역을 불러오는 중 오류가 발생했습니다/)).toBeInTheDocument()
        expect(screen.getByText('다시 시도')).toBeInTheDocument()
      })
    })

    test('401 오류 시 적절한 메시지를 표시한다', async () => {
      ;(fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ error: '인증이 필요합니다.' })
      })

      renderWithQueryClient(<ExpensesList />)

      await waitFor(() => {
        expect(screen.getByText(/인증이 필요합니다/)).toBeInTheDocument()
      })
    })

    test('다시 시도 버튼이 작동한다', async () => {
      const user = userEvent.setup()

      ;(fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'))

      renderWithQueryClient(<ExpensesList />)

      await waitFor(() => {
        expect(screen.getByText('다시 시도')).toBeInTheDocument()
      })

      // 성공 응답으로 변경
      ;(fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockExpensesResponse
      })

      const retryButton = screen.getByText('다시 시도')
      await user.click(retryButton)

      await waitFor(() => {
        expect(screen.getByText('아침 식사')).toBeInTheDocument()
      })
    })
  })

  describe('통화 형식 및 날짜 형식', () => {
    test('금액이 올바른 통화 형식으로 표시된다', async () => {
      renderWithQueryClient(<ExpensesList />)

      await waitFor(() => {
        // 한국 원화 형식 확인
        expect(screen.getByText('₩-5,000')).toBeInTheDocument()
        expect(screen.getByText('₩-1,500')).toBeInTheDocument()
      })
    })

    test('날짜가 올바른 형식으로 표시된다', async () => {
      renderWithQueryClient(<ExpensesList />)

      await waitFor(() => {
        // 한국 날짜 형식 확인 (월 일)
        expect(screen.getByText('9월 20일')).toBeInTheDocument()
        expect(screen.getByText('9월 19일')).toBeInTheDocument()
      })
    })

    test('음수 금액은 빨간색으로, 양수는 녹색으로 표시된다', async () => {
      // 양수 금액 포함 데이터
      ;(fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          ...mockExpensesResponse,
          data: [
            ...mockExpensesResponse.data,
            {
              id: '3',
              expense_date: '2025-09-20',
              category_main: '수입',
              content: '용돈',
              amount: 10000,
              memo: '',
              payment_method: '현금',
              created_at: '2025-09-20T12:00:00Z'
            }
          ]
        })
      })

      renderWithQueryClient(<ExpensesList />)

      await waitFor(() => {
        const negativeAmount = screen.getByText('₩-5,000')
        const positiveAmount = screen.getByText('₩10,000')

        expect(negativeAmount).toHaveClass('text-red-600')
        expect(positiveAmount).toHaveClass('text-green-600')
      })
    })
  })

  describe('성능 및 캐싱', () => {
    test('동일한 쿼리에 대해 캐시를 사용한다', async () => {
      const queryClient = createTestQueryClient()

      const { rerender } = render(
        <QueryClientProvider client={queryClient}>
          <ExpensesList initialStartDate="2025-09-01" />
        </QueryClientProvider>
      )

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledTimes(1)
      })

      // 동일한 props로 재렌더링
      rerender(
        <QueryClientProvider client={queryClient}>
          <ExpensesList initialStartDate="2025-09-01" />
        </QueryClientProvider>
      )

      // 캐시 사용으로 추가 API 호출 없음
      expect(fetch).toHaveBeenCalledTimes(1)
    })
  })
})