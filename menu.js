var createMenu = require("terminal-menu");
var is = require("is");
var copy = function(o) { return JSON.parse(JSON.stringify(o)); };

var Menu = function(name, program) {
  this.setup(name, program);
};

Menu.prototype = {
  setup: function(name, program) {
    this.name = name;
    this.program = program;
    this.operations = [];
    this.selectables = [];
    this.radios = {};
    this._radios = {};
    this.options = {};
    this._options = {};
  },
  schedule: function(fn) {
    setTimeout(fn.bind(this), 1);
  },
  cacheOptions: function() {
    this._options = copy(this.options);
    this._radios = copy(this.radios);
  },
  restoreOptions: function() {
    this.options = copy(this._options);
    this.radios = copy(this._radios);
    this.selectables.forEach(function(op) { 
      if (op.type == 'checkbox') {
        op.toggled = this.options[op.content]; 
      } else if (op.type == 'radio') {
        op.toggled = this.radios[op.content];
      } 
    }.bind(this));
  },
  start: function() {
    this.menu = createMenu({
      width: process.stdout.columns - 4,
      height: process.stdout.rows - 4,
      x: 0,
      y: 0
    });
    this.menu.reset();
    this.menu.createStream().pipe(process.stdout);
  },
  reset: function() {
    if(this.menu) {
      this.menu.reset();
      this.setup(this.name, this.program);
    }
  },
  close: function() {
    if(this.menu) {
      this.menu.reset();
      this.menu.close(true); // keep input tied to the menu system
    }
  },


  text: function(s) {
    var label = s + "\n";
    this.operations.push({
      type: "text",
      content: label
    });
  },
  spacer: function(s) {
    this.text('');
  },
  option: function(s, n, callback) {
    var op = { type: "option", content: s, data: s, screen: n, callback: callback };
    if (is.object(s) && 'lable' in s) {
      op.content = s.lable;
    } else {
      op.content = s;
    }
    this.addSelectable(op);
  },
  check: function(s, toggled, callback) {
    if(typeof toggled === "function") {
      callback = toggled;
      toggled = false;
    }
    var op = { type: "checkbox", content: s, toggled: toggled, callback: callback };
    this.addSelectable(op);
    this.options[s] = toggled;
  },
  radio: function(s, toggled, callback) {
    if(typeof toggled === "function") {
      callback = toggled;
      toggled = false;
    }
    var op = { type: "radio", content: s, toggled: toggled, callback: callback };
    this.addSelectable(op);
    this.radios[s] = toggled; 
  },
  confirm: function(label, nextScreen, callback) {
    if(typeof nextScreen === "function") {
      callback = nextScreen;
      nextScreen = false;
    }
    var op = { type: "confirm", content: label, screen: nextScreen, callback: callback };
    this.addSelectable(op);
  },
  cancel: function(label, prevScreen, callback) {
    if(typeof prevScreen === "function") {
      callback = prevScreen;
      prevScreen = false;
    }
    var op = { type: "cancel", content: label, screen: prevScreen, callback: callback };
    this.addSelectable(op);
  },


  addSelectable: function(op) {
    this.operations.push(op);
    this.selectables.push(op);
  },
  handler: function(label) {
    var entry, idx;
    this.selectables.forEach(function(op, i) {
      if(op.label === label) { entry = op; idx = i; }
    });
    if(entry) {
      if(entry.type === "checkbox") {
        entry.toggled = !entry.toggled;
        this.options[entry.content] = entry.toggled;
        if(entry.callback) { entry.callback(entry.toggled); }
        return this.draw(idx);
      }
      if(entry.type === "radio") {
        for (var key in this.radios) {
          this.radios[key] = false;
        }
        this.selectables.forEach(function (op) {
          if (op.type === "radio") {
            op.toggled = false;
          }
        });
        entry.toggled =  true;
        this.radios[entry.content] = true;
        if(entry.callback) { entry.callback(entry.toggled); }
        return this.draw(idx);
      }
      if(entry.type === "option") {
        this.departureidx = idx;
        if(entry.screen) {
          this.schedule(function() {
            this.program.run(entry.screen);
          });
        }
        if(entry.callback) {
          entry.callback(entry.data);
        }
      }
      if(entry.type === "confirm") {
        if(entry.callback) {
          entry.callback(copy({options: this.options, radios: this.radios}));
        }
        if(entry.screen) {
          this.program.run(entry.screen);
        }
      }
      if(entry.type === "cancel") {
        this.restoreOptions();
        if(entry.callback) {
          entry.callback(copy(this.options));
        }
        if(entry.screen) {
          this.program.run(entry.screen);
        }
      }
    }
  },
  draw: function(optionidx) {
    this.close();
    this.start();
    var menu = this.menu;

    if(arguments[0] === undefined) { this.cacheOptions(); }
    optionidx = optionidx || this.departureidx || this.defaultidx || 0;
    delete this.departureidx;

    this.operations.forEach(function(op, idx) {
      var label = op.content;
      switch(op.type) {
        case "text": menu.write(label); break;
        case "option":
        case "confirm":
        case "cancel": label = "[" + label + "]"; menu.add(label); break;
        case "checkbox": label = "[" + (op.toggled ? '√' : ' ') + "] " + label; menu.add(label); break;
        case "radio": label = "[" + (op.toggled ? '●' : ' ') + "] " + label; menu.add(label); break;
      }
      op.label = label;
      if(idx === optionidx) { menu.jump(idx); }
    });
    menu.on('select', this.handler.bind(this));
  }
};

module.exports = Menu;
