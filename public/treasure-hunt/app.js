const canvas = document.querySelector("#game-canvas");
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = true;
const routeParams = new URLSearchParams(window.location.search);
const studyMode = routeParams.get("study") === "1";
const citReturned = routeParams.get("cit") === "complete";
const BRIDGE = "http://127.0.0.1:8765";

const ui = {
  questTitle: document.querySelector("#quest-title"), questProgress: document.querySelector("#quest-progress"),
  message: document.querySelector("#game-message"), actions: document.querySelector("#screen-actions"),
  sessionChip: document.querySelector("#session-chip"), treasureValue: document.querySelector("#treasure-value"), eventLog: document.querySelector("#event-log"),
  condition: document.querySelector("#condition-select"), gem: document.querySelector("#gem-select"),
  storageStatus: document.querySelector("#storage-status"),
};

const gems = [
  { id: "diamond", label: "다이아몬드", color: "#eaf9fc", dark: "#6f8f9d" },
];
// 금화는 진실 집단이 게임 안에서 획득하는 물건이며, CIT 검사 후보에는 넣지 않는다.
// 검사 후보는 동일한 흑백 삽화 규격으로 제시할 것을 전제로 한 별도 목록이다.
const citCandidates = [
  { id: "diamond", label: "다이아몬드" },
  { id: "ring", label: "귀중한 반지" },
  { id: "watch", label: "은제 회중시계" },
  { id: "gold_bar", label: "금괴" },
  { id: "clover", label: "클로버 장식" },
];
const room = { x: 32, y: 30, w: 896, h: 500 };
const player = { x: 130, y: 425, size: 44, facing: "right" };
const pressedKeys = new Set();
const deckCrew = [
  { x: 272, y: 397 }, { x: 320, y: 409 }, { x: 368, y: 398 }, { x: 416, y: 409 }, { x: 464, y: 398 },
];
const crewLines = ["역시 선장님!!", "보물이다!", "우리가 해냈어!", "조심히 실어!", "항해가 살아난다!"];
const practiceQuestions = [
  "당신은 동굴에서 은빛 진주를 가져갔습니까?",
  "당신은 동굴에서 오래된 나침반을 가져갔습니까?",
  "당신은 동굴에서 산호 장식을 가져갔습니까?",
];
const practiceItems = ["pearl", "compass", "coral"];
const practiceAudioFiles = [
  "/treasure-hunt/audio/practice-01-pearl.mp3",
  "/treasure-hunt/audio/practice-02-compass.mp3",
  "/treasure-hunt/audio/practice-03-coral.mp3",
];
let activeCrewBubble = null;
let nextCrewBubbleAt = 0;
let crewTurn = 0;
let crewLineTurn = 0;
let lastFrame = performance.now();
let state;
let allocationLoadStarted = false;

function makeId() { return `CIT-${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}-${Math.floor(Math.random() * 900 + 100)}`; }
function selectedGem() { return gems.find((gem) => gem.id === state.targetGem); }
function escapeCsv(value) { return `"${String(value ?? "").replaceAll("\"", "\"\"")}"`; }
function localTime() { return new Date().toLocaleTimeString("ko-KR", { hour12: false }); }
function distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
function near(target, limit = 52) { return distance({ x: player.x + player.size / 2, y: player.y + player.size / 2 }, target) < limit; }
function shuffle(items) { const copied = [...items]; for (let index = copied.length - 1; index > 0; index -= 1) { const swap = Math.floor(Math.random() * (index + 1)); [copied[index], copied[swap]] = [copied[swap], copied[index]]; } return copied; }
function objectForm(noun) {
  const lastCode = noun.charCodeAt(noun.length - 1);
  const hasFinalConsonant = lastCode >= 0xac00 && lastCode <= 0xd7a3 && (lastCode - 0xac00) % 28 !== 0;
  return `${noun}${hasFinalConsonant ? "을" : "를"}`;
}

function newState() {
  return {
    id: makeId(), phase: "intake", condition: studyMode ? "" : (routeParams.get("condition") || ""), targetGem: ui.gem.value,
    testMode: !studyMode, participant: studyMode ? { code: routeParams.get("participant") || "" } : {}, allocation: null, carrying: null, chest: null, chestValue: 0, storyPage: 0, practiceStimulusVisible: false, practiceIndex: 0, practiceAudioFinished: false, events: [], citSchedule: [], notification: studyMode ? "연구자가 참가자 정보를 입력한 뒤 항해를 시작합니다." : "시연할 집단을 선택하세요. 이 모드에서는 데이터를 저장하지 않습니다.",
  };
}

function saveTemporary() {
  if (state.testMode) return;
  sessionStorage.setItem("ophtheon-cit-game-temporary", JSON.stringify(state));
}

function record(event, detail = "", extra = {}) {
  if (state.testMode) return;
  const entry = {
    local_time: localTime(), iso_time: new Date().toISOString(), session_id: state.id,
    participant_code: state.participant.code || "", condition: state.condition, target_gem: state.targetGem,
    event, detail, ...extra,
  };
  state.events.push(entry);
  saveTemporary();
  renderEventLog();
  sendEventToSupabase(entry);
}

function setMessage(text) { state.notification = text; ui.message.textContent = text; }
function setActions(markup) { ui.actions.innerHTML = markup; }

function updateHud() {
  const target = selectedGem();
  const labels = {
    intake: [state.testMode ? "시연 집단 선택" : "실험 시작 준비", "준비"], story: ["항해 이야기", `${state.storyPage + 1} / 3`], caveIntro: ["동굴 탐색", "2 / 4"], caveExitStory: ["보물 회수", "2 / 4"], deckIntro: ["선박 적재", "4 / 4"],
    shoreToCave: ["동굴 입구로 이동", "1 / 4"], cave: [state.carrying ? "해안으로 돌아가기" : (state.condition === "gem" ? `${target.label} 획득` : "황금 동전 획득"), "2 / 4"],
    shoreToShip: ["보물선으로 이동", "3 / 4"], deck: [state.carrying ? "화물함에 적재" : "적재 완료" , "4 / 4"],
    handoff: ["왕실 검사관 안내", "검사 준비"],
    practice: ["답변 연습", `${state.practiceIndex + 1} / ${practiceQuestions.length}`],
    practiceComplete: ["답변 연습 완료", "완료"], debrief: ["디브리핑", "완료"],
  };
  const [title, progress] = labels[state.phase] || labels.intake;
  ui.questTitle.textContent = title;
  ui.questProgress.textContent = progress;
  ui.treasureValue.textContent = `${new Intl.NumberFormat("ko-KR").format(state.chestValue || 0)} 크라운`;
  const conditionName = state.condition === "gem" ? "보석 집단(거짓)" : "금화 집단(진실)";
  ui.sessionChip.textContent = state.testMode ? `테스트 모드 · ${conditionName}` : (state.participant.code ? `${state.participant.code} · ${conditionName}` : "참가자 입력 대기");
}

function pixelRect(x, y, w, h, color, outline = "#17344b") {
  ctx.fillStyle = outline; ctx.fillRect(x - 3, y - 3, w + 6, h + 6);
  ctx.fillStyle = color; ctx.fillRect(x, y, w, h);
}
function text(value, x, y, size = 14, color = "#183750", align = "left") {
  const displaySize = Math.round(size * 1.5);
  ctx.fillStyle = color; ctx.font = `700 ${displaySize}px "Gaegu", "Malgun Gothic", "Apple SD Gothic Neo", Arial, sans-serif`; ctx.textAlign = align; ctx.fillText(value, x, y);
}
function drawArrow(target) { text("▼", target.x, target.y - 28, 22, "#f6d35b", "center"); }
function drawPortal(x, y, label) {
  const pulse = Math.round(Math.sin(performance.now() / 180) * 2);
  ctx.fillStyle = "rgba(56,224,224,.22)"; ctx.fillRect(x - 34 - pulse, y - 48 - pulse, 68 + pulse * 2, 88 + pulse * 2);
  ctx.fillStyle = "#17344b"; ctx.fillRect(x - 24, y - 43, 48, 76); ctx.fillRect(x - 31, y - 31, 62, 52);
  ctx.fillStyle = "#5ce0de"; ctx.fillRect(x - 20, y - 39, 40, 8); ctx.fillRect(x - 26, y - 25, 52, 40); ctx.fillRect(x - 20, y + 15, 40, 8);
  ctx.fillStyle = "#4567ca"; ctx.fillRect(x - 16, y - 25, 32, 40);
  ctx.fillStyle = "#9ff6ed"; ctx.fillRect(x - 8, y - 20, 16, 30); ctx.fillRect(x - 12, y - 14, 24, 18);
  text("▼", x, y - 60, 18, "#f6d35b", "center"); text(label, x, y + 52, 11, "#17344b", "center");
}
function drawPlayer() {
  const { x, y } = player;
  ctx.fillStyle = "#172f49"; ctx.fillRect(x + 4, y + 8, 36, 8); ctx.fillRect(x + 11, y + 2, 22, 8); ctx.fillRect(x + 15, y - 3, 14, 6);
  ctx.fillStyle = "#b93e38"; ctx.fillRect(x + 12, y + 9, 20, 3);
  ctx.fillStyle = "#f8edcf"; ctx.fillRect(x + 20, y + 3, 5, 5); ctx.fillRect(x + 18, y + 5, 9, 2);
  ctx.fillStyle = "#f2bd8a"; ctx.fillRect(x + 11, y + 16, 22, 15);
  ctx.fillStyle = "#8d4b34"; ctx.fillRect(x + 9, y + 14, 26, 5);
  ctx.fillStyle = "#172f49"; ctx.fillRect(x + (player.facing === "right" ? 27 : 16), y + 21, 3, 3);
  ctx.fillStyle = "#20334f"; ctx.fillRect(x + 7, y + 31, 30, 16);
  ctx.fillStyle = "#efd06a"; ctx.fillRect(x + 6, y + 32, 32, 4);
  ctx.fillStyle = "#4e2d2c"; ctx.fillRect(x + 10, y + 47, 8, 5); ctx.fillRect(x + 27, y + 47, 8, 5);
  if (state.carrying === "gem") drawGem(x + 35, y + 5, selectedGem(), "");
  if (state.carrying === "coins") drawCoins(x + 35, y + 12);
}
function drawCrew(member) {
  const { x, y } = member;
  ctx.fillStyle = "#183750"; ctx.fillRect(x + 2, y + 7, 19, 5); ctx.fillRect(x + 7, y + 2, 10, 7);
  ctx.fillStyle = "#f8f5e8"; ctx.fillRect(x + 6, y + 4, 12, 4);
  ctx.fillStyle = "#f2bd8a"; ctx.fillRect(x + 6, y + 12, 12, 11);
  ctx.fillStyle = "#f8f5e8"; ctx.fillRect(x + 4, y + 23, 16, 15);
  ctx.fillStyle = "#183750"; ctx.fillRect(x + 4, y + 25, 16, 3); ctx.fillRect(x + 4, y + 32, 16, 3);
  ctx.fillStyle = "#2e4056"; ctx.fillRect(x + 6, y + 38, 5, 5); ctx.fillRect(x + 14, y + 38, 5, 5);
  ctx.fillStyle = "#183750"; ctx.fillRect(x + 14, y + 16, 2, 2);
}
function updateCrewBubble() {
  const now = performance.now();
  if (now < nextCrewBubbleAt) return;
  activeCrewBubble = { memberIndex: crewTurn % deckCrew.length, line: crewLines[crewLineTurn % crewLines.length], expiresAt: now + 1900 };
  crewTurn += 1; crewLineTurn += 1;
  nextCrewBubbleAt = activeCrewBubble.expiresAt + 800;
}
function drawSpeechBubble(member, line) {
  const width = Math.max(116, line.length * 17 + 22); const x = Math.max(12, Math.min(member.x - width / 2 + 12, 948 - width)); const y = Math.max(92, member.y - 48);
  pixelRect(x, y, width, 29, "#fffdf5", "#183750"); ctx.fillStyle = "#fffdf5"; ctx.fillRect(member.x + 8, y + 29, 8, 7); ctx.fillStyle = "#183750"; ctx.fillRect(member.x + 11, y + 36, 4, 4);
  text(line, x + width / 2, y + 20, 10, "#183750", "center");
}
function drawGem(x, y, gem, label) {
  if (gem.id === "emerald") {
    ctx.fillStyle = "rgba(66, 244, 154, .12)"; ctx.fillRect(x - 12, y - 8, 54, 48);
    ctx.fillStyle = "rgba(115, 255, 197, .22)"; ctx.fillRect(x - 6, y - 3, 42, 38);
    ctx.fillStyle = "#d9fff0"; ctx.fillRect(x - 8, y + 6, 4, 11); ctx.fillRect(x - 11, y + 10, 10, 4); ctx.fillRect(x + 34, y + 16, 4, 10); ctx.fillRect(x + 31, y + 19, 10, 4); ctx.fillRect(x + 20, y - 9, 3, 8); ctx.fillRect(x + 17, y - 6, 9, 3);
  }
  ctx.fillStyle = "#183750"; ctx.fillRect(x + 10, y, 10, 4); ctx.fillRect(x + 5, y + 4, 20, 4); ctx.fillRect(x + 1, y + 8, 28, 13); ctx.fillRect(x + 5, y + 21, 20, 5); ctx.fillRect(x + 10, y + 26, 10, 5);
  ctx.fillStyle = gem.dark; ctx.fillRect(x + 6, y + 8, 18, 12); ctx.fillRect(x + 10, y + 20, 10, 6);
  ctx.fillStyle = gem.color; ctx.fillRect(x + 11, y + 4, 8, 4); ctx.fillRect(x + 8, y + 8, 13, 12);
  ctx.fillStyle = "#fff4c8"; ctx.fillRect(x + 10, y + 8, 4, 5); ctx.fillStyle = "rgba(255,255,255,.5)"; ctx.fillRect(x + 16, y + 14, 4, 3);
  if (label) text(label, x + 15, y + 46, 10, "#edf4ee", "center");
}
function drawCoins(x, y) {
  ctx.fillStyle = "#17344b"; ctx.fillRect(x, y + 4, 26, 17); ctx.fillRect(x + 4, y, 18, 4);
  ctx.fillStyle = "#f6c84e"; ctx.fillRect(x + 3, y + 6, 20, 12); ctx.fillStyle = "#fff1a6"; ctx.fillRect(x + 7, y + 8, 5, 5);
}
function drawSea() {
  ctx.fillStyle = "#86c4db"; ctx.fillRect(0, 0, 960, 576);
  ctx.fillStyle = "#b7dfdf"; ctx.fillRect(0, 266, 960, 310);
  for (let x = 0; x < 960; x += 42) { ctx.fillStyle = x % 84 ? "#8dcad2" : "#d4ece4"; ctx.fillRect(x, 310 + (x % 3) * 18, 30, 4); }
}
function drawShore() {
  drawSea();
  ctx.fillStyle = "#fbf4df"; ctx.fillRect(0, 347, 960, 229);
  for (let x = 18; x < 955; x += 36) { ctx.fillStyle = x % 72 ? "#eadfca" : "#fffaf0"; ctx.fillRect(x, 402 + (x % 4) * 12, 9, 5); }
  ctx.fillStyle = "#d8edf0"; ctx.fillRect(0, 338, 960, 9);
  for (let x = 12; x < 960; x += 58) { ctx.fillStyle = x % 116 ? "#c1e0e4" : "#edf8f6"; ctx.fillRect(x, 342, 32, 4); }
  drawPalm(92, 314); drawPalm(820, 318); drawCave(760, 252);
  const shipBob = Math.round(Math.sin(performance.now() / 360) * 5);
  drawShip(117, 132 + shipBob);
  text("해안가", 478, 62, 22, "#f8edcf", "center");
  if (state.phase === "shoreToCave") drawPortal(765, 390, "동굴로");
  if (state.phase === "shoreToShip") drawPortal(210, 347, "보물선으로");
  drawPlayer();
}
function drawPalm(x, y) {
  ctx.fillStyle = "#7b4f32"; ctx.fillRect(x - 5, y - 16, 11, 63);
  ctx.fillStyle = "#376a50"; ctx.fillRect(x - 32, y - 27, 60, 11); ctx.fillRect(x - 7, y - 48, 12, 42); ctx.fillRect(x - 24, y - 41, 23, 10); ctx.fillRect(x + 3, y - 37, 27, 10);
}
function drawCave(x, y) {
  ctx.fillStyle = "#57677b"; ctx.fillRect(x - 70, y + 72, 151, 88); ctx.fillRect(x - 52, y + 41, 112, 120); ctx.fillRect(x - 32, y + 18, 72, 142); ctx.fillStyle = "#26384b"; ctx.fillRect(x - 22, y + 76, 53, 84); ctx.fillRect(x - 10, y + 58, 29, 20); ctx.fillStyle = "#8194a0"; ctx.fillRect(x - 66, y + 90, 18, 10); ctx.fillRect(x + 44, y + 105, 31, 12);
}
function drawShip(x, y) {
  ctx.fillStyle = "#673f30"; ctx.fillRect(x, y + 166, 187, 28); ctx.fillRect(x + 19, y + 194, 145, 15); ctx.fillStyle = "#f2d8a2"; ctx.fillRect(x + 73, y + 18, 9, 151); ctx.fillStyle = "#f8edcf"; ctx.fillRect(x + 82, y + 35, 67, 74); ctx.fillStyle = "#466c91"; ctx.fillRect(x + 87, y + 42, 57, 56); ctx.fillStyle = "#17344b"; ctx.fillRect(x + 8, y + 152, 160, 9); ctx.fillStyle = "#edcf84"; ctx.fillRect(x + 126, y + 175, 9, 8); ctx.fillRect(x + 48, y + 175, 9, 8);
}
function drawCaveScene() {
  ctx.fillStyle = "#1d3146"; ctx.fillRect(0, 0, 960, 576);
  for (let i = 0; i < 36; i += 1) { ctx.fillStyle = i % 2 ? "#344960" : "#273c53"; ctx.fillRect((i * 109) % 940, 36 + (i * 61) % 500, 28, 10); }
  ctx.fillStyle = "#4c5d6d"; ctx.fillRect(0, 410, 960, 166); ctx.fillStyle = "#66717a"; ctx.fillRect(0, 458, 960, 118);
  text("보석 동굴", 480, 62, 22, "#f8edcf", "center");
  if (!state.carrying) {
    drawPedestal(478, 345);
    if (state.condition === "gem") { drawGem(463, 270, selectedGem(), selectedGem().label); } else { drawCoins(465, 285); text("황금 동전 한 닢", 480, 342, 11, "#f8edcf", "center"); }
    drawArrow({ x: 480, y: 266 });
  } else drawPortal(118, 376, "해안가로");
  drawPlayer();
}
function drawPedestal(x, y) { ctx.fillStyle = "#253b50"; ctx.fillRect(x - 48, y, 96, 16); ctx.fillStyle = "#6d7a80"; ctx.fillRect(x - 30, y - 30, 60, 30); ctx.fillStyle = "#899399"; ctx.fillRect(x - 36, y - 36, 72, 9); }
function drawDeck() {
  ctx.fillStyle = "#86c4db"; ctx.fillRect(0, 0, 960, 576); ctx.fillStyle = "#debd76"; ctx.fillRect(0, 170, 960, 406);
  for (let x = 0; x < 960; x += 51) { ctx.fillStyle = "#c89e5e"; ctx.fillRect(x, 175, 4, 400); }
  ctx.fillStyle = "#673f30"; ctx.fillRect(0, 160, 960, 16); ctx.fillRect(0, 512, 960, 20); ctx.fillStyle = "#f2d8a2"; ctx.fillRect(160, 0, 11, 173); ctx.fillRect(730, 0, 11, 173);
  text("보물선 갑판", 480, 63, 22, "#17344b", "center");
  deckCrew.forEach(drawCrew); updateCrewBubble();
  if (activeCrewBubble && performance.now() < activeCrewBubble.expiresAt) drawSpeechBubble(deckCrew[activeCrewBubble.memberIndex], activeCrewBubble.line);
  const vault = { x: 703, y: 325 };
  drawTreasureChest(vault.x, vault.y);
  if (state.carrying) drawArrow({ x: vault.x + 55, y: vault.y - 2 });
  text("보물함", vault.x + 56, 454, 13, "#17344b", "center");
  drawPlayer();
}
function drawTreasureChest(x, y) {
  ctx.fillStyle = "#17344b"; ctx.fillRect(x, y + 31, 112, 65); ctx.fillRect(x + 7, y + 8, 98, 29); ctx.fillStyle = "#8b5234"; ctx.fillRect(x + 5, y + 35, 102, 56); ctx.fillRect(x + 13, y + 13, 86, 20); ctx.fillStyle = "#eac456"; ctx.fillRect(x + 51, y + 40, 10, 20);
}
function drawGoldVault(x, y) {
  ctx.fillStyle = "#17344b"; ctx.fillRect(x, y + 10, 113, 90); ctx.fillStyle = "#af9d70"; ctx.fillRect(x + 5, y + 15, 103, 80); ctx.fillStyle = "#f1ce5d"; ctx.fillRect(x + 42, y + 45, 28, 28); ctx.fillStyle = "#7d6633"; ctx.fillRect(x + 53, y + 35, 7, 50); ctx.fillRect(x + 32, y + 56, 50, 7);
}
function drawIntro() {
  drawSea(); drawShip(384, 194); drawCave(754, 271); drawPalm(100, 340); drawPalm(876, 342);
  ctx.fillStyle = "rgba(20,41,65,.68)"; ctx.fillRect(0, 0, 960, 576);
  text("보물찾기", 480, 143, 34, "#f6d35b", "center"); text("비밀 지도에 적힌 마지막 항해", 480, 177, 11, "#f8edcf", "center");
  text("당신은 보물선의 선장입니다.", 480, 259, 16, "#f8edcf", "center");
  text(state.phase === "intake" ? "오늘의 항해를 선택하세요." : "비밀 지도를 따라 동굴을 향해 출발하세요.", 480, 288, 13, "#d7e7ed", "center");
}
function drawTreasureMap(x, y) {
  pixelRect(x, y, 224, 128, "#e9d39c", "#5a4430");
  ctx.fillStyle = "#f4e4b8"; ctx.fillRect(x + 10, y + 12, 204, 106);
  ctx.fillStyle = "#bcdade"; ctx.fillRect(x + 18, y + 24, 188, 78);
  ctx.fillStyle = "#c4b36b"; ctx.fillRect(x + 24, y + 71, 175, 25); ctx.fillRect(x + 31, y + 58, 46, 18); ctx.fillRect(x + 151, y + 48, 36, 31);
  ctx.fillStyle = "#557f64"; ctx.fillRect(x + 32, y + 55, 37, 10); ctx.fillRect(x + 157, y + 43, 25, 10);
  ctx.fillStyle = "#7d5638"; ctx.fillRect(x + 46, y + 73, 19, 8); ctx.fillRect(x + 42, y + 81, 27, 5);
  ctx.fillStyle = "#6b5b43"; ctx.fillRect(x + 164, y + 59, 15, 20); ctx.fillRect(x + 168, y + 54, 7, 6);
  for (let step = 0; step < 7; step += 1) { ctx.fillStyle = "#a34836"; ctx.fillRect(x + 73 + step * 12, y + 79 - step * 4, 5, 3); }
  text("X", x + 164, y + 66, 18, "#a34836", "center"); text("비밀 지도", x + 112, y + 18, 8, "#5a4430", "center");
  ctx.fillStyle = "#5a4430"; ctx.fillRect(x + 194, y + 104, 2, 11); ctx.fillRect(x + 190, y + 108, 10, 2); text("N", x + 195, y + 103, 6, "#5a4430", "center");
}
function drawStory() {
  drawIntro();
  drawTreasureMap(650, 188);
  const target = selectedGem();
  const pages = [
    ["긴 항해 끝에 보물선의 보물함은 텅 비었습니다.", "선원들은 이번 항해의 성과에 조용히 기대를 걸고 있습니다."],
    state.condition === "gem"
      ? [`비밀 지도는 해안 동굴 깊은 곳의 ${objectForm(target.label)} 가리킵니다.`, "그 다이아몬드를 찾아 보물선의 화물함에 안전하게 실으세요."]
      : ["비밀 지도는 해안 동굴 깊은 곳의 황금 동전 한 닢을 가리킵니다.", "그 동전을 찾아 보물선의 보물함에 안전하게 실으세요."],
    ["해안에 닿았습니다. 동굴과 보물선 사이를 오가며 임무를 완수하세요.", "이동: 화살표 / WASD · 포탈·물체 앞에서 SPACE"],
  ];
  if (state.storyPage === 1) {
    drawHighlightedStory(target);
    return;
  }
  drawDialogue("선장의 항해일지", pages[state.storyPage][0], pages[state.storyPage][1]);
}
function drawEmphasisLine(parts, y, size) {
  const displaySize = Math.round(size * 1.15);
  ctx.save();
  const widths = parts.map((part) => {
    ctx.font = (part.strong ? "800 " : "700 ") + displaySize + "px Apple SD Gothic Neo, Malgun Gothic, Arial, sans-serif";
    return ctx.measureText(part.value).width;
  });
  let x = 480 - widths.reduce((total, width) => total + width, 0) / 2;
  parts.forEach((part, index) => {
    ctx.font = (part.strong ? "800 " : "700 ") + displaySize + "px Apple SD Gothic Neo, Malgun Gothic, Arial, sans-serif";
    ctx.fillStyle = part.color;
    ctx.fillText(part.value, x, y);
    x += widths[index];
  });
  ctx.restore();
}
function drawHighlightedStory(target) {
  drawDialogue("선장의 항해일지", "", state.condition === "gem" ? "그 다이아몬드를 찾아 보물선의 화물함에 안전하게 실으세요." : "그 동전을 찾아 보물선의 보물함에 안전하게 실으세요.");
  if (state.condition === "gem") {
    drawEmphasisLine([
      { value: "비밀 지도는 해안 동굴 깊은 곳의 ", color: "#1d4661" },
      { value: target.label, color: "#287a93", strong: true },
      { value: objectForm(target.label).slice(target.label.length) + " 가리킵니다.", color: "#1d4661" },
    ], 414, 14);
  } else {
    drawEmphasisLine([
      { value: "비밀 지도는 해안 동굴 깊은 곳의 ", color: "#1d4661" },
      { value: "황금 동전", color: "#d69616", strong: true },
      { value: " 한 닢을 가리킵니다.", color: "#1d4661" },
    ], 414, 14);
  }
}
function drawDialogue(title, line1, line2) {
  ctx.fillStyle = "rgba(11,30,47,.76)"; ctx.fillRect(88, 335, 784, 150); ctx.fillStyle = "#f8edcf"; ctx.fillRect(108, 353, 744, 112);
  text(title, 132, 380, 14, "#9b552f"); text(line1, 480, 414, 13, "#183750", "center"); text(line2, 480, 441, 12, "#47677c", "center");
}
function drawCaveNarrative(phase) {
  drawCaveScene();
  if (phase === "caveIntro") drawDialogue("동굴 입구", "파도 소리는 멀어지고, 차가운 물방울 소리만 동굴 안에 울립니다.", state.condition === "gem" ? "희미한 빛이 제단 위의 다이아몬드를 비추고 있습니다." : "희미한 빛이 제단 위의 황금 동전 하나를 비추고 있습니다.");
  else drawDialogue("보물 회수", state.condition === "gem" ? "손안의 보석은 묵직하고 차갑습니다." : "손안의 황금 동전은 따뜻하게 빛납니다.", "기다리고 있을 선원들에게 돌아가기 위해 해안가 포탈을 찾으세요.");
}
function drawDeckNarrative() {
  drawDeck(); drawDialogue("보물선 갑판", "선원들이 난간 너머로 당신을 발견하고, 배 위가 잠시 술렁입니다.", "보물을 보물함에 적재하면 항해의 가치는 20,000 크라운이 됩니다.");
}
function drawWantedPoster(x, y) {
  pixelRect(x, y, 230, 260, "#ead9ae", "#513d2b");
  ctx.fillStyle = "#9b552f"; ctx.fillRect(x + 15, y + 18, 200, 33); text("WANTED", x + 115, y + 42, 20, "#f8edcf", "center");
  text("왕실의 다이아몬드 분실", x + 115, y + 79, 14, "#513d2b", "center");
  ctx.fillStyle = "#513d2b"; ctx.fillRect(x + 83, y + 99, 64, 67); ctx.fillStyle = "#d8c08a"; ctx.fillRect(x + 90, y + 106, 50, 53);
  text("?", x + 115, y + 148, 36, "#513d2b", "center");
  ctx.fillStyle = "#a98558"; ctx.fillRect(x + 20, y + 184, 190, 2); ctx.fillRect(x + 20, y + 203, 190, 2); ctx.fillRect(x + 20, y + 222, 155, 2);
  text("왕실 항구 검사관", x + 115, y + 247, 11, "#74543d", "center");
}
function drawHandoff() {
  ctx.fillStyle = "#e5e5df"; ctx.fillRect(0, 0, 960, 576); pixelRect(96, 94, 768, 382, "#f8edcf"); drawWantedPoster(137, 154);
  if (state.testMode) {
    text("항구에 붙은 수배 전단", 582, 174, 24, "#183750", "center");
    text("왕실의 다이아몬드가 동굴에서 분실됐습니다.", 582, 232, 14, "#27455c", "center");
    text("항구 검사관이 보물선의 화물을 확인하기 시작합니다.", 582, 264, 13, "#47677c", "center");
    text(state.condition === "gem" ? "보석 집단(거짓) 시연을 완료했습니다." : "금화 집단(진실) 시연을 완료했습니다.", 582, 317, 13, "#47677c", "center");
    text("이 테스트 모드에서는 어떤 데이터도 저장하지 않습니다.", 582, 353, 12, "#557083", "center");
    text("처음부터를 눌러 다른 집단도 시연할 수 있습니다.", 582, 392, 11, "#557083", "center");
    return;
  }
  text("검사 준비 완료", 582, 174, 28, "#183750", "center");
  text("왕실의 다이아몬드가 동굴에서 사라졌습니다.", 582, 226, 14, "#27455c", "center");
  text("검사관은 보석의 정체를 알고 있습니다.", 582, 255, 14, "#27455c", "center");
  text("이제 검사 장비의 기록을 시작한 뒤, 질문에는 모두 ‘아니요’로 응답합니다.", 582, 300, 12, "#47677c", "center");
  text("CIT 순서표: 후보 5종 × 5회 = 25 문항", 582, 340, 12, "#47677c", "center");
  text("연구자 패널에서 게임 이벤트와 CIT 순서표를 CSV로 내려받을 수 있습니다.", 582, 381, 11, "#557083", "center");
}
function roundedPath(x, y, w, h, radius) {
  const r = Math.min(radius, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function fillRounded(x, y, w, h, radius, fill, stroke) {
  roundedPath(x, y, w, h, radius);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke(); }
}
function circle(x, y, radius, fill, stroke) {
  ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = fill; ctx.fill();
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke(); }
}
function text(value, x, y, size, color, align) {
  ctx.save();
  ctx.fillStyle = color || "#173b56";
  ctx.font = "700 " + Math.round(size * 1.15) + "px Apple SD Gothic Neo, Malgun Gothic, Arial, sans-serif";
  ctx.textAlign = align || "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(value, x, y);
  ctx.restore();
}
function titleText(value, x, y, size, color, align) {
  ctx.save();
  ctx.fillStyle = color || "#173b56";
  ctx.font = "700 " + size + "px Gaegu, Apple SD Gothic Neo, Malgun Gothic, Arial, sans-serif";
  ctx.textAlign = align || "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(value, x, y);
  ctx.restore();
}
function pixelRect(x, y, w, h, color, outline) {
  fillRounded(x, y, w, h, 13, color, outline);
}
function drawArrow(target) {
  const bounce = Math.sin(performance.now() / 180) * 4;
  ctx.save(); ctx.translate(target.x, target.y - 25 + bounce);
  ctx.beginPath(); ctx.moveTo(0, 11); ctx.lineTo(-10, -5); ctx.lineTo(10, -5); ctx.closePath();
  ctx.fillStyle = "#ffe36e"; ctx.shadowColor = "rgba(255,205,75,.9)"; ctx.shadowBlur = 12; ctx.fill(); ctx.restore();
}
function drawPortal(x, y, label) {
  const pulse = 1 + Math.sin(performance.now() / 220) * .045;
  ctx.save(); ctx.translate(x, y); ctx.scale(pulse, pulse);
  ctx.beginPath(); ctx.ellipse(0, 0, 31, 48, 0, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(74, 245, 241, .32)"; ctx.lineWidth = 15; ctx.shadowColor = "#70f7ed"; ctx.shadowBlur = 20; ctx.stroke();
  ctx.beginPath(); ctx.ellipse(0, 0, 29, 46, 0, 0, Math.PI * 2);
  ctx.strokeStyle = "#d9ffff"; ctx.lineWidth = 3; ctx.shadowColor = "#58e7ec"; ctx.shadowBlur = 12; ctx.stroke();
  ctx.restore();
  text(label, x, y + 67, 12, "#164c68", "center");
}
function drawPlayer() {
  const x = player.x + 22; const y = player.y + 27;
  ctx.save(); ctx.translate(x, y);
  ctx.shadowColor = "rgba(10,44,59,.28)"; ctx.shadowBlur = 7; ctx.shadowOffsetY = 4;
  circle(-9, 22, 7, "#3e322c"); circle(10, 22, 7, "#3e322c");
  ctx.shadowColor = "transparent";
  fillRounded(-16, -1, 32, 27, 11, "#294f78", "#163955");
  ctx.fillStyle = "#f3cf65"; ctx.fillRect(-16, 7, 32, 5);
  circle(0, -13, 15, "#efbd8b", "#70412e");
  ctx.fillStyle = "#744633"; ctx.beginPath(); ctx.arc(0, -17, 15, Math.PI, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-22, -25); ctx.quadraticCurveTo(0, -46, 22, -25); ctx.lineTo(18, -17); ctx.lineTo(-18, -17); ctx.closePath();
  const hat = ctx.createLinearGradient(0, -42, 0, -17); hat.addColorStop(0, "#243d65"); hat.addColorStop(1, "#102943"); ctx.fillStyle = hat; ctx.fill(); ctx.strokeStyle = "#0f2943"; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = "#c4463e"; ctx.fillRect(-19, -19, 38, 4);
  circle(player.facing === "right" ? 6 : -6, -11, 2, "#183247");
  if (state.carrying === "gem") drawGem(18, -27, selectedGem(), "");
  if (state.carrying === "coins") drawCoins(16, -17);
  ctx.restore();
}
function drawCrew(member) {
  const x = member.x + 12; const y = member.y + 21;
  ctx.save(); ctx.translate(x, y);
  circle(-6, 18, 5, "#3f3936"); circle(7, 18, 5, "#3f3936");
  fillRounded(-12, -1, 25, 22, 8, "#f4f5eb", "#244662");
  ctx.fillStyle = "#315578"; ctx.fillRect(-12, 4, 25, 3); ctx.fillRect(-12, 12, 25, 3);
  circle(0, -10, 11, "#f2c497", "#784b36");
  ctx.fillStyle = "#e8f5f8"; ctx.beginPath(); ctx.ellipse(0, -20, 13, 5, 0, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = "#294f70"; ctx.lineWidth = 2; ctx.stroke();
  circle(4, -10, 1.6, "#17374f");
  ctx.restore();
}
function drawSpeechBubble(member, line) {
  const width = Math.max(120, line.length * 13 + 28);
  const x = Math.max(12, Math.min(member.x - width / 2 + 12, 948 - width)); const y = Math.max(78, member.y - 54);
  ctx.save(); ctx.shadowColor = "rgba(19,61,85,.22)"; ctx.shadowBlur = 9; ctx.shadowOffsetY = 3;
  fillRounded(x, y, width, 33, 15, "rgba(255,255,255,.96)", "#8db8ce");
  ctx.shadowColor = "transparent";
  ctx.beginPath(); ctx.moveTo(member.x + 9, y + 33); ctx.lineTo(member.x + 17, y + 33); ctx.lineTo(member.x + 13, y + 42); ctx.closePath(); ctx.fillStyle = "#fff"; ctx.fill(); ctx.strokeStyle = "#8db8ce"; ctx.stroke();
  text(line, x + width / 2, y + 22, 11, "#234e69", "center"); ctx.restore();
}
function drawGem(x, y, gem, label) {
  const centerX = x + 15; const centerY = y + 15;
  ctx.save(); ctx.translate(centerX, centerY);
  ctx.shadowColor = gem.color; ctx.shadowBlur = 18;
  ctx.beginPath(); ctx.moveTo(0, -18); ctx.lineTo(15, -5); ctx.lineTo(8, 17); ctx.lineTo(-8, 17); ctx.lineTo(-15, -5); ctx.closePath();
  const gradient = ctx.createLinearGradient(-14, -18, 14, 18); gradient.addColorStop(0, "#ffffff"); gradient.addColorStop(.3, gem.color); gradient.addColorStop(1, gem.dark);
  ctx.fillStyle = gradient; ctx.fill(); ctx.strokeStyle = "rgba(255,255,255,.7)"; ctx.lineWidth = 2; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, -17); ctx.lineTo(0, 15); ctx.moveTo(-14, -5); ctx.lineTo(14, -5); ctx.strokeStyle = "rgba(255,255,255,.5)"; ctx.lineWidth = 1.4; ctx.stroke();
  ctx.restore();
  if (label) text(label, centerX, y + 52, 12, "#eafaff", "center");
}
function drawCoins(x, y) {
  ctx.save(); ctx.translate(x + 15, y + 14);
  ctx.shadowColor = "rgba(255,197,49,.75)"; ctx.shadowBlur = 15;
  circle(0, 0, 15, "#f2bd35", "#96601d");
  circle(-4, -5, 5, "#fff1a1");
  ctx.shadowColor = "transparent"; ctx.strokeStyle = "rgba(132,79,20,.42)"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}
function drawSea() {
  const sky = ctx.createLinearGradient(0, 0, 0, 576); sky.addColorStop(0, "#79c9eb"); sky.addColorStop(.52, "#d9f4f4"); sky.addColorStop(.53, "#65bed7"); sky.addColorStop(1, "#238ebc");
  ctx.fillStyle = sky; ctx.fillRect(0, 0, 960, 576);
  circle(840, 72, 36, "rgba(255,244,178,.95)");
  for (let index = 0; index < 7; index += 1) {
    const y = 292 + index * 38; const offset = Math.sin(performance.now() / 700 + index) * 10;
    ctx.beginPath(); ctx.moveTo(0, y); for (let x = 0; x <= 960; x += 90) ctx.quadraticCurveTo(x + 45, y - 9 + offset, x + 90, y);
    ctx.strokeStyle = index % 2 ? "rgba(222,250,250,.52)" : "rgba(27,129,175,.28)"; ctx.lineWidth = 3; ctx.stroke();
  }
}
function drawPalm(x, y) {
  ctx.save(); ctx.translate(x, y);
  ctx.strokeStyle = "#79543a"; ctx.lineWidth = 12; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(0, 42); ctx.quadraticCurveTo(-4, 3, 4, -27); ctx.stroke();
  const leaves = [[0,-29,35,-52],[1,-27,-34,-48],[2,-29,39,-32],[-1,-27,-41,-28],[1,-28,20,-60]];
  leaves.forEach((leaf) => { ctx.beginPath(); ctx.moveTo(leaf[0], leaf[1]); ctx.quadraticCurveTo(leaf[2] / 2, leaf[3] - 4, leaf[2], leaf[3]); ctx.strokeStyle = "#33805e"; ctx.lineWidth = 10; ctx.stroke(); });
  ctx.restore();
}
function drawCave(x, y) {
  ctx.save(); ctx.translate(x, y);
  const rock = ctx.createLinearGradient(-70, 0, 75, 160); rock.addColorStop(0, "#8495a4"); rock.addColorStop(1, "#40556c");
  ctx.beginPath(); ctx.moveTo(-78, 154); ctx.quadraticCurveTo(-70, 78, -36, 42); ctx.quadraticCurveTo(-7, 6, 28, 35); ctx.quadraticCurveTo(74, 67, 82, 154); ctx.closePath(); ctx.fillStyle = rock; ctx.fill();
  ctx.beginPath(); ctx.moveTo(-32, 154); ctx.quadraticCurveTo(-25, 86, 0, 66); ctx.quadraticCurveTo(31, 91, 37, 154); ctx.closePath(); ctx.fillStyle = "#1c3046"; ctx.fill();
  ctx.strokeStyle = "rgba(239,255,255,.22)"; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-59, 101); ctx.quadraticCurveTo(-53, 70, -34, 50); ctx.stroke();
  ctx.restore();
}
function drawShip(x, y) {
  ctx.save(); ctx.translate(x, y);
  ctx.shadowColor = "rgba(11,60,78,.25)"; ctx.shadowBlur = 10; ctx.shadowOffsetY = 8;
  ctx.beginPath(); ctx.moveTo(0, 162); ctx.lineTo(192, 162); ctx.quadraticCurveTo(170, 205, 39, 205); ctx.quadraticCurveTo(12, 194, 0, 162); ctx.closePath();
  const hull = ctx.createLinearGradient(0, 160, 0, 205); hull.addColorStop(0, "#9a5639"); hull.addColorStop(1, "#593124"); ctx.fillStyle = hull; ctx.fill(); ctx.shadowColor = "transparent";
  ctx.fillStyle = "#79402e"; ctx.fillRect(27, 152, 145, 14);
  ctx.strokeStyle = "#f2d6a1"; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(81, 154); ctx.lineTo(81, 25); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(86, 39); ctx.quadraticCurveTo(146, 68, 151, 116); ctx.lineTo(86, 116); ctx.closePath(); ctx.fillStyle = "#f9f1d8"; ctx.fill(); ctx.strokeStyle = "#c9dbe5"; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = "#2f729d"; ctx.beginPath(); ctx.moveTo(90, 45); ctx.quadraticCurveTo(128, 68, 140, 106); ctx.lineTo(90, 106); ctx.closePath(); ctx.fill();
  [50, 122, 151].forEach((windowX) => circle(windowX, 172, 5, "#ffd66d", "#703b2a"));
  ctx.restore();
}
function drawShore() {
  drawSea();
  const sand = ctx.createLinearGradient(0, 350, 0, 576); sand.addColorStop(0, "#fff5d7"); sand.addColorStop(1, "#e9c985"); ctx.fillStyle = sand;
  ctx.beginPath(); ctx.moveTo(0, 356); for (let x = 0; x <= 960; x += 80) ctx.quadraticCurveTo(x + 40, 345 + Math.sin(x) * 6, x + 80, 356); ctx.lineTo(960,576); ctx.lineTo(0,576); ctx.closePath(); ctx.fill();
  drawPalm(94, 309); drawPalm(826, 312); drawCave(760, 250);
  const shipBob = Math.sin(performance.now() / 360) * 5; drawShip(115, 130 + shipBob);
  text("해안가", 480, 59, 26, "#ffffff", "center");
  if (state.phase === "shoreToCave") drawPortal(765, 390, "동굴로");
  if (state.phase === "shoreToShip") drawPortal(210, 347, "보물선으로");
  drawPlayer();
}
function drawCaveScene() {
  const cave = ctx.createRadialGradient(480, 225, 30, 480, 260, 700); cave.addColorStop(0, "#536f8e"); cave.addColorStop(.55, "#283e58"); cave.addColorStop(1, "#14283e");
  ctx.fillStyle = cave; ctx.fillRect(0, 0, 960, 576);
  for (let index = 0; index < 9; index += 1) {
    ctx.beginPath(); ctx.moveTo(index * 130 - 50, 0); ctx.lineTo(index * 130 + 60, 0); ctx.lineTo(index * 130 + 25, 105 + (index % 3) * 36); ctx.closePath();
    ctx.fillStyle = index % 2 ? "#1e344c" : "#304967"; ctx.fill();
  }
  const floor = ctx.createLinearGradient(0, 410, 0, 576); floor.addColorStop(0, "#61768a"); floor.addColorStop(1, "#324a61"); ctx.fillStyle = floor; ctx.fillRect(0, 410, 960, 166);
  text("보석 동굴", 480, 62, 26, "#e8f7ff", "center");
  if (!state.carrying) {
    drawPedestal(478, 345);
    if (state.condition === "gem") drawGem(463, 270, selectedGem(), selectedGem().label);
    else { drawCoins(465, 285); text("황금 동전 한 닢", 480, 343, 12, "#edf9ff", "center"); }
    drawArrow({ x: 480, y: 266 });
  } else drawPortal(118, 376, "해안가로");
  drawPlayer();
}
function drawPedestal(x, y) {
  ctx.save(); ctx.translate(x, y);
  const stone = ctx.createLinearGradient(0, -44, 0, 18); stone.addColorStop(0, "#b5c6cb"); stone.addColorStop(1, "#52697b");
  ctx.beginPath(); ctx.moveTo(-42, 16); ctx.lineTo(42, 16); ctx.lineTo(28, -22); ctx.lineTo(-28, -22); ctx.closePath(); ctx.fillStyle = stone; ctx.fill(); ctx.strokeStyle = "#314d63"; ctx.lineWidth = 2; ctx.stroke();
  ctx.restore();
}
function drawDeck() {
  const sky = ctx.createLinearGradient(0, 0, 0, 190); sky.addColorStop(0, "#86d0ed"); sky.addColorStop(1, "#e2f7fb"); ctx.fillStyle = sky; ctx.fillRect(0, 0, 960, 190);
  const wood = ctx.createLinearGradient(0, 170, 0, 576); wood.addColorStop(0, "#e7be78"); wood.addColorStop(1, "#a96842"); ctx.fillStyle = wood; ctx.fillRect(0, 170, 960, 406);
  for (let y = 205; y < 560; y += 48) { ctx.strokeStyle = "rgba(103,57,35,.32)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(960,y); ctx.stroke(); }
  ctx.strokeStyle = "#70402c"; ctx.lineWidth = 12; ctx.beginPath(); ctx.moveTo(0, 170); ctx.lineTo(960,170); ctx.moveTo(0,522); ctx.lineTo(960,522); ctx.stroke();
  ctx.strokeStyle = "#f3d49b"; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(165,0); ctx.lineTo(165,172); ctx.moveTo(735,0); ctx.lineTo(735,172); ctx.stroke();
  text("보물선 갑판", 480, 61, 26, "#164b67", "center");
  deckCrew.forEach(drawCrew); updateCrewBubble();
  if (activeCrewBubble && performance.now() < activeCrewBubble.expiresAt) drawSpeechBubble(deckCrew[activeCrewBubble.memberIndex], activeCrewBubble.line);
  const vault = { x: 703, y: 325 }; drawTreasureChest(vault.x, vault.y);
  if (state.carrying) drawArrow({ x: vault.x + 55, y: vault.y - 2 });
  text("보물함", vault.x + 56, 454, 14, "#4e2c1d", "center"); drawPlayer();
}
function drawTreasureChest(x, y) {
  ctx.save(); ctx.translate(x, y);
  ctx.shadowColor = "rgba(59,31,18,.25)"; ctx.shadowBlur = 10; ctx.shadowOffsetY = 6;
  fillRounded(0, 28, 116, 69, 14, "#8d4e31", "#593121");
  ctx.shadowColor = "transparent";
  ctx.beginPath(); ctx.moveTo(7, 35); ctx.quadraticCurveTo(14, 1, 58, 3); ctx.quadraticCurveTo(102, 1, 109, 35); ctx.closePath(); ctx.fillStyle = "#b76c40"; ctx.fill(); ctx.strokeStyle = "#593121"; ctx.lineWidth = 3; ctx.stroke();
  fillRounded(48, 46, 20, 25, 5, "#f4d169", "#916527");
  ctx.restore();
}
function drawTreasureValuePanel(x, y) {
  const value = new Intl.NumberFormat("ko-KR").format(state.chestValue || 0);
  ctx.save();
  ctx.shadowColor = "rgba(10,40,59,.28)"; ctx.shadowBlur = 10; ctx.shadowOffsetY = 4;
  fillRounded(x - 151, y - 25, 302, 54, 18, "rgba(255,255,255,.94)", "#bcdbe8");
  ctx.shadowColor = "transparent";
  text("보물함 가치", x - 119, y + 7, 13, "#54748a");
  text(`${value} 크라운`, x + 124, y + 9, 19, state.chestValue ? "#b47726" : "#466a81", "right");
  ctx.restore();
}
function drawInspector(x, y) {
  ctx.save(); ctx.translate(x, y);
  ctx.shadowColor = "rgba(18,48,68,.26)"; ctx.shadowBlur = 8; ctx.shadowOffsetY = 5;
  circle(-11, 52, 8, "#293a47"); circle(13, 52, 8, "#293a47");
  ctx.shadowColor = "transparent";
  fillRounded(-28, 3, 57, 52, 15, "#425f75", "#183a54");
  ctx.fillStyle = "#d4b557"; ctx.fillRect(-5, 13, 10, 30);
  circle(0, -12, 22, "#e9bb91", "#6f4838");
  ctx.fillStyle = "#263d52"; ctx.beginPath(); ctx.arc(0, -17, 22, Math.PI, Math.PI * 2); ctx.fill();
  fillRounded(-27, -32, 54, 16, 8, "#183a54", "#102f48");
  ctx.fillStyle = "#d5ba64"; ctx.fillRect(-4, -29, 8, 6);
  circle(7, -11, 2, "#183247");
  circle(17, 17, 7, "#e6c863", "#755b22");
  text("검사관", 0, 83, 11, "#274b62", "center");
  ctx.restore();
}
function drawGoldVault(x, y) { drawTreasureChest(x, y); }
function drawIntro() {
  drawSea(); drawShip(384, 190); drawCave(754, 270); drawPalm(100, 340); drawPalm(876, 342);
  const veil = ctx.createLinearGradient(0, 0, 0, 576); veil.addColorStop(0, "rgba(9,45,74,.43)"); veil.addColorStop(1, "rgba(5,25,43,.68)"); ctx.fillStyle = veil; ctx.fillRect(0, 0, 960, 576);
  titleText("보물찾기", 480, 146, 52, "#fff4b3", "center"); text("비밀 지도에 적힌 마지막 항해", 480, 181, 17, "#f2fbff", "center");
  text("당신은 보물선의 선장입니다.", 480, 258, 19, "#ffffff", "center");
  text(state.testMode ? "오늘의 시연 항해를 선택하세요." : "연구자가 참가자 정보와 항해 조건을 확인합니다.", 480, 291, 15, "#d7edf5", "center");
}
function drawTreasureMap(x, y) {
  ctx.save(); ctx.shadowColor = "rgba(11,37,56,.34)"; ctx.shadowBlur = 15; ctx.shadowOffsetY = 7;
  fillRounded(x, y, 224, 128, 10, "#f5dfaa", "#b3844b"); ctx.shadowColor = "transparent";
  ctx.fillStyle = "#bee6e3"; fillRounded(x + 13, y + 15, 198, 96, 6, "#bee6e3");
  ctx.strokeStyle = "#9a7042"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x + 32, y + 88); ctx.bezierCurveTo(x + 73,y + 45,x + 117,y + 112,x + 173,y + 57); ctx.stroke();
  circle(x + 174, y + 57, 10, "#cc5947"); text("X", x + 174, y + 64, 13, "#fff", "center");
  text("비밀 지도", x + 112, y + 28, 11, "#6b4b31", "center"); ctx.restore();
}
function drawDialogue(title, line1, line2) {
  ctx.save(); ctx.shadowColor = "rgba(7,29,45,.3)"; ctx.shadowBlur = 18; ctx.shadowOffsetY = 8;
  fillRounded(88, 335, 784, 150, 22, "rgba(255,255,255,.94)", "rgba(196,225,238,.9)"); ctx.shadowColor = "transparent";
  text(title, 126, 374, 15, "#ba7645"); text(line1, 480, 416, 14, "#1d4661", "center"); text(line2, 480, 446, 13, "#52718a", "center"); ctx.restore();
}
function drawWantedPoster(x, y) {
  ctx.save(); ctx.shadowColor = "rgba(63,37,17,.35)"; ctx.shadowBlur = 12; ctx.shadowOffsetY = 6;
  fillRounded(x, y, 230, 260, 9, "#f0dcae", "#9e7143"); ctx.shadowColor = "transparent";
  fillRounded(x + 15, y + 18, 200, 35, 7, "#b85945"); text("WANTED", x + 115, y + 43, 23, "#fff5dc", "center");
  text("왕실의 다이아몬드 분실", x + 115, y + 82, 14, "#6a492d", "center");
  circle(x + 115, y + 132, 34, "#d8c08a", "#725238");
  text("?", x + 115, y + 148, 38, "#654b3a", "center");
  ctx.strokeStyle = "#b89260"; ctx.lineWidth = 2; [184,204,224].forEach((lineY) => { ctx.beginPath(); ctx.moveTo(x + 24,lineY + y); ctx.lineTo(x + 205,lineY + y); ctx.stroke(); });
  text("왕실 항구 검사관", x + 115, y + 247, 11, "#74543d", "center"); ctx.restore();
}
function drawHandoff() {
  const bg = ctx.createLinearGradient(0,0,960,576); bg.addColorStop(0,"#d4e8ef"); bg.addColorStop(1,"#a5c7d5"); ctx.fillStyle = bg; ctx.fillRect(0,0,960,576);
  fillRounded(48,58,864,460,25,"rgba(255,255,255,.94)","#c1dce7"); drawWantedPoster(89,148); drawInspector(376,310);
  text("왕실 검사관의 안내",655,128,27,"#173d59","center");
  text("왕실의 다이아몬드가 동굴에서 분실됐습니다.",655,183,14,"#315b75","center");
  text("모든 보물선을 직접 수색할 수는 없습니다.",655,223,14,"#315b75","center");
  text("선장님은 심리생리 검사를 통해 화물 관련 여부를 확인받습니다.",655,253,13,"#52718a","center");
  fillRounded(487,282,337,74,15,"#fff5dc","#e4c781");
  text("검사에서 왕실의 다이아몬드를 가져간 사실이 확인되면",655,310,12,"#734734","center");
  text("현재 보물함은 왕실 국고로 귀속됩니다.",655,338,13,"#734734","center");
  drawTreasureValuePanel(655, 399);
  text("항해 종료 후 교환소에서 보물함 가치를 정산할 수 있습니다.",655,447,12,"#52718a","center");
  text("이 테스트 모드에서는 어떤 데이터도 저장하지 않습니다.",655,483,11,"#678299","center");
}
function drawPracticeStimulus(item) {
  const x = 480; const y = 250;
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = "#d8dde0"; ctx.fillRect(-92, -92, 184, 184);
  ctx.strokeStyle = "#f6f7f7"; ctx.lineWidth = 3; ctx.strokeRect(-92, -92, 184, 184);
  ctx.fillStyle = "#3d454b";
  if (item === "pearl") {
    ctx.fillRect(-28, -42, 56, 10); ctx.fillRect(-44, -26, 88, 52); ctx.fillRect(-28, 26, 56, 16);
    ctx.fillStyle = "#aeb6bb"; ctx.fillRect(-28, -26, 56, 52); ctx.fillRect(-42, -10, 84, 20);
    ctx.fillStyle = "#f3f5f4"; ctx.fillRect(-22, -22, 25, 19); ctx.fillRect(-34, -5, 20, 14);
  } else if (item === "compass") {
    ctx.fillRect(-44, -44, 88, 88); ctx.fillStyle = "#c9d0d4"; ctx.fillRect(-35, -35, 70, 70);
    ctx.fillStyle = "#3d454b"; ctx.fillRect(-7, -29, 14, 58); ctx.fillRect(-29, -7, 58, 14);
    ctx.fillStyle = "#f3f5f4"; ctx.fillRect(-7, -23, 14, 23); ctx.fillRect(0, -7, 23, 14);
  } else {
    ctx.fillRect(-8, -50, 16, 100); ctx.fillRect(-48, -18, 40, 14); ctx.fillRect(8, -36, 40, 14); ctx.fillRect(-42, 14, 34, 14); ctx.fillRect(8, 24, 42, 14);
    ctx.fillStyle = "#aeb6bb"; ctx.fillRect(-30, -36, 22, 18); ctx.fillRect(8, -54, 20, 18); ctx.fillRect(-52, 6, 22, 18); ctx.fillRect(8, 42, 22, 18);
    ctx.fillStyle = "#f3f5f4"; ctx.fillRect(-25, -31, 10, 8); ctx.fillRect(13, -49, 9, 8); ctx.fillRect(-47, 11, 9, 8); ctx.fillRect(13, 47, 9, 8);
  }
  ctx.restore();
}
function drawPractice() {
  const background = ctx.createLinearGradient(0, 0, 0, 576);
  background.addColorStop(0, "#8e969b"); background.addColorStop(1, "#596269");
  ctx.fillStyle = background; ctx.fillRect(0, 0, 960, 576);
  if (!state.practiceStimulusVisible) {
    const glow = ctx.createRadialGradient(480, 284, 8, 480, 284, 170);
    glow.addColorStop(0, "rgba(255,255,255,.13)"); glow.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = glow; ctx.fillRect(0, 0, 960, 576);
    ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 5; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(450, 284); ctx.lineTo(510, 284); ctx.moveTo(480, 254); ctx.lineTo(480, 314); ctx.stroke();
    text("중앙 십자를 바라봐 주세요.", 480, 388, 14, "rgba(255,255,255,.8)", "center");
    return;
  }
  text("사물을 보고 질문을 들어 주세요.", 480, 102, 14, "rgba(255,255,255,.82)", "center");
  drawPracticeStimulus(practiceItems[state.practiceIndex]);
  if (state.practiceAudioFinished) {
    text(practiceQuestions[state.practiceIndex], 480, 396, 18, "#ffffff", "center");
    text("답변을 선택해 주세요.", 480, 430, 13, "rgba(255,255,255,.8)", "center");
  }
}
function drawPracticeComplete() {
  const background = ctx.createLinearGradient(0, 0, 0, 576);
  background.addColorStop(0, "#dbe9ed"); background.addColorStop(1, "#a7c6d0");
  ctx.fillStyle = background; ctx.fillRect(0, 0, 960, 576);
  fillRounded(178, 156, 604, 250, 26, "rgba(255,255,255,.94)", "#bfd6de");
  text("답변 연습이 끝났습니다.", 480, 220, 27, "#173d59", "center");
  text("실제 실험에서는 이제 검사 장비를 착용하고 본 검사를 시행합니다.", 480, 276, 14, "#42677d", "center");
  text("본 검사 종료 후 연구자가 ‘항해 종료’를 눌러 절차를 마칩니다.", 480, 310, 14, "#42677d", "center");
  text("이 테스트 모드에서는 어떤 데이터도 저장하지 않습니다.", 480, 358, 12, "#6f8897", "center");
}
function drawDebrief() {
  const background = ctx.createLinearGradient(0, 0, 0, 576);
  background.addColorStop(0, "#dbe9ed"); background.addColorStop(1, "#a7c6d0");
  ctx.fillStyle = background; ctx.fillRect(0, 0, 960, 576);
  fillRounded(120, 112, 720, 332, 26, "rgba(255,255,255,.95)", "#bfd6de");
  text("디브리핑", 480, 178, 28, "#173d59", "center");
  text("게임에서 안내된 보물함 압류와 왕실 국고 귀속은", 480, 235, 15, "#42677d", "center");
  text("게임에 몰입할 수 있도록 구성한 이야기 설정입니다.", 480, 265, 15, "#42677d", "center");
  fillRounded(209, 293, 542, 68, 16, "#fff5dc", "#e2c581");
  text("게임 조건이나 검사 결과와 무관하게", 480, 321, 14, "#785033", "center");
  text("모든 참가자에게 20,000원이 지급됩니다.", 480, 347, 16, "#785033", "center");
  text("참여해 주셔서 감사합니다.", 480, 402, 13, "#617f92", "center");
}
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (state.phase === "intake") drawIntro(); else if (state.phase === "story") drawStory(); else if (state.phase === "cave") drawCaveScene(); else if (state.phase === "caveIntro" || state.phase === "caveExitStory") drawCaveNarrative(state.phase); else if (state.phase === "deck") drawDeck(); else if (state.phase === "deckIntro") drawDeckNarrative(); else if (state.phase === "handoff") drawHandoff(); else if (state.phase === "practice") drawPractice(); else if (state.phase === "practiceComplete") drawPracticeComplete(); else if (state.phase === "debrief") drawDebrief(); else drawShore();
}

function intakeMarkup() {
  if (!studyMode) return `<section class="intake-card demo-card">
    <p class="eyebrow">DEMO MODE · NO DATA SAVED</p><h2>보물찾기 시연</h2><p>시연할 집단을 선택하세요. 참가자 정보·이벤트·CSV는 저장하지 않습니다.</p>
    <div class="demo-options"><button id="demo-gem" class="pixel-button" type="button">보석 집단<br /><small>거짓</small></button><button id="demo-coins" class="pixel-button quiet" type="button">금화 집단<br /><small>진실</small></button></div>
  </section>`;
  const allocation = state.allocation;
  const allocationPanel = allocation?.ready
    ? `<p class="allocation-ready">배정표 준비 완료 · 총 ${allocation.total_participants}명 · 번호에 따라 조건이 자동 배정됩니다.</p>`
    : allocation?.error
      ? `<p class="intake-error">${allocation.error}</p>`
      : `<div class="allocation-setup"><strong>최초 1회: 무작위 배정표 생성</strong><span>예상 참여 인원</span><input id="allocation-total" type="number" min="2" step="1" value="60" /><button id="initialize-allocation" class="pixel-button quiet compact" type="button">배정표 만들기</button></div>`;
  return `<section class="intake-card study-card">
    <p class="eyebrow">RESEARCHER SETUP</p><h2>실험 시작 준비</h2><p>참가자에게는 화면을 보이지 않게 하고, 연구자가 아래 항목을 입력해 주세요.</p>
    ${allocationPanel}
    <form id="study-intake-form" class="intake-form">
      <label>참가자 번호 <small>연구자가 순번대로 작성</small><input id="participant-code" required inputmode="numeric" autocomplete="off" placeholder="예: 1" value="${routeParams.get("participant") || ""}" /></label>
      <label>성명<input id="participant-name" required autocomplete="name" /></label>
      <label>생년월일<input id="participant-birth-date" required type="date" /></label>
      <label>성별<select id="participant-gender" required><option value="" selected disabled>선택</option><option value="여성">여성</option><option value="남성">남성</option><option value="기타/응답 안 함">기타/응답 안 함</option></select></label>
      <label>연락처<input id="participant-phone" required inputmode="numeric" autocomplete="tel" pattern="010[0-9]{8}" title="하이픈 없이 01012345678 형식으로 입력해 주세요." placeholder="예: 01012345678" /></label>
      <p id="intake-error" class="intake-error" role="alert"></p>
      <button class="pixel-button intake-submit" type="submit">항해 시작</button>
    </form>
  </section>`;
}
function bindActions() {
  document.querySelector("#demo-gem")?.addEventListener("click", () => startDemo("gem"));
  document.querySelector("#demo-coins")?.addEventListener("click", () => startDemo("coins"));
  document.querySelector("#study-intake-form")?.addEventListener("submit", (event) => { event.preventDefault(); void startStudy(); });
  document.querySelector("#initialize-allocation")?.addEventListener("click", () => { void initializeAllocation(); });
  document.querySelector("#story-next")?.addEventListener("click", advanceStory);
  document.querySelector("#begin-voyage")?.addEventListener("click", beginVoyage);
  document.querySelector("#start-cave-explore")?.addEventListener("click", startCaveExplore);
  document.querySelector("#resume-cave-exit")?.addEventListener("click", resumeCaveExit);
  document.querySelector("#start-deck-loading")?.addEventListener("click", startDeckLoading);
  document.querySelector("#start-practice")?.addEventListener("click", startPractice);
  document.querySelector("#practice-yes")?.addEventListener("click", () => answerPractice("yes"));
  document.querySelector("#practice-no")?.addEventListener("click", () => answerPractice("no"));
  document.querySelector("#finish-game")?.addEventListener("click", finishGame);
  document.querySelector("#go-cit")?.addEventListener("click", startCitExam);
  document.querySelector("#new-session")?.addEventListener("click", resetGame);
}
function updateScreen() {
  updateHud();
  if (state.phase === "intake") setActions(intakeMarkup());
  else if (state.phase === "story") setActions(`<button id="story-next" class="pixel-button" type="button">${state.storyPage === 2 ? "해안가로 출발" : "다음"}</button>`);
  else if (state.phase === "caveIntro") setActions('<button id="start-cave-explore" class="pixel-button" type="button">동굴 탐색 시작</button>');
  else if (state.phase === "caveExitStory") setActions('<button id="resume-cave-exit" class="pixel-button" type="button">해안가 포탈 찾기</button>');
  else if (state.phase === "deckIntro") setActions('<button id="start-deck-loading" class="pixel-button" type="button">화물 적재하기</button>');
  else if (state.phase === "handoff") setActions('<button id="start-practice" class="pixel-button" type="button">검사 연습 시작</button>');
  else if (state.phase === "practice" && state.practiceAudioFinished) setActions('<button id="practice-yes" class="pixel-button quiet" type="button">예</button><button id="practice-no" class="pixel-button" type="button">아니오</button>');
  else if (state.phase === "practiceComplete") setActions(state.testMode ? '<button id="finish-game" class="pixel-button" type="button">항해 종료</button>' : (state.citFinished ? '<button id="finish-game" class="pixel-button" type="button">항해 종료</button>' : '<button id="go-cit" class="pixel-button" type="button">장비 착용 후 본검사로 이동</button>'));
  else if (state.phase === "debrief") setActions('<button id="new-session" class="pixel-button" type="button">처음으로</button>');
  else setActions("");
  ui.message.textContent = state.notification;
  bindActions(); draw();
  if (state.phase === "intake" && studyMode && !state.allocation && !allocationLoadStarted) void loadAllocationStatus();
}
function startDemo(condition) {
  state.condition = condition;
  state.storyPage = 0;
  state.phase = "story";
  setMessage("게임 안내를 확인한 뒤 게임 시작을 누르세요."); updateScreen();
}
async function startStudy() {
  const participant = {
    code: document.querySelector("#participant-code")?.value.trim() || "",
    full_name: document.querySelector("#participant-name")?.value.trim() || "",
    birth_date: document.querySelector("#participant-birth-date")?.value || "",
    gender: document.querySelector("#participant-gender")?.value || "",
    phone: document.querySelector("#participant-phone")?.value.trim() || "",
  };
  const errorNode = document.querySelector("#intake-error");
  if (!participant.code || !participant.full_name || !participant.birth_date || !participant.gender || !participant.phone) {
    errorNode.textContent = "참가자 정보를 모두 확인해 주세요.";
    return;
  }
  try {
    const response = await fetch(`${BRIDGE}/api/participant/register`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ participant_id: participant.code, participant }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || "로컬 저장 프로그램에 연결하지 못했습니다.");
    state.participant = { ...participant, code: result.participant_id, age_at_experiment: result.age_at_experiment };
    state.condition = result.condition;
    state.storyPage = 0;
    record("participant_registered", "참가자 정보 저장 및 무작위 배정표 조건 자동 연결");
    state.phase = "story";
    setMessage("연구자 확인이 끝났습니다. 항해 이야기를 시작합니다.");
    updateScreen();
  } catch (error) {
    errorNode.textContent = error instanceof Error ? error.message : "로컬 저장 프로그램에 연결하지 못했습니다.";
  }
}
async function loadAllocationStatus() {
  allocationLoadStarted = true;
  try {
    const response = await fetch(`${BRIDGE}/api/allocation/status`);
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || "배정표를 확인하지 못했습니다.");
    state.allocation = result;
  } catch (error) {
    state.allocation = { ready: false, error: error instanceof Error ? error.message : "배정표를 확인하지 못했습니다." };
  }
  updateScreen();
}
async function initializeAllocation() {
  const errorNode = document.querySelector("#intake-error");
  const total = Number(document.querySelector("#allocation-total")?.value || 0);
  if (!Number.isInteger(total) || total < 2) { errorNode.textContent = "예상 참여 인원은 2명 이상 숫자로 입력해 주세요."; return; }
  if (!window.confirm(`${total}명의 보석·금화 조건을 무작위로 배정합니다. 생성 후에는 이 배정표를 그대로 사용합니다.`)) return;
  try {
    const response = await fetch(`${BRIDGE}/api/allocation/initialize`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ total_participants: total }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || "배정표를 만들지 못했습니다.");
    state.allocation = result;
    updateScreen();
  } catch (error) {
    errorNode.textContent = error instanceof Error ? error.message : "배정표를 만들지 못했습니다.";
  }
}
function advanceStory() {
  if (state.storyPage < 2) { state.storyPage += 1; setMessage("항해일지를 넘겨 다음 장면을 확인하세요."); updateScreen(); return; }
  beginVoyage();
}
function beginVoyage() {
  state.phase = "shoreToCave"; player.x = 170; player.y = 428;
  record("game_onset", "해안가에서 동굴로 출발"); setMessage("오른쪽의 빛나는 동굴 포탈로 이동해 SPACE를 누르세요."); updateScreen(); canvas.focus();
}
function enterCave() {
  state.phase = "caveIntro"; player.x = 125; player.y = 420;
  record("cave_onset", "보석 동굴 진입"); setMessage("동굴 입구의 이야기를 확인하세요."); updateScreen();
}
function startCaveExplore() { state.phase = "cave"; setMessage("중앙 제단 앞에서 SPACE를 누르세요."); updateScreen(); canvas.focus(); }
function returnShore() {
  state.phase = "shoreToShip"; player.x = 778; player.y = 420;
  record("cave_offset", "동굴에서 해안가로 복귀"); setMessage("왼쪽 보물선으로 이동해 SPACE를 누르세요."); updateScreen();
}
function resumeCaveExit() { state.phase = "cave"; setMessage("왼쪽 해안가 포탈로 이동해 SPACE를 누르세요."); updateScreen(); canvas.focus(); }
function enterDeck() {
  state.phase = "deckIntro"; player.x = 172; player.y = 430; state.chest = "treasure_chest";
  record("ship_deck_onset", "보물선 갑판 진입", { assigned_chest: "treasure_chest" });
  setMessage("갑판의 이야기를 확인하세요."); updateScreen();
}
function startDeckLoading() { state.phase = "deck"; setMessage("오른쪽 보물함 앞에서 SPACE를 누르세요."); updateScreen(); canvas.focus(); }
function pickupTreasure() {
  state.carrying = state.condition === "gem" ? "gem" : "coins";
  record(state.condition === "gem" ? "gem_pickup" : "coin_pickup", state.condition === "gem" ? `${selectedGem().label} 획득` : "황금 동전 획득");
  state.phase = "caveExitStory"; setMessage("보물을 손에 넣었습니다."); updateScreen();
}
function depositTreasure() {
  const detail = state.condition === "gem" ? `${selectedGem().label} → 보물함` : "황금 동전 한 닢 → 보물함";
  record(state.condition === "gem" ? "gem_deposited" : "coins_deposited", detail, { assigned_chest: "treasure_chest" });
  state.carrying = null; state.chestValue = 20000; state.phase = "handoff";
  if (!state.testMode) { createCitSchedule(); record("exam_handoff_onset", "게임 완료 · 동공 및 폴리그래프 검사 준비", { cit_trial_count: state.citSchedule.length }); }
  setMessage(state.testMode ? "시연을 완료했습니다. 데이터는 저장되지 않았습니다." : "게임 기록을 보관했습니다. 이제 생리검사를 준비하세요."); updateScreen();
}
function completePracticeAudio() {
  if (state.phase !== "practice") return;
  state.practiceAudioFinished = true;
  setMessage("질문을 들었습니다. 예 또는 아니오를 선택해 주세요.");
  updateScreen();
}
function speakPracticeFallback() {
  if (!("speechSynthesis" in window)) { completePracticeAudio(); return; }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(practiceQuestions[state.practiceIndex]);
  utterance.lang = "ko-KR";
  utterance.rate = .9;
  utterance.pitch = 1;
  utterance.onend = completePracticeAudio;
  utterance.onerror = completePracticeAudio;
  window.speechSynthesis.speak(utterance);
}
function playPracticeQuestion() {
  if (state.phase !== "practice") return;
  let usingFallback = false;
  const startFallback = () => {
    if (usingFallback) return;
    usingFallback = true;
    speakPracticeFallback();
  };
  const audio = new Audio(practiceAudioFiles[state.practiceIndex]);
  audio.preload = "auto";
  audio.onended = completePracticeAudio;
  audio.onerror = startFallback;
  audio.play().catch(startFallback);
}
function presentPracticeStimulus() {
  if (state.phase !== "practice") return;
  state.practiceStimulusVisible = true;
  setMessage("흑백 사물을 보면서 질문을 들어 주세요.");
  updateScreen();
  playPracticeQuestion();
}
function startPractice() {
  state.phase = "practice";
  state.practiceIndex = 0;
  state.practiceStimulusVisible = false;
  state.practiceAudioFinished = false;
  setMessage("중앙 십자를 바라보고 질문을 들어 주세요.");
  updateScreen();
  window.setTimeout(presentPracticeStimulus, 900);
}
function answerPractice(answer) {
  record("practice_response", "연습 문항 " + (state.practiceIndex + 1) + " · " + answer);
  if (state.practiceIndex < practiceQuestions.length - 1) {
    state.practiceIndex += 1;
    state.practiceStimulusVisible = false;
    state.practiceAudioFinished = false;
    setMessage("다음 질문을 듣고 중앙 십자를 바라봐 주세요.");
    updateScreen();
    window.setTimeout(presentPracticeStimulus, 900);
    return;
  }
  state.phase = "practiceComplete";
  setMessage(state.testMode ? "검사 연습을 완료했습니다. 데이터는 저장되지 않았습니다." : "검사 연습을 완료했습니다. 이제 연구자 안내에 따라 본검사를 진행합니다.");
  updateScreen();
}
function createCitSchedule() {
  if (state.citSchedule.length) return;
  for (let round = 1; round <= 5; round += 1) {
    shuffle(citCandidates).forEach((candidate, index) => {
      const isProbe = state.condition === "gem" && candidate.id === "diamond";
      state.citSchedule.push({ session_id: state.id, participant_code: state.participant.code, round, trial_in_round: index + 1, trial_number: state.citSchedule.length + 1, candidate_object: candidate.label, candidate_id: candidate.id, item_type: isProbe ? "probe" : "irrelevant", question_text: `당신은 동굴에서 ${objectForm(candidate.label)} 가져오셨습니까?`, expected_response: "아니요" });
    });
  }
  saveTemporary();
}
function finishGame() { if (!state.testMode) record("game_record_complete", "게임 단계 기록 완료"); state.phase = "debrief"; setMessage("게임과 검사에 관한 안내를 확인해 주세요."); updateScreen(); }
function startCitExam() {
  createCitSchedule();
  record("cit_handoff_onset", "연습 완료 · 본검사 화면으로 이동", { cit_trial_count: state.citSchedule.length });
  saveTemporary();
  const query = new URLSearchParams({ session: state.id, condition: state.condition, return: "/odyssey" });
  window.top.location.href = `/cit?${query.toString()}`;
}

function interact() {
  if (state.phase === "shoreToCave") { if (near({ x: 765, y: 405 }, 78)) enterCave(); else setMessage("빛나는 동굴 포탈 가까이에서 SPACE를 누르세요."); return; }
  if (state.phase === "cave") {
    if (!state.carrying && near({ x: 480, y: 325 }, 70)) pickupTreasure();
    else if (state.carrying && near({ x: 118, y: 386 }, 76)) returnShore();
    else setMessage(state.carrying ? "왼쪽 해안가 포탈 가까이에서 SPACE를 누르세요." : "중앙 제단 가까이에서 SPACE를 누르세요.");
    return;
  }
  if (state.phase === "shoreToShip") { if (near({ x: 210, y: 352 }, 84)) enterDeck(); else setMessage("보물선 포탈 가까이에서 SPACE를 누르세요."); return; }
  if (state.phase === "deck") { if (state.carrying && near({ x: 758, y: 385 }, 88)) depositTreasure(); else setMessage("오른쪽 화물함 가까이에서 SPACE를 누르세요."); }
}
function moveBy(dx, dy) {
  if (!['shoreToCave', 'cave', 'shoreToShip', 'deck'].includes(state.phase)) return;
  player.x += dx; player.y += dy; if (dx < 0) player.facing = "left"; if (dx > 0) player.facing = "right";
  player.x = Math.max(room.x + 6, Math.min(room.x + room.w - player.size - 6, player.x)); player.y = Math.max(room.y + 38, Math.min(room.y + room.h - player.size - 8, player.y)); draw();
}
function move(direction) { const amount = 18; if (direction === "left") moveBy(-amount, 0); if (direction === "right") moveBy(amount, 0); if (direction === "up") moveBy(0, -amount); if (direction === "down") moveBy(0, amount); }
function gameLoop(now) {
  const elapsed = Math.min((now - lastFrame) / 1000, .05); lastFrame = now;
  if (pressedKeys.size && ['shoreToCave', 'cave', 'shoreToShip', 'deck'].includes(state.phase)) {
    let dx = 0; let dy = 0; if (pressedKeys.has("left")) dx -= 1; if (pressedKeys.has("right")) dx += 1; if (pressedKeys.has("up")) dy -= 1; if (pressedKeys.has("down")) dy += 1;
    if (dx || dy) { const scale = dx && dy ? Math.SQRT1_2 : 1; moveBy(dx * 225 * elapsed * scale, dy * 225 * elapsed * scale); }
  }
  draw();
  requestAnimationFrame(gameLoop);
}

function renderEventLog() {
  ui.eventLog.innerHTML = state.events.length ? [...state.events].reverse().map((entry) => `<div class="event-row"><span>${entry.local_time}</span><strong>${entry.event}</strong><span>${entry.detail}</span></div>`).join("") : "";
}
function download(filename, headings, rows) {
  const blob = new Blob([[headings.join(","), ...rows.map((row) => headings.map((heading) => escapeCsv(row[heading])).join(","))].join("\n")], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = filename; link.click(); URL.revokeObjectURL(link.href);
}
function downloadEvents() { download(`${state.id}_game_events.csv`, ["local_time", "iso_time", "session_id", "participant_code", "condition", "target_gem", "event", "detail", "assigned_chest", "cit_trial_count"], state.events); }
function downloadCit() { createCitSchedule(); download(`${state.id}_cit_schedule.csv`, ["session_id", "participant_code", "round", "trial_in_round", "trial_number", "candidate_object", "candidate_id", "item_type", "question_text", "expected_response"], state.citSchedule); }

function hasSupabaseConfig() { const config = window.CIT_SUPABASE_CONFIG; return Boolean(config && config.url && config.anonKey && config.sessionTable && config.eventTable); }
function updateStorageStatus() { ui.storageStatus.textContent = state.testMode ? "테스트 모드: 저장하지 않음" : (hasSupabaseConfig() ? "저장 위치: Supabase 전송 시도 + 현재 탭의 임시 기록" : "저장 위치: 현재 탭의 임시 기록 · 실제 연구 전 Supabase 설정 필요"); }
async function sendEventToSupabase(entry) {
  if (!hasSupabaseConfig()) return;
  const config = window.CIT_SUPABASE_CONFIG;
  const payload = { ...entry };
  try {
    await fetch(`${config.url.replace(/\/$/, "")}/rest/v1/${config.eventTable}`, { method: "POST", headers: { apikey: config.anonKey, Authorization: `Bearer ${config.anonKey}`, "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify(payload) });
  } catch { }
}
async function sendSessionToSupabase() {
  if (!hasSupabaseConfig()) return;
  const config = window.CIT_SUPABASE_CONFIG;
  const payload = {
    session_id: state.id, participant_code: state.participant.code, full_name: state.participant.full_name,
    birth_date: state.participant.birth_date, gender: state.participant.gender, phone: state.participant.phone,
    condition: state.condition, target_gem: state.targetGem,
    created_at: new Date().toISOString(),
  };
  try {
    await fetch(`${config.url.replace(/\/$/, "")}/rest/v1/${config.sessionTable}`, { method: "POST", headers: { apikey: config.anonKey, Authorization: `Bearer ${config.anonKey}`, "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify(payload) });
  } catch { }
}
function resetGame() {
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  if (citReturned) {
    try {
      const saved = JSON.parse(sessionStorage.getItem("ophtheon-cit-game-temporary") || "null");
      state = saved && saved.id === routeParams.get("session") ? { ...saved, phase: "practiceComplete", citFinished: true, notification: "본검사가 완료되었습니다. 연구자가 항해 종료를 눌러 절차를 마칩니다." } : newState();
    } catch { state = newState(); }
  } else { state = newState(); allocationLoadStarted = false; }
  player.x = 130; player.y = 425; activeCrewBubble = null; nextCrewBubbleAt = 0; crewTurn = 0; crewLineTurn = 0; updateStorageStatus(); if (!citReturned) record("session_created", "새 게임 세션 생성"); setMessage(state.notification); updateScreen(); renderEventLog();
}

window.addEventListener("keydown", (event) => {
  const directions = { ArrowUp: "up", w: "up", W: "up", ArrowDown: "down", s: "down", S: "down", ArrowLeft: "left", a: "left", A: "left", ArrowRight: "right", d: "right", D: "right" };
  if (directions[event.key]) { event.preventDefault(); pressedKeys.add(directions[event.key]); }
  if ((event.key === " " || event.key === "Enter") && !event.repeat && document.activeElement.tagName !== "INPUT" && document.activeElement.tagName !== "SELECT") { event.preventDefault(); interact(); }
});
window.addEventListener("keyup", (event) => { const directions = { ArrowUp: "up", w: "up", W: "up", ArrowDown: "down", s: "down", S: "down", ArrowLeft: "left", a: "left", A: "left", ArrowRight: "right", d: "right", D: "right" }; if (directions[event.key]) pressedKeys.delete(directions[event.key]); });
canvas.addEventListener("click", () => canvas.focus());
document.querySelectorAll("[data-move]").forEach((button) => button.addEventListener("click", () => move(button.dataset.move)));
document.querySelector("#touch-action").addEventListener("click", interact);
document.querySelector("#restart-button").addEventListener("click", resetGame);
ui.condition.addEventListener("change", resetGame); ui.gem.addEventListener("change", resetGame);
document.querySelector("#toggle-events").addEventListener("click", () => ui.eventLog.classList.toggle("is-hidden"));
document.querySelector("#download-events").addEventListener("click", downloadEvents); document.querySelector("#download-cit").addEventListener("click", downloadCit);

resetGame(); requestAnimationFrame(gameLoop);
