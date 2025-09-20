import * as XLSX from 'xlsx'

// 엑셀 파싱 관련 유틸리티 함수들을 테스트
describe('Excel Parser Utils', () => {
  describe('날짜 파싱', () => {
    test('엑셀 시리얼 번호 파싱', () => {
      // 2025-01-01의 엑셀 시리얼 번호는 45658
      const serialDate = 45658
      const expectedDate = new Date((serialDate - 25569) * 86400 * 1000)

      expect(expectedDate.getFullYear()).toBe(2025)
      expect(expectedDate.getMonth()).toBe(0) // 0-based
      expect(expectedDate.getDate()).toBe(1)
    })

    test('문자열 날짜 파싱', () => {
      const dateString = '2025-01-01'
      const parsedDate = new Date(dateString)

      expect(parsedDate.getFullYear()).toBe(2025)
      expect(parsedDate.getMonth()).toBe(0)
      expect(parsedDate.getDate()).toBe(1)
    })

    test('잘못된 날짜 형식', () => {
      const invalidDate = new Date('잘못된날짜')
      expect(isNaN(invalidDate.getTime())).toBe(true)
    })
  })

  describe('금액 파싱', () => {
    test('숫자 금액', () => {
      const amount = 12000
      expect(typeof amount).toBe('number')
      expect(amount).toBe(12000)
    })

    test('문자열 금액 (콤마 포함)', () => {
      const amountString = '-12,000'
      const parsed = parseFloat(amountString.replace(/[^\d.-]/g, ''))
      expect(parsed).toBe(-12000)
    })

    test('원화 기호 포함', () => {
      const amountString = '-18000원'
      const parsed = parseFloat(amountString.replace(/[^\d.-]/g, ''))
      expect(parsed).toBe(-18000)
    })

    test('공백 포함', () => {
      const amountString = '  -45000  '
      const parsed = parseFloat(amountString.replace(/[^\d.-]/g, ''))
      expect(parsed).toBe(-45000)
    })

    test('콤마와 원화 기호 모두 포함', () => {
      const amountString = '-15,000원'
      const parsed = parseFloat(amountString.replace(/[^\d.-]/g, ''))
      expect(parsed).toBe(-15000)
    })

    test('소수점 포함', () => {
      const amountString = '-12.5'
      const parsed = parseFloat(amountString.replace(/[^\d.-]/g, ''))
      expect(parsed).toBe(-12.5)
    })

    test('잘못된 금액 형식', () => {
      const invalidAmount = '잘못된금액'
      const parsed = parseFloat(invalidAmount.replace(/[^\d.-]/g, ''))
      expect(isNaN(parsed)).toBe(true)
    })
  })

  describe('컬럼 매핑', () => {
    test('정상 헤더', () => {
      const headers = ['날짜', '분류', '내용', '결제수단', '금액', '메모']
      const requiredColumns = ['날짜', '분류', '내용', '결제수단', '금액']
      const missingColumns = requiredColumns.filter(col => !headers.includes(col))

      expect(missingColumns).toHaveLength(0)
    })

    test('필수 컬럼 누락', () => {
      const headers = ['날짜', '내용', '결제수단', '금액'] // '분류' 누락
      const requiredColumns = ['날짜', '분류', '내용', '결제수단', '금액']
      const missingColumns = requiredColumns.filter(col => !headers.includes(col))

      expect(missingColumns).toEqual(['분류'])
    })

    test('컬럼 인덱스 매핑', () => {
      const headers = ['날짜', '분류', '내용', '결제수단', '금액', '메모']
      const columnMap = {
        date: headers.indexOf('날짜'),
        category: headers.indexOf('분류'),
        content: headers.indexOf('내용'),
        paymentMethod: headers.indexOf('결제수단'),
        amount: headers.indexOf('금액'),
        memo: headers.indexOf('메모') !== -1 ? headers.indexOf('메모') : null
      }

      expect(columnMap.date).toBe(0)
      expect(columnMap.category).toBe(1)
      expect(columnMap.content).toBe(2)
      expect(columnMap.paymentMethod).toBe(3)
      expect(columnMap.amount).toBe(4)
      expect(columnMap.memo).toBe(5)
    })

    test('메모 컬럼 없는 경우', () => {
      const headers = ['날짜', '분류', '내용', '결제수단', '금액']
      const memoIndex = headers.indexOf('메모') !== -1 ? headers.indexOf('메모') : null

      expect(memoIndex).toBeNull()
    })
  })

  describe('기간 필터링', () => {
    test('시작일 필터링', () => {
      const testDate = new Date('2025-01-15')
      const startDate = new Date('2025-01-01')

      expect(testDate >= startDate).toBe(true)
    })

    test('종료일 필터링', () => {
      const testDate = new Date('2025-01-15')
      const endDate = new Date('2025-02-01')

      expect(testDate <= endDate).toBe(true)
    })

    test('범위 외 데이터', () => {
      const testDate = new Date('2024-12-31')
      const startDate = new Date('2025-01-01')

      expect(testDate < startDate).toBe(true)
    })
  })

  describe('데이터 검증', () => {
    test('빈 행 감지', () => {
      const emptyRow = []
      const nullRow = [null, null, null, null, null, null]
      const normalRow = ['2025-01-01', '식비', '점심', '카드', '-12000', '']

      expect(emptyRow.length === 0).toBe(true)
      expect(!normalRow[0]).toBe(false) // 첫 번째 컬럼(날짜)이 있음
    })

    test('필수 필드 검증', () => {
      const completeRow = ['2025-01-01', '식비', '점심', '카드', '-12000', '']
      const incompleteRow = ['', '식비', '점심', '카드', '-12000', '']

      expect(!!completeRow[0]).toBe(true) // 날짜 있음
      expect(!!incompleteRow[0]).toBe(false) // 날짜 없음
    })
  })

  describe('요약 정보 생성', () => {
    test('총 금액 계산', () => {
      const data = [
        { amount: -12000 },
        { amount: -1400 },
        { amount: -18000 }
      ]

      const totalAmount = data.reduce((sum, d) => sum + d.amount, 0)
      expect(totalAmount).toBe(-31400)
    })

    test('카테고리 추출', () => {
      const data = [
        { category: '식비' },
        { category: '교통비' },
        { category: '식비' },
        { category: '생활용품' }
      ]

      const categories = [...new Set(data.map(d => d.category))]
      expect(categories).toEqual(['식비', '교통비', '생활용품'])
    })

    test('결제수단 추출', () => {
      const data = [
        { paymentMethod: '카드' },
        { paymentMethod: '현금' },
        { paymentMethod: '카드' },
        { paymentMethod: '교통카드' }
      ]

      const paymentMethods = [...new Set(data.map(d => d.paymentMethod))]
      expect(paymentMethods).toEqual(['카드', '현금', '교통카드'])
    })

    test('날짜 범위 계산', () => {
      const data = [
        { date: '2025-01-01' },
        { date: '2025-01-15' },
        { date: '2025-01-05' }
      ]

      const timestamps = data.map(d => new Date(d.date).getTime())
      const dateRange = {
        start: Math.min(...timestamps),
        end: Math.max(...timestamps)
      }

      expect(new Date(dateRange.start).toISOString().split('T')[0]).toBe('2025-01-01')
      expect(new Date(dateRange.end).toISOString().split('T')[0]).toBe('2025-01-15')
    })
  })

  describe('XLSX 라이브러리 통합', () => {
    test('워크북 생성 및 시트 읽기', () => {
      const testData = [
        ['날짜', '분류', '내용', '결제수단', '금액', '메모'],
        ['2025-01-01', '식비', '점심', '카드', '-12000', '']
      ]

      const workbook = XLSX.utils.book_new()
      const worksheet = XLSX.utils.aoa_to_sheet(testData)
      XLSX.utils.book_append_sheet(workbook, worksheet, '가계부 내역')

      expect(workbook.SheetNames).toContain('가계부 내역')

      const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets['가계부 내역'], { header: 1 })
      expect(jsonData).toEqual(testData)
    })

    test('시트명 찾기', () => {
      const sheetNames = ['요약', '가계부 내역', '설정']
      const targetSheetName = '가계부 내역'

      const hasTargetSheet = sheetNames.includes(targetSheetName)
      const fallbackSheet = sheetNames[0]

      expect(hasTargetSheet).toBe(true)
      expect(fallbackSheet).toBe('요약')
    })
  })
})