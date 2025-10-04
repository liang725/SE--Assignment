//import define1 from "./amazon_517.js";
//import define2 from "./amazon_817.js";

function _1(md){return(
md`# 商品共购关系网络`
)}

function _chart(ForceGraph,miserables,width,invalidation){return(
ForceGraph(miserables, {
  nodeId: d => d.id,
  nodeGroup: d => d.group,
  nodeTitle: d => `${d.id}\n${d.group}`,
  linkStrokeWidth: l => Math.sqrt(l.value),
  width,
  height: 800,
  invalidation
})
)}

function _miserables(FileAttachment){return(
FileAttachment("miserables.json").json()
)}

function _ForceGraph(d3){return(
function ForceGraph({
  nodes,
  links
}, {
  nodeId = d => d.id,
  nodeGroup,
  nodeGroups,
  nodeTitle,
  nodeFill = "currentColor",
  nodeStroke = "#fff",
  nodeStrokeWidth = 1.5,
  nodeStrokeOpacity = 1,
  nodeRadius = 8,
  nodeStrength,
  linkSource = ({source}) => source,
  linkTarget = ({target}) => target,
  linkStroke = "#999",
  linkStrokeOpacity = 0.6,
  linkStrokeWidth = 1.5,
  linkStrokeLinecap = "round",
  linkStrength,
  colors = d3.schemeTableau10,
  width = 640,
  height = 400,
  invalidation
} = {}) {
  // Compute values.
  const N = d3.map(nodes, nodeId).map(intern);
  const R = typeof nodeRadius !== "function" ? null : d3.map(nodes, nodeRadius);
  const LS = d3.map(links, linkSource).map(intern);
  const LT = d3.map(links, linkTarget).map(intern);
  if (nodeTitle === undefined) nodeTitle = (_, i) => N[i];
  const T = nodeTitle == null ? null : d3.map(nodes, nodeTitle);
  const G = nodeGroup == null ? null : d3.map(nodes, nodeGroup).map(intern);
  const W = typeof linkStrokeWidth !== "function" ? null : d3.map(links, linkStrokeWidth);
  const L = typeof linkStroke !== "function" ? null : d3.map(links, linkStroke);

  // Replace the input nodes and links with mutable objects for the simulation.
  nodes = d3.map(nodes, (_, i) => ({id: N[i]}));
  links = d3.map(links, (_, i) => ({source: LS[i], target: LT[i]}));

  // Compute default domains.
  if (G && nodeGroups === undefined) nodeGroups = d3.sort(G);

  // Construct the scales.
  const color = nodeGroup == null ? null : d3.scaleOrdinal(nodeGroups, colors);

  // Construct the forces.
  const forceNode = d3.forceManyBody();
  const forceLink = d3.forceLink(links).id(({index: i}) => N[i]);
  if (nodeStrength !== undefined) forceNode.strength(nodeStrength);
  if (linkStrength !== undefined) forceLink.strength(linkStrength);

  const simulation = d3.forceSimulation(nodes)
      .force("link", forceLink)
      .force("charge", forceNode)
      .force("center", 	d3.forceCenter())
      .on("tick", ticked);

  // --- 搜索状态管理 ---
  let highlightedNodeIndex = null;
  let highlightedNeighbors = new Set();
  let isHighlighted = false;

  // 创建主容器
  const mainContainer = d3.create("div")
      .style("display", "flex")
      .style("flex-direction", "column")
      .style("gap", "15px")
      .style("max-width", "100%")
      .style("user-select", "none")
      .style("font-family", "sans-serif");

  // 固定顶部容器 (包含搜索面板和统计面板)
  const fixedHeader = mainContainer.append("div")
      .style("position", "sticky")
      .style("top", "0")
      .style("z-index", "100")
      .style("background", "white")
      .style("padding", "0 0 15px 0");

  //搜索面板
  const searchPanel = fixedHeader.append("div")
      .style("display", "flex")
      .style("gap", "10px")
      .style("padding", "15px")
      .style("background", "#e9ecef")
      .style("border-radius", "8px")
      .style("box-shadow", "0 2px 4px rgba(0,0,0,0.05)");

  const searchInput = searchPanel.append("input")
      .attr("type", "text")
      .attr("placeholder", "请输入完整商品名称...")
      .style("flex-grow", "1")
      .style("padding", "10px 15px")
      .style("border", "1px solid #ccc")
      .style("border-radius", "6px")
      .style("font-size", "14px");

  const searchButton = searchPanel.append("button")
      .style("padding", "10px 18px")
      .style("background", "#007bff")
      .style("color", "white")
      .style("border", "none")
      .style("border-radius", "6px")
      .style("cursor", "pointer")
      .style("font-size", "14px")
      .style("font-weight", "bold")
      .style("box-shadow", "0 2px 4px rgba(0,0,0,0.1)")
      .text("🔍 搜索");

  const clearButton = searchPanel.append("button")
      .style("padding", "10px 18px")
      .style("background", "#6c757d")
      .style("color", "white")
      .style("border", "none")
      .style("border-radius", "6px")
      .style("cursor", "pointer")
      .style("font-size", "14px")
      .style("font-weight", "bold")
      .style("box-shadow", "0 2px 4px rgba(0,0,0,0.1)")
      .text("✖ 清除高亮");

  // 创建统计面板
  const statsPanel = fixedHeader.append("div")
      .style("display", "flex")
      .style("gap", "15px")
      .style("padding", "15px")
      .style("background", "#f8f9fa")
      .style("border-radius", "8px")
      .style("box-shadow", "0 2px 4px rgba(0,0,0,0.1)")
      .style("font-family", "sans-serif")
      .style("margin-top", "15px");

  // 计算统计数据
  const totalNodes = nodes.length;
  const totalLinks = links.length;
  const avgConnections = (totalLinks * 2 / totalNodes).toFixed(2);

  // 找到连接数最多的节点
  const connectionCounts = new Map();
  links.forEach(l => {
    connectionCounts.set(l.source.index, (connectionCounts.get(l.source.index) || 0) + 1);
    connectionCounts.set(l.target.index, (connectionCounts.get(l.target.index) || 0) + 1);
  });
  const maxConnections = Math.max(...connectionCounts.values());
  const hotNodes = Array.from(connectionCounts.entries())
    .filter(([_, count]) => count === maxConnections)
    .map(([idx]) => N[idx]);

  // 统计各分组数量
  const groupCounts = new Map();
  if (G) {
    G.forEach(g => groupCounts.set(g, (groupCounts.get(g) || 0) + 1));
  }

  // 创建统计卡片
  const statCard = (title, value) => {
    const card = statsPanel.append("div")
      .style("flex", "1")
      .style("padding", "8px 12px")
      .style("background", "white")
      .style("border-radius", "6px")
      .style("box-shadow", "0 1px 3px rgba(0,0,0,0.1)");

    card.append("div")
      .style("font-size", "11px")
      .style("color", "#666")
      .style("margin-bottom", "3px")
      .text(title);

    card.append("div")
      .style("font-size", "18px")
      .style("font-weight", "bold")
      .style("color", "#333")
      .html(value);

    return card;
  };

  statCard("总节点数", totalNodes);
  statCard("总连接数", totalLinks);
  statCard("平均连接度", avgConnections);
  statCard("最热门商品", `${hotNodes[0]}<br/><span style="font-size: 11px; color: #666; font-weight: normal;">(${maxConnections} 个连接)</span>`);

  // 创建图表和信息面板容器
  const container = mainContainer.append("div")
      .style("display", "flex")
      .style("gap", "10px")
      .style("max-width", "100%");

  // 创建 SVG 容器
  const svgContainer = container.append("div")
      .style("flex", "1")
      .style("position", "relative");

//  创建「视口固定」容器（
const statusPanel = mainContainer.append("div")
    .style("position", "fixed")          // 相对浏览器窗口
    .style("bottom", "12px")             // 离下边 12px
    .style("left", "12px")               // 离左边 12px
    .style("padding", "8px 12px")
    .style("background", "rgba(255,255,255,0.95)")
    .style("border-radius", "4px")
    .style("box-shadow", "0 1px 4px rgba(0,0,0,0.1)")
    .style("font-family", "sans-serif")
    .style("font-size", "12px")
    .style("color", "#333")
    .style("z-index", "9999")            // 保证在最上层
    .html(`
      <div style="display: flex; align-items: center; gap: 6px;">
        <span style="font-size: 20px;">💡</span>
        <span>悬停/拖拽查看详情</span>
      </div>
    `);
  const svg = svgContainer.append("svg")
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", [-width / 2, -height / 2, width, height])
      .style("max-width", "100%")
      .style("height", "auto")
      .style("background", "white");

  // 创建图形组（用于缩放和平移）
  const g = svg.append("g");

  // 配置缩放行为
  const zoom = d3.zoom()
      .scaleExtent([0.1, 10])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });

  svg.call(zoom)
   .on("dblclick.zoom", null);

  // 添加缩放控制面板（右上角）
  const zoomControls = svgContainer.append("div")
      .style("position", "absolute")
      .style("top", "10px")
      .style("right", "10px")
      .style("display", "flex")
      .style("flex-direction", "column")
      .style("gap", "8px")
      .style("z-index", "1000");

  const zoomInBtn = zoomControls.append("button")
      .style("width", "40px")
      .style("height", "40px")
      .style("background", "white")
      .style("border", "2px solid #ddd")
      .style("border-radius", "6px")
      .style("cursor", "pointer")
      .style("font-size", "20px")
      .style("font-weight", "bold")
      .style("color", "#333")
      .style("box-shadow", "0 2px 4px rgba(0,0,0,0.1)")
      .style("display", "flex")
      .style("align-items", "center")
      .style("justify-content", "center")
      .text("+")
      .on("mouseover", function() {
        d3.select(this).style("background", "#f0f0f0");
      })
      .on("mouseout", function() {
        d3.select(this).style("background", "white");
      })
      .on("click", function() {
        // **修改点：直接调用 zoom 对象的 scaleBy 方法**
        svg.transition().duration(300).call(zoom.scaleBy, 1.3);
      });

  const zoomOutBtn = zoomControls.append("button")
      .style("width", "40px")
      .style("height", "40px")
      .style("background", "white")
      .style("border", "2px solid #ddd")
      .style("border-radius", "6px")
      .style("cursor", "pointer")
      .style("font-size", "20px")
      .style("font-weight", "bold")
      .style("color", "#333")
      .style("box-shadow", "0 2px 4px rgba(0,0,0,0.1)")
      .style("display", "flex")
      .style("align-items", "center")
      .style("justify-content", "center")
      .text("−")
      .on("mouseover", function() {
        d3.select(this).style("background", "#f0f0f0");
      })
      .on("mouseout", function() {
        d3.select(this).style("background", "white");
      })
      .on("click", function() {
        // **修改点：直接调用 zoom 对象的 scaleBy 方法**
        svg.transition().duration(300).call(zoom.scaleBy, 0.7);
      });

  const zoomResetBtn = zoomControls.append("button")
      .style("width", "40px")
      .style("height", "40px")
      .style("background", "white")
      .style("border", "2px solid #ddd")
      .style("border-radius", "6px")
      .style("cursor", "pointer")
      .style("font-size", "18px")
      .style("color", "#333")
      .style("box-shadow", "0 2px 4px rgba(0,0,0,0.1)")
      .style("display", "flex")
      .style("align-items", "center")
      .style("justify-content", "center")
      .text("⊙")
      .on("mouseover", function() {
        d3.select(this).style("background", "#f0f0f0");
      })
      .on("mouseout", function() {
        d3.select(this).style("background", "white");
      })
      .on("click", function() {
        svg.transition().duration(500).call(zoom.transform, d3.zoomIdentity);
      });

  // 创建右侧信息面板（加大尺寸）
  const infoPanel = container.append("div")
      .style("width", "350px")
      .style("padding", "25px")
      .style("background", "#f5f5f5")
      .style("border-radius", "8px")
      .style("box-shadow", "0 2px 8px rgba(0,0,0,0.1)")
      .style("font-family", "sans-serif")
      .style("position", "sticky")
      .style("top", "20px")
      .style("align-self", "flex-start")
      .style("max-height", "calc(100vh - 40px)")
      .style("overflow-y", "auto");

  infoPanel.append("h3")
      .style("margin-top", "0")
      .style("margin-bottom", "20px")
      .style("color", "#333")
      .style("font-size", "20px")
      .style("border-bottom", "2px solid #ddd")
      .style("padding-bottom", "12px")
      .text("商品关联详情");

  const infoContent = infoPanel.append("div")
      .attr("id", "info-content")
      .style("color", "#666")
      .style("font-size", "15px")
      .html(`
        <div style="line-height: 2;">
          <p style="padding: 12px; background: white; border-radius: 4px; margin: 10px 0;">
            <strong>💡 提示：</strong><br/>
            • 悬停查看详情<br/>
            • 拖动调整位置<br/>
            • 拖动固定节点<br/>
            • 双击释放节点<br/>
            • 点击查看关联商品<br/>
            • 使用上方搜索框定位商品
          </p>
        </div>
      `);

  // 将 link group 添加到 g 元素中
  const link = g.append("g")
      .attr("stroke", typeof linkStroke !== "function" ? linkStroke : null)
      .attr("stroke-opacity", linkStrokeOpacity)
      .attr("stroke-width", typeof linkStrokeWidth !== "function" ? linkStrokeWidth : null)
      .attr("stroke-linecap", linkStrokeLinecap)
    .selectAll("line")
    .data(links)
    .join("line")
      .style("pointer-events", "none");

  // 将 node group 添加到 g 元素中
  const node = g.append("g")
      .attr("fill", nodeFill)
      .attr("stroke", nodeStroke)
      .attr("stroke-opacity", nodeStrokeOpacity)
      .attr("stroke-width", nodeStrokeWidth)
    .selectAll("circle")
    .data(nodes)
    .join("circle")
      .attr("r", nodeRadius)
      .call(drag(simulation));

  // 将 labels group 添加到 g 元素中
  const labels = g.append("g")
      .attr("class", "labels")
    .selectAll("text")
    .data(nodes)
    .join("text")
      .attr("class", "node-label")
      .attr("text-anchor", "middle")
      .attr("dy", -15)
      .style("font-size", "13px")
      .style("font-weight", "bold")
      .style("fill", "#333")
      .style("pointer-events", "none")
      .style("opacity", 0)
      .style("text-shadow", "1px 1px 2px white, -1px -1px 2px white, 1px -1px 2px white, -1px 1px 2px white")
      .text(({index: i}) => N[i]);

  if (W) link.attr("stroke-width", ({index: i}) => W[i]);
  if (L) link.attr("stroke", ({index: i}) => L[i]);
  if (G) node.attr("fill", ({index: i}) => color(G[i]));
  if (R) node.attr("r", ({index: i}) => R[i]);

  // 添加 title
  if (T) node.append("title").text(({index: i}) => N[i]);

  // 搜索功能实现

  function updateVisualsForHighlight() {
      node.attr("opacity", d => (isHighlighted && d.index !== highlightedNodeIndex && !highlightedNeighbors.has(d.index)) ? 0.1 : 1)
          .attr("stroke", d => d.index === highlightedNodeIndex ? "#007bff" : nodeStroke)
          .attr("stroke-width", d => d.index === highlightedNodeIndex ? 3 : nodeStrokeWidth)
          .attr("r", d => d.index === highlightedNodeIndex ? (R ? R[d.index] : nodeRadius) * 1.5 : (R ? R[d.index] : nodeRadius));

      link.attr("opacity", d => (isHighlighted && d.source.index !== highlightedNodeIndex && d.target.index !== highlightedNodeIndex) ? 0.05 : linkStrokeOpacity)
          .attr("stroke", d => (d.source.index === highlightedNodeIndex || d.target.index === highlightedNodeIndex) ? "#007bff" : (L ? L[d.index] : linkStroke))
          .attr("stroke-width", d => (d.source.index === highlightedNodeIndex || d.target.index === highlightedNodeIndex) ? (W ? W[d.index] * 1.5 : linkStrokeWidth * 1.5) : (W ? W[d.index] : linkStrokeWidth));

      labels.style("opacity", d => (d.index === highlightedNodeIndex || highlightedNeighbors.has(d.index)) ? 1 : 0);
  }

  function clearHighlighting() {
      isHighlighted = false;
      highlightedNodeIndex = null;
      highlightedNeighbors.clear();
      updateVisualsForHighlight();

      infoContent.html(`
        <div style="line-height: 2;">
          <p style="padding: 12px; background: white; border-radius: 4px; margin: 10px 0;">
            <strong>💡 提示：</strong><br/>
             • 悬停查看详情<br/>
            • 拖动调整位置<br/>
            • 拖动固定节点<br/>
            • 双击释放节点<br/>
            • 点击查看关联商品<br/>
            • 使用上方搜索框定位商品
          </p>
        </div>
      `);
      searchInput.property("value", "");
  }

  function highlightNode(query) {
      clearHighlighting();

      const normalizedQuery = query.trim().toLowerCase();

      if (normalizedQuery === "") {
          return;
      }

      const targetNode = nodes.find((d, i) => N[i].toString().toLowerCase() === normalizedQuery);

      if (!targetNode) {
          infoContent.html(`<p style="color: #dc3545; font-weight: bold; padding: 12px; background: #ffe0e3; border-radius: 4px;">未找到商品 "${query}"。</p>`);
          return;
      }

      const targetNodeIndex = targetNode.index;
      highlightedNodeIndex = targetNodeIndex;
      isHighlighted = true;

      links.forEach(l => {
          if (l.source.index === targetNodeIndex) {
              highlightedNeighbors.add(l.target.index);
          } else if (l.target.index === targetNodeIndex) {
              highlightedNeighbors.add(l.source.index);
          }
      });

      updateVisualsForHighlight();
      updateInfoPanel(targetNode);
  }

  searchButton.on("click", () => {
      highlightNode(searchInput.property("value"));
  });

  searchInput.on("keypress", function(event) {
      if (event.key === "Enter") {
          highlightNode(this.value);
      }
  });

  clearButton.on("click", clearHighlighting);

  // 辅助函数：获取节点连接信息
  function getNodeConnections(nodeIndex) {
    const connectedLinks = links.filter(l => l.source.index === nodeIndex || l.target.index === nodeIndex);
    const connectedNodeSet = new Set();
    connectedLinks.forEach(l => {
      if (l.source.index === nodeIndex) {
        connectedNodeSet.add(l.target.index);
      } else {
        connectedNodeSet.add(l.source.index);
      }
    });
    const connectedNodes = Array.from(connectedNodeSet).map(idx => N[idx]);
    return { count: connectedNodes.length, nodes: connectedNodes };
  }

  // 辅助函数：更新信息面板
  function updateInfoPanel(d) {
    const i = d.index;
    const { count, nodes: connectedNodes } = getNodeConnections(i);
    const isFixed = d.fx !== undefined && d.fy !== undefined;

    const nodeInfo = `
      <div style="line-height: 2.2;">
        <p style="margin: 14px 0; padding: 12px; background: white; border-radius: 4px;">
          <strong style="color: #555; font-size: 15px;">分组：</strong><br/>
          <span style="color: #333; font-size: 14px;">${G ? G[i] : 'N/A'}</span>
        </p>
        <p style="margin: 14px 0; padding: 12px; background: white; border-radius: 4px;">
          <strong style="color: #555; font-size: 15px;">商品名：</strong><br/>
          <span style="color: #333; font-size: 14px;">${N[i]}</span>
        </p>
        <p style="margin: 14px 0; padding: 12px; background: white; border-radius: 4px;">
          <strong style="color: #555; font-size: 15px;">连接数：</strong><br/>
          <span style="color: #333; font-size: 14px;">${count}</span>
        </p>
        <p style="margin: 14px 0; padding: 12px; background: white; border-radius: 4px; max-height: 350px; overflow-y: auto;">
          <strong style="color: #555; font-size: 15px;">共同购买的商品：</strong><br/>
          <span style="color: #333; font-size: 14px; line-height: 1.8;">${connectedNodes.length > 0 ? connectedNodes.join('<br/>') : '无'}</span>
        </p>
      </div>
    `;
    infoContent.html(nodeInfo);
  }

  // 鼠标悬停事件
  node.on("mouseenter", function(event, d) {
    const i = d.index;
    d3.select(this)
      .transition()
      .duration(200)
      .attr("r", (R ? R[i] : nodeRadius) * 1.5);

    const isFixed = d.fx !== undefined && d.fy !== undefined;

    statusPanel.html(`
      <div style="display: flex; align-items: center; gap: 6px;">
        <span style="font-size: 14px;">${isFixed ? '📌' : '👀'}</span>
        <span>${N[i]} ${isFixed ? '(已固定)' : ''}</span>
      </div>
    `);

    updateInfoPanel(d);
  })
  .on("mouseleave", function(event, d) {
    const i = d.index;
    d3.select(this)
      .transition()
      .duration(200)
      .attr("r", (d.index === highlightedNodeIndex) ? (R ? R[i] : nodeRadius) * 1.5 : (R ? R[i] : nodeRadius));

    if (!isHighlighted) {
      labels.style("opacity", 0);
    } else {
      labels.style("opacity", n => (n.index === highlightedNodeIndex || highlightedNeighbors.has(n.index)) ? 1 : 0);
    }

    statusPanel.html(`
      <div style="display: flex; align-items: center; gap: 6px;">
        <span style="font-size: 14px;">💡</span>
        <span>悬停/拖拽查看详情</span>
      </div>
    `);
  })
 .on("dblclick", function(event, d) {
    // 双击切换节点固定状态
    if (d.fx == null && d.fy == null) {
        // 固定节点
        d.fx = d.x;
        d.fy = d.y;
        d3.select(this)
          .attr("stroke", "#4CAF50")
          .attr("stroke-width", 3);
    } else {
        // 释放固定
        d.fx = null;
        d.fy = null;
        d3.select(this)
          .attr("stroke", nodeStroke)
          .attr("stroke-width", nodeStrokeWidth);
    }

    const i = d.index;
    const isFixed = d.fx != null && d.fy != null;
    statusPanel.html(`
      <div style="display: flex; align-items: center; gap: 6px;">
        <span style="font-size: 14px;">${isFixed ? '📌' : '👀'}</span>
        <span>${N[i]} ${isFixed ? '(已固定)' : ''}</span>
      </div>
    `);

    updateInfoPanel(d);
  });

  if (invalidation != null) invalidation.then(() => simulation.stop());

  function intern(value) {
    return value !== null && typeof value === "object" ? value.valueOf() : value;
  }

  function ticked() {
    link
      .attr("x1", d => d.source.x)
      .attr("y1", d => d.source.y)
      .attr("x2", d => d.target.x)
      .attr("y2", d => d.target.y);

    node
      .attr("cx", d => d.x)
      .attr("cy", d => d.y);

    labels
      .attr("x", d => d.x)
      .attr("y", d => d.y);
  }

  function drag(simulation) {
    function dragstarted(event) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;

      const draggedIndex = event.subject.index;
      const connectedLinks = links.filter(l =>
        l.source.index === draggedIndex || l.target.index === draggedIndex
      );

      const connectedNodeIndices = new Set();
      connectedLinks.forEach(l => {
        if (l.source.index === draggedIndex) {
          connectedNodeIndices.add(l.target.index);
        } else {
          connectedNodeIndices.add(l.source.index);
        }
      });

      link.each(function(d, i) {
        const isConnected = d.source.index === draggedIndex || d.target.index === draggedIndex;
        d3.select(this)
          .attr("stroke", isConnected ? "#ff6b6b" : (typeof linkStroke !== "function" ? linkStroke : (L ? L[i] : "#999")))
          .attr("stroke-width", isConnected ? (W ? W[i] * 2 : linkStrokeWidth * 2) : (W ? W[i] : linkStrokeWidth))
          .attr("stroke-opacity", isConnected ? 1 : 0.2);
      });

      labels.each(function(d, i) {
        if (connectedNodeIndices.has(d.index) || d.index === draggedIndex) {
          d3.select(this)
            .transition()
            .duration(200)
            .style("opacity", 1);
        }
      });

      node.each(function(d, i) {
        const isConnected = connectedNodeIndices.has(d.index) || d.index === draggedIndex;
        d3.select(this)
          .attr("opacity", isConnected ? 1 : 0.2);
      });
    }

    function dragged(event) {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    }

    function dragended(event) {
      if (!event.active) simulation.alphaTarget(0);

      if (isHighlighted) {
          updateVisualsForHighlight();
      } else {
          link.each(function(d, i) {
            d3.select(this)
              .attr("stroke", typeof linkStroke !== "function" ? linkStroke : (L ? L[i] : "#999"))
              .attr("stroke-width", W ? W[i] : linkStrokeWidth)
              .attr("stroke-opacity", linkStrokeOpacity);
          });

          labels
            .transition()
            .duration(200)
            .style("opacity", 0);

          node.attr("opacity", 1);
      }
    }

    return d3.drag()
      .on("start", dragstarted)
      .on("drag", dragged)
      .on("end", dragended);
  }

  return Object.assign(mainContainer.node(), {scales: {color}});
}
)}

export default function define(runtime, observer) {
  const main = runtime.module();
  function toString() { return this.url; }
  const fileAttachments = new Map([
    ["miserables.json", {url: new URL("./data_files/amazon.json", import.meta.url), mimeType: "application/json", toString}]
  ]);
  main.builtin("FileAttachment", runtime.fileAttachments(name => fileAttachments.get(name)));
  main.variable(observer()).define(["md"], _1);
  main.variable(observer("chart")).define("chart", ["ForceGraph","miserables","width","invalidation"], _chart);
  main.variable().define("miserables", ["FileAttachment"], _miserables);
  main.variable().define("ForceGraph", ["d3"], _ForceGraph);
  const child1 = runtime.module(define1);
  const child2 = runtime.module(define2);
  return main;
}