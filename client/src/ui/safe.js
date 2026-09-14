export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
}

export function setText(element, value) {
  if (element) element.textContent = String(value ?? "");
  return element;
}

export function appendText(element, value) {
  if (element) element.append(document.createTextNode(String(value ?? "")));
  return element;
}
