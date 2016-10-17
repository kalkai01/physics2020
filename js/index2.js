var container = document.getElementById("divContainer");
var $container = $(container);

var $tooltip = $("#divTooltip");
var $tooltipText = $tooltip.find("span");

var $details = $("#divDetails");

var width, height;

var rawNodes;
var nodes = [];
var graph;

var coolRender = false;

function init3D(data) {
    var scene = new THREE.Scene();

    var camera = new THREE.PerspectiveCamera(75, width / height, 1, 1000);
    camera.position.z = 500;

    var renderer = new THREE.WebGLRenderer({ antialias: false });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(width, height);
    renderer.sortObjects = false;

    container.appendChild(renderer.domElement);

    var controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableZoom = true;

    var nodeGeo = coolRender ? new THREE.SphereBufferGeometry(1, 16, 10) : new THREE.SphereBufferGeometry(1, 12, 8);
    var nodeGroup = new THREE.Object3D();
    
    var positions = new Float32Array(data.edges.length * 6), indices = [];
    
    var lineMaterial = new THREE.LineBasicMaterial({ color: 0xbbbbbb, opacity: 0.2, transparent: true });
    var lineGeo = new THREE.BufferGeometry();

    var processing = false;

    var instance = {
        showNode: function (id) {
            processing = true;

            if (id == null) {
                $.each(nodeGroup.children, function (i, n) {
                    n.visible = true;
                });

                lineGeo.setIndex(new THREE.BufferAttribute(new Uint16Array(indices), 1));
                
                // hide details
                $details.css("right", "-300px");
                
            } else {
                var currentNode = nodes[id];

                $.each(nodeGroup.children, function(i, n) {
                    n.visible = (n.node_id == id || currentNode.links.indexOf(n.node_id) >= 0);
                });

                lineGeo.setIndex(new THREE.BufferAttribute(new Uint16Array(currentNode.indices), 1));
                
                // show details
                var html = "<h2>" + currentNode.label + "</h2><hr/>";
                
                html += "<p><b>Modularity Class</b>: " + currentNode.attributes["Modularity Class"] + "</p>";
                html += "<p><b>Eccentricity</b>: " + currentNode.attributes["Eccentricity"] + "</p>";
                html += "<p><b>Closeness Centrality</b>: " + currentNode.attributes["Closeness Centrality"] + "</p>";
                html += "<p><b>Betweenness Centrality</b>: " + currentNode.attributes["Betweenness Centrality"] + "</p>";
                html += "<p><b>Harmonic Closeness Centrality</b>: " + currentNode.attributes["Harmonic Closeness Centrality"] + "</p>";

                html += "<p class='links'><b>Connections</b>:<br/>";
                
                $.each(currentNode.links, function (i2, l) {
                    var linkedNode = nodes[l];
                    html += "<a href='javascript:void(0);' data-id='" + linkedNode.id + "'>" + linkedNode.label + "</a><br/>";
                });

                html += "</p>";

                $details.find(".panel-content").html(html);

                $details.css("right", "0");
            }

            processing = false;
            //render();
        }
    };
    
    if (coolRender) {
        var light1 = new THREE.AmbientLight(0xffffff, 0.5);
        scene.add(light1);

        var light2 = new THREE.DirectionalLight(0xffffff, 1);
        light2.position.set(0, 1, 0);
        scene.add(light2);
    }
    
    $.each(data.nodes, function (i, n) {
        //if (i > 200) return;

        n.lcLabel = n.label.toLowerCase();
        n.indices = [];
        n.links = [];
        
        n.z = Math.sqrt(Math.abs(80000 - (n.x * n.x + n.y * n.y))) * (n.id % 2 == 0 ? 1 : -1);

        if (n.size > 2 && n.size < 19) {
            var ratio = 1 - n.size / 20;
            n.x = n.x * ratio;
            n.y = n.y * ratio;
            n.z = n.z * ratio;
        }

        nodes[n.id] = n;

        var mesh = new THREE.Mesh(nodeGeo, coolRender ? new THREE.MeshLambertMaterial({ color: n.color }) : new THREE.MeshBasicMaterial({ color: n.color }));
        mesh.matrixAutoUpdate = false;

        mesh.position.x = n.x;
        mesh.position.y = n.y;
        mesh.position.z = n.z;

        mesh.scale.x = n.size;
        mesh.scale.y = n.size;
        mesh.scale.z = n.size;

        mesh.node_id = n.id;
        mesh.node_name = n.label;

        mesh.updateMatrix();
        nodeGroup.add(mesh);
    });

    scene.add(nodeGroup);

    $.each(data.edges, function (i, e) {
        var source = nodes[e.source], target = nodes[e.target];
        if (source == null || target == null) return;

        var rootIndex = i * 6;

        positions[rootIndex] = source.x;
        positions[rootIndex + 1] = source.y;
        positions[rootIndex + 2] = source.z;

        positions[rootIndex + 3] = target.x;
        positions[rootIndex + 4] = target.y;
        positions[rootIndex + 5] = target.z;

        indices.push(i * 2);
        indices.push(i * 2 + 1);

        source.links.push(target.id);
        target.links.push(source.id);

        source.indices.push(i * 2);
        source.indices.push(i * 2 + 1);
        target.indices.push(i * 2);
        target.indices.push(i * 2 + 1);
    });

    lineGeo.addAttribute('position', new THREE.BufferAttribute(positions, 3));
    lineGeo.setIndex(new THREE.BufferAttribute(new Uint16Array(indices), 1));

    var line = new THREE.LineSegments(lineGeo, lineMaterial);
    scene.add(line);

    var raycaster = new THREE.Raycaster();
    var mouse = new THREE.Vector2(), clientPos = new THREE.Vector2(), intersected;

    var stats = new Stats();
    container.appendChild(stats.dom);

    container.addEventListener('mousemove', on3DMouseMove, false);
    container.addEventListener('click', on3DMouseClick, false);

    function on3DMouseMove(event) {
        event.preventDefault();

        clientPos.x = event.clientX;
        clientPos.y = event.clientY;

        mouse.x = (event.clientX / width) * 2 - 1;
        mouse.y = -(event.clientY / height) * 2 + 1;
    }
    
    function on3DMouseClick(event) {
        event.preventDefault();

        if (intersected != null) {
            graph.showNode(intersected.node_id);
        }
    }

    function animate() {
        requestAnimationFrame(animate);
        controls.update();
        render();
        stats.update();
    }

    function render() {
        if (processing) return;

        raycaster.setFromCamera(mouse, camera);

        var intersects = raycaster.intersectObjects(nodeGroup.children);

        if (intersects.length > 0) {
            if (intersected != intersects[0].object) {
                if (intersected) {
                    intersected.material.color.setHex(intersected.originColor);
                } else {
                    $tooltip.show();
                }

                intersected = intersects[0].object;
                intersected.originColor = intersected.material.color.getHex();
                intersected.material.color.setHex(0xffffff);

                $tooltip.css("top", clientPos.y - 5);
                $tooltip.css("left", clientPos.x + 20);

                $tooltipText.css("color", "#" + (0x1000000 + intersected.originColor).toString(16).slice(1));
                $tooltipText.html(intersected.node_name);
            }
        } else {
            if (intersected) intersected.material.color.setHex(intersected.originColor);
            intersected = null;

            $tooltip.hide();
        }

        renderer.render(scene, camera);
    }

    animate();

    return instance;
}

function scanValue(data) {
    var maxTemp = 0;
    var minSize = 100, maxSize = 0;

    $.each(data.nodes, function (i, n) {
        var temp = n.x * n.x + n.y * n.y;
        if (maxTemp < temp) maxTemp = temp;

        if (minSize > n.size) minSize = n.size;
        if (maxSize < n.size) maxSize = n.size;
    });

    $container.html(maxTemp + "<br/>" + minSize + " - " + maxSize);
}

function hideAbout() {
    $("#divAbout").fadeTo(500, 0, function () {
        $(this).hide();
    });
}

function search() {
    var query = $("#divSearch .search-query").find("input[type='text']").val().trim().toLowerCase();
    var divResult = $("#divSearch .search-query").find(".results");

    var matches = [];
    var html = "";

    if (query.length < 3) {
        html = "<span>You must search for a name with a minimum of 3 letters.</span>";
    } else {
        
        $.each(rawNodes, function (i, n) {
            if (n.lcLabel.indexOf(query) >= 0) {
                matches.push(n);
            }
        });
        
        if (matches.length == 0) {
            html = "<span>No results found.</span>";
        } else {
            html += "<span>" + matches.length + " results:</span><br/>";
            html += "<ul>";
            
            $.each(matches, function (i2, m) {
                html += "<li><a href='javascript:void(0);' data-id='" + m.id + "'>" + m.label + "</a></li>";
            });

            html += "</ul>";
        }
    }

    divResult.html(html);

    if (matches.length == 0) {
        graph.showNode();
    } else {
        graph.showNode(matches[0].id);
    }
}

$(document).ready(function () {
    $("#divSearch .about").click(function() {
        $("#divAbout").fadeTo(500, 1);
    });

    $("#divAbout").click(function() {
        hideAbout();
    });
    
    $("#divAbout .dialog-content").click(function () {
        return false;
    });
    
    $("#divAbout .dialog-close").click(function () {
        hideAbout();
        return false;
    });

    $("#divSearch .search-query").on("keypress", "input[type='text']", function(e) {
        if (e.keyCode == 13) {
            search();
            return false;
        }
    });
    
    $("#divSearch .search-query").on("click", "span", function () {
        search();
    });
    
    $("#divSearch .results").on("click", "a", function () {
        graph.showNode($(this).attr("data-id"));
    });
    
    $("#divDetails").on("click", ".links a", function () {
        graph.showNode($(this).attr("data-id"));
    });
    
    $("#divDetails .panel-close").click(function () {
        graph.showNode();
    });
    
    $("#divDetails .panel-close-link").click(function () {
        graph.showNode();
    });
    
    $.getJSON("data.json", function (data) {
        width = $container.width();
        height = $container.height();

        rawNodes = data.nodes;

        graph = init3D(data);
        
        //scanValue(data);
    });
});