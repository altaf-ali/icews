/**
 * Created by altaf on 02/04/15.
 */

var currentIndex = 0;
var intervalId = 0;
var timerInterval = 300;
var eventTable = [];
var slider = null;
var isPlaying = false;
var sliderMargin = 20;
var timeScale = null;

var startYear = 1995;
var endYear = 2014;

var projection = d3.geo.robinson()
    .scale(160)
    .precision(.1);

var path = d3.geo.path()
    .projection(projection);

var zoom = d3.behavior.zoom()
    .translate([0, 0])
    .scale(1)
    .scaleExtent([1, 8])
    .on("zoom", zoomed);

var fontScale = d3.scale.log()
    .domain([1, 8])
    .range([2, 3]);

var radius = d3.scale.log()
    .domain([1, 5000])
    .range([1, 5]);

var colorScale = d3.scale.quantize()
    .range(colorbrewer.RdYlGn[10])
    .domain([-10, 10]);

var svg = d3.select("#map-container").append("svg");

var map = svg.append("g")
    .attr("id","map");

svg
    .call(zoom) // delete this line to disable free zooming
    .call(zoom.event);

var opts = {
  lines: 13, // The number of lines to draw
  length: 20, // The length of each line
  width: 10, // The line thickness
  radius: 30, // The radius of the inner circle
  corners: 1, // Corner roundness (0..1)
  rotate: 0, // The rotation offset
  direction: 1, // 1: clockwise, -1: counterclockwise
  color: '#000', // #rgb or #rrggbb or array of colors
  speed: 1, // Rounds per second
  trail: 60, // Afterglow percentage
  shadow: false, // Whether to render a shadow
  hwaccel: false, // Whether to use hardware acceleration
  className: 'spinner', // The CSS class to assign to the spinner
  zIndex: 2e9, // The z-index (defaults to 2000000000)
  top: '50%', // Top position relative to parent
  left: '50%' // Left position relative to parent
};

var target = document.getElementById('container');
var spinner = new Spinner(opts).spin(target);

var q = queue()
    .defer(d3.json, "topo/world-topo-110m.json");

for (var year = startYear; year <= endYear ; year++) {
    q.defer(d3.json, "events/events.counts." + year + ".json")
}

q.awaitAll(ready);

function ready(error, data) {
    var topo = data[0]

    for (var i = 1; i < data.length; i++) {
        eventTable.push.apply(eventTable, data[i])
    }

    var firstDate = new Date(eventTable[0].Year, eventTable[0].Month-1);
    var lastDate = new Date(eventTable[eventTable.length-1].Year, eventTable[eventTable.length-1].Month-1);
    timeScale = d3.time.scale().domain([firstDate, lastDate]).range([0,700]);

    spinner.stop()

    drawMap(topo);
    drawSlider();

    d3.select("button#play-button")
        .attr("title","Play")
        .on("click",function() {
            togglePlayButton()
        });

    d3.select("button#backward-button")
        .attr("title","Step Backward")
        .on("click",function() {
            singleStep(-1)
        });

    d3.select("button#forward-button")
        .attr("title","Step Forward")
        .on("click",function() {
            singleStep(1)
        });

    showEvents(0);
}

function getAxisLabel(year, month) {
    var monthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return monthLabels[month-1] + " " + year;
}

function sliderProbe() {
    var d = timeScale.invert((d3.mouse(this)[0]));
    d3.select("div#slider-probe")
        .style("left", d3.mouse(this)[0] + "px")
        .style("display","block")
        .select("p")
            .html(getAxisLabel(d.getFullYear(), d.getMonth() +1))
}

function drawMap(worldmap) {
    map.append("path")
        .datum(topojson.feature(worldmap, worldmap.objects.countries))
        .attr("d", path);

    map.selectAll(".country")
        .data(topojson.feature(worldmap, worldmap.objects.countries).features)
        .enter().append("path")
        .attr("class", function(d) { return "country " + d.properties.name; })
        .attr("d", path);

    map.selectAll(".country-label")
        .data(topojson.feature(worldmap, worldmap.objects.countries).features)
        .enter().append("text")
        .attr("class", function(d) { return "country-label " + d.properties.name; })
        .attr("transform", function(d) { return "translate(" + path.centroid(d) + ")"; })
        .attr("dy", ".35em")
        .text(function(d) { return d.properties.name; });
}

function drawSlider() {

    var initialValue = 0
    var dataScale = d3.scale.linear().domain([0, eventTable.length-1])

    slider = d3.slider()
        .scale(dataScale)
        .on("slide", function(event, value) {
            currentIndex = value;
            showEvents(currentIndex)
        })
        .on("slideend", function(event, value) {
        })
        .value(0);

    d3.select("#slider-control")
        .append("div")
        .attr("id","slider")
        .style("width",timeScale.range()[1] + "px")
        .on("mousemove", sliderProbe)
        .on("mouseout",function(){
            d3.select("#slider-probe").style("display","none");
        })
        .call(slider);

    var axis = d3.svg.axis()
        .scale(timeScale)
        .tickValues(timeScale.ticks(eventTable.length).filter(function(d, i) {
            // ticks only for beginning of each year, plus first and last
            return d.getMonth() == 0 || i == 0;
        }))
        .tickFormat(function(d) {
            // abbreviated year for most, full month/year for the ends
            if ( d.getMonth() == 0 ) return "'" + d.getFullYear().toString().substr(2);
            return getAxisLabel(d.getYear(), d.getMonth());
        })
        .tickSize(10)

    d3.select("#axis").remove();

    d3.select("#slider-control")
        .append("svg")
        .attr("id","axis")
        .attr("width",timeScale.range()[1] + sliderMargin*2 )
        .attr("height",25)
        .append("g")
        .attr("transform","translate(" + (sliderMargin+1) + ",0)")
        .call(axis);

    d3.select("#axis > g g:first-child text").attr("text-anchor","end").style("text-anchor","end");
    d3.select("#axis > g g:last-of-type text").attr("text-anchor","start").style("text-anchor","start");
}

function projectionCoordinates(d) {
    return projection([d.Longitude, d.Latitude])
}

function timerCallback() {

    slider.value(currentIndex);

    try {
        showEvents(currentIndex++);
    }

    catch(err) {
        console.log("exception caught: " + err)
    }

    finally {
        if (currentIndex >= eventTable.length) {
            currentIndex = 0;
            togglePlayButton()
        }
    }
}

function togglePlayButton() {
    var title = "Play";

    if (isPlaying) {
        clearInterval(intervalId)
    } else {
        title = "Pause";
        intervalId = setInterval(timerCallback, timerInterval)
    }

    isPlaying = !isPlaying;

    d3.select("button#play-button span")
        .classed({'glyphicon-play': !isPlaying, 'glyphicon-pause': isPlaying})
        .attr("title", title);

}

function singleStep(step) {
    if (!isPlaying) {
        var newIndex = currentIndex + step
        if (newIndex > 0 && newIndex < eventTable.length) {
            currentIndex = newIndex;
            showEvents(currentIndex);
            slider.value(currentIndex);
        }
    }
}

function showEvents(index) {

    var data = eventTable[Math.round(index)]

    d3.select("#status-control p#date").html(getAxisLabel(data.Year, data.Month));

    var circle = map.selectAll("circle")
        .data(data.Events)

    circle.exit().remove();

    circle.enter()
        .append("circle")
        .sort(function(a, b) { return b.Count - a.Count; })
        .style("fill", function(d) { return colorScale(d.Intensity); })
        .attr("r", function(d) { return radius(d.Count +1); })
        .attr("cx", function(d) { return projectionCoordinates(d)[0]; })
        .attr("cy", function(d) { return projectionCoordinates(d)[1]; });

    circle
        .sort(function(a, b) { return b.Count - a.Count; })
        .style("fill", function(d) { return colorScale(d.Intensity); })
        .attr("r", function(d) { return radius(d.Count +1); })
        .attr("cx", function(d) { return projectionCoordinates(d)[0]; })
        .attr("cy", function(d) { return projectionCoordinates(d)[1]; });
}

function showEvents_WithTransition(index) {

    var data = eventTable[Math.round(index)]

    d3.select("#status-control p#date").html(getAxisLabel(data.Year, data.Month));

    var circle = map.selectAll("circle")
        .data(data.Events)
        .sort(function(a, b) { return b.Count - a.Count; });

    // update *before* enter
    circle.transition()
        .duration(750)
        .attr("r", function(d) { return radius(d.Count); })
        .style("fill", function(d) { return colorScale(d.Intensity); });

    circle.enter()
        .append("circle")
        .attr("cx", function(d) { return projectionCoordinates(d)[0]; })
        .attr("cy", function(d) { return projectionCoordinates(d)[1]; })
        .attr("r", 0)
        .style("fill", function(d) { return colorScale(d.Intensity); })
        .transition()
        .attr("r", function(d) { return radius(d.Count); });

    circle.exit()
        .transition()
        .duration(750)
        .attr("r", 0)
        .remove();
}

function zoomed() {
    map.selectAll(".country-label")
        .style("font-size", function(d) { return fontScale(zoom.scale()) + "px"; } );

    map.style("stroke-width", 1.5 / d3.event.scale + "px");
    map.attr("transform", "translate(" + d3.event.translate + ")scale(" + d3.event.scale + ")");
}

