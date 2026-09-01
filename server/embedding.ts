// ============================================================
// server/embedding.ts
// 역할: 글(텍스트)을 "의미 좌표(숫자 목록)"로 바꾼다.
//   이게 임베딩. 뜻이 비슷한 글은 비슷한 숫자가 된다.
//   이 숫자들을 나중에 비교해서 "관련 있는 글"을 찾는다.
// ============================================================

import { GoogleGenerativeAI } from "@google/generative-ai";
import "dotenv/config";

// Gemini 클라이언트 생성 (도구상자 때와 동일)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// 임베딩 전용 모델. 답변 생성 모델과는 다른 "임베딩 전용" 모델을 쓴다.
const embeddingModel = genAI.getGenerativeModel({
    model: "gemini-embedding-001", // 최신 임베딩 모델
});

// ------------------------------------------------------------
// 잠깐 쉬는 함수. ms(밀리초)만큼 기다렸다가 다음 줄로 넘어간다.
//   예: await sleep(1000)  →  1초 멈춤
//   왜 필요? 무료 등급은 "분당 요청/토큰 한도"가 있어서,
//            요청을 너무 빨리 연달아 보내면 429(한도초과)가 난다.
//            그래서 사이사이 쉬어주거나, 막히면 잠깐 기다렸다 재시도한다.
// ------------------------------------------------------------
function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// ------------------------------------------------------------
// 글 하나를 받아 임베딩(숫자 배열)으로 바꾸는 함수.
// 예: "연차 며칠?" → [0.02, -0.13, 0.87, ...] (숫자 수백 개)
//
// ★ 추가된 기능: 429(한도초과) 에러가 나면 자동으로 재시도한다.
//   - 최대 5번까지 다시 시도
//   - 시도할 때마다 기다리는 시간을 점점 늘린다 (2초 → 4초 → 8초 …)
//     이걸 "지수 백오프(exponential backoff)"라고 부른다.
//     한도가 풀릴 시간을 점점 더 주는 방식.
// ------------------------------------------------------------
export async function embed(text: string): Promise<number[]> {
    const MAX_RETRIES = 5; // 최대 재시도 횟수

    // 정해진 횟수만큼 반복 시도
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
            // 실제 임베딩 API 호출
            const result = await embeddingModel.embedContent(text);
            // 성공하면 숫자 배열을 바로 돌려주고 함수 끝
            return result.embedding.values;
        } catch (err: any) {
            // 에러가 429(Too Many Requests, 한도초과)인지 확인
            const is429 = err?.status === 429;

            // 429가 아니거나(다른 종류의 진짜 에러) 마지막 시도였으면
            // → 더 재시도하지 않고 에러를 그대로 위로 던진다.
            if (!is429 || attempt === MAX_RETRIES - 1) {
                throw err;
            }

            // 429이고 아직 재시도 여유가 있으면: 점점 더 오래 기다린다.
            //   attempt 0 → 2초, 1 → 4초, 2 → 8초, 3 → 16초 …
            const waitMs = 2000 * Math.pow(2, attempt);
            console.log(
                `  ⏳ 한도초과(429). ${waitMs / 1000}초 쉬고 다시 시도… (${attempt + 1}/${MAX_RETRIES})`
            );
            await sleep(waitMs);
            // 반복문이 돌면서 다시 시도한다.
        }
    }

    // 여기까지 오면(모든 재시도 실패) 안전장치용 에러.
    // 실제로는 위 for문 안에서 return 되거나 throw 되므로 도달하지 않는다.
    throw new Error("임베딩 재시도 모두 실패");
}