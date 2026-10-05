// =============================================================
// tools/entry/blocks.js : 엔트리 블록을 짧게 적기 위한 도우미
// -------------------------------------------------------------
// 엔트리 작품(project.json)의 블록은 { type, params, statements } 모양의 객체다.
// 매번 길게 쓰기 힘드니, 여기 함수들로 블록을 만든다.
//   예) when.run([ set("체력", 100), forever([ moveX(5) ]) ])
// 변수·신호·오브젝트는 "이름"으로 쓰고, build-ent.js 가 마지막에 아이디로 바꾼다.
//   (이름 → 아이디 표는 ctx 에 들어 있다)
// =============================================================

let ctx = null;   // { vars: {이름: id}, lists: {이름: id}, msgs: {이름: id}, objs: {이름: id}, pics: {"오브젝트/모양": id} }
function setContext(c) { ctx = c; }

function need(table, name, kind) {
  const id = (table === "vars" && ctx.localVars[name]) || ctx[table][name];
  if (!id) throw new Error(kind + " 을(를) 찾을 수 없음: " + name);
  return id;
}

// ---- 값 블록 ----
// 숫자·글자는 그대로 쓰면 자동으로 블록으로 바꾼다 (ex(5) → 숫자 블록)
function ex(v) {
  if (v && typeof v === "object") return v;
  if (typeof v === "number") return { type: "number", params: [String(v)] };
  return { type: "text", params: [String(v)] };
}
const num = (v) => ({ type: "number", params: [String(v)] });
const txt = (v) => ({ type: "text", params: [String(v)] });
const T = () => ({ type: "True", params: [null] });

// 계산: op 는 "+", "-", "*", "/"
const OPS = { "+": "PLUS", "-": "MINUS", "*": "MULTI", "/": "DIVIDE" };
function calc(a, op, b) { return { type: "calc_basic", params: [ex(a), OPS[op], ex(b)] }; }
const add = (a, b) => calc(a, "+", b);
const sub = (a, b) => calc(a, "-", b);
const mul = (a, b) => calc(a, "*", b);
const div = (a, b) => calc(a, "/", b);
// 수학 연산: square, root, sin, cos, tan, asin_radian, acos_radian, atan_radian, log, ln, floor, ceil, round, abs ...
function mathOp(name, a) { return { type: "calc_operation", params: [null, ex(a), null, name] }; }
function rand(a, b) { return { type: "calc_rand", params: [null, ex(a), null, ex(b), null] }; }
function mod(a, b) { return { type: "quotient_and_mod", params: [null, ex(a), null, ex(b), null, "MOD"] }; }
function join(a, b) { return { type: "combine_something", params: [null, ex(a), null, ex(b), null] }; }
// 변수 값
function v(name) { return { type: "get_variable", params: [need("vars", name, "변수"), null] }; }
// 오브젝트의 x, y, size ... ("self" = 자신)
function coord(obj, what) { return { type: "coordinate_object", params: [null, obj === "self" ? "self" : need("objs", obj, "오브젝트"), null, what] }; }
function dist(obj) { return { type: "distance_something", params: [null, obj === "mouse" ? "mouse" : need("objs", obj, "오브젝트"), null] }; }
const myX = () => coord("self", "x");
const myY = () => coord("self", "y");

// ---- 판단 ----
const CMP = { "=": "EQUAL", "!=": "NOT_EQUAL", ">": "GREATER", "<": "LESS", ">=": "GREATER_OR_EQUAL", "<=": "LESS_OR_EQUAL" };
function cmp(a, op, b) { return { type: "boolean_basic_operator", params: [ex(a), CMP[op], ex(b)] }; }
function and(a, b) { return { type: "boolean_and_or", params: [a, "AND", b] }; }
function or(a, b) { return { type: "boolean_and_or", params: [a, "OR", b] }; }
function not(a) { return { type: "boolean_not", params: [null, a, null] }; }
// 키보드 키 코드: 왼쪽 37, 위 38, 오른쪽 39, 아래 40, 스페이스 32, A 65, D 68, S 83, W 87
function key(code) { return { type: "is_press_some_key", params: [String(code), null] }; }
// 다른 오브젝트(또는 "edge" 벽)에 닿았는가
function touching(obj) {
  const target = obj === "edge" ? "edge" : obj === "mouse" ? "mouse" : need("objs", obj, "오브젝트");
  return { type: "reach_something", params: [null, target, null] };
}

// ---- 명령 블록 ----
const blk = (type, params, statements) => (statements ? { type, params, statements } : { type, params });
// 묻고 기다리기 · 대답 · 대답 숨기기 · "숫자인가?"
const ask = (text) => blk("ask_and_wait", [ex(text), null]);
const answer = () => ({ type: "get_canvas_input_value", params: [null] });
const hideAnswer = () => blk("set_visible_answer", ["HIDE", null]);
function isNumber(val) { return { type: "is_type", params: [ex(val), null, "number", null] }; }
const set = (name, val) => blk("set_variable", [need("vars", name, "변수"), ex(val), null]);
const change = (name, val) => blk("change_variable", [need("vars", name, "변수"), ex(val), null]);
const showVar = (name) => blk("show_variable", [need("vars", name, "변수"), null]);
const hideVar = (name) => blk("hide_variable", [need("vars", name, "변수"), null]);
const goXY = (x, y) => blk("locate_xy", [ex(x), ex(y), null]);
const setX = (x) => blk("locate_x", [ex(x), null]);
const setY = (y) => blk("locate_y", [ex(y), null]);
const moveX = (d) => blk("move_x", [ex(d), null]);
const moveY = (d) => blk("move_y", [ex(d), null]);
const goTo = (obj) => blk("locate", [need("objs", obj, "오브젝트"), null]);
const rotateTo = (deg) => blk("rotate_absolute", [{ type: "angle", params: [String(deg)] }, null]);
const rotateToV = (val) => blk("rotate_absolute", [ex(val), null]);
const show = () => blk("show", [null]);
const hide = () => blk("hide", [null]);
// 모양 바꾸기: obj 오브젝트의 pic 모양 (이름)
const shape = (obj, pic) => blk("change_to_some_shape", [{ type: "get_pictures", params: [need("pics", obj + "/" + pic, "모양")] }, null]);
const size = (s) => blk("set_scale_size", [ex(s), null]);
// 효과 "정하기" (kind: color, brightness, transparency). 엔트리 블록 이름이 헷갈린다:
//   change_effect_amount = 정하기, add_effect_amount = 더하기, set_effect_amount = 옛날 블록(더하기)
const effect = (kind, val) => blk("change_effect_amount", [kind, ex(val), null]);
const clearEffects = () => blk("erase_all_effects", [null]);
const front = () => blk("change_object_index", ["FRONT", null]);
const write = (val) => blk("text_write", [ex(val), null]);   // 글상자 내용 바꾸기
const say = (val) => blk("dialog", [ex(val), "speak", null]);
const unsay = () => blk("remove_dialog", [null]);
const wait = (sec) => blk("wait_second", [ex(sec), null]);
const waitUntil = (cond) => blk("wait_until_true", [cond, null]);
const clone = (obj) => blk("create_clone", [obj === "self" ? "self" : need("objs", obj, "오브젝트"), null]);
const deleteClone = () => blk("delete_clone", [null]);
const removeAllClones = () => blk("remove_all_clones", [null]);
const send = (msg) => blk("message_cast", [need("msgs", msg, "신호"), null]);
const sendWait = (msg) => blk("message_cast_wait", [need("msgs", msg, "신호"), null]);
// stop: "all" 모두, "thisOnly" 이 오브젝트, "thisThread" 이 코드, "otherThread" 이 오브젝트의 다른 코드
const stop = (what) => blk("stop_object", [what, null]);

// 모양을 계산 결과로 바꾸기 (번호 또는 모양 이름)
const shapeV = (val) => blk("change_to_some_shape", [ex(val), null]);
// 글상자 글자 색 ("#RRGGBB")
const fontColor = (hex) => blk("text_change_font_color", [{ type: "text_color", params: [hex] }, null]);

// ---- 리스트 (대기열처럼 쓴다: 뒤에 넣고, 1번을 꺼낸다) ----
const listAdd = (name, val) => blk("add_value_to_list", [ex(val), need("lists", name, "리스트"), null]);
const listRemove = (name, idx) => blk("remove_value_from_list", [ex(idx), need("lists", name, "리스트"), null]);
const listSet = (name, idx, val) => blk("change_value_list_index", [need("lists", name, "리스트"), ex(idx), ex(val), null]);
function listItem(name, idx) { return { type: "value_of_index_from_list", params: [null, need("lists", name, "리스트"), null, ex(idx), null] }; }
function listLen(name) { return { type: "length_of_list", params: [null, need("lists", name, "리스트"), null] }; }

// ---- 글자 ----
function charAt(str, i) { return { type: "char_at", params: [null, ex(str), null, ex(i), null] }; }   // i 번째 글자 (1부터)
function strLen(str) { return { type: "length_of_string", params: [null, ex(str), null] }; }
function indexOf(str, part) { return { type: "index_of_string", params: [null, ex(str), null, ex(part), null] }; }   // 처음 나오는 위치 (없으면 0)
// 가로만 늘리기: 지금 크기(가로·세로 평균)를 기준으로 가로 배율을 (크기 + val) ÷ 크기 배로
const stretchW = (val) => blk("stretch_scale_size", ["WIDTH", ex(val), null]);
const resetSize = () => blk("reset_scale_size", [null]);

// ---- 흐름 블록 (안에 블록 목록을 넣는다) ----
const forever = (body) => blk("repeat_inf", [null, null], [body]);
const repeat = (n, body) => blk("repeat_basic", [ex(n), null], [body]);
const repeatUntil = (cond, body) => blk("repeat_while_true", [cond, "until", null], [body]);
const iff = (cond, body) => blk("_if", [cond, null], [body]);
const ifElse = (cond, yes, no) => blk("if_else", [cond, null], [yes, no]);

// ---- 시작 블록 (스크립트 하나 = [시작 블록, ...이어지는 블록]) ----
const when = {
  run: (body) => [{ type: "when_run_button_click", params: [null], x: 40, y: 40 }, ...body],
  msg: (msg, body) => [{ type: "when_message_cast", params: [null, need("msgs", msg, "신호")], x: 40, y: 40 }, ...body],
  clone: (body) => [{ type: "when_clone_start", params: [null], x: 40, y: 40 }, ...body],
  click: (body) => [{ type: "when_object_click", params: [null], x: 40, y: 40 }, ...body],
  key: (code, body) => [{ type: "when_some_key_pressed", params: [null, String(code)], x: 40, y: 40 }, ...body],
};

module.exports = {
  setContext, ex, num, txt, T, calc, add, sub, mul, div, mathOp, rand, mod, join, v, coord, dist, myX, myY,
  cmp, and, or, not, key, touching,
  set, change, showVar, hideVar, goXY, setX, setY, moveX, moveY, goTo, rotateTo, rotateToV, show, hide, shape, size,
  effect, clearEffects, front, write, say, unsay, wait, waitUntil, clone, deleteClone, removeAllClones, send, sendWait, stop,
  shapeV, fontColor, listAdd, listRemove, listSet, listItem, listLen, blk, charAt, strLen, indexOf, stretchW, resetSize, ask, answer, hideAnswer, isNumber,
  forever, repeat, repeatUntil, iff, ifElse, when,
};
