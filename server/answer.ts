// ============================================================
// server/answer.ts
// 역할: RAG의 마지막 단계 — 검색된 조각을 근거로 AI가 답변 생성.
//
// 핵심: AI가 "자기가 아는 걸"로 답하면 안 된다.
//   반드시 "우리가 찾아준 조각"만 근거로 답하게 프롬프트로 통제한다.
//   그래야 "내 문서 기반 답변"이 된다.
// ============================================================

import { GoogleGenerativeAI } from "@google/generative-ai";
import "dotenv/config";
import { search } from "./store.js";

// Gemini 클라이언트 (답변 생성용)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-3.6-flash" });

// ------------------------------------------------------------
// 질문을 받아서, 문서 기반 답변 + 참고한 조각(출처)을 돌려준다.
// ------------------------------------------------------------
// 대화 한 턴의 형태 (질문 또는 답변)
type Turn = {
    role: "user" | "assistant"; // user=질문, assistant=답변
    text: string;
};

// ------------------------------------------------------------
// 질문 + 이전 대화 기록을 받아서, 문서 기반 답변 + 출처를 돌려준다.
//   history: 지금까지의 대화 (없으면 빈 배열)
// ------------------------------------------------------------
export async function answerQuestion(
    question: string,
    history: Turn[] = []
): Promise<{ answer: string; sources: string[] }> {
    // 1. 관련 조각 검색 (현재 질문 기준)
    const chunks = await search(question, 3);

    if (chunks.length === 0) {
        return { answer: "먼저 문서를 넣어주세요.", sources: [] };
    }

    // 2. 조각들을 참고 자료로 합침
    const context = chunks
        .map((c, i) => `[자료 ${i + 1}]\n${c}`)
        .join("\n\n");

    // 3. 이전 대화를 텍스트로 정리 (맥락 제공용)
    //    "그럼 점심은?" 같은 후속 질문을 이해하게 해준다.
    const historyText =
        history.length > 0
            ? "지금까지의 대화:\n" +
            history
                .map((t) => `${t.role === "user" ? "질문" : "답변"}: ${t.text}`)
                .join("\n") +
            "\n\n"
            : "";

    // 4. 프롬프트 조립 — 대화 맥락 + 참고 자료 + 현재 질문
    const prompt = `아래 참고 자료를 근거로 질문에 답하세요.

규칙:
- 참고 자료에 있는 내용만으로 답합니다.
- 자료에 답이 없으면 "제공된 문서에서 답을 찾을 수 없습니다."라고 답합니다.
- 추측하거나 자료 밖의 지식을 덧붙이지 마세요.
- 이전 대화가 있으면 맥락을 참고해 후속 질문을 이해하세요.
  (예: "그럼 점심은?"은 앞서 언급된 날짜의 점심을 뜻함)
- 한국어로 간결하게 답합니다.

${historyText}참고 자료:
${context}

현재 질문: ${question}`;

    const result = await model.generateContent(prompt);

    return {
        answer: result.response.text(),
        sources: chunks,
    };
}

// ------------------------------------------------------------
// 스트리밍 버전: 답변을 조각조각(청크) 흘려보낸다.
//   onChunk: 조각이 나올 때마다 호출되는 함수 (그 조각을 넘겨줌)
//   반환: 검색된 출처 (조각이 아니라 마지막에 한 번)
// ------------------------------------------------------------
export async function answerQuestionStream(
    question: string,
    history: Turn[],
    onChunk: (text: string) => void
): Promise<{ sources: string[] }> {
    // 1. 검색 (기존과 동일)
    const chunks = await search(question, 3);
    if (chunks.length === 0) {
        onChunk("먼저 문서를 넣어주세요.");
        return { sources: [] };
    }

    // 2. 참고 자료 조립 (기존과 동일)
    const context = chunks.map((c, i) => `[자료 ${i + 1}]\n${c}`).join("\n\n");

    // 3. 대화 맥락 (기존과 동일)
    const historyText =
        history.length > 0
            ? "지금까지의 대화:\n" +
            history.map((t) => `${t.role === "user" ? "질문" : "답변"}: ${t.text}`).join("\n") +
            "\n\n"
            : "";

    // 4. 프롬프트 (기존과 동일)
    const prompt = `아래 참고 자료를 근거로 질문에 답하세요.

규칙:
- 참고 자료에 있는 내용만으로 답합니다.
- 자료에 답이 없으면 "제공된 문서에서 답을 찾을 수 없습니다."라고 답합니다.
- 추측하거나 자료 밖의 지식을 덧붙이지 마세요.
- 이전 대화가 있으면 맥락을 참고해 후속 질문을 이해하세요.
- 한국어로 간결하게 답합니다.

${historyText}참고 자료:
${context}

현재 질문: ${question}`;

    // ★ 스트리밍 호출: generateContentStream (한 번에가 아니라 조각조각)
    const result = await model.generateContentStream(prompt);

    // 조각이 나올 때마다 onChunk로 넘긴다
    for await (const chunk of result.stream) {
        const text = chunk.text();
        if (text) onChunk(text);
    }

    // 답변이 다 끝나면 출처를 반환
    return { sources: chunks };
}