/**
 * Specter Dashboard Application
 *
 * Interactive visualization of codebase knowledge graph.
 */

// Global state
let cy = null;
let currentLayout = 'cose';

// Color by complexity
function getComplexityColor(complexity) {
  if (complexity <= 5) return '#22c55e'; // green
  if (complexity <= 10) return '#f59e0b'; // yellow
  if (complexity <= 20) return '#f97316'; // orange
  return '#ef4444'; // red
}

// Get complexity level name
function getComplexityLevel(complexity) {
  if (complexity <= 5) return 'low';
  if (complexity <= 10) return 'medium';
  if (complexity <= 20) return 'high';
  return 'critical';
}

// Get node shape by type
function getNodeShape(type) {
  switch (type) {
    case 'file':
      return 'round-rectangle';
    case 'class':
      return 'diamond';
    case 'interface':
      return 'hexagon';
    case 'function':
      return 'ellipse';
    default:
      return 'ellipse';
  }
}

// Initialize Cytoscape graph
async function initGraph() {
  try {
    const response = await fetch('/api/graph');
    if (!response.ok) {
      document.getElementById('cy').innerHTML =
        '<div class="error">No graph found. Run `specter scan` first.</div>';
      return;
    }
    const data = await response.json();

    cy = cytoscape({
      container: document.getElementById('cy'),
      elements: [...data.nodes, ...data.edges],
      style: [
        {
          selector: 'node',
          style: {
            'background-color': (ele) => getComplexityColor(ele.data('complexity')),
            label: 'data(label)',
            'font-size': '9px',
            'text-valign': 'bottom',
            'text-halign': 'center',
            'text-margin-y': '6px',
            color: '#a0a0b0',
            'text-outline-color': '#0f0f1a',
            'text-outline-width': '2px',
            width: (ele) => {
              const c = ele.data('complexity');
              return Math.max(15, Math.min(50, 12 + c * 1.5));
            },
            height: (ele) => {
              const c = ele.data('complexity');
              return Math.max(15, Math.min(50, 12 + c * 1.5));
            },
            shape: (ele) => getNodeShape(ele.data('type')),
            'border-width': 1,
            'border-color': '#2a2a40',
          },
        },
        {
          selector: 'node[type="file"]',
          style: {
            'background-opacity': 0.8,
            'font-size': '10px',
            'font-weight': 'bold',
          },
        },
        {
          selector: 'edge',
          style: {
            width: 1,
            'line-color': '#3a3a50',
            'curve-style': 'bezier',
            'target-arrow-shape': 'triangle',
            'target-arrow-color': '#3a3a50',
            'arrow-scale': 0.7,
            opacity: 0.5,
          },
        },
        {
          selector: 'edge[type="imports"]',
          style: {
            'line-color': '#8b5cf6',
            'target-arrow-color': '#8b5cf6',
          },
        },
        {
          selector: 'edge[type="calls"]',
          style: {
            'line-color': '#06b6d4',
            'target-arrow-color': '#06b6d4',
            'line-style': 'dashed',
          },
        },
        {
          selector: 'edge[type="extends"]',
          style: {
            'line-color': '#ec4899',
            'target-arrow-color': '#ec4899',
          },
        },
        {
          selector: 'node.highlighted',
          style: {
            'border-width': 3,
            'border-color': '#8b5cf6',
            'z-index': 999,
          },
        },
        {
          selector: 'node.faded',
          style: {
            opacity: 0.2,
          },
        },
        {
          selector: 'edge.faded',
          style: {
            opacity: 0.1,
          },
        },
        {
          selector: 'node.selected',
          style: {
            'border-width': 3,
            'border-color': '#ec4899',
          },
        },
      ],
      layout: {
        name: 'cose',
        idealEdgeLength: 80,
        nodeRepulsion: 5000,
        nodeOverlap: 20,
        animate: false,
        randomize: false,
      },
      minZoom: 0.1,
      maxZoom: 3,
    });

    // Node click handler
    cy.on('tap', 'node', (evt) => {
      const node = evt.target;
      showNodeDetails(node.data(), node);

      // Highlight selected node
      cy.nodes().removeClass('selected');
      node.addClass('selected');
    });

    // Background click clears selection
    cy.on('tap', (evt) => {
      if (evt.target === cy) {
        cy.nodes().removeClass('selected');
        document.getElementById('details-content').innerHTML =
          '<p class="hint">Click a node to see details</p>';
      }
    });

    // Hover effects
    cy.on('mouseover', 'node', (evt) => {
      const node = evt.target;
      node.addClass('highlighted');

      // Show connected edges more prominently
      const connected = node.connectedEdges();
      connected.style('opacity', 0.8);
    });

    cy.on('mouseout', 'node', (evt) => {
      const node = evt.target;
      node.removeClass('highlighted');
      cy.edges().style('opacity', 0.5);
    });
  } catch (error) {
    console.error('Failed to load graph:', error);
    document.getElementById('cy').innerHTML = '<div class="error">Failed to load graph data.</div>';
  }
}

// Helper to create detail item safely using DOM APIs (prevents XSS)
function createDetailItem(labelText, valueText, valueClass) {
  const item = document.createElement('div');
  item.className = 'detail-item';

  const label = document.createElement('span');
  label.className = 'label';
  label.textContent = labelText;

  const value = document.createElement('span');
  value.className = valueClass ? `value ${valueClass}` : 'value';
  value.textContent = valueText;

  item.appendChild(label);
  item.appendChild(value);
  return item;
}

// Helper to create connection item safely (prevents XSS)
function createConnectionItem(id, type, label, direction) {
  const item = document.createElement('div');
  item.className = 'connection-item';
  item.dataset.id = id;

  const typeSpan = document.createElement('span');
  typeSpan.style.color = '#8b5cf6';
  typeSpan.textContent = type;

  item.appendChild(typeSpan);
  item.appendChild(document.createTextNode(` ${direction} `));

  const labelSpan = document.createTextNode(label);
  item.appendChild(labelSpan);

  return item;
}

// Show node details in side panel
function showNodeDetails(data, node) {
  const level = getComplexityLevel(data.complexity);
  const connections = node.connectedEdges();
  const incoming = connections.filter((e) => e.target().id() === node.id());
  const outgoing = connections.filter((e) => e.source().id() === node.id());

  const panel = document.getElementById('details-content');
  panel.innerHTML = ''; // Clear previous content

  // Add detail items using safe DOM manipulation
  panel.appendChild(createDetailItem('Name', data.label));
  panel.appendChild(createDetailItem('Type', data.type));
  panel.appendChild(createDetailItem('File', data.filePath));
  panel.appendChild(createDetailItem('Complexity', `${data.complexity} (${level})`, level));
  panel.appendChild(createDetailItem('Lines', `${data.lineStart} - ${data.lineEnd}`));

  // Add connections if any
  if (incoming.length > 0 || outgoing.length > 0) {
    const connectionsDiv = document.createElement('div');
    connectionsDiv.className = 'connections-list';

    if (incoming.length > 0) {
      const h3 = document.createElement('h3');
      h3.textContent = `Incoming (${incoming.length})`;
      connectionsDiv.appendChild(h3);

      incoming.forEach((e) => {
        const source = e.source().data();
        const item = createConnectionItem(source.id, e.data('type'), source.label, 'from');
        item.addEventListener('click', () => navigateToNode(source.id));
        connectionsDiv.appendChild(item);
      });
    }

    if (outgoing.length > 0) {
      const h3 = document.createElement('h3');
      h3.textContent = `Outgoing (${outgoing.length})`;
      connectionsDiv.appendChild(h3);

      outgoing.forEach((e) => {
        const target = e.target().data();
        const item = createConnectionItem(target.id, e.data('type'), target.label, 'to');
        item.addEventListener('click', () => navigateToNode(target.id));
        connectionsDiv.appendChild(item);
      });
    }

    panel.appendChild(connectionsDiv);
  }
}

// Navigate to a node by ID
function navigateToNode(id) {
  const targetNode = cy.getElementById(id);
  if (targetNode.length > 0) {
    cy.animate(
      {
        center: { eles: targetNode },
        zoom: 1.5,
      },
      { duration: 300 }
    );
    showNodeDetails(targetNode.data(), targetNode);
    cy.nodes().removeClass('selected');
    targetNode.addClass('selected');
  }
}

// Load summary
async function loadSummary() {
  try {
    const response = await fetch('/api/summary');
    if (!response.ok) {
      document.getElementById('summary-content').innerHTML =
        '<div class="error">Failed to load summary</div>';
      return;
    }
    const data = await response.json();
    document.getElementById('summary-content').innerHTML =
      '<div class="stat-grid">' +
      '<div class="stat">' +
      '<span class="stat-value">' +
      data.stats.files +
      '</span>' +
      '<span class="stat-label">Files</span>' +
      '</div>' +
      '<div class="stat">' +
      '<span class="stat-value">' +
      data.stats.lines.toLocaleString() +
      '</span>' +
      '<span class="stat-label">Lines</span>' +
      '</div>' +
      '<div class="stat">' +
      '<span class="stat-value">' +
      data.stats.functions +
      '</span>' +
      '<span class="stat-label">Functions</span>' +
      '</div>' +
      '<div class="stat">' +
      '<span class="stat-value">' +
      data.stats.classes +
      '</span>' +
      '<span class="stat-label">Classes</span>' +
      '</div>' +
      '</div>';
  } catch (error) {
    console.error('Failed to load summary:', error);
    document.getElementById('summary-content').innerHTML =
      '<div class="error">Failed to load summary</div>';
  }
}

// Load health
async function loadHealth() {
  try {
    const response = await fetch('/api/health');
    if (!response.ok) return;
    const data = await response.json();

    const badge = document.getElementById('health-badge');
    badge.querySelector('.grade').textContent = data.grade;
    badge.querySelector('.score').textContent = `${data.score}/100`;

    // Set grade class for coloring
    badge.className = `health-badge grade-${data.grade.toLowerCase()}`;
  } catch (error) {
    console.error('Failed to load health:', error);
  }
}

// Helper to create hotspot item safely (prevents XSS)
function createHotspotItem(filePath, name, complexity) {
  const level = getComplexityLevel(complexity);
  const item = document.createElement('div');
  item.className = 'hotspot-item';
  item.dataset.file = filePath;
  item.dataset.name = name;

  const nameSpan = document.createElement('span');
  nameSpan.className = 'hotspot-name';
  nameSpan.title = `${name} (${filePath})`;
  nameSpan.textContent = name;

  const complexitySpan = document.createElement('span');
  complexitySpan.className = `hotspot-complexity ${level}`;
  complexitySpan.textContent = complexity;

  item.appendChild(nameSpan);
  item.appendChild(complexitySpan);

  item.addEventListener('click', () => highlightNode(name));

  return item;
}

// Helper to show error/hint message safely
function showMessage(elementId, message, className) {
  const element = document.getElementById(elementId);
  element.innerHTML = '';
  const div = document.createElement('div');
  div.className = className;
  div.textContent = message;
  element.appendChild(div);
}

// Load hotspots
async function loadHotspots() {
  try {
    const response = await fetch('/api/hotspots');
    if (!response.ok) {
      showMessage('hotspots-list', 'Failed to load hotspots', 'error');
      return;
    }
    const data = await response.json();
    const list = document.getElementById('hotspots-list');

    if (data.hotspots.length === 0) {
      showMessage('hotspots-list', 'No complexity hotspots found!', 'hint');
      return;
    }

    list.innerHTML = '';
    data.hotspots.slice(0, 8).forEach((h) => {
      list.appendChild(createHotspotItem(h.filePath, h.name, h.complexity));
    });
  } catch (error) {
    console.error('Failed to load hotspots:', error);
    showMessage('hotspots-list', 'Failed to load hotspots', 'error');
  }
}

// Highlight a node by name
function highlightNode(name) {
  if (!cy) return;

  const node = cy.nodes().filter((n) => n.data('label') === name);
  if (node.length > 0) {
    cy.animate(
      {
        center: { eles: node },
        zoom: 1.5,
      },
      { duration: 300 }
    );

    cy.nodes().removeClass('selected');
    node.addClass('selected');
    showNodeDetails(node.data(), node);
  }
}

// Load trends chart
async function loadTrends() {
  try {
    const response = await fetch('/api/trends');
    if (!response.ok) return;
    const data = await response.json();

    const info = document.getElementById('trends-info');

    if (!data.current) {
      info.textContent = 'No history yet. Run specter scan to build history.';
      return;
    }

    // Get snapshots for sparkline
    const allTrend = data.trends.all;
    if (allTrend?.snapshots && allTrend.snapshots.length >= 2) {
      const scores = allTrend.snapshots.map((s) => s.metrics.healthScore);
      drawSparkline(scores);

      const direction =
        allTrend.direction === 'improving'
          ? 'trending up'
          : allTrend.direction === 'declining'
            ? 'trending down'
            : 'stable';
      info.textContent = `${allTrend.snapshots.length} snapshots | ${direction}`;
    } else {
      info.textContent = 'Need more scans for trend data';
    }
  } catch (error) {
    console.error('Failed to load trends:', error);
  }
}

// Draw sparkline chart
function drawSparkline(scores) {
  const canvas = document.getElementById('trends-chart');
  const ctx = canvas.getContext('2d');
  const rect = canvas.getBoundingClientRect();

  // Set canvas size
  canvas.width = rect.width * 2;
  canvas.height = 80 * 2;
  ctx.scale(2, 2);

  const width = rect.width;
  const height = 80;
  const padding = 10;

  // Clear
  ctx.clearRect(0, 0, width, height);

  if (scores.length < 2) return;

  // Calculate points
  const min = Math.min(...scores) - 5;
  const max = Math.max(...scores) + 5;
  const range = max - min || 1;

  const points = scores.map((score, i) => ({
    x: padding + (i / (scores.length - 1)) * (width - padding * 2),
    y: height - padding - ((score - min) / range) * (height - padding * 2),
  }));

  // Draw gradient fill
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, 'rgba(139, 92, 246, 0.3)');
  gradient.addColorStop(1, 'rgba(139, 92, 246, 0)');

  ctx.beginPath();
  ctx.moveTo(points[0].x, height - padding);
  points.forEach((p) => ctx.lineTo(p.x, p.y));
  ctx.lineTo(points[points.length - 1].x, height - padding);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();

  // Draw line
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  points.forEach((p, i) => {
    if (i > 0) ctx.lineTo(p.x, p.y);
  });
  ctx.strokeStyle = '#8b5cf6';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Draw points
  points.forEach((p, i) => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
    ctx.fillStyle = i === points.length - 1 ? '#ec4899' : '#8b5cf6';
    ctx.fill();
  });
}

// Search functionality
function setupSearch() {
  const searchInput = document.getElementById('search');
  let debounceTimer;

  searchInput.addEventListener('input', (e) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      const query = e.target.value.toLowerCase().trim();
      filterNodes(query, document.getElementById('filter-type').value);
    }, 200);
  });
}

// Filter by type
function setupFilter() {
  const filterSelect = document.getElementById('filter-type');
  filterSelect.addEventListener('change', (e) => {
    const query = document.getElementById('search').value.toLowerCase().trim();
    filterNodes(query, e.target.value);
  });
}

// Filter nodes
function filterNodes(query, type) {
  if (!cy) return;

  cy.nodes().forEach((node) => {
    const label = node.data('label').toLowerCase();
    const filePath = node.data('filePath').toLowerCase();
    const nodeType = node.data('type');

    const matchesQuery = !query || label.includes(query) || filePath.includes(query);
    const matchesType = type === 'all' || nodeType === type;

    if (matchesQuery && matchesType) {
      node.removeClass('faded');
    } else {
      node.addClass('faded');
    }
  });

  // Fade edges connected to faded nodes
  cy.edges().forEach((edge) => {
    const source = edge.source();
    const target = edge.target();
    if (source.hasClass('faded') || target.hasClass('faded')) {
      edge.addClass('faded');
    } else {
      edge.removeClass('faded');
    }
  });
}

// Reset view
function setupResetView() {
  document.getElementById('reset-view').addEventListener('click', () => {
    if (!cy) return;

    // Clear filters
    document.getElementById('search').value = '';
    document.getElementById('filter-type').value = 'all';

    cy.nodes().removeClass('faded selected');
    cy.edges().removeClass('faded');

    cy.animate(
      {
        fit: { eles: cy.elements(), padding: 50 },
      },
      { duration: 300 }
    );
  });
}

// Toggle layout
function setupToggleLayout() {
  document.getElementById('toggle-layout').addEventListener('click', () => {
    if (!cy) return;

    currentLayout =
      currentLayout === 'cose' ? 'circle' : currentLayout === 'circle' ? 'grid' : 'cose';

    const layoutOptions = {
      cose: {
        name: 'cose',
        idealEdgeLength: 80,
        nodeRepulsion: 5000,
        animate: true,
        animationDuration: 500,
      },
      circle: {
        name: 'circle',
        animate: true,
        animationDuration: 500,
      },
      grid: {
        name: 'grid',
        animate: true,
        animationDuration: 500,
      },
    };

    cy.layout(layoutOptions[currentLayout]).run();
  });
}

// Initialize everything
async function init() {
  try {
    await Promise.all([initGraph(), loadSummary(), loadHealth(), loadHotspots(), loadTrends()]);

    setupSearch();
    setupFilter();
    setupResetView();
    setupToggleLayout();
  } catch (error) {
    console.error('Initialization error:', error);
  }
}

// Start
init();
