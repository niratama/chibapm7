/* global module, define, $ */
(function (undefined) {
  'use strict';
  var global = this,
      hasModule = (typeof module !== 'undefined' && module.exports &&
        typeof require !== 'undefined');

  var Timer = function () { this.init.apply(this, arguments); };
  Timer.prototype = {
    init: function (el, config) {
      this.el = el;
      var cfg = $.extend({limit: 300000, period: 1000}, config);
      this.limit = cfg.limit;
      this.period = cfg.period;
      this._events = [];
      this._eventsByName = {};
      this._timerEvents = [];
      this._timer = null;
      this.reset();
    },
    reset: function () {
      if (this.isRunning()) {
        this.stop();
      }
      this.current = 0;
      this.idealCurrent = 0;
      this._startAt = null;
      this._stopAt = null;
      this._initEvents();
      this.trigger('reset');
      this._checkTimerEvents();
    },
    progress: function () {
      var progress = (this.current / this.limit) * 100;
      if (progress > 100) {
        return 100;
      }
      return progress;
    },
    isRunning: function () {
      return this._timer !== null;
    },
    _eventTime: function (name) {
      if (typeof name !== 'number') {
        if (name === 'period') {
          return null;
        } else if (name === 'begin') {
          name = 0;
        } else if (name === 'end') {
          name = this.limit;
        }
        var match = name.match(/^(-?\d+(\.\d+)?)%$/);
        if (match) {
          name = this.limit * match[1] / 100;
        } else {
          name = Number(name);
          if (Number.isNaN(name)) {
            return null;
          }
        }
      }
      if (name < 0) {
        name = this.limit - name;
      }
      return name;
    },
    on: function (name, callback) {
      this._events.push({
        event: name,
        callback: callback,
      });
    },
    trigger: function (name) {
      var self = this;
      var events = this._eventsByName[name];
      if (events) {
        events.forEach(function (event) {
          var args = Array.prototype.slice.call(arguments, 1);
          args.unshift(event);
          event.callback.apply(self, args);
        });
      }
    },
    _initEvents: function () {
      var self = this;
      this._timerEvents = [];
      this._eventsByName = {};
      var tevents = [];
      this._events.forEach(function (event) {
        var eventTime = self._eventTime(event.event);
        if (eventTime !== null) {
          tevents.push({
            event: event.event,
            eventTime: eventTime,
            callback: event.callback
          });
        }
        if (self._eventsByName[event.event] === void 0) {
          self._eventsByName[event.event] = [];
        }
        self._eventsByName[event.event].push(event);
      });
      this._timerEvents = tevents.sort(function (a, b) {
        return a.eventTime - b.eventTime;
      });
    },
    _checkTimerEvents: function () {
      var self = this;
      while (this._timerEvents.length > 0) {
        var event = this._timerEvents[0];
        if (self.current < event.eventTime) {
          break;
        }
        event.callback.call(self, event);
        this._timerEvents.splice(0, 1);
      }
      this.trigger('progress');
    },
    start: function () {
      var self = this;
      if (this.isRunning()) {
        return;
      }
      if (this.current >= this.limit) {
        return;
      }
      if (this._stopAt === null) {
        this.reset();
        this._startAt = Date.now();
      } else {
        this._startAt = Date.now() - (this._stopAt - this._startAt);
        this._stopAt = null;
      }
      this.realCurrent = this.current;
      this.realPeriod = this.period;
      this._timer = setTimeout(function () {
        self._interval();
      }, this.realPeriod);
      this.trigger('start');
    },
    _interval: function () {
      var self = this;
      this.current += this.period;
      var realCurrent = Date.now() - this._startAt;
      var realPeriod = realCurrent - this.realCurrent;
      this.realPeriod = Math.round(
        (this.period + this.current - realCurrent) *
         this.realPeriod / realPeriod);
      this.realCurrent = realCurrent;
      this._timer = setTimeout(function () {
        self._interval();
      }, this.realPeriod);
      this._checkTimerEvents();
      if (this.current >= this.limit) {
        this.stop();
      }
    },
    stop: function () {
      if (this.isRunning()) {
        clearInterval(this._timer);
        this._timer = null;
        this._stopAt  = Date.now();
        this.trigger('stop');
      }
    }
  };

  var PageBar = function () { this.init.apply(this, arguments); };
  PageBar.prototype = {
    init: function (el, config) {
      this.el = el;
      var cfg = $.extend({total: 100, current: 1}, config);
      this.total = cfg.total;
      this.current = cfg.current;
      this.update();
    },
    update: function () {
      var progress = (this.current / this.total) * 100;
      this.el.css({ width: progress + '%' });
    },
    next: function () {
      if (this.current < this.total) {
        this.current++;
      }
      this.update();
    },
    previous: function () {
      if (this.current > 1) {
        this.current--;
      }
      this.update();
    },
    page: function (p) {
      if (p >= 1 && p <= this.total) {
        this.current = p;
      }
      this.update();
    }
  };

  var ProgressPanel = function () { this.init.apply(this, arguments); };
  ProgressPanel.prototype = {
    init: function (el, config) {
      var self = this;
      this.el = el;
      var cfg = $.extend({timer: {}, page: {}}, config);
      this.timer = new Timer(cfg.timer);
      this.timerBar = el.find('.bar-timer');
      this.timer.on('progress', function () {
        self.timerBar.css({ width: this.progress() + '%' });
      });
      this.timer.on(0, function () {
        self.timerBar.css({'background-color': 'green'});
      });
      this.timer.on('66%', function () {
        self.timerBar.css({'background-color': 'yellow'});
      });
      this.timer.on('90%', function () {
        self.timerBar.css({'background-color': 'red'});
      });
      this.timer.reset();
      this.page = new PageBar(el.find('.bar-page'), cfg.page);
    },
    resize: function () {
      // pass
    },
    showSlideHandler: function () {
      var self = this;
      return function (slide) {
        if (!self.timer.isRunning()) {
          self.timer.start();
        }
        self.page.page(slide.getSlideIndex());
      };
    }
  };

  if (hasModule) {
    module.exports = ProgressPanel;
  } else if (typeof defined == 'function' && define.amd) {
    define('ProgressPanel', function () {
      return ProgressPanel;
    });
  } else {
    global.ProgressPanel = ProgressPanel;
  }
}).call(this);

/* vi:set sts=2 sw=2 et: */
/*
  $(function() {
    var slideshow = remark.create();
    var panel = new ProgressPanel($("#progress-panel"), {
      timer: {
      },
      page: {
        total: slideshow.getSlideCount(),
        current: slideshow.getCurrentSlideNo()
      }
    });
    slideshow.on('showSlide', function (slide) {
      if (!panel.timer.isRunning()) {
        panel.timer.start();
      }
      panel.page.page(slide.getSlideIndex());
    });
  });
*/
