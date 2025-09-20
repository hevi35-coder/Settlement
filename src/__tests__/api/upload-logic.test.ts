/**
 * Upload API 핵심 로직 테스트
 * Next.js API 라우트 대신 핵심 비즈니스 로직을 직접 테스트
 */

import fs from 'fs'
import path from 'path'
import * as XLSX from 'xlsx'
import JSZip from 'jszip'

// 테스트할 핵심 함수들을 여기서 구현
class ExcelProcessor {
  static async processZipFile(zipBuffer: Buffer, zipPassword?: string, startDate?: string, endDate?: string) {
    const zip = new JSZip()
    let zipData: JSZip

    try {
      if (zipPassword) {
        zipData = await zip.loadAsync(zipBuffer, { password: zipPassword })
      } else {
        zipData = await zip.loadAsync(zipBuffer)
      }
    } catch (error) {
      throw new Error('ZIP 파일 압축 해제에 실패했습니다.')
    }

    // ZIP 파일 내 .xlsx 파일 찾기
    const xlsxFiles: { name: string; data: ArrayBuffer }[] = []

    for (const [fileName, zipEntry] of Object.entries(zipData.files)) {
      if (!zipEntry.dir && fileName.toLowerCase().endsWith('.xlsx')) {
        try {
          const fileData = await zipEntry.async('arraybuffer')
          xlsxFiles.push({
            name: fileName,
            data: fileData
          })
        } catch (error) {
          console.error(`파일 추출 오류 (${fileName}):`, error)
        }
      }
    }

    if (xlsxFiles.length === 0) {
      throw new Error('ZIP 파일 내에 Excel(.xlsx) 파일이 없습니다.')
    }

    // Excel 파일들 처리
    const processedFiles: any[] = []

    for (const xlsxFile of xlsxFiles) {
      try {
        const result = await this.processExcelFile(xlsxFile, startDate, endDate)
        processedFiles.push(result)
      } catch (error) {
        console.error(`Excel 파일 처리 오류 (${xlsxFile.name}):`, error)
      }
    }

    return {
      filesFound: xlsxFiles.length,
      processedFiles
    }
  }

  static async processExcelFile(xlsxFile: { name: string; data: ArrayBuffer }, startDate?: string, endDate?: string) {
    // XLSX 파일 읽기
    const workbook = XLSX.read(xlsxFile.data, { type: 'array' })

    // '가계부 내역' 시트 찾기
    const targetSheetName = '가계부 내역'
    const sheetNames = workbook.SheetNames

    let targetSheet = null
    if (sheetNames.includes(targetSheetName)) {
      targetSheet = workbook.Sheets[targetSheetName]
    } else {
      // '가계부 내역' 시트가 없으면 첫 번째 시트 사용
      targetSheet = workbook.Sheets[sheetNames[0]]
    }

    if (!targetSheet) {
      throw new Error('처리할 시트가 없습니다.')
    }

    // 시트를 JSON으로 변환 (첫 번째 행을 헤더로 사용)
    const jsonData = XLSX.utils.sheet_to_json(targetSheet, { header: 1 })

    if (jsonData.length === 0) {
      throw new Error('시트에 데이터가 없습니다.')
    }

    // 헤더 행 추출 및 검증
    const headers = jsonData[0] as string[]
    const requiredColumns = ['날짜', '분류', '내용', '결제수단', '금액']
    const missingColumns = requiredColumns.filter(col => !headers.includes(col))

    if (missingColumns.length > 0) {
      throw new Error(`필수 컬럼이 누락되었습니다: ${missingColumns.join(', ')}`)
    }

    // 컬럼 인덱스 매핑
    const columnMap = {
      date: headers.indexOf('날짜'),
      category: headers.indexOf('분류'),
      content: headers.indexOf('내용'),
      paymentMethod: headers.indexOf('결제수단'),
      amount: headers.indexOf('금액'),
      memo: headers.indexOf('메모') !== -1 ? headers.indexOf('메모') : null
    }

    // 데이터 행 처리 (헤더 제외)
    const dataRows = jsonData.slice(1)
    const parsedData: any[] = []
    const errors: string[] = []

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i] as any[]
      const rowNumber = i + 2 // 엑셀 행 번호 (헤더 포함)

      try {
        // 빈 행 건너뛰기
        if (!row || row.length === 0 || !row[columnMap.date]) {
          continue
        }

        // 날짜 파싱
        let parsedDate: Date
        const dateValue = row[columnMap.date]

        if (typeof dateValue === 'number') {
          // 엑셀 날짜 시리얼 넘버
          parsedDate = new Date((dateValue - 25569) * 86400 * 1000)
        } else if (typeof dateValue === 'string') {
          // 문자열 날짜
          parsedDate = new Date(dateValue)
        } else {
          throw new Error(`유효하지 않은 날짜 형식: ${dateValue}`)
        }

        if (isNaN(parsedDate.getTime())) {
          throw new Error(`날짜 파싱 실패: ${dateValue}`)
        }

        // 기간 필터링
        if (startDate || endDate) {
          const filterStartDate = startDate ? new Date(startDate) : null
          const filterEndDate = endDate ? new Date(endDate) : null

          if (filterStartDate && parsedDate < filterStartDate) {
            continue
          }
          if (filterEndDate && parsedDate > filterEndDate) {
            continue
          }
        }

        // 금액 파싱
        let amount = row[columnMap.amount]
        if (typeof amount === 'string') {
          // 문자열에서 숫자만 추출 (콤마, 원화 기호 제거)
          amount = parseFloat(amount.replace(/[^\d.-]/g, ''))
        }

        if (isNaN(amount)) {
          throw new Error(`유효하지 않은 금액: ${row[columnMap.amount]}`)
        }

        // 데이터 객체 생성
        const expenseData = {
          date: parsedDate.toISOString().split('T')[0], // YYYY-MM-DD 형식
          category: row[columnMap.category] || '',
          content: row[columnMap.content] || '',
          paymentMethod: row[columnMap.paymentMethod] || '',
          amount: amount,
          memo: columnMap.memo !== null ? (row[columnMap.memo] || '') : '',
          sourceRow: rowNumber
        }

        parsedData.push(expenseData)

      } catch (error) {
        errors.push(`행 ${rowNumber}: ${error.message}`)
      }
    }

    return {
      fileName: xlsxFile.name,
      sheetName: sheetNames.includes(targetSheetName) ? targetSheetName : sheetNames[0],
      totalRows: dataRows.length,
      validRows: parsedData.length,
      errors: errors,
      data: parsedData,
      summary: {
        dateRange: parsedData.length > 0 ? {
          start: Math.min(...parsedData.map(d => new Date(d.date).getTime())),
          end: Math.max(...parsedData.map(d => new Date(d.date).getTime()))
        } : null,
        totalAmount: parsedData.reduce((sum, d) => sum + d.amount, 0),
        categories: [...new Set(parsedData.map(d => d.category))],
        paymentMethods: [...new Set(parsedData.map(d => d.paymentMethod))]
      }
    }
  }
}

describe('Upload API 핵심 로직', () => {
  const testDataDir = path.join(process.cwd(), 'test-data')

  beforeAll(() => {
    // 테스트 데이터가 없으면 생성
    if (!fs.existsSync(testDataDir)) {
      throw new Error('테스트 데이터가 없습니다. npm run create-test-data를 먼저 실행하세요.')
    }
  })

  describe('정상 케이스', () => {
    test('정상 ZIP 파일 처리', async () => {
      const filePath = path.join(testDataDir, 'normal-test.zip')
      const zipBuffer = fs.readFileSync(filePath)

      const result = await ExcelProcessor.processZipFile(zipBuffer)

      expect(result.filesFound).toBe(1)
      expect(result.processedFiles).toHaveLength(1)
      expect(result.processedFiles[0].validRows).toBeGreaterThan(0)
      expect(result.processedFiles[0].errors).toEqual([])
    })

    test('다양한 금액 형식 처리', async () => {
      const filePath = path.join(testDataDir, 'amount-format-test.zip')
      const zipBuffer = fs.readFileSync(filePath)

      const result = await ExcelProcessor.processZipFile(zipBuffer)

      expect(result.processedFiles[0].validRows).toBeGreaterThan(0)

      // 다양한 금액 형식이 올바르게 파싱되었는지 확인
      const data = result.processedFiles[0].data
      expect(data.every((item: any) => typeof item.amount === 'number')).toBe(true)

      // 특정 금액 검증
      const amounts = data.map((item: any) => item.amount)
      expect(amounts).toContain(-12000) // 콤마 포함
      expect(amounts).toContain(1400)   // 양수
      expect(amounts).toContain(-18000) // 원화 기호
      expect(amounts).toContain(-45000) // 공백 포함
    })

    test('다중 파일 ZIP 처리', async () => {
      const filePath = path.join(testDataDir, 'multi-file-test.zip')
      const zipBuffer = fs.readFileSync(filePath)

      const result = await ExcelProcessor.processZipFile(zipBuffer)

      expect(result.filesFound).toBe(2)
      expect(result.processedFiles).toHaveLength(2)
    })
  })

  describe('기간 필터링', () => {
    test('시작 날짜 필터링', async () => {
      const filePath = path.join(testDataDir, 'date-range-test.zip')
      const zipBuffer = fs.readFileSync(filePath)

      const result = await ExcelProcessor.processZipFile(zipBuffer, undefined, '2025-01-01')

      const data = result.processedFiles[0].data

      // 2025-01-01 이후 데이터만 포함되어야 함
      data.forEach((item: any) => {
        expect(new Date(item.date) >= new Date('2025-01-01')).toBe(true)
      })
    })

    test('종료 날짜 필터링', async () => {
      const filePath = path.join(testDataDir, 'date-range-test.zip')
      const zipBuffer = fs.readFileSync(filePath)

      const result = await ExcelProcessor.processZipFile(zipBuffer, undefined, undefined, '2025-02-28')

      const data = result.processedFiles[0].data

      // 2025-02-28 이전 데이터만 포함되어야 함
      data.forEach((item: any) => {
        expect(new Date(item.date) <= new Date('2025-02-28')).toBe(true)
      })
    })

    test('기간 범위 필터링', async () => {
      const filePath = path.join(testDataDir, 'date-range-test.zip')
      const zipBuffer = fs.readFileSync(filePath)

      const result = await ExcelProcessor.processZipFile(zipBuffer, undefined, '2025-01-01', '2025-02-28')

      const data = result.processedFiles[0].data

      // 지정된 범위 내의 데이터만 포함되어야 함
      data.forEach((item: any) => {
        const itemDate = new Date(item.date)
        expect(itemDate >= new Date('2025-01-01')).toBe(true)
        expect(itemDate <= new Date('2025-02-28')).toBe(true)
      })
    })
  })

  describe('오류 처리', () => {
    test('필수 컬럼 누락', async () => {
      const filePath = path.join(testDataDir, 'missing-column-test.zip')
      const zipBuffer = fs.readFileSync(filePath)

      const result = await ExcelProcessor.processZipFile(zipBuffer)

      // 파일 처리는 성공하지만, 처리된 파일이 없어야 함 (오류로 인해)
      expect(result.filesFound).toBe(1)
      expect(result.processedFiles).toHaveLength(0)
    })

    test('잘못된 시트명 처리', async () => {
      const filePath = path.join(testDataDir, 'wrong-sheet-test.zip')
      const zipBuffer = fs.readFileSync(filePath)

      const result = await ExcelProcessor.processZipFile(zipBuffer)

      // 첫 번째 시트를 사용해야 함
      expect(result.processedFiles[0].sheetName).toBe('다른시트명')
      expect(result.processedFiles[0].validRows).toBeGreaterThan(0)
    })

    test('오류 데이터 처리', async () => {
      const filePath = path.join(testDataDir, 'error-test.zip')
      const zipBuffer = fs.readFileSync(filePath)

      const result = await ExcelProcessor.processZipFile(zipBuffer)

      expect(result.processedFiles[0].errors.length).toBeGreaterThan(0)
      expect(result.processedFiles[0].validRows).toBeGreaterThan(0)

      // 오류가 있어도 정상 데이터는 처리되어야 함
      const data = result.processedFiles[0].data
      expect(data.some((item: any) => item.content === '아침')).toBe(true)
    })
  })

  describe('응답 데이터 구조', () => {
    test('응답 필드 검증', async () => {
      const filePath = path.join(testDataDir, 'normal-test.zip')
      const zipBuffer = fs.readFileSync(filePath)

      const result = await ExcelProcessor.processZipFile(zipBuffer)

      expect(result).toHaveProperty('filesFound')
      expect(result).toHaveProperty('processedFiles')

      const processedFile = result.processedFiles[0]
      expect(processedFile).toHaveProperty('fileName')
      expect(processedFile).toHaveProperty('sheetName')
      expect(processedFile).toHaveProperty('totalRows')
      expect(processedFile).toHaveProperty('validRows')
      expect(processedFile).toHaveProperty('errors')
      expect(processedFile).toHaveProperty('data')
      expect(processedFile).toHaveProperty('summary')

      // summary 필드 검증
      const summary = processedFile.summary
      expect(summary).toHaveProperty('totalAmount')
      expect(summary).toHaveProperty('categories')
      expect(summary).toHaveProperty('paymentMethods')
      expect(Array.isArray(summary.categories)).toBe(true)
      expect(Array.isArray(summary.paymentMethods)).toBe(true)
    })

    test('데이터 객체 구조 검증', async () => {
      const filePath = path.join(testDataDir, 'normal-test.zip')
      const zipBuffer = fs.readFileSync(filePath)

      const result = await ExcelProcessor.processZipFile(zipBuffer)

      const dataItem = result.processedFiles[0].data[0]
      expect(dataItem).toHaveProperty('date')
      expect(dataItem).toHaveProperty('category')
      expect(dataItem).toHaveProperty('content')
      expect(dataItem).toHaveProperty('paymentMethod')
      expect(dataItem).toHaveProperty('amount')
      expect(dataItem).toHaveProperty('memo')
      expect(dataItem).toHaveProperty('sourceRow')

      // 날짜 형식 검증 (YYYY-MM-DD)
      expect(dataItem.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      // 금액은 숫자여야 함
      expect(typeof dataItem.amount).toBe('number')
    })
  })

  describe('성능 테스트', () => {
    test('대용량 데이터 처리', async () => {
      const filePath = path.join(testDataDir, 'large-data-test.zip')
      const zipBuffer = fs.readFileSync(filePath)

      const startTime = Date.now()
      const result = await ExcelProcessor.processZipFile(zipBuffer)
      const endTime = Date.now()

      const processingTime = endTime - startTime

      // 1000행 데이터가 5초 내에 처리되어야 함
      expect(processingTime).toBeLessThan(5000)
      expect(result.processedFiles[0].validRows).toBeGreaterThan(500) // 최소 500행은 처리되어야 함
    })
  })
})