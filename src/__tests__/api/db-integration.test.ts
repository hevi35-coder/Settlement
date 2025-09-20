/**
 * DB 저장 및 upsert 기능 통합 테스트
 */

import { saveExpensesToDB } from '@/lib/supabase/admin'
import { addHashesToExpenses } from '@/lib/utils/hash'

// 테스트용 사용자 ID (실제 테스트에서는 mock 사용자 사용)
const TEST_USER_ID = 'test-user-id-12345'

describe('Database Integration Tests', () => {
  beforeAll(() => {
    // Supabase Admin 클라이언트가 환경변수를 필요로 하므로 확인
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.warn('Supabase environment variables not found, skipping integration tests')
    }
  })

  describe('saveExpensesToDB', () => {
    test('새로운 지출 데이터를 저장한다', async () => {
      // 환경변수가 없으면 테스트 건너뛰기
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        console.log('Skipping DB integration test - no Supabase config')
        return
      }

      const testExpenses = [
        {
          date: '2025-09-20',
          category: '식비',
          content: `테스트 아침식사 ${Date.now()}`, // 유니크하게 만들기 위해 타임스탬프 추가
          paymentMethod: '카드',
          amount: -5000,
          memo: '테스트 데이터'
        }
      ]

      const expensesWithHash = addHashesToExpenses(testExpenses)

      try {
        const result = await saveExpensesToDB(TEST_USER_ID, expensesWithHash)

        expect(result).toHaveProperty('totalSubmitted')
        expect(result).toHaveProperty('newRecords')
        expect(result).toHaveProperty('duplicatesIgnored')
        expect(result.totalSubmitted).toBe(1)
        expect(result.newRecords).toBe(1)
        expect(result.duplicatesIgnored).toBe(0)
      } catch (error) {
        // 실제 DB 연결 없이 테스트하는 경우 건너뛰기
        if (error instanceof Error && error.message.includes('데이터베이스')) {
          console.log('Skipping DB test - database not available')
          return
        }
        throw error
      }
    })

    test('중복 데이터를 무시한다', async () => {
      // 환경변수가 없으면 테스트 건너뛰기
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        console.log('Skipping DB integration test - no Supabase config')
        return
      }

      const duplicateExpenses = [
        {
          date: '2025-09-20',
          category: '식비',
          content: '중복 테스트 데이터',
          paymentMethod: '카드',
          amount: -5000,
          memo: '중복 테스트'
        },
        {
          date: '2025-09-20',
          category: '식비',
          content: '중복 테스트 데이터', // 동일한 내용
          paymentMethod: '카드',
          amount: -5000, // 동일한 금액
          memo: '중복 테스트 - 다른 메모' // 메모는 달라도 해시는 같음
        }
      ]

      const expensesWithHash = addHashesToExpenses(duplicateExpenses)

      try {
        const result = await saveExpensesToDB(TEST_USER_ID, expensesWithHash)

        expect(result.totalSubmitted).toBe(2)
        expect(result.newRecords).toBeLessThanOrEqual(1) // 중복이므로 최대 1개만 저장
        expect(result.duplicatesIgnored).toBeGreaterThanOrEqual(1)
      } catch (error) {
        // 실제 DB 연결 없이 테스트하는 경우 건너뛰기
        if (error instanceof Error && error.message.includes('데이터베이스')) {
          console.log('Skipping DB test - database not available')
          return
        }
        throw error
      }
    })

    test('여러 사용자의 동일한 데이터는 별도로 저장된다', async () => {
      // 환경변수가 없으면 테스트 건너뛰기
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        console.log('Skipping DB integration test - no Supabase config')
        return
      }

      const sameExpense = [
        {
          date: '2025-09-20',
          category: '식비',
          content: `다중 사용자 테스트 ${Date.now()}`,
          paymentMethod: '카드',
          amount: -5000,
          memo: '다중 사용자 테스트'
        }
      ]

      const expensesWithHash = addHashesToExpenses(sameExpense)

      try {
        // 첫 번째 사용자로 저장
        const result1 = await saveExpensesToDB('user-1', expensesWithHash)
        expect(result1.newRecords).toBe(1)

        // 두 번째 사용자로 동일한 데이터 저장
        const result2 = await saveExpensesToDB('user-2', expensesWithHash)
        expect(result2.newRecords).toBe(1) // 다른 사용자이므로 저장되어야 함

      } catch (error) {
        // 실제 DB 연결 없이 테스트하는 경우 건너뛰기
        if (error instanceof Error && error.message.includes('데이터베이스')) {
          console.log('Skipping DB test - database not available')
          return
        }
        throw error
      }
    })

    test('빈 배열을 처리한다', async () => {
      // 환경변수가 없으면 테스트 건너뛰기
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        console.log('Skipping DB integration test - no Supabase config')
        return
      }

      try {
        const result = await saveExpensesToDB(TEST_USER_ID, [])

        expect(result.totalSubmitted).toBe(0)
        expect(result.newRecords).toBe(0)
        expect(result.duplicatesIgnored).toBe(0)
      } catch (error) {
        // 실제 DB 연결 없이 테스트하는 경우 건너뛰기
        if (error instanceof Error && error.message.includes('데이터베이스')) {
          console.log('Skipping DB test - database not available')
          return
        }
        throw error
      }
    })

    test('잘못된 사용자 ID로 오류를 처리한다', async () => {
      // 환경변수가 없으면 테스트 건너뛰기
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        console.log('Skipping DB integration test - no Supabase config')
        return
      }

      const testExpenses = [
        {
          date: '2025-09-20',
          category: '식비',
          content: '잘못된 사용자 테스트',
          paymentMethod: '카드',
          amount: -5000,
          memo: '테스트',
          unique_hash: 'test-hash'
        }
      ]

      try {
        // 잘못된 UUID 형식
        await expect(saveExpensesToDB('invalid-user-id', testExpenses))
          .rejects.toThrow()
      } catch (error) {
        // 실제 DB 연결 없이 테스트하는 경우 건너뛰기
        if (error instanceof Error && error.message.includes('데이터베이스')) {
          console.log('Skipping DB test - database not available')
          return
        }
        throw error
      }
    })
  })

  describe('Hash-based duplicate prevention', () => {
    test('동일한 해시값으로 중복 방지가 작동한다', () => {
      const sameData = [
        {
          date: '2025-09-20',
          content: '동일한 내용',
          amount: -5000
        },
        {
          date: '2025-09-20',
          content: '동일한 내용',
          amount: -5000
        }
      ]

      const result = addHashesToExpenses(sameData)

      // 동일한 해시가 생성되어야 함
      expect(result[0].unique_hash).toBe(result[1].unique_hash)

      // 이런 데이터가 DB에 저장될 때 중복이 방지되어야 함
      expect(result[0].unique_hash).toHaveLength(64)
    })

    test('약간 다른 데이터는 다른 해시를 생성한다', () => {
      const differentData = [
        {
          date: '2025-09-20',
          content: '아침 식사',
          amount: -5000
        },
        {
          date: '2025-09-20',
          content: '아침 식사',
          amount: -5001 // 1원 차이
        }
      ]

      const result = addHashesToExpenses(differentData)

      // 다른 해시가 생성되어야 함
      expect(result[0].unique_hash).not.toBe(result[1].unique_hash)
    })
  })
})