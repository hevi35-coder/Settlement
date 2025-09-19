TRD: 월말정산 자동화 대시보드 
1. 시스템 아키텍처 (System Architecture)
 * 통합 프레임워크: Next.js (React 기반) - UI(프론트엔드)와 API(백엔드) 통합 관리
 * 배포/실행 환경: Vercel - Next.js 애플리케이션 배포 및 서버리스 함수 실행
 * 데이터베이스 & BaaS: Supabase - PostgreSQL 데이터베이스, 데이터 API, 인증 기능 제공
작동 흐름:
 * 사용자 접속: 사용자는 Vercel에 배포된 Next.js 웹 앱에 접속합니다.
 * 파일 업로드: 사용자가 zip 파일을 업로드하면, Next.js API Route (/api/upload)가 Vercel 서버리스 함수로 실행됩니다.
 * 데이터 처리 및 저장: API 함수는 파일을 처리하여 Supabase 데이터베이스에 저장합니다.
 * 데이터 조회 및 표시: 사용자의 화면(클라이언트)은 Supabase에서 지정된 기간의 모든 지출 내역을 조회하여 화면에 렌더링합니다.
2. 기술 스택 (Tech Stack)
 * 프레임워크: Next.js 14+ (App Router 권장)
 * UI: Shadcn/ui
   * 설명: UI 라이브러리가 아닌, 재사용 가능한 컴포넌트 모음입니다. CLI를 통해 필요한 컴포넌트의 코드를 프로젝트에 직접 추가하는 방식입니다.
   * 기반 기술: Tailwind CSS (스타일링), Radix UI (동작 및 접근성), Lucide React (아이콘)
 * 백엔드: Vercel Serverless Functions (Node.js 런타임)
 * 데이터베이스: Supabase (PostgreSQL)
 * 핵심 라이브러리:
   * @supabase/supabase-js: Supabase DB 연동 클라이언트
   * jszip: ZIP 파일 처리
   * xlsx: 엑셀(.xlsx) 파일 파싱
   * swr 또는 react-query: 클라이언트 사이드 데이터 Fetching 및 상태 관리
3. 데이터 모델 (Data Model)
Supabase 대시보드에서 생성할 테이블 구조입니다. (이전 버전과 동일)
-- 사용자 설정 (향후 인증 기능 도입 시 사용)
CREATE TABLE public.settings (
    id UUID PRIMARY KEY DEFAULT auth.uid(),
    salary INT DEFAULT 0,
    fixed_expense INT DEFAULT 0
);

-- 공용지출 원본 데이터
CREATE TABLE public.shared_expenses (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    expense_date DATE NOT NULL,
    type TEXT,
    category_main TEXT,
    category_sub TEXT,
    content TEXT NOT NULL,
    amount INT NOT NULL,
    memo TEXT,
    payment_method TEXT,
    unique_hash TEXT UNIQUE NOT NULL, -- 중복 저장을 방지하기 위한 해시값
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 정산 이력 요약
CREATE TABLE public.calculation_history (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    confirmed_at TIMESTAMPTZ DEFAULT now(),
    salary_snapshot INT NOT NULL,
    fixed_expense_snapshot INT NOT NULL,
    shared_expense_total INT NOT NULL,
    final_transfer_amount INT NOT NULL,
    details_snapshot JSONB -- 정산에 포함된 상세 내역 (수정된 메모 포함)
);

4. API 엔드포인트 명세 (API Endpoint Specifications)
Next.js API Routes로 구현됩니다. (이전 버전과 동일)
| 기능 | HTTP Method | Endpoint | Request | Response |
|---|---|---|---|---|
| 파일 업로드 및 처리 | POST | /api/upload | FormData (zip 파일) | {"message": "신규 내역 N건 처리 완료"} 또는 에러 메시지 |
| 기간별 지출 조회 | GET | /api/expenses | Query: startDate, endDate | [{"id": 1, "expense_date": ...}] 또는 에러 메시지 |
| 정산 내역 확정 | POST | /api/history | Body: { "summary": {...}, "details": [...] } | {"message": "정산 내역 저장 완료"} 또는 에러 메시지 |
5. 핵심 로직 구현 상세 (Core Logic Implementation)
5.1. 백엔드 로직 (Vercel Serverless Functions)
 * 파일 처리 로직 (/api/upload): (이전 버전과 동일)
   * API는 multipart/form-data 형식으로 zip 파일을 수신합니다.
   * 환경 변수에 저장된 비밀번호를 사용하여 jszip 라이브러리로 메모리상에서 압축을 해제합니다.
   * 압축 해제된 .xlsx 파일을 찾아 xlsx 라이브러리로 파싱하여 JSON 데이터로 변환합니다.
   * 각 데이터 행(row)에 대해 unique_hash (예: hash(날짜+내용+금액))를 생성합니다.
   * Supabase Admin 클라이언트를 사용하여 upsert 기능으로 unique_hash 기준 중복되지 않은 데이터만 shared_expenses 테이블에 저장합니다.
 * 지출 내역 조회 로직 (/api/expenses): (이전 버전과 동일)
   * startDate, endDate 쿼리 파라미터를 수신합니다.
   * Supabase 클라이언트를 사용하여 shared_expenses 테이블에서 expense_date가 두 날짜 사이에 있는 모든 레코드를 조회하여 반환합니다.
5.2. 프론트엔드 로직 (React / Shadcn/ui)
 * 데이터 상태 관리: (이전 버전과 동일)
   * API로 조회한 지출 내역 배열을 React 상태(state)로 관리합니다.
   * 각 지출 항목 객체는 ...originalData, isChecked: false, currentMemo: originalData.memo || '' 와 같은 구조를 가집니다.
 * UI 컴포넌트 구현 (Shadcn/ui):
   * 지출 목록: Shadcn/ui의 Table 컴포넌트를 사용합니다. (Table, TableHeader, TableRow, TableHead, TableBody, TableCell)
   * 체크박스: 각 행의 첫 번째 셀에 Checkbox 컴포넌트를 사용합니다.
   * 메모 입력: 메모 셀 내부에 Input 컴포넌트를 배치하여 인라인(in-line) 수정을 구현합니다.
   * 상세 정보 팝업: 각 행 클릭 시 Dialog 컴포넌트(DialogTrigger, DialogContent 등)를 사용하여 상세 정보를 표시합니다.
 * 사용자 인터랙션 및 계산 로직:
   * 초기 상태: 모든 항목의 체크박스는 체크 해제 상태로 렌더링됩니다.
   * 체크박스 클릭: onCheckedChange 이벤트 발생 시, 해당 항목의 isChecked 상태를 토글하고, 즉시 전체 합산 금액을 재계산하여 화면을 업데이트합니다.
   * 메모 수정: 메모 Input의 onChange 이벤트 발생 시, 아래 두 가지 상태 업데이트를 동시에 수행합니다.
     * 해당 항목의 currentMemo 상태를 사용자 입력값으로 변경합니다.
     * 해당 항목의 isChecked 상태를 true로 강제 변경합니다.
   * 합산 금액 계산: 전체 상태 배열에서 isChecked가 true인 항목만 필터링하여 amount의 총합을 계산하고, 이 값을 화면 상단에 실시간으로 표시합니다.
5.3. 에러 처리 로직
 * 백엔드: (이전 버전과 동일) 파일 처리 중 예외 발생 시, 400 Bad Request 또는 500 Internal Server Error 상태 코드와 함께 에러 메시지 JSON을 반환합니다.
 * 프론트엔드: API 호출의 catch 구문에서 에러를 처리합니다. Shadcn/ui의 Toast (useToast 훅과 Toaster 컴포넌트)를 사용하여 사용자에게 직관적인 에러 메시지를 표시합니다.
6. 배포 방안 (Deployment Plan)
 * 플랫폼: Vercel
 * 프로세스: GitHub 저장소를 Vercel 프로젝트에 연결하여 main 브랜치에 Push 할 때마다 자동 배포(CI/CD)를 구성합니다.
 * 환경 변수: Vercel 프로젝트의 'Environment Variables'에 아래 값들을 반드시 설정합니다.
   * NEXT_PUBLIC_SUPABASE_URL: Supabase 프로젝트 URL
   * NEXT_PUBLIC_SUPABASE_ANON_KEY: Supabase 익명 키 (클라이언트용)
   * SUPABASE_SERVICE_ROLE_KEY: Supabase 서비스 키 (서버용)
   * ZIP_PASSWORD: 엑셀 파일의 압축 비밀번호
