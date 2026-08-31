const canvas = document.querySelector("#game-canvas");
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;

const ui = {
  questTitle: document.querySelector("#quest-title"), questProgress: document.querySelector("#quest-progress"),
  message: document.querySelector("#game-message"), actions: document.querySelector("#screen-actions"),
  sessionChip: document.querySelector("#session-chip"), eventLog: document.querySelector("#event-log"),
  condition: document.querySelector("#condition-select"), gem: document.querySelector("#gem-select"),
  storageStatus: document.querySelector("#storage-status"),
};

const gems = [
  { id: "ruby", label: "붉은빛 루비", color: "#df4a4f", dark: "#9a2934" },
  { id: "sapphire", label: "푸른빛 사파이어", color: "#3e7cda", dark: "#23488e" },
  { id: "emerald", label: "초록빛 에메랄드", color: "#54e88b", dark: "#1f7e4b" },
  { id: "topaz", label: "황금빛 토파즈", color: "#e0a93a", dark: "#a56c1e" },
  { id: "amethyst", label: "보랏빛 자수정", color: "#9664c3", dark: "#623f88" },
];
const room = { x: 32, y: 30, w: 896, h: 500 };
const player = { x: 130, y: 425, size: 44, facing: "right" };
const pressedKeys = new Set();
const deckCrew = [
  { x: 272, y: 397 }, { x: 320, y: 409 }, { x: 368, y: 398 }, { x: 416, y: 409 }, { x: 464, y: 398 },
];
const crewLines = ["역시 선장님!!", "보물이다!", "우리가 해냈어!", "조심히 실어!", "항해가 살아난다!"];
let activeCrewBubble = null;
let nextCrewBubbleAt = 0;
let crewTurn = 0;
let crewLineTurn = 0;
let lastFrame = performance.now();
let state;

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
    id: makeId(), phase: "intake", condition: ui.condition.value, targetGem: ui.gem.value,
    testMode: true, participant: {}, carrying: null, chest: null, storyPage: 0, events: [], citSchedule: [], notification: "시연할 집단을 선택하세요. 이 모드에서는 데이터를 저장하지 않습니다.",
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
    intake: ["시연 집단 선택", "준비"], story: ["항해 이야기", `${state.storyPage + 1} / 3`], caveIntro: ["동굴 탐색", "2 / 4"], caveExitStory: ["보물 회수", "2 / 4"], deckIntro: ["선박 적재", "4 / 4"],
    shoreToCave: ["동굴 입구로 이동", "1 / 4"], cave: [state.carrying ? "해안으로 돌아가기" : (state.condition === "gem" ? `${target.label} 획득` : "금화 상자 획득"), "2 / 4"],
    shoreToShip: ["보물선으로 이동", "3 / 4"], deck: [state.carrying ? "화물함에 적재" : "적재 완료" , "4 / 4"],
    handoff: ["생리검사 준비", "완료"],
  };
  const [title, progress] = labels[state.phase] || labels.intake;
  ui.questTitle.textContent = title;
  ui.questProgress.textContent = progress;
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
    if (state.condition === "gem") { drawGem(463, 270, selectedGem(), selectedGem().label); } else { drawCoins(465, 285); text("금화 상자", 480, 342, 11, "#f8edcf", "center"); }
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
    ["폭풍을 건넌 지 여러 날, 보물선의 식량과 금화는 바닥을 보입니다.", "선원들은 선장의 마지막 항해에 조용히 기대를 걸고 있습니다."],
    state.condition === "gem"
      ? [`비밀 지도는 해안 동굴 깊은 곳의 ${objectForm(target.label)} 가리킵니다.`, "그 보석을 찾아 보물선의 화물함에 안전하게 실으세요."]
      : ["비밀 지도는 해안 동굴 깊은 곳의 금화 상자를 가리킵니다.", "그 금화를 찾아 보물선의 보물함에 안전하게 실으세요."],
    ["해안에 닿았습니다. 동굴과 보물선 사이를 오가며 임무를 완수하세요.", "이동: 화살표 / WASD · 포탈·물체 앞에서 SPACE"],
  ];
  drawDialogue("선장의 항해일지", pages[state.storyPage][0], pages[state.storyPage][1]);
}
function drawDialogue(title, line1, line2) {
  ctx.fillStyle = "rgba(11,30,47,.76)"; ctx.fillRect(88, 335, 784, 150); ctx.fillStyle = "#f8edcf"; ctx.fillRect(108, 353, 744, 112);
  text(title, 132, 380, 14, "#9b552f"); text(line1, 480, 414, 13, "#183750", "center"); text(line2, 480, 441, 12, "#47677c", "center");
}
function drawCaveNarrative(phase) {
  drawCaveScene();
  if (phase === "caveIntro") drawDialogue("동굴 입구", "파도 소리는 멀어지고, 차가운 물방울 소리만 동굴 안에 울립니다.", state.condition === "gem" ? "희미한 빛이 제단 위의 보석을 비추고 있습니다." : "희미한 빛이 제단 위의 금화 상자를 비추고 있습니다.");
  else drawDialogue("보물 회수", state.condition === "gem" ? "손안의 보석은 묵직하고 차갑습니다." : "금화 상자는 생각보다 묵직합니다.", "기다리고 있을 선원들에게 돌아가기 위해 해안가 포탈을 찾으세요.");
}
function drawDeckNarrative() {
  drawDeck(); drawDialogue("보물선 갑판", "선원들이 난간 너머로 당신을 발견하고, 배 위가 잠시 술렁입니다.", state.condition === "gem" ? "보석을 보물함에 넣어 항해의 성과를 지키세요." : "금화 상자를 보물함에 넣어 항해의 성과를 지키세요.");
}
function drawWantedPoster(x, y) {
  pixelRect(x, y, 230, 260, "#ead9ae", "#513d2b");
  ctx.fillStyle = "#9b552f"; ctx.fillRect(x + 15, y + 18, 200, 33); text("WANTED", x + 115, y + 42, 20, "#f8edcf", "center");
  text("왕실 보석 분실", x + 115, y + 79, 16, "#513d2b", "center");
  ctx.fillStyle = "#513d2b"; ctx.fillRect(x + 83, y + 99, 64, 67); ctx.fillStyle = "#d8c08a"; ctx.fillRect(x + 90, y + 106, 50, 53);
  text("?", x + 115, y + 148, 36, "#513d2b", "center");
  ctx.fillStyle = "#a98558"; ctx.fillRect(x + 20, y + 184, 190, 2); ctx.fillRect(x + 20, y + 203, 190, 2); ctx.fillRect(x + 20, y + 222, 155, 2);
  text("왕실 항구 검사관", x + 115, y + 247, 11, "#74543d", "center");
}
function drawHandoff() {
  ctx.fillStyle = "#e5e5df"; ctx.fillRect(0, 0, 960, 576); pixelRect(96, 94, 768, 382, "#f8edcf"); drawWantedPoster(137, 154);
  if (state.testMode) {
    text("항구에 붙은 수배 전단", 582, 174, 24, "#183750", "center");
    text("왕실의 보석 하나가 동굴에서 분실됐습니다.", 582, 232, 14, "#27455c", "center");
    text("항구 검사관이 보물선의 화물을 확인하기 시작합니다.", 582, 264, 13, "#47677c", "center");
    text(state.condition === "gem" ? "보석 집단(거짓) 시연을 완료했습니다." : "금화 집단(진실) 시연을 완료했습니다.", 582, 317, 13, "#47677c", "center");
    text("이 테스트 모드에서는 어떤 데이터도 저장하지 않습니다.", 582, 353, 12, "#557083", "center");
    text("처음부터를 눌러 다른 집단도 시연할 수 있습니다.", 582, 392, 11, "#557083", "center");
    return;
  }
  text("검사 준비 완료", 582, 174, 28, "#183750", "center");
  text("왕실 보석 하나가 동굴에서 사라졌습니다.", 582, 226, 14, "#27455c", "center");
  text("검사관은 보석의 정체를 알고 있습니다.", 582, 255, 14, "#27455c", "center");
  text("이제 검사 장비의 기록을 시작한 뒤, 질문에는 모두 ‘아니요’로 응답합니다.", 582, 300, 12, "#47677c", "center");
  text("CIT 순서표: 후보 5종 × 5회 = 25 문항", 582, 340, 12, "#47677c", "center");
  text("연구자 패널에서 게임 이벤트와 CIT 순서표를 CSV로 내려받을 수 있습니다.", 582, 381, 11, "#557083", "center");
}
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (state.phase === "intake") drawIntro(); else if (state.phase === "story") drawStory(); else if (state.phase === "cave") drawCaveScene(); else if (state.phase === "caveIntro" || state.phase === "caveExitStory") drawCaveNarrative(state.phase); else if (state.phase === "deck") drawDeck(); else if (state.phase === "deckIntro") drawDeckNarrative(); else if (state.phase === "handoff") drawHandoff(); else drawShore();
}

function intakeMarkup() {
  return `<section class="intake-card demo-card">
    <p class="eyebrow">DEMO MODE · NO DATA SAVED</p><h2>보물찾기 시연</h2><p>시연할 집단을 선택하세요. 참가자 정보·이벤트·CSV는 저장하지 않습니다.</p>
    <div class="demo-options"><button id="demo-gem" class="pixel-button" type="button">보석 집단<br /><small>거짓</small></button><button id="demo-coins" class="pixel-button quiet" type="button">금화 집단<br /><small>진실</small></button></div>
  </section>`;
}
function bindActions() {
  document.querySelector("#demo-gem")?.addEventListener("click", () => startDemo("gem"));
  document.querySelector("#demo-coins")?.addEventListener("click", () => startDemo("coins"));
  document.querySelector("#story-next")?.addEventListener("click", advanceStory);
  document.querySelector("#begin-voyage")?.addEventListener("click", beginVoyage);
  document.querySelector("#start-cave-explore")?.addEventListener("click", startCaveExplore);
  document.querySelector("#resume-cave-exit")?.addEventListener("click", resumeCaveExit);
  document.querySelector("#start-deck-loading")?.addEventListener("click", startDeckLoading);
  document.querySelector("#finish-game")?.addEventListener("click", finishGame);
  document.querySelector("#new-session")?.addEventListener("click", resetGame);
}
function updateScreen() {
  updateHud();
  if (state.phase === "intake") setActions(intakeMarkup());
  else if (state.phase === "story") setActions(`<button id="story-next" class="pixel-button" type="button">${state.storyPage === 2 ? "해안가로 출발" : "다음"}</button>`);
  else if (state.phase === "caveIntro") setActions('<button id="start-cave-explore" class="pixel-button" type="button">동굴 탐색 시작</button>');
  else if (state.phase === "caveExitStory") setActions('<button id="resume-cave-exit" class="pixel-button" type="button">해안가 포탈 찾기</button>');
  else if (state.phase === "deckIntro") setActions('<button id="start-deck-loading" class="pixel-button" type="button">화물 적재하기</button>');
  else if (state.phase === "handoff") setActions(`<button id="finish-game" class="pixel-button" type="button">${state.testMode ? "시연 종료" : "게임 기록 완료"}</button>`);
  else setActions("");
  ui.message.textContent = state.notification;
  bindActions(); draw();
}
function startDemo(condition) {
  state.condition = condition;
  state.storyPage = 0;
  state.phase = "story";
  setMessage("게임 안내를 확인한 뒤 게임 시작을 누르세요."); updateScreen();
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
  record(state.condition === "gem" ? "gem_pickup" : "coin_pickup", state.condition === "gem" ? `${selectedGem().label} 획득` : "금화 상자 획득");
  state.phase = "caveExitStory"; setMessage("보물을 손에 넣었습니다."); updateScreen();
}
function depositTreasure() {
  const detail = state.condition === "gem" ? `${selectedGem().label} → 보물함` : "금화 상자 → 보물함";
  record(state.condition === "gem" ? "gem_deposited" : "coins_deposited", detail, { assigned_chest: "treasure_chest" });
  state.carrying = null; state.phase = "handoff";
  if (!state.testMode) { createCitSchedule(); record("exam_handoff_onset", "게임 완료 · 동공 및 폴리그래프 검사 준비", { cit_trial_count: state.citSchedule.length }); }
  setMessage(state.testMode ? "시연을 완료했습니다. 데이터는 저장되지 않았습니다." : "게임 기록을 보관했습니다. 이제 생리검사를 준비하세요."); updateScreen();
}
function createCitSchedule() {
  if (state.citSchedule.length) return;
  for (let round = 1; round <= 5; round += 1) {
    shuffle(gems).forEach((gem, index) => {
      const isProbe = state.condition === "gem" && gem.id === state.targetGem;
      const gemName = gem.label.replace(/^.+빛\s/, "");
      state.citSchedule.push({ session_id: state.id, participant_code: state.participant.code, round, trial_in_round: index + 1, trial_number: state.citSchedule.length + 1, candidate_gem: gemName, candidate_id: gem.id, item_type: isProbe ? "probe" : "irrelevant", question_text: `당신은 동굴에서 ${objectForm(gemName)} 가져오셨습니까?`, expected_response: "아니요" });
    });
  }
  saveTemporary();
}
function finishGame() { if (!state.testMode) record("game_record_complete", "게임 단계 기록 완료"); setMessage(state.testMode ? "데이터를 저장하지 않고 시연을 마쳤습니다." : "게임 단계가 완료되었습니다. CSV 파일을 검사 세션 폴더에 함께 보관하세요."); setActions('<button id="new-session" class="pixel-button" type="button">처음으로</button>'); bindActions(); }

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
function downloadCit() { createCitSchedule(); download(`${state.id}_cit_schedule.csv`, ["session_id", "participant_code", "round", "trial_in_round", "trial_number", "candidate_gem", "candidate_id", "item_type", "question_text", "expected_response"], state.citSchedule); }

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
  state = newState(); player.x = 130; player.y = 425; activeCrewBubble = null; nextCrewBubbleAt = 0; crewTurn = 0; crewLineTurn = 0; updateStorageStatus(); record("session_created", "새 게임 세션 생성"); setMessage(state.notification); updateScreen(); renderEventLog();
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
