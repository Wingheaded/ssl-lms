import { Flashcard } from "@/lib/types";

type ParseCsvResult = {
    cards: Flashcard[];
    warnings: string[];
};

const HEADER_FRONT_VALUES = new Set(["front", "question", "pergunta"]);
const HEADER_BACK_VALUES = new Set(["back", "answer", "resposta"]);

function normalizeCell(value: string): string {
    return value.replace(/\r/g, "").trim();
}

function parseCsvRows(content: string): string[][] {
    const rows: string[][] = [];
    let currentRow: string[] = [];
    let currentCell = "";
    let inQuotes = false;

    for (let i = 0; i < content.length; i += 1) {
        const char = content[i];
        const nextChar = content[i + 1];

        if (char === '"') {
            if (inQuotes && nextChar === '"') {
                currentCell += '"';
                i += 1;
            } else {
                inQuotes = !inQuotes;
            }
            continue;
        }

        if (char === "," && !inQuotes) {
            currentRow.push(currentCell);
            currentCell = "";
            continue;
        }

        if ((char === "\n" || char === "\r") && !inQuotes) {
            if (char === "\r" && nextChar === "\n") {
                i += 1;
            }
            currentRow.push(currentCell);
            rows.push(currentRow);
            currentRow = [];
            currentCell = "";
            continue;
        }

        currentCell += char;
    }

    currentRow.push(currentCell);
    rows.push(currentRow);

    return rows;
}

function hasHeader(firstColumn: string, secondColumn: string): boolean {
    const normalizedFront = firstColumn.toLowerCase();
    const normalizedBack = secondColumn.toLowerCase();

    return HEADER_FRONT_VALUES.has(normalizedFront) && HEADER_BACK_VALUES.has(normalizedBack);
}

export function parseFlashcardsCsv(content: string): ParseCsvResult {
    const rows = parseCsvRows(content)
        .map((row) => row.map(normalizeCell))
        .filter((row) => row.some((cell) => cell.length > 0));

    if (rows.length === 0) {
        return {
            cards: [],
            warnings: ["O ficheiro CSV está vazio."],
        };
    }

    const startIndex = rows[0] && rows[0].length >= 2 && hasHeader(rows[0][0], rows[0][1]) ? 1 : 0;
    const cards: Flashcard[] = [];
    let skippedRows = 0;

    for (let index = startIndex; index < rows.length; index += 1) {
        const row = rows[index];
        const front = row[0] || "";
        const back = row[1] || "";

        if (!front && !back) {
            continue;
        }

        if (!front || !back) {
            skippedRows += 1;
            continue;
        }

        cards.push({
            id: cards.length + 1,
            front,
            back,
        });
    }

    const warnings: string[] = [];

    if (skippedRows > 0) {
        warnings.push(`${skippedRows} linha${skippedRows > 1 ? "s foram" : " foi"} ignorada${skippedRows > 1 ? "s" : ""} por não ter frente e verso válidos.`);
    }

    if (cards.length === 0) {
        warnings.push("Não foi possível gerar flashcards válidos a partir deste CSV.");
    }

    return { cards, warnings };
}
