/**
 * A hundred lines instead of a framework.
 *
 * The frontend has to run with no build step: it is served out of Cache Storage
 * by a Service Worker in the hosted case, and there is no bundler in a browser
 * tab to turn JSX into anything. So the components below are functions that
 * return DOM nodes, and rendering a screen means replacing a subtree.
 *
 * The screens themselves are still drawn from the Application Dictionary rather
 * than written per entity — that is the part worth keeping, and it is
 * independent of which library draws them.
 */

/** `el("div.card", { onclick }, child, child)` */
export function el(spec, props = null, ...children) {
  const [tag, ...classes] = String(spec).split(".");
  const node = document.createElement(tag || "div");
  if (classes.length) node.className = classes.join(" ");

  if (props && (props.nodeType || Array.isArray(props) || typeof props === "string")) {
    children.unshift(props);
    props = null;
  }

  for (const [key, value] of Object.entries(props || {})) {
    if (value == null || value === false) continue;
    if (key === "class") node.className = `${node.className} ${value}`.trim();
    else if (key === "style" && typeof value === "object") Object.assign(node.style, value);
    else if (key === "html") node.innerHTML = value;
    else if (key.startsWith("on") && typeof value === "function") {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key === "value" || key === "checked" || key === "disabled") node[key] = value;
    else node.setAttribute(key, value === true ? "" : value);
  }

  for (const child of children.flat(Infinity)) {
    if (child == null || child === false) continue;
    node.appendChild(child.nodeType ? child : document.createTextNode(String(child)));
  }
  return node;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

export function mount(node, ...children) {
  clear(node);
  for (const child of children.flat(Infinity)) {
    if (child == null || child === false) continue;
    node.appendChild(child.nodeType ? child : document.createTextNode(String(child)));
  }
  return node;
}

/** Transient message. Errors stay until dismissed; successes fade. */
export function toast(message, tone = "info") {
  let tray = document.querySelector(".toasts");
  if (!tray) {
    tray = el("div.toasts");
    document.body.appendChild(tray);
  }
  const node = el(
    `div.toast.toast--${tone}`,
    el("div.toast__body", message),
    el("button.toast__close", { onclick: () => node.remove(), "aria-label": "Dismiss" }, "×")
  );
  tray.appendChild(node);
  if (tone !== "error") setTimeout(() => node.remove(), 4000);
  return node;
}

export function spinner(label = "Loading") {
  return el("div.spinner", el("div.spinner__dot"), el("span", label));
}

export function empty(title, detail) {
  return el("div.empty", el("h3", title), detail ? el("p", detail) : null);
}

/** Format a value for a grid cell, using what the dictionary says it is. */
export function displayValue(value, field) {
  if (value == null || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (field && field.field_type === "date") return String(value).slice(0, 10);
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    return new Date(value).toLocaleString();
  }
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export const escapeHtml = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (character) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]
  );
