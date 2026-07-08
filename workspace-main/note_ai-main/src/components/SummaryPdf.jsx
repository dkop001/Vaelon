import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

const ACCENT = "#7c3aed";
const GRAY = "#888";
const LIGHT_GRAY = "#e0e0e0";

const styles = StyleSheet.create({
  page: {
    paddingTop: 48,
    paddingBottom: 52,
    paddingHorizontal: 44,
    fontSize: 10.5,
    fontFamily: "Helvetica",
    lineHeight: 1.65,
    backgroundColor: "#ffffff",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 22,
    paddingBottom: 12,
    borderBottom: `1.5px solid ${LIGHT_GRAY}`,
  },
  wordmark: {
    fontSize: 15,
    fontFamily: "Helvetica-Bold",
    color: ACCENT,
    letterSpacing: 0.5,
  },
  headerRight: {
    fontSize: 8.5,
    color: GRAY,
    textAlign: "right",
    lineHeight: 1.5,
  },
  h1: {
    fontSize: 17,
    fontFamily: "Helvetica-Bold",
    marginTop: 18,
    marginBottom: 9,
    color: "#1a1a2e",
  },
  h2: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    marginTop: 14,
    marginBottom: 6,
    color: "#1a1a2e",
    borderBottom: `0.5px solid ${LIGHT_GRAY}`,
    paddingBottom: 3,
  },
  h3: {
    fontSize: 11.5,
    fontFamily: "Helvetica-Bold",
    marginTop: 10,
    marginBottom: 5,
    color: "#2d2d4a",
  },
  paragraph: {
    fontSize: 10.5,
    marginBottom: 7,
    lineHeight: 1.65,
    color: "#1a1a2e",
  },
  bulletRow: {
    flexDirection: "row",
    marginBottom: 4,
    paddingLeft: 8,
  },
  bulletDot: {
    width: 14,
    fontSize: 10.5,
    color: ACCENT,
    marginTop: 1,
  },
  bulletText: {
    flex: 1,
    fontSize: 10.5,
    lineHeight: 1.65,
    color: "#1a1a2e",
  },
  codeBlock: {
    backgroundColor: "#f4f4f8",
    borderRadius: 4,
    padding: 8,
    marginBottom: 7,
    fontFamily: "Courier",
    fontSize: 9,
    color: "#333",
    borderLeft: `3px solid ${ACCENT}`,
  },
  blockquote: {
    borderLeft: `3px solid ${ACCENT}`,
    paddingLeft: 10,
    marginVertical: 6,
    color: "#555",
    fontFamily: "Helvetica-Oblique",
    fontSize: 10.5,
  },
  divider: {
    borderTop: `0.75px solid ${LIGHT_GRAY}`,
    marginVertical: 10,
  },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 44,
    right: 44,
    textAlign: "center",
    fontSize: 8,
    color: "#aaa",
    borderTop: `0.75px solid ${LIGHT_GRAY}`,
    paddingTop: 7,
  },
});

/**
 * Parse markdown into element descriptors.
 * Supports: # H1, ## H2, ### H3, - bullets, * bullets, > blockquote,
 *           ``` code blocks, --- dividers, plain paragraphs.
 */
const parseMarkdown = (text) => {
  const lines = text.split("\n");
  const elements = [];
  let i = 0;
  let inCodeBlock = false;
  let codeLines = [];

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Code block toggle
    if (trimmed.startsWith("```")) {
      if (inCodeBlock) {
        elements.push({ type: "code", text: codeLines.join("\n") });
        codeLines = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      i++;
      continue;
    }
    if (inCodeBlock) {
      codeLines.push(line);
      i++;
      continue;
    }

    if (trimmed.startsWith("### ")) {
      elements.push({ type: "h3", text: trimmed.slice(4) });
    } else if (trimmed.startsWith("## ")) {
      elements.push({ type: "h2", text: trimmed.slice(3) });
    } else if (trimmed.startsWith("# ")) {
      elements.push({ type: "h1", text: trimmed.slice(2) });
    } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      elements.push({ type: "bullet", text: trimmed.slice(2) });
    } else if (trimmed.startsWith("> ")) {
      elements.push({ type: "blockquote", text: trimmed.slice(2) });
    } else if (trimmed === "---" || trimmed === "***") {
      elements.push({ type: "divider" });
    } else if (trimmed) {
      elements.push({ type: "paragraph", text: trimmed });
    }
    i++;
  }

  // Flush any unclosed code block
  if (inCodeBlock && codeLines.length > 0) {
    elements.push({ type: "code", text: codeLines.join("\n") });
  }

  return elements;
};

/** Strip inline markdown from text for PDF rendering (bold **, italic *, inline code `) */
const stripInline = (text = "") =>
  text
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/`(.*?)`/g, "$1");

const SummaryPdf = ({ summary, title }) => {
  const date = new Date().toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const parsed = parseMarkdown(summary);

  return (
    <Document
      author="note_ai"
      title={title || "Summary"}
      keywords="AI, summary, notes"
    >
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header} fixed>
          <Text style={styles.wordmark}>note_ai</Text>
          <Text style={styles.headerRight}>
            {title || "Summary"}{"\n"}{date}
          </Text>
        </View>

        {/* Content */}
        {parsed.map((el, idx) => {
          switch (el.type) {
            case "h1":
              return <Text key={idx} style={styles.h1}>{stripInline(el.text)}</Text>;
            case "h2":
              return <Text key={idx} style={styles.h2}>{stripInline(el.text)}</Text>;
            case "h3":
              return <Text key={idx} style={styles.h3}>{stripInline(el.text)}</Text>;
            case "bullet":
              return (
                <View key={idx} style={styles.bulletRow}>
                  <Text style={styles.bulletDot}>›</Text>
                  <Text style={styles.bulletText}>{stripInline(el.text)}</Text>
                </View>
              );
            case "blockquote":
              return <Text key={idx} style={styles.blockquote}>{stripInline(el.text)}</Text>;
            case "code":
              return <Text key={idx} style={styles.codeBlock}>{el.text}</Text>;
            case "divider":
              return <View key={idx} style={styles.divider} />;
            default:
              return <Text key={idx} style={styles.paragraph}>{stripInline(el.text)}</Text>;
          }
        })}

        {/* Footer */}
        <Text
          style={styles.footer}
          render={({ pageNumber, totalPages }) =>
            `Page ${pageNumber} of ${totalPages}  ·  Generated by note_ai`
          }
          fixed
        />
      </Page>
    </Document>
  );
};

export default SummaryPdf;
