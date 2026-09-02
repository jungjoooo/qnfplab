"use client";

import { useEffect, useMemo, useState } from "react";

type Candidate = { id: string; label: string };
type Trial = Candidate & { block: number; number: number };
type Stage = "ready" | "baseline" | "fixation" | "stimulus" | "question" | "complete";

const CANDIDATES: Candidate[] = [
  { id: "diamond", label: "다이아몬드" },
  { id: "ring", label: "귀중한 반지" },
  { id: "watch", label: "은제 회중시계" },
  { id: "gold_bar", label: "금괴" },
  { id: "clover", label: "클로버 장식" },
];
const BRIDGE = "http://127.0.0.1:8765";

function shuffle<T>(items: T[]) {
  const copied = [...items];
  for (let i = copied.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copied[i], copied[j]] = [copied[j], copied[i]];
  }
  return copied;
}

function schedule() {
  let number = 0;
  return Array.from({ length: 5 }, (_, blockIndex) => shuffle(CANDIDATES).map((candidate) => ({ ...candidate, block: blockIndex + 1, number: ++number }))).flat();
}

function particleShape(candidate: Candidate) {
  const shared = "fill-[#333a40] stroke-[#f7f8f8] stroke-[3]";
  if (candidate.id === "diamond") return <polygon className={shared} points="100,18 164,80 132,174 68,174 36,80" />;
  if (candidate.id === "ring") return <><circle className={shared} cx="100" cy="111" r="52" /><circle className="fill-[#d7dde0]" cx="100" cy="111" r="29" /><polygon className={shared} points="100,18 126,56 100,82 74,56" /></>;
  if (candidate.id === "watch") return <><circle className={shared} cx="100" cy="105" r="64" /><circle className="fill-[#dce1e3] stroke-[#333a40] stroke-[8]" cx="100" cy="105" r="50" /><path className="stroke-[#333a40] stroke-[9]" d="M100 72v36l25 17" /><rect className="fill-[#333a40]" x="78" y="20" width="44" height="15" /></>;
  if (candidate.id === "gold_bar") return <polygon className={shared} points="45,70 155,70 180,150 20,150" />;
  return <><circle className="fill-[#333a40]" cx="100" cy="100" r="14" />{[[100,42],[155,70],[145,138],[55,138],[45,70]].map(([cx, cy]) => <ellipse key={`${cx}-${cy}`} className={shared} cx={cx} cy={cy} rx="29" ry="22" />)}</>;
}

function Stimulus({ candidate }: { candidate: Candidate }) {
  return <div className="grid h-[250px] w-[250px] place-items-center border-4 border-slate-100 bg-[#aeb5b9] shadow-[0_0_0_1px_#56636b,0_18px_34px_rgba(0,0,0,.2)]"><svg viewBox="0 0 200 200" role="img" aria-label={candidate.label} className="h-[210px] w-[210px]">{particleShape(candidate)}</svg></div>;
}

export default function CitClient() {
  const [stage, setStage] = useState<Stage>("ready");
  const [bridge, setBridge] = useState<{ pupil_connected: boolean; message?: string } | null>(null);
  const [message, setMessage] = useState("연구자가 장비 연결을 확인한 뒤 검사를 시작합니다.");
  const [trials] = useState<Trial[]>(() => schedule());
  const [index, setIndex] = useState(0);
  const [started, setStarted] = useState(false);
  const [error, setError] = useState("");
  const active = trials[index];
  const participant = useMemo(() => {
    try {
      const saved = sessionStorage.getItem("ophtheon-cit-game-temporary");
      const state = saved ? JSON.parse(saved) : null;
      return { id: state?.participant?.code || state?.id || `CIT-${Date.now()}`, condition: state?.condition || "" };
    } catch { return { id: `CIT-${Date.now()}`, condition: "" }; }
  }, []);

  const callBridge = async (path: string, body?: object) => {
    const response = await fetch(`${BRIDGE}${path}`, { method: body ? "POST" : "GET", headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || "연결 중 오류가 발생했습니다.");
    return result;
  };
  const checkBridge = async () => {
    try { setBridge(await callBridge("/api/status")); setError(""); }
    catch { setBridge({ pupil_connected: false, message: "실험 PC 연결 프로그램이 실행되지 않았습니다." }); }
  };
  useEffect(() => { void checkBridge(); }, []);
  const mark = async (event_label: string, extra: object = {}) => callBridge("/api/event", { event_label, event_type: "cit", block_id: active?.block || "", trial_id: active?.number || "", candidate_id: active?.id || "", candidate_object: active?.label || "", ...extra });

  const nextTrial = async (trialIndex = index) => {
    if (trialIndex >= trials.length) {
      await mark("cit_complete_onset");
      setStage("complete"); setMessage("본검사가 끝났습니다. 연구자 안내에 따라 항해 화면으로 돌아갑니다."); return;
    }
    const trial = trials[trialIndex];
    setStage("fixation"); setMessage("중앙 십자를 바라봐 주세요.");
    await mark(`cit_b${String(trial.block).padStart(2, "0")}_t${String(trial.number).padStart(2, "0")}_${trial.id}_fixation_onset`, { block_id: trial.block, trial_id: trial.number, candidate_id: trial.id, candidate_object: trial.label });
    window.setTimeout(async () => {
      setStage("stimulus"); setMessage("사물을 주의 깊게 봐 주세요.");
      await mark(`cit_b${String(trial.block).padStart(2, "0")}_t${String(trial.number).padStart(2, "0")}_${trial.id}_stimulus_onset`, { block_id: trial.block, trial_id: trial.number, candidate_id: trial.id, candidate_object: trial.label });
      window.setTimeout(async () => {
        setStage("question"); setMessage("질문을 들은 뒤 답변을 선택해 주세요.");
        const question = `당신은 동굴에서 이 사물을 가져갔습니까?`;
        await mark(`cit_b${String(trial.block).padStart(2, "0")}_t${String(trial.number).padStart(2, "0")}_${trial.id}_question_onset`, { text: question, block_id: trial.block, trial_id: trial.number, candidate_id: trial.id, candidate_object: trial.label });
        if ("speechSynthesis" in window) {
          const speech = new SpeechSynthesisUtterance(question);
          speech.lang = "ko-KR"; speech.rate = 0.88; window.speechSynthesis.cancel(); window.speechSynthesis.speak(speech);
        }
      }, 900);
    }, 1200);
  };
  const start = async () => {
    try {
      if (!bridge?.pupil_connected) throw new Error("Pupil Capture 연결을 먼저 확인해 주세요.");
      setError("");
      await callBridge("/api/session/start", { session_id: participant.id, participant_id: participant.id, condition: participant.condition, schedule: trials });
      setStarted(true); setStage("baseline"); setMessage("회색 화면을 편안히 바라봐 주세요.");
      await mark("baseline_gray_onset", { event_type: "baseline" });
      window.setTimeout(async () => { await mark("baseline_gray_offset", { event_type: "baseline" }); await nextTrial(); }, 10000);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "검사를 시작할 수 없습니다."); }
  };
  const answer = async (answer: "yes" | "no") => {
    try {
      await mark(`cit_b${String(active.block).padStart(2, "0")}_t${String(active.number).padStart(2, "0")}_${active.id}_response_onset`, { participant_answer: answer });
      const nextIndex = index + 1;
      setIndex(nextIndex); setMessage("다음 시행을 준비합니다.");
      window.setTimeout(() => { void nextTrial(nextIndex); }, 900);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "반응을 저장하지 못했습니다."); }
  };
  const finish = async () => {
    try { await callBridge("/api/session/finish", {}); window.location.href = `/odyssey?cit=complete&session=${encodeURIComponent(participant.id)}`; }
    catch (caught) { setError(caught instanceof Error ? caught.message : "검사를 마무리하지 못했습니다."); }
  };

  return <section className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-5xl flex-col px-5 py-8 sm:px-8">
    <div className="mb-5 flex items-center justify-between text-sm font-medium text-slate-500"><span>생리신호 검사 · 연구자 진행</span><span className={bridge?.pupil_connected ? "text-emerald-700" : "text-rose-700"}>{bridge?.pupil_connected ? "● Pupil Capture 연결됨" : "● Pupil Capture 확인 필요"}</span></div>
    <div className="flex flex-1 flex-col items-center justify-center rounded-[28px] border border-slate-300 bg-[#777f84] p-6 shadow-xl sm:p-10">
      <div className="mb-6 text-center text-base font-semibold text-white/90">{stage === "question" ? `시행 ${index + 1} / ${trials.length}` : stage === "baseline" ? "회색 베이스라인" : "CIT 본검사"}</div>
      {stage === "ready" && <div className="max-w-lg rounded-3xl bg-white p-8 text-center shadow-lg"><h1 className="text-3xl font-bold text-slate-800">검사 준비</h1><p className="mt-4 leading-7 text-slate-600">연구자가 eye 0·eye 1 연결과 폴리그래프 장비를 확인한 뒤 시작합니다.</p><button onClick={checkBridge} className="mt-6 rounded-xl border border-slate-300 px-5 py-3 font-semibold text-slate-700">연결 다시 확인</button><button onClick={start} className="ml-3 mt-6 rounded-xl bg-slate-800 px-5 py-3 font-bold text-white">본검사 시작</button></div>}
      {stage === "baseline" && <div className="grid h-56 w-56 place-items-center text-7xl font-light text-white">+</div>}
      {stage === "fixation" && <div className="grid h-56 w-56 place-items-center text-7xl font-light text-white">+</div>}
      {(stage === "stimulus" || stage === "question") && active && <Stimulus candidate={active} />}
      {stage === "question" && <><p className="mt-8 text-center text-2xl font-bold text-white">당신은 동굴에서 이 사물을 가져갔습니까?</p><div className="mt-7 flex gap-4"><button onClick={() => void answer("yes")} className="rounded-2xl border-2 border-white bg-white px-12 py-4 text-xl font-bold text-slate-800">예</button><button onClick={() => void answer("no")} className="rounded-2xl border-2 border-white bg-slate-800 px-12 py-4 text-xl font-bold text-white">아니오</button></div></>}
      {stage === "complete" && <div className="max-w-xl rounded-3xl bg-white p-8 text-center shadow-lg"><h1 className="text-3xl font-bold text-slate-800">본검사 완료</h1><p className="mt-4 leading-7 text-slate-600">연구자가 기록 저장을 확인한 뒤 항해 화면으로 돌아갑니다.</p><button onClick={finish} className="mt-6 rounded-xl bg-slate-800 px-6 py-3 font-bold text-white">항해 화면으로 돌아가기</button></div>}
      <p className="mt-8 min-h-6 text-center font-medium text-white/85">{message}</p>{error && <p className="mt-3 rounded-lg bg-rose-50 px-4 py-2 text-center font-medium text-rose-700">{error}</p>}
    </div>
    <p className="mt-5 text-center text-sm text-slate-500">검사 진행 중에는 브라우저를 새로고침하거나 뒤로 가기를 사용하지 마세요.</p>
  </section>;
}
