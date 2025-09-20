# Apple Sign-In 설정 가이드

Apple Sign-In을 활성화하려면 Apple Developer 계정이 필요합니다.

## 필수 요구사항
- Apple Developer Program 멤버십 ($99/년)
- Apple Developer Console 접근 권한

## 설정 단계

### 1. Apple Developer Console 설정
1. **Apple Developer Console** 접속 (https://developer.apple.com)
2. **Certificates, Identifiers & Profiles** 이동
3. **Keys** 섹션에서 새 키 생성
4. **Sign in with Apple** 체크박스 선택
5. **Continue**를 클릭하여 키 생성
6. 키 파일 다운로드 (한 번만 다운로드 가능)

### 2. App ID 또는 Service ID 설정
1. **Identifiers** → **App IDs** 또는 **Services IDs**
2. 새 identifier 생성
3. **Sign in with Apple** 활성화
4. **Configure** 클릭
5. **Domains and Subdomains**에 웹사이트 도메인 추가
6. **Return URLs**에 Supabase 콜백 URL 추가:
   ```
   https://zepbcucpavsfffnkcimu.supabase.co/auth/v1/callback
   ```

### 3. Supabase 설정
1. Supabase Dashboard → **Authentication** → **Providers**
2. **Apple** 활성화
3. 다음 정보 입력:
   - **Client ID**: Service ID 또는 App Bundle ID
   - **Client Secret**: JWT 토큰 (Key ID, Team ID, Private Key로 생성)

### 4. JWT 토큰 생성
Apple의 경우 Client Secret은 JWT 토큰 형태로 생성해야 합니다.
필요한 정보:
- **Key ID**: Apple Developer Console에서 생성한 키의 ID
- **Team ID**: Apple Developer 계정의 Team ID
- **Private Key**: 다운로드한 .p8 파일의 내용

## 주의사항
- Apple Developer 계정 없이는 Apple Sign-In을 테스트할 수 없습니다
- 개발 환경에서는 localhost 도메인 사용 제한이 있을 수 있습니다
- 프로덕션 배포 시에만 완전히 테스트 가능합니다

## 대안
Apple Developer 계정이 없는 경우:
1. Google 로그인만 사용
2. 이메일/비밀번호 인증만 사용
3. 추후 Apple 계정 생성 후 Apple Sign-In 추가