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
  if (complexity <= 5) return '#22c55e';   // green
  if (complexity <= 10) return '#f59e0b';  // yellow
  if (complexity <= 20) return '#f97316';  // orange
  return '#ef4444';                         // red
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
    case 'file': return 'round-rectangle';
    case 'class': return 'diamond';
    case 'interface': return 'hexagon';
    case 'function': return 'ellipse';
    default: return 'ellipse';
  }
}

// Initialize Cytoscape graph
async function initGraph() {
  try {
    const response = await fetch('/api/graph');
    if (!response.ok) {
      document.getElementById('cy').innerHTML = '<div class="error">No graph found. Run `specter scan` first.</div>';
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
            'background-color': ele => getComplexityColor(ele.data('complexity')),
            'label': 'data(label)',
            'font-size': '9px',
            'text-valign': 'bottom',
            'text-halign': 'center',
            'text-margin-y': '6px',
            'color': '#a0a0b0',
            'text-outline-color': '#0f0f1a',
            'text-outline-width': '2px',
            'width': ele => {
              const c = ele.data('complexity');
              return Math.max(15, Math.min(50, 12 + c * 1.5));
            },
            'height': ele => {
              const c = ele.data('complexity');
              return Math.max(15, Math.min(50, 12 + c * 1.5));
            },
            'shape': ele => getNodeShape(ele.data('type')),
            'border-width': 1,
            'border-color': '#2a2a40',
          }
        },
        {
          selector: 'node[type="file"]',
          style: {
            'background-opacity': 0.8,
            'font-size': '10px',
            'font-weight': 'bold',
          }
        },
        {
          selector: 'edge',
          style: {
            'width': 1,
            'line-color': '#3a3a50',
            'curve-style': 'bezier',
            'target-arrow-shape': 'triangle',
            'target-arrow-color': '#3a3a50',
            'arrow-scale': 0.7,
            'opacity': 0.5
          }
        },
        {
          selector: 'edge[type="imports"]',
          style: {
            'line-color': '#8b5cf6',
            'target-arrow-color': '#8b5cf6',
          }
        },
        {
          selector: 'edge[type="calls"]',
          style: {
            'line-color': '#06b6d4',
            'target-arrow-color': '#06b6d4',
            'line-style': 'dashed',
          }
        },
        {
          selector: 'edge[type="extends"]',
          style: {
            'line-color': '#ec4899',
            'target-arrow-color': '#ec4899',
          }
        },
        {
          selector: 'node.highlighted',
          style: {
            'border-width': 3,
            'border-color': '#8b5cf6',
            'z-index': 999,
          }
        },
        {
          selector: 'node.faded',
          style: {
            'opacity': 0.2,
          }
        },
        {
          selector: 'edge.faded',
          style: {
            'opacity': 0.1,
          }
        },
        {
          selector: 'node.selected',
          style: {
            'border-width': 3,
            'border-color': '#ec4899',
          }
        }
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
    cy.on('tap', 'node', function(evt) {
      const node = evt.target;
      showNodeDetails(node.data(), node);

      // Highlight selected node
      cy.nodes().removeClass('selected');
      node.addClass('selected');
    });

    // Background click clears selection
    cy.on('tap', function(evt) {
      if (evt.target === cy) {
        cy.nodes().removeClass('selected');
        document.getElementById('details-content').innerHTML = '<p class="hint">Click a node to see details</p>';
      }
    });

    // Hover effects
    cy.on('mouseover', 'node', function(evt) {
      const node = evt.target;
      node.addClass('highlighted');

      // Show connected edges more prominently
      const connected = node.connectedEdges();
      connected.style('opacity', 0.8);
    });

    cy.on('mouseout', 'node', function(evt) {
      const node = evt.target;
      node.removeClass('highlighted');
      cy.edges().style('opacity', 0.5);
    });

  } catch (error) {
    console.error('Failed to load graph:', error);
    document.getElementById('cy').innerHTML = '<div class="error">Failed to load graph data.</div>';
  }
}

// Show node details in side panel
function showNodeDetails(data, node) {
  const level = getComplexityLevel(data.complexity);
  const connections = node.connectedEdges();
  const incoming = connections.filter(e => e.target().id() === node.id());
  const outgoing = connections.filter(e => e.source().id() === node.id());

  let connectionsHtml = '';
  if (incoming.length > 0 || outgoing.length > 0) {
    connectionsHtml = '<div class="connections-list">';

    if (incoming.length > 0) {
      connectionsHtml += '<h3>Incoming (' + incoming.length + ')</h3>';
      incoming.forEach(e => {
        const source = e.source().data();
        connectionsHtml += '<div class="connection-item" data-id="' + source.id + '">' +
          '<span style="color: #8b5cf6">' + e.data('type') + '</span> from ' + source.label +
          '</div>';
      });
    }

    if (outgoing.length > 0) {
      connectionsHtml += '<h3>Outgoing (' + outgoing.length + ')</h3>';
      outgoing.forEach(e => {
        const target = e.target().data();
        connectionsHtml += '<div class="connection-item" data-id="' + target.id + '">' +
          '<span style="color: #8b5cf6">' + e.data('type') + '</span> to ' + target.label +
          '</div>';
      });
    }

    connectionsHtml += '</div>';
  }

  const panel = document.getElementById('details-content');
  panel.innerHTML =
    '<div class="detail-item">' +
      '<span class="label">Name</span>' +
      '<span class="value">' + data.label + '</span>' +
    '</div>' +
    '<div class="detail-item">' +
      '<span class="label">Type</span>' +
      '<span class="value">' + data.type + '</span>' +
    '</div>' +
    '<div class="detail-item">' +
      '<span class="label">File</span>' +
      '<span class="value">' + data.filePath + '</span>' +
    '</div>' +
    '<div class="detail-item">' +
      '<span class="label">Complexity</span>' +
      '<span class="value ' + level + '">' + data.complexity + ' (' + level + ')</span>' +
    '</div>' +
    '<div class="detail-item">' +
      '<span class="label">Lines</span>' +
      '<span class="value">' + data.lineStart + ' - ' + data.lineEnd + '</span>' +
    '</div>' +
    connectionsHtml;

  // Add click handlers to connection items
  panel.querySelectorAll('.connection-item').forEach(item => {
    item.addEventListener('click', () => {
      const id = item.dataset.id;
      const targetNode = cy.getElementById(id);
      if (targetNode.length > 0) {
        cy.animate({
          center: { eles: targetNode },
          zoom: 1.5
        }, { duration: 300 });
        showNodeDetails(targetNode.data(), targetNode);
        cy.nodes().removeClass('selected');
        targetNode.addClass('selected');
      }
    });
  });
}

// Load summary
async function loadSummary() {
  try {
    const response = await fetch('/api/summary');
    if (!response.ok) {
      document.getElementById('summary-content').innerHTML = '<div class="error">Failed to load summary</div>';
      return;
    }
    const data = await response.json();
    document.getElementById('summary-content').innerHTML =
      '<div class="stat-grid">' +
        '<div class="stat">' +
          '<span class="stat-value">' + data.stats.files + '</span>' +
          '<span class="stat-label">Files</span>' +
        '</div>' +
        '<div class="stat">' +
          '<span class="stat-value">' + data.stats.lines.toLocaleString() + '</span>' +
          '<span class="stat-label">Lines</span>' +
        '</div>' +
        '<div class="stat">' +
          '<span class="stat-value">' + data.stats.functions + '</span>' +
          '<span class="stat-label">Functions</span>' +
        '</div>' +
        '<div class="stat">' +
          '<span class="stat-value">' + data.stats.classes + '</span>' +
          '<span class="stat-label">Classes</span>' +
        '</div>' +
      '</div>';
  } catch (error) {
    console.error('Failed to load summary:', error);
    document.getElementById('summary-content').innerHTML = '<div class="error">Failed to load summary</div>';
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
    badge.querySelector('.score').textContent = data.score + '/100';

    // Set grade class for coloring
    badge.className = 'health-badge grade-' + data.grade.toLowerCase();
  } catch (error) {
    console.error('Failed to load health:', error);
  }
}

// Load hotspots
async function loadHotspots() {
  try {
    const response = await fetch('/api/hotspots');
    if (!response.ok) {
      document.getElementById('hotspots-list').innerHTML = '<div class="error">Failed to load hotspots</div>';
      return;
    }
    const data = await response.json();
    const list = document.getElementById('hotspots-list');

    if (data.hotspots.length === 0) {
      list.innerHTML = '<div class="hint">No complexity hotspots found!</div>';
      return;
    }

    list.innerHTML = data.hotspots.slice(0, 8).map(h => {
      const level = getComplexityLevel(h.complexity);
      return '<div class="hotspot-item" data-file="' + h.filePath + '" data-name="' + h.name + '">' +
        '<span class="hotspot-name" title="' + h.name + ' (' + h.filePath + ')">' + h.name + '</span>' +
        '<span class="hotspot-complexity ' + level + '">' + h.complexity + '</span>' +
      '</div>';
    }).join('');

    // Add click handlers
    list.querySelectorAll('.hotspot-item').forEach(item => {
      item.addEventListener('click', () => {
        const name = item.dataset.name;
        highlightNode(name);
      });
    });
  } catch (error) {
    console.error('Failed to load hotspots:', error);
    document.getElementById('hotspots-list').innerHTML = '<div class="error">Failed to load hotspots</div>';
  }
}

// Highlight a node by name
function highlightNode(name) {
  if (!cy) return;

  const node = cy.nodes().filter(n => n.data('label') === name);
  if (node.length > 0) {
    cy.animate({
      center: { eles: node },
      zoom: 1.5
    }, { duration: 300 });

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
    if (allTrend && allTrend.snapshots && allTrend.snapshots.length >= 2) {
      const scores = allTrend.snapshots.map(s => s.metrics.healthScore);
      drawSparkline(scores);

      const direction = allTrend.direction === 'improving' ? 'trending up' :
                       allTrend.direction === 'declining' ? 'trending down' : 'stable';
      info.textContent = allTrend.snapshots.length + ' snapshots | ' + direction;
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
    y: height - padding - ((score - min) / range) * (height - padding * 2)
  }));

  // Draw gradient fill
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, 'rgba(139, 92, 246, 0.3)');
  gradient.addColorStop(1, 'rgba(139, 92, 246, 0)');

  ctx.beginPath();
  ctx.moveTo(points[0].x, height - padding);
  points.forEach(p => ctx.lineTo(p.x, p.y));
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

  searchInput.addEventListener('input', function(e) {
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
  filterSelect.addEventListener('change', function(e) {
    const query = document.getElementById('search').value.toLowerCase().trim();
    filterNodes(query, e.target.value);
  });
}

// Filter nodes
function filterNodes(query, type) {
  if (!cy) return;

  cy.nodes().forEach(node => {
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
  cy.edges().forEach(edge => {
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

    cy.animate({
      fit: { eles: cy.elements(), padding: 50 }
    }, { duration: 300 });
  });
}

// Toggle layout
function setupToggleLayout() {
  document.getElementById('toggle-layout').addEventListener('click', () => {
    if (!cy) return;

    currentLayout = currentLayout === 'cose' ? 'circle' :
                   currentLayout === 'circle' ? 'grid' : 'cose';

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
      }
    };

    cy.layout(layoutOptions[currentLayout]).run();
  });
}

// Initialize everything
async function init() {
  try {
    await Promise.all([
      initGraph(),
      loadSummary(),
      loadHealth(),
      loadHotspots(),
      loadTrends()
    ]);

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
