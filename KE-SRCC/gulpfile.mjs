import gulp from 'gulp';
import gulpSass from 'gulp-sass';
import * as dartSass from 'sass';
import postcss from 'gulp-postcss';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';
import cleanCSS from 'gulp-clean-css';
import { deleteAsync } from 'del';
import browserSync from 'browser-sync';
import { build as esbuild } from 'esbuild';
import fileInclude from 'gulp-file-include';
import spritesmith from 'gulp.spritesmith';
import { existsSync, mkdirSync, readdirSync, writeFileSync, readFileSync, unlinkSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { Transform } from 'node:stream';

const sass = gulpSass(dartSass);
const bs = browserSync.create();
const mode = { prod: false };
const MOBILE_MEDIA_MAX_WIDTH = 821;
const MOBILE_VW_BASE = 750;
const ENABLE_DEV_MINIFY = true;
const ENABLE_PROD_MINIFY = false;
const CLEAN_CSS_OPTIONS = {
  // keep only special comments: /*! ... */
  specialComments: 'all',
};

const noop = () => new Transform({
  objectMode: true,
  transform(file, _enc, callback) {
    callback(null, file);
  },
});

const pxToVwInTargetMedia = ({ mediaMaxWidth, viewportWidth, precision = 4 }) => {
  const mediaRegex = new RegExp(`max-width\\s*:\\s*${mediaMaxWidth}px`);

  const hasTargetMediaParent = (decl) => {
    let node = decl.parent;

    while (node) {
      if (node.type === 'atrule' && node.name === 'media' && mediaRegex.test(node.params)) {
        return true;
      }
      const svgToDataUrl = (svg) => {
        // SVG를 URI-safe한 data URL로 변환
        const encoded = svg
          .replace(/"/g, "'")           // 큰따옴표를 작은따옴표로
          .replace(/%/g, '%25')
          .replace(/</g, '%3C')
          .replace(/>/g, '%3E')
          .replace(/#/g, '%23')
          .replace(/&/g, '%26')
          .replace(/\n/g, ' ')          // 줄바꿈 제거
          .trim();
  
        return `url("data:image/svg+xml;charset=utf-8,${encoded}")`;
      };

      // SVG 크기 추출 함수 (viewBox에서)
      const extractSvgSize = (svg) => {
        const viewBoxMatch = svg.match(/viewBox\s*=\s*["']([^"']+)["']/);
        const widthMatch = svg.match(/width\s*=\s*["']([^"']+)["']/);
        const heightMatch = svg.match(/height\s*=\s*["']([^"']+)["']/);
  
        if (viewBoxMatch) {
          const [, , , w, h] = viewBoxMatch[1].match(/^([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)$/);
          return { width: w, height: h };
        } else if (widthMatch && heightMatch) {
          return { width: widthMatch[1], height: heightMatch[1] };
        }
        return null;
      };
      node = node.parent;
    }

    return false;
  };

  return {
    postcssPlugin: 'px-to-vw-in-target-media',
    Declaration(decl) {
      if (!decl.value || !decl.value.includes('px')) return;
      if (!hasTargetMediaParent(decl)) return;

      decl.value = decl.value.replace(/(-?\d*\.?\d+)px\b/g, (_, num) => {
        const n = parseFloat(num);
        if (n === 0) return '0';

        const vw = (n / viewportWidth) * 100;
        const rounded = Math.round(vw * (10 ** precision)) / (10 ** precision);
        return `${rounded}vw`;
      });
    },
  };
};
pxToVwInTargetMedia.postcss = true;

const setDev = (done) => {
  mode.prod = false;
  done();
};

const setProd = (done) => {
  mode.prod = true;
  done();
};

/* ─── 경로 설정 ─────────────────────────────────────── */
const paths = {
  scss: {
    src:   'src/scss/style.scss',
    watch: 'src/scss/**/*.scss',
    dest:  'docs/css',
  },
  js: {
    watch: 'src/js/**/*.js',
    vendorEntry: 'src/js/vendor.js',
    appEntry: 'src/js/main.js',
    vendorDest: 'docs/js/lib/vendor.js',
    appDest: 'docs/js/main.js',
  },
  html: {
    src:  ['src/html/**/*.html', '!src/html/**/inc/**/*.html'],
    watch: 'src/html/**/*.html',
    dest: 'docs',
  },
  img: {
    src:  'src/img/**/*',
    watch: ['src/img/**/*', '!src/img/icon/*.{png,jpg,jpeg}', '!src/img/icon/retina/*.{png,jpg,jpeg}'],
    dest: 'docs/img',
  },
  sprite: {
    dir: 'src/img/icon',
    retinaDir: 'src/img/icon/retina',
    normalSrc: ['src/img/icon/*.{png,jpg,jpeg}'],
    retinaSrc: 'src/img/icon/retina/*.{png,jpg,jpeg}',
    watch: ['src/img/icon/*.{png,jpg,jpeg}', 'src/img/icon/retina/*.{png,jpg,jpeg}'],
    imgDest: 'src/img/sprite',
    scssDestDir: 'src/scss/generated',
    scssDest: 'src/scss/generated/_icon.scss',
    cssImagePath: '../img/sprite/sprite.png',
    retinaCssImagePath: '../img/sprite/sprite-mobile.png',
    retinaScssTempDest: 'src/scss/generated/_icon-retina.scss',
  },
  svg: {
    dir: 'src/img/svg',
    watch: 'src/img/svg/**/*.svg',
    scssDestDir: 'src/scss/generated',
    scssDest: 'src/scss/generated/_svg-icons.scss',
    // 단색 variant 자동 생성 (키는 변수 suffix로 사용)
    // 예: { white: '#fff', primary: '#3D576B' }
    colorVariants: {
      white: '#fff',
      black: '#000',
      primary: '#3D576B',
      secondary: '#3B3B3B',
      accent: '#003197',
      blue: '#01489D',
      gray: '#B1BCC4',
      yellow: '#FECC2F'
    },
  },
  fonts: {
    src:  'src/fonts/**/*',
    dest: 'docs/fonts',
  },
};

/* ─── clean ─────────────────────────────────────────── */
export const clean = () => deleteAsync(['docs']);

/* ─── CSS (SCSS → PostCSS → Tailwind → CleanCSS) ────── */
export const css = () =>
  gulp.src(paths.scss.src, { sourcemaps: !mode.prod })
    .pipe(
      sass({ outputStyle: 'expanded', silenceDeprecations: ['legacy-js-api'] })
        .on('error', sass.logError)
    )
    .pipe(postcss([
      tailwindcss(),
      autoprefixer(),
      pxToVwInTargetMedia({
        mediaMaxWidth: MOBILE_MEDIA_MAX_WIDTH,
        viewportWidth: MOBILE_VW_BASE,
      }),
    ]))
    .pipe((mode.prod ? ENABLE_PROD_MINIFY : ENABLE_DEV_MINIFY) ? cleanCSS(CLEAN_CSS_OPTIONS) : noop())
    .pipe(mode.prod
      ? gulp.dest(paths.scss.dest)
      : gulp.dest(paths.scss.dest, { sourcemaps: '.' }))
    .pipe(bs.stream());

/* ─── JS (esbuild 번들) ─────────────────────────────── */
const esbuildBaseOptions = {
  bundle: true,
  format: 'iife',
  target: ['es2017'],
  logLevel: 'info',
};

export const jsVendor = () =>
  esbuild({
    ...esbuildBaseOptions,
    minify: mode.prod ? ENABLE_PROD_MINIFY : ENABLE_DEV_MINIFY,
    sourcemap: !mode.prod,
    entryPoints: [paths.js.vendorEntry],
    outfile: paths.js.vendorDest,
    globalName: 'KchipsVendor',
  });

export const jsApp = () =>
  esbuild({
    ...esbuildBaseOptions,
    minify: mode.prod ? ENABLE_PROD_MINIFY : ENABLE_DEV_MINIFY,
    sourcemap: !mode.prod,
    entryPoints: [paths.js.appEntry],
    outfile: paths.js.appDest,
    globalName: 'KchipsApp',
  });

export const js = gulp.parallel(jsVendor, jsApp);

/* ─── Sprite (icon/* → sprite.png + _icon.scss) ────── */
const hasSpriteSources = () => {
  const hasNormal = existsSync(paths.sprite.dir)
    && readdirSync(paths.sprite.dir).some((file) => /\.(png|jpe?g)$/i.test(file));
  const hasRetina = existsSync(paths.sprite.retinaDir)
    && readdirSync(paths.sprite.retinaDir).some((file) => /\.(png|jpe?g)$/i.test(file));

  return hasNormal || hasRetina;
};

const hasNormalSpriteSources = () => {
  if (!existsSync(paths.sprite.dir)) return false;
  return readdirSync(paths.sprite.dir).some((file) => /\.(png|jpe?g)$/i.test(file));
};

const hasRetinaSpriteSources = () => {
  if (!existsSync(paths.sprite.retinaDir)) return false;
  return readdirSync(paths.sprite.retinaDir).some((file) => /\.(png|jpe?g)$/i.test(file));
};

const ensureSpriteScssFile = () => {
  mkdirSync(dirname(paths.sprite.scssDest), { recursive: true });
  if (!existsSync(paths.sprite.scssDest)) {
    writeFileSync(paths.sprite.scssDest, '// auto-generated sprite classes\n');
  }
};

const spriteScssTemplate = (data) => {
  const lines = [
    `.icon { display: inline-flex; }`,
    `.icon::before { content: ''; background-image: url('${paths.sprite.cssImagePath}'); background-repeat: no-repeat; }`,
  ];

  data.sprites.forEach((sprite) => {
    lines.push(`.icon-${sprite.name}::before { width: ${sprite.px.width}; height: ${sprite.px.height}; background-position: ${sprite.px.offset_x} ${sprite.px.offset_y}; }`);
  });

  return `${lines.join('\n')}\n`;
};

const mobileSpriteScssTemplate = (data) => {
  const lines = [
    `@media (max-width: ${MOBILE_MEDIA_MAX_WIDTH}px) {`,
    `  .icon::before { background-image: url('${paths.sprite.retinaCssImagePath}'); background-size: ${data.spritesheet.px.width} ${data.spritesheet.px.height}; }`,
  ];

  data.sprites.forEach((sprite) => {
    const name = sprite.name;
    lines.push(`  .icon-${name}::before { width: ${sprite.px.width}; height: ${sprite.px.height}; background-position: ${sprite.px.offset_x} ${sprite.px.offset_y}; }`);
  });

  lines.push('}');
  return `${lines.join('\n')}\n`;
};

export const mergeSpriteScss = (done) => {
  ensureSpriteScssFile();

  const normalScss = existsSync(paths.sprite.scssDest)
    ? readFileSync(paths.sprite.scssDest, 'utf8').trimEnd()
    : '// auto-generated sprite classes';

  const retinaScss = existsSync(paths.sprite.retinaScssTempDest)
    ? readFileSync(paths.sprite.retinaScssTempDest, 'utf8').trim()
    : '';

  const merged = retinaScss
    ? `${normalScss}\n\n${retinaScss}\n`
    : `${normalScss}\n`;

  writeFileSync(paths.sprite.scssDest, merged);

  if (existsSync(paths.sprite.retinaScssTempDest)) {
    unlinkSync(paths.sprite.retinaScssTempDest);
  }

  done();
};

const writeSpriteOutput = (sourceStream, dest) =>
  new Promise((resolve, reject) => {
    sourceStream
      .pipe(gulp.dest(dest))
      .on('finish', resolve)
      .on('error', reject);
  });

export const sprite = async () => {
  if (!hasSpriteSources()) {
    ensureSpriteScssFile();
    if (existsSync(paths.sprite.retinaScssTempDest)) {
      unlinkSync(paths.sprite.retinaScssTempDest);
    }
    return;
  }

  const jobs = [];

  if (hasNormalSpriteSources()) {
    const spriteData = gulp.src(paths.sprite.normalSrc, { allowEmpty: true })
      .pipe(
        spritesmith({
          imgName: 'sprite.png',
          cssName: '_icon.scss',
          padding: 4,
          cssFormat: 'scss',
          cssTemplate: spriteScssTemplate,
        })
      );

    jobs.push(writeSpriteOutput(spriteData.img, paths.sprite.imgDest));
    jobs.push(writeSpriteOutput(spriteData.css, paths.sprite.scssDestDir));
  }

  if (hasRetinaSpriteSources()) {
    const retinaSpriteData = gulp.src(paths.sprite.retinaSrc, { allowEmpty: true })
      .pipe(
        spritesmith({
          imgName: 'sprite-mobile.png',
          cssName: '_icon-retina.scss',
          padding: 4,
          cssFormat: 'scss',
          cssTemplate: mobileSpriteScssTemplate,
        })
      );

    jobs.push(writeSpriteOutput(retinaSpriteData.img, paths.sprite.imgDest));
    jobs.push(writeSpriteOutput(retinaSpriteData.css, paths.sprite.scssDestDir));
  }

  ensureSpriteScssFile();
  if (jobs.length) {
    await Promise.all(jobs);
  }
};

/* ─── SVG → Data URL (svg/* → _svg-icons.scss) ─────── */
const sanitizeSvgName = (file) =>
  file
    .replace(/\\/g, '/')
    .replace(/\.svg$/i, '')
    .replace(/[^a-z0-9/_-]/gi, '-')
    .replace(/[\/]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();

const svgToDataUrl = (svg) => {
  const encoded = svg
    .replace(/\r?\n|\r/g, ' ')
    .replace(/\t/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/"/g, "'")
    .replace(/%/g, '%25')
    .replace(/#/g, '%23')
    .replace(/</g, '%3C')
    .replace(/>/g, '%3E')
    .replace(/&/g, '%26')
    .trim();

  return `url("data:image/svg+xml,${encoded}")`;
};

const extractSvgSize = (svg) => {
  const widthMatch = svg.match(/\bwidth\s*=\s*["']([\d.]+)(px)?["']/i);
  const heightMatch = svg.match(/\bheight\s*=\s*["']([\d.]+)(px)?["']/i);

  if (widthMatch && heightMatch) {
    return { width: `${widthMatch[1]}px`, height: `${heightMatch[1]}px` };
  }

  const viewBoxMatch = svg.match(/\bviewBox\s*=\s*["'][\d.\-]+\s+[\d.\-]+\s+([\d.\-]+)\s+([\d.\-]+)["']/i);
  if (viewBoxMatch) {
    return { width: `${viewBoxMatch[1]}px`, height: `${viewBoxMatch[2]}px` };
  }

  return { width: '1em', height: '1em' };
};

const normalizeHexColor = (color) => {
  if (typeof color !== 'string') return null;

  const raw = color.trim().toLowerCase().replace(/^#/, '');
  if (!/^[0-9a-f]{3}$|^[0-9a-f]{6}$/.test(raw)) return null;

  if (raw.length === 3) {
    return `#${raw.split('').map((c) => `${c}${c}`).join('')}`;
  }

  return `#${raw}`;
};

const sanitizeVariantKey = (key) =>
  String(key)
    .trim()
    .toLowerCase()
    .replace(/^#/, '')
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

const recolorMonotoneSvg = (svg, color) => {
  const hex = normalizeHexColor(color);
  if (!hex) return svg;

  let output = svg;

  // fill/stroke 속성 값 교체 (none 제외)
  output = output.replace(/\b(fill|stroke)\s*=\s*(["'])(?!none\b)[^"']*\2/gi, (_m, prop) => `${prop}="${hex}"`);

  // style 속성 내부 fill/stroke 교체 (none 제외)
  output = output.replace(/\b(fill|stroke)\s*:\s*(?!none\b)[^;"']+/gi, (_m, prop) => `${prop}:${hex}`);

  // 색상 선언이 없으면 root svg에 fill 주입
  if (!/\b(fill|stroke)\s*=|\b(fill|stroke)\s*:/i.test(output)) {
    output = output.replace(/<svg\b/i, `<svg fill="${hex}"`);
  }

  return output;
};

const walkSvgFiles = (baseDir, currentDir = baseDir) => {
  if (!existsSync(currentDir)) return [];

  const entries = readdirSync(currentDir, { withFileTypes: true });
  const files = [];

  entries.forEach((entry) => {
    const fullPath = join(currentDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkSvgFiles(baseDir, fullPath));
      return;
    }

    if (/\.svg$/i.test(entry.name)) {
      files.push(relative(baseDir, fullPath).replace(/\\/g, '/'));
    }
  });

  return files;
};

export const svgToScss = (done) => {
  mkdirSync(paths.svg.scssDestDir, { recursive: true });

  if (!existsSync(paths.svg.dir)) {
    writeFileSync(paths.svg.scssDest, '// auto-generated svg data urls\n');
    done();
    return;
  }

  const svgFiles = walkSvgFiles(paths.svg.dir).sort((a, b) => a.localeCompare(b));
  const colorVariants = Object.entries(paths.svg.colorVariants || {})
    .map(([key, color]) => ({ key: sanitizeVariantKey(key), color: normalizeHexColor(color) }))
    .filter((item) => item.key && item.color);

  const lines = [
    '// auto-generated svg data urls (map format)',
    '// usage: @include c.icon-pseudo(s.$icon-{name});',
    '// usage variant: @include c.icon-pseudo(s.$icon-{name}, $variant: "fff");',
    '// override size in media query: width/height',
    '',
  ];

  svgFiles.forEach((relativeFile) => {
    const filePath = join(paths.svg.dir, relativeFile);
    const name = sanitizeSvgName(relativeFile);
    const svg = readFileSync(filePath, 'utf8');
    const dataUrl = svgToDataUrl(svg);
    const size = extractSvgSize(svg);

    lines.push(`$icon-${name}: (`);
    lines.push(`  'url': ${dataUrl},`);
    lines.push(`  'w': ${size.width},`);
    lines.push(`  'h': ${size.height},`);

    if (colorVariants.length) {
      colorVariants.forEach(({ key, color }) => {
        const recoloredDataUrl = svgToDataUrl(recolorMonotoneSvg(svg, color));
        lines.push(`  'url--${key}': ${recoloredDataUrl},`);
      });
    }

    lines.push(');');
    lines.push('');
  });

  if (!svgFiles.length) {
    lines.push('// no svg files found');
  }

  writeFileSync(paths.svg.scssDest, `${lines.join('\n')}\n`);
  done();
};

/* ─── HTML 복사 ──────────────────────────────────────── */
export const html = () =>
  gulp.src(paths.html.src)
    .pipe(
      fileInclude({
        prefix: '@@',
        basepath: '@file',
      })
    )
    .pipe(gulp.dest(paths.html.dest));

/* ─── 이미지 복사 ────────────────────────────────────── */
export const img = () =>
  gulp.src(paths.img.src, { encoding: false })
    .pipe(gulp.dest(paths.img.dest));

/* ─── 폰트 복사 ──────────────────────────────────────── */
export const fonts = () =>
  gulp.src(paths.fonts.src, { encoding: false })
    .pipe(gulp.dest(paths.fonts.dest));

/* ─── Production CSS sourcemap cleanup ─────────────── */
export const stripCssSourceMaps = async () => {
  await new Promise((resolve) => setTimeout(resolve, 100));

  if (existsSync(paths.scss.dest)) {
    readdirSync(paths.scss.dest)
      .filter((file) => file.endsWith('.css'))
      .forEach((file) => {
        const filePath = `${paths.scss.dest}/${file}`;
        const css = readFileSync(filePath, 'utf8').replace(/\/\*# sourceMappingURL=[^*]*\*\//g, '').trimEnd();
        writeFileSync(filePath, `${css}\n`);
      });

    readdirSync(paths.scss.dest)
      .filter((file) => file.endsWith('.map'))
      .forEach((file) => {
        unlinkSync(`${paths.scss.dest}/${file}`);
      });
  }
};

/* ─── BrowserSync ────────────────────────────────────── */
const serve = (done) => {
  bs.init({
    server: { baseDir: 'docs' },
    open: true,
    notify: false,
  });
  done();
};

const reload = (done) => { bs.reload(); done(); };

/* ─── Watch ──────────────────────────────────────────── */
const watchFiles = () => {
  // SCSS 변경 → CSS 재빌드
  gulp.watch(paths.scss.watch, css);
  // 아이콘 변경 → 스프라이트/SCSS 재생성 후 CSS+이미지 반영
  gulp.watch(paths.sprite.watch, gulp.series(sprite, mergeSpriteScss, css, img, reload));
  // SVG 변경 → data url scss 재생성 후 CSS 반영
  gulp.watch(paths.svg.watch, gulp.series(svgToScss, css, reload));
  // HTML 변경 → Tailwind purge 반영 위해 CSS도 재빌드
  gulp.watch(paths.html.watch, gulp.series(css, html, reload));
  // JS 변경
  gulp.watch(paths.js.watch, gulp.series(js, reload));
  // 이미지 변경
  gulp.watch(paths.img.watch, gulp.series(img, reload));
};

/* ─── 빌드 / 개발 ────────────────────────────────────── */
export const build = gulp.series(
  setDev,
  clean,
  sprite,
  mergeSpriteScss,
  svgToScss,
  gulp.parallel(css, js, html, img, fonts)
);

export const buildProd = gulp.series(
  setProd,
  clean,
  sprite,
  mergeSpriteScss,
  svgToScss,
  gulp.parallel(css, js, html, img, fonts),
  stripCssSourceMaps
);

const dev = gulp.series(build, serve, watchFiles);
export default dev;
