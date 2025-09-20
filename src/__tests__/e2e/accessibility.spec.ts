import { test, expect } from '@playwright/test'
import { injectAxe, checkA11y, getViolations } from '@axe-core/playwright'

/**
 * 접근성 테스트 스위트
 * WCAG 2.1 AA 준수 확인
 */

const TEST_USER = {
  email: 'test@example.com',
  password: 'password123'
}

test.describe('접근성 테스트', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth/login')
    await page.fill('[data-testid="email-input"]', TEST_USER.email)
    await page.fill('[data-testid="password-input"]', TEST_USER.password)
    await page.click('[data-testid="login-button"]')
    await page.waitForURL('/dashboard')

    // axe-core 주입
    await injectAxe(page)
  })

  test('대시보드 페이지가 접근성 가이드라인을 준수한다', async ({ page }) => {
    // 전체 페이지 접근성 검사
    await checkA11y(page, null, {
      detailedReport: true,
      detailedReportOptions: { html: true },
      rules: {
        // 특정 규칙 활성화/비활성화 가능
        'color-contrast': { enabled: true },
        'keyboard-navigation': { enabled: true },
        'aria-labels': { enabled: true }
      }
    })

    // 위반 사항이 있다면 자세한 정보 출력
    const violations = await getViolations(page)
    if (violations.length > 0) {
      console.log('접근성 위반 사항:', violations)
    }
    expect(violations).toHaveLength(0)
  })

  test('키보드 네비게이션이 올바르게 작동한다', async ({ page }) => {
    // Tab 키로 순차적 탐색
    await page.keyboard.press('Tab')
    const focusedElement = await page.evaluate(() => document.activeElement?.getAttribute('data-testid'))

    // 첫 번째 포커스 가능한 요소 확인
    expect(focusedElement).toBeTruthy()

    // 여러 번 Tab 키 눌러서 모든 인터랙티브 요소 탐색
    const tabStops = []
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Tab')
      const testId = await page.evaluate(() => document.activeElement?.getAttribute('data-testid'))
      if (testId) {
        tabStops.push(testId)
      }
    }

    // 충분한 수의 탭 정지점이 있는지 확인
    expect(tabStops.length).toBeGreaterThan(3)

    // Enter 키로 버튼 활성화 테스트
    await page.focus('[data-testid="apply-filter-button"]')
    await page.keyboard.press('Enter')

    // 버튼이 실제로 작동했는지 확인
    await expect(page.getByTestId('expenses-list')).toBeVisible()
  })

  test('스크린 리더를 위한 ARIA 라벨이 적절히 설정되어 있다', async ({ page }) => {
    // 중요한 섹션들의 ARIA 라벨 확인
    const expensesList = page.getByTestId('expenses-list')
    await expect(expensesList).toHaveAttribute('role', 'main')

    const summarySection = page.getByTestId('summary-section')
    await expect(summarySection).toHaveAttribute('aria-label')

    // 필터 입력 필드들의 라벨 확인
    const startDateInput = page.getByTestId('start-date-input')
    await expect(startDateInput).toHaveAttribute('aria-label')

    const endDateInput = page.getByTestId('end-date-input')
    await expect(endDateInput).toHaveAttribute('aria-label')

    // 버튼들의 접근 가능한 이름 확인
    const applyButton = page.getByTestId('apply-filter-button')
    const buttonText = await applyButton.textContent()
    expect(buttonText?.trim()).toBeTruthy()
  })

  test('색상 대비가 충분하다', async ({ page }) => {
    // axe-core의 색상 대비 규칙 실행
    await checkA11y(page, null, {
      rules: {
        'color-contrast': { enabled: true }
      }
    })

    // 중요한 텍스트 요소들의 색상 대비 수동 확인
    const expenseItems = await page.getByTestId('expense-item').all()
    for (const item of expenseItems.slice(0, 3)) { // 처음 3개만 검사
      await expect(item).toBeVisible()

      // 텍스트가 읽기 가능한지 확인
      const amount = item.getByTestId('expense-amount')
      await expect(amount).toBeVisible()
    }
  })

  test('포커스 표시가 명확하다', async ({ page }) => {
    const interactiveElements = [
      '[data-testid="start-date-input"]',
      '[data-testid="end-date-input"]',
      '[data-testid="apply-filter-button"]',
      '[data-testid="clear-filter-button"]'
    ]

    for (const selector of interactiveElements) {
      // 요소에 포커스
      await page.focus(selector)

      // 포커스 스타일 확인 (outline 또는 box-shadow 존재)
      const element = page.locator(selector)
      const styles = await element.evaluate(el => {
        const computed = window.getComputedStyle(el)
        return {
          outline: computed.outline,
          outlineWidth: computed.outlineWidth,
          boxShadow: computed.boxShadow
        }
      })

      // 포커스 표시가 있는지 확인
      const hasFocusIndicator =
        styles.outline !== 'none' ||
        styles.outlineWidth !== '0px' ||
        styles.boxShadow !== 'none'

      expect(hasFocusIndicator).toBeTruthy()
    }
  })

  test('에러 메시지가 접근 가능하다', async ({ page }) => {
    // 네트워크 오류 시뮬레이션
    await page.route('/api/expenses*', route => {
      route.abort('failed')
    })

    await page.reload()

    // 에러 메시지가 ARIA live region으로 설정되어 있는지 확인
    const errorMessage = page.getByRole('alert')
    await expect(errorMessage).toBeVisible()

    // 에러 메시지가 스크린 리더에게 알려지는지 확인
    await expect(errorMessage).toHaveAttribute('aria-live')
  })

  test('모달/다이얼로그가 접근성 가이드라인을 준수한다', async ({ page }) => {
    // 모달이 있다면 (예: 필터 설정 모달)
    const modalTrigger = page.getByTestId('modal-trigger')
    if (await modalTrigger.isVisible()) {
      await modalTrigger.click()

      // 모달의 접근성 확인
      const modal = page.getByRole('dialog')
      await expect(modal).toBeVisible()
      await expect(modal).toHaveAttribute('aria-modal', 'true')

      // 포커스가 모달 내부로 이동했는지 확인
      const focusedElement = await page.evaluate(() => document.activeElement)
      const modalElement = await modal.elementHandle()
      const isInModal = await page.evaluate(
        ([modal, focused]) => modal?.contains(focused),
        [modalElement, focusedElement]
      )
      expect(isInModal).toBeTruthy()

      // ESC 키로 모달 닫기
      await page.keyboard.press('Escape')
      await expect(modal).not.toBeVisible()
    }
  })

  test('동적 콘텐츠 업데이트가 접근 가능하다', async ({ page }) => {
    // 필터 적용으로 콘텐츠 업데이트
    await page.fill('[data-testid="start-date-input"]', '2025-09-01')
    await page.fill('[data-testid="end-date-input"]', '2025-09-30')
    await page.click('[data-testid="apply-filter-button"]')

    // 로딩 상태가 접근 가능한지 확인
    const loadingIndicator = page.getByTestId('loading-spinner')
    if (await loadingIndicator.isVisible()) {
      await expect(loadingIndicator).toHaveAttribute('aria-label')
    }

    // 업데이트된 콘텐츠가 알려지는지 확인
    await page.waitForSelector('[data-testid="expenses-list"]')

    // 상태 변경이 live region으로 알려지는지 확인
    const statusMessage = page.getByRole('status')
    if (await statusMessage.isVisible()) {
      await expect(statusMessage).toHaveAttribute('aria-live')
    }
  })
})

test.describe('다크 모드 접근성 테스트', () => {
  test.beforeEach(async ({ page }) => {
    // 다크 모드 설정
    await page.emulateMedia({ colorScheme: 'dark' })

    await page.goto('/auth/login')
    await page.fill('[data-testid="email-input"]', TEST_USER.email)
    await page.fill('[data-testid="password-input"]', TEST_USER.password)
    await page.click('[data-testid="login-button"]')
    await page.waitForURL('/dashboard')

    await injectAxe(page)
  })

  test('다크 모드에서 색상 대비가 충분하다', async ({ page }) => {
    await checkA11y(page, null, {
      rules: {
        'color-contrast': { enabled: true }
      }
    })

    // 다크 모드 특정 요소들 확인
    const expenseItems = await page.getByTestId('expense-item').all()
    for (const item of expenseItems.slice(0, 2)) {
      await expect(item).toBeVisible()
    }
  })
})