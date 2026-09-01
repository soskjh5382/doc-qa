// ============================================================
// App.tsx — 문서 Q&A (RAG) · 민트 톤 (포트폴리오와 통일)
// 대화 기억 + 스트리밍 + PDF + 출처 표시
// ============================================================

import { useState } from "react";

// 포트폴리오와 같은 팔레트 (민트 액센트 + 잉크 배경)
const C = {
    bg: "#0b0d12",
    card: "#141821",
    cardHover: "#181d28",
    line: "#232936",
    text: "#eef1f6",
    dim: "#98a1b2",
    faint: "#5a6474",
    accent: "#6ee7c7",     // 민트 (시그니처)
    accentInk: "#0a1512",  // 민트 위 글자색
    field: "#0f1218",
    err: "#e07a7a",
};

const SANS = "'Inter', system-ui, sans-serif";
const MONO = "'JetBrains Mono', ui-monospace, monospace";

type Message = {
    role: "user" | "assistant";
    text: string;
    sources?: string[];
};

export default function App() {
    const [docText, setDocText] = useState("");
    const [uploaded, setUploaded] = useState(false);
    const [savedInfo, setSavedInfo] = useState("");
    const [question, setQuestion] = useState("");
    const [messages, setMessages] = useState<Message[]>([]);
    const [uploading, setUploading] = useState(false);
    const [asking, setAsking] = useState(false);
    const [error, setError] = useState("");
    const [inputFocus, setInputFocus] = useState(false); // 입력창 포커스 효과

    async function uploadDoc() {
        if (!docText.trim()) {
            setError("문서를 입력하세요.");
            return;
        }
        setError("");
        setUploading(true);
        setUploaded(false);
        setMessages([]);
        try {
            const res = await fetch("/api/upload", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: docText }),
            });
            const data = await res.json();
            if (data.error) setError(data.error);
            else {
                setUploaded(true);
                setSavedInfo(`${data.count}개 구절로 정리했습니다.`);
            }
        } catch {
            setError("서버에 연결할 수 없습니다.");
        } finally {
            setUploading(false);
        }
    }

    async function uploadPdf(file: File) {
        setError("");
        setUploading(true);
        setUploaded(false);
        setMessages([]);
        try {
            const formData = new FormData();
            formData.append("file", file);
            const res = await fetch("/api/upload-pdf", { method: "POST", body: formData });
            const data = await res.json();
            if (data.error) setError(data.error);
            else {
                setUploaded(true);
                setDocText(`📄 ${file.name}`);
                setSavedInfo(`${data.count}개 구절로 정리했습니다.`);
            }
        } catch {
            setError("PDF 업로드에 실패했습니다.");
        } finally {
            setUploading(false);
        }
    }

    // 스트리밍 질문
    async function ask() {
        if (!question.trim()) {
            setError("질문을 입력하세요.");
            return;
        }
        setError("");
        setAsking(true);
        const currentQuestion = question;
        setQuestion("");
        const history = messages.map((m) => ({ role: m.role, text: m.text }));
        setMessages((prev) => [
            ...prev,
            { role: "user", text: currentQuestion },
            { role: "assistant", text: "", sources: [] },
        ]);
        try {
            const res = await fetch("/api/ask-stream", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ question: currentQuestion, history }),
            });
            const reader = res.body!.getReader();
            const decoder = new TextDecoder();
            let buffer = "";
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const parts = buffer.split("\n\n");
                buffer = parts.pop() || "";
                for (const part of parts) {
                    if (!part.startsWith("data: ")) continue;
                    const data = JSON.parse(part.slice(6));
                    if (data.chunk) {
                        setMessages((prev) => {
                            const copy = [...prev];
                            const last = copy[copy.length - 1];
                            copy[copy.length - 1] = { ...last, text: last.text + data.chunk };
                            return copy;
                        });
                    }
                    if (data.sources) {
                        setMessages((prev) => {
                            const copy = [...prev];
                            const last = copy[copy.length - 1];
                            copy[copy.length - 1] = { ...last, sources: data.sources };
                            return copy;
                        });
                    }
                    if (data.error) setError(data.error);
                }
            }
        } catch {
            setError("서버에 연결할 수 없습니다.");
        } finally {
            setAsking(false);
        }
    }

    function resetChat() {
        setMessages([]);
        setError("");
    }

    return (
        <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: SANS }}>
            <div style={{ maxWidth: 680, margin: "0 auto", padding: "72px 24px 100px" }}>
                {/* 헤더 */}
                <header style={{ marginBottom: 48 }}>
                    <div
                        style={{
                            display: "inline-block",
                            fontFamily: MONO,
                            fontSize: 12,
                            letterSpacing: "0.12em",
                            color: C.accent,
                            borderBottom: `1px solid ${C.accent}33`,
                            paddingBottom: 6,
                            marginBottom: 20,
                        }}
                    >
                        document q&a
                    </div>
                    <h1 style={{ fontSize: "clamp(30px, 6vw, 40px)", fontWeight: 700, margin: 0, lineHeight: 1.1, letterSpacing: "-0.03em" }}>
                        문서에게 직접 물어보세요
                    </h1>
                    <p style={{ color: C.dim, fontSize: 15.5, marginTop: 16, lineHeight: 1.7, maxWidth: 480 }}>
                        문서를 넣으면 그 내용만 근거로 답합니다. 없는 것은 지어내지 않고, 이어지는 질문도 맥락을 기억합니다.
                    </p>
                </header>

                {/* 1단계: 문서 넣기 */}
                <section style={card()}>
                    <StepLabel n="1" title="문서 넣기" done={uploaded} />
                    <textarea
                        value={docText}
                        onChange={(e) => {
                            setDocText(e.target.value);
                            setUploaded(false);
                            setSavedInfo("");
                        }}
                        placeholder="문서를 붙여넣으세요. 문단은 빈 줄로 나누면 더 정확합니다."
                        spellCheck={false}
                        style={{
                            width: "100%",
                            minHeight: 148,
                            background: C.field,
                            color: C.text,
                            border: `1px solid ${C.line}`,
                            borderRadius: 12,
                            padding: 16,
                            fontSize: 14,
                            lineHeight: 1.65,
                            fontFamily: "inherit",
                            resize: "vertical",
                            outline: "none",
                            boxSizing: "border-box",
                            marginTop: 18,
                        }}
                    />
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 16 }}>
                        <button onClick={uploadDoc} disabled={uploading} style={primaryBtn(uploading)}>
                            {uploading ? "정리하는 중…" : "텍스트 저장"}
                        </button>
                        <span style={{ color: C.faint, fontSize: 13 }}>또는</span>
                        <label style={ghostBtn(uploading)}>
                            PDF 열기
                            <input
                                type="file"
                                accept="application/pdf"
                                onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    if (f) uploadPdf(f);
                                }}
                                style={{ display: "none" }}
                            />
                        </label>
                    </div>
                    {uploaded && (
                        <div
                            style={{
                                marginTop: 16,
                                padding: "10px 14px",
                                background: `${C.accent}12`,
                                border: `1px solid ${C.accent}33`,
                                borderRadius: 10,
                                fontSize: 13,
                                color: C.accent,
                                fontFamily: MONO,
                            }}
                        >
                            ✓ 저장 완료 · {savedInfo}
                        </div>
                    )}
                </section>

                {/* 2단계: 대화 */}
                <section
                    style={{
                        ...card(),
                        marginTop: 20,
                        opacity: uploaded ? 1 : 0.4,
                        pointerEvents: uploaded ? "auto" : "none",
                        transition: "opacity 0.3s",
                    }}
                >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <StepLabel n="2" title="대화하기" />
                        {messages.length > 0 && (
                            <button
                                onClick={resetChat}
                                style={{
                                    background: "none",
                                    border: `1px solid ${C.line}`,
                                    borderRadius: 8,
                                    color: C.dim,
                                    padding: "6px 12px",
                                    fontSize: 12,
                                    fontFamily: MONO,
                                    cursor: "pointer",
                                }}
                            >
                                초기화
                            </button>
                        )}
                    </div>

                    {messages.length > 0 && (
                        <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 12 }}>
                            {messages.map((m, i) => (
                                <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                                    <div
                                        style={{
                                            maxWidth: "86%",
                                            background: m.role === "user" ? C.accent : C.field,
                                            color: m.role === "user" ? C.accentInk : C.text,
                                            border: m.role === "user" ? "none" : `1px solid ${C.line}`,
                                            borderRadius: m.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                                            padding: "12px 15px",
                                            fontSize: 14,
                                            lineHeight: 1.75,
                                            whiteSpace: "pre-wrap",
                                            fontWeight: m.role === "user" ? 500 : 400,
                                        }}
                                    >
                                        {m.text || (m.role === "assistant" ? <Dots /> : "")}
                                        {m.role === "assistant" && m.sources && m.sources.length > 0 && (
                                            <details style={{ marginTop: 12 }}>
                                                <summary style={{ fontSize: 11, color: C.faint, cursor: "pointer", userSelect: "none", fontFamily: MONO }}>
                                                    참고 구절 {m.sources.length}
                                                </summary>
                                                <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                                                    {m.sources.map((src, j) => (
                                                        <div
                                                            key={j}
                                                            style={{
                                                                background: C.bg,
                                                                border: `1px solid ${C.line}`,
                                                                borderRadius: 8,
                                                                padding: "8px 10px",
                                                                fontSize: 12,
                                                                lineHeight: 1.5,
                                                                color: C.dim,
                                                            }}
                                                        >
                                                            {src}
                                                        </div>
                                                    ))}
                                                </div>
                                            </details>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    <div style={{ display: "flex", gap: 10, marginTop: messages.length > 0 ? 20 : 18 }}>
                        <input
                            value={question}
                            onFocus={() => setInputFocus(true)}
                            onBlur={() => setInputFocus(false)}
                            onChange={(e) => setQuestion(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && uploaded && !asking && ask()}
                            placeholder={messages.length > 0 ? "이어서 질문하세요…" : "문서에 대해 물어보세요"}
                            disabled={!uploaded}
                            style={{
                                flex: 1,
                                background: C.field,
                                color: C.text,
                                border: `1px solid ${inputFocus ? C.accent + "88" : C.line}`,
                                borderRadius: 12,
                                padding: "13px 16px",
                                fontSize: 15,
                                fontFamily: "inherit",
                                outline: "none",
                                transition: "border-color 0.2s",
                            }}
                        />
                        <button onClick={ask} disabled={!uploaded || asking} style={primaryBtn(!uploaded || asking)}>
                            {asking ? "…" : "묻기"}
                        </button>
                    </div>
                </section>

                {error && (
                    <div style={{ color: C.err, fontSize: 13, marginTop: 16, textAlign: "center" }}>{error}</div>
                )}
            </div>

            <style>{`
        @keyframes dot { 0%, 80%, 100% { opacity: 0.3 } 40% { opacity: 1 } }
      `}</style>
        </div>
    );

    function card(): React.CSSProperties {
        return { background: C.card, border: `1px solid ${C.line}`, borderRadius: 18, padding: 26 };
    }
    function primaryBtn(disabled: boolean): React.CSSProperties {
        return {
            background: disabled ? "#242b38" : C.accent,
            color: disabled ? C.faint : C.accentInk,
            border: "none",
            borderRadius: 11,
            padding: "12px 22px",
            fontSize: 14,
            fontWeight: 600,
            fontFamily: "inherit",
            cursor: disabled ? "default" : "pointer",
            whiteSpace: "nowrap",
            transition: "background 0.15s, opacity 0.15s",
        };
    }
    function ghostBtn(disabled: boolean): React.CSSProperties {
        return {
            background: "transparent",
            color: disabled ? C.faint : C.text,
            border: `1px solid ${C.line}`,
            borderRadius: 11,
            padding: "12px 20px",
            fontSize: 14,
            fontWeight: 500,
            fontFamily: "inherit",
            cursor: disabled ? "default" : "pointer",
            display: "inline-block",
            whiteSpace: "nowrap",
        };
    }
}

// 답변 대기 중 점 3개 애니메이션
function Dots() {
    return (
        <span style={{ display: "inline-flex", gap: 4 }}>
      {[0, 1, 2].map((i) => (
          <span
              key={i}
              style={{
                  width: 5,
                  height: 5,
                  borderRadius: "50%",
                  background: "#6ee7c7",
                  animation: `dot 1.2s ${i * 0.2}s infinite`,
              }}
          />
      ))}
    </span>
    );
}

function StepLabel({ n, title, done }: { n: string; title: string; done?: boolean }) {
    return (
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <span
          style={{
              width: 26,
              height: 26,
              borderRadius: "50%",
              background: done ? "#6ee7c7" : "transparent",
              border: done ? "none" : `1.5px solid #6ee7c7`,
              color: done ? "#0a1512" : "#6ee7c7",
              fontSize: 12,
              fontWeight: 700,
              fontFamily: "'JetBrains Mono', monospace",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
          }}
      >
        {done ? "✓" : n}
      </span>
            <span style={{ fontSize: 16, fontWeight: 600 }}>{title}</span>
        </div>
    );
}