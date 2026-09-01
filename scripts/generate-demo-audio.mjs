import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const apiKey = process.env.OPENAI_API_KEY;
const outputDirectory = path.resolve("public/treasure-hunt/audio");
const questions = [
  { filename: "practice-01-pearl.mp3", text: "당신은 동굴에서 은빛 진주를 가져갔습니까?" },
  { filename: "practice-02-compass.mp3", text: "당신은 동굴에서 오래된 나침반을 가져갔습니까?" },
  { filename: "practice-03-coral.mp3", text: "당신은 동굴에서 산호 장식을 가져갔습니까?" },
];
const instructions = "한국어로 읽으세요. 낮고 차분한 검사관 톤을 유지하세요. 감정적인 연기는 피하고, 또렷하고 일정한 속도로 질문을 읽으세요. 물음표 뒤에는 짧게 멈추세요.";

if (!apiKey) {
  throw new Error("OPENAI_API_KEY가 설정되지 않았습니다. 키를 채팅이나 코드에 넣지 말고, 명령 실행 시 환경 변수로만 제공하세요.");
}

await mkdir(outputDirectory, { recursive: true });

for (const question of questions) {
  const response = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini-tts",
      voice: "onyx",
      input: question.text,
      instructions,
      response_format: "mp3",
    }),
  });

  if (!response.ok) {
    throw new Error("음성 생성에 실패했습니다: " + response.status + " " + (await response.text()));
  }

  const destination = path.join(outputDirectory, question.filename);
  await writeFile(destination, Buffer.from(await response.arrayBuffer()));
  process.stdout.write("생성 완료: " + destination + "\n");
}
