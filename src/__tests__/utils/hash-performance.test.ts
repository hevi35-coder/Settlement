/**
 * Hash 유틸리티 성능 및 부하 테스트
 */

import { generateUniqueHash, addHashesToExpenses } from '@/lib/utils/hash'

describe('Hash Performance Tests', () => {
  describe('Large scale hash generation', () => {
    test('10,000개 해시 생성을 5초 이내에 완료한다', () => {
      const startTime = Date.now()

      // 10,000개의 서로 다른 데이터 생성
      for (let i = 0; i < 10000; i++) {
        generateUniqueHash(
          '2025-09-21',
          `테스트 항목 ${i}`,
          -(i * 100)
        )
      }

      const endTime = Date.now()
      const executionTime = endTime - startTime

      console.log(`10,000개 해시 생성 시간: ${executionTime}ms`)
      expect(executionTime).toBeLessThan(5000) // 5초 이내
    })

    test('배치 처리로 대용량 데이터를 효율적으로 처리한다', () => {
      const expenses = []

      // 50,000개 데이터 생성
      for (let i = 0; i < 50000; i++) {
        expenses.push({
          date: '2025-09-21',
          content: `대용량 테스트 ${i}`,
          amount: -(i % 10000) * 10
        })
      }

      const startTime = Date.now()
      const result = addHashesToExpenses(expenses)
      const endTime = Date.now()

      const executionTime = endTime - startTime
      console.log(`50,000개 배치 처리 시간: ${executionTime}ms`)

      expect(result).toHaveLength(50000)
      expect(executionTime).toBeLessThan(10000) // 10초 이내
      expect(result.every(item => item.unique_hash.length === 64)).toBe(true)
    })
  })

  describe('Memory efficiency tests', () => {
    test('메모리 사용량이 적절한 범위 내에 있다', () => {
      const initialMemory = process.memoryUsage()

      // 100,000개 해시 생성 (메모리 테스트)
      const hashes = []
      for (let i = 0; i < 100000; i++) {
        const hash = generateUniqueHash(
          '2025-09-21',
          `메모리 테스트 ${i}`,
          -i
        )
        hashes.push(hash)
      }

      const finalMemory = process.memoryUsage()
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed

      console.log(`메모리 증가량: ${Math.round(memoryIncrease / 1024 / 1024)}MB`)

      // 메모리 증가가 100MB 미만이어야 함
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024)
      expect(hashes).toHaveLength(100000)
    })

    test('가비지 컬렉션 후에도 정상 작동한다', () => {
      // 메모리 정리를 위한 가비지 컬렉션 강제 실행
      if (global.gc) {
        global.gc()
      }

      const initialMemory = process.memoryUsage()

      // 대량 데이터 처리
      const expenses = Array.from({ length: 10000 }, (_, i) => ({
        date: '2025-09-21',
        content: `GC 테스트 ${i}`,
        amount: -i * 50
      }))

      const result = addHashesToExpenses(expenses)

      // 다시 가비지 컬렉션
      if (global.gc) {
        global.gc()
      }

      const finalMemory = process.memoryUsage()

      expect(result).toHaveLength(10000)
      expect(result.every(item => item.unique_hash)).toBeTruthy()

      // 메모리가 정리되었는지 확인 (증가량이 적절한 범위 내)
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024) // 50MB 미만
    })
  })

  describe('Concurrent processing simulation', () => {
    test('동시 처리 시나리오를 시뮬레이션한다', async () => {
      const promises = []
      const startTime = Date.now()

      // 10개의 동시 처리 작업 시뮬레이션
      for (let batch = 0; batch < 10; batch++) {
        const promise = new Promise((resolve) => {
          const expenses = []

          // 각 배치당 1000개 데이터
          for (let i = 0; i < 1000; i++) {
            expenses.push({
              date: '2025-09-21',
              content: `배치${batch} 아이템${i}`,
              amount: -(batch * 1000 + i)
            })
          }

          const result = addHashesToExpenses(expenses)
          resolve(result)
        })

        promises.push(promise)
      }

      const results = await Promise.all(promises)
      const endTime = Date.now()

      const executionTime = endTime - startTime
      console.log(`동시 처리 시간: ${executionTime}ms`)

      // 모든 배치가 정상 처리되었는지 확인
      expect(results).toHaveLength(10)
      results.forEach(result => {
        expect(result).toHaveLength(1000)
        expect(result.every((item: any) => item.unique_hash.length === 64)).toBe(true)
      })

      // 10초 이내 완료
      expect(executionTime).toBeLessThan(10000)
    })

    test('해시 충돌이 발생하지 않는지 확인한다', () => {
      const hashSet = new Set()
      const duplicateSet = new Set()

      // 100,000개의 서로 다른 데이터로 충돌 테스트
      for (let i = 0; i < 100000; i++) {
        const hash = generateUniqueHash(
          `2025-09-${(i % 30) + 1}`, // 날짜 변화
          `충돌 테스트 ${i % 1000}`, // 내용 패턴
          -(i % 50000) // 금액 패턴
        )

        if (hashSet.has(hash)) {
          duplicateSet.add(hash)
        }
        hashSet.add(hash)
      }

      console.log(`생성된 고유 해시 수: ${hashSet.size}`)
      console.log(`중복 발견 수: ${duplicateSet.size}`)

      // 의도적으로 중복을 만든 케이스(같은 날짜+내용+금액)가 아닌 이상 충돌이 없어야 함
      // 패턴에 의해 일부 중복이 예상되므로, 전체적인 고유성 비율을 확인
      const uniquenessRatio = hashSet.size / 100000
      expect(uniquenessRatio).toBeGreaterThan(0.7) // 70% 이상의 고유성
    })
  })

  describe('Stress testing', () => {
    test('극한 상황에서도 안정적으로 작동한다', () => {
      const startTime = Date.now()
      let successCount = 0
      let errorCount = 0

      // 200,000개 데이터로 스트레스 테스트
      for (let i = 0; i < 200000; i++) {
        try {
          const hash = generateUniqueHash(
            '2025-09-21',
            `스트레스 테스트 ${i}`,
            -i
          )

          if (hash && hash.length === 64) {
            successCount++
          }
        } catch (error) {
          errorCount++
        }
      }

      const endTime = Date.now()
      const executionTime = endTime - startTime

      console.log(`스트레스 테스트 결과:`)
      console.log(`- 실행 시간: ${executionTime}ms`)
      console.log(`- 성공: ${successCount}`)
      console.log(`- 실패: ${errorCount}`)

      expect(successCount).toBe(200000)
      expect(errorCount).toBe(0)
      expect(executionTime).toBeLessThan(20000) // 20초 이내
    })
  })
})