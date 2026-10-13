// 키보드가 열리고 닫힐 때 메인 화면을 부드럽게 맞춘다.
// 달력 높이(--app-height)와 화면 위치를 같은 0.3초 동안 함께 바꾼다:
// 키보드가 열리면 달력이 줄면서 입력 시트가 키보드 위로 올라오고, 닫히면 반대로 시트가 내려오며 달력이 커진다.
// 시트 시각 칸을 누르는 순간(키보드가 뜨기 전) 지난번 키보드 높이로 미리 움직이기 시작해,
// 키보드가 칸을 가려 브라우저가 화면을 툭 스크롤하는 일(깜빡임)이 없고, 시스템 애니메이션을 꺼 키보드가 바로 떠도 함께 움직인다.
// 실제 화면 크기가 바뀌면 그 값으로 이어서 맞춘다. 움직이는 동안은 창을 맨 위에 두고 메인 화면을 transform으로 옮기고,
// 끝나면 같은 위치로 실제 스크롤한다 (스크롤할 수 없는 만큼은 transform으로 남긴다)

const DURATION = 300;
/** 화면 높이가 이만큼 넘게 줄면 키보드가 열린 것으로 본다 */
const KEYBOARD_MIN = 120;
/** 키보드를 아직 본 적이 없을 때 어림하는 키보드 높이 (화면 높이에 대한 비율) */
const KEYBOARD_GUESS = 0.45;
const INPUTS = '#sheet input[inputmode="numeric"]';

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
let anim = 0;
let guard = 0;
let revert = 0;
let fullWidth = 0;
let fullHeight = 0;
let navInset = 0;
let keyboardHeight = 0;

const keyboardOpen = () => window.innerHeight < fullHeight - KEYBOARD_MIN;
const isInput = (el) => el instanceof HTMLElement && el.matches(INPUTS);

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

/**
 * 보이는 높이가 vh일 때 맞출 메인 화면 높이와 화면 위치.
 * 키보드가 열려 시트 칸에 입력 중이면 시트 전체(저장 버튼까지)가 키보드 위에 오게 한다
 * @param {number} vh @param {boolean} keyboard
 */
function targets(vh, keyboard) {
  const h = Math.max(vh, minHomeHeight());
  root.style.setProperty('--app-height', `${h}px`);
  const maxY = Math.max(0, home.offsetHeight - vh);
  let y = Math.min(drawn.y, maxY);
  const el = document.activeElement;
  if (keyboard && el && isInput(el)) {
    // 화면이 아주 낮으면 입력 칸이 위로 잘리지 않게 한다
    const top = el.getBoundingClientRect().top + window.scrollY + shift;
    y = Math.min(maxY, Math.max(0, top - 8));
  }
  return { h, y };
}

/** 지금 모습에서 (보이는 높이 vh에 맞춘) 목표 모습으로 0.3초 동안 옮긴다. 움직이는 중이면 그 자리에서 이어 간다 */
function animate(vh, keyboard) {
  const from = drawn;
  cancelAnimationFrame(anim);
  anim = 0;
  const to = targets(vh, keyboard);
  if (home.hidden) {
    finish(to);
    return;
  }
  // 첫 프레임은 바뀌기 전 모습 그대로 그린다
  window.scrollTo(0, 0);
  draw(from.h, from.y);
  const start = performance.now();
  const step = (now) => {
    const t = Math.min(1, (now - start) / DURATION);
    const e = t < 0.5 ? 2 * t * t : 1 - ((2 - 2 * t) ** 2) / 2;
    // 브라우저가 창을 스크롤해도 맨 위로 되돌려 이 애니메이션만 화면을 옮기게 한다
    if (window.scrollY !== 0) window.scrollTo(0, 0);
    draw(from.h + (to.h - from.h) * e, from.y + (to.y - from.y) * e);
    if (t < 1) anim = requestAnimationFrame(step);
    else finish(to);
  };
  anim = requestAnimationFrame(step);
  // 화면이 가려져 프레임이 멈춰도 끝 모습으로 맞춘다
  clearTimeout(guard);
  guard = window.setTimeout(() => {
    if (anim) finish(to);
  }, DURATION + 200);
}

function finish({ h, y }) {
  cancelAnimationFrame(anim);
  anim = 0;
  home.style.transform = '';
  root.style.setProperty('--app-height', `${h}px`);
  window.scrollTo(0, y);
  draw(h, y);
}

function onResize() {
  if (window.innerWidth !== fullWidth) {
    fullWidth = window.innerWidth;
    fullHeight = 0;
    navInset = 0;
    keyboardHeight = 0;
  }
  fullHeight = Math.max(fullHeight, window.innerHeight);
  syncInset();
  if (keyboardOpen()) keyboardHeight = fullHeight - window.innerHeight;
  clearTimeout(revert);
  animate(window.innerHeight, keyboardOpen());
}

/** 처음 그린 뒤 한 번 부른다. 이후 화면 크기가 바뀌거나 시트 칸을 누르고 벗어날 때 부드럽게 맞춘다 */
export function initViewport() {
  fullWidth = window.innerWidth;
  fullHeight = window.innerHeight;
  syncInset();
  finish({ h: Math.max(window.innerHeight, minHomeHeight()), y: window.scrollY });
  window.addEventListener('resize', onResize);
  window.addEventListener('scroll', () => {
    if (!anim) drawn = { h: drawn.h, y: window.scrollY + shift };
  }, { passive: true });

  // 시트 칸을 누르면 키보드가 뜨기 전에 미리 올리기 시작한다. 키보드가 끝내 뜨지 않으면(외장 키보드 등) 되돌린다
  document.addEventListener('focusin', (event) => {
    if (!isInput(event.target) || keyboardOpen() || home.hidden) return;
    animate(fullHeight - (keyboardHeight || Math.round(fullHeight * KEYBOARD_GUESS)), true);
    clearTimeout(revert);
    revert = window.setTimeout(() => {
      if (!keyboardOpen()) animate(window.innerHeight, false);
    }, 1200);
  });
  // 시트 칸에서 벗어나 키보드가 닫히게 되면, 닫히기 전에 미리 내리기 시작한다 (다른 시트 칸으로 옮길 때는 그대로)
  document.addEventListener('focusout', () => {
    setTimeout(() => {
      if (isInput(document.activeElement) || !keyboardOpen() || home.hidden) return;
      animate(fullHeight, false);
    }, 0);
  });
}
