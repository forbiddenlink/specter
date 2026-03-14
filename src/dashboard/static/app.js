/**
 * Specter Dashboard Application
 *
 * Interactive visualization of codebase knowledge graph.
 */

// Global state
let cy = null;
let currentLayout = 'cose';
const charts = {
  distribution: null,
  healthTimeline: null,
  language: null,
  hotspotsProgress: null,
};

// Dark theme colors for Chart.js
const chartColors = {
  low: '#22c55e', // green
  medium: '#f59e0b', // yellow/amber
  high: '#f97316', // orange
  critical: '#ef4444', // red
  accent: '#8b5cf6', // purple
  secondary: '#ec4899', // pink
  typescript: '#3178c6', // TypeScript blue
  javascript: '#f7df1e', // JavaScript yellow
  textPrimary: '#f0f0f0',
  textSecondary: '#a0a0b0',
  textMuted: '#606070',
  gridColor: '#2a2a40',
  bgCard: '#1e1e32',
};

// Chart.js default configuration for dark theme
Chart.defaults.color = chartColors.textSecondary;
Chart.defaults.borderColor = chartColors.gridColor;

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

// Load complexity distribution chart
async function loadDistributionChart() {
  try {
    const response = await fetch('/api/distribution');
    if (!response.ok) return;
    const data = await response.json();

    const ctx = document.getElementById('distribution-chart').getContext('2d');

    // Destroy existing chart if present
    if (charts.distribution) {
      charts.distribution.destroy();
    }

    charts.distribution = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Low', 'Medium', 'High', 'Critical'],
        datasets: [
          {
            label: 'Files',
            data: [data.low || 0, data.medium || 0, data.high || 0, data.critical || 0],
            backgroundColor: [
              chartColors.low,
              chartColors.medium,
              chartColors.high,
              chartColors.critical,
            ],
            borderColor: [
              chartColors.low,
              chartColors.medium,
              chartColors.high,
              chartColors.critical,
            ],
            borderWidth: 1,
            borderRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            backgroundColor: chartColors.bgCard,
            titleColor: chartColors.textPrimary,
            bodyColor: chartColors.textSecondary,
            borderColor: chartColors.gridColor,
            borderWidth: 1,
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              stepSize: 1,
              color: chartColors.textMuted,
            },
            grid: {
              color: chartColors.gridColor,
            },
          },
          x: {
            ticks: {
              color: chartColors.textMuted,
            },
            grid: {
              display: false,
            },
          },
        },
      },
    });
  } catch (error) {
    console.error('Failed to load distribution chart:', error);
  }
}

// Load health timeline chart from history
async function loadHealthTimelineChart() {
  try {
    const response = await fetch('/api/history');
    if (!response.ok) return;
    const data = await response.json();

    if (!data.snapshots || data.snapshots.length < 2) {
      return; // Not enough data for timeline
    }

    const ctx = document.getElementById('trends-chart').getContext('2d');

    // Destroy existing sparkline if present (we're replacing it with Chart.js)
    if (charts.healthTimeline) {
      charts.healthTimeline.destroy();
    }

    const labels = data.snapshots.map((s, _i) => {
      const date = new Date(s.timestamp);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });

    const scores = data.snapshots.map((s) => s.metrics?.healthScore || s.healthScore || 0);

    charts.healthTimeline = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Health Score',
            data: scores,
            borderColor: chartColors.accent,
            backgroundColor: 'rgba(139, 92, 246, 0.1)',
            fill: true,
            tension: 0.3,
            pointBackgroundColor: chartColors.accent,
            pointBorderColor: chartColors.accent,
            pointRadius: 3,
            pointHoverRadius: 5,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            backgroundColor: chartColors.bgCard,
            titleColor: chartColors.textPrimary,
            bodyColor: chartColors.textSecondary,
            borderColor: chartColors.gridColor,
            borderWidth: 1,
            callbacks: {
              label: (context) => `Score: ${context.parsed.y}`,
            },
          },
        },
        scales: {
          y: {
            min: 0,
            max: 100,
            ticks: {
              color: chartColors.textMuted,
              stepSize: 25,
            },
            grid: {
              color: chartColors.gridColor,
            },
          },
          x: {
            ticks: {
              color: chartColors.textMuted,
              maxRotation: 0,
              autoSkip: true,
              maxTicksLimit: 5,
            },
            grid: {
              display: false,
            },
          },
        },
      },
    });
  } catch (error) {
    console.error('Failed to load health timeline chart:', error);
  }
}

// Load language breakdown pie chart
async function loadLanguageChart() {
  try {
    const response = await fetch('/api/graph');
    if (!response.ok) return;
    const data = await response.json();

    // Count files by extension
    const counts = { typescript: 0, javascript: 0, other: 0 };

    data.nodes.forEach((node) => {
      if (node.data?.type === 'file' && node.data?.filePath) {
        const path = node.data.filePath.toLowerCase();
        if (path.endsWith('.ts') || path.endsWith('.tsx')) {
          counts.typescript++;
        } else if (path.endsWith('.js') || path.endsWith('.jsx')) {
          counts.javascript++;
        } else {
          counts.other++;
        }
      }
    });

    // Only show chart if we have data
    if (counts.typescript === 0 && counts.javascript === 0 && counts.other === 0) {
      return;
    }

    const ctx = document.getElementById('language-chart').getContext('2d');

    if (charts.language) {
      charts.language.destroy();
    }

    const chartData = [];
    const chartLabels = [];
    const chartBgColors = [];
    const chartBorderColors = [];

    if (counts.typescript > 0) {
      chartData.push(counts.typescript);
      chartLabels.push('TypeScript');
      chartBgColors.push(chartColors.typescript);
      chartBorderColors.push(chartColors.typescript);
    }
    if (counts.javascript > 0) {
      chartData.push(counts.javascript);
      chartLabels.push('JavaScript');
      chartBgColors.push(chartColors.javascript);
      chartBorderColors.push(chartColors.javascript);
    }
    if (counts.other > 0) {
      chartData.push(counts.other);
      chartLabels.push('Other');
      chartBgColors.push(chartColors.textMuted);
      chartBorderColors.push(chartColors.textMuted);
    }

    charts.language = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: chartLabels,
        datasets: [
          {
            data: chartData,
            backgroundColor: chartBgColors,
            borderColor: chartBorderColors,
            borderWidth: 2,
            hoverOffset: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: chartColors.textSecondary,
              padding: 10,
              usePointStyle: true,
              pointStyle: 'circle',
            },
          },
          tooltip: {
            backgroundColor: chartColors.bgCard,
            titleColor: chartColors.textPrimary,
            bodyColor: chartColors.textSecondary,
            borderColor: chartColors.gridColor,
            borderWidth: 1,
            callbacks: {
              label: (context) => {
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const percentage = Math.round((context.parsed / total) * 100);
                return `${context.label}: ${context.parsed} (${percentage}%)`;
              },
            },
          },
        },
        cutout: '60%',
      },
    });
  } catch (error) {
    console.error('Failed to load language chart:', error);
  }
}

// Load hotspots progress chart from history
async function loadHotspotsProgressChart() {
  try {
    const response = await fetch('/api/history');
    if (!response.ok) return;
    const data = await response.json();

    if (!data.snapshots || data.snapshots.length < 2) {
      return; // Not enough data for timeline
    }

    const ctx = document.getElementById('hotspots-progress-chart').getContext('2d');

    if (charts.hotspotsProgress) {
      charts.hotspotsProgress.destroy();
    }

    const labels = data.snapshots.map((s) => {
      const date = new Date(s.timestamp);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });

    const hotspotCounts = data.snapshots.map((s) => {
      // Try different possible field names for hotspot count
      return s.metrics?.hotspotCount || s.hotspotCount || s.metrics?.criticalCount || 0;
    });

    charts.hotspotsProgress = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Hotspots',
            data: hotspotCounts,
            borderColor: chartColors.critical,
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            fill: true,
            tension: 0.3,
            pointBackgroundColor: chartColors.critical,
            pointBorderColor: chartColors.critical,
            pointRadius: 3,
            pointHoverRadius: 5,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            backgroundColor: chartColors.bgCard,
            titleColor: chartColors.textPrimary,
            bodyColor: chartColors.textSecondary,
            borderColor: chartColors.gridColor,
            borderWidth: 1,
            callbacks: {
              label: (context) => `Hotspots: ${context.parsed.y}`,
            },
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              color: chartColors.textMuted,
              stepSize: 1,
            },
            grid: {
              color: chartColors.gridColor,
            },
          },
          x: {
            ticks: {
              color: chartColors.textMuted,
              maxRotation: 0,
              autoSkip: true,
              maxTicksLimit: 5,
            },
            grid: {
              display: false,
            },
          },
        },
      },
    });
  } catch (error) {
    console.error('Failed to load hotspots progress chart:', error);
  }
}

// Initialize everything
async function init() {
  try {
    await Promise.all([
      initGraph(),
      loadSummary(),
      loadHealth(),
      loadHotspots(),
      loadTrends(),
      loadDistributionChart(),
      loadHealthTimelineChart(),
      loadLanguageChart(),
      loadHotspotsProgressChart(),
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
