/**********************************************************
 * Module imports
 *********************************************************/

import { exportNodes, exportEdges, importNodes, importEdges } from "./export.js";

/**********************************************************
 * Global variables, and vis.js network initialisation
 *********************************************************/

var colours = ['lightblue', 'orange', 'green', 'red', 'purple', 'brown', 'pink', 'cyan'];

var node_stack = []

var create_move_edge = false;

var nodes = new vis.DataSet([]);
var edges = new vis.DataSet([]);

var container = document.getElementById("network");

var data = {
    nodes: nodes,
    edges: edges
};

var cur_char_code = 97; // a

function get_next_free_node_label() {
    return String.fromCharCode(cur_char_code++);
}

var options = {
    manipulation: {
        enabled: false,

        addNode: function (data, callback) {
            data['label'] = get_next_free_node_label();
            data['color'] = {
                'background': 'white'
            }

            callback(data);

            // Keep adding nodes
            network.addNodeMode();
        },

        addEdge: function (data, callback) {
            data['dashes'] = create_move_edge;
            callback(data);

            // Keep adding edges
            network.addEdgeMode();
        }
    },

    physics: {
        enabled: false
    },

    interaction: {
        multiselect: true,
        selectConnectedEdges: true
    },

    nodes: {
        color: {
            border: 'black',
            background: 'white'
        }
    }
};

var network = new vis.Network(container, data, options);

/**********************************************************
 * Update UI
 *********************************************************/

function setInstructionLabel(content) {
    document.getElementById('instructionsLabel').innerHTML = content;
}

function updateNodeStackLabel() {
    var content = node_stack.map(node => node['label']).join(', ');
    document.getElementById('nodeStackLabel').innerHTML = 'Node stack: ' + content;
}

/**********************************************************
 * Keyboard shortcuts
 *********************************************************/

document.onkeydown = function (event) {
    event = event || window.event;

    if (event.key == 'n')
        addNode();
    else if (event.key == 'p')
        addPrecolouredNodes();
    else if (event.key == 'i')
        addInterferenceEdge();
    else if (event.key == 'm')
        addMoveEdge();
    else if (event.key == 'x')
        exitEditMode();
    else if (event.key == 'd')
        deleteSelected();
    else if (event.key == 's')
        simplify();
    else if (event.key == 'c')
        candidateSpill();
    else if (event.key == 'l')
        select();
    else if (event.key == 'b')
        coalesceBriggs();
    else if (event.key == 'g')
        coalesceGeorge();
}

/**********************************************************
 * Graph editing: add/delete edges/nodes
 *********************************************************/

function addNode() {
    setInstructionLabel('Click in an empty space to place a new node.');
    network.addNodeMode();
}

function addPrecolouredNodes() {
    var added_node_ids = [];

    // Add nodes
    for (var i = 0; i < getK(); ++i) {
        added_node_ids = added_node_ids.concat(nodes.add({
            label: (i + 1).toString(),
            color: {
                background: 'white'
            }
        }));
    }

    // Run physics, because otherwise all these nodes overlap
    network.stabilize();

    // Add edges between each pair of nodes
    for (var i = 0; i < added_node_ids.length; ++i) {
        for (var j = i + 1; j < added_node_ids.length; ++j) {
            edges.add({ 'from': added_node_ids[i], 'to': added_node_ids[j], 'dashes': false });
        }
    }
}

function addInterferenceEdge() {
    setInstructionLabel('Click on a node and drag the edge to another node to connect them.');
    create_move_edge = false;
    network.addEdgeMode();
}

function addMoveEdge() {
    setInstructionLabel('Click on a node and drag the edge to another node to connect them.');
    create_move_edge = true;
    network.addEdgeMode();
}

function exitEditMode() {
    network.disableEditMode();
    setInstructionLabel("&nbsp;");
}

function deleteSelected() {
    network.deleteSelected();
}

/**********************************************************
 * Helper functions
 *********************************************************/

/**
 * Gets the neighbours of the node with the given ID. The move_edges parameter determines whether to follow only interference, or only move-related edges.
 * @param {vis.DataSet} nodes The DataSet containing the nodes.
 * @param {vis.DataSet} edges The DataSet containing the edges.
 * @param {string} node_id The ID of the node.
 * @param {boolean} move_edges If true, follow only move-related edges; if false (default), follow only interference edges.
 * @returns An Array containing the IDs of the neighbouring nodes.
 */
function getNeighbourIds(nodes, edges, node_id, move_edges = false) {
    var neighbour_ids = [];

    edges.forEach(edge => {
        // Edge type must match.
        if (edge['dashes'] != move_edges) {
            return;
        }

        // Both endpoints must not be deleted.
        if (nodes.get(edge['from']) == null) {
            return;
        }

        if (nodes.get(edge['to']) == null) {
            return;
        }

        // Either endpoint must match the given node.
        if (edge['from'] == node_id) {
            neighbour_ids.push(edge['to']);
        }
        if (edge['to'] == node_id) {
            neighbour_ids.push(edge['from']);
        }
    });

    return neighbour_ids;
}

/**
 * Checks whether a node is move related, i.e. has a neighbour connect to it via a move edge.
 * @param {vis.DataSet} nodes The DataSet containing the nodes.
 * @param {vis.DataSet} edges The DataSet containing the edges.
 * @param {string} node_id The ID of the node.
 * @returns True iff the given node is move related.
 */
function isMoveRelated(nodes, edges, node_id) {
    return getNeighbourIds(nodes, edges, node_id, true).length > 0;
}

/**
 * Gets the degree of the node with the given ID, i.e. the number of nodes that are connected to it via interference edges.
 * @param {vis.DataSet} nodes The DataSet containing the nodes.
 * @param {vis.DataSet} edges The DataSet containing the edges.
 * @param {string} node_id The ID of the node.
 * @returns The degree of the given node.
 */
function getDegree(nodes, edges, node_id) {
    return getNeighbourIds(nodes, edges, node_id).length;
}

/**
 * Checks whether two nodes are move related, i.e. are connected by a move-related edge.
 * @param {vis.DataSet} nodes The DataSet containing the nodes.
 * @param {vis.DataSet} edges The DataSet containing the edges.
 * @param {string} node_1_id The ID of the first node.
 * @param {string} node_2_id The ID of the second node.
 * @returns True iff the two nodes are move related.
 */
function areMoveRelated(nodes, edges, node_1_id, node_2_id) {
    return getNeighbourIds(nodes, edges, node_1_id, true).includes(node_2_id);
}

/**
 * Checks whether two nodes interfere, i.e. are connected by an interference edge.
 * @param {vis.DataSet} nodes The DataSet containing the nodes.
 * @param {vis.DataSet} edges The DataSet containing the edges.
 * @param {string} node_1_id The ID of the first node.
 * @param {string} node_2_id The ID of the second node.
 * @returns True iff the two nodes interfere.
 */
function interfere(nodes, edges, node_1_id, node_2_id) {
    return getNeighbourIds(nodes, edges, node_1_id, false).includes(node_2_id);
}

/**
 * Merges two nodes in a graph.
 * @param {vis.DataSet} nodes The DataSet containing the nodes.
 * @param {vis.DataSet} edges The DataSet containing the edges.
 * @param {string} node_id_1 The ID of the first node to merge.
 * @param {string} node_id_2 The ID of the second node to merge.
 * @returns The ID of the merged node.
 */
function mergeNodes(nodes, edges, node_id_1, node_id_2) {
    // Get the selected nodes
    var node1 = nodes.get(node_id_1);
    var node2 = nodes.get(node_id_2);

    // First, update the label of the first node
    // Sort new label text (e.g. bca --> abc)
    var new_label = node1['label'] + node2['label'];
    new_label = new_label.split('').sort().join('');
    node1['label'] = new_label;

    // Add all edges from node2 to node1 as well
    // First, iterate over all neighbours of node2
    edges.forEach(function (value) {
        // Get the neighbour of node2
        var neighbour_id;

        if (value['from'] == node_id_2 && value['to'] != node_id_1) {
            neighbour_id = value['to'];
        } else if (value['to'] == node_id_2 && value['from'] != node_id_1) {
            neighbour_id = value['from'];
        } else {
            return;
        }

        // Now, iterate over all edges around node1
        var found = false;

        edges.forEach(function (edge) {
            // Is this edge the one we are looking for?
            if ((edge['from'] == neighbour_id && edge['to'] == node1['id']) ||
                (edge['from'] == node1['id'] && edge['to'] == neighbour_id)) {
                // Yes, so merge them
                edge['dashes'] = edge['dashes'] && value['dashes'];
                edges.update(edge);

                found = true;
            }
        });

        // If we haven't found an edge, we have to create a new one
        if (!found) {
            edges.add({ 'from': node1['id'], 'to': neighbour_id, 'dashes': value['dashes'] });
        }
    });

    // Propagate changes to node 1
    nodes.update(node1);

    // Delete node 2
    nodes.remove(node2);

    // Delete any edges connected to node 2
    var edges_to_delete = [];

    edges.forEach(edge => {
        if ((edge['from'] == node_id_2) || (edge['to'] == node_id_2)) {
            edges_to_delete.push(edge);
        }
    });
    edges.remove(edges_to_delete);

    // Return ID of merged node
    return node_id_1;
}

/**********************************************************
 * Register allocation algorithm actions
 *********************************************************/

// Helper function for simplify and candidate spills.
function simplifyHelper(condition_callback) {
    var selected_node_ids = network.getSelectedNodes();

    // Remove deleted nodes
    selected_node_ids = selected_node_ids.filter(id => nodes.get(id) != null);

    if (selected_node_ids.length != 1) {
        setInstructionLabel('You need to select exactly one node to simplify!');
        return;
    }

    // Check condition
    if (!condition_callback(selected_node_ids[0])) {
        return;
    }

    // Push node to stack
    var node = nodes.get(selected_node_ids[0]);
    node_stack.push(node);
    updateNodeStackLabel();

    // Remove node
    nodes.remove(selected_node_ids[0]);
}

function simplify() {
    simplifyHelper((selected_node_id) => {
        // Conditions:
        // 1) <K neighbours
        // AND
        // 2) non-MOVE related

        if (isMoveRelated(nodes, edges, selected_node_id)) {
            setInstructionLabel('Cannot simplify move-related nodes!');
            return false;
        }

        var degree = getDegree(nodes, edges, selected_node_id);

        if (degree >= getK()) {
            setInstructionLabel(`Cannot simplify node of significant degree: ${degree} >= K!`);
            return false;
        }

        setInstructionLabel(`Simplified node of insignificant degree: ${degree} < K.`);
        return true;
    });
}

function candidateSpill() {
    simplifyHelper((selected_node_id) => {
        // Conditions:
        // 1) >= K neighbours
        // AND
        // 2) non-MOVE related

        if (isMoveRelated(nodes, edges, selected_node_id)) {
            setInstructionLabel('Cannot spill move-related nodes!');
            return false;
        }

        var degree = getDegree(nodes, edges, selected_node_id);

        if (degree < getK()) {
            setInstructionLabel(`Cannot spill node of insignificant degree: ${degree} < K, you should simplify instead!`);
            return false;
        }

        setInstructionLabel(`Spilled node of significant degree: ${degree} >= K.`);
        return true;
    });
}

function select() {
    if (node_stack.length == 0)
        return;

    // Pop node
    var node = node_stack.pop();
    updateNodeStackLabel();

    // Add node back
    var added_node_ids = nodes.add(node);

    // Find a colour for the node
    var possible_colours = colours.map(x => x);
    possible_colours = possible_colours.slice(0, getK());

    getNeighbourIds(nodes, edges, added_node_ids[0]).forEach(node_id => {
        var c = nodes.get(node_id)['color']['background'];
        possible_colours = possible_colours.filter(x => x != c);
    });

    if (possible_colours.length == 0) {
        alert('Node cannot be coloured: no colours left!');
        return;
    }

    var colour = possible_colours[0];

    node['color']['background'] = colour;

    // Colour the node
    nodes.update(node);
}

function coalesceHelper(condition_callback) {
    var selected_node_ids = network.getSelectedNodes();

    // Remove deleted nodes
    var selected_node_ids = selected_node_ids.filter(id => nodes.get(id) != null);

    if (selected_node_ids.length != 2) {
        setInstructionLabel('You need to select exactly two nodes to coalesce!');
        return;
    }

    // Check condition
    if (!condition_callback(selected_node_ids[0], selected_node_ids[1])) {
        return false;
    }

    mergeNodes(nodes, edges, selected_node_ids[0], selected_node_ids[1]);
}

function coalesceBriggs() {
    coalesceHelper((node_a_id, node_b_id) => {
        // Conditions:
        // 1) nodes MUST NOT interfere
        // 2) nodes MUST be move-related
        // 3) Brigg's criterion must hold:
        //      - the resulting node ab must have < K
        //        neighbours of degree >= K

        if (interfere(nodes, edges, node_a_id, node_b_id)) {
            setInstructionLabel('Cannot coalesce nodes that interfere!');
            return false;
        }

        if (!areMoveRelated(nodes, edges, node_a_id, node_b_id)) {
            setInstructionLabel('Cannot coalesce nodes that are not move-related!');
            return false;
        }

        // Create deep copy of graph
        var new_nodes = new vis.DataSet();
        var new_edges = new vis.DataSet();

        nodes.forEach(node => { new_nodes.add({ ...node }); });
        edges.forEach(edge => { new_edges.add({ ...edge }); });

        // Merge a and b in this new graph
        var coalesced_node_id = mergeNodes(new_nodes, new_edges, node_a_id, node_b_id);

        var neighbour_ids = getNeighbourIds(new_nodes, new_edges, coalesced_node_id);
        var significant_neighbours = [];

        neighbour_ids.forEach((neighbour_id) => {
            if (getDegree(new_nodes, new_edges, neighbour_id) >= getK()) {
                var label = new_nodes.get(neighbour_id)['label'];
                significant_neighbours.push(label);
            }
        });

        if (significant_neighbours.length >= getK()) {
            setInstructionLabel(`Cannot coalesce according to the Briggs heuristic: coalesced node will have ${significant_neighbours.length} >= K neighbours of significant degree (${significant_neighbours})!`);
            return false;
        }

        setInstructionLabel(`Coalesced nodes using Briggs: resulting node has ${significant_neighbours.length} < K neighbours of significant degree (${significant_neighbours}).`);
        return true;
    });
}

function coalesceGeorge() {
    coalesceHelper((node_a_id, node_b_id) => {
        // Conditions:
        // 1) nodes MUST NOT interfere
        // 2) nodes MUST be move-related
        // 3) George's criterion must hold:
        //      - every neighbour t of a must either:
        //          a) be a neighbour of b, OR
        //          b) have degree < K
        //          (or with a and b reversed)
        if (interfere(nodes, edges, node_a_id, node_b_id)) {
            setInstructionLabel('Cannot coalesce nodes that interfere!');
            return false;
        }

        if (!areMoveRelated(nodes, edges, node_a_id, node_b_id)) {
            setInstructionLabel('Cannot coalesce nodes that are not move-related!');
            return false;
        }

        // Helper function for George
        var george_criterion = (node_a_id, node_b_id) => {
            var neighbours_a = getNeighbourIds(nodes, edges, node_a_id);
            var neighbours_b = getNeighbourIds(nodes, edges, node_b_id);

            // Every neighbour t of a must either:
            // a) be a neighbour of b, or
            // b) have degree < K

            // Equivalently, we can say that:
            // Every significant-degree neighbour of a
            // must be a neighbour of b.
            var significant_degree_neighbours = neighbours_a.filter(t => getDegree(nodes, edges, t) >= getK());

            var are_neighbours_of_b = significant_degree_neighbours.every(t => neighbours_b.includes(t));

            if (are_neighbours_of_b) {
                var get_label = (id) => nodes.get(id)['label'];

                setInstructionLabel(`Can coalesce according to George: all significant-degree neighbours of ${get_label(node_a_id)} (${significant_degree_neighbours.map(get_label)}) are also neighbours of ${get_label(node_b_id)}.`);
            }

            return are_neighbours_of_b;
        };

        if (!george_criterion(node_a_id, node_b_id) && !george_criterion(node_b_id, node_a_id)) {
            setInstructionLabel('Cannot coalesce according to the George heuristic!');
            return false;
        }

        return true;
    });
}

/**********************************************************
 * Network import and export
 *********************************************************/

function exportNetwork() {
    var exportValue = JSON.stringify({
        nodes: exportNodes(nodes, network),
        edges: exportEdges(edges),
        K: getK()
    }, undefined, 2);

    $('#exportJSONTextArea').val(exportValue);
    $('#exportModal').modal();
}

function showImportDialog() {
    $('#importModal').modal();
}

function importNetwork() {
    var importValue = $('#importJSONTextArea').val();
    var inputData = JSON.parse(importValue);

    importNodes(nodes, inputData['nodes']);
    importEdges(edges, inputData['edges']);
    setK(inputData['K']);
}

function importExample(example) {
    $.getJSON(`examples/${example}.json`, function (inputData) {
        importNodes(nodes, inputData['nodes']);
        importEdges(edges, inputData['edges']);
        setK(inputData['K']);
    });
}

// Check if we need to load an example
var example = new URLSearchParams(window.location.search).get('example');
if (example != null) {
    importExample(example);
}

/**********************************************************
 * General settings (number of registers, physics)
 *********************************************************/

function getK() {
    return $('#numRegisters').val();
}

function setK(value) {
    $('#numRegisters').val(parseInt(value));
}

function setPhysics() {
    options.physics.enabled = $('#physicsCheckBox').is(':checked');
    network.setOptions(options);
}

/**********************************************************
 * Event listener registration
 *********************************************************/

document.querySelector('#addNodeButton').addEventListener('click', addNode);
document.querySelector('#addPrecolouredNodesButton').addEventListener('click', addPrecolouredNodes);
document.querySelector('#addInterferenceEdgeButton').addEventListener('click', addInterferenceEdge);
document.querySelector('#addMoveEdgeButton').addEventListener('click', addMoveEdge);
document.querySelector('#exitEditModeButton').addEventListener('click', exitEditMode);
document.querySelector('#deleteSelectedButton').addEventListener('click', deleteSelected);
document.querySelector('#simplifyButton').addEventListener('click', simplify);
document.querySelector('#coalesceBriggsButton').addEventListener('click', coalesceBriggs);
document.querySelector('#coalesceGeorgeButton').addEventListener('click', coalesceGeorge);
document.querySelector('#candidateSpillButton').addEventListener('click', candidateSpill);
document.querySelector('#selectButton').addEventListener('click', select);
document.querySelector('#showImportDialogButton').addEventListener('click', showImportDialog);
document.querySelector('#exportNetworkButton').addEventListener('click', exportNetwork);
document.querySelector('#importNetworkButton').addEventListener('click', importNetwork);
document.querySelector('#physicsCheckBox').addEventListener('click', setPhysics);