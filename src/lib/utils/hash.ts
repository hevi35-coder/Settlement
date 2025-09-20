import { createHash } from 'crypto'

/**
 * 지출 데이터의 고유 해시를 생성합니다.
 * 날짜, 내용, 금액을 기반으로 SHA256 해시를 생성하여 중복을 방지합니다.
 *
 * @param date - 지출 날짜 (YYYY-MM-DD 형식)
 * @param content - 지출 내용
 * @param amount - 지출 금액
 * @returns SHA256 해시 문자열
 */
export function generateUniqueHash(date: string, content: string, amount: number): string {
  // 입력값 검증
  if (!date || !content || !content.trim() || typeof amount !== 'number' || isNaN(amount)) {
    throw new Error('Invalid input: date, content, and amount are required')
  }

  // 금액을 소수점 2자리로 정규화 (부동소수점 오차 방지)
  const normalizedAmount = Math.round(amount * 100) / 100

  // 해시 생성을 위한 문자열 조합
  const hashInput = `${date}|${content.trim()}|${normalizedAmount}`

  // SHA256 해시 생성
  const hash = createHash('sha256')
    .update(hashInput, 'utf8')
    .digest('hex')

  return hash
}

/**
 * 지출 데이터 객체에서 고유 해시를 생성합니다.
 *
 * @param expenseData - 지출 데이터 객체
 * @returns SHA256 해시 문자열
 */
export function generateExpenseHash(expenseData: {
  date: string
  content: string
  amount: number
}): string {
  return generateUniqueHash(expenseData.date, expenseData.content, expenseData.amount)
}

/**
 * 여러 지출 데이터에 대해 고유 해시를 일괄 생성합니다.
 *
 * @param expensesData - 지출 데이터 배열
 * @returns 해시가 추가된 지출 데이터 배열
 */
export function addHashesToExpenses<T extends { date: string; content: string; amount: number }>(
  expensesData: T[]
): (T & { unique_hash: string })[] {
  return expensesData.map(expense => ({
    ...expense,
    unique_hash: generateExpenseHash(expense)
  }))
}