# kchipsrnd 빌드 가이드

## 프로젝트 특징
- **Node 22.12.0** 기반
- **Yarn 1.22.22** 사용
- Gulp + esbuild + Tailwind 빌드 파이프라인
- Vendor/Main 분리 번들 구조
- HTML include 방식 (head/header/footer 공통 분리)
- 아이콘 스프라이트 자동 생성
- Dev/Prod 빌드 모드 분리

## 전체 구조
- `src/`: 작업 원본 폴더
- `docs/`: 배포 산출 폴더(빌드 시 재생성)

## 빌드 파이프라인
- Sprite: `src/img/icon/*` → `src/img/sprite/sprite.png` + `src/scss/generated/_icon.scss`
- Retina Sprite: `src/img/icon/retina/*` → `src/img/sprite/sprite-mobile.png` (동일 클래스에 모바일 미디어쿼리로 병합)
- SCSS: `src/scss/style.scss` → Tailwind + Autoprefixer → `docs/css/style.css`
- JS Vendor: `src/js/vendor.js` → esbuild 번들 → `docs/js/lib/vendor.js`
- JS App: `src/js/main.js` → esbuild 번들 → `docs/js/main.js`
- HTML: `src/html/**/*.html` → `docs/`
- 이미지/폰트: `src/img`, `src/fonts` → `docs/img`, `docs/fonts`

## 파일별 역할
- `gulpfile.mjs`
  - 전체 태스크 정의 (`clean`, `sprite`, `css`, `js`, `html`, `img`, `fonts`, `build`, `buildProd`, `dev`)
  - `clean`에서 `docs/` 삭제 후 재생성 흐름 보장
  - `sprite`에서 아이콘 폴더 이미지를 스프라이트로 생성하고 아이콘 클래스 SCSS 자동 생성
- `tailwind.config.js`
  - Tailwind가 클래스 스캔할 파일 경로 설정
- `src/js/vendor.js`
  - 외부 라이브러리 집합 (`jquery`, `swiper`, `gsap`)
  - 전역(`window`) 노출로 일반 스크립트 환경에서 사용 가능
- `src/js/main.js`
  - 프로젝트 비즈니스 코드
- `src/html/index.html`
  - 페이지 본문 파일
- `src/html/inc/head.html`, `src/html/inc/header.html`, `src/html/inc/footer.html`
  - `@@include`로 공통 head/헤더/푸터 분리

## 실행 명령
- 개발: `yarn dev`
- 일반 빌드(소스맵 포함, 압축): `yarn build`
- 프로덕션 빌드(소스맵 제외, 비압축 / 개발자 전달용): `yarn build:prod`

## 압축 설정
- 현재는 `build`만 압축, `build:prod`는 비압축 상태
- 설정 위치: [gulpfile.mjs](gulpfile.mjs)
- `const ENABLE_DEV_MINIFY = true;` 로 되어 있음
- `const ENABLE_PROD_MINIFY = false;` 로 되어 있음
- 필요 시 dev / prod를 각각 독립적으로 켜고 끌 수 있음

```js
const ENABLE_DEV_MINIFY = true;
const ENABLE_PROD_MINIFY = false;
```

- 현재 로직:
  - `yarn build` → CSS `cleanCSS()`, JS `esbuild minify` 적용
  - `yarn build:prod` → 비압축 유지, CSS sourcemap 제거

- 만약 나중에 `build:prod`도 압축하려면 아래처럼 값만 바꾸면 됨

```js
const ENABLE_DEV_MINIFY = true;
const ENABLE_PROD_MINIFY = true;
```

## CSS 주석 보존 규칙
- `cleanCSS` 옵션에서 `specialComments: 'all'` 사용 중
- 압축 시 `/*! ... */` 형태의 보존 주석만 유지됨
- 일반 주석(`/* ... */`, `/** ... */`)은 제거됨
- 여러 줄 보존 주석도 사용 가능

```css
/* 제거됨 */
/** 제거됨 */
/*! 유지됨 */
/*!
 * 여러 줄도 유지됨
 */
```

## 동작 포인트
- `type="module"` 없이 일반 `<script>` 로딩
- `import` 구문은 번들 단계에서 정리되어 배포 파일에 직접 노출되지 않음
- 아이콘 클래스는 `.icon` + `.icon-{파일명}` 형식으로 생성됨
- `icon/retina` 아이콘은 모바일(`max-width: 768px`)에서 같은 `.icon-{파일명}` 클래스를 덮어씀
- `icon/retina` 파일은 모바일(`max-width: 768px`)에서 크기/좌표/배경크기를 `vw`로 자동 변환함(기준폭 768)
- HTML은 `gulp-file-include`로 `@@include('./inc/header.html')` 형식 사용 가능
- 페이지별 타이틀은 `@@include('./inc/head.html', { "title": "페이지명" })` 형식으로 지정 가능
