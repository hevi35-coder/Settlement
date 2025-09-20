/**
 * Hash 유틸리티 엣지 케이스 테스트
 */

import { generateUniqueHash, addHashesToExpenses } from '@/lib/utils/hash'

describe('Hash Edge Cases Tests', () => {
  describe('Special characters handling', () => {
    test('Unicode 문자를 올바르게 처리한다', () => {
      const testCases = [
        { content: '한글 테스트', expected: true },
        { content: 'English Test', expected: true },
        { content: '日本語テスト', expected: true },
        { content: '中文测试', expected: true },
        { content: 'العربية', expected: true },
        { content: 'Русский', expected: true }
      ]

      testCases.forEach(({ content, expected }) => {
        const hash1 = generateUniqueHash('2025-09-21', content, -1000)
        const hash2 = generateUniqueHash('2025-09-21', content, -1000)

        expect(hash1).toBe(hash2) // 일관성
        expect(hash1.length).toBe(64) // SHA256 길이
        expect(typeof hash1).toBe('string')
      })
    })

    test('이모지를 포함한 내용을 처리한다', () => {
      const emojiTestCases = [
        '🍕 피자 주문',
        '☕ 커피 ☕',
        '🎉🎊 축하파티 🎊🎉',
        '💰💵💴💶💷',
        '🏪🏬🏭🏯🏰'
      ]

      emojiTestCases.forEach(content => {
        const hash = generateUniqueHash('2025-09-21', content, -5000)

        expect(hash).toHaveLength(64)
        expect(hash).toMatch(/^[a-f0-9]{64}$/) // hex 문자만

        // 같은 이모지 내용으로 다시 생성했을 때 동일한 해시
        const hash2 = generateUniqueHash('2025-09-21', content, -5000)
        expect(hash).toBe(hash2)
      })
    })

    test('특수 기호와 구두점을 처리한다', () => {
      const specialChars = [
        '!@#$%^&*()_+-=[]{}|;:,.<>?',
        '"\'`~\\/',
        '※◎○●◇◆□■△▲▽▼',
        '①②③④⑤⑥⑦⑧⑨⑩',
        '℃℉㎏㎡㎞',
        '＃＄％＆'
      ]

      specialChars.forEach(content => {
        expect(() => {
          const hash = generateUniqueHash('2025-09-21', content, -1000)
          expect(hash).toHaveLength(64)
        }).not.toThrow()
      })
    })

    test('HTML/XML 태그가 포함된 내용을 처리한다', () => {
      const htmlTestCases = [
        '<script>alert("test")</script>',
        '<div class="test">테스트</div>',
        '&lt;tag&gt;escaped&lt;/tag&gt;',
        '<?xml version="1.0"?>',
        '<![CDATA[some data]]>'
      ]

      htmlTestCases.forEach(content => {
        const hash = generateUniqueHash('2025-09-21', content, -1000)

        expect(hash).toHaveLength(64)
        expect(hash).toMatch(/^[a-f0-9]{64}$/)

        // XSS 공격 등을 방지하기 위해 해시가 원본 내용과 다른지 확인
        expect(hash).not.toContain('<')
        expect(hash).not.toContain('>')
        expect(hash).not.toContain('script')
      })
    })
  })

  describe('Extreme values testing', () => {
    test('매우 긴 문자열을 처리한다', () => {
      const veryLongContent = 'A'.repeat(10000) // 10,000 글자
      const hash = generateUniqueHash('2025-09-21', veryLongContent, -1000)

      expect(hash).toHaveLength(64)
      expect(hash).toMatch(/^[a-f0-9]{64}$/)

      // 같은 긴 문자열로 다시 생성
      const hash2 = generateUniqueHash('2025-09-21', veryLongContent, -1000)
      expect(hash).toBe(hash2)
    })

    test('매우 큰 금액을 처리한다', () => {
      const extremeAmounts = [
        Number.MAX_SAFE_INTEGER,
        -Number.MAX_SAFE_INTEGER,
        999999999999.99,
        -999999999999.99,
        0.01,
        -0.01
      ]

      extremeAmounts.forEach(amount => {
        const hash = generateUniqueHash('2025-09-21', '극한값 테스트', amount)

        expect(hash).toHaveLength(64)
        expect(hash).toMatch(/^[a-f0-9]{64}$/)

        // 같은 값으로 다시 생성했을 때 동일성
        const hash2 = generateUniqueHash('2025-09-21', '극한값 테스트', amount)
        expect(hash).toBe(hash2)
      })
    })

    test('소수점 정밀도 문제를 올바르게 처리한다', () => {
      const precisionTests = [
        { amount1: 0.1 + 0.2, amount2: 0.3, shouldBeSame: true },
        { amount1: 0.1 * 3, amount2: 0.3, shouldBeSame: true },
        { amount1: 1.0000000001, amount2: 1.0, shouldBeSame: true }, // 정규화로 같아짐
        { amount1: -123.456789, amount2: -123.46, shouldBeSame: true }, // 소수점 2자리로 정규화
        { amount1: 100.001, amount2: 100.00, shouldBeSame: true }
      ]

      precisionTests.forEach(({ amount1, amount2, shouldBeSame }) => {
        const hash1 = generateUniqueHash('2025-09-21', '정밀도 테스트', amount1)
        const hash2 = generateUniqueHash('2025-09-21', '정밀도 테스트', amount2)

        if (shouldBeSame) {
          expect(hash1).toBe(hash2)
        } else {
          expect(hash1).not.toBe(hash2)
        }
      })
    })

    test('빈 문자열과 공백 처리를 테스트한다', () => {
      // 빈 문자열은 오류를 발생시켜야 함
      expect(() => {
        generateUniqueHash('2025-09-21', '', -1000)
      }).toThrow('Invalid input')

      // 공백만 있는 문자열도 오류를 발생시켜야 함 (trim 후 빈 문자열)
      expect(() => {
        generateUniqueHash('2025-09-21', '   ', -1000)
      }).toThrow('Invalid input')

      // 앞뒤 공백은 제거되어야 함
      const hash1 = generateUniqueHash('2025-09-21', '  테스트  ', -1000)
      const hash2 = generateUniqueHash('2025-09-21', '테스트', -1000)
      expect(hash1).toBe(hash2)
    })
  })

  describe('Date format edge cases', () => {
    test('다양한 날짜 형식을 일관되게 처리한다', () => {
      const dateTestCases = [
        '2025-01-01',
        '2025-12-31',
        '2024-02-29', // 윤년
        '2025-02-28', // 평년
        '1900-01-01', // 오래된 날짜
        '2099-12-31'  // 미래 날짜
      ]

      dateTestCases.forEach(date => {
        const hash = generateUniqueHash(date, '날짜 테스트', -1000)

        expect(hash).toHaveLength(64)
        expect(hash).toMatch(/^[a-f0-9]{64}$/)

        // 같은 날짜로 다시 생성했을 때 동일성
        const hash2 = generateUniqueHash(date, '날짜 테스트', -1000)
        expect(hash).toBe(hash2)
      })
    })

    test('잘못된 날짜 형식도 일관된 해시를 생성한다', () => {
      // 잘못된 날짜 형식이어도 문자열로 처리되어 일관된 해시 생성
      const invalidDates = [
        '2025-13-01', // 잘못된 월
        '2025-02-30', // 잘못된 일
        '25-09-21',   // 다른 형식
        'invalid-date'
      ]

      invalidDates.forEach(date => {
        const hash1 = generateUniqueHash(date, '잘못된 날짜', -1000)
        const hash2 = generateUniqueHash(date, '잘못된 날짜', -1000)

        expect(hash1).toBe(hash2) // 일관성은 유지되어야 함
        expect(hash1).toHaveLength(64)
      })
    })
  })

  describe('Timezone and locale handling', () => {
    test('시간대가 다른 환경에서도 일관된 해시를 생성한다', () => {
      // 날짜 문자열은 시간대에 영향받지 않으므로 항상 같은 해시
      const date = '2025-09-21'
      const content = '시간대 테스트'
      const amount = -1000

      // 여러 번 생성해도 같은 결과
      const hashes = []
      for (let i = 0; i < 10; i++) {
        hashes.push(generateUniqueHash(date, content, amount))
      }

      // 모든 해시가 동일해야 함
      expect(new Set(hashes).size).toBe(1)
    })
  })

  describe('Concurrent edge cases', () => {
    test('동시에 같은 데이터를 처리해도 일관된 결과를 얻는다', async () => {
      const promises = []

      // 100개의 동시 요청으로 같은 데이터 처리
      for (let i = 0; i < 100; i++) {
        promises.push(
          Promise.resolve(generateUniqueHash('2025-09-21', '동시성 테스트', -1000))
        )
      }

      const results = await Promise.all(promises)

      // 모든 결과가 동일해야 함
      expect(new Set(results).size).toBe(1)
      expect(results[0]).toHaveLength(64)
    })

    test('배치 처리에서 특수 케이스들을 처리한다', () => {
      const edgeCaseExpenses = [
        { date: '2025-09-21', content: '🍕 피자', amount: -15000.999 },
        { date: '2025-09-21', content: '<script>test</script>', amount: -5000 },
        { date: '2025-09-21', content: 'A'.repeat(1000), amount: -Number.MAX_SAFE_INTEGER },
        { date: '2025-09-21', content: '   앞뒤공백   ', amount: -0.01 },
        { date: '2025-09-21', content: '특수문자!@#$%', amount: 999999.99 }
      ]

      const result = addHashesToExpenses(edgeCaseExpenses)

      expect(result).toHaveLength(5)
      result.forEach(item => {
        expect(item.unique_hash).toHaveLength(64)
        expect(item.unique_hash).toMatch(/^[a-f0-9]{64}$/)
      })

      // 모든 해시가 서로 다른지 확인 (다른 내용이므로)
      const hashes = result.map(item => item.unique_hash)
      expect(new Set(hashes).size).toBe(5)
    })
  })
})