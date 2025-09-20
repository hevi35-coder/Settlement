const XLSX = require('xlsx')
const fs = require('fs')
const path = require('path')

// 1. 정상 데이터 (기존)
const normalData = [
  ['날짜', '분류', '내용', '결제수단', '금액', '메모'],
  ['2025-01-01', '식비', '점심', '카드', '-12000', ''],
  ['2025-01-02', '교통비', '지하철', '교통카드', '-1400', ''],
  ['2025-01-03', '식비', '저녁', '현금', '-18000', '회식'],
  ['2025-01-04', '생활용품', '마트', '카드', '-45000', '생필품'],
  ['2025-01-05', '문화생활', '영화', '카드', '-15000', ''],
  ['2025-01-06', '식비', '아침', '카드', '-8000', '카페'],
  ['2025-01-07', '의료비', '약국', '카드', '-12000', '감기약'],
  ['2025-01-08', '교통비', '버스', '교통카드', '-1200', ''],
  ['2025-01-09', '식비', '점심', '카드', '-14000', ''],
  ['2025-01-10', '기타', '온라인쇼핑', '카드', '-32000', '옷']
]

// 2. 기간 필터링 테스트용 데이터 (2024년, 2025년 혼재)
const dateRangeData = [
  ['날짜', '분류', '내용', '결제수단', '금액', '메모'],
  ['2024-12-25', '식비', '크리스마스', '카드', '-50000', '가족식사'],
  ['2024-12-31', '문화생활', '송년회', '카드', '-30000', ''],
  ['2025-01-01', '식비', '신년', '카드', '-20000', '떡국'],
  ['2025-01-15', '교통비', '지하철', '교통카드', '-1400', ''],
  ['2025-02-01', '생활용품', '마트', '카드', '-45000', '생필품'],
  ['2025-02-14', '문화생활', '발렌타인', '카드', '-25000', ''],
  ['2025-03-01', '의료비', '병원', '카드', '-15000', ''],
  ['2025-12-31', '식비', '송년', '카드', '-40000', '송년회']
]

// 3. 다양한 금액 형식 테스트
const amountFormatData = [
  ['날짜', '분류', '내용', '결제수단', '금액', '메모'],
  ['2025-01-01', '식비', '점심', '카드', '-12,000', '콤마 포함'],
  ['2025-01-02', '교통비', '지하철', '교통카드', '1400', '양수'],
  ['2025-01-03', '식비', '저녁', '현금', '-18000원', '원화 기호'],
  ['2025-01-04', '생활용품', '마트', '카드', '  -45000  ', '공백 포함'],
  ['2025-01-05', '문화생활', '영화', '카드', '-15,000원', '콤마+원화'],
  ['2025-01-06', '식비', '아침', '카드', 8000, '숫자타입'],
  ['2025-01-07', '의료비', '약국', '카드', '-12.5', '소수점']
]

// 4. 오류 케이스 데이터
const errorData = [
  ['날짜', '분류', '내용', '결제수단', '금액', '메모'],
  ['잘못된날짜', '식비', '점심', '카드', '-12000', '잘못된 날짜'],
  ['2025-01-02', '교통비', '지하철', '교통카드', '잘못된금액', '잘못된 금액'],
  ['', '식비', '저녁', '현금', '-18000', '빈 날짜'],
  ['2025-01-04', '', '', '', '', '빈 필드들'],
  [], // 완전히 빈 행
  ['2025-01-06', '식비', '아침', '카드', '-8000', '정상'],
  [null, null, null, null, null, null] // null 행
]

// 5. 필수 컬럼 누락 데이터
const missingColumnData = [
  ['날짜', '내용', '결제수단', '금액'], // '분류' 컬럼 누락
  ['2025-01-01', '점심', '카드', '-12000'],
  ['2025-01-02', '지하철', '교통카드', '-1400']
]

// 6. 대용량 데이터 생성
const generateLargeData = () => {
  const data = [['날짜', '분류', '내용', '결제수단', '금액', '메모']]
  const categories = ['식비', '교통비', '생활용품', '문화생활', '의료비', '기타']
  const paymentMethods = ['카드', '현금', '교통카드', '계좌이체']
  const contents = ['점심', '저녁', '아침', '간식', '마트', '쇼핑', '병원', '영화']

  for (let i = 1; i <= 1000; i++) {
    const date = new Date(2025, 0, 1 + (i % 365))
    const category = categories[i % categories.length]
    const content = contents[i % contents.length]
    const paymentMethod = paymentMethods[i % paymentMethods.length]
    const amount = -(Math.floor(Math.random() * 50000) + 1000)

    data.push([
      date.toISOString().split('T')[0],
      category,
      content,
      paymentMethod,
      amount.toString(),
      i % 10 === 0 ? '메모' + i : ''
    ])
  }
  return data
}

// 테스트 파일 생성 함수
const createTestFile = (data, fileName, sheetName = '가계부 내역') => {
  const workbook = XLSX.utils.book_new()
  const worksheet = XLSX.utils.aoa_to_sheet(data)
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)

  const testDataDir = path.join(__dirname, '..', 'test-data')
  if (!fs.existsSync(testDataDir)) {
    fs.mkdirSync(testDataDir, { recursive: true })
  }

  const excelPath = path.join(testDataDir, fileName)
  XLSX.writeFile(workbook, excelPath)
  return excelPath
}

// ZIP 파일 생성 함수
const createZipFile = async (excelFiles, zipFileName, password = null) => {
  const JSZip = require('jszip')
  const zip = new JSZip()

  // Excel 파일들을 ZIP에 추가
  excelFiles.forEach(filePath => {
    const fileName = path.basename(filePath)
    const excelBuffer = fs.readFileSync(filePath)
    zip.file(fileName, excelBuffer)
  })

  const testDataDir = path.join(__dirname, '..', 'test-data')
  const zipPath = path.join(testDataDir, zipFileName)

  try {
    const content = await zip.generateAsync({
      type: 'nodebuffer',
      compression: "DEFLATE",
      compressionOptions: { level: 9 }
    })

    fs.writeFileSync(zipPath, content)
    console.log(`ZIP 파일 생성: ${zipPath}`)
    return zipPath
  } catch (err) {
    console.error(`ZIP 파일 생성 오류 (${zipFileName}):`, err)
    throw err
  }
}

// 모든 테스트 파일 생성
const main = async () => {
  try {
    console.log('테스트 파일 생성 시작...')

    // 1. 정상 데이터
    const normalFile = createTestFile(normalData, 'normal-data.xlsx')
    console.log('✅ 정상 데이터:', normalFile)

    // 2. 기간 필터링 테스트용
    const dateRangeFile = createTestFile(dateRangeData, 'date-range-data.xlsx')
    console.log('✅ 기간 필터링 테스트:', dateRangeFile)

    // 3. 다양한 금액 형식
    const amountFormatFile = createTestFile(amountFormatData, 'amount-format-data.xlsx')
    console.log('✅ 금액 형식 테스트:', amountFormatFile)

    // 4. 오류 케이스
    const errorFile = createTestFile(errorData, 'error-data.xlsx')
    console.log('✅ 오류 케이스:', errorFile)

    // 5. 필수 컬럼 누락
    const missingColumnFile = createTestFile(missingColumnData, 'missing-column-data.xlsx')
    console.log('✅ 필수 컬럼 누락:', missingColumnFile)

    // 6. 시트명 없는 파일 (다른 시트명 사용)
    const wrongSheetFile = createTestFile(normalData, 'wrong-sheet-name.xlsx', '다른시트명')
    console.log('✅ 잘못된 시트명:', wrongSheetFile)

    // 7. 대용량 데이터
    const largeData = generateLargeData()
    const largeFile = createTestFile(largeData, 'large-data.xlsx')
    console.log('✅ 대용량 데이터 (1000행):', largeFile)

    // ZIP 파일들 생성
    console.log('\nZIP 파일 생성 중...')

    // 정상 ZIP (비밀번호 없음)
    await createZipFile([normalFile], 'normal-test.zip')

    // 기간 필터링 ZIP
    await createZipFile([dateRangeFile], 'date-range-test.zip')

    // 금액 형식 ZIP
    await createZipFile([amountFormatFile], 'amount-format-test.zip')

    // 오류 케이스 ZIP
    await createZipFile([errorFile], 'error-test.zip')

    // 필수 컬럼 누락 ZIP
    await createZipFile([missingColumnFile], 'missing-column-test.zip')

    // 시트명 오류 ZIP
    await createZipFile([wrongSheetFile], 'wrong-sheet-test.zip')

    // 다중 파일 ZIP
    await createZipFile([normalFile, dateRangeFile], 'multi-file-test.zip')

    // 대용량 ZIP
    await createZipFile([largeFile], 'large-data-test.zip')

    // 기존 호환성을 위한 파일
    await createZipFile([normalFile], 'test-upload.zip')

    console.log('\n🎉 모든 테스트 파일 생성 완료!')
    console.log('\n📁 생성된 파일들:')
    console.log('- 정상 데이터: normal-test.zip')
    console.log('- 기간 필터링: date-range-test.zip')
    console.log('- 금액 형식: amount-format-test.zip')
    console.log('- 오류 케이스: error-test.zip')
    console.log('- 컬럼 누락: missing-column-test.zip')
    console.log('- 시트명 오류: wrong-sheet-test.zip')
    console.log('- 다중 파일: multi-file-test.zip')
    console.log('- 대용량: large-data-test.zip')
    console.log('- 기존 호환: test-upload.zip')

  } catch (error) {
    console.error('테스트 파일 생성 중 오류:', error)
    process.exit(1)
  }
}

// 실행
main()