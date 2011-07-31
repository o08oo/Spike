/* Spike
 *
 * An interactive spiking neural network simulator
 * https://github.com/akamaus/Spike/wiki
 *
 * Copyright 2011, Dmitry Vyal
 * Released under the GPLv2 license
 *
 * Date: Sun, 31 Jul 2011 22:49:45 +0400
 */

// Important constants
neuron_radius = 20;

// Coefficients of FitzHugh-Nagumo model
a = -0.7;
b = 0.8;
tau = 1/0.08;
// initial conditions
v0 = -0.9;
w0 = 0.24;

dt = 0.2;

manual_stimilus = 1;
link_weight = 0.5;
link_weight_max = 5;

tick_interval = 100;

// Language augmentation
Array.prototype.delete = function(obj) {
    var i = this.indexOf(obj);
    if (i >= 0)
        this.splice(i,1);
    return this;
};

// 2D point
function Pos(x,y) {
    this.x = x;
    this.y = y;
};
Pos.dist = function(p1,p2) {
    var dx = p1.x - p2.x,
        dy = p1.y - p2.y;
    return Math.sqrt(dx*dx + dy*dy);
};

Pos.prototype.toString = function() {
    return this.x + " " + this.y;
};

// Value scroller
function ValueRange(min, max, value) {
    this.min = min;
    this.max = max;
    this.value = value;
    this.step = (max - min) / 50.0;
}

ValueRange.prototype.move = function(d) {
    this.value += this.step * d;
    if (this.value < this.min) this.value = this.min;
    else if (this.value > this.max) this.value = this.max;
};

ValueRange.prototype.valueOf = function() {
    return this.value;
};

// mapping from [o1,o2] into [d1,d2]
function affine(o1,o2,d1,d2, x) {
    var p = (x-o1) / (o2-o1);
    return d1 + (d2-d1)*p;
};

function int_map(o1,o2,d1,d2, x) {
    var res = affine(o1,o2,d1,d2, x);
    if (d1<d2) {
        var min = d1,max = d2;
    } else
        var min = d2,max = d1;
    if (res < min) res = min;
    else if (res > max) res = max;
    return Math.round(res);
};

// Neuron related

function Neuron(x, y) {
    this.num = Neuron.new_num++;

    this.soma = this.paper.circle(x,y, neuron_radius);
    this.soma.neuron = this;
    this.soma.node.neuron = this;
    this.outgoing_links = [];
    this.incoming_links = [];

    this.v = v0; // potential
    this.w = w0; // stabilizer
    this.i = 0; // summary external current
    this.i_prev = 0; // summary external current

    this.neurons.push(this);

    this.soma.drag(Neuron.on_drag_move, Neuron.on_drag_start, Neuron.on_drag_stop);

    this.soma.dblclick(function() { this.neuron.stimulate(); });
    this.soma.click(function() {this.neuron.select(); });

    $(this.soma.node).bind("mousedown", Neuron.on_mouse_down);

    this.redraw();
}

Neuron.prototype.getPos = function() { return this.soma.getPos(); };
Neuron.prototype.setPos = function(p) { this.soma.setPos(p); };

Neuron.prototype.tick = function() {
    var v = this.v,
        w = this.w,
        i = this.i_prev; // incoming current from last tick
    var dv = v - v*v*v - w + i;
    var dw = (v - a - b*w)/tau;

    this.v += dv*dt;
    this.w += dw*dt;

    if (this.v > 0) // transmitting impulse
        for (i=0; i< this.outgoing_links.length; i++) {
            this.outgoing_links[i].n2.i += this.outgoing_links[i].weight * this.v;
        }
};

// Neuron UI

Neuron.on_drag_start = function() {
    this.opos = this.getPos();
    this.attr({'stroke-width': 3});
};

Neuron.on_drag_stop = function() {
    this.attr({'stroke-width': 1});
};

Neuron.on_drag_move = function(dx, dy) {
    this.setPos({x: this.opos.x + dx, y: this.opos.y + dy});
    $(this.neuron.outgoing_links).each(function(k,v) {v.redraw(); });
    $(this.neuron.incoming_links).each(function(k,v) {v.redraw(); });
};

Neuron.on_mouse_down = function(e) {
    switch(e.which) {
    case 2:
        var n1 = Neuron.selected,
        n2 = this.neuron;
        if (n1 && n1 != n2 && !Neuron.linked(n1,n2)) {
            new Link(n1,n2);
        }
        n2.select();
        break;
    case 3:
        this.neuron.remove();
        break;
    }
};

Neuron.prototype.stimulate = function() {
    this.v += manual_stimilus;
};

Neuron.prototype.select = function() {
    if (Neuron.selected) {
        Neuron.selected.soma.attr({"stroke-dasharray": ""});
    }
    Neuron.selected = this;
    Neuron.selected.soma.attr({"stroke-dasharray": "--"});

    Spike.update_stats();
};

Neuron.prototype.toString = function() {return "N " + this.num; };

Neuron.prototype.redraw = function() {
    this.soma.attr({fill: "rgb(" + int_map(-1.5,1.5, 0, 255, this.v) +"," + int_map(-1.5,1.5, 255, 0, this.v) +",0)"});
};

Neuron.linked = function(n1,n2) {
        for (i in n1.outgoing_links) {
        if (n1.outgoing_links[i].n2 === n2) return true;
    }
    return false;
};

Neuron.prototype.remove = function() {
    $(this.incoming_links).each(function(k,l) { l.remove(); });
    $(this.outgoing_links).each(function(k,l) { l.remove(); });
    this.neurons.delete(this);
    this.soma.remove();
};

// Link related
function Link(n1, n2) {
    this.n1 = n1;
    this.n2 = n2;
    n1.outgoing_links.push(this);
    n2.incoming_links.push(this);

    this.weight = new ValueRange(0, link_weight_max, link_weight);
    this.axon = this.paper.path();
    this.axon.link = this;
    this.axon.node.link = this;

    this.axon.attr({'stroke-width': 5});
    this.axon.attr({path: "M0 0"});

    this.axon.click(function() {this.link.select(); });
    $(this.axon.node).bind("mousedown", Link.on_mouse_down);
    $(this.axon.node).mousewheel(Link.on_wheel);

    this.redraw();
}

Link.on_mouse_down = function(e) {
    switch(e.which) {
        case 3:
        this.link.remove();
    }
};

Link.on_wheel = function(e,d) {
    this.link.weight.move(d);
    return false;
};

Link.prototype.select = function() {
    if (Link.selected) {
        Link.selected.axon.attr({"stroke-dasharray": ""});
    }
    Link.selected = this;
    Link.selected.axon.attr({"stroke-dasharray": "-"});
};

Link.prototype.remove = function() {
    this.n1.outgoing_links.delete(this);
    this.n2.incoming_links.delete(this);
    this.axon.remove();
};

Link.prototype.toString = function() { return this.n1 + " -> " + this.n2; };
Link.prototype.redraw = function() {
    this.axon.scale(1.,1.);
    this.axon.attr({path: "M" + this.n1.getPos() + "L" + this.n2.getPos()});
    var dist = Pos.dist(this.n1.getPos(),this.n2.getPos()),
        correction = (dist - 2 * neuron_radius) / dist;
    if (correction > 0)
        this.axon.scale(correction,correction);
};

function Spike() {
    this.neurons = [];
    this.links = [];
    this.paper = Raphael('main-bar', $('#mainbar').width(), $('#mainbar').height());

    Neuron.prototype.paper = this.paper;
    Neuron.prototype.neurons = this.neurons;
    Neuron.new_num = 1;
    Neuron.selected = undefined;
    Link.prototype.paper = this.paper;
    Link.prototype.links = this.links;

    Spike.setup_canvas(this.paper);

    $(window).focus(Spike.start_timer);
    $(window).blur(Spike.stop_timer);

    // binding handlers
    $("#main-bar").click(Spike.on_canvas_click);
    $(document).bind("contextmenu", function() {return false;});

    Spike.start_timer();
}

Spike.on_tick = function() {
    for (var i=1;i<=2; i++) {
        $(spike.neurons).each(function(k,n) {n.i_prev = n.i; n.i = 0; });
        $(spike.neurons).each(function(k,n) {n.tick(); });
    }
    $(spike.neurons).each(function(k,n) {n.redraw(); });

    Spike.update_stats();
};

Spike.start_timer = function() {
    if (!Spike.timer)
        Spike.timer = setInterval(Spike.on_tick, tick_interval);
};

Spike.stop_timer = function() {
    if (Spike.timer) {
        clearInterval(Spike.timer);
        Spike.timer = undefined;
    }
};

Spike.update_stats = function() {
    var neuron_stats = "";
    var link_stats = "";

    if (Neuron.selected) {
        neuron_stats += 'Id: ' + Neuron.selected + "<br/>";
        neuron_stats += 'V: ' + Neuron.selected.v.toFixed(2) + "<br/>";
    }
    if(Link.selected) {
        link_stats += 'Id: ' + Link.selected + "<br/>";
        link_stats += 'Weight: ' + Link.selected.weight.valueOf().toFixed(2) + "<br/>";
    }

    $('#neuron-stats').html(neuron_stats);
    $('#link-stats').html(link_stats);

};

// handlers
Spike.on_canvas_click = function(e) {
    var x = e.pageX - $("svg").offset().left;
    var y = e.pageY - $("svg").offset().top;

    if(e.originalEvent.explicitOriginalTarget.tagName == "svg")
        new Neuron(x, y);
};

Spike.setup_canvas =function(paper) {
    var c = paper.circle(0,0,1);
    c.__proto__.getPos = function() {
        return new Pos(this.attr("cx"), this.attr("cy"));
    };
    c.__proto__.setPos = function(pos) {
        this.attr({cx: pos.x, cy: pos.y});
    };
};

$(document).ready(
    function() {
        window.spike = new Spike();
        $('#help-toggle').click(function() { $('#help').toggle(); });
    });
