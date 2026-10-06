// =============================================================
// tools/serve.js : 게임 폴더를 작은 웹 서버로 열어 주는 도우미 (검사·측정 도구 전용)
// -------------------------------------------------------------
// 왜 필요할까?
//   게임의 조절 숫자는 "const 이름 = 값;" 으로 적혀 있어서, 페이지가 열린 뒤에는 바꿀 수 없다.
//   그래서 파일을 브라우저에 보내 줄 때 글자를 바꿔 끼워서 보낸다.
//   예: { WAVE_SPAWN_BATCH: 1 } → "const WAVE_SPAWN_BATCH = 3;" 을 "const WAVE_SPAWN_BATCH = 1;" 로
//   게임 파일 자체는 전혀 바뀌지 않는다.
//
// 사용법
//   const server = await startServer(폴더);
//   server.setOverrides({ ENEMY_SPEED_BASE: 1.15 });  // 다음에 여는 페이지부터 적용
//   page.goto(server.url + "index.html");
//   server.close();
// =============================================================

const http = require("http");
const fs = require("fs");
const path = require("path");

const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8" };

function startServer(root) {
  let overrides = {};
  const server = http.createServer((req, res) => {
    const file = path.join(root, decodeURIComponent(req.url.split("?")[0]));
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404); res.end(); return;
    }
    let body = fs.readFileSync(file);
    const ext = path.extname(file);
    if (ext === ".js") {
      let text = body.toString("utf8");
      // 바꿔 끼울 상수를 하나씩 찾아 값만 바꾸는 반복문
      for (const name in overrides) {
        const re = new RegExp("(^|\\n)(const " + name + " = )[^;]+;");
        if (re.test(text)) text = text.replace(re, "$1$2" + String(overrides[name]) + ";");
      }
      body = text;
    }
    res.writeHead(200, { "Content-Type": TYPES[ext] || "application/octet-stream", "Cache-Control": "no-store" });
    res.end(body);
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      resolve({
        url: "http://127.0.0.1:" + server.address().port + "/",
        // 다음에 여는 페이지부터 적용할 상수 목록 (없는 이름이 있으면 바로 알려 준다)
        setOverrides(map) {
          const all = ["game.js", "enemies.js", "waves.js", "upgrades.js", "augments.js", "save.js", "skills.js", "tutorial.js", "rules.js"]
            .map((f) => fs.readFileSync(path.join(root, f), "utf8")).join("\n");
          for (const name in map) {
            if (!new RegExp("(^|\\n)const " + name + " = ").test(all)) throw new Error("상수를 찾을 수 없음: " + name);
          }
          overrides = Object.assign({}, map);
        },
        close() { server.close(); },
      });
    });
  });
}

module.exports = { startServer };
