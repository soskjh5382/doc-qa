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
// 글 하나를 받아 임베딩(숫자 배열)으로 바꾸는 함수.
// 예: "연차 며칠?" → [0.02, -0.13, 0.87, ...] (숫자 수백 개)
// ------------------------------------------------------------
export async function embed(text: string): Promise<number[]> {
    const result = await embeddingModel.embedContent(text);
    // result.embedding.values 안에 숫자 배열이 들어있다.
    return result.embedding.values;
}