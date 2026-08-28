// ============================================================
// server/index.ts
// 역할: 백엔드 서버. 프론트의 요청을 받아 RAG 함수들을 실행.
//   /api/upload → 문서 저장 (조각내고 임베딩)
//   /api/ask    → 질문에 문서 기반 답변
//
// 실행: npm run server
// ============================================================

import express from "express";
import cors from "cors";
import "dotenv/config";
import path from "path";
import { fileURLToPath } from "url";
import { addDocument } from "./store.js";        // 문서 저장 함수
import { answerQuestion } from "./answer.js";    // 답변 생성 함수
import multer from "multer";           // 파일 업로드 받기
import { PDFParse } from "pdf-parse";   // PDF에서 글자 추출 (클래스 방식)

const app = express();
// 업로드된 파일을 메모리에 임시 보관하는 설정
// (디스크에 저장 안 하고 바로 처리하려고 memoryStorage 사용)
const upload = multer({ storage: multer.memoryStorage() });
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.use(cors());
app.use(express.json({ limit: "5mb" })); // 문서가 클 수 있어 용량 여유

// ------------------------------------------------------------
// POST /api/upload — 문서를 받아 저장(조각내고 임베딩)
// ------------------------------------------------------------
app.post("/api/upload", async (req, res) => {
    try {
        const { text } = req.body;
        if (!text || !text.trim()) {
            return res.status(400).json({ error: "문서 내용이 필요합니다." });
        }

        // 문서를 조각내고 임베딩해서 저장
        const count = await addDocument(text);
        console.log(`문서 저장: ${count}개 조각`);

        // 저장된 조각 개수를 알려줌
        res.json({ count });
    } catch (err) {
        console.error("업로드 실패:", err);
        res.status(500).json({ error: "문서 저장 중 문제가 발생했습니다." });
    }
});
// ------------------------------------------------------------
// POST /api/upload-pdf — PDF 파일을 받아 글자를 추출해 저장
//   upload.single("file"): "file"이라는 이름의 파일 하나를 받음
// ------------------------------------------------------------
app.post("/api/upload-pdf", upload.single("file"), async (req, res) => {
    try {
        // multer가 받은 파일은 req.file에 들어있다
        if (!req.file) {
            return res.status(400).json({ error: "PDF 파일이 필요합니다." });
        }

        // PDF 파일(버퍼)에서 텍스트를 추출
        const parser = new PDFParse({ data: req.file.buffer });
        const result = await parser.getText();
        const text = result.text;
        await parser.destroy(); // 다 쓴 파서 정리 (메모리 해제)

        if (!text || !text.trim()) {
            return res.status(400).json({ error: "PDF에서 텍스트를 추출하지 못했습니다." });
        }

        // 추출한 텍스트를 기존 방식대로 저장 (조각내고 임베딩)
        const count = await addDocument(text);
        console.log(`PDF 저장: ${count}개 조각`);

        res.json({ count });
    } catch (err) {
        console.error("PDF 처리 실패:", err);
        res.status(500).json({ error: "PDF 처리 중 문제가 발생했습니다." });
    }
});

// ------------------------------------------------------------
// POST /api/ask — 질문을 받아 문서 기반 답변
// ------------------------------------------------------------
app.post("/api/ask", async (req, res) => {
    try {
        const { question } = req.body;
        if (!question || !question.trim()) {
            return res.status(400).json({ error: "질문이 필요합니다." });
        }

        // RAG 전체 실행 (검색 + 답변 생성)
        // answerQuestion이 이제 { answer, sources } 객체를 반환
        const result = await answerQuestion(question);
        console.log(`질문 처리 완료`);
        res.json(result); // { answer, sources }를 그대로 전달

    } catch (err) {
        console.error("질문 처리 실패:", err);
        res.status(500).json({ error: "답변 생성 중 문제가 발생했습니다." });
    }
});

// ------------------------------------------------------------
// 빌드된 프론트 화면 제공 (배포용)
// ------------------------------------------------------------
app.use(express.static(path.join(__dirname, "..", "dist")));
app.use((_req, res) => {
    res.sendFile(path.join(__dirname, "..", "dist", "index.html"));
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`서버 실행 중: http://localhost:${PORT}`);
});