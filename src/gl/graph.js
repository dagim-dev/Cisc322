// The A1 conceptual architecture as a 3D graph: eight subsystems around the
// Multiplexer, with pulses travelling along each dependency.
import * as THREE from "three";
import { architecture } from "../content.js";

const COLORS = {
  node: new THREE.Color("#a9c4ee"),
  core: new THREE.Color("#e8c468"),
  call: new THREE.Color("#e8c468"),
  config: new THREE.Color("#7fa3d8"),
  pubsub: new THREE.Color("#6fd3ff"),
  ghost: new THREE.Color("#6fd3ff"),
};
const EDGE_OPACITY = { call: 0.5, config: 0.34, pubsub: 0.95 };
const GHOST_POS = new THREE.Vector3(-2.6, 1.3, 2.6);

function dotSprite() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.35, "rgba(255,255,255,0.55)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(canvas);
}

function makeNode(radius, color) {
  const group = new THREE.Group();
  const wire = new THREE.LineSegments(
    new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(radius, 1)),
    new THREE.LineBasicMaterial({ color, transparent: true, depthWrite: false }),
  );
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 0.36, 16, 12),
    new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false }),
  );
  const hit = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 1.5, 8, 6),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  group.add(wire, core, hit);
  return { group, wire, core, hit, radius };
}

function makeEdge(a, b, ra, rb, kind, color) {
  const dir = b.clone().sub(a).normalize();
  const from = a.clone().addScaledVector(dir, ra * 1.15);
  const to = b.clone().addScaledVector(dir, -rb * 1.15);
  const geometry = new THREE.BufferGeometry().setFromPoints([from, to]);
  const dashed = kind === "config" || kind === "ghost";
  const material = dashed
    ? new THREE.LineDashedMaterial({ color, dashSize: 0.22, gapSize: 0.16, transparent: true, depthWrite: false })
    : new THREE.LineBasicMaterial({ color, transparent: true, depthWrite: false });
  const line = new THREE.Line(geometry, material);
  if (dashed) line.computeLineDistances();
  return { line, from, to };
}

export function createGraph(labelLayer) {
  const group = new THREE.Group();
  const nodes = new Map();
  const labels = [];

  for (const spec of architecture.nodes) {
    const node = makeNode(spec.core ? 0.95 : 0.44, spec.core ? COLORS.core : COLORS.node);
    node.group.position.fromArray(spec.pos);
    node.spec = spec;
    node.hit.userData.id = spec.id;
    group.add(node.group);
    nodes.set(spec.id, node);

    const label = document.createElement("div");
    label.className = `gl-label${spec.core ? " is-core" : ""}${spec.pos[0] < -1 ? " is-left" : ""}`;
    label.append(spec.label);
    const hint = document.createElement("small");
    hint.textContent = spec.hint;
    label.append(hint);
    labelLayer.append(label);
    labels.push({ el: label, node, left: spec.pos[0] < -1 });
  }

  const edges = architecture.edges.map((spec) => {
    const a = nodes.get(spec.from);
    const b = nodes.get(spec.to);
    const edge = makeEdge(a.group.position, b.group.position, a.radius, b.radius, spec.kind, COLORS[spec.kind]);
    group.add(edge.line);
    return { ...edge, spec, phase: Math.random(), speed: spec.kind === "pubsub" ? 0.55 : 0.22 + Math.random() * 0.12 };
  });

  // Pulses: one travelling point per edge, two on the publish–subscribe edge.
  const pulseEdges = edges.flatMap((edge) => (edge.spec.kind === "pubsub" ? [edge, edge] : [edge]));
  const pulsePositions = new Float32Array(pulseEdges.length * 3);
  const pulseColors = new Float32Array(pulseEdges.length * 3);
  pulseEdges.forEach((edge, i) => COLORS[edge.spec.kind].toArray(pulseColors, i * 3));
  const pulseGeometry = new THREE.BufferGeometry();
  pulseGeometry.setAttribute("position", new THREE.BufferAttribute(pulsePositions, 3));
  pulseGeometry.setAttribute("color", new THREE.BufferAttribute(pulseColors, 3));
  const pulses = new THREE.Points(
    pulseGeometry,
    new THREE.PointsMaterial({
      size: 0.34,
      map: dotSprite(),
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  pulses.frustumCulled = false;
  group.add(pulses);

  // A3: a proposed subsystem attaching to the Mux.
  const ghost = makeNode(0.5, COLORS.ghost);
  ghost.group.position.copy(GHOST_POS);
  const ghostEdge = makeEdge(GHOST_POS, nodes.get("mux").group.position, 0.5, 0.95, "ghost", COLORS.ghost);
  group.add(ghost.group, ghostEdge.line);
  const ghostLabel = document.createElement("div");
  ghostLabel.className = "gl-label is-ghost";
  ghostLabel.append("Proposed enhancement");
  const ghostHint = document.createElement("small");
  ghostHint.textContent = "A3 · to be defined";
  ghostLabel.append(ghostHint);
  labelLayer.append(ghostLabel);

  const hitTargets = [...nodes.values()].map((node) => node.hit);
  const world = new THREE.Vector3();
  let hovered = null;

  function placeLabel(el, object, radius, camera, width, height, opacity, left = false) {
    object.getWorldPosition(world);
    world.project(camera);
    const visible = world.z < 1 && opacity > 0.02;
    el.style.opacity = visible ? opacity.toFixed(3) : "0";
    if (!visible) return;
    const side = left ? -1 : 1;
    const x = (world.x * 0.5 + 0.5) * width + side * radius * 26;
    const y = (-world.y * 0.5 + 0.5) * height - 16;
    el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)${left ? " translateX(-100%)" : ""}`;
  }

  return {
    group,
    hitTargets,
    setHovered(id) {
      if (id === hovered) return;
      hovered = id;
      for (const { el, node } of labels) el.classList.toggle("is-hot", node.spec.id === id);
    },
    // lit: 1 = live graph (A1), near 0 = dim wireframe (A2, A3).
    // ghost: 0..1, how present the A3 node is. vis: 0..1 overall fade.
    update({ time, lit, ghost: ghostAmount, vis, camera, width, height, showLabels }) {
      const level = 0.16 + 0.84 * lit;
      let i = 0;
      for (const node of nodes.values()) {
        const flicker = lit < 0.5 && Math.sin(time * 19 + i * 3.1) * Math.sin(time * 6.7 + i) > 0.55 ? 0.35 : 1;
        const hot = hovered === node.spec.id ? 1.6 : 1;
        node.wire.material.opacity = Math.min(1, 0.6 * level * flicker * hot) * vis;
        node.core.material.opacity = lit * vis;
        node.wire.rotation.y = time * (0.12 + i * 0.013);
        node.wire.rotation.x = time * 0.07;
        const pulse = node.spec.core ? 1 + Math.sin(time * 1.6) * 0.04 * lit : 1;
        node.group.scale.setScalar(pulse * (hot > 1 ? 1.12 : 1));
        i++;
      }

      for (const edge of edges) {
        const related = !hovered || edge.spec.from === hovered || edge.spec.to === hovered;
        const base = EDGE_OPACITY[edge.spec.kind] * level * vis;
        edge.line.material.opacity = related ? (hovered ? Math.min(1, base * 1.8) : base) : base * 0.18;
      }

      pulseEdges.forEach((edge, index) => {
        const t = (time * edge.speed + edge.phase + (index % 2) * 0.5) % 1;
        pulsePositions[index * 3] = edge.from.x + (edge.to.x - edge.from.x) * t;
        pulsePositions[index * 3 + 1] = edge.from.y + (edge.to.y - edge.from.y) * t;
        pulsePositions[index * 3 + 2] = edge.from.z + (edge.to.z - edge.from.z) * t;
      });
      pulseGeometry.attributes.position.needsUpdate = true;
      pulses.material.opacity = lit * vis;

      const breathe = 0.65 + 0.35 * Math.sin(time * 2.4);
      ghost.wire.material.opacity = ghostAmount * breathe * vis;
      ghost.core.material.opacity = ghostAmount * 0.8 * vis;
      ghost.wire.rotation.y = -time * 0.3;
      ghost.group.scale.setScalar(0.6 + 0.4 * ghostAmount);
      ghostEdge.line.material.opacity = ghostAmount * 0.8 * vis;

      const labelLevel = showLabels ? vis * Math.max(0, (lit - 0.45) / 0.55) : 0;
      for (const { el, node, left } of labels) {
        const dim = hovered && hovered !== node.spec.id ? 0.45 : 1;
        placeLabel(el, node.group, node.radius, camera, width, height, labelLevel * dim, left);
      }
      placeLabel(ghostLabel, ghost.group, 0.5, camera, width, height, showLabels ? ghostAmount * vis : 0);
    },
  };
}
