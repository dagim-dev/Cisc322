// Builds the statement, team panels and assignment stations from src/content.js.
import { site, team, assignments, isLive } from "./content.js";

const ROLE_LABEL = { leader: "group leader", presenter: "presenter" };
const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
const word = (n) => WORDS[n] ?? String(n);
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const pad = (n) => String(n).padStart(2, "0");

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === null || value === undefined || value === false) continue;
    if (key === "text") node.textContent = value;
    else if (key === "class") node.className = value;
    else if (key === "style") node.style.cssText = value;
    else node.setAttribute(key, value === true ? "" : value);
  }
  for (const child of [].concat(children)) if (child) node.append(child);
  return node;
}

function member(person, index) {
  const role = person.role ? ROLE_LABEL[person.role] : "member";
  return el("li", { class: `panel member member--${person.role || "member"}` }, [
    el("p", { class: "member-index mono", "aria-hidden": "true" }, [
      el("span", { text: pad(index + 1) }),
      ` / ${pad(team.length)}`,
    ]),
    el("h3", { class: "member-name display", text: person.name }),
    el("p", { class: "member-role mono" }, [el("i", { "aria-hidden": "true" }), role]),
  ]);
}

function action(label, href, { primary = false, theatre = null, title = "", download = false, quiet = false, portal = null } = {}) {
  if (!href) return null;
  return el("a", {
    class: `action${primary ? " action--primary" : ""}${quiet ? " action--quiet" : ""}`,
    href,
    download,
    target: download ? null : "_blank",
    rel: download ? null : "noopener",
    "data-theatre": theatre,
    "data-title": theatre ? title : null,
    "data-portal": portal,
    "data-magnetic": quiet ? null : true,
  }, [el("span", { text: label })]);
}

function station(item, index) {
  const live = isLive(item);
  const actions = live
    ? el("div", { class: "actions" }, [
        action("Watch", item.video, {
          primary: true,
          theatre: "video",
          title: `${item.badge} presentation — ${item.title}`,
          portal: index,
        }),
        action("Read report", item.report, {
          theatre: "pdf",
          title: `${item.badge} report — ${item.title}`,
          portal: index,
        }),
        action(item.slides?.label || "Slides", item.slides?.href, { download: true }),
        action("download video", item.video, { download: true, quiet: true }),
      ])
    : null;

  const poster = item.poster
    ? el("img", { src: item.poster, alt: `Title slide of the ${item.badge} presentation`, loading: "lazy" })
    : el("span", { class: "station-static", "aria-hidden": "true" });

  return el(
    "article",
    {
      id: item.id,
      class: `station${live ? " station--live" : " station--pending"}`,
      style: `--tint: ${item.tint}`,
      "data-station": index,
    },
    [
      el("div", { class: "station-text" }, [
        el("p", { class: "station-meta mono" }, [
          el("span", { class: "badge", text: item.badge }),
          el("span", { class: "state" }, [el("i", { "aria-hidden": "true" }), live ? "live" : "transmission pending"]),
        ]),
        el("h3", { class: "station-title display", text: item.title }),
        el("p", { class: "station-summary", text: item.summary }),
        actions,
      ]),
      el("figure", { class: "station-poster", "aria-hidden": item.poster ? null : "true" }, poster),
    ],
  );
}

export function renderContent() {
  for (const node of document.querySelectorAll("[data-site]")) {
    node.textContent = site[node.dataset.site] ?? node.textContent;
  }

  const statement = document.querySelector("[data-statement]");
  const lines = [
    `${cap(word(team.length))} of us.`,
    "One terminal.",
    `${cap(word(assignments.length))} deliverables.`,
  ];
  statement.replaceChildren(
    ...lines.map((line, i) => el("span", { class: `statement-line${i === 1 ? " is-accent" : ""}`, text: line })),
  );

  document.querySelector("[data-team]").replaceChildren(...team.map(member));
  document.querySelector("[data-assignments]").replaceChildren(...assignments.map(station));
}
