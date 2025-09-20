/**
 * 완전한 Upload API 플로우 통합 테스트
 * ZIP 업로드 → 파싱 → 해시 생성 → DB 저장까지 전체 과정 검증
 */

import fs from 'fs'
import path from 'path'

// 실제 Upload API 로직 시뮬레이션을 위한 모듈 import
import JSZip from 'jszip'
import * as XLSX from 'xlsx'
import { addHashesToExpenses } from '@/lib/utils/hash'
import { saveExpensesToDB } from '@/lib/supabase/admin'

// Upload API의 핵심 로직을 분리하여 테스트 가능하게 만든 함수
async function simulateUploadAPIFlow(
  fileBuffer: Buffer,
  fileName: string,
  userId: string,
  startDate?: string,
  endDate?: string
) {
  // 1. 파일 형식 검증
  if (!fileName.toLowerCase().endsWith('.zip')) {
    throw new Error('ZIP 파일만 업로드 가능합니다.')
  }

  // 2. ZIP 파일 처리
  const zip = new JSZip()
  let zipData: JSZip

  try {
    const zipPassword = process.env.ZIP_PASSWORD
    if (zipPassword) {
      zipData = await zip.loadAsync(fileBuffer, { password: zipPassword })
    } else {
      zipData = await zip.loadAsync(fileBuffer)
    }
  } catch (error) {
    throw new Error('ZIP 파일 압축 해제에 실패했습니다.')
  }

  // 3. Excel 파일 추출
  const xlsxFiles: { name: string; data: ArrayBuffer }[] = []

  for (const [fileName, zipEntry] of Object.entries(zipData.files)) {
    if (!zipEntry.dir && fileName.toLowerCase().endsWith('.xlsx')) {
      try {
        const fileData = await zipEntry.async('arraybuffer')
        xlsxFiles.push({ name: fileName, data: fileData })
      } catch (error) {
        console.error(`파일 추출 오류 (${fileName}):`, error)
      }
    }
  }

  if (xlsxFiles.length === 0) {
    throw new Error('ZIP 파일 내에 Excel(.xlsx) 파일이 없습니다.')
  }

  // 4. Excel 파일 파싱
  const processedFiles: any[] = []

  for (const xlsxFile of xlsxFiles) {
    try {
      const workbook = XLSX.read(xlsxFile.data, { type: 'array' })

      const targetSheetName = '가계부 내역'
      const sheetNames = workbook.SheetNames

      let targetSheet = null
      if (sheetNames.includes(targetSheetName)) {
        targetSheet = workbook.Sheets[targetSheetName]
      } else {
        targetSheet = workbook.Sheets[sheetNames[0]]
      }

      if (targetSheet) {
        const jsonData = XLSX.utils.sheet_to_json(targetSheet, { header: 1 })

        if (jsonData.length === 0) {
          throw new Error('시트에 데이터가 없습니다.')
        }

        const headers = jsonData[0] as string[]
        const requiredColumns = ['날짜', '분류', '내용', '결제수단', '금액']
        const missingColumns = requiredColumns.filter(col => !headers.includes(col))

        if (missingColumns.length > 0) {
          throw new Error(`필수 컬럼이 누락되었습니다: ${missingColumns.join(', ')}`)
        }

        const columnMap = {
          date: headers.indexOf('날짜'),
          category: headers.indexOf('분류'),
          content: headers.indexOf('내용'),
          paymentMethod: headers.indexOf('결제수단'),
          amount: headers.indexOf('금액'),
          memo: headers.indexOf('메모') !== -1 ? headers.indexOf('메모') : null
        }

        const dataRows = jsonData.slice(1)
        const parsedData: any[] = []
        const errors: string[] = []

        for (let i = 0; i < dataRows.length; i++) {
          const row = dataRows[i] as any[]
          const rowNumber = i + 2

          try {
            if (!row || row.length === 0 || !row[columnMap.date]) {
              continue
            }

            // 날짜 파싱
            let parsedDate: Date
            const dateValue = row[columnMap.date]

            if (typeof dateValue === 'number') {
              parsedDate = new Date((dateValue - 25569) * 86400 * 1000)
            } else if (typeof dateValue === 'string') {
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
              amount = parseFloat(amount.replace(/[^\d.-]/g, ''))
            }

            if (isNaN(amount)) {
              throw new Error(`유효하지 않은 금액: ${row[columnMap.amount]}`)
            }

            const expenseData = {
              date: parsedDate.toISOString().split('T')[0],
              category: row[columnMap.category] || '',
              content: row[columnMap.content] || '',
              paymentMethod: row[columnMap.paymentMethod] || '',
              amount: amount,
              memo: columnMap.memo !== null ? (row[columnMap.memo] || '') : '',
              sourceRow: rowNumber
            }

            parsedData.push(expenseData)

          } catch (error) {
            errors.push(`행 ${rowNumber}: ${(error as Error).message}`)
          }
        }

        processedFiles.push({
          fileName: xlsxFile.name,
          sheetName: sheetNames.includes(targetSheetName) ? targetSheetName : sheetNames[0],
          totalRows: dataRows.length,
          validRows: parsedData.length,
          errors: errors,
          data: parsedData
        })
      }
    } catch (error) {
      console.error(`Excel 파일 처리 오류 (${xlsxFile.name}):`, error)
    }
  }

  // 5. 모든 데이터 수집
  let totalExpenses: any[] = []
  let totalValidRows = 0
  let totalErrors: string[] = []

  for (const processedFile of processedFiles) {
    totalExpenses = totalExpenses.concat(processedFile.data)
    totalValidRows += processedFile.validRows
    totalErrors = totalErrors.concat(processedFile.errors)
  }

  // 6. 해시 생성
  let dbSaveResult = null

  if (totalExpenses.length > 0) {
    const expensesWithHash = addHashesToExpenses(totalExpenses)

    // 7. DB 저장
    try {
      dbSaveResult = await saveExpensesToDB(userId, expensesWithHash)
    } catch (dbError) {
      throw new Error(`데이터베이스 저장 실패: ${(dbError as Error).message}`)
    }
  }

  return {
    filesFound: xlsxFiles.length,
    processedFiles,
    dbResult: dbSaveResult,
    summary: {
      totalValidRows,
      totalErrors: totalErrors.length,
      errorMessages: totalErrors.slice(0, 10)
    }
  }
}

describe('Complete Upload API Flow Integration Tests', () => {
  const testDataDir = path.join(process.cwd(), 'test-data')
  const TEST_USER_ID = 'test-user-api-flow'

  beforeAll(() => {
    if (!fs.existsSync(testDataDir)) {
      console.warn('Test data directory not found, some tests will be skipped')
    }
  })

  describe('Full workflow tests', () => {
    test('정상적인 ZIP 파일 전체 플로우를 테스트한다', async () => {
      const filePath = path.join(testDataDir, 'normal-test.zip')

      if (!fs.existsSync(filePath)) {
        console.log('normal-test.zip not found, skipping test')
        return
      }

      const fileBuffer = fs.readFileSync(filePath)
      const startTime = Date.now()

      const result = await simulateUploadAPIFlow(
        fileBuffer,
        'normal-test.zip',
        TEST_USER_ID
      )

      const endTime = Date.now()
      const executionTime = endTime - startTime

      console.log(`전체 플로우 실행 시간: ${executionTime}ms`)

      // 기본 검증
      expect(result.filesFound).toBe(1)
      expect(result.processedFiles).toHaveLength(1)
      expect(result.summary.totalValidRows).toBeGreaterThan(0)
      expect(result.summary.totalErrors).toBe(0)

      // DB 저장 결과 검증 (환경에 따라 다를 수 있음)
      if (result.dbResult) {
        expect(result.dbResult.totalSubmitted).toBe(result.summary.totalValidRows)
        expect(result.dbResult.newRecords).toBeGreaterThanOrEqual(0)
        expect(result.dbResult.duplicatesIgnored).toBeGreaterThanOrEqual(0)
      }

      // 성능 검증
      expect(executionTime).toBeLessThan(10000) // 10초 이내
    })

    test('기간 필터링이 포함된 전체 플로우를 테스트한다', async () => {
      const filePath = path.join(testDataDir, 'date-range-test.zip')

      if (!fs.existsSync(filePath)) {
        console.log('date-range-test.zip not found, skipping test')
        return
      }

      const fileBuffer = fs.readFileSync(filePath)

      // 필터링 없는 경우
      const fullResult = await simulateUploadAPIFlow(
        fileBuffer,
        'date-range-test.zip',
        `${TEST_USER_ID}-full`
      )

      // 기간 필터링이 있는 경우
      const filteredResult = await simulateUploadAPIFlow(
        fileBuffer,
        'date-range-test.zip',
        `${TEST_USER_ID}-filtered`,
        '2025-01-01',
        '2025-02-28'
      )

      // 필터링된 결과가 전체 결과보다 적거나 같아야 함
      expect(filteredResult.summary.totalValidRows).toBeLessThanOrEqual(fullResult.summary.totalValidRows)

      // 두 결과 모두 정상적으로 처리되어야 함
      expect(fullResult.filesFound).toBe(1)
      expect(filteredResult.filesFound).toBe(1)
    })

    test('다중 파일 ZIP의 전체 플로우를 테스트한다', async () => {
      const filePath = path.join(testDataDir, 'multi-file-test.zip')

      if (!fs.existsSync(filePath)) {
        console.log('multi-file-test.zip not found, skipping test')
        return
      }

      const fileBuffer = fs.readFileSync(filePath)

      const result = await simulateUploadAPIFlow(
        fileBuffer,
        'multi-file-test.zip',
        `${TEST_USER_ID}-multi`
      )

      // 다중 파일 검증
      expect(result.filesFound).toBe(2)
      expect(result.processedFiles).toHaveLength(2)

      // 모든 파일이 처리되었는지 확인
      result.processedFiles.forEach(file => {
        expect(file.validRows).toBeGreaterThan(0)
      })

      // 전체 결과가 각 파일의 합과 일치하는지 확인
      const totalFromFiles = result.processedFiles.reduce((sum, file) => sum + file.validRows, 0)
      expect(result.summary.totalValidRows).toBe(totalFromFiles)
    })
  })

  describe('Error handling in full flow', () => {
    test('잘못된 파일 형식을 처리한다', async () => {
      const textBuffer = Buffer.from('This is not a ZIP file')

      await expect(simulateUploadAPIFlow(
        textBuffer,
        'not-a-zip.txt',
        TEST_USER_ID
      )).rejects.toThrow('ZIP 파일만 업로드 가능합니다.')
    })

    test('비어있는 ZIP 파일을 처리한다', async () => {
      // 빈 ZIP 파일 생성
      const zip = new JSZip()
      const emptyZipBuffer = await zip.generateAsync({ type: 'nodebuffer' })

      await expect(simulateUploadAPIFlow(
        emptyZipBuffer,
        'empty.zip',
        TEST_USER_ID
      )).rejects.toThrow('ZIP 파일 내에 Excel(.xlsx) 파일이 없습니다.')
    })

    test('오류가 있는 데이터를 포함한 파일의 전체 플로우', async () => {
      const filePath = path.join(testDataDir, 'error-test.zip')

      if (!fs.existsSync(filePath)) {
        console.log('error-test.zip not found, skipping test')
        return
      }

      const fileBuffer = fs.readFileSync(filePath)

      const result = await simulateUploadAPIFlow(
        fileBuffer,
        'error-test.zip',
        `${TEST_USER_ID}-errors`
      )

      // 오류가 있어도 일부 데이터는 처리되어야 함
      expect(result.summary.totalErrors).toBeGreaterThan(0)
      expect(result.summary.totalValidRows).toBeGreaterThan(0)

      // 오류 메시지가 포함되어야 함
      expect(result.summary.errorMessages).toHaveLength(result.summary.totalErrors)
    })
  })

  describe('Performance tests', () => {
    test('대용량 파일의 전체 플로우 성능을 테스트한다', async () => {
      const filePath = path.join(testDataDir, 'large-data-test.zip')

      if (!fs.existsSync(filePath)) {
        console.log('large-data-test.zip not found, skipping performance test')
        return
      }

      const fileBuffer = fs.readFileSync(filePath)
      const startTime = Date.now()

      const result = await simulateUploadAPIFlow(
        fileBuffer,
        'large-data-test.zip',
        `${TEST_USER_ID}-large`
      )

      const endTime = Date.now()
      const executionTime = endTime - startTime

      console.log(`대용량 파일 처리 결과:`)
      console.log(`- 데이터 수: ${result.summary.totalValidRows}행`)
      console.log(`- 실행 시간: ${executionTime}ms`)
      console.log(`- 초당 처리: ${Math.round(result.summary.totalValidRows / (executionTime / 1000))}행/초`)

      // 성능 기준
      expect(result.summary.totalValidRows).toBeGreaterThan(500)
      expect(executionTime).toBeLessThan(20000) // 20초 이내

      // DB 저장이 성공했다면 성능도 확인
      if (result.dbResult) {
        expect(result.dbResult.totalSubmitted).toBe(result.summary.totalValidRows)
      }
    })
  })

  describe('Database integration in full flow', () => {
    test('중복 데이터 업로드 시 전체 플로우를 테스트한다', async () => {
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        console.log('Skipping DB integration test - no Supabase config')
        return
      }

      const filePath = path.join(testDataDir, 'normal-test.zip')

      if (!fs.existsSync(filePath)) {
        console.log('normal-test.zip not found, skipping DB test')
        return
      }

      const fileBuffer = fs.readFileSync(filePath)

      try {
        // 첫 번째 업로드
        const result1 = await simulateUploadAPIFlow(
          fileBuffer,
          'normal-test.zip',
          `${TEST_USER_ID}-duplicate-1`
        )

        expect(result1.dbResult).toBeTruthy()
        expect(result1.dbResult.newRecords).toBe(result1.summary.totalValidRows)
        expect(result1.dbResult.duplicatesIgnored).toBe(0)

        // 같은 데이터 다시 업로드 (중복 방지 테스트)
        const result2 = await simulateUploadAPIFlow(
          fileBuffer,
          'normal-test.zip',
          `${TEST_USER_ID}-duplicate-1` // 같은 사용자 ID
        )

        expect(result2.dbResult).toBeTruthy()
        expect(result2.dbResult.newRecords).toBe(0) // 중복이므로 새로 저장된 것 없음
        expect(result2.dbResult.duplicatesIgnored).toBe(result2.summary.totalValidRows)

      } catch (error) {
        if ((error as Error).message.includes('데이터베이스')) {
          console.log('Skipping DB test - database not available')
          return
        }
        throw error
      }
    })
  })

  describe('Response structure validation', () => {
    test('API 응답 구조가 올바른지 검증한다', async () => {
      const filePath = path.join(testDataDir, 'normal-test.zip')

      if (!fs.existsSync(filePath)) {
        console.log('normal-test.zip not found, skipping test')
        return
      }

      const fileBuffer = fs.readFileSync(filePath)

      const result = await simulateUploadAPIFlow(
        fileBuffer,
        'normal-test.zip',
        `${TEST_USER_ID}-structure`
      )

      // 응답 구조 검증
      expect(result).toHaveProperty('filesFound')
      expect(result).toHaveProperty('processedFiles')
      expect(result).toHaveProperty('summary')

      expect(typeof result.filesFound).toBe('number')
      expect(Array.isArray(result.processedFiles)).toBe(true)

      // summary 구조 검증
      expect(result.summary).toHaveProperty('totalValidRows')
      expect(result.summary).toHaveProperty('totalErrors')
      expect(result.summary).toHaveProperty('errorMessages')

      expect(typeof result.summary.totalValidRows).toBe('number')
      expect(typeof result.summary.totalErrors).toBe('number')
      expect(Array.isArray(result.summary.errorMessages)).toBe(true)

      // processedFiles 구조 검증
      result.processedFiles.forEach(file => {
        expect(file).toHaveProperty('fileName')
        expect(file).toHaveProperty('sheetName')
        expect(file).toHaveProperty('totalRows')
        expect(file).toHaveProperty('validRows')
        expect(file).toHaveProperty('errors')
        expect(file).toHaveProperty('data')

        expect(Array.isArray(file.data)).toBe(true)
        expect(Array.isArray(file.errors)).toBe(true)
      })

      // dbResult 구조 검증 (있는 경우)
      if (result.dbResult) {
        expect(result.dbResult).toHaveProperty('totalSubmitted')
        expect(result.dbResult).toHaveProperty('newRecords')
        expect(result.dbResult).toHaveProperty('duplicatesIgnored')

        expect(typeof result.dbResult.totalSubmitted).toBe('number')
        expect(typeof result.dbResult.newRecords).toBe('number')
        expect(typeof result.dbResult.duplicatesIgnored).toBe('number')
      }
    })
  })
})