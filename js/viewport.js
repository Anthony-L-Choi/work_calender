// 키보드가 열리고 닫힐 때 메인 화면을 부드럽게 맞춘다.
// 화면 높이가 바뀌면 달력 높이(--app-height)와 화면 위치를 같은 0.3초 동안 함께 바꾼다:
// 키보드가 열리면 달력이 줄면서 입력 시트가 키보드 위로 올라오고, 닫히면 반대로 시트가 내려오며 달력이 커진다.
// 바뀌는 동안은 창을 맨 위에 두고 메인 화면을 transform으로 옮겨(문서 높이 때문에 스크롤이 막히거나 튀지 않게),
// 끝나면 같은 위치로 실제 스크롤한다

const DURATION = 300;
/** 화면 높이가 이만큼 넘게 줄면 키보드가 열린 것으로 본다 */
const KEYBOARD_MIN = 120;

const root = document.documentElement;
const home = /** @type {HTMLElement} */ (document.getElementById('home'));
const calendar = /** @type {HTMLElement} */ (document.getElementById('calendar'));
// 내비게이션 바 높이(--inset-bottom)를 재는 보이지 않는 막대
const probe = document.createElement('div');
probe.style.cssText = 'position:fixed;left:0;top:0;width:0;height:var(--inset-bottom);visibility:hidden;pointer-events:none';
document.body.append(probe);

/** 지금 그린 메인 화면 높이와 화면 위치(창 스크롤 + transform으로 옮긴 만큼) */
let drawn = { h: 0, y: 0 };
let shift = 0;
let lastY = 0;
let anim = 0;
let guard = 0;
let fullWidth = 0;
let fullHeight = 0;
let navInset = 0;

const keyboardOpen = () => window.innerHeight < fullHeight - KEYBOARD_MIN;

/** 달력 칸이 최소 높이(--cell-min)일 때의 메인 화면 높이. 화면이 이보다 작으면 나머지는 스크롤된다 */
function minHomeHeight() {
  const style = getComputedStyle(calendar);
  const rows = Math.ceil(calendar.children.length / 7);
  const calMin = rows * parseFloat(style.getPropertyValue('--cell-min')) + (rows - 1) * parseFloat(style.rowGap);
  return home.offsetHeight - calendar.offsetHeight + calMin;
}

/** 키보드가 열리면 내비게이션 바 여백이 0이 되는데, 아래 여백은 키보드가 닫혀 있을 때 값으로 둬 달력이 튀지 않게 한다 */
function syncInset() {
  if (keyboardOpen()) return;
  navInset = Math.max(navInset, probe.offsetHeight);
  root.style.setProperty('--home-inset', `${navInset}px`);
}

function draw(h, y) {
  drawn = { h, y };
  root.style.setProperty('--app-height', `${h}px`);
  shift = y - window.scrollY;
  home.style.transform = shift ? `translateY(${-shift}px)` : '';
}

/** 높이를 바꾼 뒤의 화면 위치: 키보드가 열려 시트 칸에 입력 중이면 시트 전체(저장 버튼까지)가 키보드 위에 오게 한다 */
function targetY(h) {
  root.style.setProperty('--app-height', `${h}px`);
  const maxY = Math.max(0, home.offsetHeight - window.innerHeight);
  const el = document.activeElement;
  let y = Math.min(drawn.y, maxY);
  if (keyboardOpen() && el instanceof HTMLInputElement && el.closest('#sheet')) {
    // 시트 맨 아래를 화면 맨 아래에 맞추되, 화면이 아주 낮으면 입력 칸이 위로 잘리지 않게 한다
    const top = el.getBoundingClientRect().top + window.scrollY + shift;
    y = Math.min(maxY, Math.max(0, top - 8));
  }
  return y;
}

function onResize() {
  if (window.innerWidth !== fullWidth) {
    fullWidth = window.innerWidth;
    fullHeight = 0;
    navInset = 0;
  }
  fullHeight = Math.max(fullHeight, window.innerHeight);
  syncInset();
  const from = anim ? drawn : { h: drawn.h, y: lastY };
  cancelAnimationFrame(anim);
  anim = 0;
  const toH = Math.max(window.innerHeight, minHomeHeight());
  const toY = targetY(toH);
  // 설정 화면(메인 화면이 숨겨짐)에서는 높이만 맞춘다
  if (home.hidden) {
    finish(toH, toY);
    return;
  }
  // 첫 프레임은 바뀌기 전 모습 그대로 그린다
  window.scrollTo(0, 0);
  draw(from.h, from.y);
  const start = performance.now();
  const step = (now) => {
    const t = Math.min(1, (now - start) / DURATION);
    const e = t < 0.5 ? 2 * t * t : 1 - ((2 - 2 * t) ** 2) / 2;
    // 브라우저가 입력 칸을 보이려고 창을 스크롤해도 맨 위로 되돌려 이 애니메이션만 화면을 옮기게 한다
    if (window.scrollY !== 0) window.scrollTo(0, 0);
    draw(from.h + (toH - from.h) * e, from.y + (toY - from.y) * e);
    if (t < 1) anim = requestAnimationFrame(step);
    else finish(toH, toY);
  };
  anim = requestAnimationFrame(step);
  // 화면이 가려져 프레임이 멈춰도 transform이 남지 않게 시간이 지나면 끝낸다
  clearTimeout(guard);
  guard = window.setTimeout(() => {
    if (anim) finish(toH, toY);
  }, DURATION + 200);
}

function finish(h, y) {
  cancelAnimationFrame(anim);
  anim = 0;
  root.style.setProperty('--app-height', `${h}px`);
  home.style.transform = '';
  shift = 0;
  window.scrollTo(0, y);
  lastY = window.scrollY;
  drawn = { h, y: lastY };
}

/** 처음 그린 뒤 한 번 부른다. 이후 화면 크기가 바뀔 때마다 부드럽게 맞춘다 */
export function initViewport() {
  fullWidth = window.innerWidth;
  fullHeight = window.innerHeight;
  syncInset();
  finish(Math.max(window.innerHeight, minHomeHeight()), window.scrollY);
  window.addEventListener('resize', onResize);
  window.addEventListener('scroll', () => {
    if (!anim) lastY = window.scrollY;
  }, { passive: true });
}
