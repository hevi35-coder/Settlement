/**
 * Hash utility 단위 테스트
 */

import { generateUniqueHash, generateExpenseHash, addHashesToExpenses } from '@/lib/utils/hash'

describe('Hash Utility Functions', () => {
  describe('generateUniqueHash', () => {
    test('동일한 입력에 대해 항상 같은 해시를 생성한다', () => {
      const date = '2025-09-20'
      const content = '아침 식사'
      const amount = -5000

      const hash1 = generateUniqueHash(date, content, amount)
      const hash2 = generateUniqueHash(date, content, amount)

      expect(hash1).toBe(hash2)
      expect(hash1).toHaveLength(64) // SHA256은 64자리 hex
    })

    test('다른 입력에 대해서는 다른 해시를 생성한다', () => {
      const date = '2025-09-20'
      const content1 = '아침 식사'
      const content2 = '점심 식사'
      const amount = -5000

      const hash1 = generateUniqueHash(date, content1, amount)
      const hash2 = generateUniqueHash(date, content2, amount)

      expect(hash1).not.toBe(hash2)
    })

    test('금액이 다르면 다른 해시를 생성한다', () => {
      const date = '2025-09-20'
      const content = '아침 식사'
      const amount1 = -5000
      const amount2 = -6000

      const hash1 = generateUniqueHash(date, content, amount1)
      const hash2 = generateUniqueHash(date, content, amount2)

      expect(hash1).not.toBe(hash2)
    })

    test('날짜가 다르면 다른 해시를 생성한다', () => {
      const date1 = '2025-09-20'
      const date2 = '2025-09-21'
      const content = '아침 식사'
      const amount = -5000

      const hash1 = generateUniqueHash(date1, content, amount)
      const hash2 = generateUniqueHash(date2, content, amount)

      expect(hash1).not.toBe(hash2)
    })

    test('공백이 있는 내용도 올바르게 처리한다', () => {
      const date = '2025-09-20'
      const content1 = '  아침 식사  '
      const content2 = '아침 식사'
      const amount = -5000

      const hash1 = generateUniqueHash(date, content1, amount)
      const hash2 = generateUniqueHash(date, content2, amount)

      expect(hash1).toBe(hash2) // trim()으로 공백 제거됨
    })

    test('부동소수점 금액을 정규화한다', () => {
      const date = '2025-09-20'
      const content = '아침 식사'
      const amount1 = -5000.123456
      const amount2 = -5000.12

      const hash1 = generateUniqueHash(date, content, amount1)
      const hash2 = generateUniqueHash(date, content, amount2)

      expect(hash1).toBe(hash2) // 소수점 2자리로 정규화됨
    })

    test('잘못된 입력에 대해 오류를 발생시킨다', () => {
      expect(() => generateUniqueHash('', '내용', -5000)).toThrow('Invalid input')
      expect(() => generateUniqueHash('2025-09-20', '', -5000)).toThrow('Invalid input')
      expect(() => generateUniqueHash('2025-09-20', '내용', NaN)).toThrow('Invalid input')
    })
  })

  describe('generateExpenseHash', () => {
    test('지출 객체에서 올바른 해시를 생성한다', () => {
      const expense = {
        date: '2025-09-20',
        content: '아침 식사',
        amount: -5000
      }

      const hash = generateExpenseHash(expense)
      const expectedHash = generateUniqueHash(expense.date, expense.content, expense.amount)

      expect(hash).toBe(expectedHash)
    })
  })

  describe('addHashesToExpenses', () => {
    test('지출 배열에 해시를 추가한다', () => {
      const expenses = [
        {
          date: '2025-09-20',
          content: '아침 식사',
          amount: -5000,
          category: '식비',
          paymentMethod: '카드',
          memo: ''
        },
        {
          date: '2025-09-20',
          content: '점심 식사',
          amount: -8000,
          category: '식비',
          paymentMethod: '카드',
          memo: ''
        }
      ]

      const result = addHashesToExpenses(expenses)

      expect(result).toHaveLength(2)
      expect(result[0]).toHaveProperty('unique_hash')
      expect(result[1]).toHaveProperty('unique_hash')
      expect(result[0].unique_hash).toHaveLength(64)
      expect(result[1].unique_hash).toHaveLength(64)
      expect(result[0].unique_hash).not.toBe(result[1].unique_hash)

      // 원본 데이터가 유지되는지 확인
      expect(result[0].category).toBe('식비')
      expect(result[1].paymentMethod).toBe('카드')
    })

    test('빈 배열을 처리한다', () => {
      const result = addHashesToExpenses([])
      expect(result).toEqual([])
    })

    test('동일한 데이터에 대해 동일한 해시를 생성한다', () => {
      const expenses = [
        {
          date: '2025-09-20',
          content: '아침 식사',
          amount: -5000
        },
        {
          date: '2025-09-20',
          content: '아침 식사',
          amount: -5000
        }
      ]

      const result = addHashesToExpenses(expenses)

      expect(result[0].unique_hash).toBe(result[1].unique_hash)
    })
  })

  describe('Hash collision resistance', () => {
    test('많은 데이터에서 해시 충돌이 발생하지 않는다', () => {
      const expenses = []
      const hashSet = new Set()

      // 1000개의 서로 다른 지출 데이터 생성
      for (let i = 0; i < 1000; i++) {
        expenses.push({
          date: '2025-09-20',
          content: `지출 항목 ${i}`,
          amount: -(i * 100)
        })
      }

      const result = addHashesToExpenses(expenses)

      // 모든 해시가 고유한지 확인
      result.forEach(expense => {
        expect(hashSet.has(expense.unique_hash)).toBe(false)
        hashSet.add(expense.unique_hash)
      })

      expect(hashSet.size).toBe(1000)
    })
  })
})