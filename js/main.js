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
                'border': 'black',
                'background': 'white'
            };
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
    }
};
var network = new vis.Network(container, data, options);

var cur_char_code = 97; // a

function get_next_free_node_label() {
    return String.fromCharCode(cur_char_code++);
}

function setInstructionLabel(content) {
    document.getElementById('instructionsLabel').innerHTML = content;
}

function addNode() {
    setInstructionLabel('Click in an empty space to place a new node.');
    network.addNodeMode();
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
}

function updateNodeStackLabel() {
    content = node_stack.map(node => node['label']).join(', ');
    document.getElementById('nodeStackLabel').innerHTML = 'Node stack: ' + content;
}

function simplify() {
    selected_node_ids = network.getSelectedNodes();

    // Remove deleted nodes
    selected_node_ids = selected_node_ids.filter(id => nodes.get(id) != null);

    if (selected_node_ids.length == 0) {
        setInstructionLabel('You need to select one or more nodes to simplify!');
        return;
    }

    // Push node to stack
    node = nodes.get(selected_node_ids[0]);
    node_stack.push(node);
    updateNodeStackLabel();

    // Remove node
    nodes.remove(selected_node_ids[0]);
}

function getK() {
    return document.getElementById('numRegisters').value;
}

function select() {
    if (node_stack.length == 0)
        return;

    // Pop node
    node = node_stack.pop();
    updateNodeStackLabel();

    // Add node back
    added_node_ids = nodes.add(node);

    // Find a colour for the node
    possible_colours = colours.map(x => x);
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

    colour = possible_colours[0];

    node['color']['background'] = colour;

    // Colour the node
    nodes.update(node);
}