export function FileIcon({ filename }: { filename: string }) {
  const extension = filename.trim().split(".").pop()?.toLowerCase();
  const type = extension === "pdf" ? "pdf" : extension === "docx" || extension === "doc" ? "word" : extension === "txt" ? "txt" : "file";

  return <svg className="upload-file-icon" data-file-type={type} viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z" />
    <path d="M14 3v6h6" />
    {type === "pdf" && <text x="12" y="16.5" textAnchor="middle" fill="currentColor" stroke="none" fontFamily="var(--font-body)" fontSize="5.3" fontWeight="700">PDF</text>}
    {type === "word" && <path d="m7 13 2 5 3-5 3 5 2-5" />}
    {type === "txt" && <path d="M8 12h5M8 15h8M8 18h6" />}
    {type === "file" && <path d="M8 13h8M8 17h5" />}
  </svg>;
}
