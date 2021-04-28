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
        var num_neighbours = 0;
        var is_move_related = false;

        network.getConnectedEdges(selected_node_id).forEach(edge_id => {
            if (edges.get(edge_id)['dashes']) {
                is_move_related = true;
            } else {
                num_neighbours++;
            }
        });

        if (is_move_related) {
            setInstructionLabel('Cannot simplify move-related nodes!');
            return false;
        }

        if (num_neighbours >= getK()) {
            setInstructionLabel(`Cannot simplify node of significant degree: ${num_neighbours} >= K!`);
            return false;
        }

        return true;
    });
}

function candidateSpill() {
    simplifyHelper((selected_node_id) => {
        // Conditions:
        // 1) >= K neighbours
        // AND
        // 2) non-MOVE related
        var num_neighbours = 0;
        var is_move_related = false;

        network.getConnectedEdges(selected_node_id).forEach(edge_id => {
            if (edges.get(edge_id)['dashes']) {
                is_move_related = true;
            } else {
                num_neighbours++;
            }
        });

        if (is_move_related) {
            setInstructionLabel('Cannot spill move-related nodes!');
            return false;
        }

        if (num_neighbours < getK()) {
            setInstructionLabel(`Cannot spill node of insignificant degree: ${num_neighbours} < K, you should simplify instead!`);
            return false;
        }

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

    edges.forEach(function (value) {
        if (value['from'] == added_node_ids[0]) {
            n = nodes.get(value['to']);
            if (n != null)
                possible_colours = possible_colours.filter(x => x != n['color']['background']);
        }
        if (value['to'] == added_node_ids[0]) {
            n = nodes.get(value['from']);
            if (n != null)
                possible_colours = possible_colours.filter(x => x != n['color']['background']);
        }
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
        var neighbour = null;

        if (value['from'] == node_id_2 && value['to'] != node_id_1) {
            neighbour = nodes.get(value['to']);
        } else if (value['to'] == node_id_2 && value['from'] != node_id_1) {
            neighbour = nodes.get(value['from']);
        }

        if (neighbour == null)
            return;

        // Now, iterate over all edges around node1
        var found = false;

        edges.forEach(function (edge) {
            // Is this edge the one we are looking for?
            if ((edge['from'] == neighbour['id'] && edge['to'] == node1['id']) ||
                (edge['from'] == node1['id'] && edge['to'] == neighbour['id'])) {
                // Yes, so merge them
                edge['dashes'] = edge['dashes'] && value['dashes'];
                edges.update(edge);

                found = true;
            }
        });

        // If we haven't found an edge, we have to create a new one
        if (!found) {
            edges.add({ 'from': node1['id'], 'to': neighbour['id'], 'dashes': value['dashes'] });
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

// Get the neighbours of a node with given ID.
// The optional move_edges parameter determines whether to follow
// interference or move-related edges.
function getNeighbourIds(edges, node_id, move_edges = false) {
    var neighbour_ids = [];

    edges.forEach(edge => {
        // Edge type must match.
        if (edge['dashes'] != move_edges) {
            return;
        }

        if (edge['from'] == node_id) {
            neighbour_ids.push(edge['to']);
        }
        if (edge['to'] == node_id) {
            neighbour_ids.push(edge['from']);
        }
    });

    return neighbour_ids;
}

// Get the degree of a node with given ID
function getDegree(edges, node_id) {
    return getNeighbourIds(edges, node_id).length;
}

// Returns true iff two nodes are move-related.
function areMoveRelated(edges, node_1_id, node_2_id) {
    return getNeighbourIds(edges, node_1_id, true).includes(node_2_id);
}

// Returns true iff two nodes interfere.
function interfere(edges, node_1_id, node_2_id) {
    return getNeighbourIds(edges, node_1_id, false).includes(node_2_id);
}

function coalesceBriggs() {
    coalesceHelper((node_a_id, node_b_id) => {
        // Conditions:
        // 1) nodes MUST NOT interfere
        // 2) nodes MUST be move-related
        // 3) Brigg's criterion must hold:
        //      - the resulting node ab must have < K
        //        neighbours of degree >= K

        if (interfere(edges, node_a_id, node_b_id)) {
            setInstructionLabel('Cannot coalesce nodes that interfere!');
            return false;
        }

        if (!areMoveRelated(edges, node_a_id, node_b_id)) {
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

        var num_significant_neighbours = 0;

        var neighbour_ids = getNeighbourIds(new_edges, coalesced_node_id);

        neighbour_ids.forEach((neighbour_id) => {
            if (getDegree(new_edges, neighbour_id) >= getK()) {
                num_significant_neighbours++;
            }
        });

        if (num_significant_neighbours >= getK()) {
            setInstructionLabel(`Cannot coalesce according to the Briggs heuristic: coalesced node will have ${num_significant_neighbours} >= K neighbours of significant degree!`);
            return false;
        }

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
        if (interfere(edges, node_a_id, node_b_id)) {
            setInstructionLabel('Cannot coalesce nodes that interfere!');
            return false;
        }

        if (!areMoveRelated(edges, node_a_id, node_b_id)) {
            setInstructionLabel('Cannot coalesce nodes that are not move-related!');
            return false;
        }

        // Helper function for George
        var george_criterion = (node_a_id, node_b_id) => {
            var neighbours_a = getNeighbourIds(edges, node_a_id);
            var neighbours_b = getNeighbourIds(edges, node_b_id);

            return neighbours_a.every(t => {
                return neighbours_b.includes(t) || getDegree(edges, t) < getK();
            });
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