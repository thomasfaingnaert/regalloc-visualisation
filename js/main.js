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

function setPhysics() {
    options.physics.enabled = $('#physicsCheckBox').is(':checked');
    network.setOptions(options);
}

var cur_char_code = 97; // a

function get_next_free_node_label() {
    return String.fromCharCode(cur_char_code++);
}

var cur_precoloured_label = 1;

function get_next_free_precoloured_node_label() {
    return (cur_precoloured_label++).toString();
}

function setInstructionLabel(content) {
    document.getElementById('instructionsLabel').innerHTML = content;
}

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
    else if (event.key == 'l')
        select();
    else if (event.key == 'c')
        coalesce();
}

function updateNodeStackLabel() {
    var content = node_stack.map(node => node['label']).join(', ');
    document.getElementById('nodeStackLabel').innerHTML = 'Node stack: ' + content;
}

function simplify() {
    var selected_node_ids = network.getSelectedNodes();

    // Remove deleted nodes
    selected_node_ids = selected_node_ids.filter(id => nodes.get(id) != null);

    if (selected_node_ids.length != 1) {
        setInstructionLabel('You need to select exactly one node to simplify!');
        return;
    }

    // Push node to stack
    var node = nodes.get(selected_node_ids[0]);
    node_stack.push(node);
    updateNodeStackLabel();

    // Remove node
    nodes.remove(selected_node_ids[0]);
}

function getK() {
    return $('#numRegisters').val();
}

function setK(value) {
    $('#numRegisters').val(parseInt(value));
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

function coalesce() {
    var selected_node_ids = network.getSelectedNodes();

    // Remove deleted nodes
    var selected_node_ids = selected_node_ids.filter(id => nodes.get(id) != null);

    if (selected_node_ids.length != 2) {
        setInstructionLabel('You need to select exactly two nodes to coalesce!');
        return;
    }

    // Get the selected nodes
    var node1 = nodes.get(selected_node_ids[0]);
    var node2 = nodes.get(selected_node_ids[1]);

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

        if (value['from'] == selected_node_ids[1] && value['to'] != selected_node_ids[0]) {
            neighbour = nodes.get(value['to']);
        } else if (value['to'] == selected_node_ids[1] && value['from'] != selected_node_ids[0]) {
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
}

function exportNetwork() {
    var exportValue = JSON.stringify({
        nodes: exportNodes(),
        edges: exportEdges(),
        K: getK()
    }, undefined, 2);

    $('#exportJSONTextArea').val(exportValue);
    $('#exportModal').modal();
}

function exportNodes() {
    return nodes.getIds().map(nodeid => {
        return {
            id: nodeid,
            label: nodes.get(nodeid).label,
            x: network.getPosition(nodeid).x,
            y: network.getPosition(nodeid).y
        };
    });
}

function exportEdges() {
    return edges.getIds().map(edgeid => {
        return {
            from: edges.get(edgeid).from,
            to: edges.get(edgeid).to,
            dashes: edges.get(edgeid).dashes
        };
    })
}

function showImportDialog() {
    $('#importModal').modal();
}

function importNetwork() {
    var importValue = $('#importJSONTextArea').val();

    nodes.clear();
    edges.clear();

    var inputData = JSON.parse(importValue);

    importNodes(inputData['nodes']);
    importEdges(inputData['edges']);
    setK(inputData['K']);
}

function importNodes(nodeData) {
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

function importEdges(edgeData) {
    edgeData.forEach(function (edge) {
        edges.add({
            from: edge.from,
            to: edge.to,
            dashes: edge.dashes
        })
    });
}
