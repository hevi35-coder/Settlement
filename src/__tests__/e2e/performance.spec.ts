import { test, expect } from '@playwright/test'

/**
 * 성능 테스트 스위트
 * T-006 관련 성능 요구사항 검증
 */

const TEST_USER = {
  email: 'test@example.com',
  password: 'password123'
}

test.describe('성능 테스트', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth/login')
    await page.fill('[data-testid="email-input"]', TEST_USER.email)
    await page.fill('[data-testid="password-input"]', TEST_USER.password)
    await page.click('[data-testid="login-button"]')
    await page.waitForURL('/dashboard')
  })

  test('초기 페이지 로딩 성능이 양호하다', async ({ page }) => {
    const startTime = Date.now()

    // 페이지 재로드하여 초기 로딩 측정
    await page.reload()

    // 주요 콘텐츠가 로드될 때까지 대기
    await page.waitForSelector('[data-testid="expenses-list"]', { timeout: 5000 })

    const loadTime = Date.now() - startTime

    // 초기 로딩은 5초 이내 완료되어야 함
    expect(loadTime).toBeLessThan(5000)

    console.log(`초기 페이지 로딩 시간: ${loadTime}ms`)
  })

  test('대용량 데이터 렌더링 성능', async ({ page }) => {
    // 대용량 데이터 Mock (500개 항목)
    const largeMockData = Array.from({ length: 500 }, (_, i) => ({
      id: `${i + 1}`,
      expense_date: '2025-09-20',
      category_main: `카테고리${i % 10}`,
      content: `지출 항목 ${i + 1}`,
      amount: -(Math.random() * 50000 + 1000),
      memo: `메모 ${i + 1}`,
      payment_method: i % 3 === 0 ? '카드' : i % 3 === 1 ? '현금' : '교통카드',
      created_at: '2025-09-20T10:00:00Z'
    }))

    await page.route('/api/expenses*', route => {
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: largeMockData.slice(0, 100), // 첫 페이지 100개
          pagination: {
            total: 500,
            limit: 100,
            offset: 0,
            hasMore: true
          },
          summary: {
            totalAmount: -25000000,
            totalCount: 500,
            categories: Array.from(new Set(largeMockData.map(item => item.category_main))),
            paymentMethods: ['카드', '현금', '교통카드']
          }
        })
      })
    })

    const startTime = Date.now()
    await page.reload()

    // 모든 항목이 렌더링될 때까지 대기
    await page.waitForSelector('[data-testid="expenses-list"]')
    await page.waitForFunction(() => {
      const items = document.querySelectorAll('[data-testid="expense-item"]')
      return items.length >= 50 // 최소 50개 항목 렌더링 확인
    })

    const renderTime = Date.now() - startTime

    // 대용량 데이터 렌더링은 3초 이내 완료되어야 함
    expect(renderTime).toBeLessThan(3000)

    console.log(`대용량 데이터 렌더링 시간: ${renderTime}ms`)

    // 스크롤 성능 테스트
    const scrollStartTime = Date.now()

    // 빠른 스크롤
    for (let i = 0; i < 10; i++) {
      await page.mouse.wheel(0, 500)
      await page.waitForTimeout(50)
    }

    const scrollTime = Date.now() - scrollStartTime

    // 스크롤 응답성 확인 (1초 이내)
    expect(scrollTime).toBeLessThan(1000)

    console.log(`스크롤 성능: ${scrollTime}ms`)
  })

  test('API 응답 시간 성능', async ({ page }) => {
    const apiResponseTimes: number[] = []

    // API 호출 시간 측정
    page.on('response', async response => {
      if (response.url().includes('/api/expenses')) {
        const timing = response.timing()
        apiResponseTimes.push(timing.responseEnd)
        console.log(`API 응답 시간: ${timing.responseEnd}ms`)
      }
    })

    // 여러 번의 필터링 요청으로 API 성능 측정
    const filters = [
      { start: '2025-09-01', end: '2025-09-07' },
      { start: '2025-09-08', end: '2025-09-14' },
      { start: '2025-09-15', end: '2025-09-21' }
    ]

    for (const filter of filters) {
      await page.fill('[data-testid="start-date-input"]', filter.start)
      await page.fill('[data-testid="end-date-input"]', filter.end)
      await page.click('[data-testid="apply-filter-button"]')

      await page.waitForSelector('[data-testid="expenses-list"]')
      await page.waitForTimeout(500) // 응답 완료 대기
    }

    // 평균 API 응답 시간 확인
    const avgResponseTime = apiResponseTimes.reduce((a, b) => a + b, 0) / apiResponseTimes.length

    // 평균 API 응답은 1초 이내여야 함
    expect(avgResponseTime).toBeLessThan(1000)

    console.log(`평균 API 응답 시간: ${avgResponseTime}ms`)
  })

  test('메모리 사용량이 적절하다', async ({ page }) => {
    // Performance API 활성화
    await page.addInitScript(() => {
      (window as any).performanceMetrics = []
    })

    // 초기 메모리 측정
    const initialMemory = await page.evaluate(() => {
      if ((performance as any).memory) {
        return (performance as any).memory.usedJSHeapSize
      }
      return 0
    })

    // 대용량 데이터 로딩
    const largeMockData = Array.from({ length: 1000 }, (_, i) => ({
      id: `${i + 1}`,
      expense_date: '2025-09-20',
      category_main: `카테고리${i % 20}`,
      content: `지출 항목 ${i + 1}`,
      amount: -(Math.random() * 100000 + 1000),
      memo: `메모 내용이 길어질 수 있는 경우를 대비한 테스트 데이터 ${i + 1}`,
      payment_method: ['카드', '현금', '교통카드', '계좌이체'][i % 4],
      created_at: '2025-09-20T10:00:00Z'
    }))

    await page.route('/api/expenses*', route => {
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: largeMockData.slice(0, 200),
          pagination: { total: 1000, limit: 200, offset: 0, hasMore: true },
          summary: {
            totalAmount: -50000000,
            totalCount: 1000,
            categories: Array.from(new Set(largeMockData.map(item => item.category_main))),
            paymentMethods: ['카드', '현금', '교통카드', '계좌이체']
          }
        })
      })
    })

    await page.reload()
    await page.waitForSelector('[data-testid="expenses-list"]')

    // 로딩 후 메모리 측정
    const afterLoadMemory = await page.evaluate(() => {
      if ((performance as any).memory) {
        return (performance as any).memory.usedJSHeapSize
      }
      return 0
    })

    if (initialMemory > 0 && afterLoadMemory > 0) {
      const memoryIncrease = afterLoadMemory - initialMemory
      const memoryIncreaseMB = memoryIncrease / (1024 * 1024)

      console.log(`메모리 증가량: ${memoryIncreaseMB.toFixed(2)}MB`)

      // 메모리 증가량이 50MB 이하여야 함
      expect(memoryIncreaseMB).toBeLessThan(50)
    }
  })

  test('동시 요청 처리 성능', async ({ page, context }) => {
    // 여러 개의 페이지로 동시 요청 시뮬레이션
    const pages = await Promise.all([
      context.newPage(),
      context.newPage(),
      context.newPage()
    ])

    const startTime = Date.now()

    // 모든 페이지에서 동시에 로그인 및 데이터 로딩
    await Promise.all(pages.map(async (newPage) => {
      await newPage.goto('/auth/login')
      await newPage.fill('[data-testid="email-input"]', TEST_USER.email)
      await newPage.fill('[data-testid="password-input"]', TEST_USER.password)
      await newPage.click('[data-testid="login-button"]')
      await newPage.waitForURL('/dashboard')
      await newPage.waitForSelector('[data-testid="expenses-list"]')
    }))

    const totalTime = Date.now() - startTime

    // 동시 요청도 10초 이내 완료되어야 함
    expect(totalTime).toBeLessThan(10000)

    console.log(`동시 요청 처리 시간: ${totalTime}ms`)

    // 페이지 정리
    await Promise.all(pages.map(p => p.close()))
  })

  test('네트워크 지연 상황에서의 사용성', async ({ page }) => {
    // 네트워크 지연 시뮬레이션 (2초 지연)
    await page.route('/api/expenses*', async route => {
      await new Promise(resolve => setTimeout(resolve, 2000))
      route.continue()
    })

    const startTime = Date.now()

    // 필터 적용
    await page.fill('[data-testid="start-date-input"]', '2025-09-01')
    await page.fill('[data-testid="end-date-input"]', '2025-09-30')
    await page.click('[data-testid="apply-filter-button"]')

    // 로딩 상태가 즉시 표시되는지 확인
    const loadingAppeared = await page.waitForSelector('[data-testid="loading-spinner"]', { timeout: 500 })
    expect(loadingAppeared).toBeTruthy()

    const loadingStartTime = Date.now()

    // 최종 데이터 로딩 완료 대기
    await page.waitForSelector('[data-testid="expenses-list"]')

    const totalResponseTime = Date.now() - startTime
    const loadingToContentTime = Date.now() - loadingStartTime

    console.log(`총 응답 시간: ${totalResponseTime}ms`)
    console.log(`로딩 표시 후 콘텐츠 표시까지: ${loadingToContentTime}ms`)

    // 로딩 상태가 적절한 시간 내에 표시되었는지 확인
    expect(Date.now() - startTime).toBeGreaterThan(1900) // 지연 확인
  })

  test('CSS 및 이미지 리소스 로딩 성능', async ({ page }) => {
    const resourceMetrics: any[] = []

    // 리소스 로딩 모니터링
    page.on('response', response => {
      if (response.url().includes('.css') || response.url().includes('.png') || response.url().includes('.jpg')) {
        resourceMetrics.push({
          url: response.url(),
          status: response.status(),
          timing: response.timing()
        })
      }
    })

    await page.reload()
    await page.waitForSelector('[data-testid="expenses-list"]')

    // CSS 리소스가 적절한 시간 내에 로딩되었는지 확인
    const cssResources = resourceMetrics.filter(r => r.url.includes('.css'))
    for (const resource of cssResources) {
      expect(resource.timing.responseEnd).toBeLessThan(3000)
    }

    console.log(`CSS 리소스 수: ${cssResources.length}`)
  })
})