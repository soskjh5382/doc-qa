// ============================================================
// server/preprocess.ts
// 역할: 저장하기 전에 문서를 "검색하기 좋은 형태"로 정리한다.
//
// 왜 필요한가:
//   PDF에서 뽑은 텍스트는 표가 뭉치거나 순서가 엉키는 등 지저분하다.
//   이걸 그대로 저장하면 검색이 잘 안 된다.
//   저장 전에 AI가 한 번 정리하면 어떤 문서든 깔끔해진다.
//
// 핵심: 문서 종류(식단표/계약서/매뉴얼 등)를 가정하지 않는다.
//   "뭐든 검색하기 좋게 정리해줘"라는 범용 지시만 준다.
//   → 어떤 양식이 와도 AI가 알아서 적절히 정리한다.
// ============================================================

import { GoogleGenerativeAI } from "@google/generative-ai";
import "dotenv/config";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-3.6-flash" });

// ------------------------------------------------------------
// 지저분한 원본 텍스트를 받아, 검색하기 좋게 정리한 텍스트를 돌려준다.
// ------------------------------------------------------------
export async function preprocess(rawText: string): Promise<string> {
    // 문서가 너무 짧으면 정리할 필요 없이 그대로 반환 (비용 절약)
    if (rawText.length < 100) {
        return rawText;
    }

    const prompt = `아래 문서를 검색하기 좋은 형태로 정리하세요.

정리 규칙:
- 표 형식(항목이 가로로 나열)이면, 각 행/항목을 독립적으로 이해되는 문장이나 블록으로 재구성하세요.
- 서로 관련된 정보는 한 덩어리로 묶고, 덩어리 사이는 빈 줄로 구분하세요.
- 각 덩어리는 그것만 읽어도 무슨 내용인지 알 수 있게 만드세요. (예: 날짜/제목 등 맥락을 각 덩어리에 포함)
- 원본에 있는 정보는 절대 빠뜨리거나 지어내지 마세요. 재배치만 하세요.
- 불필요한 머리말/꼬리말/반복은 정리하되, 실제 내용은 모두 보존하세요.
- 설명이나 인사말 없이, 정리된 문서 내용만 출력하세요.

원본 문서:
${rawText}`;

    try {
        const result = await model.generateContent(prompt);
        const cleaned = result.response.text().trim();
        // 정리 결과가 비었으면 원본을 그대로 사용 (안전장치)
        return cleaned.length > 0 ? cleaned : rawText;
    } catch (err) {
        // 정리 실패해도 원본으로 진행 (전처리는 있으면 좋은 것, 없어도 동작)
        console.error("전처리 실패, 원본 사용:", err);
        return rawText;
    }
}