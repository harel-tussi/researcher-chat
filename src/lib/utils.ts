import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export async function readJsonStream<T>(
  reader: ReadableStreamDefaultReader,
  abortController: AbortController,
  onChunkRead: (chunk: T) => void
) {
  async function read() {
    const { done, value } = await reader.read();
    if (done || abortController.signal.aborted) {
      return;
    }

    const decoded = new TextDecoder().decode(value);

    // Split by newlines in case multiple chunks arrived together
    const chunks = decoded.split("\n").filter(Boolean);

    for (const chunk of chunks) {
      if (abortController.signal.aborted) {
        return;
      }

      try {
        const json = JSON.parse(chunk) as T;
        onChunkRead(json);
      } catch (err) {
        console.error("Failed to parse chunk:", err);
      }
    }

    return read();
  }

  await read();
}
