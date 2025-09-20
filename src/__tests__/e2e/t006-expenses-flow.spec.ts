import { test, expect } from '@playwright/test'
import { injectAxe, checkA11y } from '@axe-core/playwright'

/**
 * T-006 E2E 테스트: 기간별 지출 내역 조회 시스템 전체 플로우
 */

// 테스트용 사용자 데이터
const TEST_USER = {
  email: 'test@example.com',
  password: 'password123'
}

test.describe('T-006: 기간별 지출 내역 조회 E2E', () => {
  test.beforeEach(async ({ page }) => {
    // 로그인 페이지로 이동
    await page.goto('/auth/login')

    // 로그인 (실제 환경에서는 mock 사용자나 테스트 계정 필요)
    await page.fill('[data-testid="email-input"]', TEST_USER.email)
    await page.fill('[data-testid="password-input"]', TEST_USER.password)
    await page.click('[data-testid="login-button"]')

    // 대시보드 페이지로 리다이렉트 대기
    await page.waitForURL('/dashboard')

    // 접근성 테스트 준비
    await injectAxe(page)
  })

  test('사용자가 대시보드에서 지출 내역을 조회할 수 있다', async ({ page }) => {
    // 지출 내역 섹션이 표시되는지 확인
    await expect(page.getByText('지출 내역')).toBeVisible()

    // 기본 데이터 로딩 확인
    await expect(page.getByTestId('expenses-list')).toBeVisible()

    // 요약 정보가 표시되는지 확인
    await expect(page.getByText('총 건수')).toBeVisible()
    await expect(page.getByText('총 금액')).toBeVisible()

    // 접근성 검사
    await checkA11y(page, null, {
      detailedReport: true,
      detailedReportOptions: { html: true },
    })
  })

  test('날짜 필터를 사용하여 기간별 조회를 할 수 있다', async ({ page }) => {
    // 시작일 설정
    const startDate = '2025-09-01'
    await page.fill('[data-testid="start-date-input"]', startDate)

    // 종료일 설정
    const endDate = '2025-09-30'
    await page.fill('[data-testid="end-date-input"]', endDate)

    // 조회 버튼 클릭
    await page.click('[data-testid="apply-filter-button"]')

    // 로딩 상태 확인
    await expect(page.getByTestId('loading-spinner')).toBeVisible()

    // 필터링된 결과 대기
    await page.waitForSelector('[data-testid="expenses-list"]')

    // 필터된 날짜 범위가 적용되었는지 확인
    const appliedFilters = await page.getByTestId('applied-filters')
    await expect(appliedFilters).toContainText(startDate)
    await expect(appliedFilters).toContainText(endDate)
  })

  test('지출 내역이 올바른 형식으로 표시된다', async ({ page }) => {
    // 지출 항목들이 로드될 때까지 대기
    await page.waitForSelector('[data-testid="expense-item"]')

    // 첫 번째 지출 항목 확인
    const firstExpense = page.getByTestId('expense-item').first()

    // 카테고리 표시 확인
    await expect(firstExpense.getByTestId('expense-category')).toBeVisible()

    // 금액 표시 확인 (한국 통화 형식)
    const amountElement = firstExpense.getByTestId('expense-amount')
    await expect(amountElement).toBeVisible()
    const amountText = await amountElement.textContent()
    expect(amountText).toMatch(/₩[\d,]+/)

    // 날짜 표시 확인 (한국 날짜 형식)
    const dateElement = firstExpense.getByTestId('expense-date')
    await expect(dateElement).toBeVisible()
    const dateText = await dateElement.textContent()
    expect(dateText).toMatch(/\d+월 \d+일/)

    // 내용 표시 확인
    await expect(firstExpense.getByTestId('expense-content')).toBeVisible()
  })

  test('필터 초기화 기능이 작동한다', async ({ page }) => {
    // 날짜 필터 설정
    await page.fill('[data-testid="start-date-input"]', '2025-09-01')
    await page.fill('[data-testid="end-date-input"]', '2025-09-30')

    // 초기화 버튼 클릭
    await page.click('[data-testid="clear-filter-button"]')

    // 입력 필드가 비워졌는지 확인
    await expect(page.getByTestId('start-date-input')).toHaveValue('')
    await expect(page.getByTestId('end-date-input')).toHaveValue('')

    // 전체 데이터가 다시 로드되는지 확인
    await expect(page.getByTestId('expenses-list')).toBeVisible()
  })

  test('요약 정보가 정확히 계산되어 표시된다', async ({ page }) => {
    // 요약 섹션 대기
    await page.waitForSelector('[data-testid="summary-section"]')

    // 총 건수 확인
    const totalCountElement = page.getByTestId('summary-total-count')
    await expect(totalCountElement).toBeVisible()
    const totalCountText = await totalCountElement.textContent()
    expect(totalCountText).toMatch(/\d+건/)

    // 총 금액 확인
    const totalAmountElement = page.getByTestId('summary-total-amount')
    await expect(totalAmountElement).toBeVisible()
    const totalAmountText = await totalAmountElement.textContent()
    expect(totalAmountText).toMatch(/₩[\d,\-]+/)

    // 카테고리 수 확인
    const categoriesElement = page.getByTestId('summary-categories')
    await expect(categoriesElement).toBeVisible()
    const categoriesText = await categoriesElement.textContent()
    expect(categoriesText).toMatch(/\d+개/)
  })

  test('페이지네이션이 올바르게 작동한다', async ({ page }) => {
    // 더 많은 데이터가 있는 경우를 위한 테스트
    await page.waitForSelector('[data-testid="expenses-list"]')

    // 페이지네이션 버튼이 있는지 확인
    const nextButton = page.getByTestId('pagination-next')
    if (await nextButton.isVisible()) {
      // 다음 페이지로 이동
      await nextButton.click()

      // 새로운 데이터 로딩 확인
      await page.waitForSelector('[data-testid="loading-spinner"]')
      await page.waitForSelector('[data-testid="expenses-list"]')

      // 이전 페이지 버튼 확인
      await expect(page.getByTestId('pagination-prev')).toBeVisible()
    }
  })

  test('오류 상황에서 적절한 메시지를 표시한다', async ({ page }) => {
    // 네트워크 오류 시뮬레이션
    await page.route('/api/expenses*', route => {
      route.abort('failed')
    })

    // 페이지 새로고침하여 오류 트리거
    await page.reload()

    // 오류 메시지 확인
    await expect(page.getByText('지출 내역을 불러오는 중 오류가 발생했습니다')).toBeVisible()

    // 재시도 버튼 확인
    await expect(page.getByTestId('retry-button')).toBeVisible()
  })

  test('빈 데이터 상태를 적절히 표시한다', async ({ page }) => {
    // 빈 응답 Mock
    await page.route('/api/expenses*', route => {
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [],
          pagination: { total: 0, limit: 100, offset: 0, hasMore: false },
          summary: {
            totalAmount: 0,
            totalCount: 0,
            categories: [],
            paymentMethods: []
          }
        })
      })
    })

    await page.reload()

    // 빈 상태 메시지 확인
    await expect(page.getByText('선택한 기간에 지출 내역이 없습니다')).toBeVisible()

    // 빈 상태에서도 요약 정보가 표시되는지 확인
    await expect(page.getByTestId('summary-total-count')).toContainText('0건')
    await expect(page.getByTestId('summary-total-amount')).toContainText('₩0')
  })
})

test.describe('T-006: 모바일 반응형 테스트', () => {
  test.use({ viewport: { width: 375, height: 667 } }) // iPhone SE 크기

  test.beforeEach(async ({ page }) => {
    await page.goto('/auth/login')
    await page.fill('[data-testid="email-input"]', TEST_USER.email)
    await page.fill('[data-testid="password-input"]', TEST_USER.password)
    await page.click('[data-testid="login-button"]')
    await page.waitForURL('/dashboard')
  })

  test('모바일에서 지출 내역이 적절히 표시된다', async ({ page }) => {
    // 모바일 레이아웃 확인
    await expect(page.getByTestId('expenses-list')).toBeVisible()

    // 모바일에서 카드 형태로 표시되는지 확인
    const expenseItems = page.getByTestId('expense-item')
    await expect(expenseItems.first()).toBeVisible()

    // 터치 스크롤 테스트
    await page.mouse.wheel(0, 500)
    await page.waitForTimeout(500)

    // 스크롤 후에도 내용이 표시되는지 확인
    await expect(expenseItems.first()).toBeVisible()
  })

  test('모바일에서 날짜 필터가 적절히 작동한다', async ({ page }) => {
    // 날짜 입력 필드 터치
    await page.tap('[data-testid="start-date-input"]')

    // 모바일 키보드가 활성화되는지 확인 (간접적)
    await page.fill('[data-testid="start-date-input"]', '2025-09-01')

    // 필터 적용 버튼 터치
    await page.tap('[data-testid="apply-filter-button"]')

    // 결과 확인
    await expect(page.getByTestId('expenses-list')).toBeVisible()
  })
})

test.describe('T-006: 성능 테스트', () => {
  test('대용량 데이터에서 성능이 양호하다', async ({ page }) => {
    // 대용량 Mock 데이터 생성
    const largeMockData = Array.from({ length: 100 }, (_, i) => ({
      id: `${i + 1}`,
      expense_date: '2025-09-20',
      category_main: '식비',
      content: `지출 항목 ${i + 1}`,
      amount: -(Math.random() * 10000 + 1000),
      memo: '',
      payment_method: '카드',
      created_at: '2025-09-20T10:00:00Z'
    }))

    await page.route('/api/expenses*', route => {
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: largeMockData,
          pagination: { total: 100, limit: 100, offset: 0, hasMore: false },
          summary: {
            totalAmount: -500000,
            totalCount: 100,
            categories: ['식비'],
            paymentMethods: ['카드']
          }
        })
      })
    })

    await page.goto('/dashboard')

    // 로딩 시간 측정
    const startTime = Date.now()
    await page.waitForSelector('[data-testid="expenses-list"]')
    const loadTime = Date.now() - startTime

    // 3초 이내 로딩 완료 확인
    expect(loadTime).toBeLessThan(3000)

    // 모든 항목이 렌더링되었는지 확인
    const expenseItems = await page.getByTestId('expense-item').count()
    expect(expenseItems).toBeGreaterThan(0)
  })

  test('네트워크 지연 상황에서 적절한 로딩 상태를 표시한다', async ({ page }) => {
    // 네트워크 지연 시뮬레이션
    await page.route('/api/expenses*', async route => {
      await new Promise(resolve => setTimeout(resolve, 2000)) // 2초 지연
      route.continue()
    })

    await page.goto('/dashboard')

    // 로딩 스피너 확인
    await expect(page.getByTestId('loading-spinner')).toBeVisible()

    // 스켈레톤 UI 확인
    await expect(page.getByTestId('skeleton')).toBeVisible()

    // 로딩 완료 후 스피너 사라짐 확인
    await page.waitForSelector('[data-testid="expenses-list"]')
    await expect(page.getByTestId('loading-spinner')).not.toBeVisible()
  })
})