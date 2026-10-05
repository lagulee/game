// =============================================================
// tools/entry/assemble.js : 게임 설계(오브젝트·변수·신호·스크립트)를 엔트리 작품으로 묶는다
// -------------------------------------------------------------
// 엔트리 .ent 파일 = tar.gz 압축 파일
//   temp/project.json              작품 정보 (오브젝트, 블록, 변수 ...)
//   temp/ab/cd/image/abcd....png   모양 그림 (파일 이름 앞 4글자로 폴더를 나눈다)
//   temp/ab/cd/thumb/abcd....png   모양 미리보기 그림
// (엔트리 오프라인 프로그램의 저장 방식과 같다: entrylabs/entry-offline)
// =============================================================

const B = require("./blocks.js");

// 같은 입력이면 늘 같은 아이디가 나오게 (작품을 다시 만들어도 내용이 같도록)
let idSeed = 1;
function makeId(len) {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let s = "";
  for (let i = 0; i < len; i++) {
    idSeed = (Math.imul(idSeed, 1664525) + 1013904223) >>> 0;
    s += chars[idSeed % chars.length];
  }
  return s;
}

// 블록에 아이디·좌표를 붙인다 (엔트리가 저장할 때 붙이는 기본 항목)
function finishBlock(b) {
  if (!b || typeof b !== "object") return b;
  const out = { id: makeId(4), x: b.x || 0, y: b.y || 0, type: b.type, params: (b.params || []).map(finishBlock), statements: (b.statements || []).map((list) => list.map(finishBlock)),
    movable: null, deletable: 1, emphasized: false, readOnly: null, copyable: true, assemble: true, extensions: [] };
  return out;
}

// design = {
//   scene: "장면 이름",
//   variables: [{ name, value, visible, x, y, local: "오브젝트 이름" }],
//   messages: ["신호 이름", ...],
//   objects: [{ name, type: "sprite"|"textBox", pictures: [{ name, png: Buffer, width, height }],
//               x, y, scale, visible, text, font, colour, scripts: (B) => [스크립트, ...] }]
//   (objects 순서 = 엔트리 오브젝트 목록 순서. 위에 있을수록 앞에 그려진다)
// }
// 결과: { project, files: [{ path, data }] }
function assemble(design) {
  idSeed = 1;
  const sceneId = makeId(4);
  // locals: { 오브젝트 이름: { 변수 이름: id } } — 같은 이름의 지역 변수가 여러 오브젝트에 있을 수 있다
  const ctx = { vars: {}, msgs: {}, objs: {}, pics: {}, locals: {}, localVars: {} };
  for (const o of design.objects) { o.id = makeId(4); ctx.objs[o.name] = o.id; }
  const variables = [];
  for (const vd of design.variables) {
    const id = makeId(4);
    if (vd.local) (ctx.locals[vd.local] = ctx.locals[vd.local] || {})[vd.name] = id;
    else ctx.vars[vd.name] = id;
    variables.push({ name: vd.name, id, visible: !!vd.visible, value: String(vd.value ?? 0), variableType: "variable",
      isCloud: false, isRealTime: false, cloudDate: false, object: vd.local ? ctx.objs[vd.local] : null, x: vd.x ?? 0, y: vd.y ?? 0 });
  }
  const messages = design.messages.map((name) => { const id = makeId(4); ctx.msgs[name] = id; return { name, id }; });
  const files = [];
  // 그림 파일: 아이디를 먼저 정해 둔다 (스크립트가 모양 이름 → 아이디 표를 쓴다)
  for (const o of design.objects) {
    o.pictureModels = (o.pictures || []).map((p) => {
      const id = makeId(4), file = makeId(32), dir = file.slice(0, 2) + "/" + file.slice(2, 4);
      ctx.pics[o.name + "/" + p.name] = id;
      files.push({ path: "temp/" + dir + "/image/" + file + ".png", data: p.png });
      files.push({ path: "temp/" + dir + "/thumb/" + file + ".png", data: p.thumb || p.png });
      return { id, name: p.name, filename: file, imageType: "png", dimension: { width: p.width, height: p.height },
        fileurl: "temp/" + dir + "/image/" + file + ".png", thumbUrl: "temp/" + dir + "/thumb/" + file + ".png" };
    });
  }
  B.setContext(ctx);
  const objects = design.objects.map((o) => {
    ctx.localVars = ctx.locals[o.name] || {};   // 이 오브젝트의 지역 변수를 먼저 찾는다
    const scripts = (o.scripts ? o.scripts(B) : []).map((s) => s.map(finishBlock));
    const base = { id: o.id, name: o.name, script: JSON.stringify(scripts), scene: sceneId, lock: false, rotateMethod: o.rotateMethod || "free" };
    if (o.type === "textBox") {
      const w = o.width || 200, h = o.height || 30;
      return Object.assign(base, { objectType: "textBox", text: o.text || "", sprite: { pictures: [], sounds: [] }, selectedPictureId: null,
        entity: { x: o.x || 0, y: o.y || 0, regX: w / 2, regY: h / 2, scaleX: 1, scaleY: 1, rotation: 0, direction: 90, width: w, height: h,
          font: o.font || "20px NanumGothic", colour: o.colour || "#2B2118", bgColor: o.bgColor || "transparent", text: o.text || "",
          textAlign: o.textAlign ?? 1, lineBreak: !!o.lineBreak, underLine: false, strike: false, visible: o.visible !== false } });
    }
    const first = o.pictureModels[0];
    const scale = o.scale ?? 1;
    return Object.assign(base, { objectType: "sprite", selectedPictureId: first.id, sprite: { pictures: o.pictureModels, sounds: [] },
      entity: { x: o.x || 0, y: o.y || 0, regX: first.dimension.width / 2, regY: first.dimension.height / 2, scaleX: scale, scaleY: scale,
        rotation: 0, direction: 90, width: first.dimension.width, height: first.dimension.height, visible: o.visible !== false } });
  });
  const project = { objects, scenes: [{ id: sceneId, name: design.scene || "장면 1" }], variables, messages, functions: [], tables: [],
    speed: 60, interface: { menuWidth: 280, canvasWidth: 480, object: objects[0].id }, expansionBlocks: [], aiUtilizeBlocks: [],
    hardwareLiteBlocks: [], externalModules: [], externalModulesLite: [] };
  return { project, files };
}

module.exports = { assemble };
