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
export async function answerQuestion(
    question: string
): Promise<{ answer: string; sources: string[] }> {
    // 1. 관련 조각 검색
    const chunks = await search(question, 3);

    if (chunks.length === 0) {
        return { answer: "먼저 문서를 넣어주세요.", sources: [] };
    }

    // 2. 조각들을 참고 자료로 합침
    const context = chunks
        .map((c, i) => `[자료 ${i + 1}]\n${c}`)
        .join("\n\n");

    // 3. 프롬프트 조립
    const prompt = `아래 참고 자료를 근거로 질문에 답하세요.

규칙:
- 참고 자료에 있는 내용만으로 답합니다.
- 자료에 답이 없으면 "제공된 문서에서 답을 찾을 수 없습니다."라고 답합니다.
- 추측하거나 자료 밖의 지식을 덧붙이지 마세요.
- 한국어로 간결하게 답합니다.

참고 자료:
${context}

질문: ${question}`;

    const result = await model.generateContent(prompt);

    // 답변 + 참고한 조각들(출처)을 함께 반환
    return {
        answer: result.response.text(),
        sources: chunks, // 화면에 보여줄 출처
    };
}