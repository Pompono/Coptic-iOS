import { NextResponse } from "next/server";
import { spawn } from "node:child_process";
import path from "node:path";

type Dialect = "sahidic" | "bohairic";

type TranslateRequest = {
  text?: string;
  dialect?: Dialect;
  includeConfidence?: boolean;
};

type PythonResult = {
  translation: string;
  confidence?: number;
  dialect?: Dialect;
};


function toDialect(value: unknown, fallback: Dialect): Dialect {
  if (value === "bohairic") return "bohairic";
  if (value === "sahidic") return "sahidic";
  return fallback;
}

function runTranslatorCLI(args: string[]): Promise<{ stdout: string; stderr: string; code: number | null }> {
  const pythonBin = process.env.COPTIC_TRANSLATOR_PYTHON_BIN || (process.platform === "win32" ? path.join(process.env.LOCALAPPDATA || path.join(process.env.USERPROFILE || "", "AppData", "Local"), "Programs", "Python", "Python312", "python.exe") : "python3");
  const scriptPath = path.join(process.cwd(), "translator", "english_coptic_cli.py");

  return new Promise((resolve, reject) => {
    const proc = spawn(pythonBin, [scriptPath, ...args], {
      cwd: process.cwd(),
      env: process.env,
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    proc.on("error", (error) => reject(error));
    proc.on("close", (code) => resolve({ stdout, stderr, code }));
  });
}

export async function POST(request: Request) {
  let input: TranslateRequest;
  try {
    input = (await request.json()) as TranslateRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const text = (input.text ?? "").toString().trim();
  if (!text) {
    return NextResponse.json({ error: "Please provide text." }, { status: 400 });
  }

  const defaultDialect = toDialect(process.env.ENGLISH_COPTIC_TRANSLATOR_DEFAULT_DIALECT, "bohairic");
  const dialect = toDialect(input.dialect, defaultDialect);
  const includeConfidence = Boolean(input.includeConfidence);
  const cliArgs = [text, "--dialect", dialect];
  if (includeConfidence) cliArgs.push("--include-confidence");
  if (process.env.ENGLISH_COPTIC_TRANSLATOR_MODEL) {
    cliArgs.push("--model", process.env.ENGLISH_COPTIC_TRANSLATOR_MODEL);
  }

  try {
    const { stdout, stderr, code } = await runTranslatorCLI(cliArgs);

    if (code !== 0) {
      return NextResponse.json(
        {
          error: "Translator subprocess failed.",
          details: stderr.trim() || "No stderr output.",
        },
        { status: code === 2 ? 400 : 502 }
      );
    }

    const parsed = JSON.parse(stdout) as PythonResult;
    if (!parsed || typeof parsed.translation !== "string" || !parsed.translation.trim()) {
      return NextResponse.json(
        { error: "Translator did not return a valid translation." },
        { status: 502 }
      );
    }

    const response: PythonResult = {
      translation: parsed.translation,
      dialect: toDialect(parsed.dialect, dialect),
    };

    if (typeof parsed.confidence === "number") {
      response.confidence = Number(parsed.confidence);
    }

    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Unable to run translator subprocess.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 502 }
    );
  }
}
