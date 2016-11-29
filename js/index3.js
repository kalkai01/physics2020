var container = d3.select("#divContainer");
var $container = $("#divContainer");

var data, chartData;

var dictClass = [], dictOrg = [], dictOrg_type = [], dictPclass = [], dictStatus = [], dictOwner = [], dictGrant = [];
var startFrom = 1000000, startTo = 0, endFrom = 1000000, endTo = 0;

var pclassColor = d3.scaleOrdinal(d3.schemeCategory20);

function scanValue() {
    
    var timeParse = d3.timeParse("%m/%d/%Y");

    data.forEach(function (d) {
        if (dictClass.indexOf(d.class) < 0) dictClass.push(d.class);
        if (dictOrg.indexOf(d.org) < 0) dictOrg.push(d.org);
        if (dictOrg_type.indexOf(d.org_type) < 0) dictOrg_type.push(d.org_type);
        if (dictPclass.indexOf(d.pclass) < 0) dictPclass.push(d.pclass);
        if (dictStatus.indexOf(d.status) < 0) dictStatus.push(d.status);
        if (dictOwner.indexOf(d.owner) < 0) dictOwner.push(d.owner);
        if (dictGrant.indexOf(d.grant) < 0) dictGrant.push(d.grant);

        d.startY = timeParse(d.start).getFullYear();
        d.endY = timeParse(d.end).getFullYear();

        if (d.startY < startFrom) startFrom = d.startY;
        if (d.startY > startTo) startTo = d.startY;
        
        if (d.endY < endFrom) endFrom = d.endY;
        if (d.endY > endTo) endTo = d.endY;
    });

    dictClass.sort();
    dictOrg.sort();
    dictOrg_type.sort();
    dictPclass.sort();
    dictStatus.sort();
    dictOwner.sort();
    dictGrant.sort();

    //var dict = dictOrg;
    
    //var html = "count: " + dict.length + "<br/><br/>";
    //dict.forEach(function (d) {
    //    html += d + "<br/>";
    //});
    
    //html += "<br/>start: " + startFrom + " - " + startTo;
    //html += "<br/>end: " + endFrom + " - " + endTo;

    //$container.html(html);

    initFilter(dictOwner, $("#divFilters ul[data-id='owner']"));
    initFilter(dictPclass, $("#divFilters ul[data-id='pclass']"));
    initFilter(dictOrg_type, $("#divFilters ul[data-id='org_type']"));
    initFilter(dictStatus, $("#divFilters ul[data-id='status']"));
    initFilter(dictGrant, $("#divFilters ul[data-id='grant']"));

    $("#divFilters ul[data-id='pclass'] > li").each(function() {
        d3.select(this).append("span").attr("class", "color").style("background-color", pclassColor(d3.select(this).select("span").text()));
    });
}

function initFilter(dict, ul) {
    var html = "";

    dict.forEach(function(d) {
        html += "<li class='active'><span>" + (d == null || d == "" ? "[empty]" : d) + "</span><a>[remove]</a></li>";
    });

    ul.html(html);
}

function refreshChart() {
    container.selectAll("*").remove();
    $("#divFilters ul[data-id='pclass'] .color").hide();
    
    var mode = $("#divDisplayModes .btn.active").attr("data-id");
    
    if (mode == "trend") {
        $("#divFilters ul[data-id='pclass'] .color").show();
        drawLines();
        return;
    }

    var items = [], valueDict = [], recordDict = [];
    var recordMin = 1000000, recordMax = 0, valueMax = 0;

    var itemDict = mode == "pclass" ? dictPclass : mode == "class" ? dictClass : dictOrg;

    itemDict.forEach(function (d) {
        valueDict[d] = 0;
        recordDict[d] = 0;
    });

    if (mode == "pclass") {
        chartData.forEach(function (d) {
            valueDict[d.pclass] += parseFloat(d.total);
            recordDict[d.pclass]++;
        });
        
    } else if (mode == "class") {
        chartData.forEach(function (d) {
            valueDict[d.class] += parseFloat(d.total);
            recordDict[d.class]++;
        });
        
    } else {
        chartData.forEach(function (d) {
            valueDict[d.org] += parseFloat(d.total);
            recordDict[d.org]++;
        });
    }

    $.each(itemDict, function (i, d) {
        var records = recordDict[d];
        if (records == 0) return;

        items.push({ id: i, name: (d == null || d == "" ? "[empty]" : d), value: valueDict[d], records: records });

        if (records < recordMin) recordMin = records;
        if (records > recordMax) recordMax = records;

        var value = valueDict[d];
        if (value > valueMax) valueMax = value;
    });

    $("#divDisplayModes > div").show();
    if (items.length == 0) return;
    
    $("#spanRecords").html(recordMin + " - " + recordMax);

    var w = $container.width(), h = $container.height();
    var r = Math.min(w, h);

    var color = d3.scaleLinear().domain([Math.sqrt(recordMin), Math.sqrt(recordMax)]).interpolate(d3.interpolateHslLong).range(['#007DB4', '#FFA600']);
    var zoom = d3.zoom().scaleExtent([1, 20]).on("zoom", zoomed);

    var pack = d3.pack().size([r, r]).padding(1);

    var root = d3.hierarchy({ children: items }).sum(function(d) { return d.value; });

    var svg = container.append("svg").attr("width", w).attr("height", h).attr("class", "bubble");
    var view = svg.append("g");

    var node = view.selectAll(".node")
        .data(pack(root).leaves()).enter().append("g").attr("class", "node").attr("opacity", 0)
        .attr("transform", function(d) { return "translate(" + d.x + "," + d.y + ")"; });

    node.attr("data-id", function (d) { return d.data.name; })
        .append("circle")
        .attr("id", function (d) { return "node" + d.data.id; })
        .attr("r", function(d) { return d.r; })
        .style("fill", function (d) { return color(Math.sqrt(d.data.records)); })
        .style("fill-opacity", function (d) { return 0.5 + (d.data.value / valueMax) * 0.5; });

    node.append("clipPath")
        .attr("id", function(d) { return "clip" + d.data.id; })
        .append("use")
        .attr("xlink:href", function (d) { return "#node" + d.data.id; });

    var text = node.append("text")
        .attr("clip-path", function(d) { return "url(#clip" + d.data.id + ")"; })
        .attr("opacity", function(d) { return d.r >= 40 ? 1 : 0; });

    var textSpan = text.selectAll("tspan")
        .data(function(d) {
            var parts = d.data.name.split(/(?=[A-Z][^A-Z])/g);
            parts.push("£" + d3.format(".2s")(d.data.value));
            return parts;
        })
        .enter().append("tspan")
        .attr("x", 0)
        .attr("y", function(d, i, nodes) { return 20 + (i - nodes.length / 2 - 0.5) * 15; })
        .text(function(d) { return d; });

    function zoomed() {
        view.attr("transform", d3.event.transform);

        text.style("font-size", (12 / d3.event.transform.k) + "px");
        textSpan.attr("y", function(d, i, nodes) { return (20 + (i - nodes.length / 2 - 0.5) * 15) / d3.event.transform.k; });

        text.transition().attr("opacity", function(d) { return d.r * d3.event.transform.k >= 40 ? 1 : 0; });
    }

    var tooltip = container.append("div").attr("class", "tooltip").attr("style", "display: none;");

    node
        .on("mouseover", function (d) {
            var pos = d3.mouse(container.node());
            tooltip
                .html("<label>" + d.data.name + "</label><br/>Number of Grants: " + d.data.records + "<br/>Total grant value: " + d3.format(",.2f")(d.data.value))
                .style("left", (pos[0] + 20) + "px").style("top", (pos[1] - 10) + "px").style("display", "inline");
        })
        .on("mouseout", function() {
            tooltip.style("display", "none");
        })
        .on("mousemove", function() {
            var pos = d3.mouse(container.node());
            tooltip.style("left", (pos[0] + 20) + "px").style("top", (pos[1] - 10) + "px");
        })
        .on("click", function() {
            var nodeMode = $("#divDisplayModes .btn.active").attr("data-id");
            var nodeId = d3.select(this).attr("data-id");
            
            var nodeItems;
            
            if (nodeMode == "pclass") {
                nodeItems = chartData.filter(function(d) { return d.pclass == nodeId; });
            } else if (nodeMode == "class") {
                nodeItems = chartData.filter(function (d) { return d.class == nodeId; });
            } else {
                nodeItems = chartData.filter(function (d) { return d.org == nodeId; });
            }

            nodeItems.sort(function (d1, d2) { return d2.total - d1.total; });

            $("#divDialog .title").html("Top grant");

            var html = "<table>";
            html += "<thead><tr><th>Project title</th><th>Organisation name</th><th>Year of start date</th><th>Total grant value</th></tr></thead>";
            html += "<tbody>";
            
            for (var i = 0; i < 5 && i < nodeItems.length; i++) {
                html += "<tr><td>" + nodeItems[i].title + "</td><td>" + nodeItems[i].org + "</td><td>" + nodeItems[i].startY + "</td><td>" + d3.format(",.2f")(nodeItems[i].total) + "</td></tr>";
            }
            
            html += "</tbody>";
            html += "</table>";

            $("#divDialog .body").html(html);
            $("#divDialog").addClass("active");
        });

    svg.call(zoom.transform, d3.zoomIdentity.translate((w - r) / 2, (h - r) / 2).scale(1));
    svg.call(zoom);

    node.transition().duration(1000).attr("opacity", 1);
}

function drawLines() {
    var items = [], valueDict = [], recordDict = [];

    dictPclass.forEach(function(d) {
        valueDict[d] = [];
        recordDict[d] = [];
    });

    chartData.forEach(function(d) {
        if (valueDict[d.pclass][d.startY] == null) {
            valueDict[d.pclass][d.startY] = parseFloat(d.total);
            recordDict[d.pclass][d.startY] = 1;

        } else {
            valueDict[d.pclass][d.startY] += parseFloat(d.total);
            recordDict[d.pclass][d.startY]++;
        }
    });

    var yearTo = Math.min(startTo, new Date().getFullYear());

    $.each(dictPclass, function(i, d) {
        var records = recordDict[d];
        if (records.length == 0) return;

        var item = { id: i, name: (d == null || d == "" ? "[empty]" : d), years: [] };

        for (var j = 2006; j <= yearTo; j++) {
            if (valueDict[d][j] != null) {
                item.years.push({ year: j, value: valueDict[d][j], records: recordDict[d][j] });
            }
        }

        items.push(item);
    });

    $("#divDisplayModes > div").hide();
    if (items.length == 0) return;

    var margin = { top: 50, right: 50, bottom: 80, left: 60 },
        width = $container.width() - margin.left - margin.right,
        height = $container.height() - margin.top - margin.bottom;

    var x = d3.scaleLinear().range([0, width]);
    var y = d3.scaleLinear().range([height, 0]);

    var line = d3.line().x(function (d) { return x(d.year); }).y(function (d) { return y(d.value); });

    x.domain([
        d3.min(items, function(d) { return d3.min(d.years, function(d1) { return d1.year; }); }),
        d3.max(items, function(d) { return d3.max(d.years, function(d1) { return d1.year; }); })
    ]);

    y.domain([
        d3.min(items, function (d) { return d3.min(d.years, function (d1) { return d1.value; }); }),
        d3.max(items, function (d) { return d3.max(d.years, function (d1) { return d1.value; }); })
    ]);

    var svg = container
        .append("svg").attr("width", $container.width()).attr("height", $container.height())
        .append("g").attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    svg.append("g").attr("class", "axis axis--x").attr("transform", "translate(0," + height + ")").call(d3.axisBottom(x).tickFormat(d3.format("d")))
        .append("text").attr("x", margin.left + width / 2 - 40).attr("y", 40).attr("fill", "#000").text("Year of start date");

    svg.append("g").attr("class", "axis axis--y").call(d3.axisLeft(y).tickFormat(d3.format(".2s")))
        .append("text").attr("transform", "rotate(-90)").attr("y", -45).attr("fill", "#000").text("Total Grant Value");

    var series = svg.selectAll(".line").data(items).enter().append("g").attr("class", "line");

    series.append("path").attr("d", function (d) { return line(d.years); }).style("stroke", function (d) { return pclassColor(d.name); });

    var vertical = container.append("div").attr("class", "vertical")
        .style("height", height + "px").style("top", margin.top + "px").style("left", margin.left + "px");
    
    var tooltip = container.append("div").attr("class", "tooltip").attr("style", "display: none; width: 200px;");
    var focus = container.append("div").attr("class", "focus").attr("style", "display: none;");

    container.select("svg")
        .on("mousemove", function () {
            var pos = d3.mouse(svg.node());
            var posx = pos[0], posy = pos[1];

            if (posx < 0 || posx > width) {
                vertical.style("display", "none");
                tooltip.style("display", "none");
                focus.style("display", "none");
                return;
            }

            if (posy < 0) posy = 0;
            if (posy > height) posy = height;

            vertical.style("display", "inline").style("left", (posx + margin.left) + "px");

            var year = Math.round(x.invert(posx)), value = y.invert(posy);
            var nearest = null;
            
            items.forEach(function (s) {
                s.years.forEach(function (s1) {
                    if (s1.year == year) {
                        if (nearest == null || Math.abs(nearest.year.value - value) > Math.abs(s1.value - value)) {
                            nearest = { item: s, year: s1 };
                        }
                    }
                });
            });

            if (nearest != null) {
                var html = "<label style='color: " + pclassColor(nearest.item.name) + "'>" + nearest.item.name + "</label>";
                html += "<br/><span>Year of start date: " + nearest.year.year + "</span>";
                html += "<br/><span>Number of Grants: " + nearest.year.records + "</span>";
                html += "<br/><span>Total grant value: " + d3.format(",.2f")(nearest.year.value) + "</span>";

                var tooltipX = width - posx < 220 ? (posx + margin.left - 230) : (posx + margin.left + 10);
                var tooltipY = (height - posy < 100 ? (height - 100) : posy) + margin.top;

                tooltip.html(html).style("left", tooltipX + "px").style("top", tooltipY + "px").style("display", "inline");
                
                focus
                    .style("background-color", pclassColor(nearest.item.name))
                    .style("left", Math.round(x(nearest.year.year) + margin.left - 5) + "px").style("top", Math.round(y(nearest.year.value) + margin.top - 5) + "px")
                    .style("display", "inline");
            }
        });
}

function refreshFilter() {
    var filterOwner = $("#divFilters ul[data-id='owner']").find("li.active > span").map(function () { return $(this).text(); }).get();
    var filterPclass = $("#divFilters ul[data-id='pclass']").find("li.active > span").map(function () { return $(this).text(); }).get();
    var filterOrg_type = $("#divFilters ul[data-id='org_type']").find("li.active > span").map(function () { return $(this).text(); }).get();
    var filterStatus = $("#divFilters ul[data-id='status']").find("li.active > span").map(function () { return $(this).text(); }).get();
    var filterGrant = $("#divFilters ul[data-id='grant']").find("li.active > span").map(function () { return $(this).text(); }).get();
    
    if (filterPclass.indexOf("[empty]") >= 0) {
        var pclassIndex = filterPclass.indexOf("[empty]");
        filterPclass[pclassIndex] = "";
    }

    chartData = [];

    var ignoreOwner = filterOwner.length == dictOwner.length;
    var ignorePclass = filterPclass.length == dictPclass.length;
    var ignoreOrg_type = filterOrg_type.length == dictOrg_type.length;
    var ignoreStatus = filterStatus.length == dictStatus.length;
    var ignoreGrant = filterGrant.length == dictGrant.length;

    data.forEach(function (d) {
        if (!ignoreOwner && filterOwner.indexOf(d.owner) < 0) return;
        if (!ignorePclass && filterPclass.indexOf(d.pclass) < 0) return;
        if (!ignoreOrg_type && filterOrg_type.indexOf(d.org_type) < 0) return;
        if (!ignoreStatus && filterStatus.indexOf(d.status) < 0) return;
        if (!ignoreGrant && filterGrant.indexOf(d.grant) < 0) return;

        chartData.push(d);
    });
    
    refreshChart();
}

$(document).ready(function () {
    $("#divDisplayModes .btn").click(function() {
        $("#divDisplayModes .btn.active").removeClass("active");
        $(this).addClass("active");

        refreshChart();
    });

    $("#divFilters ul").on("click", "a", function () {
        if ($(this).parent().hasClass("active")) {
            $(this).parent().removeClass("active");
            refreshFilter();
        }
        return false;
    });

    $("#divFilters ul").on("click", "li", function () {
        $(this).closest("ul").find("li.active").removeClass("active");
        $(this).addClass("active");
        refreshFilter();
        return false;
    });
    
    $("#divFilters label").on("click", "a", function () {
        $(this).parent().next().find("li").addClass("active");
        refreshFilter();
        return false;
    });
    
    $("#divDialog").click(function () {
        $("#divDialog").removeClass("active");
    });

    $("#divDialog .dialog-content").click(function () {
        return false;
    });

    $("#divDialog .dialog-close").click(function () {
        $("#divDialog").removeClass("active");
        return false;
    });

    d3.csv("data/PhysicsFunding2.csv", function (csv) {
        data = csv;
        chartData = csv;

        scanValue();

        $("#divDisplayModes .btn").first().click();
    });
});