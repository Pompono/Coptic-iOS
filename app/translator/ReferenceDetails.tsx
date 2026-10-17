import AppIcon from "../AppIcon";

export default function ReferenceDetails({ text, row }: { text?: string; row?: string }) {
  if (!text) return null;
  return <details className="mt-3 text-sm"><summary className="disclosure-summary">Matched Coptic and source<span className="disclosure-chevron"><AppIcon name="chevron" size={16}/></span></summary>
    <p className="coptic-text mt-2">{text}</p>
    <p className="mt-2">Coptic Corpora / Tasbeha · {row} · CC-BY-4.0</p>
    <a href="https://huggingface.co/datasets/megalaa/coptic-corpora" target="_blank" rel="noreferrer">View source corpus</a>
  </details>;
}
