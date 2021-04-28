/**
 * Export the nodes to a JSON-compatible format.
 * @param {vis.DataSet} nodes The DataSet containing the nodes.
 * @param {vis.Network} network The Network used by the node DataSet.
 * @returns The exported node data.
 */
export function exportNodes(nodes, network) {
    return nodes.getIds().map(nodeid => {
        return {
            id: nodeid,
            label: nodes.get(nodeid).label,
            x: network.getPosition(nodeid).x,
            y: network.getPosition(nodeid).y
        };
    });
}

/**
 * Export edges to a JSON-compatible format.
 * @param {vis.DataSet} edges The DataSet containing the edges.
 * @returns The exported edge data.
 */
export function exportEdges(edges) {
    return edges.getIds().map(edgeid => {
        return {
            from: edges.get(edgeid).from,
            to: edges.get(edgeid).to,
            dashes: edges.get(edgeid).dashes
        };
    })
}

/**
 * Import nodes from a JSON export. Existing nodes are deleted.
 * @param {vis.DataSet} nodes The DataSet containing the nodes.
 * @param {Object} nodeData The node data to import.
 */
export function importNodes(nodes, nodeData) {
    nodes.clear();

    nodeData.forEach(function (node) {
        nodes.add({
            id: node.id,
            label: node.label,
            x: node.x,
            y: node.y,
            color: {
                background: 'white'
            }
        });
    });
}

/**
 * Import edges from a JSON export. Existing edges are deleted.
 * @param {vis.DataSet} edges The DataSet containing the edges.
 * @param {Object} edgeData The edge data to import.
 */
export function importEdges(edges, edgeData) {
    edges.clear();

    edgeData.forEach(function (edge) {
        edges.add({
            from: edge.from,
            to: edge.to,
            dashes: edge.dashes
        })
    });
}