# 발로란트 플래시 · 감도 스펙 조사 (0단계)

- 조사일: 2026-10-14
- 조사 방법: 웹 검색 결과(검색 엔진 요약)만 사용했다. 이 작업 환경의 네트워크 정책 때문에
  playvalorant.com, wiki.playvalorant.com, valorant.fandom.com 페이지를 **직접 열지 못했다.**
  그래서 "확인됨"도 **검색 결과에 인용된 공식 패치 노트 문구** 수준이다.
  실제 게임에 반영하기 전에 공식 패치 노트나 사격장에서 한 번 더 확인하는 것이 좋다.
- 검색으로 찾은 가장 최근 패치는 13.02(2026-07-28)이고, 요약 사이트에 13.06까지 언급된다.
  13.x 패치 요약에서 아래 플래시 수치를 바꾼 기록은 **찾지 못했다**(쿨다운 변경만 있었다).

## 표기 규칙

| 표기 | 뜻 |
|---|---|
| ✅ 확인 | 공식 패치 노트 문구를 인용한 검색 결과가 둘 이상, 또는 공식 노트 직접 인용 |
| 🟡 2차 | 공략 사이트·커뮤니티 위키 등 2차 출처 하나뿐 |
| ❌ 미확인 | 찾지 못함. 게임에서는 **근사값**을 쓰고 `src/config/flash.js`에 "근사값"이라고 표시 |

---

## 1. 요원별 플래시 스펙

### 1-1. 피닉스 Curveball (Q)

| 항목 | 값 | 상태 | 출처 / 메모 |
|---|---|---|---|
| 최대 눈뽕 | **1.5 s** | ✅ | 5.01: 1.1s → 1.5s ([Patch 5.01 위키](https://wiki.playvalorant.com/en-us/Patch_Notes/5.01), [PCGamesN](https://www.pcgamesn.com/valorant/patch-5-01-phoenix-yoru-buffs-kayo-changes-smurf-detection)). 이후 변경 기록 못 찾음 |
| 윈드업(던진 뒤 터질 때까지) | **0.6 s** | ✅ | 5.01: 0.7→0.5s, **11.00: 0.5→0.6s** ([Patch Notes 11.00](https://playvalorant.com/en-us/news/game-updates/valorant-patch-notes-11-00/), [Dexerto](https://www.dexerto.com/valorant/valorant-11-00-patch-notes-bring-massive-agent-buffs-and-nerfs-3218419/), [Liquipedia 11.00](https://liquipedia.net/valorant/Patch_11.00)). 작업 지시서의 0.5s는 11.00 이전 값 |
| 곡선 방향 | 좌클릭 = 왼쪽, 우클릭 = 오른쪽 | ✅(2차 둘) | [Liquipedia Phoenix](https://liquipedia.net/valorant/Phoenix), [Switchblade](https://www.switchbladegaming.com/valorant/phoenix-guide/). 정면 직선 투척은 없음([Upcomer](https://upcomer.com/valorant-guide-how-to-play-the-fiery-phoenix)) |
| 던지는 모션 시간 | — | ❌ | 근사 |
| 비행 속도, 곡률 | — | ❌ | 근사 |

### 1-2. 스카이 Guiding Light (E)

| 항목 | 값 | 상태 | 출처 / 메모 |
|---|---|---|---|
| 최대 눈뽕 | **1.0 s → 2.25 s**, 시전 후 **0.75 s** 동안 충전되며 증가 | ✅ | 5.07 공식 노트 ([Patch Notes 5.07](https://playvalorant.com/en-us/news/game-updates/valorant-patch-notes-5-07/), [Dexerto](https://www.dexerto.com/valorant/valorant-patch-5-07-notes-kay-o-nerf-skye-buff-fracture-map-changes-more-1949296/)). PBE에서는 최소 1.25s였음 ([X @ValorantUpdated](https://x.com/ValorantUpdated/status/1573449811772297234)) |
| 최소값 버그 | 1.25s 상한 버그가 v10.00에서 수정됨 | 🟡 | 공식 위키 업데이트 이력(검색 요약) |
| 매 사격 파괴 | 5.07부터 파괴 불가 | ✅ | 5.07 |
| 12.05 | 쿨다운 45 → 60 s(재충전 복귀), 눈뽕 수치 변경 없음 | ✅ | [Patch Notes 12.05](https://playvalorant.com/en-us/news/game-updates/valorant-patch-notes-12-05/) |
| 재사용(터뜨리기) 후 윈드업 | — | ❌ | 근사 |
| 매 비행 속도·최대 비행 시간 | — | ❌ | 근사 |

### 1-3. 요루 Blindside (Q)

| 항목 | 값 | 상태 | 출처 / 메모 |
|---|---|---|---|
| 최대 눈뽕 | **1.5 s** | ✅ | **11.08: 1.75 → 1.5 s** ([Patch Notes 11.08](https://playvalorant.com/en-us/news/game-updates/valorant-patch-notes-11-08/), [THESPIKE](https://www.thespike.gg/valorant/news/valorant-patch-11-08-major-ability-changes-new-gunplay-and-more/6952)) |
| 윈드업 | **0.6 s** (단단한 표면에 부딪힌 뒤 시작) | 🟡 | 공식 위키 수치(검색 요약). 11.08에서 윈드업 변경 기록 없음 |
| 화면 밖 플래시 | 11.08: "화면 밖 플래시가 다른 요원(척후대) 플래시와 같은 규칙으로 감소" | ✅ | 11.08 — 즉 **화면 밖이어도 부분 눈뽕**이 있다는 뜻 |
| 12.05 | 충전 2 → 1회 | ✅ | 12.05 |
| 비행 속도 | — | ❌ | 근사 |

> X의 @ValorantUpdated 글은 "2s → 1.6s"라고 적었지만 공식 노트와 다르다. 공식 노트(1.75 → 1.5)를 따른다.

### 1-4. 케이/오 FLASH/drive (Q)

| 항목 | 값 | 상태 | 출처 / 메모 |
|---|---|---|---|
| 오버핸드(좌클릭) 최대 눈뽕 | **2.25 s** | ✅ | 5.07: 2s → 2.25s ([X @ValorantUpdated 5.07](https://x.com/ValorantUpdated/status/1577296088230412293), Dexerto). 이후 변경 기록 못 찾음 |
| 언더핸드(우클릭) 최대 눈뽕 | **1.5 s** | ✅ | 5.07: 2→1.25s, **10.06: 1.25 → 1.5 s** ([Tracker.gg 10.06](https://tracker.gg/valorant/articles/valorant-patch-notes-10-06-kay-o-buffs-yoru-and-vyse-nerfs), [X @ValorINTEL](https://x.com/ValorINTEL/status/1907058340577890467)) |
| 튕기면 윈드업 | 튕기는 순간 **0.8 s** 윈드업 후 폭발. 이미 0.8s 안에 터질 예정이면 적용 안 함 | ✅ | 10.06 |
| 오버핸드 신관(던진 뒤 폭발) | 약 **1.6 s** | 🟡 | [Dot Esports](https://dotesports.com/valorant/news/how-to-flash-in-valorant-each-agents-flash-ability-explained) (오래된 글) |
| 언더핸드 신관 | 약 **1.0 s** | 🟡 | 위와 같음 |

### 1-5. 브리치 Flashpoint (Q)

| 항목 | 값 | 상태 | 출처 / 메모 |
|---|---|---|---|
| 최대 눈뽕 | **2.25 s** | ✅ | **11.08: 2 → 2.25 s** ([Patch Notes 11.08](https://playvalorant.com/en-us/news/game-updates/valorant-patch-notes-11-08/), [X @VALORANTLeaksEN](https://x.com/VALORANTLeaksEN/status/1978092147782901956)) |
| 윈드업 | **0.5 s** | 🟡 | 1.07: 0.6 → 0.5s (공식 위키·Liquipedia 검색 요약) |
| 투사체 속도 | 2400 (언리얼 단위 = cm/s → **24 m/s**) | 🟡 | v12.00: 2000 → 2400 (공식 위키 업데이트 이력, 검색 요약) |
| 벽 관통 | 벽에 설치해 반대편으로 발사 | ✅(상식적 능력 설명) | — |

> VLR.gg 게시글의 "2.25 → 1.75s + 터널 비전"은 **유저 제안**이었고 실제 패치가 아니다 ([VLR.gg](https://www.vlr.gg/706077/tejo-buffs-and-breach-rework)).

### 1-6. 레이나 Leer (C) — 니어사이트(근시)

| 항목 | 값 | 상태 | 출처 / 메모 |
|---|---|---|---|
| 윈드업 | **0.4 s** (목표 위치 도착 후) | 🟡 | 공식 위키 수치(검색 요약, ^v5.07 표기) |
| 최대 사거리 이동 시간 | 약 0.55 s | 🟡 | 커뮤니티 위키 |
| 니어사이트 지속 | **1.6 s** | 🟡 | 공식 위키·Hotspawn (2.6 → 2.0 → 1.6 변천, 2.0 출처는 오래됨) |
| 체력 | **60 HP** | 🟡 | 공식 위키 (80 → 60). 100이라는 출처는 콘솔 관련 옛 값 |
| 판정 | 눈을 **바라본** 적에게 근시 | 🟡 | 능력 설명 |

---

## 2. 눈뽕 시각 효과 구조

| 항목 | 내용 | 상태 | 출처 |
|---|---|---|---|
| 완전 눈뽕 | 시야가 **불투명한 색 화면으로 대체**됨 | 🟡 | [Fandom: Status Effect](https://valorant.fandom.com/wiki/Status_Effect) (검색 요약) |
| 페이드 | 지속시간이 끝나면 효과가 **약 1초에 걸쳐 서서히** 사라짐 | 🟡 | 같은 문서 |
| 지속시간 결정 요소 | **바라보는 방향**과 **거리** | 🟡 | 같은 문서 ("dependent on where the target is facing and the distance") |
| 정면 | 정면으로 보면 최대 지속시간 | 🟡 | 같은 문서·여러 공략 |
| 부분 눈뽕 | 5.07부터 적이 "완전/부분 눈뽕"인지 구분 표시 → 부분 눈뽕이 존재 | ✅ | 5.07 |
| 화면 밖 | 11.08 요루 변경 문구로 보아 화면 밖도 감소된 눈뽕 | ✅(간접) | 11.08 |
| **각도 → 지속시간 공식** | — | ❌ | **찾지 못함.** 코사인 기반 곡선으로 근사 |
| **거리 감쇠 공식** | — | ❌ | "거리가 영향을 준다"는 서술만 있고 수치 없음. 브리치 공략은 "거리 무관 최대"라고 서술 — **서로 충돌**. 기본값은 감쇠 끔, 설정으로 켤 수 있게 함 |

## 3. 소리 · 연출

| 항목 | 내용 | 상태 |
|---|---|---|
| 발로란트 고유 이명음 | 발로란트에 이명(삐-) 효과가 있다는 출처는 **찾지 못함** | ❌ |
| 다른 게임 레퍼런스 | CS:GO 플래시 이명은 약 2600 Hz로 알려짐(청력 보호 논란) ([GGRecon](https://www.ggrecon.com/articles/csgo-prod-call-from-flashbang-noise-to-be-reduced-after-causing-ear-damage)) | 🟡 |
| 폭발음 큐 | 요루 4.02: 플래시가 실제로 터진 시점을 알 수 있도록 폭발음 길이 조정 ([Sportskeeda](https://sportskeeda.com/valorant/yoru-audio-updates-might-cards-valorant-patch-4-02)) → 소리가 회피 큐로 쓰인다 | 🟡 |
| 케이/오 튕김 윈드업 | 10.06: 고유 소리·시각 효과 있음 | ✅ |

→ 이명은 **근사 구현**한다: WebAudio로 2.6 kHz 근처 사인파 + 약한 맥놀이. 귀 보호를 위해 기본 볼륨을 낮게 두고 설정에서 끌 수 있게 한다.

---

## 4. 감도 · 시야각

| 항목 | 값 | 상태 | 출처 |
|---|---|---|---|
| yaw | **0.07 °/카운트** | 🟡(작업 지시서 기준값 + 커뮤니티 다수 일치) | [Recharge 변환기](https://www.recharge.com/blog/en-gb/valorant-sensitivity-converter-cs2-apex-ow2-fortnite), [Steam 토론](https://steamcommunity.com/app/714010/discussions/0/2522527267215596248) |
| pitch | yaw와 같은 0.07 (상하 배율 1.0) | 🟡 | 위와 같음(발로란트는 별도 수직 배율 옵션 기본 1.0) |
| CS2 / Apex yaw | 0.022 | 🟡 | [csdb.gg](https://csdb.gg/sensitivity-converter/cs2-to-valorant/), [mouse-sensitivity.com](https://www.mouse-sensitivity.com/n/overwatch/) |
| 오버워치2 yaw | 0.0066 | 🟡 | 위와 같음 |
| 변환 | CS2 → 발로란트 = ×0.022/0.07 = ÷3.1818 | 🟡 | csdb.gg ("1.0 in Valorant equals 3.18 in CS2") |
| 수평 FOV | **103° (16:9 기준, 고정)** | 🟡 | Steam 토론, 커뮤니티 다수. Riot 공식 문서는 찾지 못함 |
| raw 입력 | `requestPointerLock({ unadjustedMovement: true })` — 크롬 계열 지원, 미지원 시 `NotSupportedError` → 일반 포인터 락으로 대체 | ✅ | [web.dev](https://web.dev/articles/disable-mouse-acceleration), [MDN](https://developer.mozilla.org/fr/docs/Web/API/Element/requestPointerLock) |

공식 정리:

$$\Delta\text{yaw}(°) = \text{movementX}\times \text{sens}\times 0.07,\qquad \text{eDPI} = \text{DPI}\times\text{sens}$$

$$\text{cm}/360 = \frac{360 \times 2.54}{\text{DPI}\times\text{sens}\times 0.07}$$

$$\text{발로란트 감도} = \text{원본 감도}\times\frac{\text{원본 yaw}}{0.07}$$

$$\text{수직 FOV} = 2\arctan\!\left(\frac{\tan(103°/2)}{\text{가로}/\text{세로}}\right)\quad(16{:}9 \Rightarrow 약\ 70.5°)$$

---

## 5. 게임에 쓰는 값 요약 (src/config/flash.js 와 일치해야 함)

| 종류 | 최대 눈뽕 | 윈드업 / 신관 | 근거 |
|---|---|---|---|
| 피닉스 커브볼 | 1.5 s | 0.6 s | ✅ / ✅ |
| 스카이 Guiding Light | 1.0→2.25 s (0.75 s 충전) | 재사용 후 0.5 s | ✅ / ❌근사 |
| 요루 Blindside | 1.5 s | 튕긴 뒤 0.6 s | ✅ / 🟡 |
| 케이/오 오버핸드 | 2.25 s | 1.6 s (튕기면 0.8 s) | ✅ / 🟡(✅) |
| 케이/오 언더핸드 | 1.5 s | 1.0 s (튕기면 0.8 s) | ✅ / 🟡(✅) |
| 브리치 Flashpoint | 2.25 s | 0.5 s | ✅ / 🟡 |
| 레이나 Leer | 니어사이트 1.6 s | 0.4 s, 60 HP | 🟡 |
| 공통 페이드 | 지속시간 뒤 1.0 s | | 🟡 |
| 각도 곡선 / 거리 감쇠 / 던지는 모션 / 투사체 속도 | 근사 | | ❌ |

---

## 6. 총 · 봇 (사격 기능 추가 때 조사)

| 항목 | 값 | 상태 | 출처 |
|---|---|---|---|
| 밴달 피해량 (0~50 m) | 머리 160 / 몸 40 / 다리 34 | ✅ | [Liquipedia Vandal](https://liquipedia.net/valorant/Vandal), [Dexerto](https://www.dexerto.com/valorant/how-to-use-the-vandal-valorant-weapon-guide-1367476/) |
| 밴달 연사 속도 | 9.75발/s (1.07에서 9.25 → 9.75) | ✅ | Liquipedia |
| 밴달 탄창 | 25 | ✅ | Liquipedia |
| 체력 | 100 + 중방어구 50 = 150 (몸 4발, 머리 1발) | ✅(2차 둘) | [Dodge.gg](https://www.dodge.gg/en-US/valorant/news/vandal-weapon-guide-2026), Dexerto |
| 반동 패턴 · 이동 부정확도 · 재장전 시간 | — | ❌ | 근사 (`src/config/combat.js`) |

## 7. 훈련용 난이도 (발로란트 값 아님)

- **터지는 시간 배율**(기본 0.7): 브리치를 뺀 플래시의 던지는 모션 · 비행 · 윈드업 시간에 곱한다. 사용자 요청으로 실제보다 어렵게 만든 값이다. 1.0으로 두면 5절 표의 실제 값과 같다.
