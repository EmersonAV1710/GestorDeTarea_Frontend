export function FileIcon({ filename }: { filename: string }) {
  const extension = filename.trim().split(".").pop()?.toLowerCase();
  const type = extension === "pdf" ? "pdf" : extension === "docx" || extension === "doc" ? "word" : extension === "txt" ? "txt" : "file";
  const icon = type === "pdf" ? "/file-icons/pdf-file-type-svgrepo-com.svg"
    : type === "word" ? "/file-icons/word-file-type-svgrepo-com.svg"
    : type === "txt" ? "/file-icons/txt-file-type-svgrepo-com.svg" : null;

  return <span className="upload-file-icon" data-file-type={type} aria-hidden="true">
    {icon ? <img src={icon} width="44" height="44" alt="" /> : <>
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" focusable="false">
        <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z" />
        <path d="M14 3v6h6M8 13h8M8 16h5" />
      </svg>
      <span className="upload-file-format">FILE</span>
    </>}
  </span>;
}
