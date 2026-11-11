// Builds the team panes and assignment cards from src/content.js.
import { site, team, assignments } from "./content.js";

const ROLE_LABEL = { leader: "group leader", presenter: "presenter" };

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === null || value === undefined || value === false) continue;
    if (key === "text") node.textContent = value;
    else if (key === "class") node.className = value;
    else node.setAttribute(key, value === true ? "" : value);
  }
  for (const child of [].concat(children)) if (child) node.append(child);
  return node;
}

function pane(member, index) {
  const role = member.role ? ROLE_LABEL[member.role] : "member";
  return el("li", { class: `pane${member.role ? ` pane--${member.role}` : ""}` }, [
    el("p", { class: "pane-head" }, [
      el("span", { text: `pane ${index + 1}`, "aria-hidden": "true" }),
      el("span", { class: "pane-role", text: role }),
    ]),
    el("div", {}, [
      el("p", { class: "pane-name", text: member.name }),
      el("p", { class: "pane-prompt", "aria-hidden": "true" }, [
        el("b", { text: "~ $ " }),
        `whoami → ${member.name.toLowerCase()}`,
      ]),
    ]),
  ]);
}

function action(label, href, { primary = false, theatre = null, title = "", download = false } = {}) {
  const pending = !href;
  return el("a", {
    class: `btn${primary ? " btn--primary" : ""}`,
    href: href || "#",
    text: label,
    "aria-disabled": pending ? "true" : null,
    tabindex: pending ? "-1" : null,
    download: !pending && download,
    target: !pending && !download ? "_blank" : null,
    rel: !pending && !download ? "noopener" : null,
    "data-theatre": !pending ? theatre : null,
    "data-title": !pending && theatre ? title : null,
  });
}

function station(item, index) {
  const live = Boolean(item.report || item.slides || item.video);
  const actions = [
    action("Report (PDF)", item.report, {
      primary: true,
      theatre: "pdf",
      title: `${item.badge} report — ${item.title}`,
    }),
    action(item.slides?.label || "Slides", item.slides?.href, { download: true }),
    action("Video", item.video, {
      theatre: "video",
      title: `${item.badge} presentation — ${item.title}`,
    }),
  ];
  if (item.video) actions.push(action("Download video", item.video, { download: true }));

  const legend =
    index === 0
      ? el("ul", { class: "legend", "aria-label": "How to read the architecture graph" }, [
          el("li", {}, [el("i"), "procedural call"]),
          el("li", { class: "is-config" }, [el("i"), "configuration injection"]),
          el("li", { class: "is-pubsub" }, [el("i"), "publish–subscribe notification"]),
        ])
      : null;

  return el(
    "article",
    { id: item.id, class: `station${live ? "" : " station--pending"}`, "data-station": index },
    el("div", { class: "wrap" }, [
      el("div", { class: "card" }, [
        el("p", { class: "card-top" }, [
          el("span", { class: "badge", text: item.badge }),
          el("span", { class: "state", text: live ? "live" : "awaiting signal" }),
        ]),
        el("h3", { class: "card-title", text: item.title }),
        el("p", { class: "card-desc", text: item.summary }),
        el("div", { class: "actions" }, actions),
        legend,
      ]),
    ]),
  );
}

export function renderContent() {
  for (const node of document.querySelectorAll("[data-site]")) {
    node.textContent = site[node.dataset.site] ?? node.textContent;
  }
  document.querySelector("[data-team]").replaceChildren(...team.map(pane));
  document.querySelector("[data-assignments]").replaceChildren(...assignments.map(station));
  const name = document.querySelector(".mux-name");
  if (name) name.textContent = `${site.group.toLowerCase()} — mux — ${team.length} panes`;
}
