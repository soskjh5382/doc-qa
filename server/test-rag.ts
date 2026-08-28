// ============================================================
// test-rag.ts
// 문서 넣기 → 질문 → 문서 기반 답변까지 전체 RAG 흐름 테스트.
// ============================================================

import { addDocument } from "./store.js";
import { answerQuestion } from "./answer.js";

// 테스트용 회사 규정 문서
const document = `
연차 휴가는 입사 1년 후부터 15일이 주어집니다. 3년마다 1일씩 추가됩니다.

급여는 매월 25일에 지급됩니다. 4대 보험이 공제된 후 입금됩니다.

출퇴근 시간은 오전 9시부터 오후 6시까지입니다. 유연근무제를 신청할 수 있습니다.

점심 식대는 회사에서 월 15만원을 지원합니다. 사내 식당도 이용 가능합니다.
`;

async function main() {
    // 1. 문서 저장
    const count = await addDocument(document);
    console.log(`문서 ${count}개 조각 저장 완료.\n`);
    console.log("=".repeat(50));

    // 2. 여러 질문 던져보기
    const questions = [
        "쉬는 날은 며칠 받나요?",        // 연차 (단어 다름)
        "월급은 언제 들어와요?",          // 급여
        "밥값 지원되나요?",              // 식대
        "재택근무 가능한가요?",          // 문서에 없는 내용! → "찾을 수 없음" 나와야
    ];

    for (const q of questions) {
        console.log(`\n질문: ${q}`);
        const answer = await answerQuestion(q);
        console.log(`답변: ${answer}`);
    }
}

main();