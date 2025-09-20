import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { saveExpensesToDB } from '@/lib/supabase/admin'
import { addHashesToExpenses } from '@/lib/utils/hash'
import JSZip from 'jszip'
import * as XLSX from 'xlsx'

export async function POST(request: NextRequest) {
  try {
    // 인증 확인
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      )
    }

    // FormData에서 ZIP 파일과 기간 정보 추출
    const formData = await request.formData()
    const file = formData.get('file') as File
    const startDate = formData.get('startDate') as string
    const endDate = formData.get('endDate') as string

    if (!file) {
      return NextResponse.json(
        { error: '파일이 선택되지 않았습니다.' },
        { status: 400 }
      )
    }

    // ZIP 파일 형식 확인
    if (!file.name.toLowerCase().endsWith('.zip')) {
      return NextResponse.json(
        { error: 'ZIP 파일만 업로드 가능합니다.' },
        { status: 400 }
      )
    }

    // 파일 크기 제한 (10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: '파일 크기는 10MB를 초과할 수 없습니다.' },
        { status: 400 }
      )
    }

    // ZIP 파일을 ArrayBuffer로 읽기
    const arrayBuffer = await file.arrayBuffer()

    // JSZip으로 ZIP 파일 로드
    const zip = new JSZip()
    let zipData: JSZip

    try {
      // 환경변수에서 ZIP 비밀번호 가져오기
      const zipPassword = process.env.ZIP_PASSWORD

      if (zipPassword) {
        // 비밀번호가 있는 경우 (JSZip에서는 loadAsync의 options에 password 전달)
        zipData = await zip.loadAsync(arrayBuffer, { password: zipPassword })
      } else {
        // 비밀번호가 없는 경우
        zipData = await zip.loadAsync(arrayBuffer)
      }
    } catch (error) {
      console.error('ZIP 파일 압축 해제 오류:', error)
      return NextResponse.json(
        { error: 'ZIP 파일 압축 해제에 실패했습니다. 비밀번호를 확인해주세요.' },
        { status: 400 }
      )
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
      return NextResponse.json(
        { error: 'ZIP 파일 내에 Excel(.xlsx) 파일이 없습니다.' },
        { status: 400 }
      )
    }

    // Excel 파일들 처리
    const processedFiles: any[] = []

    for (const xlsxFile of xlsxFiles) {
      try {
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

        if (targetSheet) {
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

          processedFiles.push({
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
          })
        }
      } catch (error) {
        console.error(`Excel 파일 처리 오류 (${xlsxFile.name}):`, error)
      }
    }

    // 모든 처리된 파일의 데이터를 수집하여 DB에 저장
    let totalExpenses: any[] = []
    let totalValidRows = 0
    let totalErrors: string[] = []

    for (const processedFile of processedFiles) {
      totalExpenses = totalExpenses.concat(processedFile.data)
      totalValidRows += processedFile.validRows
      totalErrors = totalErrors.concat(processedFile.errors)
    }

    let dbSaveResult = null

    if (totalExpenses.length > 0) {
      try {
        // 해시 추가
        const expensesWithHash = addHashesToExpenses(totalExpenses)

        // DB에 저장
        dbSaveResult = await saveExpensesToDB(user.id, expensesWithHash)
      } catch (dbError) {
        console.error('DB 저장 오류:', dbError)
        return NextResponse.json({
          message: '파일 처리는 완료되었지만 데이터베이스 저장에 실패했습니다.',
          error: dbError instanceof Error ? dbError.message : '알 수 없는 오류',
          userId: user.id,
          uploadedFile: file.name,
          filesFound: xlsxFiles.length,
          processedFiles
        }, { status: 500 })
      }
    }

    return NextResponse.json({
      message: 'ZIP 파일이 성공적으로 처리되고 데이터베이스에 저장되었습니다.',
      userId: user.id,
      uploadedFile: file.name,
      filesFound: xlsxFiles.length,
      processedFiles,
      dbResult: dbSaveResult ? {
        totalSubmitted: dbSaveResult.totalSubmitted,
        newRecords: dbSaveResult.newRecords,
        duplicatesIgnored: dbSaveResult.duplicatesIgnored
      } : null,
      summary: {
        totalValidRows,
        totalErrors: totalErrors.length,
        errorMessages: totalErrors.slice(0, 10) // 최대 10개의 오류 메시지만 반환
      }
    })

  } catch (error) {
    console.error('파일 업로드 처리 오류:', error)
    return NextResponse.json(
      { error: '파일 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}