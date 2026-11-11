// Full-screen overlay for the presentation video and the report PDF.
// Links keep their real href, so they still work if this script fails.
export function initTheatre({ onOpen, onClose } = {}) {
  const dialog = document.getElementById("theatre");
  if (!dialog?.showModal) return;
  const body = dialog.querySelector(".theatre-body");
  const title = dialog.querySelector(".theatre-title");
  // Phones and tablets cannot show a PDF inside a frame; let those open it natively.
  const coarse = window.matchMedia("(pointer: coarse)").matches;

  document.addEventListener("click", (event) => {
    const link = event.target.closest("a[data-theatre]");
    if (!link || event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    const kind = link.dataset.theatre;
    if (kind === "pdf" && coarse) return;
    event.preventDefault();

    let media;
    if (kind === "video") {
      media = document.createElement("video");
      media.controls = true;
      media.autoplay = true;
      media.playsInline = true;
    } else {
      media = document.createElement("iframe");
      media.title = link.dataset.title || "Report";
    }
    media.src = link.href;
    title.textContent = link.dataset.title || "";
    body.replaceChildren(media);
    dialog.showModal();
    onOpen?.();
  });

  dialog.querySelector(".theatre-close").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener("close", () => {
    body.replaceChildren();
    onClose?.();
  });
}
