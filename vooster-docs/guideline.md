# 월말정산 자동화 대시보드 코드 가이드라인

본 문서는 '월말정산 자동화 대시보드' 프로젝트의 코드 품질, 일관성 및 유지보수성을 보장하기 위한 개발 가이드라인을 정의합니다. 모든 프로젝트 참여자는 이 가이드라인을 숙지하고 준수해야 합니다.

## 1. 프로젝트 개요

'월말정산 자동화 대시보드'는 뱅크샐러드 엑셀 파일을 업로드하여 공용 지출 내역을 자동 추출하고, 사용자가 설정한 월급 및 고정 지출액을 바탕으로 가족 계좌에 이체할 최종 금액을 계산해주는 개인용 서버리스 웹 애플리케이션입니다. 수동 정산 시간을 30분에서 5분 이내로 단축하는 것을 목표로 합니다.

**핵심 기술 스택:**
*   **통합 프레임워크:** Next.js 14+ (App Router)
*   **배포/실행 환경:** Vercel (서버리스 함수)
*   **데이터베이스 & BaaS:** Supabase (PostgreSQL, 인증, API)
*   **UI:** Shadcn/ui (Tailwind CSS, Radix UI 기반)
*   **핵심 라이브러리:** `@supabase/supabase-js`, `jszip`, `xlsx`, `swr` (또는 `react-query`)

**핵심 아키텍처 결정:**
*   **서버리스 아키텍처:** Vercel과 Supabase를 활용한 완전 서버리스 구성으로 확장성과 운영 효율성을 확보합니다.
*   **Next.js App Router:** 프론트엔드와 백엔드 API를 통합 관리하여 개발 생산성을 높입니다.
*   **Edge Network 활용:** Vercel의 글로벌 엣지 네트워크를 통해 빠른 페이지 로딩 속도를 제공합니다.
*   **Row Level Security (RLS):** Supabase RLS를 통해 사용자별 데이터 접근을 엄격히 통제합니다.

## 2. 핵심 원칙

1.  **명확성 (Clarity):** 코드는 작성자의 의도를 명확하게 드러내야 하며, 주석 없이도 이해하기 쉬워야 합니다.
2.  **일관성 (Consistency):** 프로젝트 전반에 걸쳐 동일한 코딩 스타일, 명명 규칙 및 패턴을 유지해야 합니다.
3.  **모듈성 (Modularity):** 각 코드는 단일 책임 원칙을 준수하며, 재사용 가능하고 테스트하기 쉬운 작은 단위로 구성되어야 합니다.
4.  **성능 최적화 (Performance Optimization):** 사용자 경험을 최우선으로 고려하여, 불필요한 렌더링이나 API 호출을 최소화해야 합니다.
5.  **보안 우선 (Security First):** 모든 코드 작성 시 잠재적인 보안 취약점을 고려하고, 안전한 코딩 관행을 준수해야 합니다.

## 3. 언어별 가이드라인

### 3.1. 파일 구성 및 디렉토리 구조

**MUST:**
*   Next.js App Router의 권장 디렉토리 구조를 따릅니다.
*   컴포넌트는 `components` 디렉토리 내에 기능별 또는 도메인별로 그룹화합니다.
*   API 라우트는 `app/api` 디렉토리 내에 기능별로 하위 디렉토리를 생성하여 관리합니다.
*   유틸리티 함수는 `lib` 디렉토리 내에, 타입 정의는 `types` 디렉토리 내에 저장합니다.
*   Supabase 관련 클라이언트 코드는 `lib/supabase` 디렉토리 내에 통합하여 관리합니다.

```
.
├── app/
│   ├── (main)/
│   │   ├── page.tsx
│   │   └── layout.tsx
│   ├── api/
│   │   ├── upload/
│   │   │   └── route.ts
│   │   ├── expenses/
│   │   │   └── route.ts
│   │   └── history/
│   │       └── route.ts
│   ├── settings/
│   │   └── page.tsx
│   └── history/
│       └── page.tsx
├── components/
│   ├── ui/             # shadcn/ui 컴포넌트 (CLI로 추가)
│   ├── common/         # 공통적으로 사용되는 컴포넌트 (예: Header, Footer)
│   └── dashboard/      # 대시보드 관련 컴포넌트 (예: ExpenseList, CalculationSummary)
├── lib/
│   ├── utils.ts        # 공통 유틸리티 함수
│   ├── supabase/
│   │   ├── client.ts   # Supabase 클라이언트 인스턴스
│   │   └── server.ts   # Supabase 서버 클라이언트 인스턴스 (API Route용)
│   ├── parsers.ts      # 엑셀 파싱 로직
│   └── constants.ts    # 상수 정의
├── types/
│   └── index.d.ts      # TypeScript 타입 정의
├── public/
└── ...
```

**MUST NOT:**
*   `app` 디렉토리 내에 비즈니스 로직이 포함된 유틸리티 파일을 직접 생성하지 않습니다.
*   단일 파일에 너무 많은 기능을 담지 않습니다. (예: `app/api/all-features.ts`)

### 3.2. 임포트/의존성 관리

**MUST:**
*   절대 경로 임포트를 사용합니다. (`tsconfig.json`의 `paths` 설정 활용)
*   외부 라이브러리 임포트, 내부 모듈 임포트 순으로 정렬하고, 각 그룹 사이에 한 줄 공백을 둡니다.

```typescript
// MUST: 절대 경로 임포트 및 정렬
import React from 'react';
import { Button } from '@/components/ui/button';
import { fetchExpenses } from '@/lib/api';
import { Expense } from '@/types';

// ...
```

**MUST NOT:**
*   상대 경로 임포트를 남용하여 가독성을 저해하지 않습니다. (예: `../../../components/ui/button`)

### 3.3. 에러 처리 패턴

**MUST:**
*   **백엔드 (Next.js API Route):**
    *   `try-catch` 블록을 사용하여 비동기 작업의 에러를 명확히 처리합니다.
    *   사용자에게 의미 있는 에러 메시지와 적절한 HTTP 상태 코드를 반환합니다.
    *   `console.error`를 사용하여 서버 로그에 상세 에러를 기록합니다.
```typescript
// MUST: API Route 에러 처리
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    // ... 로직 수행 ...
    return NextResponse.json({ message: '성공적으로 처리되었습니다.' }, { status: 200 });
  } catch (error) {
    console.error('API 처리 중 에러 발생:', error);
    // 사용자에게 보여줄 에러 메시지는 구체적이지 않게, 내부 에러는 로그로
    return NextResponse.json({ message: '파일 처리 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
```

*   **프론트엔드:**
    *   API 호출 시 `try-catch` 또는 `swr`/`react-query`의 에러 핸들링 기능을 활용합니다.
    *   `shadcn/ui`의 `useToast` 훅과 `Toaster` 컴포넌트를 사용하여 사용자에게 직관적인 에러 메시지를 표시합니다.
    *   데이터 로딩 실패 시, 사용자에게 빈 상태(empty state) 메시지를 표시합니다.

```typescript
// MUST: 프론트엔드 에러 처리 (useToast 활용)
import { useToast } from '@/components/ui/use-toast';
import useSWR from 'swr';
import { fetcher } from '@/lib/utils'; // fetcher 함수 예시

function MyComponent() {
  const { toast } = useToast();
  const { data, error } = useSWR('/api/expenses', fetcher);

  if (error) {
    toast({
      title: '데이터 로딩 실패',
      description: error.message || '지출 내역을 불러오는데 실패했습니다.',
      variant: 'destructive',
    });
    return <div>지출 내역을 불러올 수 없습니다.</div>;
  }

  // ... 데이터 렌더링 ...
}
```

**MUST NOT:**
*   에러를 단순히 `console.log`로만 출력하고 사용자에게 아무런 피드백을 주지 않습니다.
*   백엔드에서 민감한 에러 스택 트레이스를 클라이언트에 직접 노출하지 않습니다.

## 4. 코드 스타일 규칙

### 4.1. MUST Follow (필수 준수 사항)

*   **TypeScript 사용:** 모든 코드에 TypeScript를 사용하여 타입 안정성을 확보합니다. `any` 타입 사용은 최소화하고 명확한 타입 정의를 선호합니다.
*   **ESLint 및 Prettier:** 프로젝트에 설정된 ESLint 및 Prettier 규칙을 준수합니다. 커밋 전 자동 포맷팅을 권장합니다.
*   **명명 규칙:**
    *   변수, 함수: `camelCase` (예: `expenseList`, `calculateTotalAmount`)
    *   컴포넌트: `PascalCase` (예: `ExpenseItem`, `DashboardLayout`)
    *   상수: `SCREAMING_SNAKE_CASE` (예: `API_BASE_URL`, `MAX_FILE_SIZE`)
    *   파일 이름: `kebab-case` (예: `expense-list.tsx`, `api-client.ts`)
*   **주석:**
    *   복잡한 로직이나 비즈니스 규칙에 대한 설명은 주석으로 명확히 작성합니다.
    *   JSDoc 스타일 주석을 사용하여 함수, 컴포넌트, 타입의 목적, 인자, 반환 값 등을 설명합니다.
    *   불필요하거나 자명한 주석은 작성하지 않습니다.
*   **단일 책임 원칙 (SRP):** 함수, 컴포넌트, 모듈은 하나의 명확한 책임만 가져야 합니다.
*   **가독성:**
    *   한 줄에 80~120자 제한을 지키도록 노력합니다.
    *   적절한 공백과 줄 바꿈을 사용하여 코드 블록을 구분합니다.
    *   조건문, 반복문 등은 중첩을 최소화하고 조기 반환(early return)을 적극 활용합니다.

```typescript
// MUST: 명확한 함수명, JSDoc 주석, 조기 반환
/**
 * 주어진 지출 목록에서 체크된 항목들의 총 금액을 계산합니다.
 * @param expenses - 지출 항목 배열
 * @returns 체크된 항목들의 총 금액
 */
function calculateCheckedExpensesTotal(expenses: Expense[]): number {
  if (!expenses || expenses.length === 0) {
    return 0;
  }

  return expenses.reduce((sum, expense) => {
    if (expense.isChecked) {
      return sum + expense.amount;
    }
    return sum;
  }, 0);
}
```

### 4.2. MUST NOT Do (피해야 할 사항)

*   **거대한 단일 파일:** 단일 파일에 너무 많은 컴포넌트, 함수, 비즈니스 로직을 몰아넣지 않습니다. 모듈성을 해치고 유지보수를 어렵게 만듭니다.
*   **복잡한 상태 관리:** `useState`와 `useReducer`로 충분한 경우, 불필요하게 복잡한 전역 상태 관리 라이브러리(예: Redux)를 도입하지 않습니다. `swr` 또는 `react-query`를 사용하여 서버 상태를 효율적으로 관리합니다.
*   **매직 넘버/문자열:** 코드 내에 의미를 알 수 없는 숫자나 문자열 리터럴을 직접 사용하지 않고, 상수로 정의하여 사용합니다.
*   **직접적인 DOM 조작:** React 컴포넌트 내에서 `document.getElementById`와 같은 직접적인 DOM 조작은 피하고, React의 상태 관리 및 참조(ref) 시스템을 활용합니다.
*   **불필요한 렌더링:** `React.memo`, `useCallback`, `useMemo`를 적절히 사용하여 불필요한 컴포넌트 리렌더링을 방지하고 성능을 최적화합니다. 하지만 과도한 사용은 오히려 복잡성을 증가시키므로 신중하게 적용합니다.

```javascript
// MUST NOT: 거대한 단일 파일 (예시)
// 이 파일은 너무 많은 책임을 가집니다.
// components/dashboard/ExpenseList.tsx, components/dashboard/CalculationSummary.tsx 등으로 분리해야 합니다.
// export function ExpenseList() { /* ... */ }
// export function CalculationSummary() { /* ... */ }
// export function SettingsForm() { /* ... */ }
// export function ApiUtils() { /* ... */ }
```

```typescript
// MUST NOT: 매직 넘버 사용
// if (status === 1) { /* ... */ } // 1의 의미가 불분명
//
// MUST: 상수로 정의하여 사용
// const EXPENSE_STATUS_CONFIRMED = 1;
// if (status === EXPENSE_STATUS_CONFIRMED) { /* ... */ }
```

## 5. 아키텍처 패턴

### 5.1. 컴포넌트/모듈 구조 가이드라인

**MUST:**
*   **원자적 컴포넌트:** `shadcn/ui` 컴포넌트는 원자적(atomic)으로 사용하고, 이를 조합하여 더 큰 컴포넌트를 만듭니다.
*   **컨테이너/프리젠테이션 패턴:** 데이터 로딩 및 비즈니스 로직을 담당하는 컨테이너 컴포넌트와 UI 렌더링만 담당하는 프리젠테이션 컴포넌트를 분리하여 관리합니다. (Next.js 서버 컴포넌트/클라이언트 컴포넌트 구분을 활용)
*   **서버 컴포넌트 우선:** 가능한 한 서버 컴포넌트를 사용하여 초기 로딩 성능을 최적화하고, 클라이언트 상호작용이 필요한 부분만 `use client` 지시어를 사용하여 클라이언트 컴포넌트로 분리합니다.

```typescript
// MUST: 서버 컴포넌트 (데이터 페칭 및 로직)
// app/dashboard/page.tsx
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { ExpenseListClient } from '@/components/dashboard/ExpenseListClient'; // 클라이언트 컴포넌트 임포트

export default async function DashboardPage() {
  const supabase = createServerComponentClient({ cookies });
  const { data: expenses, error } = await supabase.from('shared_expenses').select('*');

  if (error) {
    console.error('지출 내역 로딩 실패:', error);
    return <div>데이터를 불러오는데 실패했습니다.</div>;
  }

  return (
    <div>
      <h1>월말 정산 대시보드</h1>
      <ExpenseListClient initialExpenses={expenses || []} />
    </div>
  );
}

// MUST: 클라이언트 컴포넌트 (UI 상호작용 및 상태 관리)
// components/dashboard/ExpenseListClient.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Expense } from '@/types';

interface ExpenseListClientProps {
  initialExpenses: Expense[];
}

export function ExpenseListClient({ initialExpenses }: ExpenseListClientProps) {
  const [expenses, setExpenses] = useState<Expense[]>(initialExpenses.map(exp => ({
    ...exp,
    isChecked: false,
    currentMemo: exp.memo || '',
  })));

  // ... 체크박스 및 메모 변경 로직 ...

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>선택</TableHead>
          <TableHead>날짜</TableHead>
          <TableHead>내용</TableHead>
          <TableHead>금액</TableHead>
          <TableHead>메모</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {expenses.map((expense) => (
          <TableRow key={expense.id}>
            <TableCell>
              <Checkbox
                checked={expense.isChecked}
                onCheckedChange={(checked) => { /* ... */ }}
              />
            </TableCell>
            <TableCell>{expense.expense_date}</TableCell>
            <TableCell>{expense.content}</TableCell>
            <TableCell>{expense.amount.toLocaleString()}원</TableCell>
            <TableCell>
              <Input
                value={expense.currentMemo}
                onChange={(e) => { /* ... */ }}
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

**MUST NOT:**
*   클라이언트 컴포넌트 내에서 불필요하게 서버 데이터를 직접 페칭하지 않습니다. (가능한 경우 서버 컴포넌트에서 페칭 후 prop으로 전달)
*   UI 로직과 비즈니스 로직이 한 컴포넌트에 뒤섞여 복잡성을 증가시키지 않습니다.

### 5.2. 데이터 흐름 패턴

**MUST:**
*   **단방향 데이터 흐름:** React의 단방향 데이터 흐름 원칙을 준수합니다. 부모 컴포넌트에서 자식 컴포넌트로 데이터를 전달하고, 자식 컴포넌트의 이벤트는 콜백 함수를 통해 부모에게 전달합니다.
*   **서버 상태 관리:** `swr` 또는 `react-query`를 사용하여 서버에서 가져온 데이터(지출 내역, 설정 등)를 캐싱하고 동기화합니다. 이를 통해 불필요한 API 호출을 줄이고 UI 응답성을 높입니다.
*   **클라이언트 상태 관리:** UI 관련 임시 상태(예: 모달 열림/닫힘, 입력 필드 값)는 `useState`를 사용하여 컴포넌트 내에서 관리합니다.

### 5.3. 상태 관리 컨벤션

**MUST:**
*   **로컬 상태:** 컴포넌트 내부에서만 사용되는 상태는 `useState` 또는 `useReducer`를 사용합니다.
*   **서버 캐시 상태:** API를 통해 가져오는 데이터는 `swr` 또는 `react-query`의 훅을 사용하여 관리합니다. (예: `useSWR('/api/expenses', fetcher)`)
*   **전역 상태 (최소화):** 전역적으로 공유되어야 하는 상태(예: 사용자 인증 정보 - 향후 확장 시)는 React Context API나 가벼운 전역 상태 관리 라이브러리(예: Zustand)를 신중하게 고려하여 사용합니다. 현재 프로젝트 범위에서는 `swr` 또는 `react-query`의 전역 캐시만으로 충분합니다.

```typescript
// MUST: swr을 이용한 서버 상태 관리
import useSWR from 'swr';
import { fetcher } from '@/lib/utils'; // axios 또는 fetch 기반의 fetcher 함수

interface Expense { /* ... */ }

function ExpensesDisplay() {
  const { data: expenses, error, isLoading, mutate } = useSWR<Expense[]>('/api/expenses?startDate=...&endDate=...', fetcher);

  if (isLoading) return <div>로딩 중...</div>;
  if (error) return <div>에러 발생: {error.message}</div>;

  const handleUpdateExpense = async () => {
    // ... API 호출로 데이터 업데이트 ...
    await mutate(); // 데이터 갱신
  };

  return (
    // ... expenses 데이터 렌더링 ...
  );
}
```

**MUST NOT:**
*   `props drilling`을 피하기 위해 불필요하게 Context API를 남용하지 않습니다.
*   복잡한 상태 로직을 `useState` 하나로 관리하려 하지 않고, `useReducer`를 고려합니다.

### 5.4. API 디자인 표준

**MUST:**
*   **RESTful 원칙:** API 엔드포인트는 RESTful 원칙을 따르도록 설계합니다. (예: `/api/expenses`, `/api/history`)
*   **명확한 응답:** API 응답은 성공/실패 여부, 메시지, 데이터 등을 포함하여 클라이언트가 쉽게 처리할 수 있도록 명확하게 구성합니다.
*   **HTTP 상태 코드:** 응답에 적절한 HTTP 상태 코드를 사용합니다 (예: 200 OK, 201 Created, 400 Bad Request, 404 Not Found, 500 Internal Server Error).
*   **보안:**
    *   Supabase RLS를 통해 데이터 접근 권한을 제어합니다.
    *   민감 정보는 환경 변수를 통해 관리하고, 클라이언트에 노출되지 않도록 합니다.
    *   API Route에서 Supabase Admin 클라이언트를 사용할 때는 `SUPABASE_SERVICE_ROLE_KEY`를 사용하고, 클라이언트에서 사용할 때는 `NEXT_PUBLIC_SUPABASE_ANON_KEY`를 사용합니다.

```typescript
// MUST: API Route 응답 예시
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr'; // 서버용 Supabase 클라이언트

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');

  if (!startDate || !endDate) {
    return NextResponse.json({ message: '시작일과 종료일은 필수입니다.' }, { status: 400 });
  }

  try {
    const supabase = createServerClient({ /* ... */ }); // 서버용 클라이언트 초기화
    const { data: expenses, error } = await supabase
      .from('shared_expenses')
      .select('*')
      .gte('expense_date', startDate)
      .lte('expense_date', endDate);

    if (error) {
      console.error('지출 내역 조회 에러:', error);
      return NextResponse.json({ message: '데이터 조회 중 오류가 발생했습니다.' }, { status: 500 });
    }

    return NextResponse.json(expenses, { status: 200 });
  } catch (error) {
    console.error('API 처리 중 예외 발생:', error);
    return NextResponse.json({ message: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
```

**MUST NOT:**
*   API 엔드포인트 이름이 동사를 포함하지 않도록 합니다. (예: `/api/getExpenses` 대신 `/api/expenses`)
*   에러 발생 시 단순한 문자열 대신 구조화된 JSON 응답을 반환합니다.