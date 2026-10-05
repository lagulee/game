// =============================================================
// tools/entry/art.js : 엔트리 판에 들어갈 그림 (게임과 같은 스티커 스타일 SVG)
// -------------------------------------------------------------
// 모든 그림은 엔트리에서 보일 크기의 2배로 그린다 (오브젝트 크기 50% 로 넣어 선명하게)
// 색은 game.js 의 COLORS 팔레트와 같다. 외곽선은 4px 진한 갈색.
// =============================================================

const C = {
  outline: "#2B2118", background: "#E9E6D8", white: "#F7F4EA", yellow: "#F2C14E", red: "#D9482B",
  green: "#6FB04A", brown: "#C98A4B", purple: "#8A63B8", orange: "#E8913A", gray: "#A39D92", pink: "#D7739F", blue: "#4E8FC6",
};
const OL = 4;   // 외곽선 두께
const FONT = "'Jua', sans-serif";
const TITLE_FONT = "'Black Han Sans', 'Jua', sans-serif";

const svg = (w, h, body) => '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + " " + h + '">' + body + "</svg>";
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");

// 눈 두 개 (화난 눈썹 선택)
function eyes(cx, cy, gap, r, angry) {
  let s = "";
  for (const dx of [-gap, gap]) {
    s += '<circle cx="' + (cx + dx) + '" cy="' + cy + '" r="' + r + '" fill="' + C.white + '" stroke="' + C.outline + '" stroke-width="3"/>';
    s += '<circle cx="' + (cx + dx + r * 0.25) + '" cy="' + (cy + r * 0.1) + '" r="' + r * 0.45 + '" fill="' + C.outline + '"/>';
    if (angry) {
      const sgn = dx < 0 ? 1 : -1;
      s += '<line x1="' + (cx + dx - r * 1.1) + '" y1="' + (cy - r * 1.5 - sgn * r * 0.4) + '" x2="' + (cx + dx + r * 1.1) + '" y2="' + (cy - r * 1.5 + sgn * r * 0.4) + '" stroke="' + C.outline + '" stroke-width="4" stroke-linecap="round"/>';
    }
  }
  return s;
}

// 그림자 (오른쪽 아래로 살짝 어긋난 진한 도형)
const shadowCircle = (cx, cy, r) => '<circle cx="' + (cx + 3) + '" cy="' + (cy + 4) + '" r="' + r + '" fill="' + C.outline + '" opacity="0.25"/>';

const ART = {
  // 플레이어: 초록 동그라미 + 눈 + 하이라이트
  player: () => svg(52, 52, shadowCircle(25, 25, 21) +
    '<circle cx="25" cy="25" r="21" fill="' + C.green + '" stroke="' + C.outline + '" stroke-width="' + OL + '"/>' +
    '<ellipse cx="17" cy="16" rx="6" ry="4" fill="' + C.white + '" opacity="0.6"/>' + eyes(26, 25, 7, 5, false)),
  // 기본 적: 빨강 동그라미 + 화난 눈
  basic: () => svg(48, 48, shadowCircle(23, 23, 19) +
    '<circle cx="23" cy="23" r="19" fill="' + C.red + '" stroke="' + C.outline + '" stroke-width="' + OL + '"/>' + eyes(23, 25, 7, 4.5, true)),
  // 돌격형: 갈색 삼각형 (오른쪽을 향함)
  charger: () => svg(52, 48, '<polygon points="9,8 46,24 9,40" fill="' + C.outline + '" opacity="0.25" transform="translate(3,4)"/>' +
    '<polygon points="7,6 46,24 7,42" fill="' + C.brown + '" stroke="' + C.outline + '" stroke-width="' + OL + '" stroke-linejoin="round"/>' + eyes(20, 24, 6, 4, true)),
  // 사인파형: 보라 마름모
  sine: () => svg(50, 50, '<polygon points="25,5 45,25 25,45 5,25" fill="' + C.outline + '" opacity="0.25" transform="translate(3,4)"/>' +
    '<polygon points="25,4 46,25 25,46 4,25" fill="' + C.purple + '" stroke="' + C.outline + '" stroke-width="' + OL + '" stroke-linejoin="round"/>' + eyes(25, 25, 6, 4, true)),
  // 보스: 큰 빨강 동그라미 + 왕관
  boss: () => svg(124, 124, shadowCircle(61, 66, 48) +
    '<circle cx="61" cy="66" r="48" fill="' + C.red + '" stroke="' + C.outline + '" stroke-width="' + OL + '"/>' +
    '<polygon points="34,30 42,8 54,24 61,4 68,24 80,8 88,30" fill="' + C.yellow + '" stroke="' + C.outline + '" stroke-width="' + OL + '" stroke-linejoin="round"/>' +
    eyes(61, 66, 17, 10, true) + '<path d="M44 92 Q61 82 78 92" fill="none" stroke="' + C.outline + '" stroke-width="5" stroke-linecap="round"/>'),
  // 플레이어 총알 (노랑), 옆 총알 (연노랑, 조금 작게), 적 탄 (분홍)
  bullet: () => svg(18, 18, '<circle cx="9" cy="9" r="6.5" fill="' + C.yellow + '" stroke="' + C.outline + '" stroke-width="3"/>'),
  sideBullet: () => svg(16, 16, '<circle cx="8" cy="8" r="5.5" fill="#F7DC94" stroke="' + C.outline + '" stroke-width="3"/>'),
  enemyBullet: () => svg(20, 20, '<circle cx="10" cy="10" r="7.5" fill="' + C.pink + '" stroke="' + C.outline + '" stroke-width="3"/>'),
  // 시간 지연 범위 원 (반지름 140 → 크기 % 로 줄여 쓴다)
  slowRing: () => svg(288, 288, '<circle cx="144" cy="144" r="138" fill="' + C.green + '" fill-opacity="0.2" stroke="' + C.green + '" stroke-width="10" stroke-dasharray="30 18"/>'),
  // 배경: 크림색 + 옅은 + 무늬 (엔트리 무대 480×270 의 2배)
  background: () => {
    let s = '<rect width="960" height="540" fill="' + C.background + '"/>';
    for (let x = 60; x < 960; x += 120) for (let y = 60; y < 540; y += 120) {
      s += '<path d="M' + (x - 7) + " " + y + " H" + (x + 7) + " M" + x + " " + (y - 7) + " V" + (y + 7) + '" stroke="' + C.outline + '" stroke-opacity="0.12" stroke-width="3" stroke-linecap="round"/>';
    }
    return svg(960, 540, s);
  },
  // 카드 (240×320): 색 띠 + 이름 + 분야 + 수식 + 설명 + 아래 꼬리표
  card: (c) => {
    const w = 240, h = 320;
    let s = '<rect x="10" y="12" width="' + (w - 18) + '" height="' + (h - 20) + '" rx="18" fill="' + C.outline + '"/>';
    s += '<rect x="5" y="5" width="' + (w - 18) + '" height="' + (h - 20) + '" rx="18" fill="' + C.white + '" stroke="' + C.outline + '" stroke-width="' + OL + '"/>';
    s += '<rect x="17" y="18" width="' + (w - 42) + '" height="46" rx="12" fill="' + C[c.color] + '" stroke="' + C.outline + '" stroke-width="' + OL + '"/>';
    s += '<text x="' + (w / 2 - 4) + '" y="50" text-anchor="middle" font-family="' + FONT + '" font-size="26" fill="' + C.white + '" stroke="' + C.outline + '" stroke-width="5" paint-order="stroke">' + esc(c.name) + "</text>";
    s += '<text x="' + (w / 2 - 4) + '" y="86" text-anchor="middle" font-family="' + FONT + '" font-size="15" fill="' + C.brown + '">' + esc(c.concept) + "</text>";
    s += '<text x="' + (w / 2 - 4) + '" y="128" text-anchor="middle" font-family="' + TITLE_FONT + '" font-size="27" fill="' + C[c.color] + '" stroke="' + C.outline + '" stroke-width="5" paint-order="stroke">' + esc(c.formula) + "</text>";
    c.desc.forEach((line, i) => {
      s += '<text x="' + (w / 2 - 4) + '" y="' + (168 + i * 23) + '" text-anchor="middle" font-family="' + FONT + '" font-size="16" fill="' + C.outline + '">' + esc(line) + "</text>";
    });
    s += '<rect x="' + (w / 2 - 58) + '" y="' + (h - 58) + '" width="108" height="30" rx="15" fill="' + (c.supply ? C.gray : C.yellow) + '" stroke="' + C.outline + '" stroke-width="3"/>';
    s += '<text x="' + (w / 2 - 4) + '" y="' + (h - 37) + '" text-anchor="middle" font-family="' + FONT + '" font-size="16" fill="' + C.outline + '">' + esc(c.tag) + "</text>";
    return svg(w, h, s);
  },
};


// ---- 공통 도우미 ----
// 스티커 사각형: 오른쪽 아래로 밀린 진한 그림자 + 채우기 + 외곽선
function sticker(x, y, w, h, r, fill, depth) {
  return '<rect x="' + (x + depth) + '" y="' + (y + depth) + '" width="' + w + '" height="' + h + '" rx="' + r + '" fill="' + C.outline + '"/>' +
    '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="' + r + '" fill="' + fill + '" stroke="' + C.outline + '" stroke-width="' + OL + '"/>';
}
// 외곽선 글자 (게임의 drawOutlinedText 와 같다: 진한 테두리 + 색 채우기)
function otext(str, x, y, size, fill, anchor, font, stroke) {
  return '<text x="' + x + '" y="' + y + '" text-anchor="' + (anchor || "middle") + '" dominant-baseline="central" font-family="' + (font || FONT) + '" font-size="' + size +
    '" fill="' + (fill || C.white) + '" stroke="' + C.outline + '" stroke-width="' + (stroke ?? 6) + '" stroke-linejoin="round" paint-order="stroke">' + esc(str) + "</text>";
}
// 체력바 (하얀 바탕 → 비율만큼 채우기 → 외곽선). 게임의 drawBar 와 같다
function bar(x, y, w, h, ratio, fill, ol) {
  let s = '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="' + h / 2 + '" fill="' + C.white + '"/>';
  if (ratio > 0) s += '<rect x="' + x + '" y="' + y + '" width="' + Math.max(h, w * ratio) + '" height="' + h + '" rx="' + h / 2 + '" fill="' + fill + '"/>';
  return s + '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="' + h / 2 + '" fill="none" stroke="' + C.outline + '" stroke-width="' + (ol || OL) + '"/>';
}

Object.assign(ART, {
  // 대미지 숫자 글자 하나 (28 × 40): 0~9, +, −  /  색: 흰(보통) 노랑(큰 한 방) 빨강(내가 맞음) 초록(회복)
  glyph: (ch, color) => svg(28, 40, otext(ch, 14, 21, 36, color, "middle", FONT, 7)),
  word: (str, color, w) => svg(w, 40, otext(str, w / 2, 21, 30, color, "middle", FONT, 7)),
  // 상태창 패널 (갈색, 360 × 128)
  hudPanel: () => svg(368, 136, sticker(2, 2, 358, 126, 26, C.brown, 6)),
  // 체력바 (300 × 34): 비율 0~20 단계, 30% 이하는 빨강
  hpBar: (level, red) => svg(304, 38, bar(2, 2, 300, 34, level / 20, red ? C.red : C.green)),
  // 적 머리 위 작은 체력바 (52 × 16)
  enemyBar: (level) => svg(54, 18, bar(2, 2, 50, 14, level / 20, C.green, 3)),
  // 보스 체력바 (화면 위 가운데): "보스" 노란 글자 + 빨간 바
  bossBar: (level) => svg(304, 80, otext("보스", 152, 18, 28, C.yellow) + bar(2, 44, 300, 32, level / 20, C.red)),
  // 증강 패널 (오른쪽 위). rows = 줄 수
  augPanel: (rows) => svg(248, 60 + rows * 38, sticker(2, 2, 238, 50 + rows * 38, 24, C.brown, 6) + otext("증강", 24, 30, 26, C.white, "start")),
  // 증강 한 줄 (220 × 36): 색 동그라미 + 이름 + Lv
  augRow: (color, name, lv) => svg(220, 38, '<circle cx="18" cy="19" r="11" fill="' + C[color] + '" stroke="' + C.outline + '" stroke-width="3"/>' +
    otext(name, 38, 20, 22, C.white, "start", FONT, 5) + otext("Lv." + lv, 212, 20, 22, C.yellow, "end", FONT, 5)),
  // 메뉴 제목 스티커 (노랑)
  menuTitle: () => svg(540, 170, sticker(6, 6, 520, 150, 34, C.yellow, 10) + otext("증강 슈터", 266, 64, 70) + otext("수학 · 과학 공식으로 살아남기", 266, 124, 24, C.white, "middle", FONT, 5)),
  // 버튼 (스티커, 가운데 글자)
  button: (label, color, w, h, size) => svg(w + 12, h + 12, sticker(3, 3, w, h, h / 2, C[color], 7) + otext(label, w / 2 + 3, h / 2 + 4, size || 28)),
  // 큰 패널: 크림색 + 위쪽 색 띠 제목 + 글 여러 줄 [글, 색, 크기]
  panel: (title, color, lines, w, h) => {
    let s = sticker(4, 4, w, h, 30, C.white, 10);
    s += sticker(w / 2 - 130, -2 + 22, 260, 64, 22, C[color], 6) + otext(title, w / 2 + 4, 54, 36);
    (lines || []).forEach((ln) => { s += otext(ln[0], w / 2 + 4, ln[3], ln[2] || 24, ln[1] || C.outline, "middle", FONT, ln[1] && ln[1] !== C.outline ? 6 : 0); });
    return svg(w + 16, h + 16, s);
  },
  // 화면을 어둡게 덮는 반투명 판 (960 × 540)
  dim: () => svg(960, 540, '<rect width="960" height="540" fill="' + C.outline + '" fill-opacity="0.45"/>'),
  // 웨이브 시작 띠 (노랑 리본)
  bannerStrip: () => svg(560, 96, sticker(4, 4, 540, 80, 28, C.yellow, 8)),
});

module.exports = { ART, C };
