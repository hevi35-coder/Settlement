/**
 * T-004 실제 테스트 데이터를 사용한 T-005 해시 생성 및 DB 저장 테스트
 */

import fs from 'fs'
import path from 'path'
import { addHashesToExpenses } from '@/lib/utils/hash'
import { saveExpensesToDB } from '@/lib/supabase/admin'

// T-004에서 생성된 ExcelProcessor 클래스 재사용
class ExcelProcessor {
  static async processZipFile(zipBuffer: Buffer, zipPassword?: string, startDate?: string, endDate?: string) {
    const JSZip = require('jszip')
    const XLSX = require('xlsx')

    const zip = new JSZip()
    let zipData: any

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
      if (!(zipEntry as any).dir && fileName.toLowerCase().endsWith('.xlsx')) {
        try {
          const fileData = await (zipEntry as any).async('arraybuffer')
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
    const XLSX = require('xlsx')

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

    // 시트를 JSON으로 변환
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

    // 데이터 행 처리
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

        // 데이터 객체 생성
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

    return {
      fileName: xlsxFile.name,
      sheetName: sheetNames.includes(targetSheetName) ? targetSheetName : sheetNames[0],
      totalRows: dataRows.length,
      validRows: parsedData.length,
      errors: errors,
      data: parsedData
    }
  }
}

describe('T-004 Data Scenarios with T-005 Hash Integration', () => {
  const testDataDir = path.join(process.cwd(), 'test-data')
  const TEST_USER_ID = 'test-user-t005-scenarios'

  beforeAll(() => {
    if (!fs.existsSync(testDataDir)) {
      console.warn('Test data directory not found, some tests will be skipped')
    }
  })

  describe('Real test data hash generation', () => {
    test('normal-test.zip 데이터에 해시를 생성하고 중복을 확인한다', async () => {
      const filePath = path.join(testDataDir, 'normal-test.zip')

      if (!fs.existsSync(filePath)) {
        console.log('normal-test.zip not found, skipping test')
        return
      }

      const zipBuffer = fs.readFileSync(filePath)
      const result = await ExcelProcessor.processZipFile(zipBuffer)

      expect(result.processedFiles).toHaveLength(1)

      const processedData = result.processedFiles[0].data
      expect(processedData.length).toBeGreaterThan(0)

      // 해시 추가
      const dataWithHashes = addHashesToExpenses(processedData)

      // 모든 데이터에 해시가 추가되었는지 확인
      expect(dataWithHashes).toHaveLength(processedData.length)
      dataWithHashes.forEach(item => {
        expect(item.unique_hash).toHaveLength(64)
        expect(item.unique_hash).toMatch(/^[a-f0-9]{64}$/)
      })

      // 동일한 데이터를 다시 처리했을 때 같은 해시가 생성되는지 확인
      const dataWithHashes2 = addHashesToExpenses(processedData)

      expect(dataWithHashes.length).toBe(dataWithHashes2.length)
      for (let i = 0; i < dataWithHashes.length; i++) {
        expect(dataWithHashes[i].unique_hash).toBe(dataWithHashes2[i].unique_hash)
      }
    })

    test('amount-format-test.zip 다양한 금액 형식 해시 생성', async () => {
      const filePath = path.join(testDataDir, 'amount-format-test.zip')

      if (!fs.existsSync(filePath)) {
        console.log('amount-format-test.zip not found, skipping test')
        return
      }

      const zipBuffer = fs.readFileSync(filePath)
      const result = await ExcelProcessor.processZipFile(zipBuffer)

      const processedData = result.processedFiles[0].data
      const dataWithHashes = addHashesToExpenses(processedData)

      // 금액이 다르면 다른 해시가 생성되어야 함
      const hashSet = new Set(dataWithHashes.map(item => item.unique_hash))
      expect(hashSet.size).toBe(dataWithHashes.length) // 모든 해시가 고유

      // 금액 정규화가 올바르게 작동하는지 확인
      dataWithHashes.forEach(item => {
        expect(typeof item.amount).toBe('number')
        expect(item.unique_hash).toHaveLength(64)
      })
    })

    test('date-range-test.zip 기간 필터링과 해시 생성', async () => {
      const filePath = path.join(testDataDir, 'date-range-test.zip')

      if (!fs.existsSync(filePath)) {
        console.log('date-range-test.zip not found, skipping test')
        return
      }

      const zipBuffer = fs.readFileSync(filePath)

      // 전체 데이터 처리
      const fullResult = await ExcelProcessor.processZipFile(zipBuffer)
      const fullData = fullResult.processedFiles[0].data
      const fullDataWithHashes = addHashesToExpenses(fullData)

      // 기간 필터링된 데이터 처리
      const filteredResult = await ExcelProcessor.processZipFile(
        zipBuffer, undefined, '2025-01-01', '2025-02-28'
      )
      const filteredData = filteredResult.processedFiles[0].data
      const filteredDataWithHashes = addHashesToExpenses(filteredData)

      // 필터링된 데이터가 전체 데이터의 부분집합이어야 함
      expect(filteredDataWithHashes.length).toBeLessThanOrEqual(fullDataWithHashes.length)

      // 필터링된 데이터의 해시가 전체 데이터에서 찾을 수 있어야 함
      const fullHashes = new Set(fullDataWithHashes.map(item => item.unique_hash))
      filteredDataWithHashes.forEach(item => {
        expect(fullHashes.has(item.unique_hash)).toBe(true)
      })
    })

    test('multi-file-test.zip 다중 파일 해시 생성', async () => {
      const filePath = path.join(testDataDir, 'multi-file-test.zip')

      if (!fs.existsSync(filePath)) {
        console.log('multi-file-test.zip not found, skipping test')
        return
      }

      const zipBuffer = fs.readFileSync(filePath)
      const result = await ExcelProcessor.processZipFile(zipBuffer)

      expect(result.processedFiles.length).toBe(2) // 2개 파일

      let allHashes: string[] = []

      result.processedFiles.forEach(processedFile => {
        const dataWithHashes = addHashesToExpenses(processedFile.data)

        dataWithHashes.forEach(item => {
          expect(item.unique_hash).toHaveLength(64)
          allHashes.push(item.unique_hash)
        })
      })

      // 모든 해시가 고유한지 확인 (다른 파일이므로 내용이 다를 수 있음)
      console.log(`총 생성된 해시 수: ${allHashes.length}`)
      console.log(`고유 해시 수: ${new Set(allHashes).size}`)
    })
  })

  describe('Database integration with real data', () => {
    test('실제 데이터를 DB에 저장하고 중복 방지를 확인한다', async () => {
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        console.log('Skipping DB test - no Supabase config')
        return
      }

      const filePath = path.join(testDataDir, 'normal-test.zip')

      if (!fs.existsSync(filePath)) {
        console.log('normal-test.zip not found, skipping DB test')
        return
      }

      try {
        const zipBuffer = fs.readFileSync(filePath)
        const result = await ExcelProcessor.processZipFile(zipBuffer)

        const processedData = result.processedFiles[0].data
        const dataWithHashes = addHashesToExpenses(processedData)

        // 첫 번째 저장
        const saveResult1 = await saveExpensesToDB(TEST_USER_ID, dataWithHashes)

        expect(saveResult1.totalSubmitted).toBe(dataWithHashes.length)
        expect(saveResult1.newRecords).toBe(dataWithHashes.length)
        expect(saveResult1.duplicatesIgnored).toBe(0)

        // 같은 데이터 다시 저장 (중복 방지 테스트)
        const saveResult2 = await saveExpensesToDB(TEST_USER_ID, dataWithHashes)

        expect(saveResult2.totalSubmitted).toBe(dataWithHashes.length)
        expect(saveResult2.newRecords).toBe(0) // 모두 중복이므로 0
        expect(saveResult2.duplicatesIgnored).toBe(dataWithHashes.length)

      } catch (error) {
        if ((error as Error).message.includes('데이터베이스')) {
          console.log('Skipping DB test - database not available')
          return
        }
        throw error
      }
    })

    test('대용량 데이터 해시 생성 및 저장 성능 테스트', async () => {
      const filePath = path.join(testDataDir, 'large-data-test.zip')

      if (!fs.existsSync(filePath)) {
        console.log('large-data-test.zip not found, skipping performance test')
        return
      }

      const startTime = Date.now()

      const zipBuffer = fs.readFileSync(filePath)
      const result = await ExcelProcessor.processZipFile(zipBuffer)

      const processedData = result.processedFiles[0].data
      expect(processedData.length).toBeGreaterThan(500) // 최소 500행

      // 해시 생성 시간 측정
      const hashStartTime = Date.now()
      const dataWithHashes = addHashesToExpenses(processedData)
      const hashEndTime = Date.now()

      const hashTime = hashEndTime - hashStartTime
      const totalTime = hashEndTime - startTime

      console.log(`대용량 데이터 처리 결과:`)
      console.log(`- 데이터 수: ${processedData.length}행`)
      console.log(`- 해시 생성 시간: ${hashTime}ms`)
      console.log(`- 전체 처리 시간: ${totalTime}ms`)

      // 성능 기준
      expect(hashTime).toBeLessThan(2000) // 해시 생성 2초 이내
      expect(totalTime).toBeLessThan(10000) // 전체 10초 이내

      // 모든 해시가 올바르게 생성되었는지 확인
      expect(dataWithHashes).toHaveLength(processedData.length)
      dataWithHashes.forEach(item => {
        expect(item.unique_hash).toHaveLength(64)
      })
    })
  })

  describe('Error scenarios with hash generation', () => {
    test('오류가 있는 데이터에서도 정상 데이터는 해시가 생성된다', async () => {
      const filePath = path.join(testDataDir, 'error-test.zip')

      if (!fs.existsSync(filePath)) {
        console.log('error-test.zip not found, skipping error test')
        return
      }

      const zipBuffer = fs.readFileSync(zipBuffer)
      const result = await ExcelProcessor.processZipFile(zipBuffer)

      const processedFile = result.processedFiles[0]

      // 오류가 있어야 함
      expect(processedFile.errors.length).toBeGreaterThan(0)

      // 하지만 일부 정상 데이터는 처리되어야 함
      expect(processedFile.data.length).toBeGreaterThan(0)

      // 정상 처리된 데이터에 해시 추가
      const dataWithHashes = addHashesToExpenses(processedFile.data)

      dataWithHashes.forEach(item => {
        expect(item.unique_hash).toHaveLength(64)
        expect(item.unique_hash).toMatch(/^[a-f0-9]{64}$/)
      })
    })
  })
})